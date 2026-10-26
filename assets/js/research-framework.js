/* Native GIF images play one at a time; inactive diagrams show still frames. */
(() => {
  'use strict';
  const root = document.querySelector('.materiality-framework');
  if (!root) return;
  const images = [...root.querySelectorAll('[data-framework-gif]')];
  const cards = [...root.querySelectorAll('.framework-step')];
  const stills = images.map(image => image.getAttribute('src'));
  const toggle = root.querySelector('[data-sequence-toggle]');
  const status = root.querySelector('[data-sequence-status]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = new Map();
  let active = 0;
  let visible = false;
  let wantsPlayback = !reducedMotion.matches && !navigator.connection?.saveData;
  let timer;
  let objectUrl;
  let request = 0;
  function update() {
    cards.forEach((card, index) => card.classList.toggle('is-active', wantsPlayback && index === active));
    status.textContent = `${String(active + 1).padStart(2, '0')} / 03`;
    toggle.textContent = wantsPlayback ? 'Stop sequence' : 'Play sequence';
  }
  function stop() {
    request += 1;
    clearTimeout(timer);
    images.forEach((image, index) => {
      image.onload = null;
      image.onerror = null;
      if (image.getAttribute('src') !== stills[index]) image.src = stills[index];
    });
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  function asset(index) {
    if (!assets.has(index)) {
      assets.set(index, fetch(images[index].dataset.src).then(response => {
        if (!response.ok) throw new Error('GIF could not be loaded');
        return response.blob();
      }).catch(error => { assets.delete(index); throw error; }));
    }
    return assets.get(index);
  }
  async function start(index) {
    stop();
    active = index;
    update();
    if (!wantsPlayback || !visible || document.hidden) return;
    const token = request;
    try {
      const blob = await asset(index);
      if (token !== request) return;
      // A fresh object URL restarts the cached GIF without downloading it again.
      objectUrl = URL.createObjectURL(blob);
      const image = images[index];
      image.onload = () => {
        image.onload = null;
        if (token !== request) return;
        timer = setTimeout(() => start((active + 1) % images.length), Number(image.dataset.duration));
      };
      image.onerror = () => {
        if (token !== request) return;
        wantsPlayback = false;
        stop();
        update();
      };
      image.src = objectUrl;
    } catch {
      if (token !== request) return;
      wantsPlayback = false;
      stop();
      update();
    }
  }
  function sync() {
    if (!wantsPlayback || !visible || document.hidden) stop();
    else if (!objectUrl) start(active);
    update();
  }
  root.querySelectorAll('[data-framework-select]').forEach((button, index) => {
    button.addEventListener('click', () => { wantsPlayback = true; start(index); });
  });
  toggle.addEventListener('click', () => { wantsPlayback = !wantsPlayback; sync(); });
  root.querySelector('[data-sequence-restart]').addEventListener('click', () => {
    wantsPlayback = true;
    start(0);
  });
  root.querySelector('.framework-controls').hidden = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.1 }).observe(root.querySelector('.framework-sequence'));
  } else { visible = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { wantsPlayback = false; sync(); }
  });
  update();
})();
