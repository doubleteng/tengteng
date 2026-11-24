// Reduced-resolution CPU rasterization for browsers without a WebGL context.
// Orbit, model layers, world coordinates and cast shadows use the same scene.
import * as T from './lib/three.module.min.js';
export class SoftwareRenderer {
 constructor(){
  this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha:false});this.shadowMap={needsUpdate:true};this.known=new Set();this.pending=false;
  this.width=this.domElement.width;this.height=this.domElement.height;
  this.worker=new Worker(new URL('./raster-worker.js', import.meta.url));this.worker.onmessage=({data})=>{
   // Resize the backing buffer only when the replacement frame is ready.
   if(this.domElement.width!==data.w)this.domElement.width=data.w;
   if(this.domElement.height!==data.h)this.domElement.height=data.h;
   this.ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer),data.w,data.h),0,0);this.pending=false;
   if(this.queued){const [scene,cam]=this.queued;this.queued=null;this.render(scene,cam);}
   else{this.finish?.();this.finish=null;this.settled=null;}
  };
 }
 setPixelRatio(){}
 setSize(w,h){
  const scale=Math.min(1,900/w,610/h);
  this.width=Math.max(1,Math.round(w*scale));this.height=Math.max(1,Math.round(h*scale));
 }
 render(scene,cam){
  if(this.pending){this.queued=[scene,cam];return;}this.pending=true;
  scene.updateMatrixWorld(true);cam.updateMatrixWorld();const matrix=new T.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).elements;
  const draws=[],fresh=[],transfer=[],used=new Set();let light;
  scene.traverseVisible(o=>{
   if(o.isDirectionalLight){light=o;return;}if(!o.geometry||!(o.isMesh||o.isLine||o.isPoints))return;
   const g=o.geometry,id=g.uuid,position=g.getAttribute('position');if(!position)return;used.add(id);
   if(!this.known.has(id)){
    const xyz=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){xyz[i*3]=position.getX(i);xyz[i*3+1]=position.getY(i);xyz[i*3+2]=position.getZ(i);}
    const index=g.index?new Uint32Array(g.index.array):null;
    const ink=g.getAttribute('inkWidth'),widths=ink?new Float32Array(ink.array):null;
    let paving=null;
    const source=[].concat(o.userData.sourceMaterial||o.material).find(m=>m?.userData.runningBond);
    const image=source?.map?.image,uv=g.getAttribute('uv');
    if(image&&uv){
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     const coords=new Float32Array(uv.count*2);
     for(let i=0;i<uv.count;i++){coords[2*i]=uv.getX(i);coords[2*i+1]=uv.getY(i);}
     paving={coords,pixels,width:canvas.width};transfer.push(coords.buffer,pixels.buffer);
    }
    // District batches store one measured finish per triangle in linear RGB.
    let finishes=null;
    const color=g.getAttribute('color');
    if(color&&o.userData.districtVertexColors){
     finishes=new Uint8Array(color.count*3);
     const c=new T.Color();
     for(let i=0;i<color.count;i++){
      c.setRGB(color.getX(i),color.getY(i),color.getZ(i)).convertLinearToSRGB();
      finishes.set([Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)],3*i);
     }
     transfer.push(finishes.buffer);
    }
    const factor=g.getAttribute('districtAmbient');
    const ambient=factor?new Uint8Array(factor.array):null;
    if(ambient)transfer.push(ambient.buffer);
    fresh.push({id,xyz,index,widths,paving,finishes,ambient});transfer.push(xyz.buffer);
    if(index)transfer.push(index.buffer);if(widths)transfer.push(widths.buffer);this.known.add(id);
   }
   const mats=[].concat(o.material);const groups=Array.isArray(o.material)?g.groups:[{start:0,count:g.index?.count||position.count,materialIndex:0}];
   for(const group of groups){
    const m=mats[group.materialIndex]||mats[0];if(!m||m.visible===false)continue;
    const c=m.color?.clone().convertLinearToSRGB()||new T.Color(.7,.7,.7);
    draws.push({id,baked:!!m.userData.districtAmbient,glass:!!m.userData.districtGlass,vertexColors:m.vertexColors,paving:!!m.userData.runningBond,m:o.matrixWorld.elements.slice(),color:[c.r,c.g,c.b],start:group.start,count:group.count,cast:o.castShadow,receive:o.receiveShadow,kind:o.isMesh?'tri':o.isPoints?'point':o.isLineSegments?'segments':'line',outline:!!o.userData.contextOutline,alpha:m.transparent?m.opacity:1});
   }
  });
  const removed=[...this.known].filter(k=>!used.has(k));removed.forEach(k=>this.known.delete(k));
  const dir=new T.Vector3(0,1,0);let sm=null;
  if(light){light.target.updateMatrixWorld();dir.copy(light.position).sub(light.target.position).normalize();
   if(light.castShadow){light.shadow.updateMatrices(light);const c=light.shadow.camera;sm=new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).elements;}}
  const col=(scene.background?.isColor?scene.background:new T.Color(0xe1e2da)).clone().convertLinearToSRGB();
  this.worker.postMessage({w:this.width,h:this.height,eye:cam.position.toArray(),eyeDirection:cam.getWorldDirection(new T.Vector3()).negate().toArray(),inkProjection:Math.abs(cam.projectionMatrix.elements[5])*this.height/2,draws,fresh,removed,view:matrix,perspectiveNear:cam.isPerspectiveCamera?cam.near:0,updateShadow:this.shadowMap.needsUpdate,shadow:sm,dir:dir.toArray(),sunVisible:!!light,background:[col.r,col.g,col.b]},transfer);
  this.shadowMap.needsUpdate=false;
 }
 wait(){return this.pending?(this.settled??=new Promise(resolve=>{this.finish=resolve;})):Promise.resolve();}
 dispose(){this.worker.terminate();}forceContextLoss(){}
}
export function makeRenderer(options){
 const canvas=document.createElement('canvas');
 const gl=canvas.getContext('webgl2',options);
 if(gl)return new T.WebGLRenderer({...options,canvas,context:gl});
 return new SoftwareRenderer();
}
