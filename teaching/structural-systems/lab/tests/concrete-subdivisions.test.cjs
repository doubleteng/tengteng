const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W={};for(const f of ['concrete-pdf-data.js','concrete-building-data.js','concrete-parametric.js','concrete-geometry.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{window:W});
const M=W.ConcreteBuildingData,P=W.ConcretePDFData,E=W.ConcreteParametric;
const fresh=prototype=>M.initialize({...M.defaults(),prototype});
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const source=(s,key)=>{const v=P.cells.find(v=>M.compatible(s,key,v)&&M.sourceSpan(s,key,v).within&&!v.sourceAnomaly&&v.capacity>=M.check(s,key).demand);assert.ok(v,s.prototype+' '+key);assert.equal(E.pick(s,key,v.id).ok,true);return v;};

for(const prototype of Object.keys(M.prototypes))test(`${prototype}: both equal and unequal X/Z subdivisions regenerate geometry inside 60 × 120 ft`,()=>{
 const s=fresh(prototype);
 for(const [x,z]of [[[20,20,20],[24,24,24,24,24]],[[28,32],[22,26,24,28,20]]]){
  assert.equal(E.update(s,{gridX:x,gridZ:z}).ok,true);const l=M.layout(s),lines=M.supportLines(s);
  assert.deepEqual(plain(l.grid),{x,z});near(l.panels.reduce((n,p)=>n+p.dx*p.dz,0),7200);assert.equal(l.uncovered,0);
  assert.equal(Math.max(...l.panels.map(p=>p.x+p.dx)),60);assert.equal(Math.max(...l.panels.map(p=>p.z+p.dz)),120);
  assert.deepEqual(plain(lines.map(l=>l.coord)),plain(M.coordinates(l.axis==='x'?x:z)));
  for(const line of lines.filter(l=>l.kind!=='wall'))assert.deepEqual(plain(M.segments(line).map(a=>a.end-a.t)),l.axis==='x'?z:x);
  if(prototype==='ALPHA'||prototype==='DELTA')assert.equal(lines.filter(l=>l.kind==='column').length,1);
  if(prototype==='KILO'){assert.equal(lines.filter(l=>l.kind==='wall').length,1);assert.equal(lines.filter(l=>l.kind==='column').length,0);}
  const scene=M.scene(s);assert.ok(scene.items.some(i=>i.text===x[0]+' ft'));assert.ok(scene.items.some(i=>i.text===z[0]+' ft'));const raft=scene.items.filter(i=>i.type==='poly'&&i.id==='raft').flatMap(i=>i.points);assert.equal(Math.max(...raft.map(p=>p[0])),60);assert.equal(Math.max(...raft.map(p=>p[2])),120);
  const saved=M.normalize(plain(s));assert.deepEqual(plain(M.grid(saved)),{x,z});assert.equal(saved.gridConfirmed,true);
 }
});
test('invalid sums, nonfinite spans and impossible interior-line grids never partially mutate a study',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=fresh(prototype),before=JSON.stringify(s);for(const patch of [{gridX:'30, 29',gridZ:'30,30,30,30'},{gridZ:'40,40,44'},{gridX:[0,60]},{gridX:[NaN,30]},{gridX:[Infinity,30]},{gridX:[30,-30,60]}]){assert.equal(E.update(s,patch).ok,false);assert.equal(JSON.stringify(s),before);}if(prototype!=='ALPHA'){assert.equal(E.update(s,{[M.prototypes[prototype].axis==='x'?'gridX':'gridZ']:[M.prototypes[prototype].axis==='x'?60:120]}).ok,false);assert.equal(JSON.stringify(s),before);}}
});
test('all four retain roof/floor source IDs while an increased maximum span invalidates the prior source',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=fresh(prototype);E.update(s,{gridX:[30,30],gridZ:[30,30,30,30]});source(s,'floor');const cell=M.choice(s,'floor'),axis=M.layout(s).axis,total=axis==='x'?60:120,newMax=cell.span+2,patch={[axis==='x'?'gridX':'gridZ']:[newMax,total-newMax]};assert.equal(E.update(s,patch).ok,true);assert.equal(s.selections.floor,cell.id);assert.equal(M.check(s,'floor').within,false);assert.equal(M.check(s,'floor').compatible,false);assert.ok(M.scene(s,null,{progressive:true}).items.some(i=>i.pending&&i.tableKey==='floor'));}
});
test('nonuniform deck spans transfer their own tributary depth; both sides and beam selfweight conserve gravity loads',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=fresh(prototype);E.update(s,{gridX:[28,32],gridZ:prototype==='DELTA'?[36,40,44]:[28,30,32,30],alphaLine:28,deltaLine:76,wallLines:2});for(const level of ['roof','floor'])source(s,level);for(const r of M.beamRoles(s))source(s,r.key);const c=M.calc(s);
  for(const level of ['roof','floor']){const r=c[level];near(r.transferred,r.deckTotal+r.beamSelf);for(const b of r.beams){near(b.r0+b.r1,b.deck+b.self);for(const load of b.loads){const panel=c.layout.panels.find(p=>p.id===load.panel);near(load.tributaryDepth,panel.span/2);near(load.q,r.load.q*panel.span/2);}}
   const record=M.teachingRecord(s,level);near(record.support.area*record.q+record.support.beamWeight,record.support.force);
  }
 }
});
test('a short bay outside the printed prestress range cannot inherit a verified result from a longer bay',()=>{
 const s=fresh('ALPHA');E.update(s,{gridX:[4,28,28]});const v=P.cells.find(v=>v.family==='DT'&&v.width===8&&v.topping===2&&v.span>=28&&v.capacity>=65);assert.ok(v);assert.equal(E.pick(s,'floor',v.id).ok,true);const ch=M.check(s,'floor');assert.equal(ch.compatible,true);assert.equal(ch.sourceRange.within,false);assert.equal(ch.within,false);assert.ok(ch.scope.includes('4, 28, 28'));
});
test('ALPHA and KILO can adopt original PDF 20 ft spans as three X bays without changing Z or the footprint',()=>{
 for(const prototype of ['ALPHA','KILO']){const s=fresh(prototype),p=M.prototypes[prototype],v=P.cells.find(v=>v.family===p.family&&v.width===p.width&&v.topping===2&&v.span===20);assert.ok(v);assert.equal(E.pick(s,'floor',v.id,true).ok,true);assert.deepEqual(plain(M.grid(s)),{x:[20,20,20],z:[24,24,24,24,24]});assert.equal(M.layout(s).uncovered,0);assert.equal(s.selections.floor,v.id);}
});
test('changing only beam subdivisions updates lengths, support counts and source checks while retaining sections',()=>{
 const s=fresh('ALPHA');source(s,'floor');const v=P.cells.find(v=>v.section==='18LB20'&&v.span===24&&v.pattern==='9');assert.equal(E.pick(s,'floorBeam-L0',v.id).ok,true);const before=M.reactions(s,'floor');assert.equal(E.update(s,{gridZ:[20,30,40,30]}).ok,true);const after=M.reactions(s,'floor');assert.equal(s.selections['floorBeam-L0'],v.id);assert.equal(M.check(s,'floorBeam-L0').compatible,false);assert.equal(before.supports.length,6);assert.equal(after.supports.length,5);assert.deepEqual(plain(after.beams.map(b=>b.length)),[20,30,40,30]);
});
test('moving an interior KILO wall and ALPHA frame preserves their single-line support rules',()=>{
 const k=fresh('KILO');E.update(k,{gridX:[20,20,20],kiloLine:40});assert.equal(M.supportLines(k).find(l=>l.kind==='wall').coord,40);assert.equal(M.supportLines(k).filter(l=>l.kind==='portal').length,3);const a=fresh('ALPHA');E.update(a,{gridX:[20,20,20],alphaLine:40});assert.equal(M.supportLines(a).find(l=>l.kind==='column').coord,40);assert.equal(M.supportLines(a).filter(l=>l.kind==='wall').length,3);
});
test('malformed imported subdivision is reported and cannot resize the footprint or crash interior-line systems',()=>{
 for(const prototype of Object.keys(M.prototypes)){const s=M.normalize({...fresh(prototype),gridX:[20,20],gridZ:[120],gridConfirmed:true});assert.ok(s.migrationNotice);assert.equal(s.gridConfirmed,false);assert.equal(M.grid(s).x.reduce((a,b)=>a+b),60);assert.equal(M.grid(s).z.reduce((a,b)=>a+b),120);assert.doesNotThrow(()=>M.scene(s));}
});
