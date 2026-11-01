// Usage: node evaluate-recognition-benchmark.mjs EXPORTED_PROJECT TRUTH_JSON
// Scores the exported recognition before a user edits it. This is a synthetic
// service benchmark, not a claim about accuracy on unrelated architectural plans.
import fs from 'node:fs';
import {materializeInterpretation,imagePoint} from '../../teaching/egress/src/semantic-plan.mjs';
import {inside,insideRoom,area,dist,lerp,roomPoint} from '../../teaching/egress/src/geometry.mjs';
import {doorPoints} from '../../teaching/egress/src/opening-identity.mjs';
import {doorSymbolLines} from '../../teaching/egress/src/door-symbol.mjs';

const project=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),truth=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const floor=project.floors[project.activeFloor||0],image=floor.image;
if(!image?.interpretation)throw Error('The exported project has no finished recognition preview.');
const model=materializeInterpretation(image.interpretation,image,{elevation:floor.elevation});
const point=([x,y])=>imagePoint(image,[x/truth.width*1000,y/truth.height*1000]);
const matchedExterior=new Set();
const spaces=truth.spaces.map(s=>{
 const points=(s.points||[[s.box[0],s.box[1]],[s.box[2],s.box[1]],[s.box[2],s.box[3]],[s.box[0],s.box[3]]]).map(point),center=roomPoint({points});
 if(s.kind==='exterior'){
  const found=model.features.filter(f=>['exterior','courtyard'].includes(f.kind)&&inside(center,f.points));
  found.forEach(f=>matchedExterior.add(f.id));
  return {name:s.name,expected:'exterior',found:found.length,indoorOverlap:model.rooms.some(r=>insideRoom(center,r)),coverCorrect:found.some(f=>f.roofState===s.roof)};
 }
 const found=model.rooms.filter(r=>insideRoom(center,r)),expectedArea=area(points);
 return {name:s.name,expected:s.kind,found:found.length,roomId:found[0]?.id,role:found[0]?.role,areaRelativeError:found.length===1?Math.abs(area(found[0].points)-expectedArea)/expectedArea:null};
});
const openings=[...model.candidates.map(c=>({...c,located:c.openingEvidence?.located===true&&!c.windowConflict&&!c.openingEvidence?.windowConflict})),...model.doors.map(d=>{
 const wall=model.walls.find(w=>w.id===d.wallId),symbol=doorSymbolLines(d,wall);
 return {...d,points:doorPoints(model,d),located:true,swingPoint:symbol[0]?.at(-1)};
})].filter(o=>o.points?.length>=2);
const matchedIds=new Set();
const doors=truth.doors.map(d=>{
 const a=point(d.a),b=point(d.b),center=lerp(a,b,.5),width=dist(a,b);
 const matches=openings.filter(o=>dist(center,lerp(...o.points.slice(0,2),.5))<.3&&Math.abs(dist(...o.points.slice(0,2))-width)/width<.25);
 matches.forEach(o=>matchedIds.add(o.id));
 const match=matches[0],cross=q=>(b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x);
 // Source y increases downwards, so the expected side reverses in world XY.
 return {name:d.name,expected:d.kind,matched:matches.length,sourceLocated:match?.located||false,type:match?.doorType||null,
  directionCorrect:d.kind==='sliding'?match?.doorType==='sliding':!!match?.swingPoint&&Math.sign(cross(match.swingPoint))===-d.side};
});
const interior=spaces.filter(s=>s.expected!=='exterior'),exterior=spaces.filter(s=>s.expected==='exterior');
console.log(JSON.stringify({
 summary:{expectedIndoor:truth.indoorSpaces,actualIndoor:model.rooms.length,uniqueIndoorMatches:new Set(interior.map(s=>s.roomId).filter(Boolean)).size,
  indoorAreaMatches:interior.filter(s=>s.areaRelativeError!==null&&s.areaRelativeError<.06).length,
  exteriorMatches:exterior.filter(s=>s.found>0&&!s.indoorOverlap).length,exteriorCoverMatches:exterior.filter(s=>s.coverCorrect).length,
  expectedDoorways:truth.doorways,doorwayMatches:doors.filter(d=>d.matched===1).length,sourceLocatedDoorways:doors.filter(d=>d.matched===1&&d.sourceLocated).length,
  directionMatches:doors.filter(d=>d.directionCorrect).length,extraDoorways:openings.filter(o=>!matchedIds.has(o.id)).length,
  extraExterior:model.features.filter(f=>['exterior','courtyard'].includes(f.kind)&&!matchedExterior.has(f.id)).length,
  pendingExterior:model.pendingFeatures.length,pendingSpaces:model.pendingSpaces?.length||0},
 spaces,doors,extraDoorways:openings.filter(o=>!matchedIds.has(o.id)).map(o=>({name:o.name,type:o.doorType,located:o.located,points:o.points})),
 repairs:image.recognitionRun?.repairs?.map(r=>({state:r.state,strategy:r.strategy,error:r.error}))||[]
},null,2));
