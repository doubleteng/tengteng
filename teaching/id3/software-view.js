// Reduced-resolution CPU rasterization for browsers without a WebGL context.
// Orbit, model layers, world coordinates and cast shadows use the same scene.
import * as T from './lib/three.module.min.js';
// Keep decoded material images and static light fields in the raster worker
// across camera changes. The copies below leave the WebGL textures usable.
function textureTile(map){
 const {image}=map;
 if(!image?.width||!image?.height||map.isCompressedTexture)return null;
 const scale=Math.min(1,1024/Math.max(image.width,image.height));
 const width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
 let pixels;
 if(image.data?.length===image.width*image.height*4&&image.data.BYTES_PER_ELEMENT===1){
  if(scale===1)pixels=new Uint8Array(image.data);
  else{
   pixels=new Uint8Array(width*height*4);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=4*(Math.floor(y/scale)*image.width+Math.floor(x/scale));
    pixels.set(image.data.subarray(source,source+4),4*(y*width+x));
   }
  }
 }else{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  try{
   ctx.drawImage(image,0,0,width,height);
   pixels=ctx.getImageData(0,0,width,height).data;
  }catch{
   // The browser may restrict readback from a cross-origin image; retain its base colour.
   return null;
  }
 }
 return {width,height,pixels,id:map.uuid,wrapS:map.wrapS,wrapT:map.wrapT};
}
function modelMap(material,object){
 return material?.map&&!material.userData.runningBond&&
  (material.userData.proposalFinish||object.userData.projectSurface||!object.userData.sourceMaterial)?material.map:null;
}
function copyUV(attribute){
 const values=new Float32Array(attribute.count*2);
 for(let i=0;i<attribute.count;i++){values[2*i]=attribute.getX(i);values[2*i+1]=attribute.getY(i);}
 return values;
}
export class SoftwareRenderer {
 constructor(){
  this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha:false});this.shadowMap={needsUpdate:true};this.known=new Set();this.pending=false;
  this.width=this.domElement.width;this.height=this.domElement.height;
  this.worker=new Worker(new URL('./raster-worker.js?v=2ca39cd8fd', import.meta.url));this.worker.onmessage=({data})=>{
   // Resize the backing buffer only when the replacement frame is ready.
   if(this.domElement.width!==data.w)this.domElement.width=data.w;
   if(this.domElement.height!==data.h)this.domElement.height=data.h;
   this.ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer),data.w,data.h),0,0);this.pending=false;
   if(this.queued){
    const [scene,cam]=this.queued,elapsed=performance.now()-this.started;
    // Consecutive changes while the worker is still drawing indicate a drag,
    // dolly or slider scrub. A single click gets the normal-resolution frame.
    const moving=elapsed>60&&(this.queueCount>1||this.scale<1);
    const next=moving?Math.max(.55,Math.min(.85,this.scale*Math.sqrt(65/elapsed))):1;
    this.queued=null;this.queueCount=0;this.render(scene,cam,next);
   }else if(this.scale<1){
    // On release repaint the latest camera at full detail before resolving wait().
    this.render(this.lastScene,this.lastCamera);
   }else{this.finish?.();this.finish=null;this.settled=null;}
  };
 }
 setPixelRatio(){}
 setSize(w,h){
  const scale=Math.min(1,900/w,610/h);
  this.width=Math.max(1,Math.round(w*scale));this.height=Math.max(1,Math.round(h*scale));
 }
 render(scene,cam,scale=1){
  if(this.pending){this.queued=[scene,cam];this.queueCount=(this.queueCount||0)+1;return;}
  this.pending=true;this.scale=scale;this.started=performance.now();this.lastScene=scene;this.lastCamera=cam;
  const w=Math.max(1,Math.round(this.width*scale)),h=Math.max(1,Math.round(this.height*scale));
  scene.updateMatrixWorld(true);cam.updateMatrixWorld();const matrix=new T.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).elements;
  const draws=[],fresh=[],deformed=[],transfer=[],used=new Set(),tiles=[],usedTiles=new Set();
  this.knownTiles??=new Set();this.sharedTileIds??=new Set();
  let light,sky;
  scene.traverseVisible(o=>{
   if(o.isHemisphereLight){sky=o;return;}
   if(o.isDirectionalLight){light=o;return;}if(!o.geometry||!(o.isMesh||o.isLine||o.isPoints))return;
   const g=o.geometry,id=g.uuid,position=g.getAttribute('position');if(!position)return;used.add(id);
   if(g.userData.posedCloth){
    this.clothVersions??=new WeakMap();
    if(this.known.has(id)&&this.clothVersions.get(g)!==position.version){
     const xyz=new Float32Array(position.array);const normals=new Float32Array(g.attributes.normal.array);
     deformed.push({id,xyz,normals});transfer.push(xyz.buffer,normals.buffer);
    }
    this.clothVersions.set(g,position.version);
   }
   if(!this.known.has(id)){
    const xyz=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){xyz[i*3]=position.getX(i);xyz[i*3+1]=position.getY(i);xyz[i*3+2]=position.getZ(i);}
    const index=g.index?new Uint32Array(g.index.array):null;
    const ink=g.getAttribute('inkWidth'),widths=ink?new Float32Array(ink.array):null;
    let paving=null;const finishUVs=[];
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
    for(const material of [].concat(o.userData.sourceMaterial||o.material)){
     const map=modelMap(material,o);if(!map)continue;
     const channel=map.channel||0,attr=g.getAttribute(channel?'uv'+channel:'uv');
     if(attr&&!finishUVs[channel]){
      finishUVs[channel]=copyUV(attr);transfer.push(finishUVs[channel].buffer);
     }
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
    const normals=g.userData.figureLighting?new Float32Array(g.attributes.normal.array):null;
    const contactFade=g.userData.contactShadow?Float32Array.from({length:color.count},(_,i)=>color.getW(i)):null;
    if(normals)transfer.push(normals.buffer);
    if(contactFade)transfer.push(contactFade.buffer);
    fresh.push({id,xyz,index,widths,paving,finishes,ambient,finishUVs,normals,contactFade});transfer.push(xyz.buffer);
    if(index)transfer.push(index.buffer);if(widths)transfer.push(widths.buffer);this.known.add(id);
   }
   const mats=[].concat(o.material);const groups=Array.isArray(o.material)?g.groups:[{start:0,count:g.index?.count||position.count,materialIndex:0}];
   for(const group of groups){
    const m=mats[group.materialIndex]||mats[0];if(!m||m.visible===false)continue;
    const c=m.color?.clone().convertLinearToSRGB()||new T.Color(.7,.7,.7);
    const finish=m.userData.proposalFinish,reflection=m.userData.proposalReflection;
    const map=modelMap(m,o),channel=map?.channel||0;
    let uvMatrix=null;
    if(map&&g.getAttribute(channel?'uv'+channel:'uv')){
     if(map.matrixAutoUpdate)map.updateMatrix();
     const e=map.matrix.elements;
     if(e[0]!==1||e[1]!==0||e[3]!==0||e[4]!==1||e[6]!==0||e[7]!==0)
      uvMatrix=[e[0],e[1],e[3],e[4],e[6],e[7]];
     usedTiles.add(map.uuid);
     if(map.userData.proposalShared)this.sharedTileIds.add(map.uuid);
     if(!this.knownTiles.has(map.uuid)){
      const tile=textureTile(map);
      if(tile){tiles.push(tile);transfer.push(tile.pixels.buffer);}
      if(map.image?.width)this.knownTiles.add(map.uuid);
     }
    }
    const proposal=!!g.userData.proposalLighting&&[].concat(o.userData.sourceMaterial||o.material).includes(m);
    const layer=o.userData.atlasPath||o.userData.layer||'';
    const openCanopy=proposal&&/^(?:Market \/|Site \/ Market court paving|Structure \/ (?:Arcade |CLT market |Glulam market |Glulam portal crossheads|Glulam posts$|Market plinths))/.test(layer);
    draws.push({id,openCanopy,side:m.side,uvMatrix,uvChannel:channel,flipY:map?.flipY,alphaTest:m.alphaTest,sourceBlend:m.transparent,proposal,finish,reflection,tileID:map?.uuid,roughness:m.roughness,metalness:m.metalness,baked:!!m.userData.districtAmbient,glass:!!m.userData.districtGlass,vertexColors:m.vertexColors,paving:!!m.userData.runningBond,m:o.matrixWorld.elements.slice(),color:[c.r,c.g,c.b],start:group.start,count:group.count,cast:o.castShadow,receive:o.receiveShadow,kind:o.isMesh?'tri':o.isPoints?'point':o.isLineSegments?'segments':'line',outline:!!o.userData.contextOutline,alpha:m.transparent?m.opacity:1});
   }
  });
  const removed=[...this.known].filter(k=>!used.has(k));removed.forEach(k=>this.known.delete(k));
  const dir=new T.Vector3(0,1,0);let sm=null;
  if(light){light.target.updateMatrixWorld();dir.copy(light.position).sub(light.target.position).normalize();
   if(light.castShadow){light.shadow.updateMatrices(light);const c=light.shadow.camera;sm=new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).elements;}}
  const col=(scene.background?.isColor?scene.background:new T.Color(0xe1e2da)).clone().convertLinearToSRGB();
  const removedTiles=[...this.knownTiles].filter(id=>!usedTiles.has(id)&&!this.sharedTileIds.has(id));
  removedTiles.forEach(id=>this.knownTiles.delete(id));
  const resources={};
  // Keep the most recently sent field during clay mode/isolation. Its use is
  // gated per draw; a restored view can re-use the same uploaded field.
  const vol=this.proposalLightVolume,env=this.proposalEnvironment;
  if(vol&&this.sentVolume!==vol){
   const data=new Uint8Array(vol.data);
   resources.volume={data,size:vol.size,origin:vol.origin,step:vol.step};
   transfer.push(data.buffer);this.sentVolume=vol;
  }
  if(env&&this.sentEnvironment!==env){
   const pixels=new Uint8Array(env.pixels);
   resources.environment={pixels,width:env.width,height:env.height};
   transfer.push(pixels.buffer);this.sentEnvironment=env;
  }
  const street=cam.isPerspectiveCamera&&this.streetSky;
  if(street&&this.sentStreetSky!==street){
   const pixels=new Uint8Array(street.pixels);
   resources.streetSky={pixels,width:street.width,height:street.height};
   transfer.push(pixels.buffer);this.sentStreetSky=street;
  }
  const p=cam.projectionMatrix.elements;
  const streetView=street?{world:cam.matrixWorld.elements,projection:[p[0],p[5],p[8],p[9]]}:null;
  const skyRow=this.proposalSky&&cam.isPerspectiveCamera?
   [-cam.matrixWorld.elements[9],cam.matrixWorld.elements[5],cam.projectionMatrix.elements[9],1/cam.projectionMatrix.elements[5]]:null;
  this.worker.postMessage({resources,skyRow,streetView,tiles,removedTiles,useVolume:!!vol,useEnvironment:!!env,w,h,eye:cam.position.toArray(),eyeDirection:cam.getWorldDirection(new T.Vector3()).negate().toArray(),inkProjection:Math.abs(cam.projectionMatrix.elements[5])*h/2,draws,fresh,deformed,removed,view:matrix,perspectiveNear:cam.isPerspectiveCamera?cam.near:0,updateShadow:this.shadowMap.needsUpdate,shadow:sm,dir:dir.toArray(),skyPower:sky?.intensity??1.1225,sunPower:light?.intensity??0,background:[col.r,col.g,col.b]},transfer);
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
