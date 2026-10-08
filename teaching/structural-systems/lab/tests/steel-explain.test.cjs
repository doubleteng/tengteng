const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');vm.runInContext(html.slice(html.indexOf('/* BEGIN STEEL REFLECTION SCRIPT */'),html.indexOf('/* END STEEL REFLECTION SCRIPT */')),ctx);
for(const file of ['steel-roof-data.js','steel-roof-lessons.js','steel-explain.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx);
const R=ctx.window.SteelRoof,E=ctx.window.SteelExplain,S=ctx.window.SteelReflection,text=r=>r.cards.flatMap(c=>c.text).join('\n');
let s=R.normalize({...R.defaults(),lesson:'deck-table',panel:'explain',tablePick:{gauge:20,span:6}}),e=E.table(s);assert.equal(e.cards.length,4);assert.equal(e.status,'pass');assert.match(text(e),/128 psf/);assert.match(text(e),/122 psf/);assert.match(text(e),/5.714 ft remains/);assert.match(text(e),/0.0358 in/);
e=E.table({...s,tablePick:{gauge:20,span:5}});assert.equal(e.status,'review');assert.match(text(e),/183 psf/);assert.match(e.message,/clicked span/);
e=E.table(R.normalize({...s,family:'3060',option:'D',spaces:5,gauge:22,tablePick:{gauge:22,span:12}}));assert.equal(e.status,'review');assert.match(e.message,/No source value/);
s={...s,lesson:'joist-table',joist:'40LH13'};e=E.table(s);assert.equal(e.status,'review');assert.match(text(e),/section number 13/);assert.match(text(e),/29.9 plf/);
e=E.table({...s,joist:'40LH14'});assert.equal(e.status,'pass');assert.match(text(e),/section number 14/);assert.match(text(e),/40 in nominal depth/);
e=E.table({...s,joist:'40LH14',readColumn:'weight'});assert.match(text(e),/self-weight/);
e=E.table({...s,joist:'40LH14',readColumn:'lrfd'});assert.equal(e.status,'review');assert.match(e.message,/LRFD/);
s={...s,lesson:'girder-table'};e=E.table(s);assert.match(text(e),/78 plf = estimated/);assert.match(text(e),/44G7N24K/);assert.match(text(e),/7 spaces give 8 joist lines and 6 interior load points/);assert.match(e.message,/upstream joist/);
e=E.table({...s,girderDepth:44,girderLoad:48});assert.match(e.message,/Blank cell/);
const valid={...s,joist:'40LH14'};e=E.table({...valid,sides:2});assert.equal(e.status,'review');assert.match(e.message,/below the target/);assert.match(text(e),/two equal sides/);
for(const lesson of S.lessons){const cs={...R.defaults().concepts,lesson:lesson.id};assert.equal(E.concept(cs).cards.length,4);}
const imported=R.normalize(JSON.parse(JSON.stringify({...valid,panel:'explain',concepts:{lesson:'spans',panel:'explain',spaces:3}})));assert.equal(imported.panel,'explain');assert.equal(imported.concepts.panel,'explain');assert.equal(imported.concepts.spaces,3);
console.log('PASS: Explain follows selected cells, rejects mismatches/blanks, separates load bases and weights, preserves schematic limits and saved panels.');
