import test from 'node:test';import assert from 'node:assert/strict';
import {moveWall,enclosedRooms,roomsFromFaces} from '../../teaching/egress/src/editable-plan.mjs';
import {pdfLinework,rasterLinework,referenceLinework} from '../../teaching/egress/src/pdf-plan.mjs';
import {area,edges} from '../../teaching/egress/src/geometry.mjs';
import {fresh} from '../../teaching/egress/src/model.mjs';
const point=(x,y)=>({x,y}),rect=(x,y,w,h)=>[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];
const walls=points=>edges(points).map(([a,b],i)=>({id:'w'+i,a:{...a},b:{...b},thickness:.15}));
test('Closed imported linework yields bounded room faces, including T-junctions',()=>{
 const ws=walls(rect(0,0,10,10));ws.push({id:'partition',a:point(5,0),b:point(5,10),thickness:.15});const result=enclosedRooms(ws);assert.equal(result.components,1);assert.equal(result.faces.length,2);assert.deepEqual(result.faces.map(area).sort((a,b)=>a-b),[50,50]);assert.equal(area(result.outline),100);
});
test('Open drawings do not acquire an invented outer boundary',()=>{const ws=walls(rect(0,0,10,10));ws.pop();assert.equal(enclosedRooms(ws).faces.length,0);});
test('Dragging a partition updates both room areas, preserves outer area, and moves its door',()=>{
 const f=fresh().floors[0];f.outline=rect(0,0,10,10);f.walls=walls(f.outline);f.walls.push({id:'partition',a:point(5,0),b:point(5,10),thickness:.15});f.rooms=roomsFromFaces(enclosedRooms(f.walls).faces);f.doors=[{id:'door',wallId:'partition',x:5,y:4,width:1}];const before=structuredClone(f);moveWall(f,'partition',point(6,0),point(6,10),before);assert.deepEqual(f.rooms.map(r=>area(r.points)).sort((a,b)=>a-b),[40,60]);assert.equal(area(f.outline),100);assert.equal(f.doors[0].x,6);assert.equal(f.doors[0].y,4);
 moveWall(f,'partition',point(7,0),point(7,10),before);assert.deepEqual(f.rooms.map(r=>area(r.points)).sort((a,b)=>a-b),[30,70]);
});
test('Moving an exterior wall carries connected corners and changes room and floor area',()=>{const f=fresh().floors[0];f.outline=rect(0,0,10,10);f.walls=walls(f.outline);f.rooms=roomsFromFaces(enclosedRooms(f.walls).faces);const before=structuredClone(f);moveWall(f,'w1',point(12,0),point(12,10),before);assert.equal(area(f.outline),120);assert.equal(area(f.rooms[0].points),120);assert.equal(f.walls[0].b.x,12);assert.equal(f.walls[2].a.x,12);});
test('PDF vector extraction respects transforms, closes rectangles and excludes text',()=>{
 const OPS={save:1,restore:2,transform:3,constructPath:4,showText:5},op={fnArray:[1,3,4,5,2],argsArray:[[],[1,0,0,1,10,20],[20,[new Float32Array([0,0,0,1,20,0,1,20,10,1,0,10,4])],[0,0,20,10]],['text'],[]]},v={width:100,height:100,transform:[1,0,0,-1,0,100]},r=pdfLinework(op,OPS,v);assert.equal(r.segments.length,4);assert.deepEqual(r.segments[0].a,{x:.1,y:1-.8});
 const im={x:0,y:0,width:10,height:10,linework:r},data=referenceLinework(im);assert.equal(data.segments.length,4);assert.ok(Math.abs(data.segments[0].a[0]-1)<1e-8);assert.ok(Math.abs(data.segments[0].a[1]-2)<1e-8);
});
test('Scanned line candidates are editable vectors and disclose orientation limitations',()=>{const width=200,height=200,data=new Uint8ClampedArray(width*height*4);data.fill(255);for(let x=20;x<=180;x++)for(let y=40;y<=42;y++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}const r=rasterLinework({width,height,data});assert.equal(r.segments.length,1);assert.ok(Math.abs(r.segments[0].a.x-.1)<.02);assert.ok(r.warnings[0].includes('angled'));});
test('The pinned PDF.js decoder supplies real editable geometry from a PDF page',async()=>{
 const fs=await import('node:fs');globalThis.DOMMatrix??=class{};globalThis.ImageData??=class{};globalThis.Path2D??=class{};
 const pdf=await import('../../teaching/egress/vendor/pdf.min.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('../../teaching/egress/vendor/pdf.worker.min.mjs',import.meta.url).href;
 const doc=await pdf.getDocument({data:new Uint8Array(fs.readFileSync(new URL('./fixtures/calibration.pdf',import.meta.url))),useSystemFonts:true}).promise;
 const page=await doc.getPage(2),v=page.getViewport({scale:2}),result=pdfLinework(await page.getOperatorList(),pdf.OPS,v);assert.equal(result.segments.length,7);
 const data=referenceLinework({x:0,y:0,width:18.288,height:12.192,linework:result}),lines=data.segments.slice(0,4).map((s,i)=>({id:'pdf'+i,a:point(...s.a),b:point(...s.b),thickness:.15}));
 const rooms=enclosedRooms(lines);assert.equal(rooms.faces.length,1);assert.ok(Math.abs(area(rooms.faces[0])-12.192*6.096)<1e-8);await doc.destroy();
});
test('Program area feedback remains available before an exit is assigned',async()=>{const {analyze}=await import('../../teaching/egress/src/analysis.mjs');const p=fresh(),f=p.floors[0];f.outline=rect(0,0,10,10);f.rooms=roomsFromFaces([f.outline]);f.rooms[0].targetArea=120;assert.equal(analyze(p).checks.find(c=>c.ref==='Design brief').status,'review');f.rooms[0].targetArea=90;assert.equal(analyze(p).checks.find(c=>c.ref==='Design brief').status,'pass');});
test('Raster vectorization preserves diagonal strokes and curved geometry',()=>{const width=180,height=180,data=new Uint8ClampedArray(width*height*4);data.fill(255);const black=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};for(let t=20;t<85;t++)for(let d=-1;d<=1;d++)black(t,t+d);for(let angle=0;angle<Math.PI*2;angle+=.004)for(let radius=24;radius<=27;radius++)black(Math.round(130+radius*Math.cos(angle)),Math.round(125+radius*Math.sin(angle)));const r=rasterLinework({width,height,data});assert.ok(r.segments.some(s=>Math.abs(s.a.x-s.b.x)>.2&&Math.abs(s.a.y-s.b.y)>.2));assert.ok(r.segments.filter(s=>s.a.x>.5).length>8);});
