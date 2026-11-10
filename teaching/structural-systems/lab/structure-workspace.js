/* One workspace shell for the three building projects. Existing model and PDF engines remain authoritative. */
(function(W,D){
'use strict';
const api=W.StructureLabUI,studio=W.StructureStudio;if(!api||!studio)return;
const $=id=>D.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h=api.getHandles(),projects=['wood','steel','concrete'];
W.StructureDisplay={projection:'perspective',view:'3d',xray:false};
const bar=D.createElement('section');bar.id='buildingWorkspace';bar.hidden=true;bar.setAttribute('aria-label','Building project workspace');
bar.innerHTML=`<header class="bw-heading"><div><h1 id="bwTitle"></h1><p id="bwDescription"></p></div><button id="bwSources">Original PDF & tables</button></header><div class="bw-toolbar" role="toolbar" aria-label="Building model tools"><div id="bwClassification" class="bw-group"></div><label class="bw-chapter">Chapter <select id="bwChapter" aria-label="Chapter"></select></label><div class="bw-group bw-views" aria-label="Display methods"><button data-bw-view="plan">Plan</button><button data-bw-view="3d">3D</button><button data-bw-view="elevation">Elevation</button><select id="bwProjection" aria-label="Projection"><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select><select id="bwDisplay" aria-label="Display style"><option value="shaded">Shaded + shadows</option><option value="xray">X-ray</option></select><button id="bwFit">Fit</button><button id="bwControls">Controls</button><button id="bwMaximize" title="Maximize model">⛶</button></div></div>`;
$('workspace').before(bar);
const footer=D.createElement('footer');footer.id='buildingFooter';footer.hidden=true;footer.innerHTML='<span>Drag to orbit · Shift-drag to pan · Scroll to zoom · Click a member</span><button id="bwSave">Save study</button><button id="bwPNG">PNG</button><button id="bwCoach">Ask Coach</button>';$('workspace').after(footer);
let lastSpace='',signature='',queued=false;
function renderer(){const r=studio.route();return r.space==='concrete'?h.concrete.renderer:r.space==='steel'?(h.steel.renderer||h.steel.conceptLab.renderer):h.renderer;}
function select(id,label,options,value){return `<label>${label} <select id="${id}" aria-label="${label}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;}
const uses=[['office','Office · Ypsilanti'],['grocery','Grocery · Pinconning'],['library','Library · Houghton']];
function classify(r){
 let html;
 if(r.space==='wood')html=select('bwType','Truss',[['pratt','Pratt'],['howe','Howe'],['warren','Warren']],r.s.states.truss.type)+select('bwUse','Brief',uses,r.s.states.roof.occupancy);
 if(r.space==='concrete')html=select('bwType','Prototype',Object.keys(W.ConcreteBuildingData.prototypes).map(v=>[v,v]),h.concrete.state.prototype)+select('bwUse','Brief',Object.entries(W.ConcreteBuildingData.uses).map(([k,v])=>[k,v.name]),h.concrete.state.use);
 if(r.space==='steel')html=select('bwType','Bay',[['3060','3060 · 30 × 60 ft'],['4060','4060 · 40 × 60 ft']],h.steel.state.family)+select('bwRoof','Roof','ABCDE'.split('').map(v=>[v,v]),h.steel.state.option)+select('bwFloor','Floor',[['','Not selected'],...'PQRSTUVW'.split('').map(v=>[v,v])],h.steel.floorState.optionChosen?h.steel.floorState.option:'')+select('bwUse','Brief',uses,h.steel.state.use);
 if($('bwClassification').innerHTML!==html&&signature!==r.space+html){$('bwClassification').innerHTML=html;signature=r.space+html;for(const el of $('bwClassification').querySelectorAll('select'))el.onchange=()=>changeChoice(el.id,el.value);}
}
function changeChoice(id,value){
 const r=studio.route();
 if(r.space==='wood')api.setWoodChoice(id==='bwType'?'truss':'occupancy',value);
 else if(r.space==='concrete'){const el=$(id==='bwType'?'cbPrototype':'cbUse');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}
 else {
  const lab=h.steel,s=lab.state,lesson=s.lesson;
  if(id==='bwFloor'){lab.floorState.optionChosen=!!value;if(value){lab.floorState.option=value;lab.floorState.familyAtChoice=s.family;}lab.floorState.briefConfirmed=!!value;lab.floorState.layoutConfirmed=false;lab.floorState.reviewed={};W.SteelFloor.sync(s,lab.floorState);}
  else {const key={bwType:'family',bwRoof:'option',bwUse:'use'}[id];lab.state=W.SteelRoof.normalize({...s,[key]:value,lesson:W.SteelRoof.steps.some(x=>x.id===lesson)?lesson:lab.roofLesson||'brief',familyChosen:true,optionChosen:true,useChosen:true,briefConfirmed:true,completed:{},tablePick:null});lab.state.lesson=lesson;lab.floorState.layoutConfirmed=false;lab.floorState.reviewed={};W.SteelFloor.sync(lab.state,lab.floorState);}
  lab.render();
 }
 sync();studio.sync();
}
function applyDisplay(){
 const d=W.StructureDisplay;
 if(studio.route().space==='wood')api.setDisplay({projection:d.projection,xray:d.xray,mode:d.view==='3d'?'3d':'2d',plane:d.view==='3d'?'auto':d.view});
 const rr=renderer();if(rr){rr.applyDisplay();rr.render();}
 $('bwProjection').value=d.projection;$('bwProjection').disabled=d.view!=='3d';$('bwDisplay').value=d.xray?'xray':'shaded';
 for(const b of bar.querySelectorAll('[data-bw-view]'))b.setAttribute('aria-pressed',String(b.dataset.bwView===d.view));
}
function sources(){const r=studio.route();if(r.space==='concrete')h.concrete.openSource();else if(r.space==='wood')W.WoodPDFTables.open(r.id==='floor'?'floor':r.id==='truss'?'purlin':'roof');else {const b=$('studioOpenSources');if(b&&$('steelScreen').querySelector('.sr-reading'))b.click();else {api.setPanel('explain');W.StructureViewport.setPanel(true);}}}
function arrange(r){
 const screen=$(r.space==='concrete'?'concreteScreen':r.space==='steel'?'steelScreen':'labWorkspace');
 const panel=r.space==='wood'?$('labInspector'):screen.querySelector('.concrete-aside,.sr-aside,.steel-aside');if(!panel)return;
 let display=panel.querySelector('.bw-project-controls');if(!display){display=D.createElement('details');display.className='bw-project-controls';display.open=true;display.innerHTML='<summary>Model display & assembly</summary><div class="bw-project-tools"></div>';panel.prepend(display);}
 const box=display.lastElementChild;
 // Move, do not clone: existing bound controls continue to update their own model state.
 if(r.space==='wood'){for(const el of D.querySelectorAll('#labWorkspace .view-toggles,#labWorkspace .studio-model-actions'))box.append(el);}
 if(r.space==='steel')for(const el of [...screen.querySelectorAll('.sr-layers,.steel-toolbar,.sr-modelbar-heading > div')])if(!el.closest('.bw-project-controls'))box.append(el);
 if(r.space==='concrete'){
  const s=h.concrete.state;box.innerHTML='<label><input id="bwConcreteRoof" type="checkbox"> Roof</label>'+select('bwConcreteStage','Stage',[['1','1 · Raft'],['2','2 · Vertical members'],['3','3 · Floor beams'],['4','4 · Precast stairs'],['5','5 · Floor deck'],['6','6 · Roof beams'],['7','7 · Roof deck']],s.stage)+'<button id="bwConcreteExport">Export model OBJ</button>';
  $('bwConcreteRoof').checked=s.showRoof;$('bwConcreteRoof').onchange=e=>{s.showRoof=e.target.checked;h.concrete.render();};$('bwConcreteStage').onchange=e=>{s.stage=+e.target.value;h.concrete.render();};$('bwConcreteExport').onclick=()=>h.concrete.exportModel();
 }
 display.hidden=!box.children.length;
}
function sync(){
 const r=studio.route(),active=projects.includes(r.space);D.body.classList.toggle('building-unified',active);bar.hidden=!active;footer.hidden=!active;if(!active)return;
 if(r.space==='steel'&&((W.SteelFloor.isFloor(r.id)&&W.SteelFloor.lecture(r.id)===2.1)||W.SteelFoundation.isFoundation(r.id))&&!h.steel.floorState.optionChosen){h.steel.floorState.optionChosen=true;h.steel.floorState.familyAtChoice=h.steel.state.family;h.steel.floorState.briefConfirmed=true;W.SteelFloor.sync(h.steel.state,h.steel.floorState);h.steel.render();}
 D.body.classList.remove('studio-rail-open');$('studioTaskToggle')?.setAttribute('aria-expanded','false');
 $('bwTitle').textContent=r.space[0].toUpperCase()+r.space.slice(1)+' Building Project';
 $('bwDescription').textContent=r.space==='concrete'?'60 × 120 ft · Select members in the original PDF · Explain the load path':r.space==='steel'?'Shared roof, partial floor & foundations · Read the original tables · Trace the load path':'Roof, truss, floor & building assembly · Read the original tables · Trace the load path';
 classify(r);
 if(lastSpace!==r.space){$('bwChapter').innerHTML=studio.groupsFor(r).map(([name,rows])=>`<optgroup label="${esc(name)}">${rows.map(([id,title])=>`<option value="${esc(id)}">${esc(title)}</option>`).join('')}</optgroup>`).join('');lastSpace=r.space;}
 $('bwChapter').value=r.id;arrange(r);const rr=renderer();if(rr){rr.applyDisplay();rr.resize();}
 $('bwProjection').value=W.StructureDisplay.projection;$('bwProjection').disabled=W.StructureDisplay.view!=='3d';$('bwDisplay').value=W.StructureDisplay.xray?'xray':'shaded';
 for(const b of bar.querySelectorAll('[data-bw-view]'))b.setAttribute('aria-pressed',String(b.dataset.bwView===W.StructureDisplay.view));
}
$('bwChapter').onchange=()=>{studio.go(studio.route().space,$('bwChapter').value);sync();};
for(const b of bar.querySelectorAll('[data-bw-view]'))b.onclick=()=>{W.StructureDisplay.view=b.dataset.bwView;applyDisplay();};
$('bwProjection').onchange=()=>{W.StructureDisplay.projection=$('bwProjection').value;applyDisplay();};
$('bwDisplay').onchange=()=>{W.StructureDisplay.xray=$('bwDisplay').value==='xray';applyDisplay();};
$('bwFit').onclick=()=>renderer()?.reset();$('bwControls').onclick=()=>W.StructureViewport.setPanel(!D.body.classList.contains('viewport-panel-open'));
$('bwSources').onclick=sources;$('bwSave').onclick=()=>api.save();$('bwCoach').onclick=()=>api.askCoach();$('bwMaximize').onclick=()=>$('viewportMaximize').click();
$('bwPNG').onclick=()=>{const canvas=renderer()?.canvas;if(!canvas)return;canvas.toBlob(blob=>{if(!blob)return;const a=D.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='StructureLab-'+studio.route().space+'-'+W.StructureDisplay.projection+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
W.StructureWorkspace={sync,renderer,restoreDisplay(raw){W.StructureDisplay={projection:raw?.projection==='orthographic'?'orthographic':'perspective',view:['3d','plan','elevation'].includes(raw?.view)?raw.view:'3d',xray:raw?.xray===true};sync();}};
D.addEventListener('structure:layout',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});});sync();
})(window,document);
