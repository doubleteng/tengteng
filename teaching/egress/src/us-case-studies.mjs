import { fresh, functions } from './model.mjs?v=wall-rooms-1';
import { edges, FT } from './geometry.mjs?v=wall-rooms-1';

// Independent teaching diagrams. Drawing coordinates are registered to one XY
// datum per building; analysis and editing always use the app's metre units.
function drawing(point) {
  const polygon = vertices => vertices.map(([x, y]) => point(x, y));
  const box = (left, top, right, bottom) =>
    polygon([[left, top], [right, top], [right, bottom], [left, bottom]]);
  return { point, polygon, box };
}

function level(id, name, elevation, outline) {
  const floor = fresh().floors[0];
  Object.assign(floor, { id, name, elevation, outline, semanticRooms: true, features: [] });
  floor.walls = edges(outline).map(([a, b], index) => ({
    id: id + '-edge-' + index, a, b, thickness: 0.18, boundary: true, semanticBase: true
  }));
  return floor;
}

function partition(floor, id, a, b) {
  floor.walls.push({ id, a, b, thickness: 0.15, semanticBase: true });
  return id;
}

function doorway(floor, id, name, wallId, point, feet, exit = false) {
  floor.doors.push({
    id, name, wallId, ...point, width: feet * FT, exit,
    discharge: exit ? 'site' : 'none', swing: 'with'
  });
}

function space(floor, id, name, points, use, options = {}) {
  const { factor, basis, group } = functions[use];
  floor.rooms.push({
    id, name, points, function: use, factor, basis, group,
    areaConfirmed: false, ...options
  });
}

function sitePath(project, id, name, door, rest, widthFeet) {
  const points = [{ x: door.x, y: door.y }, ...rest];
  project.site.routes.push({
    id, name, kind: 'pedestrian', egressRole: 'discharge', servedExitIds: [door.id],
    width: widthFeet * FT, points
  });
  project.site.targets.push({ id: id + '-end', name: name + ' · study endpoint', kind: 'public', ...rest.at(-1) });
}

const comparison = 'Classroom comparison under selected IBC 2021 plan checks. Door and path clearances are editable design assumptions. The approved life-safety sheets were unavailable.';

