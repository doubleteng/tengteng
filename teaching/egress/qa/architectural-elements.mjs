import {normalizeSanitaryElements} from './sanitary-elements.mjs?v=door-detection-1';

const outdoorTypes=['balcony','terrace','porch','loggia','arcade','courtyard','site','other'];
const roofStates=['covered','open','unknown'];
const nonEnclosure=['furniture','fixture','movable','toilet-partition','annotation'];

// Spatial enclosure and overhead cover are independent properties. A closed
// railing or roof outline is not evidence of an indoor room.
export function architecturalAttributes(item){
 const out={};
 if(['interior','exterior','unknown'].includes(item.spaceLocation))out.spaceLocation=item.spaceLocation;
 if(outdoorTypes.includes(item.outdoorType))out.outdoorType=item.outdoorType;
 if(roofStates.includes(item.roofState))out.roofState=item.roofState;
 if(['enclosure','unknown',...nonEnclosure].includes(item.boundaryRole))out.boundaryRole=item.boundaryRole;
 return out;
}

export function normalizeArchitecturalElements(elements){
 return normalizeSanitaryElements(elements).map(item=>{
  const e={...item,...architecturalAttributes(item)},label=(e.label||'').trim();
  if(!e.confirmed&&nonEnclosure.includes(e.boundaryRole)){
   if(['wall','door','entrance','window'].includes(e.kind))e.kind=e.boundaryRole==='toilet-partition'?'toilet-partition':'reference-line';
   else if(['room','corridor','lobby'].includes(e.kind))e.kind=e.boundaryRole==='fixture'?'sanitary-fixture':'furniture';
  }
  // Only names identifying the space itself are used for legacy migration.
  // A bedroom with a balcony is still a bedroom; an enclosed sunroom is indoor.
  const named=!/\b(?:bedroom|living room|sunroom|enclosed|glazed)\b/i.test(label)&&label.match(/^(?:covered |open |outdoor |external |roof |upper |lower |\d+\s*[-:.]?\s*)*(balcony|terrace|porch|veranda|loggia|arcade|courtyard)\b/i);
  if(named&&!e.outdoorType)e.outdoorType=named[1].toLowerCase()==='veranda'?'porch':named[1].toLowerCase();
  const outdoor=e.spaceLocation==='exterior'||['exterior','courtyard'].includes(e.kind)||named&&e.spaceLocation!=='interior';
  if(outdoor&&['room','corridor','lobby','exterior','courtyard'].includes(e.kind)){
   e.kind=e.outdoorType==='courtyard'||e.kind==='courtyard'?'courtyard':'exterior';
   e.spaceLocation='exterior';e.outdoorType??=e.kind==='courtyard'?'courtyard':'other';
   e.roofState??=/\b(?:covered|canopy|loggia|arcade|veranda)\b/i.test(label)?'covered':/\b(?:uncovered|open.to.sky|unroofed)\b/i.test(label)?'open':'unknown';
  }
  return e;
 });
}

export function outdoorDescription(o){
 if(o.spaceLocation!=='exterior'&&!['exterior','courtyard'].includes(o.kind))return '';
 const type=(o.outdoorType||o.kind||'outdoors').replace(/-/g,' '),cover=o.roofState==='covered'?'Covered outdoors':o.roofState==='open'?'Open to sky':'Outdoors · roof not established';
 return cover+' · '+type;
}
