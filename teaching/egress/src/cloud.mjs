/** Same-account Google storage through a first-party popup (no third-party cookies). */
export const validEndpoint = s => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(s);
export const validGoogleOrigin = s => s === 'https://script.google.com' || s === 'https://script.googleusercontent.com' || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(s);
export function discoverFrames(win, result = new Set(), depth = 0) {
  if (!win || depth > 3 || result.has(win)) return result;
  result.add(win);
  try { for (let i = 0; i < Math.min(win.length, 8); i++) discoverFrames(win.frames[i], result, depth + 1); } catch {}
  return result;
}
export class CloudConnection {
  constructor(host = window, onStatus = () => {}) {
    this.host = host; this.onStatus = onStatus; this.pending = new Map(); this.candidates = new Set();
    this.listener = e => this.receive(e); host.addEventListener('message', this.listener);
  }
  get connected() { return !!this.source && !!this.popup && !this.popup.closed; }
  status(message) { this.message = message; this.onStatus(message, this.connected); }
  disconnect() {
    clearInterval(this.timer); this.timer = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(Error('Google connection changed. Reconnect and try again.')); }
    this.pending.clear(); this.source = null; this.origin = null; this.candidates.clear();
    try { if (this.popup && !this.popup.closed) this.popup.close(); } catch {}
    this.popup = null;
  }
  connect(endpoint) {
    if (!validEndpoint(endpoint)) throw Error('Enter a valid deployed Apps Script /exec URL.');
    this.disconnect(); this.nonce = crypto.randomUUID();
    this.popup = this.host.open(endpoint + '?nonce=' + this.nonce, '_blank', 'popup,width=640,height=640');
    if (!this.popup) { this.status('Popup blocked. Allow a Google connection window, then click Connect Google.'); return; }
    this.started = Date.now(); this.status('Finish Google authorization in the connection window, then return here. Keep that window open while saving.');
    const tick = () => {
      if (!this.popup || this.popup.closed) { this.source = null; clearInterval(this.timer); this.status('Google connection closed. Click Connect Google to reconnect.'); return; }
      if (this.connected) return;
      this.candidates = discoverFrames(this.popup);
      for (const win of this.candidates) {
        // Discovery sends no project data. Results/requests use pinned origins and window identities.
        try { win.postMessage({ type: 'egress-cloud-hello', nonce: this.nonce }, '*'); } catch {}
      }
      if (Date.now() - this.started > 180000) { clearInterval(this.timer); this.status('Connection timed out. Finish authorization, then reconnect.'); }
    };
    this.timer = setInterval(tick, 1000); tick();
  }
  receive(e) {
    const m = e.data;
    if (!m || m.nonce !== this.nonce || !validGoogleOrigin(e.origin)) return;
    if (m.type === 'egress-cloud-ready' && this.candidates.has(e.source)) {
      this.source = e.source; this.origin = e.origin; this.status('Connected to your Google Drive.');
    }
    if (m.type === 'egress-cloud-result' && e.source === this.source && e.origin === this.origin) {
      const p = this.pending.get(m.requestId); if (!p) return;
      clearTimeout(p.timer); this.pending.delete(m.requestId); m.error ? p.reject(Error(m.error)) : p.resolve(m.result);
    }
  }
  request(request) {
    if (!this.connected) return Promise.reject(Error('Connect Google before saving or opening cloud projects.'));
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(Error('Google Drive did not respond in time. Your local project is still saved.')); }, 60000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.source.postMessage({ type: 'egress-cloud-request', nonce: this.nonce, requestId, request }, this.origin);
    });
  }
}
