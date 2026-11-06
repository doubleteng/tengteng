/* Original lecture pages with transparent, keyboard-accessible cell overlays.
   Capacities and geometry remain distinct; selecting a cell never certifies a building. */
(function(W){
'use strict';
const E=W.StructureEngine,P=W.WoodProject,F=W.FloorLayout,C=W.CourseIntegration;
const use=['office','grocery','library'],n=(x,d=2)=>Number(x.toFixed(d)),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sources={roof:{page:1,lecture:'Lecture 6 · p. 69',title:'1 · Roof MPP',url:'https://drive.google.com/file/d/1PfjudK3MflzwjUCVHM1KLGT3LOXVgEL1/view',header:[340,203,588,75]},purlin:{page:2,lecture:'Lecture 6 · p. 79',title:'2 · Glulam purlin',url:'https://drive.google.com/file/d/1PfjudK3MflzwjUCVHM1KLGT3LOXVgEL1/view',header:[392,118,518,63]},floor:{page:3,lecture:'Lecture 7 · p. 44',title:'3 · Floor MPP',url:'https://drive.google.com/file/d/19tvjBUzl7Q5qubdlg8Mf2Rxq2ZGBHiBw/view',header:[332,207,581,62]},width:{page:4,lecture:'Lecture 7 · p. 34',title:'4 · Panel widths',url:'https://drive.google.com/file/d/19tvjBUzl7Q5qubdlg8Mf2Rxq2ZGBHiBw/view',header:[40,340,440,120]}};
const cells=[];
use.forEach((occupancy,i)=>{
 cells.push({id:'roof-'+occupancy,type:'roof',occupancy,value:[8.02,7.01,5.38][i],rect:[[450,278,28,16],[618,278,28,16],[785,278,28,16]][i]});
 cells.push({id:'floor-'+occupancy,type:'floor',occupancy,value:[8.92,7.76,6.09][i],rect:[[654,284,65,19],[719,284,64,19],[848,284,65,19]][i]});
});
// Fixed assignment section, 3.5 × 9.5 in. Both printed rows are inspectable.
const simple=[2683,1969,1505,1188,961,792,665,565,478,387],multiple=[2066,1516,1159,914,739,609,510,434,373,324];
for(let i=0;i<10;i++)for(const support of ['simple','multiple'])cells.push({id:'purlin-'+support+'-'+(i+6),type:'purlin',support,span:i+6,value:(support==='simple'?simple:multiple)[i],rect:[529,181+i*32.58+(support==='multiple'?10.85:0),42,10.85]});
// The source panel-width diagram runs from widest at left to narrowest at right.
[142,118,94,46].forEach((value,i)=>cells.push({id:'width-'+value,type:'width',value,rect:[[48,387,119,65],[184,387,106,65],[303,387,90,65],[410,387,64,65]][i]}));
const byId=new Map(cells.map(c=>[c.id,c]));
function normalize(raw){return Object.fromEntries(Object.keys(sources).filter(k=>byId.get(raw?.[k])?.type===k).map(k=>[k,raw[k]]));}
function selection(states,type){return byId.get(states.roof.tableSelections?.[type]);}
function apply(states,id){
 const c=byId.get(id);if(!c)throw Error('Choose an outlined cell from the original PDF.');
 if(c.support==='multiple')throw Error('This row requires a continuous purlin. The current model has simply supported purlin segments. Select the Simple row for this model; 510 plf is not the 12 ft Simple capacity (665 plf).');
 if(c.occupancy)P.setBrief(states,c.occupancy);
 if(c.type==='roof'){
  states.roof.deck='f10-2';states.roof.deckDeflection=240;
  states.roof.purlinSpacing=Math.floor((c.value+states.roof.b/12)*4)/4;
  if(states.truss.mode!=='custom')states.truss.autoPanels=true;
  P.linkRoof(states);
 }else if(c.type==='purlin'){
  states.roof.purlinMode='course';states.roof.b=3.5;states.roof.h=9.5;
  states.roof.trussSpacing=c.span;states.truss.spacing=c.span;P.linkRoof(states);
 }else if(c.type==='floor'){
  const p=states.floor.layout||(states.floor.layout=F.defaults());p.enabled=true;p.stage='framing';
  // Keep the source maximum as evidence; the actual centers include support width.
  p.beamSpacing=Math.floor((Math.min(c.value,8.44)+p.beamWidth/12)*48)/48;
 }else if(c.type==='width'){
  const p=states.floor.layout||(states.floor.layout=F.defaults());p.enabled=true;p.panelWidthIn=c.value;p.stage='panels';
 }
 states.roof.tableSelections={...normalize(states.roof.tableSelections),[c.type]:id};
 P.coordinateRoof(states);return c;
}
function report(states,type){
 const c=selection(states,type),r=P.roofEstimate(states);
 if(type==='roof')return {basis:'F10-2 · 2 in nominal · single span · snow L/240 · +15 psf dead load included',value:c?c.value+' ft maximum clear span':'Select an outlined course load cell',actual:n(r.clear)+' ft clear / '+n(r.limit)+' ft limit; '+n(r.actual)+' ft node spacing',valid:!!c&&c.occupancy===states.roof.occupancy&&r.tableOK,extra:'Span remaining below the limit: '+n(r.limit-r.clear)+' ft. Each purlin bears at a top-chord node. The target spacing is rounded down to the input increment; the truss panel count determines the actual spacing. Roof economy target: within 2 in of the maximum, without exceeding it. Stock length is not unsupported span.'};
 if(type==='floor'){
  const g=F.geometry(states),vibration=8.44,match=!!c&&c.occupancy===states.floor.occupancy,ok=match&&g.clear<=Math.min(c.value,vibration)+1e-7&&states.floor.bayDead<=15;
  return {basis:'F10-3 · 3 in nominal · single span · LL L/360 · total L/240 · +15 psf dead load included',value:c?c.value+' ft live-load span limit':'Select the course live-load cell',actual:n(g.clear)+' ft clear = '+n(g.maxSpacing)+' ft centers − '+n(g.p.beamWidth)+' in support width',valid:ok,extra:'The applied beam spacing uses the smaller live-load and vibration limit. The printed vibration-controlled span is '+vibration+' ft. '+(g.clear>vibration?'Current clear span exceeds that separate criterion. ':'Current clear span is within that separate criterion. ')+'Floor economy target: within 1 ft of the live-load span limit. Keep about 3,600 sf of elevated floor and support every panel end seam.'};
 }
 if(type==='width')return {basis:'One course panel width throughout this floor option',value:c?c.value+' in / '+F.dimension(c.value/12):'Select a panel in the original diagram',actual:(states.floor.layout?.panelWidthIn||142)+' in model panel width',valid:!!c&&c.value===states.floor.layout?.panelWidthIn,extra:'46, 94, 118 and 142 in are panel widths. A 142 in panel is 2 in narrower than a 12 ft grid. Panel stock length (32–48 ft) and beam-supported clear span are separate dimensions.'};
 const match=!!c&&c.support==='simple'&&Math.abs(c.span-states.roof.trussSpacing)<1e-7&&states.roof.b===3.5&&states.roof.h===9.5;
 const a=r.layout,trib=Math.max(...a.nodes.map((x,i)=>((i?x.x-a.nodes[i-1].x:0)+(i<a.nodes.length-1?a.nodes[i+1].x-x.x:0))/2)),demand=r.q*trib+r.purlinWeight;
 return {basis:'24F-V4 · 115% load duration · 3.5 × 9.5 in · Simple span · plf',value:c?c.value+' plf allowable at '+c.span+' ft':'Select a Simple cell in the 9.5 in depth column',actual:n(demand)+' plf = '+n(r.q)+' psf × '+n(trib)+' ft tributary width + '+n(r.purlinWeight)+' plf self-weight',valid:match&&demand<=c.value,extra:(c&&!match?'The model span or section has changed; this saved cell is no longer applicable. ':'')+'Nominal course frame spacing: '+E.occupancies[states.roof.occupancy].spacing+' ft (±10% adjustment band). Current spacing: '+n(states.roof.trussSpacing)+' ft. '+(c&&match?'Capacity minus demand: '+n(c.value-demand)+' plf. ':'')+'The course purlin weighs 8 plf; its weight per foot does not increase when the span changes. Roof pressure includes snow + additional dead + MPP self-weight once. A surplus of 0–75 plf is an economy target, not the strength criterion. Multiple rows require continuous supports and a separate analysis.'};
}
function spec(states,type){const src=sources[type],s=selection(states,type),buttons=cells.filter(c=>c.type===type).map(c=>({rect:c.rect,pick:{woodCell:c.id},selected:s?.id===c.id,label:c.type==='purlin'?`${c.span} ft ${c.support}, 3.5 by 9.5 in: ${c.value} plf${c.support==='multiple'?' — inspect support condition':' — apply to model'}`:c.type==='width'?`${c.value} in panel width — apply to floor`:`${c.occupancy}: ${c.value} ft ${type} span — apply to model`}));return {kind:'wood',page:src.page,size:[960,540],header:src.header,target:s?.rect||buttons[0].rect,buttons,marks:[],guide:src.lecture+' · '+report(states,type).basis};}
let host,context,current='roof',opened=false;
function render(){if(!host||!context)return;const {states}=context,src=sources[current],r=report(states,current);
 host.querySelector('[data-wood-model]').textContent='View '+(['floor','width'].includes(current)?'floor':'roof')+' model →';
 host.querySelectorAll('[data-wood-table]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.woodTable===current)));
 host.querySelector('.wood-table-readout').innerHTML=`<strong>${esc(r.value)}</strong><p>${esc(r.actual)}</p><p class="wood-table-check">${r.valid?'Selected table check satisfied':'Select / review this table condition'}</p><p>${esc(r.extra)}</p><a href="${src.url}" target="_blank" rel="noopener">Open complete ${src.lecture.split(' · ')[0]} PDF</a>`;
 W.SteelPDFTables.mount(host.querySelector('.sr-pdf-host'),{pdfSpec:spec(states,current)},{},pick=>{
  try{apply(states,pick.woodCell);context.o.refresh();render();host.querySelector('.wood-table-message').textContent='Applied to the shared wood model. '+(byId.get(pick.woodCell).occupancy?E.occupancies[states.roof.occupancy].label+'; roof snow '+E.occupancies[states.roof.occupancy].snow+' psf / floor live '+E.occupancies[states.floor.occupancy].live+' psf. ':'')+report(states,current).actual;}
  catch(e){host.querySelector('.wood-table-message').textContent=e.message;}
 });
}
function close(){opened=false;if(host)host.hidden=true;document.getElementById('labWorkspace')?.classList.remove('wood-tables-open');document.querySelector('[data-action="sources"]')?.focus();W.StructureLabUI?.resize();}
function open(type){if(!context)return;current=sources[type]?type:'roof';opened=true;
 if(!host){host=document.createElement('section');host.className='wood-table-workspace';host.setAttribute('aria-label','Original wood lecture tables');host.innerHTML=`<div class="wood-table-head"><strong>Read the original table → apply to model</strong><button data-wood-close>Back to model ×</button></div><nav aria-label="Wood table sequence">${Object.entries(sources).map(([id,s])=>`<button data-wood-table="${id}">${s.title}</button>`).join('')}</nav><p class="wood-table-message" role="status">Outlined cells apply the course choices. Original page content and printed notes are preserved.</p><button data-wood-model>View model →</button><div class="sr-pdf-host"></div><div class="wood-table-readout" aria-live="polite"></div>`;document.getElementById('canvasWrap').before(host);host.querySelector('[data-wood-close]').onclick=close;host.querySelector('[data-wood-model]').onclick=()=>{const target=['floor','width'].includes(current)?'floor':'roof';close();context.o.go(target);};host.querySelectorAll('[data-wood-table]').forEach(b=>b.onclick=()=>{current=b.dataset.woodTable;host.querySelector('.wood-table-message').textContent='Click an outlined cell on the original page.';render();});host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});}
 host.hidden=false;document.getElementById('labWorkspace').classList.add('wood-tables-open');render();host.querySelector('[data-wood-close]').focus();
}
W.SteelPDFTables.registerSource('wood',{url:'wood-sources/Wood_Lecture_Tables.pdf',name:'Wood_Lecture_Tables',label:'Original lecture page extracts · PDF'});
const oldPanel=C.panel;C.panel=function(id,states){let html=oldPanel(id,states);if(P.has(id))html=`<div class="response-card"><strong>Original lecture tables</strong><p>Click the printed span or load cell to update this shared model.</p><button id="woodOpenTable" class="primary-btn">Open ${id==='floor'?'floor':'roof'} PDF table</button></div>`+html;return html;};
const oldBind=C.bind;C.bind=function(id,states,o){oldBind(id,states,o);context={states,o};if(!P.has(id)){close();return;}const type=id==='floor'?'floor':id==='truss'?'purlin':'roof';for(const key of ['woodOpenTable','courseReferences']){const b=document.getElementById(key);if(b)b.onclick=()=>open(type);}if(opened)render();};
if(W.COACH_KNOWLEDGE)W.COACH_KNOWLEDGE.concepts.push({id:'WOOD-PDF-2026',title:'Wood original PDF table workflow',question:'Does the printed table condition match your current model?',why:'In Wood Sources & tables, click the original lecture PDF cells. F10-2 roof uses snow L/240. F10-3 floor uses live-load L/360 and the separate 8.44 ft vibration limit. The model applies the smaller floor span. Course 3.5 × 9.5 in purlins weigh 8 plf independent of span. At 12 ft the Simple row is 665 plf; 510 plf belongs to Multiple and cannot verify the segmented simple-span model. Roof self-weight still transfers to the purlins once. Table choices are saved as source IDs and must be reviewed when conditions change. A capacity surplus up to 75 plf and roof/floor span margins of 2 in/1 ft are economy objectives.',source:'Lecture 6 pp. 69, 79; Lecture 7 pp. 34, 44; Sep 15–22 recordings',refs:[{url:sources.roof.url},{url:sources.floor.url}]});
W.WoodPDFTables={cells,sources,normalize,apply,report,spec,open,close,refresh(){if(opened)render();}};
})(window);
