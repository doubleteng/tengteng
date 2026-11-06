const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..')+'/',window={},ctx=vm.createContext({window,globalThis:window,console});
for(const file of ['structure-core.js','steel-roof-data.js','steel-pdf-map.js','steel-pdf-tables.js','steel-explain.js','steel-roof-lessons.js','steel-floor-data.js','steel-floor-lessons.js','steel-foundation-data.js','steel-linked-tables.js','steel-project-brief.js','steel-foundation-lessons.js','structure-course-guide.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx,{filename:file});
const R=window.SteelRoof,F=window.SteelFloor,N=window.SteelFoundation;
for(const family of ['3060','4060'])for(const option of 'ABCDE')for(const floor of 'PQRSTUVW'){
 const r=R.normalize({...R.defaults(),family,option}),f=F.normalize({...F.defaults(),option:floor,optionChosen:true,elevation:16,beamName:'W30x90',girderName:'W24x100'});F.sync(r,f);
 const bay=F.scene(r,f,'floor-beam'),building=F.projectScene(r,f);
 for(const [items,beamId,girderId]of [[bay.items,'beam','girder'],[building.items,'floor-beam','floor-girder']]){
  const b=items.find(i=>i.id===beamId&&i.type==='beam'),g=items.find(i=>i.id===girderId&&i.type==='beam');
  assert.equal(b.h,2.5);assert.equal(g.h,2);assert.equal(b.a[1]+b.h/2,16);assert.equal(g.a[1]+g.h/2,16);
 }
 const n=N.defaults();N.current(r,f,n);const columns=N.columns(r,f),scene=N.scene(r,f,n),ids=scene.items.filter(i=>i.type==='beam'&&i.id.startsWith('support:')).map(i=>i.id);
 assert.equal(ids.length,columns.length,'No duplicate column overlays');assert.equal(new Set(ids).size,columns.length,'Every support can be picked');
 for(const c of columns)assert.ok(ids.includes('support:'+c.key));
 const selected=columns.at(-1);n.selected=selected.key;n.layer='columns';const picked=N.scene(r,f,n);assert.equal(picked.selected,'support:'+selected.key);assert.equal(picked.items.filter(i=>i.type==='beam').length,columns.length);
}
const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),proto=window.LabRenderer.prototype,renderer=Object.create(proto);
for(const c of ['#bd9f7c','#536775','#4b8097','#cf7a42','#ab5551','#193ee3','#303d55','#000000'])assert.ok((luminance(renderer.modelColor(c))+.05)/(luminance('#666666')+.05)>=3,'Member contrast '+c);
Object.assign(renderer,{yaw:1.1,pitch:.3,zoom:2,pan:[50,40],center:[0,16,4],extent:155,render(){}});const view=renderer.captureView();renderer.pan[0]=99;assert.equal(view.pan[0],50);renderer.restoreView(view);assert.equal(renderer.pan[0],50);renderer.pan[0]=90;assert.equal(view.pan[0],50);
assert.equal(F.uses.office.live,65);assert.equal(window.StructureCourseGuide.stage('wood','floor'),window.StructureCourseGuide.stages.floor);
assert.equal(window.StructureCourseGuide.stage('steel','foundation-footing'),window.StructureCourseGuide.stages.steelFoundation);
assert.equal(window.StructureCourseGuide.stage('steel','floor-beam'),window.StructureCourseGuide.stages.steelFloor);
assert.ok(window.COACH_KNOWLEDGE.concepts.some(c=>c.id==='C76'&&c.why.includes('65/75/150')));
console.log('PASS: 80 linked roof/floor combinations; bay/building member elevations and depths agree; every column is uniquely selectable; camera snapshots are isolated; model colors contrast ≥3:1; course/Coach load distinctions retained.');
