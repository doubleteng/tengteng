import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSource, setValue, editSequence, changes, getAt} from '../scripts/admin/document.mjs';
const paths = ['_projects','_publications','_updates','_data'].flatMap(dir=>fs.readdirSync(dir).filter(p=>/\.(md|yml)$/.test(p)).map(p=>dir+'/'+p));
let scalarCount=0, moveCount=0;
for(const file of paths){const source=fs.readFileSync(file,'utf8'),p=parseSource(source,file);
  test('preserve unchanged source and body: '+file,()=>{
    const first=Object.keys(p.data)[0];assert.equal(setValue(source,file,[first],p.data[first]),source);
    const after=setValue(source,file,[first],typeof p.data[first]==='string'?p.data[first]+' [editor test]':p.data[first]);
    const actual=parseSource(after,file);assert.equal(actual.body,p.body);for(const key of Object.keys(p.data).filter(x=>x!==first))assert.deepEqual(actual.data[key],p.data[key]);
  });
  test('edit every scalar independently without touching siblings: '+file,()=>{
    function walk(value,path){if(value && typeof value==='object'){for(const [k,v] of Object.entries(value))walk(v,[...path,Array.isArray(value)?Number(k):k]);return;}
      const next=typeof value==='boolean'?!value:typeof value==='number'?value+1:String(value??'')+' ✓';
      const after=setValue(source,file,path,next),diff=changes(source,after,file);assert.equal(diff.length,1);assert.equal(getAt(parseSource(after,file).data,path),next);scalarCount++;
    }walk(p.data,[]);
  });
  test('preserve original sequence item bytes and unknown settings: '+file,()=>{
    function walk(value,path){if(Array.isArray(value)&&value.length>1){const next=editSequence(source,file,path,{type:'move',from:0,to:value.length-1});const actual=parseSource(next,file);assert.deepEqual(getAt(actual.data,path),[...value.slice(1),value[0]]);assert.equal(actual.body,p.body);const restored=editSequence(next,file,path,{type:'move',from:value.length-1,to:0});assert.deepEqual(parseSource(restored,file).data,p.data);moveCount++;}
      if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))walk(v,[...path,Array.isArray(value)?Number(k):k]);
    }walk(p.data,[]);
  });
}
test('missing field and sequence operations preserve complex unknown content',()=>{
  const source='---\ntitle: Original # title comment\nunknown: {a: 1, b: [2, 3]}\nsections:\n- type: media-row\n  custom: yes # keep\n  items:\n  - type: image\n    image: /original.jpg\n    ratio: 1.525\n- type: video-gallery\n  videos: [{file: /test.mp4, extra: 99}]\n---\n\n<div class="custom">Do not normalize **Markdown**.</div>\n';
  let s=setValue(source,'x.md',['sections',0,'caption'],'New\ncaption');assert.ok(s.includes('custom: yes # keep'));assert.ok(s.includes('unknown: {a: 1, b: [2, 3]}'));assert.equal(parseSource(s).body,parseSource(source).body);
  s=editSequence(s,'x.md',['sections'],{type:'add',value:{type:'text',body:'Hi'}});assert.equal(parseSource(s).data.sections.length,3);
  s=editSequence(s,'x.md',['sections'],{type:'remove',index:1});assert.equal(parseSource(s).data.sections[0].items[0].ratio,1.525);
  s=setValue(s,'x.md',['new_key'],{child:'value'});assert.equal(parseSource(s).data.new_key.child,'value');
  assert.throws(()=>setValue(s,'x.md',['__proto__','oops'],'bad'));assert.equal({}.oops,undefined);
});
test('block scalar comment, CRLF, quotes, Unicode and empty lists',()=>{
  const source='---\r\ntitle: Original\r\nbio: | # retain this comment\r\n  Hello\r\nsections: []\r\n---\r\n\r\nBody\r\n';
  const next=setValue(source,'x.md',['bio'],'你好: "quoted"\nsecond line');assert.equal(parseSource(next).data.bio,'你好: "quoted"\nsecond line');assert.ok(next.includes('# retain this comment'));assert.equal(parseSource(next).body,'\r\nBody\r\n');
  const added=editSequence(source,'x.md',['sections'],{type:'add',value:{type:'text',body:'hello'}});assert.equal(parseSource(added).data.sections.length,1);
  const empty=editSequence(added,'x.md',['sections'],{type:'remove',index:0});assert.deepEqual(parseSource(empty).data.sections,[]);
});
test('summary of preservation coverage',()=>console.log({files:paths.length,scalarEdits:scalarCount,sequenceMoves:moveCount}));
