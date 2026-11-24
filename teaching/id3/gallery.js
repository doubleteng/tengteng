import {AtlasViewer} from './viewer.js?v=8b42cc34ee';
import {SiteAnnotations} from './annotations.js';
import {bindSunlight} from './sun-controls.js?v=cf14de4ba5';
const originalCity='./models/ann-arbor.glb';
const overview={key:'site',title:'Ann Arbor Farmers Market',type:'Urban context',overview:true,cover:'./models/ann-arbor.webp'};
const $=id=>document.getElementById(id);
const samples=[
 {key:'northlight',title:'Northlight Hall',material:'Mass timber',type:'Market hall'},
 {key:'arcade',title:'Vaulted Arcade',material:'Precast concrete',type:'Market hall'},
 {key:'lattice',title:'Open Bay Market',material:'Steel',type:'Market hall'}
].map(x=>({...x,demo:true,url:'./models/'+x.key+'.glb',cover:'./models/'+x.key+'.webp'}));
const defaults=['Structure','Enclosure','Site','Interior'];
const colorSet={'Design site':'#c6815c',Structure:'#b67249',Enclosure:'#7d897b',Site:'#9fa581',Interior:'#b1a185','Urban context':'#b7b9af'};
let cases=[],caseHidden=null;
let actual=[],cityRecord=null,items=samples,current,viewer,version=0,expanded=false;
let activeLoad;
let deskPromise;
const dollyButton=$('dolly-toggle'),dollyPanel=$('dolly-panel'),lens=$('dolly-lens');
function closeLens(){
 dollyPanel.hidden=true;dollyButton.setAttribute('aria-expanded','false');
}
function syncLens(){
 const value=viewer?.project?viewer.getDollyZoom():null;
 dollyButton.disabled=value==null;
 if(value==null){closeLens();return;}
 lens.value=value;$('lens-value').textContent=Math.round(value)+'°';
 lens.setAttribute('aria-valuetext',Math.round(value)+' degree field of view');
}
dollyButton.onclick=()=>{
 dollyPanel.hidden=!dollyPanel.hidden;
 dollyButton.setAttribute('aria-expanded',String(!dollyPanel.hidden));
 if(!dollyPanel.hidden){syncLens();lens.focus({preventScroll:true});}
};
lens.oninput=()=>{if(viewer?.project){viewer.setDollyZoom(Number(lens.value));syncLens();}};
document.addEventListener('pointerdown',e=>{if(!dollyPanel.hidden&&!dollyPanel.contains(e.target)&&!dollyButton.contains(e.target))closeLens();});
dollyPanel.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();closeLens();dollyButton.focus();}};
$('open-drawings').onclick=async()=>{
 try{
  deskPromise??=import('./drawing-desk.js?v=6e490f8e05').then(({bindDrawingDesk})=>bindDrawingDesk({
   getModel:()=>viewer?.project?{root:viewer.project,item:current}:null,
   getProjects:()=>items,
   selectProject:async key=>{
    if(current?.key===key&&activeLoad)await activeLoad;
    else {const project=items.find(p=>p.key===key);if(project)await selectModel(project);}
   }
  }));
  (await deskPromise).show();
 }catch{deskPromise=null;status('The drawing tools could not load. Please try again.');}
};
const status=(s)=>{const el=$('viewer-message');el.textContent=s;el.hidden=!s;};
const activate=()=>{if(viewer?.project)$('poster').hidden=true;};
function getViewer(){
 if(!viewer){
  viewer=new AtlasViewer($('canvas-box'),activate);
  viewer.annotations=new SiteAnnotations(viewer,layerRow);
 }
 return viewer;
}
function txt(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function tab(which){
 for(const [t,id] of [['layers','layer-panel'],['annotations','annotations-panel']]){
  $('tab-'+t).setAttribute('aria-selected',String(t===which));$(id).hidden=t!==which;
 }
}
$('tab-layers').onclick=()=>tab('layers');
$('tab-annotations').onclick=()=>{tab('annotations');getViewer().activate();};
$('district-plan').onclick=()=>withModel(v=>{$('camera').value='district';v.view('district');syncLens();saveViewLink();});
$('annotation-sources').onclick=()=>info('sources');
function setPoster(model){
 const p=$('poster');p.hidden=!model.cover;if(model.cover){p.src=model.cover;p.alt=model.title+' architectural model';}
}
function drawCards(){
 const container=$('cards');container.replaceChildren();
 for(const x of items){
  const btn=txt('button','','card');btn.setAttribute('aria-pressed',String(x.key===current?.key));btn.setAttribute('aria-label','View '+x.title);
  const art=txt('span','','card-art');if(x.cover){const img=new Image();img.src=x.cover;img.alt='';img.loading='lazy';art.append(img);}else art.append(txt('span','3D model','fallback-art'));
  if(x.key===current?.key)art.append(txt('span','IN VIEW','card-active'));
  btn.append(art,txt('span',x.title,'card-title'),txt('span',x.overview?'Kerrytown / Ann Arbor, Michigan':x.caseStudy?'Teaching case · '+x.material:x.demo?x.material+' / '+x.type:x.author+' · '+x.material,'card-meta'));
  btn.onclick=()=>{selectModel(x);$('gallery').scrollIntoView({block:'start',behavior:'smooth'});};container.append(btn);
 }
 $('index-title').textContent=actual.length?'Student projects and cases':'Projects and studies';
 const caseCount=cases.length?' · '+cases.length+' teaching '+(cases.length===1?'case':'cases'):'';
 $('count').textContent=(actual.length?actual.length+' / 14 student projects':samples.length+' demonstration models')+caseCount;
}
function grouped(paths){
 const groups=new Map();
 for(const path of paths){
  let g=path.split(/\s*(?:\/|::)\s*/)[0];
  if(/struct|framing|column|beam|truss|结构/i.test(g))g='Structure';
  else if(/enclos|envelop|facad|cladd|curtain|roof|围护/i.test(g))g='Enclosure';
  else if(/site|landscap|terrain|pav|场地/i.test(g))g='Site';
  else if(/interior|furn|program|室内/i.test(g))g='Interior';
  if(!groups.has(g))groups.set(g,[]);groups.get(g).push(path);
 }
 return new Map([...groups].sort(([a],[b])=>(defaults.includes(a)?defaults.indexOf(a):20)-(defaults.includes(b)?defaults.indexOf(b):20)||a.localeCompare(b)));
}
function layerRow(name,checked,color,change,sub=false,mixed=false){
 const l=txt('label','','layer-row'+(sub?' sub':'')),s=txt('span',''),c=txt('i','','swatch');
 c.style.background=color;s.append(c,document.createTextNode(name));const input=document.createElement('input');input.type='checkbox';input.checked=checked;input.indeterminate=mixed;input.setAttribute('aria-label',name);input.onchange=()=>change(input.checked);l.append(s,input);return l;
}
function fillLayers(){
 const box=$('layer-list');box.replaceChildren();
 const paths=viewer?.project&&viewer.paths?[...viewer.paths.keys()]:defaults;
 for(const [group,members] of grouped(paths)){
  const enabled=members.filter(p=>!viewer?.hidden.has(p)).length;
  box.append(layerRow(group,enabled>0,colorSet[group]||'#8d927e',async yes=>{await activeLoad;if(viewer?.project){viewer.setPaths(members,yes);fillLayers();}},false,enabled>0&&enabled<members.length));
  if(expanded)for(const path of members)box.append(layerRow(path.split(/\s*(?:\/|::)\s*/).at(-1),!viewer?.hidden.has(path),colorSet[group]||'#8d927e',yes=>{viewer.setPaths([path],yes);fillLayers();},true));
 }
 if(current){
  box.append(layerRow('Urban context',viewer?.cityVisible!==false,colorSet['Urban context'],async yes=>{await activeLoad;if(viewer?.project){viewer.setCity(yes);fillLayers();}}));
  if(viewer?.cityVisible)box.append(layerRow('Context edges',viewer.contextEdges,'#665f56',yes=>viewer.setContextEdges(yes),true));
  if(viewer?.cityVisible&&viewer.cityURL===originalCity)box.append(layerRow('Context building colors',viewer.buildingColors,'#a37861',yes=>viewer.setBuildingColors(yes),true));
  if(expanded&&viewer?.cityVisible)for(const path of viewer.cityPaths)box.append(layerRow(path,!viewer.hiddenCity.has(path),colorSet['Urban context'],yes=>{viewer.activate();if(yes)viewer.hiddenCity.delete(path);else viewer.hiddenCity.add(path);viewer.applyModes();fillLayers();},true));
 }
 $('details-btn').textContent=expanded?'Collapse':'Expand';
}
function saveViewLink(){
 const camera=$('camera').value;
 const preset=camera==='perspective'?'':'?view='+encodeURIComponent(camera);
 history.replaceState(null,'','#model-'+current.key+preset);
}
async function selectModel(x,initialView='perspective',updateLink=true){
 const seq=++version;current=x;caseHidden=null;closeLens();dollyButton.disabled=true;
 $('case-actions').hidden=!x.caseStudy;$('case-frame').setAttribute('aria-pressed','false');$('case-frame').textContent='Isolate timber frame';
 $('case-cameras').disabled=$('case-cameras').hidden=!x.caseStudy;expanded=false;setPoster(x);status('');drawCards();$('site-view').textContent=x.overview?'Shared site in view':'View shared site';$('site-view').disabled=!!x.overview;
 $('model-title').textContent=x.title;$('model-kind').textContent=x.overview?'SHARED URBAN MODEL':x.caseStudy?'ID3 TEACHING CASE':x.demo?'DEMONSTRATION MODEL':'STUDIO PROJECT '+x.key;
 $('model-author').textContent=x.overview?'Kerrytown / Ann Arbor, Michigan':x.caseStudy?x.material+' · Market and public institution':x.demo?x.material+' / '+x.type:x.author+' · '+x.material;
 $('camera').disabled=true;$('camera').value='perspective';$('viewport').setAttribute('aria-busy','true');
 const city=cityRecord?.url || originalCity;
 $('context-cameras').disabled=$('context-cameras').hidden=city!==originalCity;
 try{
  const view=getViewer();const job=view.show(x,city);activeLoad=job;fillLayers();const result=await job;if(!result||seq!==version)return;
  $('material-mode').value=view.mode;$('material-references').hidden=city!==originalCity;fillLayers();
  // Keep the cover during loading, then reveal the first frame of the true perspective view.
  requestAnimationFrame(async()=>{
   if(view.renderer.wait)await view.renderer.wait();
   if(seq===version)activate();
  });
  sunControls.apply(false);updateTones();updateReceivers();
  if(result.cityError)status('The urban model could not load. Reload to try again.');
  const option=Array.from($('camera').options).find(o=>o.value===initialView);
  if(option&&initialView!=='perspective'&&!option.parentElement.disabled){
   $('camera').value=initialView;view.view(initialView,false);
  }
  syncLens();if(updateLink)saveViewLink();
 }catch(e){if(seq===version)status('Interactive view unavailable. '+(e.message?.includes('WebGL')?'Enable WebGL in your browser to orbit the model.':'Reload to try again.'));}
 finally{if(seq===version){$('open-drawings').disabled=!items.length;$('camera').disabled=false;$('viewport').setAttribute('aria-busy','false');}}
}
$('details-btn').onclick=()=>{expanded=!expanded;fillLayers();};
async function withModel(fn){try{await activeLoad;if(viewer?.project)fn(viewer);}catch{status('The interactive model is unavailable.');}}
$('camera').onchange=()=>withModel(v=>{v.view($('camera').value);syncLens();saveViewLink();});
function fitProject(v){
 const camera=$('camera');
 if(v.caseStudy)camera.value='perspective';
 v.view(camera.value);syncLens();saveViewLink();
}
$('fit').onclick=()=>withModel(fitProject);
$('zin').onclick=()=>withModel(v=>v.changeZoom(1.22));$('zout').onclick=()=>withModel(v=>v.changeZoom(1/1.22));
$('material-mode').onchange=()=>withModel(v=>v.setMode($('material-mode').value));
const sunControls=bindSunlight((azimuth,altitude,interactive)=>viewer?.setSun(azimuth,altitude,interactive));
function updateTones(){
 const light=Number($('shadow-light').value),dark=Number($('shadow-dark').value);
 $('light-value').textContent=light;$('dark-value').textContent=dark;
 viewer?.setShadowTones(light,dark);
}
$('shadow-light').oninput=$('shadow-dark').oninput=updateTones;
function updateReceivers(){
 const enabled=$('shadows').checked;
 $('shade-faces').disabled=$('shade-ground').disabled=!enabled;
 viewer?.setShadowReceivers($('shade-faces').checked,$('shade-ground').checked);
}
$('shade-faces').onchange=$('shade-ground').onchange=updateReceivers;
$('site-view').onclick=()=>{selectModel(overview);$('gallery').scrollIntoView({block:'start',behavior:'smooth'});};
$('shadows').onchange=()=>withModel(v=>{v.setShadows($('shadows').checked);updateReceivers();});
$('full').onclick=async()=>{const el=$('viewport');if(document.fullscreenElement){await document.exitFullscreen();return;}if(el.classList.contains('expanded')){el.classList.remove('expanded');return;}try{await el.requestFullscreen();}catch{el.classList.add('expanded');}};
$('viewport').onkeydown=e=>{if(e.target!==$('viewport'))return;
 const actions={ArrowLeft:v=>v.orbit(-.1,0),ArrowRight:v=>v.orbit(.1,0),ArrowUp:v=>v.orbit(0,-.08),ArrowDown:v=>v.orbit(0,.08),'+':v=>v.changeZoom(1.2),'=':v=>v.changeZoom(1.2),'-':v=>v.changeZoom(1/1.2),'0':fitProject};
 if(actions[e.key]){e.preventDefault();withModel(actions[e.key]);}if(e.key==='Escape')$('viewport').classList.remove('expanded');
};
$('viewport').addEventListener('pointerdown',e=>{if(!e.target.closest('button,select')&&!viewer?.project)status('Loading the 3D model…');});
$('material-references').onclick=async()=>{
 const body=$('info-content');body.innerHTML='<p class="kicker"><i></i> URBAN CONTEXT</p><h2>Building materials</h2><p>Kerrytown District photographs document the street-facing windows, storefronts, porches and masonry shown below. The city’s 2026 aerial imagery locates the visible roof features. Open a building’s references to compare its model with the photographs.</p>';
 $('info').showModal();
 try{
  const response=await fetch('./models/building-materials.json');if(!response.ok)throw Error();
  const refs=await response.json();
  if(!$('info').open||!body.querySelector('h2')?.textContent.includes('Building materials'))return;
  const list=txt('div','','material-list');
  for(const f of refs){
   const item=txt('div','','material-item'),sw=txt('i','','material-chip');sw.style.background=f.wallColor;
   const col=txt('div','');col.append(txt('strong',f.name),txt('span',f.material));
   for(const part of f.components||[]){
    const row=txt('span','', 'component-material');
    const chip=txt('i','','material-chip');chip.style.background=part.color||part.wallColor;
    row.append(chip,document.createTextNode(part.name+' · '+part.material));
    if(part.capMaterial)row.append(document.createTextNode(', '+part.capMaterial));
    col.append(row);
   }
   const links=txt('div','','material-links');
   for(const [label,url] of [['Reference',f.source],['Street View',f.streetView],...(f.links||[])]){
    if(!url||!/^https:\/\//.test(url)||(label==='Reference'&&url===f.streetView))continue;
    const a=txt('a',label);a.href=url;a.target='_blank';a.rel='noopener';links.append(a);
   }
   col.append(links);item.append(sw,col);list.append(item);
  }
  body.append(list);
 }catch{body.append(txt('p','Reference list could not load. Reopen to try again.'));}
};
const guides={
 sources:'<p class="kicker"><i></i> KERRYTOWN</p><h2>Map sources</h2><p>The 500 × 500 m district is registered to the studio Rhino model using surrounding building outlines. The original model defines the design-site boundary. Municipal footprint and average-height records supply the additional building masses.</p><p>Street trees use municipal inventory locations. Tree crowns are schematic. The original Rhino surfaces define the streets, curbs and planting beds around the market. Municipal pavement edges and city orthophotos supply the ground surfaces farther out. Road direction and total lane count come from individual municipal road segments.</p><p>TheRide stops and routes reflect the November 15, 2026 – January 23, 2027 schedule. Parking outlines show public facilities outside the studio site. County lot boundaries follow the 2026 city aerial, and access hours follow the county facility records. The Fourth &amp; Catherine lot was redeveloped as Dunbar Tower. The curbside layer shows angled parking on Detroit Street and parallel parking on North Fourth Avenue. Bike rack dots follow individual DDA inventory points on Fourth, Fifth and Detroit. Select a bicycle symbol for the number of racks and spaces at that address.</p><div class="map-source-links"><a target="_blank" rel="noopener" href="https://a2maps.a2gov.org/a2arcgis/rest/services/OSI/BuildingFootprints/MapServer/0">Building footprints · Woolpert and City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://a2maps.a2gov.org/a2arcgis/rest/services/CachedBasemaps/BaseMap/MapServer/13">Road centerlines · City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://a2maps.a2gov.org/a2arcgis/rest/services/CachedBasemaps/BaseMap/MapServer/15">Pavement edges · City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://data.a2gov.org/city-of-ann-arbor/street-trees">Street tree inventory · City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://a2maps.a2gov.org/a2arcgis/rest/services/CachedAerials/2026Color/MapServer">2026 orthophoto · City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://kerrytowndistrict.org/photo-gallery">Exterior photographs · Kerrytown District Association</a><a target="_blank" rel="noopener" href="https://www.a2dda.org/parking-map/">Public parking · Ann Arbor DDA</a><a target="_blank" rel="noopener" href="https://a2-mi.maps.arcgis.com/apps/instant/sidebar/index.html?appid=5fc85727c32b4fad997fd8cc42fa7d40">Bicycle parking inventory · Ann Arbor DDA</a><a target="_blank" rel="noopener" href="https://kerrytown.com/visit/">Market-day parking access · Kerrytown</a><a target="_blank" rel="noopener" href="https://www.a2gov.org/parks-and-recreation/parks-and-places/ann-arbor-farmers-market/">Getting to the market · City of Ann Arbor</a><a target="_blank" rel="noopener" href="https://content.civicplus.com/api/assets/69dbdba8-a300-4ecc-8b24-b57276bc9fed">County parking hours · Washtenaw County</a><a target="_blank" rel="noopener" href="https://www.theride.org/business/software-developers">Stops and routes · TheRide</a><a target="_blank" rel="noopener" href="https://www.google.com/maps/@42.2841888,-83.7468859,417m/data=!3m1!1e3">Site location · Google Maps</a></div><p class="annotation-credit">Transit scheduling, geographic, and real-time data provided by permission of AAATA/TheRide</p>',
 guide:'<p class="kicker"><i></i> RHINO SUBMISSION</p><h2>Model guide</h2><h3>One city, fourteen projects</h3><p>The surrounding 500 × 500 m district stays in view across camera settings and student projects. Each student submits one Rhino file containing their building and designed site. Keep the studio template’s origin, north direction and site elevation. Use standard document units such as feet, inches, millimeters or meters.</p><h3>Organize the Rhino layers</h3><p>Use parent layers such as Structure, Enclosure, Site and Interior. Keep specific elements on sublayers, for example Structure::Glulam beams and Enclosure::Glazing. Assign render materials and embed image textures.</p><h3>Prepare the display geometry</h3><p>Open a Shaded viewport and save the .3dm with render meshes. Inspect curved members, panel edges and thin connections before submitting. Avoid “Save small,” which omits the cached meshes. For features the importer cannot reproduce, export a self-contained GLB with materials and layer groups.</p><h3>Explore the model</h3><p>Drag to orbit, right-drag to pan and scroll to zoom. On a touchscreen, drag with one finger or pinch with two. Dolly zoom varies the lens and camera distance together. Open Drawings for a floor plan, elevation or movable section through the visible project layers. Download SVG saves the drawing with a graphic scale. Select Expand under Layers for individual Rhino sublayers. Drag the sun around the compass to change its direction. Drag the sun along the arc to raise or lower it. Open Sunlight above the compass to use an Ann Arbor date and local time. The site center is approximate. The highlighted footprint traces the opening in the Rhino model. True north is estimated from the municipal building footprints at 2.25° west of Rhino +Y. Use Annotations to inspect transit, parking and street segments, or District plan to see the surrounding blocks.</p>'
};
function info(which){$('info-content').innerHTML=guides[which];$('info').showModal();}
$('guideBtn').onclick=()=>info('guide');
$('case-notes').onclick=()=>{
 if(!current?.caseStudy)return;
 $('info-content').replaceChildren($('market-switchback-notes').content.cloneNode(true));$('info').showModal();
};
$('case-frame').onclick=()=>withModel(v=>{
 if(!current?.caseStudy)return;
 if(caseHidden){v.hidden=caseHidden;caseHidden=null;}
 else{
  caseHidden=new Set(v.hidden);
  v.hidden=new Set([...v.paths.keys()].filter(p=>!p.startsWith('Structure /') || /CLT.*roof|cross laminated roof panels|lower-ground slab|public ground floor|eastern plinth|studios and bridges|forum and terraces/i.test(p)));
 }
 v.applyModes();fillLayers();
 $('case-frame').setAttribute('aria-pressed',String(!!caseHidden));
 $('case-frame').textContent=caseHidden?'Restore layers':'Isolate timber frame';
});
document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => button.closest('dialog').close();
});
const infoDialog = $('info');
infoDialog.addEventListener('click', event => { if (event.target === infoDialog) infoDialog.close(); });

async function refresh() {
  const response = await fetch('./models/catalog.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('The exhibition catalog could not be loaded.');
  const catalog = await response.json();
  cityRecord = catalog.city || null;
  actual = catalog.projects.slice().sort((a, b) => a.key.localeCompare(b.key));
  cases = (catalog.cases || []).map(x=>({...x,caseStudy:true}));
  items = actual.length ? [...actual,...cases] : [...cases,...samples];
}
async function init(){
 let error=false;try{await refresh();}catch{error=true;}
 const [key,query]=location.hash.startsWith('#model-')?location.hash.slice(7).split('?'):[];
 const initialView=new URLSearchParams(query).get('view')||'perspective';
 const selected=key==='city'||key==='site'?overview:items.find(x=>x.key===key)||(actual.length?items[0]:overview);
 const ready=selectModel(selected,initialView,Boolean(key));
 if(key)$('gallery').scrollIntoView({block:'start',behavior:'instant'});
 await ready;
 if(error)status('The student catalog is unavailable. Showing demonstration models.');
}
init();
