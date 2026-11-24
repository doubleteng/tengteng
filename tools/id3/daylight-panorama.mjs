// Open daylight-panorama.html from the same HTTP origin as the source tree.
// Each pixel looks out from the registered site through the actual district.
import {GLTFLoader} from '../../teaching/id3/lib/loaders/GLTFLoader.js';
import {Vector3} from '../../teaching/id3/lib/three.module.min.js';
import {TriangleScene} from './market-switchback/light-bvh.mjs';

const width=512,height=256;
const site=[-52.5,7.4,10.5];
const district=['urban-core-materials.glb','urban-near.glb','urban-outer.glb'];
const samples=[[0,1,0],[.60,.72,.35],[-.31,.68,.65],[-.72,.66,-.24],[.42,.67,-.67]]
 .map(v=>v.map(n=>n/Math.hypot(...v)));

async function readDistrict() {
 const loader=new GLTFLoader();
 const models=await Promise.all(district.map(name=>loader.loadAsync(new URL('../../teaching/id3/models/'+name,import.meta.url).href)));
 const positions=[],colors=[],faces=[],palette=new Map();
 const point=new Vector3();
 for(const {scene} of models) {
  scene.updateMatrixWorld(true);
  scene.traverse(object=>{
   if(!object.isMesh || object.userData.initialHidden) return;
   const geometry=object.geometry;
   const tint=object.material.color;
   const vertices=geometry.getAttribute('position'), painted=geometry.getAttribute('color');
   const count=geometry.index?.count||vertices.count;
   for(let k=0;k<count;k+=3){
    let red=0,green=0,blue=0;
    for(let corner=0;corner<3;corner++){
     const i=geometry.index?.getX(k+corner)??k+corner;
     point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld);
     positions.push(point.x,point.y,point.z);
     red+=painted?.getX(i)??1;green+=painted?.getY(i)??1;blue+=painted?.getZ(i)??1;
    }
    const color=[tint.r*red/3,tint.g*green/3,tint.b*blue/3];
    const key=color.map(c=>Math.round(c*1023)).join('/');
    let id=palette.get(key);
    if(id===undefined){id=colors.length;palette.set(key,id);colors.push(color);faces.push([]);}
    const last=positions.length/3;
    faces[id].push(last-3,last-2,last-1);
   }
  });
 }
 const position=Float32Array.from(positions);
 const primitives=faces.map((indices,color)=>({position,index:Uint32Array.from(indices),albedo:color}));
 return {bvh:new TriangleScene(primitives), colors};
}

function sky(direction) {
 const [x,y,z]=direction;
 if(y<0)return [.28,.255,.225];
 // A continuous mid-latitude sky without a baked sun. Four bands of
 // turbulence give glazing large, legible cloud reflections across the seam.
 const waves=[[2.2,8.7,3.1,4.27],[-6.3,8.5,1.7,.69],[8.9,3.4,-4.5,1.51],[3.6,-5.2,-6.8,3.85]];
 let density=0;
 for(let octave=0;octave<4;octave++){
  const scale=2**octave;
  for(const [a,b,c,d] of waves)
   density+=Math.sin((a*x+b*y+c*z)*scale+d*(octave+1))*.15/scale;
 }
 const cloud=Math.min(1,Math.max(0,.34+density))*.88;
 const h=y**.55;
 return [[.91,.21],[.93,.46],[.91,.73]].map(([horizon,zenith])=>{
  const clear=horizon+(zenith-horizon)*h;
  return clear+(.98-clear)*cloud;
 });
}

const normal=new Vector3();
function daylight(origin,direction,hit,bvh,colors){
 if(hit<0)return sky(direction);
 const distance=bvh.hitDistance, data=bvh.triangles;
 const color=colors[data[hit+12]];
 normal.fromArray(data,hit+9);
 if(normal.x*direction[0]+normal.y*direction[1]+normal.z*direction[2]>0)normal.negate();
 const start=direction.map((d,i)=>origin[i]+d*distance+.018*normal.getComponent(i));
 let available=0,unoccluded=0;
 for(const axis of samples){
  const incidence=normal.x*axis[0]+normal.y*axis[1]+normal.z*axis[2];
  if(incidence<=0)continue;
  available+=incidence;
  if(bvh.trace(...start,...axis,45)<0)unoccluded+=incidence;
 }
 const visibility=unoccluded/Math.max(.001,available);
 const light=.15+.68*(.58+.42*normal.y)*(.37+.63*visibility);
 return [.96,.985,1].map((adjust,i)=>color[i]*adjust*light);
}

function srgb(x){
 x=Math.max(0,Math.min(1,x));
 return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));
}

async function generate(){
 const {bvh,colors}=await readDistrict();
 postMessage({status:'Sampling the streetscape and sky…'});
 const rgba=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++){
  const lat=Math.PI*(.5-(y+.5)/height),sin=Math.sin(lat),cos=Math.cos(lat);
  for(let x=0;x<width;x++){
   const lon=2*Math.PI*((x+.5)/width-.5);
   const direction=[cos*Math.cos(lon),sin,cos*Math.sin(lon)];
   const rgb=daylight(site,direction,bvh.trace(...site,...direction,650),bvh,colors);
   const gray=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
   const index=4*(y*width+x);
   for(let k=0;k<3;k++)rgba[index+k]=srgb(.98*rgb[k]+.02*gray);
   rgba[index+3]=255;
  }
 }
 const canvas=new OffscreenCanvas(width,height);
 canvas.getContext('2d').putImageData(new ImageData(rgba,width,height),0,0);
 const image=await canvas.convertToBlob({type:'image/webp',quality:.93});
 if(image.type!=='image/webp')throw Error('WebP encoding is unavailable.');
 postMessage({image,triangles:bvh.faceCount});
}
generate().catch(error=>{postMessage({status:'The panorama could not be drawn. '+error.message});});
