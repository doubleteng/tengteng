const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../concrete-pdf-data.js'), 'utf8'), {window});
const D = window.ConcretePDFData;
const find = (page,section,pattern,span) => D.cells.find(c => c.page === page && c.section === section && c.pattern === pattern && c.span === span);

test('all 11 slab and beam capacity pages have original-page click evidence', () => {
  const counts = {};
  D.cells.forEach(c => counts[c.page] = (counts[c.page] || 0) + 1);
  assert.deepEqual(counts, {2:182,3:259,4:56,5:83,6:100,7:100,8:149,9:140,12:148,13:126,14:124});
  assert.equal(D.cells.length, 1467);
  assert.equal(new Set(D.cells.map(c=>c.id)).size,D.cells.length);
  for(const c of D.cells){
    const [w,h] = D.pages[c.page], [x,y,rw,rh] = c.rect;
    assert.ok(x>=0 && y>=0 && rw>0 && rh>0 && x+rw<=w && y+rh<=h,c.id);
    assert.ok(Number.isInteger(c.capacity) && c.capacity>0,c.id);
    assert.equal(c.capacityBasis,'superimposed service load');
  }
});

test('scan transcription matches independently checked original cells', () => {
  for(const [pg,sec,pat,span,capacity,sw] of [
    [4,'8LDT12','28-S',12,186,29],
    [4,'8LDT12plus2','68-S',30,47,54],
    [5,'8LDT16plus2','68-D1',30,135,58],
    [5,'8LDT16','88-D1',56,32,33],
    [6,'8LDT18plus2','68-S',30,117,59],
    [7,'8LDT20plus2','68-D1',30,182,61],
    [7,'8LDT20plus2','88-D1',38,136,61],
    [7,'8LDT20','108-D1',68,34,36],
    [13,'18LB24','10',24,4090,375],
    [13,'18LB40','18',34,5626,600],
    [13,'18LB60','27',50,5641,850]
  ]){
    const c=find(pg,sec,pat,span);
    assert.ok(c,`${pg} ${sec} ${pat} ${span}`);
    assert.equal(c.capacity,capacity);assert.equal(c.selfWeight,sw);
  }
  assert.equal(find(4,'8LDT12','28-S',30),undefined,'blank source cells stay unavailable');
});

test('topped selfweights and depth include topping once', () => {
  for(const c of D.cells.filter(c=>c.unit==='psf' && c.topping===2)){
    const base = D.cells.find(b=>b.page===c.page && b.section===c.section.replace('plus2',''));
    assert.ok(base,c.id);
    assert.equal(c.selfWeight-base.selfWeight,25,c.id);
    assert.equal(c.depth-base.depth,2,c.id);
    assert.equal(c.selfWeightIncludesTopping,true);
    assert.equal(c.assumedSuperimposedDeadPsf,15);
  }
});

test('source anomalies remain visible without invented corrections', () => {
  for(const [sec,span,value] of [['16RB36',28,5800],['28IT32',26,5330],['28IT52',46,4100]]){
    const c=D.cells.find(c=>c.section===sec && c.span===span);
    assert.equal(c.capacity,value);assert.equal(c.sourceAnomaly,true);assert.ok(c.sourceNote);
  }
  const typo=find(13,'18LB52','23',34);
  assert.equal(typo.depth,52);assert.equal(typo.selfWeight,750);
  assert.match(typo.sourceNote,/18LB50/);
});

test('printed line weights stay separate from rounded psf values', () => {
  for(const [page,untopped,topped] of [[2,195,295],[3,224,324],[4,229,429],[5,260,460],[6,275,475],[7,290,490],[8,418,618],[9,468,718]]){
    for(const c of D.cells.filter(c=>c.page===page))assert.equal(c.selfWeightLine,c.topping?topped:untopped,c.id);
  }
  const hc=D.cells.find(c=>c.page===2 && c.topping===0);
  assert.equal(hc.selfWeight,49);assert.equal(hc.selfWeightLine,195);
  assert.notEqual(hc.selfWeight*hc.width,hc.selfWeightLine,'rounding must not overwrite the printed plf');
  for(const c of D.cells.filter(c=>['L','T'].includes(c.family)))assert.equal(c.h1In+c.h2In,c.depth);
});

test('original stair table has separate click rows and original design conditions', () => {
  assert.equal(D.stairs.length,4);
  assert.deepEqual(Array.from(D.stairs,c=>[c.thickness,c.spanLimit]),[[6,14],[8,19],[10,23],[12,26]]);
  for(const c of D.stairs){
    assert.equal(c.page,10);assert.equal(c.liveLoadPsf,100);assert.equal(c.fcPsi,5000);
    assert.ok(c.rect[0]>270 && c.rect[0]+c.rect[2]<375);
    assert.ok(c.rect[1]>340 && c.rect[1]+c.rect[3]<425);
    assert.equal(D.cells.find(x=>x.id===c.id),undefined,'stairs are not service-load capacity cells');
  }
});

test('page 6 hit regions contain the printed capacities, including narrow final columns', () => {
  // Independent pixel anchors read on a 2x rendering of the original scan.
  // This catches a half-column-spacing error even when values and IDs are correct.
  for (const [section,pattern,span,value,px,py] of [
    ['8LDT18','28-S',16,194,295,621],
    ['8LDT18','48-S',42,35,763,662],
    ['8LDT18','68-S',26,162,476,716],
    ['8LDT18','68-D1',32,134,583,762],
    ['8LDT18','88-D1',52,51,938,806],
    ['8LDT18','108-D1',64,34,1113,853],
    ['8LDT18plus2','28-S',16,201,300,1124],
    ['8LDT18plus2','48-S',24,164,445,1171],
    ['8LDT18plus2','68-S',30,117,552,1217],
    ['8LDT18plus2','68-D1',32,134,588,1264],
    ['8LDT18plus2','88-D1',52,39,945,1311]
  ]) {
    const c=find(6,section,pattern,span), [x,y,w,h]=c.rect;
    assert.equal(c.capacity,value);
    assert.ok(px/2>=x && px/2<=x+w && py/2>=y && py/2<=y+h,c.id+' misses the printed number');
  }
});
