// A closed leaf remains the same mesh while it moves. FPS collisions and the
// renderer therefore use the same local geometry and current world transform.
import * as T from './lib/three.module.min.js';
import {roomPortals} from './market-doorways.js?v=3f16679216';
const ORIGIN_X=-82.906, HALF_TURN=Math.PI/2, WALK_REACH=2.8;
const interior='Interior / Partitions and doors';
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const tmpMatrix=new T.Matrix4(),rotation=new T.Matrix4(),translation=new T.Matrix4();
const targetRay=new T.Ray(),localRay=new T.Ray(),where=vec(),closest=vec();
const inverse=new T.Matrix4(),corners=new T.Box3();
const playerRadius=.24;

function visible(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}

// Single indexed mesh per leaf, with one draw group each for panel and fittings.
// The glulam/plywood map follows the height of the door in real metres.
const cube=new T.BoxGeometry();
function panelGeometry(width,height,glazed){
 const xyz=[],normals=[],uv=[],idx=[],ranges=[];
 function box(slot,x,y,z,w,h,d){
  const base=xyz.length/3,start=idx.length;
  const {position,normal}=cube.attributes;
  for(let i=0;i<position.count;i++){
   const X=x+position.getX(i)*w,Y=y+position.getY(i)*h,Z=z+position.getZ(i)*d;
   xyz.push(X,Y,Z);normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));
   uv.push(Y/2.4,(X+Z)/1.2);
  }
  for(const k of cube.index.array)idx.push(base+k);
  if(!ranges.length||ranges.at(-1).slot!==slot)ranges.push({start,count:0,slot});
  ranges.at(-1).count+=idx.length-start;
 }
 const frame=.043,thick=.046;
 if(glazed){
  box(0,width/2,height/2,0,width-2*frame,height-2*frame,.014);
  for(const x of [frame/2,width-frame/2])box(1,x,height/2,0,frame,height,thick);
  for(const y of [frame/2,height-frame/2])box(1,width/2,y,0,width-2*frame,frame,thick);
 }else box(0,width/2,height/2,0,width,height,thick);
 for(const s of [-1,1]){
  box(1,width-.11,1.00,s*.043,.025,.026,.040);
  box(1,width-.155,1.00,s*.064,.12,.024,.021);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
 for(const r of ranges)g.addGroup(r.start,r.count,r.slot);
 g.computeBoundingBox();g.userData.proposalLighting=true;return g;
}

function geometryBounds(object){
 const inverseWorld=object.matrixWorld.clone().invert(),bounds=new T.Box3();
 object.traverse(o=>{
  if(!o.isMesh||!o.geometry?.attributes.position)return;
  o.geometry.computeBoundingBox();
  bounds.union(corners.copy(o.geometry.boundingBox).applyMatrix4(tmpMatrix.multiplyMatrices(inverseWorld,o.matrixWorld)));
 });
 return bounds;
}

// Rotate rigidly about a vertical line through an explicit point, retaining
// parent transforms and glTF node origins (including mirrored blocks).
function swing(node,localHinge,angle){
 const rest=node.matrix.clone(),auto=node.matrixAutoUpdate;
 const restWorld=node.matrixWorld.clone(),pivot=localHinge.clone().applyMatrix4(restWorld);
 return function pose(open){
  if(open===0){node.matrix.copy(rest);node.matrixAutoUpdate=auto;}
  else{
   rotation.makeRotationY(open*angle);
   tmpMatrix.makeTranslation(pivot.x,pivot.y,pivot.z).multiply(rotation)
    .multiply(translation.makeTranslation(-pivot.x,-pivot.y,-pivot.z)).multiply(restWorld);
   node.matrix.copy(inverse.copy(node.parent.matrixWorld).invert().multiply(tmpMatrix));
   node.matrixAutoUpdate=false;
  }
  node.matrixWorldNeedsUpdate=true;node.updateWorldMatrix(false,true);
 };
}
function doorRecord(label,meshes,pose,initial=0){
 // Store tight closed OBBs in addition to the moving leaves, so looking back
 // through an open doorway also reaches its handle.
 pose(0);
 const closed=meshes.map(mesh=>{
  mesh.userData.walkDoor=true;
  mesh.geometry.computeBoundingBox();
  return {mesh,world:mesh.matrixWorld.clone()};
 });
 pose(initial);
 return {label,meshes,closed,pose,initial,value:initial,open:!!initial};
}

