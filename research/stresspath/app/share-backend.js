/* StressPath v1.24: website-to-Apps-Script sharing transport. */
(() => {
  'use strict';
  const endpoint = 'https://script.google.com/macros/s/AKfycbyDxwaHSOyTv0D5avZMb5HgAk-_q8MFRBLTJPH4YoihL1OPKbiUaMPx5j485J23h3c/exec';
  const siteOrigin = 'https://teng-teng.org';
  const methods = new Set(['getShareService', 'getShare', 'saveShare', 'revokeShare']);
  const native = () => window.google?.script?.run;
  const available = () => !!native() || location.origin === siteOrigin;
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),
    value => value.toString(16).padStart(2, '0')).join('');
  let bridge = null;

  function openBridge() {
    if (bridge) return bridge.ready;
    if (location.origin !== siteOrigin) return Promise.reject(new Error(
      'Public sharing is available at teng-teng.org/research/stresspath/app/. You can still export a project file here.'
    ));
    const state = {channel: token(), frame: document.createElement('iframe'),
      peer: null, origin: null, pending: new Map(), settled: false};
    state.ready = new Promise((resolve, reject) => {
      state.resolve = resolve; state.reject = reject;
    });
    bridge = state;
    state.frame.hidden = true;
    state.frame.title = 'StressPath sharing service';
    state.frame.setAttribute('aria-hidden', 'true');
    state.frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    const belongsToFrame = source => {
      try {
        for (let depth = 0; source && depth < 8; depth++) {
          if (source === state.frame.contentWindow) return true;
          if (source === source.parent) break;
          source = source.parent;
        }
      } catch (_) {}
      return false;
    };
    state.listener = event => {
      const msg = event.data;
      if (!msg || msg.stresspathBridge !== 1 || msg.channel !== state.channel) return;
      if (msg.ready) {
        const googleOrigin = /^https:\/\/(?:script|[a-z0-9-]+-script)\.googleusercontent\.com$/.test(event.origin);
        if (state.settled || !googleOrigin || !belongsToFrame(event.source)) return;
        state.peer = event.source;
        state.origin = event.origin;
        state.settled = true;
        clearTimeout(state.timer);
        state.resolve(state);
        return;
      }
      if (event.source !== state.peer || event.origin !== state.origin) return;
      const request = state.pending.get(msg.request);
      if (!request) return;
      state.pending.delete(msg.request);
      clearTimeout(request.timer);
      if (typeof msg.error === 'string') request.reject(new Error(msg.error));
      else request.resolve(msg.result);
    };
    window.addEventListener('message', state.listener);
    state.timer = setTimeout(() => {
      if (state.settled) return;
      window.removeEventListener('message', state.listener);
      state.frame.remove();
      if (bridge === state) bridge = null;
      state.reject(new Error('Sharing service did not connect. Reopen Share to retry, and check the Apps Script deployment.'));
    }, 30000);
    state.frame.src = endpoint + '?bridge=1&channel=' + state.channel;
    document.body.appendChild(state.frame);
    return state.ready;
  }

  async function call(method, ...args) {
    if (!methods.has(method)) throw new Error('Unsupported sharing operation.');
    if (native()) return new Promise((resolve, reject) => {
      native().withSuccessHandler(resolve)
        .withFailureHandler(error => reject(new Error(error.message || String(error))))
        [method](...args);
    });
    const state = await openBridge();
    return new Promise((resolve, reject) => {
      const request = token();
      const timer = setTimeout(() => {
        state.pending.delete(request);
        reject(new Error('Sharing request timed out. Retry the same action to check its saved result.'));
      }, 120000);
      state.pending.set(request, {resolve, reject, timer});
      try {
        state.peer.postMessage({stresspathBridge: 1, channel: state.channel,
          request, method, args}, state.origin);
      } catch (error) {
        clearTimeout(timer);
        state.pending.delete(request);
        reject(error);
      }
    });
  }
  window.StressPathBackend = Object.freeze({call, available});
})();
