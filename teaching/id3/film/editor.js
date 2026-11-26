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
 if(t<=keys[0].at)return keys[0][prop];
 if(t>=keys.at(-1).at)return keys.at(-1)[prop];
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
const legacyDemoNames = new Set([
 'Kerrytown to the market', 'Across the central terrace', 'Inside the shared center'
]);
const duration = shot => shot?.keys.at(-1)?.at ?? 0;
import {projectKey, renderControls} from './cloud-film.js?v=1';
const sequenceData = shots => ({version: 2, project: projectKey, timeUnit: 'seconds', shots});

function readShots(data, cleanOldDraft = false) {
 const legacy = data?.version === 1;
 if ((!legacy && (data?.version !== 2 || data.timeUnit !== 'seconds')) ||
     data.project !== projectKey || !Array.isArray(data.shots) || data.shots.length > 32) {
  throw Error('Unrecognized camera sequence.');
 }
 const result = [];
 const vec = v => Array.isArray(v) && v.length === 3 && v.every(x => Number.isFinite(x) && Math.abs(x) < 10000);
 for (const s of data.shots) {
  if (legacy && cleanOldDraft && legacyDemoNames.has(s.name)) continue;
  if (typeof s.name !== 'string' || !s.name.length || s.name.length > 100 ||
      !Array.isArray(s.keys) || s.keys.length > 120) throw Error('Invalid shot.');
  if (legacy && (!Number.isFinite(s.seconds) || s.seconds <= 0 || s.seconds > 120 ||
      s.keys.length < 2 || s.keys.at(-1).at !== 1)) throw Error('Invalid shot duration.');
  const keys = s.keys.map((k, i) => {
   if (!Number.isFinite(k.at) || k.at < 0 || k.at > (legacy ? 1 : 120) ||
       (i === 0 ? k.at !== 0 : k.at <= s.keys[i-1].at) ||
       !vec(k.eye) || !vec(k.target) || !Number.isFinite(k.fov) || k.fov < 25 || k.fov > 95 ||
       Math.hypot(...k.eye.map((x,j) => x-k.target[j])) < .05) throw Error('Invalid keyframe.');
   return {at: legacy ? k.at*s.seconds : k.at, eye:k.eye, target:k.target, fov:k.fov};
  });
  // The previous Add shot command cloned its starting pose at exactly four seconds.
  if(legacy && cleanOldDraft && /^Shot [0-9]+$/.test(s.name) && s.seconds===4 && keys.length===2){
   const [first,last]=keys;
   if(first.fov===last.fov && first.eye.every((v,i)=>v===last.eye[i]) &&
      first.target.every((v,i)=>v===last.target[i]))keys.pop();
  }
  result.push({name:s.name, keys});
 }
 return result;
}

