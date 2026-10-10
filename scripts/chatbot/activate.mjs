import fs from 'node:fs';
const base = new URL(process.argv[2]);
if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Pass the deployed chatbot HTTPS origin.');
const health = await fetch(base.origin + '/health', { redirect: 'error', signal: AbortSignal.timeout(10000) });
if (!health.ok || !(await health.json()).ready) throw new Error('Deploy the API and complete its knowledge index first.');
for (const question of ['What does Teng research?', 'Teng 的研究关注什么？']) {
  const response = await fetch(base.origin + '/chat', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(40000),
    headers: { 'Content-Type': 'application/json', Origin: 'https://teng-teng.org' }, body: JSON.stringify({ question, history: [], page: '/about/' }) });
  if (!response.ok) throw new Error('Live Gemini check failed: HTTP ' + response.status);
  const data = await response.json();
  if (!data.answer || !data.sources?.some(source => source.url !== 'https://teng-teng.org/contact/' && source.url.startsWith('https://teng-teng.org/'))) throw new Error('Gemini did not return a grounded answer.');
  console.log(JSON.stringify({ question, answer: data.answer, sources: data.sources }, null, 2));
}
fs.writeFileSync('_data/chatbot.yml', 'enabled: true\nendpoint: ' + JSON.stringify(base.origin + '/chat') + '\n');
console.log('Live English/Chinese checks passed. Review the answers, then commit the enabled configuration.');
