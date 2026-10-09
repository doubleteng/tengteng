import { Liquid } from 'liquidjs';
import MarkdownIt from 'markdown-it';
import { parseSource, getAt } from './document.mjs';
export const markdown = new MarkdownIt({ html: true, linkify: false });
export const PAGE_FOR_DATA = { profile: 'about/index.html', site: 'index.html', home: 'index.html', research: 'research/index.html', teaching: 'teaching/index.html', portfolio: 'design/index.html', tools: 'computational-tools/index.html', fine_art: 'fine-art/index.html', institutions: 'about/index.html', preview_media: 'gallery/index.html' };
export function contextFromFiles(bundle) {
  const site = { ...bundle.config, data: {}, projects: [], publications: [], updates: [], time: new Date().toISOString() };
  for (const [path, file] of Object.entries(bundle.files)) {
    const p = parseSource(file.source, path);
    if (path.startsWith('_data/')) site.data[path.slice(6, -4)] = p.data;
    else {
      const collection = path.split('/')[0].slice(1), slug = path.split('/').at(-1).slice(0, -3);
      site[collection]?.push({ published: false, featured: false, featured_order: 99, layout: collection === 'projects' ? 'project' : collection === 'updates' ? 'update' : 'default', ...p.data, slug, path, url: p.data.permalink || (collection === 'updates' ? '/news/' : '/' + collection + '/') + slug + '/', content: p.body });
    }
  }
  return site;
}
export function renderer(bundle) {
  const templates = Object.fromEntries(Object.entries(bundle.templates).filter(([p]) => p.startsWith('_includes/')).map(([p, s]) => [p.slice(10), s]));
  const liquid = new Liquid({ templates, jekyllInclude: true, strictFilters: true });
  liquid.registerFilter('relative_url', s => String(s || ''));
  liquid.registerFilter('absolute_url', s => new URL(s || '', bundle.config.url).href);
  liquid.registerFilter('markdownify', s => markdown.render(String(s || '')));
  return async (siteInput, file, source, dataPage) => {
    const site = structuredClone(siteInput), draft = parseSource(source, file);
    let page, template, isMarkdown = false;
    if (file.startsWith('_data/')) {
      const key = file.slice(6, -4); site.data[key] = draft.data;
      const path = dataPage || PAGE_FOR_DATA[key] || 'index.html', p = parseSource(bundle.pages[path], path);
      page = { layout: 'default', ...p.data, url: '/' + path.replace(/index\.html$/, '') }; template = p.body;
    } else if (file.startsWith('_publications/')) {
      const record = site.publications.find(x => x.path === file);
      const next = { ...(record || {}), ...draft.data, path: file, content: draft.body };
      site.publications = [...site.publications.filter(x => x.path !== file), next];
      // Include unpublished entries in this private editing preview only.
      next.published = true;
      const p = parseSource(bundle.pages['publications/index.html'], 'publications/index.html');
      page = { layout: 'default', ...p.data, url: '/publications/' }; template = p.body;
    } else {
      const col = file.startsWith('_projects/') ? 'projects' : 'updates';
      page = { layout: col === 'projects' ? 'project' : 'update', ...(site[col].find(x => x.path === file) || {}), ...draft.data, content: draft.body };
      page.url = page.permalink || page.url || '/' + col + '/' + file.split('/').at(-1).slice(0, -3) + '/';
      site[col] = [...site[col].filter(x => x.path !== file), page];
      template = draft.body; isMarkdown = true;
    }
    let content = await liquid.parseAndRender(template, { site, page });
    if (isMarkdown) content = markdown.render(content);
    let layout = page.layout, depth = 0;
    while (layout && depth++ < 5) {
      const raw = bundle.templates['_layouts/' + layout + '.html'];
      if (!raw) throw new Error('缺少页面模板：' + layout);
      const p = raw.startsWith('---') ? parseSource(raw, 'layout.html') : { body: raw, data: {} };
      content = await liquid.parseAndRender(p.body, { site, page, content }); layout = p.data.layout;
    }
    return { html: content, page, data: draft.data, body: draft.body };
  };
}
export function decorate(document, file, data, body, uploads = []) {
  const tagged = new Set();
  function tag(el, path, kind = 'text') {
    if (!el || tagged.has(el)) return;
    const value = path[0] === '$body' ? body : getAt(data, path);
    if (value === undefined) return;
    el.setAttribute('data-edit-path', JSON.stringify(path)); el.setAttribute('data-edit-kind', kind);
    el.setAttribute('title', '点击选择 · 双击编辑'); tagged.add(el);
  }
  const one = (selector, path, kind) => tag(document.querySelector(selector), path, kind);
  if (file.startsWith('_projects/')) {
    one('.project-heading h1', ['title']); one('.project-heading .lead', ['summary']); one('.page-top .eyebrow', ['year']);
    const customBody = document.querySelector('.stresspath-description');
    if (customBody) { const wrap = document.createElement('div'); wrap.className = 'studio-project-context'; [...customBody.childNodes].filter(n => !(n.nodeType === 1 && n.tagName === 'H2')).forEach(n => wrap.append(n)); customBody.append(wrap); }
    one('.project-context, .studio-project-context', ['$body'], 'rich'); one('.project-hero img', ['cover'], 'media'); one('.project-hero figcaption', ['cover_caption']);
    one('.method-intro p', ['contribution']); one('.evidence-note p', ['evidence']); one('.evidence-note h2', ['evidence_label']);
    document.querySelectorAll('.hero-carousel-slide').forEach((el, i) => { tag(el.querySelector('img'), ['hero_gallery', i, 'image'], 'media'); tag(el.querySelector('figcaption'), ['hero_gallery', i, 'caption']); });
    for (const [selector, key] of [['.project-opening .content-block', 'opening_sections'], ['.project-body .content-block', 'sections']]) {
      document.querySelectorAll(selector).forEach((el, i) => {
        const block = data[key]?.[i]; if (!block) return;
        const path = [key, i]; tag(el, path, 'block'); tag(el.querySelector('h2'), [...path, 'heading']);
        if (block.type === 'text') tag(el.querySelector('.prose'), [...path, 'body'], 'rich');
        if (block.type === 'image') tag(el.querySelector('img'), [...path, 'image'], 'media');
        if (block.type === 'gallery') el.querySelectorAll('.gallery img').forEach((img, j) => tag(img, [...path, 'images', j], 'media'));
        if (block.type === 'media-row') el.querySelectorAll('.media-row > figure').forEach((figure, j) => tag(figure.querySelector('img'), [...path, 'items', j, 'image'], 'media'));
        tag(el.querySelector('.caption'), [...path, 'caption']);
        // A figcaption containing copyright is a block selection; editing its whole text could erase the separate credit.
        if (!block.credit) tag(el.querySelector('figcaption'), [...path, 'caption']);
      });
    }
  }
  if (file === '_data/profile.yml') {
    one('.about-content > .prose', ['bio'], 'rich'); one('.about-portrait img', ['portrait'], 'media');
  }
  // Exact leaf matches also cover profile lists, publications, and page introductions.
  const leaves = [];
  function walk(value, path) {
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, [...path, Array.isArray(value) ? Number(k) : k]);
    else if ((typeof value === 'string' && value.length > 3) || typeof value === 'number') leaves.push([String(value), path]);
  }
  walk(data, []);
  const counts = new Map(); leaves.forEach(([v]) => counts.set(v, (counts.get(v) || 0) + 1));
  let scope = document.querySelector('main') || document;
  if (file.startsWith('_publications/')) scope = document.getElementById(file.split('/').at(-1).slice(0,-3)) || scope;
  let nodes = [...scope.querySelectorAll('h1,h2,h3,p,li,dd,span,a,img')];
  if (file.startsWith('_projects/')) nodes = nodes.filter(el => el.closest('.project-heading,.project-body,.project-details,.project-method,.project-brief,.project-opening,.project-hero,.stresspath-description'));
  if (file.startsWith('_publications/')) tag(scope.querySelector('details .prose'), ['$body'], 'rich');
  for (const [value, path] of leaves) {
    if (counts.get(value) !== 1 || ['permalink', 'layout', 'type'].includes(String(path.at(-1)))) continue;
    for (const el of nodes) {
      if (el.tagName === 'IMG' && el.getAttribute('src') === value) tag(el, path, 'media');
      else if (el.textContent.trim() === value && !el.querySelector('p,li,dd,span,a,h1,h2,h3,img')) tag(el, path);
    }
  }
  for (const upload of uploads) document.querySelectorAll('[src], [poster], [href]').forEach(el => {
    for (const attr of ['src', 'poster', 'href']) if (el.getAttribute(attr) === '/' + upload.path) el.setAttribute(attr, upload.objectURL);
  });
  return tagged.size;
}
export function bridgeScript(nonce, initialScroll = 0, interactive = false) {
  // The iframe has an opaque origin, no access to its parent's DOM/storage/token, and a nonce-only script CSP.
  return `(()=>{const nonce=${JSON.stringify(nonce)};const send=(type,data={})=>parent.postMessage({studio:nonce,type,...data},'*');let active=null;const interactive=${JSON.stringify(interactive)};
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(a)e.preventDefault();if(interactive)return;const el=e.target.closest('[data-edit-path]');if(!el)return;e.preventDefault();document.querySelectorAll('[data-selected]').forEach(x=>x.removeAttribute('data-selected'));el.setAttribute('data-selected','');send('select',{path:JSON.parse(el.dataset.editPath),kind:el.dataset.editKind});});
  document.addEventListener('dblclick',e=>{if(interactive)return;const el=e.target.closest('[data-edit-path]');if(!el||!['text','rich'].includes(el.dataset.editKind))return;active=el;el.contentEditable='true';el.focus();});
  document.addEventListener('input',e=>{const el=e.target.closest('[contenteditable=true]');if(!el)return;send('edit',{path:JSON.parse(el.dataset.editPath),kind:el.dataset.editKind,value:el.dataset.editKind==='rich'?el.innerHTML:el.textContent});});
  document.addEventListener('focusout',e=>{if(e.target===active){active.removeAttribute('contenteditable');active=null;}});
  document.addEventListener('submit',e=>e.preventDefault());document.querySelectorAll('video').forEach(v=>{v.muted=true;v.preload='metadata';v.removeAttribute('autoplay');});
  let scrollTimer;addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>send('scroll',{y:scrollY}),100);});
  addEventListener('message',e=>{if(e.source!==parent||e.data?.studio!==nonce)return;if(e.data.type==='locate'){const el=[...document.querySelectorAll('[data-edit-path]')].find(x=>x.dataset.editPath===JSON.stringify(e.data.path));if(el){document.querySelectorAll('[data-selected]').forEach(x=>x.removeAttribute('data-selected'));el.setAttribute('data-selected','');el.scrollIntoView({block:'center',behavior:'smooth'});}}});
  const slides=[...document.querySelectorAll('[data-carousel-slide]')];let slide=0;function show(i){slide=(i+slides.length)%slides.length;document.querySelector('[data-carousel-track]')?.style.setProperty('transform','translateX(-'+(slide*100)+'%)');slides.forEach((el,j)=>el.setAttribute('aria-hidden',j===slide?'false':'true'));const status=document.querySelector('[data-carousel-status]');if(status)status.textContent=(slide+1)+' / '+slides.length;}document.querySelector('[data-carousel-next]')?.addEventListener('click',()=>show(slide+1));document.querySelector('[data-carousel-prev]')?.addEventListener('click',()=>show(slide-1));document.querySelectorAll('[data-carousel-dot]').forEach((b,i)=>b.addEventListener('click',()=>show(i)));
  requestAnimationFrame(()=>{scrollTo(0,${Math.max(0, Number(initialScroll) || 0)});send('ready');});})();`;
}
