export const projectKey = new URLSearchParams(location.search).get('project') || 'ava-barbat';
const api = 'https://ttistengteng--id3-film.modal.run';
const byId = id => document.getElementById(id);
const validId = value => /^[0-9a-f]{40}$/.test(value);
const movieUrl = id => api + '/jobs/' + id + '/movie';

export async function loadProject() {
  const response = await fetch('../models/catalog.json', {cache:'no-cache'});
  if (!response.ok) throw Error('The project catalog could not load.');
  const project = (await response.json()).projects.find(p => p.key === projectKey && p.url);
  if (!project) throw Error('This project does not have a published model yet.');
  return project;
}

async function request(path, options = {}) {
  const response = await fetch(api + path, {cache:'no-store', signal:AbortSignal.timeout(75000), ...options});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(data.error || data.detail || 'Modal is temporarily unavailable.');
    error.job = data.job;
    error.httpStatus = response.status;
    throw error;
  }
  return data;
}

export async function showFilms(project, preferred) {
  try {
    const {films} = await request('/films?project=' + encodeURIComponent(project.key));
    const items = films.filter(f => validId(f.id));
    if (!items.length) return;
    const list = byId('film-list');
    const chosen = preferred || list.value;
    list.replaceChildren(...items.map(f => new Option(f.director + ' · ' +
      new Date(f.finished * 1000).toLocaleString() + ' · ' + (f.frames / 24).toFixed(1) + ' s', f.id)));
    if (items.some(f => f.id === chosen)) list.value = chosen;
    const select = () => {
      const url = movieUrl(list.value);
      if (byId('final-player').getAttribute('src') !== url) byId('final-player').src = url;
      byId('download-final').href = url + '?download=true';
    };
    list.onchange = select;
    select();
    byId('published-finals').hidden = false;
  } catch { /* The featured film and editor are available when Modal is offline. */ }
}

export function renderControls(project, director) {
  const submit = byId('render-final'), message = byId('render-status');
  const storageKey = 'id3-final:' + project.key + ':' + director;
  let preview = null, timer, busy = false, pending = false;
  const enable = () => { submit.disabled = busy || pending || !preview; };
  function remember(id) { try { localStorage.setItem(storageKey, id); } catch {} }
  function display(job) {
    if (!validId(job.id)) throw Error('The cloud returned an invalid film identifier.');
    remember(job.id);
    clearTimeout(timer);
    busy = job.state === 'queued' || job.state === 'running';
    enable();
    if (job.state === 'ready') {
      message.textContent = 'Final MP4 ready · 1080p · ' + job.frames + ' frames.';
      const link = byId('play-final');
      link.href = movieUrl(job.id) + '?download=true';
      link.hidden = false;
      showFilms(project, job.id);
    } else if (job.state === 'failed') {
      message.textContent = job.error || 'The render stopped. Submit the preview to try again.';
    } else {
      message.textContent = (job.state === 'running' ? 'Rendering · ' + (job.frame || 0) + ' / ' + job.frames + ' frames.' : 'Queued for the studio GPU.') + ' You can close this page.';
      timer = setTimeout(() => poll(job.id), 12000);
    }
  }
  async function poll(id) {
    try { display(await request('/jobs/' + id)); }
    catch (error) {
      if (error.httpStatus === 404) {
        busy = false;
        enable();
        message.textContent = 'This render could not be found.';
        return;
      }
      message.textContent = 'Reconnecting to Modal to check your render…';
      timer = setTimeout(() => poll(id), 20000);
    }
  }
  submit.onclick = async () => {
    if (busy || pending || !preview) return;
    pending = true;
    enable();
    byId('play-final').hidden = true;
    message.textContent = 'Submitting your camera path to Modal…';
    try {
      const job = await request('/jobs', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...JSON.parse(preview), director, revision:project.url})});
      display(job);
    } catch (error) {
      if (error.job && validId(error.job.id)) display(error.job);
      else message.textContent = error.httpStatus ? error.message : 'Could not confirm submission. Retry to reconnect to the same render.';
    } finally { pending = false; enable(); }
  };
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch {}
  if (validId(saved)) { busy = true; poll(saved); }
  enable();
  return {
    ready(path) { preview = JSON.stringify(path); enable(); },
    changed(path) { if (preview && JSON.stringify(path) !== preview) { preview = null; enable(); } }
  };
}
