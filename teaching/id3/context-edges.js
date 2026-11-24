// Classify creases once per shared mesh. Narrow faces need less ink as their
// screen width approaches a pixel, especially on closely spaced roof members.
import * as T from './lib/three.module.min.js';

export function contextEdges(geometry) {
 const positions = geometry.getAttribute('position');
 const indices = geometry.index;
 const count = indices ? indices.count : positions.count;
 const keys = Array.from({length:positions.count}, (_, i) =>
  [positions.getX(i), positions.getY(i), positions.getZ(i)].map(x=>Math.round(x*1e4)).join(','));
 const edges = new Map();
 const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
 const uv = new T.Vector3(), uw = new T.Vector3(), normal = new T.Vector3();
 const crease = Math.cos(T.MathUtils.degToRad(32));
 for (let i=0; i<count; i+=3) {
  const ix = indices ? [indices.getX(i),indices.getX(i+1),indices.getX(i+2)] : [i,i+1,i+2];
  a.fromBufferAttribute(positions,ix[0]); b.fromBufferAttribute(positions,ix[1]); c.fromBufferAttribute(positions,ix[2]);
  normal.crossVectors(uv.subVectors(b,a),uw.subVectors(c,a));
  const area2 = normal.length(); if(area2<1e-12)continue;
  normal.multiplyScalar(1/area2);
  const width = area2 / Math.max(uv.length(),uw.length(),b.distanceTo(c));
  for(let side=0;side<3;side++){
   const s=ix[side], t=ix[(side+1)%3];
   const p=keys[s],q=keys[t];if(p===q)continue;
   const key=p<q?p+'|'+q:q+'|'+p;
   const old=edges.get(key);
   if(!old)edges.set(key,{s,t,normal:normal.clone(),width,faces:1,crease:false});
   else {
    old.faces++;old.width=Math.max(old.width,width);
    // Opposite-winding duplicates of the same flat face are not a crease.
    if(Math.abs(old.normal.dot(normal))<crease)old.crease=true;
   }
  }
 }
 const xyz=[], widths=[];
 for(const {s,t,width,faces,crease:sharp} of edges.values()){
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
 const material = new T.LineBasicMaterial({color:0x58554f,transparent:true,opacity:.48,depthWrite:false});
 material.onBeforeCompile = shader => {
  shader.uniforms.inkViewHeight = viewHeight;
  shader.vertexShader = 'attribute float inkWidth; uniform float inkViewHeight; varying float inkCoverage;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
   float pixelWidth = inkWidth * length(modelMatrix[0].xyz) * inkViewHeight * .5 * projectionMatrix[1][1] / max(gl_Position.w, .0001);
   inkCoverage = smoothstep(.85, 3.6, pixelWidth);`);
  shader.fragmentShader='varying float inkCoverage;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
   diffuseColor.a *= inkCoverage;
   if (diffuseColor.a < .015) discard;`);
 };
 return material;
}
