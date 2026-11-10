const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),window={},ctx=vm.createContext({window,globalThis:window,console});
for(const f of ['concrete-pdf-data.js','concrete-building-data.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const M=window.ConcreteBuildingData,P=window.ConcretePDFData,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function choose(s,key){for(const c of P.cells){const old=s.selections[key];if(M.applyCell(s,key,c.id).ok&&M.check(s,key).passes)return c;if(old)s.selections[key]=old;else delete s.selections[key];}throw Error('No passing cell for '+s.prototype+' '+key);}
test('ALPHA A.3 and DELTA D.3 have direct wall-supported tees, no standalone columns or beams',()=>{
 for(const prototype of ['ALPHA','DELTA']){const s={...M.defaults(),prototype,cores:false,enclosure:false};assert.equal(s.basis,'poster');assert.equal(M.beamRoles(s).length,0);assert.ok(M.supportLines(s).every(x=>x.wall));const scene=M.scene(s);assert.ok(!scene.items.some(x=>/^column-|^(floor|roof)-beam-/.test(x.id||'')));assert.ok(scene.items.some(x=>x.id?.startsWith('haunch-floor-')));assert.ok(!M.assemblyStages(s).some(x=>/beams/.test(x)));choose(s,'floor');const r=M.calc(s).floorReactions;assert.equal(r.members.length,0);assert.equal(r.columns.length,0);near(r.totalToSupports,r.deckTotal);assert.equal(M.applyCell(s,'floorBeam',P.cells.find(x=>x.family==='T').id).ok,false);}
});
test('KILO poster has perimeter block walls and internal beams supported by portal walls',()=>{
 const s={...M.defaults(),prototype:'KILO',cores:false,enclosure:false},lines=M.supportLines(s),scene=M.scene(s);assert.equal(lines[0].wall,true);assert.equal(lines[1].wall,false);assert.equal(lines[2].wall,true);assert.ok(scene.items.some(x=>x.id==='floor-beam-30-0'));assert.ok(!scene.items.some(x=>/^column-/.test(x.id||'')));assert.ok(scene.items.some(x=>x.id?.startsWith('block-0-')));assert.ok(scene.items.some(x=>x.id?.startsWith('litewall-30-24-head-')));near(M.layout(s).beamTributary,30);
});
test('CHARLIE uses columns, haunches and beams; course walls are opt-in',()=>{
 const s={...M.defaults(),prototype:'CHARLIE',cores:false};assert.ok(M.supportLines(s).every(x=>!x.wall));const scene=M.scene(s);assert.ok(scene.items.some(x=>x.id?.startsWith('column-haunch-')));s.basis='course';assert.equal(M.supportLines(s).filter(x=>x.wall).length,1);s.wallLines=3;assert.equal(M.supportLines(s).filter(x=>x.wall).length,3);
});
test('course additions remain separate, and source registry has no phantom beam groups',()=>{
 for(const prototype of ['ALPHA','DELTA']){const s={...M.defaults(),prototype};assert.ok(!M.componentSchedule(s).some(x=>x.key.endsWith('Beam')));s.basis='course';assert.equal(M.supportLines(s).filter(x=>!x.wall).length,1);assert.equal(M.beamRoles(s).length,2);}
 for(const prototype of Object.keys(M.prototypes)){const s={...M.defaults(),prototype};const rows=M.componentSchedule(s);for(const i of M.scene(s).items.filter(x=>x.type==='beam')){assert.ok(i.tableKey,'Missing source category: '+i.id);assert.ok(rows.some(r=>r.key===i.tableKey),i.id);}}
});
test('wrong family, width, topping and short span cannot overwrite a valid original cell',()=>{
 const s=M.defaults();const good='p6-8LDT18plus2-68-S-30';assert.equal(M.applyCell(s,'floor',good).ok,true);
 for(const bad of [P.cells.find(x=>x.family==='HC'),P.cells.find(x=>x.family==='DT'&&x.width===10),P.cells.find(x=>x.family==='DT'&&x.width===8&&x.topping===0),P.cells.find(x=>x.family==='DT'&&x.width===8&&x.topping===2&&x.span<30)]){assert.equal(M.applyCell(s,'floor',bad.id).ok,false);assert.equal(s.selections.floor,good);}
 assert.equal(M.applyCell(s,'roof',good).ok,false);assert.equal(s.selections.roof,undefined);
});
test('each rendered deck part uses its selected original section and source ID, with independent roof and floor',()=>{
 const s=M.defaults();M.applyCell(s,'floor','p6-8LDT18plus2-68-S-30');M.applyCell(s,'roof','p6-8LDT18plus2-68-D1-32');
 const scene=M.scene(s);for(const level of ['roof','floor'])for(const i of scene.items.filter(x=>x.tableKey===level)){assert.equal(i.sourceCell,s.selections[level]);assert.equal(i.sourcePage,6);}
 const c=M.calc(s);near(c.checks.floor.c.selfWeight,59);near(c.checks.floor.c.depth,20);near(c.floorQ,59+65);assert.equal(c.checks.roof.c.span,32);
 s.use='library';assert.equal(M.check(s,'floor').passes,false);assert.equal(M.check(s,'roof').passes,true);
});
test('L, T and rectangular beam table dimensions and selfweight remain identical to rendered/source records',()=>{
 for(const prototype of ['CHARLIE','KILO'])for(const family of ['L','T','R']){const s={...M.defaults(),prototype,cores:false},role=M.beamRoles(s).find(r=>r.key==='floorBeam');choose(s,'floor');const cell=P.cells.find(x=>x.family===family&&x.span===M.layout(s).beamSpan&&!x.sourceAnomaly);assert.equal(M.applyCell(s,role.key,cell.id).ok,true);const p=M.beamProfile(s,role.key);near(p.w,cell.width);near(p.h*12,cell.depth);const pieces=M.scene(s).items.filter(x=>x.tableKey===role.key);assert.ok(pieces.length);assert.ok(pieces.every(x=>x.sourceCell===cell.id));for(const m of M.calc(s).floorReactions.members.filter(x=>x.key===role.key))near(m.selfWeight,cell.selfWeight*m.chord*m.multiplicity);}
});
test('stairs retain the exact clicked row; reference-only members never inherit beam/deck capacity',()=>{
 const s=M.defaults();assert.equal(M.applyCell(s,'stairs','p10-stair-10').ok,true);near(s.stairThickness,10);near(M.calc(s).stairLimit,23);const saved=M.normalize(JSON.parse(JSON.stringify(s)));assert.equal(saved.stairSelection,'p10-stair-10');assert.ok(M.scene(s).items.filter(x=>x.tableKey==='stairs').every(x=>x.sourceCell==='p10-stair-10'));for(const key of ['walls','landings','raft','enclosure'])assert.ok(M.scene(s).items.filter(x=>x.tableKey===key).every(x=>x.sourceCell===null));
});
test('all four poster systems conserve load after asymmetric floor openings',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s={...M.defaults(),prototype,cores:false,roofVoids:[],voids:[M.layout({...M.defaults(),prototype}).panels[2].id]};choose(s,'floor');for(const r of M.beamRoles(s).filter(x=>x.level==='floor'))choose(s,r.key);const r=M.calc(s).floorReactions;near(r.totalToSupports,r.deckTotal+r.beamWeight);for(const m of r.members)near(m.r0+m.r1,m.deckLoad+m.selfWeight);}
});
test('all systems, occupancies and assembly stages produce finite, positive solid geometry',()=>{
 for(const basis of ['poster','course'])for(const prototype of Object.keys(M.prototypes))for(const use of Object.keys(M.uses))for(let stage=1;stage<=7;stage++){const s={...M.defaults(),basis,prototype,use,stage};const solids=M.scene(s).items.filter(x=>x.type==='beam');assert.ok(solids.length);for(const x of solids){assert.ok([...x.a,...x.b,x.w,x.h].every(Number.isFinite),x.id);assert.ok(x.w>0&&x.h>0,x.id);}}
});
