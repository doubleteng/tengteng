export const SITE = 'https://teng-teng.org';
export const GOOGLE = 'https://generativelanguage.googleapis.com';
export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const STORE_PATTERN = /^fileSearchStores\/[a-zA-Z0-9_-]+$/;
export function publicURL(value) {
  try {
    const u = new URL(value);
    return u.origin === SITE && !u.username && !u.password && !u.search && !u.hash &&
      /^\/(?:about|contact|publications|computational-tools|research|teaching|design)(?:\/[a-z0-9-]+)?\/$/.test(u.pathname) ? u.href : null;
  } catch { return null; }
}
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function readJSON(request, limit = 20000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalid_json');
  const stream = request.body?.getReader();
  if (!stream) throw new Error('invalid_json');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await stream.read(); if (done) break;
    size += value.length;
    if (size > limit) { await stream.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function validateCatalog(value) {
  if (!value || !STORE_PATTERN.test(value.store) || !/^[a-f0-9]{64}$/.test(value.revision) ||
      !Array.isArray(value.files) || !value.files.length || value.files.length > 200) throw new Error('invalid_catalog');
  const names = new Set(), urls = new Set();
  const files = value.files.map(file => {
    if (!publicURL(file.url) || typeof file.title !== 'string' || !file.title.trim() || file.title.length > 240 ||
        typeof file.filename !== 'string' || !/^tt-[a-f0-9]{16}\.txt$/.test(file.filename) || names.has(file.filename) || urls.has(file.url) ||
        typeof file.document !== 'string' || !file.document.startsWith(value.store + '/documents/') || !/^[\w/-]+$/.test(file.document)) throw new Error('invalid_catalog');
    names.add(file.filename); urls.add(file.url);
    return { filename: file.filename, document: file.document, title: file.title, url: file.url };
  });
  return { store: value.store, revision: value.revision, files };
}
export function validateQuestion(body) {
  if (!body || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1200) throw new Error('invalid_question');
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 4 || history.some(item => !item || !['user', 'assistant'].includes(item.role) ||
    typeof item.content !== 'string' || item.content.length > 3200)) throw new Error('invalid_history');
  return { question: body.question.trim(), history: history.map(({ role, content }) => ({ role, content })),
    page: typeof body.page === 'string' && publicURL(SITE + body.page) ? body.page : '' };
}