function kendedaProject() {
  const project = fresh();
  // Calibrate the two axes to the published interior dimensions of Room 152.
  const width = (52 + (9 + 1/4)/12) * FT;
  const length = (71 + (3 + 5/8)/12) * FT;
  const { point, polygon, box } = drawing((x, y) => ({
    x: (x - 120) * width / 155, y: (606 - y) * length / 201
  }));
  const floor = level('k-main', 'Main floor + porch', 0, polygon([
    [188,299], [490,299], [490,357], [528,357], [528,383], [724,383],
    [724,584], [518,584], [518,606], [424,606], [424,584], [120,584],
    [120,466], [162,466], [162,407], [188,407]
  ]));
  project.floors = [floor];
  project.settings.group = 'A';
  const wall = (id, x1, y1, x2, y2) => partition(floor, id, point(x1,y1), point(x2,y2));
  const door = (id, name, host, x, y, feet, exit) =>
    doorway(floor, id, name, host, point(x,y), feet, exit);

  const auditoriumWall = wall('hall-wall', 569,383,569,584);
  space(floor, 'auditorium', 'Auditorium 152', box(569,383,724,584), 'tables',
    {sourceNote:'Georgia Tech lists 176 seats in its classroom setup.'});
  for (const [id,name,y] of [['hall-front','Front hall door',397], ['hall-middle','Middle hall door',486], ['hall-rear','Rear hall door',571]]) {
    door(id, name, auditoriumWall, 569, y, 3.5);
  }
  const labWall = wall('lab-gallery',188,386,282,386);
  wall('lab-seminar',282,299,282,386);
  wall('seminar-side',337,299,337,366);
  const seminarWall = wall('seminar-wall',282,366,337,366);
  space(floor,'teaching-lab','Teaching lab',box(188,299,282,386),'vocational',{group:'B'});
  space(floor,'seminar','Seminar room',box(282,299,337,366),'classroom',{group:'B'});
  door('lab-door','Lab door',labWall,269,386,3.5);
  door('seminar-door','Seminar door',seminarWall,323,366,3.5);

  // Count the furnished part of the student center separately from its gallery walk.
  space(floor,'commons','Student center · tables',box(337,299,488,383),'tables',{role:'open use area'});
  const officeWall = wall('office-hall',120,499,311,499);
  wall('office-divider',311,499,311,584);
  const studioWall = wall('studio-hall',311,499,400,499);
  wall('studio-side',400,499,400,584);
  space(floor,'open-office','Open office',box(120,499,311,584),'business');
  space(floor,'workroom','Teaching studio',box(311,499,400,584),'vocational',{group:'B'});
  door('office-entry','Office door',officeWall,202,499,3.5);
  door('studio-entry','Studio door',studioWall,332,499,3.5);
  space(floor,'gallery-walk','Gallery walk',box(190,461,486,499),'business',
    {role:'corridor',clearWidth:8*FT});

  // Lower service rooms stay outside the circulation network of this extract.
  floor.obstacles.push({id:'service-block',name:'Service rooms · outside study',points:box(401,503,517,584)});
  const porchInner = wall('porch-vestibule',490,383,528,383);
  const wetlandInner = wall('wetland-vestibule',188,407,188,448);
  wall('porch-vestibule-return',490,357,490,383);
  wall('wetland-vestibule-return',162,448,188,448);
  door('porch-inner','Porch vestibule',porchInner,510,383,6);
  door('wetland-inner','Wetland vestibule',wetlandInner,188,428,6);
  door('porch-exit','Porch exit',floor.id+'-edge-2',510,357,6,true);
  door('wetland-exit','Wetland exit',floor.id+'-edge-13',162,428,6,true);
  for (let column=0;column<3;column++) {
    for (let row=0;row<6;row++) {
      const x=587+column*37, y=404+row*28;
      floor.features.push({id:'hall-table-'+column+'-'+row,name:'Moveable table group',kind:'furniture',
        points:box(x,y,x+21,y+7),blocksMovement:false});
    }
  }
  floor.features.push({id:'commons-steps',name:'Tiered seating · projection',kind:'projection',
    points:box(247,444,483,459),blocksMovement:false});
  project.site.walkable.push({id:'eco-walk',name:'Porch and campus walks · study extent',points:polygon([
    [92,238],[463,173],[630,190],[622,263],[545,289],[545,382],[489,382],
    [489,299],[188,299],[188,466],[120,466],[103,502],[53,505],[56,428],[134,407],[135,310],[92,306]
  ])});
  project.site.obstacles.push({id:'wetland-planting',name:'Constructed wetland',points:box(102,321,134,390)});
  sitePath(project,'porch-walk','Porch to campus walk',floor.doors.find(d=>d.id==='porch-exit'),
    [point(510,285),point(543,217)],8);
  sitePath(project,'wetland-walk','Wetland walk',floor.doors.find(d=>d.id==='wetland-exit'),
    [point(151,428),point(142,451),point(82,472)],6);
  project.precedent = {
    title:'Kendeda Building', architect:'The Miller Hull Partnership + Lord Aeck Sargent',
    place:'Georgia Tech · Atlanta, Georgia · 2019',
    note:comparison,
    record:'Georgia Tech construction review 2018-CP-109. Georgia had adopted IBC 2012 during this period. The project-specific edition, amendments and approved discharge design remain unverified.',
    scale:'Auditorium 152 is modeled as a rectangle using Georgia Tech’s published 71 ft 3⅝ in × 52 ft 9¼ in interior dimensions. Other spaces are approximate.',
    changes:'Main-floor study of the auditorium, student center and porch. The 176 seats listed by Georgia Tech describe a classroom setup. The live load uses the activity and area of your drawing. The exercise simplifies tiered floors, door groups, occupied areas and furniture. Campus walk endpoints represent public ways for this exercise. Actual public-way status and site grades need the approved site plan.',
    sources:[
      {label:'Georgia Tech · room dimensions and seating',url:'https://livingbuilding.gatech.edu/building-manual/room-specifications'},
      {label:'Miller Hull · building and design team',url:'https://millerhull.com/project/the-kendeda-building/'},
      {label:'Miller Hull drawings · ground and upper floor plans',url:'https://www.gooood.cn/kendeda-building-by-miller-hull.htm'},
      {label:'Georgia DCA · state code adoption history',url:'https://dca.georgia.gov/document/publications/code-adoption-history/download'}
    ]
  };
  return project;
}

