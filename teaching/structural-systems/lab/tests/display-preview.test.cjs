const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W={document:{body:{dataset:{studioSpace:'concrete'}}}};
for(const f of ['structure-lighting.js','structure-core.js','concrete-pdf-data.js','concrete-building-data.js','concrete-parametric.js','concrete-geometry.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{window:W,console});
const M=W.ConcreteBuildingData,E=W.ConcreteParametric,L=W.LabLighting;
for(const prototype of Object.keys(M.prototypes))test(prototype+': unresolved preview has shaded faces without completing choices or contaminating exports',()=>{
 const s=M.initialize({...M.defaults(),prototype}),before=JSON.stringify(s),sc=M.scene(s,null,{progressive:true,previewPending:true});
 assert.ok(sc.items.some(i=>i.type==='poly'&&i.pending&&i.kind==='deck'));
 assert.ok(sc.items.some(i=>i.type==='poly'&&i.pending&&i.kind==='vertical'));
 assert.ok(sc.items.filter(i=>i.pending).every(i=>i.alpha===1&&i.preview&&i.sourceCell===null));
 assert.equal(JSON.stringify(s),before);assert.equal(E.progress(s).complete,false);assert.equal(M.check(s,'roof').cell,null);
 const map=new L.ShadowMap(sc.items,i=>W.LabJoinery.corners(i),256);assert.ok(map.valid);assert.ok(map.depth.some(Number.isFinite));
 assert.ok(M.scene(s,null,{progressive:true}).items.filter(i=>i.type==='poly').every(i=>i.tableKey==='raft'),'Export does not turn provisional sections into chosen sections');
 s.showGuides=false;assert.ok(!M.scene(s,null,{progressive:true,previewPending:true}).items.some(i=>i.pending));
});
test('an original PDF selection replaces the roof preview and retains its exact section source',()=>{
 const s=M.initialize(M.defaults()),cell=W.ConcretePDFData.cells.find(c=>M.compatible(s,'roof',c)&&M.sourceSpan(s,'roof',c).within&&!c.sourceAnomaly&&c.capacity>=M.check(s,'roof').demand);
 assert.ok(cell);assert.equal(E.pick(s,'roof',cell.id).ok,true);
 const roof=M.scene(s,null,{progressive:true,previewPending:true}).items.filter(i=>i.type==='poly'&&i.tableKey==='roof');
 assert.ok(roof.length);assert.ok(roof.every(i=>!i.pending&&i.sourceCell===cell.id));assert.equal(M.check(s,'roof').cell.depth,cell.depth);
});
test('material finishes are distinct, deterministic, and preserve analysis overlays',()=>{
 const item={type:'beam',a:[0,1,0],b:[10,1,0]},map=new L.ShadowMap([{...item,w:1,h:1}],i=>W.LabJoinery.corners(i),256),colors=[];
 for(const kind of ['wood','steel','concrete']){const m=L.materialFor(item,kind);colors.push(m.color);m.coordinates=L.textureCoordinates(map,m);const q=map.project([2,.5,.3]);assert.equal(L.texture(m,...q),L.texture(m,...q));assert.ok(L.texture(m,...q)>.85&&L.texture(m,...q)<1.05);}
 assert.equal(new Set(colors).size,3);assert.equal(L.materialFor({type:'poly',alpha:.2,id:'tributary'},'steel'),null);assert.equal(L.materialFor({...item,id:'footing-A'},'steel').kind,'concrete');
});
test('material display changes color without changing pixel depth or picking',()=>{
 const p=(x,y,z)=>({x,y,depth:z,light:[x,y,z,1]}),face={p:[p(0,0,1),p(18,0,1),p(0,18,1)],color:'#bbcddd',id:'member'};
 const plain=new W.DepthSurface(20,20),textured=new W.DepthSurface(20,20),material={kind:'wood',coordinates:[[1,0,0,0],[0,1,0,0],[0,0,1,0]]};
 plain.add(face);textured.add({...face,shadow:{map:{visibility:()=>1},material}});
 assert.equal(plain.pick(4,4),textured.pick(4,4));assert.equal(plain.z[84],textured.z[84]);assert.notEqual(plain.colors[336],textured.colors[336]);
});
test('fine grain fades at distant pixel footprints to prevent moire',()=>{
 const m={kind:'wood',coordinates:[[1,0,0,0],[0,1,0,0],[0,0,1,0]]};
 const near=L.filterTexture(m,[.001,0,0],[0,.001,0]),far=L.filterTexture(m,[.5,0,0],[0,.5,0]);
 assert.ok(near.grain[0]>.99);assert.ok(far.grain[0]<.001);assert.ok(far.grain[1]<.001);
});
test('all building renderers preserve orthographic and perspective while changing finishes',()=>{
 for(const space of ['wood','steel','concrete'])for(const projection of ['perspective','orthographic']){
  W.document.body.dataset.studioSpace=space;W.StructureDisplay={projection,view:'3d',materials:false,xray:false};
  const r=Object.assign(Object.create(W.LabRenderer.prototype),{canvas:{closest:()=>true}});r.applyDisplay();assert.equal(r.projection,projection);assert.equal(r.materials,false);
  W.StructureDisplay.materials=true;r.applyDisplay();assert.equal(r.projection,projection);assert.equal(r.mode,'3d');assert.equal(r.materials,true);
 }
});
