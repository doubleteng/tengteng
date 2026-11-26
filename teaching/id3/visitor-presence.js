import {Frustum, Matrix4, Sphere, Vector3} from './lib/three.module.min.js';

const service='wss://id3-ava-walk.teng-portfolio-11e715bd5693.workers.dev/visitors/v1/';
const actions=[null,'vault','climb','wall'];
const tau=2*Math.PI;
const round=x=>Math.round(x*1000)/1000;
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const phase=x=>((x%tau)+tau)%tau;
const mix=(a,b,f)=>a+(b-a)*f;
const same=(a,b)=>a&&a.length===b.length&&a.every((x,i)=>x===b[i]);

class LocalPose {
  constructor(){this.last=new Vector3();this.phase=0;}
  read(mode,now){
    const walker=mode.walker,street=mode.street;
    const root=street?.avatar.root.position??walker.feet;
    const dt=this.time==null?0:(now-this.time)/1000;
    const distance=dt>0&&dt<.5?Math.hypot(walker.feet.x-this.last.x,walker.feet.z-this.last.z):0;
    const speed=dt>0&&walker.grounded?Math.min(7,distance/dt):0;
    this.last.copy(walker.feet);this.time=now;
    if(walker.grounded)this.phase=phase(this.phase+distance*tau/(1.52+1.06*Math.min(1,Math.max(0,(speed-2.2)/2.6))));
    const pose=street?.poseState;
    const packet=[root.x,root.y,root.z,angle(street?.rotation??walker.yaw),walker.pitch,
      phase(pose?.gait??this.phase),pose?.speed??speed,walker.grounded?1:0,walker.verticalSpeed,
      Math.max(0,actions.indexOf(pose?.action)),pose?.progress??0,pose?.turn??0,pose?.impact??0];
    if(pose?.grip||pose?.palms){
      packet.push(...(pose.grip?.toArray()??[0,0,0]));
      if(pose.palms)for(const hand of pose.palms)packet.push(...hand.toArray());
    }
    return packet.map(round);
  }
}

// Interpolate the sender's sampled route including its vertical coordinate.
// Hold the last confirmed pose on a delayed packet rather than guessing a path.
export function samplePose(frames,t){
  while(frames.length>1&&frames[1].t<=t)frames.shift();
  const first=frames[0],next=frames[1];
  if(!next||t<=first.t)return first.pose;
  const f=(t-first.t)/Math.max(1,next.t-first.t),a=first.pose,b=next.pose;
  const base=f<.5?a:b;
  return base.map((n,i)=>{
    if(i===7||i===9)return n;
    if((i===10||i>=13)&&(a[9]!==b[9]||i>=Math.min(a.length,b.length)))return n;
    if(i===3||i===5)return a[i]+angle(b[i]-a[i])*f;
    return mix(a[i],b[i],f);
  });
}