function bullittProject() {
  const project = fresh();
  // Align to the column grid on the owner's Level 4 sheet (10 ft 6 in bays).
  const metresPerUnit = 10.5 * FT / 69.5;
  const {point, polygon, box} = drawing((x,y) => ({
    x:(x-470)*metresPerUnit, y:(940-y)*metresPerUnit
  }));
  const entryOutline = polygon([[779,283],[1280,283],[1280,938],[724,938],[470,783]]);
  const entry = level('bullitt-l2','L2 · Madison entry',0,entryOutline);
  const upperOutline = [[473,780],[723,375],[1132,375],[1132,262],[1246,262],[1246,537],
    [1270,537],[1270,765],[1246,765],[1246,918],[1132,918],[1132,843],[582,843]];
  const third = level('bullitt-l3','L3 · office',13*FT,polygon(upperOutline));
  const fourth = level('bullitt-l4','L4 · office 420',(26+10/12)*FT,polygon(upperOutline));
  project.floors=[entry,third,fourth];

  const wall = (f,id,x1,y1,x2,y2) => partition(f,f.id+'-'+id,point(x1,y1),point(x2,y2));
  // Each stair is represented by the same landing area on all three levels.
  // Enclosures, clear widths and walking lengths are inputs to the exercise.
  for (const f of project.floors) {
    f.stairs.push(
      {id:f.id+'-stair-1',name:'Stair 1',link:'Madison stair',points:box(1170,425,1218,370),
        width:4*FT,travelLength:27*FT,protected:true},
      {id:f.id+'-stair-2',name:'Stair 2',link:'Alley stair',points:box(1213,736,1240,645),
        width:4*FT,travelLength:27*FT,protected:true}
    );
    f.obstacles.push({id:f.id+'-services',name:'Service core',points:box(964,539,1141,682)});
  }
  const stairVest = wall(entry,'street-lobby',1142,440,1280,440);
  wall(entry,'street-side',1142,283,1142,440);
  doorway(entry,'b-lobby-door','Madison stair lobby',stairVest,point(1171,440),5);
  doorway(entry,'b-madison-exit','Madison exit',entry.id+'-edge-0',point(1177,283),6,true);
  const rear = wall(entry,'rear-lobby',1065,730,1279,730);
  wall(entry,'bike-room',1065,730,1065,938);
  doorway(entry,'b-rear-door','Rear lobby door',rear,point(1194,730),4);
  doorway(entry,'b-alley-exit','Alley exit',entry.id+'-edge-2',point(1258,938),4,true);

  // Two occupied office bays flank the open-to-below area at the entry datum.
  const north = wall(entry,'office-216-side',1142,440,1142,534);
  wall(entry,'office-216-end',860,534,1142,534);
  space(entry,'office-216','Office 216',box(860,285,1142,534),'business');
  doorway(entry,'b-216-door','Office 216 door',north,point(1142,495),3.5);
  wall(entry,'office-218-side',723,682,1065,682);
  const southOfficeDoorWall=wall(entry,'office-218-return',1065,682,1065,730);
  wall(entry,'mezzanine-guard',723,682,724,938);
  space(entry,'office-218','Office 218',polygon([[723,682],[1065,682],[1065,938],[724,938]]),'business');
  doorway(entry,'b-218-door','Office 218 study door',southOfficeDoorWall,point(1065,705),3.5);
  space(entry,'b-lobby','Entry circulation',box(1144,443,1227,729),'business',
    {role:'corridor',clearWidth:6*FT});
  entry.features.push(
    {id:'mezz-void',name:'Open to Level 1',kind:'void',points:polygon([[780,285],[858,285],[858,678],[722,678],[722,555],[617,555]]),blocksMovement:true},
    {id:'south-void',name:'Open to Level 1',kind:'void',points:polygon([[542,676],[721,676],[721,932],[475,782]]),blocksMovement:true}
  );

  for (const f of [third,fourth]) {
    const mainStair = wall(f,'madison-stair-entry',1132,440,1246,440);
    wall(f,'madison-stair-side',1132,375,1132,440);
    doorway(f,f.id+'-door-1','Stair 1 door',mainStair,point(1158,440),3.5);
    const secondStair = wall(f,'alley-stair-side',1202,615,1202,760);
    wall(f,'alley-stair-head',1202,615,1269,615);
    wall(f,'alley-stair-foot',1202,760,1269,760);
    doorway(f,f.id+'-door-2','Stair 2 door',secondStair,point(1202,728),3.5);
    f.obstacles.push({id:f.id+'-lift',name:'Elevator shaft',points:box(1203,541,1267,613)});
    const office=polygon([[473,780],[723,375],[1132,375],[1132,440],[1246,440],[1246,537],
      [1202,537],[1202,765],[1246,765],[1246,918],[1132,918],[1132,843],[582,843]]);
    space(f, f===fourth?'office-420':'office-l3',f===fourth?'Office 420':'Level 3 office',
      office,'business',{holes:[box(964,539,1141,682)],
        sourceNote:f===fourth?'Owner’s drawing · Office 420 · 6,099 sf':''});
    for (const x of [723,862,1000]) for (const y of [439,681,835]) {
      f.features.push({id:f.id+'-column-'+x+'-'+y,name:'Timber column',kind:'column',
        points:box(x-3,y-3,x+3,y+3),blocksMovement:true});
    }
  }
  project.site.walkable.push({
    id:'bullitt-site',name:'Madison, sidewalk and alley · exercise',points:
      polygon([[690,193],[1310,193],[1310,285],[1281,285],[1281,939],[1300,939],[1300,1009],
        [696,1009],[345,797],[380,731]])
  });
  sitePath(project,'madison-walk','Madison sidewalk',entry.doors.find(d=>d.id==='b-madison-exit'),
    [point(1177,245),point(1188,217)],8);
  sitePath(project,'alley-walk','Alley to sidewalk · exercise',entry.doors.find(d=>d.id==='b-alley-exit'),
    [point(1258,971),point(725,971),point(500,860)],6);
  project.precedent={
    title:'Bullitt Center',architect:'The Miller Hull Partnership',place:'Seattle, Washington · 2013',
    note:comparison,
    record:'Seattle construction permit 6237843. The published city elevations identify the permit. The approved egress schedule and applicable egress amendments remain unverified.',
    scale:'The common column grid is 10 ft 6 in. Level 2 is the street datum. Level 3 is 13 ft above it and Level 4 is 26 ft 10 in above it. The owner labels Office 420 as 6,099 sf. The live load uses the editable study polygon.',
    changes:'The study covers Levels 2–4 of the six-story building. Level 3 uses a simplified typical office plate. Both stair positions follow the drawings. This scenario assumes protected, continuous stairs with 4 ft clear widths. Travel lengths, partitions, door widths and load sharing are teaching inputs. The street entrance opens to Madison. The rear route continues through an alley to an assumed public sidewalk. Lower-level and other tenant loads, alley rights, slopes and the approved discharge arrangement require separate verification.',
    sources:[
      {label:'Bullitt Foundation · dimensioned office and entry floor plans',url:'https://bullittcenter.org/2014/04/21/bullitt-center-design-drawings/'},
      {label:'Miller Hull drawings in ULI case study · levels and site, p. 6',url:'https://casestudies.uli.org/wp-content/uploads/2015/02/TheBullittCenter1.pdf#page=6'},
      {label:'City of Seattle · project elevations and permit number',url:'https://www.seattle.gov/Documents/Departments/OPCD/DesignCommission/ProjectArchive/DCPresentation1Bullitt-Center-PV-ArrayAgendaID3500.pdf'},
      {label:'University of Washington · Level 2 visitor entrance',url:'https://idl.be.uw.edu/tours/'}
    ]
  };
  return project;
}

