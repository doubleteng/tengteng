import * as T from './lib/three.module.min.js';

// Measured in metres per complete texture repeat. Image files are neutral
// albedo detail; the base colors represent the architectural finish.
const finishes = {
 'Douglas-fir glulam': {kind:'wood', tile:'glulam', size:[1.70,.32], color:0xe3b582, rough:.54, metal:0, bump:.0008},
 'Glulam spruce': {kind:'wood', tile:'glulam', size:[1.70,.32], color:0xe9c79a, rough:.56, metal:0, bump:.0008},
 'CLT spruce': {kind:'wood', tile:'clt', size:[1.65,.56], color:0xecd0a7, rough:.61, metal:0, bump:.0011},
 'Oiled birch': {kind:'wood', tile:'birch-panels', size:[4.8,2.4], color:0xe9c59b, rough:.47, metal:0, bump:.0007},
 'Board-formed concrete': {kind:'concrete', tile:'formed-concrete', size:[2.7,2.7], color:0xcbc7ba, rough:.87, metal:0, bump:.0024},
 'Galvanized silver': {kind:'zinc', tile:'zinc', size:[1.7,1.7], color:0xc5cace, rough:.46, metal:.64},
 'Graphite steel': {kind:'steel', color:0x535b5e, rough:.46, metal:.50},
 'Vermilion steel': {kind:'steel', rough:.44, metal:.30},
 'Blue-black photovoltaics': {kind:'pv', tile:'pv-cells', size:[2,1], color:0x35516a, rough:.22, metal:.28},
 'Basalt pavers': {kind:'paving', tile:'court-pavers', size:[2.4,2.4], color:0xb4afa1, rough:.92, metal:0, bump:.0016},
 'Vision glass': {kind:'glass', color:0xa3c3c4, rough:.105, metal:.05, opacity:.32},
 'Translucent channel glass': {kind:'frosted', color:0xc8d5cd, rough:.38, metal:.025, opacity:.70}
};
const tileVersions = {
 'birch-panels':'ac4f7d3fbd',
 'clt':'0eb29f85b0',
 'court-pavers':'02192332e7',
 'formed-concrete':'924f71b4e8',
 'glulam':'56306e1a1d',
 'pv-cells':'dd3ec23885',
 'zinc':'220456e7f8',
};
const tiles = new Map();
const loader = new T.TextureLoader();

function loadTile(name, anisotropy) {
 if (!tiles.has(name)) {
  const url=new URL('./models/finishes/'+name+'.webp',import.meta.url);
  url.searchParams.set('v',tileVersions[name]);
  const task=loader.loadAsync(url.href).then(texture=>{
   texture.name=name;
   texture.wrapS=texture.wrapT=T.RepeatWrapping;
   texture.colorSpace=T.SRGBColorSpace;
   texture.flipY=false;
   texture.anisotropy=Math.min(4,Math.max(1,anisotropy));
   texture.userData.viewerShared=true;
   texture.userData.proposalShared=true;
   return texture;
  }).catch(()=>{
   tiles.delete(name);
   return null;
  });
  tiles.set(name,task);
 }
 return tiles.get(name);
}

// Each batch in the teaching model holds many closed fabrication parts. Group
// by actual indexed connectivity so neighbouring diagonals receive independent
// grain directions. This adds one UV pair per original vertex. Both topology
// and indices remain identical for light baking, sections and hit testing.
function islands(geometry) {
 const position=geometry.attributes.position, indices=geometry.index;
 if (!indices) return [];
 const parent=new Int32Array(position.count);
 for (let i=0;i<parent.length;i++) parent[i]=i;
 function root(i) {
  while(parent[i]!==i) {
   parent[i]=parent[parent[i]];
   i=parent[i];
  }
  return i;
 }
 for(let i=0;i<indices.count;i+=3) {
  const a=root(indices.getX(i));
  parent[root(indices.getX(i+1))]=a;
  parent[root(indices.getX(i+2))]=a;
 }
 const parts=new Map();
 for(let i=0;i<parent.length;i++) {
  const key=root(i);
  if(!parts.has(key)) parts.set(key,[]);
  parts.get(key).push(i);
 }
 return parts.values();
}

function grainFrame(points) {
 const half=points.length/2;
 const axis=new T.Vector3();
 const candidate=new T.Vector3();
 // The first ring is a convex face, the second its counterpart. Its true
 // perimeter edges and extruded edges are valid wood directions; triangle
 // diagonals introduced by the GLB exporter are deliberately excluded.
 if(Number.isInteger(half) && half>=3) {
  for(let j=0;j<half;j++) {
   candidate.subVectors(points[(j+1)%half],points[j]);
   if(candidate.lengthSq()>axis.lengthSq()) axis.copy(candidate);
   candidate.subVectors(points[j+half],points[j]);
   if(candidate.lengthSq()>axis.lengthSq()) axis.copy(candidate);
  }
 }
 if(axis.lengthSq()<1e-12) axis.set(1,0,0);
 axis.normalize();
 // Keep matching members visually parallel despite reversed face windings.
 const major=[axis.x,axis.y,axis.z].reduce((a,b)=>Math.abs(a)>Math.abs(b)?a:b);
 if(major<0) axis.negate();
 const reference=Math.abs(axis.y)>.94?new T.Vector3(0,0,1):new T.Vector3(0,1,0);
 const across=new T.Vector3().crossVectors(axis,reference).normalize();
 const deep=new T.Vector3().crossVectors(across,axis).normalize();
 return {axis,across,deep};
}