export class VisitorPresence {
  constructor(mode,key){
    this.mode=mode;this.v=mode.v;this.key=key;this.peers=new Map();
    this.local=new LocalPose();this.retry=600;
    this.status=mode.area.querySelector('#walk-visitors');
    this.frustum=new Frustum();this.clip=new Matrix4();this.bounds=new Sphere(new Vector3(),1.35);
    this.grip=new Vector3();this.palms=[new Vector3(),new Vector3()];
  }
  label(text){if(this.status&&this.status.textContent!==text)this.status.textContent=text;}
  counts(){
    const n=this.peers.size;
    this.label(n?(n===1?'1 other visitor':n+' other visitors'):'Walking alone');
  }
  start(){
    this.active=true;
    this.onHide=()=>this.stop();
    window.addEventListener('pagehide',this.onHide);
    this.connect();this.pulse();
  }
  connect(){
    if(!this.active)return;
    this.label(this.retry>600?'Reconnecting visitors…':'Connecting visitors…');
    let ws;
    try{ws=new WebSocket(service+encodeURIComponent(this.key)+'?look='+this.v.visitorLook);}
    catch{this.reconnect();return;}
    this.ws=ws;this.ready=false;this.lastReply=this.lastPing=performance.now();
    ws.onmessage=e=>{
      if(!this.active||ws!==this.ws)return;
      let msg;try{msg=JSON.parse(e.data);}catch{return;}
      this.lastReply=performance.now();
      const [type,id,value,others]=msg;
      if(type==='ready'){
        this.ready=true;this.retry=600;this.id=id;
        if(this.v.visitorLook!==value){this.v.visitorLook=value;this.mode.street?.setAppearance(value);this.v.draw();}
        for(const peer of others)this.add(peer.id,peer.look);
        this.counts();this.sendPose(this.lastReply,true);
      }else if(type==='join'){
        this.add(id,value);this.counts();this.sendPose(this.lastReply,true);
      }else if(type==='pose'){
        const peer=this.peers.get(id);if(!peer)return;
        this.receive(peer,value,this.lastReply);
      }else if(type==='out'){
        this.remove(id);this.counts();
      }
    };
    ws.onclose=()=>{
      if(!this.active||ws!==this.ws)return;
      this.ws=null;this.ready=false;this.clearPeers();this.reconnect();
    };
    ws.onerror=()=>{}; // close schedules a bounded retry while the visitor continues walking.
  }
  reconnect(){
    this.label('Reconnecting visitors…');
    this.retryTimer=setTimeout(()=>this.connect(),this.retry+Math.random()*220);
    this.retry=Math.min(this.retry*2,12000);
  }
  add(id,look){
    if(id===this.id||this.peers.has(id))return;
    this.peers.set(id,{look,frames:[],seen:performance.now()});
  }
  receive(peer,pose,now){
    const frames=peer.frames,prev=frames.at(-1);peer.seen=now;
    if(prev&&same(prev.pose,pose))return;
    if(prev&&now-prev.t>250){frames.length=0;frames.push({t:now-85,pose:prev.pose});}
    frames.push({t:now,pose});if(frames.length>8)frames.shift();
  }
  sendPose(now,force=false){
    if(!this.ready||!this.peers.size||this.ws?.readyState!==1||this.ws.bufferedAmount>8192)return;
    if(force)this.snapshotDue=true;
    if(now-(this.sentAt??-Infinity)<50||(!this.snapshotDue&&now-(this.lastSample??-Infinity)<80))return;
    const p=this.local.read(this.mode,now);this.lastSample=now;
    if(this.snapshotDue||!same(this.sent,p)||now-(this.sentAt??0)>3500){
      this.snapshotDue=false;
      this.ws.send(JSON.stringify(p));this.sent=p;this.sentAt=now;
    }
  }
  remove(id){
    const peer=this.peers.get(id);
    if(peer?.avatar){peer.avatar.dispose();this.v.draw();}
    this.peers.delete(id);
  }
  clearPeers(){for(const id of this.peers.keys())this.remove(id);}
  loadAvatar(){
    if(!this.module&&!this.loading){
      this.loading=import('./street-avatar.js?v=b503d6f30d').then(m=>{this.module=m;}).catch(()=>{}).finally(()=>{this.loading=null;});
    }
  }
  present(now){
    if(!this.peers.size)return false;
    const cam=this.v.camera;
    cam.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.clip.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    let changed=false;
    for(const peer of this.peers.values()){
      if(!peer.frames.length)continue;
      const p=samplePose(peer.frames,now-110);
      this.bounds.center.set(p[0],p[1]+.88,p[2]);
      const visible=this.frustum.intersectsSphere(this.bounds)&&now-peer.seen<14000;
      if(!visible){
        if(peer.avatar?.root.visible){peer.avatar.root.visible=false;changed=true;}
        continue;
      }
      if(!peer.avatar){
        if(!this.module){this.loadAvatar();continue;}
        peer.avatar=this.module.createStreetAvatar(peer.look);
        peer.avatar.root.traverse(o=>{o.userData.streetActivity=true;o.castShadow=false;});
        peer.avatar.root.name='Visiting explorer';
        this.v.scene.add(peer.avatar.root);this.v.draw();
      }
      const avatar=peer.avatar,appearing=!avatar.root.visible;
      avatar.root.visible=true;
      if(!appearing&&same(peer.drawn,p))continue;
      avatar.root.position.set(p[0],p[1],p[2]);avatar.root.rotation.y=-p[3];
      const distance=cam.position.distanceToSquared(avatar.root.position);
      if(appearing||!peer.drawn||now-(peer.posedAt||0)>=(distance>900?130:45)||peer.frames.length===1){
        avatar.pose({gait:p[5],speed:p[6],grounded:!!p[7],verticalSpeed:p[8],look:p[4],action:actions[p[9]],
          progress:p[10],turn:p[11],impact:p[12],time:now/1000,
          grip:p.length>=16&&p[9]!==3?this.grip.fromArray(p,13):null,
          palms:p.length===22?[this.palms[0].fromArray(p,16),this.palms[1].fromArray(p,19)]:null});
        peer.posedAt=now;
      }
      peer.drawn=p;changed=true;
    }
    return changed;
  }
  pulse(){
    if(!this.active)return;
    const now=performance.now();
    if(this.ws&&now-this.lastReply>16000&&this.ws.readyState<2)this.ws.close();
    if(this.ready&&this.ws?.readyState===1){
      if(now-this.lastPing>3000){this.ws.send('ping');this.lastPing=now;}
      this.sendPose(now);
    }
    if(this.present(now)){
      if(this.v.renderer.renderActivity){
        if(!this.v.frame&&!this.v.renderer.renderActivity(this.v.scene,this.v.camera))this.v.draw();
      }else if(!this.v.frame&&now-(this.v.lastFullDraw||0)>22)this.v.renderer.render(this.v.scene,this.v.camera);
      else this.v.draw();
    }
    this.timer=setTimeout(()=>this.pulse(),this.peers.size?40:200);
  }
  stop(){
    if(!this.active)return;
    this.active=false;clearTimeout(this.timer);clearTimeout(this.retryTimer);
    window.removeEventListener('pagehide',this.onHide);
    if(this.ws){
      if(this.ws.readyState===1)this.ws.send('bye');
      this.ws.close();this.ws=null;
    }
    this.clearPeers();this.ready=false;this.label('');
  }
}
