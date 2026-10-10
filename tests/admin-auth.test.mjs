import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createWorker, validatePublish } from '../scripts/admin-auth/worker.mjs';
import { OWNER_ID, REPO_ID, hash, seal, unseal, SESSION_COOKIE, FLOW_COOKIE } from '../scripts/admin-auth/security.mjs';
import { GitHub as SessionClient } from '../scripts/admin/session-api.mjs';
const ORIGIN = 'https://studio.example.com', SECRET = 'ab'.repeat(32);
const GOOD = 'a'.repeat(40), HEAD = 'b'.repeat(40), OLD = '---\ntitle: Old\n---\nBody\n', SOURCE = '---\ntitle: New\n---\nBody\n';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(new URL('../scripts/admin-auth/migrations/0001_auth.sql', import.meta.url),'utf8'));
  return { sqlite, prepare(sql) { return { bind(...args) { const statement=sqlite.prepare(sql); return { async first(){return statement.get(...args) || null;}, async run(){return statement.run(...args);} }; } }; } };
}
async function setup({configured=true, userId=OWNER_ID, push=true, stale=false, race=false}={}) {
  const DB = database(), calls=[];
  const fetcher = async (input, options={}) => {
    const url=String(input), body=options.body?JSON.parse(options.headers?.['Content-Type']==='application/x-www-form-urlencoded'?'{}':options.body):null; calls.push({url,...options,parsed:body});
    let data,status=200;
    if(url==='https://github.com/login/oauth/access_token')data={access_token:'ghu_server_only_secret',expires_in:28800};
    else if(url.startsWith('https://api.github.com/app-manifests/'))data={owner:{id:userId},client_id:'client',client_secret:'app-secret',slug:'teng-studio'};
    else if(url==='https://api.github.com/user')data={id:userId,login:'doubleteng'};
    else if(url==='https://api.github.com/repos/doubleteng/tengteng')data={id:REPO_ID,permissions:{push}};
    else if(url.endsWith('/git/trees/main?recursive=1'))data={tree:[]};
    else if(url.endsWith('/git/ref/heads/main'))data={object:{sha:HEAD}};
    else if(url.includes('/contents/_projects/'))data={type:'file',encoding:'base64',content:Buffer.from(OLD).toString('base64'),sha:stale?'c'.repeat(40):GOOD};
    else if(url.endsWith('/git/commits/'+HEAD))data={tree:{sha:'old-tree'}};
    else if(url.endsWith('/git/blobs'))data={sha:'new-blob'};
    else if(url.endsWith('/git/trees'))data={sha:'new-tree'};
    else if(url.endsWith('/git/commits'))data={sha:'new-commit'};
    else if(url.endsWith('/git/refs/heads/main')){data={};if(race)status=422;}
    else throw new Error('Unexpected upstream '+url);
    return new Response(JSON.stringify(data),{status});
  };
  const env={DB,SESSION_SECRET:SECRET,ASSETS:{async fetch(request){return new Response(request.url.includes('/admin/')?'<html><head></head><body>protected editor</body></html>':'protected asset');}}};
  if(configured)await DB.prepare('INSERT INTO studio_settings (key,value) VALUES (?,?)').bind('github',await seal({clientId:'client',clientSecret:'app-secret',slug:'teng-studio'},SECRET,'github-app')).run();
  const worker=createWorker({fetcher});
  const send=(path, options={})=>worker.fetch(new Request(ORIGIN+path,options),env);
  async function login(){
    const start=await send('/auth/github'),state=new URL(start.headers.get('location')).searchParams.get('state'),cookie=start.headers.get('set-cookie').split(';')[0];
    const response=await send('/auth/github/callback?code=valid-code-1234&state='+state,{headers:{Cookie:cookie}});
    const sessionCookie=response.headers.getSetCookie().find(x=>x.startsWith(SESSION_COOKIE+'='))?.split(';')[0];
    return {response,cookie:sessionCookie,state,flowCookie:cookie};
  }
  async function authenticated(){const logged=await login();assert.equal(logged.response.status,303);const response=await send('/api/session',{headers:{Cookie:logged.cookie}});return {...logged,...await response.json()};}
  return {env,calls,send,login,authenticated};
}
test('all editor assets and APIs require a server session; fake tokens cannot bypass it',async()=>{
  const {send,calls}=await setup();
  for(const path of ['/admin/','/admin/index.html','/assets/admin/studio.js','/assets/admin/context.json']){const response=await send(path,{headers:{Authorization:'Bearer attacker',Cookie:SESSION_COOKIE+'=fake'}});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/login');assert.doesNotMatch(await response.text(),/protected/);}
  for(const path of ['/api/session','/api/github?path=%2Fgit%2Ftrees%2Fmain%3Frecursive%3D1','/api/publish'])assert.equal((await send(path)).status,401);
  assert.equal(calls.length,0);
});
test('login uses PKCE and browser-bound, expiring, single-use state',async()=>{
  const {send,calls}=await setup();
  const start=await send('/auth/github'),url=new URL(start.headers.get('location')),state=url.searchParams.get('state'),flowCookie=start.headers.get('set-cookie').split(';')[0];
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),ORIGIN+'/auth/github/callback');
  assert.equal((await send('/auth/github/callback?code=valid-code-1234&state='+state)).status,400);assert.equal(calls.length,0);
  const callback='/auth/github/callback?code=valid-code-1234&state='+state;
  const result=await send(callback,{headers:{Cookie:flowCookie}});assert.equal(result.status,303);
  const exchange=new URLSearchParams(calls.find(x=>x.url.includes('access_token')).body);
  assert.equal(await hash(exchange.get('code_verifier')),url.searchParams.get('code_challenge'));
  assert.equal(exchange.get('repository_id'),String(REPO_ID));
  assert.equal((await send(callback,{headers:{Cookie:flowCookie}})).status,400);
  assert.equal(calls.filter(x=>x.url.includes('access_token')).length,1);
});
test('wrong GitHub user and removed repository permission cannot create a session',async()=>{
  for(const options of [{userId:123},{push:false}]){const {login,env}=await setup(options);const {response}=await login();assert.equal(response.status,403);assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS total FROM studio_sessions').get().total,0);}
});
test('GitHub credentials are encrypted at rest and absent from all browser responses',async()=>{
  const {authenticated,send,env}=await setup(),session=await authenticated();
  const setCookie=session.response.headers.getSetCookie().find(x=>x.startsWith(SESSION_COOKIE+'='));
  for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(setCookie.includes(flag));assert.ok(!setCookie.includes('Domain='));
  const row=env.DB.sqlite.prepare('SELECT * FROM studio_sessions').get();assert.ok(!row.token.includes('ghu_'));assert.notEqual(row.id,session.cookie.split('=')[1]);
  assert.equal(await unseal(row.token,SECRET,'github-token'),'ghu_server_only_secret');
  for(const path of ['/api/session','/admin/','/assets/admin/studio.js']){const response=await send(path,{headers:{Cookie:session.cookie}}),text=await response.text();assert.equal(response.headers.get('cache-control'),'no-store, private');assert.doesNotMatch(text,/ghu_server_only_secret|app-secret/);}
});
test('state expires and logout revokes the database session, requires same-origin CSRF',async()=>{
  const {authenticated,send,env}=await setup(),session=await authenticated();
  const options={method:'POST',headers:{Cookie:session.cookie,Origin:ORIGIN,'X-CSRF-Token':session.csrf}};
  assert.equal((await send('/auth/logout',{...options,headers:{...options.headers,Origin:'https://evil.example'}})).status,403);
  assert.equal((await send('/auth/logout',{...options,headers:{...options.headers,'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await send('/auth/logout',options)).status,303);
  assert.equal((await send('/api/session',{headers:{Cookie:session.cookie}})).status,401);
  const start=await send('/auth/github'),state=new URL(start.headers.get('location')).searchParams.get('state');env.DB.sqlite.exec('UPDATE studio_flows SET expires=0');
  assert.equal((await send('/auth/github/callback?code=valid-code-1234&state='+state,{headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}})).status,400);
});
test('idle and absolute session expiry are enforced on protected assets',async()=>{
  for(const column of ['expires','touched']){const {authenticated,send,env}=await setup(),session=await authenticated();env.DB.sqlite.exec('UPDATE studio_sessions SET '+column+'=0');assert.equal((await send('/admin/',{headers:{Cookie:session.cookie}})).headers.get('location'),'/login');}
});
test('read API cannot become an arbitrary GitHub proxy',async()=>{
  const {authenticated,send,calls}=await setup(),session=await authenticated();
  for(const target of ['/contents/_config.yml?ref=main','/git/refs/heads/main','//evil.example','/contents/../_config.yml?ref=main','/contents/_projects/demo.md?ref=other','/commits?sha=main&path=_layouts/default.html&per_page=15','/git/trees/main?recursive=1#bad'])assert.equal((await send('/api/github?path='+encodeURIComponent(target),{headers:{Cookie:session.cookie}})).status,403);
  const before=calls.length;
  assert.equal((await send('/api/github?path='+encodeURIComponent('/contents/_projects/demo.md?ref=main'),{headers:{Cookie:session.cookie}})).status,200);
  assert.equal(calls.length,before+1);assert.equal(calls.at(-1).headers.Authorization,'Bearer ghu_server_only_secret');
});
test('authenticated publish rechecks ownership, targets one file and preserves optimistic concurrency',async()=>{
  for(const options of [{},{stale:true},{race:true}]){
    const {authenticated,send,calls}=await setup(options),session=await authenticated();
    const request={method:'POST',headers:{Cookie:session.cookie,Origin:ORIGIN,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({path:'_projects/demo.md',source:SOURCE,baseSHA:GOOD,uploads:[]})};
    const before=calls.length,response=await send('/api/publish',request),recent=calls.slice(before);
    assert.equal(recent[0].url,'https://api.github.com/user');assert.equal(recent[1].url,'https://api.github.com/repos/'+ 'doubleteng/tengteng');
    if(options.stale){assert.notEqual(response.status,200);assert.ok(recent.every(x=>!x.method));}
    else {assert.equal(response.status,options.race?422:200);const tree=recent.find(x=>x.url.endsWith('/git/trees'));assert.deepEqual(tree.parsed.tree.map(x=>x.path),['_projects/demo.md']);assert.equal(recent.at(-1).parsed.force,false);}
  }
});
test('publish rejects CSRF, invalid content, extra files and non-JSON before GitHub writes',async()=>{
  const {authenticated,send,calls}=await setup(),session=await authenticated(),before=calls.length;
  for(const [contentType,origin,csrf,payload,status] of [
    ['application/json','https://evil.example',session.csrf,{},403],['application/json',ORIGIN,'wrong',{},403],
    ['text/plain',ORIGIN,session.csrf,{},415],['application/json',ORIGIN,session.csrf,{path:'_layouts/default.html',source:SOURCE,baseSHA:GOOD},400],
    ['application/json',ORIGIN,session.csrf,{path:'_projects/demo.md',source:'broken',baseSHA:GOOD},400]
  ])assert.equal((await send('/api/publish',{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'Content-Type':contentType,'X-CSRF-Token':csrf},body:JSON.stringify(payload)})).status,status);
  assert.equal(calls.length,before);
  for(const uploads of [[{path:'assets/uploads/evil.html',base64:'YWJj'}],[{path:'assets/uploads/image.png',base64:'YWJj'}]])assert.throws(()=>validatePublish({path:'_projects/demo.md',source:SOURCE,baseSHA:GOOD,uploads}));
});
test('manifest setup rejects the wrong GitHub owner, binds state and never overwrites registered settings',async()=>{
  for(const userId of [OWNER_ID,123]){const {send,env,calls}=await setup({configured:false,userId});
    assert.equal((await send('/setup',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
    const start=await send('/setup',{method:'POST',headers:{Origin:ORIGIN}}),html=await start.text(),state=html.match(/apps\/new\?state=([\w-]+)/)[1];
    assert.match(html,/&quot;contents&quot;:&quot;write&quot;/);assert.match(html,/&quot;public&quot;:false/);assert.doesNotMatch(html,/app-secret/);
    const callback='/auth/setup/callback?code=manifest-code-1234&state='+state;
    assert.equal((await send(callback)).status,400);
    const response=await send(callback,{headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}});
    assert.equal(response.status,userId===OWNER_ID?303:403);
    assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM studio_settings').get().n,userId===OWNER_ID?1:0);
    assert.equal(calls.length,1);
  }
});
test('missing infrastructure fails closed without editor access',async()=>{
  const worker=createWorker();for(const env of [{},{DB:database(),SESSION_SECRET:'weak'}])assert.equal((await worker.fetch(new Request(ORIGIN+'/admin/'),env)).status,503);
});
test('browser client sends only same-origin session calls, no token or uploads object URLs',async()=>{
  const calls=[],api=new SessionClient(async(url,options)=>{calls.push({url,...options});return new Response(JSON.stringify(url==='/api/session'?{user:{id:OWNER_ID,login:'doubleteng'},csrf:'csrf'}:{sha:'commit'}));});
  await api.session();await api.publish({path:'_projects/demo.md',source:SOURCE,baseSHA:GOOD,uploads:[{path:'assets/uploads/new.png',base64:'YWJj',objectURL:'blob:private'}]});
  assert.equal(calls.at(-1).url,'/api/publish');assert.equal(calls.at(-1).headers['X-CSRF-Token'],'csrf');assert.equal(calls.at(-1).credentials,'same-origin');assert.doesNotMatch(calls.at(-1).body,/blob:private/);
  assert.ok(!('token' in api));assert.ok(calls.every(x=>!x.headers.Authorization));
});
