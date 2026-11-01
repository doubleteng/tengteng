import {usableFurnitureGeometry} from './furniture-evidence.mjs?v=auto-enclosure-1';
import {normalizeSanitaryElements,sanitaryKinds} from './sanitary-elements.mjs?v=door-detection-1';
import {windowOverlaps} from './door-evidence.mjs?v=auto-enclosure-1';
import {doorAssembly} from './door-assembly.mjs?v=door-detection-1';
import {deduplicateOpenings,matchingDoor,reconcileOpeningCandidates,doorPoints} from './opening-identity.mjs?v=auto-enclosure-1';
export {deduplicateOpenings} from './opening-identity.mjs?v=auto-enclosure-1';
import {openingHost,openingSpaces} from './import-quality.mjs?v=auto-enclosure-1';
import {enableWallRooms,syncEnclosedRooms} from './editable-plan.mjs?v=auto-enclosure-1';
import {area,dist,edges,inside,project,segDist,uid} from './geometry.mjs?v=auto-enclosure-1';

export const semanticKinds=['room','corridor','lobby','exterior','courtyard','void','projection','furniture','column','stair','window','wall','door','entrance',...sanitaryKinds];
export const semanticColors={room:'#507fa6',corridor:'#e5a42f',lobby:'#b78cde',exterior:'#7da971',courtyard:'#64a795',void:'#c66e71',projection:'#8b9199',furniture:'#99816b',column:'#8c7464',stair:'#9b72bc',window:'#62a9c0',wall:'#254f47',door:'#d97830',entrance:'#d34936','toilet-compartment':'#9aaea7','toilet-partition':'#82978f','toilet-door':'#82978f','sanitary-fixture':'#9aaea7'};
const text=x=>String(x??'').slice(0,180);
export function validateInterpretation(input){
  if(!input||input.version!==1||!Array.isArray(input.elements)||input.elements.length>2000)throw Error('Invalid architectural interpretation.');
  const seen=new Set(),warnings=(input.warnings||[]).slice(0,50).map(text),elements=[];
  for(const item of input.elements){
    if(!semanticKinds.includes(item.kind))throw Error('Unknown architectural element type.');
    if(typeof item.id!=='string'||!item.id||seen.has(item.id))throw Error('Architectural element IDs must be unique.');seen.add(item.id);
    if(!Array.isArray(item.points)||item.points.length>160)throw Error('Invalid element geometry.');
    const points=item.points.map(q=>{if(!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000))throw Error('Element coordinates must be between 0 and 1000.');return [q[0],q[1]];});
    const line=['wall','door','entrance','window','toilet-partition','toilet-door'].includes(item.kind);
    if(points.length<(line?2:3))throw Error('An element has incomplete geometry.');
    if(!line&&area(points.map(([x,y])=>({x,y})))<1){warnings.push(text(item.label)+': empty polygon omitted.');continue;}
    elements.push({id:item.id,kind:item.kind,label:text(item.label||item.kind),points,confidence:['high','medium','low'].includes(item.confidence)?item.confidence:'low',evidence:text(item.evidence),confirmed:item.confirmed===true,...(item.sourceGeometry?.version===1&&['fitted','unresolved'].includes(item.sourceGeometry.status)?{sourceGeometry:{version:1,status:item.sourceGeometry.status,coverage:Math.max(0,Math.min(1,Number(item.sourceGeometry.coverage)||0)),note:text(item.sourceGeometry.note)}}:{}),...(item.roomUse==='restroom'?{roomUse:'restroom'}:{}),...(['door','entrance'].includes(item.kind)?doorAssembly(item):{}),...(Array.isArray(item.mergedSourceIds)?{mergedSourceIds:[...new Set(item.mergedSourceIds.filter(x=>typeof x==='string').map(text))].slice(0,200)}:{}),...(Number.isFinite(item.sourceBand)?{sourceBand:Math.max(0,Math.min(40,item.sourceBand))}:{}),...(item.openingEvidence?.located===true?{openingEvidence:{located:true,method:item.openingEvidence.method==='swing-and-jambs'?'swing-and-jambs':'jambs',swingScore:Math.max(0,Math.min(1,Number(item.openingEvidence.swingScore)||0)),autoDoor:item.openingEvidence.autoDoor===true,windowConflict:text(item.openingEvidence.windowConflict),...(Array.isArray(item.openingEvidence.swingPoint)&&item.openingEvidence.swingPoint.length===2&&item.openingEvidence.swingPoint.every(v=>Number.isFinite(v)&&v>=0&&v<=1000)?{swingPoint:[...item.openingEvidence.swingPoint]}:{})}}:{}),...(item.sourceCheck&&Number.isFinite(item.sourceCheck.coverage)?{sourceCheck:{coverage:Math.max(0,Math.min(1,item.sourceCheck.coverage)),missingPixels:Math.max(0,Number(item.sourceCheck.missingPixels)||0),samples:Math.max(0,Number(item.sourceCheck.samples)||0)}}:{})});
  }
  const outline=Array.isArray(input.outline)?input.outline:[];
  if(outline.length>160||outline.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000)))throw Error('Invalid floor enclosure.');
  return {version:1,summary:text(input.summary),outline,elements:normalizeSanitaryElements(elements),warnings,...([1,2,3,4].includes(input.sourceRefinement?.version)?{sourceRefinement:{version:input.sourceRefinement.version,signature:String(input.sourceRefinement.signature||'').slice(0,16),sourceWidth:Number(input.sourceRefinement.sourceWidth)||0,sourceHeight:Number(input.sourceRefinement.sourceHeight)||0}}:{})};
}
export function imagePoint(image,q){const c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0),x=q[0]/1000*image.width,y=(1-q[1]/1000)*image.height;return{x:image.x+c*x-s*y,y:image.y+s*x+c*y};}
export function featureObstacles(floor){return (floor.features||[]).filter(f=>f.blocksMovement===true&&['furniture','column'].includes(f.kind)&&usableFurnitureGeometry(f));}
export function excludedSpaces(floor){return (floor.features||[]).filter(f=>['courtyard','void','exterior'].includes(f.kind));}

