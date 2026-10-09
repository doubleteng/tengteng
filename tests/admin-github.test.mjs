import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHub } from '../scripts/admin/github.mjs';
const source='---\ntitle: New\n---\nBody\n',old='---\ntitle: Old\n---\nBody\n';
function setup({stale=false,race=false}={}){const calls=[];const api=new GitHub(async(url,options)=>{const path=url.replace('https://api.github.com/repos/doubleteng/tengteng','');calls.push({path,...options,body:options.body?JSON.parse(options.body):undefined});let data,status=200;
if(path==='/git/ref/heads/main')data={object:{sha:'head'}};
else if(path.startsWith('/contents/_projects/'))data={type:'file',encoding:'base64',content:Buffer.from(old).toString('base64'),sha:stale?'someone-elses-blob':'base'};
else if(path==='/git/commits/head')data={tree:{sha:'old-tree'}};
else if(path==='/git/blobs')data={sha:'new-blob'};
else if(path==='/git/trees')data={sha:'new-tree'};
else if(path==='/git/commits')data={sha:'new-commit'};
else if(path==='/git/refs/heads/main'){data={};if(race)status=422;}
else throw new Error('Unexpected request '+path);
return new Response(JSON.stringify(data),{status});});api.token='test-token';return{api,calls};}
test('stale content stops before creating any blobs or commits',async()=>{const{api,calls}=setup({stale:true});await assert.rejects(api.publish({path:'_projects/demo.md',source,baseSHA:'base'}),/版本冲突/);assert.ok(calls.every(c=>!c.method));});
test('publish only one file from current tree with compare guard and non-force ref',async()=>{const{api,calls}=setup();const result=await api.publish({path:'_projects/demo.md',source,baseSHA:'base'});assert.equal(result.fileSHA,'new-blob');assert.deepEqual(calls.find(c=>c.path==='/git/trees').body,{base_tree:'old-tree',tree:[{path:'_projects/demo.md',mode:'100644',type:'blob',sha:'new-blob'}]});assert.deepEqual(calls.at(-1).body,{sha:'new-commit',force:false});assert.deepEqual(calls.find(c=>c.path==='/git/commits').body.parents,['head']);});
test('concurrent push rejects update without forced overwrite',async()=>{const{api,calls}=setup({race:true});await assert.rejects(api.publish({path:'_projects/demo.md',source,baseSHA:'base'}),/版本冲突/);assert.equal(calls.at(-1).body.force,false);});
test('no token, forbidden files and invalid YAML cannot write',async()=>{const{api,calls}=setup();api.token='';await assert.rejects(api.publish({path:'_projects/demo.md',source,baseSHA:'base'}),/连接/);api.token='test';await assert.rejects(api.publish({path:'_layouts/default.html',source,baseSHA:'base'}),/禁止/);await assert.rejects(api.publish({path:'_projects/demo.md',source:'---\na: [\n---\n',baseSHA:'base'}));assert.equal(calls.length,0);});
test('new media and document are one atomic commit and cannot overwrite assets',async()=>{
  const calls=[];const api=new GitHub(async(url,options)=>{const path=url.split('doubleteng/tengteng')[1],body=options.body?JSON.parse(options.body):null;calls.push({path,body});let status=200,data={};
    if(path==='/git/ref/heads/main')data={object:{sha:'head'}};
    else if(path.startsWith('/contents/_projects/'))data={type:'file',encoding:'base64',content:Buffer.from(old).toString('base64'),sha:'base'};
    else if(path.startsWith('/contents/assets/'))status=404;
    else if(path==='/git/commits/head')data={tree:{sha:'tree'}};
    else if(path==='/git/blobs')data={sha:body.encoding==='base64'?'asset-blob':'file-blob'};
    else if(path==='/git/trees')data={sha:'next-tree'};
    else if(path==='/git/commits')data={sha:'next-commit'};
    return new Response(JSON.stringify(data),{status});});api.token='test-token';
  await api.publish({path:'_projects/demo.md',source,baseSHA:'base',uploads:[{path:'assets/uploads/new-unique.webp',base64:'aW1hZ2U='}]});
  const tree=calls.find(x=>x.path==='/git/trees').body.tree;assert.equal(tree.length,2);assert.deepEqual(tree.map(x=>x.path),['_projects/demo.md','assets/uploads/new-unique.webp']);assert.equal(calls.filter(x=>x.path==='/git/refs/heads/main').length,1);assert.equal(calls.at(-1).body.force,false);
});
