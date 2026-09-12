'use strict';
const previewPage = document.getElementById('preview-page');
if (previewPage) {
  const frame = document.getElementById('site-preview');
  previewPage.addEventListener('change', () => {
    frame.src = previewPage.value;
    document.getElementById('preview-open').href = previewPage.value;
  });
  document.querySelectorAll('[data-preview-width]').forEach(button => button.addEventListener('click', () => {
    frame.style.width = button.dataset.previewWidth;
    document.querySelectorAll('[data-preview-width]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
}
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
