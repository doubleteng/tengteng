import {nonSwingDoor,doorAssemblyLabel} from './door-assembly.mjs?v=door-detection-1';
import {FT,IN,SF,edges,segDist,roomPoint} from './geometry.mjs?v=auto-enclosure-1';
import {roomLoad,capacityDimension} from './capacity.mjs?v=auto-enclosure-1';

export const planSources={ibc:'https://www.iccsafe.org/wp-content/uploads/Session-62-and-63-2021-IBC-Means-of-Egress.pdf',ada:'https://www.access-board.gov/ada/chapter/ch04/'};
export const planCategories=[
 {id:'inputs',name:'Scale, use + occupants',scope:'indoor'},
 {id:'doors',name:'Doors + clear widths',scope:'indoor'},
 {id:'corridors',name:'Corridors + bottlenecks',scope:'indoor'},
 {id:'exits',name:'Exit number + arrangement',scope:'indoor'},
 {id:'travel',name:'Travel, common paths + dead ends',scope:'indoor'},
 {id:'stairs',name:'Stairs + multi-level continuity',scope:'indoor'},
 {id:'discharge',name:'Building exits → public way',scope:'site'},
 {id:'sitewidth',name:'Outdoor paths + egress courts',scope:'site'},
 {id:'accessible',name:'Accessible walking routes',scope:'site'},
 {id:'crossings',name:'Pedestrian / vehicle crossings',scope:'site'}
];
export const codeStatus={fail:'Revise',input:'Add information',review:'Review',pass:'Check met'};
const isGround=f=>Math.abs(f.elevation)<.001;
const source=ref=>ref.startsWith('ADA')?planSources.ada:ref.startsWith('IBC')?planSources.ibc:null;
function category(c){
 const t=c.title.toLowerCase();
 if(t.includes('crossing'))return 'crossings';
 if(c.ref?.startsWith('ADA'))return 'accessible';
 if(t.startsWith('site:')||c.category==='site'||/public-way|discharge route|site route/.test(t))return 'discharge';
 if(/vertical opening|stair|multi-floor|convergence/.test(t))return 'stairs';
 if(/corridor.*width|circulation corridors/.test(t))return 'corridors';
 if(/width|door is not/.test(t))return 'doors';
 if(/doorway|floor exit|exit separation|exit capacity|no exit has/.test(t))return 'exits';
 if(/travel|common path|dead.end|disconnected|walkable|outside floor|allocated.*route/.test(t))return 'travel';
 return 'inputs';
}
// Match the host wall and a room edge, not just a symbol near any room.
export function doorRooms(f,door){
 const host=f.walls.find(w=>w.id===door.wallId);if(!host||segDist(door,host.a,host.b)>.02)return[];
 const tolerance=Math.max(.06,(host.thickness||.15)/2+.12);
 return f.rooms.filter(r=>r.role!=='corridor'&&edges(r.points).some(([a,b])=>segDist(door,a,b)<=tolerance));
}
export function doorSwingCheck(p,fi,d,analysis){
 if(d.openingType==='passage')return {id:'swing:'+d.id,category:'doors',scope:'indoor',floor:fi,objectId:d.id,point:d,status:'review',title:(d.name||'Opening')+': open passage',ref:'Model input',detail:'No door leaf is modeled. Confirm this is an open passage; door swing is not evaluated. Identify the applicable circulation component and its minimum clear width separately.'};
 if(nonSwingDoor(d))return {id:'swing:'+d.id,category:'doors',scope:'indoor',floor:fi,objectId:d.id,point:d,status:'input',title:(d.name||'Door')+': confirm egress operation',ref:'IBC 1010.1.2',measured:doorAssemblyLabel(d)+' · 1 doorway',required:'Identify the applicable door-type provision and operating conditions',detail:'This assembly is counted once. A hinged-door swing-direction check does not establish whether this door type is permitted. Confirm manual/powered operation, release hardware and the applicable egress-door provision; changing the type alone cannot establish a pass.'};
 const f=p.floors[fi],rooms=doorRooms(f,d),loads=rooms.map(r=>roomLoad(p,fi,r));
 const row=analysis?.floors[fi]?.capacity?.rows.find(r=>r.id===d.id);
 // A room's total triggers the swing rule even when its flow splits among doors.
 const served=Math.max(0,...loads.map(r=>r.occupants),row?.load||0);
 const required=served>=50||rooms.some(r=>r.group==='H');
 const known=d.swing==='with'||d.swing==='against';
 const status=required?(known?(d.swing==='with'?'pass':'fail'):'input'):'review';
 return {id:'swing:'+d.id,category:'doors',scope:'indoor',floor:fi,objectId:d.id,point:d,
  status,title:(d.name||'Door')+': swing direction',ref:'IBC 1010.1.2.1',
  measured:known?(d.swing==='with'?'With egress travel':'Against egress travel'):'Swing not identified',
  required:required?'Swing with egress travel':'Confirm the complete room / area served',
  detail:required?`${served} occupants in the served room / area or modeled flow. The 50-person trigger uses the whole room load, not a divided share at each door. ${d.swing==='against'?'Reverse the swing direction.':!known?'Identify the swing direction in Door Properties.':'Direction is user-confirmed; check its orientation on the drawing.'}`:'Below 50 in the modeled rooms / flow. Confirm other spaces served and any special door condition before concluding the swing is unrestricted.'};
}
export function siteWidthChecks(p,analysis){
 const routes=p.site.routes.filter(r=>r.kind!=='vehicle'),out=[];
 for(const r of routes){
  if(!['discharge','court'].includes(r.egressRole))continue;
  const ids=[...new Set(r.servedExitIds||[])],upstream=[];
  for(let fi=0;fi<p.floors.length;fi++){const f=p.floors[fi];if(!isGround(f))continue;
   for(const d of f.doors.filter(d=>d.exit&&d.discharge==='site'&&ids.includes(d.id))){const row=analysis?.floors[fi]?.capacity?.rows.find(o=>o.id===d.id);upstream.push({d,row});}
  }
  const missing=ids.length!==upstream.length||!ids.length,unknown=upstream.some(o=>!o.row?.allocationKnown);
  const load=upstream.reduce((n,o)=>n+(o.row?.load||0),0),factor=(p.settings.sprinkler&&p.settings.voice) ? .15 : .2;
  // A lower bound: do not sum physical leaf widths or certify merge allocation.
  const courtMin=r.egressRole==='court'?44*IN:0;
  const required=Math.max(courtMin,load*factor*IN,...upstream.map(o=>o.row?.required||0));
  const width=Number(r.width),short=width>0&&width+1e-6<required;
  const status=short?'fail':missing||unknown||!(width>0)?'input':'review';
  const multi=p.floors.some(f=>f.elevation>0),measure=capacityDimension(width,p.units),need=capacityDimension(required,p.units,true);
  out.push({id:'sitewidth:'+r.id,category:'sitewidth',scope:'site',objectId:r.id,point:r.points[0],status,
   title:(r.name||'Outdoor path')+': '+(r.egressRole==='court'?'egress court':'exit discharge')+' width',
   ref:r.egressRole==='court'?'IBC 1029.2 / 1005.3.2':'IBC 1028.3 / 1005.3.2',
   measured:width>0?measure+' entered clear width':'Width not entered',required:required>0?'At least '+need:'Assign the exits served',load,width,minimum:courtMin,widthLowerBound:required,
   detail:`${load} modeled ground-floor occupants from ${upstream.map(o=>o.d.name||'Exit').join(', ')||'unassigned exits'}. ${r.egressRole==='court'?'The A/B/E/M egress-court minimum is 44 in. ':''}${short?'Widen the narrowest clear segment or revise the served route. ':''}${missing?'Select the actual building exits served in Route Properties. ':''}${unknown?'Resolve exit-load allocation. ':''}${multi?'Upper-story discharge loads remain unresolved here. ':''}Check gates, obstacles and upstream required widths along the complete path. Merging flows and clear-width continuity remain review items; this is a lower-bound check.`});
 }
 return out;
}
export function analyzePlanCode(p,analysis){
 const checks=[],add=c=>checks.push({...c,source:source(c.ref||'IBC')});
 if(!analysis)return{pending:true,checks:[],counts:{fail:0,input:0,review:0,pass:0},categories:planCategories};
 const siteSeen=new Set();
 for(let fi=0;fi<p.floors.length;fi++){
  const f=p.floors[fi],a=analysis.floors[fi];if(!a)continue;
  for(const [i,c] of a.checks.entries()){
   if(['Unmodeled life-safety conditions','Plan conditions to review'].includes(c.title)||c.ref==='Design brief'||/: confirm (net|gross) area$/.test(c.title))continue;
   const cat=category(c),scope=planCategories.find(o=>o.id===cat).scope;
   // Project/site checks are emitted by each floor; show each once in this schedule.
   const key=JSON.stringify([c.title,c.detail,c.point]);if(scope==='site'){if(siteSeen.has(key))continue;siteSeen.add(key);}
   const missing=/not calibrated|await confirmation|no walkable samples|Define the floor|Define the exit discharge|Identify circulation|No exit has|not connected to a wall/.test(c.title);
   const room=f.rooms.find(r=>c.title.startsWith(r.name+':'));
   const siteObject=scope==='site'?[...p.site.routes,...p.site.targets].find(o=>o.name&&c.title.startsWith(o.name+':')):null;
   const object=siteObject||[...f.doors,...(f.stairs||[]),...f.rooms].find(o=>o.name&&c.title.startsWith(o.name+':'));
   add({...c,id:`existing:${fi}:${i}`,category:cat,scope,floor:fi,objectScope:siteObject?'site':object?'building':scope==='site'?'site':'building',objectId:object?.id,status:missing&&c.status!=='fail'?'input':c.status,point:c.point||room&&roomPoint(room)});
  }
  for(const r of f.rooms.filter(r=>r.role!=='corridor')){
   const load=roomLoad(p,fi,r);
   add({id:'load:'+r.id,category:'inputs',scope:'indoor',floor:fi,objectId:r.id,point:roomPoint(r),status:r.areaConfirmed?'pass':'input',
    title:r.name+': area → design occupants',measured:`${(load.area/SF).toFixed(0)} sf / ${load.area.toFixed(1)} m²`,required:`${load.factor} sf/person · ${load.basis}`,ref:'IBC Table 1004.5',
    detail:`${load.functionLabel}: ${load.occupants} design occupants. ${r.areaConfirmed?'Use and area basis confirmed.':'Confirm the room use, scale and net/gross area basis in Properties.'}`});
  }
  for(const d of f.doors){add(doorSwingCheck(p,fi,d,analysis));if(d.exit&&d.exitConfirmed===false)add({id:'exit-role:'+d.id,category:'exits',scope:'indoor',floor:fi,objectId:d.id,point:d,status:'input',title:(d.name||'Exit')+': confirm exterior discharge',ref:'Model input',measured:'Outward swing + indoor/outdoor connection detected',required:'Confirm this doorway serves the exit route',detail:'The drawing supplies a ground-floor exterior door opening outward. It is used as a proposed exit in this design model. Check its destination and operating conditions, then select Confirm detected exit. A door symbol alone does not establish code compliance.'});}
  for(const r of f.rooms.filter(r=>r.role!=='corridor'))if(!f.traces.some(t=>t.kind==='common'&&t.roomId===r.id))add({id:'common:'+r.id,category:'travel',scope:'indoor',floor:fi,roomId:r.id,point:roomPoint(r),status:'input',title:r.name+': common path not assessed',ref:'IBC 1006.2.1',action:'common',detail:'Trace from the remote point to the first genuine choice of separate exit routes. This trace will be linked to the room; its occupant load and occupancy set the limit.'});
  for(const [kind,label,ref] of [['dead','Dead-end corridor','IBC 1020.5']]){
   if(f.rooms.length&&!f.traces.some(t=>t.kind===kind))add({id:kind+':'+f.id,category:'travel',scope:'indoor',floor:fi,status:'input',title:f.name+': '+label+' not assessed',ref,action:kind,detail:kind==='common'?'Trace from the remote point to the first genuine choice of separate exit routes. A shortest path to one exit does not establish the common path.':'Identify dead-end branches in the corridor layout. Trace any that exist; the absence of a trace does not mean no dead ends exist.'});
  }
 }
 for(const c of siteWidthChecks(p,analysis))add(c);
 if(!p.site.routes.some(r=>['discharge','court'].includes(r.egressRole)))add({id:'sitewidth:missing',category:'sitewidth',scope:'site',status:'input',title:'Assign outdoor discharge paths',ref:'IBC 1028.3 / 1029.2',action:'pedestrian',detail:'Draw or select a pedestrian path. In Properties, identify it as Exit discharge or Egress court, enter its narrowest clear width and select the building exits it serves. A connected route does not establish adequate width.'});
 if(!p.site.routes.some(r=>r.kind==='accessible'))add({id:'accessible:missing',category:'accessible',scope:'site',status:'input',title:'Identify an accessible site route',ref:'ADA 403',action:'accessible',detail:'Draw the walking route between the site arrival point and building entrance. Enter clear width, running slope and cross slope. Ramp segments need their own geometry review.'});
 add({id:'accessible:continuity',category:'accessible',scope:'site',status:'review',title:'Accessible route continuity',ref:'IBC 1009 / ADA 402–405',detail:'Check doors, level changes, stairs, ramps and landings along the selected journey. Walking-surface width and slope alone do not establish accessible means of egress.'});
 if(p.site.routes.some(r=>r.kind==='vehicle')&&!checks.some(c=>c.category==='crossings'))add({id:'crossings:none',category:'crossings',scope:'site',status:'review',title:'No drawn centerline crossing found',ref:'Design review',detail:'Check curb cuts, loading areas, turning vehicles and sight lines. This comparison only covers drawn route centerlines.'});
 const counts={fail:0,input:0,review:0,pass:0};for(const c of checks)counts[c.status]++;
 return{pending:false,checks,counts,categories:planCategories};
}
