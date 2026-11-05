/* Lecture 10 teaching model. Source values are discrete, not interpolated. */
(function(root){
'use strict';
const uses={office:{label:'Office · Ypsilanti',live:65},grocery:{label:'Grocery · Pinconning',live:75},library:{label:'Library · Houghton',live:150}};
const source='steel-sources/Lecture_10_STEEL_FLOOR_LATERAL.pdf';
const spans=[6,6.5,7,7.5,8,8.5,9,10,11];
// p48: 1.5CD/1.5CDI, 3.5 in TOTAL slab depth, 145 pcf concrete, f'c = 3 ksi.
const deck={22:{weight:1.63,loads:[294,246,207,176,151,130,113,85,65],construction:{single:5.75,double:6.75,triple:6+10/12}},20:{weight:1.98,loads:[354,297,251,215,185,160,139,106,82],construction:{single:6.75,double:8,triple:8+1/12}},18:{weight:2.62,loads:[400,386,328,281,243,212,185,139,105],construction:{single:8+4/12,double:9+8/12,triple:9+11/12}},16:{weight:3.30,loads:[400,400,400,349,301,251,212,154,116],construction:{single:9+8/12,double:10.75,triple:11+1/12}}};
const concepts=[{id:'floor-system',title:'Steel Floor',short:'Floor system',page:11},{id:'floor-members',title:'Beams, girders & columns',short:'Members',page:18},{id:'floor-lateral',title:'Steel Lateral',short:'Lateral system',page:90},{id:'floor-continuity',title:'Openings & continuity',short:'Continuity',page:104}];
const steps=[{id:'floor-brief',title:'Connect the roof and floor brief',short:'Shared brief',page:25},{id:'floor-layout',title:'Read the floor option',short:'Layout',page:29},{id:'floor-deck',title:'Two checks for composite deck',short:'Deck table',page:48},{id:'floor-beam',title:'Area load → beam line load',short:'W beam',page:64},{id:'floor-girder',title:'Beam reactions → girder point loads',short:'W girder',page:67},{id:'floor-column',title:'Roof + floor → shared columns',short:'Columns',page:84},{id:'floor-evidence',title:'Explain and record your decisions',short:'Evidence',page:85}];
const all=[...concepts,...steps],isFloor=id=>all.some(l=>l.id===id),lecture=id=>concepts.some(l=>l.id===id)?2:steps.some(l=>l.id===id)?2.1:null;
function defaults(){return {version:5,roofVisible:true,elevation:12.25,bridge:false,bridgeWidth:8,modelScope:'building',geometryKey:'',roofBasis:'',briefConfirmed:false,conceptLesson:'floor-system',assignmentLesson:'floor-brief',panel:'model',mode:'3d',option:'R',familyAtChoice:'',optionChosen:false,beamSpan:30,girderSpan:20,spaces:3,layoutConfirmed:false,gauge:20,continuity:'triple',bearing:0,sides:1,beamWeight:0,girderWeight:0,beamName:'',girderName:'',brace:'central',wind:'x',opening:false,layer:'all',notes:{},basis:'',reviewed:{}};}
function normalize(raw={}){const d=defaults(),s={...d,...raw};const number=(k,min,max)=>s[k]=Math.max(min,Math.min(max,Number.isFinite(+s[k])?+s[k]:d[k]));['beamSpan','girderSpan'].forEach(k=>number(k,5,80));number('elevation',10,18);number('bridgeWidth',4,16);s.bridge=s.bridge===true;s.roofVisible=s.roofVisible!==false;number('spaces',2,6);s.spaces=Math.round(s.spaces);number('bearing',0,24);number('beamWeight',0,300);number('girderWeight',0,500);s.gauge=[16,18,20,22].includes(+s.gauge)?+s.gauge:20;s.sides=+s.sides===2?2:1;for(const [k,opts]of Object.entries({option:'P Q R S T U V W',continuity:'single double triple',brace:'central corners none',wind:'x z',modelScope:'building bay',panel:'model explain',mode:'2d 3d',layer:'all deck beam girder column brace'}))if(!opts.split(' ').includes(s[k]))s[k]=d[k];s.conceptLesson=concepts.some(l=>l.id===s.conceptLesson)?s.conceptLesson:d.conceptLesson;s.assignmentLesson=steps.some(l=>l.id===s.assignmentLesson)?s.assignmentLesson:d.assignmentLesson;for(const k of ['briefConfirmed','optionChosen','layoutConfirmed','opening'])s[k]=s[k]===true;for(const k of ['beamName','girderName','basis','familyAtChoice','geometryKey','roofBasis'])s[k]=typeof s[k]==='string'?s[k].slice(0,150):'';s.notes=Object.fromEntries(Object.entries(s.notes&&typeof s.notes==='object'?s.notes:{}).filter(([k,v])=>isFloor(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,4000)]));s.reviewed=s.reviewed&&typeof s.reviewed==='object'?s.reviewed:{};return s;}
function signature(roof,s){return [roof.family,roof.use,s.option,s.beamSpan,s.girderSpan,s.spaces,s.gauge,s.continuity,s.bearing,s.sides,s.beamWeight,s.girderWeight,s.beamName,s.girderName,s.elevation,s.bridge,s.bridgeWidth].join('|');}
function calc(roof,s){s=normalize(s);const live=(uses[roof.use]||uses.library).live,spacing=s.girderSpan/s.spaces,dead=15+31+deck[s.gauge].weight,q=live+dead,w=q*spacing+s.beamWeight,wl=live*spacing,R=w*s.beamSpan/2000,P=R*s.sides,points=Array.from({length:s.spaces-1},(_,i)=>({x:(i+1)*spacing,kips:P}));const clear=Math.max(0,spacing-s.bearing/12),index=spans.findIndex(n=>n>=clear-1e-9),capacity=index<0?null:deck[s.gauge].loads[index],superimposed=live+15,construction=deck[s.gauge].construction[s.continuity];const girderReaction=(points.reduce((n,p)=>n+p.kips,0)+s.girderWeight*s.girderSpan/1000)/2;
return {live,dead,q,spacing,w,wl,R,P,points,clear,tableSpan:index<0?null:spans[index],capacity,superimposed,construction,clearValid:spacing>s.bearing/12,constructionOK:spacing>s.bearing/12&&clear<=construction+1e-9,serviceOK:spacing>s.bearing/12&&capacity!==null&&superimposed<=capacity,girderReaction,boundaryReaction:(q*spacing/2+s.beamWeight)*s.beamSpan/2000*s.sides,columnFloorReaction:girderReaction+(q*spacing/2+s.beamWeight)*s.beamSpan/2000*s.sides,pattern:({2:'One midspan point load',3:'Two equal third-point loads',4:'Three equal quarter-point loads'})[s.spaces]||'Multiple discrete point loads',basisCurrent:s.basis===signature(roof,s)};}
function scene(roof,s,id){const c=calc(roof,s),lateral=['floor-lateral','floor-continuity'].includes(id),G=s.girderSpan,L=s.beamSpan,Y=12,items=[],color={deck:'#9cbbc5',beam:'#cf7a42',girder:'#4b8097',column:'#536775',brace:'#ab5551'},focus=s.layer;
const beam=(a,b,kind,w=.28,h=.8)=>{if(focus==='all'||focus===kind)items.push({type:'beam',a,b,w,h,color:color[kind],id:kind});},line=(a,b,kind)=>{if(focus==='all'||focus===kind)items.push({type:'line',a,b,color:color[kind],width:2,id:kind});},label=(p,text)=>items.push({type:'label',p,text,color:'#33434a'});
const cols=lateral?[0,G,2*G,3*G]:[0,G],maxX=lateral?3*G:G;
for(const x of cols)for(const z of [0,L])beam([x,0,z],[x,lateral?24:Y,z],'column',.45,.45);
for(const y of (lateral?[12,24]:[12])){
 for(const z of [0,L])beam([0,y-.55,z],[maxX,y-.55,z],'girder',.38,1.1);
 for(let bay=0;bay<(lateral?3:1);bay++)for(let j=0;j<=s.spaces;j++)beam([bay*G+j*c.spacing,y-.4,0],[bay*G+j*c.spacing,y-.4,L],'beam',.24,.8);
 if(focus==='all'||focus==='deck'){
  const slab=(x0,x1,z0,z1)=>items.push({type:'poly',points:[[x0,y+.06,z0],[x1,y+.06,z0],[x1,y+.06,z1],[x0,y+.06,z1]],color:color.deck,alpha:.28,id:'deck'});
  if(s.opening&&lateral){slab(0,G,0,L);slab(2*G,maxX,0,L);slab(G,2*G,0,L*.33);slab(G,2*G,L*.67,L);for(const z of [L*.33,L*.67])beam([G,y-.4,z],[2*G,y-.4,z],'beam');}else slab(0,maxX,0,L);
  for(let z=2;z<L;z+=3)line([0,y+.09,z],[maxX,y+.09,z],'deck');
 }
}
if(lateral){
 const bays=s.brace==='corners'?[0,2]:s.brace==='central'?[1]:[];
 for(const b of bays)for(const z of [0,L])for(const y of [0,12]){beam([b*G,y,z],[(b+1)*G,y+12,z],'brace',.12,.12);beam([(b+1)*G,y,z],[b*G,y+12,z],'brace',.12,.12);}
 if(s.brace!=='none')for(const x of [0,maxX])for(const y of [0,12]){beam([x,y,0],[x,y+12,L],'brace',.12,.12);beam([x,y,L],[x,y+12,0],'brace',.12,.12);}
 const a=s.wind==='x'?[-G*.4,24,L/2]:[maxX/2,24,-L*.4],b=s.wind==='x'?[G*.3,24,L/2]:[maxX/2,24,L*.3];items.push({type:'arrow',a,b,color:'#ae5550',width:3});label(a,'Lateral action');label([maxX/2,26,L/2],s.opening?'Diaphragm opening: edge transfer required':'Diaphragm → braced bays → foundations');
}else{for(const x of [c.spacing]){items.push({type:'poly',points:[[x-c.spacing/2,Y+.1,0],[x+c.spacing/2,Y+.1,0],[x+c.spacing/2,Y+.1,L],[x-c.spacing/2,Y+.1,L]],color:'#d28a52',alpha:.25,id:'tributary'});items.push({type:'arrow',a:[x,Y+6,L/2],b:[x,Y+1,L/2],color:'#bd7144',width:2});}if(id==='floor-girder')for(const p of c.points){items.push({type:'arrow',a:[p.x,Y+5,0],b:[p.x,Y+.3,0],color:'#ae5550',width:3});label([p.x,Y+6,0],`${p.kips.toFixed(2)} kips`);}label([G/2,Y+2,-2],`Girder span ${G} ft · ${s.spaces} spaces`);label([G+2,Y+2,L/2],`Beam span ${L} ft`);label([c.spacing,Y+3,L*.7],`${c.spacing.toFixed(2)} ft tributary strip`);}
return {items,center:[maxX/2,lateral?12:6,L/2],extent:Math.max(maxX,L,lateral?28:20)*1.22,plane:'plan'};}
// Floor diagrams are coordinates within the same 60 x 120 ft enclosure as Lecture 1.1.
function layout(roof,s){
 const small=roof.family==='3060',bay=small?30:40,o=s.option,group='PQRS'.includes(o),index='PQRSTUVW'.indexOf(o)%4;
 const dx=small?[30,20,15,15][index]:[30,20,30,20][index],dz=small?30:index<2?40:20;
 const xs=small&&index===3?[0,15,60]:Array.from({length:60/dx+1},(_,i)=>i*dx),zs=Array.from({length:120/dz+1},(_,i)=>i*dz);
 const hole=small?(o==='P'?{x0:0,x1:60,z0:30,z1:60}:group?{x0:o==='Q'?20:15,x1:60,z0:30,z1:90}:{x0:o==='T'?30:o==='U'?20:o==='V'?30:15,x1:60,z0:0,z1:60}):{x0:0,x1:60,z0:group?40:0,z1:group?80:40};
 const cells=[];for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2;if(!(x>hole.x0&&x<hole.x1&&z>hole.z0&&z<hole.z1))cells.push({x0,x1,z0,z1});}
 if(s.bridge){const width=Math.min(s.bridgeWidth||8,hole.x1-hole.x0);cells.push({x0:hole.x0,x1:hole.x0+width,z0:hole.z0,z1:hole.z1,bridge:true});}
 return {bay,xs,zs,cells,hole,beamSpan:Math.max(small&&index===3?45:dx,dz),girderSpan:Math.min(small&&index===3?45:dx,dz),area:cells.reduce((a,c)=>a+(c.x1-c.x0)*(c.z1-c.z0),0)};
}
function roofSignature(r){return [r.family,r.use,r.option,r.direction,r.spaces,r.gauge,r.continuity,r.joist,r.girderDepth,r.girderLoad,r.sides,r.allowance,r.deckExtension,r.joistExtension,r.girderExtension].join('|');}
function sync(roof,s){
 const key='layout-v2|'+roof.family+'|'+s.option,l=layout(roof,s),sig=roofSignature(roof);
 if(s.geometryKey!==key){s.beamSpan=l.beamSpan;s.girderSpan=l.girderSpan;s.geometryKey=key;s.layoutConfirmed=false;s.basis='';s.reviewed={};}
 if(s.roofBasis!==sig){s.roofBasis=sig;s.basis='';s.reviewed={};}
 s.familyAtChoice=roof.family;return s;
}
function projectScene(roof,s){
 const R=root.SteelRoof,g=R.roofGeometry(roof),r=R.scene({...roof,roofView:'building',layer:'all'}),l=layout(roof,s);r.items=r.items.filter(it=>it.id!=='selected-bay'&&(it.type!=='label'||it.text==='OPEN PORCH'));const items=r.items;
 const Y=s.elevation||12.25,p=(x,z,y=Y)=>[x-30,y,z+g.bay-g.length/2];
 const segments=new Set(),columns=new Set();
 function member(a,b,id,w,h,color){const key=JSON.stringify([a,b].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));if(segments.has(key))return;segments.add(key);items.push({type:'beam',a,b,id,w,h,color});}
 const depth=name=>{const m=/^W(\d+)/i.exec(name);return m?+m[1]/12:null;},bd=depth(s.beamName)||.8,gd=depth(s.girderName)||1.1;
 for(const c of l.cells){
  const across=c.x1-c.x0>=c.z1-c.z0,n=s.spaces;
  if(across){for(const x of [c.x0,c.x1])member(p(x,c.z0,Y-gd/2),p(x,c.z1,Y-gd/2),'floor-girder',.38,gd,'#4b8097');for(let i=0;i<=n;i++){const z=c.z0+(c.z1-c.z0)*i/n;member(p(c.x0,z,Y-bd/2),p(c.x1,z,Y-bd/2),'floor-beam',.24,bd,'#cf7a42');}}
  else{for(const z of [c.z0,c.z1])member(p(c.x0,z,Y-gd/2),p(c.x1,z,Y-gd/2),'floor-girder',.38,gd,'#4b8097');for(let i=0;i<=n;i++){const x=c.x0+(c.x1-c.x0)*i/n;member(p(x,c.z0,Y-bd/2),p(x,c.z1,Y-bd/2),'floor-beam',.24,bd,'#cf7a42');}}
  // Slab rib direction crosses the actual beam lines.
  for(let a=(across?c.x0:c.z0)+3;a<(across?c.x1:c.z1);a+=3)items.push({type:'line',a:across?p(a,c.z0,Y+.05):p(c.x0,a,Y+.05),b:across?p(a,c.z1,Y+.05):p(c.x1,a,Y+.05),id:'floor-deck',color:'#6999aa',width:.5});
  items.push({type:'poly',points:[p(c.x0,c.z0),p(c.x1,c.z0),p(c.x1,c.z1),p(c.x0,c.z1)],id:'floor-deck',color:'#8cbdc7',alpha:.25});
  for(const x of [c.x0,c.x1])for(const z of [c.z0,c.z1]){
   const key=x+','+z;if(columns.has(key))continue;columns.add(key);
   // Roof perimeter columns already continue to ground. Additional floor columns stop at this level.
   if((x===0||x===60)&&Math.abs(z/g.bay-Math.round(z/g.bay))<1e-8)continue;
   member(p(x,z,0),p(x,z),'floor-column',.45,.45,'#536775');
  }
 }
 if(s.brace!=='none'){
  const cross=(a,b)=>member(a,b,'floor-brace',.14,.14,'#b55f4e'),roofP=(x,z)=>p(x,z,g.elevation(x,z+g.bay));
  const regions=s.brace==='corners'?[[0,g.bay],[120-g.bay,120]]:[[g.bay,2*g.bay]];
  for(const [z0,z1]of regions)for(const x of [0,60]){cross(p(x,z0,0),p(x,z1,Y));cross(p(x,z1,0),p(x,z0,Y));cross(p(x,z0,Y),roofP(x,z1));cross(p(x,z1,Y),roofP(x,z0));}
  for(const z of [0,120]){cross(p(0,z,0),p(60,z,Y));cross(p(60,z,0),p(0,z,Y));cross(p(0,z,Y),roofP(60,z));cross(p(60,z,Y),roofP(0,z));}
 }
 const h=l.hole,x0=h.x0+(s.bridge?Math.min(s.bridgeWidth,h.x1-h.x0):0),x1=h.x1;
 if(x1>x0){for(const [a,b]of [[[x0,h.z0],[x1,h.z0]],[[x1,h.z0],[x1,h.z1]],[[x1,h.z1],[x0,h.z1]],[[x0,h.z1],[x0,h.z0]]])items.push({type:'line',a:p(a[0],a[1],Y+.1),b:p(b[0],b[1],Y+.1),id:'floor-void',color:'#b47b36',width:2});items.push({type:'label',p:p((x0+x1)/2,(h.z0+h.z1)/2,Y+.2),text:'DOUBLE HEIGHT · NO FLOOR',color:'#805820'});}
 if(s.roofVisible===false){r.items=items.filter(it=>it.id?.startsWith('floor-')||it.id==='column'||it.type==='label');r.annotations=[];}
 if(s.layer!=='all')for(const it of items)if(it.id&&!it.id.includes(s.layer)&&it.type!=='label')it.color='#d2d9dc';
 r.annotations=[{a:p(0,0,0),b:p(0,120,0),title:'Shared building · roof '+roof.option+' / floor '+s.option,value:roof.family+' · 60 × 120 ft + porch',color:'#326c94'},{a:p(l.hole.x0,l.hole.z0),b:p(l.hole.x1,l.hole.z1),title:'Floor '+s.option+' · open to roof',value:l.area+' sq ft elevated floor · shared coordinates',color:'#4b8097'}];
 return r;
}
root.SteelFloor={layout,sync,roofSignature,projectScene,uses,source,spans,deck,concepts,steps,all,isFloor,lecture,defaults,normalize,signature,calc,scene};
if(typeof module!=='undefined')module.exports=root.SteelFloor;
})(typeof window!=='undefined'?window:globalThis);
