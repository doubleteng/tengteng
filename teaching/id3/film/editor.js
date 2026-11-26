const ascii=s=>new TextEncoder().encode(s);
function integer(n,min=1){const out=[];do{out.unshift(n%256);n=Math.floor(n/256)}while(n||out.length<min);return Uint8Array.from(out)}
function vint(n){let width=1;while(n>=2**(7*width)-1)width++;const out=integer(n,width);out[0]|=1<<(8-width);return out}
function el(tag,...body){
 const data=new Blob(body);return new Blob([integer(tag),vint(data.size),data]);
}
const field=(id,n)=>el(id,integer(n));
function number64(x){const a=new DataView(new ArrayBuffer(8));a.setFloat64(0,x);return new Uint8Array(a.buffer)}
async function vp8(canvas){
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.89));
 if(!blob||blob.type!=='image/webp')throw Error('This browser cannot encode WebP video frames.');
 const data=new Uint8Array(await blob.arrayBuffer()),view=new DataView(data.buffer);
 for(let offset=12;offset+8<=data.length;){
  const size=view.getUint32(offset+4,true);
  if(String.fromCharCode(...data.subarray(offset,offset+4))==='VP8 '&&offset+8+size<=data.length)return data.slice(offset+8,offset+8+size);
  offset+=8+size+(size%2);
 }
 throw Error('This browser did not return a compatible video frame.');
}
function makeWebm(frames,w,h,fps){
 const header=el(0x1a45dfa3,field(0x4286,1),field(0x42f7,1),field(0x42f2,4),field(0x42f3,8),el(0x4282,ascii('webm')),field(0x4287,2),field(0x4285,2));
 const info=el(0x1549a966,field(0x2ad7b1,1000000),el(0x4d80,ascii('ID3')),el(0x5741,ascii('ID3')),el(0x4489,number64(frames.length*1000/fps)));
 const video=el(0xe0,field(0xb0,w),field(0xba,h));const track=el(0xae,field(0xd7,1),field(0x73c5,1),field(0x83,1),field(0x9c,0),el(0x86,ascii('V_VP8')),field(0x23e383,Math.round(1e9/fps)),video);
 const tracks=el(0x1654ae6b,track);const clusters=[],cues=[];
 let cursor=info.size+tracks.size;
 for(let i=0;i<frames.length;i+=fps){
  const time=Math.round(i*1000/fps),blocks=[];
  for(let k=i;k<Math.min(i+fps,frames.length);k++){const t=Math.round(k*1000/fps)-time;blocks.push(el(0xa3,Uint8Array.of(0x81,t>>8,t&255,0x80),frames[k]));}
  const cl=el(0x1f43b675,field(0xe7,time),...blocks);
  cues.push(el(0xbb,field(0xb3,time),el(0xb7,field(0xf7,1),field(0xf1,cursor))));clusters.push(cl);cursor+=cl.size;
 }
 return new Blob([header,el(0x18538067,info,tracks,...clusters,el(0x1c53bb6b,...cues))],{type:'video/webm'});
}