// Correct old automatically detected objects when explicit window evidence is
// already present. Keep manually confirmed decisions and the original ID.
export function reconcileDetectedWindows(floor){
 const windows=(floor.features||[]).filter(o=>o.kind==='window');if(!windows.length)return false;
 const rejected=new Set();
 for(const d of floor.doors||[]){
  if(!d.recognition?.autoDetected||d.recognition.reviewed||d.exitConfirmed===true)continue;
  const points=doorPoints(floor,d);if(!points||!windowOverlaps(...points,windows))continue;
  floor.candidates??=[];floor.candidates.push({id:d.id,name:d.name,points,...doorAssembly(d),recognition:d.recognition,kind:'door',suggestedExit:false,windowConflict:'Window symbol overlaps this opening.',detectionReason:'Window symbol overlaps this opening. Not connected as a door or exit.'});rejected.add(d.id);
 }
 if(rejected.size)floor.doors=floor.doors.filter(d=>!rejected.has(d.id));
 return rejected.size>0;
}

// Semantic polygons supply labels; closed walls define rooms. Furniture is NEVER an input to the
// room graph. Located interior doors can connect spaces; exterior openings
// become proposed ground-floor exits only when the visible swing faces outdoors.
export function materializeInterpretation(result,image,{include=new Set(result.elements.map(e=>e.id)),defaultThickness=.15,deriveRooms=true,elevation=null}={}){
  if(!image.calibrated)throw Error('Calibrate a known dimension before creating the analysis model.');
  const batch=uid(),out={...(Number.isFinite(elevation)?{elevation}:{}),outline:result.outline.map(q=>imagePoint(image,q)),rooms:[],walls:[],doors:[],stairs:[],features:[],candidates:[],recognition:{batch,summary:result.summary,warnings:[...result.warnings],reviewed:false}};
  const selected=normalizeSanitaryElements(result.elements.filter(e=>include.has(e.id)));
  const common=e=>({id:uid(),name:e.label,recognition:{batch,sourceId:e.id,sourceIds:e.mergedSourceIds,confidence:e.confidence,evidence:e.evidence,reviewed:e.confirmed===true,sourceCheck:e.sourceCheck}});
  for(const e of selected){
    const points=e.points.map(q=>imagePoint(image,q)),o=common(e);
    if(['room','corridor','lobby'].includes(e.kind)){out.rooms.push({...o,points,roomUse:e.roomUse,role:e.kind,function:'business',group:'B',factor:150,basis:'gross',areaConfirmed:false,fromWalls:true});}
    else if(e.kind==='wall'){for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])>.01)out.walls.push({...o,id:uid(),a:points[i-1],b:points[i],thickness:defaultThickness});}
    else if(e.kind==='stair')out.stairs.push({...o,points,link:'Unlinked '+e.label,width:1.2,travelLength:null,protected:false,direction:'unknown',navigationConfirmed:false,navigationVersion:1,flightPath:[],destinationFloorId:null});
    else if(['door','entrance'].includes(e.kind))out.candidates.push({...o,...doorAssembly(e),kind:e.kind,points,openingEvidence:e.openingEvidence,swingPoint:e.openingEvidence?.swingPoint?imagePoint(image,e.openingEvidence.swingPoint):null,confirmed:false});
    else out.features.push({...o,kind:e.kind,points,sourceGeometry:e.sourceGeometry,blocksMovement:false});
  }
  if(out.walls.length>1500)throw Error('This interpretation has more than 1,500 wall segments. Read a smaller floor region before analysis.');
  // The source outline is a recognition hint, not an independent routing boundary.
  // Only explicit, reviewable wall elements become walls.
  out.candidates=deduplicateOpenings(out.walls,out.candidates);
  for(const c of out.candidates)c.windowConflict=c.openingEvidence?.windowConflict||(windowOverlaps(...c.points.slice(0,2),out.features.filter(o=>o.kind==='window'))?'Window symbol overlaps this opening.':'');
  if(deriveRooms){enableWallRooms(out);resolveDetectedOpenings(out);}
  return out;
}

