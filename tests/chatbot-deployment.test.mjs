import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { deploymentSecrets, normalizeGeminiKey, provisionDatabase, WORKER_NAME } from '../scripts/chatbot/deployment.mjs';

const env = { GEMINI_API_KEY: 'test-google-key-only-not-a-real-secret', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-cloudflare-token' };
const uuid = '12345678-1234-1234-1234-123456789abc';
const success = result => Response.json({ success: true, result });

test('pasted Google key labels are removed without accepting ambiguous keys or logging the value', () => {
  const key = 'AIza' + 'a'.repeat(35);
  assert.equal(normalizeGeminiKey(key), key);
  assert.equal(normalizeGeminiKey('Key ： "' + key + '"\n'), key);
  assert.equal(normalizeGeminiKey('API 密钥：' + key), key);
  assert.deepEqual(deploymentSecrets({ GEMINI_API_KEY: 'Key ：' + key }), deploymentSecrets({ GEMINI_API_KEY: key }));
  for (const raw of ['只有名称没有密钥', key + '\n' + 'AIza' + 'b'.repeat(35), 'Key ：not-a-real-key']) {
    assert.throws(() => normalizeGeminiKey(raw), error => !error.message.includes(raw) && /key value only/.test(error.message));
  }
});

test('derived secrets are stable, distinct, rotate with the provider key and support manual credentials', () => {
  const secrets = deploymentSecrets(env);
  assert.deepEqual(secrets, deploymentSecrets(env));
  assert.match(secrets.SYNC_TOKEN, /^[a-f0-9]{64}$/);
  assert.notEqual(secrets.SYNC_TOKEN, secrets.RATE_LIMIT_SECRET);
  assert.notEqual(secrets.SYNC_TOKEN, deploymentSecrets({ ...env, GEMINI_API_KEY: env.GEMINI_API_KEY + 'rotated' }).SYNC_TOKEN);
  assert.equal(deploymentSecrets({ ...env, CHAT_SYNC_TOKEN: 's'.repeat(40) }).SYNC_TOKEN, 's'.repeat(40));
  assert.throws(() => deploymentSecrets({}), /GEMINI_API_KEY/);
  assert.throws(() => deploymentSecrets({ ...env, CHAT_SYNC_TOKEN: 'short' }), /32/);
});

test('provisioning reuses only the exact named database and keeps credentials in the Cloudflare header', async () => {
  const calls = [];
  const result = await provisionDatabase(env, async (url, options) => {
    calls.push({ url, options });
    assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/'));
    assert.equal(options.headers.Authorization, 'Bearer ' + env.CLOUDFLARE_API_TOKEN);
    assert.equal(options.redirect, 'error');
    assert.ok(!url.includes(env.CLOUDFLARE_API_TOKEN));
    return url.endsWith('/workers/subdomain') ? success({ subdomain: 'my-portfolio' }) : success([
      { name: WORKER_NAME + '-unrelated', uuid: 'not-this' }, { name: WORKER_NAME, uuid }
    ]);
  });
  assert.equal(result.databaseId, uuid);
  assert.equal(result.backend, 'https://teng-portfolio-chat.my-portfolio.workers.dev');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.method === 'GET'));
});

test('first setup creates one database without touching unrelated resources', async () => {
  const calls = [];
  const result = await provisionDatabase(env, async (url, options) => {
    calls.push(options);
    if (url.endsWith('/workers/subdomain')) return success({ subdomain: 'my-portfolio' });
    if (options.method === 'GET') return success([{ name: 'unrelated', uuid }]);
    assert.ok(url.endsWith('/d1/database'));
    assert.deepEqual(JSON.parse(options.body), { name: WORKER_NAME });
    return success({ uuid, name: WORKER_NAME });
  });
  assert.equal(result.databaseId, uuid);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

test('setup stops before mutation for bad account or permission failures without echoing responses', async () => {
  let calls = 0;
  await assert.rejects(provisionDatabase({ ...env, CLOUDFLARE_ACCOUNT_ID: '../other' }, async () => { calls++; }), /CLOUDFLARE_ACCOUNT_ID/);
  assert.equal(calls, 0);
  await assert.rejects(provisionDatabase(env, async () => Response.json({ success: false, errors: [{ message: env.CLOUDFLARE_API_TOKEN }] }, { status: 403 })), error => {
    assert.match(error.message, /HTTP 403/);
    assert.ok(!error.message.includes(env.CLOUDFLARE_API_TOKEN));
    return true;
  });
});

test('a new account receives a workers.dev address only after Cloudflare confirms none exists', async () => {
  const calls = [];
  let name;
  const result = await provisionDatabase(env, async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.endsWith('/workers/subdomain') && options.method === 'GET') return Response.json({ success: false, errors: [{ code: 10007 }] }, { status: 404 });
    if (options.method === 'PUT') {
      name = JSON.parse(options.body).subdomain;
      assert.match(name, /^teng-portfolio-[a-f0-9]{12}$/);
      assert.ok(!name.includes(env.CLOUDFLARE_ACCOUNT_ID));
      return success({ subdomain: name });
    }
    return success([{ name: WORKER_NAME, uuid }]);
  });
  assert.equal(result.backend, 'https://' + WORKER_NAME + '.' + name + '.workers.dev');
  assert.deepEqual(calls.map(call => call.method), ['GET', 'PUT', 'GET']);
  let permissionCalls = 0;
  await assert.rejects(provisionDatabase(env, async () => {
    permissionCalls++;
    return Response.json({ success: false, errors: [{ code: 10007 }] }, { status: 403 });
  }), /HTTP 403/);
  assert.equal(permissionCalls, 1);
});

