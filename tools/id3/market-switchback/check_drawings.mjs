// Run with Node 22+ from any directory. Tests the same worker and snapshot as the gallery.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {createModelDrawingSource} from '../../../teaching/id3/model-drawings.js';

globalThis.self = globalThis;
// Adapt the browser Worker API to a real background Node thread. The worker file
// itself handles the same messages, transferable buffers and rendering methods.
globalThis.Worker = class {
  constructor(url) {
    const adapter = `
      import {parentPort} from 'node:worker_threads';
      globalThis.WorkerGlobalScope = class {};
      globalThis.self = new WorkerGlobalScope();
      self.postMessage = value => parentPort.postMessage(value);
      await import(${JSON.stringify(url.href)});
      parentPort.on('message', data => self.onmessage({data}));
    `;
    this.thread = new NodeWorker(new URL('data:text/javascript,' + encodeURIComponent(adapter)));
    this.thread.on('message',data=>this.onmessage?.({data}));
    this.thread.on('error',error=>this.onerror?.(error));
  }
  postMessage(message,buffers=[]) { this.thread.postMessage(message,buffers); }
  terminate() { this.thread.terminate(); }
};

const mat = new T.MeshBasicMaterial();
const mesh = geometry => new T.Mesh(geometry,mat);
const projected = drawing => {
  const path=drawing.svg.match(/data-ink="projection"[^>]* d="([^"]*)"/)[1];
  return [...path.matchAll(/M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)/g)]
    .map(match=>match.slice(1).map(Number));
};
const front = {type:'elevation',direction:'front'};
const box = new T.Group();
box.position.set(5,3,-2);
box.rotation.y = Math.PI/2;
box.add(mesh(new T.BoxGeometry(2,2,4)));
const hidden = mesh(new T.BoxGeometry(200,200,200)); hidden.visible=false;box.add(hidden);
const support = new T.Group();support.userData.drawingSupport=true;
support.add(mesh(new T.BoxGeometry(100,100,100)));box.add(support);
const sample=createModelDrawingSource(box);
assert.ok(sample.bounds.min.every((v,i)=>Math.abs(v-[3,2,-3][i])<1e-9),'Registered bounds exclude hidden/support geometry');
assert.ok(sample.bounds.max.every((v,i)=>Math.abs(v-[7,4,-1][i])<1e-9));
assert.equal(projected(await sample.render(front)).length,4,'Only four projected sides of the indexed box');
const cut=await sample.render({type:'plan',offset:3});
assert.equal(cut.stats.cutLoops,1);
assert.equal(cut.metresPerUnit,1);
sample.dispose();

const wallShape=new T.Shape();
wallShape.moveTo(-3,-3);wallShape.lineTo(3,-3);wallShape.lineTo(3,3);wallShape.lineTo(-3,3);wallShape.closePath();
const opening=new T.Path();
opening.moveTo(-1,-1);opening.lineTo(-1,1);opening.lineTo(1,1);opening.lineTo(1,-1);opening.closePath();
wallShape.holes.push(opening);
const wall=mesh(new T.ExtrudeGeometry(wallShape,{depth:2,bevelEnabled:false}));
assert.equal(wall.geometry.index,null,'Exercise non-indexed input');
const voidSource=createModelDrawingSource(wall);
const elevation=await voidSource.render(front);
assert.equal(projected(elevation).length,8,'Perimeter and opening, without tessellation diagonals');
const section=await voidSource.render({type:'section',axis:'z',offset:1});
assert.equal(section.stats.cutLoops,2);
assert.equal(section.stats.openCuts,0);
const polygons=[...section.svg.matchAll(/M([^MZ]+)Z/g)]
  .map(match=>match[1].split('L').map(p=>p.split(' ').map(Number)));
const signedAreas=polygons.map(points=>points.reduce((sum,p,i)=>{
  const next=points[(i+1)%points.length];return sum+p[0]*next[1]-p[1]*next[0];
},0)/2);
assert.equal(signedAreas.length,2);
assert.equal(Math.abs(signedAreas[0]+signedAreas[1]),32,'Directional winding preserves the opening under nonzero fill');
voidSource.dispose();

// Touching closed triangular cells are a common Rhino paving export. Remove
// the shared fabrication wall without leaving a diagonal across the top.
const halves=[[[0,0],[2,0],[2,2]],[[0,0],[2,2],[0,2]]];
const soup=[];
for(const coords of halves) {
  const shape=new T.Shape(coords.map(([x,y])=>new T.Vector2(x,y)));
  const g=new T.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false});
  soup.push(...g.attributes.position.array);
}
const pavement=new T.BufferGeometry();
pavement.setAttribute('position',new T.Float32BufferAttribute(soup,3));
const cells=createModelDrawingSource(mesh(pavement));
assert.equal(projected(await cells.render(front)).length,4,'No interior diagonal between adjoining triangular solids');
cells.dispose();

const occlusion=new T.Group();
const back=mesh(new T.BoxGeometry(6,2,1)), near=mesh(new T.BoxGeometry(2,4,1));
back.position.z=-2;near.position.z=2;occlusion.add(back,near);
const hlr=createModelDrawingSource(occlusion);
const clipped=projected(await hlr.render(front)).filter(([ax,ay,bx,by])=>ay===1&&by===1)
  .map(([ax,ay,bx])=>[Math.min(ax,bx),Math.max(ax,bx)]).sort((a,b)=>a[0]-b[0]);
assert.deepEqual(clipped,[[-3,-1],[1,3]],'An occluder hides exactly the middle of the rear edge');
hlr.dispose();

const sourceFile=new URL('../../../teaching/id3/models/market-switchback.glb',import.meta.url);
const bytes=await readFile(sourceFile);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
scene.traverse(object=>{if(object.userData.initialHidden)object.visible=false;});
const source=createModelDrawingSource(scene);
for(const options of [{type:'plan',offset:7.88},{type:'section',axis:'z',offset:18},front,{type:'elevation',direction:'right'}]) {
  const result=await source.render(options);
  assert.ok(result.stats.visibleEdges>300 && result.svg.length>3000);
  assert.ok(!result.svg.includes('NaN') && !result.svg.includes('Infinity'));
  if(options.type!=='elevation')assert.ok(result.stats.cutLoops>10);
  console.log(options.type, options.direction||'', result.stats);
}
const stale=source.render({type:'plan',offset:9.013});
const newest=source.render({type:'section',axis:'x',offset:-42.9});
await assert.rejects(stale,{name:'AbortError'});
assert.ok((await newest).stats.cutLoops>0);
const interrupted=source.render({type:'plan',offset:12.23});
source.dispose();
await assert.rejects(interrupted,{name:'AbortError'});
console.log('Passed transformed bounds, hidden layers, non-indexed opening, exact occlusion, cut winding, full case and cancellation.');
