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