export function confirmOpening(floor,candidate,{exit=false,width=null,reviewed=true}={}){
  if(candidate.windowConflict||windowOverlaps(...candidate.points.slice(0,2),(floor.features||[]).filter(o=>o.kind==='window')))throw Error('This opening overlaps window evidence. Correct the window / door classification before connecting it.');
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
  const door={id:uid(),...doorAssembly(candidate),name:candidate.name||'Door',wallId:wall.id,x:host.center.x,y:host.center.y,width:clear,exit,exitConfirmed:exit&&reviewed,detectedSwing:candidate.detectedSwing,discharge:exit&&floor.elevation===0?'site':'none',recognition:{...candidate.recognition,reviewed},sourceConnection:connection.labels};
  floor.doors.push(door);floor.candidates=merged.filter(c=>c.id!==candidate.id);reconcileOpeningCandidates(floor);if(floor.roomGeometry==='walls')syncEnclosedRooms(floor);return door;
}

// A swing alone is not a connection: require a unique host and two distinct
// spaces. Ground-floor outward doors become detected exits for design routing;
// their exit role, width and operating conditions still need confirmation.
export function resolveDetectedOpenings(floor){
 for(const c of [...(floor.candidates||[])]){
  if(c.windowConflict){c.suggestedExit=false;c.detectedSwing=null;c.detectionReason=c.windowConflict+' Not connected as a door or exit.';continue;}
  const host=openingHost(floor.walls,c.points),connection=openingSpaces(floor,c.points);
  const sides=connection.sides;
  c.sourceConnection=connection.labels;
  c.located=!host.error;
  c.suggestedExit=!host.error&&sides.every(s=>s.length===1)&&sides[0][0]!==sides[1][0]&&sides.some(s=>s[0]==='outside');
  const [a,b]=c.points,side=c.swingPoint?((b.x-a.x)*(c.swingPoint.y-a.y)-(b.y-a.y)*(c.swingPoint.x-a.x)):0;
  const swingSide=Math.abs(side)>1e-6?(side>0?1:0):null;
  c.detectedSwing=swingSide==null?null:{toward:connection.labels[swingSide],spaceId:sides[swingSide].length===1?sides[swingSide][0]:null};
  if(c.suggestedExit)c.kind='entrance';
  const connected=sides.every(s=>s.length===1)&&sides[0][0]!==sides[1][0];
  const supported=c.openingEvidence?.autoDoor&&c.openingEvidence.swingScore>=.55;
  const outward=c.detectedSwing?.spaceId==='outside',ground=Number.isFinite(floor.elevation)&&Math.abs(floor.elevation)<.001;
  c.detectionReason=host.error?'Door detected, but its wall is missing or disconnected. Restore the visible wall and jambs.':c.suggestedExit?(!ground?'Exterior door: confirm the route from this level.':!c.detectedSwing?'Exterior opening: swing direction is not visible.':!outward?'Door opens toward the interior: confirm its exit use.':'Outward-opening exterior door detected.'):'';
  if(host.error||!connected||!supported||c.suggestedExit&&(!ground||!outward))continue;
  const width=dist(...c.points.slice(0,2));if(width<.4||width>3.5)continue;
  const d=confirmOpening(floor,c,{reviewed:false,exit:c.suggestedExit});
  if(d.exit){d.name='Detected exit';d.exitConfirmed=false;}
  d.recognition={...d.recognition,reviewed:false,autoDetected:true};
  d.drawSwing=false;d.widthConfirmed=false;
 }
 return floor;
}
