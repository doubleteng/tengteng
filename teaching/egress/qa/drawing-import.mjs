import {fresh} from './model.mjs?v=topology-rebuild-2';

export function hasDrawingContent(project){
 return !!project.openings?.length||[...project.floors,project.site].some(scope=>
  !!scope.image||['outline','walls','doors','rooms','stairs','obstacles','cad','features','candidates','walkable','targets','routes','traces'].some(k=>scope[k]?.length));
}

// Prepare a separate model. Cancelling placement or decoding must not mutate
// the current design, its floors, site, source image, or recognition results.
export function stageDrawingImport(project,{destination,mode='building',floorId,name='Drawing'}){
 if(!['new','floor','current'].includes(destination))throw Error('Choose where this drawing belongs.');
 const next=destination==='new'?fresh():structuredClone(project);
 const title=name.replace(/\.[^.]+$/,'');
 let fi=project.floors.findIndex(f=>f.id===floorId);
 if(destination==='new'){
  next.name=title;next.units=project.units;fi=0;mode='building';
 }else if(destination==='floor'){
  if(next.floors.length>=30)throw Error('Maximum 30 floors.');
  const f=fresh().floors[0];f.name=title;f.elevation=Math.max(...next.floors.map(f=>f.elevation))+3.6;
  fi=next.floors.length;next.floors.push(f);mode='building';delete next.tutorial;
 }else if(fi<0)throw Error('The destination floor is no longer available.');
 // An explicit destination choice must never be reinterpreted as an old,
 // accidental example overlay when this design is restored later.
 next.importWorkflowVersion=2;next.activeFloor=fi;
 return {project:next,scope:mode==='site'?next.site:next.floors[fi],mode,destination};
}

const geometryKeys=['walls','doors','rooms','stairs','obstacles','features','candidates','traces','walkable','targets','routes'];
const uploadedImage=scope=>/^data:image\//.test(scope.image?.src||'');
const sourceTitle=image=>(image?.name||'Uploaded drawing').replace(/\.(png|jpe?g|pdf)(?=\s*·|$)/i,'');
function hasCaseWalls(floor,original){
 if(!original?.walls.length)return false;
 const ids=new Set((floor.walls||[]).map(w=>w.id));
 return original.walls.filter(w=>ids.has(w.id)).length>=Math.ceil(original.walls.length*.8);
}

// Older Upload plan releases put a student's source on top of a built-in
// case and autosaved both. Only repair a positively identified case whose
// original wall IDs still dominate the uploaded floor. Recognized student
// geometry has new IDs and must not be treated as example geometry.
export function repairLegacyCaseImport(project,template){
 if(project.importWorkflowVersion>=2||!template)return null;
 const caseFloors=new Map(template.floors.map(f=>[f.id,f]));
 const affected=project.floors.filter(f=>uploadedImage(f)&&hasCaseWalls(f,caseFloors.get(f.id)));
 if(!affected.length)return null;
 const next=structuredClone(project);
 delete next.precedent;delete next.tutorial;
 next.importWorkflowVersion=2;next.name=sourceTitle(affected[0].image);
 const strip=(scope,original)=>{
  for(const key of geometryKeys){
   const ids=new Set((original[key]||[]).map(o=>o.id));
   if(scope[key])scope[key]=scope[key].filter(o=>!ids.has(o.id));
  }
 };
 next.floors=next.floors.filter(f=>{
  const original=caseFloors.get(f.id);if(!hasCaseWalls(f,original))return true;
  strip(f,original);if(JSON.stringify(f.outline)===JSON.stringify(original.outline))f.outline=[];
  for(const key of ['semanticRooms','enclosures','spaceSeeds','pendingSpaces','roomGeometry','recognition'])delete f[key];
  if(uploadedImage(f))f.name=sourceTitle(f.image);
  else if(f.image?.src===original.image?.src)delete f.image;
  return uploadedImage(f)||['cad',...geometryKeys].some(k=>f[k]?.length);
 });
 strip(next.site,template.site);
 const openingIds=new Set((template.openings||[]).map(o=>o.id));
 if(next.openings)next.openings=next.openings.filter(o=>!openingIds.has(o.id)&&next.floors.some(f=>f.id===o.baseFloorId)&&next.floors.some(f=>f.id===o.throughFloorId));
 next.activeFloor=Math.max(0,next.floors.findIndex(f=>f.id===affected[0].id));
 next.importRepair={version:1,caseId:template.tutorial?.id,sourceProjectId:project.id};
 return next;
}
