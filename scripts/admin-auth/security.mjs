export const OWNER_ID = 54260562;
export const REPO_ID = 1075654318;
export const REPO = 'doubleteng/tengteng';
export const SITE = 'https://teng-teng.org';
export const SESSION_COOKIE = '__Host-tt-session';
export const FLOW_COOKIE = '__Host-tt-flow';
export const now = () => Math.floor(Date.now() / 1000);
export function random() { return encode(crypto.getRandomValues(new Uint8Array(32))); }
export function encode(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function decode(value) { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
export async function hash(value) { return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
async function key(secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw new Error('SESSION_SECRET must be 32 random bytes encoded as hex');
  return crypto.subtle.importKey('raw', Uint8Array.from(secret.match(/../g), x => parseInt(x, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value, secret, purpose) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(purpose) }, await key(secret), new TextEncoder().encode(JSON.stringify(value)));
  return encode(iv) + '.' + encode(new Uint8Array(encrypted));
}
export async function unseal(value, secret, purpose) {
  const [iv, body] = value.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(purpose) }, await key(secret), decode(body))));
}
export function cookie(name, value, age) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
export function cookies(request) { return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(x => x.trim().split('=')).filter(x => x.length === 2)); }
export function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
export function sameOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || ['cross-site', 'none'].includes(request.headers.get('Sec-Fetch-Site'))) fail(403, '请求来源无效，请重新打开后台。');
}
export async function boundedJSON(request, limit = 30 * 1024 * 1024) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, '需要 JSON 请求。');
  if (+request.headers.get('Content-Length') > limit) fail(413, '上传总量过大。');
  const reader = request.body?.getReader(); if (!reader) fail(400, '缺少请求内容。');
  const parts = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); fail(413, '上传总量过大。'); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, '请求格式无效。'); }
}
