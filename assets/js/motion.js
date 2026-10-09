/* Loaded in the head before first paint so pagereveal can name the incoming image. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const storage = {
    get(key) { try { return JSON.parse(sessionStorage.getItem('portfolio:' + key)); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem('portfolio:' + key, JSON.stringify(value)); } catch { /* Optional enhancement. */ } }
  };
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
    if (reducedMotion.matches || !Element.prototype.animate) { update(); return; }
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
    if (link.matches('.project-card .project-link') && !projectPage()) {
      const record = { from: here(), to: address(link.href), time: Date.now(), historyLength: history.length };
      storage.set('return:' + record.to, record);
      storage.set('last-project', record);
    }
  });

  window.addEventListener('pageswap', event => {
    stopPreview();
    clearNames();
    storage.set('transition', null);
    const transition = event.viewTransition;
    if (!transition) return;
    transition.ready.catch(() => {}); // Outgoing transitions normally reject once hidden.
    if (reducedMotion.matches) { transition.skipTransition(); return; }
    const to = address(event.activation?.entry?.url || pendingLink?.href);
    if (!to || to === here()) return;
    const cardImage = findCard(to)?.querySelector('[data-transition-cover]');
    const image = cardImage || hero();
    if (!nameImage(image)) return;
    storage.set('transition', { from: here(), to, image: image.getAttribute('src'), project: cardImage ? to : here(), time: Date.now() });
    transition.finished.then(clearNames, clearNames);
  });

  window.addEventListener('pagereveal', event => {
    clearNames();
    const transition = event.viewTransition;
    if (!transition) return;
    transition.ready.catch(() => {});
    if (reducedMotion.matches) { transition.skipTransition(); return; }
    const record = storage.get('transition');
    if (!record || record.to !== here() || Date.now() - record.time > 10000) return;
    const image = here() === record.project ? hero() : findCard(record.project)?.querySelector('[data-transition-cover]');
    if (image?.getAttribute('src') === record.image) nameImage(image);
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
  window.addEventListener('pageshow', event => { pendingLink = null; requestAnimationFrame(() => highlightReturn(event)); });
  window.addEventListener('pagehide', stopPreview);

  document.addEventListener('DOMContentLoaded', () => {
    const back = document.querySelector('.back-link');
    const source = projectPage() && storage.get('return:' + here());
    if (back && source && address(document.referrer) === source.from) {
      back.href = source.from;
      back.textContent = '← Back to projects';
      back.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (history.length === source.historyLength + 1) { event.preventDefault(); history.back(); }
      });
    }
    const selector = '.project-image[data-preview-video], .project-image[data-preview-animation]';
    function begin(frame) {
      if (!frame || activePreview?.frame === frame || reducedMotion.matches || !hoverPointer.matches || navigator.connection?.saveData) return;
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
          media.preload = 'none';
          media.addEventListener('playing', show, { once: true });
        } else { media.alt = ''; media.addEventListener('load', show, { once: true }); }
        frame.appendChild(media);
        media.src = isVideo ? frame.dataset.previewVideo : frame.dataset.previewAnimation;
        if (isVideo) media.play()?.catch(() => { if (activePreview === preview) stopPreview(); });
      }, 140);
    }
    document.addEventListener('pointerover', event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') begin(event.target.closest(selector)); });
    document.addEventListener('pointerout', event => {
      if (activePreview && activePreview.frame.contains(event.target) && !activePreview.frame.contains(event.relatedTarget)) stopPreview();
    });
    document.addEventListener('focusin', event => {
      if (event.target.matches('.project-card .project-link')) begin(event.target.querySelector(selector));
    });
    document.addEventListener('focusout', event => { if (event.target.matches('.project-card .project-link')) stopPreview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') stopPreview(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
    window.addEventListener('blur', stopPreview);
    window.addEventListener('scroll', () => { if (activePreview && !visible(activePreview.frame)) stopPreview(); }, { passive: true });
    reducedMotion.addEventListener('change', stopPreview);
    hoverPointer.addEventListener('change', stopPreview);
    if ('MutationObserver' in window) new MutationObserver(() => {
      if (activePreview && !visible(activePreview.frame)) stopPreview();
    }).observe(document.getElementById('main'), { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  });
})();
