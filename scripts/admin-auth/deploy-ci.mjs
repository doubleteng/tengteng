import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const STUDIO = 'teng-content-studio';
export const DATABASE = 'teng-content-studio-auth';
export async function provision(env, fetcher = fetch) {
  const account = env.CLOUDFLARE_ACCOUNT_ID?.trim(), token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Cloudflare repository secrets are required.');
  const request = async (suffix, method = 'GET', body) => {
    const response = await fetcher('https://api.cloudflare.com/client/v4/accounts/' + account + suffix, {
      method, redirect:'error', signal:AbortSignal.timeout(30000), headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'}, body:body ? JSON.stringify(body) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error('Cloudflare studio provisioning failed (HTTP ' + response.status + ').');
    return result.result;
  };
  const registration = await request('/workers/subdomain');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(registration?.subdomain || '')) throw new Error('The Cloudflare account needs its workers.dev subdomain.');
  const scripts = await request('/workers/scripts');
  if (!Array.isArray(scripts)) throw new Error('Unexpected Worker list.');
  const exists = scripts.some(script => script.id === STUDIO);
  if (exists) {
    const secrets = await request('/workers/scripts/' + STUDIO + '/secrets');
    if (!Array.isArray(secrets) || !secrets.some(secret => secret.name === 'SESSION_SECRET')) throw new Error('Existing studio has no encryption key. Restore its key before redeployment; no replacement was generated.');
  }
  const databases = await request('/d1/database?name=' + DATABASE + '&per_page=100');
  if (!Array.isArray(databases)) throw new Error('Unexpected database list.');
  const matching = databases.filter(database => database.name === DATABASE);
  if (matching.length > 1) throw new Error('Ambiguous studio database.');
  // An orphaned database may contain credentials encrypted by a previous key.
  if (!exists && matching.length) throw new Error('Existing studio database found without its Worker. Restore the Worker encryption key before continuing.');
  const database = matching[0] || await request('/d1/database', 'POST', {name:DATABASE});
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(database?.uuid || '')) throw new Error('Invalid studio database identifier.');
  return {databaseId:database.uuid, origin:'https://' + STUDIO + '.' + registration.subdomain + '.workers.dev', needsKey:!exists};
}
export async function verifyAnonymous(origin, fetcher = fetch) {
  for (const route of ['/admin/','/assets/admin/studio.js','/assets/admin/context.json']) {
    const response = await fetcher(origin + route, {redirect:'manual',signal:AbortSignal.timeout(10000)});
    if (response.status !== 303 || response.headers.get('location') !== '/login') throw new Error('Anonymous editor access is not blocked: ' + route);
  }
  for (const route of ['/api/session','/api/publish']) {
    const response = await fetcher(origin + route, {redirect:'manual',signal:AbortSignal.timeout(10000)});
    if (response.status !== 401) throw new Error('Anonymous API access is not blocked: ' + route);
  }
  const login = await fetcher(origin + '/login', {redirect:'manual',signal:AbortSignal.timeout(10000)});
  if (login.status !== 200 || !(await login.text()).includes('Content Studio')) throw new Error('Studio login is not available.');
}
async function main() {
  const result = await provision(process.env);
  const configPath = 'scripts/admin-auth/wrangler.jsonc';
  const config = JSON.parse(await fs.readFile(configPath,'utf8'));
  if (config.name !== STUDIO || config.d1_databases?.length !== 1 || config.d1_databases[0].binding !== 'DB') throw new Error('Unexpected studio configuration.');
  config.d1_databases[0].database_id = result.databaseId;
  config.vars = {...config.vars,ADMIN_ORIGIN:result.origin};
  await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'teng-studio-'));
  const secrets = result.needsKey ? {SESSION_SECRET:randomBytes(32).toString('hex')} : null;
  if (secrets && process.env.GITHUB_ACTIONS === 'true') console.log('::add-mask::' + secrets.SESSION_SECRET);
  const redact = value => [process.env.CLOUDFLARE_API_TOKEN,secrets?.SESSION_SECRET].filter(Boolean).reduce((text,secret)=>text.split(secret).join('[redacted]'),value);
  const run = args => new Promise((resolve,reject) => {
    const child = spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_SANITIZE:'true'},stdio:['ignore','pipe','pipe']});
    let output=''; for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-20000);});
    child.on('error',()=>reject(new Error('Could not start Wrangler.')));
    child.on('close',code=>{if(code===0)resolve();else{console.error(redact(output));reject(new Error('Studio deployment failed.'));}});
  });
  try {
    await run(['d1','migrations','apply','DB','--remote','--config',configPath]);
    const args=['deploy','--config',configPath,'--keep-vars'];
    if(secrets){const file=path.join(directory,'secrets.json');await fs.writeFile(file,JSON.stringify(secrets),{mode:0o600});args.push('--secrets-file',file);}
    await run(args);
    console.log('Studio deployed: ' + result.origin);
    let verified=false;
    for(let attempt=0;attempt<20;attempt++){try{await verifyAnonymous(result.origin);verified=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,3000));}}
    if(!verified)throw new Error('Studio deployed, but anonymous access checks did not pass.');
    if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'GitHub owner login: '+result.origin+'/login\n\nAnonymous editor, asset and publishing routes are blocked. Existing encryption key preserved on redeployment.\n');
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
