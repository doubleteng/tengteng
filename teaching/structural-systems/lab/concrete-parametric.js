/* Shared decision/dependency engine for all four course prototypes.
   Course constraints, student inputs and source-derived values stay distinct. */
(function(W){'use strict';const M=W.ConcreteBuildingData,P=W.ConcretePDFData;
const gridKeys=['gridX','gridZ','kiloLine','alphaLine','alphaWall','charlieSpan','wallLines','deltaWidth','deltaSpan','deltaLine','deltaBeamSpan'];
const clone=s=>JSON.parse(JSON.stringify(s));
function update(s,patch){
 patch={...patch};for(const [key,total]of [['gridX',60],['gridZ',120]])if(patch[key]!==undefined&&patch[key]!==null){const parsed=M.parseBays(patch[key],total);if(!parsed.ok)return {ok:false,message:parsed.message};patch[key]=parsed.bays;}
 const axis=M.prototypes[s.prototype].axis,proposed=patch[axis==='x'?'gridX':'gridZ'];if(proposed&&proposed.length<2&&s.prototype!=='ALPHA')return {ok:false,message:'This support system needs an interior support line. Subdivide the deck direction into at least two bays.'};
 if(patch.charlieSpan!==undefined||patch.deltaSpan!==undefined)patch.gridZ=null;if(patch.deltaBeamSpan!==undefined)patch.gridX=null;
 const before=M.calc(s),oldRoles=M.beamRoles(s),oldPanels=before.layout.panels,next=M.normalize({...s,...patch});
 if(patch.deltaSpan!==undefined&&patch.deltaLine===undefined&&next.deltaSpan!==s.deltaSpan)next.deltaLine=M.deltaLines(next).reduce((a,b)=>Math.abs(b-60)<Math.abs(a-60)?b:a);
 const newRoles=M.beamRoles(next),panels=M.layout(next).panels,changedGrid=JSON.stringify(before.layout.grid)!==JSON.stringify(M.layout(next).grid)||before.layout.width!==M.layout(next).width;
 // Preserve selected sections by physical support location, or by the sole frame role.
 next.selections={};next.pairedL={};for(const level of ['roof','floor']){if(s.selections[level])next.selections[level]=s.selections[level];const olds=oldRoles.filter(r=>r.level===level),news=newRoles.filter(r=>r.level===level);for(const r of news){const old=olds.find(a=>a.line.coord===r.line.coord&&a.line.kind===r.line.kind)||(olds.length===1&&news.length===1?olds[0]:null);if(old&&s.selections[old.key])next.selections[r.key]=s.selections[old.key];if(old&&s.pairedL[old.key])next.pairedL[r.key]=true;}}
 if(changedGrid){for(const key of ['voids','roofVoids']){next[key]=[...new Set((s[key]||[]).map(id=>oldPanels.find(p=>p.id===id)).filter(Boolean).map(p=>{const x=p.x+p.dx/2,z=p.z+p.dz/2;return panels.find(q=>x>=q.x&&x<q.x+q.dx&&z>=q.z&&z<q.z+q.dz)?.id;}).filter(Boolean))];}next.openingsInitialized=true;next.typicalSupport=null;}
 if(Object.keys(patch).some(k=>gridKeys.includes(k)))next.gridConfirmed=true;
 if(Object.keys(patch).some(k=>['columnSize','wallThickness'].includes(k)))next.verticalConfirmed=false;
 if(patch.stairThickness!==undefined&&next.stairThickness!==s.stairThickness)next.stairSelection=null;
 M.initialize(next);const after=M.calc(next),messages=[];
 if(changedGrid)messages.push(`Footprint unchanged: 60 × 120 ft. X spans ${after.layout.grid.x.join(' + ')} ft; Z spans ${after.layout.grid.z.join(' + ')} ft. ${after.layout.panels.length} deck locations. Openings follow their previous positions; check core/support clashes.`);
 for(const key of ['roof','floor',...newRoles.map(r=>r.key)]){const a=after.checks[key],b=before.checks[key];if(a.cell&&(!a.within||!b||b.demand!==a.demand))messages.push(`${key}: ${a.demand===null?'pending load':Number(a.demand.toFixed(1))+' '+a.unit} — ${a.status}. Existing source retained for review.`);}
 if(!messages.length)messages.push('Inputs updated; geometry, selfweights, reactions and source comparisons recalculated.');
 next.lastChange=messages;Object.assign(s,next);return {ok:true,messages};
}
function pick(s,key,id,adoptLayout=false){
 const cell=P.cells.find(c=>c.id===id),next=clone(s);
 if(adoptLayout&&['roof','floor'].includes(key)&&cell){
  const p=M.prototypes[s.prototype],axis=p.axis,total=axis==='x'?60:120,count=total/cell.span;
  if(cell.family!==p.family||(s.prototype==='DELTA'?![8,10].includes(cell.width):cell.width!==p.width)||cell.topping!==(key==='floor'?2:s.roofTopping))return {ok:false,message:'Family, unit width or topping does not match this prototype. Nothing changed.'};
  if(!Number.isInteger(count)||count<2||count>24)return {ok:false,message:`The clicked ${cell.span} ft span cannot divide ${total} ft into equal bays for this system. Set custom X/Z subdivisions in the grid chapter. Nothing changed.`};
  const patch={[axis==='x'?'gridX':'gridZ']:Array(count).fill(cell.span)};if(s.prototype==='DELTA'){patch.deltaWidth=cell.width;patch.deltaLine=M.coordinates(patch.gridZ).slice(1,-1).reduce((a,b)=>Math.abs(b-60)<Math.abs(a-60)?b:a);}
  const r=update(next,patch);if(!r.ok)return r;
  // Retain legacy span metadata for previously saved studies; the explicit grid is authoritative.
  if(s.prototype==='CHARLIE')next.charlieSpan=cell.span;if(s.prototype==='DELTA')next.deltaSpan=cell.span;
 }
 const result=M.applyCell(next,key,id);if(!result.ok)return result;
 const after=M.calc(next);next.lastChange=[result.message||'Original stair row applied.',...['roof','floor'].includes(key)?[`${key}: source depth ${cell.depth} in, selfweight ${cell.selfWeight} psf; total area load ${after[key].load.q?.toFixed(1)} psf.`,...M.beamRoles(next).filter(r=>r.level===key).map(r=>`${r.label}: updated demand ${after.checks[r.key].demand?.toFixed(1)} plf; ${after.checks[r.key].status}.`)]:[]];
 Object.assign(s,next);return result;
}
function progress(s,c=M.calc(s)){const stairs=P.stairs.find(r=>r.id===s.stairSelection),steps=[{key:'grid',label:'Set the grid',chapter:'concrete-layout',done:s.gridConfirmed&&c.layout.uncovered<1e-6},...['roof','floor'].map(k=>({key:k,label:(k==='roof'?'Roof':'Floor')+' · original table',chapter:'concrete-'+k,done:c.checks[k].within})),...M.beamRoles(s).map(r=>({key:r.key,label:r.label,chapter:'concrete-beams',done:c.checks[r.key].within})),{key:'vertical',label:'Set support dimensions',chapter:'concrete-vertical',done:s.verticalConfirmed},{key:'stairs',label:'Stairs · original table',chapter:'concrete-vertical',done:!!stairs&&stairs.thickness===s.stairThickness&&c.stairSpan<=stairs.spanLimit},{key:'openings',label:'Place openings & check layout',chapter:'concrete-floor',done:c.geometryOK}];return {steps,done:steps.filter(x=>x.done).length,total:steps.length,complete:steps.every(x=>x.done),next:steps.find(x=>!x.done)||null};}
function memberReady(s,key){if(key==='raft'||key==='grade'||key==='scale')return true;if(['roof','floor'].includes(key)||key.includes('Beam'))return !!M.validChoice(s,key);if(key==='stairs'||key==='landings')return !!s.stairSelection;if(key==='walls'||key==='columns')return !!s.verticalConfirmed&&!!M.validChoice(s,'roof')&&!!M.validChoice(s,'floor')&&M.beamRoles(s).every(r=>!!M.validChoice(s,r.key));return true;}
function parameterRecord(s){const c=M.calc(s),lines=M.supportLines(s);return [`Assigned: ${s.prototype}, ${c.use.name}; 60 × 120 ft footprint.`,`Student subdivision: X ${c.layout.grid.x.join(' + ')} = 60 ft; Z ${c.layout.grid.z.join(' + ')} = 120 ft. Unit width ${c.layout.width} ft; deck axis ${c.layout.axis.toUpperCase()}; support lines ${lines.map(x=>x.coord+' ft '+x.kind).join(', ')}.`,`Student roof: low elevation ${s.roofBase} ft, slope ${s.slope} degrees, topping ${s.roofTopping} in.`,`Student supports: column ${s.columnSize} in; wall ${s.wallThickness} in; dimensions ${s.verticalConfirmed?'applied':'not yet applied'}.`,...M.cores(s).map(a=>`${a.id}: (${a.x}, ${a.z}) ft, ${a.dx} × ${Number(a.dz.toFixed(2))} ft.`),...Object.values(c.checks).map(a=>`${a.key}: ${a.cell?a.cell.section+' / '+a.cell.pattern+', '+a.cell.depth+' in depth; '+a.cell.selfWeight+' '+a.cell.unit+' selfweight; '+P.sourceFor(a.cell.page).label:'no source selected'}. Demand ${a.demand??'pending'} ${a.unit}; ${a.status}.`)];}
W.ConcreteParametric={update,pick,progress,memberReady,parameterRecord};
})(typeof window!=='undefined'?window:globalThis);
