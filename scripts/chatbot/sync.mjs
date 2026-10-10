import { parseHTML } from 'linkedom';
import { pathToFileURL } from 'node:url';
import { SITE, GOOGLE, digest, readJSON, publicURL, STORE_PATTERN, validateCatalog } from './shared.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export function extractPage(html) {
  const { document } = parseHTML(html);
  if (/noindex/i.test(document.querySelector('meta[name=robots]')?.content || '')) throw new Error('Unpublished page in manifest.');
  const main = document.querySelector('main#main');
  if (!main) throw new Error('Published page has no main content.');
  main.querySelectorAll('script,style,iframe,form,template,noscript,[hidden],[aria-hidden="true"],.related-projects,.project-reading-path').forEach(node => node.remove());
  const text = main.innerText.replace(/[\t ]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  if (text.length < 30 || text.length > 120000) throw new Error('Published page content is missing or too large.');
  return text;
}
async function pool(items, operation, count = 3) {
  let next = 0, failure;
  await Promise.all(Array.from({ length: count }, async () => {
    while (next < items.length && !failure) {
      const index = next++;
      try { await operation(items[index], index); } catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
}
export async function collectPages(fetcher = fetch) {
  const response = await fetcher(SITE + '/chatbot/manifest.json', { redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!response.ok) throw new Error('The public chatbot manifest is not published yet.');
  const manifest = await readJSON(response, 100000);
  if (manifest.version !== 1 || !Array.isArray(manifest.pages) || manifest.pages.length < 5 || manifest.pages.length > 200) throw new Error('Invalid public manifest.');
  const unique = new Set();
  for (const page of manifest.pages) {
    if (!publicURL(page.url) || typeof page.title !== 'string' || !page.title.trim() || page.title.length > 240 || unique.has(page.url)) throw new Error('Invalid public page.');
    unique.add(page.url);
  }
  const docs = [];
  await pool(manifest.pages, async page => {
    const response = await fetcher(page.url, { redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('A published page could not be read; existing index retained.');
    const html = await response.text();
    if (html.length > 2000000) throw new Error('Page exceeds the sync size limit.');
    docs.push({ title: page.title, url: page.url, text: extractPage(html), filename: 'tt-' + (await digest(page.url)).slice(0, 16) + '.txt' });
  }, 4);
  docs.sort((a, b) => a.url.localeCompare(b.url, 'en'));
  if (docs.reduce((sum, doc) => sum + doc.text.length, 0) > 2000000) throw new Error('Knowledge index exceeds the sync size limit.');
  return { docs, revision: await digest(JSON.stringify(docs)) };
}

export async function syncKnowledge({ key, token, backend, fetcher = fetch, pause = wait, report = console.log }) {
  if (!key || !token || token.length < 32) throw new Error('Configure GEMINI_API_KEY and CHAT_SYNC_TOKEN securely before syncing.');
  const base = new URL(backend);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('CHAT_BACKEND_URL must be a separate HTTPS origin.');
  const backendRequest = async (method, body) => {
    const response = await fetcher(base.origin + '/sync', { method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error('Knowledge activation failed (HTTP ' + response.status + '); no existing files were deleted.');
    return readJSON(response, 250000);
  };
  const googleRequest = async (path, options = {}) => {
    const response = await fetcher(GOOGLE + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...options.headers } });
    if (!response.ok) throw new Error('Gemini indexing request failed (HTTP ' + response.status + ').');
    return response;
  };
  const state = await backendRequest('GET');
  const { docs, revision } = await collectPages(fetcher);
  if (state.current?.revision === revision) { report('Published content is unchanged; no indexing calls needed.'); return { changed: false }; }
  const created = await readJSON(await googleRequest('/v1beta/fileSearchStores', {
    method: 'POST', body: JSON.stringify({ displayName: 'teng-portfolio-' + revision.slice(0, 16) })
  }));
  if (!STORE_PATTERN.test(created.name)) throw new Error('Gemini returned an invalid store identifier.');
  const store = created.name;
  report('Indexing ' + docs.length + ' published pages into a new Gemini knowledge store.');
  // Staging stores are not queried by visitors. A failed upload never replaces
  // the last complete catalog. Ambiguous activation failures must not delete it.
  await pool(docs, async doc => {
    const bytes = new TextEncoder().encode(doc.title + '\nSource: ' + doc.url + '\n\n' + doc.text);
    const start = await googleRequest('/upload/v1beta/' + store + ':uploadToFileSearchStore', {
      method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': 'text/plain' },
      body: JSON.stringify({ displayName: doc.filename })
    });
    const upload = new URL(start.headers.get('x-goog-upload-url'));
    if (upload.origin !== GOOGLE || upload.username || upload.password) throw new Error('Invalid Gemini upload destination.');
    const finalized = await googleRequest(upload.pathname + upload.search, { method: 'POST', headers: {
      'Content-Type': 'text/plain', 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'
    }, body: bytes });
    let operation = await readJSON(finalized, 100000);
    for (let attempt = 0; !operation.done && attempt < 40; attempt++) {
      if (typeof operation.name !== 'string' || !operation.name.startsWith(store + '/') || !/^[\w/-]+$/.test(operation.name)) throw new Error('Invalid Gemini operation.');
      await pause(3000);
      operation = await readJSON(await googleRequest('/v1beta/' + operation.name), 100000);
    }
    if (!operation.done || operation.error) throw new Error('Gemini indexing did not complete; existing catalog retained.');
  });
  let documents = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    documents = []; let pageToken;
    do {
      const page = await readJSON(await googleRequest('/v1beta/' + store + '/documents?pageSize=20' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '')), 500000);
      documents.push(...(page.documents || [])); pageToken = page.nextPageToken;
      if (documents.length > 200) throw new Error('Unexpected document count.');
    } while (pageToken);
    if (documents.some(doc => doc.state === 'STATE_FAILED')) throw new Error('A Gemini document failed indexing; existing catalog retained.');
    if (documents.length === docs.length && documents.every(doc => doc.state === 'STATE_ACTIVE')) break;
    if (attempt === 19) throw new Error('Gemini documents are not ready; existing catalog retained.');
    await pause(3000);
  }
  const files = docs.map(doc => ({ filename: doc.filename, title: doc.title, url: doc.url,
    document: documents.find(item => item.displayName === doc.filename)?.name }));
  const catalog = validateCatalog({ store, revision, files });
  await backendRequest('POST', { expectedRevision: state.current?.revision || null, catalog });
  report('Activated ' + files.length + ' published pages. The previous catalog is retained for recovery.');
  // Only a two-generations-old store owned by this integration is eligible.
  // Keep an hour of grace for in-flight calls and recovery; never touch other stores.
  if (state.previous?.store && state.previous.store !== state.current?.store && STORE_PATTERN.test(state.previous.store) &&
      Date.now() - Date.parse(state.previous.updated) > 3600000) {
    try {
      const old = await readJSON(await googleRequest('/v1beta/' + state.previous.store));
      if (old.displayName === 'teng-portfolio-' + state.previous.revision.slice(0, 16)) await googleRequest('/v1beta/' + state.previous.store + '?force=true', { method: 'DELETE' });
    } catch { report('An older knowledge store was retained; cleanup can be retried separately.'); }
  }
  return { changed: true, count: files.length, revision };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncKnowledge({ key: process.env.GEMINI_API_KEY, token: process.env.CHAT_SYNC_TOKEN, backend: process.env.CHAT_BACKEND_URL })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
