import fs from 'node:fs/promises';
import { parse } from 'yaml';
import { deploymentSecrets } from './deployment.mjs';
import { syncKnowledge } from './sync.mjs';

async function main() {
  const config = parse(await fs.readFile('_data/chatbot.yml', 'utf8'));
  let backend = process.env.CHAT_BACKEND_URL;
  if (!backend && config?.enabled === true && config.endpoint) {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/chat' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid published chat endpoint.');
    backend = endpoint.origin;
  }
  if (!backend) { console.log('Chat has not been deployed and activated yet; knowledge sync skipped.'); return; }
  const secrets = deploymentSecrets(process.env);
  if (process.env.GITHUB_ACTIONS === 'true') console.log('::add-mask::' + secrets.SYNC_TOKEN);
  await syncKnowledge({ key: secrets.GEMINI_API_KEY, token: secrets.SYNC_TOKEN, backend });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
