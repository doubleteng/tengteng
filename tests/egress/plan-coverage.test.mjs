import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageRegions,enhancePlanContrast,hasUnresolvedStructure,readCoverage,coverageSummary} from '../../teaching/egress/src/plan-coverage.mjs';
import {mergeDetail,compileRecognition} from '../../teaching/egress/src/recognition-pipeline.mjs';
import {validateInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {refineSourceWalls} from '../../teaching/egress/src/source-refinement.mjs';
const empty=()=>({version:1,summary:'fixture',outline:[],elements:[],warnings:[]});
const el=(id,kind,points)=>({id,kind,label:id,points,confidence:'high',evidence:'Synthetic fixture'});
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const region={id:'middle',x:200,y:200,width:600,height:600,core:{left:300,top:300,right:700,bottom:700}};
test('Whole-sheet cores cover every location, including wings absent from the initial interpretation',()=>{
 const regions=coverageRegions(5000,4000);assert.equal(regions.length,20);assert.equal(coverageRegions(956,636).length,4);
 for(let y=1;y<1000;y+=13)for(let x=1;x<1000;x+=17)assert.ok(regions.some(r=>x>=r.core.left&&x<=r.core.right&&y>=r.core.top&&y<=r.core.bottom));
 assert.ok(regions.every(r=>r.x<=r.core.left&&r.y<=r.core.top&&r.x+r.width>=r.core.right&&r.y+r.height>=r.core.bottom));
});
test('Both small and very large source sheets retain complete coverage',()=>{
 assert.equal(coverageRegions(700,500).length,1);const r=coverageRegions(14000,9000);assert.equal(r.length,36);assert.equal(r.at(-1).core.right,1000);assert.equal(r.at(-1).core.bottom,1000);
});
test('Faint-line contrast adjustment changes model input without mutating source pixels',()=>{
 const original={width:3,height:1,data:new Uint8ClampedArray([255,255,255,255,240,240,240,255,20,20,20,255])},before=original.data.slice(),out=enhancePlanContrast(original);
 assert.deepEqual(original.data,before);assert.equal(out.data[0],255);assert.ok(out.data[4]<220);assert.equal(out.data[8],0);
});
test('A detail adds previously missed rooms, corridor and stair objects',()=>{
 const detail={...empty(),elements:[el('room','room',rect(200,200,220,220)),el('hall','corridor',rect(450,200,100,500)),el('stairs','stair',rect(600,400,150,200)),el('wall','wall',[[200,200],[420,200]])]};
 const m=mergeDetail(empty(),detail,region);assert.equal(m.accepted,true);for(const kind of ['room','corridor','stair','wall'])assert.ok(m.result.elements.some(e=>e.kind===kind));
});
test('Overlapping tile margins do not append stray wall tails outside the owning core',()=>{
 const detail={...empty(),elements:[el('wall','wall',[[20,500],[980,500]])]},m=mergeDetail(empty(),detail,region);
 assert.deepEqual(m.result.elements[0].points,[[300,500],[700,500]]);
});
test('A partial tile response cannot erase an unrelated existing wall',()=>{
 const base={...empty(),elements:[el('retain','wall',[[400,300],[400,700]])]},detail={...empty(),elements:[el('new','wall',[[200,500],[800,500]])]};
 const m=mergeDetail(base,detail,region);assert.ok(m.result.elements.some(e=>e.id.startsWith('retain')&&e.points[0][0]===400));
});
test('Repeated tile merges keep one doorway and one room; confirmed geometry survives',()=>{
 const detail={...empty(),elements:[el('room','room',rect(200,200,220,220)),el('door','door',[[300,200],[400,200]])]},once=mergeDetail(empty(),detail,region).result,twice=mergeDetail(once,detail,region).result;
 assert.equal(twice.elements.filter(e=>e.kind==='room').length,1);assert.equal(twice.elements.filter(e=>e.kind==='door').length,1);
 const confirmed={...empty(),elements:[{...el('manual','wall',[[300,500],[700,500]]),confirmed:true}]};assert.ok(mergeDetail(confirmed,{...empty(),elements:[el('wall','wall',[[100,500],[900,500]])]},region).result.elements.some(e=>e.id==='manual'&&e.confirmed));
});
test('Crop-clipped room labels cannot generate fictitious closing walls',()=>{
 const detail={...empty(),elements:[el('partial','room',rect(0,200,600,500))]},m=validateInterpretation(mergeDetail(empty(),detail,region).result);
 assert.equal(m.elements[0].partial,true);const pixels={width:100,height:100,data:new Uint8ClampedArray(40000).fill(255)};
 assert.equal(refineSourceWalls(m,pixels).elements.filter(e=>e.kind==='wall').length,0);
});
test('A failed region is retried automatically; subsequent regions are still read and saved',async()=>{
 const run={result:empty(),regions:coverageRegions(3300,500)},calls=[],saved=[];
 await readCoverage(run,{read:async r=>{calls.push(r.id);if(r.id==='tile-0-0')throw Error('Provider returned incomplete geometry');return empty();},merge:mergeDetail,onProgress:r=>saved.push(structuredClone(r))});
 assert.equal(calls.length,4);assert.equal(run.regions[0].state,'failed');assert.equal(run.regions[2].state,'read');assert.ok(saved.length>=6);
 const resumed=[];await readCoverage(run,{read:async r=>{resumed.push(r.id);return empty();},merge:mergeDetail});assert.deepEqual(resumed,['tile-0-0']);assert.equal(coverageSummary(run.regions).complete,true);
});
test('Quota rejection pauses unfinished tiles without discarding completed geometry',async()=>{
 const run={result:empty(),regions:coverageRegions(3300,500)};run.regions[0].state='read';run.result.elements=[el('existing','wall',[[10,10],[100,10]])];let count=0;
 await readCoverage(run,{read:async()=>{count++;throw Error('Shared quota reached');},merge:mergeDetail});assert.equal(count,1);assert.equal(run.result.elements.length,1);assert.equal(run.regions[2].state,'pending');assert.equal(coverageSummary(run.regions).complete,false);
});
test('Cancellation during a tile request cannot replace the saved result',async()=>{
 const run={result:empty(),regions:coverageRegions(600,500)};let stopped=false;
 await readCoverage(run,{read:async()=>{stopped=true;return {...empty(),elements:[el('late','wall',[[10,10],[100,10]])]};},merge:mergeDetail,cancelled:()=>stopped});assert.equal(run.result.elements.length,0);assert.equal(run.regions[0].state,'pending');
});
test('Unread-region status survives validation and prevents a complete interpretation claim',()=>{
 const regions=coverageRegions(2200,500);regions[0].state='read';const input={...empty(),coverage:coverageSummary(regions)},r=validateInterpretation(input);
 assert.equal(r.coverage.read,1);assert.equal(r.coverage.total,2);assert.equal(r.coverage.complete,false);assert.equal(compileRecognition(r,{x:0,y:0,width:10,height:10}).complete,false);
});

test('An oversized truncated tile is automatically split and both child regions are read',async()=>{const run={result:empty(),regions:coverageRegions(800,600)};const calls=[];await readCoverage(run,{read:async r=>{calls.push(r.id);if(!r.depth)throw Error('Region response was truncated');return empty();},merge:mergeDetail});assert.equal(run.regions.length,2);assert.ok(run.regions.every(r=>r.state==='read'));assert.equal(calls.length,4);assert.equal(run.regions[0].core.left,0);assert.equal(run.regions[1].core.right,1000);});

test('A faint wing cannot be silently accepted as blank context',()=>{const width=160,height=120,data=new Uint8ClampedArray(width*height*4).fill(255);for(let y=30;y<34;y++)for(let x=20;x<140;x++){const k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=237;}for(let x=20;x<24;x++)for(let y=30;y<100;y++){const k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=237;}assert.equal(hasUnresolvedStructure(empty(),{width,height,data}),true);assert.equal(hasUnresolvedStructure(empty(),{width,height,data:new Uint8ClampedArray(data.length).fill(255)}),false);});
test('Overlapping detail tiles recover the missing half of a six-room faint-line plan without seam rooms',()=>{
 const width=600,height=400,data=new Uint8ClampedArray(width*height*4).fill(255),norm=([x,y])=>[x/width*1000,y/height*1000];
 const walls=[[[30,30],[570,30]],[[570,30],[570,370]],[[570,370],[30,370]],[[30,370],[30,30]],[[210,30],[210,370]],[[390,30],[390,370]],[[30,200],[570,200]]];
 for(const [a,b] of walls){const n=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let j=0;j<=n;j++){const x=Math.round(a[0]+(b[0]-a[0])*j/n),y=Math.round(a[1]+(b[1]-a[1])*j/n);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const k=((y+dy)*width+x+dx)*4;data[k]=data[k+1]=data[k+2]=x>300?237:20;}}}
 const rooms=Array.from({length:6},(_,i)=>el('room'+i,'room',rect(30+i%3*180,30+Math.floor(i/3)*170,180,170).map(norm)));
 let result={...empty(),elements:[rooms[0],rooms[3]]};
 for(const region of coverageRegions(2400,1600,{tilePixels:800})){
  const toLocal=p=>[(p[0]-region.x)/region.width*1000,(p[1]-region.y)/region.height*1000];
  const details=[];
  for(const [i,[aa,bb]] of walls.entries()){
   const a=norm(aa),b=norm(bb),left=region.x,right=region.x+region.width,top=region.y,bottom=region.y+region.height;
   if(a[1]===b[1]&&a[1]>=top&&a[1]<=bottom){const lo=Math.max(Math.min(a[0],b[0]),left),hi=Math.min(Math.max(a[0],b[0]),right);if(hi>lo)details.push(el('w'+i,'wall',[[lo,a[1]],[hi,a[1]]].map(toLocal)));}
   if(a[0]===b[0]&&a[0]>=left&&a[0]<=right){const lo=Math.max(Math.min(a[1],b[1]),top),hi=Math.min(Math.max(a[1],b[1]),bottom);if(hi>lo)details.push(el('w'+i,'wall',[[a[0],lo],[a[0],hi]].map(toLocal)));}
  }
  for(const room of rooms)if(room.points.every(p=>p[0]>=region.x&&p[0]<=region.x+region.width&&p[1]>=region.y&&p[1]<=region.y+region.height))details.push({...room,points:room.points.map(toLocal)});
  result=mergeDetail(result,{...empty(),elements:details},region).result;
 }
 const fitted=refineSourceWalls(result,{width,height,data}),compiled=compileRecognition(fitted,{x:0,y:0,width:30,height:20});
 assert.equal(compiled.model.rooms.length,6);assert.ok(compiled.model.walls.length<=20);assert.equal(compiled.pending.length,0);
});

