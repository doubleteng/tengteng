import {deduplicateOpenings,matchingDoor,reconcileOpeningCandidates} from './opening-identity.mjs?v=opening-identity-1';
export {deduplicateOpenings} from './opening-identity.mjs?v=opening-identity-1';
import {openingHost,openingSpaces} from './import-quality.mjs?v=portal-network-1';
import {enableWallRooms,syncEnclosedRooms} from './editable-plan.mjs?v=portal-network-1';
import {area,dist,edges,inside,project,segDist,uid} from './geometry.mjs?v=portal-network-1';

export const semanticKinds=['room','corridor','lobby','exterior','courtyard','void','projection','furniture','column','stair','window','wall','door','entrance'];
export const semanticColors={room:'#507fa6',corridor:'#e5a42f',lobby:'#b78cde',exterior:'#7da971',courtyard:'#64a795',void:'#c66e71',projection:'#8b9199',furniture:'#99816b',column:'#8c7464',stair:'#9b72bc',window:'#62a9c0',wall:'#254f47',door:'#d97830',entrance:'#d34936'};
const text=x=>String(x??'').slice(0,180);
export function validateInterpretation(input){
  if(!input||input.version!==1||!Array.isArray(input.elements)||input.elements.length>2000)throw Error('Invalid architectural interpretation.');
  const seen=new Set(),warnings=(input.warnings||[]).slice(0,50).map(text),elements=[];
  for(const item of input.elements){
    if(!semanticKinds.includes(item.kind))throw Error('Unknown architectural element type.');
    if(typeof item.id!=='string'||!item.id||seen.has(item.id))throw Error('Architectural element IDs must be unique.');seen.add(item.id);
    if(!Array.isArray(item.points)||item.points.length>160)throw Error('Invalid element geometry.');
    const points=item.points.map(q=>{if(!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000))throw Error('Element coordinates must be between 0 and 1000.');return [q[0],q[1]];});
    const line=['wall','door','entrance','window'].includes(item.kind);
    if(points.length<(line?2:3))throw Error('An element has incomplete geometry.');
    if(!line&&area(points.map(([x,y])=>({x,y})))<1){warnings.push(text(item.label)+': empty polygon omitted.');continue;}
    elements.push({id:item.id,kind:item.kind,label:text(item.label||item.kind),points,confidence:['high','medium','low'].includes(item.confidence)?item.confidence:'low',evidence:text(item.evidence),confirmed:item.confirmed===true,...(Array.isArray(item.mergedSourceIds)?{mergedSourceIds:[...new Set(item.mergedSourceIds.filter(x=>typeof x==='string').map(text))].slice(0,200)}:{}),...(Number.isFinite(item.sourceBand)?{sourceBand:Math.max(0,Math.min(40,item.sourceBand))}:{}),...(item.openingEvidence?.located===true?{openingEvidence:{located:true,method:item.openingEvidence.method==='swing-and-jambs'?'swing-and-jambs':'jambs',swingScore:Math.max(0,Math.min(1,Number(item.openingEvidence.swingScore)||0)),autoDoor:item.openingEvidence.autoDoor===true}}:{}),...(item.sourceCheck&&Number.isFinite(item.sourceCheck.coverage)?{sourceCheck:{coverage:Math.max(0,Math.min(1,item.sourceCheck.coverage)),missingPixels:Math.max(0,Number(item.sourceCheck.missingPixels)||0),samples:Math.max(0,Number(item.sourceCheck.samples)||0)}}:{})});
  }
  const outline=Array.isArray(input.outline)?input.outline:[];
  if(outline.length>160||outline.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000)))throw Error('Invalid floor enclosure.');
  return {version:1,summary:text(input.summary),outline,elements,warnings,...([1,2].includes(input.sourceRefinement?.version)?{sourceRefinement:{version:input.sourceRefinement.version,signature:String(input.sourceRefinement.signature||'').slice(0,16),sourceWidth:Number(input.sourceRefinement.sourceWidth)||0,sourceHeight:Number(input.sourceRefinement.sourceHeight)||0}}:{})};
}
export function imagePoint(image,q){const c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0),x=q[0]/1000*image.width,y=(1-q[1]/1000)*image.height;return{x:image.x+c*x-s*y,y:image.y+s*x+c*y};}
export function featureObstacles(floor){return (floor.features||[]).filter(f=>f.blocksMovement===true&&['furniture','column'].includes(f.kind));}
export function excludedSpaces(floor){return (floor.features||[]).filter(f=>['courtyard','void','exterior'].includes(f.kind));}

