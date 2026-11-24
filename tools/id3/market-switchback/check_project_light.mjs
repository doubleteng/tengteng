// Check the downloadable asset, including its registration to the unmodified GLB.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {TriangleScene,readOpaqueCase} from './light-bvh.mjs';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {loadProjectLightVolume,applyProjectLightVolume} from '../../../teaching/id3/project-light-volume.js';

const models=new URL('../../../teaching/id3/models/',import.meta.url);
const [model,compressed]=await Promise.all([
 readFile(new URL('market-switchback.glb',models)),
 readFile(new URL('market-switchback.light.gz',models))
]);
const fingerprint=createHash('sha256').update(model).digest('hex');
const url='data:application/octet-stream;base64,'+compressed.toString('base64');
const volume=await loadProjectLightVolume(url,fingerprint.slice(0,10));
assert.equal(volume.version,fingerprint);
assert.equal(await loadProjectLightVolume(url,fingerprint.slice(0,10)),volume);
await assert.rejects(loadProjectLightVolume(url,'0000000000'),/does not match/);

// Equivalent to the GPU's clamp-to-edge trilinear lookup of four channels.
// All four world positions are on actual model faces. Within each pair both
// samples share the same material, face, normal and direct-light angle.
function sample(position,normal) {
 const N=new T.Vector3(...normal).normalize().toArray();
 const {size,origin,step,data}=volume;
 const f=position.map((p,i)=>Math.min(size[i]-1,Math.max(0,(p-origin[i])/step+.62*N[i])));
 const end=f.map((n,i)=>Math.min(size[i]-1,Math.floor(n)+1));
 const base=f.map(Math.floor);
 const coeff=[0,0,0,0];
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++) {
  const bit=[x,y,z],point=bit.map((d,i)=>d?end[i]:base[i]);
  const weight=bit.reduce((a,d,i)=>a*(d?f[i]-base[i]:1-(f[i]-base[i])),1);
  const j=4*(point[0]+size[0]*(point[1]+size[1]*point[2]));
  for(let c=0;c<4;c++)coeff[c]+=weight*data[j+c];
 }
 return Math.max(0,Math.min(1,(coeff[0]+N.reduce((a,n,i)=>a+n*(coeff[i+1]-128),0))/255));
}
const soffit=[-.201,-.98,0],floor=[0,1,0];
const outsideSoffit=sample([-79.910,6.876,2.293],soffit);
const shelteredSoffit=sample([-76.994,6.278,14.818],soffit);
const nearOpening=sample([-57.471,2.5,1.956],floor);
const deepFloor=sample([-56.933,2.5,3.844],floor);
assert.ok(outsideSoffit-shelteredSoffit>.23,'continuous soffit receives local indirect shade');
assert.ok(nearOpening-deepFloor>.30,'the interior darkens away from the opening');

const material=new T.MeshStandardMaterial();
material.onBeforeCompile=shader=>{shader.uniforms.existingFinish={value:1};};
material.customProgramCacheKey=()=>'existing-finish';
const testMesh=new T.Mesh(new T.BoxGeometry(),material);
applyProjectLightVolume(testMesh,volume);
applyProjectLightVolume(testMesh,volume);
const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <aomap_fragment>'};
material.onBeforeCompile(shader,{});
assert.equal(shader.uniforms.existingFinish.value,1);
assert.equal(shader.uniforms.projectProbeStrength,volume.strength);
assert.equal(shader.uniforms.projectProbes.value,volume.texture);
assert.match(material.customProgramCacheKey(),/^existing-finish\|project-probes-1$/);
assert.equal(testMesh.geometry.userData.proposalLighting,true);
console.log(JSON.stringify({compressedBytes:compressed.length,probeBytes:volume.data.byteLength,
 dimensions:volume.size,soffit:[outsideSoffit,shelteredSoffit],floor:[nearOpening,deepFloor]}));

// Compare the authoring worker BVH with independent plane intersections and
// barycentric containment, including vertical rays and hits from back faces.
const raw=model;
const buf=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const scene=new TriangleScene(readOpaqueCase(buf));
assert.ok(scene.faceCount>100000);
let seed=73;
function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
function brute(ox,oy,oz,dx,dy,dz){
 const a=scene.triangles;
 let best=36;
 for(let j=0;j<a.length;j+=13) {
  const nx=a[j+9],ny=a[j+10],nz=a[j+11], dot=nx*dx+ny*dy+nz*dz;
  if(Math.abs(dot)<1e-7)continue;
  const tx=a[j]-ox,ty=a[j+1]-oy,tz=a[j+2]-oz,t=(nx*tx+ny*ty+nz*tz)/dot;
  if(t<1e-6||t>best)continue;
  const px=dx*t-tx,py=dy*t-ty,pz=dz*t-tz,ex=a[j+3],ey=a[j+4],ez=a[j+5],fx=a[j+6],fy=a[j+7],fz=a[j+8];
  const ee=ex*ex+ey*ey+ez*ez,ff=fx*fx+fy*fy+fz*fz,ef=ex*fx+ey*fy+ez*fz;
  const pe=px*ex+py*ey+pz*ez,pf=px*fx+py*fy+pz*fz,den=ee*ff-ef*ef,u=(pe*ff-pf*ef)/den,v=(pf*ee-pe*ef)/den;
  if(u>=0&&v>=0&&u+v<=1)best=t;
 }
 return best;
}
let hits=0;
for(let k=0;k<256;k++) {
 const x=rnd()*86-84,y=rnd()*22-3,z=rnd()*62-2;
 let dx=2*rnd()-1,dy=2*rnd()-1,dz=2*rnd()-1,q=Math.hypot(dx,dy,dz); dx/=q;dy/=q;dz/=q;
 if(k%19===0){dx=0;dy=1;dz=0;}if(k%23===0){dx=0;dy=-1;dz=0;}
 const f=scene.trace(x,y,z,dx,dy,dz,36),baseline=brute(x,y,z,dx,dy,dz);
 if(f>=0)hits++;
 assert.ok(Math.abs(scene.hitDistance-baseline)<.00002,'nearest distance for ray '+k+' '+[scene.hitDistance,baseline]);
}
console.log('independent plane+triangle reference',256,'rays',hits,'hits');
