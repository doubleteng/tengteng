import {fresh,functions} from './model.mjs?v=topology-rebuild-5';
import {edges} from './geometry.mjs?v=topology-rebuild-5';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const room=(id,name,points,role='room')=>({id,name,points,role,function:'gallery',factor:30,basis:'net',group:'A',areaConfirmed:false});
function walls(f,points,prefix){for(const [i,[a,b]] of edges(points).entries())f.walls.push({id:prefix+i,a:{...a},b:{...b},thickness:.15});}
const schemeNote='Editable interpretive study model, not a measured survey. Dimensions, clear widths, use and site endpoints are teaching assumptions. IBC results describe the student scenario, not the historic building’s compliance.';
export function barcelonaCase(){
 const p=fresh(),f=p.floors[0],pt=(x,y)=>({x:(x-120)*.05,y:(525-y)*.05}),poly=coords=>coords.map(([x,y])=>pt(x,y));
 f.id='barcelona';f.name='Pavilion + podium';f.semanticRooms=true;
 const hall=poly([[754,258],[1027,258],[1027,439],[754,439]]),annex=poly([[122,86],[294,86],[294,194],[122,194]]);
 f.outline=hall;f.enclosures=[hall,annex];f.autoBoundary=true;
 f.rooms=[room('pavilion-hall','Reception · open plan',hall),room('annex','Service pavilion',annex)];
 const segments=[['glass-west',754,258,754,439],['north-screen',720,258,930,258],['south-screen',720,439,1072,439],['east-glass',1027,258,1027,439],['onyx',870,315,987,315],['annex-west',122,86,122,194],['annex-north',122,86,294,86],['annex-east',294,86,294,194],['annex-front',122,194,294,194],['annex-divider',207,86,207,194]];
 for(const [id,x1,y1,x2,y2]of segments)f.walls.push({id,a:pt(x1,y1),b:pt(x2,y2),thickness:id.includes('glass')?.08:.16});
 // A modeled open threshold bridges the diagram's north-side opening; it is
 // explicitly a passage rather than a swinging door or an observed fire exit.
 f.walls.push({id:'north-threshold',a:pt(930,258),b:pt(1027,258),thickness:.05});
 f.doors=[{id:'pavilion-exit',name:'North open threshold · study',wallId:'north-threshold',...pt(975,258),width:2.4,openingType:'passage',exit:true,discharge:'site'},{id:'annex-exit',name:'Service pavilion opening · study',wallId:'annex-front',...pt(259,194),width:1,exit:true,discharge:'site',swing:'unknown'},{id:'annex-door',name:'Service partition opening · study',wallId:'annex-divider',...pt(207,140),width:.9,exit:false,swing:'unknown'}];
 f.features=[{id:'chair-a',name:'Barcelona chair · diagram',kind:'furniture',points:poly([[900,350],[918,350],[918,369],[900,369]]),blocksMovement:false},{id:'chair-b',name:'Barcelona chair · diagram',kind:'furniture',points:poly([[930,350],[948,350],[948,369],[930,369]]),blocksMovement:false}];
 for(const [i,[x,y]]of [[770,254],[900,254],[1029,254],[770,399],[900,399],[1029,399]].entries())f.features.push({id:'column-'+i,name:'Cruciform column',kind:'column',points:poly([[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]]),blocksMovement:true});
 f.image={name:'Plan Barcelona Pavillon · TomAlt · CC BY-SA 3.0',src:'./examples/barcelona-plan-tomalt.png',x:-6,y:-9.25,width:63.05,height:35.5,rotation:0,calibrated:false};
 const podium=poly([[120,84],[296,84],[296,192],[906,192],[906,209],[1160,209],[1160,442],[1175,442],[1175,459],[906,459],[906,542],[105,542],[105,520],[120,520]]);
 p.site.walkable=[{id:'podium',name:'Travertine podium · study extent',points:podium},{id:'approach',name:'Stair / approach projection · grade review',points:rect(36,-5,3.4,9)}];
 p.site.obstacles=[{id:'large-pool',kind:'water',name:'Large reflecting pool',points:poly([[125,337],[537,337],[537,520],[125,520]])},{id:'small-pool',kind:'water',name:'Sculpture pool',points:poly([[1072,213],[1155,213],[1155,439],[1072,439]])}];
 // Thin outdoor wall strips are obstacles, separate from the room graph.
 for(const [i,c]of [[[125,522],[269,522],[269,526],[125,526]],[[879,208],[1160,208],[1160,212],[879,212]],[[1156,209],[1160,209],[1160,444],[1156,444]],[[960,439],[1160,439],[1160,444],[960,444]]].entries())p.site.obstacles.push({id:'site-wall-'+i,name:'Podium screen wall',points:poly(c)});
 p.site.targets=[{id:'study-public',kind:'public',name:'Study public-way endpoint · verify',x:37.5,y:-4}];
 p.site.routes=[{id:'pavilion-path',name:'Podium route · width exercise',kind:'pedestrian',egressRole:'discharge',servedExitIds:['pavilion-exit'],width:.9,points:[pt(975,258),pt(975,230),pt(680,230),pt(680,490),pt(875,490),{x:37.5,y:-4}]},{id:'annex-path',name:'Annex approach · study',kind:'pedestrian',egressRole:'discharge',servedExitIds:['annex-exit'],width:1.5,points:[pt(259,194),pt(500,270),pt(680,270),pt(680,490),{x:37.5,y:-4}]}];
 p.precedent={title:'Barcelona Pavilion',architect:'Ludwig Mies van der Rohe + Lilly Reich',place:'Barcelona · 1929 / reconstructed 1986',note:schemeNote,scale:'Nominal 0.05 m/pixel; source diagram has no dimensioned scale. Confirm dimensions before interpreting absolute code values.',sources:[{label:'Fundació Mies van der Rohe · building + official drawings',url:'https://miesbcn.com/the-pavilion/'},{label:'Plan by TomAlt · Wikimedia Commons',url:'https://commons.wikimedia.org/wiki/File:Plan_Barcelona_Pavillon.png'},{label:'Plan + adapted geometry: CC BY-SA 3.0',url:'https://creativecommons.org/licenses/by-sa/3.0/'}],changes:'Simplified spatial zones, open-threshold locations, furniture, widths and public-way endpoint added for teaching. Original plan image retained unchanged. North passage is a study opening; verify glazing and access against detailed drawings. Podium steps are projected in 2D; grades are not verified.'};
 for(const f of p.floors)for(const w of f.walls)w.semanticBase=true;
 return p;
}
export function savoyeCase(){
 const p=fresh();p.floors=[];const xy=(x,y)=>({x,y:22.4-y}),poly=c=>c.map(([x,y])=>xy(x,y)),box=(x,y,w,h)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 const floor=(id,name,elevation,outline)=>({id,name,elevation,outline,walls:[],doors:[],rooms:[],stairs:[],obstacles:[],traces:[],cad:[],layers:[],features:[],semanticRooms:true});
 // Independently drafted topology study from the CMN visitor guide's three
 // diagrams. Nominal dimensions; the guide is not a measured survey.
 const arc=[];for(let i=0;i<=16;i++){const a=i*Math.PI/16;arc.push([10.1+6.7*Math.cos(a),11.4+6.7*Math.sin(a)]);}
 const ground=floor('savoye-ground','Ground · arrival + services',0,poly([[3.4,0],[16.8,0],...arc,[3.4,1.2]]));walls(ground,ground.outline,'g-envelope-');
 const addWall=(f,id,a,b)=>f.walls.push({id,a:xy(...a),b:xy(...b),thickness:.15});
 for(const [id,a,b]of [['g-services',[7.5,0],[7.5,10.4]],['g-laundry',[3.4,3.6],[7.5,3.6]],['g-servant',[3.4,6.3],[7.5,6.3]],['g-garage',[11.1,3.6],[11.1,14.2]],['g-garage-angle',[11.1,14.2],arc[4]],['g-driver',[7.5,3.6],[13.2,3.6]],['g-driver-angle',[13.2,3.6],[16.8,7]]])addWall(ground,id,a,b);
 ground.rooms=[room('g-lobby','Arrival hall · visitor scenario',poly([[3.4,10.4],[7.5,10.4],[7.5,3.6],[11.1,3.6],[11.1,14.2],...arc.slice(4)])),room('g-laundry','Laundry · exhibit scenario',box(3.4,0,4.1,3.6)),room('g-service-a','Service room 1 · exhibit',box(3.4,3.6,4.1,2.7)),room('g-service-b','Service room 2 · exhibit',box(3.4,6.3,4.1,4.1)),room('g-driver','Chauffeur suite · exhibit',poly([[7.5,0],[16.8,0],[16.8,7],[13.2,3.6],[7.5,3.6]])),room('g-garage-room','Garage · exhibit scenario',poly([[11.1,3.6],[13.2,3.6],[16.8,7],...arc.slice(0,5),[11.1,14.2]]))];
 const front=ground.walls.find(w=>Math.abs(w.a.y-4.3)<.4&&Math.abs(w.b.y-4.3)<.4)||ground.walls[9];const center={x:(front.a.x+front.b.x)/2,y:(front.a.y+front.b.y)/2};
 ground.doors.push({id:'savoye-entry',name:'Arrival entrance · study',wallId:front.id,...center,width:1.6,exit:true,discharge:'site',swing:'unknown'});
 const addDoor=(f,id,wallId,x,y,width=.9)=>f.doors.push({id,name:id,wallId,...xy(x,y),width,exit:false,swing:'unknown'});
 addDoor(ground,'Laundry passage','g-services',7.5,2);addDoor(ground,'Service room 1 passage','g-services',7.5,5);addDoor(ground,'Service room 2 passage','g-services',7.5,8);addDoor(ground,'Chauffeur passage','g-driver',9,3.6);addDoor(ground,'Garage passage','g-garage',11.1,12.5);
 const upper=floor('savoye-first','First · living spaces + roof garden',3.2,box(0,0,20,22.4));walls(upper,upper.outline,'u-envelope-');
 for(const [id,a,b]of [['u-living',[0,16.3],[20,16.3]],['u-kitchen',[5,16.3],[5,22.4]],['u-bedroom',[4.3,0],[4.3,13]],['u-bath',[0,6],[4.3,6]],['u-guest',[0,7.6],[4.3,7.6]],['u-guest-bottom',[0,13],[4.3,13]],['u-main',[4.3,4.5],[8.6,4.5]],['u-boudoir',[11.5,0],[11.5,6.3]],['u-garden-top',[11.5,6.3],[20,6.3]],['u-garden-side',[10.1,6.3],[10.1,16.3]],['u-ramp-west',[8.6,3.5],[8.6,14.2]]])addWall(upper,id,a,b);
 upper.rooms=[room('living','Living room · gallery scenario',box(5,16.3,15,6.1)),room('kitchen','Kitchen · exhibit scenario',box(0,16.3,5,6.1)),room('son','Son’s room · exhibit',box(0,0,4.3,6)),room('bath','Shared bathroom · exhibit',box(0,6,4.3,1.6)),room('guest','Guest room · exhibit',box(0,7.6,4.3,5.4)),room('masters','Main suite · exhibit',poly([[4.3,0],[11.5,0],[11.5,6.3],[8.6,6.3],[8.6,13],[4.3,13]])),room('boudoir','Boudoir · exhibit',box(11.5,0,3.7,6.3)),room('upper-hall','Landing + circulation',poly([[4.3,13],[8.6,13],[8.6,6.3],[10.1,6.3],[10.1,16.3],[0,16.3],[0,13]]),'corridor'),room('roof-garden','Roof garden · outdoor terrace',poly([[15.2,0],[20,0],[20,16.3],[10.1,16.3],[10.1,6.3],[15.2,6.3]]),'terrace')];
 // The boudoir/terrace edge is glazing, not a new room around furniture.
 addWall(upper,'u-boudoir-east',[15.2,0],[15.2,6.3]);
 addDoor(upper,'Living / landing opening','u-living',7,16.3,1.2);addDoor(upper,'living-garden-door','u-living',15,16.3,2.8);upper.doors.at(-1).name='Living room → roof garden';
 addDoor(upper,'Kitchen passage','u-kitchen',5,18.8);addDoor(upper,'Son room passage','u-bedroom',4.3,5.2);addDoor(upper,'Guest passage','u-bedroom',4.3,11.8);addDoor(upper,'Bathroom passage','u-bedroom',4.3,6.8);addDoor(upper,'Main suite passage','u-main',6.4,4.5);addDoor(upper,'Boudoir passage','u-boudoir',11.5,4.4);addDoor(upper,'Garden passage','u-garden-side',10.1,15);
 upper.features=[{id:'bath-furniture',name:'Bath / chaise · diagram',kind:'furniture',points:box(5.1,5.4,1.3,3.8),blocksMovement:false},{id:'table-savoye',name:'Living table · diagram',kind:'furniture',points:box(6.1,19.2,2.5,1),blocksMovement:false}];
 const roof=floor('savoye-roof','Roof · solarium + terrace below',6.4,box(0,0,20,22.4));roof.rooms=[room('solarium','Solarium · outdoor visitor scenario',roof.outline,'terrace')];
 // Curved wind screen is sampled as short editable segments.
 const wind=[];for(let i=0;i<=12;i++){const a=Math.PI/2+i*Math.PI/12;wind.push([4.3+3.2*Math.cos(a),17.9+2.5*Math.sin(a)]);}wind.push([14.5,20.4]);for(let i=1;i<wind.length;i++)addWall(roof,'wind-'+i,wind[i-1],wind[i]);
 addWall(roof,'roof-screen-a',[1.1,16],[5.7,16]);addWall(roof,'roof-screen-b',[5.7,16],[5.7,18.4]);addWall(roof,'roof-screen-c',[5.7,18.4],[14.5,18.4]);
 for(const [i,f]of [ground,upper,roof].entries()){
  f.stairs=[{id:'savoye-stair-'+i,name:'Sculptural stair · enclosure unverified',link:'Savoye stair',points:box(4.5,12.3,3,2.1),width:1.1,protected:false,travelLength:7}];
  f.features.push({id:'ramp-'+i,name:'Architectural promenade · ramp reference',kind:'projection',points:box(8.7,3.5,1.4,10.7),blocksMovement:false});
  for(const [k,[x,y]]of [[1.1,1.2],[5.1,1.2],[10.1,1.2],[15.2,1.2],[19,1.2],[1.1,6.2],[19,6.2],[1.1,16],[19,16]].entries())f.features.push({id:'pilotis-'+i+'-'+k,name:'Pilotis',kind:'column',points:box(x-.12,y-.12,.24,.24),blocksMovement:true});
  p.floors.push(f);
 }
 p.openings=[{id:'savoye-terrace-void',name:'Open sky above the roof garden',baseFloorId:upper.id,throughFloorId:roof.id,points:upper.rooms.find(r=>r.id==='roof-garden').points}];
 p.site.walkable=[{id:'savoye-site',name:'Immediate grounds · study extent',points:rect(-6,-6,32,34)}];p.site.targets=[{id:'savoye-public',name:'Study site endpoint · verify',kind:'public',x:10,y:-5}];
 p.site.routes=[{id:'savoye-approach',name:'Arrival walk · study',kind:'pedestrian',egressRole:'discharge',servedExitIds:['savoye-entry'],width:1.5,points:[center,{x:10,y:1},{x:10,y:-5}]},{id:'savoye-drive',name:'Arrival loop · diagram',kind:'vehicle',width:3,points:[{x:1,y:25},{x:1,y:6},{x:3,y:1},{x:10,y:-1},{x:18,y:2},{x:21,y:7},{x:21,y:25}]}];
 p.precedent={title:'Villa Savoye',architect:'Le Corbusier + Pierre Jeanneret',place:'Poissy · 1928–1931',note:schemeNote,scale:'Nominal 20 × 22.4 m first-floor envelope; elevations 3.2 m apart are exercise assumptions. Curves and partitions are simplified. Calibrate against measured drawings for dimensional assessment.',sources:[{label:'Centre des monuments nationaux · three-floor visitor plan (p. 2)',url:'https://www.villa-savoye.fr/content/download/9824393/file/document-visite-villa-savoye-FR-2021.pdf?inLanguage=fre-FR&version=3'},{label:'Fondation Le Corbusier · Villa Savoye',url:'https://www.fondationlecorbusier.fr/oeuvre-architecture/realisations-villa-savoye-et-loge-du-jardinier-poissy-france-1928-1931/'}],changes:'Original spatial relationships are redrawn schematically. Gallery use is a hypothetical visitor exercise, not the original residential program. Outdoor terraces retain slabs; only the sky opening above the first-floor garden removes roof area. The ramp is reference geometry, not an analyzed exit. The existing open stair is not assumed to be a protected exit.'};
 for(const f of p.floors)for(const w of f.walls)w.semanticBase=true;
 return p;
}
export const precedentExamples=[
 {id:'barcelona',number:'A',title:'Barcelona Pavilion',subtitle:'Mies van der Rohe + Lilly Reich · 1929',tag:'OPEN PLAN + SITE',description:'Read the free plan, onyx screen and two pools. Test how an opening or wall changes the route through the pavilion and podium.',skills:['Indoor / outdoor','Furniture vs enclosure','Open thresholds'],build:barcelonaCase,steps:[
  {title:'Read the actual precedent',text:'Use the mouse wheel to zoom. Hold the right mouse button and drag to pan. Toggle Show underlay to compare the source drawing. Then click Next step; we will select the room for you.',action:'Show pavilion + site',overview:true},
  {title:'Separate furniture from rooms',text:'The reception space is selected. In Edit below, choose Space function and read the area-per-person calculation. Check the area basis when reviewed. Furniture does not divide this open-plan room.',action:'Select reception space',target:'pavilion-hall',field:'function',tab:'properties',goal:'precedent-input'},
  {title:'Move the onyx screen',text:'The green wall is selected. Drag its MIDDLE sideways on the plan. The dashed route recalculates after you release it. The exercise marker below changes to a checkmark when you move the wall.',action:'Select onyx screen',target:'onyx',tab:'properties',goal:'onyx'},
  {title:'Test the podium route',text:'The outdoor path is selected. In the highlighted Clear width field below, replace 0.90 with 1.50, then press Tab. Watch the exercise marker and updated width checks. These are exercise dimensions.',action:'Edit podium route',scope:'site',target:'pavilion-path',tab:'properties',goal:'podium'},
  {title:'Explain the intervention',text:'Open a finding below and click Locate + edit on plan to return to its object. When ready, click Save report PDF and choose Save as PDF. The report includes your changes and source assumptions.',action:'Review plan checks',tab:'code',recap:true},
 ]},
 {id:'savoye',number:'B',title:'Villa Savoye',subtitle:'Le Corbusier + Pierre Jeanneret · 1928–1931',tag:'THREE FLOORS + ROOF GARDEN',description:'Compare the curved arrival floor, living floor, ramp and roof garden. Distinguish an outdoor terrace from a missing slab.',skills:['Shared XY','Rooms + terrace','Stair / ramp review'],build:savoyeCase,steps:[
  {title:'Read three aligned floors',text:'The three floors share the same XY coordinates. Zoom with the wheel; right-drag to pan. Click Next step to select the first-floor living room automatically.',action:'Show all three floors',overview:true},
  {title:'Read room use and capacity',text:'The living room is selected. Change Space function below and read how its occupant load changes. This is a hypothetical gallery exercise. Confirm the area basis after reviewing it.',action:'Select the living room',floor:1,target:'living',field:'function',tab:'properties',goal:'precedent-input'},
  {title:'Edit the terrace opening',text:'The terrace opening is selected. Replace 2.80 with 3.20 in Clear width below, then press Tab. You can also drag the opening along its wall. This connects to the terrace, not directly to ground.',action:'Select living / garden opening',floor:1,target:'living-garden-door',tab:'properties',goal:'savoye-door'},
  {title:'Terrace or void?',text:'The sky opening is selected. Inspect Lowest occupied floor and Highest floor WITHOUT a slab below. The first-floor garden keeps its floor; the roof level has the opening.',action:'Inspect the sky opening',floor:1,target:'savoye-terrace-void',tab:'properties'},
  {title:'Distinguish promenade from egress',text:'Open a stair finding below and click Locate + edit on plan. Amber routes stop at the historic open stair because it is not assigned as an exit in this model. Model an eligible exit route to assess onward egress. Export the report to record these findings.',action:'Review multi-floor checks',tab:'code',recap:true},
 ]},
];
