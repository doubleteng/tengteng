import * as T from './lib/three.module.min.js';
import {applyProposalFinishes} from './proposal-finishes.js?v=f856cfc70e';
import {applyProposalEnvironment,loadProposalEnvironment,proposalSkyTexture} from './proposal-environment.js?v=262656718b';
import {applyProjectLightVolume,loadProjectLightVolume} from './project-light-volume.js?v=20cde4c284';
import {CameraClearance} from './camera-clearance.js?v=5e0d138cc1';
import {WalkDoors} from './walk-doors.js?v=d7307430af';
import {OrbitControls} from './lib/controls/OrbitControls.js';
import {GLTFLoader} from './lib/loaders/GLTFLoader.js';
import {siteFootprint,demoOrigin,siteCenter} from './site-model.js';
import {applyDistrictLight,loadDistrict} from './district-light.js';
import {makeRenderer} from './software-view.js?v=437b091705';
import {contextEdges,createInkMaterial} from './context-edges.js';
const v=(x,y,z)=>new T.Vector3(x,y,z);
const loader=new GLTFLoader();
const registeredSite=siteFootprint();
const maxPerspectivePolarAngle=Math.PI-.01;
// Street perspectives are 1.65 m above the registered Rhino street or sidewalk.
// The target stays level with the eye. A vertical lens shift frames the roofline.
const contextViews = {
 'case-arcade': {eye:[-11.106,4.17,25.4],target:[-41.906,6.16,22.10],shift:.04,fov:65},
 'case-plinth': {eye:[-26.106,3.47,-5.50],target:[-33.206,5.25,1.60],shift:.015,fov:68},
 'case-roof': {eye:[4.094,35,40],target:[-33.906,10.5,11],shift:0,fov:53},
 'case-promenade': {eye:[-92.906,2.08,-3.5],target:[-65.906,8.10,11.1],shift:0,fov:65},
 'case-west': {eye:[-86.40,2.12,16.44],target:[-63.0,4.05,12.95],shift:.08,fov:65},
 'case-market': {eye:[-81.21,2.10,30.58],target:[-47.8,2.85,30.95],shift:.045,fov:68},
 'case-ramp': {eye:[-64.90,9.18,19.88],target:[-88.6,9.00,19.10],shift:.04,fov:65},
 'case-hall': {eye:[-45.16,4.16,16.06],target:[-67.02,4.45,9.08],shift:.12,fov:74},
 'case-hall-balcony': {eye:[-51.64,12.27,4.48],target:[-58.80,11.76,7.75],shift:0,fov:69},
 'case-gallery': {eye:[-50.906,4.12,17.40],target:[-57.106,9.10,4.8],shift:.045,fov:67},
 'case-forum': {eye:[-24.5,8.08,11.80],target:[-14.35,8.56,4.01],shift:.055,fov:73},
 'case-court': {eye:[-39.906,8.03,14.55],target:[-35.906,7.85,7.45],shift:.10,fov:72},
 'case-studios': {eye:[-75.89,12.30,7.74],target:[-78.15,12.22,2.40],shift:.03,fov:70},
 'case-node': {eye:[-74.906,4.12,5.50],target:[-69.506,3.98,1.65],shift:0,fov:54},
 fourth: {eye:[-94,1.802,38],target:[-73,1.802,68],shift:.25},
 detroit: {eye:[-27,4.088,42],target:[-60,4.088,70],shift:.19},
 dunbar: {eye:[-84,3.479,117],target:[-122,3.479,81],shift:.20},
 'dunbar-roof': {eye:[-94,65,117],target:[-123,18,80],shift:0},
 '330-detroit': {eye:[-84,1.955,35],target:[-14,1.955,67],shift:.15,fov:35},
 '330-fifth': {eye:[3,4.088,12],target:[-7,4.088,58],shift:.16},
 '330-roof': {eye:[-52,63,33],target:[-15,12,67],shift:0},
 'market-shops': {eye:[16,3.577,-11],target:[-8,3.577,-32],shift:.17},
 'detroit-deli': {eye:[49,2.717,-61],target:[70,2.717,-59],shift:.16},
 'concert-house': {eye:[-89,1.802,-43],target:[-110,1.802,-36],shift:.16},
 'division-school': {eye:[171,6.726,24],target:[144.48,6.726,16.9],shift:.13},
 'ann-museum': {eye:[-33,5.90,214],target:[-34.80,5.90,246.63],shift:.15,fov:43}
};
export function disposeModel(root){
 if(!root)return;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);
  if(o.userData.neutralMaterial)materials.add(o.userData.neutralMaterial);
  for(const m of [].concat(o.userData.sourceMaterial||o.material||[])){
   materials.add(m);for(const t of Object.values(m))if(t?.isTexture&&!t.userData.viewerShared&&!t.userData.proposalShared)textures.add(t);
  }
 });
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.()});
}
export function layerOf(o){for(let n=o;n;n=n.parent){if(n.userData.layer)return n.userData.layer;}return o.parent?.name||o.name||'Model';}
export function loadGLB(url){return loader.loadAsync(url).then(x=>x.scene);}
export function parseGLB(bytes){return loader.parseAsync(bytes,'').then(x=>x.scene);}
async function loadProject(model,renderer){
 if(model.overview)return {root:siteFootprint()};
 const version=new URL(model.url,document.baseURI).searchParams.get('v');
 const volume=model.lightVolume&&version?loadProjectLightVolume(model.lightVolume,version).catch(()=>null):null;
 const modelReady=loadGLB(model.url).then(async root=>{
  root.traverse(object=>{if(object.isMesh)object.userData.projectSurface=true;});
  await applyProposalFinishes(root,{caseStudy:!!model.caseStudy,maxAnisotropy:renderer.capabilities?.getMaxAnisotropy?.()||1});
  return root;
 });
 const [root,environment,lightVolume]=await Promise.all([modelReady,loadProposalEnvironment().catch(()=>null),volume]);
 if(environment)applyProposalEnvironment(root,environment);
 if(lightVolume)applyProjectLightVolume(root,lightVolume);
 return {root,environment,lightVolume};
}

