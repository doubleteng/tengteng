import { allowedFile, parseSource } from './document.mjs';
export const REPO = 'doubleteng/tengteng';
export class GitHub {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; this.token = ''; }
  get connected() { return Boolean(this.token); }
  async request(path, options = {}) {
    const response = await this.fetcher('https://api.github.com/repos/' + REPO + path, {
      ...options, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store'
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'GitHub 登录已失效，请重新连接。' : response.status === 403 ? 'GitHub 拒绝访问。请检查令牌权限、有效期或 API 请求额度。' : [409, 422].includes(response.status) ? '版本冲突：其他位置已有更新。草稿已保留，请重新读取当前版本后合并。' : `GitHub 请求失败（${response.status}）`);
      error.status = response.status; throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async file(path, ref = 'main') {
    const result = await this.request('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref));
    if (result.type !== 'file' || result.encoding !== 'base64') throw new Error('无法读取这个内容文件');
    const bytes = Uint8Array.from(atob(result.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    return { source: new TextDecoder().decode(bytes), sha: result.sha };
  }
  async history(path) { return this.request('/commits?sha=main&per_page=15&path=' + encodeURIComponent(path)); }
  async connect(token) {
    this.token = token.trim();
    try { const repo = await this.request(''); if (!repo.permissions?.push) throw new Error('这个账号没有仓库写入权限'); return repo; }
    catch (error) { this.token = ''; throw error; }
  }
  async publish({ path, source, baseSHA, uploads = [] }) {
    if (!this.token) throw new Error('请先连接 GitHub 再发布。');
    if (!allowedFile(path)) throw new Error('禁止修改这个文件');
    parseSource(source, path);
    if (uploads.some(f => !/^assets\/uploads\/[a-zA-Z0-9._-]+$/.test(f.path) || !/\.(png|jpe?g|webp|gif|avif|mp4|webm|pdf)$/i.test(f.path))) throw new Error('无效上传路径');
    const head = (await this.request('/git/ref/heads/main')).object.sha;
    let current;
    try { current = await this.file(path, head); } catch (error) { if (error.status !== 404 || baseSHA) throw error; }
    if ((current?.sha || null) !== (baseSHA || null)) throw Object.assign(new Error('版本冲突：线上内容已变化，已停止发布。你的草稿还在，请查看最新版本并合并。'), { status: 409 });
    if (current?.source === source && !uploads.length) return { unchanged: true, sha: head, fileSHA: current.sha };
    const commit = await this.request('/git/commits/' + head);
    // New assets only. Check at the same pinned commit; never overwrite a filename.
    for (const file of uploads) {
      try { await this.request('/contents/' + file.path + '?ref=' + head); throw new Error('上传文件名已存在，请重新选择文件'); }
      catch (error) { if (error.status !== 404) throw error; }
    }
    const blob = await this.request('/git/blobs', { method: 'POST', body: JSON.stringify({ content: source, encoding: 'utf-8' }) });
    const tree = [{ path, mode: '100644', type: 'blob', sha: blob.sha }];
    for (const file of uploads) {
      const asset = await this.request('/git/blobs', { method: 'POST', body: JSON.stringify({ content: file.base64, encoding: 'base64' }) });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: asset.sha });
    }
    const nextTree = await this.request('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
    const next = await this.request('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Content Studio: update ' + path, tree: nextTree.sha, parents: [head] }) });
    // force:false is intentional: any intervening push rejects this commit atomically.
    await this.request('/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: next.sha, force: false }) });
    return { sha: next.sha, fileSHA: blob.sha };
  }
}
