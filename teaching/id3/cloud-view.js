import {channel,service} from './cloud-channel.js';
const $=id=>document.getElementById(id);
let availableUntil=0,available=false;
export async function cloudAvailable(){
 if(Date.now()<availableUntil)return available;
 try{const r=await fetch(service+'/health',{signal:AbortSignal.timeout(2200)});available=r.ok&&(await r.json()).configured===true;}catch{available=false;}
 availableUntil=Date.now()+(available?60000:5000);return available;
}
function terminate(s){if(s)fetch(service+'/rooms/'+s.id,{method:'DELETE',headers:{Authorization:'Bearer '+s.key},keepalive:true}).catch(()=>{});}
export class CloudView{
 constructor(useBrowser){
  this.useBrowser=useBrowser;this.hidden=new Set();this.hiddenCity=new Set();this.paths=new Map();this.cityPaths=[];
  this.host={clientWidth:1280,clientHeight:720};this.camera={updateMatrixWorld(){},projectionMatrix:{elements:[]},matrixWorldInverse:{elements:[]}};
  this.renderer={};this.mode='material';this.walkMode={active:false,exit:()=>this.command('exit')};
  this.offPage=()=>this.dispose();window.addEventListener('pagehide',this.offPage,{once:true});
 }
 show(model,city){
  this.cityURL=city;this.model=model;
  $('cloud-shell').hidden=false;$('cloud-stage').style.backgroundImage='url("'+new URL(model.cover,location.href).href+'")';
  $('canvas-box').style.visibility='hidden';$('annotation-map').setAttribute('viewBox','0 0 1280 720');
  $('cloud-local').onclick=this.useBrowser;$('cloud-start').onclick=()=>this.connect();
  this.prompt('','Start cloud walkthrough');return new Promise(resolve=>{this.loaded=resolve;});
 }
 prompt(message,label){
  $('cloud-prompt').hidden=false;$('cloud-note').textContent=message;$('cloud-start').textContent=label;$('cloud-start').disabled=false;
 }
 async connect(){
  if(this.pending||this.disposed)return;
  this.pending=true;this.project=null;$('cloud-start').disabled=true;$('cloud-note').textContent='Connecting to Ava’s model…';
  const generation=(this.generation||0)+1;this.generation=generation;
  const invalid=()=>this.disposed||generation!==this.generation;
  const stop=message=>{if(invalid())return;this.reset();this.prompt(message,'Retry cloud walkthrough');};
  try{
   const {default:Hyperbeam}=await import('https://cdn.jsdelivr.net/npm/@hyperbeam/web@0.0.38/dist/index.js');
   if(invalid())return;
   const r=await fetch(service+'/sessions',{method:'POST',signal:AbortSignal.timeout(60000)});
   const s=await r.json();if(!r.ok)throw Error(s.error||'The cloud walkthrough is unavailable.');
   if(invalid()){terminate(s);return;}
   this.session=s;const frame=$('cloud-video');
   const link=this.link=channel(s.id,s.key,m=>{
    if(invalid())return;
    if(m.type==='peer'){link.send({type:'hello'});return;}
    if(m.type==='error'){stop('The cloud computer could not load the model.');return;}
    if(m.type==='ready'&&!this.modelReady){
     this.paths=new Map(m.paths.map(path=>[path,true]));this.cityPaths=m.cityPaths;this.hidden=new Set(m.hidden);this.hiddenCity=new Set(m.hiddenCity);
     for(const key of ['cityVisible','contextEdges','buildingColors','mode','lens'])this[key]=m[key];
     this.modelReady=true;this.reveal();return;
    }
    if(m.type==='pose' && Array.isArray(m.p)&&m.p.length===2){
     this.camera.projectionMatrix.elements=m.p[0];this.camera.matrixWorldInverse.elements=m.p[1];this.draw();return;
    }
    if(m.type==='walking'){
     this.walkMode.active=!!m.value;
     if(m.value)$('viewport').dataset.walking=m.value;else delete $('viewport').dataset.walking;
     $('walk-hud').hidden=!m.value;$('walk-help').hidden=!!m.value;$('walk-door-hint').textContent=m.hint;$('walk-door-hint').hidden=!m.hint;
    }
    if(m.type==='lens'){this.lens=m.value;this.onLens?.();}
   },()=>stop('Your cloud session ended. You can start a new one.'));
   this.connectTimer=setTimeout(()=>stop('The cloud model took too long to open.'),85000);
   this.hello=setInterval(()=>link.send({type:'hello'}),1200);
   const hb=await Hyperbeam(frame,s.stream,{timeout:65000,webhookUserdata:{ticket:s.key},delegateKeyboard:true,onDisconnect:()=>stop('The video connection has ended.')});
   if(invalid()){hb.destroy();return;}
   this.player=hb;this.reveal();
  }catch(e){stop(e.message?.startsWith('The ')||e.message?.startsWith('All six')?e.message:'The cloud walkthrough could not connect.');}
 }
 reveal(){
  if(!this.modelReady||!this.player||this.project)return;
  clearTimeout(this.connectTimer);clearInterval(this.hello);this.project=true;
  $('cloud-prompt').hidden=true;$('cloud-note').textContent='';this.loaded({cityError:false});this.onReady?.();
 }
 reset(){
  this.generation=(this.generation||0)+1;this.project=null;this.pending=false;this.modelReady=false;this.camera.projectionMatrix.elements=[];
  clearTimeout(this.connectTimer);clearInterval(this.hello);clearTimeout(this.sunTimer);
  this.link?.close();this.link=null;this.player?.destroy();this.player=null;
  terminate(this.session);this.session=null;$('cloud-video').replaceChildren();delete $('viewport').dataset.walking;
  $('walk-hud').hidden=true;$('walk-help').hidden=false;this.walkMode.active=false;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.reset();this.loaded?.(null);
  window.removeEventListener('pagehide',this.offPage);$('cloud-shell').hidden=true;
  $('canvas-box').style.visibility='';$('annotation-map').removeAttribute('viewBox');
 }
 command(name,...args){this.link?.send({type:'control',name,args});}
 activate(){this.command('annotations',!!this.annotations?.enabled.size);}
 draw(){if(this.camera.projectionMatrix.elements.length===16)this.annotations?.draw(this.camera,1280,720);}
 setPaths(paths,on){for(const p of paths)if(on)this.hidden.delete(p);else this.hidden.add(p);this.applyModes();}
 applyModes(){this.command('layers',[...this.hidden],[...this.hiddenCity]);}
 setCity(on){this.cityVisible=on;this.command('city',on);}
 setContextEdges(on){this.contextEdges=on;this.command('edges',on);}
 setBuildingColors(on){this.buildingColors=on;this.command('colors',on);}
 setMode(value){this.mode=value;this.command('mode',value);}
 view(value){this.command('camera',value);}
 orbit(x,y){this.command('orbit',x,y);}
 changeZoom(n){this.command('zoom',n);}
 getDollyZoom(){return this.lens;}
 setDollyZoom(n){this.lens=n;this.command('lens',n);}
 setSun(...a){this.sunArgs=a;if(!this.sunTimer)this.sunTimer=setTimeout(()=>{this.sunTimer=0;this.command('sun',...this.sunArgs);},50);}
 setShadowTones(l,d){this.command('tones',l,d);}
 setShadowReceivers(f,g){this.command('receivers',f,g);}
 setShadows(s){this.command('shadows',s);}
}
