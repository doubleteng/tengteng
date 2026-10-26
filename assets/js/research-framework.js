/* A single native GIF contains the complete three-part concept sequence. */
(() => {
  'use strict';
  const root = document.querySelector('.materiality-framework');
  if (!root) return;
  const image = root.querySelector('[data-framework-gif]');
  const still = image.getAttribute('src');
  const toggle = root.querySelector('[data-animation-toggle]');
  const dialog = document.getElementById('image-dialog');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let wantsPlayback = !reducedMotion.matches && !navigator.connection?.saveData;
  let asset;
  let objectUrl;
  let request = 0;
  function update() { toggle.textContent = wantsPlayback ? 'Stop animation' : 'Play animation'; }
  function stop() {
    request += 1;
    image.onerror = null;
    if (image.getAttribute('src') !== still) image.src = still;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  async function start() {
    stop();
    if (!wantsPlayback || !visible || document.hidden || dialog?.open) return;
    const token = request;
    try {
      asset ||= fetch(image.dataset.src).then(response => {
        if (!response.ok) throw new Error('GIF could not be loaded');
        return response.blob();
      }).catch(error => { asset = null; throw error; });
      const blob = await asset;
      if (token !== request) return;
      objectUrl = URL.createObjectURL(blob);
      image.onerror = () => {
        if (token !== request) return;
        wantsPlayback = false; stop(); update();
      };
      image.src = objectUrl;
    } catch {
      if (token !== request) return;
      wantsPlayback = false; stop(); update();
    }
  }
  function sync() {
    if (!wantsPlayback || !visible || document.hidden || dialog?.open) stop();
    else if (!objectUrl) start();
    update();
  }
  toggle.addEventListener('click', () => { wantsPlayback = !wantsPlayback; sync(); });
  root.querySelector('[data-animation-restart]').addEventListener('click', () => { wantsPlayback = true; start(); update(); });
  root.querySelector('[data-image]').addEventListener('click', stop);
  dialog?.addEventListener('close', sync);
  root.querySelector('.framework-controls').hidden = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(image);
  } else { visible = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { wantsPlayback = false; sync(); } });
  update();
})();
