const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
const core=fs.readFileSync(path.join(dir,'structure-core.js'),'utf8');vm.runInContext(core.slice(core.indexOf('/* BEGIN STEEL REFLECTION SCRIPT */'),core.indexOf('/* END STEEL REFLECTION SCRIPT */')),ctx);
for(const file of ['steel-roof-data.js','steel-roof-lessons.js','steel-pdf-map.js','steel-pdf-tables.js','steel-floor-data.js','steel-foundation-data.js','steel-linked-tables.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx);
const {SteelRoof:R,SteelFloor:F,SteelFoundation:N,SteelLinkedTables:L}=ctx.window;
const lab={state:R.normalize(R.defaults()),floorState:F.normalize(F.defaults()),foundationState:N.defaults()};
F.sync(lab.state,lab.floorState);let d=N.current(lab.state,lab.floorState,lab.foundationState);d.record.checked=d.basis;
// PDF result choices update member + self-weight as one action, keep geometry/load pattern,
// and invalidate the dependent foundation review (including re-selecting the same member).
const oldSpan=lab.floorState.beamSpan,oldSpaces=lab.floorState.spaces,oldLive=F.calc(lab.state,lab.floorState).live;
let spec=L.sourceSpec('beam',lab);L.applyPick(lab,'beam',spec.buttons[0].pick);
assert.equal(lab.floorState.beamName,'W21×44');assert.equal(lab.floorState.beamWeight,44);
assert.equal(lab.floorState.beamSpan,oldSpan);assert.equal(lab.floorState.spaces,oldSpaces);assert.equal(F.calc(lab.state,lab.floorState).live,oldLive);assert.equal(d.record.checked,'');
assert.equal(L.sourceSpec('beam',lab).buttons.filter(b=>b.selected).length,1);
spec=L.sourceSpec('floorGirder',lab);L.applyPick(lab,'floorGirder',spec.buttons[2].pick);assert.equal(lab.floorState.girderName,'W21×50');assert.equal(lab.floorState.girderWeight,50);assert.equal(lab.floorState.spaces,oldSpaces);
// Selecting source capacity must not turn it into a demand or silently resize the bay.
spec=L.floorSpec(lab.floorState,F.calc(lab.state,lab.floorState));const service=spec.buttons.find(b=>b.pick.sourceCell.kind==='service'&&b.pick.gauge===18);L.applyPick(lab,'floorDeck',service.pick);assert.equal(lab.floorState.gauge,18);assert.equal(lab.floorState.beamSpan,oldSpan);assert.equal(F.calc(lab.state,lab.floorState).live,oldLive);
// Column source choices attach only to the selected coordinate and segment.
lab.foundationState.pdfColumnTarget='upper';spec=L.sourceSpec('column',lab);assert.ok(d.column.roof);L.applyPick(lab,'column',spec.buttons[0].pick);assert.equal(d.record.upperSection,'W8×28');assert.equal(d.record.section,'');assert.equal(d.record.roofLoad,'');assert.equal(d.record.floorLoad,'');
lab.foundationState.pdfColumnTarget='lower';L.applyPick(lab,'column2A',L.sourceSpec('column2A',lab).buttons[0].pick);assert.equal(d.record.section,'W8×31');assert.equal(d.record.upperSection,'W8×28');assert.match(d.record.evidence,/Lecture 11 p64/);
// Conflicting footings remain separate source choices with inch/foot units preserved.
spec=L.sourceSpec('footing2A',lab);L.applyPick(lab,'footing2A',spec.buttons.find(b=>b.pick.values.width===11).pick);assert.equal(d.record.width,11);assert.equal(d.record.length,11);assert.equal(d.record.thickness,18);assert.equal(d.record.checked,'');
L.applyPick(lab,'footing2A',spec.buttons.find(b=>b.pick.values.width===6.5).pick);assert.equal(d.record.width,6.5);assert.equal(d.record.thickness,18);assert.match(d.record.evidence,/conflicts with headline/);
L.applyPick(lab,'footing',L.sourceSpec('footing',lab).buttons.find(b=>b.pick.values.depth===42).pick);assert.equal(d.record.depth,42);assert.match(d.record.evidence,/body says 60 in/);
// All hit regions lie within the original page; shapes must remain finite and nonzero.
for(const kind of ['beam','floorGirder','column','column2A','footing','footing2A','footingCorners','connection']){const s=L.sourceSpec(kind,lab);for(const b of s.buttons){const [x,y,w,h]=b.rect;assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=s.size[0]&&y+h<=s.size[1],kind+': '+b.label);}}
// Source/target and evidence survive Save/Open; changing one support leaves others alone.
lab.foundationState.pdfSources={'foundation-column':'column2A'};lab.floorState.pdfSources={'floor-girder':'beam'};
const savedN=N.normalize(JSON.parse(JSON.stringify(lab.foundationState))),savedF=F.normalize(JSON.parse(JSON.stringify(lab.floorState)));
assert.equal(savedN.pdfSources['foundation-column'],'column2A');assert.equal(savedF.pdfSources['floor-girder'],'beam');assert.equal(savedN.records[d.column.key].section,'W8×31');assert.match(savedN.records[d.column.key].evidence,/unreviewed/);assert.equal(savedF.pdfEvidence.beam.id,'row-0');
const originalKey=d.column.key,other=d.columns.find(c=>c.key!==originalKey);lab.foundationState.selected=other.key;L.applyPick(lab,'footing',L.sourceSpec('footing',lab).buttons[0].pick);assert.equal(lab.foundationState.records[originalKey].width,6.5);assert.equal(lab.foundationState.records[other.key].width,9);
console.log('PASS: direct PDF selection, member weights, load separation, per-column trials, units/conflicts, page bounds and Save/Open evidence.');
