const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W={};for(const f of ['concrete-pdf-data.js','concrete-building-data.js','concrete-parametric.js','concrete-geometry.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{window:W});
const M=W.ConcreteBuildingData,P=W.ConcretePDFData,E=W.ConcreteParametric;
const state=prototype=>M.initialize({...M.defaults(),prototype});
const find=(section,span,pattern)=>P.cells.find(c=>c.section===section&&c.span===span&&(!pattern||c.pattern===pattern));
const pick=(s,key,section,span,pattern,adopt=false)=>{const c=find(section,span,pattern);assert.ok(c,section);assert.equal(E.pick(s,key,c.id,adopt).ok,true);return c;};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('all four fresh studies start with pending choices and guide geometry, not completed buildings',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=state(prototype),p=E.progress(s),sc=M.scene(s,null,{progressive:true});assert.equal(p.complete,false);assert.equal(Object.keys(s.selections).length,0);assert.ok(sc.items.some(i=>i.pending));assert.ok(sc.items.filter(i=>i.type==='poly').every(i=>i.tableKey==='raft'));s.showGuides=false;assert.ok(!M.scene(s,null,{progressive:true}).items.some(i=>i.pending));}
});
test('ALPHA original selection changes actual tee depth and dependent beam load; existing beam trial is retained',()=>{
 const s=state('ALPHA');pick(s,'floor','8LDT18plus2',30,'68-S');pick(s,'floorBeam-L0','18LB20',24,'9');const a=M.calc(s),beam=s.selections['floorBeam-L0'];pick(s,'floor','8LDT20plus2',30,'68-D1');const b=M.calc(s);assert.equal(b.floor.load.self-a.floor.load.self,2);close(b.checks['floorBeam-L0'].demand-a.checks['floorBeam-L0'].demand,30);assert.equal(s.selections['floorBeam-L0'],beam);assert.equal(b.checks.floor.cell.depth,22);assert.ok(s.lastChange.some(t=>t.includes('updated demand')));
 const sc=M.scene(s,null,{progressive:true});assert.ok(sc.items.some(i=>i.type==='poly'&&i.tableKey==='floor'));assert.ok(sc.items.some(i=>i.pending&&i.tableKey==='roof'));
});
test('ALPHA moving its sole frame preserves the trial but invalidates one-sided L support',()=>{
 const s=state('ALPHA');pick(s,'floor','8LDT20plus2',30,'68-D1');pick(s,'floorBeam-L0','18LB20',24,'9');E.update(s,{alphaLine:30});assert.equal(s.selections['floorBeam-L1'],'p13-18LB20-9-24');assert.equal(M.check(s,'floorBeam-L1').compatible,false);assert.equal(M.supportLines(s).filter(l=>l.kind==='column').length,1);assert.equal(s.gridConfirmed,true);
});
test('CHARLIE PDF span drives a new grid only when the student enables that action',()=>{
 const s=state('CHARLIE'),v=find('4HC8plus2',24,'68-S');assert.equal(E.pick(s,'floor',v.id,false).ok,false);assert.equal(s.charlieSpan,30);assert.equal(E.pick(s,'floor',v.id,true).ok,true);assert.equal(s.charlieSpan,24);assert.equal(M.layout(s).panels.length,75);assert.equal(M.layout(s).uncovered,0);assert.equal(M.supportLines(s).length,6);assert.equal(M.layout(s).beamSpan,20);assert.equal(s.selections.floor,v.id);
});
test('CHARLIE support count is a design input and newly introduced beam roles need their own source',()=>{
 const s=state('CHARLIE');E.update(s,{wallLines:1,charlieSpan:24});assert.equal(M.supportLines(s).filter(l=>l.kind==='wall').length,1);assert.equal(M.beamRoles(s).length,10);assert.equal(E.progress(s).complete,false);assert.ok(M.beamRoles(s).every(r=>M.check(s,r.key).cell===null));
});
test('DELTA can derive width and span from an original cell without erasing roof trials or notes',()=>{
 const s=state('DELTA');s.deltaWidth=8;pick(s,'roof','8DT24',40,'108-S');s.notes['concrete-floor']='Keep my decision';const roof=s.selections.roof;pick(s,'floor','10DT24plus2',30,'68-S',true);assert.equal(s.deltaWidth,10);assert.equal(s.deltaSpan,30);assert.equal(s.deltaLine,60);assert.equal(s.selections.roof,roof);assert.equal(M.check(s,'roof').compatible,false);assert.equal(s.notes['concrete-floor'],'Keep my decision');assert.equal(M.layout(s).uncovered,0);
});
test('DELTA source-driven layout rejects 44 ft without any partial state mutation',()=>{
 const s=state('DELTA'),before=JSON.stringify(s);const v=find('10DT24plus2',44,'128-S');assert.equal(E.pick(s,'floor',v.id,true).ok,false);assert.equal(JSON.stringify(s),before);
});
test('KILO deeper hollowcore updates both beam demands, retaining its prescribed 30 / 24 ft system',()=>{
 const s=state('KILO');s.use='library';pick(s,'floor','4HC8plus2',30,'78-S');for(const r of M.beamRoles(s).filter(r=>r.level==='floor'))pick(s,r.key,'18LB24',24,'10');const before=M.calc(s);pick(s,'floor','4HC10plus2',30,'68-S');const after=M.calc(s);for(const r of M.beamRoles(s).filter(r=>r.level==='floor')){close(after.checks[r.key].demand-before.checks[r.key].demand,180);assert.equal(after.checks[r.key].within,true);}assert.equal(after.layout.span,30);assert.equal(after.layout.beamSpan,24);assert.equal(M.supportLines(s).filter(l=>l.kind==='column').length,0);assert.equal(E.pick(s,'floor',find('4HC8plus2',24,'68-S').id,true).ok,false);
});
test('changes in use recalculate checks without replacing the student selected cell',()=>{
 const s=state('KILO');pick(s,'floor','4HC8plus2',30,'78-S');const id=s.selections.floor;assert.equal(M.check(s,'floor').within,true);E.update(s,{use:'library'});assert.equal(s.selections.floor,id);assert.equal(M.check(s,'floor').demand,165);assert.equal(M.check(s,'floor').within,false);assert.ok(s.lastChange.some(x=>x.includes('Exceeds selected capacity')));
});
test('core position and dimensions regenerate floor reservations; collisions remain unresolved',()=>{
 const s=state('KILO'),before=M.layout(s).reserved.join(',');E.update(s,{corePositions:{elevator:{x:32,z:48}},elevatorWidth:8,elevatorArea:120});const core=M.cores(s).find(c=>c.id==='elevator');assert.equal(core.dx,8);assert.equal(core.dz,15);assert.notEqual(M.layout(s).reserved.join(','),before);assert.equal(M.coreProblems(s).length,0);E.update(s,{corePositions:{elevator:{x:26,z:48}}});assert.ok(M.coreProblems(s).some(x=>x.includes('support line')));assert.equal(M.calc(s).geometryOK,false);
});
test('roof elevation is a student input and updates geometry while retaining the height constraint',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=state(prototype);E.update(s,{roofBase:30});close(M.roofY(s,0),30);close(M.calc(s).rise,60*Math.tan(3*Math.PI/180));E.update(s,{roofBase:35});assert.equal(M.calc(s).geometryOK,false);}
});
test('every prototype can finish the modeling decisions through inputs and source picks, without claiming full design verification',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=state(prototype);s.gridConfirmed=true;s.verticalConfirmed=true;for(const level of ['roof','floor']){const candidates=P.cells.filter(c=>M.compatible(s,level,c)&&M.sourceSpan(s,level,c).within&&c.capacity>=M.check(s,level).demand&&!c.sourceAnomaly).sort((a,b)=>a.depth-b.depth);assert.ok(candidates.length,prototype+' '+level);assert.equal(E.pick(s,level,candidates[0].id).ok,true);}for(const r of M.beamRoles(s)){const candidates=P.cells.filter(c=>M.compatible(s,r.key,c)&&M.sourceSpan(s,r.key,c).within&&c.capacity>=M.check(s,r.key).demand&&!c.sourceAnomaly).sort((a,b)=>a.depth-b.depth);assert.ok(candidates.length,prototype+' '+r.key);assert.equal(E.pick(s,r.key,candidates[0].id).ok,true);}assert.equal(E.pick(s,'stairs',P.stairs.find(r=>r.thickness===8).id).ok,true);assert.equal(E.progress(s).complete,true,prototype);assert.equal(M.calc(s).allChecksComplete,false);assert.ok(!M.scene(s,null,{progressive:true}).items.some(i=>i.pending));const saved=M.normalize(JSON.parse(JSON.stringify(s)));assert.equal(E.progress(saved).complete,true,prototype+' restore');}
});
