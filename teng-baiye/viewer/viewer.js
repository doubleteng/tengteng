const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const root = new URL('../', location.href);
const language = query.get('lang') === 'en' ? 'en' : 'zh';
const say = (zh, en) => language === 'en' ? en : zh;
document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
document.body.classList.toggle('embed', window.self !== window.top);
$('home').textContent = say('滕白也档案', 'Teng Baiye Archive');
$('download').textContent = say('下载原件', 'Download original');
$('fit').textContent = say('适合宽度', 'Fit width');
$('page-label').textContent = say('页', 'Page');
for (const [id, zh, en] of [['prev','上一页','Previous page'],['next','下一页','Next page'],['minus','缩小','Zoom out'],['plus','放大','Zoom in']]) $(id).setAttribute('aria-label',say(zh,en));
function validFile(value) {
  return /^(?:assets|reading|sources|shenbao)\/[\w.-]+\.pdf$/i.test(value || '');
}
const file = query.get('file');
const originals = query.get('original');
let pdf, rendering, version = 0, zoom = 1;
let current = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);
const scroll = $('viewport');
function fallback() {
  if (!validFile(file)) {
    $('status').textContent = say('未指定档案中的 PDF。', 'No archive PDF was selected.');
    return;
  }
  $('paper').hidden = true;
  const frame = document.createElement('object');
  frame.className = 'native-fallback';
  frame.type = 'application/pdf';
  frame.data = new URL(file, root).href + '#page=' + current;
  const link = document.createElement('a');
  link.href = frame.data;
  link.textContent = say('打开 PDF 原件', 'Open the PDF');
  frame.append(link);
  scroll.replaceChildren(frame);
}
async function draw() {
  if (!pdf) return;
  const token = ++version;
  rendering?.cancel();
  const pg = await pdf.getPage(current);
  if (token !== version) return;
  const unit = pg.getViewport({scale:1});
  const width = Math.max(180, scroll.clientWidth - 22);
  const viewport = pg.getViewport({scale:zoom * width / unit.width});
  const ratio = Math.min(window.devicePixelRatio || 1, 2, 4100 / Math.max(viewport.width, viewport.height));
  const canvas = document.createElement('canvas');
  canvas.id = 'paper';
  canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
  canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
  canvas.style.width = viewport.width + 'px';
  canvas.style.height = viewport.height + 'px';
  canvas.setAttribute('aria-label',say('第','Page ') + current);
  $('number').value = current;
  $('prev').disabled = current <= 1;
  $('next').disabled = current >= pdf.numPages;
  $('minus').disabled = zoom <= .5;
  $('plus').disabled = zoom >= 3;
  $('status').hidden = false;
  $('status').textContent = say('正在绘制第 '+current+' 页…','Rendering page '+current+'…');
  rendering = pg.render({canvas, viewport, transform:[ratio,0,0,ratio,0,0]});
  try {
    await rendering.promise;
    if (token !== version) return;
    $('paper').replaceWith(canvas);
    $('status').hidden = true;
  } catch (error) {
    if (error.name !== 'RenderingCancelledException' && token === version) fallback();
  }
}
function jump(value) {
  if (!pdf) return;
  current = Math.min(pdf.numPages, Math.max(1, Number(value) || 1));
  const u = new URL(location.href);
  u.searchParams.set('page', current);
  history.replaceState(null, '', u);
  scroll.scrollTo(0,0);
  draw().catch(fallback);
}
$('prev').onclick = () => jump(current - 1);
$('next').onclick = () => jump(current + 1);
$('number').onchange = () => jump(parseInt($('number').value,10));
for (const [id,adjust] of [['minus',-.25],['fit',0],['plus',.25]]) {
  $(id).onclick = () => { zoom = adjust ? Math.max(.5,Math.min(3,zoom+adjust)) : 1; draw().catch(fallback); };
}
scroll.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    jump(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
let timer;
window.addEventListener('resize', () => {clearTimeout(timer);timer=setTimeout(()=>draw().catch(fallback),120);});
async function open() {
  if (!validFile(file)) return fallback();
  const original = validFile(originals) ? originals : file;
  $('download').href = new URL(original,root).href;
  $('download').hidden = false;
  $('title').textContent = query.get('title') || file.split('/').pop();
  document.title = $('title').textContent + ' · 滕白也档案';
  const lib = await import('../vendor/pdfjs/pdf.min.mjs');
  const asset = sub => new URL('../vendor/pdfjs/'+sub,import.meta.url).href;
  lib.GlobalWorkerOptions.workerSrc = asset('pdf.worker.min.mjs');
  pdf = await lib.getDocument({url:new URL(file,root).href,cMapUrl:asset('cmaps/'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts/'),wasmUrl:asset('wasm/'),iccUrl:asset('iccs/'),isEvalSupported:false}).promise;
  $('count').textContent = pdf.numPages;
  $('number').max = pdf.numPages;
  current=Math.min(current,pdf.numPages);
  await draw();
}
open().catch(fallback);
