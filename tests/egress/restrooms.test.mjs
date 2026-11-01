import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validateInterpretation,materializeInterpretation,confirmOpening} from '../../teaching/egress/src/semantic-plan.mjs';
import {normalizeSanitaryElements} from '../../teaching/egress/src/sanitary-elements.mjs';
import {syncEnclosedRooms} from '../../teaching/egress/src/editable-plan.mjs';
import {area} from '../../teaching/egress/src/geometry.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const el=(id,kind,points,label=id)=>({id,kind,points,label,confidence:'high',evidence:'Synthetic contract fixture.'});
function fixture(){
 const outline=rect(0,0,1000,1000),elements=outline.map((p,i)=>el('w'+i,'wall',[p,outline[(i+1)%4]]));
 elements.push(el('divider','wall',[[0,700],[1000,700]]),{...el('wc','room',rect(0,0,1000,700),'Restroom'),roomUse:'restroom',evidence:'Restroom contains toilet stalls and sinks.'},el('hall','corridor',rect(0,700,1000,300)),el('entry','door',[[400,700],[500,700]],'Restroom entrance'));
 for(let i=0;i<3;i++)elements.push(el('stall'+i,'toilet-compartment',rect(50+i*250,50,200,250),'Toilet stall '+i),el('panel'+i,'toilet-partition',[[250+i*250,50],[250+i*250,300]]),el('gate'+i,'toilet-door',[[80+i*250,300],[180+i*250,300]]),el('fixture'+i,'sanitary-fixture',rect(100+i*250,100,70,100)));
 return {version:1,outline,elements,warnings:[],summary:'Synthetic restroom regression'};
}
const image={x:0,y:0,width:10,height:10,calibrated:true};
test('Three toilet cubicles remain fixtures within one restroom; only the main entrance is a doorway',()=>{
 const m=materializeInterpretation(validateInterpretation(fixture()),image);
 assert.equal(m.rooms.length,2);assert.equal(m.walls.length,5);assert.equal(m.candidates.length,1);assert.equal(m.doors.length,0);
 assert.equal(m.features.length,12);assert.equal(m.rooms.filter(r=>r.roomUse==='restroom').length,1);
 const wc=m.rooms.find(r=>r.roomUse==='restroom');assert.equal(area(wc.points),70);
 confirmOpening(m,m.candidates[0]);assert.equal(m.doors.length,1);assert.equal(m.doors[0].exit,false);
 syncEnclosedRooms(m);assert.equal(m.rooms.filter(r=>r.roomUse==='restroom').length,1);
 assert.equal(m.rooms.length,2);assert.equal(area(m.rooms.find(r=>r.roomUse==='restroom').points),70);
});
test('Explicit legacy stall rooms, panels and gates are normalized without discarding their editable geometry',()=>{
 const f=fixture();for(const e of f.elements){if(e.kind==='toilet-compartment')e.kind='room';if(e.kind==='toilet-partition'){e.kind='wall';e.label='Toilet stall partition';}if(e.kind==='toilet-door'){e.kind='entrance';e.label='Toilet stall door';}}
 const m=materializeInterpretation(validateInterpretation(f),image);assert.equal(m.rooms.length,2);assert.equal(m.walls.length,5);assert.equal(m.candidates.length,1);assert.equal(m.features.length,12);
});
test('Mentioning cubicles in whole-restroom evidence does not erase that restroom',()=>{
 const e=el('wc','room',rect(0,0,100,100),'Restroom');e.evidence='A restroom with toilet stalls and basins.';
 const result=normalizeSanitaryElements([e])[0];assert.equal(result.kind,'room');assert.equal(result.roomUse,'restroom');
});
test('Separate full-height private WC rooms and their entrance doors remain distinct',()=>{
 const f=fixture();f.elements=f.elements.filter(e=>!['toilet-compartment','toilet-partition','toilet-door','sanitary-fixture'].includes(e.kind));
 f.elements=f.elements.filter(e=>e.id!=='wc');f.elements.push(el('private-divider','wall',[[500,0],[500,700]]),el('wcA','room',rect(0,0,500,700),'Accessible WC'),el('wcB','room',rect(500,0,500,700),'Private toilet'),el('entryB','door',[[700,700],[800,700]],'Private WC entrance'));
 const m=materializeInterpretation(validateInterpretation(f),image);assert.equal(m.rooms.length,3);assert.equal(m.rooms.filter(r=>r.roomUse==='restroom').length,2);assert.equal(m.candidates.length,2);
});
test('Restroom types survive serialized interpretation and match the provider schema',()=>{
 const f=validateInterpretation(JSON.parse(JSON.stringify(validateInterpretation(fixture()))));assert.equal(f.elements.filter(e=>e.kind==='toilet-door').length,3);
 const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../../scripts/egress/Vision.gs',import.meta.url),'utf8'),ctx);
 const schema=ctx.visionSchema_().properties.elements.items.properties;for(const kind of ['toilet-compartment','toilet-partition','toilet-door','sanitary-fixture'])assert.ok(schema.kind.enum.includes(kind));assert.ok(schema.roomUse.enum.includes('restroom'));
});
