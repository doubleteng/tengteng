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
  const entryAnimations = new Set();
  let nativeArrival = false;
  let morphStarted = false;
  let cleanupMorph = () => {};
  const ease = 'cubic-bezier(.22,.61,.36,1)';
  const morphDuration = () => innerWidth < 800 ? 420 : 620;
  const projectParts = [
    ['.page-top', 'project-meta', 80],
    ['.project-heading .lead', 'project-summary', 160],
    ['.project-heading .actions', 'project-actions', 200],
    ['.project-brief', 'project-brief', 240],
    ['.project-reading-path', 'project-reading', 280],
    ['.project-opening', 'project-opening', 320],
    ['.project-layout', 'project-body', 320]
  ];
  function trackEntry(animation) {
    entryAnimations.add(animation);
    animation.finished.then(() => entryAnimations.delete(animation), () => entryAnimations.delete(animation));
    return animation;
  }
  function cancelEntry() { entryAnimations.forEach(animation => animation.cancel()); entryAnimations.clear(); }

  function enterPage(shared = {}) {
    const main = document.getElementById('main');
    if (!main || entryStarted || !main.animate) return;
    entryStarted = true;
    const reveal = (element, delay = 0) => {
      if (!visible(element)) return;
      trackEntry(element.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay, easing: ease, fill: 'backwards' }));
    };
    // A short dissolve is retained for reduced motion, without spatial movement.
    if (reduce()) trackEntry(main.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 180 }));
    else if (projectPage()) {
      if (!shared.image) reveal(hero());
      if (!shared.title) reveal(document.querySelector('.project-heading h1'), 80);
      projectParts.forEach(([selector, , delay]) => reveal(document.querySelector(selector),
        shared.image && delay >= 240 ? morphDuration() - 100 + (delay - 240) / 2 : delay / 2));
    } else reveal(main);
  }
  const namedElements = new Set();

  function clearNames() {
    namedElements.forEach(element => { element.style.viewTransitionName = ''; });
    namedElements.clear();
    delete document.documentElement.dataset.projectArrival;
  }
  function nameElement(element, name) {
    if (!visible(element)) return false;
    if (element.tagName === 'IMG' && (!element.complete || !element.naturalWidth)) return false;
    element.style.viewTransitionName = name;
    namedElements.add(element);
    return true;
  }
  function hero() {
    return document.querySelector('.project-hero img, .hero-carousel-slide[aria-hidden="false"] img');
  }
  function captureTransition(to) {
    const link = to && findCard(to);
    const image = link ? link.querySelector('[data-transition-cover]') : hero();
    const title = link ? link.querySelector('h2, h3') : document.querySelector('.project-heading h1');
    const rect = element => {
      if (!visible(element)) return null;
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const imageRect = rect(image), titleRect = rect(title);
    if (!imageRect && !titleRect) { storage.set('transition', null); return {}; }
    storage.set('transition', { from: here(), to, image: imageRect ? image.getAttribute('src') : null,
      project: link ? to : here(), rect: imageRect, titleRect,
      titleSize: titleRect ? parseFloat(getComputedStyle(title).fontSize) : null, time: Date.now() });
    return { image, title };
  }
  function arrivalElements(record) {
    if (!record || (record.to && record.to !== here()) || Date.now() - record.time > 15000) return {};
    const entering = here() === record.project && projectPage();
    const link = entering ? null : findCard(record.project);
    const image = entering ? hero() : link?.querySelector('[data-transition-cover]');
    return { image: image?.getAttribute('src') === record.image ? image : null,
      title: record.titleRect ? (entering ? document.querySelector('.project-heading h1') : link?.querySelector('h2, h3')) : null };
  }
  function fallbackArrival() {
    if (nativeArrival || morphStarted) return;
    if (reduce()) { enterPage(); return; }
    const record = storage.get('transition'), targets = arrivalElements(record);
    const target = targets.image;
    const shared = { image: Boolean(record?.rect && visible(target) && target.complete && target.naturalWidth),
      title: Boolean(record?.titleRect && visible(targets.title)) };
    enterPage(shared);
    if (!shared.image && !shared.title) return;
    morphStarted = true;
    const cleanups = [];
    if (shared.image) {
      const end = target.getBoundingClientRect(), start = record.rect;
      const clone = target.cloneNode(false);
      clone.removeAttribute('style'); clone.removeAttribute('data-transition-cover');
      clone.className = 'morph-image'; clone.alt = ''; clone.setAttribute('aria-hidden', 'true');
      Object.assign(clone.style, { position: 'fixed', margin: '0', maxWidth: 'none', zIndex: '19', pointerEvents: 'none', objectFit: getComputedStyle(target).objectFit });
      document.body.appendChild(clone);
      const originalVisibility = target.style.visibility;
      target.style.visibility = 'hidden';
      const rect = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      const animation = clone.animate([rect(start), rect(end)], { duration: morphDuration(), easing: ease, fill: 'both' });
      const cleanup = () => { target.style.visibility = originalVisibility; clone.remove(); animation.cancel(); };
      cleanups.push(cleanup);
      animation.finished.then(cleanup, cleanup);
    }
    if (shared.title) {
      const title = targets.title, end = title.getBoundingClientRect(), start = record.titleRect;
      const size = parseFloat(getComputedStyle(title).fontSize);
      const scale = Math.min(2, Math.max(.4, (record.titleSize || size) / size));
      const animation = trackEntry(title.animate([
        { opacity: .2, transformOrigin: '0 0', transform: `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${scale})` },
        { opacity: 1, transformOrigin: '0 0', transform: 'none' }
      ], { duration: morphDuration(), easing: ease }));
      cleanups.push(() => animation.cancel());
    }
    cleanupMorph = () => { cleanups.forEach(cleanup => cleanup()); cleanupMorph = () => {}; };
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

  const reorders = new Map();
  function cancelReorders() { reorders.forEach(cleanup => cleanup()); reorders.clear(); }
  // FLIP measures the current visual position, so another sort can interrupt smoothly.
  function reorder(grid, update) {
    stopPreview();
    if (reduce() || !Element.prototype.animate) { reorders.get(grid)?.(); update(); return; }
    const before = new Map([...grid.children].filter(visible).map(card => [card,
      { rect: card.getBoundingClientRect(), opacity: getComputedStyle(card).opacity }]));
    reorders.get(grid)?.();
    update();
    const animations = [], ghosts = [];
    const after = [...grid.children].filter(visible);
    const remaining = new Set(after);
    // Removed cards fade in place while the retained identities move into the gaps.
    before.forEach(({ rect, opacity }, card) => {
      if (remaining.has(card)) return;
      const ghost = card.cloneNode(true);
      ghost.hidden = false;
      ghost.classList.add('project-card-exit');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id], video, .thumbnail-preview').forEach(element => {
        if (element.matches('video, .thumbnail-preview')) element.remove();
        else element.removeAttribute('id');
      });
      Object.assign(ghost.style, { left: rect.left + scrollX + 'px', top: rect.top + scrollY + 'px', width: rect.width + 'px', margin: '0' });
      document.body.appendChild(ghost);
      ghosts.push(ghost);
      const animation = ghost.animate([{ opacity, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }],
        { duration: 160, easing: ease, fill: 'both' });
      animation.finished.then(() => ghost.remove(), () => ghost.remove());
      animations.push(animation);
    });
    after.forEach((card, index) => {
      const previous = before.get(card), current = card.getBoundingClientRect();
      const dx = previous ? previous.rect.left - current.left : 0;
      const dy = previous ? previous.rect.top - current.top : 0;
      if (previous && Math.abs(dx) < .5 && Math.abs(dy) < .5 && Number(previous.opacity) >= .99) return;
      const frames = previous
        ? [{ opacity: previous.opacity, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'none' }];
      animations.push(card.animate(frames, { duration: previous ? 520 : 360,
        delay: previous ? 0 : 80 + Math.min(index, 8) * 18, easing: ease, fill: 'backwards' }));
    });
    const cleanup = () => {
      animations.forEach(animation => animation.cancel());
      ghosts.forEach(ghost => ghost.remove());
      if (reorders.get(grid) === cleanup) reorders.delete(grid);
    };
    reorders.set(grid, cleanup);
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (reorders.get(grid) === cleanup) cleanup();
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
    const shared = captureTransition(to);
    const transition = event.viewTransition;
    if (!transition) return;
    transition.ready.catch(() => {});
    if (reduce()) { transition.skipTransition(); return; }
    nameElement(shared.image, 'project-cover');
    nameElement(shared.title, 'project-title');
    transition.finished.then(clearNames, clearNames);
  });

  window.addEventListener('pagereveal', event => {
    clearNames();
    const transition = event.viewTransition;
    if (!transition) { fallbackArrival(); return; }
    if (reduce()) { transition.ready.catch(() => {}); transition.skipTransition(); fallbackArrival(); return; }
    nativeArrival = true;
    entryStarted = true;
    cancelEntry();
    transition.ready.catch(() => { nativeArrival = false; entryStarted = false; fallbackArrival(); });
    const shared = arrivalElements(storage.get('transition'));
    const imageMorph = nameElement(shared.image, 'project-cover');
    nameElement(shared.title, 'project-title');
    if (projectPage()) {
      document.documentElement.dataset.projectArrival = imageMorph ? 'morph' : 'reveal';
      nameElement(document.querySelector('.project-heading h1'), 'project-title');
      projectParts.forEach(([selector, name]) => nameElement(document.querySelector(selector), name));
    }
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
  window.addEventListener('pagehide', () => { stopPreview(); if (!('onpageswap' in window)) captureTransition(pendingLink && address(pendingLink.href)); cleanupMorph(); cancelEntry(); cancelReorders(); entryStarted = false; nativeArrival = false; morphStarted = false; });

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
