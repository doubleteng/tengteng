import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { Liquid } from 'liquidjs';
const fragment = fs.readFileSync(new URL('../_includes/chatbot.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../assets/js/chatbot.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function ui(fetcher) {
  const liquid = new Liquid(); liquid.registerFilter('relative_url', value => value);
  const html = await liquid.parseAndRender(fragment, { site: { data: { chatbot: { enabled: true, endpoint: 'https://chat.example/chat' } } }, page: {} });
  const { document, window } = parseHTML('<html><body><main data-project-page></main>' + html + '</body></html>');
  window.HTMLElement.prototype.focus = function () { document.activeElement = this; };
  vm.runInNewContext(source, { document, window, URL, fetch: fetcher, AbortController, setTimeout, clearTimeout, location: { pathname: '/research/scutoid-brick/' } });
  return { document, window, input: document.querySelector('textarea'), form: document.querySelector('form'),
    click(selector) { document.querySelector(selector).dispatchEvent(new window.Event('click', { bubbles: true })); },
    submit() { document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); } };
}
test('chat starts closed, opens on demand, supports Escape and project-specific prompt', async () => {
  const app = await ui(async () => { throw new Error('Unexpected request'); });
  assert.equal(app.document.querySelector('[role=dialog]').hidden, true);
  assert.equal(app.document.querySelector('[data-chat-page]').hidden, false);
  app.click('.teng-chat-launch'); assert.equal(app.document.querySelector('[role=dialog]').hidden, false);
  assert.equal(app.document.activeElement, app.input);
  const escape = new app.window.Event('keydown', { bubbles: true, cancelable: true }); escape.key = 'Escape'; app.input.dispatchEvent(escape);
  assert.equal(app.document.querySelector('[role=dialog]').hidden, true);
  assert.equal(app.document.querySelector('.teng-chat-launch').getAttribute('aria-expanded'), 'false');
});
test('chat preserves project context, renders plain text and allows only trusted source links', async () => {
  let request;
  const app = await ui(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ answer: '<img src=x onerror=alert(1)> Example answer.', sources: [
      { title: 'Scutoid', url: 'https://teng-teng.org/research/scutoid-brick/' }, { title: 'Bad', url: 'javascript:alert(1)' }
    ] }), { headers: { 'Content-Type': 'application/json' } });
  });
  app.input.value = 'Tell me about this project.'; app.submit(); await tick();
  assert.equal(JSON.parse(request.options.body).page, '/research/scutoid-brick/');
  assert.equal(request.options.credentials, 'omit');
  const message = app.document.querySelector('[data-role=assistant]');
  assert.equal(message.querySelector('img'), null); assert.match(message.textContent, /<img/);
  assert.equal(message.querySelectorAll('a').length, 1);
  app.click('[data-chat-clear]'); assert.equal(app.document.querySelector('.teng-chat-messages').childElementCount, 0);
});
test('failed question is retained, duplicate submit is blocked, and retry is possible', async () => {
  let finish, calls = 0;
  const app = await ui(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  app.input.value = 'A question'; app.submit(); app.input.value = 'Second question'; app.submit();
  assert.equal(calls, 1); assert.equal(app.form.querySelector('[type=submit]').disabled, true);
  finish(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })); await tick();
  assert.equal(app.input.value, 'A question'); assert.match(app.document.querySelector('[role=status]').textContent, /limit/);
  assert.equal(app.document.querySelector('.teng-chat-messages').childElementCount, 0);
  assert.equal(app.form.querySelector('[type=submit]').disabled, false);
});
test('Enter during Chinese IME composition does not submit', async () => {
  let calls = 0; const app = await ui(async () => { calls++; return new Response('{}'); });
  app.input.value = '材料研究';
  const event = new app.window.Event('keydown', { bubbles: true, cancelable: true }); event.key = 'Enter'; event.isComposing = true;
  app.input.dispatchEvent(event); await tick(); assert.equal(calls, 0);
});
