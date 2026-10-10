(() => {
  const root = document.querySelector('[data-teng-chat]');
  if (!root) return;
  let endpoint;
  try { endpoint = new URL(root.dataset.endpoint); if (endpoint.protocol !== 'https:') return; } catch { return; }
  const panel = root.querySelector('.teng-chat-panel'), launch = root.querySelector('.teng-chat-launch');
  const form = root.querySelector('form'), input = root.querySelector('textarea');
  const log = root.querySelector('.teng-chat-messages'), status = root.querySelector('[role=status]');
  const scroll = root.querySelector('.teng-chat-scroll'), prompts = root.querySelector('.teng-chat-prompts');
  const pagePrompt = root.querySelector('[data-chat-page]');
  const history = [];
  let pending = false, controller = null, lastFocus = null;
  pagePrompt.hidden = !document.querySelector('[data-project-page]');
  const scrollEnd = () => { scroll.scrollTop = scroll.scrollHeight; };
  function open() { lastFocus = document.activeElement; panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); input.focus(); }
  function close() { panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); (lastFocus?.isConnected ? lastFocus : launch).focus(); }
  launch.addEventListener('click', () => panel.hidden ? open() : close());
  root.querySelector('[data-chat-close]').addEventListener('click', close);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); } });
  function append(role, content, sources = []) {
    const item = document.createElement('div'); item.className = 'teng-chat-message'; item.dataset.role = role;
    const label = document.createElement('span'); label.className = 'teng-chat-message-label'; label.textContent = role === 'user' ? 'You' : 'Portfolio guide';
    const paragraph = document.createElement('p'); paragraph.textContent = content;
    item.append(label, paragraph);
    const links = document.createElement('div'); links.className = 'teng-chat-sources';
    for (const source of sources.slice(0, 5)) {
      try {
        const url = new URL(source.url);
        if (url.origin !== 'https://teng-teng.org' || url.username || url.password) continue;
        const link = document.createElement('a'); link.href = url.href; link.textContent = source.title + ' ↗'; links.append(link);
      } catch { /* Ignore invalid links rather than turning model output into HTML. */ }
    }
    if (links.childElementCount) item.append(links);
    log.append(item); scrollEnd(); return item;
  }
  async function send(event) {
    event?.preventDefault();
    const question = input.value.trim();
    if (!question || question.length > 1200 || pending) return;
    pending = true; controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 40000);
    form.querySelector('[type=submit]').disabled = true;
    prompts.hidden = true;
    const bubble = append('user', question);
    input.value = '';
    status.textContent = /[\u3400-\u9fff]/u.test(question) ? '正在查阅已发布的作品资料…' : 'Checking the published portfolio…';
    scrollEnd();
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: history.slice(-4), page: location.pathname })
      });
      const data = await response.json();
      if (!response.ok || typeof data.answer !== 'string' || !Array.isArray(data.sources)) {
        const chinese = /[\u3400-\u9fff]/u.test(question);
        throw new Error(response.status === 429
          ? (chinese ? '暂时达到提问次数限制，请稍后再试。' : 'The question limit has been reached. Please try again later.')
          : (chinese ? '暂时无法回答，请稍后重试，或通过 Contact 页面联系 Teng。' : 'The guide is temporarily unavailable. Try again, or reach Teng through the Contact page.'));
      }
      append('assistant', data.answer, data.sources);
      history.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer.slice(0, 3200) });
      history.splice(0, Math.max(0, history.length - 4));
      status.textContent = '';
    } catch (error) {
      bubble.remove(); input.value = question;
      status.textContent = error.name === 'AbortError' ? 'The request timed out. Your question is kept—please try again.' : (error instanceof TypeError ? 'Unable to connect. Your question is kept—please try again.' : error.message);
    } finally {
      clearTimeout(timeout); pending = false; controller = null;
      form.querySelector('[type=submit]').disabled = false; scrollEnd();
    }
  }
  form.addEventListener('submit', send);
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) send(event); });
  prompts.addEventListener('click', event => { const button = event.target.closest('button'); if (button) { input.value = button.textContent; send(); } });
  root.querySelector('[data-chat-clear]').addEventListener('click', () => {
    if (pending) return;
    history.length = 0; log.replaceChildren(); input.value = ''; status.textContent = ''; prompts.hidden = false; input.focus();
  });
  window.addEventListener('pagehide', () => controller?.abort());
})();
