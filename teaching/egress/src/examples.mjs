import {usCaseStudies} from './us-case-studies.mjs?v=us-studies-2';
import {precedentExamples} from './precedents.mjs?v=stair-review-20261031';
import {fresh,functions} from './model.mjs?v=stair-review-20261031';
import {uid,edges,centroid,area} from './geometry.mjs?v=stair-review-20261031';
import {syncEnclosedRooms} from './editable-plan.mjs?v=stair-review-20261031';
import {doorSwingCheck,siteWidthChecks} from './plan-code.mjs?v=stair-review-20261031';
import {roomArea} from './openings.mjs?v=stair-review-20261031';

const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function wall(f,id,a,b){const w={id,a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},thickness:.15};f.walls.push(w);return w;}
function envelope(f,points){f.outline=points;f.walls=edges(points).map(([a,b],i)=>({id:f.id+'-w'+i,a:{...a},b:{...b},thickness:.15,boundary:true}));}
function door(f,id,wallId,x,y,exit=false){const d={id,name:id,wallId,x,y,width:1.2,swing:'with',exit,discharge:exit?'site':'none'};f.doors.push(d);return d;}
function use(r,name,key){Object.assign(r,{name,function:key,factor:functions[key].factor,basis:functions[key].basis,group:functions[key].group,areaConfirmed:true});return r;}
function site(p,w,h){
 p.site.walkable=[{id:'grounds',name:'Walkable grounds',points:rect(-8,-5,w+16,h+10)}];
 p.site.targets=[{id:'public-west',name:'West public sidewalk',kind:'public',x:-7,y:7},{id:'public-east',name:'East public sidewalk',kind:'public',x:w+7,y:7}];
 p.site.routes=[{id:'west-path',name:'West discharge path',kind:'pedestrian',egressRole:'discharge',servedExitIds:['west-exit'],width:1.8,points:[{x:0,y:7},{x:-7,y:7}]},{id:'east-path',name:'East accessible discharge',kind:'accessible',egressRole:'discharge',servedExitIds:['east-exit'],width:1.8,slope:2,crossSlope:1,points:[{x:w,y:7},{x:w+7,y:7}]}];
}
function roomsCase(){
 const p=fresh(),f=p.floors[0];f.id='rooms-ground';envelope(f,rect(0,0,24,14));
 wall(f,'south-corridor',[0,6],[24,6]);wall(f,'north-corridor',[0,8],[24,8]);wall(f,'studio-divider',[12,0],[12,6]);
 syncEnclosedRooms(f);
 for(const r of f.rooms){const c=centroid(r.points);if(c.y>8){r.id='gallery';use(r,'Exhibition','gallery');}else if(c.y>6){r.id='corridor';use(r,'Shared corridor','business');r.role='corridor';}else if(c.x<12){r.id='workshop';use(r,'Workshop','tables');r.areaConfirmed=false;}else{r.id='studio';use(r,'Design studio','business');}}
 Object.assign(door(f,'workshop-door','south-corridor',3,6),{name:'Workshop door A',width:.7,swing:'against'});
 door(f,'workshop-door-b','south-corridor',9,6).name='Workshop door B';door(f,'studio-door','south-corridor',18,6).name='Studio door';
 door(f,'gallery-door-a','north-corridor',6,8).name='Gallery door A';door(f,'gallery-door-b','north-corridor',18,8).name='Gallery door B';
 door(f,'west-exit',f.walls[3].id,0,7,true).name='West exit';door(f,'east-exit',f.walls[1].id,24,7,true).name='East exit';
 f.features=[{id:'table',kind:'furniture',name:'Workshop table',points:rect(4,2,3,1.2),blocksMovement:false}];site(p,24,14);return p;
}
function siteCase(){
 const p=fresh(),f=p.floors[0];f.id='site-ground';envelope(f,rect(0,0,18,14));syncEnclosedRooms(f);use(f.rooms[0],'Community room','reading');f.rooms[0].id='community';
 door(f,'west-exit',f.walls[3].id,0,7,true).name='West exit';door(f,'east-exit',f.walls[1].id,18,7,true).name='East exit';site(p,18,14);
 Object.assign(p.site.routes[0],{name:'West egress court',egressRole:'court',width:.9});
 p.site.routes.push({id:'service',name:'Service drive',kind:'vehicle',width:3,points:[{x:-4,y:-3},{x:-4,y:17}]});
 p.site.obstacles=[{id:'garden',name:'Rain garden',points:rect(20,10,3,4)}];return p;
}
function levelsCase(){
 const p=fresh();p.floors=[];
 for(let i=0;i<3;i++){
  const f=fresh().floors[0];f.id='level-'+i;f.name=['Ground floor','Level 2','Level 3 · setback'][i];f.elevation=i*3.6;
  envelope(f,i===2?rect(2,0,18,14):rect(0,0,20,14));syncEnclosedRooms(f);use(f.rooms[0],['Ground studio','Upper studio','Top studio'][i],'business');f.rooms[0].id='room-'+i;
  f.stairs=[{id:'stair-'+i,name:'West stair · '+f.name,link:i===2?'Unlinked stair':'Stair A',points:rect(3,6,2,3),width:1.3,travelLength:7.2,protected:true}];
  if(!i){door(f,'west-exit',f.walls[3].id,0,7,true).name='West exit';door(f,'east-exit',f.walls[1].id,20,7,true).name='East exit';}p.floors.push(f);
 }
 p.openings=[{id:'atrium',name:'Studio lightwell',baseFloorId:'level-0',throughFloorId:'level-1',points:rect(8,5,4,4)}];site(p,20,14);return p;
}
// Keep authorship and guide IDs for projects saved in earlier releases.
// Historic models are not offered as IBC reference buildings.
export const examples=[...usCaseStudies,
 {id:'rooms',number:'01',title:'Rooms, doors + people',subtitle:'Start here · 6–8 min',tag:'INDOOR PLAN',description:'Read a room load, repair a narrow doorway, then move a wall and watch the plan recalculate.',skills:['Select + Properties','Live area / load','Wall editing'],build:roomsCase,steps:[
  {title:'Read the plan',text:'Wheel to zoom; hold the right mouse button to pan. Select Workshop to see its area, use and people. The table is furniture, not a room boundary.',action:'Select Workshop',target:'workshop',tab:'properties'},
  {title:'Confirm the room use',text:'Workshop is set to Assembly: tables + chairs. Compare the area-per-person calculation with the room area, then tick “I checked the area basis”. Try another use and watch the people count change.',action:'Review room inputs',target:'workshop',tab:'properties',goal:'room-input'},
  {title:'Repair the doorway',text:'Select Workshop door A. Change its clear width from 0.70 m to 1.20 m, and its swing to “With egress travel”. Checks update automatically. These are practice dimensions; see Code for the calculated requirement.',action:'Edit Workshop door A',target:'workshop-door',tab:'properties',goal:'door'},
  {title:'Change the plan',text:'Drag the middle of the selected divider sideways, not its endpoints. Both enclosed rooms follow the wall; their areas, occupant loads and routes update. Undo with Ctrl/Cmd+Z. When drawing new walls, hold Shift for Ortho; snaps are always on.',action:'Select the divider',target:'studio-divider',tab:'properties',goal:'wall'},
  {title:'Review → report → your design',text:'Open Code to inspect remaining inputs and checks. The exercise is complete when you understand the changes, even if other review items remain. Save report PDF records this version; save the editable project to keep practicing.',action:'Review indoor + outdoor checks',tab:'code',recap:true},
 ]},
 {id:'site',number:'02',title:'From exit to public way',subtitle:'Site workflow · 5–7 min',tag:'INDOOR + OUTDOOR',description:'Follow one continuous journey, widen an egress court and investigate a pedestrian / vehicle crossing.',skills:['Shared building exits','Outdoor clear width','Pedestrian / vehicle'],build:siteCase,steps:[
  {title:'Follow the whole route',text:'The ground floor and site share one plan. Green paths connect the room to building exits; outdoor paths continue to the public sidewalks. Use Play to follow the connections.',action:'Show the shared plan',overview:true},
  {title:'Repair the narrow court',text:'Select West egress court. Its clear width is 0.90 m. Change it to 1.50 m and check the live result. “West exit” is assigned to this path so its people contribute to the width check.',action:'Edit the egress court',scope:'site',target:'west-path',tab:'properties',goal:'court'},
  {title:'Investigate the crossing',text:'The service drive crosses the west pedestrian path. Drag the drive to the south edge of the site, or reshape its endpoints. Review the new geometry; visibility and crossing protection still need design judgment.',action:'Select Service drive',scope:'site',target:'service',tab:'properties',goal:'crossing'},
  {title:'Move a building exit',text:'Drag the selected East exit up or down its wall. Its indoor and outdoor routes update together. Then select East accessible discharge in Site mode and move its first vertex to follow the new exit position; drawn route centerlines are editable design inputs.',action:'Select East exit',target:'east-exit',tab:'properties',goal:'exit'},
  {title:'Review outdoor checks',text:'Open Code → Outdoor. Compare geometric connectivity, path width and accessible-route inputs. A path that reaches a sidewalk does not by itself establish adequate width. Export a PDF to record your revisions.',action:'Review outdoor checks',scope:'site',tab:'code',recap:true},
 ]},
 {id:'levels',number:'03',title:'Floors, stairs + a lightwell',subtitle:'Multi-level workflow · 7–10 min',tag:'THREE LINKED FLOORS',description:'Compare a setback, repair a stair connection and turn a double-height space into a triple-height one.',skills:['Shared XY + elevations','Stair links','Slab openings'],build:levelsCase,steps:[
  {title:'Compare the three floors',text:'All floors use the same XY coordinates. Level 3 is set back 2 m along the west edge; its walls do not define a new origin. Use All floors to compare, or the floor selector to edit one level.',action:'Show all floors',overview:true},
  {title:'Repair the upper stair link',text:'Level 3’s stair has the same XY footprint as the lower landings but a different link name. Set its Link name to “Stair A”. The complete route should then continue down to the ground floor and public way.',action:'Edit the top stair',floor:2,target:'stair-2',tab:'properties',goal:'stair'},
  {title:'Make a triple-height space',text:'The lightwell currently removes only Level 2’s slab. Set “Highest floor WITHOUT a slab” to Level 3. The ground floor stays occupied; Level 2 and Level 3 lose floor area inside the shared footprint.',action:'Edit the lightwell',floor:1,target:'atrium',tab:'properties',goal:'void'},
  {title:'Inspect usable area and routes',text:'Select Top studio and compare its usable area. Routes should avoid the lightwell. Switch on the reference floor overlay to compare landings. Matched names alone do not connect misaligned stairs.',action:'Select Top studio',floor:2,target:'room-2',tab:'properties'},
  {title:'Review the whole journey',text:'Check each floor and the site, then export the report. The stair protection is a teaching assumption. Shared discharge loads from multiple floors remain a review item; completing this exercise does not resolve that allocation.',action:'Review all plan checks',tab:'code',recap:true},
 ]},
];
export const firstPractice=examples[0];
export const exampleById=id=>examples.find(e=>e.id===id)||precedentExamples.find(e=>e.id===id);
export function createExample(id){const e=exampleById(id);if(!e)throw Error('Unknown practice case.');const p=e.build();p.id=uid();p.name=e.buildingStudy?e.title+' · studio study':'Practice '+e.number+' · '+e.title;p.units=e.units||'m';p.tutorial={id,step:0,collapsed:false};return p;}
export function exampleGoals(p,a){
 const id=p.tutorial?.id,f=p.floors[0],ready=!!a,findDoor=id=>f.doors.find(d=>d.id===id),goals=[];
 const add=(id,label,met,detail)=>goals.push({id,label,met:ready?!!met:null,detail:ready?detail:'Updating analysis…'});
 if(id==='kendeda'){
  const room=a?.floors[0]?.rooms.find(r=>r.id==='auditorium');
  add('k-seating','Audience in this layout',room?.function==='chairs',room ? room.occupants+' design occupants' : 'Select Auditorium 152.');
  const row=a?.floors[0]?.capacity.rows.find(r=>r.id==='hall-middle');
  add('k-door','Narrow-door test',row && row.available < 32*.0254 && row.status==='fail',
    row ? (row.available/.0254).toFixed(1)+' in clear / '+(row.required/.0254).toFixed(1)+' in required in this scenario' : 'The middle door is missing.');
  if(ready && row?.shortfall>0)goals.at(-1).finding='Door is '+(row.shortfall/.0254).toFixed(1)+' in too narrow.';
 }else if(id==='bullitt'){
  const row=a?.floors[2]?.capacity.rows.find(r=>r.id==='bullitt-l4-stair-1');
  add('b-stair','Stair width test',row && row.available < 36*.0254 && row.status==='fail',
    row ? (row.available/.0254).toFixed(1)+' in clear / '+(row.required/.0254).toFixed(1)+' in required in this scenario' : 'The upper landing is missing.');
  if(ready && row?.shortfall>0)goals.at(-1).finding='Stair is '+(row.shortfall/.0254).toFixed(1)+' in too narrow.';
 }else if(id==='barcelona'||id==='savoye'){
  const fi=id==='savoye'?1:0,r=p.floors[fi]?.rooms.find(r=>r.id===(id==='savoye'?'living':'pavilion-hall'));
  add('precedent-input','Scenario use / area reviewed',r?.areaConfirmed,r?`${roomArea(p,fi,r).toFixed(1)} m² · teaching dimensions`:'Study room was removed.');
  if(id==='barcelona'){
   const w=f.walls.find(w=>w.id==='onyx');add('onyx','Onyx screen moved',w&&(Math.abs(w.a.x-37.5)>.15||Math.abs(w.a.y-10.5)>.15),'Compare the revised route with the source diagram.');
   const path=p.site.routes.find(r=>r.id==='pavilion-path');add('podium','Podium width exercise revised',path?.width>=1.5,path?`${path.width.toFixed(2)} m clear · hypothetical exercise`:'Study path was removed.');
  }else{const d=p.floors[1]?.doors.find(d=>d.id==='living-garden-door');add('savoye-door','Terrace opening changed',d&&(Math.abs(d.width-2.8)>.05||Math.abs(d.x-15)>.15),d?`${d.width.toFixed(2)} m clear · verify source dimensions`:'Study opening was removed.');}
 }else if(id==='rooms'){
  const r=f.rooms.find(r=>r.id==='workshop'),d=findDoor('workshop-door'),w=f.walls.find(w=>w.id==='studio-divider');
  add('room-input','Room inputs reviewed',r?.areaConfirmed,r?`${roomArea(p,0,r).toFixed(1)} m² · ${a?.floors[0]?.rooms.find(o=>o.id===r.id)?.occupants??'—'} people`:'Workshop was removed.');
  const row=a?.floors[0]?.capacity?.rows.find(r=>r.id===d?.id),swing=d?doorSwingCheck(p,0,d,a):null;
  add('door','Door width + direction revised',d&&row?.allocationKnown&&d.width>=row.required&&d.swing==='with'&&swing?.status!=='fail',d?`${d.width.toFixed(2)} m clear · ${d.swing==='with'?'with egress travel':'check swing direction'}`:'Practice door was removed.');
  add('wall','Divider moved',w&&(Math.abs(w.a.x-12)>.1||Math.abs(w.b.x-12)>.1),w?'Move the shared wall to see both room areas change.':'Divider was removed.');
 }else if(id==='site'){
  const r=p.site.routes.find(r=>r.id==='west-path'),c=ready?siteWidthChecks(p,a).find(c=>c.objectId===r?.id):null;
  add('court','Court width revised',c&&c.status==='review'&&c.widthLowerBound&&r.width>=c.widthLowerBound,r?`${r.width.toFixed(2)} m clear · see Code for the required width`:'Court was removed.');
  const service=p.site.routes.find(r=>r.id==='service'),ped=p.site.routes.find(r=>r.id==='west-path');
  add('crossing','Modeled crossing removed',service&&ped&&a?.floors[0]?.conflicts.length===0,'Resolve the drawn crossing; review real-world protection separately.');
  const d=findDoor('east-exit');add('exit','Shared exit moved',d&&Math.abs(d.y-7)>.25,d?`East exit: X ${d.x.toFixed(1)}, Y ${d.y.toFixed(1)} m`:'East exit was removed.');
 }else if(id==='levels'){
  const routes=a?.complete.filter(r=>r.floor===2)||[],s=p.floors[2]?.stairs.find(s=>s.id==='stair-2');
  add('stair','Top floor reaches the public way',s?.link==='Stair A'&&routes.length&&routes.every(r=>r.complete),routes.length?`${routes.filter(r=>r.complete).length}/${routes.length} top-floor routes connected`:'Top floor needs a route.');
  const o=p.openings?.find(o=>o.id==='atrium'),r=p.floors[2]?.rooms.find(r=>r.id==='room-2');
  add('void','Triple-height opening defined',o?.baseFloorId===p.floors[0]?.id&&o?.throughFloorId===p.floors[2]?.id&&r&&roomArea(p,2,r)<area(r.points),r?`Top studio usable area: ${roomArea(p,2,r).toFixed(1)} m²`:'Top studio was removed.');
 }return goals;
}

