import {channel} from './cloud-channel.js?v=2';
import {AtlasViewer} from './viewer.js?v=6c0afe0a61';
const match=/^#([0-9a-f-]{36})\.([0-9a-f-]{36})$/.exec(location.hash);
if(match)launch(match[1],match[2]);
async function launch(id,key){
 history.replaceState(null,'',location.pathname);
 const viewport=document.getElementById('remote-viewport');
 const canvas=document.getElementById('canvas-box');
 let serial=0,lastImage=-1,encoding=false;
 const exportCanvas=document.createElement('canvas');exportCanvas.width=1280;exportCanvas.height=720;
 const bitmap=exportCanvas.getContext('2d',{alpha:false});
 let viewer, ready=false, failed=false, annotations=false, lastPose='', poseTimer, lastSent=0;
 const link=channel(id,key,message=>{
  if(message.type==='peer'||message.type==='hello'){snapshot();return;}
  if(message.type!=='control'||!ready)return;
  const a=Array.isArray(message.args)?message.args:[];
  switch(message.name){
   case 'frame':capture();break;
   case 'enter':{
    const c=viewer.renderer.domElement,r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('dblclick',{button:0,clientX:r.left+a[0]*r.width/1280,clientY:r.top+a[1]*r.height/720}));
    break;
   }
   case 'drag':
    if(viewer.walkMode?.active)viewer.walkMode.look(a[0],a[1]);
    else if(a[2]){viewer.controls._pan(a[0],a[1]);viewer.controls.update();}
    else viewer.orbit(-a[0]*.006,-a[1]*.006);
    break;
   case 'layers':
    viewer.hidden=new Set(a[0].filter(p=>viewer.paths.has(p)));
    viewer.hiddenCity=new Set(a[1].filter(p=>viewer.cityPaths.has(p)));
    viewer.applyModes();break;
   case 'city':viewer.setCity(!!a[0]);break;
   case 'edges':viewer.setContextEdges(!!a[0]);break;
   case 'colors':viewer.setBuildingColors(!!a[0]);break;
   case 'mode':if(['material','clay'].includes(a[0]))viewer.setMode(a[0]);break;
   case 'camera':viewer.view(a[0]);break;
   case 'zoom':viewer.changeZoom(a[0]);break;
   case 'orbit':viewer.orbit(a[0],a[1]);break;
   case 'lens':viewer.setDollyZoom(a[0]);break;
   case 'sun':viewer.setSun(a[0],a[1],a[2]);break;
   case 'tones':viewer.setShadowTones(...a);break;
   case 'receivers':viewer.setShadowReceivers(...a);break;
   case 'shadows':viewer.setShadows(!!a[0]);break;
   case 'street':document.getElementById('street-start').click();break;
   case 'exit':viewer.walkMode?.exit();break;
   case 'walkKey':if(viewer.walkMode?.active && ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','Space','KeyF','Escape'].includes(a[0]))viewport.dispatchEvent(new KeyboardEvent(a[1]?'keydown':'keyup',{code:a[0],shiftKey:viewer.walkMode.held.has('ShiftLeft'),bubbles:true}));break;
   case 'annotations':annotations=!!a[0];lastPose='';pose();break;
  }
  if(['camera','lens','zoom','orbit'].includes(message.name))link.send({type:'lens',value:viewer.getDollyZoom()});
 },()=>{});
 function pose(){
  if(!annotations||!ready)return;
  const elapsed=performance.now()-lastSent;
  if(elapsed<100){clearTimeout(poseTimer);poseTimer=setTimeout(pose,101-elapsed);return;}
  const c=viewer.camera;c.updateMatrixWorld();
  const p=[c.projectionMatrix.toArray(),c.matrixWorldInverse.toArray()],serialized=JSON.stringify(p);
  if(serialized===lastPose)return;
  lastPose=serialized;lastSent=performance.now();link.send({type:'pose',p});
 }
 async function capture(){
  if(encoding)return;
  if(lastImage===serial){link.send({type:'still'});return;}
  encoding=true;
  try{
   if(viewer.renderer.isWebGLRenderer)viewer.drawNow(performance.now());
   else await viewer.renderer.wait?.();
   const revision=serial;
   bitmap.drawImage(viewer.renderer.domElement,0,0,1280,720);
   const blob=await new Promise(resolve=>exportCanvas.toBlob(resolve,'image/jpeg',.78));
   if(blob && blob.size<=500000){link.sendFrame(await blob.arrayBuffer());lastImage=revision;}
   else link.send({type:'still'});
  }finally{encoding=false;}
 }
 function snapshot(){
  if(failed){link.send({type:'error'});return;}
  if(!ready)return;
  link.send({type:'ready',paths:[...viewer.paths.keys()],cityPaths:[...viewer.cityPaths],hidden:[...viewer.hidden],hiddenCity:[...viewer.hiddenCity],cityVisible:viewer.cityVisible,contextEdges:viewer.contextEdges,buildingColors:viewer.buildingColors,mode:viewer.mode,lens:viewer.getDollyZoom()});
 }
 try{
  const r=await fetch('./models/catalog.json',{cache:'no-cache'});if(!r.ok)throw Error();
  const catalog=await r.json(),model=catalog.projects.find(p=>p.key==='ava-barbat');
  viewer=new AtlasViewer(canvas);const result=await viewer.show(model,catalog.city?.url||'./models/ann-arbor.glb');
  if(!result||result.cityError)throw Error();
  viewer.annotations={draw:()=>{serial++;pose();}};viewer.draw();await new Promise(requestAnimationFrame);await viewer.renderer.wait?.();
  ready=true;snapshot();
  new MutationObserver(()=>link.send({type:'walking',value:viewport.dataset.walking||'',hint:document.getElementById('walk-door-hint').hidden?'':document.getElementById('walk-door-hint').textContent})).observe(viewport,{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['data-walking','hidden']});
 }catch{failed=true;snapshot();}
 // The renderer can finish loading before either side has connected.

}
