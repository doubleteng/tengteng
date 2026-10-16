const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/motion.js'), 'utf8');

function setup() {
  const { document, HTMLElement, Event } = parseHTML('<html><body><main id="main"><div class="related-projects project-grid"></div></main></body></html>');
  const listeners = {}, windowListeners = {}, timers = new Map();
  let timerId = 0;
  document.addEventListener = (name, fn) => (listeners[name] ||= []).push(fn);
  HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 100, right: 300, bottom: 300, width: 300, height: 200 });
  const create = document.createElement.bind(document);
  document.createElement = tag => {
    const el = create(tag);
    if (tag === 'video') {
      el.play = () => { el.playedByPreview = true; return Promise.resolve(); };
      el.pause = () => { el.pausedByPreview = true; };
      el.load = () => { el.releasedByPreview = true; };
    }
    return el;
  };
  const window = { addEventListener: (name, fn) => (windowListeners[name] ||= []).push(fn) };
  const emit = (name, event = {}) => (listeners[name] || []).forEach(fn => fn(event));
  const context = {
    window, document, Element: HTMLElement, URL, URLSearchParams,
    location: { href: 'https://teng-teng.org/research/example/', origin: 'https://teng-teng.org', search: '' },
    history: { length: 1 }, sessionStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }), innerWidth: 1200, innerHeight: 800,
    performance: { getEntriesByType: () => [] }, requestAnimationFrame: fn => fn(),
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(source, context);
  emit('DOMContentLoaded');
  function card(url) {
    const el = create('article'); el.className = 'project-card';
    el.innerHTML = '<a class="project-link" href="/research/example/"><div class="project-image"><img src="/cover.webp"></div><h3>Project</h3></a>';
    const frame = el.querySelector('.project-image'); frame.dataset.previewVideo = url;
    document.querySelector('.project-grid').appendChild(el);
    return { frame, link: el.querySelector('a'), image: el.querySelector('img') };
  }
  const flush = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); };
  const hover = c => emit('pointerover', { pointerType: 'mouse', target: c.image });
  return { document, Event, emit, flush, hover, card, windowListeners };
}

const s = setup();
const local = s.card('/assets/videos/example.mp4');
const youtube = s.card('https://youtu.be/BfdAiYnHGFA');
const vimeo = s.card('https://vimeo.com/1054877188');
assert.equal(s.document.querySelector('video, iframe'), null, 'Loading a page does not download card videos');
s.hover(local);
assert.equal(local.frame.querySelector('video'), null, 'A passing pointer does not immediately fetch a video');
s.flush();
let media = local.frame.querySelector('video');
assert(media && media.playedByPreview);
media.videoWidth = 640; media.videoHeight = 960;
for (const name of ['muted', 'defaultMuted', 'loop', 'autoplay', 'playsInline']) assert.equal(media[name], true);
media.dispatchEvent(new s.Event('playing'));
assert(local.frame.classList.contains('is-previewing'));
assert.equal(Number(local.frame.style.getPropertyValue('--preview-ratio')), 2 / 3, 'Portrait video uses its intrinsic ratio');
assert(Math.abs(parseFloat(local.frame.style.getPropertyValue('--preview-width')) - 400 / 9) < .001, 'Portrait preview fits inside the cover without cropping');
assert(Math.abs(parseFloat(local.frame.style.getPropertyValue('--preview-space'))) < .001, 'The portrait preview needs no padding inside its frame');
s.emit('pointerout', { target: local.image, relatedTarget: local.link.querySelector('h3') });
assert(local.frame.querySelector('video'), 'Moving from image to title keeps the preview running');
s.hover(youtube); s.flush();
assert(media.pausedByPreview && media.releasedByPreview && !media.isConnected, 'Moving to another card releases the previous video');
assert(!local.frame.style.getPropertyValue('--preview-ratio'), 'Leaving restores the original cover dimensions');
media = youtube.frame.querySelector('iframe');
let url = new URL(media.src);
assert.equal(url.hostname, 'www.youtube-nocookie.com');
assert.equal(url.pathname, '/embed/BfdAiYnHGFA');
for (const key of ['autoplay', 'mute', 'loop', 'playsinline']) assert.equal(url.searchParams.get(key), '1');
assert.equal(url.searchParams.get('playlist'), 'BfdAiYnHGFA');
assert.equal(url.searchParams.get('controls'), '0');
assert(media.getAttribute('allow').includes('autoplay'));
assert.equal(media.tabIndex, -1);
media.dispatchEvent(new s.Event('load'));
assert(youtube.frame.classList.contains('is-previewing'));
assert.equal(parseFloat(youtube.frame.style.getPropertyValue('--preview-width')), 100);
assert.equal(parseFloat(youtube.frame.style.getPropertyValue('--preview-space')), 31.25, 'Unused space sits outside the video frame and keeps the title still');
assert.equal(parseFloat(media.style.getPropertyValue('--embed-height')), 200, 'Embedded player retains its minimum viewport');
assert.equal(parseFloat(media.style.getPropertyValue('--embed-scale')), 168.75 / 200, 'The entire embed scales to fit instead of being cropped');
youtube.link.getBoundingClientRect = () => ({ width: 150, height: 100, top: 100, left: 0, right: 150, bottom: 200 });
s.windowListeners.resize.forEach(fn => fn({}));
assert.equal(parseFloat(youtube.frame.style.getPropertyValue('--preview-space')), 15.625, 'Preview spacing adapts when the card width changes');
assert.equal(parseFloat(media.style.getPropertyValue('--embed-scale')), 84.375 / 200);
s.emit('pointerout', { target: youtube.image, relatedTarget: null });
assert(!media.isConnected, 'Leaving an embedded preview unloads its player');
assert(!youtube.frame.style.getPropertyValue('--preview-space'), 'Preview spacing is removed on exit');
s.hover(vimeo); s.flush();
media = vimeo.frame.querySelector('iframe'); url = new URL(media.src);
assert.equal(url.hostname, 'player.vimeo.com');
assert.equal(url.pathname, '/video/1054877188');
for (const key of ['autoplay', 'muted', 'loop', 'playsinline']) assert.equal(url.searchParams.get(key), '1');
s.emit('keydown', { key: 'Escape' });
assert(!media.isConnected);
s.hover(local); s.hover(youtube); s.flush();
assert.equal(local.frame.querySelector('video'), null, 'Rapid card changes cancel the previous intent timer');
assert(youtube.frame.querySelector('iframe'));
s.windowListeners.pagehide.forEach(fn => fn({}));
assert.equal(s.document.querySelector('video, iframe'), null, 'Navigation releases every preview');
s.emit('pointerover', { pointerType: 'touch', target: local.image }); s.flush();
assert.equal(local.frame.querySelector('video'), null, 'Touch scrolling does not start previews');
s.hover(local); s.flush(); media = local.frame.querySelector('video');
media.dispatchEvent(new s.Event('error'));
assert(!media.isConnected && !local.frame.classList.contains('is-previewing'), 'A failed video restores the cover');
console.log('PASS: native, YouTube and Vimeo hover previews; silence, looping, card changes, exit, navigation, touch scrolling, and failed-media fallback.');
