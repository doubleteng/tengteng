import {routeVisitors} from './visitors.mjs';
export {VisitorRoom} from './visitors.mjs';
const site = 'https://teng-teng.org';
const remotePage = site + '/teaching/id3/ava-render.html';
const engine = 'https://engine.hyperbeam.com/v0/vm';
const minute = 60000;
const duration = 10;
const uuid = () => crypto.randomUUID();
const cors = {'Access-Control-Allow-Origin':site, 'Access-Control-Allow-Headers':'Authorization, Content-Type', 'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const reply = (body, status=200) => Response.json(body,{status,headers:cors});
const error = (message,status) => reply({error:message},status);
export default {
 async fetch(req, env) {
  const url = new URL(req.url);
  const visitorRoom = /^\/visitors\/v1\/([a-z0-9][a-z0-9-]{0,63})$/.exec(url.pathname);
  if(visitorRoom)return routeVisitors(req,env,visitorRoom[1]);
  if(env.ARCHIVED==='true' && req.method!=='DELETE' && req.method!=='OPTIONS'){
   if(url.pathname==='/health')return reply({configured:false});
   return error('The gallery now uses the browser 3D viewer.',410);
  }
  if(url.pathname==='/health') return reply({configured:Boolean(env.HYPERBEAM_API_KEY)});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(!env.HYPERBEAM_API_KEY) return error('Cloud sessions are currently unavailable.',503);
  const webhook = /^\/rooms\/[0-9a-f-]{36}\/participant$/.test(url.pathname);
  if(!webhook && req.headers.get('Origin')!==site) return error('Open this walkthrough from the ID3 gallery.',403);
  if(url.pathname!=='/sessions' && !/^\/rooms\/[0-9a-f-]{36}(?:\/participant)?$/.test(url.pathname)) return error('Unknown route.',404);
  return env.ROOMS.get(env.ROOMS.idFromName('ava-archive-v1')).fetch(req);
 }
};
export class GallerySessions {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.db=ctx.storage.sql;
  this.db.exec('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, host TEXT, renderer TEXT, hook TEXT, participant TEXT, vm TEXT, ends INTEGER)');
  this.db.exec('CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, at INTEGER, ip TEXT)');
 }
 async fetch(req){
  const url=new URL(req.url);
  if(req.method==='POST' && url.pathname==='/sessions')return this.start(req,url.origin);
  const [, ,id,op]=url.pathname.split('/');
  const room=this.db.exec('SELECT * FROM rooms WHERE id=? AND ends>?',id||'',Date.now()).toArray()[0];
  if(!room)return error('This walkthrough has ended.',410);
  if(op==='participant' && req.method==='POST'){
   if(req.headers.get('Authorization')!=='Bearer '+room.hook)return reply({authorized:false},403);
   const data=await req.json().catch(()=>({}));
   if(data.userdata?.ticket!==room.host || typeof data.user_id!=='string'||data.user_id.length>100||!data.user_id.length)return reply({authorized:false});
   // Claim the first participant atomically, and allow the same browser to reconnect.
   this.db.exec('UPDATE rooms SET participant=? WHERE id=? AND participant IS NULL',data.user_id,id);
   const who=this.db.exec('SELECT participant FROM rooms WHERE id=?',id).one().participant;
   return reply({authorized:who===data.user_id});
  }
  if(op)return error('Unknown route.',404);
  if(req.method==='DELETE' && req.headers.get('Authorization')==='Bearer '+room.host){
   await this.end(room);return reply({closed:true});
  }
  if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return error('Invalid request.',400);
  const protocols=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  const role=protocols.includes('key.'+room.host)?'host':protocols.includes('key.'+room.renderer)?'renderer':null;
  if(!role || !protocols.includes('id3.v1'))return error('Invalid session.',403);
  const pair=new WebSocketPair(), [client,socket]=Object.values(pair);
  for(const prior of this.ctx.getWebSockets(id+':'+role))prior.close(1000,'Reconnected');
  this.ctx.acceptWebSocket(socket,[id,id+':'+role]);
  socket.serializeAttachment({id,role,ends:room.ends});
  for(const peer of this.ctx.getWebSockets(id+':'+(role==='host'?'renderer':'host')))peer.send('{"type":"peer"}');
  return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'id3.v1'}});
 }
 async start(req,origin){
  const now=Date.now(),id=uuid(),host=uuid(),renderer=uuid(),hook=uuid();
  const ip=req.headers.get('CF-Connecting-IP')||'unavailable';
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(now.toString().slice(0,-8)+':'+ip));
  const ipTag=Array.from(new Uint8Array(bytes).slice(0,12),x=>x.toString(16).padStart(2,'0')).join('');
  // SQLite writes above the first network await serialize concurrent reservations.
  this.db.exec('DELETE FROM reservations WHERE at<?',now-32*24*60*minute);
  const active=this.db.exec('SELECT COUNT(*) AS n FROM rooms WHERE ends>?',now).one().n;
  if(active>=6)return error('All six cloud views are in use. Try again shortly.',429);
  const reserved=this.db.exec('SELECT COUNT(*) AS n FROM reservations').one().n;
  if(reserved>=800)return error('The gallery’s free cloud allowance is in use. Please try again later.',429);
  if(this.db.exec('SELECT COUNT(*) AS n FROM reservations WHERE ip=? AND at>?',ipTag,now-10*minute).one().n>=12)return error('Please wait before starting another walkthrough.',429);
  this.db.exec('INSERT INTO reservations VALUES(?,?,?)',id,now,ipTag);
  this.db.exec('INSERT INTO rooms(id,host,renderer,hook,ends) VALUES(?,?,?,?,?)',id,host,renderer,hook,now+(duration+2)*minute);
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(now+minute);
  try{
   const response=await fetch(engine,{method:'POST',headers:{Authorization:'Bearer '+this.env.HYPERBEAM_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
    start_url:remotePage+'#'+id+'.'+renderer,region:'NA',kiosk:true,webgl:true,width:1280,height:720,fps:30,quality:{mode:'smooth'},
    timeout:{absolute:duration*60,inactive:180,offline:duration*60,warning:30},
    auth:{type:'webhook',value:{url:origin+'/rooms/'+id+'/participant',bearer:hook}}
   }),signal:AbortSignal.timeout(55000)});
   if(!response.ok){
    this.db.exec('DELETE FROM rooms WHERE id=?',id);
    if(response.status>=400 && response.status<500)this.db.exec('DELETE FROM reservations WHERE id=?',id);
    return error('The cloud provider could not start a walkthrough.',503);
   }
   const vm=await response.json(),embed=new URL(vm.embed_url);
   if(!vm.session_id || embed.protocol!=='https:' || !embed.hostname.endsWith('.hyperbeam.com'))throw Error();
   this.db.exec('UPDATE rooms SET vm=? WHERE id=?',vm.session_id,id);
   return reply({id,key:host,stream:embed.href});
  }catch{return error('The cloud provider did not respond in time.',503);}
 }
 async end(room){
  if(room.vm){
   const r=await fetch(engine+'/'+encodeURIComponent(room.vm),{method:'DELETE',headers:{Authorization:'Bearer '+this.env.HYPERBEAM_API_KEY},signal:AbortSignal.timeout(8000)}).catch(()=>null);
   if(!r || (!r.ok && r.status!==404 && r.status!==410))return;
  }
  this.db.exec('DELETE FROM rooms WHERE id=?',room.id);
  for(const s of this.ctx.getWebSockets(room.id))s.close(1000,'Ended');
 }
 webSocketMessage(socket,message){
  const {id,role,ends}=socket.deserializeAttachment();
  const valid=typeof message==='string'?message.length<=48000:role==='renderer' && message instanceof ArrayBuffer && message.byteLength<=500000;
  if(Date.now()>=ends || !valid){socket.close(1008,'Expired or invalid');return;}
  for(const peer of this.ctx.getWebSockets(id+':'+(role==='host'?'renderer':'host')))if(peer.readyState===1)peer.send(message);
 }
 async alarm(){
  const now=Date.now();
  for(const room of this.db.exec('SELECT * FROM rooms WHERE ends<=?',now).toArray()){
   this.db.exec('DELETE FROM rooms WHERE id=?',room.id);
   for(const s of this.ctx.getWebSockets(room.id))s.close(1000,'Expired');
  }
  if(this.db.exec('SELECT COUNT(*) AS n FROM rooms').one().n)await this.ctx.storage.setAlarm(now+minute);
 }
}