// Thumbnails are drawn from the actual editable example geometry.
export function exampleThumbnail(e){
 const p=e.build(),f=p.floors[e.thumbnailFloor??(e.id==='levels'?2:e.id==='savoye'?1:0)],points=[...f.outline,...(['site','barcelona'].includes(e.id)?p.site.walkable.flatMap(o=>o.points):[])],xs=points.map(q=>q.x),ys=points.map(q=>q.y),minX=Math.min(...xs)-2,minY=Math.min(...ys)-2,w=Math.max(...xs)-minX+2,h=Math.max(...ys)-minY+2;
 const poly=ps=>ps.map(q=>`${q.x},${-q.y}`).join(' ');
 return `<svg viewBox="${minX} ${-minY-h} ${w} ${h}" role="img" aria-label="${e.title}" class="example-thumbnail"><g stroke-linejoin="round">${['site','barcelona'].includes(e.id)?p.site.walkable.map(o=>`<polygon points="${poly(o.points)}" fill="#e2ebd5" stroke="#bbccab" stroke-width=".12"/>`).join(''):''}${f.rooms.map((r,i)=>`<polygon points="${poly(r.points)}" fill="${r.role==='terrace'?'#cfdfbb':r.role==='corridor'?'#ecdeb0':['#e3eadc','#f1e6d2','#dce7e4'][i%3]}"/>`).join('')}${p.site.obstacles.filter(o=>['large-pool','small-pool'].includes(o.id)).map(o=>`<polygon points="${poly(o.points)}" fill="#8eb7be"/>`).join('')}${f.walls.map(w=>`<path d="M${w.a.x} ${-w.a.y}L${w.b.x} ${-w.b.y}" stroke="#4e6858" stroke-width=".25"/>`).join('')}${f.doors.map(d=>`<circle cx="${d.x}" cy="${-d.y}" r=".35" fill="${d.width<.8?'#bb7152':'#fff'}" stroke="#487c60" stroke-width=".15"/>`).join('')}${(f.stairs||[]).map(s=>`<polygon points="${poly(s.points)}" fill="#a5bb9b" stroke="#637f5a" stroke-width=".2"/>`).join('')}${(p.openings||[]).map(o=>`<polygon points="${poly(o.points)}" fill="#faf8ef" stroke="#b38b4d" stroke-dasharray=".6 .4" stroke-width=".18"/>`).join('')}${e.id==='site'?p.site.routes.map(r=>`<polyline points="${poly(r.points)}" fill="none" stroke="${r.kind==='vehicle'?'#c48b54':'#4e97a4'}" stroke-width=".35" stroke-dasharray=".6 .4"/>`).join(''):''}</g></svg>`;
}
