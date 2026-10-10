// Browser adapter for the same-origin authenticated service. No GitHub credential
// is sent to JavaScript or browser storage; only the opaque HttpOnly cookie travels.
export class GitHub {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; this.secure = true; this.user = null; this.csrf = ''; }
  get connected() { return Boolean(this.user); }
  async call(path, options = {}) {
    const response = await this.fetcher(path, { ...options, credentials:'same-origin', cache:'no-store', headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.method === 'POST' ? {'X-CSRF-Token':this.csrf} : {}) } });
    if (!response.ok) {
      if (response.status === 401) { this.user = null; this.csrf = ''; }
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || '请求失败，请稍后重试。'); error.status = response.status; throw error;
    }
    return response;
  }
  async session() { const data = await (await this.call('/api/session')).json(); this.user = data.user; this.csrf = data.csrf; return data; }
  async logout() { await this.call('/auth/logout', { method:'POST', body:'{}' }); this.user = null; this.csrf = ''; }
  async request(path, options = {}) { if (options.method && options.method !== 'GET') throw new Error('请使用发布接口保存内容。'); return (await this.call('/api/github?path=' + encodeURIComponent(path))).json(); }
  async file(path, ref = 'main') {
    const result = await this.request('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref));
    if (result.type !== 'file' || result.encoding !== 'base64') throw new Error('无法读取这个内容文件');
    return { source:new TextDecoder().decode(Uint8Array.from(atob(result.content.replace(/\s/g, '')), c => c.charCodeAt(0))), sha:result.sha };
  }
  async history(path) { return this.request('/commits?sha=main&per_page=15&path=' + encodeURIComponent(path)); }
  async publish({ path, source, baseSHA, uploads = [] }) {
    if (!this.connected) throw new Error('请先使用 GitHub 登录。');
    return (await this.call('/api/publish', { method:'POST', body:JSON.stringify({ path, source, baseSHA, uploads:uploads.map(({path,base64}) => ({path,base64})) }) })).json();
  }
}
