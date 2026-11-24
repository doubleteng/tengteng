// A camera may pass under roofs, galleries and tree crowns. Only terrain and
// at-grade paving contribute to this height field, including when a layer is hidden.
export function isTerrain({mesh}) {
 if (mesh.userData.groundSurface) return true;
 const path = mesh.userData.atlasPath || mesh.userData.layer || mesh.name;
 return /(?:^|\/|::)\s*(?:terrain|topography|topo|ground|grade|market court paving|site paving|street pavement|sidewalks?)\s*(?:$|\/|::)/i.test(path);
}

// Test a segment against each ground triangle in the cells it crosses. Barycentric
// weights and the eye's height above the triangle plane are linear in travel time.
export class TerrainIndex {
 constructor(meshes) {
  this.cells = new Map();
  this.triangles = [];
  this.minX=Infinity;this.minZ=Infinity;
  let maxX=-Infinity,maxZ=-Infinity;
  for(const {bounds} of meshes){
   this.minX=Math.min(this.minX,bounds.min.x);this.minZ=Math.min(this.minZ,bounds.min.z);
   maxX=Math.max(maxX,bounds.max.x);maxZ=Math.max(maxZ,bounds.max.z);
  }
  const width=maxX-this.minX,depth=maxZ-this.minZ;
  this.step = Math.max(6, width/64, depth/64);
  for (const {vertices,indices} of meshes) {
   const count = indices?.length ?? vertices.count;
   for (let offset=0;offset<count;offset+=3) {
    const a=indices?.[offset]??offset, b=indices?.[offset+1]??offset+1, c=indices?.[offset+2]??offset+2;
    const x=vertices.getX(a), y=vertices.getY(a), z=vertices.getZ(a);
    const bx=vertices.getX(b)-x, by=vertices.getY(b)-y, bz=vertices.getZ(b)-z;
    const cx=vertices.getX(c)-x, cy=vertices.getY(c)-y, cz=vertices.getZ(c)-z;
    const det=bx*cz-bz*cx;
    if (Math.abs(det)<1e-9) continue;
    const id=this.triangles.length;
    this.triangles.push({x,y,z,ux:cz/det,uz:-cx/det,vx:-bz/det,vz:bx/det,by,cy,seen:0});
    const x0=this.cellX(x+Math.min(0,bx,cx)), x1=this.cellX(x+Math.max(0,bx,cx));
    const z0=this.cellZ(z+Math.min(0,bz,cz)), z1=this.cellZ(z+Math.max(0,bz,cz));
    for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){
     const key=iz*65+ix;
     if(!this.cells.has(key))this.cells.set(key,[]);
     this.cells.get(key).push(id);
    }
   }
  }
  this.query=0;
 }
 cellX(x){return Math.floor((x-this.minX)/this.step);}
 cellZ(z){return Math.floor((z-this.minZ)/this.step);}
 height(x,z) {
  if (!this.cells.size) return -Infinity;
  const ix=this.cellX(x),iz=this.cellZ(z);
  if(ix<0||iz<0||ix>64||iz>64)return -Infinity;
  let top=-Infinity;
  for(const id of this.cells.get(iz*65+ix)||[]){
   const t=this.triangles[id], px=x-t.x, pz=z-t.z;
   const u=t.ux*px+t.uz*pz,v=t.vx*px+t.vz*pz;
   if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)top=Math.max(top,t.y+t.by*u+t.cy*v);
  }
  return top;
 }
 safeFraction(a,b,clearance,limit) {
  if (!this.cells.size) return limit;
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const ix0=Math.max(0,this.cellX(Math.min(a.x,b.x))),ix1=Math.min(64,this.cellX(Math.max(a.x,b.x)));
  const iz0=Math.max(0,this.cellZ(Math.min(a.z,b.z))),iz1=Math.min(64,this.cellZ(Math.max(a.z,b.z)));
  const query=++this.query;
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
   for(const id of this.cells.get(iz*65+ix)||[]){
    const t=this.triangles[id];
    if(t.seen===query)continue;
    t.seen=query;
    const px=a.x-t.x,pz=a.z-t.z,u=t.ux*px+t.uz*pz,v=t.vx*px+t.vz*pz;
    const du=t.ux*dx+t.uz*dz,dv=t.vx*dx+t.vz*dz;
    let entry=0,exit=limit;
    for(const [start,delta] of [[u,du],[v,dv],[1-u-v,-du-dv]]){
     if(Math.abs(delta)<1e-12){if(start< -1e-8){exit=-1;break;}}
     else if(delta>0)entry=Math.max(entry,-start/delta);
     else exit=Math.min(exit,-start/delta);
    }
    if(entry>exit)continue;
    const height=a.y-clearance-t.y-t.by*u-t.cy*v, slope=dy-t.by*du-t.cy*dv;
    if(height+entry*slope< -1e-7)limit=entry;
    else if(height+exit*slope< -1e-7)limit=Math.min(limit,Math.max(entry,-height/slope));
   }
  }
  return limit;
 }
}
