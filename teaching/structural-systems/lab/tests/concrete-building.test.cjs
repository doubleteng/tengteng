const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),window={},ctx=vm.createContext({window,globalThis:window,console});
for(const f of ['concrete-pdf-data.js','concrete-building-data.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const M=window.ConcreteBuildingData,P=window.ConcretePDFData,near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,msg||`${a} != ${b}`);
function select(s,key){const options=P.cells.filter(c=>{s.selections[key]=c.id;return M.check(s,key).passes;}).sort((a,b)=>a.depth-b.depth||a.span-b.span);delete s.selections[key];if(!options.length){for(const c of P.cells){s.selections[key]=c.id;if(M.check(s,key).compatible&&!c.sourceAnomaly)options.push(c);}options.sort((a,b)=>b.capacity-a.capacity);}if(options.length)s.selections[key]=options[0].id;return options[0];}
test('four prototypes x three uses x seven stages contain finite geometry, real stairs and roof-independent floor',()=>{
 for(const prototype of Object.keys(M.prototypes))for(const use of Object.keys(M.uses))for(const stage of [1,2,3,4,5,6,7]){
  const s={...M.defaults(),prototype,use,stage},c=M.calc(s),scene=M.scene(s);
  assert.ok(c.floorArea>=5400&&c.floorArea<7200);assert.ok(scene.items.length);
  assert.ok(scene.items.every(i=>!i.a||[...i.a,...i.b,i.w??0,i.h??0].every(Number.isFinite)));
  assert.equal(c.floorDeckTotal,null);assert.equal(scene.items.some(i=>i.id==='stair-1-lower-flight'),stage>=4);
  assert.equal(scene.items.some(i=>i.id==='stair-2-lower-flight'),stage>=4);
  if(stage>=5)assert.ok(scene.items.some(i=>i.id?.startsWith('floor:p-')));
 }
});
test('original assignment uses, location loads and foundation thickness remain exact',()=>{
 for(const [use,roof,floor,raft]of [['office',35,65,50],['grocery',55,95,50],['library',115,165,68]]){const s={...M.defaults(),use};near(M.check(s,'roof').required,roof);near(M.check(s,'floor').required,floor);near(M.calc(s).raftWeight,7200*raft/12*150);}
});
test('true roof chord rejects the nominal 30 ft column; floor stays independent',()=>{
 const s={...M.defaults(),use:'library'};s.selections.roof='p6-8LDT18plus2-68-S-30';assert.equal(M.check(s,'roof').compatible,false);
 s.selections.roof='p6-8LDT18plus2-68-D1-32';const c=M.calc(s);assert.equal(c.checks.roof.passes,true);near(c.roofQ,59/Math.cos(Math.PI/60)+115);near(c.checks.roofBeam.required,c.roofQ*30);near(c.roofDeckTotal,c.roofQ*6480);
 s.selections.floor='p6-8LDT18plus2-68-S-30';assert.equal(M.check(s,'floor').compatible,true);assert.equal(M.check(s,'floor').passes,false);near(M.calc(s).floorQ,224);
 s.roofTopping=0;assert.equal(M.calc(s).roofQ,null);assert.equal(M.validChoice(s,'roof'),null);
});
test('Kilo follows the original continuous-wall scheme and 15 ft perimeter tributary width',()=>{
 const s={...M.defaults(),prototype:'KILO'},lines=M.supportLines(s);assert.equal(lines[1].wall,true);assert.equal(lines[0].wall,false);near(M.layout(s).beamTributary,15);
 const scene=M.scene(s);assert.ok(scene.items.some(i=>i.id==='floor-beam-0-0'));assert.ok(scene.items.some(i=>i.id==='floor-beam-60-0'));assert.ok(!scene.items.some(i=>i.id?.startsWith('column-')));
 assert.equal(M.normalize({prototype:'KILO',kiloSupport:'column'}).kiloSupport,'wall');
});
test('all simple-support reactions conserve deck plus beam weight after asymmetric panel removals',()=>{
 for(const prototype of Object.keys(M.prototypes))for(const use of Object.keys(M.uses)){
  const s={...M.defaults(),prototype,use,cores:false};s.roofVoids=[];s.voids=[M.layout(s).panels[1].id];
  for(const key of ['roof','floor',...M.beamRoles(s).map(r=>r.key)])select(s,key);
  const c=M.calc(s);
  for(const level of ['roof','floor']){const r=c[level+'Reactions'];assert.ok(r.deckTotal>0);assert.ok(r.beamWeight!==null,prototype+' '+use+' '+level);near(r.totalToSupports,r.deckTotal+r.beamWeight);for(const m of r.members)near(m.r0+m.r1,m.deckLoad+m.selfWeight);}
  for(const col of c.columns)near(col.foundation,col.roof+col.floor+col.selfWeight);
 }
});
test('opening modules preserve factory units and core reservations are counted once',()=>{
 const s=M.defaults(),c=M.calc(s);near(c.voidArea,1440);s.voids=[c.layout.coreVoids[0]];near(M.calc(s).voidArea,1440);
 s.voids=M.layout(s).panels.slice(0,20).map(p=>p.id);assert.ok(M.calc(s).warnings.some(x=>x.includes('25%')));
 s.prototype='DELTA';s.deltaWidth=8;near(M.layout(s).uncovered,480);assert.ok(M.calc(s).warnings.some(x=>x.includes('edge strip')));
});
test('elevator is exactly 100 sf, stairs have horizontal span below source maximum, slope height limit flagged',()=>{
 const s=M.defaults(),lift=M.coreLayout(s).find(c=>c.type==='elevator');near(lift.dx*lift.dz,100);assert.ok(lift.dx>=8&&lift.dz>=8);near(M.calc(s).stairSpan,121/12);assert.ok(M.calc(s).stairPass);s.slope=10;assert.ok(M.calc(s).warnings.some(x=>x.includes('high point')));
});
test('anomalous printed capacities never report a passing numerical check',()=>{
 const s=M.defaults();select(s,'floor');const a=P.cells.find(c=>c.page===14&&c.section==='28IT32'&&c.span===26);assert.ok(a.sourceAnomaly);s.selections.floorBeam=a.id;assert.equal(M.check(s,'floorBeam').passes,false);assert.equal(M.check(s,'floorBeam').anomaly,true);
});
test('geometry uses only compatible source dimensions and preserves saved evidence',()=>{
 const s=M.defaults();s.selections.floor='p6-8LDT18plus2-68-S-30';let a=M.scene(s).items.filter(i=>i.id==='floor:p-0-24');assert.ok(a.length===3);
 s.prototype='CHARLIE';assert.equal(M.validChoice(s,'floor'),null);a=M.scene(s).items.find(i=>i.id==='floor:p-12-30');near(a.h,10/12);
 s.notes['concrete-floor']='Original PDF source retained.';const restored=M.normalize(JSON.parse(JSON.stringify(s)));assert.equal(restored.selections.floor,s.selections.floor);assert.equal(restored.notes['concrete-floor'],s.notes['concrete-floor']);assert.equal(restored.version,2);
 assert.equal(M.normalize({slope:Infinity,stage:999,selections:{roof:'invented'},voids:['<script>']}).stage,7);
});
test('unsupported library floor combinations are explicit and Charlie shorter spans resolve the table deficit',()=>{
 for(const prototype of ['CHARLIE','DELTA','KILO']){let s={...M.defaults(),prototype,use:'library'};assert.ok(M.calc(s).warnings.some(w=>w.includes('Floor demand 165 psf exceeds')));if(prototype==='CHARLIE'){s.deckSpan=24;assert.ok(M.check(s,'floor').maxCapacity>=165);}}
});
test('every factory panel terminates at two defined bearing lines for each permitted layout',()=>{
 for(const prototype of Object.keys(M.prototypes))for(const deckSpan of [20,24,30]){const s={...M.defaults(),prototype,deckSpan},l=M.layout(s),lines=M.supportLines(s);for(const p of l.panels){const start=l.p.axis==='x'?p.x:p.z,end=start+p.span;assert.equal(lines.filter(x=>x.coord===start||x.coord===end).length,2);}}
 const s={...M.defaults(),prototype:'CHARLIE',wallLines:3};near(M.layout(s).beamTributary,15);
});
test('interior L-beams are paired, with per-member demand and both selfweights in reactions',()=>{
 const s={...M.defaults(),cores:false};select(s,'floor');const cell=P.cells.find(c=>c.family==='L'&&c.span===24&&!c.sourceAnomaly);assert.ok(cell);s.selections.floorBeam=cell.id;
 const c=M.calc(s);near(c.checks.floorBeam.tributary,15);assert.equal(c.checks.floorBeam.multiplicity,2);
 const m=c.floorReactions.members[0];assert.equal(m.multiplicity,2);near(m.selfWeight,2*cell.selfWeight*24);near(c.floorReactions.totalToSupports,c.floorReactions.deckTotal+c.floorReactions.beamWeight);
 assert.equal(M.scene(s).items.filter(x=>x.id===m.id).length,4);
});

test('L, inverted T and rectangular sections are solid, non-overlapping and applied to all four prototypes',()=>{
 for(const prototype of Object.keys(M.prototypes))for(const family of ['L','T','R']){
  const s={...M.defaults(),prototype,cores:false,showRoof:false,layer:'beams'};
  for(const role of M.beamRoles(s))s.beamFamilies[role.key]=family;
  for(const role of M.beamRoles(s).filter(r=>r.level==='floor')){
   const p=M.beamProfile(s,role.key),parts=M.beamParts(p),m=M.scene(s).items.filter(i=>i.id===`floor-beam-${role.lines[0].coord}-0`);
   assert.equal(p.schematic,true);assert.equal(M.check(s,role.key).passes,false);
   assert.equal(m.length,family==='R'?1:family==='L'&&!role.edge?4:2);
   const area=parts.reduce((a,x)=>a+x.w*x.h,0);
   near(area,p.count*(family==='R'?p.w*p.h:p.w*p.flangeH+p.webW*p.webH));
   for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j],overX=Math.min(a.offset+a.w/2,b.offset+b.w/2)-Math.max(a.offset-a.w/2,b.offset-b.w/2),overY=Math.min(a.y+a.h/2,b.y+b.h/2)-Math.max(a.y-a.h/2,b.y-b.h/2);
    assert.ok(overX<1e-7||overY<1e-7,'beam parts may meet but must not overlap');
   }
  }
 }
});
test('edge L ledges face inward at opposite Kilo sides and decks clear the webs',()=>{
 const s={...M.defaults(),prototype:'KILO',cores:false,showRoof:false},scene=M.scene(s);
 for(const coord of [0,60]){
  const parts=scene.items.filter(i=>i.id===`floor-beam-${coord}-0`);
  assert.equal(parts.length,2);const ledge=parts.find(i=>i.w===1.5),web=parts.find(i=>i.w===1);
  near(web.a[0],coord);near(ledge.a[0],coord+(coord===0?.25:-.25));
 }
 const deck=scene.items.find(i=>i.id==='floor:p-0-24');assert.ok(deck.a[0]>.5);near(deck.b[0],30);
});
test('Charlie independently checks edge L and interior T/R beams with each source self-weight',()=>{
 const s={...M.defaults(),prototype:'CHARLIE',cores:false};select(s,'floor');
 const edge=P.cells.find(c=>c.family==='L'&&c.span===20&&c.section==='18LB24'),interior=P.cells.find(c=>c.family==='T'&&c.span===20&&c.section==='28IT20');
 s.selections.floorEdgeBeam=edge.id;s.selections.floorBeam=interior.id;
 const c=M.calc(s);near(c.checks.floorEdgeBeam.tributary,15);near(c.checks.floorBeam.tributary,30);
 near(c.checks.floorBeam.required,c.checks.floorEdgeBeam.required*2);
 const r=c.floorReactions;for(const m of r.members){const cell=m.key==='floorEdgeBeam'?edge:interior;near(m.selfWeight,cell.selfWeight*20);}
 near(r.totalToSupports,r.deckTotal+r.beamWeight);
 for(const family of ['L','T','R']){
  const key='floorBeam',cell=P.cells.find(c=>c.family===family&&c.span===20&&!c.sourceAnomaly);s.beamFamilies[key]=family;s.selections[key]=cell.id;
  const p=M.beamProfile(s,key);assert.equal(p.schematic,false);near(p.h*12,cell.depth);near(p.w,cell.width);assert.equal(M.beamPage(s,key),cell.page);
 }
 const saved=M.normalize(JSON.parse(JSON.stringify(s)));assert.equal(saved.selections.floorEdgeBeam,edge.id);assert.equal(saved.beamFamilies.floorBeam,'R');
});
test('old mixed-layout studies migrate shared beams without inventing capacity selections',()=>{
 const cell=P.cells.find(c=>c.family==='T'&&c.span===20&&!c.sourceAnomaly),old=M.normalize({prototype:'CHARLIE',selections:{floorBeam:cell.id}});
 assert.equal(old.selections.floorEdgeBeam,cell.id);assert.equal(M.normalize(M.defaults()).selections.floorEdgeBeam,undefined);
});