// Semantic polygons supply labels; closed walls define rooms. Furniture is NEVER an input to the
// room graph. Located interior doors can connect spaces; exterior openings
// remain candidates until the user confirms their role as an exit.
export function materializeInterpretation(result,image,{include=new Set(result.elements.map(e=>e.id)),defaultThickness=.15,deriveRooms=true}={}){
  if(!image.calibrated)throw Error('Calibrate a known dimension before creating the analysis model.');
  const batch=uid(),out={outline:result.outline.map(q=>imagePoint(image,q)),rooms:[],walls:[],doors:[],stairs:[],features:[],candidates:[],recognition:{batch,summary:result.summary,warnings:[...result.warnings],reviewed:false}};
  const selected=result.elements.filter(e=>include.has(e.id));
  const common=e=>({id:uid(),name:e.label,recognition:{batch,sourceId:e.id,sourceIds:e.mergedSourceIds,confidence:e.confidence,evidence:e.evidence,reviewed:e.confirmed===true,sourceCheck:e.sourceCheck}});
  for(const e of selected){
    const points=e.points.map(q=>imagePoint(image,q)),o=common(e);
    if(['room','corridor','lobby'].includes(e.kind)){out.rooms.push({...o,points,role:e.kind,function:'business',group:'B',factor:150,basis:'gross',areaConfirmed:false,fromWalls:true});}
    else if(e.kind==='wall'){for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])>.01)out.walls.push({...o,id:uid(),a:points[i-1],b:points[i],thickness:defaultThickness});}
    else if(e.kind==='stair')out.stairs.push({...o,points,link:'Unlinked '+e.label,width:1.2,travelLength:null,protected:false,direction:'unknown',navigationConfirmed:false,navigationVersion:1,flightPath:[],destinationFloorId:null});
    else if(['door','entrance'].includes(e.kind))out.candidates.push({...o,kind:e.kind,points,openingEvidence:e.openingEvidence,confirmed:false});
    else out.features.push({...o,kind:e.kind,points,blocksMovement:false});
  }
  if(out.walls.length>1500)throw Error('This interpretation has more than 1,500 wall segments. Read a smaller floor region before analysis.');
  // The occupied outline limits routing but is not evidence of a physical wall.
  // Only explicit, reviewable wall elements become walls.
  out.candidates=deduplicateOpenings(out.walls,out.candidates);
  if(deriveRooms){enableWallRooms(out);resolveDetectedOpenings(out);}
  return out;
}

export function confirmOpening(floor,candidate,{exit=false,width=null,reviewed=true}={}){
  const existing=matchingDoor(floor,candidate);if(existing)return existing;
  const merged=deduplicateOpenings(floor.walls,[candidate,...(floor.candidates||[]).filter(c=>c.id!==candidate.id)]);
  candidate=merged.find(c=>c.id===candidate.id||c.mergedCandidateIds?.includes(candidate.id))||candidate;
  const [a,b]=candidate.points,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},clear=width??dist(a,b);
  if(!(clear>.05&&clear<20))throw Error('Enter the measured clear opening width.');
  const host=openingHost(floor.walls,candidate.points,clear);
  if(host.error)throw Error(host.error);
  const connection=openingSpaces(floor,candidate.points);
  let wall=host.wall;
  if(host.gap){wall={id:uid(),...host.gap,openingHost:true,recognition:{...candidate.recognition,reviewed,evidence:(reviewed?'Confirmed':'Detected')+' opening between the source jambs.'}};floor.walls.push(wall);}
  const door={id:uid(),name:candidate.name||'Door',wallId:wall.id,x:host.center.x,y:host.center.y,width:clear,exit,discharge:exit&&floor.elevation===0?'site':'none',recognition:{...candidate.recognition,reviewed},sourceConnection:connection.labels};
  floor.doors.push(door);floor.candidates=merged.filter(c=>c.id!==candidate.id);reconcileOpeningCandidates(floor);if(floor.roomGeometry==='walls')syncEnclosedRooms(floor);return door;
}

// A swing alone is not a connection: require a unique host and two distinct
// enclosed spaces. An indoor/outdoor opening is identified, but not promoted
// to a code exit. Width and code assumptions still require review.
export function resolveDetectedOpenings(floor){
 for(const c of [...(floor.candidates||[])]){
  const host=openingHost(floor.walls,c.points),connection=openingSpaces(floor,c.points);
  const sides=connection.sides;
  c.sourceConnection=connection.labels;
  c.located=!host.error;
  c.suggestedExit=!host.error&&sides.every(s=>s.length===1)&&sides[0][0]!==sides[1][0]&&sides.some(s=>s[0]==='outside');
  if(c.suggestedExit){c.kind='entrance';continue;}
  if(host.error||c.kind!=='door'||!c.openingEvidence?.autoDoor||c.openingEvidence.swingScore<.55||sides.some(s=>s.length!==1||s[0]==='outside')||sides[0][0]===sides[1][0])continue;
  const width=dist(...c.points.slice(0,2));if(width<.4||width>3.5)continue;
  const d=confirmOpening(floor,c,{reviewed:false});
  d.recognition={...d.recognition,reviewed:false,autoDetected:true};
  d.drawSwing=false;d.widthConfirmed=false;
 }
 return floor;
}