function makeUVs(mesh, profile) {
 const geometry=mesh.geometry, pos=geometry.attributes.position;
 if(geometry.attributes.uv || !pos || !geometry.index) return;
 const values=new Float32Array(2*pos.count);
 const layer=String(mesh.userData.layer||'');
 const onSoffit=profile.tile==='birch-panels' && /soffit|end wall/i.test(layer);
 const alongGrain=profile.kind==='wood' && !onSoffit;
 for(const ids of islands(geometry)) {
  const points=ids.map(i=>new T.Vector3().fromBufferAttribute(pos,i));
  const bounds=new T.Box3().setFromPoints(points), ext=bounds.getSize(new T.Vector3());
  const frame=alongGrain?grainFrame(points):null;
  let cellU,cellV;
  if(profile.kind==='pv' && points.length===8) {
   const edgeA=points[1].clone().sub(points[0]),edgeB=points[3].clone().sub(points[0]);
   [cellU,cellV]=edgeA.lengthSq()>=edgeB.lengthSq()?[edgeA,edgeB]:[edgeB,edgeA];
   cellU.divideScalar(Math.max(1e-8,cellU.lengthSq()));
   cellV.divideScalar(Math.max(1e-8,cellV.lengthSq()));
  }
  const seed=((ids[0]*997)%421)/421;
  const floor=ext.y <= Math.min(ext.x,ext.z);
  for(let j=0;j<ids.length;j++) {
   const p=points[j];
   let u,v;
   if(frame) {
    const sectionSide=p.dot(frame.across),sectionDepth=p.dot(frame.deep);
    u=p.dot(frame.axis)+.034*sectionSide;
    v=sectionSide+sectionDepth;
   } else if(onSoffit) {
    u=p.x;
    v=p.z;
    // The board's thin returns show grain across the thickness as well.
    if(ext.y<.12) v+=p.y-bounds.min.y;
   } else if(cellU) {
    // Normalize to one complete cell sheet per solar module.
    u=profile.size[0]*(p.dot(cellU)-points[0].dot(cellU));
    v=profile.size[1]*(p.dot(cellV)-points[0].dot(cellV));
   } else if(floor) {
    u=p.x+.45*p.y;v=p.z+.89*p.y;
   } else if(ext.x<ext.z) {
    u=p.z+.45*p.x;v=p.y+.89*p.x;
   } else {
    u=p.x+.45*p.z;v=p.y+.89*p.z;
   }
   const i=2*ids[j];
   values[i]=u/profile.size[0]+(alongGrain?seed:0);
   values[i+1]=v/profile.size[1]+(alongGrain?.29*seed:0);
  }
 }
 geometry.setAttribute('uv',new T.BufferAttribute(values,2));
}

// The exhibition compiler uses the same material scale and orientation when it
// creates a temporary textured GLB for offline rendering.
export function makeProposalFinishUVs(mesh) {
 const profile=finishes[mesh.material?.name];
 if(!mesh.isMesh || !profile) return null;
 if(profile.tile) makeUVs(mesh,profile);
 return profile;
}

export async function applyProposalFinishes(root,{caseStudy=false,maxAnisotropy=1}={}) {
 // Authored student materials and their texture coordinates belong to the
 // students. Only this registered teaching model has a matching finish spec.
 if(!caseStudy) return;
 const jobs=[],needed=new Set();
 root.traverse(mesh=>{
  if(!mesh.isMesh || Array.isArray(mesh.material)) return;
  const material=mesh.material, profile=finishes[material?.name];
  if(!profile||!material.isMeshStandardMaterial||material.map||material.normalMap||
    material.bumpMap||material.roughnessMap||material.metalnessMap) return;
  jobs.push({mesh,material,profile});
  if(profile.tile) needed.add(profile.tile);
 });
 const maps=new Map(await Promise.all([...needed].map(async name=>[name,await loadTile(name,maxAnisotropy)])));
 for(const {mesh,material,profile} of jobs) {
  const texture=maps.get(profile.tile);
  if(profile.tile && !texture) continue;
  if(texture) {
   makeProposalFinishUVs(mesh);
   if(!mesh.geometry.attributes.uv) continue;
   material.map=texture;
   if(profile.bump) {
    material.bumpMap=texture;
    material.bumpScale=profile.bump;
   }
  }
  material.userData.proposalFinish=profile.kind;
  if(profile.color!==undefined) material.color.setHex(profile.color);
  material.roughness=profile.rough;
  material.metalness=profile.metal;
  if(profile.opacity!==undefined) {
   material.transparent=true;
   material.opacity=profile.opacity;
   material.depthWrite=false;
  }
  material.needsUpdate=true;
 }
}