test('untrusted provider identifiers cannot become a credential destination or substitute database', async () => {
  await assert.rejects(provisionDatabase(env, async () => success({ subdomain: 'evil.example/path' })), /invalid workers.dev/);
  for (const result of [[{ name: WORKER_NAME, uuid: '../other' }], [{ name: WORKER_NAME, uuid }, { name: WORKER_NAME, uuid }]]) {
    await assert.rejects(provisionDatabase(env, async url => url.endsWith('/workers/subdomain') ? success({ subdomain: 'valid' }) : success(result)), /database/);
  }
});

test('deployment is limited to main and shares the sync lock; public artifact excludes secrets', () => {
  const deploy = parse(fs.readFileSync('.github/workflows/chatbot-deploy.yml', 'utf8'));
  const sync = parse(fs.readFileSync('.github/workflows/chatbot-sync.yml', 'utf8'));
  assert.deepEqual(deploy.permissions, { contents: 'read' });
  assert.equal(deploy.concurrency.group, sync.concurrency.group);
  assert.match(deploy.jobs.deploy.if, /refs\/heads\/main/);
  assert.match(sync.jobs.sync.if, /refs\/heads\/main/);
  assert.equal(deploy.on.pull_request, undefined);
  assert.equal(deploy.on.pull_request_target, undefined);
  const artifact = deploy.jobs.deploy.steps.find(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(artifact.with.path, '.chatbot/activation/');
  assert.equal(deploy.jobs.deploy.steps.filter(step => step.env?.CLOUDFLARE_API_TOKEN).length, 1);
});

for (const fail of [false, true]) test('deployment runner ' + (fail ? 'redacts CLI failures and removes temporary credentials' : 'passes protected secrets to Wrangler and removes them after success'), () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-deploy-test-'));
  try {
    fs.mkdirSync(path.join(directory, 'scripts/chatbot'), { recursive: true });
    fs.copyFileSync('scripts/chatbot/wrangler.jsonc', path.join(directory, 'scripts/chatbot/wrangler.jsonc'));
    fs.mkdirSync(path.join(directory, 'node_modules/wrangler/bin'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'preload.mjs'), `globalThis.fetch = async url => url.endsWith('/health') ? Response.json({ ready: false }, { status: 503 }) : Response.json({ success: true, result: url.endsWith('/workers/subdomain') ? { subdomain: 'test' } : [{ name: '${WORKER_NAME}', uuid: '${uuid}' }] });`);
    fs.writeFileSync(path.join(directory, 'node_modules/wrangler/bin/wrangler.js'), `
      const fs = require('node:fs');
      if (process.argv.includes('--secrets-file')) {
        const file = process.argv[process.argv.indexOf('--secrets-file') + 1];
        const secrets = JSON.parse(fs.readFileSync(file, 'utf8'));
        fs.writeFileSync('record.json', JSON.stringify({ file, mode: fs.statSync(file).mode & 511, names: Object.keys(secrets) }));
        if (process.env.TEST_FAIL === 'true') {
          console.error(Object.values(secrets).join(' ') + ' ' + process.env.CLOUDFLARE_API_TOKEN);
          process.exitCode = 1;
        }
      }
    `);
    const result = spawnSync(process.execPath, ['--import', path.join(directory, 'preload.mjs'), path.resolve('scripts/chatbot/deploy-ci.mjs')], {
      cwd: directory, encoding: 'utf8', env: { ...process.env, ...env, GITHUB_ACTIONS: 'false', TEST_FAIL: String(fail), GITHUB_ENV: path.join(directory, 'github.env'), GITHUB_STEP_SUMMARY: path.join(directory, 'summary.md'), TMPDIR: directory }
    });
    assert.equal(result.status, fail ? 1 : 0, result.stderr);
    const record = JSON.parse(fs.readFileSync(path.join(directory, 'record.json')));
    assert.equal(record.mode, 0o600);
    assert.deepEqual(record.names.sort(), ['GEMINI_API_KEY', 'RATE_LIMIT_SECRET', 'SYNC_TOKEN']);
    assert.ok(!fs.existsSync(record.file));
    assert.ok(!fs.existsSync(path.dirname(record.file)));
    for (const secret of [env.CLOUDFLARE_API_TOKEN, ...Object.values(deploymentSecrets(env))]) assert.ok(!(result.stdout + result.stderr).includes(secret));
    if (!fail) assert.equal(fs.readFileSync(path.join(directory, 'github.env'), 'utf8'), 'CHAT_BACKEND_URL=https://teng-portfolio-chat.test.workers.dev\n');
    else assert.ok(!fs.existsSync(path.join(directory, 'github.env')));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
