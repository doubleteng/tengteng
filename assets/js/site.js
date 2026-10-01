'use strict';
document.querySelector('.menu-toggle')?.addEventListener('click', event => {
  const button = event.currentTarget;
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  document.getElementById('primary-nav')?.classList.toggle('is-open', open);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
    document.getElementById('primary-nav')?.classList.remove('is-open');
  }
});
document.querySelectorAll('[data-browser]').forEach(browser => {
  const input = browser.querySelector('[data-search-input]');
  const buttons = [...browser.querySelectorAll('[data-filter]')];
  const records = [...browser.querySelectorAll('[data-search]')];
  const count = browser.querySelector('[data-result-count]');
  const noun = browser.querySelector('.publication-list') ? 'publication' : 'project';
  let category = 'all';
  const params = new URLSearchParams(location.search);
  if (buttons.some(button => button.dataset.filter === params.get('category'))) category = params.get('category');
  if (input) input.value = params.get('q') || '';
  function filter(updateURL = true) {
    const terms = (input?.value || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const record of records) {
      const text = record.dataset.search.toLocaleLowerCase();
      const matches = (category === 'all' || record.dataset.category === category) && terms.every(term => text.includes(term));
      record.hidden = !matches;
      if (matches) visible++;
    }
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    if (count) count.textContent = `${visible} ${noun}${visible === 1 ? '' : 's'}`;
    const empty = browser.querySelector('[data-empty]');
    if (empty) empty.hidden = visible !== 0;
    if (updateURL) {
      const url = new URL(location.href);
      category === 'all' ? url.searchParams.delete('category') : url.searchParams.set('category', category);
      input?.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
  }
  input?.addEventListener('input', () => filter());
  buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; filter(); }));
  filter(false);
});
const dialog = document.getElementById('image-dialog');
const images = [...document.querySelectorAll('[data-image]')];
let currentImage = 0;
function showImage(index) {
  currentImage = (index + images.length) % images.length;
  const trigger = images[currentImage];
  const img = dialog.querySelector('img');
  img.src = trigger.dataset.image;
  img.alt = trigger.querySelector('img')?.alt || '';
  dialog.querySelector('p').textContent = trigger.dataset.caption || '';
  dialog.querySelector('#image-position').textContent = `${currentImage + 1} / ${images.length}`;
  dialog.querySelectorAll('[data-direction]').forEach(button => { button.disabled = images.length < 2; });
}
if (dialog) {
  images.forEach((trigger, index) => trigger.addEventListener('click', () => {
    if (typeof dialog.showModal !== 'function') { window.open(trigger.dataset.image, '_blank', 'noopener'); return; }
    showImage(index); dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => showImage(currentImage + Number(button.dataset.direction))));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showImage(currentImage + (event.key === 'ArrowRight' ? 1 : -1)); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
}
document.querySelectorAll('[data-copy-citation]').forEach(button => button.addEventListener('click', async () => {
  const container = button.closest('.citation');
  try { await navigator.clipboard.writeText(container.querySelector('pre').textContent); container.querySelector('[data-copy-status]').textContent = 'Copied'; }
  catch { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(container.querySelector('pre')); selection.removeAllRanges(); selection.addRange(range); container.querySelector('[data-copy-status]').textContent = 'Text selected — copy with your keyboard.'; }
}));

document.querySelectorAll('[data-hero-carousel]').forEach(carousel => {
  const track = carousel.querySelector('[data-carousel-track]');
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  const dots = [...carousel.querySelectorAll('[data-carousel-dot]')];
  const prev = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  const status = carousel.querySelector('[data-carousel-status]');
  if (!track || slides.length < 2) return;

  let index = 0;
  let timer = null;
  let touchStartX = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
    dots.forEach((dot, i) => i === index ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current'));
    if (status) status.textContent = `${index + 1} / ${slides.length}`;
  }

  function go(nextIndex, restart = true) {
    index = (nextIndex + slides.length) % slides.length;
    render();
    if (restart) start();
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (reduceMotion || document.hidden) return;
    timer = window.setInterval(() => go(index + 1, false), 2400);
  }

  prev?.addEventListener('click', event => { event.stopPropagation(); go(index - 1); });
  next?.addEventListener('click', event => { event.stopPropagation(); go(index + 1); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));

  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  carousel.addEventListener('focusin', stop);
  carousel.addEventListener('focusout', event => { if (!carousel.contains(event.relatedTarget)) start(); });
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  carousel.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0]?.clientX || 0;
    stop();
  }, {passive:true});
  carousel.addEventListener('touchend', event => {
    const x = event.changedTouches[0]?.clientX || 0;
    const delta = x - touchStartX;
    if (Math.abs(delta) > 45) go(index + (delta < 0 ? 1 : -1));
    else start();
  }, {passive:true});

  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  render();
  start();
});