function caseLeaves(root,doors){
 const source=new Map();
 root.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material))source.set(o.material.name,o.material);});
 const glass=source.get('Vision glass'),wood=source.get('Oiled birch'),metal=source.get('Galvanized silver');
 if(!glass||!wood||!metal)return;
 function install(label,axis,plane,a,b,floor,height,glazed,side,layer=interior){
  const trimmed=layer!==interior||(!axis&&plane===3.65)||label==='East stair gallery';
  const width=b-a,jamb=trimmed?.16:(glazed?.052:.018);
  const count=width>1.45?2:1,span=(width-2*jamb)/count-.004;
  if(span<.52)return;
  const members=[],motions=[];
  for(let i=0;i<count;i++){
   const reversed=i===1,location=reversed?b-jamb:a+jamb;
   const mesh=new T.Mesh(panelGeometry(span,height-.034,glazed),[glazed?glass:wood,metal]);
   mesh.name=label+' door leaf';mesh.userData.layer=layer;mesh.userData.projectSurface=true;
   mesh.position.set((axis?plane:location)+ORIGIN_X,floor+.012,axis?location:plane);
   mesh.rotation.y=(axis?-HALF_TURN:0)+(reversed?Math.PI:0);
   root.add(mesh);mesh.updateWorldMatrix(true,false);
   motions.push(swing(mesh,vec(),side*(reversed?-1:1)*HALF_TURN));members.push(mesh);
  }
  doors.push(doorRecord(label,members,v=>motions.forEach(f=>f(v))));
 }
 const labels=[[0,'Large hall'],[7,'Small hall'],[11,'Classroom'],[15,'Office'],[21,'Staff room'],
  [23,'Washroom'],[24,'Hall support'],[25,'Washroom'],[27,'Service room'],[30,'Café kitchen'],
  [32,'Hall support'],[33,'Lower-ground room'],[41,'Teaching suite washroom'],[42,'East stair gallery']];
 let label=0;
 roomPortals.forEach(([axis,plane,left,right,floor,height],i)=>{
  if(label+1<labels.length&&labels[label+1][0]===i)label++;
  const glazed=i<2||i===21||i===22;
  // Office and service leaves open into their room, outside the public aisle.
  const interiorSide=(i>=18&&i<=21)||i===23||(i>=25&&i<=29)||i===32||i===41? -1 : 1;
  const side=axis?(i<2?-1:interiorSide):(i>=11&&i<15?(plane===9.35?1:-1):interiorSide);
  install(labels[label][1],axis,plane,left,right,floor,height,glazed,side);
 });
 // Exterior openings with trimmed jambs and floors/landings, from shell_skin.py.
 const shellDoors='Enclosure / Portal reveals';
 install('East entrance',0,17.94,60.08,62.48,2.50,2.50,true,-1,shellDoors);
 install('Café entrance',1,69.85,9.18,11.15,2.50,2.65,true,1,shellDoors);
 install('Upper gallery',0,17.94,64.10,65.90,6.4116,2.45,true,-1,shellDoors);
 install('Upper promenade',0,3.09,46.35,47.55,10.6788,2.40,true,1,shellDoors);
 install('Courtyard',0,6.90,46.34,47.83,6.4116,2.35,true,-1,shellDoors);
 install('Courtyard',1,47.95,10.75,12.65,6.4116,2.35,true,-1,shellDoors);
}

