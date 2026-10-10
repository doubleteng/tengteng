import { createHmac } from 'node:crypto';

export const WORKER_NAME = 'teng-portfolio-chat';

// Domain-separated authentication secrets avoid another manual credential step.
// Rotate the Gemini key by running deployment again before the next sync.
export function deploymentSecrets(env) {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key || key.length < 20) throw new Error('Add GEMINI_API_KEY to repository Actions secrets.');
  const derive = purpose => createHmac('sha256', key).update('doubleteng/tengteng:portfolio-chatbot:v1:' + purpose).digest('hex');
  const secrets = {
    GEMINI_API_KEY: key,
    SYNC_TOKEN: env.CHAT_SYNC_TOKEN || derive('knowledge-sync'),
    RATE_LIMIT_SECRET: env.RATE_LIMIT_SECRET || derive('visitor-quotas')
  };
  if (secrets.SYNC_TOKEN.length < 32 || secrets.RATE_LIMIT_SECRET.length < 32) throw new Error('Optional CHAT_SYNC_TOKEN and RATE_LIMIT_SECRET must contain at least 32 characters.');
  return secrets;
}

export async function provisionDatabase(env, fetcher = fetch) {
  const account = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to repository Actions secrets.');
  const request = async (path, method = 'GET', body) => {
    const response = await fetcher('https://api.cloudflare.com/client/v4/accounts/' + account + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) {
      if (path === '/workers/subdomain' && data.errors?.some(item => item.code === 10007)) throw new Error('Open Cloudflare Workers & Pages and finish setting up your workers.dev subdomain, then rerun deployment.');
      throw new Error('Cloudflare setup failed (HTTP ' + response.status + '). Check the token account and Workers Scripts / D1 permissions.');
    }
    return data.result;
  };
  const { subdomain } = await request('/workers/subdomain');
  if (typeof subdomain !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) throw new Error('Cloudflare returned an invalid workers.dev subdomain.');
  const databases = await request('/d1/database?name=' + WORKER_NAME + '&per_page=100');
  if (!Array.isArray(databases)) throw new Error('Cloudflare returned an invalid database list.');
  const matching = databases.filter(db => db.name === WORKER_NAME);
  if (matching.length > 1) throw new Error('Multiple matching databases found; deployment stopped.');
  const database = matching[0] || await request('/d1/database', 'POST', { name: WORKER_NAME });
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(database?.uuid || '')) throw new Error('Cloudflare returned an invalid database identifier.');
  return { databaseId: database.uuid, backend: 'https://' + WORKER_NAME + '.' + subdomain + '.workers.dev' };
}
