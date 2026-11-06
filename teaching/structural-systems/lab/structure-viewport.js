/* Shared full-width workspace. Panels overlay the model only when requested. */
(function (W, D) {
  'use strict';
  const body = D.body, api = W.StructureLabUI, $ = id => D.getElementById(id);
  if (!api || !$('studioRail')) return;
  body.classList.add('studio-wide');
  let lastRoute = '', queued = false;
  const bar = D.createElement('div');
  bar.className = 'viewport-tools';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Model workspace');
  bar.innerHTML = '<button id="viewportControls" aria-expanded="false">Controls & explanation</button><span id="viewportLocation"></span><button id="viewportMaximize" aria-pressed="false">Maximize model ⛶</button>';
  $('workspace').before(bar);
  const chapters = $('studioTaskToggle');
  chapters.textContent = 'Chapters';
  chapters.setAttribute('aria-controls', 'studioRail');
  bar.prepend(chapters);
  function resize() { requestAnimationFrame(() => api.resize()); }
  function setPanel(open, focus = false) {
    body.classList.toggle('viewport-panel-open', open);
    $('viewportControls').setAttribute('aria-expanded', String(open));
    if (open) { body.classList.remove('studio-rail-open'); chapters.setAttribute('aria-expanded', 'false'); }
    if (!open && focus) $('viewportControls').focus();
  }
  function maximize(value) {
    body.classList.toggle('viewport-maximized', value);
    const button = $('viewportMaximize');
    button.setAttribute('aria-pressed', String(value));
    button.textContent = value ? 'Restore layout ↙' : 'Maximize model ⛶';
    resize();
  }
  $('viewportControls').onclick = () => setPanel(!body.classList.contains('viewport-panel-open'));
  $('viewportMaximize').onclick = () => maximize(!body.classList.contains('viewport-maximized'));
  chapters.addEventListener('click', () => { setPanel(false); });
  const originalPanel = api.setPanel;
  api.setPanel = function (...args) { const result = originalPanel.apply(this, args); setPanel(true); return result; };
  function sync() {
    const space = body.dataset.studioSpace;
    const active = D.querySelector('.studio-route[aria-current="page"]');
    const title = active?.textContent.trim().replace(/•$/, '').trim() || D.querySelector('.studio-spaces [aria-current="page"]')?.textContent || 'Structure Lab';
    const key = space + ':' + title;
    if (key !== lastRoute) { setPanel(false); lastRoute = key; }
    $('viewportLocation').textContent = title;
    $('viewportControls').hidden = space === 'coach';
    $('viewportMaximize').textContent = body.classList.contains('viewport-maximized') ? 'Restore layout ↙' : space === 'coach' ? 'Maximize workspace ⛶' : 'Maximize model ⛶';
    const panel = space === 'terms' ? D.querySelector('.glossary-explanation') : space === 'steel' ? D.querySelector('#steelScreen .sr-aside, #steelScreen .steel-aside') : space === 'coach' ? null : $('labInspector');
    $('viewportControls').disabled = !panel;
    if (panel && !panel.querySelector(':scope > .viewport-panel-close')) {
      const close = D.createElement('button');
      close.className = 'viewport-panel-close'; close.textContent = 'Close controls ×';
      close.onclick = () => setPanel(false, true); panel.prepend(close);
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
