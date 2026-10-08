/* Run with node tests/steel-roof.test.cjs. No runtime dependencies. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'..'),context={window:{}};vm.createContext(context);
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
vm.runInContext(html.slice(html.indexOf('/* BEGIN STEEL REFLECTION SCRIPT */'),html.indexOf('/* END STEEL REFLECTION SCRIPT */')),context);
for(const file of ['steel-roof-data.js','steel-roof-lessons.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context);
const A=context.window.SteelRoof,D=context.window.SteelRoofData,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let s=A.normalize(A.defaults()),c=A.calc(s);assert.equal(s.briefConfirmed,false);assert.equal(s.familyChosen,false);assert.equal(s.optionChosen,false);
// Reconcile the actual slide example without its rounded intermediate values.
near(c.spacing,40/7);near(c.q,116.98);assert.equal(c.deckSpan,6);assert.equal(c.deckCell[0],128);assert.equal(c.deckCell[1],122);
near(c.wRoof,116.98*40/7);near(c.wTotal,c.wRoof+29.9);assert.equal(c.joist.asd,678);assert.equal(c.joistOK,false);assert.equal(c.gWeight,78);assert.equal(c.gColumn,24);
// Reactions preserve equilibrium. Both-side loading sums two independent joist ends.
near(c.R*2000,c.wTotal*c.L);near(A.calc({...s,sides:2}).P,2*c.R+s.allowance);
// A different source row resolves strength, while a stricter deflection limit can still fail.
assert.equal(A.calc({...s,joist:'40LH14'}).joistOK,true);assert.equal(A.calc({...s,joist:'40LH14',liveLimit:360}).joistOK,false);
// Never round a required deck span down; blank source entries remain blank.
assert.equal(A.calc({...s,spaces:6}).deckSpan,7);assert.equal(A.calc(A.normalize({...s,family:'3060',option:'D',spaces:5,gauge:22})).deckCell,null);
assert.equal(A.deck.double[3][4][1],163);
// The E direction rule is different for the two assignment families.
assert.equal(A.normalize({...s,family:'3060',option:'E'}).direction,'short');assert.equal(A.normalize({...s,family:'4060',option:'E',direction:'short'}).direction,'long');
let combinations=0;
for(const family of ['3060','4060'])for(const option of ['A','B','C','D','E'])for(const direction of ['short','long'])for(const use of ['office','grocery','library']){
 const state=A.normalize({...s,family,option,direction,use}),geometry=A.dimensions(state);
 for(const spaces of Object.keys(D.girders[geometry.G].groups).map(Number)){
  const study=A.normalize({...state,spaces}),r=A.calc(study);assert.ok(Number.isFinite(r.R));assert.equal(r.spacing,r.G/spaces);assert.ok(A.scene(study).items.length>0);assert.ok(D.girders[r.G].groups[spaces].some(row=>row.depth===study.girderDepth));combinations++;
 }
}
// Dimensions are derived from discrete source rows and measured on the displayed geometry.
for(const name of ['40LH13','44LH14','48LH14']){const trial={...s,lesson:'joist-table',joist:name},anno=A.scene(trial).annotations[1];near(Math.hypot(...anno.a.map((v,i)=>v-anno.b[i])),parseInt(name)/12);assert.match(anno.title,new RegExp(name));}
for(const depth of [32,36,40,44,48]){const anno=A.scene({...s,lesson:'girder-table',girderDepth:depth}).annotations[1];near(Math.hypot(...anno.a.map((v,i)=>v-anno.b[i])),depth/12);}
for(const gauge of [22,20,18,16]){const anno=A.scene({...s,lesson:'deck-table',gauge}).annotations[2];near(Math.hypot(...anno.a.map((v,i)=>v-anno.b[i])),({22:.0295,20:.0358,18:.0474,16:.0598})[gauge]/12);}
// Imported studies keep notes and trial choices; invalid references fall back safely.
s={...s,lesson:'girder-table',notes:{'brief':'My supports','joist-table':'Check self-weight'},completed:{brief:true},tablePick:{gauge:20,span:6}};
const restored=A.normalize(JSON.parse(JSON.stringify(s)));assert.equal(restored.notes.brief,'My supports');assert.equal(restored.joist,'40LH13');assert.equal(restored.lesson,'girder-table');assert.equal(restored.tablePick.span,6);
const invalid=A.normalize({...s,spaces:0,gauge:999,joist:'fake',allowance:Infinity,girderDepth:999});assert.ok(Number.isFinite(A.calc(invalid).wTotal));assert.ok(A.calc(invalid).gWeight!==undefined);
console.log(`Steel source and load-path checks passed; ${combinations} assignment / spacing combinations.`);

// Concept exploration must not replace table-selected geometry, including after Save/Open.
assert.equal(A.lecture('anatomy'),1);
for(const step of A.steps)assert.equal(A.lecture(step.id),1.1);
const separated=A.normalize({...restored,concepts:{lesson:'spans',direction:'short',spaces:3,notes:{spans:'Compare support spacing.'}}});
assert.equal(separated.direction,restored.direction);assert.equal(separated.spaces,restored.spaces);
assert.equal(separated.joist,restored.joist);assert.equal(separated.concepts.spaces,3);
assert.equal(separated.concepts.direction,'short');assert.equal(separated.concepts.notes.spans,'Compare support spacing.');
const oldConcept=A.normalize({version:1,lesson:'spans',direction:'short',spaces:3,notes:{spans:'My original reflection.'}});
assert.equal(oldConcept.concepts.spaces,3);assert.equal(oldConcept.concepts.notes.spans,'My original reflection.');
const doubleRoundTrip=A.normalize(JSON.parse(JSON.stringify(separated)));
assert.equal(doubleRoundTrip.tableLesson,'girder-table');assert.equal(doubleRoundTrip.concepts.spaces,3);
console.log('Restored Lecture 1 and independent Lecture 1.1 study records passed.');
