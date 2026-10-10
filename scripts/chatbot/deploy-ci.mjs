import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { deploymentSecrets, provisionDatabase, WORKER_NAME } from './deployment.mjs';

async function main() {
  const secrets = deploymentSecrets(process.env);
  // Register derived values with GitHub's log masker before invoking any CLI.
  if (process.env.GITHUB_ACTIONS === 'true') for (const value of Object.values(secrets)) console.log('::add-mask::' + value);
  const { databaseId, backend } = await provisionDatabase(process.env);
  const configPath = 'scripts/chatbot/wrangler.jsonc';
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  if (config.name !== WORKER_NAME || config.d1_databases?.length !== 1 || config.d1_databases[0].binding !== 'CHAT_DB') throw new Error('Unexpected Worker configuration.');
  if (config.d1_databases[0].database_id && config.d1_databases[0].database_id !== databaseId) throw new Error('Configured database differs from the selected account; deployment stopped.');
  config.d1_databases[0].database_id = databaseId;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'teng-chat-deploy-'));
  const secretPath = path.join(temporary, 'secrets.json');
  const redact = value => [process.env.CLOUDFLARE_API_TOKEN, ...Object.values(secrets)].filter(Boolean).reduce((text, secret) => text.split(secret).join('[redacted]'), value);
  const run = args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_SANITIZE: 'true' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-20000); });
    child.on('error', () => reject(new Error('Could not start Wrangler.')));
    child.on('close', code => {
      if (code === 0) resolve();
      else { console.error(redact(output)); reject(new Error('Wrangler command failed; inspect the sanitized output above.')); }
    });
  });
  try {
    await fs.writeFile(secretPath, JSON.stringify(secrets), { mode: 0o600 });
    await run(['d1', 'migrations', 'apply', 'CHAT_DB', '--remote', '--config', configPath]);
    console.log('Chat database migrations applied.');
    await run(['deploy', '--config', configPath, '--keep-vars', '--secrets-file', secretPath]);
    console.log('Chat interface deployed: ' + backend);
    if (process.env.GITHUB_ENV) await fs.appendFile(process.env.GITHUB_ENV, 'CHAT_BACKEND_URL=' + backend + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, 'Chat API deployed: ' + backend + '\n\nThe website chat remains disabled until knowledge sync and live checks pass and the activation file is published.\n');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
