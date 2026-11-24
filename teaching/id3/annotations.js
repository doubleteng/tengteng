import {Matrix4, Vector4} from './lib/three.module.min.js';

const categories = [
 ['bus', 'Bus stops', '#246f65'], ['parking', 'Public parking', '#36704d'],
 ['curbside', 'Curbside parking', '#74556c'], ['bike', 'Bike racks', '#2a6d88'],
 ['one', 'One-way traffic', '#ae491d'], ['two', 'Two-way traffic', '#2a667c']
];
const colors = Object.fromEntries(categories.map(([key, , color]) => [key, color]));
const parkingTypes = {
 garage: ['Paid garage', '#36704d'], county: ['County after-hours', '#a63841'],
 school: ['School event parking', '#ae6816'], metered: ['Metered lot', '#555c6a']
};
const byId = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
function node(tag, attrs = {}, contents) {
 const el = document.createElementNS(svgNS, tag);
 for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
 if (contents !== undefined) el.textContent = contents;
 return el;
}
function description(f) {
 if (f.kind === 'bus') return 'TheRide · Routes ' + f.routes.join(', ');
 if (f.kind === 'curbside') return (f.orientation==='angled'?'Angled':'Parallel')+' parking · '+f.street+' · '+f.side;
 if (f.kind === 'parking') return [f.facility, f.location, f.access].filter(Boolean).join(' · ');
 if (f.kind === 'bike') return f.detail;
 const parts = [f.flow];
 if (f.lanes) parts.push(f.lanes + (f.lanes === 1 ? ' lane' : ' lanes total'));
 if (f.surface) parts.push(f.surface);
 return parts.join(' · ');
}
export class SiteAnnotations {
 constructor(viewer, makeRow) {
  this.viewer = viewer; this.enabled = new Set(); this.features = []; this.visible = [];
  this.groups = new Map(); this.matrix = new Matrix4(); this.vector = new Vector4(); this.selection = '';
  this.map = byId('annotation-map');
  for (const [key, name, color] of categories) {
   byId('annotation-controls').append(makeRow(name, false, color, async on => {
    if (on) this.enabled.add(key); else this.enabled.delete(key);
    this.viewer.activate(); this.filter();
    if (this.enabled.size && !this.loaded) await this.load();
   }));
  }
  for (const [name, color] of Object.values(parkingTypes)) {
   const item = document.createElement('li');
   item.style.setProperty('--key-color', color); item.textContent = name;
   byId('parking-key').append(item);
  }
  byId('lane-filter').onchange = () => this.filter();
  byId('annotation-feature').onchange = e => this.select(e.target.value);
 }
 async load() {
  if (this.loading) return this.loading;
  this.loading = fetch('./models/district-annotations.json').then(async response => {
   if (!response.ok) throw Error();
   this.features = await response.json(); this.loaded = true; this.filter();
  }).catch(() => { byId('annotation-state').textContent = 'Map data could not load. Toggle a layer to retry.'; })
  .finally(() => { this.loading = null; });
  return this.loading;
 }
 filter() {
  const traffic = this.enabled.has('one') || this.enabled.has('two');
  const lanes = Number(byId('lane-filter').value);
  this.visible = this.features.filter(f => {
   if (!this.enabled.has(f.kind)) return false;
   return !('flow' in f) || !lanes || (lanes === 4 ? f.lanes >= 4 : f.lanes === lanes);
  }).sort((a, b) => {
   const dist = f => Math.hypot(f.point[0] + 50.49, f.point[2] - 25.83);
   return dist(a) - dist(b);
  });
  byId('lane-row').hidden = !traffic; byId('feature-row').hidden = !this.visible.length;
  byId('parking-key').hidden = !this.enabled.has('parking');
  byId('walk-parking').hidden = !this.enabled.has('parking');
  byId('walk-transit').hidden = !this.enabled.has('bus');
  byId('curb-access').hidden = !this.enabled.has('curbside');
  byId('transit-credit').hidden = !this.enabled.has('bus');
  byId('annotation-state').textContent = !this.enabled.size ? 'Select a layer to see it on the model.'
   : !this.loaded ? 'Loading map data…' : this.visible.length ? this.visible.length + ' mapped features · Select a symbol or street.' : 'No matching features in this district.';
  const select = byId('annotation-feature');
  select.replaceChildren(new Option('Choose on map or from list',''));
  for (const f of this.visible) select.append(new Option(f.name + (f.addresses?' '+f.addresses:'') + ('flow' in f ? ' · '+description(f) : ''), f.id));
  this.groups.clear(); this.map.replaceChildren();
  const ordered = [...this.visible].sort((a,b) => Number(!a.paths)-Number(!b.paths) || Number(a.kind!=='parking')-Number(b.kind!=='parking'));
  for (const f of ordered) this.makeGroup(f);
  this.select(this.visible.some(f => f.id === this.selection) ? this.selection : '');
 }
 select(id) {
  this.selection = id; byId('annotation-feature').value = id;
  const f = this.visible.find(f => f.id === id);
  const detail = byId('annotation-detail'); detail.hidden = !f; detail.replaceChildren();
  if (f) {
   const heading = document.createElement('strong'); heading.textContent = f.name + (f.addresses ? ' · '+f.addresses : '');
   detail.append(heading, document.createTextNode(description(f)));
   this.map.append(this.groups.get(f.id).el);
  }
  this.draw(this.viewer.camera,this.viewer.host.clientWidth,this.viewer.host.clientHeight);
 }
 makeGroup(f) {
  const el = node('g'); const color = parkingTypes[f.group]?.[1] || colors[f.kind];
  el.append(node('title',{},f.name+' · '+description(f)));
  const parts = {el};
  if (f.paths) {
   parts.halo = node('path',{fill:'none',stroke:'#fffef4','stroke-width':4,'stroke-opacity':.9});
   parts.line = node('path',{fill:f.kind==='parking'?color:'none','fill-opacity':.14,'fill-rule':'evenodd',stroke:color,'stroke-width':1.75,'stroke-linecap':'round','stroke-linejoin':'round'});
   parts.hit = node('path',{fill:'none',stroke:'transparent','stroke-width':10,class:'map-hit'});
   el.append(parts.halo,parts.line,parts.hit);
  }
  if (f.rackPoints) {
   parts.racks = f.rackPoints.map(() => {
    const dot = node('circle',{r:2.6,fill:color,stroke:'#fffef6','stroke-width':.9,class:'pin'});
    el.append(dot); return dot;
   });
  }
  const marker = node('g',{class:'pin'}); parts.marker=marker;
  if (f.tangent) {
   marker.append(node('circle',{r:9.5,fill:'#fffef6',stroke:color,'stroke-width':1.15}));
   const glyph = node('path',{d:f.kind==='one'?'M-5 0H5M1 -4l4 4-4 4':'M-6 -2.8H5m-3 -2.9L5 -2.8l-3 2.9M6 2.8H-5m3 -2.9L-5 2.8l3 2.9',fill:'none',stroke:color,'stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'});
   marker.append(glyph); parts.arrow=glyph;
  } else {
   marker.append(node('path',{d:'M0 0L-4 -5Q-9 -7 -9 -13A9 9 0 0 1 9 -13Q9 -7 4 -5Z',fill:color,stroke:'#fffef6','stroke-width':1.5}));
   if (f.kind==='bus') {
    marker.append(node('rect',{x:-4.4,y:-17.7,width:8.8,height:8.6,rx:1.6,fill:'#fffef6'}),node('rect',{x:-3.1,y:-16.1,width:6.2,height:3.5,rx:.5,fill:color}));
    for(const x of [-2.6,2.6]) marker.append(node('circle',{cx:x,cy:-10.8,r:.85,fill:color}));
   } else if (f.kind==='bike') {
    marker.append(node('path',{d:'M-2.2 -10.9a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 1 1 4.2 0Zm8.7 0a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 1 1 4.2 0ZM-4.3 -10.9l2.2-4.2 2.8 4.2h-5l5.6-3.1 1.7-1.5m1.4 4.6-1.7-6H.9m-4.4 1.8h2.2',fill:'none',stroke:'#fffef6','stroke-width':1,'stroke-linecap':'round','stroke-linejoin':'round'}));
   } else marker.append(node('text',{x:0,y:-9,'text-anchor':'middle',fill:'#fffef6','font-size':12,'font-weight':700},'P'));
  }
  el.append(marker); parts.label=node('text',{class:'map-label'}); el.append(parts.label);
  el.addEventListener('click', e => { e.stopPropagation(); this.select(this.selection===f.id?'':f.id); });
  this.map.append(el); this.groups.set(f.id, parts);
 }
 project(p) {
  const v = this.vector.set(p[0],p[1],p[2],1).applyMatrix4(this.matrix);
  if (v.w <= 0 || v.z < -v.w || v.z > v.w) return null;
  return [(v.x/v.w+1)*this.width/2,(1-v.y/v.w)*this.height/2];
 }
 draw(camera, width, height) {
  if (!this.visible.length) return;
  this.width=width; this.height=height;
  camera.updateMatrixWorld(); this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const occupied=[];
  const order = this.selection ? [...this.visible].sort((a,b)=>Number(b.id===this.selection)-Number(a.id===this.selection)) : this.visible;
  for (const f of order) {
   const parts=this.groups.get(f.id); if(!parts)continue;
   const selected=f.id===this.selection;
   if (f.paths) {
    const paths=[];
    for (const path of f.paths) {
     let open=false, whole=true;
     for (const p of path) {
      const xy=this.project(p);
      if (!xy) {open=false;whole=false;continue;}
      paths.push((open?'L':'M')+xy[0].toFixed(1)+' '+xy[1].toFixed(1)); open=true;
     }
     if (whole && f.kind==='parking') paths.push('Z');
    }
    const d=paths.join('');for(const path of [parts.halo,parts.line,parts.hit])path.setAttribute('d',d);
    parts.line.setAttribute('stroke-width',selected?3:1.75);
   }
   if (parts.racks) {
    f.rackPoints.forEach((point,i) => {
     const pos=this.project(point), dot=parts.racks[i];
     dot.style.display=pos?'':'none';
     if (pos) {dot.setAttribute('cx',pos[0]);dot.setAttribute('cy',pos[1]);}
    });
   }
   const p=this.project(f.point);
   const onScreen=p&&p[0]>6&&p[1]>5&&p[0]<width-6&&p[1]<height-4;
   // In district views keep arrows and pins legible at dense intersections.
   const gap=f.tangent?22:13;
   const clear=onScreen&&(!f.tangent||selected||!occupied.some(([x,y])=>Math.hypot(x-p[0],y-p[1])<gap));
   parts.marker.style.display=clear?'':'none'; parts.label.style.display=selected&&onScreen?'':'none';
   if (!onScreen) continue;
   if (clear) {
    occupied.push(p); parts.marker.setAttribute('transform','translate('+p[0]+','+p[1]+')');
    if (f.tangent) {
     const a=this.project(f.tangent[0]),b=this.project(f.tangent[1]);
     if(a&&b) parts.arrow.setAttribute('transform','rotate('+Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI+')');
    }
   }
   if (selected) {
    const left=p[0]>width*.63;parts.label.setAttribute('text-anchor',left?'end':'start');
    parts.label.setAttribute('x',p[0]+(left?-13:13));parts.label.setAttribute('y',p[1]-5);
    parts.label.textContent=f.name+(f.lanes?' · '+f.lanes+(f.lanes===1?' lane':' lanes'):'');
   }
  }
 }
}
