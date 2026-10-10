import test from 'node:test';
import assert from 'node:assert/strict';
import { provision, verifyAnonymous, STUDIO, DATABASE } from '../scripts/admin-auth/deploy-ci.mjs';
const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'fixture-token'};
const uuid='12345678-1234-1234-1234-123456789abc';
const ok=result=>Response.json({success:true,result});
test('studio deployment preserves an existing encryption key and exact database',async()=>{
  const calls=[];
  const result=await provision(env,async(url,options)=>{
    calls.push(options);assert.equal(options.headers.Authorization,'Bearer fixture-token');
    if(url.endsWith('/subdomain'))return ok({subdomain:'portfolio'});
    if(url.endsWith('/scripts'))return ok([{id:STUDIO}]);
    if(url.endsWith('/secrets'))return ok([{name:'SESSION_SECRET'}]);
    return ok([{name:DATABASE,uuid}]);
  });
  assert.equal(result.needsKey,false);assert.equal(result.databaseId,uuid);
  assert.ok(calls.every(call=>call.method==='GET'));
});
test('only a new Worker with a new database can generate its first encryption key',async()=>{
  const result=await provision(env,async(url,options)=>{
    if(url.endsWith('/subdomain'))return ok({subdomain:'portfolio'});
    if(url.endsWith('/scripts'))return ok([]);
    if(options.method==='POST'){assert.deepEqual(JSON.parse(options.body),{name:DATABASE});return ok({uuid});}
    return ok([]);
  });
  assert.equal(result.needsKey,true);assert.equal(result.origin,'https://'+STUDIO+'.portfolio.workers.dev');
});
test('missing existing encryption keys, orphaned databases and permission errors stop provisioning',async()=>{
  for(const exists of [true,false])await assert.rejects(provision(env,async(url,options)=>{
    assert.equal(options.method,'GET');
    if(url.endsWith('/subdomain'))return ok({subdomain:'portfolio'});
    if(url.endsWith('/scripts'))return ok(exists?[{id:STUDIO}]:[]);
    if(url.endsWith('/secrets'))return ok([]);
    return ok([{name:DATABASE,uuid}]);
  }),/encryption key/);
  await assert.rejects(provision(env,async()=>Response.json({success:false,errors:[{message:env.CLOUDFLARE_API_TOKEN}]},{status:403})),error=>/HTTP 403/.test(error.message)&&!error.message.includes(env.CLOUDFLARE_API_TOKEN));
});
test('anonymous deployment checks reject exposed editor HTML, assets or APIs',async()=>{
  const origin='https://studio.example';
  const gated=async url=>url.endsWith('/login')?new Response('Content Studio'):url.includes('/api/')?new Response('',{status:401}):new Response('',{status:303,headers:{Location:'/login'}});
  await verifyAnonymous(origin,gated);
  await assert.rejects(verifyAnonymous(origin,async()=>new Response('public editor')),/not blocked/);
});
