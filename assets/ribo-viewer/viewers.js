import * as T from '../../teaching/id3/lib/three.module.min.js';
import { OrbitControls } from '../../teaching/id3/lib/controls/OrbitControls.js';
import { GLTFLoader } from '../../teaching/id3/lib/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './meshopt-decoder.js';

const groups = {
  context: 'Site & surrounding buildings', structure: 'Structural framing',
  furniture: 'Interior furniture', interior: 'Interior architecture',
  envelope: 'Exterior envelope', finishes: 'Finishes, fixtures & lighting'
};
const buildingFiles = ['envelope', 'ring-frame', 'upper-frame', 'interior', 'finishes', 'furniture', 'context'];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const localAsset = name => new URL('./models/' + name + '.glb', import.meta.url).href;
const selected = (button, value) => button.setAttribute('aria-pressed', String(value));
function setExpanded(card) {
  const change = () => {
    const on = document.fullscreenElement === card || card.classList.contains('ribo-expanded');
    const button = card.querySelector('[data-expand]');
    button.textContent = on ? '×' : '⛶';
    button.setAttribute('aria-label', (on ? 'Exit expanded ' : 'Expand ') + card.getAttribute('aria-label').toLowerCase());
  };
  card.querySelector('[data-expand]').onclick = async () => {
    if (document.fullscreenElement === card) await document.exitFullscreen();
    else if (card.classList.contains('ribo-expanded')) card.classList.remove('ribo-expanded');
    else {
      try { await card.requestFullscreen(); }
      catch { card.classList.add('ribo-expanded'); }
    }
    change();
  };
  document.addEventListener('fullscreenchange', change);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && card.classList.contains('ribo-expanded')) {
      card.classList.remove('ribo-expanded'); change();
    }
  });
}
function studio(renderer, scene, detail) {
  scene.background = new T.Color(0xe8e9e3);
  const room = new T.Scene(); room.background = new T.Color(0xb2b6ae);
  const panel = new T.PlaneGeometry(7, 5);
  for (const [x,y,z,brightness] of [[-4,5,2,4],[4,2,-3,2],[0,2,6,1.4]]) {
    const material = new T.MeshBasicMaterial({color:new T.Color(brightness,brightness,brightness),side:T.DoubleSide});
    const light = new T.Mesh(panel,material); light.position.set(x,y,z);light.lookAt(0,0,0);room.add(light);
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .05, .1, 40);
  scene.environment = environment.texture; scene.environmentIntensity = .52;
  room.children.forEach(item => item.material.dispose());panel.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xf5f6fb,0xb6ad92,1.4));
  const sun = new T.DirectionalLight(0xfff5e4,2.5);
  const target = detail ? new T.Vector3(0,1.5,0) : new T.Vector3(-2,3,-5);
  const radius = detail ? 3.3 : 32;
  sun.target.position.copy(target);
  sun.position.copy(target).add(new T.Vector3(.72,1.33,.78).multiplyScalar(radius));
  sun.castShadow=true; sun.shadow.mapSize.set(detail?512:1024,detail?512:1024);
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.05,far:radius*4});
  sun.shadow.normalBias=detail ? .0007 : .012;sun.shadow.bias=-.00024;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight(0xd3e2f0,.75);fill.position.set(-2,2,-4);scene.add(fill);
}
function frame(camera, controls, box, direction, padding) {
  const center=box.getCenter(new T.Vector3());
  const forward=direction.clone().normalize();
  const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0), forward).normalize();
  const up=new T.Vector3().crossVectors(forward,right);
  const tanY=Math.tan(T.MathUtils.degToRad(camera.fov/2)); let distance=0;
  for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]){
    const corner=new T.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,corner.dot(forward)+padding*Math.max(Math.abs(corner.dot(right))/(tanY*camera.aspect),Math.abs(corner.dot(up))/tanY));
  }
  controls.target.copy(center);camera.position.copy(center).addScaledVector(forward,distance);
  camera.lookAt(center);controls.update();
}
// The stencil faces use the source meshes' transforms and visibility. One cap pass
// per plane fills the cut through an opaque solid, leaving openings and glazing clear.
function cutCaps(scene, renderer, items, plane, order) {
  const group=new T.Group();const copies=[];
  function windingMaterial(side, operation) {
    return new T.MeshBasicMaterial({side,clippingPlanes:[plane],depthWrite:false,depthTest:false,colorWrite:false,
      stencilWrite:true,stencilFunc:T.AlwaysStencilFunc,stencilFail:operation,stencilZFail:operation,stencilZPass:operation});
  }
  const back=windingMaterial(T.BackSide,T.IncrementWrapStencilOp),front=windingMaterial(T.FrontSide,T.DecrementWrapStencilOp);
  for(const item of items.filter(item=>item.isMesh&&!item.material.transparent)){
    const pair=[back,front].map((material,index)=>{
      const copy=new T.Mesh(item.geometry,material);copy.matrixAutoUpdate=false;copy.matrix.copy(item.matrixWorld);
      copy.renderOrder=order+index*.1;group.add(copy);return copy;
    });copies.push([item,pair]);
  }
  const capMaterial=new T.MeshBasicMaterial({color:0xc98a61,side:T.DoubleSide,stencilWrite:true,stencilRef:0,
    stencilFunc:T.NotEqualStencilFunc,stencilFail:T.ReplaceStencilOp,stencilZFail:T.ReplaceStencilOp,stencilZPass:T.ReplaceStencilOp});
  const cap=new T.Mesh(new T.PlaneGeometry(360,360),capMaterial);cap.renderOrder=order+.2;
  cap.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),plane.normal);
  cap.onAfterRender=()=>renderer.clearStencil();cap.frustumCulled=false;group.add(cap);scene.add(group);
  return (active,otherPlanes)=>{
    group.visible=active;if(!active)return;
    for(const [item,pair] of copies) for(const copy of pair)copy.visible=item.visible;
    plane.coplanarPoint(cap.position);capMaterial.clippingPlanes=otherPlanes;
  };
}
function layerControls(card, items, apply) {
  let isolated=false;
  const hidden=new Set(),panel=card.querySelector('.ribo-layers'),open=card.querySelector('[data-layers]'),buttons=[];
  const keyFor=item=>item.userData.group+'/'+item.userData.layer;
  const isolate=card.querySelector('[data-steel]');
  function update() {
    selected(isolate,isolated);
    items.forEach(item=>{item.visible=isolated?item.userData.steel:!hidden.has(keyFor(item));});
    for(const {check,keys} of buttons){
      const active=keys.filter(key=>!hidden.has(key)).length;
      check.checked=active===keys.length;check.indeterminate=active>0&&active<keys.length;
    }
    apply();
  }
  function bind(input,keys) {
    buttons.push({check:input,keys});
    input.addEventListener('change',()=>{isolated=false;for(const key of keys)input.checked?hidden.delete(key):hidden.add(key);update();});
  }
  const togglePanel=show=>{panel.hidden=!show;open.setAttribute('aria-expanded',String(show));};
  open.onclick=()=>togglePanel(panel.hidden);
  card.querySelector('[data-close]').onclick=()=>{togglePanel(false);open.focus();};
  card.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){togglePanel(false);open.focus();}});
  isolate.onclick=()=>{isolated=!isolated;togglePanel(false);update();};
  const list=card.querySelector('[data-layer-list]');
  const labelControl=(text,keys)=>{
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(text));bind(check,keys);return label;
  };
  Object.entries(groups).forEach(([group,title])=>{
    const entries=new Map(items.filter(i=>i.userData.group===group).map(i=>[keyFor(i),i.userData.label]));
    if(!entries.size)return;
    const row=document.createElement('div');row.className='ribo-choice';row.append(labelControl(title,[...entries.keys()]));
    const more=document.createElement('button');more.type='button';more.textContent='Layers';more.setAttribute('aria-label','Show layers for '+title);
    more.setAttribute('aria-expanded','false');row.append(more);
    const children=document.createElement('div');children.className='ribo-sublist';children.hidden=true;
    for(const [key,label] of [...entries].sort((a,b)=>a[1].localeCompare(b[1])))children.append(labelControl(label,[key]));
    more.onclick=()=>{children.hidden=!children.hidden;more.setAttribute('aria-expanded',String(!children.hidden));};
    list.append(row,children);
  });
  update();return ()=>{isolated=false;hidden.clear();togglePanel(false);update();};
}
async function start(card) {
  const detail=card.dataset.model==='detail',stage=card.querySelector('.ribo-stage'),status=card.querySelector('.ribo-status');
  const toolbar=card.querySelectorAll('.ribo-tools button');toolbar.forEach(button=>button.disabled=true);
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:false,stencil:!detail,powerPreference:'default'}); }
  catch { const {softwareRenderer}=await import('./software.js');renderer=await softwareRenderer(detail); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.localClippingEnabled=!detail;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label',(detail?'Envelope detail':'Building model')+' interactive perspective. Drag to orbit, scroll to zoom, right-drag to pan.');canvas.tabIndex=0;stage.append(canvas);
  const scene=new T.Scene();if(!renderer.software)studio(renderer,scene,detail);
  const camera=new T.PerspectiveCamera(36,1,detail ? .008 : .12,detail?80:450);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=detail ? .07 : .4;controls.maxDistance=detail?24:180;
  controls.maxPolarAngle=Math.PI*.97;controls.zoomToCursor=true;controls.listenToKeyEvents(canvas);
  let ready=false,touched=false,scheduled=false,preset='full';
  function draw() {if(!ready||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderer.render(scene,camera);});}
  controls.addEventListener('change',draw);controls.addEventListener('start',()=>{touched=true;});
  const bounds=(a,b)=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b));
  // Extreme projected vertices of the clubhouse, excluding its much larger site.
  const buildingTarget=new T.Vector3(-1.5,3.8,-5.35);
  const profile=[[13.5663,-0.7905],[13.0493,2.1874],[13.0464,2.2029],[10.5746,8.5375]];
  const detailBounds=bounds([-.218,-.305,-.463],[.275,3.317,.758]);
  const detailDirection=new T.Vector3(.83,.38,1.55),buildingDirection=new T.Vector3(26,16,-19);
  function home(){
    if(!detail){
      const k=1.17/Math.tan(T.MathUtils.degToRad(camera.fov/2))/camera.aspect;
      const distance=Math.max(33.1601,...profile.map(([span,depth])=>depth+span*k));
      controls.target.copy(buildingTarget);camera.position.copy(buildingTarget).addScaledVector(buildingDirection.clone().normalize(),distance);
      camera.lookAt(buildingTarget);controls.update();touched=false;draw();return;
    }
    let box=detailBounds.clone();
    if(detail&&preset==='head'){box.min.y=2.88;box.max.y=3.35;}
    if(detail&&preset==='sill'){box.min.y=-.33;box.max.y=.19;}
    frame(camera,controls,box,detailDirection,1.12);touched=false;draw();
  }
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(!touched)home();else draw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
  const files=detail?['detail']:buildingFiles;
  const models=await Promise.all(files.map(file=>loader.loadAsync(localAsset(file))));
  const items=[];
  for(const model of models){
    scene.add(model.scene);model.scene.traverse(item=>{
      if(!item.isMesh&&!item.isLine)return;
      item.castShadow=item.isMesh&&!item.material.transparent;item.receiveShadow=item.isMesh;
      if(item.material.transparent){item.material.depthWrite=false;item.material.forceSinglePass=true;}
      items.push(item);
    });
  }
  scene.updateMatrixWorld(true);if(renderer.software)renderer.prepare(items);
  if(detail){
    const focusButtons=card.querySelectorAll('[data-focus]');
    for(const button of focusButtons)button.onclick=()=>{
      preset=button.dataset.focus;focusButtons.forEach(b=>selected(b,b===button));home();
    };
  }else{
    const clips={plan:{plane:new T.Plane(new T.Vector3(0,-1,0),3)},section:{plane:new T.Plane(new T.Vector3(-1,0,0),0)}};
    const materials=new Set(items.map(item=>item.material));
    function apply() {
      const entries=Object.values(clips),active=entries.filter(e=>e.active).map(e=>e.plane);
      for(const material of materials){material.clippingPlanes=active;material.clipShadows=true;}
      for(const e of entries){
        if(e.active&&!e.cap&&!renderer.software)e.cap=cutCaps(scene,renderer,items,e.plane,e===clips.plan?3:4);
        if(e.cap)e.cap(e.active,active.filter(p=>p!==e.plane));
      }
      renderer.shadowMap.needsUpdate=true;draw();
    }
    for(const [name,e] of Object.entries(clips)){
      e.active=false;e.button=card.querySelector('[data-cut="'+name+'"]');e.row=card.querySelector('[data-slider="'+name+'"]');
      e.range=e.row.querySelector('input');e.output=e.row.querySelector('output');
      e.button.onclick=()=>{e.active=!e.active;e.row.hidden=!e.active;selected(e.button,e.active);apply();};
      e.range.oninput=()=>{e.plane.constant=Number(e.range.value);e.output.textContent=e.plane.constant.toFixed(2)+' m';apply();};
    }
    const resetLayers=layerControls(card,items,apply);
    card.querySelector('[data-reset]').onclick=()=>{
      for(const e of Object.values(clips)){e.active=false;e.row.hidden=true;e.range.value=e.range.defaultValue;
        e.plane.constant=Number(e.range.value);e.output.textContent=e.plane.constant.toFixed(2)+' m';selected(e.button,false);}
      resetLayers();home();
    };
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();status.textContent='3D display interrupted. Reload to resume.';status.hidden=false;card.querySelector('.ribo-poster').hidden=false;});
  canvas.addEventListener('webglcontextrestored',()=>{renderer.shadowMap.needsUpdate=true;draw();status.hidden=true;card.querySelector('.ribo-poster').hidden=true;});
  ready=true;resize();renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
  status.hidden=true;card.querySelector('.ribo-poster').hidden=true;toolbar.forEach(button=>button.disabled=false);card.dataset.ready='true';
}
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
    if(!entry.isIntersecting)continue;
    const card=entry.target;observer.unobserve(card);
    start(card).catch(error=>{
      console.error('RIBO model viewer:',error);
      const status=card.querySelector('.ribo-status');status.textContent=/WebGL/i.test(error.message)?'3D requires WebGL 2.':'The 3D model could not load.';
      card.querySelectorAll('.ribo-tools button').forEach(b=>b.disabled=true);
      if(!/WebGL/i.test(error.message)){
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>window.location.reload();card.querySelector('.ribo-tools').append(retry);
      }
    });
  }
},{rootMargin:'350px'});
document.querySelectorAll('.ribo-card').forEach(card=>{setExpanded(card);observer.observe(card);});
