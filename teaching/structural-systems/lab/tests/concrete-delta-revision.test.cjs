const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W={};for(const file of ['concrete-pdf-data.js','concrete-building-data.js','concrete-parametric.js','concrete-geometry.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{window:W});
const M=W.ConcreteBuildingData,P=W.ConcretePDFData;
const state=()=>M.initialize({...M.defaults(),prototype:'DELTA',use:'library'});
const pick=(s,key,section,span,pattern)=>{const c=P.cells.find(c=>c.section===section&&c.span===span&&(!pattern||c.pattern===pattern));assert.ok(c);assert.equal(M.applyCell(s,key,c.id).ok,true);return c;};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function selected(){const s=state();M.reviseDeltaSpan(s,30);pick(s,'roof','10DT24',30,'68-S');pick(s,'floor','10DT24plus2',30,'68-S');pick(s,'roofBeam-L2','28IT24',20);pick(s,'floorBeam-L2','28IT28',20);return s;}

test('DELTA 30 ft revision exactly covers 60 x 120 with four bays and one transverse frame',()=>{
 const s=state();assert.equal(s.deltaSpan,40);assert.equal(M.reviseDeltaSpan(s,30),true);const l=M.layout(s),lines=M.supportLines(s);
 assert.equal(l.uncovered,0);assert.equal(l.panels.length,24);assert.ok(l.panels.every(p=>p.span===30&&p.width===10));
 assert.deepEqual(Array.from(lines,x=>x.coord),[0,30,60,90,120]);assert.equal(lines.filter(x=>x.kind==='column').length,1);assert.equal(lines.filter(x=>x.kind==='wall').length,4);assert.equal(lines.find(x=>x.kind==='column').coord,60);
 assert.equal(M.scene(s).objects.filter(x=>x.id.startsWith('vertical-')).length,4);
 assert.match(M.projectDescription(s),/course prototype specifies 40 ft/);assert.ok(M.calc(s).warnings.some(w=>w.includes('bearing-wall line count')));
});
test('DELTA Houghton revised roof, floor and both beams pass printed original course cells',()=>{
 const s=selected(),c=M.calc(s);assert.equal(c.geometryOK,true);assert.equal(c.tableComplete,true);assert.equal(c.allChecksComplete,false);
 for(const [key,demand,capacity]of [['roof',115,171],['floor',165,172],['floorBeam-L2',7110,8350]]){assert.equal(c.checks[key].demand,demand);assert.equal(c.checks[key].cell.capacity,capacity);assert.equal(c.checks[key].within,true);assert.equal(c.checks[key].sourceRange.within,true);assert.ok(c.checks[key].cell.page<=18);}
 close(c.checks['roofBeam-L2'].demand,(115+47/Math.cos(3*Math.PI/180))*30);assert.equal(c.checks['roofBeam-L2'].cell.capacity,5990);
 assert.equal(c.floor.load.self,72);assert.equal(c.floor.load.q,237);assert.equal(c.checks.floor.cell.depth,26);assert.equal(c.checks.floor.cell.selfWeightLine,718);
 for(const level of ['roof','floor']){const r=c[level];close(r.transferred,r.deckTotal+r.beamSelf);for(const b of r.beams)close(b.r0+b.r1,b.deck+b.self);}
});
test('DELTA span changes rebuild openings and retain source trials without losing explanations',()=>{
 const s=selected();s.notes['concrete-layout']='One frame plus bearing walls';s.voids.push('p-20-30');M.reviseDeltaSpan(s,40);
 assert.equal(s.deltaSpan,40);assert.equal(s.deltaLine,40);assert.equal(Object.keys(s.selections).length,4);assert.equal(s.voids.length,1);assert.equal(M.check(s,'floor').within,false);assert.equal(s.notes['concrete-layout'],'One frame plus bearing walls');assert.equal(M.layout(s).panels.length,18);assert.ok(s.roofVoids.every(id=>M.layout(s).panels.some(p=>p.id===id)));
 pick(s,'floor','10DT24plus2',40,'128-S');assert.equal(M.check(s,'floor').within,false);assert.equal(M.check(s,'floor').cell.capacity,160);
});
test('DELTA revision survives JSON, preserves old 40 ft files and rejects non-grid frame locations',()=>{
 const s=selected(),n=M.normalize(JSON.parse(JSON.stringify(s)));assert.equal(n.deltaSpan,30);assert.equal(n.deltaLine,60);assert.equal(M.calc(n).tableComplete,true);
 for(const line of [30,60,90])assert.equal(M.normalize({...s,deltaLine:line}).deltaLine,line);
 assert.equal(M.normalize({...s,deltaLine:40}).deltaLine,60);assert.equal(M.normalize({...s,deltaSpan:44}).deltaSpan,40);
 const old=state();delete old.deltaSpan;assert.equal(M.normalize(old).deltaSpan,40);assert.equal(M.reviseDeltaSpan(s,44),false);
});
test('blank short-span source entries cannot be bypassed by clicking a longer-span high prestress row',()=>{
 const s=state();M.reviseDeltaSpan(s,30);pick(s,'floor','10DT24plus2',40,'128-S');let c=M.check(s,'floor');assert.equal(c.sourceRange.min,40);assert.equal(c.within,false);
 s.use='office';c=M.check(s,'floor');assert.equal(c.numericWithin,true);assert.equal(c.within,false);assert.match(c.status,/outside source row/);
 pick(s,'floor','10DT24plus2',30,'68-S');assert.equal(M.check(s,'floor').within,true);
});
test('revised DELTA solids retain actual 26 in floor depth, 30 ft grid and staged supports',()=>{
 const s=selected(),sc=M.scene(s),faces=sc.items.filter(x=>x.id==='floor:p-20-30'&&x.points),ys=faces.flatMap(f=>f.points.map(p=>p[1]));assert.ok(faces.length);close(Math.max(...ys)-Math.min(...ys),26/12);
 assert.ok(sc.items.some(i=>i.text==='30 ft'));for(let stage=1;stage<=7;stage++)assert.ok(M.scene({...s,stage}).objects.every(o=>o.stage<=stage));
 for(const line of M.supportLines(s).filter(x=>x.kind==='wall'))assert.ok(sc.objects.some(o=>o.id.startsWith('wall-'+line.id+'-')));
});
