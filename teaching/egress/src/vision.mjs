/** Anonymous instructor service in an embedded bridge; never opens Google sign-in. */
export const validEndpoint=s=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(s);
export const validGoogleOrigin=s=>s==='https://script.google.com'||s==='https://script.googleusercontent.com'||/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(s);
export function discoverFrames(win,result=new Set(),depth=0){
 if(!win||depth>3||result.has(win))return result;result.add(win);
 try{for(let i=0;i<Math.min(win.length,8);i++)discoverFrames(win.frames[i],result,depth+1);}catch{}
 return result;
}
export class VisionConnection{
 constructor(host=window){this.host=host;this.pending=new Map();this.candidates=new Set();this.host.addEventListener('message',e=>this.receive(e));}
 get connected(){return !!this.source&&!!this.frame?.isConnected;}
 disconnect(){
  clearInterval(this.timer);clearTimeout(this.connectTimer);
  this.rejectConnect?.(Error('Recognition connection changed. Please try again.'));this.rejectConnect=null;this.resolveConnect=null;this.connecting=null;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Recognition connection changed. Your drawing is unchanged.'));}
  this.pending.clear();this.frame?.remove();this.frame=null;this.source=null;this.origin=null;this.candidates.clear();
 }
 connect(endpoint){
  if(!validEndpoint(endpoint))return Promise.reject(Error('The instructor recognition service is unavailable. Please try again later.'));
  if(this.connected&&Date.now()-this.started<18000000)return Promise.resolve();
  if(this.connecting)return this.connecting;
  this.disconnect();this.nonce=crypto.randomUUID();this.started=Date.now();
  this.connecting=new Promise((resolve,reject)=>{this.resolveConnect=resolve;this.rejectConnect=reject;});
  const frame=this.host.document.createElement('iframe');frame.title='Shared plan recognition service';frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.src=endpoint+'?nonce='+this.nonce;this.frame=frame;this.host.document.body.appendChild(frame);
  const tick=()=>{if(!this.frame?.isConnected)return;this.candidates=discoverFrames(this.frame.contentWindow);for(const win of this.candidates){try{win.postMessage({type:'egress-vision-hello',nonce:this.nonce},'*');}catch{}}};
  this.timer=setInterval(tick,500);tick();
  this.connectTimer=setTimeout(()=>{const reject=this.rejectConnect;this.rejectConnect=null;this.disconnect();reject?.(Error('The recognition service did not connect. Please retry; no Google login or API key is needed.'));},45000);
  return this.connecting;
 }
 receive(e){
  const m=e.data;if(!m||m.nonce!==this.nonce||!validGoogleOrigin(e.origin))return;
  if(m.type==='egress-vision-ready'&&this.candidates.has(e.source)&&!this.source){
   this.source=e.source;this.origin=e.origin;clearInterval(this.timer);clearTimeout(this.connectTimer);const resolve=this.resolveConnect;this.resolveConnect=null;this.rejectConnect=null;this.connecting=null;resolve?.();
  }
  if(m.type==='egress-vision-result'&&e.source===this.source&&e.origin===this.origin){
   const p=this.pending.get(m.requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.requestId);m.error?p.reject(Error(m.error)):p.resolve(m.result);
  }
 }
 request(request){
  if(!['status','recognizePlan'].includes(request?.action))return Promise.reject(Error('Unsupported recognition action.'));
  if(!this.connected)return Promise.reject(Error('Recognition is not connected yet. Please try again.'));
  return new Promise((resolve,reject)=>{
   const requestId=crypto.randomUUID(),timer=setTimeout(()=>{this.pending.delete(requestId);reject(Error('Recognition timed out. Your drawing is unchanged. Please try again.'));},request.action==='recognizePlan'?300000:30000);
   this.pending.set(requestId,{resolve,reject,timer});
   this.source.postMessage({type:'egress-vision-request',nonce:this.nonce,requestId,request:{action:request.action,image:request.image}},this.origin);
  });
 }
}
