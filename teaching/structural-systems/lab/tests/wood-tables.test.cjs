const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),window={},ctx=vm.createContext({window,globalThis:window,console});
for(const f of ['structure-core.js','steel-pdf-tables.js','wood-pdf-tables.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const {WoodPDFTables:T,WoodProject:P,StructureEngine:E,FloorLayout:F,LAB_MODULES:modules}=window;
const fresh=()=>JSON.parse(JSON.stringify(Object.fromEntries(modules.map(m=>[m.id,m.defaults]))));
for(const occ of ['office','grocery','library']){
 const s=fresh();T.apply(s,'roof-'+occ);const r=P.roofEstimate(s);
 assert.equal(s.floor.occupancy,occ);assert.equal(s.roof.occupancy,occ);assert.equal(s.truss.roofLoadMode,'linked');assert.equal(r.purlinWeight,8);
 const sum=s.truss.roofNodeLoadsPerFoot.reduce((x,f)=>x+f.w*s.building.length,0);
 assert.ok(Math.abs(sum-r.total)<1e-6,'Nodal roof loads conserve total roof weight');
 assert.equal(r.q,E.occupancies[occ].snow+15+6);assert.ok(T.report(s,'roof').valid);
 T.apply(s,'floor-'+occ);const floor=F.analyze(s);assert.equal(floor.live,E.occupancies[occ].live);assert.ok(floor.g.clear<=Math.min(E.occupancies[occ].floorSpan,8.44));assert.ok(Math.abs(floor.supportLoad-floor.totalLoad)<1e-5);assert.ok(T.report(s,'floor').valid);
 assert.equal(floor.g.area,3600,'Applying a table retains the partial-floor area');
 s.floor.bayDead=16;assert.equal(T.report(s,'floor').valid,false,'15 psf source limit enforced');
}
for(let span=6;span<=15;span++){
 const s=fresh();T.apply(s,'purlin-simple-'+span);assert.equal(s.truss.spacing,span);assert.equal(s.roof.trussSpacing,span);assert.equal(P.roofEstimate(s).purlinWeight,8);
 const before=JSON.stringify(s);assert.throws(()=>T.apply(s,'purlin-multiple-'+span),/continuous/);assert.equal(JSON.stringify(s),before,'Unsupported condition never mutates the model');
 s.roof.trussSpacing=span+.5;assert.equal(T.report(s,'purlin').valid,false);
}
assert.equal(T.cells.find(c=>c.id==='purlin-simple-12').value,665);assert.equal(T.cells.find(c=>c.id==='purlin-multiple-12').value,510);
for(const width of [46,94,118,142]){const s=fresh();T.apply(s,'width-'+width);assert.equal(F.geometry(s).p.panelWidthIn,width);assert.equal(T.normalize(s.roof.tableSelections).width,'width-'+width);}
assert.equal(Object.keys(T.normalize({roof:'purlin-simple-12',floor:'<script>',width:'width-142'})).length,1);
const s=fresh();T.apply(s,'roof-office');const pick=s.roof.tableSelections.roof;P.setBrief(s,'library');assert.equal(s.roof.tableSelections.roof,pick);assert.equal(T.report(s,'roof').valid,false,'Stored source choice becomes stale after brief change');
for(const type of Object.keys(T.sources))for(const b of T.spec(fresh(),type).buttons){assert.ok(b.rect.every(Number.isFinite));assert.ok(b.rect[0]>=0&&b.rect[0]+b.rect[2]<=960&&b.rect[1]+b.rect[3]<=540);}
console.log('PASS: original PDF cells → model geometry/loads; all 3 briefs, 10 purlin spans, 4 widths; roof/floor load conservation; incompatible support rejection; source-staleness and saved-ID validation.');
