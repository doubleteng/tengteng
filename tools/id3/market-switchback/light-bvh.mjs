// Registered triangle scene. Geometry is sorted into a binned surface-area BVH;
// tracing allocates no per-ray objects. This runs only in the authoring worker.
const LEAF_SIZE=6, BINS=8, TRI=13, BOX=6;
const min=Math.min,max=Math.max;

export function readOpaqueCase(buffer) {
 const dv=new DataView(buffer);
 if(dv.getUint32(0,true)!==0x46546c67 || dv.getUint32(4,true)!==2)
  throw Error('Expected a binary glTF 2 model');
 const n=dv.getUint32(12,true), body=28+n;
 const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n)));
 const tuple=accessor=>{
  const a=doc.accessors[accessor],v=doc.bufferViews[a.bufferView];
  const width=a.type==='VEC3'?3:1;
  const ArrayType={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
  if(!ArrayType || (v.byteStride && v.byteStride!==width*ArrayType.BYTES_PER_ELEMENT))
   throw Error('Expected tightly packed registered case geometry');
  return new ArrayType(buffer,body+(v.byteOffset||0)+(a.byteOffset||0),a.count*width);
 };
 const primitives=[];
 for(const node of doc.nodes) {
  if(node.extras?.initialHidden)continue;
  if(['matrix','rotation','translation','scale','children'].some(k=>k in node))throw Error('Expected registered model coordinates');
  for(const p of doc.meshes[node.mesh].primitives) {
   const m=doc.materials[p.material]; if(m.alphaMode==='BLEND')continue;
   const [r,g,b]=m.pbrMetallicRoughness.baseColorFactor;
   primitives.push({position:tuple(p.attributes.POSITION),index:tuple(p.indices),albedo:max(.07,min(.82,.2126*r+.7152*g+.0722*b))});
  }
 }
 return primitives;
}

const area=(x,y,z)=>x*y+y*z+z*x;
const reset=(a,i)=>{a[i]=a[i+1]=a[i+2]=Infinity;a[i+3]=a[i+4]=a[i+5]=-Infinity};
function include(a,i,b,j) {
 a[i]=min(a[i],b[j]);a[i+1]=min(a[i+1],b[j+1]);a[i+2]=min(a[i+2],b[j+2]);
 a[i+3]=max(a[i+3],b[j+3]);a[i+4]=max(a[i+4],b[j+4]);a[i+5]=max(a[i+5],b[j+5]);
}

export class TriangleScene {
 constructor(primitives) {
  const n=primitives.reduce((s,p)=>s+p.index.length/3,0);
  if(!n)throw Error('No opaque model triangles');
  const tris=new Float32Array(n*TRI),boxes=new Float32Array(n*BOX);
  const centers=new Float32Array(n*3),order=new Uint32Array(n);
  let t=0;
  for(const p of primitives){
   const {position,index,albedo}=p;
   for(let i=0;i<index.length;i+=3,t++) {
    const j=t*TRI,bi=t*BOX,a=3*index[i],b=3*index[i+1],c=3*index[i+2];
    for(let d=0;d<3;d++) {
     const A=position[a+d],B=position[b+d],C=position[c+d];
     tris[j+d]=A; tris[j+d+3]=B-A; tris[j+d+6]=C-A;
     boxes[bi+d]=min(A,B,C);boxes[bi+d+3]=max(A,B,C);centers[3*t+d]=(A+B+C)/3;
    }
    const nx=tris[j+4]*tris[j+8]-tris[j+5]*tris[j+7],ny=tris[j+5]*tris[j+6]-tris[j+3]*tris[j+8],
     nz=tris[j+3]*tris[j+7]-tris[j+4]*tris[j+6],l=Math.hypot(nx,ny,nz)||1;
    tris[j+9]=nx/l;tris[j+10]=ny/l;tris[j+11]=nz/l;tris[j+12]=albedo;order[t]=t;
   }
  }
  const bounds=new Float32Array(2*n*BOX),child=new Int32Array(2*n),count=new Int32Array(2*n);
  const binBounds=new Float64Array(BINS*BOX),binCount=new Int32Array(BINS),suffix=new Float64Array(BINS),temp=new Float64Array(BOX);
  let used=1;
  function build(node,first,last) {
   const bi=node*BOX;reset(bounds,bi);
   for(let i=first;i<last;i++)include(bounds,bi,boxes,order[i]*BOX);
   if(last-first>LEAF_SIZE){
    let axis=-1,split=0,cost=Infinity;
    for(let d=0;d<3;d++){
     const origin=bounds[bi+d],range=bounds[bi+d+3]-origin;
     if(range<1e-5)continue;
     const scale=BINS/range;binCount.fill(0);
     for(let b=0;b<BINS;b++)reset(binBounds,BOX*b);
     for(let i=first;i<last;i++){
      const id=order[i],bin=min(BINS-1,max(0,(scale*(centers[3*id+d]-origin))|0));
      binCount[bin]++;include(binBounds,BOX*bin,boxes,BOX*id);
     }
     reset(temp,0);let sum=0;
     for(let b=BINS-1;b>0;b--){
      if(binCount[b]){include(temp,0,binBounds,BOX*b);sum+=binCount[b];}
      suffix[b]=sum?area(temp[3]-temp[0],temp[4]-temp[1],temp[5]-temp[2])*sum:0;
     }
     sum=0;reset(temp,0);
     for(let b=0;b<BINS-1;b++){
      if(binCount[b]){include(temp,0,binBounds,BOX*b);sum+=binCount[b];}
      if(!sum || sum===last-first)continue;
      const c=suffix[b+1]+area(temp[3]-temp[0],temp[4]-temp[1],temp[5]-temp[2])*sum;
      if(c<cost){axis=d;split=origin+(b+1)/scale;cost=c;}
     }
    }
    if(axis>=0){
     let mid=first;
     for(let i=first;i<last;i++)if(centers[3*order[i]+axis]<split){
      const old=order[mid];order[mid++]=order[i];order[i]=old;
     }
     if(mid>first && mid<last) {
      const l=used;used+=2;child[node]=l;build(l,first,mid);build(l+1,mid,last);return;
     }
    }
   }
   child[node]=first;count[node]=last-first;
  }
  build(0,0,n);
  this.bounds=bounds.slice(0,used*BOX);this.children=child.slice(0,used);this.count=count.slice(0,used);
  this.triangles=new Float32Array(tris.length);this.faceCount=n;
  for(let i=0;i<n;i++)this.triangles.set(tris.subarray(TRI*order[i],TRI*order[i]+TRI),TRI*i);
  this.stack=new Int32Array(128);this.distances=new Float64Array(128);
 }

