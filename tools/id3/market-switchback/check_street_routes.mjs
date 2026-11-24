// Sweep the actual proposal and all three district meshes, including sidewalk trees.
// node tools/id3/market-switchback/check_street_routes.mjs [proposal.glb]
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Vector3} from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';

globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});
const models=new URL('../../../teaching/id3/models/',import.meta.url);
async function load(file){
 const bytes=await readFile(file);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 scene.traverse(object=>{if(object.userData.initialHidden)object.visible=false;});
 return scene;
}
const proposal=await load(process.argv[2]||new URL('market-switchback.glb',models));
const district=new Group();
for(const name of ['urban-near','urban-core-materials','urban-outer']){
 district.add(await load(new URL(name+'.glb',models)));
}
const doors=new WalkDoors(proposal,{caseStudy:true});
for(const door of doors.entries)door.pose(1);
const surface=new WalkSurfaces([proposal,district],{doors});
const origin=-82.906;
const fourth=[[-5,21.56],[47.40,21.56],[49.65,21.10],[72.10,21.10]];
const routes=[['Covered market street',fourth],
 ['West cross-aisle',[[15.4904,21.56],[15.4904,52.265]]],
 ['East cross-aisle',[[27.6824,30.773],[27.6824,52.265]]],
 ['Fourth stair to north hall door',[[-5,9.52],[12.68,9.52],[12.68,5.80],[14.10,5.80]],true],
 ['Fourth stair to south hall door',[[-5,16.33],[14.10,16.33]],true],
 ['Detroit lobby apron',[[74,21.10],[61.28,21.10],[61.28,18.06]]],
 ['Detroit café apron',[[79.50,10.16],[69.76,10.16]]],
 ['Detroit to market ramp',[[74,21.1],[51.7,21.1],[51.7,24],[48.5,24]]]];
for(const [i,y] of [30.773,41.519,52.265].entries()){
 const approach=y-(i===2?1.35:0);
 const eastSidewalk=82.906-40.5383*y/57.912+3;
 routes.push(['Vendor aisle '+(i+1),[[-5,approach],[2,approach],[7,y],[eastSidewalk,y]]]);
}

function trace(name,points,stairs,initialLevel){
 let previous=null,samples=0;
 for(let j=1;j<points.length;j++){
  const [x0,y0]=points[j-1],[x1,y1]=points[j];
  const intervalCount=Math.ceil(Math.hypot(x1-x0,y1-y0)/.075);
  for(let i=0;i<=intervalCount;i++){
   const fraction=i/intervalCount,x=x0+(x1-x0)*fraction,y=y0+(y1-y0)*fraction;
   const min=previous?previous.y-.26:(initialLevel===undefined?-.6:initialLevel-.05);
   const max=previous?previous.y+.26:(initialLevel===undefined?3.4:initialLevel+.05);
   const level=surface.floorAt(origin+x,y,min,max);
   const location=name+' at '+x.toFixed(2)+', '+y.toFixed(2);
   assert.notEqual(level,null,'Missing floor or excessive step on '+location);
   const feet=new Vector3(origin+x,level,y);
   assert.ok(surface.canMove(previous||feet,feet,.22,1.78),'Body collision on '+location);
   // On flat and graded segments use a 1.2192 m diameter envelope. At steps
   // the larger disk would intersect the second riser before reaching the first.
   if(!stairs)assert.ok(surface.canStand(feet,48*.0254/2,1.90),'Pinched clearance on '+location);
   previous=feet;samples++;
  }
 }
 return samples;
}
let count=0;
for(const [label,points,stairs] of routes){
 count+=trace(label,points,stairs)+trace(label,[...points].reverse(),stairs);
}
// Start each direction on the specified deck to avoid accepting the parallel street below.
const inclineAndBridge=[[48.5,24.0],[5.48,24.0],[5.48,21.64],[48.60,21.64],
 [48.60,20.86],[65.00,20.86],[65.0,18.52]];
count+=trace('Market switchback to forum',inclineAndBridge,false,2.50);
count+=trace('Forum to market switchback',[...inclineAndBridge].reverse(),false,6.4116);
console.log(routes.length+' bidirectional street routes and the continuous switchback to the forum passed across '+count+' grade and clearance samples.');
