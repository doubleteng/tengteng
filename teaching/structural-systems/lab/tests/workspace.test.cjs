const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),path=require('node:path');
const window={document:{body:{dataset:{studioSpace:'wood'}}}},context=vm.createContext({window,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../structure-core.js'),'utf8'),context);
const R=window.LabRenderer.prototype;
function renderer(){return Object.assign(Object.create(R),{canvas:{closest:()=>true},projection:'perspective',mode:'3d',plane:'elevation',render(){},fitPending:false,center:[0,4,0],extent:24,yaw:0,pitch:0,zoom:1,w:600,h:400,pan:[0,0]});}
test('all building renderers retain the chosen projection and view through geometry and camera restoration',()=>{
 for(const space of ['wood','steel','concrete'])for(const projection of ['perspective','orthographic']){
  window.document.body.dataset.studioSpace=space;window.StructureDisplay={projection,view:'plan',xray:false};const r=renderer();
  r.setScene([],{plane:'elevation'});assert.equal(r.projection,projection);assert.equal(r.mode,'2d');assert.equal(r.plane,'plan');
  const camera=r.captureView();window.StructureDisplay.view='3d';r.restoreView(camera);assert.equal(r.mode,'3d');assert.equal(r.projection,projection);
  const near=r.project([5,0,5]),far=r.project([5,0,-5]);assert.ok(Number.isFinite(near.x)&&Number.isFinite(far.x));if(projection==='perspective')assert.notEqual(near.x,far.x);else assert.equal(near.x,far.x);
 }
});
test('shared model display does not override a fundamentals lesson plane',()=>{
 window.document.body.dataset.studioSpace='fundamentals';window.StructureDisplay={projection:'perspective',view:'plan',xray:false};const r=renderer();r.mode='2d';r.setScene([],{plane:'elevation'});assert.equal(r.plane,'elevation');
});
test('fresh model constructor uses perspective before a workspace preference exists',()=>{
 // Constructor side effects use a minimal canvas; inspect the real initialized projection.
 const dummy={addEventListener(){},parentElement:{getBoundingClientRect(){return {width:600,height:400}}},getContext(){return {}},style:{}};
 context.ResizeObserver=class{observe(){}};window.addEventListener=()=>{};window.devicePixelRatio=1;
 const resize=R.resize;R.resize=function(){};try{delete window.StructureDisplay;const r=new window.LabRenderer(dummy);assert.equal(r.projection,'perspective');assert.equal(r.mode,'3d');}finally{R.resize=resize;}
});

test('dolly zoom keeps the target plane framed while changing the vertical field of view',()=>{
 const r=renderer();
 r.center=[0,0,0];r.pan=[17,-23];r.zoom=1.25;
 const center=r.project([0,0,0]),target=r.project([2,3,0]);
 let previousNear=0,previousFar=Infinity;
 for(const angle of [15,35,75]){
  r.setFieldOfView(angle);
  const point=r.project([2,3,0]);
  assert.equal(point.x,target.x);assert.equal(point.y,target.y);
  const near=r.project([2,0,4]).x-center.x,far=r.project([2,0,-4]).x-center.x;
  assert.ok(near>previousNear&&far<previousFar);previousNear=near;previousFar=far;
  const measured=2*Math.atan(r.h/(2*r.scale()*r.cameraDistance()))*180/Math.PI;
  assert.ok(Math.abs(measured-angle)<1e-9);
  const line=r.projectSegment([0,0,0],[0,2,r.cameraDistance()*2]);
  assert.equal(line.length,2);assert.ok(line.every(p=>Number.isFinite(p.y)));
 }
 r.projection='orthographic';r.setFieldOfView(15);const parallel=r.project([2,3,4]);
 r.setFieldOfView(75);assert.deepEqual(r.project([2,3,4]),parallel);
});
test('missing or out-of-range study lens values restore to a usable angle',()=>{
 const r=renderer();
 for(const [input,expected] of [[undefined,35],[null,35],[Infinity,35],[-4,15],[90,75],[47,47]]){
  r.setFieldOfView(input);assert.equal(r.fieldOfView,expected);
 }
});