export class AtlasViewer{
 constructor(host,onInteract){
  this.host=host;this.onInteract=onInteract;
  const small=matchMedia('(max-width:700px)').matches;
  this.renderer=makeRenderer({antialias:true,alpha:false,powerPreference:'low-power',logarithmicDepthBuffer:true});
  const r=this.renderer;this.preferredPixelRatio=Math.min(devicePixelRatio,small?1.25:1.5);
  this.fullPixelRatio=this.preferredPixelRatio;r.setPixelRatio(this.fullPixelRatio);
  r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.shadowMap.autoUpdate=false;
  r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.14;host.append(r.domElement);
  this.scene=new T.Scene();this.paperBackground=new T.Color(0xe0e1da);this.scene.background=this.paperBackground;this.parallelCamera=new T.OrthographicCamera(-1,1,1,-1,.005,100000);
  this.perspectiveCamera=new T.PerspectiveCamera(44,1,.05,10000);
  this.inkViewHeight={value:1};this.camera=this.perspectiveCamera;this.contextEdges=true;this.buildingColors=true;
  this.controls=new OrbitControls(this.camera,r.domElement);this.controls.maxPolarAngle=maxPerspectivePolarAngle;this.controls.minZoom=.001;this.controls.maxZoom=100;this.controls.addEventListener('start',()=>{this.userNavigated=true;this.activate();});
  this.enableWalkEntry();
  this.controls.addEventListener('change',()=>this.cameraChanged());this.controls.enableDamping=false;
  this.receiveFaces=true;this.receiveGround=true;
  this.sky=new T.HemisphereLight(0xfffdf2,0xaeb1a1);
  this.sun=new T.DirectionalLight(0xfff3df);this.sun.castShadow=true;this.scene.add(this.sky,this.sun,this.sun.target);
  this.setShadowTones(80,35);
  this.sun.shadow.mapSize.setScalar(small?1024:2048);this.sun.shadow.bias=-.00009;
  this.ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0xdddcd4,roughness:1}));
  this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.scene.add(this.ground);
  this.clay=new T.MeshStandardMaterial({color:0xeae6d9,roughness:.94,side:T.DoubleSide});
  this.flatClay=this.clay.clone();this.flatClay.flatShading=true;
  this.width=65;this.height=40;this.radius=40;this.center=v(0,1.2,0);this.solar=[315,40];this.mode='material';
  this.hidden=new Set();this.cityVisible=true;this.cityPaths=new Set();this.hiddenCity=new Set();this.key=0;this.pendingCity=null;
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
 }
 enableWalkEntry(){
  const canvas=this.renderer.domElement,area=this.host.parentElement;
  // The authoring views use the same renderer with no navigation interface.
  if(!area?.querySelector('#walk-hud'))return;
  this.entryLabel=matchMedia('(pointer:coarse)').matches?'Double-tap a floor to walk':'Double-click a floor to walk';
  area.querySelector('#walk-entry-text').textContent=this.entryLabel;
  const enter=(x,y,touch)=>{
   if(this.walkMode?.active||!this.project||area.getAttribute('aria-busy')==='true')return;
   const rect=canvas.getBoundingClientRect(),project=this.project,request=++this.walkRequest;
   const ndc={x:2*(x-rect.left)/rect.width-1,y:1-2*(y-rect.top)/rect.height};
   this.walkModule??=import('./walk-mode.js?v=2197339611').catch(error=>{this.walkModule=null;throw error;});
   this.walkModule.then(({WalkMode})=>{
    if(this.project!==project||this.walkRequest!==request||this.walkMode?.active)return;
    this.walkMode??=new WalkMode(this);
    if(!this.walkMode.enter(ndc,touch))this.walkHint('Choose a clear spot on the ground or a floor.');
   }).catch(()=>this.walkHint('Walk mode could not start. Double-click a floor to retry.'));
  };
  this.walkRequest=0;
  canvas.addEventListener('dblclick',e=>{
   if(e.button!==0||e.sourceCapabilities?.firesTouchEvents)return;
   e.preventDefault();enter(e.clientX,e.clientY,false);
  });
  let tap=null,lastTap=null;
  canvas.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch')return;
   if(!e.isPrimary){tap=lastTap=null;return;}
   tap={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};
  });
  canvas.addEventListener('pointermove',e=>{
   if(tap?.id===e.pointerId&&Math.hypot(tap.x-e.clientX,tap.y-e.clientY)>10)tap=lastTap=null;
  });
  canvas.addEventListener('pointercancel',()=>{tap=lastTap=null;});
  canvas.addEventListener('pointerup',e=>{
   if(e.pointerType!=='touch'||tap?.id!==e.pointerId)return;
   const now=performance.now(),p=tap;tap=null;
   if(now-p.at>330){lastTap=null;return;}
   if(lastTap&&now-lastTap.at<370&&Math.hypot(lastTap.x-p.x,lastTap.y-p.y)<25){
    lastTap=null;enter(e.clientX,e.clientY,true);
   }else lastTap={x:p.x,y:p.y,at:now};
  });
  area.addEventListener('keydown',e=>{
   if(e.target===area&&e.key==='Enter'&&!this.walkMode?.active&&!e.repeat){
    e.preventDefault();const r=canvas.getBoundingClientRect();enter(r.left+r.width/2,r.top+r.height/2,true);
   }
  });
 }
 walkHint(message){
  const hint=this.host.parentElement.querySelector('#walk-entry-text');if(!hint)return;
  clearTimeout(this.hintTimer);hint.textContent=message;
  this.hintTimer=setTimeout(()=>{hint.textContent=this.entryLabel;},3000);
 }
 cameraChanged(){
  if(this.clearance&&!this.settingView){
   this.clearance.constrain(this.camera.position,this.controls.target);
   this.camera.lookAt(this.controls.target);
  }
  if(!this.settingView&&this.project)this.movingFrame=true;
  this.draw();
 }
 activate(){if(this.project)this.onInteract?.();}
 adaptMovingResolution(now){
  if(!this.renderer.isWebGLRenderer||!this.movingFrame)return;
  this.movingFrame=false;
  const elapsed=now-(this.lastMovingFrame??-Infinity);
  this.lastMovingFrame=now;
  // Isolated mouse-wheel ticks and the first frame after loading are not a
  // performance measurement. Require successive late frames during navigation.
  const continuous=elapsed<Math.max(220,(this.lastRenderDuration||0)*1.8);
  this.slowFrames=elapsed>32&&continuous?(this.slowFrames||0)+1:0;
  if(this.slowFrames>=2&&!this.reducedResolution){
   this.reducedResolution=true;
   this.renderer.setPixelRatio(Math.min(this.fullPixelRatio,Math.max(.65,this.fullPixelRatio*.65)));
  }
  if(this.reducedResolution){
   clearTimeout(this.settleTimer);
   this.settleTimer=setTimeout(()=>{
    this.reducedResolution=false;this.slowFrames=0;this.lastMovingFrame=undefined;
    this.renderer.setPixelRatio(this.fullPixelRatio);this.draw();
   },Math.min(900,Math.max(260,2*(this.lastRenderDuration||0))));
  }
 }
 draw(){
  if(this.frame)return;
  this.frame=requestAnimationFrame(now=>{
   this.frame=0;this.adaptMovingResolution(now);this.updateCameraRange();this.updateLightCoverage();this.updateBackdrop();
   const start=performance.now();this.renderer.render(this.scene,this.camera);this.lastRenderDuration=performance.now()-start;
   this.annotations?.draw(this.camera,this.host.clientWidth,this.host.clientHeight);
  });
 }
 registerContext(root){
  this.prepare(root);
  root.traverse(o=>{if(o.geometry){
   if(!o.userData.contextSourceSupport&&!o.userData.initialHidden)this.cityPaths.add(o.userData.atlasPath);
   if(o.userData.contextBuildingColor&&o.material?.color){
    const neutral=o.material.clone();neutral.vertexColors=false;neutral.color.set(o.userData.contextNeutral||'#dedbd2');
    o.userData.neutralMaterial=neutral;
    if(o.geometry.hasAttribute('districtAmbient'))applyDistrictLight(neutral,false);
   }
   if(o.geometry.hasAttribute('districtAmbient')){
    for(const mat of [].concat(o.material)){
     const glass=/\b(glass|glazing)\b|visible original panel faces/i.test(mat.name);
     applyDistrictLight(mat,glass);
    }
   }
  }});
  this.addCityOutlines(root);
 }
 updateCameraRange(){
  if(!this.project)return;
  const cam=this.camera, distance=cam.position.distanceTo(this.controls.target);
  const toSite=cam.position.distanceTo(siteCenter), toModel=cam.position.distanceTo(this.center);
  // Adapt the depth range when moving from a connection detail to the district.
  // Keep geometry immediately in front of the eye while close to the scene.
  const near=cam.isPerspectiveCamera?Math.max(.002,Math.min(distance*.002,this.clearance ? .10 : 1)):.02;
  const far=Math.max(distance+500,toSite+600,toModel+this.radius*3);
  if(cam.near!==near||cam.far!==far){
   cam.near=near;cam.far=far;cam.updateProjectionMatrix();
  }
 }
 updateLightCoverage(){
  if(!this.project)return;
  const camera=this.camera;
  const span=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:
   2*camera.position.distanceTo(this.controls.target)*Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const width=Math.max(1,this.host.clientWidth/Math.max(1,this.host.clientHeight))*span;
  const wide=width>(this.wideLighting?250:290)||this.controls.target.distanceTo(siteCenter)>95;
  if(wide!==this.wideLighting){
   this.wideLighting=wide;this.setSun(...this.solar,false);
  }
 }
 updateBackdrop(){
  const daylight=!!(this.project&&!this.overview&&this.mode==='material'&&this.camera.isPerspectiveCamera&&this.solar[1]>0);
  this.renderer.proposalSky=daylight;
  this.scene.background=daylight&&this.renderer.isWebGLRenderer?proposalSkyTexture():this.paperBackground;
 }
 refreshShadow(){this.renderer.shadowMap.needsUpdate=true;this.draw();}
 resize(){
  const w=this.host.clientWidth,h=this.host.clientHeight;
  if(!w||!h)return;
  if(this.renderer.isWebGLRenderer){
   // Keep a large or high-density display from multiplying fragment work.
   const ratio=Math.min(this.preferredPixelRatio,Math.sqrt(1800000/(w*h)));
   if(ratio!==this.fullPixelRatio){
    this.fullPixelRatio=ratio;
    if(!this.reducedResolution)this.renderer.setPixelRatio(ratio);
   }
  }
  this.host.parentElement?.style.setProperty('--viewport-height', h+'px');
  this.renderer.setSize(w,h,false);this.inkViewHeight.value=h;
  const aspect=w/h, height=Math.max(this.height,this.width/aspect);
  Object.assign(this.parallelCamera,{left:-height*aspect/2,right:height*aspect/2,top:height/2,bottom:-height/2});
  this.parallelCamera.updateProjectionMatrix();
  const previousAspect=this.perspectiveCamera.aspect;
  if(this.project&&!this.userNavigated&&!this.contextView&&this.camera.isPerspectiveCamera&&previousAspect!==aspect){
   const direction=this.camera.position.clone().sub(this.controls.target).normalize();
   this.camera.position.copy(this.controls.target).addScaledVector(direction,this.perspectiveFitDistance(aspect,direction));
   this.controls.update();
  }
  this.perspectiveCamera.aspect=aspect;
  if(this.contextView)this.perspectiveCamera.setViewOffset(w,h,0,-h*this.contextView.shift,w,h);
  this.perspectiveCamera.updateProjectionMatrix();
  this.draw();
 }
 addCityOutlines(root){
  const meshes=[];
  root.traverse(o=>{if(o.isMesh&&!o.userData.noOutline&&!o.userData.initialHidden)meshes.push(o);});
  const material=createInkMaterial(this.inkViewHeight);
  const edgesByGeometry=new Map();
  for(const mesh of meshes){
   let geometry=edgesByGeometry.get(mesh.geometry);
   if(!geometry){geometry=contextEdges(mesh.geometry);edgesByGeometry.set(mesh.geometry,geometry);}
   const outline=new T.LineSegments(geometry,material);
   outline.userData.contextOutline=true;
   outline.renderOrder=2;
   mesh.add(outline);
   for(const surface of [].concat(mesh.material,mesh.userData.neutralMaterial||[])){
    surface.polygonOffset=true;surface.polygonOffsetFactor=.35;surface.polygonOffsetUnits=.5;
   }
  }
 }
 prepare(root){
  root.traverse(o=>{
   if(!o.geometry)return;
   o.userData.atlasPath=layerOf(o);o.userData.sourceMaterial=o.material;
   const path=o.userData.atlasPath;
   const surface=path.split(/::|[/>]/).at(-1).trim();
   o.userData.groundReceiver=o.userData.groundSurface ??
    /^(?:ground(?: surface)?|terrain|topography|paving|market court paving|road(?:s|way)?|street pavement|sidewalks?|crosswalks?|curbs?|parking lot(?: paving)?|parcel (?:footprint|perimeter)|地面|地形|道路|人行道)$/i.test(surface);
   o.castShadow=!!o.isMesh&&!o.userData.groundSurface&&!o.userData.noShadowCast;
   o.receiveShadow=!!o.isMesh&&(o.userData.groundReceiver?this.receiveGround:this.receiveFaces);
   o.visible=!o.userData.initialHidden;
  });
 }
 async show(model,city){
  this.walkMode?.release();this.walkRequest=(this.walkRequest||0)+1;
  const key=++this.key;
  this.clearance=null;
  this.proposalVolume=null;this.renderer.proposalLightVolume=null;this.renderer.proposalEnvironment=null;
  if(this.project){this.scene.remove(this.project);disposeModel(this.project);this.project=null;}
  if(this.cityURL!==city){
   if(this.city){this.scene.remove(this.city);disposeModel(this.city);this.city=null;}
   this.wideLighting=false;this.cityURL=city;this.cityPaths=new Set();this.hiddenCity.clear();
   const request=Symbol();this.contextRequest=request;
   const urls=city==='./models/ann-arbor.glb'?[
    './models/urban-core-materials.glb','./models/urban-near.glb','./models/urban-outer.glb'
   ]:city?[city]:[];
   // Commit the three registered assets as one context, shared by all projects.
   this.pendingCity=Promise.allSettled(urls.map(url=>city==='./models/ann-arbor.glb'?loadDistrict(loader,url):loadGLB(url))).then(results=>{
    const objects=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    if(this.contextRequest!==request){objects.forEach(disposeModel);return;}
    const failed=results.find(r=>r.status==='rejected');
    if(failed){objects.forEach(disposeModel);this.cityURL=null;throw failed.reason;}
    if(!objects.length)return;
    this.city=new T.Group();
    for(const obj of objects){this.registerContext(obj);this.city.add(obj);}
    this.scene.add(this.city);this.applyModes();
   });
  }
  const cityPromise=this.pendingCity||Promise.resolve();
  // Collect both promises immediately so a failed context cannot become an unhandled rejection.
  const [res,ctx]=await Promise.allSettled([loadProject(model,this.renderer),cityPromise]);
  if(key!==this.key){if(res.status==='fulfilled')disposeModel(res.value.root);return null;}
  if(res.status==='rejected')throw res.reason;
  this.overview=!!model.overview;this.caseStudy=!!model.caseStudy;
  this.proposalVolume=res.value.lightVolume||null;this.renderer.proposalEnvironment=res.value.environment||null;
  this.project=res.value.root;if(model.demo)this.project.position.copy(demoOrigin);
  this.walkDoors=new WalkDoors(this.project,{caseStudy:this.caseStudy});this.prepare(this.project);this.scene.add(this.project);
  this.hidden.clear();this.paths=new Map();
  this.project.traverse(o=>{if(o.geometry){const path=o.userData.atlasPath;this.paths.set(path,(this.paths.get(path)||false)||!o.userData.initialHidden);}});
  for(const [path,visible] of this.paths){if(!visible)this.hidden.add(path);}
  const b=new T.Box3().setFromObject(this.project);if(b.isEmpty())throw Error('This file has no viewable geometry.');
  this.projectBounds=b;
  const size=b.getSize(v());this.center=b.getCenter(v());this.radius=Math.max(size.length()*.54,.01);
  this.width=Math.max(size.x,size.z,size.y)*1.42;this.height=this.radius*.96;
  if(model.demo){
   const base=siteFootprint(false);base.userData.drawingSupport=true;base.position.copy(demoOrigin).negate();
   this.prepare(base);this.project.add(base);this.paths.set('Site / Ground',true);
   this.width=67;this.height=31;this.center=demoOrigin.clone().add(v(0,1.2,0));}
  if(model.overview){this.center=v(-47,1.4,24);this.width=195;this.height=90;this.radius=130;}
  if(this.caseStudy){
   this.center=v(-47.5,5.5,26);this.width=106;this.height=57;
  }
  this.ground.position.copy(this.center);const urbanBox=this.city?new T.Box3().setFromObject(this.city):null;
  this.ground.position.y=Math.min(b.min.y,urbanBox?.min.y??b.min.y,city==='./models/ann-arbor.glb'?-13.6:Infinity)-this.radius*.001;
  this.ground.scale.setScalar(Math.max(this.radius*100,urbanBox?urbanBox.getSize(v()).length()*3:0));
  this.clearance=new CameraClearance([this.project,this.city],{registeredSite,fallback:this.ground.position.y});
  this.applyModes();this.view('perspective',false);this.setSun(...this.solar,false);return {paths:this.paths,cityError:ctx.status==='rejected'};
 }
 perspectiveFitDistance(aspect,direction){
  const tangent=Math.tan(T.MathUtils.degToRad(this.perspectiveCamera.fov/2));
  const height=Math.max(this.height,this.width/aspect);
  let distance=height/(2*tangent)+this.radius*.29;
  if(!this.projectBounds)return distance;
  const right=v().crossVectors(this.perspectiveCamera.up,direction).normalize();
  const up=v().crossVectors(direction,right);
  const {min,max}=this.projectBounds;
  for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
   const p=v(x,y,z).sub(this.center);
   const projected=Math.max(Math.abs(p.dot(right))/aspect,Math.abs(p.dot(up)));
   distance=Math.max(distance,p.dot(direction)+projected/(.90*tangent));
  }
  return distance;
 }
 view(name,interact=true){
  this.walkMode?.exit();
  if(interact)this.activate();
  this.settingView=true;this.userNavigated=false;
  this.contextView=contextViews[name]||null;
  this.camera=(this.contextView||name==='perspective')?this.perspectiveCamera:this.parallelCamera;
  this.controls.maxPolarAngle=this.camera.isPerspectiveCamera?maxPerspectivePolarAngle:Math.PI*.495;
  this.perspectiveCamera.clearViewOffset();
  this.perspectiveCamera.fov=this.contextView?(this.contextView.fov||55):44;
  this.controls.object=this.camera;
  this.controls.minDistance=Math.max(this.radius*.004,.001);
  this.controls.maxDistance=Math.max(1400,this.radius*60);
  this.camera.zoom=1;
  this.camera.near=Math.max(.0001,this.radius*.0006);
  this.camera.far=Math.max(1800,this.radius*120);
  if(this.contextView){
   this.camera.position.fromArray(this.contextView.eye);
   this.controls.target.fromArray(this.contextView.target);
   this.finishView();return;
  }
  const dirs={perspective:this.overview?v(1.0,.68,1.66):this.caseStudy?v(-.80,.66,-1.08):v(1.30,.50,-.83),axon:this.overview?v(118,145,182):v(36,33,57),plan:v(0,1,.00001),district:v(0,1,.00001),front:v(0,.00001,1),side:v(1,.00001,0)};
  const aspect=this.host.clientWidth/Math.max(this.host.clientHeight,1)||1;
  this.perspectiveCamera.aspect=aspect;
  const height=Math.max(this.height,this.width/aspect);
  if(name==='district')this.camera.zoom=height/(516*Math.max(1,1/aspect));
  const direction=dirs[name].normalize();
  const distance=name==='district'?730:this.camera.isPerspectiveCamera?this.perspectiveFitDistance(aspect,direction):this.radius*4;
  this.controls.target.copy(name==='district'?siteCenter:this.center);
  this.camera.position.copy(this.controls.target).addScaledVector(direction,distance);
  this.camera.updateProjectionMatrix();this.finishView();
 }
 finishView(){
  this.clearance?.place(this.camera.position,this.controls.target);
  this.controls.update();this.resize();
  this.clearance?.reset(this.camera.position,this.controls.target);
  this.settingView=false;
 }
 getDollyZoom(){return this.camera.isPerspectiveCamera?this.camera.fov:null;}
 setDollyZoom(degrees){
  const cam=this.camera,requested=Number(degrees);
  if(!cam.isPerspectiveCamera||!Number.isFinite(requested))return this.getDollyZoom();
  const fov=T.MathUtils.clamp(requested,20,85);
  this.userNavigated=true;this.activate();
  const target=this.controls.target, offset=cam.position.clone().sub(target);
  const distance=offset.length();
  if(distance<1e-8)return cam.fov;
  // The physical half-height at the target plane stays constant. Collision or
  // zoom limits reduce both travel and change in FOV by the matching amount.
  const halfHeight=distance*Math.tan(T.MathUtils.degToRad(cam.fov/2));
  const desired=T.MathUtils.clamp(halfHeight/Math.tan(T.MathUtils.degToRad(fov/2)),this.controls.minDistance,this.controls.maxDistance);
  cam.position.copy(target).addScaledVector(offset,desired/distance);
  this.clearance?.constrain(cam.position,target);
  cam.fov=T.MathUtils.radToDeg(2*Math.atan2(halfHeight,cam.position.distanceTo(target)));
  cam.updateProjectionMatrix();this.controls.update();this.draw();
  return cam.fov;
 }
 changeZoom(f){
  this.userNavigated=true;this.activate();
  if(this.camera.isPerspectiveCamera){
   const offset=this.camera.position.clone().sub(this.controls.target);
   offset.setLength(T.MathUtils.clamp(offset.length()/f,this.controls.minDistance,this.controls.maxDistance));
   this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
  }else{
   this.camera.zoom=T.MathUtils.clamp(this.camera.zoom*f,.001,100);this.camera.updateProjectionMatrix();
  }
  this.draw();
 }
 orbit(dx,dy){this.userNavigated=true;this.activate();const p=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(p);
  s.theta+=dx;s.phi=T.MathUtils.clamp(s.phi+dy,.001,this.controls.maxPolarAngle);this.camera.position.copy(this.controls.target).add(v().setFromSpherical(s));this.controls.update();}
 setSun(az,alt,interactive=true){
  if(interactive){this.activate();this.movingFrame=true;}this.solar=[Number(az),Number(alt)];const [a,h]=this.solar.map(T.MathUtils.degToRad);
  const scope=this.wideLighting?Math.max(this.radius,310):this.radius;
  const aim=this.wideLighting?siteCenter:this.center;
  this.sun.visible=this.solar[1]>0;this.sun.castShadow=this.sun.visible&&this.shadowChoice!==false;this.sun.target.position.copy(aim);this.sun.position.copy(aim).addScaledVector(v(Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)),scope*3);
  const c=this.sun.shadow.camera, r=scope*1.4;c.left=c.bottom=-r;c.right=c.top=r;c.near=scope*.04;c.far=scope*7;c.updateProjectionMatrix();this.sun.shadow.normalBias=scope*.00025;this.refreshShadow();
 }
 setShadowTones(light,dark){
  if(!Number.isFinite(+light)||!Number.isFinite(+dark))return;
  const l=T.MathUtils.clamp(+light,0,100)/100,d=T.MathUtils.clamp(+dark,0,100)/100;
  // Sky fill sets the shadow floor. Compensate the key when fill changes to
  // keep a sun-facing surface at the chosen Light value, within physical limits.
  this.sky.intensity=.23+2.55*d;
  this.sun.intensity=l*(5.84-1.25*this.sky.intensity);
  this.draw();
 }
 setShadowReceivers(faces,ground){
  this.receiveFaces=!!faces;this.receiveGround=!!ground;this.ground.receiveShadow=this.receiveGround;
  for(const root of [this.project,this.city])root?.traverse(o=>{
   if(o.isMesh)o.receiveShadow=o.userData.groundReceiver?this.receiveGround:this.receiveFaces;
  });
  this.draw();
 }
 setShadows(yes){this.activate();this.shadowChoice=yes;this.sun.castShadow=yes&&this.solar[1]>0;this.refreshShadow();}
 applyModes(){
  this.walkMode?.exit();
  const original=this.mode==='material';
  const proposal=!!this.project&&!this.overview&&original;
  this.sky.color.set(proposal?0xdbebff:0xfffdf2);this.sky.groundColor.set(proposal?0xbba68e:0xaeb1a1);
  this.sun.color.set(proposal?0xffe7c6:0xfff3df);
  if(this.proposalVolume){
   // A hidden roof or wall must also remove its baked obstruction.
   const intact=original&&![...this.paths].some(([name,visible])=>visible&&this.hidden.has(name));
   this.proposalVolume.strength.value=intact?1:0;
   this.renderer.proposalLightVolume=intact?this.proposalVolume:null;
  }
  for(const root of [this.project,this.city])root?.traverse(o=>{if(o.geometry){
   if(o.userData.contextOutline){o.visible=this.contextEdges;return;}
   const path=o.userData.atlasPath;
   o.visible=root===this.project?!this.hidden.has(path):!this.hiddenCity.has(path)&&!o.userData.initialHidden;
   if(o.isMesh){
    const display=o.geometry.hasAttribute('normal')?this.clay:this.flatClay;
    o.material=this.mode==='clay'?display:(!this.buildingColors&&o.userData.neutralMaterial)||o.userData.sourceMaterial;
    if(root===this.project){
     const transparentPane=original&&[].concat(o.material).every(m=>
      (m.userData.proposalReflection==='glass'||['glass','frosted'].includes(m.userData.proposalFinish))&&m.transparent&&m.opacity<1);
     o.castShadow=!o.userData.groundSurface&&!o.userData.noShadowCast&&!transparentPane;
    }
   }
  }});if(this.city)this.city.visible=this.cityVisible;this.refreshShadow();
 }
 setBuildingColors(enabled){this.activate();this.buildingColors=enabled;this.applyModes();}
 setContextEdges(enabled){this.activate();this.contextEdges=enabled;this.applyModes();}
 setMode(mode){this.activate();this.mode=mode;this.applyModes();}
 setPaths(paths,show){this.activate();for(const path of paths){if(show)this.hidden.delete(path);else this.hidden.add(path);}this.applyModes();}
 setCity(show){this.activate();this.cityVisible=show;this.applyModes();}
}
export async function thumbnail(root){
 const r=makeRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(600,336);r.toneMapping=T.ACESFilmicToneMapping;
 const sc=new T.Scene();sc.background=new T.Color(0xe1e2da);sc.add(root);sc.add(new T.HemisphereLight(0xffffff,0xb7b6a8,2));const light=new T.DirectionalLight(0xfff4df,2.2);sc.add(light);
 const b=new T.Box3().setFromObject(root),t=b.getCenter(v()),s=b.getSize(v()),d=Math.max(s.length(),.01),h=d*.68;
 const cam=new T.OrthographicCamera(-h*.89,h*.89,h*.5,-h*.5,d*.0001,d*10);cam.position.copy(t).addScaledVector(v(1,.83,1.55).normalize(),d*2);cam.lookAt(t);light.position.copy(t).add(v(-d,d*2,d));light.target.position.copy(t);sc.add(light.target);
 r.render(sc,cam);if(r.wait)await r.wait();const blob=await new Promise(res=>r.domElement.toBlob(res,'image/webp',.81));sc.remove(root);r.dispose();r.forceContextLoss();return blob;
}
