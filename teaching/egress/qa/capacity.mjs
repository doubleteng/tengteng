import {SF,IN,dist,inside,insideRoom,edges,segDist,route} from './geometry.mjs?v=topology-rebuild-4';
import {roomArea,floorOpenings} from './openings.mjs?v=topology-rebuild-4';
import {featureObstacles,excludedSpaces} from './semantic-plan.mjs?v=topology-rebuild-4';
import {functions} from './model.mjs?v=topology-rebuild-4';
export function roomLoad(p,fi,r){
 const a=roomArea(p,fi,r),factor=Number(r.factor)||functions[r.function]?.factor||150,circulation=r.role==='corridor';
 return{id:r.id,name:r.name,role:r.role||'room',area:a,factor,basis:r.basis||functions[r.function]?.basis||'gross',function:r.function,functionLabel:circulation?'Circulation (no additional occupants)':functions[r.function]?.name||'User-defined use',occupants:circulation?0:Math.ceil(a/SF/factor),areaConfirmed:!!r.areaConfirmed};
}
export function capacityDimension(x,units='m',up=false){
 const value=units==='ft'?x/IN:x*1000,precision=units==='ft'?100:1,n=up?Math.ceil(value*precision-1e-8)/precision:value;
 return n.toFixed(units==='ft'?2:0)+(units==='ft'?' in':' mm');
}
export function requiredComponentWidth(kind,load,settings,group='B'){
 const factor=kind==='stair'?(settings.sprinkler&&settings.voice ? .2 : .3):(settings.sprinkler&&settings.voice ? .15 : .2);
 const minimum=kind==='passage'?0:kind==='door'?32:kind==='corridor'&&group==='E'&&load>=100?72:load<50?36:44;
 return{factor,minimum:minimum*IN,capacityWidth:load*factor*IN,required:Math.max(minimum,load*factor)*IN};
}
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function intersection(a,b,c,d){const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,den=ux*vy-uy*vx;if(Math.abs(den)<1e-10)return null;const t=((c.x-a.x)*vy-(c.y-a.y)*vx)/den,u=((c.x-a.x)*uy-(c.y-a.y)*ux)/den;return t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7?t:null;}
const touches=(path,a,b)=>path.some((q,i)=>i>0&&intersection(path[i-1],q,a,b)!==null);
/** Propose perpendicular sections across opposing parallel boundary runs. No bounding-box width. */
export function corridorSections(points){
 const segments=edges(points),sections=[];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  if(j===i+1||(i===0&&j===segments.length-1))continue;
  const [a,b]=segments[i],[c,d]=segments[j],len=dist(a,b),other=dist(c,d);if(len<.05||other<.05)continue;
  const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len,vx=(d.x-c.x)/other,vy=(d.y-c.y)/other;
  if(ux*vx+uy*vy>-.995)continue; // opposing boundary directions; taper needs measured confirmation
  const tc=(c.x-a.x)*ux+(c.y-a.y)*uy,td=(d.x-a.x)*ux+(d.y-a.y)*uy,lo=Math.max(0,Math.min(tc,td)),hi=Math.min(len,Math.max(tc,td));
  if(hi-lo<.1)continue;
  const offset=(c.x-a.x)*(-uy)+(c.y-a.y)*ux;if(Math.abs(offset)<.05||hi-lo<Math.abs(offset)*.5)continue;
  const count=Math.min(30,Math.max(3,Math.ceil((hi-lo)/1.5)));
  for(let k=0;k<count;k++){
   const t=lo+(hi-lo)*(k+.5)/count,p={x:a.x+ux*t,y:a.y+uy*t},q={x:p.x-uy*offset,y:p.y+ux*offset};
   if(![.2,.5,.8].every(s=>inside({x:p.x+(q.x-p.x)*s,y:p.y+(q.y-p.y)*s},points)))continue;
   sections.push({a:p,b:q,width:Math.abs(offset),point:mid(p,q)});
  }
 }
 return sections;
}
export function clearSectionWidth(section,obstacles){
 const blocked=[];
 for(const o of obstacles){const polygon=o.points||o,ts=[0,1];for(const [a,b] of edges(polygon)){const t=intersection(section.a,section.b,a,b);if(t!==null)ts.push(Math.max(0,Math.min(1,t)));}ts.sort((a,b)=>a-b);for(let i=1;i<ts.length;i++){const t=(ts[i-1]+ts[i])/2;if(inside({x:section.a.x+(section.b.x-section.a.x)*t,y:section.a.y+(section.b.y-section.a.y)*t},polygon))blocked.push([ts[i-1],ts[i]]);}}
 blocked.sort((a,b)=>a[0]-b[0]);let cursor=0,largest=0;for(const [a,b] of blocked){largest=Math.max(largest,a-cursor);cursor=Math.max(cursor,b);}return Math.max(largest,1-cursor)*section.width;
}
function doorPortals(f){const walls=new Map(f.walls.map(w=>[w.id,w]));return f.doors.flatMap(d=>{const w=walls.get(d.wallId);if(!w||!(d.width>0))return[];const n=dist(w.a,w.b);if(n<.001)return[];const dx=(w.b.x-w.a.x)/n*d.width/2,dy=(w.b.y-w.a.y)/n*d.width/2;return[{id:d.id,a:{x:d.x-dx,y:d.y-dy},b:{x:d.x+dx,y:d.y+dy},point:d}];});}
/** Geometry-based distribution, not a code-approved allocation or evacuation simulation. */
export function capacityScenario(p,fi,g,field,loads){
 const f=p.floors[fi],portals=doorPortals(f),paths=[];if(!g||!field)return{paths,unassigned:loads.reduce((n,r)=>n+r.occupants,0),method:'No connected exit routes yet.'};
 const indices=[];for(let i=0;i<g.n;i++)if(g.good[i]&&Number.isFinite(field.d[i]))indices.push(i);indices.sort((a,b)=>field.d[a]-field.d[b]);
 const buckets=new Map();for(const portal of portals){const x0=Math.floor((Math.min(portal.a.x,portal.b.x)-g.minX)/g.step)-1,x1=Math.ceil((Math.max(portal.a.x,portal.b.x)-g.minX)/g.step)+1,y0=Math.floor((Math.min(portal.a.y,portal.b.y)-g.minY)/g.step)-1,y1=Math.ceil((Math.max(portal.a.y,portal.b.y)-g.minY)/g.step)+1;for(let y=Math.max(0,y0);y<=Math.min(g.ny-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(g.nx-1,x1);x++){const i=y*g.nx+x;if(!buckets.has(i))buckets.set(i,[]);buckets.get(i).push(portal);}}
 const first=new Array(g.n);for(const i of indices){const prev=field.prev[i],a=g.point(i),b=prev>=0?g.point(prev):field.targets[field.owner[i]],hits=(buckets.get(i)||[]).map(portal=>({portal,t:intersection(a,b,portal.a,portal.b)})).filter(o=>o.t!==null).sort((a,b)=>a.t-b.t);first[i]=hits[0]?.portal.id||(prev>=0?first[prev]:b.id);}
 let unassigned=0;
 for(const load of loads){if(!load.occupants)continue;const r=f.rooms.find(r=>r.id===load.id),groups=new Map();let samples=0,reachable=0;
  for(let i=0;i<g.n;i++){if(!g.good[i]||!insideRoom(g.point(i),r))continue;samples++;if(!Number.isFinite(field.d[i]))continue;reachable++;const key=first[i]+'|'+field.owner[i];if(!groups.has(key))groups.set(key,{count:0,seed:i});const group=groups.get(key);group.count++;if(field.d[i]>field.d[group.seed])group.seed=i;}
  if(!samples||!reachable){unassigned+=load.occupants;continue;}
  const assigned=Math.round(load.occupants*reachable/samples),list=[...groups.values()].map(o=>({...o,exact:assigned*o.count/reachable}));list.forEach(o=>o.people=Math.floor(o.exact));let remainder=assigned-list.reduce((n,o)=>n+o.people,0);list.sort((a,b)=>(b.exact-b.people)-(a.exact-a.people));for(let i=0;i<remainder;i++)list[i%list.length].people++;
  for(const group of list){if(!group.people)continue;const points=route(g,field,group.seed),target=field.targets[field.owner[group.seed]],doors=new Set(portals.filter(o=>touches(points,o.a,o.b)).map(o=>o.id));if(f.doors.some(d=>d.id===target.id))doors.add(target.id);paths.push({room:load.id,name:load.name,people:group.people,points,doors:[...doors],target:target.id,group:r.group||p.settings.group});}
  unassigned+=load.occupants-assigned;
 }
 return{paths,unassigned,method:'Occupants are distributed by reachable room sample area, grouped by first door and nearest exit. Representative shortest paths identify shared components. This is a design scenario; verify allocations, alternatives and route independence.'};
}
export function analyzeCapacity(p,fi,g,field,loads){
 const f=p.floors[fi],scenario=capacityScenario(p,fi,g,field,loads),rows=[],checks=[],fmt=(x,up=false)=>capacityDimension(x,p.units,up);
 function record(kind,o,served,width,point,extra={}){
  const load=served.reduce((n,r)=>n+r.people,0),group=extra.group||o.group||p.settings.group,rule=requiredComponentWidth(kind,load,p.settings,group),known=!!g&&load>0,measured=Number.isFinite(width)&&width>0;
  const status=measured&&known&&width+1e-6<rule.required?'fail':'review';
  const sources=[...new Set(served.map(r=>r.name))],row={id:o.id,name:o.name||o.link||kind,kind,load,available:measured?width:null,...rule,shortfall:measured&&known?Math.max(0,rule.required-width):null,capacity:measured?Math.floor(width/(rule.factor*IN)):null,status,sources,point,allocationKnown:known,widthSource:extra.widthSource||'entered clear width',...extra};rows.push(row);
  const detail=known?`${load} modeled occupants from ${sources.join(', ')||'the connected rooms'}. ${measured?fmt(width)+' available':'Clear width not measured'}; ${kind==='passage'?fmt(rule.required,true)+' flow-width estimate = '+load+' × '+rule.factor+' in/person; component minimum unverified.':fmt(rule.required,true)+' required = max('+fmt(rule.minimum,true)+' component minimum, '+load+' × '+rule.factor+' in/person).'} ${row.shortfall>0?'Width shortfall '+fmt(row.shortfall,true)+'. Widen this component or revise the program and route allocation. ':''}${row.widthSource==='source drawing estimate'?'Door width is estimated from source jambs, not a confirmed clear opening. ':''}${row.widthSource==='polygon estimate'?'Width is estimated from corridor boundary faces; confirm the actual clear dimension. ':''}Load allocation is a design scenario; confirm room use, area basis and exit alternatives.`:`No reliable served-load allocation yet. ${measured?fmt(width)+' entered/estimated width. ':''}Confirm doors, rooms and connected exits before evaluating capacity; no capacity pass is established.`;
  if(kind==='passage'){row.widthSource='flow-only estimate; component minimum unverified';row.note='This opening has no door leaf. Classify the passage to establish its component minimum.';}
  checks.push({status,title:`${row.name}: ${kind} width / served load`,detail:kind==='passage'?detail+' Open passage: the flow estimate does not establish a component minimum; classify the space and confirm its required clear width.':detail,ref:'IBC 1005.2–1005.3 / '+(kind==='door'?'1010.1.1':kind==='stair'?'1011.2':kind==='passage'?'component identification required':'1020'),point,category:'building'});
 }
 for(const d of f.doors)record(d.openingType==='passage'?'passage':'door',d,scenario.paths.filter(r=>r.doors.includes(d.id)),d.width,d,{widthSource:d.recognition?.autoDetected&&d.widthConfirmed!==true?'source drawing estimate':'entered clear width'});
 for(const s of f.stairs||[])record('stair',s,scenario.paths.filter(r=>r.target===s.id),s.width,s.points[0],{note:'Per-story allocation. Upper floors are not blindly summed for stair sizing; discharge and convergence require a separate check.'});
 const corridors=f.rooms.filter(r=>r.role==='corridor');
 for(const c of corridors){
  const served=scenario.paths.filter(r=>r.points.some(q=>inside(q,c.points))),total=served.reduce((n,r)=>n+r.people,0),group=c.group||p.settings.group,sections=corridorSections(c.points),minimum=requiredComponentWidth('corridor',total,p.settings,group).minimum;
  const obstacles=[...(f.obstacles||[]),...featureObstacles(f),...excludedSpaces(f),...floorOpenings(p,fi)];
  const candidates=sections.map(s=>{const clear=clearSectionWidth(s,obstacles),crossing=served.filter(r=>touches(r.points,s.a,s.b)),load=crossing.reduce((n,r)=>n+r.people,0),width=c.clearWidth>0?Math.min(c.clearWidth,clear):clear,rule=requiredComponentWidth('corridor',load,p.settings,group);return{...s,crossing,load,width,required:Math.max(minimum,rule.required)};});
  // The controlling cross-section carries its actual scenario share, not the sum of every branch.
  candidates.sort((a,b)=>(a.width-a.required)-(b.width-b.required));const critical=candidates[0];
  if(critical){record('corridor',c,critical.crossing,critical.width,critical.point,{group,widthSource:c.clearWidth>0?'measured / boundary-limited':'polygon estimate',corridorServed:total,sources:[...new Set(served.map(r=>r.name))],minimum,required:critical.required});const row=rows.at(-1);row.shortfall=Math.max(0,row.required-row.available);if(total>0&&row.shortfall>1e-6){row.status='fail';checks.at(-1).status='fail';}checks.at(-1).detail=`Corridor serves ${total} modeled occupants from ${[...new Set(served.map(r=>r.name))].join(', ')||'unresolved rooms'}; this section carries ${critical.load}. ${fmt(row.available)} available / ${fmt(row.required,true)} required (minimum ${fmt(minimum,true)}; flow factor ${row.factor} in/person). ${row.shortfall>0?'Short by '+fmt(row.shortfall,true)+'. Widen the corridor or revise room use / route allocation. ':''}Boundary-based width estimate; confirm clear faces, furniture and door encroachments. ${scenario.unassigned?'Some room loads are unassigned, so this is a lower-bound flow estimate. ':''}Review the modeled allocation.`;}
  else record('corridor',c,served,c.clearWidth||null,c.points[0],{group,widthSource:c.clearWidth>0?'entered clear width':'not measurable from parallel boundaries',corridorServed:total});
 }
 if(loads.some(r=>r.occupants)&&!corridors.length)checks.push({status:'review',title:'Identify circulation corridors for width checks',detail:'Mark each corridor with Spatial type → corridor. Its serving rooms and bottleneck width will then appear in the report. An unmodeled corridor has not passed a width check.',ref:'IBC 1005 / 1020',category:'building'});
 if(scenario.unassigned)checks.push({status:'review',title:`${scenario.unassigned} occupants have no allocated egress route`,detail:'Resolve missing or disconnected doors and exits. Component loads may be understated until every occupied room connects.',ref:'IBC 1005 / 1016',category:'building'});
 if(p.floors.length>1)checks.push({status:'review',title:'Multi-floor discharge and convergence allocation',detail:'Component loads here are per story. Verify shared discharge doors/corridors and convergence from upper and lower stories separately; upper-story occupants are not included automatically in ground-floor discharge loads.',ref:'IBC 1005.3.1 / 1005.6 / 1028',category:'building'});
 return{rows,checks,unassigned:scenario.unassigned,method:scenario.method};
}
