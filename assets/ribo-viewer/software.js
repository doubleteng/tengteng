// Depth-buffered perspective fallback using the same decoded geometry, materials,
// camera and layer selection as the WebGL renderer.
import { Color, Matrix4, PerspectiveCamera, Vector3 } from '../../teaching/id3/lib/three.module.min.js';
let compiled;
export async function softwareRenderer(detail) {
  compiled ??= fetch(new URL('./raster.wasm',import.meta.url)).then(async response=>{
    if(!response.ok)throw Error('Cannot load software renderer');
    return WebAssembly.compile(await response.arrayBuffer());
  });
  const wasm=(await WebAssembly.instantiate(await compiled,{env:{abort(){throw Error('Raster memory error');}}})).exports;
  let cursor=65536;
  function ensure(end){const difference=end-wasm.memory.buffer.byteLength;if(difference>0)wasm.memory.grow(Math.ceil(difference/65536));}
  function alloc(length){const ptr=cursor;cursor+=(length+15)&~15;ensure(cursor);return ptr;}
  const matrixPtr=alloc(64),lightPtr=alloc(64);
  const lightSize=detail?360:640,shadowColor=alloc(lightSize*lightSize*4),shadowDepth=alloc(lightSize*lightSize*4);
  const lightCamera=new PerspectiveCamera(45,1,.05,detail?28:230);
  const sunTarget=detail?new Vector3(0,1.5,0):new Vector3(-2,2,-5);
  lightCamera.position.copy(sunTarget).addScaledVector(new Vector3(.72,1.33,.78),detail?4:43);
  lightCamera.lookAt(sunTarget);lightCamera.updateMatrixWorld();
  const lightMatrix=new Matrix4().multiplyMatrices(lightCamera.projectionMatrix,lightCamera.matrixWorldInverse);
  const lightFromClip=new Matrix4();let shadowDirty=true;
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:false});
  const matrix=new Matrix4(),color=new Color();
  let entries=[],projected=0,frameStart=0;
  function register(item){
    const p=item.geometry.getAttribute('position'),n=item.geometry.getAttribute('normal'),index=item.geometry.index;
    const vert=alloc(p.count*16),ind=alloc(index.count*4),palette=alloc(1024);
    const vertices=new Float32Array(wasm.memory.buffer,vert,p.count*4);
    const e=item.matrixWorld.elements;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),o=i*4;
      vertices[o]=e[0]*x+e[4]*y+e[8]*z+e[12];vertices[o+1]=e[1]*x+e[5]*y+e[9]*z+e[13];vertices[o+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
      const nx=n?n.getX(i):0,ny=n?n.getY(i):1,nz=n?n.getZ(i):0;
      const key=Math.max(0,nx*.39+ny*.79+nz*.47),fill=Math.max(0,-nx*.59+ny*.45-nz*.64);
      vertices[o+3]=Math.min(255,123+95*key+28*fill+13*ny);
    }
    new Uint32Array(wasm.memory.buffer,ind,index.count).set(index.array);
    color.copy(item.material.color).convertLinearToSRGB();
    const shades=new Uint32Array(wasm.memory.buffer,palette,256);
    for(let l=0;l<256;l++){
      const k=l/237;const r=Math.min(255,Math.round(255*(color.r*k+.020))),g=Math.min(255,Math.round(255*(color.g*k+.024))),b=Math.min(255,Math.round(255*(color.b*k+.025)));
      shades[l]=(0xff000000|(b<<16)|(g<<8)|r)>>>0;
    }
    return {item,vert,ind,palette,vertices:p.count,count:index.count,alpha:Math.round(item.material.opacity*256)};
  }
  const renderer={
    software:true,domElement:canvas,shadowMap:{},setPixelRatio(){},
    setSize(w,h){
      const scale=Math.min(1,1100/w,750/h);
      canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    },
    prepare(items){
      entries=items.map(register).sort((a,b)=>b.alpha-a.alpha);
      projected=alloc(Math.max(...entries.map(e=>e.vertices))*20);frameStart=cursor;
    },
    render(scene,camera){
      if(!frameStart)return;
      camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      const w=canvas.width,h=canvas.height,pixels=w*h,depth=frameStart+pixels*4;
      ensure(depth+pixels*4);
      
      const planes=entries[0].item.material.clippingPlanes||[];
      let axes=0,y=0,x=0;for(const p of planes){if(p.normal.y===-1){axes|=1;y=p.constant;}else{axes|=2;x=p.constant;}}
      if(shadowDirty||renderer.shadowMap.needsUpdate){
        new Float32Array(wasm.memory.buffer,matrixPtr,16).set(lightMatrix.elements);
        wasm.begin(lightSize,lightSize,shadowColor,shadowDepth,matrixPtr,axes,y,x,lightCamera.near);
        for(const e of entries)if(e.item.visible&&e.item.isMesh&&e.alpha===256)wasm.draw(e.vert,e.vertices,e.ind,e.count,projected,e.palette,e.alpha,0);
        shadowDirty=false;renderer.shadowMap.needsUpdate=false;
      }
      new Float32Array(wasm.memory.buffer,matrixPtr,16).set(matrix.elements);
      wasm.begin(w,h,frameStart,depth,matrixPtr,axes,y,x,camera.near);
      for(const e of entries)if(e.item.visible)wasm.draw(e.vert,e.vertices,e.ind,e.count,projected,e.palette,e.alpha,e.item.isLine?1:0);
      lightFromClip.copy(matrix).invert().premultiply(lightMatrix);
      new Float32Array(wasm.memory.buffer,lightPtr,16).set(lightFromClip.elements);
      wasm.shade(shadowDepth,lightSize,lightPtr,-camera.projectionMatrix.elements[10],camera.projectionMatrix.elements[14],detail ? .015 : .17);
      const rgba=new Uint8ClampedArray(wasm.memory.buffer,frameStart,pixels*4);
      context.putImageData(new ImageData(rgba,w,h),0,0);
    }
  };return renderer;
}
