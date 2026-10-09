import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { createTwoFilesPatch } from 'diff';
import { parseSource, getAt, setValue, editSequence, changes, allowedFile } from './document.mjs';
import { GitHub } from './github.mjs';
import { renderer, contextFromFiles, decorate, bridgeScript, markdown, PAGE_FOR_DATA } from './render.mjs';

const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = new GitHub(), drafts = new Map(), cache = new Map();
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
let bundle, site, render, current, collection = 'projects', selected = null, renderTimer, renderVersion = 0, openVersion = 0, nonce = '', scroll = 0, clean = false, busy = false;
const labels = { title:'标题', summary:'简介', year:'年份', category:'分类', published:'在网站显示', featured:'精选项目', featured_order:'精选排序', cover:'封面图片', cover_alt:'封面替代文字', cover_caption:'封面说明', cover_preview_only:'封面只用于缩略图', hero_gallery:'顶部轮播', hero_gallery_fit:'轮播图片适配', opening_sections:'开场图文', sections:'正文区块', heading:'区块标题', body:'正文', image:'图片', images:'图片列表', caption:'说明文字', credit:'摄影 / 图片版权', type:'区块类型', file:'视频文件', url:'链接', poster:'视频封面', alt:'替代文字', columns:'图片列数', items:'并排内容', videos:'视频列表', ratio:'宽高比', width_percent:'宽度 %', equal_height:'等高排列', image_ratios:'图片比例', anchor:'锚点名称', duration_ms:'停留时间（毫秒）', role:'我的角色', role_summary:'角色简介', institution:'机构', location:'地点', project_type:'项目类型', project_stage:'项目阶段', research_question:'研究问题', contribution:'方法简介', contributions:'贡献', method_steps:'方法步骤', text:'文字', evidence:'成果范围', evidence_summary:'成果简介', evidence_first:'前置区块数量', evidence_target:'成果锚点', evidence_label:'成果标签', question_label:'问题标签', reading_path:'阅读导航', tags:'标签', team:'团队', credits:'鸣谢名单', acknowledgements:'致谢', awards:'奖项', links:'资源链接', primary_link:'主要链接', related_projects:'关联项目', related_publications:'关联出版物', publications_position:'出版物位置', autoplay_videos:'视频自动播放', cover_width_percent:'封面宽度 %', gallery_width_percent:'图组宽度 %', image_alignment:'图片对齐', wide:'宽版页面', interactive_map:'互动地图', structure_lab:'结构实验室', permalink:'页面网址（保留）', layout:'页面模板（保留）', bio:'个人简介', name:'姓名', chinese_name:'中文姓名', portrait:'肖像', email:'邮箱', intro:'介绍', cv:'简历 PDF', research_interests:'研究兴趣', interests:'兴趣', education:'教育经历', appointments:'学术任职', experience:'专业经历', service:'学术服务', social:'社交链接', label:'标签', authors:'作者', venue:'刊物 / 会议', kind:'出版类型', status:'状态', url_link:'出版链接', pdf:'PDF 文件', note:'备注', bibtex:'BibTeX', scholar_url:'Google Scholar', researchgate_url:'ResearchGate', footer_text:'页脚文字', home_title:'首页标题', home_intro:'首页介绍', home_focus:'研究方向', home_research_title:'首页研究标题', home_research_text:'首页研究说明', research_intro:'研究页介绍', teaching_intro:'教学页介绍', design_intro:'设计页介绍', contact_intro:'联系页介绍', core_projects:'首页开场项目顺序', built_design_projects:'已建成项目', priority_weight:'首页抽样权重', '$body':'页面正文' };
const dataNames = { profile:'个人资料 / About', site:'网站文字与设置', home:'首页项目安排', research:'研究页面', teaching:'教学页面', portfolio:'设计页面', tools:'计算工具', fine_art:'艺术页面', institutions:'机构资料', preview_media:'缩略图视频' };
function nameFor(path) { return path.map(p => typeof p === 'number' ? String(p + 1) : labels[p] || p).join(' / '); }
function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function run(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(error => { status(error.message, true); const target = $('#modal-error'); if (target) target.textContent = error.message; }); }
function button(text, action, className = '') { const b = document.createElement('button'); b.textContent = text; b.className = className; b.onclick = run(action); return b; }
function dialog(title, html, actions = []) {
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal-actions').replaceChildren(...actions); if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
$('#modal-close').onclick = closeModal;
function storageKey(path) { return 'tt-studio-v1:' + path; }
function remember() {
  if (!current) return;
  try {
    if (current.source === current.base && current.baseSHA) localStorage.removeItem(storageKey(current.path));
    else localStorage.setItem(storageKey(current.path), JSON.stringify({ path: current.path, source: current.source, base: current.base, baseSHA: current.baseSHA, savedAt: new Date().toISOString() }));
  } catch { status('浏览器无法保存本地草稿，请用“导出草稿”备份。', true); }
  updateToolbar();
}
function modified(draft = current) { return draft && (draft.source !== draft.base || !draft.baseSHA); }
function updateToolbar() {
  if (!current) return;
  const data = parseSource(current.source, current.path).data;
  $('#document-name').textContent = current.path.startsWith('_data/') ? dataNames[current.path.slice(6, -4)] : data.title || current.path;
  $('#document-state').textContent = modified() ? '● 本地草稿 · 尚未发布' : current.baseSHA ? '已读取原内容 · 所有字段保留' : '新内容 · 尚未发布';
  $('#undo').disabled = !current.undo.length || busy; $('#redo').disabled = !current.redo.length || busy;
  $('#review').disabled = !modified() || busy;
  $('#discard').disabled = !modified() || busy;
  $('#connect').textContent = api.token ? 'GitHub 已连接' : '连接 GitHub';
}
function change(next, { skipRender = false } = {}) {
  if (busy) return;
  parseSource(next, current.path);
  if (next === current.source) return;
  current.undo.push(current.source); if (current.undo.length > 100) current.undo.shift(); current.redo = []; current.source = next;
  remember(); if (!skipRender) schedulePreview();
}
function apply(path, value, options) { change(setValue(current.source, current.path, path, value), options); }
function sequence(path, operation) {
  change(editSequence(current.source, current.path, path, operation)); selected = path; inspect();
}
function schedulePreview() { clearTimeout(renderTimer); renderTimer = setTimeout(() => run(preview)(), 220); }
function parseCurrent() { return parseSource(current.source, current.path); }
function safeRich(value) { return !/{[{%]|<(?:iframe|script|style|table|div|figure|video)\b|<\w+[^>]+(?:style|class|data-)\s*=/i.test(value); }
function richMarkdown(html) { return td.turndown(DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['script','style','iframe','form','input','button'] })); }
async function preview() {
  if (!current) return;
  const version = ++renderVersion, target = current;
  const result = await render(site, target.path, target.source, target.dataPage);
  if (version !== renderVersion || target !== current) return;
  const safe = DOMPurify.sanitize(result.html, { WHOLE_DOCUMENT: true, ADD_TAGS: ['link','iframe'], ADD_ATTR: ['allow','allowfullscreen','loading','fetchpriority'], FORBID_TAGS: ['script','form','input','textarea','select','object','embed','base','meta'] });
  const doc = new DOMParser().parseFromString(safe, 'text/html');
  doc.querySelectorAll('iframe').forEach(el => { try { const u = new URL(el.getAttribute('src'), bundle.config.url); if (!['www.youtube-nocookie.com','player.vimeo.com'].includes(u.hostname)) el.remove(); else { el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'); el.setAttribute('referrerpolicy','no-referrer'); } } catch { el.remove(); } });
  doc.querySelectorAll('link').forEach(el => { if (el.getAttribute('rel') !== 'stylesheet' || !el.getAttribute('href')?.startsWith('/assets/css/')) el.remove(); });
  decorate(doc, target.path, result.data, result.body, target.uploads);
  doc.querySelectorAll('[data-edit-kind="rich"]').forEach(el => {
    const path = JSON.parse(el.dataset.editPath), value = path[0] === '$body' ? result.body : getAt(result.data, path);
    if (!safeRich(value || '')) el.setAttribute('data-edit-kind', 'source');
  });
  if (clean) doc.querySelectorAll('[data-edit-path]').forEach(el => { el.removeAttribute('title'); });
  const base = doc.createElement('base'); base.href = bundle.config.url + '/'; doc.head.prepend(base);
  nonce = crypto.randomUUID().replaceAll('-', '');
  const csp = doc.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy';
  csp.content = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${bundle.config.url}; img-src https: data: blob:; media-src https: blob:; font-src ${bundle.config.url}; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; connect-src 'none'; form-action 'none'; base-uri ${bundle.config.url}`; doc.head.prepend(csp);
  const style = doc.createElement('style'); style.textContent = (clean ? '' : '[data-edit-path]{cursor:pointer;outline-offset:5px}[data-edit-path]:hover{outline:1px dashed #709c75}[data-selected]{outline:2px solid #5b8864!important}[contenteditable=true]{outline:2px solid #32603b!important;cursor:text}') + 'html{scroll-behavior:auto!important}.site-header,.site-footer{pointer-events:none}.project-context:empty{min-height:20px}'; doc.head.append(style);
  const script = doc.createElement('script'); script.nonce = nonce; script.textContent = bridgeScript(nonce, scroll, clean); doc.body.append(script);
  $('#preview').srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
  $('#live-link').href = new URL(result.page.url || '/', bundle.config.url).href;
}
window.addEventListener('message', run(async event => {
  if (event.source !== $('#preview').contentWindow || event.data?.studio !== nonce || !current) return;
  const message = event.data;
  if (message.type === 'scroll') { scroll = Math.max(0, Number(message.y) || 0); return; }
  if (message.type === 'select') { selected = message.path; inspect(); }
  if (message.type === 'edit') {
    const data = parseCurrent(), old = message.path[0] === '$body' ? data.body : getAt(data.data, message.path);
    if (typeof old !== 'string' && typeof old !== 'number') return;
    if (message.kind === 'rich' && !safeRich(old)) return;
    let value = message.kind === 'rich' ? richMarkdown(message.value) : String(message.value);
    if (typeof old === 'number') { value = Number(value); if (!Number.isFinite(value)) return; }
    apply(message.path, value, { skipRender: true }); selected = message.path; inspect();
  }
}));
function locate(path) { $('#preview').contentWindow.postMessage({ studio: nonce, type: 'locate', path }, '*'); }
function fileRecords() {
  if (collection === 'data') return Object.keys(dataNames).map(key => ({ path: '_data/' + key + '.yml', title: dataNames[key], category: '页面内容', published: true }));
  const records = new Map((site[collection] || []).map(x => [x.path, x]));
  for (const path of Object.keys(bundle.files)) if (path.startsWith('_' + collection + '/')) {
    if (!records.has(path)) records.set(path, { ...parseSource(bundle.files[path].source, path).data, path });
  }
  for (const draft of drafts.values()) if (draft.path.startsWith('_' + collection + '/')) records.set(draft.path, { ...parseSource(draft.source, draft.path).data, path: draft.path });
  return [...records.values()].sort((a,b) => String(a.title || a.path).localeCompare(String(b.title || b.path)));
}
function list() {
  const query = $('#search').value.toLowerCase(); $('#content-list').replaceChildren();
  const records = fileRecords().filter(x => (x.title + ' ' + x.path + ' ' + x.category).toLowerCase().includes(query));
  for (const record of records) {
    const b = button('', () => open(record.path), 'record'); b.setAttribute('aria-current', String(current?.path === record.path));
    const cover = record.cover; b.innerHTML = `${cover && /^(\/assets\/|https:\/\/)/.test(cover) ? `<img src="${esc(cover)}" loading="lazy" alt="">` : '<span class="record-icon">' + (collection === 'data' ? '▤' : '◻') + '</span>'}<span><strong>${esc(record.title || record.path)}</strong><small>${esc([record.category || record.kind || '', record.year || '', record.published === false ? '未公开' : ''].filter(Boolean).join(' · '))}${modified(drafts.get(record.path)) ? '<i class="draft-dot"></i>' : ''}</small></span>`;
    $('#content-list').append(b);
  }
  if (!records.length) $('#content-list').innerHTML = '<p class="empty">没有匹配的内容。</p>';
}
async function open(path) {
  if (busy || !allowedFile(path)) return;
  remember(); const opening = ++openVersion; selected = null; scroll = 0; ++renderVersion;
  let draft = drafts.get(path);
  if (!draft) {
    let entry = cache.get(path), warning = '';
    if (!entry) {
      status('正在读取 ' + path + ' 的最新版本…');
      try { entry = await api.file(path); cache.set(path, entry); }
      catch (error) { entry = bundle.files[path]; warning = '当前显示网站附带的版本。发布时仍会重新检查最新版本。' ; if (!entry) throw error; }
    }
    draft = { path, source: entry.source, base: entry.source, baseSHA: entry.sha, undo: [], redo: [], uploads: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(path)) || 'null');
      if (saved?.path === path && typeof saved.source === 'string') {
        parseSource(saved.source, path); draft = { ...draft, source: saved.source, base: saved.base, baseSHA: saved.baseSHA };
        warning = entry.sha !== saved.baseSHA ? '已恢复本地草稿；线上文件也有更新，发布前需要合并。' : '已恢复这台设备上的本地草稿。';
      }
    } catch { warning = '无法读取旧草稿，当前显示仓库版本。'; }
    drafts.set(path, draft); status(warning || '点击页面中的文字或图片开始编辑。修改只保存在草稿，发布前可检查差异。', Boolean(warning && !warning.includes('已恢复这台')));
  } else status('已打开当前草稿。发布前可以查看每一处改动。');
  if (opening !== openVersion) return; current = draft; updateToolbar(); list(); inspect(); await preview();
}
function leafField(path, value, parent) {
  const key = path.at(-1), title = typeof key === 'number' ? '第 ' + (key + 1) + ' 项' : labels[key] || key;
  const wrapper = document.createElement('div'); wrapper.className = 'field';
  const label = document.createElement('div'); label.className = 'field-title'; label.innerHTML = `<span>${esc(title)}</span><code>${esc(typeof key === 'number' ? '' : key)}</code>`; wrapper.append(label);
  const id = 'field-' + JSON.stringify(path).replace(/[^\w-]/g, '-');
  const locked = path.length === 1 && ['permalink','layout'].includes(key) || key === 'type';
  const media = /^(cover|image|file|poster|portrait|pdf|cv|video)$/.test(String(key)) || typeof key === 'number' && path.at(-2) === 'images';
  const rich = ['$body','body','bio'].includes(String(key)) && safeRich(String(value || ''));
  if (typeof value === 'boolean') {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; input.id = id;
    const l = document.createElement('label'); l.className = 'checkbox-label'; l.htmlFor = id; l.append(input, document.createTextNode(value ? '开启' : '关闭')); wrapper.append(l);
    input.onchange = run(() => { apply(path, input.checked); l.lastChild.textContent = input.checked ? '开启' : '关闭'; });
  } else if (rich) {
    const toolbar = document.createElement('div'); toolbar.className = 'rich-tools';
    const editor = document.createElement('div'); editor.className = 'rich-editor'; editor.contentEditable = 'true'; editor.setAttribute('role','textbox'); editor.setAttribute('aria-label', title); editor.setAttribute('aria-multiline','true'); editor.innerHTML = DOMPurify.sanitize(markdown.render(String(value || '')));
    for (const [text, cmd, argument] of [['B','bold'],['I','italic'],['H2','formatBlock','h2'],['段落','formatBlock','p'],['•','insertUnorderedList'],['1.','insertOrderedList']]) {
      const b = button(text, () => { editor.focus(); document.execCommand(cmd, false, argument); editor.dispatchEvent(new Event('input')); }); b.onmousedown = e => e.preventDefault(); toolbar.append(b);
    }
    const link = button('链接', () => { const url = prompt('输入链接网址（https:// 或网站内路径）'); if (url && /^(https?:\/\/|\/|mailto:)/i.test(url)) { editor.focus(); document.execCommand('createLink', false, url); editor.dispatchEvent(new Event('input')); } }); link.onmousedown = e => e.preventDefault(); toolbar.append(link);
    toolbar.append(button('源码', () => { const input = document.createElement('textarea'); input.value = path[0] === '$body' ? parseCurrent().body : getAt(parseCurrent().data, path) || ''; input.setAttribute('aria-label', title + ' Markdown'); input.oninput = run(() => apply(path, input.value)); editor.replaceWith(input); toolbar.remove(); }));
    editor.oninput = run(() => apply(path, richMarkdown(editor.innerHTML))); wrapper.append(toolbar, editor);
  } else {
    if (media && value && /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(value)) { const img = document.createElement('img'); img.className = 'media-thumb'; img.src = current.uploads.find(x => '/' + x.path === value)?.objectURL || value; img.alt = title; wrapper.append(img); }
    let input;
    const options = key === 'category' ? ['research','teaching','design','computational-tools','fine-art'] : key === 'columns' ? ['one','two','three'] : key === 'hero_gallery_fit' || key === 'cover_fit' ? ['cover','contain'] : key === 'image_alignment' ? ['left','center'] : null;
    if (options) { input = document.createElement('select'); for (const option of new Set([value || '', ...options])) input.add(new Option(option, option)); input.value = value || ''; }
    else if (typeof value === 'number') { input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = value; }
    else { input = document.createElement(String(value || '').length > 100 || /\n/.test(value) || ['$body','body','bio','summary','intro','text','bibtex'].includes(String(key)) ? 'textarea' : 'input'); input.value = value ?? ''; }
    input.id = id; input.setAttribute('aria-label', title); input.disabled = locked;
    input.oninput = run(() => { const next = typeof value === 'number' ? Number(input.value) : input.value; if (typeof next === 'number' && (!input.value || !Number.isFinite(next))) return; apply(path, next); });
    wrapper.append(input);
    if (media) { const actions = document.createElement('div'); actions.className = 'media-buttons'; actions.append(button('选择已有素材', () => mediaPicker(path)), button('上传新素材', () => uploadPicker(path))); wrapper.append(actions); }
    if (locked) { const note = document.createElement('p'); note.className='locked-note'; note.textContent = '保留原有网址与模板，避免链接或排版被意外改变。'; wrapper.append(note); }
    if (['$body','body','bio'].includes(String(key)) && !rich) { const note = document.createElement('p'); note.className='hint'; note.textContent = '这段内容含自定义 HTML / 模板，保留原始格式编辑，避免富文本转换损失布局。'; wrapper.append(note); }
  }
  parent.append(wrapper);
}
const blockExamples = {
  text: { type:'text', heading:'', body:'Write your text here.' }, image: { type:'image', heading:'', image:'', alt:'', caption:'', credit:'' }, gallery: { type:'gallery', heading:'', columns:'two', images:[], caption:'' }, video: { type:'video', heading:'', file:'', poster:'', caption:'' }, 'media-row': { type:'media-row', heading:'', equal_height:true, items:[], caption:'' }, 'video-gallery': { type:'video-gallery', heading:'', videos:[], caption:'' }, quote: { type:'quote', text:'', attribution:'' }, links: { type:'links', heading:'', items:[] }
};
function newItem(path, array) {
  const key = path.at(-1);
  if (key === 'hero_gallery') return { image:'', alt:'', caption:'', duration_ms:2000 };
  if (key === 'videos') return { file:'', poster:'' };
  if (key === 'method_steps') return { title:'', text:'' };
  if (key === 'reading_path') return { label:'', target:'' };
  if (['education','appointments','experience','service'].includes(key)) return { name:'', role:'', url:'' };
  if (key === 'social') return { label:'', url:'' };
  if (['links','awards','related_publications'].includes(key)) return { title:'', url:'' };
  if (array[0] && typeof array[0] === 'object') return Object.fromEntries(Object.entries(array[0]).map(([k,v]) => [k, k === 'type' ? v : Array.isArray(v) ? [] : typeof v === 'boolean' ? false : typeof v === 'number' ? 1 : '']));
  return '';
}
function fields(value, path, parent, open = false) {
  if (!value || typeof value !== 'object') { leafField(path, value, parent); return; }
  const details = document.createElement('details'); details.className = 'field-group'; details.open = open;
  const summary = document.createElement('summary'); summary.textContent = (labels[path.at(-1)] || path.at(-1) || '内容') + (Array.isArray(value) ? ` · ${value.length}` : ''); details.append(summary); parent.append(details);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const box = document.createElement('section'); box.className = 'list-item';
      const head = document.createElement('div'); head.className = 'item-heading'; head.innerHTML = `<span>${index + 1}. ${esc(item?.heading || item?.title || item?.name || labels[item?.type] || item?.type || '内容')}</span>`;
      const actions = document.createElement('div'); actions.className = 'item-actions';
      const up = button('↑', () => sequence(path, {type:'move',from:index,to:index-1})); up.disabled = index === 0; up.setAttribute('aria-label','上移第 ' + (index+1) + ' 项');
      const down = button('↓', () => sequence(path, {type:'move',from:index,to:index+1})); down.disabled = index === value.length-1; down.setAttribute('aria-label','下移第 ' + (index+1) + ' 项');
      actions.append(up, down, button('移除', () => { dialog('从草稿移除这一项？', '<p>只影响当前列表中的这一项。移除后可以撤销，发布前仍可检查改动。</p>', [button('取消',closeModal),button('移除这一项',()=>{closeModal();sequence(path,{type:'remove',index});},'danger')]); })); head.append(actions); box.append(head);
      if (item && typeof item === 'object') {
        const itemDetails = document.createElement('details'); itemDetails.className='field-group'; const itemSummary=document.createElement('summary');itemSummary.textContent='编辑这一项';itemDetails.append(itemSummary);itemDetails.open=value.length<3;
        for(const [key,v] of Object.entries(item)) fields(v,[...path,index,key],itemDetails); box.append(itemDetails);
      } else leafField([...path,index],item,box);
      details.append(box);
    });
    const add = document.createElement('div'); add.className='add-row';
    const blockList = ['sections','opening_sections'].includes(path.at(-1));
    const mediaRow = path.at(-1)==='items' && getAt(parseCurrent().data,path.slice(0,-1))?.type==='media-row';
    let select;
    if(blockList || mediaRow){select=document.createElement('select');select.setAttribute('aria-label','新增区块类型');for(const key of blockList?Object.keys(blockExamples):['image','video'])select.add(new Option(({text:'文字',image:'图片',gallery:'图组',video:'视频','media-row':'并排图文','video-gallery':'并排视频',quote:'引用',links:'链接'})[key],key));add.append(select);}
    add.append(button('＋ 添加',()=>sequence(path,{type:'add',value:blockList?structuredClone(blockExamples[select.value]):mediaRow?(select.value==='image'?{type:'image',image:'',alt:'',ratio:1}:{type:'video',file:'',poster:'',ratio:1}):newItem(path,value)})));details.append(add);
  } else for (const [key, v] of Object.entries(value)) fields(v, [...path,key], details);
}
function inspect() {
  const panel = $('#inspector'); panel.replaceChildren(); if (!current) return;
  const p = parseCurrent();
  if (selected) {
    const header = document.createElement('div'); header.className='selected-path';header.textContent=nameFor(selected);panel.append(header);
    const value = selected[0]==='$body'?p.body:getAt(p.data,selected);
    const blockPath = typeof selected[1]==='number' && ['sections','opening_sections','hero_gallery'].includes(selected[0]) ? selected.slice(0,2) : null;
    if (value && typeof value==='object' && !Array.isArray(value)) for(const [key,v] of Object.entries(value)) fields(v,[...selected,key],panel);
    else fields(value,selected,panel,true);
    if(blockPath && selected.length>2) panel.append(button('编辑整个区块',()=>{selected=blockPath;inspect();},'wide-action'));
    panel.append(button('在页面中定位',()=>locate(selected),'wide-action'));
    return;
  }
  const note=document.createElement('p');note.className='hint';note.textContent='点中间页面可定位字段。文字、媒体、区块顺序都能在这里调整。未编辑的字段原样保留。';panel.append(note);
  if(current.path==='_data/site.yml') {
    const label=document.createElement('label');label.className='field';label.textContent='预览页面';const select=document.createElement('select');for(const path of ['index.html','research/index.html','teaching/index.html','design/index.html','contact/index.html'])select.add(new Option(path==='index.html'?'首页':path.split('/')[0],path));select.value=current.dataPage||'index.html';select.onchange=()=>{current.dataPage=select.value;scroll=0;schedulePreview();};label.append(select);panel.append(label);
  }
  const common = current.path.startsWith('_projects/') ? ['title','summary','published','featured','category','year','cover','hero_gallery','opening_sections','sections'] : current.path.startsWith('_data/') ? Object.keys(p.data) : ['title','published','kind','year','authors','venue','url_link','pdf','note'];
  for(const key of common){if(Object.hasOwn(p.data,key)) fields(p.data[key],[key],panel,['sections','opening_sections'].includes(key));}
  if(!current.path.startsWith('_data/')) leafField(['$body'],p.body,panel);
  const rest=Object.fromEntries(Object.entries(p.data).filter(([key])=>!common.includes(key)));
  if(Object.keys(rest).length)fields(rest,[],panel,false);
  if(current.path.startsWith('_projects/')) {
    const add=document.createElement('div');add.className='add-row';const select=document.createElement('select');select.setAttribute('aria-label','添加可选字段');
    const optional={summary:'',cover:'',cover_caption:'',cover_preview_only:false,hero_gallery:[],hero_gallery_fit:'cover',opening_sections:[],sections:[],role:'',institution:'',location:'',tags:[],links:[],primary_link:{title:'',url:''},related_publications:[],published:false,featured:false};
    for(const key of Object.keys(optional).filter(k=>!Object.hasOwn(p.data,k)))select.add(new Option(labels[key]||key,key));
    if(select.options.length){add.append(select,button('添加字段',()=>{apply([select.value],optional[select.value]);inspect();}));panel.append(add);}
  }
  if(current.path==='_data/profile.yml') {
    const optional={portrait:'',cv:''};const missing=Object.keys(optional).filter(k=>!Object.hasOwn(p.data,k));
    for(const key of missing)panel.append(button('＋ 添加'+labels[key],()=>{apply([key],optional[key]);inspect();},'wide-action'));
  }
  const path=document.createElement('p');path.className='code-path';path.textContent=current.path;panel.append(path);
}
async function mediaPicker(path) {
  dialog('选择已有素材','<input id="media-search" type="search" placeholder="搜索文件名…" aria-label="搜索素材"><div id="media-grid" class="media-grid"></div><p class="hint">选择只改变当前字段，不移动或覆盖原素材。每次显示前 80 个匹配结果。</p>');
  function draw(){const q=$('#media-search').value.toLowerCase(),grid=$('#media-grid');grid.replaceChildren();for(const url of bundle.media.filter(x=>x.toLowerCase().includes(q)).slice(0,80)){const b=button('',()=>{apply(path,url);closeModal();inspect();},'media-card');b.innerHTML=/\.(png|jpe?g|webp|gif|avif)$/i.test(url)?`<img src="${esc(url)}" loading="lazy" alt=""><span>${esc(url.split('/').at(-1))}</span>`:`<div class="empty">${/\.pdf$/i.test(url)?'PDF':'▶ 视频'}</div><span>${esc(url.split('/').at(-1))}</span>`;grid.append(b);}}
  $('#media-search').oninput=draw;draw();
}
function uploadPicker(path) {
  dialog('上传新素材','<p>图片、视频或 PDF；每个文件最多 20 MB。使用新文件名，与你的内容一起发布，不覆盖已有素材。</p><input id="upload-file" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.mp4,.webm,.pdf"><p class="hint">上传文件暂存在当前标签页。刷新前请发布，或保留原文件以便重新上传。</p><p id="modal-error" class="inline-error"></p>',[button('取消',closeModal),button('加入草稿',async()=>{
    const file=$('#upload-file').files[0];if(!file)throw new Error('请先选择文件');if(file.size>20*1024*1024)throw new Error('文件超过 20 MB，请先压缩。');const ext=file.name.split('.').at(-1).toLowerCase();if(!/^(png|jpe?g|webp|gif|avif|mp4|webm|pdf)$/.test(ext))throw new Error('不支持这个文件类型');
    const filename='assets/uploads/'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,12)+'.'+ext;
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    current.uploads.push({path:filename,base64:data.split(',')[1],objectURL:URL.createObjectURL(file),name:file.name});apply(path,'/'+filename);closeModal();inspect();status('素材已加入草稿；发布时会与当前内容一起保存。');
  },'primary')]);
}
function connectDialog() {
  if(api.token){dialog('GitHub 已连接','<p>令牌只保留在这个标签页的内存中，关闭或刷新页面后需要重新连接。</p>',[button('断开连接',()=>{api.token='';updateToolbar();closeModal();}),button('完成',closeModal,'primary')]);return;}
  dialog('连接 GitHub 后发布',`<p>预览和编辑不需要登录。发布需要你对 <code>doubleteng/tengteng</code> 的写入权限。</p><ol><li>在 GitHub 创建 Fine-grained personal access token。</li><li>只选择 <code>tengteng</code> 仓库，设置 <code>Contents → Read and write</code>。</li><li>把令牌粘贴在下方。这不会存入网站文件或浏览器本地存储。</li></ol><p><a href="https://github.com/settings/personal-access-tokens/new?name=Teng%20Content%20Studio&description=Edit%20my%20portfolio%20content&target_name=doubleteng&contents=write" target="_blank" rel="noopener noreferrer">在 GitHub 创建令牌 ↗</a></p><label class="field">GitHub 令牌<input id="github-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label><p id="modal-error" class="inline-error"></p>`,[button('取消',closeModal),button('连接',async()=>{const value=$('#github-token').value;if(!value.trim())throw new Error('请填写令牌');await api.connect(value);$('#github-token').value='';updateToolbar();closeModal();status('GitHub 已连接。发布前仍需查看并确认当前文件的改动。');await discover();},'primary')]);
}
function short(value) { const text = typeof value === 'object' ? JSON.stringify(value,null,2) : String(value ?? '（空）'); return text.length>1400?text.slice(0,1400)+'…':text; }
function diffHTML(patch) { return patch.split('\n').map(line=>`<div class="${line.startsWith('+')?'add':line.startsWith('-')?'remove':''}">${esc(line)||' '}</div>`).join(''); }
async function review() {
  if(!current || !modified())return;
  const snapshot=current.source, delta=changes(current.base,snapshot,current.path);
  const uploadRefs=current.uploads.filter(x=>snapshot.includes('/'+x.path));
  const missing=[...snapshot.matchAll(/\/assets\/uploads\/[a-zA-Z0-9._-]+/g)].map(x=>x[0]).filter(path=>!current.base.includes(path)&&!bundle.media.includes(path)&&!uploadRefs.some(x=>'/'+x.path===path));
  if(missing.length)throw new Error('草稿引用的上传文件已不在当前标签页，请重新上传后发布：'+missing.join(', '));
  const patch=createTwoFilesPatch(current.path,current.path,current.base,snapshot,'当前版本','草稿');
  dialog('检查改动后发布',`<p>本次只保存 <code>${esc(current.path)}</code>${uploadRefs.length?'，并添加 '+uploadRefs.length+' 个新素材':''}。其他页面不会被改写。</p><p class="notice">${current.baseSHA?'发布前将再次检查线上文件版本。':'这是新内容。保留“在网站显示”关闭可先保存为未公开内容。'}</p>${delta.map(x=>`<div class="change-card"><div>${esc(nameFor(x.path))}</div><div class="before">${esc(short(x.before))}</div><div class="after">${esc(short(x.after))}</div></div>`).join('')}<details><summary>查看文件逐行差异</summary><div class="diff">${diffHTML(patch)}</div></details><p id="modal-error" class="inline-error"></p>`,[button('继续编辑',closeModal),button('发布这些改动',async()=>{
    if(!api.token){connectDialog();return;}
    if(current.source!==snapshot)throw new Error('草稿已变化，请关闭后重新检查改动。');
    busy=true;updateToolbar();$('#modal-actions').querySelectorAll('button').forEach(b=>b.disabled=true);status('正在检查版本并发布当前文件…');
    try{
      const result=await api.publish({path:current.path,source:snapshot,baseSHA:current.baseSHA,uploads:uploadRefs});
      current.base=snapshot;current.baseSHA=result.fileSHA;current.uploads.forEach(x=>bundle.media.push('/'+x.path));
      cache.set(current.path,{source:snapshot,sha:result.fileSHA});bundle.files[current.path]={source:snapshot,sha:result.fileSHA};
      const p=parseCurrent();if(current.path.startsWith('_data/'))site.data[current.path.slice(6,-4)]=p.data;else{const col=current.path.split('/')[0].slice(1);site[col]=site[col].filter(x=>x.path!==current.path);site[col].push({...p.data,path:current.path,content:p.body,url:p.data.permalink||'/'+col+'/'+current.path.split('/').at(-1).slice(0,-3)+'/'});}
      current.undo=[];current.redo=[];remember();closeModal();list();status('已保存到 GitHub。网站部署通常需要 1–3 分钟，完成后再查看线上页面。');
      dialog('内容已保存',`<p>这次修改已生成独立版本。GitHub Pages 正在更新网站，通常需要 1–3 分钟。</p><p><a href="https://github.com/doubleteng/tengteng/commit/${esc(result.sha)}" target="_blank" rel="noopener">查看这次版本 ↗</a>　<a href="https://github.com/doubleteng/tengteng/actions" target="_blank" rel="noopener">查看部署状态 ↗</a></p>`,[button('完成',closeModal,'primary')]);
    }catch(error){$('#modal-actions').append(button('比较线上最新版本',compareLatest));throw error;}
    finally{busy=false;updateToolbar();$('#modal-actions').querySelectorAll('button').forEach(b=>b.disabled=false);}
  },'primary')]);
}
async function compareLatest() {
  const latest=await api.file(current.path), original=parseSource(current.base,current.path), local=parseCurrent(), remote=parseSource(latest.source,current.path);
  const delta=changes(current.base,current.source,current.path);let merged=latest.source;const conflicts=[];
  for(const c of delta){const old=c.path[0]==='$body'?original.body:getAt(original.data,c.path);const theirs=c.path[0]==='$body'?remote.body:getAt(remote.data,c.path);if(JSON.stringify(old)!==JSON.stringify(theirs)){conflicts.push(c);continue;}merged=setValue(merged,current.path,c.path,c.after);}
  dialog('线上版本与草稿',`<p>检测到 ${conflicts.length} 处同时被修改的内容。</p>${conflicts.map(c=>`<div class="change-card">${esc(nameFor(c.path))}<p>请先导出草稿，再重新读取线上版本，手动合并这一项。</p></div>`).join('')}<details open><summary>线上版本与草稿的差异</summary><div class="diff">${diffHTML(createTwoFilesPatch('线上最新','我的草稿',latest.source,current.source))}</div></details><p id="modal-error" class="inline-error"></p>`,[button('保留草稿并关闭',closeModal),button('导出草稿',exportDraft),...(conflicts.length?[]:[button('合并互不冲突的修改',()=>{current.base=latest.source;current.baseSHA=latest.sha;current.source=merged;current.undo=[];current.redo=[];cache.set(current.path,latest);remember();closeModal();inspect();schedulePreview();status('已合并线上更新；请重新检查差异后发布。');},'primary')])]);
}
async function history() {
  if(!current)return;status('正在读取这个文件的历史版本…');const commits=await api.history(current.path);
  dialog('历史版本 · 仅当前内容','<p>选择版本后先载入草稿预览。只有再次发布，才会恢复到网站。</p><div id="history-list"></div><p id="modal-error" class="inline-error"></p>');
  for(const commit of commits){const row=document.createElement('div');row.className='history-row';row.innerHTML=`<div>${esc(commit.commit.message.split('\n')[0])}<small>${esc(commit.commit.author?.date||'')} · ${esc(commit.sha.slice(0,7))}</small></div>`;row.append(button('载入草稿',async()=>{const version=await api.file(current.path,commit.sha);change(version.source);selected=null;closeModal();inspect();status('已载入历史版本作为草稿。查看改动后发布，才会恢复线上内容。');}));$('#history-list').append(row);}
}
function exportDraft() {
  if(!current)return;const data=JSON.stringify({version:1,path:current.path,source:current.source,base:current.base,baseSHA:current.baseSHA,exportedAt:new Date().toISOString()},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=current.path.split('/').at(-1)+'.draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function help() {
  dialog('管理你的网站',`<div class="guide-step"><span>1</span><div>选内容，直接在页面上修改<small>左侧选项目或页面。点文字 / 图片定位，双击文字原位编辑；右侧编辑链接、媒体和区块顺序。</small></div></div><div class="guide-step"><span>2</span><div>检查桌面与手机效果<small>预览使用网站的真实模板与样式。顶部轮播可用箭头切换；动态地图等自定义交互请在发布后检查线上页。</small></div></div><div class="guide-step"><span>3</span><div>查看改动，再发布<small>只写入当前文件和你新增的素材。遇到版本冲突停止覆盖；历史版本也先载入草稿，不会直接替换网站。</small></div></div><p class="notice">草稿自动保存在这台设备上，不会自动发布。令牌只留在当前标签页内存。不要使用旧表单同时编辑同一内容。</p><p>内容：项目、个人资料、页面文字、首页顺序、出版物、动态、缩略图视频。网站模板和复杂交互代码保留在仓库中。</p><label class="field">导入已导出的草稿<input id="import-file" type="file" accept=".json"></label><p id="modal-error" class="inline-error"></p>`,[button('完成',closeModal)]);
  $('#import-file').onchange=run(async e=>{const file=e.target.files[0];if(!file)return;const saved=JSON.parse(await file.text());if(!allowedFile(saved.path)||typeof saved.source!=='string'||typeof saved.base!=='string')throw new Error('不是有效的内容草稿');parseSource(saved.source,saved.path);await open(saved.path);change(saved.source);current.base=saved.base;current.baseSHA=saved.baseSHA;remember();selected=null;inspect();schedulePreview();closeModal();status('草稿已导入。发布前会重新检查线上版本。');});
}
function newRecord() {
  dialog('新增内容','<label class="field">类型<select id="new-type"><option value="projects">项目</option><option value="publications">出版物</option><option value="updates">动态</option></select></label><label class="field">标题<input id="new-title" placeholder="项目标题"></label><label class="field">网址短名<input id="new-slug" placeholder="例如 new-material-study" pattern="[a-z0-9-]+"></label><p class="hint">使用英文小写字母、数字和连字符。新内容默认不公开。</p><p id="modal-error" class="inline-error"></p>',[button('取消',closeModal),button('创建草稿',async()=>{
    const type=$('#new-type').value,title=$('#new-title').value.trim(),slug=$('#new-slug').value.trim();if(!title||!slug.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))throw new Error('请填写标题和有效的网址短名');const path='_'+type+'/'+slug+'.md';if(bundle.files[path]||drafts.has(path)||(site[type]||[]).some(x=>x.path===path))throw new Error('这个短名已存在，请换一个');
    const data={title,published:false,year:new Date().getFullYear(),...(type==='projects'?{category:'research',permalink:'/research/'+slug+'/',summary:'',cover:'',sections:[]}:type==='publications'?{kind:'journal',authors:'',venue:'',url_link:'',pdf:'',status:'pending'}:{summary:''})};
    const source='---\n'+Object.entries(data).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n\n';const base='---\n{}\n---\n';const draft={path,source,base,baseSHA:null,undo:[],redo:[],uploads:[]};drafts.set(path,draft);collection=type;document.querySelectorAll('[data-collection]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.collection===type)));current=draft;remember();closeModal();await open(path);
  },'primary')]);
}
async function discover() {
  try{const tree=await api.request('/git/trees/main?recursive=1');if(tree.truncated){status('GitHub 文件目录未完整返回，现有内容仍可编辑。',true);return;}for(const item of tree.tree){if(item.type!=='blob')continue;if(/^assets\/.+\.(png|jpe?g|webp|gif|avif|mp4|webm|pdf)$/i.test(item.path)&&!bundle.media.includes('/'+item.path))bundle.media.push('/'+item.path);if(allowedFile(item.path)&&!bundle.files[item.path]&&!item.path.startsWith('_data/')){const col=item.path.split('/')[0].slice(1);if(!site[col].some(x=>x.path===item.path))site[col].push({path:item.path,title:item.path.split('/').at(-1).slice(0,-3),published:false});}}list();}catch{/* Content file reads and publish checks remain authoritative. */}
}
$('#search').oninput=list;
$('#collections').onclick=run(e=>{const b=e.target.closest('[data-collection]');if(!b)return;collection=b.dataset.collection;document.querySelectorAll('[data-collection]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));list();});
$('#all-fields').onclick=()=>{selected=null;inspect();};$('#connect').onclick=connectDialog;$('#review').onclick=run(review);$('#history').onclick=run(history);$('#help').onclick=help;$('#new-record').onclick=newRecord;$('#export-draft').onclick=exportDraft;
$('#undo').onclick=run(()=>{if(!current?.undo.length)return;current.redo.push(current.source);current.source=current.undo.pop();remember();inspect();schedulePreview();});
$('#redo').onclick=run(()=>{if(!current?.redo.length)return;current.undo.push(current.source);current.source=current.redo.pop();remember();inspect();schedulePreview();});
$('#discard').onclick=()=>{if(!current)return;dialog('放弃当前草稿？','<p>将重新读取线上当前版本。其他内容的草稿不会改变。建议先导出需要保留的修改。</p>',[button('取消',closeModal),button('导出草稿',exportDraft),button('放弃并重新读取',async()=>{const path=current.path;localStorage.removeItem(storageKey(path));current.source=current.base;current.uploads.forEach(x=>URL.revokeObjectURL(x.objectURL));drafts.delete(path);cache.delete(path);current=null;closeModal();await open(path);},'danger')]);};
for(const mode of ['desktop','mobile'])$('#'+mode).onclick=()=>{$('#canvas').classList.toggle('mobile',mode==='mobile');$('#desktop').setAttribute('aria-pressed',String(mode==='desktop'));$('#mobile').setAttribute('aria-pressed',String(mode==='mobile'));};
$('#clean-preview').onclick=run(async()=>{clean=!clean;$('#clean-preview').setAttribute('aria-pressed',String(clean));$('#clean-preview').textContent=clean?'返回编辑':'纯预览';$('#preview-instruction').textContent=clean?'预览模式 · 编辑标记已隐藏':'点击选择 · 双击文字原位编辑';await preview();});
window.addEventListener('beforeunload',e=>{remember();if(current?.uploads.some(x=>!current.base.includes('/'+x.path))){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();remember();status('草稿已保存到这台设备。点击“查看改动 / 发布”更新网站。');}});
async function boot(){
  const response=await fetch('/assets/admin/context.json?v=1');if(!response.ok)throw new Error('编辑器内容读取失败，请刷新重试');bundle=await response.json();site=contextFromFiles(bundle);render=renderer(bundle);
  try{const response=await fetch('/admin/catalog.json?fresh='+Date.now(),{cache:'no-store'});if(response.ok){const live=await response.json();if(live.data)site.data=live.data;for(const col of ['projects','publications','updates'])if(Array.isArray(live[col]))for(const record of live[col]){const item=record.record?{...record.record,path:record.path}:record;if(!item.path)continue;site[col]=site[col].filter(x=>x.path!==item.path);site[col].push(item);}}}catch{/* Bundled content is a read-only fallback until a file is loaded. */}
  // Recover new local documents so a reload never loses an unpublished record.
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('tt-studio-v1:'))continue;const d=JSON.parse(localStorage.getItem(key));if(!d?.baseSHA&&allowedFile(d.path)){parseSource(d.source,d.path);drafts.set(d.path,{...d,undo:[],redo:[],uploads:[]});}}}catch{/* The current file can still be opened normally. */}
  list();const wanted=new URLSearchParams(location.search).get('file');const first=wanted&&allowedFile(wanted)?wanted:fileRecords().find(x=>x.title?.toLowerCase().includes('scutoid'))?.path||fileRecords()[0]?.path;
  if(first)await open(first);void discover();
}
run(boot)();
