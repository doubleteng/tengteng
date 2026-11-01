import {normalizeSanitaryElements} from './sanitary-elements.mjs?v=door-detection-1';
import {inside,insideRoom,bounds} from './geometry.mjs?v=auto-enclosure-1';

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
 const normalized=normalizeSanitaryElements(elements).map(item=>{
  const e={...item,...architecturalAttributes(item)},label=(e.label||'').trim();
  const fixtureLabel=/^(?:(?:individual|row of|bank of)\s+)?(?:wash\s*basins?|wash\s*sinks?|sinks?|urinals?|toilet\s+(?:bowl|pan|fixture)s?|bathtubs?|shower\s+trays?)\b|^(?:洗手盆|水斗|小便池|马桶|浴缸)(?:\s|\d|$)/i.test(label);
  // Bare "Toilet" may name a complete private room; do not demote it.
  if(!e.confirmed&&fixtureLabel&&!/\b(?:room|bathroom|restroom)\b/i.test(label))e.boundaryRole='fixture';
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
 // Older tiled results can contain a complete balcony plus a clipped copy
 // from an adjacent tile. Retain the complete footprint, not two areas or an
 // unnecessary pending repair. A different uncovered area remains pending.
 const outdoor=e=>['exterior','courtyard'].includes(e.kind);
 return normalized.filter(e=>{
  if(!e.partial||e.confirmed||!(outdoor(e)||e.kind==='void'))return true;
  const full=normalized.filter(v=>v!==e&&!v.partial&&(outdoor(e)?outdoor(v):v.kind==='void')).map(v=>({...v,points:v.points.map(([x,y])=>({x,y}))}));
  return !excludedCell({points:e.points.map(([x,y])=>({x,y}))},full);
 });
}

export function outdoorDescription(o){
 if(o.spaceLocation!=='exterior'&&!['exterior','courtyard'].includes(o.kind))return '';
 const type=(o.outdoorType||o.kind||'outdoors').replace(/-/g,' '),cover=o.roofState==='covered'?'Covered outdoors':o.roofState==='open'?'Open to sky':'Outdoors · roof not established';
 return cover+' · '+type;
}

// Semantic footprints often stop at the inside face of a thick wall, while
// the editable cell follows its centerline. Classify the occupied cell by
// spatial overlap; requiring every vertex to coincide leaves balconies indoors.
export function excludedCell(cell,features){
 const candidates=features.filter(f=>['exterior','courtyard','void'].includes(f.kind)&&f.points?.length>=3);
 if(!candidates.length)return false;
 const box=bounds(cell.points);let total=0;const hits=candidates.map(()=>0);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const p={x:box.minX+(x+.5)*(box.maxX-box.minX)/16,y:box.minY+(y+.5)*(box.maxY-box.minY)/16};
  if(!insideRoom(p,cell))continue;total++;
  candidates.forEach((f,i)=>{if(inside(p,f.points))hits[i]++;});
 }
 return total>0&&hits.some(n=>n/total>=.85);
}
