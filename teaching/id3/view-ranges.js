// Rhino layers can span whole blocks yet arrive as a single WebGL draw.
// Trim only complete primitive runs wholly outside the eye camera. The
// original index buffer remains available to shadow, drawing and walk queries.
import {Box3,Frustum,Matrix4,StaticDrawUsage,Vector3} from './lib/three.module.min.js';

const groups=new WeakMap();
const projection=new Matrix4(),frustum=new Frustum(),point=new Vector3();
const primitivesPerBlock=64;

function blockBounds(geometry,primitive){
 const position=geometry.attributes.position,index=geometry.index;
 const posVersion=(position.data||position).version,idxVersion=index?.version;
 let record=groups.get(geometry);
 if(record&&record.position===position&&record.index===index&&record.posVersion===posVersion&&record.idxVersion===idxVersion&&record.primitive===primitive)return record;
 const blockSize=primitive*primitivesPerBlock,count=index?.count??position.count,boxes=[];
 for(let first=0;first<count;first+=blockSize){
  const box=new Box3();
  for(let i=first,end=Math.min(count,first+blockSize);i<end;i++){
   box.expandByPoint(point.fromBufferAttribute(position,index?index.getX(i):i));
  }
  boxes.push(box.expandByScalar(.0001));
 }
 record={position,index,posVersion,idxVersion,primitive,blockSize,count,boxes};groups.set(geometry,record);
 return record;
}

export function limitViewRange(object){
 const primitive=object.isMesh?3:object.isLineSegments?2:0,g=object.geometry,position=g?.attributes.position;
 if(!primitive||!position||object.isInstancedMesh||object.isBatchedMesh||object.isSkinnedMesh||g.morphAttributes.position?.length||
    (position.data||position).usage!==StaticDrawUsage||(g.index&&g.index.usage!==StaticDrawUsage)||
    (g.index?.count??position.count)<primitive*primitivesPerBlock*3)return;
 blockBounds(g,primitive);
 const before=object.onBeforeRender,after=object.onAfterRender;
 let savedStart,savedCount,limited=false;
 object.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
  before.call(this,renderer,scene,camera,geometry,material,group);
  if(material.displacementMap||material.wireframe||material.isShaderMaterial||material.isRawShaderMaterial)return;
  const {blockSize,count,boxes}=blockBounds(geometry,primitive);
  const original=geometry.drawRange;
  const start=Math.max(original.start,group?.start??0);
  const end=Math.min(original.start+original.count,group?group.start+group.count:Infinity,count);
  if(start%primitive||end-start<blockSize*2)return;
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.matrixWorld);
  // Leave a conservative margin around screen edges, including line coverage.
  projection.elements[0]*=.995;projection.elements[4]*=.995;projection.elements[8]*=.995;projection.elements[12]*=.995;
  projection.elements[1]*=.995;projection.elements[5]*=.995;projection.elements[9]*=.995;projection.elements[13]*=.995;
  frustum.setFromProjectionMatrix(projection);
  let left=Math.floor(start/blockSize),right=Math.ceil(end/blockSize)-1;
  while(left<=right&&!frustum.intersectsBox(boxes[left]))left++;
  while(right>=left&&!frustum.intersectsBox(boxes[right]))right--;
  const first=Math.max(start,left*blockSize),last=Math.min(end,(right+1)*blockSize);
  if(first===start&&last===end)return;
  savedStart=original.start;savedCount=original.count;limited=true;
  geometry.setDrawRange(first,Math.max(0,last-first));
 };
 object.onAfterRender=function(renderer,scene,camera,geometry,material,group){
  if(limited){geometry.setDrawRange(savedStart,savedCount);limited=false;}
  after.call(this,renderer,scene,camera,geometry,material,group);
 };
}
