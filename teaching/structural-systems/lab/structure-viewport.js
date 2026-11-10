/* Full-width workspace with hover-revealed side panels. */
(function (W, D) {
  'use strict';
  const body = D.body, api = W.StructureLabUI, $ = id => D.getElementById(id);
  if (!api || !$('studioRail')) return;
  body.classList.add('studio-wide');
  let lastRoute = '', queued = false, panel = null, closeTimer = 0;
  const workspace = $('workspace'), rail = $('studioRail');
  const panelSelector = '.concrete-aside, #labInspector, .sr-aside, .steel-aside, .glossary-explanation';
  const boundPanels = new WeakSet();
  const bar = D.createElement('div');
  bar.className = 'viewport-tools';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Model workspace');
  bar.innerHTML = '<span id="viewportLocation"></span><button id="viewportMaximize" aria-pressed="false">Maximize model ⛶</button>';
  workspace.before(bar);
  const chapters = $('studioTaskToggle');
  chapters.className = 'viewport-edge viewport-edge-left';
  chapters.innerHTML = '<span aria-hidden="true">›</span><span>Chapters</span>';
  chapters.setAttribute('aria-controls', 'studioRail');
  chapters.title = 'Hover to open chapters';
  const controls = D.createElement('button');
  controls.id = 'viewportControls'; controls.className = 'viewport-edge viewport-edge-right';
  controls.innerHTML = '<span aria-hidden="true">‹</span><span>Controls</span>';
  controls.setAttribute('aria-label', 'Controls & explanation');
  controls.setAttribute('aria-expanded', 'false');
  controls.title = 'Hover to open controls and explanation';
  workspace.append(chapters, controls);
  function resize() { requestAnimationFrame(() => api.resize()); }
  function setChapters(open) {
    body.classList.toggle('studio-rail-open', open);
    chapters.setAttribute('aria-expanded', String(open));
    if (open) setPanel(false);
  }
  function setPanel(open, focus = false) {
    open = Boolean(open && panel);
    body.classList.toggle('viewport-panel-open', open);
    controls.setAttribute('aria-expanded', String(open));
    if (open) { body.classList.remove('studio-rail-open'); chapters.setAttribute('aria-expanded', 'false'); }
    if (!open && focus) controls.focus();
  }
  function closePanels(force = false) {
    clearTimeout(closeTimer);
    if (!force && body.classList.contains('viewport-panel-pinned')) return;
    if (force) body.classList.remove('viewport-panel-pinned');
    if (!force && [chapters, controls, rail, panel].some(element => element?.matches(':hover'))) return;
    setChapters(false); setPanel(false);
  }
  function inSidebar(target) {
    return target instanceof Element && !!target.closest('.viewport-edge, #studioRail, ' + panelSelector);
  }
  function bindHover(element, open) {
    if (boundPanels.has(element)) return;
    boundPanels.add(element);
    element.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      clearTimeout(closeTimer); open();
    });
    element.addEventListener('pointerleave', e => {
      if (e.pointerType === 'touch' || inSidebar(e.relatedTarget)) return;
      closeTimer = setTimeout(closePanels, 100);
    });
  }
  bindHover(chapters, () => setChapters(true));
  bindHover(rail, () => setChapters(true));
  bindHover(controls, () => setPanel(true));
  // The edges remain keyboard and touch controls; desktop needs no click.
  const needsClick = e => e.pointerType === 'touch' || e.detail === 0 || !W.matchMedia('(any-hover: hover)').matches;
  chapters.onclick = e => { if (needsClick(e)) setChapters(!body.classList.contains('studio-rail-open')); };
  controls.onclick = e => { if (needsClick(e)) setPanel(!body.classList.contains('viewport-panel-open')); };
  workspace.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || inSidebar(e.target)) return;
    closePanels();
  });
  workspace.addEventListener('focusout', e => {
    if (e.relatedTarget && inSidebar(e.target) && !inSidebar(e.relatedTarget)) closePanels();
  });
  function maximize(value) {
    body.classList.toggle('viewport-maximized', value);
    const button = $('viewportMaximize');
    button.setAttribute('aria-pressed', String(value));
    button.textContent = value ? 'Restore layout ↙' : 'Maximize model ⛶';
    resize();
  }
  $('viewportMaximize').onclick = () => maximize(!body.classList.contains('viewport-maximized'));
  const originalPanel = api.setPanel;
  api.setPanel = function (...args) { const result = originalPanel.apply(this, args); setPanel(true); return result; };
  function sync() {
    const space = body.dataset.studioSpace;
    const active = D.querySelector('.studio-route[aria-current="page"]');
    const title = active?.textContent.trim().replace(/•$/, '').trim() || D.querySelector('.studio-spaces [aria-current="page"]')?.textContent || 'Structure Lab';
    const key = space + ':' + title;
    if (key !== lastRoute) { closePanels(true); lastRoute = key; }
    $('viewportLocation').textContent = title;
    $('viewportMaximize').textContent = body.classList.contains('viewport-maximized') ? 'Restore layout ↙' : space === 'coach' ? 'Maximize workspace ⛶' : 'Maximize model ⛶';
    panel = space === 'concrete' ? D.querySelector('.concrete-aside') : space === 'terms' ? D.querySelector('.glossary-explanation') : space === 'steel' ? D.querySelector('#steelScreen .sr-aside, #steelScreen .steel-aside') : space === 'coach' ? null : $('labInspector');
    controls.hidden = !panel;
    body.classList.toggle('viewport-no-controls', !panel);
    if (panel) {
      if (!panel.id) panel.id = 'viewportAside';
      controls.setAttribute('aria-controls', panel.id);
      bindHover(panel, () => setPanel(true));
    }
  }
  // The existing lesson renderer may replace entire steel panels after an edit.
  D.addEventListener('structure:layout', sync);
  D.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || D.querySelector('dialog[open], .sn-calculator-expanded')) return;
    if (body.classList.contains('viewport-panel-open')) { setPanel(false, true); return; }
    if (body.classList.contains('viewport-maximized')) { maximize(false); $('viewportMaximize').focus(); }
  });
  D.addEventListener('click', e => {
    if (e.target.closest('.studio-route, .studio-spaces [data-space]')) setPanel(false);
    if (e.target.closest('.studio-model-actions [data-action="sources"]') && !W.WoodProject.has(api.getModel().active)) setPanel(true);
    if (e.target.closest('#studioNextAction') && body.dataset.studioSpace !== 'terms') setPanel(true);
    if (e.target.closest('#studioSteelReason')) setPanel(true);
  });
  // Route changes also originate from the original lesson and file-open controls.
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }).observe(body, {attributes:true, attributeFilter:['data-studio-space']});
  W.StructureViewport = {sync, maximize, setPanel};
  sync(); resize();
})(window, document);
