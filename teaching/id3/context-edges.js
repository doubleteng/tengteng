// Classify creases once per shared mesh. Narrow faces need less ink as their
// screen width approaches a pixel, especially on closely spaced roof members.
import * as T from './lib/three.module.min.js';

export function contextEdges(geometry, assembled=false) {
 const positions = geometry.getAttribute('position');
 const indices = geometry.index;
 const count = indices ? indices.count : positions.count;
 // Weld coincident Rhino vertices for crease classification. Intern each
 // coordinate once so the three edges of every face use small numeric keys.
 const vertices=new Map(),ids=new Uint32Array(positions.count);
 for(let i=0;i<ids.length;i++){
  const key=Math.round(positions.getX(i)*1e4)+','+Math.round(positions.getY(i)*1e4)+','+Math.round(positions.getZ(i)*1e4);
  let id=vertices.get(key);
  if(id===undefined){id=vertices.size;vertices.set(key,id);}
  ids[i]=id;
 }
 const vertexCount=vertices.size;
 const edges = new Map();
 const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
 const uv = new T.Vector3(), uw = new T.Vector3(), normal = new T.Vector3();
 const ix=new Uint32Array(3);
 const crease = Math.cos(T.MathUtils.degToRad(32));
 for (let i=0; i<count; i+=3) {
  for(let j=0;j<3;j++)ix[j]=indices?indices.getX(i+j):i+j;
  a.fromBufferAttribute(positions,ix[0]); b.fromBufferAttribute(positions,ix[1]); c.fromBufferAttribute(positions,ix[2]);
  normal.crossVectors(uv.subVectors(b,a),uw.subVectors(c,a));
  const area2 = normal.length(); if(area2<1e-12)continue;
  normal.multiplyScalar(1/area2);
  const width = area2 / Math.max(uv.length(),uw.length(),b.distanceTo(c));
  for(let side=0;side<3;side++){
   const s=ix[side], t=ix[(side+1)%3];
   const p=ids[s],q=ids[t];if(p===q)continue;
   const low=Math.min(p,q),high=Math.max(p,q);
   const key=vertexCount<=94906265?low*vertexCount+high:low+'|'+high;
   const old=edges.get(key);
   if(!old)edges.set(key,{s,t,normal:normal.clone(),width,faces:1,crease:false,first:i});
   else if(assembled&&old.faces>=2){
    (old.extra??=[]).push(i);old.faces++;old.width=Math.max(old.width,width);
   }
   else {
    old.faces++;old.second=i;old.width=Math.max(old.width,width);
    // Opposite-winding duplicates of the same flat face are not a crease.
    if(Math.abs(old.normal.dot(normal))<crease)old.crease=true;
   }
  }
 }
 const xyz=[], widths=[];
 for(const edge of edges.values()){
  const {s,t,width,faces}=edge;
  let sharp=edge.crease;
  if(edge.extra){
   // Opposing side faces between touching solid cells cancel. The flat
   // upper and lower surfaces left at this edge have no drawn diagonal.
   const around=[];
   for(const i of [edge.first,edge.second,...edge.extra]){
    for(let k=0;k<3;k++)ix[k]=indices?indices.getX(i+k):i+k;
    a.fromBufferAttribute(positions,ix[0]);b.fromBufferAttribute(positions,ix[1]);c.fromBufferAttribute(positions,ix[2]);
    normal.crossVectors(uv.subVectors(b,a),uw.subVectors(c,a)).normalize();
    const j=ix.findIndex(v=>ids[v]===ids[s]),sign=ids[ix[(j+1)%3]]===ids[t];
    const mate=around.findIndex(f=>f.sign!==sign&&f.n.dot(normal)<-.999999);
    if(mate>=0)around.splice(mate,1);else around.push({sign,n:normal.clone()});
   }
   sharp=around.length===1||around.some(f=>Math.abs(f.n.dot(around[0].n))<crease);
  }
  if(faces>1&&!sharp)continue;
  for(const i of [s,t]){
   xyz.push(positions.getX(i),positions.getY(i),positions.getZ(i));
   widths.push(width);
  }
 }
 const result=new T.BufferGeometry();
 result.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
 result.setAttribute('inkWidth',new T.Float32BufferAttribute(widths,1));
 return result;
}

export function createInkMaterial(viewHeight) {
 const material = new T.LineBasicMaterial({color:0x5c5b54,transparent:true,opacity:.37,depthWrite:false});
 material.onBeforeCompile = shader => {
  shader.uniforms.inkViewHeight = viewHeight;
  shader.vertexShader = 'attribute float inkWidth; uniform float inkViewHeight; varying float inkCoverage;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
   float pixelsPerMeter = inkViewHeight * .5 * projectionMatrix[1][1] / max(gl_Position.w, .0001);
   float pixelWidth = inkWidth * length(modelMatrix[0].xyz) * pixelsPerMeter;
   inkCoverage = smoothstep(1., 4., pixelWidth) * mix(.42, 1., smoothstep(.7, 5., pixelsPerMeter));`);
  shader.fragmentShader='varying float inkCoverage;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
   diffuseColor.a *= inkCoverage;
   if (diffuseColor.a < .015) discard;`);
 };
 return material;
}