test('One returned wall cannot mark a second unrecognized wing as complete, including angled faint strokes',()=>{
 const width=400,height=300,data=new Uint8ClampedArray(width*height*4).fill(255);
 const draw=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);for(let i=0;i<=n;i++){const x=Math.round(a[0]+(b[0]-a[0])*i/n),y=Math.round(a[1]+(b[1]-a[1])*i/n),k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=225;}};
 draw([40,40],[40,260]);draw([260,60],[350,140]);draw([350,140],[280,240]);
 const response={...empty(),elements:[el('known','wall',[[100,133],[100,867]])]};
 assert.equal(hasUnresolvedStructure(response,{width,height,data}),true);
 response.elements.push(el('wing','room',[[600,150],[920,400],[760,850],[600,800]]));
 assert.equal(hasUnresolvedStructure(response,{width,height,data}),false);
});
test('Furniture and fixtures already classified in the response are not unread building wings',()=>{
 const width=200,height=200,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=60;y<=140;y++)for(const x of [60,140]){const k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=30;}
 for(let x=60;x<=140;x++)for(const y of [60,140]){const k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=30;}
 const response={...empty(),elements:[el('fixture','sanitary-fixture',rect(250,250,500,500))]};
 assert.equal(hasUnresolvedStructure(response,{width,height,data}),false);
});