 trace(ox,oy,oz,dx,dy,dz,limit) {
  const {bounds,children,count,triangles,stack,distances}=this;
  const ix=1/(dx||1.e-30),iy=1/(dy||1.e-30),iz=1/(dz||1.e-30);
  // Sorting the child distances makes the first leaf supply a tight maximum,
  // which is important in the many dense interiors of this scene.
  const loX=ix<0?3:0,loY=iy<0?4:1,loZ=iz<0?5:2,hiX=3-loX,hiY=5-loY,hiZ=7-loZ;
  let best=limit,hit=-1,sp=1;stack[0]=0;distances[0]=0;
  while(sp){
   const i=--sp,node=stack[i];
   if(distances[i]>best)continue;
   if(!count[node]){
    const l=children[node];
    let leftDist=Infinity,rightDist=Infinity;
    for(let k=0;k<2;k++){
     const b=(l+k)*BOX;
     const near=max(0,(bounds[b+loX]-ox)*ix,(bounds[b+loY]-oy)*iy,(bounds[b+loZ]-oz)*iz);
     if(near>best)continue;
     const far=min(best,(bounds[b+hiX]-ox)*ix,(bounds[b+hiY]-oy)*iy,(bounds[b+hiZ]-oz)*iz);
     if(near<=far){if(k===0)leftDist=near;else rightDist=near;}
    }
    const swap=leftDist<rightDist;
    if(Number.isFinite(swap?rightDist:leftDist)){stack[sp]=swap?l+1:l;distances[sp++]=swap?rightDist:leftDist;}
    if(Number.isFinite(swap?leftDist:rightDist)){stack[sp]=swap?l:l+1;distances[sp++]=swap?leftDist:rightDist;}
   }else{
    const first=children[node],end=first+count[node];
    for(let f=first;f<end;f++){
     const j=TRI*f,tx=ox-triangles[j],ty=oy-triangles[j+1],tz=oz-triangles[j+2],
      ex=triangles[j+3],ey=triangles[j+4],ez=triangles[j+5],fx=triangles[j+6],fy=triangles[j+7],fz=triangles[j+8],
      px=dy*fz-dz*fy,py=dz*fx-dx*fz,pz=dx*fy-dy*fx,det=ex*px+ey*py+ez*pz;
     if(Math.abs(det)<1e-10)continue;
     const inv=1/det,u=(tx*px+ty*py+tz*pz)*inv;
     if(u<0||u>1)continue;
     const qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,v=(dx*qx+dy*qy+dz*qz)*inv;
     if(v<0||u+v>1)continue;
     const dist=(fx*qx+fy*qy+fz*qz)*inv;
     if(dist>=1e-6&&dist<best){best=dist;hit=f;}
    }
   }
  }
  this.hitDistance=best;
  return hit<0?-1:hit*TRI;
 }
}