const $=id=>document.getElementById(id);
const say=text=>{$('notice').textContent=text};
function sample(keys,t,prop){
 let i=0;while(i<keys.length-2&&keys[i+1].at<t)i++;
 const a=keys[i],b=keys[i+1],before=keys[Math.max(0,i-1)],after=keys[Math.min(keys.length-1,i+2)];
 const h=b.at-a.at,u=(t-a.at)/h,v=u*u,w=v*u;
 const components=Array.isArray(a[prop])?a[prop].length:1;
 const part=(key,j)=>Array.isArray(key[prop])?key[prop][j]:key[prop];
 const out=[];
 for(let j=0;j<components;j++){
  const x=part(a,j),y=part(b,j),m=(y-part(before,j))*h/(b.at-before.at),n=(part(after,j)-x)*h/(after.at-a.at);
  out.push((2*w-3*v+1)*x+(w-2*v+u)*m+(-2*w+3*v)*y+(w-v)*n);
 }
 return components===1?Math.max(25,Math.min(95,out[0])):out;
}
function validatePath(data){
 if(data?.version!==1||data.project!=='ava-barbat'||!Array.isArray(data.shots)||data.shots.length<1||data.shots.length>32)throw Error();
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<10000);
 for(const s of data.shots){
  if(typeof s.name!=='string'||!s.name.length||s.name.length>100||!Number.isFinite(s.seconds)||s.seconds<.5||s.seconds>120||!Array.isArray(s.keys)||s.keys.length<2||s.keys.length>120||s.keys[0].at!==0||s.keys.at(-1).at!==1)throw Error();
  for(const [i,k] of s.keys.entries())if(!Number.isFinite(k.at)||(i&&k.at-s.keys[i-1].at<.00499999)||!vec(k.eye)||!vec(k.target)||!Number.isFinite(k.fov)||k.fov<25||k.fov>95||Math.hypot(...k.eye.map((x,j)=>x-k.target[j]))<.05)throw Error();
 }
}
export async function openEditor(director){
 const [T,{GLTFLoader},{OrbitControls},{makeRenderer}]=await Promise.all([
  import('../lib/three.module.min.js'),import('../lib/loaders/GLTFLoader.js'),
  import('../lib/controls/OrbitControls.js'),import('../software-view.js')]);
 const response=await fetch('../models/catalog.json');
 if(!response.ok)throw Error('The model catalog could not load.');
 const catalog=await response.json();
 const project=catalog.projects.find(p=>p.key==='ava-barbat');
 if(!project)throw Error('Ava’s proposal could not be found.');
 const modelURL=new URL(project.url,new URL('../',location.href));
 const draftKey='id3-film:v1:'+director+':'+modelURL.search;
 let shots=[];
 try {
  const stored=localStorage.getItem(draftKey);
  if(stored){const data=JSON.parse(stored);validatePath(data);shots=data.shots;}
 } catch {}
 const scene=new T.Scene();scene.background=new T.Color(0xe5e7df);
 const renderer=makeRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 $('stage').prepend(renderer.domElement);renderer.domElement.tabIndex=-1;
 renderer.setPixelRatio(Math.min(1.4,devicePixelRatio));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 if(renderer.isWebGLRenderer){renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;}
 const cam=new T.PerspectiveCamera(50,16/9,.05,1500),controls=new OrbitControls(cam,renderer.domElement);
 controls.enableDamping=false;controls.minDistance=.1;controls.maxDistance=450;
 const target=new T.Vector3(-43,2,25);
 const sun=new T.DirectionalLight(0xffedce,2.4);sun.target.position.copy(target);sun.position.copy(target).add(new T.Vector3(-70,82,76));sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-76,right:76,top:76,bottom:-76,near:.5,far:260});sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(1536,1536);sun.shadow.bias=-.00016;
 scene.add(sun,sun.target,new T.HemisphereLight(0xf5f8ff,0xb3a299,2));
 const envURL='../models/kerrytown-daylight.webp';
 if(renderer.isWebGLRenderer){const env=await new T.TextureLoader().loadAsync(envURL);env.colorSpace=T.SRGBColorSpace;env.mapping=T.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.72;}
 const foliage=new URL('../models/foliage-86e71ddf75.png',location.href).href;
 const manager=new T.LoadingManager();manager.setURLModifier(url=>url.endsWith('foliage-86e71ddf75.png')?foliage:url);
 const loader=new GLTFLoader(manager);
 for(const url of [modelURL,...['urban-core-materials.glb','urban-near.glb','urban-outer.glb'].map(n=>new URL('../models/'+n,location.href))]){
  const response=await fetch(url);if(!response.ok)throw Error('A model file could not load.');
  let geometry=await response.arrayBuffer();
  if(new Uint8Array(geometry,0,2)[0]===0x1f)geometry=await new Response(new Blob([geometry]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const model=await loader.parseAsync(geometry,new URL('.',url).href);
  model.scene.traverse(o=>{
   if(o.userData.initialHidden)o.visible=false;
   if(o.isMesh){o.receiveShadow=true;o.castShadow=!o.userData.noShadowCast&&!o.userData.groundSurface;
    if(o.geometry.attributes.color)o.userData.districtVertexColors=true;
   }
  });scene.add(model.scene);
 }
 const ground=new T.Mesh(new T.PlaneGeometry(1600,1600),new T.MeshStandardMaterial({color:0xd1d0bd,roughness:.95}));ground.position.y=-13.65;ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 let sid=0,local=0,playing=false,originTime=0,frame=0,pending=false,internal=false;
 function keep(){
  try{localStorage.setItem(draftKey,JSON.stringify({version:1,project:'ava-barbat',shots}))}
  catch{say('Storage is unavailable on this device. Download the camera path to keep your changes.')}
 }
 let shot=()=>shots[sid],total=()=>shots.reduce((s,k)=>s+k.seconds,0),baseTime=()=>shots.slice(0,sid).reduce((a,s)=>a+s.seconds,0);
 let exporting=false,cancelExport=false,lastVideo=null;
 function render(){
  if(!exporting&&!pending){pending=true;requestAnimationFrame(()=>{pending=false;if(!exporting)renderer.render(scene,cam)})}
 }
 function resize(){if(exporting)return;renderer.setSize(Math.max(10,$('stage').clientWidth),Math.max(10,$('stage').clientHeight));cam.aspect=$('stage').clientWidth/Math.max(1,$('stage').clientHeight);cam.updateProjectionMatrix();render()}
 new ResizeObserver(resize).observe($('stage'));resize();
 function pause(){playing=false;controls.enabled=true;cancelAnimationFrame(frame);$('play').textContent='Play sequence';}
 function labels(){
  const s=shot();$('lens').value=cam.fov;$('angle').textContent=Math.round(cam.fov)+'°';$('scrub').value=Math.round(local*1000);
  $('stamp').textContent=(baseTime()+local*s.seconds).toFixed(2)+' / '+total().toFixed(2)+' s';
  const idx=s.keys.findIndex(k=>Math.abs(k.at-local)<=.004);
  $('store').textContent=idx<0?'Add keyframe':'Update keyframe';
  $('remove').disabled=idx<=0||idx===s.keys.length-1;
  for(const [j,b] of Array.from($('marks').children).entries())b.classList.toggle('active',j===idx);
 }
 function pose(){const keys=shot().keys;internal=true;cam.position.fromArray(sample(keys,local,'eye'));controls.target.fromArray(sample(keys,local,'target'));cam.fov=sample(keys,local,'fov');cam.updateProjectionMatrix();controls.update();internal=false;labels();render()}
 function marks(){
  const s=shot();$('marks').replaceChildren();
  for(const [i,k] of s.keys.entries()){const b=document.createElement('button');b.style.left=k.at*100+'%';b.title='Keyframe '+(i+1)+' · '+(k.at*s.seconds).toFixed(2)+' s';b.setAttribute('aria-label',b.title);b.onclick=()=>{pause();local=k.at;pose();say('')};$('marks').append(b)}
 }
 function changeShot(id,t=0){
  sid=id;local=t;
  for(const [i,b] of Array.from($('shots').children).entries())b.setAttribute('aria-current',String(i===sid));
  $('shotname').textContent=shot().name;$('duration').value=shot().seconds;marks();pose();
 }
 function shotButtons(){
  const hasShots=shots.length>0;
  $('timeline').hidden=!hasShots;
  $('shot-settings').hidden=!hasShots;
  $('save').disabled=$('export').disabled=!hasShots;
  $('new-shot').disabled=shots.length>=32;
  $('shots').replaceChildren();for(const [i,s] of shots.entries()){
  const b=document.createElement('button'),num=document.createElement('b'),txt=document.createElement('span');num.textContent=String(i+1).padStart(2,'0');txt.textContent=s.name;b.append(num,txt);b.onclick=()=>{pause();changeShot(i);say('')};$('shots').append(b)}}
 $('new-shot').onclick=()=>{
  if(exporting||shots.length>=32)return;
  pause();
  const keys=[0,1].map(at=>({at,eye:cam.position.toArray(),target:controls.target.toArray(),fov:cam.fov}));
  shots.push({name:'Shot '+(shots.length+1),seconds:4,keys});
  shotButtons();changeShot(shots.length-1);keep();
  say('Move the time slider, frame a view and save a keyframe.');
 };
 function seek(seconds){let rest=seconds,id=0;while(id<shots.length-1&&rest>=shots[id].seconds){rest-=shots[id].seconds;id++}const t=Math.min(1,rest/shots[id].seconds);
  if(sid!==id)changeShot(id,t);else{local=t;pose()}}
 function tick(now){if(!playing)return;const sec=(now-originTime)/1000;renderer.noteMotion?.();if(sec>=total()){seek(total());pause();return}seek(sec);frame=requestAnimationFrame(tick)}
 $('play').onclick=()=>{if(playing){pause();return}let sec=baseTime()+local*shot().seconds;if(sec>=total()-.02)sec=0;playing=true;controls.enabled=false;$('play').textContent='Pause';say('');originTime=performance.now()-sec*1000;frame=requestAnimationFrame(tick)};
 $('scrub').oninput=()=>{pause();local=+$('scrub').value/1000;renderer.noteMotion?.();pose();say('')};
 $('lens').oninput=()=>{pause();cam.fov=+$('lens').value;cam.updateProjectionMatrix();labels();render();say('Use Add or Update keyframe to keep this view.')};
 $('duration').oninput=()=>{const v=$('duration').valueAsNumber;if(Number.isFinite(v)&&v>=.5&&v<=120){pause();shot().seconds=v;marks();labels()}};
 $('duration').onchange=()=>{pause();let val=Number($('duration').value);if(!Number.isFinite(val)||val<.5||val>120){$('duration').value=shot().seconds;say('Choose a shot length from 0.5 to 120 seconds.');return}shot().seconds=val;marks();labels();say('Shot length updated.');keep()};
 controls.addEventListener('start',()=>{pause();$('stage').focus({preventScroll:true})});
 controls.addEventListener('change',()=>{if(!internal){renderer.noteMotion?.();render();say('Use Add or Update keyframe to keep this view.')}});
 $('stage').addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(exporting||playing||!['w','a','s','d','q','e'].includes(k))return;e.preventDefault();
  const forward=cam.getWorldDirection(new T.Vector3());forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
  const right=forward.clone().cross(cam.up).normalize(),dy=new T.Vector3(0,1,0);
  const delta=(k==='q'||k==='e'?dy:k==='w'||k==='s'?forward:right).multiplyScalar((e.shiftKey?1.2:.3)*(['q','s','a'].includes(k)?-1:1));cam.position.add(delta);controls.target.add(delta);controls.update()
 });
 $('store').onclick=()=>{pause();const keys=shot().keys,i=keys.findIndex(k=>Math.abs(k.at-local)<=.004);if(i<0&&keys.length>=120){say('This shot has reached 120 keyframes.');return}
  const k={at:i<0?local:keys[i].at,eye:cam.position.toArray(),target:controls.target.toArray(),fov:cam.fov};
  if(i<0)keys.push(k);else keys[i]=k;keys.sort((a,b)=>a.at-b.at);local=k.at;marks();labels();say('Camera keyframe saved.');keep()};
 $('remove').onclick=()=>{pause();const keys=shot().keys,i=keys.findIndex(k=>Math.abs(k.at-local)<=.004);
  if(i>0&&i<keys.length-1){keys.splice(i,1);marks();pose();say('Interior keyframe removed.');keep()}};
 $('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,project:'ava-barbat',shots},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=director+' - Ava camera path.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);say('Camera path exported.')};
 $('open').onclick=()=>$('pathfile').click();
 $('pathfile').onchange=async()=>{const f=$('pathfile').files[0];if(!f)return;try{if(f.size>2e6)throw Error();const data=JSON.parse(await f.text());validatePath(data);pause();shots=data.shots;shotButtons();changeShot(0);say('Camera path loaded.');keep()}catch{say('Choose a camera path saved for Ava’s model.')}finally{$('pathfile').value=''}};

 $('cancel').onclick=()=>{cancelExport=true;say('Stopping the preview export…')};
 $('export').onclick=async()=>{
  if(exporting)return;
  pause();
  const oldShot=sid,oldTime=local,oldEye=cam.position.clone(),oldTarget=controls.target.clone(),oldFov=cam.fov;
  const fps=24,width=1280,height=720;
  const counts=shots.map(s=>Math.max(2,Math.round(s.seconds*fps))),count=counts.reduce((a,b)=>a+b,0);
  if(count>1440){say('Keep this trial export within one minute by shortening the shots.');return}
  exporting=true;cancelExport=false;controls.enabled=false;$('cancel').hidden=false;
  for(const id of ['settings','timeline','files'])$(id).inert=true;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  let message='';
  try{
   if(renderer.wait)await renderer.wait();
   clearTimeout(renderer.settleTimer);renderer.settleTimer=0;
   if(renderer.isWebGLRenderer){renderer.setPixelRatio(1);renderer.setSize(1920,1080,false)}
   else{renderer.width=width;renderer.height=height}
   cam.aspect=width/height;
   const frames=[];let encodedBytes=0;
   for(let j=0;j<shots.length;j++){
    const s=shots[j];
    for(let k=0;k<counts[j];k++){
     if(cancelExport)throw Error('Preview export canceled.');
     local=k/(counts[j]-1);cam.position.fromArray(sample(s.keys,local,'eye'));
     cam.lookAt(...sample(s.keys,local,'target'));cam.fov=sample(s.keys,local,'fov');cam.updateProjectionMatrix();
     if(renderer.isWebGLRenderer){
      renderer.render(scene,cam);ctx.drawImage(renderer.domElement,0,0,width,height);
     }else{
      renderer.render(scene,cam);await renderer.wait();ctx.drawImage(renderer.domElement,0,0,width,height);
     }
     const data=await vp8(canvas);frames.push(data);encodedBytes+=data.byteLength;
     if(encodedBytes>180*1024*1024)throw Error('This preview is too large. Shorten its shots and export again.');
     if(k===0||k%3===0)say('Rendering '+s.name+' · '+frames.length+' / '+count+' frames');
    }
   }
   const movie=makeWebm(frames,width,height,fps);if(lastVideo)URL.revokeObjectURL(lastVideo);
   lastVideo=URL.createObjectURL(movie);$('movie').src=lastVideo;$('movie').hidden=false;$('getvideo').href=lastVideo;$('getvideo').hidden=false;
   message='Preview ready · 1280 × 720 · 24 fps · '+(count/fps).toFixed(2)+' s';
  }catch(e){message=e.message||'The preview could not be exported.'}
  finally{
   exporting=false;controls.enabled=true;renderer.setPixelRatio(Math.min(1.4,devicePixelRatio));resize();
   for(const id of ['settings','timeline','files'])$(id).inert=false;$('cancel').hidden=true;
   changeShot(oldShot,oldTime);internal=true;cam.position.copy(oldEye);controls.target.copy(oldTarget);cam.fov=oldFov;cam.updateProjectionMatrix();controls.update();internal=false;labels();render();say(message);
  }
 };
 shotButtons();
 if(shots.length)changeShot(0);
 else {
  cam.position.set(20,49,84);
  controls.target.set(-43,6,24);
  internal=true;controls.update();internal=false;render();
  say('Frame your first view and choose Add shot.');
 }
 $('status').hidden=true;for(const id of ['settings','timeline','files'])$(id).inert=false;
}
