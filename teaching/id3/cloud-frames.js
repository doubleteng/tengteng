// HTTPS-compatible cloud display. Request the next frame only when the previous
// frame has decoded. Model geometry and rendering stay in the virtual computer.
export class CloudFrames{
 constructor(host,send,onFirst){
  this.send=send;this.onFirst=onFirst;this.keys=new Set();
  this.image=document.createElement('img');this.image.alt='Ava’s live cloud model';this.image.tabIndex=0;this.image.draggable=false;host.replaceChildren(this.image);
  const signal=(this.events=new AbortController()).signal;
  const on=(name,fn)=>this.image.addEventListener(name,fn,{signal});
  const point=e=>{
   const r=this.image.getBoundingClientRect(),s=Math.min(r.width/1280,r.height/720);
   return [(e.clientX-r.left-(r.width-1280*s)/2)/s,(e.clientY-r.top-(r.height-720*s)/2)/s];
  };
  const fingers=new Map();
  on('contextmenu',e=>e.preventDefault());
  on('pointerdown',e=>{e.preventDefault();this.image.focus({preventScroll:true});this.image.setPointerCapture(e.pointerId);
   fingers.set(e.pointerId,{p:point(e),start:point(e),pan:e.button===2,at:performance.now()});
  });
  on('pointermove',e=>{
   const hit=fingers.get(e.pointerId);if(!hit)return;
   const p=point(e),last=hit.p;hit.p=p;
   if(fingers.size===2){
    const other=[...fingers.values()].find(x=>x!==hit).p,dist=q=>Math.hypot(q[0]-other[0],q[1]-other[1]);
    if(dist(last)>4)send('zoom',Math.max(.7,Math.min(1.4,dist(p)/dist(last))));
   }else send('drag',p[0]-last[0],p[1]-last[1],hit.pan);
  });
  on('pointerup',e=>{
   const hit=fingers.get(e.pointerId);fingers.delete(e.pointerId);if(!hit||e.button!==0)return;
   const p=point(e),now=performance.now();
   if(now-hit.at<350 && Math.hypot(p[0]-hit.start[0],p[1]-hit.start[1])<8){
    if(this.tap&&now-this.tap.at<420&&Math.hypot(p[0]-this.tap.p[0],p[1]-this.tap.p[1])<20){send('enter',...p);this.tap=null;}
    else this.tap={p,at:now};
   }
  });
  on('pointercancel',e=>fingers.delete(e.pointerId));
  on('wheel',e=>{e.preventDefault();send('zoom',Math.exp(-Math.sign(e.deltaY)*.13));});
  const codes=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','Space','KeyF','Escape']);
  on('keydown',e=>{if(codes.has(e.code)){e.preventDefault();if(!e.repeat){send('walkKey',e.code,true);this.keys.add(e.code);}}});
  on('keyup',e=>{if(this.keys.delete(e.code)){e.preventDefault();send('walkKey',e.code,false);}});
  on('blur',()=>{for(const k of this.keys)send('walkKey',k,false);this.keys.clear();});
  this.ask(0);
 }
 ask(ms){if(!this.closed){clearTimeout(this.timer);this.timer=setTimeout(()=>this.send('frame'),ms);}}
 async receive(bytes){
  if(this.closed)return;
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));const img=new Image();img.src=url;
  try{await img.decode();if(this.closed){URL.revokeObjectURL(url);return;}
   const old=this.url;this.image.src=this.url=url;if(old)URL.revokeObjectURL(old);
   if(this.onFirst){this.onFirst();this.onFirst=null;}this.ask(75);
  }catch{URL.revokeObjectURL(url);this.ask(250);}
 }
 close(){this.closed=true;this.events.abort();clearTimeout(this.timer);if(this.url)URL.revokeObjectURL(this.url);this.image.remove();}
}