// The as-modeled large hall has three glass leaves parked in a stack at
// each jamb. Separate the three stacks located in the two real south portals.
// Their rest pose exactly reconstructs the original indexed geometry.
function foldingScreens(root,doors){
 const batch=root.children.find(o=>o.userData.layer===interior&&o.material?.name==='Vision glass');
 if(!batch)return;
 const g=batch.geometry,index=g.index,pos=g.attributes.position;
 if(!index||index.count%36)return;
 const banks=[{x:19.23,sign:-1},{x:29.39,sign:1},{x:34.47,sign:-1}];
 const bankParts=banks.map(()=>[]),keep=[];
 for(let start=0;start<index.count;start+=36){
  const faces=Array.from(index.array.subarray(start,start+36)),vertices=[...new Set(faces)];
  const bounds=new T.Box3();
  for(const n of vertices)bounds.expandByPoint(where.fromBufferAttribute(pos,n));
  const bank=banks.findIndex(b=>Math.abs(bounds.min.x-ORIGIN_X-b.x-.078*Math.round((bounds.min.x-ORIGIN_X-b.x)/.078))<.001&&
   bounds.min.x-ORIGIN_X>=b.x-.001&&bounds.min.x-ORIGIN_X<b.x+.16);
  if(bank<0||vertices.length!==8||Math.abs(bounds.min.z-18.23)>.001||
    Math.abs(bounds.max.z-18.96)>.001||Math.abs(bounds.min.y-2.5)>.001||
    Math.abs(bounds.max.y-5.08)>.001||Math.abs((bounds.max.x-bounds.min.x)-.043)>.001){
   keep.push(...faces);continue;
  }
  bankParts[bank].push({faces,vertices,bounds});
 }
 if(!bankParts.every(parts=>parts.length===3))return;
 g.setIndex(keep);
 banks.forEach(({sign},b)=>{
  const parts=bankParts[b].sort((a,c)=>a.bounds.min.x-c.bounds.min.x),meshLeaves=[];
  const startX=parts[0].bounds.getCenter(vec()).x;
  const poses=parts.map(({vertices,faces,bounds},k)=>{
   const leafGeometry=new T.BufferGeometry();
   for(const [key,attr] of Object.entries(g.attributes)){
    const values=[];
    for(const n of vertices)for(let c=0;c<attr.itemSize;c++)values.push(attr.getComponent(n,c));
    leafGeometry.setAttribute(key,new T.Float32BufferAttribute(values,attr.itemSize));
   }
   leafGeometry.setIndex(faces.map(n=>vertices.indexOf(n)));
   leafGeometry.userData.proposalLighting=g.userData.proposalLighting;
   const z0=bounds.min.z,z1=bounds.max.z,width=z1-z0,X=bounds.getCenter(vec()).x;
   const pivot=vec(X,bounds.min.y,k%2?z1:z0);
   leafGeometry.translate(-pivot.x,-pivot.y,-pivot.z);
   const leaf=new T.Mesh(leafGeometry,batch.material);leaf.name='Market hall folding door leaf';
   leaf.userData.layer=interior;leaf.userData.projectSurface=true;root.add(leaf);meshLeaves.push(leaf);
   return open=>{
    const angle=(1-open)*HALF_TURN;
    leaf.position.set(startX+(X-startX)*Math.cos(angle)+sign*k*width*Math.sin(angle),pivot.y,z0+(k%2)*width*Math.cos(angle));
    leaf.rotation.y=sign*(k%2?-angle:angle);leaf.updateWorldMatrix(false,false);
   };
  });
  doors.push(doorRecord('Market hall folding screen',meshLeaves,v=>poses.forEach(f=>f(v)),1));
 });
}

function authoredDoors(root,doors){
 const claimed=new Set();
 root.traverse(o=>{
  if(o===root||!o.isMesh&&!o.isGroup&&!o.isObject3D)return;
  for(let p=o.parent;p&&p!==root;p=p.parent)if(claimed.has(p))return;
  const tag=o.userData.walkDoor;
  const name=(o.userData.name||o.name||'').replace(/_/g,' ');
  // Metadata allows multipart leaves, e.g. glTF extras
  // {walkDoor:{label:'Lobby',hinge:[localX,localY,localZ],angle:-90}}.
  // Infer only single upright meshes. A whole block often includes its jamb.
  const identifier=name.split(/[/|:]/).at(-1).trim();
  const named=o.isMesh&&(/(?:^|\b)door\b/i.test(identifier)||/门扇|門扇/.test(identifier))&&
   !/frame|handle|jamb|sill|casing|lintel|opening|shaft|lift|elevator|garage|sliding|folding|threshold|closer|hardware|hinge|doorway|doors\b/i.test(identifier);
  if(tag===false||!tag&&!named)return;
  const leaves=[];o.traverse(c=>{if(c.isMesh)leaves.push(c);});if(!leaves.length)return;
  const box=geometryBounds(o),size=box.getSize(vec());
  if(!tag&&(Math.max(size.x,size.z)>2.8||Math.min(size.x,size.z)>.55||size.y<1.25||size.y>3.7))return;
  const options=typeof tag==='object'?tag:{};
  const hinge=box.getCenter(vec()),wide=size.x>=size.z?'x':'z';
  hinge[wide]=options.hingeSide==='right'?box.max[wide]:box.min[wide];hinge.y=box.min.y;
  if(Array.isArray(options.hinge)&&options.hinge.length===3&&options.hinge.every(Number.isFinite))hinge.fromArray(options.hinge);
  const degrees=Number.isFinite(options.angle)?T.MathUtils.clamp(options.angle,-150,150):90;
  const motion=swing(o,hinge,T.MathUtils.degToRad(degrees));
  claimed.add(o);doors.push(doorRecord(options.label||name||'Door',leaves,motion));
 });
}

