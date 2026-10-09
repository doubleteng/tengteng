/* Loaded in the head before first paint so pagereveal can name the incoming image. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storage = {
    get(key) { try { return JSON.parse(sessionStorage.getItem('portfolio:' + key)); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem('portfolio:' + key, JSON.stringify(value)); } catch { /* Optional enhancement. */ } }
  };
  // A deliberate preview link can opt into morph even when the OS requests less motion.
  const motionChoice = new URLSearchParams(location.search).get('motion');
  if (motionChoice === 'morph' || motionChoice === 'reduce') storage.set('motion-choice', motionChoice);
  const reduce = () => storage.get('motion-choice') === 'morph' ? false : storage.get('motion-choice') === 'reduce' ? true : reducedMotion.matches;
  document.documentElement.dataset.motion = reduce() ? 'reduce' : 'morph';
  const address = value => { if (!value) return ''; try { const u = new URL(value, location.href); return u.origin === location.origin ? u.pathname + u.search : ''; } catch { return ''; } };
  const here = () => address(location.href);
  const projectPage = () => document.querySelector('[data-project-page]');
  const visible = element => {
    if (!element?.isConnected || element.closest('[hidden]')) return false;
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const findCard = url => [...document.querySelectorAll('.project-card .project-link')]
    .find(link => address(link.href) === address(url) && visible(link));
  let pendingLink = null;
  let activePreview = null;
  let entryStarted = false;
  let entryAnimation = null;
  let nativeArrival = false;
  let morphStarted = false;
  let cleanupMorph = () => {};

  function enterPage() {
    const main = document.getElementById('main');
    if (!main || entryStarted || !main.animate) return;
    entryStarted = true;
    // Reduced motion keeps a short dissolve, without movement or image zoom.
    const frames = reduce()
      ? [{ opacity: .35 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }];
    entryAnimation = main.animate(frames, { duration: reduce() ? 180 : 340, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }
  const namedImages = new Set();

  function clearNames() {
    namedImages.forEach(img => { img.style.viewTransitionName = ''; });
    namedImages.clear();
  }
  function nameImage(img) {
    if (!visible(img) || !img.complete || !img.naturalWidth) return false;
    img.style.viewTransitionName = 'project-cover';
    namedImages.add(img);
    return true;
  }
  function hero() {
    return document.querySelector('.project-hero img, .hero-carousel-slide[aria-hidden="false"] img');
  }
  function captureTransition(to) {
    const cardImage = to && findCard(to)?.querySelector('[data-transition-cover]');
    const image = cardImage || hero();
    if (!visible(image)) { storage.set('transition', null); return null; }
    const r = image.getBoundingClientRect();
    storage.set('transition', { from: here(), to, image: image.getAttribute('src'), project: cardImage ? to : here(),
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }, time: Date.now() });
    return image;
  }
  function arrivalImage(record) {
    if (!record || (record.to && record.to !== here()) || Date.now() - record.time > 15000) return null;
    const image = here() === record.project ? hero() : findCard(record.project)?.querySelector('[data-transition-cover]');
    return image?.getAttribute('src') === record.image ? image : null;
  }
  function fallbackArrival() {
    enterPage();
    if (reduce() || morphStarted) return;
    const record = storage.get('transition'), target = arrivalImage(record);
    if (!record?.rect || !visible(target) || !target.complete || !target.naturalWidth) return;
    morphStarted = true;
    const end = target.getBoundingClientRect(), start = record.rect;
    const clone = target.cloneNode(false);
    clone.removeAttribute('style'); clone.removeAttribute('data-transition-cover');
    clone.className = 'morph-image'; clone.alt = ''; clone.setAttribute('aria-hidden', 'true');
    Object.assign(clone.style, { position: 'fixed', margin: '0', maxWidth: 'none', zIndex: '90', pointerEvents: 'none', objectFit: getComputedStyle(target).objectFit });
    document.body.appendChild(clone);
    const originalVisibility = target.style.visibility;
    target.style.visibility = 'hidden';
    const rect = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const animation = clone.animate([rect(start), rect(end)], { duration: innerWidth < 800 ? 420 : 620, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
    cleanupMorph = () => { target.style.visibility = originalVisibility; clone.remove(); animation.cancel(); };
    animation.finished.then(cleanupMorph, cleanupMorph);
  }
  function stopPreview() {
    if (!activePreview) return;
    const { frame, media, timer } = activePreview;
    activePreview = null;
    clearTimeout(timer);
    frame.classList.remove('is-previewing');
    if (media) {
      if (media.tagName === 'VIDEO') { media.pause(); media.removeAttribute('src'); media.load(); }
      else media.removeAttribute('src');
      media.remove();
    }
  }

  // FLIP only moves visible cards; a long catalogue does not animate offscreen work.
  function reorder(grid, update) {
    stopPreview();
    if (reduce() || !Element.prototype.animate) { update(); return; }
    const before = new Map([...grid.children].filter(visible).map(card => [card, card.getBoundingClientRect()]));
    grid.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    update();
    [...grid.children].filter(visible).forEach(card => {
      const previous = before.get(card), current = card.getBoundingClientRect();
      const frames = previous
        ? [{ transform: `translate(${previous.left - current.left}px, ${previous.top - current.top}px)` }, { transform: 'none' }]
        : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }];
      card.animate(frames, { duration: 280, easing: 'cubic-bezier(.22,.61,.36,1)' });
    });
  }
  window.portfolioMotion = { reorder, storage };

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || !address(link.href)) return;
    pendingLink = link;
    captureTransition(address(link.href));
    if (link.matches('.project-card .project-link') && !projectPage()) {
      const record = { from: here(), to: address(link.href), time: Date.now(), historyLength: history.length };
      storage.set('return:' + record.to, record);
      storage.set('last-project', record);
    }
  });

  window.addEventListener('pageswap', event => {
    stopPreview();
    clearNames();
    const to = address(event.activation?.entry?.url || pendingLink?.href);
    const image = captureTransition(to);
    const transition = event.viewTransition;
    if (!transition) return;
    transition.ready.catch(() => {});
    if (reduce()) { transition.skipTransition(); return; }
    nameImage(image);
    transition.finished.then(clearNames, clearNames);
  });

  window.addEventListener('pagereveal', event => {
    clearNames();
    const transition = event.viewTransition;
    if (!transition) { fallbackArrival(); return; }
    if (reduce()) { transition.ready.catch(() => {}); transition.skipTransition(); fallbackArrival(); return; }
    nativeArrival = true;
    entryStarted = true;
    entryAnimation?.cancel();
    transition.ready.catch(() => { nativeArrival = false; entryStarted = false; fallbackArrival(); });
    nameImage(arrivalImage(storage.get('transition')));
    transition.finished.then(clearNames, clearNames);
  });

  function highlightReturn(event) {
    const record = storage.get('last-project');
    if (!record || record.from !== here()) return;
    const from = window.navigation?.activation?.from?.url;
    const returning = from ? address(from) === record.to : event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    if (!returning) return;
    const card = findCard(record.to)?.closest('.project-card');
    card?.classList.add('is-returned');
    setTimeout(() => card?.classList.remove('is-returned'), 1200);
  }
  window.addEventListener('pageshow', event => { pendingLink = null; requestAnimationFrame(() => { if (!nativeArrival) fallbackArrival(); highlightReturn(event); }); });
  window.addEventListener('pagehide', () => { stopPreview(); if (!('onpageswap' in window)) captureTransition(pendingLink && address(pendingLink.href)); cleanupMorph(); entryAnimation?.cancel(); entryStarted = false; nativeArrival = false; morphStarted = false; });

  document.addEventListener('DOMContentLoaded', () => {
    if (!('onpagereveal' in window)) fallbackArrival();
    const back = document.querySelector('.back-link');
    const source = projectPage() && storage.get('return:' + here());
    if (back && source && address(document.referrer) === source.from) {
      back.href = source.from;
      back.textContent = '← Back to projects';
      back.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (history.length === source.historyLength + 1) { event.preventDefault(); captureTransition(source.from); history.back(); }
      });
    }
    const selector = '.project-image[data-preview-video], .project-image[data-preview-animation]';
    function begin(frame) {
      if (!frame || activePreview?.frame === frame) return;
      stopPreview();
      const preview = { frame, media: null, timer: null };
      activePreview = preview;
      // A brief intent delay avoids downloading videos while the pointer passes across a grid.
      preview.timer = setTimeout(() => {
        if (activePreview !== preview || !visible(frame) || document.hidden) { stopPreview(); return; }
        const isVideo = Boolean(frame.dataset.previewVideo);
        const media = document.createElement(isVideo ? 'video' : 'img');
        preview.media = media;
        media.className = 'thumbnail-preview';
        media.setAttribute('aria-hidden', 'true');
        const show = () => { if (activePreview === preview) frame.classList.add('is-previewing'); };
        media.addEventListener('error', () => { if (activePreview === preview) stopPreview(); }, { once: true });
        if (isVideo) {
          media.muted = true; media.defaultMuted = true; media.loop = true; media.autoplay = true; media.playsInline = true;
          media.setAttribute('muted', ''); media.setAttribute('playsinline', '');
          media.preload = 'auto';
          media.addEventListener('playing', show, { once: true });
        } else { media.alt = ''; media.addEventListener('load', show, { once: true }); }
        frame.appendChild(media);
        media.src = isVideo ? frame.dataset.previewVideo : frame.dataset.previewAnimation;
        if (isVideo) media.play()?.catch(() => { if (activePreview === preview) stopPreview(); });
      }, 80);
    }
    // Use the actual input event, including a mouse attached to a touch-first laptop.
    document.addEventListener('pointerover', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') begin(event.target.closest('.project-card .project-link')?.querySelector(selector));
    });
    document.addEventListener('pointerout', event => {
      const link = activePreview?.frame.closest('.project-link');
      if (link?.contains(event.target) && !link.contains(event.relatedTarget)) stopPreview();
    });
    document.addEventListener('focusin', event => {
      if (event.target.matches('.project-card .project-link:focus-visible')) begin(event.target.querySelector(selector));
    });
    document.addEventListener('focusout', event => { if (event.target.matches('.project-card .project-link')) stopPreview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') stopPreview(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
    window.addEventListener('blur', stopPreview);
    window.addEventListener('scroll', () => { if (activePreview && !visible(activePreview.frame)) stopPreview(); }, { passive: true });

    if ('MutationObserver' in window) new MutationObserver(() => {
      if (activePreview && !visible(activePreview.frame)) stopPreview();
    }).observe(document.getElementById('main'), { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  });
})();
