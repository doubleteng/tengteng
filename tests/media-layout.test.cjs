const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const { document, Event } = parseHTML(`<html><body>
  <div class="media-row media-row-equal-height">
    <figure style="--media-ratio:1"><img id="portrait"></figure>
    <figure style="--media-ratio:1"><video id="landscape"></video></figure>
  </div>
  <section data-hero-carousel>
    <div data-carousel-track>
      <figure data-carousel-slide aria-hidden="false"><img></figure>
      <figure data-carousel-slide aria-hidden="true"><img></figure>
    </div>
    <button data-carousel-prev></button><button data-carousel-next></button>
    <button data-carousel-dot="0"></button><button data-carousel-dot="1"></button>
    <span data-carousel-status></span><button data-carousel-toggle></button>
  </section>
</body></html>`);
const portrait = document.querySelector('#portrait');
portrait.naturalWidth = 640; portrait.naturalHeight = 960;
const timers = new Map(); let id = 0;
const window = { setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key) };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/site.js'), 'utf8'), { document, window });
assert.equal(Number(portrait.closest('figure').style.getPropertyValue('--media-ratio')), 2 / 3, 'Cached portrait dimensions set column width without imposing a crop');
const landscape = document.querySelector('#landscape');
landscape.videoWidth = 1920; landscape.videoHeight = 1080;
landscape.dispatchEvent(new Event('loadedmetadata'));
assert.equal(Number(landscape.closest('figure').style.getPropertyValue('--media-ratio')), 16 / 9, 'Delayed video metadata corrects the equal-height row');
portrait.naturalWidth = 900; portrait.naturalHeight = 900;
portrait.dispatchEvent(new Event('load'));
assert.equal(Number(portrait.closest('figure').style.getPropertyValue('--media-ratio')), 1, 'Replacement images update row proportions');

const slides = [...document.querySelectorAll('[data-carousel-slide]')];
document.querySelector('[data-carousel-next]').dispatchEvent(new Event('click'));
assert.deepEqual(slides.map(slide => slide.getAttribute('aria-hidden')), ['true', 'false']);
assert.equal(document.querySelector('[data-carousel-status]').textContent, '2 / 2');
assert(!document.querySelector('[data-carousel-track]').style.transform, 'Natural-height slides are not translated outside their grid');
document.querySelector('[data-carousel-prev]').dispatchEvent(new Event('click'));
assert.deepEqual(slides.map(slide => slide.getAttribute('aria-hidden')), ['false', 'true']);
assert.equal(timers.size, 1, 'Slide navigation leaves one playback timer');
document.querySelector('[data-carousel-toggle]').dispatchEvent(new Event('click'));
assert.equal(timers.size, 0, 'Pause still stops automatic advancement');
console.log('PASS: intrinsic media dimensions, delayed metadata, equal-height rows, natural-height carousel navigation and pause.');