function rayHitBox(mesh,matrix){
 localRay.copy(targetRay).applyMatrix4(inverse.copy(matrix).invert());
 if(!localRay.intersectBox(mesh.geometry.boundingBox,where))return Infinity;
 return where.applyMatrix4(matrix).distanceTo(targetRay.origin);
}

function hitsBody(door,eye){
 if(!eye)return false;
 for(const mesh of door.meshes){
  if(!visible(mesh))continue;
  // Clamp torso, knee and head samples to each transformed panel's local
  // bounds. A world-space distance also works under nonuniform parent scale.
  inverse.copy(mesh.matrixWorld).invert();
  for(const dy of [-1.31,-.72,0]){
   where.copy(eye);where.y+=dy;
   closest.copy(where).applyMatrix4(inverse);
   mesh.geometry.boundingBox.clampPoint(closest,closest).applyMatrix4(mesh.matrixWorld);
   if(closest.distanceToSquared(where)<playerRadius**2)return true;
  }
 }
 return false;
}

export class WalkDoors{
 constructor(project,{caseStudy=false}={}){
  this.entries=[];this.active=new Set();
  project.updateWorldMatrix(true,true);authoredDoors(project,this.entries);
  if(caseStudy){foldingScreens(project,this.entries);caseLeaves(project,this.entries);}
  this.meshes=this.entries.flatMap(d=>d.meshes);
 }
 get moving(){return this.active.size>0;}
 target(eye,direction,blockDistance=WALK_REACH){
  targetRay.set(eye,direction);
  let nearest=Math.min(WALK_REACH,blockDistance+.035),candidate=null;
  for(const door of this.entries)for(const {mesh,world} of door.closed){
   if(!visible(mesh))continue;
   let d=rayHitBox(mesh,mesh.matrixWorld);
   if(door.value>0)d=Math.min(d,rayHitBox(mesh,world));
   if(d<=nearest){nearest=d;candidate=door;}
  }
  return candidate;
 }
 toggle(door,eye){
  if(!door)return false;
  const next=door.open?0:1,stops=Math.ceil(Math.abs(next-door.value)*12);
  let clear=true;
  for(let i=1;eye&&i<=stops;i++){
   door.pose(door.value+(next-door.value)*i/stops);
   if(hitsBody(door,eye)){clear=false;break;}
  }
  door.pose(door.value);if(!clear)return false;
  door.open=!!next;this.active.add(door);return true;
 }
 update(dt,eye){
  let changed=false;
  for(const d of this.active){
   const goal=d.open?1:0,step=T.MathUtils.clamp(dt,0,.1)*3.5;
   const next=d.open?Math.min(goal,d.value+step):Math.max(goal,d.value-step);
   d.pose(next);
   if(hitsBody(d,eye)){d.pose(d.value);this.active.delete(d);d.open=d.value>.5;continue;}
   changed ||= d.value!==next;d.value=next;if(next===goal)this.active.delete(d);
  }
  return changed;
 }
 reset(){
  for(const d of this.entries)if(d.value!==d.initial||this.active.has(d)){
   d.pose(d.initial);d.open=!!d.initial;d.value=d.initial;
  }
  this.active.clear();
 }
}
