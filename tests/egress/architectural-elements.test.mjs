import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeArchitecturalElements,outdoorDescription,excludedCell} from '../../teaching/egress/src/architectural-elements.mjs';
import {validateInterpretation,materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {area} from '../../teaching/egress/src/geometry.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const el=(id,kind,points,extra={})=>({id,kind,points,label:id,confidence:'high',...extra});
test('A balcony footprint on the wall face classifies its centerline cell without swallowing a room around a small courtyard',()=>{
 const points=rect(0,0,8,4).map(([x,y])=>({x,y})),toPoints=ps=>ps.map(([x,y])=>({x,y}));
 assert.equal(excludedCell({points},[{kind:'exterior',points:toPoints(rect(.1,.1,7.8,3.8))}]),true);
 assert.equal(excludedCell({points},[{kind:'courtyard',points:toPoints(rect(3,1,2,2))}]),false);
});
test('A covered balcony is exterior, an enclosed glazed sunroom is interior',()=>{
 const [balcony,sunroom,bedroom]=normalizeArchitecturalElements([
  el('Covered balcony','room',rect(0,0,10,10)),el('Enclosed glazed sunroom','room',rect(0,0,10,10)),el('Bedroom with balcony','room',rect(0,0,10,10))
 ]);
 assert.equal(balcony.kind,'exterior');assert.equal(balcony.roofState,'covered');assert.equal(balcony.outdoorType,'balcony');
 assert.equal(sunroom.kind,'room');assert.equal(bedroom.kind,'room');
 assert.equal(normalizeArchitecturalElements([el('Balcony','room',rect(0,0,10,10))])[0].roofState,'unknown');
});
test('Spatial location and overhead cover survive serialization and do not inflate indoor area',()=>{
 const outline=rect(100,100,800,800),elements=outline.map((p,i)=>el('w'+i,'wall',[p,outline[(i+1)%4]]));
 elements.push(el('divider','wall',[[500,100],[500,900]]),el('Dining','room',rect(100,100,400,800)),el('Roofed loggia','room',rect(500,100,400,800),{spaceLocation:'exterior',outdoorType:'loggia',roofState:'covered'}));
 const r=validateInterpretation(JSON.parse(JSON.stringify({version:1,outline,elements,warnings:[]}))),m=materializeInterpretation(r,{x:0,y:0,width:10,height:10,calibrated:true});
 assert.equal(m.rooms.length,1);assert.equal(area(m.rooms[0].points),32);assert.equal(m.pendingSpaces.length,0);
 assert.equal(m.features[0].spaceLocation,'exterior');assert.equal(outdoorDescription(m.features[0]),'Covered outdoors · loggia');
});
test('Fixture edges, movable partitions and toilet stall gates cannot supply enclosure',()=>{
 const normalized=normalizeArchitecturalElements([
  el('Desk edge','wall',[[100,100],[200,100]],{boundaryRole:'furniture'}),
  el('Sink','wall',[[100,100],[200,100]],{boundaryRole:'fixture'}),
  el('Screen','wall',[[100,100],[200,100]],{boundaryRole:'movable'}),
  el('Stall','door',[[100,100],[200,100]],{boundaryRole:'toilet-partition'}),
  el('Restroom perimeter','wall',[[100,100],[200,100]],{boundaryRole:'enclosure'})]);
 assert.equal(normalized.filter(e=>e.kind==='wall').length,1);assert.equal(normalized.filter(e=>e.kind==='door').length,0);
 const m=materializeInterpretation({version:1,outline:[],elements:normalized,warnings:[]},{x:0,y:0,width:10,height:10,calibrated:true});
 assert.equal(m.walls.length,1);assert.equal(m.doors.length,0);assert.equal(m.rooms.length,0);
});
test('Explicit basin and urinal objects are fixtures while complete private toilets remain rooms',()=>{
 const elements=normalizeArchitecturalElements(['Wash basin','Urinals','Toilet bowl','Toilet','Private toilet room','Restroom with wash basins'].map(label=>el(label,'room',rect(0,0,10,10))));
 assert.deepEqual(elements.map(e=>e.kind),['sanitary-fixture','sanitary-fixture','sanitary-fixture','room','room','room']);
});
