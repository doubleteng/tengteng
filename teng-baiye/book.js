'use strict';
function renderBook(){
  const b=window.BOOK_INDEX;
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const mode=['plates','life','records'].includes(params.get('view'))?params.get('view'):'pages';
  const token=params.get('p')||'f1';
  const page=Math.max(1,Math.min(142,/^f[1-8]$/.test(token)?Number(token.slice(1)):(Number(token)||1)+8));
  const group=b.groups.find(g=>page>=g[3]&&page<=g[4]);
  const label=n=>n<=8?say('卷前 ','Front ')+n:say('印页 ','p. ')+(n-8);
  const link=n=>'#book?p='+(n<=8?'f'+n:String(n-8));
  const scan='book/pages/'+String(page).padStart(3,'0')+'.webp';
  const sections=[['pages','原书','Pages'],['plates','图版','Plates'],['life','生平与年表','Biography'],['records','作品文字著录','Works in documents']];
  const nav=sections.map(([k,z,e])=>`<a class="chip" ${k===mode?'aria-current="page"':''} href="${k==='pages'?link(page):'#book?view='+k}">${say(z,e)}</a>`).join('');
  const showPlate=z=>`<article class="book-tile"><button data-material="${z.aid}"><img loading="lazy" src="${mat(z.aid).thumb}" alt="${esc(say(z.zh,z.en))}"></button><a href="${link(z.page+8)}">${label(z.page+8)}</a><h3>${esc(say(z.zh,z.en))}</h3>${z.wid?`<button class="text-link small" data-work="${z.wid}">${z.wid} · ${say('作品条目','Work record')} ↗</button>`:''}</article>`;
  const index=`<div class="book-toc"><label>${say('章节','Section')}<select id="book-chapter">${b.groups.map(g=>`<option value="${link(g[3])}" ${g[0]===group[0]?'selected':''}>${esc(say(g[1],g[2]))}</option>`).join('')}</select></label><label>${say('书页','Page')}<select id="book-page">${Array.from({length:142},(_,j)=>`<option value="${link(j+1)}" ${j+1===page?'selected':''}>${label(j+1)}</option>`).join('')}</select></label></div>`;
  let contents='';
  if(mode==='pages'){
    const figures=b.plates.filter(z=>z.page===page-8);
    const pdf=mat(group[5]);
    contents=`${index}<div class="book-controls">${page>1?`<a href="${link(page-1)}">← ${say('上一页','Previous')}</a>`:'<span></span>'}<b>${esc(say(group[1],group[2]))} · ${label(page)}</b>${page<142?`<a href="${link(page+1)}">${say('下一页','Next')} →</a>`:'<span></span>'}</div><div class="book-page"><a href="${esc(pdfReader(pdf.file,page-group[3]+1,'画坛遗珠'))}" target="_blank" rel="noopener"><img src="${scan}" alt="${esc(say('《画坛遗珠》','Study of Teng Baiye'))} · ${label(page)}"></a></div><p class="book-attrib">${say('包铭新、王瑞华《滕白也研究》，东华大学出版社，2008年。','Bao Mingxin and Wang Ruihua, Study of Teng Baiye, Donghua University Press, 2008.')} <a href="${esc(pdfReader(pdf.file,page-group[3]+1,'画坛遗珠'))}" target="_blank" rel="noopener">${say('放大原书 PDF','Open full-resolution PDF')} ↗</a></p>${figures.length?`<h2>${say('本页图版','Illustrations on this page')}</h2><div class="book-grid">${figures.map(showPlate).join('')}</div>`:''}`;
  }else if(mode==='plates'){
    contents=`<div class="book-grid">${b.plates.map(showPlate).join('')}</div>`;
  }else if(mode==='life'){
    contents=b.life.map(e=>`<article class="book-line"><div><b>${esc(e.date)}</b><br><a href="${link(e.page+8)}">${label(e.page+8)} ↗</a></div><div><p>${esc(say(e.zh,e.en))}</p>${lang==='zh'&&(e.caution||e.status)?`<small>${esc(e.caution||e.status)}</small>`:''}</div></article>`).join('');
  }else{
    contents=b.records.map(e=>`<article class="book-line"><div><a href="${link(e.page+8)}">${label(e.page+8)} ↗</a></div><div><h3>${esc(say(e.title,e.en))}</h3><p>${esc((e.recipient?say('书中所列收受人 ','Recipient listed in the book: ')+e.recipient+' · ':'')+(lang==='zh'?(e.note||''):e.locator))}</p></div></article>`).join('');
  }
  return `<div class="wrap book-section">${pageHead('画坛遗珠','Study of Teng Baiye')}<p class="book-byline">${say('包铭新、王瑞华　东华大学出版社，2008。','Bao Mingxin and Wang Ruihua · Donghua University Press, 2008.')}</p><nav class="book-tabs">${nav}</nav>${contents}</div>`;
}
document.addEventListener('change',e=>{if(e.target.id==='book-page'||e.target.id==='book-chapter')location.hash=e.target.value;});
