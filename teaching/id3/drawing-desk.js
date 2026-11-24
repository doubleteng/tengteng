import { Vector3, Matrix4 } from './lib/three.module.min.js';
import { createModelDrawingSource } from './model-drawings.js?v=53997717f2';

const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const views = {front:['z',2,'Front'],back:['z',2,'Back'],left:['x',0,'Left'],right:['x',0,'Right']};
const meters = value => `${Number(value).toFixed(2)} m`;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

// Horizontal top faces of floor meshes supply optional cut-height shortcuts.
// An unnamed or unlayered model can always use the continuous datum slider.
function floorCandidates(root) {
 const bins = new Map(), a = new Vector3(), b = new Vector3(), c = new Vector3();
 const matrix = new Matrix4(), instance = new Matrix4();
 root.traverseVisible(mesh => {
  if(!mesh.isMesh || !mesh.geometry.attributes.position)return;
  for(let o=mesh;o;o=o.parent)if(o.userData.drawingSupport)return;
  const layer = mesh.userData.atlasPath || mesh.userData.layer || mesh.name || '';
  if(!/floor|slab|studios and bridges|forum and terraces|楼板|樓板|楼面/i.test(layer) ||
     /beam|girder|roof|joist|saddle|seat|frame|hanger|foundation/i.test(layer))return;
  const ground = /(?:public |ground[ _/-]*)floor|ground slab|首层/i.test(layer) && !/lower|basement/i.test(layer);
  const {index,attributes} = mesh.geometry, pos = attributes.position;
  const count = index ? index.count : pos.count, instances = mesh.isInstancedMesh ? mesh.count : 1;
  for(let k=0;k<instances;k++){
   matrix.copy(mesh.matrixWorld);
   if(mesh.isInstancedMesh){mesh.getMatrixAt(k,instance);matrix.multiply(instance);}
   const read=(v,i)=>v.fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(matrix);
   for(let i=0;i+2<count;i+=3) {
    read(a,i);read(b,i+1);read(c,i+2);
    if(Math.max(a.y,b.y,c.y)-Math.min(a.y,b.y,c.y)>.025)continue;
    const area=((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z))*.5;
    if(area<=.00001)continue;
    const y=(a.y+b.y+c.y)/3, key=Math.round(y*20);
    if(!bins.has(key))bins.set(key,{area:0,x:0,y:0,z:0,ground:0});
    const bin=bins.get(key);bin.area+=area;bin.y+=area*y;
    bin.x+=area*(a.x+b.x+c.x)/3;bin.z+=area*(a.z+b.z+c.z)/3;
    if(ground)bin.ground+=area;
   }
  }
 });
 const candidates=[...bins.values()].sort((a,b)=>b.area-a.area), levels=[];
 for(const q of candidates) {
  if(q.area<Math.max(1,candidates[0].area*.045))break;
  const h=q.y/q.area;
  if(levels.every(l=>Math.abs(h-l.y)>1.4))
   levels.push({y:h,x:q.x/q.area,z:q.z/q.area,ground:q.ground,area:q.area});
 }
 return levels.sort((a,b)=>a.y-b.y);
}

function svgNode(tag,attributes,text){
 const el=document.createElementNS(svgNS,tag);
 for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));
 if(text!==undefined)el.textContent=text;
 return el;
}

