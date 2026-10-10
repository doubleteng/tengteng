import { GitHub } from '../admin/github.mjs';
import { allowedFile, parseSource } from '../admin/document.mjs';
import { OWNER_ID, REPO_ID, REPO, SITE, SESSION_COOKIE, FLOW_COOKIE, now, random, hash, seal, unseal, cookie, cookies, fail, sameOrigin, boundedJSON } from './security.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const redirect = (path, values = []) => { const headers = new Headers({ Location: path }); values.forEach(value => headers.append('Set-Cookie', value)); return new Response(null, { status: 303, headers }); };
function page(title, content, status = 200) {
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} · Content Studio</title><style>html{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef0ec;color:#273d31;font:16px/1.7 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,480px);padding:44px;background:#fff;border:1px solid #dae0d7;border-radius:18px;box-shadow:0 20px 70px #193d2010}.brand{font-size:13px;letter-spacing:.12em;color:#748471}h1{font-size:28px;letter-spacing:-.04em;line-height:1.25;margin:24px 0 12px}p{color:#687568}a{color:#35533b}button,.action{display:block;width:100%;border:0;border-radius:8px;padding:14px 18px;background:#284a34;color:white;font:inherit;text-align:center;text-decoration:none;cursor:pointer;margin:26px 0 12px}small{display:block;color:#7a8577;font-size:12px}code{font-size:14px}.footer{margin-top:28px;font-size:13px}</style><main><div class="brand">TT / CONTENT STUDIO</div><h1>${esc(title)}</h1>${content}<div class="footer"><a href="${SITE}">返回 Teng Teng 网站 ↗</a></div></main></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function headers(response, nonce) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'no-store, private');
  result.headers.set('Referrer-Policy', 'no-referrer');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  result.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  result.headers.set('Content-Security-Policy', `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline' ${SITE}; img-src https: data: blob:; media-src https: blob:; font-src 'self' ${SITE}; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self' ${SITE}; form-action 'self' https://github.com`);
  return result;
}
export function createWorker({ fetcher = globalThis.fetch.bind(globalThis) } = {}) {
  const repositoryClient = token => {
    const api = new GitHub((url, options) => fetcher(url, { ...options, redirect:'manual', headers:{ 'User-Agent':'Teng-Content-Studio', ...options.headers } }));
    api.token = token; return api;
  };
  async function github(path, token, options = {}) {
    const response = await fetcher('https://api.github.com' + path, { ...options, redirect: 'manual', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Teng-Content-Studio', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.body ? { 'Content-Type':'application/json' } : {}) } });
    if (!response.ok) fail(response.status === 401 ? 401 : 403, 'GitHub 未授权。请检查应用已安装到 tengteng 仓库，再重新登录。');
    return response.json();
  }
  async function app(env) {
    const row = await env.DB.prepare('SELECT value FROM studio_settings WHERE key = ?').bind('github').first();
    return row ? unseal(row.value, env.SESSION_SECRET, 'github-app') : null;
  }
  async function startFlow(env, kind) {
    const state = random(), binding = random(), verifier = random(), expires = now() + 600;
    await env.DB.prepare('DELETE FROM studio_flows WHERE expires < ?').bind(now()).run();
    await env.DB.prepare('INSERT INTO studio_flows (id, binding, kind, payload, expires) VALUES (?, ?, ?, ?, ?)').bind(await hash(state), await hash(binding), kind, await seal({ verifier }, env.SESSION_SECRET, 'flow'), expires).run();
    return { state, verifier, cookie: cookie(FLOW_COOKIE, binding, 600) };
  }
  async function finishFlow(request, env, kind) {
    const state = new URL(request.url).searchParams.get('state'), binding = cookies(request)[FLOW_COOKIE];
    if (!/^[\w-]{43}$/.test(state || '') || !/^[\w-]{43}$/.test(binding || '')) fail(400, '登录验证已失效，请重新开始。');
    // Check browser binding and consume in ONE query; a code cannot be replayed.
    const row = await env.DB.prepare('DELETE FROM studio_flows WHERE id = ? AND binding = ? AND kind = ? AND expires > ? RETURNING payload').bind(await hash(state), await hash(binding), kind, now()).first();
    if (!row) fail(400, '登录验证已失效，请重新开始。');
    return unseal(row.payload, env.SESSION_SECRET, 'flow');
  }
  async function session(request, env) {
    const id = cookies(request)[SESSION_COOKIE]; if (!/^[\w-]{43}$/.test(id || '')) return null;
    const digest = await hash(id);
    const row = await env.DB.prepare('SELECT * FROM studio_sessions WHERE id = ? AND expires > ? AND touched > ?').bind(digest, now(), now() - 1800).first();
    if (!row || row.user_id !== OWNER_ID) return null;
    await env.DB.prepare('UPDATE studio_sessions SET touched = ? WHERE id = ?').bind(now(), digest).run();
    return { ...row, token: await unseal(row.token, env.SESSION_SECRET, 'github-token') };
  }
  async function owner(token) {
    const user = await github('/user', token);
    if (user.id !== OWNER_ID) fail(403, '这个后台只允许 doubleteng 的 GitHub 账号登录。');
    const repo = await github('/repos/' + REPO, token);
    if (repo.id !== REPO_ID || !repo.permissions?.push) fail(403, '请把 GitHub App 安装到 tengteng 仓库并授予 Contents 读写权限。');
    return user;
  }
  function csrf(request, current) { sameOrigin(request); if (request.headers.get('X-CSRF-Token') !== current.csrf) fail(403, '验证已失效，请刷新后台。'); }
  async function route(request, env, nonce) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (url.protocol !== 'https:') fail(400, '请使用 HTTPS 打开后台。');
    if (env.ADMIN_ORIGIN && url.origin !== env.ADMIN_ORIGIN) fail(403, '请使用配置的后台地址。');
    if (!env.DB || !/^[a-f0-9]{64}$/i.test(env.SESSION_SECRET || '')) return page('登录服务尚未配置', '<p>请先完成服务端部署配置，再启用 GitHub 登录。</p>', 503);
    if (['/', '/login'].includes(path) && method === 'GET') {
      const current = await session(request, env); if (current) return redirect('/admin/');
      const configured = await app(env);
      return page('管理你的网站', configured
        ? '<p>使用你的 GitHub 账号登录，继续编辑和预览内容。</p><a class="action" href="/auth/github">使用 GitHub 登录</a><small>仅限 doubleteng · 登录后才可进入编辑器</small>'
        : '<p>首次使用需要创建专属 GitHub App，并仅授权 tengteng 仓库。</p><a class="action" href="/setup">开始配置 GitHub 登录</a><small>配置完成后，只需点击 GitHub 登录。</small>');
    }
    if (path === '/setup' && method === 'GET') {
      const config = await app(env); if (config) return redirect('/install');
      return page('连接你的 GitHub', '<p>使用 <code>doubleteng</code> 账号创建专属应用，然后只选择 <code>tengteng</code> 仓库。</p><p>应用只申请 Contents 读写权限，用于读取内容和发布经你确认的修改。</p><form method="post" action="/setup"><button>在 GitHub 创建应用</button></form><small>密钥由服务端接收和加密保管，无需复制令牌。</small>');
    }
    if (path === '/setup' && method === 'POST') {
      sameOrigin(request); if (await app(env)) return redirect('/login');
      const flow = await startFlow(env, 'setup');
      const manifest = { name: 'Doubleteng Content Studio', url: SITE, redirect_url: url.origin + '/auth/setup/callback', callback_urls: [url.origin + '/auth/github/callback'], setup_url: url.origin + '/login', public: false, default_permissions: { contents:'write' }, default_events: [], hook_attributes: { url:url.origin + '/webhook', active:false }, request_oauth_on_install:false };
      const response = page('确认应用权限', `<p>GitHub 将显示应用名称和权限。完成创建后，你会返回这里选择仓库。</p><form action="https://github.com/settings/apps/new?state=${flow.state}" method="post"><input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}"><button>继续到 GitHub</button></form>`);
      response.headers.append('Set-Cookie', flow.cookie); return response;
    }
    if (path === '/auth/setup/callback' && method === 'GET') {
      await finishFlow(request, env, 'setup');
      if (await app(env)) return redirect('/login', [cookie(FLOW_COOKIE, '', 0)]);
      const code = url.searchParams.get('code'); if (!/^[a-zA-Z0-9_-]{10,200}$/.test(code || '')) fail(400, 'GitHub 未完成应用创建。');
      const config = await github('/app-manifests/' + code + '/conversions', null, { method: 'POST' });
      if (config.owner?.id !== OWNER_ID || !config.client_id || !config.client_secret || !/^[a-z0-9-]+$/.test(config.slug || '')) fail(403, '请使用 doubleteng 账号创建应用。');
      // Do not persist the app private key or webhook secret: neither is needed.
      const value = await seal({ clientId:config.client_id, clientSecret:config.client_secret, slug:config.slug }, env.SESSION_SECRET, 'github-app');
      await env.DB.prepare('INSERT OR IGNORE INTO studio_settings (key, value) VALUES (?, ?)').bind('github', value).run();
      return redirect('/install', [cookie(FLOW_COOKIE, '', 0)]);
    }
    if (path === '/install' && method === 'GET') {
      const config = await app(env); if (!config) return redirect('/setup');
      return page('只授权网站仓库', `<p>在 GitHub 选择 <code>Only select repositories</code>，仅勾选 <code>tengteng</code>，完成后返回登录。</p><a class="action" href="https://github.com/apps/${esc(config.slug)}/installations/new">选择 tengteng 仓库</a><a href="/login">已完成安装，去登录 →</a>`);
    }
    if (path === '/auth/github' && method === 'GET') {
      const config = await app(env); if (!config) return redirect('/setup');
      const flow = await startFlow(env, 'login');
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.search = new URLSearchParams({ client_id:config.clientId, redirect_uri:url.origin + '/auth/github/callback', login:'doubleteng', state:flow.state, code_challenge:await hash(flow.verifier), code_challenge_method:'S256' }).toString();
      return redirect(authorize.href, [flow.cookie]);
    }
    if (path === '/auth/github/callback' && method === 'GET') {
      const flow = await finishFlow(request, env, 'login');
      if (url.searchParams.has('error')) return redirect('/login', [cookie(FLOW_COOKIE, '', 0)]);
      const code = url.searchParams.get('code'); if (!/^[a-zA-Z0-9_-]{10,200}$/.test(code || '')) fail(400, 'GitHub 登录未完成，请重试。');
      const config = await app(env); if (!config) fail(503, 'GitHub 应用尚未配置。');
      const response = await fetcher('https://github.com/login/oauth/access_token', { method:'POST', redirect:'manual', headers:{ Accept:'application/json', 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ client_id:config.clientId, client_secret:config.clientSecret, code, redirect_uri:url.origin + '/auth/github/callback', code_verifier:flow.verifier, repository_id:String(REPO_ID) }) });
      if (!response.ok) fail(401, 'GitHub 登录失败，请重试。');
      const result = await response.json(); if (!result.access_token || result.error) fail(401, 'GitHub 登录失败，请重试。');
      const user = await owner(result.access_token), id = random(), token = await seal(result.access_token, env.SESSION_SECRET, 'github-token');
      const age = Math.min(7200, Number(result.expires_in) || 7200); if (age < 60) fail(401, 'GitHub 登录已过期，请重试。');
      const old = cookies(request)[SESSION_COOKIE];
      if (old) await env.DB.prepare('DELETE FROM studio_sessions WHERE id = ?').bind(await hash(old)).run();
      await env.DB.prepare('DELETE FROM studio_sessions WHERE expires < ? OR touched < ?').bind(now(), now() - 1800).run();
      await env.DB.prepare('INSERT INTO studio_sessions (id, user_id, login, token, csrf, expires, touched) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(await hash(id), user.id, user.login, token, random(), now() + age, now()).run();
      return redirect('/admin/', [cookie(SESSION_COOKIE, id, age), cookie(FLOW_COOKIE, '', 0)]);
    }
    const current = await session(request, env);
    if (!current) { if (path.startsWith('/api/')) fail(401, '登录已过期。草稿已保留，请重新登录 GitHub。'); return redirect('/login', [cookie(SESSION_COOKIE, '', 0)]); }
    if (path === '/api/session' && method === 'GET') return json({ user:{ id:current.user_id, login:current.login }, csrf:current.csrf, expires:current.expires });
    if (path === '/auth/logout' && method === 'POST') { csrf(request, current); await env.DB.prepare('DELETE FROM studio_sessions WHERE id = ?').bind(current.id).run(); return redirect('/login', [cookie(SESSION_COOKIE, '', 0), cookie(FLOW_COOKIE, '', 0)]); }
    if (path === '/api/github' && method === 'GET') {
      const target = url.searchParams.get('path') || '', requested = new URL('https://api.github.com' + target);
      let valid = target === '/git/trees/main?recursive=1';
      if (requested.pathname.startsWith('/contents/')) {
        const file = decodeURIComponent(requested.pathname.slice('/contents/'.length));
        valid = allowedFile(file) && /^(main|[a-f0-9]{40})$/.test(requested.searchParams.get('ref') || '') && [...requested.searchParams.keys()].every(k => k === 'ref');
      }
      if (requested.pathname === '/commits') valid = allowedFile(requested.searchParams.get('path') || '') && requested.searchParams.get('sha') === 'main' && requested.searchParams.get('per_page') === '15' && [...requested.searchParams.keys()].every(k => ['path','sha','per_page'].includes(k));
      if (!valid || !target.startsWith('/') || target.startsWith('//') || target.includes('#')) fail(403, '禁止访问这个资源。');
      return json(await repositoryClient(current.token).request(target));
    }
    if (path === '/api/publish' && method === 'POST') {
      csrf(request, current);
      const body = await boundedJSON(request);
      validatePublish(body);
      await owner(current.token); // Re-check identity and current repository access for every publish.
      return json(await repositoryClient(current.token).publish(body));
    }
    if (path === '/admin/catalog.json' && method === 'GET') {
      const response = await fetcher(SITE + '/admin/catalog.json', { redirect:'manual', cache:'no-store' });
      if (!response.ok) fail(502, '无法读取最新内容目录。');
      return json(await response.json());
    }
    if (method === 'GET' && (['/admin/', '/admin/index.html'].includes(path) || /^\/assets\/admin\/(studio\.(js|css)|context\.json)$/.test(path))) {
      const assetURL = new URL(request.url); if (path.startsWith('/admin/')) assetURL.pathname = '/admin/index.html';
      const response = await env.ASSETS.fetch(new Request(assetURL, { method:'GET' }));
      if (path.startsWith('/admin/') && response.ok) return new Response((await response.text()).replace('<head>', `<head><meta name="studio-script-nonce" content="${nonce}">`), { headers:{'Content-Type':'text/html; charset=utf-8'} });
      return response;
    }
    fail(404, '这个页面不存在。');
  }
  return { async fetch(request, env) {
    const nonce = random();
    try { return headers(await route(request, env, nonce), nonce); }
    catch (error) {
      const status = error.status || 500, message = status < 500 ? error.message : '服务暂时不可用，请稍后重试。草稿不会被发布或覆盖。';
      const response = new URL(request.url).pathname.startsWith('/api/') ? json({ error:message }, status) : page('暂时无法继续', `<p>${esc(message)}</p><a class="action" href="/login">返回登录</a><a href="/install">检查仓库授权</a>`, status);
      return headers(response, nonce);
    }
  } };
}
export function validatePublish(body) {
  if (!body || !allowedFile(body.path || '') || typeof body.source !== 'string' || body.source.length > 1024 * 1024 || !(body.baseSHA === null || /^[a-f0-9]{40}$/.test(body.baseSHA || ''))) fail(400, '内容或文件版本无效。');
  try { parseSource(body.source, body.path); } catch { fail(400, '内容格式无效，未发布。'); }
  if (!Array.isArray(body.uploads || [])) fail(400, '素材格式无效。');
  const files = body.uploads || []; let size = 0; const seen = new Set();
  if (files.length > 8) fail(400, '每次最多上传 8 个新素材。');
  for (const file of files) {
    if (!/^assets\/uploads\/[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.(png|jpe?g|webp|gif|avif|mp4|webm|pdf)$/i.test(file.path || '') || seen.has(file.path) || typeof file.base64 !== 'string' || !file.base64.length || file.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) fail(400, '素材路径或格式无效。');
    if (!body.source.includes('/' + file.path)) fail(400, '新素材必须被当前内容引用。');
    seen.add(file.path); size += file.base64.length * 3 / 4;
  }
  if (size > 20 * 1024 * 1024) fail(413, '每次发布的新素材总量不能超过 20 MB。');
}
export default createWorker();