// Completed camera paths keep the normalized format accepted by the offline renderer.
// An unfinished shot is a valid editable draft, including a shot without keyframes.
function downloadData(shots) {
 if (!shots.length || shots.some(s => duration(s) === 0)) return sequenceData(shots);
 return {version:1, project:projectKey, shots:shots.map(s => ({
  name:s.name, seconds:duration(s), keys:s.keys.map(k => ({...k, at:k.at/duration(s)}))
 }))};
}
export async function openEditor(director,project,review=null){
 const cloud=review?.readOnly ? null : renderControls(project,director);
 const [T,{GLTFLoader},{OrbitControls},{makeRenderer}]=await Promise.all([
  import('../lib/three.module.min.js'),import('../lib/loaders/GLTFLoader.js'),
  import('../lib/controls/OrbitControls.js'),import('../software-view.js')]);
 const {siteCenter}=await import('../site-model.js');
 const modelURL=new URL(project.url,new URL('../',location.href));
 const suffix=(projectKey==='ava-barbat'?'':projectKey+':')+director+':'+modelURL.search;
 const draftKey='id3-film:v2:'+suffix+(review ? ':common-center' : '');
 let shots=review ? readShots(review.path) : [];
 try {
  const current=review?.readOnly ? null : localStorage.getItem(draftKey);
  if(current!==null)shots=readShots(JSON.parse(current));
  else if (!review) {
   const legacy=localStorage.getItem('id3-film:v1:'+suffix);
   if(legacy!==null){
    shots=readShots(JSON.parse(legacy),true);
    localStorage.setItem(draftKey,JSON.stringify(sequenceData(shots)));
   }
  }
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
 const lighting=review?.path?.previewLighting;
 const fixtures=(lighting?.areaLights || []).map(f=>({...f,point:new T.Vector3(...f.position)}));
 const fillLights=[];
 const lastLightPosition=new T.Vector3(Infinity,Infinity,Infinity);
 if(lighting){
  sun.position.copy(target).addScaledVector(new T.Vector3(...lighting.sunDirection).normalize(),-125);
  scene.add(sun.target);
  if(renderer.isWebGLRenderer)for(let i=0;i<2;i++){
   const light=new T.PointLight(new T.Color(...lighting.lightColorLinear),0,10);
   scene.add(light);fillLights.push(light);
  }
 }
 function placeRoomLights(){
  if(!fillLights.length || cam.position.distanceToSquared(lastLightPosition)<.25)return;
  lastLightPosition.copy(cam.position);
  const nearest=fixtures.map(f=>({f,dist:f.point.distanceToSquared(cam.position)}))
    .filter(r=>r.dist<225).sort((a,b)=>a.dist-b.dist);
  fillLights.forEach((light,i)=>{
   const f=nearest[i]?.f;
   light.intensity=f ? f.powerWatts*.026 : 0;
   if(f){light.position.copy(f.point);light.distance=Math.max(5,f.diameterMeters*2);}
  });
 }
 const envURL='../models/kerrytown-daylight.webp';
 if(renderer.isWebGLRenderer){const env=await new T.TextureLoader().loadAsync(envURL);env.colorSpace=T.SRGBColorSpace;env.mapping=T.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.72;}
 const foliage=new URL('../models/foliage-86e71ddf75.png',location.href).href;
 const manager=new T.LoadingManager();manager.setURLModifier(url=>url.endsWith('foliage-86e71ddf75.png')?foliage:url);
 const loader=new GLTFLoader(manager);
 const parcelMeshes=[], pickMeshes=[], proposalBounds=new T.Box3();
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
  model.scene.updateMatrixWorld(true);
  model.scene.traverseVisible(mesh=>{
   if(!mesh.isMesh)return;
   pickMeshes.push(mesh);
   if(url===modelURL){
    proposalBounds.expandByObject(mesh);
    if(mesh.userData.groundSurface)parcelMeshes.push(mesh);
   }
  });
 }
 const ground=new T.Mesh(new T.PlaneGeometry(1600,1600),new T.MeshStandardMaterial({color:0xd1d0bd,roughness:.95}));ground.position.y=-13.65;ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);ground.userData.walkable=true;pickMeshes.push(ground);ground.updateMatrixWorld(true);
 let sid=0,local=0,playing=false,originTime=0,frame=0,pending=false,internal=false;
 const previewPath=()=>downloadData(shots.filter(s=>duration(s)>0));
 function keep(){
  if(review?.readOnly)return;
  cloud.changed(previewPath());
  try{localStorage.setItem(draftKey,JSON.stringify(sequenceData(shots)))}
  catch{say('Storage is unavailable on this device. Download the camera path to keep your changes.')}
 }
 const shot=()=>shots[sid];
 const total=()=>shots.reduce((a,s)=>a+duration(s),0);
 const baseTime=()=>shots.slice(0,sid).reduce((a,s)=>a+duration(s),0);
 let undoState=null;
 let exporting=false,cancelExport=false,lastVideo=null;
 function render(){
  placeRoomLights();
  if(!exporting&&!pending){pending=true;requestAnimationFrame(()=>{pending=false;if(!exporting)renderer.render(scene,cam)})}
 }
 function resize(){if(exporting)return;renderer.setSize(Math.max(10,$('stage').clientWidth),Math.max(10,$('stage').clientHeight));cam.aspect=$('stage').clientWidth/Math.max(1,$('stage').clientHeight);cam.updateProjectionMatrix();render()}
 new ResizeObserver(resize).observe($('stage'));resize();
 function pause(){if(picking)setPicking(false);playing=false;controls.enabled=true;cancelAnimationFrame(frame);$('play').textContent='Play sequence';}
 // The shared parcel centroid gives both cameras the same bearing. Its elevation
 // comes from Ava’s graded site, including the part below the street datum.
 const center=siteCenter.clone(), ray=new T.Raycaster();
 ray.set(new T.Vector3(center.x,proposalBounds.isEmpty()?100:proposalBounds.max.y+1,center.z),new T.Vector3(0,-1,0));
 const grade=ray.intersectObjects(parcelMeshes,false)[0];
 if(grade)center.y=grade.point.y;
 const eyeHeight=5.5*.3048, birdHeight=150*.3048;
 const canvas=renderer.domElement;
 let picking=false;
 function setPicking(active){
  picking=active;controls.enabled=!active;
  $('eye-view').setAttribute('aria-pressed',String(active));
  $('stage').classList.toggle('picking',active);
  $('pick-hint').hidden=!active;
 }
 function frameView(eye,aim){
  pause();internal=true;
  cam.position.copy(eye);controls.target.copy(aim);controls.update();
  internal=false;updateControls();render();$('stage').focus({preventScroll:true});
  say(shot()?'Save a keyframe to keep this view.':'Add a shot to save this view as its first keyframe.');
 }
 function placeEye(x,y){
  cam.updateMatrixWorld(true);
  ray.setFromCamera(new T.Vector2(x,y),cam);
  // Check the first solid visible at the pointer. A roof or table must not
  // silently place the camera on a lower floor behind it.
  const hit=ray.intersectObjects(pickMeshes,false).find(hit=>{
   const mat=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
   return mat.visible && !(mat.transparent && mat.opacity<.5);
  });
  if(hit){
   const data=hit.object.userData;
   const surface=data.walkable===true || data.groundSurface || data.layer==='Enclosure / Roof' ||
    data.layer==='Architecture / Sloped surfaces' || hit.object.name==='Original_context_surface';
   const normal=hit.face.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld));
   if(surface && normal.y>=.7){
    const eye=hit.point.clone();eye.y+=eyeHeight;
    const heading=center.clone().sub(eye);heading.y=0;
    if(heading.lengthSq()<.01){
     cam.getWorldDirection(heading);heading.y=0;
     if(heading.lengthSq()<.0001)heading.set(0,0,-1);
     heading.normalize().multiplyScalar(5);
    }
    heading.clampLength(.2,controls.maxDistance-1);
    frameView(eye,eye.clone().add(heading));return;
   }
  }
  $('pick-hint').textContent='Choose an exposed, upward-facing floor, roof, terrace or street.';
 }
 $('eye-view').onclick=()=>{
  if(exporting)return;
  const active=!picking;pause();setPicking(active);
  $('pick-hint').textContent='Click a surface to stand on it. Enter picks the center of the view. Esc cancels.';
  $('stage').focus({preventScroll:true});
 };
 canvas.addEventListener('click',event=>{
  if(!picking||exporting||event.button!==0)return;
  const rect=canvas.getBoundingClientRect();
  placeEye(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
 });
 $('bird-view').onclick=()=>{
  if(exporting)return;
  const bearing=cam.position.clone().sub(center);bearing.y=0;
  if(bearing.lengthSq()<.01)bearing.set(1,0,1);
  bearing.normalize();
  const eye=center.clone(),testCamera=cam.clone(),corner=new T.Vector3();
  const {min,max}=proposalBounds;
  // Preserve the lens and approach direction. Back up until the project fits
  // both axes, without changing the chosen height above the parcel.
  let distance=birdHeight;
  const limit=Math.sqrt(controls.maxDistance**2-birdHeight**2)-1;
  for(;;){
   eye.copy(center).addScaledVector(bearing,distance);eye.y+=birdHeight;
   testCamera.position.copy(eye);testCamera.lookAt(center);testCamera.updateMatrixWorld(true);
   let fits=true;
   if(!proposalBounds.isEmpty()){
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
     corner.set(x,y,z).project(testCamera);
     if(Math.abs(corner.x)>.93||Math.abs(corner.y)>.93||Math.abs(corner.z)>1)fits=false;
    }
   }
   if(fits||distance>=limit)break;
   distance=Math.min(limit,distance*1.12);
  }
  frameView(eye,center);
 };
 function keyIndex() {
  return shot()?.keys.findIndex(k => Math.abs(k.at-local)<0.000001) ?? -1;
 }
 function updateControls() {
  const s=shot(), keys=s?.keys ?? [], length=duration(s), idx=keyIndex();
  $('lens').value=cam.fov;
  $('angle').textContent=Math.round(cam.fov)+'°';
  $('shotname').textContent=s?.name ?? '';
  $('stamp').textContent='Shot '+length.toFixed(2)+' s · Film '+total().toFixed(2)+' s';
  $('cursor').value=Number(local.toFixed(3));
  $('cursor').disabled=!keys.length;
  $('advance').disabled=!keys.length || local>=120;
  $('scrub').max=length;
  $('scrub').value=Math.min(local,length);
  $('scrub').disabled=!length;
  $('store').textContent=idx<0?'Add keyframe':'Update keyframe';
  $('remove').disabled=idx<0;
  $('delete-shot').disabled=!s;
  $('undo').hidden=!undoState;
  $('save').disabled=!shots.length;
  $('play').disabled=$('export').disabled=total()<=0;
  $('new-shot').disabled=shots.length>=32;
  for(const [j,b] of Array.from($('marks').children).entries()) {
   b.classList.toggle('active',j===idx);
   b.setAttribute('aria-pressed',String(j===idx));
  }
 }
 function pose() {
  const keys=shot()?.keys;
  if(keys?.length) {
   internal=true;
   cam.position.fromArray(sample(keys,local,'eye'));
   controls.target.fromArray(sample(keys,local,'target'));
   cam.fov=sample(keys,local,'fov');cam.updateProjectionMatrix();
   controls.update();internal=false;
  }
  updateControls();render();
 }
 function marks() {
  $('marks').replaceChildren();
  const s=shot();
  if(!s)return;
  const end=duration(s);
  for(const [i,k] of s.keys.entries()) {
   const b=document.createElement('button');
   b.style.left=(end ? 100*k.at/end : 0)+'%';
   b.title='Keyframe '+(i+1)+' · '+k.at.toFixed(2)+' s';
   b.setAttribute('aria-label',b.title);
   b.onclick=()=>{pause();local=k.at;marks();pose();say('')};
   $('marks').append(b);
  }
 }
 function changeShot(id,t=0) {
  sid=id;local=t;
  for(const [i,b] of Array.from($('shots').children).entries())b.setAttribute('aria-current',String(i===sid));
  marks();pose();
 }
 function shotButtons() {
  $('timeline').hidden=$('shot-settings').hidden=!shots.length;
  $('shots').replaceChildren();
  for(const [i,s] of shots.entries()){
   const b=document.createElement('button'),num=document.createElement('b'),txt=document.createElement('span');
   num.textContent=String(i+1).padStart(2,'0');txt.textContent=s.name;
   b.append(num,txt);b.onclick=()=>{pause();changeShot(i);say('')};$('shots').append(b);
  }
 }
 function snapshotDeletion() {
  undoState={shots:structuredClone(shots),sid,local};
 }
 $('undo').onclick=()=>{
  if(!undoState)return;
  pause();
  const restored=undoState; undoState=null; shots=restored.shots;
  shotButtons();changeShot(restored.sid,restored.local);keep();say('Deletion undone.');
 };
 $('new-shot').onclick=()=>{
  if(exporting||shots.length>=32)return;
  pause();undoState=null;
  let n=shots.length+1;
  while(shots.some(s=>s.name==='Shot '+n))n++;
  shots.push({name:'Shot '+n,keys:[]});
  shotButtons();changeShot(shots.length-1);keep();
  say('Frame your starting view and add the first keyframe at 0 s.');
 };
 $('delete-shot').onclick=()=>{
  if(!shot()||exporting)return;
  pause();snapshotDeletion();
  const [deleted]=shots.splice(sid,1);
  shotButtons();changeShot(Math.max(0,Math.min(sid,shots.length-1)));keep();say(deleted.name+' deleted.');
 };
 function seek(seconds) {
  let remaining=Math.max(0,seconds);
  let last=-1;
  for(const [i,s] of shots.entries()){
   const span=duration(s);
   if(span<=0)continue;
   last=i;
   if(remaining<span) {
    if(sid!==i)changeShot(i,remaining);
    else{local=remaining;pose()}
    return;
   }
   remaining-=span;
  }
  if(last>=0)changeShot(last,duration(shots[last]));
 }
 function tick(now) {
  if(!playing)return;
  const seconds=(now-originTime)/1000;renderer.noteMotion?.();
  if(seconds>=total()){seek(total());pause();return}
  seek(seconds);frame=requestAnimationFrame(tick);
 }
 $('play').onclick=()=>{
  if(playing){pause();return}
  if(!total())return;
  if(picking)setPicking(false);
  let sec=baseTime()+Math.min(local,duration(shot()));
  if(sec>=total()-.000001)sec=0;
  playing=true;controls.enabled=false;$('play').textContent='Pause';say('');
  originTime=performance.now()-sec*1000;frame=requestAnimationFrame(tick);
 };
 $('scrub').oninput=()=>{
  pause();local=Number($('scrub').value);renderer.noteMotion?.();marks();pose();say('');
 };
 function setCaptureTime(seconds) {
  if(!shot()?.keys.length)return;
  pause();
  if(!Number.isFinite(seconds)||seconds<0||seconds>120) {
   updateControls();say('Choose a shot time from 0 to 120 seconds.');return;
  }
  local=Math.round(seconds*1000)/1000;
  marks();updateControls();say('Frame this view and save a keyframe at '+local.toFixed(2)+' s.');
 }
 $('cursor').onchange=()=>setCaptureTime($('cursor').valueAsNumber);
 $('advance').onclick=()=>setCaptureTime(Math.min(120,local+1));
 $('lens').oninput=()=>{pause();cam.fov=+$('lens').value;cam.updateProjectionMatrix();updateControls();render();say('Save a keyframe to keep this view.')};
 controls.addEventListener('start',()=>{pause();$('stage').focus({preventScroll:true})});
 controls.addEventListener('change',()=>{if(!internal){renderer.noteMotion?.();render();say('Use Add or Update keyframe to keep this view.')}});
 $('stage').addEventListener('keydown',e=>{
  if(picking){
   if(e.key==='Escape'){e.preventDefault();setPicking(false);say('Camera placement canceled.')}
   if(e.key==='Enter'){e.preventDefault();placeEye(0,0)}
   return;
  }
  const k=e.key.toLowerCase();if(exporting||playing||!['w','a','s','d','q','e'].includes(k))return;e.preventDefault();
  const forward=cam.getWorldDirection(new T.Vector3());forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
  const right=forward.clone().cross(cam.up).normalize(),dy=new T.Vector3(0,1,0);
  const delta=(k==='q'||k==='e'?dy:k==='w'||k==='s'?forward:right).multiplyScalar((e.shiftKey?1.2:.3)*(['q','s','a'].includes(k)?-1:1));cam.position.add(delta);controls.target.add(delta);controls.update()
 });
 $('store').onclick=()=>{
  if(exporting||!shot())return;
  pause();
  const keys=shot().keys, i=keyIndex();
  if(i<0 && keys.length>=120){say('This shot has reached 120 keyframes.');return}
  if(!keys.length)local=0;
  undoState=null;
  const k={at:i<0?local:keys[i].at,eye:cam.position.toArray(),target:controls.target.toArray(),fov:cam.fov};
  if(i<0)keys.push(k);else keys[i]=k;
  keys.sort((a,b)=>a.at-b.at);local=k.at;marks();updateControls();keep();
  say('Keyframe saved at '+local.toFixed(2)+' s.');
 };
 $('remove').onclick=()=>{
  const i=keyIndex();
  if(i<0||exporting)return;
  pause();snapshotDeletion();
  const keys=shot().keys;keys.splice(i,1);
  if(i===0 && keys.length){
   const start=keys[0].at;
   for(const k of keys)k.at-=start;
   local=0;
  } else local=keys[Math.max(0,i-1)]?.at ?? 0;
  marks();pose();keep();say('Keyframe deleted.');
 };
 $('save').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(downloadData(shots),null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=director+' - '+project.title+' camera path.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);say('Camera path exported.');
 };
 $('open').onclick=()=>$('pathfile').click();
 $('pathfile').onchange=async()=>{
  const file=$('pathfile').files[0];if(!file)return;
  try{
   if(file.size>2e6)throw Error();
   const imported=readShots(JSON.parse(await file.text()));
   pause();undoState=null;shots=imported;shotButtons();changeShot(0);keep();say('Camera path loaded.');
  }catch{say('Choose a camera path saved for this project.')}finally{$('pathfile').value=''}
 };
 $('cancel').onclick=()=>{cancelExport=true;say('Stopping the preview export…')};
 $('export').onclick=async()=>{
  if(exporting||!total())return;
  pause();
  const oldShot=sid,oldTime=local,oldEye=cam.position.clone(),oldTarget=controls.target.clone(),oldFov=cam.fov;
  const fps=24,width=1280,height=720;
  const counts=shots.map(s=>duration(s)>0 ? Math.max(1,Math.round(duration(s)*fps)) : 0),count=counts.reduce((a,b)=>a+b,0);
  if(total()>120.000001||count>2880){say('Keep the preview sequence within two minutes.');return}
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
     local=counts[j]===1 ? 0 : k*duration(s)/(counts[j]-1);cam.position.fromArray(sample(s.keys,local,'eye'));
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
   cloud.ready(previewPath());
   message='Preview ready · 1280 × 720 · 24 fps · '+(count/fps).toFixed(2)+' s';
  }catch(e){message=e.message||'The preview could not be exported.'}
  finally{
   exporting=false;controls.enabled=true;renderer.setPixelRatio(Math.min(1.4,devicePixelRatio));resize();
   for(const id of ['settings','timeline','files'])$(id).inert=false;$('cancel').hidden=true;
   changeShot(oldShot,oldTime);internal=true;cam.position.copy(oldEye);controls.target.copy(oldTarget);cam.fov=oldFov;cam.updateProjectionMatrix();controls.update();internal=false;updateControls();render();say(message);
  }
 };
 shotButtons();
 if(!shots[0]?.keys.length){
  cam.position.set(20,49,84);
  controls.target.set(-43,6,24);
  internal=true;controls.update();internal=false;render();
 }
 changeShot(Math.max(0,Math.min(review?.selected || 0,shots.length-1)));
 if(!shots.length)say('Choose Add shot to begin at 0 s.');
 $('status').hidden=true;for(const id of ['settings','timeline','files'])$(id).inert=false;
}
