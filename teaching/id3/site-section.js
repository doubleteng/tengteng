// A soil column has both an upper and a lower boundary. Reading these from the
// terrain mesh also works at stair sidewalls with an open Rhino trim seam.
const snap=1e5;
export function layerName(name){
 return String(name||'').trim().toLowerCase().replace(/\s*(?:::|[/>])\s*/g,'/').replace(/[_-]+/g,' ').replace(/\s+/g,' ');
}
export function isSiteMass(mesh,siteLayers=[]){
 const names=[];
 for(let node=mesh;node;node=node.parent){
  const data=node.userData||{};
  if(data.sectionRole)return data.sectionRole==='terrain';
  for(const label of [data.atlasPath,data.layer,data.sourceLayer,node.name]){
   if(label)names.push(layerName(label));
  }
 }
 // A catalog entry may identify the original Rhino layers, including a
 // parent and its sublayers. This also handles models with arbitrary names.
 if(siteLayers.length)return names.some(n=>siteLayers.some(l=>n===l||n.startsWith(l+'/')));
 if(mesh.userData.groundSurface===true)return true;
 const path=layerName(mesh.userData.atlasPath||mesh.userData.layer||mesh.name);
 const labels=[path,...names].filter(Boolean);
 const site=/^(?:\d+\s+)?(?:(?:existing |proposed |design |flat )?site(?: geometry| mass| model| base| solid)?|landscape|场地)$/;
 const earth=/\b(?:terrain|topo|topograph\w*|toposolid|landform|earthworks|soil|graded parcel|site grading)\b|地形|土方/;
 // Interpret a generic named Site layer as ground while keeping separately
 // labeled site furnishings and planting out of the earth section.
 const source=layerName(mesh.userData.sourceLayer);
 if(/furniture|trees|planting|contours|annotation|设备|植物/.test(path+' '+source))return false;
 if(earth.test(path)||earth.test(source))return true;
 const leaf=path.split('/').at(-1);
 if(site.test(leaf)||site.test(source.split('/').at(-1)))return true;
 if(/^(?:ground|earth|grade|地面)$/.test(leaf))return true;
 return labels.some(n=>n.split('/').some(part=>site.test(part)))&&
  /^(?:geometry|mass|soil|ground|graded?\b.*|grading|landform|parcel footprint|.*paving|base|earth|地坪)$/.test(leaf);
}
function worldPoint(axis,s,u,v){
 if(axis===0)return [s,v,u];
 if(axis===1)return [u,s,v];
 return [u,v,s];
}
// Sweep the actual boundaries, filling each occupied vertical interval. Nested
// voids and disjoint footprints are handled by the same parity test.
function fillStrips(edges,axis,s,required,out){
 const events=new Map();
 function event(x){if(!events.has(x))events.set(x,{begin:[],end:[]});return events.get(x);}
 for(const e of edges.values()){
  if(!e.mask)continue;
  event(e.x0).begin.push(e);event(e.x1).end.push(e);
 }
 const xs=[...events.keys()].sort((a,b)=>a-b),active=new Set();
 const at=(e,x)=>e.y0+(e.y1-e.y0)*(x-e.x0)/(e.x1-e.x0);
 function strip(left,right,sorted){
  let mask=0,bottom;
  for(const edge of sorted){
   const was=mask===required;mask^=edge.mask;
   if(!was&&mask===required)bottom=edge;
   else if(was&&mask!==required){
    const bl=at(bottom,left),br=at(bottom,right),tl=at(edge,left),tr=at(edge,right);
    const a=worldPoint(axis,s,left/snap,bl/snap),b=worldPoint(axis,s,right/snap,br/snap);
    const c=worldPoint(axis,s,right/snap,tr/snap),d=worldPoint(axis,s,left/snap,tl/snap);
    if(tr-br>.001)out.push(...a,...b,...c);
    if(tl-bl>.001)out.push(...a,...c,...d);
   }
  }
 }
 for(let i=0;i+1<xs.length;i++){
  const left=xs[i],right=xs[i+1],evt=events.get(left);
  for(const e of evt.end)active.delete(e);
  for(const e of evt.begin)active.add(e);
  const lines=[...active];
  if(lines.length<2||lines.reduce((mask,e)=>mask^e.mask,0)!==0)continue;
  const splits=[left,right];
  for(let j=0;j<lines.length;j++)for(let k=0;k<j;k++){
   const d0=at(lines[j],left)-at(lines[k],left),d1=at(lines[j],right)-at(lines[k],right);
   if(d0*d1<0)splits.push(left+(right-left)*d0/(d0-d1));
  }
  splits.sort((a,b)=>a-b);
  for(let j=1;j<splits.length;j++){
   const lo=splits[j-1],hi=splits[j];if(hi-lo<.001)continue;
   const mid=(lo+hi)/2;
   lines.sort((a,b)=>at(a,mid)-at(b,mid));strip(lo,hi,lines);
  }
 }
}
function fillLayer(parts,axis,s,side,out){
 const edges=new Map(),horizontal=axis===1;
 function boundary(p,q,mask){
  let x0=Math.round(p[axis===0?2:0]*snap),x1=Math.round(q[axis===0?2:0]*snap);
  if(x0===x1)return;
  let y0=Math.round(p[horizontal?2:1]*snap),y1=Math.round(q[horizontal?2:1]*snap);
  if(x1<x0){[x0,x1]=[x1,x0];[y0,y1]=[y1,y0];}
  const key=x0+','+y0+';'+x1+','+y1,old=edges.get(key);
  if(old)old.mask^=mask;else edges.set(key,{x0,x1,y0,y1,mask});
 }
 const triangle=[[0,0,0],[0,0,0],[0,0,0]],high=[false,false,false];
 for(const {xyz,index,count} of parts){
  for(let i=0;i+2<count;i+=3){
   for(let j=0;j<3;j++){
    const n=3*(index?index[i+j]:i+j),p=triangle[j];
    p[0]=xyz[n];p[1]=xyz[n+1];p[2]=xyz[n+2];
    const dist=p[axis]-s;
    high[j]=Math.abs(dist)<1e-7?side<0:dist>0;
   }
   const [a,b,c]=triangle;
   // Vertical sidewalls have zero footprint. Top and soffit faces supply the
   // full interval at each column, including excavations and overhangs.
   if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))<1e-12)continue;
   if(high[0]===high[1]&&high[1]===high[2]){
    if(horizontal){const mask=high[0]?1:2;boundary(a,b,mask);boundary(b,c,mask);boundary(c,a,mask);}
    continue;
   }
   const crossings=[];
   for(let j=0;j<3;j++){
    const k=(j+1)%3,p=triangle[j],q=triangle[k],mask=high[j]?1:2;
    if(high[j]===high[k]){if(horizontal)boundary(p,q,mask);continue;}
    const t=Math.max(0,Math.min(1,(s-p[axis])/(q[axis]-p[axis])));
    const hit=p.map((v,n)=>v+t*(q[n]-v));hit[axis]=s;crossings.push(hit);
    if(horizontal){boundary(p,hit,mask);boundary(hit,q,3^mask);}
   }
   if(crossings.length===2)boundary(crossings[0],crossings[1],horizontal?3:1);
  }
 }
 fillStrips(edges,axis,s,horizontal?3:1,out);
}
export function siteSection(parts,axis,position,side,visible){
 const layers=new Map(),out=[];
 for(const p of parts){
  if(!visible.has(p.id))continue;
  if(!layers.has(p.bucket))layers.set(p.bucket,[]);
  layers.get(p.bucket).push(p);
 }
 for(const batch of layers.values())fillLayer(batch,axis,position,side,out);
 return new Float32Array(out);
}
