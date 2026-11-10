/* ARC 2713 Concrete Building. Original course values; feet, inches, pounds.
 * Service-load comparisons are separate from connection / stability design.
 */
(function(W){'use strict';
const uses={office:{name:'Office · Ypsilanti',snow:20,roofDL:15,live:50,floorDL:15,raft:50},grocery:{name:'Grocery · Pinconning',snow:40,roofDL:15,live:75,floorDL:20,raft:50},library:{name:'Library · Houghton',snow:100,roofDL:15,live:150,floorDL:15,raft:68}};
const prototypes={
 ALPHA:{family:'DT',width:8,span:30,beamSpan:24,axis:'x',description:'8 ft double tees span 30 ft. One longitudinal column line carries 24 ft L / inverted T / rectangular beams; perimeter panels carry the outer deck reactions. Parameters p.14.'},
 CHARLIE:{family:'HC',width:4,span:30,beamSpan:20,axis:'z',description:'4 ft hollow-core planks span 20, 24 or 30 ft. 20 ft L / inverted T / rectangular beams on columns; replace 1–3 internal support lines with litewalls. Parameters p.15.'},
 DELTA:{family:'DT',width:10,span:40,beamSpan:20,axis:'z',description:'8 or 10 ft double tees span 40 ft. One transverse column / beam line; other support lines are bearing walls. Beam subdivision is a student design choice. Parameters p.16.'},
 KILO:{family:'HC',width:4,span:30,beamSpan:24,axis:'x',description:'4 ft hollow-core planks span 30 ft to a continuous central litewall. Perimeter litewalls support 24 ft L / inverted T / rectangular beams. Parameters p.17 and Lecture 12 p.152.'}
};
const groups=[['Concrete Building · Read',[['concrete-brief','1 · Brief & prototypes'],['concrete-concepts','1.0 · Members & load path']]],['Concrete Building · Model + tables',[['concrete-roof','1.1 · Roof deck'],['concrete-floor','2.1 · Floor & double height'],['concrete-beams','2.2 · Beams & reactions'],['concrete-vertical','3.1 · Columns, walls & raft'],['concrete-assembly','3.2 · Assembly & submission']]]];
const ids=groups.flatMap(g=>g[1].map(x=>x[0]));
const posterSystems={
 ALPHA:{variant:'A.3',path:'Double tees → wall-panel haunches → structural wall panels → raft. No separate columns or beams.',members:'Structural wall panels; wall haunches; double tees; horizontal spandrels; vertical fins; guardrail panels; stairs.',difference:'Course p.14 / Lecture 12 pp.156–159 adds one longitudinal column-and-beam line. The A.3 poster has none.'},
 CHARLIE:{variant:'C.2',path:'Hollow-core planks → beams → column haunches → columns → raft.',members:'Columns; haunches; beams; hollow-core planks; two insulated-panel forms with fins / hoods; stairs.',difference:'Course p.15 adds 1–3 lite-wall lines. Lecture 12 p.151 specifies three. The poster beam drawing shows a single-sided ledge; interior bearing arrangement must be selected and verified.'},
 DELTA:{variant:'D.3',path:'Double tees → opening-bearing lite-wall panels → raft. No separate columns or beams.',members:'Lite walls; double tees; stairs; segmented panels; two shadow-hood forms; door hoods; structural end panels.',difference:'Course p.16 adds one transverse column-and-beam line; Lecture 12 p.152 does not. Beam span and section are not specified on p.16.'},
 KILO:{variant:'K.3',path:'Hollow-core planks → perimeter cyclopean bearing walls + interior beams → portal lite walls → raft.',members:'Cyclopean blocks; portal lite walls; interior beams (explicit in poster text); hollow-core planks; screen hoods; stairs.',difference:'Course p.17 substitutes a continuous longitudinal lite-wall line supporting hollow core. The poster has perimeter block bearing walls and interior beams.'}
};
const isPoster=s=>s.basis!=='course';
function description(s){return isPoster(s)?posterSystems[s.prototype].path+' Structural-system study adapted to the 60 × 120 ft course footprint and permitted deck modules; not a dimension-for-dimension copy of the poster.':prototypes[s.prototype].description;}
function assemblyStages(s){return ['Raft','Bearing walls / columns',beamRoles(s).length?'Floor beams + bearing seats':'Floor wall haunches / bearing seats','Precast stairs','Floor deck',beamRoles(s).length?'Roof beams + bearing seats':'Roof wall haunches / bearing seats','Roof deck + enclosure'];}
const defaults=()=>({version:3,basis:'poster',enclosure:true,stairSelection:null,lesson:'concrete-brief',prototype:'ALPHA',use:'office',deckSpan:30,deltaWidth:10,deltaBeamSpan:20,wallLines:1,kiloSupport:'wall',slope:3,roofTopping:2,stage:7,layer:'all',mode:'3d',voids:[],roofVoids:['p-30-24','p-30-56','p-30-88'],selections:{},beamFamilies:{},notes:{},tablePages:{},showRoof:true,planLevel:'floor',columnSize:24,wallThickness:8,cores:true,stairThickness:8,showGrid:true,loadPath:false});
function normalize(raw){
 const d=defaults(),r=raw&&typeof raw==='object'?raw:{};
 for(const k of ['prototype','use'])if((k==='prototype'?prototypes:uses)[r[k]])d[k]=r[k];
 if(ids.includes(r.lesson))d.lesson=r.lesson;
 if(['poster','course'].includes(r.basis))d.basis=r.basis;
 if(typeof r.enclosure==='boolean')d.enclosure=r.enclosure;
 if(W.ConcretePDFData.stairs.some(x=>x.id===r.stairSelection))d.stairSelection=r.stairSelection;
 for(const [k,values]of Object.entries({deckSpan:[20,24,30],deltaWidth:[8,10],deltaBeamSpan:[20,30],wallLines:[1,2,3],roofTopping:[0,2],stage:[1,2,3,4,5,6,7],mode:['2d','3d','section'],planLevel:['roof','floor'],columnSize:[16,18,20,24,28,32],wallThickness:[6,8,10,12],stairThickness:[6,8,10,12],layer:['all','deck','beams','vertical','stairs']}))if(values.includes(r[k]))d[k]=r[k];
 if(Number.isFinite(r.slope))d.slope=Math.min(10,Math.max(3,r.slope));
 for(const k of ['showRoof','cores','showGrid','loadPath'])if(typeof r[k]==='boolean')d[k]=r[k];
 for(const k of ['voids','roofVoids'])if(Array.isArray(r[k]))d[k]=[...new Set(r[k].filter(x=>typeof x==='string'&&/^p-\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(x)))].slice(0,100);
 for(const k of ['roof','floor','roofBeam','floorBeam','roofEdgeBeam','floorEdgeBeam'])if(typeof r.selections?.[k]==='string'&&W.ConcretePDFData.cells.some(c=>c.id===r.selections[k]))d.selections[k]=r.selections[k];
 for(const k of ['roofBeam','floorBeam','roofEdgeBeam','floorEdgeBeam'])if(['L','T','R'].includes(r.beamFamilies?.[k]))d.beamFamilies[k]=r.beamFamilies[k];
 for(const k of ids){if(typeof r.notes?.[k]==='string')d.notes[k]=r.notes[k].slice(0,12000);if(Number.isInteger(r.tablePages?.[k])&&r.tablePages[k]>=1&&r.tablePages[k]<=18)d.tablePages[k]=r.tablePages[k];}
 if(!r.beamFamilies&&supportLines(d).some(x=>!x.wall&&!x.edge)&&supportLines(d).some(x=>!x.wall&&x.edge))for(const level of ['roof','floor'])if(!d.selections[level+'EdgeBeam']&&d.selections[level+'Beam'])d.selections[level+'EdgeBeam']=d.selections[level+'Beam'];
 if(r.layer==='enclosure')d.layer='enclosure';
 return d;
}
const cellsByID=new Map(W.ConcretePDFData.cells.map(c=>[c.id,c]));
const choice=(s,key)=>cellsByID.get(s.selections[key])||null;
const roofY=(s,x)=>28+x*Math.tan(s.slope*Math.PI/180);
const overlap=(a,b)=>a.x<b.x+b.dx-1e-7&&a.x+a.dx>b.x+1e-7&&a.z<b.z+b.dz-1e-7&&a.z+a.dz>b.z+1e-7;
function coreLayout(s){
 if(!s.cores)return [];
 // Whole factory panels are omitted: no field cutting of strands or tee stems.
 // The 10 x 10 shaft is inside the reserved panel opening; surplus space is open to below.
 const well=8+0.5,run=11*11/12,depth=run+8;
 return [{id:'stair-1',type:'stair',x:.75,z:.75,dx:well,dz:depth},{id:'stair-2',type:'stair',x:60-.75-well,z:120-.75-depth,dx:well,dz:depth},{id:'elevator',type:'elevator',x:20,z:8,dx:10,dz:10}];
}
function layout(s){
 const p=prototypes[s.prototype],span=s.prototype==='CHARLIE'?s.deckSpan:p.span,width=s.prototype==='DELTA'?s.deltaWidth:p.width,panels=[];
 if(p.axis==='x')for(let x=0;x<60;x+=span)for(let z=0;z+width<=120+.001;z+=width)panels.push({id:`p-${x}-${z}`,x,z,dx:span,dz:width,span,width});
 else for(let z=0;z<120;z+=span)for(let x=0;x+width<=60+.001;x+=width)panels.push({id:`p-${x}-${z}`,x,z,dx:width,dz:span,span,width});
 const cores=coreLayout(s),coreVoids=panels.filter(p=>cores.some(c=>overlap(p,c))).map(p=>p.id);
 const beamSpan=s.prototype==='DELTA'?s.deltaBeamSpan:p.beamSpan;
 const beamTributary=isPoster(s)?(['ALPHA','DELTA'].includes(s.prototype)?0:span):(s.prototype==='KILO'||(s.prototype==='CHARLIE'&&s.wallLines>=120/span-1)?span/2:span);
 return {p,span,width,panels,cores,coreVoids,beamSpan,beamTributary,uncovered:7200-panels.reduce((a,b)=>a+b.dx*b.dz,0)};
}
function supportLines(s){
 const l=layout(s),lines=[],limit=l.p.axis==='x'?60:120;
 for(let c=0;c<=limit+.001;c+=l.span){
  const edge=c===0||c===limit;
  let wall=s.prototype==='ALPHA'?edge:s.prototype==='KILO'?!edge:s.prototype==='DELTA'?c!==40:!edge&&c/l.span<=s.wallLines;
  if(isPoster(s))wall=s.prototype==='CHARLIE'?false:s.prototype==='KILO'?edge:true;
  lines.push({id:'support-'+c,coord:c,axis:l.p.axis==='x'?'z':'x',length:l.p.axis==='x'?120:60,step:l.beamSpan,wall,edge,tributary:edge?l.span/2:l.span});
 }
 return lines;
}

// Separate one-sided perimeter supports from two-sided internal supports.
function beamRoles(s){
 const lines=supportLines(s).filter(x=>!x.wall),inside=lines.filter(x=>!x.edge),edge=lines.filter(x=>x.edge),roles=[];
 if(!lines.length)return roles;
 for(const level of ['roof','floor']){
  roles.push({key:level+'Beam',level,edge:!inside.length,lines:inside.length?inside:edge,label:(level==='roof'?'Roof':'Floor')+(inside.length?' interior beams':' edge beams')});
  if(inside.length&&edge.length)roles.push({key:level+'EdgeBeam',level,edge:true,lines:edge,label:(level==='roof'?'Roof':'Floor')+' edge beams'});
 }
 return roles;
}
const beamRole=(s,key)=>beamRoles(s).find(r=>r.key===key);
const beamKey=(s,level,line)=>beamRoles(s).find(r=>r.level===level&&r.lines.some(x=>x.id===line.id))?.key||level+'Beam';
const beamFamily=(s,key)=>s.beamFamilies?.[key]||(['L','T','R'].includes(choice(s,key)?.family)?choice(s,key).family:beamRole(s,key)?.edge?'L':'T');
const beamPage=(s,key)=>({L:13,T:14,R:12})[beamFamily(s,key)];
function beamProfile(s,key,edge=beamRole(s,key)?.edge){
 const selected=validChoice(s,key),family=beamFamily(s,key);
 // Preliminary geometry has no assigned load capacity or self-weight.
 const h=(selected?.depth||24)/12,w=selected?.width||(family==='L'?18:family==='T'?28:12)/12;
 const flangeH=(selected?.h2In||12)/12,webW=(selected?.webWidthIn||12)/12;
 return {family,h,w,flangeH,webW,webH:h-flangeH,count:family==='L'&&!edge?2:1,selected,schematic:!selected};
}
function beamParts(profile,sign=1){
 const {family,h,w,flangeH,webW,webH,count}=profile;
 if(family==='R')return [{part:'rectangle',offset:0,y:-h/2,w,h}];
 const parts=[];
 for(let n=0;n<count;n++){
  const direction=count===2?(n===0?-1:1):sign,webCenter=family==='L'&&count===2?direction*webW/2:0;
  parts.push({part:'ledge',offset:webCenter+(family==='L'?direction*(w-webW)/2:0),y:-flangeH/2,w,h:flangeH});
  parts.push({part:'web',offset:webCenter,y:webH/2,w:webW,h:webH});
 }
 return parts;
}
// Display cutback clears the beam upstand; structural spans remain nominal grid spans.
function deckCutback(s,level,line){
 if(!line)return 0;
 if(line.wall)return ['ALPHA','DELTA'].includes(s.prototype)?s.wallThickness/24+.025:0;
 const p=beamProfile(s,beamKey(s,level,line),line.edge);
 return p.family==='R'?0:p.webW*(p.count===2?1:.5)+.5/12;
}

function check(s,key){
 const l=layout(s),c=choice(s,key),u=uses[s.use],beam=key.endsWith('Beam'),roof=key.startsWith('roof'),topping=roof?s.roofTopping:2;
 const nominalSpan=beam?l.beamSpan:l.span,slopeFactor=roof?1/Math.cos(s.slope*Math.PI/180):1;
 const alongSlope=beam?l.p.axis==='z':l.p.axis==='x',span=nominalSpan*(alongSlope?slopeFactor:1);
 const deck=beam?check(s,roof?'roof':'floor'):null;
 const added=roof?u.snow+u.roofDL:u.live+u.floorDL;
 const family=beam?beamFamily(s,key):null,role=beam?beamRole(s,key):null,fullTributary=role?.edge?l.span/2:l.span;
 const tributary=beam?(family==='L'?Math.min(fullTributary,l.span/2):fullTributary):null;
 const required=beam?(deck.compatible?(deck.c.selfWeight*slopeFactor+added)*tributary:null):added;
 const compatible=!!c&&(!beam||!!role)&&(beam?c.family===family:c.family===l.p.family&&c.width===l.width&&c.topping===topping)&&c.span+1e-7>=span;
 const anomaly=!!c?.sourceAnomaly;
 const status=!c?'Choose a printed capacity cell':!compatible?'Section, topping or table span does not match':required===null?'Choose a compatible deck first':anomaly?'Source anomaly — verify printed row':required>c.capacity?'Demand exceeds table capacity':'Within selected service-load table';
 const candidates=W.ConcretePDFData.cells.filter(v=>(beam?v.family===family:v.family===l.p.family&&v.width===l.width&&v.topping===topping)&&v.span+1e-7>=span&&!v.sourceAnomaly),maxCapacity=candidates.length?Math.max(...candidates.map(v=>v.capacity)):null;
 return {key,c,required,span,nominalSpan,maxCapacity,tributary,multiplicity:beam&&family==='L'&&!role?.edge?2:1,compatible,passes:compatible&&required!==null&&required<=c.capacity&&!anomaly,anomaly,status,unit:beam?'plf':'psf',scope:beam?'Source assumes 50% superimposed dead / 50% live; verify actual load mix, camber and release strength.':'Use the printed topping, superimposed dead load, release strength and camber conditions.',utilization:compatible&&required!==null?required/c.capacity:null};
}
const validChoice=(s,key)=>check(s,key).compatible?choice(s,key):null;
function tablePages(s,key){
 if(key==='stairs')return [10,11];
 if(key==='columns')return [15,16];
 if(key==='walls')return [17,18];
 if(key==='landings')return [11];
 if(key.endsWith('Beam'))return beamRole(s,key)?[beamPage(s,key)]:[];
 const l=layout(s);return l.p.family==='HC'?[2,3]:l.width===10?[9]:[4,5,6,7,8];
}
function applyCell(s,key,id){
 if(key==='stairs'){const row=W.ConcretePDFData.stairs.find(x=>x.id===id);if(!row)return {ok:false,message:'Choose an original stair row.'};s.stairThickness=row.thickness;s.stairSelection=row.id;return {ok:true};}
 const cell=cellsByID.get(id),l=layout(s),beam=key.endsWith('Beam');
 if(!cell||!['roof','floor',...beamRoles(s).map(r=>r.key)].includes(key))return {ok:false,message:'This prototype has no member group for that table selection.'};
 if(beam?!['L','T','R'].includes(cell.family):(cell.family!==l.p.family||cell.width!==l.width||cell.topping!==(key==='roof'?s.roofTopping:2)))return {ok:false,message:'Wrong member family, width or topping for this model group. Nothing applied.'};
 if(cell.span+1e-7<check(s,key).span)return {ok:false,message:'Printed table span is shorter than the actual member. Nothing applied.'};
 s.selections[key]=id;if(beam)s.beamFamilies[key]=cell.family;return {ok:true};
}
function componentSchedule(s){
 const rows=['roof','floor',...beamRoles(s).map(r=>r.key)].map(key=>{const c=check(s,key);return {key,name:beamRole(s,key)?.label||(key==='roof'?'Roof deck':'Floor deck'),pages:tablePages(s,key),cell:c.c,applied:c.compatible,check:c,kind:'capacity'};});
 const stair=W.ConcretePDFData.stairs.find(x=>x.id===s.stairSelection&&x.thickness===s.stairThickness);
 rows.push({key:'stairs',name:'Precast stair flights',pages:[10,11],cell:stair||null,kind:'stair'});
 rows.push({key:'landings',name:'Stair landings + access slabs',pages:[11],kind:'reference',note:'Bearing / connection diagram only. Flight span recommendations do not verify landing or access-slab capacity.'});
 if(s.prototype==='CHARLIE'||(!isPoster(s)&&['ALPHA','DELTA'].includes(s.prototype)))rows.push({key:'columns',name:'Columns + haunches',pages:[15,16],kind:'reference',note:'Column interaction diagrams only. No selected capacity; haunches and connections require separate design.'});
 const wallName=s.prototype==='CHARLIE'&&isPoster(s)?'Shear walls + core / landing supports (course common)':s.prototype==='ALPHA'?'Haunched structural wall panels':s.prototype==='KILO'&&isPoster(s)?'Cyclopean bearing blocks + portal lite walls':'Opening-bearing lite walls';
 rows.push({key:'walls',name:wallName,pages:[17,18],kind:'reference',note:'Generic wall / tee-wall diagrams, not a capacity table for these openings, haunches or blocks. No capacity assigned.'});
 rows.push({key:'enclosure',name:{ALPHA:'Spandrels · fins · guardrails',CHARLIE:'Insulated panels · fins · hoods',DELTA:'Segmented panels · shadow / door hoods',KILO:'Screen hoods'}[s.prototype],pages:[],kind:'unlisted',note:'Poster geometry only; no matching load table in the supplied PDF.'});
 rows.push({key:'raft',name:'Raft foundation',pages:[],kind:'unlisted',note:'Thickness from Parameters p.12; no soil-bearing capacity assigned.'});
 return rows;
}
function reactions(s,level,l,q){
 const voids=new Set(level==='roof'?s.roofVoids:[...s.voids,...l.coreVoids]);
 const members=[],columns=new Map(),walls=[];
 if(q===null)return {members,columns:[],walls,deckTotal:null,beamWeight:null,totalToSupports:null};
 const col=(line,t)=>{const x=line.axis==='z'?line.coord:t,z=line.axis==='z'?t:line.coord,id=`${s.prototype==='KILO'?'litewall':'column'}-${x}-${z}`;if(!columns.has(id))columns.set(id,{id,x,z,load:0,complete:true});return columns.get(id);};
 for(const line of supportLines(s)){
  const tributary=l.panels.filter(p=>!voids.has(p.id)&&((l.p.axis==='x'&&(p.x===line.coord||p.x+p.dx===line.coord))||(l.p.axis==='z'&&(p.z===line.coord||p.z+p.dz===line.coord))));
  if(line.wall){walls.push({id:line.id,coord:line.coord,axis:line.axis,deckLoad:tributary.reduce((a,p)=>a+q*p.dx*p.dz/2,0),length:line.length});continue;}
  const key=beamKey(s,level,line),selected=validChoice(s,key);
  for(let t=0;t<line.length;t+=line.step){
   const end=Math.min(line.length,t+line.step),length=end-t,loads=[];
   for(const p of tributary){const a=line.axis==='z'?p.z:p.x,b=a+p.width,lo=Math.max(t,a),hi=Math.min(end,b);if(hi>lo)loads.push({force:q*p.span*(hi-lo)/2,at:(lo+hi)/2-t,panel:p.id});}
   const chord=length*(level==='roof'&&line.axis==='x'?1/Math.cos(s.slope*Math.PI/180):1),multiplicity=selected?.family==='L'&&!line.edge?2:1,weight=selected?selected.selfWeight*chord*multiplicity:null;
   const deckLoad=loads.reduce((a,b)=>a+b.force,0),r0=loads.reduce((a,b)=>a+b.force*(1-b.at/length),0)+(weight||0)/2,r1=deckLoad-loads.reduce((a,b)=>a+b.force*(1-b.at/length),0)+(weight||0)/2;
   members.push({id:`${level}-beam-${line.coord}-${t}`,key,family:beamFamily(s,key),line:line.id,axis:line.axis,coord:line.coord,t,end,length,chord,multiplicity,deckLoad,selfWeight:weight,r0,r1,complete:weight!==null,loads});
   for(const [pos,r]of [[t,r0],[end,r1]]){const c=col(line,pos);c.load+=r;c.complete&&=weight!==null;}
  }
 }
 const deckTotal=l.panels.filter(p=>!voids.has(p.id)).reduce((a,p)=>a+q*p.dx*p.dz,0);
 const beamWeight=members.every(m=>m.complete)?members.reduce((a,m)=>a+m.selfWeight,0):null;
 return {members,columns:[...columns.values()],walls,deckTotal,beamWeight,totalToSupports:[...columns.values()].reduce((a,c)=>a+c.load,0)+walls.reduce((a,w)=>a+w.deckLoad,0)};
}
function calc(s){
 const l=layout(s),u=uses[s.use],floorIDs=new Set([...s.voids,...l.coreVoids]),floorVoids=l.panels.filter(p=>floorIDs.has(p.id)),roofVoids=l.panels.filter(p=>s.roofVoids.includes(p.id));
 const area=panels=>panels.reduce((a,p)=>a+p.dx*p.dz,0),voidArea=area(floorVoids),floorArea=7200-l.uncovered-voidArea,roofArea=7200-l.uncovered-area(roofVoids);
 const checks=Object.fromEntries(['roof','floor',...beamRoles(s).map(r=>r.key)].map(k=>[k,check(s,k)]));
 const roofQ=checks.roof.compatible?checks.roof.c.selfWeight/Math.cos(s.slope*Math.PI/180)+u.roofDL+u.snow:null,floorQ=checks.floor.compatible?checks.floor.c.selfWeight+u.floorDL+u.live:null;
 const rise=60*Math.tan(s.slope*Math.PI/180),warnings=[];
 if(isPoster(s))warnings.push('Poster structural system on the course footprint / deck modules. '+posterSystems[s.prototype].difference+' Select Course adaptation to inspect the stated assignment changes.');
 if(!isPoster(s)&&s.prototype==='DELTA')warnings.push('Source difference: Parameters p.16 adds a column / beam line; Lecture 12 p.152 omits it. Beam subdivision is a design choice, not a prescribed table value.');
 if(l.uncovered)warnings.push(`${l.uncovered} sq ft is uncovered: 8 ft modules do not close 60 ft. Resolve the edge strip; 10 ft Delta tees close the footprint.`);
 if(voidArea>1800+.001)warnings.push('All floor voids, including reserved stair / lift panels, exceed 25% of the footprint.');
 if(roofVoids.length<3||roofVoids.length>10)warnings.push('Provide 3–10 structural roof openings.');
 if(rise>7+.001)warnings.push('Roof high point exceeds 21 ft above the second floor. At a 60 ft slope run, use 3–6.65° to satisfy both height and slope limits.');
 if(!s.cores)warnings.push('Two stairs and one elevator opening are required; turn on stairs & lift.');
 if(l.cores.length)warnings.push('Stair / lift wells reserve whole precast panels. Surplus opening area counts toward the 25% limit. Landings bear on dedicated solid panels; connection design remains separate.');
 for(const c of Object.values(checks))if(c.anomaly)warnings.push(c.c.sourceNote||'Selected printed source row has an anomaly. Verify before acceptance.');
 for(const key of ['roof','floor'])if(checks[key].maxCapacity!==null&&checks[key].required>checks[key].maxCapacity)warnings.push(`${key==='roof'?'Roof':'Floor'} demand ${checks[key].required} psf exceeds every compatible capacity in the supplied tables (maximum ${checks[key].maxCapacity} psf). ${s.prototype==='CHARLIE'?'Try the permitted 20 or 24 ft plank span.':'A different section / verified source or instructor-approved layout is needed.'}`);
 for(const role of beamRoles(s)){
  const b=validChoice(s,role.key),d=validChoice(s,role.level);
  if(beamFamily(s,role.key)==='L'&&!role.edge)warnings.push(`${role.label}: paired L sections carry opposite deck sides. Verify the paired-beam connection and support width; both beam self-weights enter reactions.`);
  if(b?.h1In&&d&&b.h1In>d.depth)warnings.push(`${role.label}: web projects ${b.h1In-d.depth} in above the deck top. Coordinate the upstand / bearing detail.`);
 }
 const roofReactions=reactions(s,'roof',l,roofQ),floorReactions=reactions(s,'floor',l,floorQ),columns=[];
 const columnIDs=new Set([...roofReactions.columns,...floorReactions.columns].map(c=>c.id));
 for(const id of columnIDs){const a=roofReactions.columns.find(c=>c.id===id),b=floorReactions.columns.find(c=>c.id===id),p=a||b,height=roofY(s,p.x)-(validChoice(s,'roof')?.depth||10)/12,verticalArea=(s.columnSize/12)**2;let weight=verticalArea*height*150;if(s.prototype==='KILO'){const line=supportLines(s).find(x=>!x.wall&&x.coord===p.x),fp=beamProfile(s,beamKey(s,'floor',line)),rp=beamProfile(s,beamKey(s,'roof',line)),fb=14-(validChoice(s,'floor')?.depth||10)/12-(fp.family==='R'?fp.h:fp.flangeH),rb=height-(rp.family==='R'?rp.h:rp.flangeH),width=p.x===0||p.x===60?4:8;weight=(3*(fb+rb-14)+4*(width-3))*s.wallThickness/12*150;}columns.push({...p,roof:a?.load??null,floor:b?.load??null,selfWeight:weight,foundation:a&&b&&a.complete&&b.complete?a.load+b.load+weight:null});}
 const stairSpan=11*11/12,stairLimit=({6:14,8:19,10:23,12:26})[s.stairThickness];
 const geometryOK=!l.uncovered&&voidArea<=1800&&roofVoids.length>=3&&roofVoids.length<=10&&rise<=7&&s.cores;
 return {layout:l,use:u,checks,floorArea,voidArea,roofArea,roofOpenings:roofVoids.length,rise,roofQ,floorQ,roofDeckTotal:roofQ===null?null:roofQ*roofArea,floorDeckTotal:floorQ===null?null:floorQ*floorArea,raftWeight:7200*u.raft/12*150,warnings,roofReactions,floorReactions,columns,stairSpan,stairLimit,stairPass:stairSpan<=stairLimit,geometryOK};
}
const palette={raft:'#bebfbe',column:'#ea9550',wall:'#f47e68',floor:'#c5dfb4',roof:'#ffd966',beam:'#bcd6ed',stair:'#f1f2f1',opening:'#7e7f7e',haunch:'#d2b28f',block:'#c19f83',enclosure:'#91a5b2'};
function scene(s,selected){
 const c=calc(s),l=c.layout,items=[],section=s.mode==='section',allowed=kind=>s.layer==='all'||s.layer===kind;
 const beam=(id,a,b,w,h,color,stage,kind)=>{if(s.stage>=stage&&allowed(kind))items.push({type:'beam',id,a,b,w,h,color});};
 const label=(text,p,color='#ffffff')=>items.push({type:'label',text,p,color});
 const line=(a,b,color='#ededed',id)=>items.push({type:'line',a,b,color,width:1,id});
 const depth=level=>(validChoice(s,level)?.depth||(l.p.family==='DT'?20:10))/12;
 const top=(level,x)=>level==='roof'?roofY(s,x):14;
 const soffit=(level,x)=>top(level,x)-depth(level);
 beam('raft',[0,-c.use.raft/24,60],[60,-c.use.raft/24,60],120,c.use.raft/12,palette.raft,1,'vertical');
 beam('main-floor-topping',[0,1/12,60],[60,1/12,60],120,2/12,palette.floor,1,'vertical');
 line([-6,-8/12,0],[66,-8/12,0]);label('GRADE · -0′ 8″',[65,-8/12,-4]);
 // Exact bearing lines define both the geometry and reaction solver.
 const wall=(id,a,b,roof=true)=>{
  const h1=soffit('roof',a[0]),h2=soffit('roof',b[0]),h=Math.min(h1,h2);
  beam(id,[a[0],h/2,a[1]],[b[0],h/2,b[1]],s.wallThickness/12,h,palette.wall,2,'vertical');
  if(Math.abs(h2-h1)>.001&&s.stage>=2&&allowed('vertical'))items.push({type:'poly',id,points:[[a[0],h,a[1]],[b[0],h,b[1]],[b[0],h2,b[1]],[a[0],h1,a[1]]],color:palette.wall});
 };
 // Wall panels are assembled around real openings; lintels remain part of the wall unit.
 const wallT=s.wallThickness/12;
 const segment=(id,support,t0,t1,y0,y1,w=wallT,color=palette.wall,stage=2,kind='vertical',offset=0)=>{
  if(t1<=t0||y1<=y0)return;
  const a=support.axis==='z'?[support.coord+offset,(y0+y1)/2,t0]:[t0,(y0+y1)/2,support.coord+offset];
  const b=support.axis==='z'?[support.coord+offset,(y0+y1)/2,t1]:[t1,(y0+y1)/2,support.coord+offset];
  beam(id,a,b,w,y1-y0,color,stage,kind);
 };
 const panel=(support,t0,t1,id)=>{
  const x=support.axis==='z'?support.coord:(t0+t1)/2,h=soffit('roof',x),leg=Math.min(1.5,(t1-t0)/5),joint=.04;
  segment(id+'-left',support,t0+joint,t0+leg,0,h);
  segment(id+'-right',support,t1-leg,t1-joint,0,h);
  segment(id+'-sill',support,t0+leg,t1-leg,0,1.5);
  segment(id+'-floor-head',support,t0+leg,t1-leg,11,soffit('floor',x));
  if(support.axis==='x'){
   const a=[t0+leg,soffit('roof',t0+leg)-1.35,support.coord],b=[t1-leg,soffit('roof',t1-leg)-1.35,support.coord];
   beam(id+'-roof-head',a,b,wallT,2.7,palette.wall,2,'vertical');
  }else segment(id+'-roof-head',support,t0+leg,t1-leg,h-2.7,h);
 };
 const seats=(support)=>{
  const directions=support.edge?[support.coord===0?1:-1]:[-1,1],step=l.p.family==='DT'?l.width/2:l.width;
  for(const level of ['floor','roof']){if(level==='roof'&&!s.showRoof)continue;
   for(let t=step/2;t<support.length;t+=step){const x=support.axis==='z'?support.coord:t,y=soffit(level,x);
    for(const sign of directions)segment('haunch-'+level+'-'+support.coord+'-'+t+'-'+sign,support,t-.55,t+.55,y-.8,y,1.05,palette.haunch,level==='floor'?3:6,'vertical',sign*(wallT/2+.52));
   }
  }
 };
 const blocks=support=>{
  const height=soffit('roof',support.coord),course=2;
  for(let y=0;y<height;y+=course){const hh=Math.min(course-.04,height-y,y<14?soffit('floor',support.coord)-y:Infinity),shift=Math.floor(y/course)%2?4:0;
   for(let t=-shift;t<120;t+=8){const lo=Math.max(0,t),hi=Math.min(120,t+8),opening=(y>=4&&y<10)||(y>=18&&y<24);
    let pieces=[[lo+.03,hi-.03]];
    if(opening)for(let window=4;window<120;window+=8){const left=window-1.5,right=window+1.5;pieces=pieces.flatMap(([a,b])=>b<=left||a>=right?[[a,b]]:[[a,Math.min(b,left)],[Math.max(a,right),b]].filter(([c,d])=>d>c));}
    for(const [i,[a,b]]of pieces.entries())segment('block-'+support.coord+'-'+y+'-'+lo+'-'+i,support,a,b,y,y+hh,1.25,palette.block);
   }
  }
 };
 for(const support of supportLines(s)){
  const pos=(t,y)=>support.axis==='z'?[support.coord,y,t]:[t,y,support.coord];
  if(support.wall){
   if(s.prototype==='KILO'&&isPoster(s)&&support.edge)blocks(support);
   else {const module=s.prototype==='ALPHA'?8:Math.min(20,support.length);
    for(let t=0;t<support.length;t+=module)panel(support,t,Math.min(t+module,support.length),`wall-${support.coord}-${t}`);
    if(s.prototype==='ALPHA'||s.prototype==='DELTA')seats(support);
   }
  }else{
   for(let t=0;t<=support.length+.001;t+=support.step){
    const a=pos(t,0),b=pos(t,soffit('roof',a[0]));
    if(s.prototype==='KILO'){
     // Portal wall at every beam end: two wall legs and integral heads, not a column.
     const portal={axis:'x',coord:a[2]},lo=Math.max(0,a[0]-4),hi=Math.min(60,a[0]+4),leg=1.5;
     const fp=beamProfile(s,beamKey(s,'floor',support)),rp=beamProfile(s,beamKey(s,'roof',support));
     const floorBottom=soffit('floor',a[0])-(fp.family==='R'?fp.h:fp.flangeH);
     const roofBottom=soffit('roof',a[0])-(rp.family==='R'?rp.h:rp.flangeH);
     for(const [base,top]of [[0,floorBottom],[14,roofBottom]]){
      segment('litewall-'+a[0]+'-'+a[2]+'-leg-a-'+base,portal,lo,lo+leg,base,top,wallT);
      segment('litewall-'+a[0]+'-'+a[2]+'-leg-b-'+base,portal,hi-leg,hi,base,top,wallT);
      segment('litewall-'+a[0]+'-'+a[2]+'-head-'+base,portal,lo+leg,hi-leg,top-2,top,wallT);
     }
    }else{
     beam(`column-${a[0]}-${a[2]}`,a,b,s.columnSize/12,s.columnSize/12,palette.column,2,'vertical');
     for(const level of ['floor','roof']){if(level==='roof'&&!s.showRoof)continue;const profile=beamProfile(s,beamKey(s,level,support)),bottom=profile.family==='R'?profile.h:profile.flangeH,y=soffit(level,a[0])-bottom;
      for(const sign of [-1,1]){if(t+sign*.6<0||t+sign*.6>support.length)continue;segment('column-haunch-'+level+'-'+support.coord+'-'+t+'-'+sign,support,t+sign*s.columnSize/24-.55,t+sign*s.columnSize/24+.55,y-.8,y,s.columnSize/12,palette.haunch,2);}
     }
    }
   }
   for(const level of ['floor','roof']){
    if(level==='roof'&&!s.showRoof)continue;
    const key=beamKey(s,level,support),profile=beamProfile(s,key,support.edge),parts=beamParts(profile,support.coord===0?1:-1);
    for(let t=0;t<support.length;t+=support.step){
     const id=`${level}-beam-${support.coord}-${t}`,stage=level==='floor'?3:6;
     for(const part of parts){const a=pos(t,0),b=pos(Math.min(support.length,t+support.step),0),transverse=support.axis==='z'?0:2;
      a[1]=soffit(level,a[0])+part.y;b[1]=soffit(level,b[0])+part.y;a[transverse]+=part.offset;b[transverse]+=part.offset;
      beam(id,a,b,part.w,part.h,palette.beam,stage,'beams');
     }
    }
   }
  }
 }
 // Prototype-specific enclosure is a separate layer; it never supplies invented table capacity.
 if(s.enclosure){
  const hood=(x,z,y,screen=false,door=false)=>{
   const side=x===0?-1:1,projection=door?3:1.8,xx=x+side*projection,span=screen?3:4,h=door?8:6;
   beam('hood-top-'+x+'-'+z+'-'+y,[x,y+h,z-span/2],[xx,y+h,z-span/2],span,.25,palette.enclosure,7,'enclosure');
   for(const zz of [z-span/2,z+span/2])beam('hood-side-'+x+'-'+zz+'-'+y,[x+side*projection/2,y+h/2,zz],[xx,y+h/2,zz],.22,h,palette.enclosure,7,'enclosure');
   if(screen)for(let dz=-span/2;dz<=span/2;dz+=.45)beam('screen-'+x+'-'+z+'-'+dz+'-'+y,[xx,y,z+dz],[xx,y+h,z+dz],.1,.16,palette.enclosure,7,'enclosure');
  };
  for(const x of [0,60])for(let z=4;z<120;z+=8){const sign=x===0?-1:1;
   if(s.prototype==='ALPHA'||s.prototype==='CHARLIE'){
    beam('fin-'+x+'-'+z,[x+sign*1.2,0,z],[x+sign*1.2,27,z],.22,2.5,palette.enclosure,7,'enclosure');
    if(s.prototype==='CHARLIE'){for(const y of [12.5,26.5])segment('insulated-panel-'+x+'-'+z+'-'+y,{axis:'z',coord:x+sign*.6},z-3.9,z+3.9,y-1,y+1,.45,palette.enclosure,7,'enclosure');hood(x,z,18);}
   }
   if(s.prototype==='DELTA'){
    beam('segmented-panel-'+x+'-'+z,[x+sign*.5,0,z-2.5],[x+sign*2,27,z+2.5],.4,3,palette.enclosure,7,'enclosure');
   }
   if(s.prototype==='KILO')for(const y of [4,18])hood(x,z,y,true);
  }
  if(s.prototype==='ALPHA')for(const z of [0,120])for(const y of [12.5,26.5]){
   beam('spandrel-'+z+'-'+y,[0,y,z],[60,y,z],.4,2,palette.enclosure,7,'enclosure');
   beam('guardrail-'+z+'-'+y,[0,y+3,z+(z===0?-1:1)],[60,y+3,z+(z===0?-1:1)],.3,3,palette.enclosure,7,'enclosure');
  }
  if(s.prototype==='DELTA'){for(const x of [0,60])for(const z of [4,116]){hood(x,z,4);hood(x,z,18);}hood(0,60,0,false,true);}
 }
 // Four perimeter sides contain solid shear segments in both plan directions.
 for(const z of [0,120])for(const x of [0,52])wall(`shear-x-${x}-${z}`,[x,z],[x+8,z]);
 for(const x of [0,60])for(const z of [0,112])wall(`shear-z-${x}-${z}`,[x,z],[x,z+8]);
 for(const core of l.cores){
  if(core.type==='elevator'){
   for(const [i,a,b]of [[0,[core.x,core.z],[core.x,core.z+10]],[1,[core.x+10,core.z],[core.x+10,core.z+10]],[2,[core.x,core.z],[core.x+10,core.z]]]){const yy=13.5;beam('lift-wall-'+i,[a[0],yy/2,a[1]],[b[0],yy/2,b[1]],s.wallThickness/12,yy,palette.wall,2,'vertical');}
   if(s.stage>=2&&allowed('vertical'))label('LIFT · 10 × 10 ft',[core.x+5,14.2,core.z+5]);continue;
  }
  const x=core.x,z=core.z,run=11*11/12,h=s.stairThickness/12;
  // Solid landing supports terminate at landing elevation, avoiding the walking path.
  for(const [name,zz,y]of [['mid',z+run+4,7],['top',z,14]])beam(core.id+'-'+name+'-support',[x,y/2,zz],[x+core.dx,y/2,zz],.5,y,palette.wall,2,'vertical');
  beam(core.id+'-lower-flight',[x+2,h/2,z+4],[x+2,7-h/2,z+4+run],4,h,palette.stair,4,'stairs');
  beam(core.id+'-upper-flight',[x+6.5,7-h/2,z+4+run],[x+6.5,14-h/2,z+4],4,h,palette.stair,4,'stairs');
  beam(core.id+'-middle-landing',[x,7-h/2,z+run+6],[x+core.dx,7-h/2,z+run+6],4,h,palette.stair,4,'stairs');
  beam(core.id+'-top-landing',[x+4.5,14-h/2,z+2],[x+8.5,14-h/2,z+2],4,h,palette.stair,4,'stairs');
  const retained=l.panels.filter(p=>![...s.voids,...l.coreVoids].includes(p.id));
  const landingX=x+6.5,landingZ=z+2,neighbors=retained.filter(p=>p.z<=landingZ&&p.z+p.dz>=landingZ).map(p=>({p,target:Math.max(p.x,Math.min(p.x+p.dx,landingX))})).sort((a,b)=>Math.abs(a.target-landingX)-Math.abs(b.target-landingX));
  if(neighbors.length){const target=neighbors[0].target,lo=Math.min(landingX,target),hi=Math.max(landingX,target);if(hi-lo>.01){beam(core.id+'-access-landing',[lo,14-h/2,landingZ],[hi,14-h/2,landingZ],4,h,palette.stair,4,'stairs');for(const zz of [z,z+4])beam(core.id+'-access-support-'+zz,[lo,7-h/2,zz],[hi,7-h/2,zz],.5,14-h,palette.wall,2,'vertical');}}
  for(let i=1;i<=12;i++){
   const zz=z+4+(i-1)*11/12,yy=i*7/12;
   beam(core.id+'-tread-a-'+i,[x,yy-.08,zz],[x+4,yy-.08,zz],11/12,.16,palette.stair,4,'stairs');
   beam(core.id+'-tread-b-'+i,[x+4.5,7+yy-.08,z+4+run-(i-1)*11/12],[x+8.5,7+yy-.08,z+4+run-(i-1)*11/12],11/12,.16,palette.stair,4,'stairs');
  }
  if(s.stage>=4&&allowed('stairs'))label(core.id.toUpperCase()+' · 4 ft flights',[x+core.dx/2,14.5,z+core.dz/2]);
 }
 for(const level of ['floor','roof']){
  if(level==='roof'&&!s.showRoof)continue;if(s.mode==='2d'&&level!==s.planLevel)continue;
  const stage=level==='roof'?7:5,voids=new Set(level==='roof'?s.roofVoids:[...s.voids,...l.coreVoids]),sel=validChoice(s,level),d=depth(level),topping=(level==='roof'?s.roofTopping:2)/12;
  for(const p of l.panels){
   const id=level+':'+p.id,y=x=>top(level,x),corners=[[p.x,y(p.x)+.05,p.z],[p.x+p.dx,y(p.x+p.dx)+.05,p.z],[p.x+p.dx,y(p.x+p.dx)+.05,p.z+p.dz],[p.x,y(p.x)+.05,p.z+p.dz]];
   if(voids.has(p.id)){if(s.stage>=stage&&allowed('deck')){for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],palette.opening,id);}continue;}
   const a=l.p.axis==='x'?[p.x,y(p.x)-d/2,p.z+p.dz/2]:[p.x+p.dx/2,y(p.x+p.dx/2)-d/2,p.z],b=l.p.axis==='x'?[p.x+p.dx,y(p.x+p.dx)-d/2,p.z+p.dz/2]:[p.x+p.dx/2,y(p.x+p.dx/2)-d/2,p.z+p.dz];
   const spanAxis=l.p.axis==='x'?0:2,lines=supportLines(s);
   const startLine=lines.find(x=>x.coord===a[spanAxis]),endLine=lines.find(x=>x.coord===b[spanAxis]);
   a[spanAxis]+=deckCutback(s,level,startLine);b[spanAxis]-=deckCutback(s,level,endLine);
   a[1]=y(a[0])-d/2;b[1]=y(b[0])-d/2;
   if(l.p.family==='DT'){
    const flange=2/12+topping,fa=[...a],fb=[...b];fa[1]+=d/2-flange/2;fb[1]+=d/2-flange/2;beam(id,fa,fb,p.width-.08,flange,palette[level],stage,'deck');
    for(const offset of [-p.width/4,p.width/4]){const ra=[...a],rb=[...b];ra[l.p.axis==='x'?2:0]+=offset;rb[l.p.axis==='x'?2:0]+=offset;ra[1]-=flange/2;rb[1]-=flange/2;beam(id,ra,rb,.5,Math.max(.2,d-flange),palette[level],stage,'deck');}
   }else beam(id,a,b,p.width-.08,d,palette[level],stage,'deck');
  }
 }
 if(s.showGrid){
  const xs=l.p.axis==='x'?[0,30,60]:Array.from({length:60/l.beamSpan+1},(_,i)=>i*l.beamSpan),zs=l.p.axis==='x'?[0,24,48,72,96,120]:Array.from({length:120/l.span+1},(_,i)=>i*l.span),y=s.mode==='2d'?(s.planLevel==='roof'?roofY(s,60)+1:15):.05;
  xs.forEach((x,i)=>{line([x,y,-4],[x,y,124],'#8e989c');label(String.fromCharCode(65+i),[x,y,-7]);if(i)label((x-xs[i-1])+' ft',[(x+xs[i-1])/2,y,-3]);});
  zs.forEach((z,i)=>{line([-4,y,z],[64,y,z],'#8e989c');label(String(i+1),[-7,y,z]);if(i)label((z-zs[i-1])+' ft',[-9,y,(z+zs[i-1])/2]);});
 }
 if(s.loadPath&&!c.columns.length){const support=supportLines(s).find(x=>x.wall);if(support){const x=support.axis==='z'?support.coord:30,z=support.axis==='z'?60:support.coord;for(const level of ['roof','floor']){const y=level==='roof'?roofY(s,x):14;if(level==='roof'&&!s.showRoof)continue;items.push({type:'arrow',a:[x+2,y+4,z],b:[x+2,y,z],color:'#fff6bd',width:3});label(level.toUpperCase()+' → WALL',[x+4,y+3,z]);}items.push({type:'arrow',a:[x+2,11,z],b:[x+2,0,z],color:'#fff6bd',width:3});label('WALL → RAFT',[x+4,1,z]);}}
 if(s.loadPath){const col=c.columns.find(x=>x.foundation!==null)||c.columns[0];if(col){const labelLoad=v=>v===null?'?':(v/1000).toFixed(1)+' kip';for(const [y,v]of [[roofY(s,col.x),col.roof],[14,col.floor]]){items.push({type:'arrow',a:[col.x,y+4,col.z],b:[col.x,y,col.z],color:'#fff6bd',width:3});label(labelLoad(v),[col.x+3,y+3,col.z]);}items.push({type:'arrow',a:[col.x,12,col.z],b:[col.x,0,col.z],color:'#fff6bd',width:3});label('FOUNDATION '+labelLoad(col.foundation),[col.x+5,1,col.z]);}}
 label('60 ft × 120 ft',[30,.2,-13]);
 if(section){label('2ND FLOOR +14 ft',[65,14,0]);label('ROOF +'+roofY(s,60).toFixed(2)+' ft',[65,roofY(s,60),0]);label('MAT '+c.use.raft+' in',[65,-2,0]);}
 for(const it of items){if(it.type!=='beam')continue;
  const deck=/^(roof|floor):/.exec(it.id||''),bm=/^(roof|floor)-beam-([\d.]+)-/.exec(it.id||'');
  if(deck)it.tableKey=deck[1];else if(bm){const support=supportLines(s).find(x=>x.coord===+bm[2]);it.tableKey=beamKey(s,bm[1],support);}
  else if(it.id?.includes('flight')||it.id?.includes('tread'))it.tableKey='stairs';
  else if(it.id?.startsWith('column'))it.tableKey='columns';
  else if(/^(wall-|haunch-|litewall-|block-|shear-)/.test(it.id||''))it.tableKey='walls';
  else if(/^(fin-|hood-|screen-|segmented-|spandrel-|guardrail-|insulated-)/.test(it.id||''))it.tableKey='enclosure';
  else if(it.id==='raft'||it.id==='main-floor-topping')it.tableKey='raft';
  else if(/support|lift-wall/.test(it.id||''))it.tableKey='walls';
  else if(/landing/.test(it.id||''))it.tableKey='landings';
  const cell=it.tableKey==='stairs'?W.ConcretePDFData.stairs.find(x=>x.id===s.stairSelection):['roof','floor',...beamRoles(s).map(r=>r.key)].includes(it.tableKey)?validChoice(s,it.tableKey):null;
  it.sourceCell=cell?.id||null;it.sourcePage=cell?.page||null;
 }
 return {items,center:[30,section?13:12,60],extent:section?85:148,plane:section?'elevation':'plan',selected};
}
W.ConcreteBuildingData={uses,prototypes,posterSystems,isPoster,description,assemblyStages,tablePages,applyCell,componentSchedule,groups,ids,defaults,normalize,choice,validChoice,layout,supportLines,beamRoles,beamRole,beamKey,beamFamily,beamPage,beamProfile,beamParts,deckCutback,coreLayout,check,calc,reactions,scene,palette,roofY};
})(typeof window!=='undefined'?window:globalThis);