function downloadSheet(result,project,title,subtitle) {
 const [x,y,w,h]=result.viewBox, units=result.metresPerUnit||1;
 const denominator=[20,50,100,200,250,500,1000,2000,5000].find(n=>w*units*1000/n<355 && h*units*1000/n<220) || 10000;
 const mm=1000*units/denominator, W=Math.max(w*mm+20,185), H=h*mm+35;
 const sheet=svgNode('svg',{width:W+'mm',height:H+'mm',viewBox:`0 0 ${W} ${H}`});
 sheet.append(svgNode('title',{},project+' · '+title),svgNode('desc',{},subtitle),svgNode('rect',{width:W,height:H,fill:'#ffffff'}));
 const image=new DOMParser().parseFromString(result.svg,'image/svg+xml').documentElement;
 for(const [key,value] of Object.entries({x:(W-w*mm)/2,y:4,width:w*mm,height:h*mm,viewBox:[x,y,w,h].join(' ')}))image.setAttribute(key,String(value));
 sheet.append(image);
 const base=H-23;
 sheet.append(svgNode('line',{x1:8,x2:W-8,y1:base,y2:base,stroke:'#506463','stroke-width':.3}));
 const font={'font-family':'Arial, sans-serif',fill:'#243a3b'};
 sheet.append(svgNode('text',{...font,x:8,y:base+6,'font-size':3.4,'font-weight':700},project+' · '+title),
             svgNode('text',{...font,x:8,y:base+12,'font-size':2.8},subtitle),
             svgNode('text',{...font,x:8,y:base+17,'font-size':2.8},'1:'+denominator+' at original size'));
 const maxLength=(W*.25)*denominator/1000;
 const decade=10**Math.floor(Math.log10(maxLength));const mag=maxLength/decade;
 const bar=(mag>=5?5:mag>=2?2:1)*decade, length=bar*1000/denominator;
 const left=W-8-length, right=W-8, by=base+15;
 sheet.append(svgNode('path',{d:`M${left} ${by-1.4}v2.8m0 -1.4H${right}m0 -1.4v2.8`,fill:'none',stroke:'#263a3b','stroke-width':.45}),
             svgNode('text',{...font,x:left,y:by-2.4,'font-size':2.8},'0'),
             svgNode('text',{...font,x:right,y:by-2.4,'font-size':2.8,'text-anchor':'end'},bar+' m'));
 const blob=new Blob([new XMLSerializer().serializeToString(sheet)],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=(project+'-'+title+'-'+subtitle).replace(/[^\p{L}\p{N}−.+-]+/gu,'-').slice(0,130)+'.svg';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export function bindDrawingDesk({getModel,getProjects,selectProject}){
 const dialog=$('drawing-dialog'), image=$('drawing-image'), paper=$('drawing-paper');
 const projectInput=$('drawing-project'),direction=$('drawing-direction'),cut=$('drawing-cut'),level=$('drawing-level');
 const scale=$('drawing-scale'), scaleLine=$('drawing-scale-line'), scaleLabel=$('drawing-scale-label');
 const title=$('drawing-title'),meta=$('drawing-meta'),save=$('drawing-save'),status=$('drawing-status');
 let source=null, result=null, model=null, levels=[], primary=null, type='plan', generation=0, timer=0, offsets={};
 let zoomBox=null, drag=null;
 const say=text=>{status.textContent=text;status.hidden=!text;};
 function release(){
  ++generation;clearTimeout(timer);source?.dispose();source=null;model=null;result=null;save.disabled=true;
  image.replaceChildren();scale.hidden=true;zoomBox=null;drag=null;
 }
 function populateCut(){
  if(!source)return;
  const elevation=type==='elevation', plan=type==='plan';
  const [axis,idx]=plan?['y',1]:views[direction.value];
  $('drawing-direction-row').hidden=plan;$('drawing-cut-row').hidden=elevation;
  $('drawing-level-row').hidden=!plan||!levels.length;
  if(!elevation){
   const lo=source.bounds.min[idx], hi=source.bounds.max[idx], span=hi-lo;
   cut.min=lo;cut.max=hi;cut.step=Math.max(.001,Math.min(.05,span/2000));
   if(offsets[axis]===undefined){
    const first=plan ? (primary?primary.y+1.2:lo+Math.min(1.2,span*.35)) : (primary?primary[axis]:(lo+hi)/2);
    offsets[axis]=clamp(first,lo+span*.001,hi-span*.001);
   }
   cut.value=offsets[axis];cut.disabled=span<.002;offsets[axis]=Number(cut.value);
   $('drawing-cut-label').textContent=plan?'Cut height':`Cut at ${axis.toUpperCase()}`;
   $('drawing-cut-value').textContent=meters(cut.value);
   cut.setAttribute('aria-valuetext',meters(cut.value)+' on the model '+axis.toUpperCase()+' axis');
   if(plan){const found=levels.findIndex(l=>Math.abs(l.y+1.2-offsets.y)<.055);level.value=found<0?'custom':String(found);}
  }
  const dir=views[direction.value][2];
  title.textContent=plan?'Floor plan':elevation?dir+' elevation':'Building section';
  meta.textContent=plan?'Horizontal cut at Y = '+meters(offsets.y):elevation?'Viewed from '+dir.toLowerCase()+' · project axes':
    'Cut at '+axis.toUpperCase()+' = '+meters(offsets[axis])+' · viewed from '+dir.toLowerCase();
 }
 async function render(seq){
  if(!source||!dialog.open||seq!==generation)return;
  const [axis]=views[direction.value];
  try{
   const data=await source.render({type,direction:type==='plan'?'top':direction.value,axis,offset:type==='plan'?offsets.y:offsets[axis],title:title.textContent});
   if(seq!==generation||!dialog.open)return;
   const el=new DOMParser().parseFromString(data.svg,'image/svg+xml').documentElement;
   if(el.localName!=='svg')throw Error('Invalid drawing');
   el.setAttribute('role','img');el.setAttribute('aria-label',model.title+' · '+title.textContent);
   image.replaceChildren(el);result=data;zoomBox=[...result.viewBox];updateScale();say('');save.disabled=false;
  }catch(e){if(seq===generation){image.replaceChildren();result=null;save.disabled=true;say('This view could not be drawn. Try another cut or enable more model layers.');}}
 }
 function queue(delay=0){
  clearTimeout(timer);populateCut();result=null;save.disabled=true;
  const seq=++generation;say('Drawing…');
  timer=setTimeout(()=>render(seq),delay);
 }
 async function load(key){
  release();say('Loading model…');const seq=generation;
  try{
   let active=getModel();
   if(!active?.root||active.item.key!==key){await selectProject(key);active=getModel();}
   if(seq!==generation||!dialog.open)return;
   if(!active?.root||active.item.key!==key)throw Error('Missing project');
   model=active.item;source=createModelDrawingSource(active.root);levels=floorCandidates(active.root);
   primary=[...levels].sort((a,b)=>b.ground-a.ground||b.area-a.area)[0];
   level.replaceChildren(new Option('Custom cut','custom'),...levels.map((l,i)=>new Option(meters(l.y),String(i))));
   offsets={};queue();
  }catch(e){if(seq===generation)say('No visible building geometry. Return to the model and enable a project layer.');}
 }
 function setType(kind){
  type=kind;
  for(const btn of dialog.querySelectorAll('[data-drawing]'))btn.setAttribute('aria-pressed',String(btn.dataset.drawing===type));
  if(source)queue();
 }
 function show(){
  if(dialog.open)return;
  const projects=getProjects();if(!projects.length)return;
  const active=getModel();projectInput.replaceChildren(...projects.map(p=>new Option(p.title,p.key)));
  projectInput.value=projects.some(p=>p.key===active?.item.key)?active.item.key:projects[0].key;
  dialog.showModal();setType('plan');load(projectInput.value);
 }

 $('drawing-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',release);
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 projectInput.onchange=()=>load(projectInput.value);
 for(const btn of dialog.querySelectorAll('[data-drawing]'))btn.onclick=()=>setType(btn.dataset.drawing);
 direction.onchange=()=>queue();
 cut.oninput=()=>{const axis=type==='plan'?'y':views[direction.value][0];offsets[axis]=Number(cut.value);queue(130);};
 level.onchange=()=>{if(level.value==='custom'){cut.focus();return;}offsets.y=levels[Number(level.value)].y+1.2;queue();};
 save.onclick=()=>{if(result&&model)downloadSheet(result,model.title,title.textContent,meta.textContent);};
 function updateScale(){
  const transform=image.firstElementChild?.getScreenCTM();
  if(!result || !transform){scale.hidden=true;return;}
  const pixelsPerMetre=Math.hypot(transform.a,transform.b)/(result.metresPerUnit||1);
  if(!(pixelsPerMetre>0)){scale.hidden=true;return;}
  const target=95/pixelsPerMetre, dec=10**Math.floor(Math.log10(target)), magnitude=target/dec;
  const length=(magnitude>=5?5:magnitude>=2?2:1)*dec;
  scaleLine.style.width=(length*pixelsPerMetre)+'px';
  scaleLabel.textContent=Number(length.toPrecision(3))+' m';scale.hidden=false;
 }
 new ResizeObserver(updateScale).observe(image);
 function writeBox(){image.firstElementChild?.setAttribute('viewBox',zoomBox.join(' '));updateScale();}
 function position(e){
  const svg=image.firstElementChild, m=svg?.getScreenCTM();
  return m ? new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()) : null;
 }
 function zoom(factor,p){
  if(!result)return;
  const [x,y,w,h]=zoomBox;
  const next=clamp(w*factor,result.viewBox[2]/32,result.viewBox[2]*2);
  const f=next/w, cx=p?.x??x+w/2, cy=p?.y??y+h/2;
  zoomBox=[cx+(x-cx)*f,cy+(y-cy)*f,next,h*f];writeBox();
 }
 $('drawing-zoom-in').onclick=()=>zoom(1/1.35);$('drawing-zoom-out').onclick=()=>zoom(1.35);
 $('drawing-fit').onclick=()=>{if(result){zoomBox=[...result.viewBox];writeBox();}};
 image.addEventListener('wheel',e=>{if(!result)return;e.preventDefault();zoom(Math.exp(clamp(e.deltaY,-250,250)*.002),position(e));},{passive:false});
 image.onpointerdown=e=>{if(!result||e.button!==0)return;const p=position(e);if(!p)return;image.setPointerCapture(e.pointerId);drag={id:e.pointerId,p};};
 image.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||!result)return;const p=position(e);if(!p)return;
  zoomBox[0]+=drag.p.x-p.x;zoomBox[1]+=drag.p.y-p.y;writeBox();};
 image.onlostpointercapture=()=>{drag=null;};
 paper.onkeydown=e=>{if(e.target!==paper||!result)return;
  if(e.key==='+'||e.key==='=')zoom(1/1.35);else if(e.key==='-')zoom(1.35);else if(e.key==='0')$('drawing-fit').click();
  else if(e.key.startsWith('Arrow')){const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   if(!dirs[e.key])return;zoomBox[0]+=dirs[e.key][0]*zoomBox[2]*.1;zoomBox[1]+=dirs[e.key][1]*zoomBox[3]*.1;writeBox();}
  else return;e.preventDefault();
 };
 return {show};
}
