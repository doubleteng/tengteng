(() => {
  const root = document.querySelector('[data-chinatown-map]');
  if (!root) return;
  const poster = root.querySelector('.chinatown-map__poster');
  const status = root.querySelector('[role="status"]');
  const fullScreen = root.querySelector('.chinatown-map__fullscreen');
  let frame, timeout, previousOverflow = '';
  const expanded = () => document.fullscreenElement === root || root.classList.contains('is-expanded');
  function updateFullscreenLabel() {
    fullScreen.textContent = expanded() ? 'Exit full screen ⤡' : 'Full screen ⤢';
  }
  function expandInPage(value) {
    if (value) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else document.body.style.overflow = previousOverflow;
    root.classList.toggle('is-expanded', value);
    updateFullscreenLabel();
  }

  // Apps Script's sandbox is nested inside its outer frame. Accept messages
  // only from that frame's descendants and the expected Google origin.
  function belongsToMap(source) {
    try {
      for (let depth = 0; source && depth < 8; depth++) {
        if (source === frame?.contentWindow) return true;
        if (source === window || source.parent === source) return false;
        source = source.parent;
      }
    } catch (_) { return false; }
    return false;
  }
  window.addEventListener('message', event => {
    if (!frame || !/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin)) return;
    if (!belongsToMap(event.source)) return;
    if (event.data?.type === 'afterchinatown:embed-escape') {
      if (root.classList.contains('is-expanded')) { expandInPage(false); fullScreen.focus(); }
      return;
    }
    if (event.data?.type !== 'afterchinatown:embed-ready') return;
    if (typeof event.data.nonce !== 'string' || event.data.nonce.length > 160) return;
    event.source.postMessage({type:'afterchinatown:embed-accepted', nonce:event.data.nonce}, event.origin);
    clearTimeout(timeout);
    status.hidden = true;
    root.dataset.loaded = 'true';
  });

  poster.addEventListener('click', () => {
    if (frame) return;
    const app = new URL('https://script.google.com/macros/s/AKfycbyQ5KKP15ZcSY1W_9CN4P6Bqbjy7rFW8M671yBSQfCzzaGV_wIj2j8bDI0XX_Q7A7Q/exec');
    app.search = new URLSearchParams({embed:'1', site:window.location.origin, view:'map', lang:'en'}).toString();
    frame = document.createElement('iframe');
    frame.title = 'After Chinatown — interactive historical map';
    frame.allow = 'fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = app.href;
    status.hidden = false;
    poster.hidden = true;
    root.querySelector('.chinatown-map__mount').append(frame);
    fullScreen.hidden = false;
    frame.focus();
    timeout = setTimeout(() => {
      status.textContent = 'Still loading? Open the project website below to explore the map.';
      status.hidden = false;
    }, 25000);
  });

  fullScreen.addEventListener('click', async () => {
    if (root.classList.contains('is-expanded')) { expandInPage(false); return; }
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch (_) {
      expandInPage(true);
    }
    updateFullscreenLabel();
  });
  document.addEventListener('fullscreenchange', updateFullscreenLabel);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.classList.contains('is-expanded')) {
      expandInPage(false);
      fullScreen.focus();
    }
  });
})();
