/* Exactly one diagram plays at a time, in reading order, with native controls. */
(() => {
  'use strict';
  const root = document.querySelector('.materiality-framework');
  if (!root) return;
  const videos = [...root.querySelectorAll('[data-framework-video]')];
  const cards = [...root.querySelectorAll('.framework-step')];
  const toggle = root.querySelector('[data-sequence-toggle]');
  const status = root.querySelector('[data-sequence-status]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const automaticPauses = new WeakSet();
  let active = 0;
  let visible = false;
  let wantsPlayback = !reducedMotion.matches && !navigator.connection?.saveData;
  function pause(video) {
    if (video.paused) return;
    automaticPauses.add(video);
    video.pause();
  }
  function update() {
    cards.forEach((card, index) => card.classList.toggle('is-active', index === active));
    videos.forEach((video, index) => { video.controls = index === active; });
    status.textContent = `${String(active + 1).padStart(2, '0')} / 03`;
    toggle.textContent = wantsPlayback ? 'Pause sequence' : 'Play sequence';
  }
  function sync() {
    videos.forEach((video, index) => {
      if (index !== active || !wantsPlayback || !visible || document.hidden) pause(video);
    });
    if (wantsPlayback && visible && !document.hidden) {
      const requested = active;
      videos[requested].play()?.catch(error => {
        if (error.name === 'AbortError' || requested !== active || !visible || document.hidden) return;
        wantsPlayback = false;
        update();
      });
    }
    update();
  }
  videos.forEach((video, index) => {
    const select = () => {
      if (index === active) return;
      active = index;
      if (video.ended) video.currentTime = 0;
      wantsPlayback = true;
      sync();
    };
    video.addEventListener('click', select);
    video.addEventListener('keydown', event => {
      if (index !== active && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(); }
    });
    video.defaultMuted = true;
    video.muted = true;
    video.addEventListener('play', () => {
      active = index;
      wantsPlayback = true;
      videos.forEach(other => { if (other !== video) pause(other); });
      update();
    });
    video.addEventListener('pause', () => {
      if (automaticPauses.has(video)) automaticPauses.delete(video);
      else if (index === active && !video.ended) { wantsPlayback = false; update(); }
    });
    video.addEventListener('ended', () => {
      if (index !== active) return;
      active = (active + 1) % videos.length;
      videos[active].currentTime = 0;
      sync();
    });
  });
  toggle.addEventListener('click', () => { wantsPlayback = !wantsPlayback; sync(); });
  root.querySelector('[data-sequence-restart]').addEventListener('click', () => {
    videos.forEach(pause);
    active = 0;
    videos.forEach(video => { video.currentTime = 0; });
    wantsPlayback = true;
    sync();
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