const reportStep = {
  title:'Save the revision', prompt:'Save this version as a PDF.',
  text:'The report pairs your room loads, widths and routes with the source drawings and exercise assumptions.',
  action:'View the checks', tab:'code', recap:true
};

export const usCaseStudies = [
  {
    id:'kendeda', number:'A', title:'Kendeda Building', subtitle:'Atlanta · 2019', tag:'HALL + PORCH', studyLabel:'IBC 2021 study · assumed clear widths',
    description:'Follow the auditorium to the porch. Change the seating layout and compare the door loads.',
    units:'ft', buildingStudy:true, build:kendedaProject,
    steps:[
      {title:'Read the main floor',prompt:'Follow Auditorium 152 to the porch.',overview:true,action:'Show the main floor',
        text:'The three auditorium openings lead into the building. Follow a route through a vestibule to the exterior. The green endpoints are campus-walk assumptions for this study.'},
      {title:'Change the audience',prompt:'Switch Auditorium 152 to chairs only.',target:'auditorium',field:'function',tab:'properties',goal:'k-seating',action:'Select the auditorium',
        text:'Under Space function choose Assembly: chairs only. Compare the new design occupant load with the tables-and-chairs layout. Georgia Tech lists 176 seats in its operating setup.'},
      {title:'Test an opening',prompt:'Set the middle door to 2.50 ft clear.',target:'hall-middle',tab:'properties',goal:'k-door',action:'Select the middle door',
        text:'Enter 2.50 ft and commit the edit. That gives a 30 in opening. Check the door-width finding, then try 3.50 ft again.'},
      {title:'Edit the exterior path',prompt:'Drag a vertex of the porch walk.',scope:'site',target:'porch-walk',tab:'properties',action:'Select the porch walk',
        text:'The porch door also appears on the site. Move a vertex of the drawn discharge path and compare it with the calculated route to the campus walk.'},
      reportStep
    ]
  },
  {
    id:'bullitt', number:'B', title:'Bullitt Center', subtitle:'Seattle · 2013', tag:'OFFICE + TWO STAIRS', studyLabel:'IBC 2021 study · assumed stair protection',
    description:'Trace the office floors to the Madison Street entrance. Edit a stair and its discharge walk.',
    units:'ft', buildingStudy:true, thumbnailFloor:2, build:bullittProject,
    steps:[
      {title:'Read the three levels',prompt:'Trace the two stairs down to Level 2.',overview:true,action:'Show Levels 2–4',
        text:'Compare the aligned cores in the three floor plans. Level 2 meets Madison Street on the sloping site. The study assumes the two stairs qualify as protected exits.'},
      {title:'Check the office load',prompt:'Select Office 420 and check its load.',floor:2,target:'office-420',field:'function',tab:'properties',action:'Select Office 420',
        text:'The owner labels this office 6,099 sf. Compare the area calculated from this diagram with that reference. Use and area basis control the live load.'},
      {title:'Change a stair width',prompt:'Try a 2.50 ft stair, then restore 4 ft.',floor:2,target:'bullitt-l4-stair-1',tab:'properties',goal:'b-stair',action:'Select Stair 1',
        text:'Set Clear width to 2.50 ft to see how much width the stair lacks for the modeled load. Compare the finding after you restore the original 4 ft exercise width.'},
      {title:'Check the discharge',prompt:'Follow the rear exit along the alley.',scope:'site',target:'alley-walk',tab:'properties',action:'Select the alley walk',
        text:'The drawing identifies the rear alley. For this scenario it connects to a public sidewalk. Adjust the path or its clear width and check the outdoor findings.'},
      reportStep
    ]
  }
];
