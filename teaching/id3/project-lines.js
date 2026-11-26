import * as T from './lib/three.module.min.js';
import {createInkMaterial} from './context-edges.js?v=4ff44f5d03';
import {limitViewRange} from './view-ranges.js?v=ef004320a5';
import {sectionStroke,setStrokeSegments} from './section-stroke.js?v=23702b3790';
function snapshot(g){
 const p=g.attributes.position,xyz=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){xyz[3*i]=p.getX(i);xyz[3*i+1]=p.getY(i);xyz[3*i+2]=p.getZ(i);}
 const index=g.index?new Uint32Array(g.index.array):null;
 return {xyz,index};
}
export class ProjectLines{
 constructor(viewer,regular){
  this.viewer=viewer;this.buckets=[];this.meshes=[];this.request=0;
  const root=viewer.project;root.updateWorldMatrix(true,true);
  const byGeometry=new Map(),layers=new Map(),sources=[],instances=[],transfer=[];
  root.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
   const path=mesh.userData.atlasPath,door=!!mesh.userData.walkDoor;
   let bucket=door?undefined:layers.get(path);
   if(bucket===undefined){
    bucket=this.buckets.length;const parent=door?mesh:root;
    this.buckets.push({parent,path,inverse:parent.matrixWorld.clone().invert()});
    if(!door)layers.set(path,bucket);
   }
   const g=mesh.geometry;let geometry=byGeometry.get(g);
   if(geometry===undefined){
    geometry=sources.length;byGeometry.set(g,geometry);const s=snapshot(g);sources.push(s);transfer.push(s.xyz.buffer);if(s.index)transfer.push(s.index.buffer);
   }
   const id=this.meshes.length;this.meshes.push(mesh);
   if(mesh.isInstancedMesh){
    const mat=new T.Matrix4();for(let j=0;j<mesh.count;j++){mesh.getMatrixAt(j,mat);instances.push({geometry,bucket,id,m:mat.premultiply(mesh.matrixWorld).toArray()});}
   }else instances.push({geometry,bucket,id,m:mesh.matrixWorld.toArray()});
  });
  this.material=createInkMaterial(viewer.inkViewHeight);this.material.color.setHex(0x403d38);this.material.opacity=.61;
  this.stroke=sectionStroke(viewer.renderer.isWebGLRenderer);this.stroke.visible=false;viewer.scene.add(this.stroke);
  this.worker=new Worker(new URL('./project-lines-worker.js?v=3e207370ac',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{
   if(data.bucket!==undefined){this.attach(data);return;}
   this.inflight=false;
   if(data.request===this.request&&this.pending){
    const {axis,position,side}=this.pending;this.pending=null;
    setStrokeSegments(this.stroke,data.xyz);this.stroke.visible=data.xyz.length>0;
    this.viewer.applySection(axis,position,side);
   }
   this.sendCut();
  };
  this.worker.postMessage({kind:'init',sources,instances,edges:regular},transfer);
 }
 attach({bucket,xyz,widths}){
  if(!xyz.length)return;
  const row=this.buckets[bucket],g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(xyz,3));g.setAttribute('inkWidth',new T.BufferAttribute(widths,1));
  const line=new T.LineSegments(g,this.material);
  line.matrixAutoUpdate=false;line.matrix.copy(row.inverse);line.renderOrder=2;
  line.userData={projectOutline:true,sectionTarget:true,atlasPath:row.path};
  line.visible=this.viewer.projectEdges&&!this.viewer.hidden.has(row.path);
  row.parent.add(line);row.line=line;
  if(this.viewer.renderer.isWebGLRenderer)limitViewRange(line);
  this.viewer.draw();
 }
 cut(axis,position,side){
  this.pending={axis,position,side};this.request++;this.sendCut();
 }
 sendCut(){
  if(!this.pending||this.inflight)return;
  const visible=[];
  for(let id=0;id<this.meshes.length;id++){
   let o=this.meshes[id];while(o&&o.visible)o=o.parent;if(!o)visible.push(id);
  }
  this.inflight=true;
  this.worker.postMessage({kind:'cut',request:this.request,...this.pending,visible});
 }
 clear(){this.request++;this.pending=null;this.stroke.visible=false;}
 dispose(){
  this.worker.terminate();this.stroke.removeFromParent();this.stroke.geometry.dispose();this.stroke.material.dispose();
  for(const {line} of this.buckets)if(line){line.removeFromParent();line.geometry.dispose();}
  this.material.dispose();
 }
}
