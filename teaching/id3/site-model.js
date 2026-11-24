import * as T from './lib/three.module.min.js';
export const siteCenter=new T.Vector3(-50.4944,0,25.8326);
export const demoOrigin=new T.Vector3(-53,1.40,23);
export function siteFootprint(highlight=true){
 const coordinates=[[0,0],[-82.906,0],[-82.906,-57.912],[-40.5383,-57.912]];
 const grades=[2.4384,.3048,.3048,2.4384];
 const region=new T.Group();const geom=new T.BufferGeometry();
 const boundary=coordinates.map(([x,y])=>new T.Vector2(x,-y));
 const rings=[boundary];const elevations=grades.map(z=>z+.025);
 // The demo plinth occupies this entire rectangle. The surrounding parcel
 // meets its outer rim at the same elevation; no sloped pad crosses it.
 if(!highlight){
  rings.push([[-24,-14],[24,-14],[24,14],[-24,14]].map(([x,z])=>
   new T.Vector2(demoOrigin.x+x,demoOrigin.z+z)));
  elevations.push(...Array(4).fill(demoOrigin.y+.07));
 }
 const points=rings.flat(),indices=highlight?[0,1,2,0,2,3]:
  T.ShapeUtils.triangulateShape(boundary,rings.slice(1)).flatMap(([a,b,c])=>[a,c,b]);
 geom.setAttribute('position',new T.Float32BufferAttribute(points.flatMap((p,i)=>[p.x,elevations[i],p.y]),3));
 geom.setIndex(indices);geom.computeVertexNormals();
 const pad=new T.Mesh(geom,new T.MeshStandardMaterial({color:highlight?0xdd9977:0xd4d1c7,roughness:1,side:T.DoubleSide}));
 pad.userData.layer=highlight?'Design site / Parcel footprint':'Site / Ground';
 pad.userData.groundSurface=true;region.add(pad);
 if(!highlight)return region;
 const mat=new T.MeshStandardMaterial({color:0xb44c27,roughness:.92});for(let i=0;i<4;i++){const [x,y]=coordinates[i],[x2,y2]=coordinates[(i+1)%4];const a=new T.Vector3(x,grades[i]+.06,-y),b=new T.Vector3(x2,grades[(i+1)%4]+.06,-y2),d=b.clone().sub(a);
  const edge=new T.Mesh(new T.BoxGeometry(d.length(),.12,.38),mat);edge.position.copy(a.addScaledVector(d,.5));edge.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),d.normalize());edge.userData.layer='Design site / Parcel perimeter';region.add(edge);}
 return region;
}
