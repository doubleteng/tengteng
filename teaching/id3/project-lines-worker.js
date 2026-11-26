// All positions are registered world coordinates. The same triangles drive the
// feature edges and the section, including nonuniformly scaled Rhino objects.
import {BufferGeometry,BufferAttribute} from './lib/three.module.min.js';
import {contextEdges} from './context-edges.js?v=4ff44f5d03';
const block=384,eps=.000012;
export function preparePart(source,m,bucket,id){
 const xyz=new Float32Array(source.xyz.length);
 for(let i=0;i<xyz.length;i+=3){
  const x=source.xyz[i],y=source.xyz[i+1],z=source.xyz[i+2];
  for(let a=0;a<3;a++)xyz[i+a]=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];
 }
 const index=source.index,count=index?.length??xyz.length/3;
 const bounds=new Float32Array(6*Math.ceil(count/block));
 for(let s=0;s<count;s+=block){
  const b=6*(s/block);bounds.set([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],b);
  for(let i=s;i<Math.min(s+block,count);i++){
   const v=3*(index?index[i]:i);
   for(let a=0;a<3;a++){bounds[b+a]=Math.min(bounds[b+a],xyz[v+a]);bounds[b+3+a]=Math.max(bounds[b+3+a],xyz[v+a]);}
  }
 }
 return {id,bucket,xyz,index,count,bounds};
}
function groupEdges(parts){
 const geometry=new BufferGeometry(),vertices=parts.reduce((n,p)=>n+p.xyz.length,0);
 const xyz=new Float32Array(vertices),indices=new Uint32Array(parts.reduce((n,p)=>n+p.count,0));
 let begin=0,offset=0;
 for(const p of parts){
  xyz.set(p.xyz,begin);
  for(let k=0;k<p.count;k++)indices[offset+k]=begin/3+(p.index?p.index[k]:k);
  begin+=p.xyz.length;offset+=p.count;
 }
 geometry.setAttribute('position',new BufferAttribute(xyz,3));geometry.setIndex(new BufferAttribute(indices,1));
 return contextEdges(geometry,true);
}
// Coplanar triangles contribute their outer perimeter, never their diagonals.
// Edges touched by another non-coplanar face remain visible even at exact slab levels.
export function cutSegments(parts,axis,value,visible){
 const edges=new Map(),coplanarTriangles=new Set();
 const u=(axis+1)%3,v=(axis+2)%3;
 const key=p=>Math.round(p[u]*1e5)+','+Math.round(p[v]*1e5);
 function edge(p,q,coplanar){
  const a=key(p),b=key(q);if(a===b)return;
  const id=a<b?a+'|'+b:b+'|'+a;
  const item=edges.get(id);
  if(item){if(coplanar)item.coplanar++;else item.intersects=true;}
  else edges.set(id,{p,q,intersects:!coplanar,coplanar:coplanar?1:0});
 }
 const at=[0,0,0],d=[0,0,0];
 for(const part of parts){
  if(!visible.has(part.id))continue;
  const {xyz,index,count,bounds}=part;
  for(let start=0;start<count;start+=block){
   const bi=6*(start/block);
   if(bounds[bi+axis]>value+eps||bounds[bi+3+axis]<value-eps)continue;
   for(let i=start,end=Math.min(start+block,count);i+2<end;i+=3){
    for(let j=0;j<3;j++){
     at[j]=3*(index?index[i+j]:i+j);const dist=xyz[at[j]+axis]-value;d[j]=Math.abs(dist)<=eps?0:dist;
    }
    if((d[0]>0&&d[1]>0&&d[2]>0)||(d[0]<0&&d[1]<0&&d[2]<0))continue;
    const point=j=>{const a=at[j],p=[xyz[a],xyz[a+1],xyz[a+2]];p[axis]=value;return p;};
    if(!d[0]&&!d[1]&&!d[2]){
     const p=point(0),q=point(1),r=point(2);
     const tri=[key(p),key(q),key(r)].sort().join('|');
     if(!coplanarTriangles.has(tri)){coplanarTriangles.add(tri);edge(p,q,true);edge(q,r,true);edge(r,p,true);}
     continue;
    }
    const hits=[];
    for(let j=0;j<3;j++){
     const k=(j+1)%3;
     if(d[j]===0)hits.push(point(j));
     else if(d[j]*d[k]<0){
      const t=d[j]/(d[j]-d[k]),a=at[j],b=at[k],p=point(j);
      p[u]+=t*(xyz[b+u]-xyz[a+u]);p[v]+=t*(xyz[b+v]-xyz[a+v]);hits.push(p);
     }
    }
    if(hits.length===2)edge(hits[0],hits[1],false);
   }
  }
 }
 const result=[];
 for(const e of edges.values())if(e.intersects||e.coplanar===1)result.push(...e.p,...e.q);
 return new Float32Array(result);
}
if(typeof self!=='undefined'&&typeof document==='undefined'){
 let parts=[],groups=[];
 function nextEdges(){
  const entry=groups.shift();if(!entry)return;
  const [bucket,batch]=entry,g=groupEdges(batch);
  const xyz=g.attributes.position.array,widths=g.attributes.inkWidth.array;
  self.postMessage({bucket,xyz,widths},[xyz.buffer,widths.buffer]);
  if(groups.length)setTimeout(nextEdges,0);
 }
 self.onmessage=({data})=>{
  if(data.kind==='init'){
   parts=data.instances.map(({geometry,m,bucket,id})=>preparePart(data.sources[geometry],m,bucket,id));
   const batches=new Map();
   if(data.edges)for(const p of parts){if(!batches.has(p.bucket))batches.set(p.bucket,[]);batches.get(p.bucket).push(p);}
   groups=[...batches];if(groups.length)setTimeout(nextEdges,0);
  }else{
   const xyz=cutSegments(parts,'xyz'.indexOf(data.axis),data.position,new Set(data.visible));
   self.postMessage({request:data.request,xyz},[xyz.buffer]);
  }
 };
}
