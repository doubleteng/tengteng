import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import api,{GallerySessions} from './worker.mjs';
const base='https://fake.workers.dev',origin='https://teng-teng.org';
function setup(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){const rows=db.prepare(query).all(...args);return {toArray:()=>rows,one:()=>rows[0]};}};
 const ctx={storage:{sql,getAlarm:async()=>null,setAlarm:async()=>{}},getWebSockets:()=>[]};
 const env={HYPERBEAM_API_KEY:'mock-only'};
 const sessions=new GallerySessions(ctx,env);
 env.ROOMS={idFromName:x=>x,get:()=>sessions};
 return {db,env};
}
const start=()=>new Request(base+'/sessions',{method:'POST',headers:{Origin:origin}});
test('requests are restricted to the gallery and fail closed without a server credential',async()=>{
 assert.equal((await api.fetch(start(),{})).status,503);
 const {env}=setup();
 assert.equal((await api.fetch(new Request(base+'/sessions',{method:'POST'}),env)).status,403);
});
test('cloud starts are isolated, capped and authorize only the requesting visitor',async t=>{
 const {env,db}=setup();let payload;
 t.mock.method(globalThis,'fetch',async (url,opts)=>{
  if(opts.method==='DELETE')return new Response(null,{status:204});
  payload=JSON.parse(opts.body);return Response.json({session_id:crypto.randomUUID(),embed_url:'https://demo.hyperbeam.com/view',admin_token:'never-return-this'});
 });
 const r=await api.fetch(start(),env),s=await r.json();
 assert.equal(r.status,200);assert.deepEqual(Object.keys(s).sort(),['id','key','stream']);
 assert.equal(payload.width,1280);assert.equal(payload.height,720);assert.equal(payload.timeout.absolute,600);
 assert.match(payload.start_url,/^https:\/\/teng-teng\.org\/teaching\/id3\/ava-render\.html#/);
 const hook=payload.auth.value;
 const check=async(user,ticket)=>{const res=await api.fetch(new Request(hook.url,{method:'POST',headers:{Authorization:'Bearer '+hook.bearer},body:JSON.stringify({user_id:user,userdata:{ticket}})}),env);return (await res.json()).authorized;};
 assert.equal(await check('first','bad'),false);assert.equal(await check('first',s.key),true);assert.equal(await check('other',s.key),false);
 for(let i=0;i<5;i++)assert.equal((await api.fetch(start(),env)).status,200);
 assert.equal((await api.fetch(start(),env)).status,429);
 const close=await api.fetch(new Request(base+'/rooms/'+s.id,{method:'DELETE',headers:{Origin:origin,Authorization:'Bearer '+s.key}}),env);
 assert.equal(close.status,200);
 assert.equal(db.prepare('select count(*) n from reservations').get().n,6);
 const stmt=db.prepare('INSERT INTO reservations VALUES(?,?,?)');
 for(let i=6;i<800;i++)stmt.run(String(i),Date.now(),'other');
 assert.equal((await api.fetch(start(),env)).status,429);
});
