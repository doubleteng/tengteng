/* ARC 2713 Concrete Building. Original course values; feet, inches, pounds.
 * Service-load comparisons are separate from connection / stability design.
 */
(function(W){'use strict';
const uses={office:{name:'Office · Ypsilanti',snow:20,roofDL:15,live:50,floorDL:15,raft:50},grocery:{name:'Grocery · Pinconning',snow:40,roofDL:15,live:75,floorDL:20,raft:50},library:{name:'Library · Houghton',snow:100,roofDL:15,live:150,floorDL:15,raft:68}};
const prototypes={
 ALPHA:{family:'DT',width:8,span:30,beamSpan:24,axis:'x',description:'8 ft double tees span 30 ft. One longitudinal column line carries 24 ft beams; perimeter panels carry the outer deck reactions. Parameters p.14.'},
 CHARLIE:{family:'HC',width:4,span:30,beamSpan:20,axis:'z',description:'4 ft hollow-core planks span 20, 24 or 30 ft. 20 ft beams on columns; replace 1–3 internal support lines with litewalls. Parameters p.15.'},
 DELTA:{family:'DT',width:10,span:40,beamSpan:20,axis:'z',description:'8 or 10 ft double tees span 40 ft. One transverse column / beam line; other support lines are bearing walls. Beam subdivision is a student design choice. Parameters p.16.'},
 KILO:{family:'HC',width:4,span:30,beamSpan:24,axis:'x',description:'4 ft hollow-core planks span 30 ft to a continuous central litewall. Perimeter litewalls support 24 ft beams. Parameters p.17 and Lecture 12 p.152.'}
};
const groups=[['Concrete Building · Read',[['concrete-brief','1 · Brief & prototypes'],['concrete-concepts','1.0 · Members & load path']]],['Concrete Building · Model + tables',[['concrete-roof','1.1 · Roof deck'],['concrete-floor','2.1 · Floor & double height'],['concrete-beams','2.2 · Beams & reactions'],['concrete-vertical','3.1 · Columns, walls & raft'],['concrete-assembly','3.2 · Assembly & submission']]]];
const ids=groups.flatMap(g=>g[1].map(x=>x[0]));
const defaults=()=>({version:2,lesson:'concrete-brief',prototype:'ALPHA',use:'office',deckSpan:30,deltaWidth:10,deltaBeamSpan:20,wallLines:1,kiloSupport:'wall',slope:3,roofTopping:2,stage:7,layer:'all',mode:'3d',voids:[],roofVoids:['p-30-24','p-30-56','p-30-88'],selections:{},notes:{},tablePages:{},showRoof:true,planLevel:'floor',columnSize:24,wallThickness:8,cores:true,stairThickness:8,showGrid:true,loadPath:false});
function normalize(raw){
 const d=defaults(),r=raw&&typeof raw==='object'?raw:{};
 for(const k of ['prototype','use'])if((k==='prototype'?prototypes:uses)[r[k]])d[k]=r[k];
 if(ids.includes(r.lesson))d.lesson=r.lesson;
 for(const [k,values]of Object.entries({deckSpan:[20,24,30],deltaWidth:[8,10],deltaBeamSpan:[20,30],wallLines:[1,2,3],roofTopping:[0,2],stage:[1,2,3,4,5,6,7],mode:['2d','3d','section'],planLevel:['roof','floor'],columnSize:[16,18,20,24,28,32],wallThickness:[6,8,10,12],stairThickness:[6,8,10,12],layer:['all','deck','beams','vertical','stairs']}))if(values.includes(r[k]))d[k]=r[k];
 if(Number.isFinite(r.slope))d.slope=Math.min(10,Math.max(3,r.slope));
 for(const k of ['showRoof','cores','showGrid','loadPath'])if(typeof r[k]==='boolean')d[k]=r[k];
 for(const k of ['voids','roofVoids'])if(Array.isArray(r[k]))d[k]=[...new Set(r[k].filter(x=>typeof x==='string'&&/^p-\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(x)))].slice(0,100);
 for(const k of ['roof','floor','roofBeam','floorBeam'])if(typeof r.selections?.[k]==='string'&&W.ConcretePDFData.cells.some(c=>c.id===r.selections[k]))d.selections[k]=r.selections[k];
 for(const k of ids){if(typeof r.notes?.[k]==='string')d.notes[k]=r.notes[k].slice(0,12000);if(Number.isInteger(r.tablePages?.[k])&&r.tablePages[k]>=1&&r.tablePages[k]<=18)d.tablePages[k]=r.tablePages[k];}
 return d;
}
const choice=(s,key)=>W.ConcretePDFData.cells.find(c=>c.id===s.selections[key])||null;
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
 return {p,span,width,panels,cores,coreVoids,beamSpan,beamTributary:s.prototype==='KILO'||(s.prototype==='CHARLIE'&&s.wallLines>=120/span-1)?span/2:span,uncovered:7200-panels.reduce((a,b)=>a+b.dx*b.dz,0)};
}
function supportLines(s){
 const l=layout(s),lines=[],limit=l.p.axis==='x'?60:120;
 for(let c=0;c<=limit+.001;c+=l.span){
  const edge=c===0||c===limit;
  let wall=s.prototype==='ALPHA'?edge:s.prototype==='KILO'?!edge:s.prototype==='DELTA'?c!==40:!edge&&c/l.span<=s.wallLines;
  lines.push({id:'support-'+c,coord:c,axis:l.p.axis==='x'?'z':'x',length:l.p.axis==='x'?120:60,step:l.beamSpan,wall,edge,tributary:edge?l.span/2:l.span});
 }
 return lines;
}
function check(s,key){
 const l=layout(s),c=choice(s,key),u=uses[s.use],beam=key.endsWith('Beam'),roof=key.startsWith('roof'),topping=roof?s.roofTopping:2;
 const nominalSpan=beam?l.beamSpan:l.span,slopeFactor=roof?1/Math.cos(s.slope*Math.PI/180):1;
 const alongSlope=beam?l.p.axis==='z':l.p.axis==='x',span=nominalSpan*(alongSlope?slopeFactor:1);
 const deck=beam?check(s,roof?'roof':'floor'):null;
 const added=roof?u.snow+u.roofDL:u.live+u.floorDL;
 const required=beam?(deck.compatible?(deck.c.selfWeight*slopeFactor+added)*(c?.family==='L'?Math.min(l.beamTributary,l.span/2):l.beamTributary):null):added;
 const compatible=!!c&&(beam?['R','L','T'].includes(c.family):c.family===l.p.family&&c.width===l.width&&c.topping===topping)&&c.span===Math.ceil((span-1e-7)/2)*2;
 const anomaly=!!c?.sourceAnomaly;
 const status=!c?'Choose a printed capacity cell':!compatible?'Section, topping or table span does not match':required===null?'Choose a compatible deck first':anomaly?'Source anomaly — verify printed row':required>c.capacity?'Demand exceeds table capacity':'Within selected service-load table';
 const candidates=W.ConcretePDFData.cells.filter(v=>(beam?['R','L','T'].includes(v.family):v.family===l.p.family&&v.width===l.width&&v.topping===topping)&&v.span===Math.ceil((span-1e-7)/2)*2&&!v.sourceAnomaly),maxCapacity=candidates.length?Math.max(...candidates.map(v=>v.capacity)):null;
 return {key,c,required,span,nominalSpan,maxCapacity,tributary:beam?(c?.family==='L'?Math.min(l.beamTributary,l.span/2):l.beamTributary):null,multiplicity:beam&&c?.family==='L'&&l.beamTributary>l.span/2?2:1,compatible,passes:compatible&&required!==null&&required<=c.capacity&&!anomaly,anomaly,status,unit:beam?'plf':'psf',scope:beam?'Source assumes 50% superimposed dead / 50% live; verify actual load mix, camber and release strength.':'Use the printed topping, superimposed dead load, release strength and camber conditions.',utilization:compatible&&required!==null?required/c.capacity:null};
}
const validChoice=(s,key)=>check(s,key).compatible?choice(s,key):null;
function reactions(s,level,l,q){
 const selected=validChoice(s,level+'Beam'),voids=new Set(level==='roof'?s.roofVoids:[...s.voids,...l.coreVoids]);
 const members=[],columns=new Map(),walls=[];
 if(q===null)return {members,columns:[],walls,deckTotal:null,beamWeight:null,totalToSupports:null};
 const col=(line,t)=>{const x=line.axis==='z'?line.coord:t,z=line.axis==='z'?t:line.coord,id=`column-${x}-${z}`;if(!columns.has(id))columns.set(id,{id,x,z,load:0,complete:true});return columns.get(id);};
 for(const line of supportLines(s)){
  const tributary=l.panels.filter(p=>!voids.has(p.id)&&((l.p.axis==='x'&&(p.x===line.coord||p.x+p.dx===line.coord))||(l.p.axis==='z'&&(p.z===line.coord||p.z+p.dz===line.coord))));
  if(line.wall){walls.push({id:line.id,coord:line.coord,axis:line.axis,deckLoad:tributary.reduce((a,p)=>a+q*p.dx*p.dz/2,0),length:line.length});continue;}
  for(let t=0;t<line.length;t+=line.step){
   const end=Math.min(line.length,t+line.step),length=end-t,loads=[];
   for(const p of tributary){const a=line.axis==='z'?p.z:p.x,b=a+p.width,lo=Math.max(t,a),hi=Math.min(end,b);if(hi>lo)loads.push({force:q*p.span*(hi-lo)/2,at:(lo+hi)/2-t,panel:p.id});}
   const chord=length*(level==='roof'&&line.axis==='x'?1/Math.cos(s.slope*Math.PI/180):1),multiplicity=selected?.family==='L'&&!line.edge?2:1,weight=selected?selected.selfWeight*chord*multiplicity:null;
   const deckLoad=loads.reduce((a,b)=>a+b.force,0),r0=loads.reduce((a,b)=>a+b.force*(1-b.at/length),0)+(weight||0)/2,r1=deckLoad-loads.reduce((a,b)=>a+b.force*(1-b.at/length),0)+(weight||0)/2;
   members.push({id:`${level}-beam-${line.coord}-${t}`,line:line.id,axis:line.axis,coord:line.coord,t,end,length,chord,multiplicity,deckLoad,selfWeight:weight,r0,r1,complete:weight!==null,loads});
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
 const checks=Object.fromEntries(['roof','floor','roofBeam','floorBeam'].map(k=>[k,check(s,k)]));
 const roofQ=checks.roof.compatible?checks.roof.c.selfWeight/Math.cos(s.slope*Math.PI/180)+u.roofDL+u.snow:null,floorQ=checks.floor.compatible?checks.floor.c.selfWeight+u.floorDL+u.live:null;
 const rise=60*Math.tan(s.slope*Math.PI/180),warnings=[];
 if(l.uncovered)warnings.push(`${l.uncovered} sq ft is uncovered: 8 ft modules do not close 60 ft. Resolve the edge strip; 10 ft Delta tees close the footprint.`);
 if(voidArea>1800+.001)warnings.push('All floor voids, including reserved stair / lift panels, exceed 25% of the footprint.');
 if(roofVoids.length<3||roofVoids.length>10)warnings.push('Provide 3–10 structural roof openings.');
 if(rise>7+.001)warnings.push('Roof high point exceeds 21 ft above the second floor. At a 60 ft slope run, use 3–6.65° to satisfy both height and slope limits.');
 if(!s.cores)warnings.push('Two stairs and one elevator opening are required; turn on stairs & lift.');
 if(l.cores.length)warnings.push('Stair / lift wells reserve whole precast panels. Surplus opening area counts toward the 25% limit. Landings bear on dedicated solid panels; connection design remains separate.');
 for(const c of Object.values(checks))if(c.anomaly)warnings.push(c.c.sourceNote||'Selected printed source row has an anomaly. Verify before acceptance.');
 for(const key of ['roof','floor'])if(checks[key].maxCapacity!==null&&checks[key].required>checks[key].maxCapacity)warnings.push(`${key==='roof'?'Roof':'Floor'} demand ${checks[key].required} psf exceeds every compatible capacity in the supplied tables (maximum ${checks[key].maxCapacity} psf). ${s.prototype==='CHARLIE'?'Try the permitted 20 or 24 ft plank span.':'A different section / verified source or instructor-approved layout is needed.'}`);
 for(const level of ['roof','floor']){const b=validChoice(s,level+'Beam'),d=validChoice(s,level);if(b?.family==='L'&&l.beamTributary===l.span)warnings.push(`${level} interior support has decks on both sides. A single L-beam has one ledge: detail paired L-beams or choose an inverted T / rectangular beam; the current table comparison is numerical only.`);if(b?.h1In&&d&&b.h1In>d.depth)warnings.push(`${level} beam web rises ${b.h1In-d.depth} in above the selected deck surface; resolve the floor / roof level or section arrangement.`);}
 for(const key of ['roofBeam','floorBeam']){const v=validChoice(s,key),deck=validChoice(s,key.startsWith('roof')?'roof':'floor');if(v?.h1In&&deck&&v.h1In>deck.depth)warnings.push(`${key}: selected beam web projects ${v.h1In-deck.depth} in above the deck top when supported on its ledge. Coordinate the upstand / bearing detail.`);}
 const roofReactions=reactions(s,'roof',l,roofQ),floorReactions=reactions(s,'floor',l,floorQ),columns=[];
 const columnIDs=new Set([...roofReactions.columns,...floorReactions.columns].map(c=>c.id));
 for(const id of columnIDs){const a=roofReactions.columns.find(c=>c.id===id),b=floorReactions.columns.find(c=>c.id===id),p=a||b,height=roofY(s,p.x)-(validChoice(s,'roof')?.depth||10)/12,verticalArea=s.prototype==='KILO'?(s.wallThickness/12)*(p.z===0||p.z===120?2:4):(s.columnSize/12)**2,weight=verticalArea*height*150;columns.push({...p,roof:a?.load??null,floor:b?.load??null,selfWeight:weight,foundation:a&&b&&a.complete&&b.complete?a.load+b.load+weight:null});}
 const stairSpan=11*11/12,stairLimit=({6:14,8:19,10:23,12:26})[s.stairThickness];
 const geometryOK=!l.uncovered&&voidArea<=1800&&roofVoids.length>=3&&roofVoids.length<=10&&rise<=7&&s.cores;
 return {layout:l,use:u,checks,floorArea,voidArea,roofArea,roofOpenings:roofVoids.length,rise,roofQ,floorQ,roofDeckTotal:roofQ===null?null:roofQ*roofArea,floorDeckTotal:floorQ===null?null:floorQ*floorArea,raftWeight:7200*u.raft/12*150,warnings,roofReactions,floorReactions,columns,stairSpan,stairLimit,stairPass:stairSpan<=stairLimit,geometryOK};
}
const palette={raft:'#bebfbe',column:'#ea9550',wall:'#f47e68',floor:'#c5dfb4',roof:'#ffd966',beam:'#bcd6ed',stair:'#f1f2f1',opening:'#7e7f7e'};
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
 for(const support of supportLines(s)){
  const pos=(t,y)=>support.axis==='z'?[support.coord,y,t]:[t,y,support.coord];
  if(support.wall){
   for(let t=0;t<support.length;t+=support.step){const a=pos(t,0),b=pos(Math.min(t+8,support.length),0);wall(`wall-${support.coord}-${t}`,[a[0],a[2]],[b[0],b[2]]);}
   for(const level of ['floor','roof']){if(level==='roof'&&!s.showRoof)continue;const a=pos(0,0),b=pos(support.length,0);a[1]=soffit(level,a[0])-1;b[1]=soffit(level,b[0])-1;beam('wall-band-'+support.coord+'-'+level,a,b,s.wallThickness/12,2,palette.wall,2,'vertical');}
  }else{
   for(let t=0;t<=support.length+.001;t+=support.step){const a=pos(t,0),b=pos(t,soffit('roof',a[0]));if(s.prototype==='KILO')wall('kilo-pier-'+support.coord+'-'+t,[a[0],Math.max(0,a[2]-2)],[a[0],Math.min(120,a[2]+2)]);else beam(`column-${a[0]}-${a[2]}`,a,b,s.columnSize/12,s.columnSize/12,palette.column,2,'vertical');}
   for(const level of ['floor','roof']){if(level==='roof'&&!s.showRoof)continue;const sel=validChoice(s,level+'Beam'),h=(sel?.depth||24)/12,w=sel?.width||28/12;
    for(let t=0;t<support.length;t+=support.step){const a=pos(t,0),b=pos(Math.min(support.length,t+support.step),0);a[1]=soffit(level,a[0])-h/2;b[1]=soffit(level,b[0])-h/2;const id=`${level}-beam-${support.coord}-${t}`,stage=level==='floor'?3:6;
     if(sel?.family==='T'||sel?.family==='L'){
      const flangeH=(sel.h2In||sel.depth*.4)/12,webW=(sel.webWidthIn||12)/12,soffA=soffit(level,a[0]),soffB=soffit(level,b[0]),transverse=support.axis==='z'?0:2;
      // The slab underside bears on the ledge top; the web is an upstand.
      const count=sel.family==='L'&&!support.edge?2:1;
      for(let n=0;n<count;n++){
       const sign=count===2?(n===0?-1:1):(support.coord===0?1:-1),flangeOffset=sel.family==='L'?sign*w/2:0,webOffset=sel.family==='L'?sign*webW/2:0;
       const fa=[...a],fb=[...b],wa=[...a],wb=[...b];fa[1]=soffA-flangeH/2;fb[1]=soffB-flangeH/2;wa[1]=soffA-flangeH+h/2;wb[1]=soffB-flangeH+h/2;fa[transverse]+=flangeOffset;fb[transverse]+=flangeOffset;wa[transverse]+=webOffset;wb[transverse]+=webOffset;
       beam(id,fa,fb,w,flangeH,palette.beam,stage,'beams');beam(id,wa,wb,webW,h,palette.beam,stage,'beams');
      }
     }else beam(id,a,b,w,h,palette.beam,stage,'beams');
    }
   }
  }
 }
 // Four perimeter sides contain solid shear segments in both plan directions.
 for(const z of [0,120])for(const x of [0,52])wall(`shear-x-${x}-${z}`,[x,z],[x+8,z]);
 for(const x of [0,60])for(const z of [0,112])wall(`shear-z-${x}-${z}`,[x,z],[x,z+8]);
 for(const core of l.cores){
  if(core.type==='elevator'){
   for(const [i,a,b]of [[0,[core.x,core.z],[core.x,core.z+10]],[1,[core.x+10,core.z],[core.x+10,core.z+10]],[2,[core.x,core.z],[core.x+10,core.z]]]){const yy=13.5;beam('lift-wall-'+i,[a[0],yy/2,a[1]],[b[0],yy/2,b[1]],s.wallThickness/12,yy,palette.wall,2,'vertical');}
   if(s.stage>=2)label('LIFT · 10 × 10 ft',[core.x+5,14.2,core.z+5]);continue;
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
  if(s.stage>=4)label(core.id.toUpperCase()+' · 4 ft flights',[x+core.dx/2,14.5,z+core.dz/2]);
 }
 for(const level of ['floor','roof']){
  if(level==='roof'&&!s.showRoof)continue;if(s.mode==='2d'&&level!==s.planLevel)continue;
  const stage=level==='roof'?7:5,voids=new Set(level==='roof'?s.roofVoids:[...s.voids,...l.coreVoids]),sel=validChoice(s,level),d=depth(level),topping=(level==='roof'?s.roofTopping:2)/12;
  for(const p of l.panels){
   const id=level+':'+p.id,y=x=>top(level,x),corners=[[p.x,y(p.x)+.05,p.z],[p.x+p.dx,y(p.x+p.dx)+.05,p.z],[p.x+p.dx,y(p.x+p.dx)+.05,p.z+p.dz],[p.x,y(p.x)+.05,p.z+p.dz]];
   if(voids.has(p.id)){if(s.stage>=stage){for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],palette.opening,id);}continue;}
   const a=l.p.axis==='x'?[p.x,y(p.x)-d/2,p.z+p.dz/2]:[p.x+p.dx/2,y(p.x+p.dx/2)-d/2,p.z],b=l.p.axis==='x'?[p.x+p.dx,y(p.x+p.dx)-d/2,p.z+p.dz/2]:[p.x+p.dx/2,y(p.x+p.dx/2)-d/2,p.z+p.dz];
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
 if(s.loadPath){const col=c.columns.find(x=>x.foundation!==null)||c.columns[0];if(col){const labelLoad=v=>v===null?'?':(v/1000).toFixed(1)+' kip';for(const [y,v]of [[roofY(s,col.x),col.roof],[14,col.floor]]){items.push({type:'arrow',a:[col.x,y+4,col.z],b:[col.x,y,col.z],color:'#fff6bd',width:3});label(labelLoad(v),[col.x+3,y+3,col.z]);}items.push({type:'arrow',a:[col.x,12,col.z],b:[col.x,0,col.z],color:'#fff6bd',width:3});label('FOUNDATION '+labelLoad(col.foundation),[col.x+5,1,col.z]);}}
 label('60 ft × 120 ft',[30,.2,-13]);
 if(section){label('2ND FLOOR +14 ft',[65,14,0]);label('ROOF +'+roofY(s,60).toFixed(2)+' ft',[65,roofY(s,60),0]);label('MAT '+c.use.raft+' in',[65,-2,0]);}
 return {items,center:[30,section?13:12,60],extent:section?85:148,plane:section?'elevation':'plan',selected};
}
W.ConcreteBuildingData={uses,prototypes,groups,ids,defaults,normalize,choice,validChoice,layout,supportLines,coreLayout,check,calc,reactions,scene,palette,roofY};
})(typeof window!=='undefined'?window:globalThis);
