/* Course-specific member geometry. Connection details and wall openings remain schematic.
   Source-selected sections retain exact outside dimensions, topping and tee stem widths. */
(function(W){'use strict';const M=W.ConcreteBuildingData,C=M.palette;
const depth=(s,level)=>(M.validChoice(s,level)?.depth||(M.layout(s).p.family==='DT'?20:10))/12;
const top=(s,level,x)=>level==='roof'?M.roofY(s,x):14;
function profile(s,key){const c=M.validChoice(s,key),family=c?.family||'R',h=(c?.depth||24)/12,w=c?.width||(family==='T'?28:family==='L'?18:12)/12,base=(c?.h2In||12)/12,web=(c?.webWidthIn||12)/12;return {c,family,h,w,base,web};}
function beamBottom(s,level,line,x){const p=profile(s,level+'Beam-'+line.id);return top(s,level,x)-depth(s,level)-(p.family==='R'?p.h:p.base);}
function verticalWeight(s,support){const line=M.supportLines(s).find(l=>l.id===support.line),t=line.axis==='z'?support.z:support.x,h=beamBottom(s,'roof',line,support.x),th=s.wallThickness/12;
 if(line.kind==='portal')return (3*h+2*(8-3)*2)*th*150;
 const w=s.columnSize/12,ends=(t>0?1:0)+(t<line.length?1:0);return (w*w*(top(s,'roof',support.x)-depth(s,'roof'))+ends*2*.75*w*1)*150;
}
function scene(s,selected,opts={}){
 const section=opts.section||s.section,sectionAt=opts.sectionAt??48;
 const clip=pts=>{const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],ai=a[2]<=sectionAt+1e-8,bi=b[2]<=sectionAt+1e-8;if(ai)out.push(a);if(ai!==bi){const t=(sectionAt-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>v+t*(b[k]-v)));}}return out;};
 const calc=M.calc(s),l=calc.layout,lines=M.supportLines(s),items=[],objects=new Map(),selectedCells=Object.fromEntries(['roof','floor',...M.beamRoles(s).map(r=>r.key)].map(k=>[k,M.validChoice(s,k)]));
 const typical=calc.supports.find(x=>x.id===s.typicalSupport)||calc.supports[Math.floor(calc.supports.length/2)],tributary=opts.tributary??s.lesson==='concrete-tributary';
 const relevant=new Set();if(tributary&&typical){relevant.add('vertical-'+typical.id);for(const level of ['roof','floor'])for(const b of calc[level].beams.filter(b=>b.line===typical.line&&(b.t===(lines.find(a=>a.id===b.line).axis==='z'?typical.z:typical.x)||b.end===(lines.find(a=>a.id===b.line).axis==='z'?typical.z:typical.x)))){relevant.add(b.id);b.loads.forEach(a=>relevant.add(level+':'+a.panel));}}
 const explode=tributary?s.explode:0;
 const allowed=(id,kind,stage)=>stage<=s.stage&&(s.layer==='all'||s.layer===kind)&&(!tributary||!typical||relevant.has(id)||id==='raft');
 const register=(id,kind,stage,key,supports=[])=>{if(!objects.has(id))objects.set(id,{id,kind,stage,key,supports,sourceCell:selectedCells[key]?.id||null});};
 function face(id,points,color,kind,stage,key,supports=[]){if(section)points=clip(points);if(points.length<3)return;if(!allowed(id,kind,stage))return;register(id,kind,stage,key,supports);const lift=explode*(stage===7?3:stage===6?2.5:stage===5?1.5:stage===3?1:0);items.push({type:'poly',id,points:points.map(p=>[p[0],p[1]+lift,p[2]]),color,alpha:1,edges:['roof','floor'].includes(key)&&points.every(p=>Math.abs(p[1]-top(s,key,p[0]))<.001),shadowBias:.08,stroke:'#77836e',stage,kind,tableKey:key,sourceCell:selectedCells[key]?.id||null});}
 function prism(id,a,b,profile,color,kind,stage,key,supports){const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,n=[-dz/len,0,dx/len],ends=[a,b].map(o=>profile.map(([u,y])=>[o[0]+n[0]*u,o[1]+y+(key==='roof'?n[0]*u*Math.tan(s.slope*Math.PI/180):0),o[2]+n[2]*u]));if(section){const hits=[];for(const ring of ends)for(let i=0;i<ring.length;i++)intersect(ring[i],ring[(i+1)%ring.length]);for(let i=0;i<ends[0].length;i++)intersect(ends[0][i],ends[1][i]);function intersect(a,b){if((a[2]-sectionAt)*(b[2]-sectionAt)<0){const t=(sectionAt-a[2])/(b[2]-a[2]),p=a.map((v,k)=>v+t*(b[k]-v));if(!hits.some(q=>Math.hypot(...q.map((v,k)=>v-p[k]))<1e-6))hits.push(p);}}if(hits.length>=3){const cx=hits.reduce((a,p)=>a+p[0],0)/hits.length,cy=hits.reduce((a,p)=>a+p[1],0)/hits.length;hits.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));face(id,hits,'#4b5960',kind,stage,key,supports);}}face(id,ends[0].slice().reverse(),color,kind,stage,key,supports);face(id,ends[1],color,kind,stage,key,supports);for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length;face(id,[ends[0][i],ends[0][j],ends[1][j],ends[1][i]],color,kind,stage,key,supports);}}
 const rect=(id,a,b,w,h,color,kind,stage,key,supports)=>prism(id,a,b,[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],color,kind,stage,key,supports);
 const box=(id,x,z,dx,dz,y0,y1,color,kind,stage,key,supports)=>rect(id,[x,(y0+y1)/2,z+dz/2],[x+dx,(y0+y1)/2,z+dz/2],dz,y1-y0,color,kind,stage,key,supports);
 const label=(text,p)=>items.push({type:'label',text,p,color:'#eee'});
 const line=(a,b,color='#9faeb4',id)=>items.push({type:'line',a,b,color,width:1,id});
 const arrow=(a,b)=>items.push({type:'arrow',a,b,color:'#fff0a5',width:2.5});
 const pos=(line,t,y)=>M.position(line,t,y);
 const segment=(id,line,t0,t1,y0,y1,th,color,stage=2,key='walls')=>rect(id,pos(line,t0,(y0+y1)/2),pos(line,t1,(y0+y1)/2),th,y1-y0,color,'vertical',stage,key,['raft']);
 const raft=tributary&&typical?{x:Math.max(0,typical.x-7),z:Math.max(0,typical.z-10),dx:Math.min(14,60-Math.max(0,typical.x-7)),dz:Math.min(20,120-Math.max(0,typical.z-10))}:{x:0,z:0,dx:60,dz:120};
 box('raft',raft.x,raft.z,raft.dx,raft.dz,-calc.use.raft/12,0,C.raft,'vertical',1,'raft');
 if(!tributary)box('main-topping',0,0,60,120,0,2/12,C.floor,'deck',1,'raft');
 for(const lineData of lines){
  const q=lineData,th=s.wallThickness/12;
  if(q.kind==='wall'){
   const mod=s.prototype==='ALPHA'?8:l.width===10?10:8;
   for(let t=0;t<q.length;t+=mod){const end=Math.min(t+mod,q.length),a=pos(q,t),b=pos(q,end),h0=top(s,'roof',a[0])-depth(s,'roof'),h1=top(s,'roof',b[0])-depth(s,'roof'),h=Math.min(h0,h1),id=`wall-${q.id}-${t}`,solid=s.prototype==='ALPHA'&&s.alphaWall==='solid';
    if(solid)segment(id,q,t+.025,end-.025,0,h,th,C.wall);
    else {const leg=Math.min(1.5,(end-t)/4);segment(id,q,t+.025,t+leg,0,h,th,C.wall);segment(id,q,end-leg,end-.025,0,h,th,C.wall);segment(id,q,t+leg,end-leg,0,1,th,C.wall);segment(id,q,t+leg,end-leg,10,14-depth(s,'floor'),th,C.wall);segment(id,q,t+leg,end-leg,h-2.5,h,th,C.wall);}
    if(Math.abs(h1-h0)>.001)prism(id,[a[0],0,a[2]],[b[0],h1-h0,b[2]],[[-th/2,h0-.2],[th/2,h0-.2],[th/2,h0],[-th/2,h0]],C.wall,'vertical',2,'walls',['raft']);
   }
   // Floor and roof bearing ledges are integral wall features, never independent beams.
   for(const level of ['floor','roof'])for(const p of l.panels){const at=l.axis==='x'?p.x:p.z;if(at!==q.coord&&at+p.span!==q.coord||M.removed(s,level).has(p.id))continue;const side=at===q.coord?1:-1,loc=q.axis==='z'?p.z:p.x,offsets=l.p.family==='DT'?[l.width/4,l.width*3/4]:[l.width/2];for(const o of offsets){const pt=pos(q,loc+o),y=top(s,level,pt[0])-depth(s,level),a=pos(q,loc+o-.4,y-.4),b=pos(q,loc+o+.4,y-.4),axis=q.axis==='z'?0:2;a[axis]+=side*(th/2+.3);b[axis]+=side*(th/2+.3);rect('wall-seat-'+level+'-'+q.id+'-'+loc+'-'+o,a,b,.6,.8,C.haunch,'vertical',2,'walls',[`wall-${q.id}-${Math.floor(loc/(s.prototype==='ALPHA'?8:l.width===10?10:8))*(s.prototype==='ALPHA'?8:l.width===10?10:8)}`]);}}
  }else{
   if(!q.step){if(!tributary){for(const y of [14,28])line(pos(q,0,y),pos(q,q.length,y),'#efb768');label('DELTA · beam spacing not specified',pos(q,q.length/2,30));}continue;}
   const ts=[...new Set(M.segments(q).flatMap(a=>[a.t,a.end]))];
   for(const t of ts){const p=pos(q,t),id='vertical-'+q.id+'@'+t,h=top(s,'roof',p[0])-depth(s,'roof'),w=s.columnSize/12;
    if(q.kind==='column'){
     box(id,p[0]-w/2,p[2]-w/2,w,w,0,h,C.column,'vertical',2,'columns',['raft']);
     for(const level of ['floor','roof'])for(const sign of [-1,1])if(t+sign*.75>0&&t+sign*.75<q.length){const y=beamBottom(s,level,q,p[0]);segment(id,q,t+sign*w/2+(sign<0?-.75:0),t+sign*w/2+(sign>0?.75:0),y-1,y,w,C.haunch,2,'columns');}
    }else{
     // A single continuous, two-storey portal panel: no independent columns hidden inside it.
     const lo=p[0]===0?0:p[0]===60?52:p[0]-4,portal={axis:'x',coord:p[2]},hh=beamBottom(s,'roof',q,p[0]);
     segment(id,portal,lo,lo+1.5,0,hh,th,C.wall,2,'walls');segment(id,portal,lo+6.5,lo+8,0,hh,th,C.wall,2,'walls');
     for(const level of ['floor','roof']){const y=beamBottom(s,level,q,p[0]);segment(id,portal,lo+1.5,lo+6.5,y-2,y,th,C.wall,2,'walls');}
    }
   }
   for(const level of ['floor','roof']){if(level==='roof'&&!s.showRoof)continue;const key=level+'Beam-'+q.id,p=profile(s,key),stage=level==='floor'?3:6;
    for(const seg of M.segments(q)){const id=`${level}-beam-${q.id}-${seg.t}`,trim=q.kind==='column'?s.columnSize/24+.04:.04,ta=seg.t+trim,tb=seg.end-trim,pa=pos(q,ta),pb=pos(q,tb),a=pos(q,ta,top(s,level,pa[0])-depth(s,level)),b=pos(q,tb,top(s,level,pb[0])-depth(s,level)),deps=['vertical-'+q.id+'@'+seg.t,'vertical-'+q.id+'@'+seg.end];
     if(p.family==='R')prism(id,a,b,[[-p.w/2,-p.h],[p.w/2,-p.h],[p.w/2,0],[-p.w/2,0]],C.beam,'beams',stage,key,deps);
     else {
      const signs=p.family==='L'?(q.sides===2?[-1,1]:[q.coord===0?1:-1]):[0];
      for(const sign of signs){const orient=q.axis==='z'?-1:1,offset=q.sides===2&&p.family==='L'?sign*p.web/2:0;
       const web=offset*orient,left=p.family==='T'?-p.w/2:Math.min(web-p.web/2,web+sign*orient*(p.w-p.web/2)),right=p.family==='T'?p.w/2:Math.max(web+p.web/2,web+sign*orient*(p.w-p.web/2));
       prism(id,a,b,[[left,-p.base],[right,-p.base],[right,0],[left,0]],C.beam,'beams',stage,key,deps);
       prism(id,a,b,[[web-p.web/2,0],[web+p.web/2,0],[web+p.web/2,p.h-p.base],[web-p.web/2,p.h-p.base]],C.beam,'beams',stage,key,deps);
      }
     }
    }
   }
  }
 }
 // Four explicitly tagged shear panels. These are schematic lateral members, not a lateral-strength check.
 if(!tributary){for(const z of [0,120])segment('shear-X-'+z,{axis:'x',coord:z},22,30,0,Math.min(top(s,'roof',22),top(s,'roof',30))-depth(s,'roof'),s.wallThickness/12,C.wall);
  for(const x of [0,60]){const existing=lines.find(q=>q.axis==='z'&&q.coord===x&&q.kind==='wall');if(existing){const first=[...objects.values()].find(o=>o.id.startsWith('wall-'+existing.id+'-'));if(first)first.shear='Z';}else segment('shear-Z-'+x,{axis:'z',coord:x},56,64,0,top(s,'roof',x)-depth(s,'roof'),s.wallThickness/12,C.wall);}}
 for(const core of l.cores){if(tributary)continue;const {x,z}=core;if(core.type==='elevator'){for(const[a,b]of [[[x,z],[x+core.dx,z]],[[x,z],[x,z+core.dz]],[[x+core.dx,z],[x+core.dx,z+core.dz]]])rect('elevator-wall',[a[0],7,a[1]],[b[0],7,b[1]],s.wallThickness/12,14,C.wall,'vertical',2,'walls',['raft']);label('LIFT · '+Math.round(core.dx*core.dz)+' sf',[x+core.dx/2,15,z+core.dz/2]);continue;}
  const run=11*11/12,h=s.stairThickness/12,id=core.id;
  box(id+'-support',x,z+4+run,8.5,.5,0,7-h,C.wall,'vertical',2,'walls',['raft']);
  for(const xx of [x+4.5,x+8.5])box(id+'-support',xx-.2,z,.4,4,0,14-h,C.wall,'vertical',2,'walls',['raft']);
  rect(id+'-flight-1',[x+2,-h/2,z+4],[x+2,7-h/2,z+4+run],4,h,C.stair,'stairs',4,'stairs',[id+'-support']);
  rect(id+'-flight-2',[x+6.5,7-h/2,z+4+run],[x+6.5,14-h/2,z+4],4,h,C.stair,'stairs',4,'stairs',[id+'-support']);
  box(id+'-mid',x,z+4+run,8.5,4,7-h,7,C.stair,'stairs',4,'landings',[id+'-support']);box(id+'-top',x+4.5,z,4,4,14-h,14,C.stair,'stairs',4,'landings',[id+'-support']);
  // A separately supported access landing joins the retained floor without cutting a precast unit.
  const landing={x:x+4.5,z,dx:4,dz:4},routes=[];
  for(const p of l.panels.filter(p=>!M.removed(s,'floor').has(p.id))){
   if(p.z<=landing.z&&p.z+p.dz>=landing.z+4){if(p.x>=landing.x+4)routes.push({x:landing.x+4,z,dx:p.x-landing.x-4,dz:4});if(p.x+p.dx<=landing.x)routes.push({x:p.x+p.dx,z,dx:landing.x-p.x-p.dx,dz:4});}
   if(p.x<=landing.x&&p.x+p.dx>=landing.x+4){if(p.z>=z+4)routes.push({x:landing.x,z:z+4,dx:4,dz:p.z-z-4});if(p.z+p.dz<=z)routes.push({x:landing.x,z:p.z+p.dz,dx:4,dz:z-p.z-p.dz});}
  }
  routes.sort((a,b)=>a.dx*a.dz-b.dx*b.dz);const access=routes[0];if(access&&access.dx*access.dz>.01){box(id+'-access',access.x,access.z,access.dx,access.dz,14-h,14,C.stair,'stairs',4,'landings',[id+'-access-wall']);if(access.dz===4)for(const zz of [access.z,access.z+4])box(id+'-access-wall',access.x,zz-.2,access.dx,.4,0,14-h,C.wall,'vertical',2,'walls',['raft']);else for(const xx of [access.x,access.x+4])box(id+'-access-wall',xx-.2,access.z,.4,access.dz,0,14-h,C.wall,'vertical',2,'walls',['raft']);}
  for(let i=0;i<11;i++){box(id+'-flight-1',x,z+4+i*11/12,4,11/12,i*7/12,(i+1)*7/12,C.stair,'stairs',4,'stairs');box(id+'-flight-2',x+4.5,z+4+(10-i)*11/12,4,11/12,7+i*7/12,7+(i+1)*7/12,C.stair,'stairs',4,'stairs');}
 }
 for(const level of ['floor','roof']){
  if(tributary)continue;
  if(level==='roof'&&!s.showRoof||opts.plan&&level!==s.planLevel)continue;const selectedCell=M.validChoice(s,level),stage=level==='floor'?5:7,d=depth(s,level),topping=(level==='floor'?2:s.roofTopping)/12,baseDepth=d-topping;
  for(const p of l.panels){const id=level+':'+p.id,voided=M.removed(s,level).has(p.id),spanAxis=l.axis==='x'?0:2,at=p[l.axis==='x'?'x':'z'],q0=lines.find(a=>a.coord===at),q1=lines.find(a=>a.coord===at+p.span),cut=q=>q.kind==='wall'?s.wallThickness/24:profile(s,level+'Beam-'+q.id).family==='R'?.02:profile(s,level+'Beam-'+q.id).web*(profile(s,level+'Beam-'+q.id).family==='L'&&q.sides===2?1:.5)+.04;
   const a=l.axis==='x'?[p.x,0,p.z+p.dz/2]:[p.x+p.dx/2,0,p.z],b=l.axis==='x'?[p.x+p.dx,0,p.z+p.dz/2]:[p.x+p.dx/2,0,p.z+p.dz];a[spanAxis]+=cut(q0);b[spanAxis]-=cut(q1);a[1]=top(s,level,a[0]);b[1]=top(s,level,b[0]);
   if(voided){if(!tributary&&stage<=s.stage){const pts=[[p.x,top(s,level,p.x),p.z],[p.x+p.dx,top(s,level,p.x+p.dx),p.z],[p.x+p.dx,top(s,level,p.x+p.dx),p.z+p.dz],[p.x,top(s,level,p.x),p.z+p.dz]];for(let i=0;i<4;i++)line(pts[i],pts[(i+1)%4],'#f1d59c',id);}continue;}
   const deps=[q0.kind==='wall'?'wall-'+q0.id:level+'Beam-'+q0.id,q1.kind==='wall'?'wall-'+q1.id:level+'Beam-'+q1.id];
   if(l.p.family==='DT'){
    const flange=2/12;prism(id,a,b,[[-p.width/2+.02,-topping-flange],[p.width/2-.02,-topping-flange],[p.width/2-.02,0],[-p.width/2+.02,0]],C[level],'deck',stage,level,deps);
    for(const o of [-p.width/4,p.width/4])prism(id,a,b,[[o-3.75/24,-d],[o+3.75/24,-d],[o+5.75/24,-topping-flange],[o-5.75/24,-topping-flange]],C[level],'deck',stage,level,deps);
   }else{
    // Rectangular core voids are a display simplification; PDF preserves the exact circular profile.
    const skin=1/12,n=baseDepth<=.51?8:6,web=.7/12;
    for(const[y0,y1]of [[-d,-d+skin],[-topping-skin,0]])prism(id,a,b,[[-2+.02,y0],[2-.02,y0],[2-.02,y1],[-2+.02,y1]],C[level],'deck',stage,level,deps);
    for(let j=0;j<=n;j++){const u=-2+j*4/n,w=j===0||j===n?web/2:web;prism(id,a,b,[[u-w/2,-d+skin],[u+w/2,-d+skin],[u+w/2,-topping-skin],[u-w/2,-topping-skin]],C[level],'deck',stage,level,deps);}
   }
  }
 }
 // Influence-area patches account exactly for each deck-to-beam-to-support reaction.
 // These surfaces describe load allocation; they are not physical cuts in precast members.
 if(tributary&&typical){for(const level of ['roof','floor'])for(const b of calc[level].beams){const q=lines.find(x=>x.id===b.line),t=q.axis==='z'?typical.z:typical.x;if(b.line!==typical.line||t!==b.t&&t!==b.end)continue;const left=t===b.t;for(const a of b.loads){const p=l.panels.find(p=>p.id===a.panel),f=u=>left?1-u/b.length:u/b.length,d0=p.span/2*f(a.lo),d1=p.span/2*f(a.hi),lo=b.t+a.lo,hi=b.t+a.hi,coord=u=>{const v=pos(q,u);v[1]=top(s,level,v[0]);return v;},p0=coord(lo),p1=coord(hi),p2=coord(hi),p3=coord(lo),axis=q.axis==='z'?0:2;p2[axis]+=a.side*d1;p3[axis]+=a.side*d0;for(const pp of [p2,p3])pp[1]=top(s,level,pp[0]);face(level+':'+p.id,[p0,p1,p2,p3],C[level],'deck',level==='roof'?7:5,level,[b.id]);}}
  label('SHADED AREA = REACTION / AREA LOAD',[typical.x,42+explode,typical.z]);}
 if(!tributary&&s.showGrid&&!section){const xs=M.coordinates(l.grid.x),zs=M.coordinates(l.grid.z),y=opts.plan?35.5:.2;xs.forEach((x,i)=>{line([x,y,-3],[x,y,123]);label(String.fromCharCode(65+i),[x,y,-6]);if(i)label(Number((x-xs[i-1]).toFixed(3))+' ft',[(x+xs[i-1])/2,y,-3]);});zs.forEach((z,i)=>{line([-3,y,z],[63,y,z]);label(String(i+1),[-5,y,z]);if(i)label(Number((z-zs[i-1]).toFixed(3))+' ft',[-8,y,(z+zs[i-1])/2]);});label('60 × 120 ft nominal footprint',[30,y,-12]);}
 if(tributary&&typical){for(const level of ['roof','floor']){const y=top(s,level,typical.x)+(level==='roof'?explode*3:explode*1.5);arrow([typical.x,y+4,typical.z],[typical.x,y,typical.z]);label(level.toUpperCase()+' → '+(typical[level]===null?'pending':(typical[level]/1000).toFixed(2)+' kip'),[typical.x+5,y+4,typical.z]);}arrow([typical.x,10,typical.z],[typical.x,0,typical.z]);label('PORTION OF CONTINUOUS RAFT',[raft.x+raft.dx/2,-calc.use.raft/12-2,raft.z]);}
 if(opts.people&&!tributary){for(const [x,z,dx,dz]of [[-10,-10,10,140],[60,-10,10,140],[0,-10,60,10],[0,120,60,10]])box('grade-context',x,z,dx,dz,-.72,-8/12,'#92968e','people',1,'grade');for(const [i,x,z]of [[1,-4,43],[2,-5,70],[3,-4,102]]){const id='scale-person-'+i,col='#e0e4db',base=-8/12;box(id,x-.25,z-.25,.5,.5,base+4.75,base+5.5,col,'people',1,'scale');box(id,x-.45,z-.18,.9,.36,base+2.45,base+4.65,col,'people',1,'scale');for(const dx of [-.27,.27])box(id,x+dx-.12,z-.12,.24,.24,base,base+2.45,col,'people',1,'scale');for(const dx of [-.58,.58])rect(id,[x+dx,base+4.5,z],[x+dx,base+2.75,z],.18,.18,col,'people',1,'scale');}}

 if(section){label('SECTION A–A · Z = '+sectionAt+' ft',[30,39,sectionAt]);label('2ND FLOOR +14 ft',[66,14,sectionAt]);label('TOP OF MAT +8 in ABOVE GRADE',[30,0,sectionAt]);line([-5,-8/12,sectionAt],[66,-8/12,sectionAt]);label('MAT '+calc.use.raft+' in',[66,-2,sectionAt]);}

 // The viewport may preview unresolved solids; evidence/OBJ export still includes only selected members.
 let visibleItems=items;
 if(opts.progressive&&W.ConcreteParametric){const bounds=new Map();visibleItems=[];for(const item of items){if(item.type!=='poly'||W.ConcreteParametric.memberReady(s,item.tableKey)){visibleItems.push(item);continue;}const obj=objects.get(item.id);if(obj)obj.pending=true;if(!s.showGuides)continue;if(opts.previewPending){visibleItems.push({...item,pending:true,preview:true,color:'#c8bdab',stroke:'#a07c47',alpha:1,material:'concrete'});continue;}let b=bounds.get(item.id);if(!b){b={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity],item};bounds.set(item.id,b);}for(const p of item.points)for(let k=0;k<3;k++){b.lo[k]=Math.min(b.lo[k],p[k]);b.hi[k]=Math.max(b.hi[k],p[k]);}}for(const {lo,hi,item}of bounds.values()){const corners=Array.from({length:8},(_,i)=>[i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]]);for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))visibleItems.push({type:'line',id:item.id,a:corners[i],b:corners[i|bit],color:'#88959e',width:.6,tableKey:item.tableKey,pending:true});}}
 return {items:visibleItems,objects:[...objects.values()],center:section?[30,16,sectionAt]:tributary&&typical?[typical.x,17+explode,typical.z]:[30,13,60],extent:section?85:tributary?90:145,plane:opts.section||s.section?'elevation':'plan',selected};
}
W.ConcreteGeometry={scene,profile,verticalWeight};M.scene=scene;
})(typeof window!=='undefined'?window:globalThis);
