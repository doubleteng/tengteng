import {fresh} from './model.mjs?v=wall-rooms-1';

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
 next.activeFloor=fi;
 return {project:next,scope:mode==='site'?next.site:next.floors[fi],mode,destination};
}
