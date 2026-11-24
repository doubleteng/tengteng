import * as T from './lib/three.module.min.js';
import {OrbitControls} from './lib/controls/OrbitControls.js';
import {GLTFLoader} from './lib/loaders/GLTFLoader.js';
import {siteFootprint,demoOrigin,siteCenter} from './site-model.js';
import {makeRenderer} from './software-view.js';
import {contextEdges,createInkMaterial} from './context-edges.js';
const v=(x,y,z)=>new T.Vector3(x,y,z);
const loader=new GLTFLoader();
// Street perspectives are 1.65 m above the registered Rhino street or sidewalk.
// The target stays level with the eye. A vertical lens shift frames the roofline.
const contextViews = {
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
   materials.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);
  }
 });
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.()});
}
export function layerOf(o){for(let n=o;n;n=n.parent){if(n.userData.layer)return n.userData.layer;}return o.parent?.name||o.name||'Model';}
export function loadGLB(url){return loader.loadAsync(url).then(x=>x.scene);}
export function parseGLB(bytes){return loader.parseAsync(bytes,'').then(x=>x.scene);}
export class AtlasViewer{
 constructor(host,onInteract){
  this.host=host;this.onInteract=onInteract;
  const small=matchMedia('(max-width:700px)').matches;
  this.renderer=makeRenderer({antialias:true,alpha:false,powerPreference:'high-performance',logarithmicDepthBuffer:true});
  const r=this.renderer;r.setPixelRatio(Math.min(devicePixelRatio,small?1.4:1.8));r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.shadowMap.autoUpdate=false;
  r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.14;host.append(r.domElement);
  this.scene=new T.Scene();this.scene.background=new T.Color(0xe0e1da);this.parallelCamera=new T.OrthographicCamera(-1,1,1,-1,.005,100000);
  this.perspectiveCamera=new T.PerspectiveCamera(44,1,.05,10000);
  this.inkViewHeight={value:1};this.camera=this.perspectiveCamera;this.contextEdges=true;this.buildingColors=true;
  this.controls=new OrbitControls(this.camera,r.domElement);this.controls.maxPolarAngle=Math.PI*.495;this.controls.minZoom=.001;this.controls.maxZoom=100;this.controls.addEventListener('start',()=>this.activate());
  this.controls.addEventListener('change',()=>this.draw());this.controls.enableDamping=false;
  this.scene.add(new T.HemisphereLight(0xfffdf2,0xaeb1a1,1.76));
  this.sun=new T.DirectionalLight(0xfff3df,2.84);this.sun.castShadow=true;this.scene.add(this.sun,this.sun.target);
  this.sun.shadow.mapSize.setScalar(small?1024:2048);this.sun.shadow.bias=-.00022;
  this.ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0xdddcd4,roughness:1}));
  this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.scene.add(this.ground);
  this.clay=new T.MeshStandardMaterial({color:0xeae6d9,roughness:.94,side:T.DoubleSide});
  this.flatClay=this.clay.clone();this.flatClay.flatShading=true;
  this.width=65;this.height=40;this.radius=40;this.center=v(0,1.2,0);this.solar=[315,40];this.mode='material';
  this.hidden=new Set();this.cityVisible=true;this.cityPaths=new Set();this.hiddenCity=new Set();this.key=0;this.pendingCity=null;
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
 }
 activate(){if(this.project)this.onInteract();}
 draw(){
  if(this.frame)return;
  this.frame=requestAnimationFrame(()=>{
   this.frame=0;this.updateCameraRange();this.updateLightCoverage();
   this.renderer.render(this.scene,this.camera);
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
  const near=cam.isPerspectiveCamera?Math.max(.002,Math.min(distance*.002,1)):.02;
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
 refreshShadow(){this.renderer.shadowMap.needsUpdate=true;this.draw();}
 resize(){
  const w=this.host.clientWidth,h=this.host.clientHeight;
  if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.inkViewHeight.value=h;
  const aspect=w/h, height=Math.max(this.height,this.width/aspect);
  Object.assign(this.parallelCamera,{left:-height*aspect/2,right:height*aspect/2,top:height/2,bottom:-height/2});
  this.parallelCamera.updateProjectionMatrix();
  const previousAspect=this.perspectiveCamera.aspect;
  if(this.project&&!this.contextView&&this.camera.isPerspectiveCamera&&previousAspect!==aspect){
   const oldHeight=Math.max(this.height,this.width/previousAspect);
   this.camera.position.sub(this.controls.target).multiplyScalar(height/oldHeight).add(this.controls.target);
   this.controls.update();
  }
  this.perspectiveCamera.aspect=aspect;
  if(this.contextView)this.perspectiveCamera.setViewOffset(w,h,0,-h*this.contextView.shift,w,h);
  this.perspectiveCamera.updateProjectionMatrix();
  this.draw();
 }
 addCityOutlines(root){
  const meshes=[];
  root.traverse(o=>{if(o.isMesh&&!o.userData.noOutline)meshes.push(o);});
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
   o.castShadow=!!o.isMesh&&!o.userData.groundSurface&&!o.userData.noShadowCast;o.receiveShadow=!!o.isMesh;
   o.visible=!o.userData.initialHidden;
  });
 }
 async show(model,city){
  const key=++this.key;
  if(this.project){this.scene.remove(this.project);disposeModel(this.project);this.project=null;}
  if(this.cityURL!==city){
   if(this.city){this.scene.remove(this.city);disposeModel(this.city);this.city=null;}
   this.wideLighting=false;this.cityURL=city;this.cityPaths=new Set();this.hiddenCity.clear();
   const request=Symbol();this.contextRequest=request;
   const urls=city==='./models/ann-arbor.glb'?[
    './models/urban-core-materials.glb','./models/urban-near.glb','./models/urban-outer.glb'
   ]:city?[city]:[];
   // Commit the three registered assets as one context, shared by all projects.
   this.pendingCity=Promise.allSettled(urls.map(loadGLB)).then(results=>{
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
  const [res,ctx]=await Promise.allSettled([model.overview?Promise.resolve(siteFootprint()):loadGLB(model.url),cityPromise]);
  if(key!==this.key){if(res.status==='fulfilled')disposeModel(res.value);return null;}
  if(res.status==='rejected')throw res.reason;
  this.overview=!!model.overview;this.project=res.value;if(model.demo)this.project.position.copy(demoOrigin);this.prepare(this.project);this.scene.add(this.project);
  this.hidden.clear();this.paths=new Map();
  this.project.traverse(o=>{if(o.geometry){const path=o.userData.atlasPath;this.paths.set(path,(this.paths.get(path)||false)||!o.userData.initialHidden);}});
  for(const [path,visible] of this.paths){if(!visible)this.hidden.add(path);}
  const b=new T.Box3().setFromObject(this.project);if(b.isEmpty())throw Error('This file has no viewable geometry.');
  const size=b.getSize(v());this.center=b.getCenter(v());this.radius=Math.max(size.length()*.54,.01);
  this.width=Math.max(size.x,size.z,size.y)*1.42;this.height=this.radius*.96;
  if(model.demo){
   const base=siteFootprint(false);base.position.copy(demoOrigin).negate();
   this.prepare(base);this.project.add(base);this.paths.set('Site / Ground',true);
   this.width=67;this.height=31;this.center=demoOrigin.clone().add(v(0,1.2,0));}
  if(model.overview){this.center=v(-47,1.4,24);this.width=195;this.height=90;this.radius=130;}
  this.ground.position.copy(this.center);const urbanBox=this.city?new T.Box3().setFromObject(this.city):null;
  this.ground.position.y=Math.min(b.min.y,urbanBox?.min.y??b.min.y,city==='./models/ann-arbor.glb'?-13.6:Infinity)-this.radius*.001;
  this.ground.scale.setScalar(Math.max(this.radius*100,urbanBox?urbanBox.getSize(v()).length()*3:0));
  this.applyModes();this.view('perspective',false);this.setSun(...this.solar,false);return {paths:this.paths,cityError:ctx.status==='rejected'};
 }
 view(name,interact=true){
  if(interact)this.activate();
  this.contextView=contextViews[name]||null;
  this.camera=(this.contextView||name==='perspective')?this.perspectiveCamera:this.parallelCamera;
  this.controls.maxPolarAngle=this.contextView?Math.PI*.5:Math.PI*.495;
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
   this.controls.update();this.resize();return;
  }
  const dirs={perspective:this.overview?v(1.0,.98,1.66):v(1.05,.77,1.7),axon:this.overview?v(118,145,182):v(36,33,57),plan:v(0,1,.00001),district:v(0,1,.00001),front:v(0,.00001,1),side:v(1,.00001,0)};
  const aspect=this.host.clientWidth/Math.max(this.host.clientHeight,1)||1;
  this.perspectiveCamera.aspect=aspect;
  const height=Math.max(this.height,this.width/aspect);
  if(name==='district')this.camera.zoom=height/(516*Math.max(1,1/aspect));
  const distance=name==='district'?730:this.camera.isPerspectiveCamera?height/(2*Math.tan(T.MathUtils.degToRad(this.perspectiveCamera.fov/2)))+this.radius*.29:this.radius*4;
  this.controls.target.copy(name==='district'?siteCenter:this.center);
  this.camera.position.copy(this.controls.target).addScaledVector(dirs[name].normalize(),distance);
  this.camera.updateProjectionMatrix();this.controls.update();this.resize();
 }
 changeZoom(f){
  this.activate();
  if(this.camera.isPerspectiveCamera){
   const offset=this.camera.position.clone().sub(this.controls.target);
   offset.setLength(T.MathUtils.clamp(offset.length()/f,this.controls.minDistance,this.controls.maxDistance));
   this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
  }else{
   this.camera.zoom=T.MathUtils.clamp(this.camera.zoom*f,.001,100);this.camera.updateProjectionMatrix();
  }
  this.draw();
 }
 orbit(dx,dy){this.activate();const p=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(p);
  s.theta+=dx;s.phi=T.MathUtils.clamp(s.phi+dy,.001,this.controls.maxPolarAngle);this.camera.position.copy(this.controls.target).add(v().setFromSpherical(s));this.controls.update();}
 setSun(az,alt,interactive=true){
  if(interactive)this.activate();this.solar=[Number(az),Number(alt)];const [a,h]=this.solar.map(T.MathUtils.degToRad);
  const scope=this.wideLighting?Math.max(this.radius,310):this.radius;
  const aim=this.wideLighting?siteCenter:this.center;
  this.sun.visible=this.solar[1]>0;this.sun.castShadow=this.sun.visible&&this.shadowChoice!==false;this.sun.target.position.copy(aim);this.sun.position.copy(aim).addScaledVector(v(Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)),scope*3);
  const c=this.sun.shadow.camera, r=scope*1.4;c.left=c.bottom=-r;c.right=c.top=r;c.near=scope*.04;c.far=scope*7;c.updateProjectionMatrix();this.sun.shadow.normalBias=scope*.0005;this.refreshShadow();
 }
 setShadows(yes){this.activate();this.shadowChoice=yes;this.sun.castShadow=yes&&this.solar[1]>0;this.refreshShadow();}
 applyModes(){
  for(const root of [this.project,this.city])root?.traverse(o=>{if(o.geometry){
   if(o.userData.contextOutline){o.visible=this.contextEdges;return;}
   const path=o.userData.atlasPath;
   o.visible=root===this.project?!this.hidden.has(path):!this.hiddenCity.has(path)&&!o.userData.initialHidden;
   if(o.isMesh){
    const display=o.geometry.hasAttribute('normal')?this.clay:this.flatClay;
    o.material=this.mode==='clay'?display:(!this.buildingColors&&o.userData.neutralMaterial)||o.userData.sourceMaterial;
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
