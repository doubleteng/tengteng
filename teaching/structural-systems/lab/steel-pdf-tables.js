/* The canvas renders the supplied PDF itself. Buttons are transparent hit regions,
 * never replacements for the printed cells. All rectangles use PDF page points. */
(function(root){
'use strict';
const files={deck:'Steel_Roof_Deck_Span_Load_Table',joist:'Joist_Span_Load_Tables',girder:'Joist_Girder_Span_Load_Tables',extension:'Top_Chord_Extensions',connection:'Joist_Girder_Column_Connection'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=(kind,page)=>'steel-sources/'+files[kind]+'.pdf'+(page?'#page='+page:'');
const docs=new Map(),poses=new Map();let library;
async function documentFor(kind){
 if(!library)library=import('./vendor/pdfjs/pdf.min.mjs').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;return pdf;});
 if(!docs.has(kind))docs.set(kind,library.then(pdf=>pdf.getDocument({url:url(kind),isEvalSupported:false}).promise).catch(e=>{docs.delete(kind);throw e;}));
 return docs.get(kind);
}
function spec(s,c){const M=root.SteelPDFMap,D=root.SteelRoofData,R=root.SteelRoof,kind=s.lesson.replace('-table','');const buttons=[],marks=[];let target,header,page=1,guide;
 const add=(rect,label,pick,selected=false)=>{buttons.push({rect,label,pick,selected});if(selected)target=rect;};
 if(kind==='deck'){
  const xs=[146,183.6,221.2,258.8,296.4,334,371.6,409.2,446.8,484.4,522];
  ['single','double','triple'].forEach((condition,k)=>R.gauges.forEach((g,i)=>{
   const y=372+(k*4+i)*12;
   R.spans.forEach((span,j)=>{const cell=R.deck[condition][i][j];add([xs[j],y,xs[j+1]-xs[j],12],`${condition} span, ${g} gauge, ${span} ft: ${cell?cell[0]+' total / '+cell[1]+' deflection psf':'blank source entry'}`,{gauge:g,continuity:condition,tablePick:{gauge:g,span}},s.continuity===condition&&s.tablePick?.gauge===g&&s.tablePick?.span===span);});
   if(s.continuity===condition&&s.gauge===g)marks.push({rect:[109,y,413,12],type:'row'});
  }));
  const j=R.spans.indexOf(c.deckSpan),k=['single','double','triple'].indexOf(s.continuity),i=R.gauges.indexOf(s.gauge);
  if(j>=0)marks.push({rect:[xs[j],359.5,xs[j+1]-xs[j],156.5],type:'column'});
  target=target||[j>=0?xs[j]:146,372+(k*4+i)*12,37.6,12];header=[73,334,487,38];guide=`${s.continuity}-span support condition · ${s.gauge} ga · next listed span ${c.deckSpan??'beyond table'} ft`;
 }else if(kind==='joist'){
  const m=M.joist[c.L];page=m.page;guide=`${c.L} ft nominal span block · ${s.joist} · ${s.readColumn.toUpperCase()} column · plf`;
  for(const [name,row] of Object.entries(m.rows)){
   add(row.rect,`${name}, ${c.L} ft nominal span. Select this source row.`,{joist:name},name===s.joist);
   if(name===s.joist){marks.push({rect:row.rect,type:'row'},{rect:row.cells[s.readColumn],type:'cell'});header=[row.rect[0]-32,76,row.rect[2]+32,40];target=[row.rect[0]-32,row.rect[1],row.rect[2]+32,row.rect[3]];}
  }
 }else{
  const m=M.girder[c.G],g=D.girders[c.G];page=m.page;guide=`${c.G} ft span · ${s.spaces} spaces · ${s.girderDepth} in depth · ${s.girderLoad} kip ASD column`;
  for(const row of m.groups[s.spaces]){
   const values=g.groups[s.spaces].find(r=>r.depth===row.depth).weights;
   row.cells.forEach((rect,i)=>add(rect,`${row.depth} inch depth, ${g.loads[i]} kip ASD panel load: ${values[i]===null?'blank source entry':values[i]+' plf estimated weight'}`,{girderDepth:row.depth,girderLoad:g.loads[i]},row.depth===s.girderDepth&&g.loads[i]===s.girderLoad));
   if(row.depth===s.girderDepth)marks.push({rect:row.rect,type:'row'});
  }
  const rows=m.groups[s.spaces],col=g.loads.indexOf(c.gColumn),rect=rows[0].rect;
  marks.push({rect:[58,rect[1],rect[0]+rect[2]-58,rows.at(-1).rect[1]+rows.at(-1).rect[3]-rect[1]],type:'group'});
  if(col>=0){const h=m.headers[col];marks.push({rect:[h[0],99,h[2],rows.at(-1).rect[1]+rows.at(-1).rect[3]-99],type:'column'});}
  header=[target?.[0]||176,94,22,28];
 }
 return {kind,page,buttons,marks,target,header,guide};
}
class Viewer{
 constructor(host,s,c,pick){this.host=host;this.pick=pick;this.serial=0;this.scale=2;this.data=spec(s,c);this.key=this.data.kind+this.data.page;
  host.innerHTML=`<div class="sr-pdf-toolbar"><span>Original PDF · p. ${this.data.page}</span><div><button data-pdf="out" aria-label="Zoom PDF out">−</button><output aria-label="PDF zoom"></output><button data-pdf="in" aria-label="Zoom PDF in">+</button><button data-pdf="fit">Whole page</button><button data-pdf="header">Table header</button><button data-pdf="selection">My row</button></div></div><p class="sr-pdf-guide"></p><div class="sr-pdf-scroll" tabindex="0" aria-label="Original PDF page. Scroll in both directions; use zoom to read printed values."><div class="sr-pdf-page"><canvas role="img" aria-label="Original supplied ${this.data.kind} PDF, page ${this.data.page}"></canvas><div class="sr-pdf-overlay"></div></div></div><p class="sr-pdf-status" role="status">Loading the original PDF…</p><a class="sr-pdf-file" href="${url(this.data.kind,this.data.page)}" target="_blank" rel="noopener">${files[this.data.kind]}.pdf · open full document</a>`;
  this.scroll=host.querySelector('.sr-pdf-scroll');this.sheet=host.querySelector('.sr-pdf-page');this.canvas=host.querySelector('canvas');this.overlay=host.querySelector('.sr-pdf-overlay');
  const pose=poses.get(this.key);this.scale=pose?.scale||(this.data.kind==='deck'?1.6:this.data.kind==='joist'?2:2.2);
  host.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>this.action(b.dataset.pdf));
  this.overlay.onclick=e=>{const b=e.target.closest('[data-pdf-cell]');if(b)this.pick(this.data.buttons[+b.dataset.pdfCell].pick);};
  this.scroll.onscroll=()=>poses.set(this.key,{scale:this.scale,left:this.scroll.scrollLeft,top:this.scroll.scrollTop});
  this.update(s,c);this.load(pose);
 }
 async load(pose){try{this.pdfPage=await (await documentFor(this.data.kind)).getPage(this.data.page);await this.paint();if(!this.host.isConnected)return;if(pose){this.scroll.scrollLeft=pose.left;this.scroll.scrollTop=pose.top;}else this.focus(this.data.target);this.host.querySelector('.sr-pdf-status').textContent='Click a printed row or cell to apply a trial. Outlined regions belong to this study.';}catch(e){console.warn('Original PDF could not render:',e.message,e.details||'');this.host.querySelector('.sr-pdf-status').textContent='The PDF could not load here. Open the full document below, or try again.';const b=document.createElement('button');b.textContent='Retry PDF';b.onclick=()=>{b.remove();this.load();};this.host.querySelector('.sr-pdf-status').append(' ',b);}}
 update(s,c){this.data=spec(s,c);this.host.querySelector('.sr-pdf-guide').textContent=this.data.guide;this.drawOverlay();}
 drawOverlay(){const style=rect=>`left:${rect[0]/612*100}%;top:${rect[1]/792*100}%;width:${rect[2]/612*100}%;height:${rect[3]/792*100}%`;
  this.overlay.innerHTML=this.data.marks.map(m=>`<span class="sr-pdf-mark sr-pdf-${m.type}" style="${style(m.rect)}"></span>`).join('')+this.data.buttons.map((b,i)=>`<button data-pdf-cell="${i}" style="${style(b.rect)}" aria-label="${esc(b.label)}" title="${esc(b.label)}" aria-pressed="${b.selected}" ${Object.entries(b.pick).filter(([k])=>['joist','girderDepth','girderLoad','gauge','continuity'].includes(k)).map(([k,v])=>`data-source-${k.toLowerCase()}="${esc(v)}"`).join(' ')} ${b.pick.tablePick?`data-source-span="${b.pick.tablePick.span}"`:''}></button>`).join('');
 }
 async paint(){if(!this.pdfPage)return;const serial=++this.serial;this.renderTask?.cancel();const v=this.pdfPage.getViewport({scale:this.scale}),ratio=Math.min(devicePixelRatio||1,2);this.sheet.style.width=v.width+'px';this.sheet.style.height=v.height+'px';this.canvas.width=Math.ceil(v.width*ratio);this.canvas.height=Math.ceil(v.height*ratio);this.host.querySelector('output').textContent=Math.round(this.scale*100)+'%';
  this.renderTask=this.pdfPage.render({canvasContext:this.canvas.getContext('2d'),viewport:v,transform:[ratio,0,0,ratio,0,0]});try{await this.renderTask.promise;if(serial===this.serial)this.host.dataset.pdfReady='true';}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
 }
 focus(rect){if(!rect)return;this.scroll.scrollLeft=Math.max(0,(rect[0]+rect[2]/2)*this.scale-this.scroll.clientWidth/2);this.scroll.scrollTop=Math.max(0,rect[1]*this.scale-this.scroll.clientHeight*.3);}
 async action(a){if(a==='header'||a==='selection'){this.focus(a==='header'?this.data.header:this.data.target);return;}const cx=(this.scroll.scrollLeft+this.scroll.clientWidth/2)/this.scale,cy=(this.scroll.scrollTop+this.scroll.clientHeight/2)/this.scale;this.scale=a==='fit'?Math.max(.4,Math.min((this.scroll.clientWidth-16)/612,(this.scroll.clientHeight-16)/792)):Math.max(.5,Math.min(4,this.scale+(a==='in'?.25:-.25)));await this.paint();if(a==='fit'){this.scroll.scrollLeft=0;this.scroll.scrollTop=0;}else{this.scroll.scrollLeft=cx*this.scale-this.scroll.clientWidth/2;this.scroll.scrollTop=cy*this.scale-this.scroll.clientHeight/2;}poses.set(this.key,{scale:this.scale,left:this.scroll.scrollLeft,top:this.scroll.scrollTop});}
}
root.SteelPDFTables={url,spec,html:()=>'<div class="sr-pdf-host"></div>',mount(host,s,c,pick){if(!host)return;const data=spec(s,c),key=data.kind+data.page;if(host.pdfViewer?.key===key){host.pdfViewer.pick=pick;host.pdfViewer.update(s,c);}else host.pdfViewer=new Viewer(host,s,c,pick);}};
})(window);
