// One hibernatable WebSocket room per gallery project. Only live sockets hold
// membership. A reconnect asks current members for their current poses.
const galleryOrigin = 'https://teng-teng.org';
const maxVisitors = 40;
const appearanceCount = 12 * 6 * 6 * 5 * 3 * 5;

export function routeVisitors(request, env, project) {
  if (request.headers.get('Origin') !== galleryOrigin) return new Response('Open the gallery to join.', {status: 403});
  if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('WebSocket required.', {status: 426});
  }
  return env.VISITORS.get(env.VISITORS.idFromName(project)).fetch(request);
}

export function validPose(p) {
  if (!Array.isArray(p) || ![13,16,22].includes(p.length) ||
      !p.every(n => typeof n === 'number' && Number.isFinite(n))) return false;
  const bounds = [20000,20000,20000,3.15,1.6,6.29,12,1,80,3,10000,1,1];
  return bounds.every((limit,i) => Math.abs(p[i]) <= limit) &&
    (p[7] === 0 || p[7] === 1) && Number.isInteger(p[9]) && p[9] >= 0 &&
    p[6] >= 0 && p[12] >= 0 && p.slice(13).every(n => Math.abs(n) <= 4);
}

export class VisitorRoom {
  constructor(ctx) { this.ctx = ctx; this.lastMessage = new WeakMap(); }
  members() { return this.ctx.getWebSockets().filter(s => s.readyState === 1 && s.deserializeAttachment()); }
  send(s, value) { try { s.send(value); } catch { /* The close event removes a disconnected visitor. */ } }
  others(s, data) {
    const message = JSON.stringify(data);
    for (const peer of this.members()) if (peer !== s) this.send(peer, message);
  }
  fetch(request) {
    const members = this.members();
    if (members.length >= maxVisitors) return new Response('Room full', {status: 429});
    const occupied = new Set(members.map(s => s.deserializeAttachment().look));
    const requested = Number(new URL(request.url).searchParams.get('look'));
    let look = Number.isSafeInteger(requested) && requested >= 0 && requested < appearanceCount ? requested : 0;
    while (occupied.has(look)) look = (look + 1) % appearanceCount;
    const [client, socket] = Object.values(new WebSocketPair());
    const who = {id: crypto.randomUUID(), look};
    this.ctx.acceptWebSocket(socket);
    socket.serializeAttachment(who);
    this.send(socket, JSON.stringify(['ready', who.id, look, members.map(s => s.deserializeAttachment())]));
    this.others(socket, ['join', who.id, look]);
    return new Response(null, {status: 101, webSocket: client});
  }
  leave(s) {
    const who = s.deserializeAttachment();
    if (!who) return;
    s.serializeAttachment(null);
    this.others(s, ['out', who.id]);
  }
  webSocketMessage(s, message) {
    const who = s.deserializeAttachment();
    if (!who) return;
    if (message === 'bye') { this.leave(s); s.close(1000,'Left gallery walk'); return; }
    if (typeof message !== 'string' || message.length > 480) { this.leave(s); s.close(1008,'Invalid pose'); return; }
    const now = Date.now();
    if (message === 'ping') {
      if (now - (this.lastMessage.get(s)?.ping || 0) >= 1000) {
        this.lastMessage.set(s, {...this.lastMessage.get(s), ping:now});
        this.send(s, '["pong"]');
      }
      return;
    }
    let pose;
    try { pose = JSON.parse(message); } catch {}
    if (!validPose(pose)) { this.leave(s); s.close(1008,'Invalid pose'); return; }
    const last = this.lastMessage.get(s) || {};
    if (now - (last.pose || 0) < 35) return;
    this.lastMessage.set(s, {...last,pose:now});
    this.others(s, ['pose',who.id,pose]);
  }
  webSocketClose(s, code) { this.leave(s); try { s.close(code === 1000 ? 1000 : 1001); } catch {} }
  webSocketError(s) { this.webSocketClose(s,1001); }
}
