const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const path=require('node:path'),window={},context=vm.createContext({window,console});
for(const file of ['structure-lighting.js','structure-core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const L=window.LabLighting,corners=it=>window.LabJoinery.corners(it);
const deck={type:'beam',id:'deck',a:[-5,5,0],b:[5,5,0],w:8,h:1,color:'#aaccee'};
test('a deck casts a shadow on the lower floor but does not shadow its own top',()=>{
 const floor={type:'beam',id:'floor',a:[-12,-.5,0],b:[12,-.5,0],w:20,h:1};
 const map=new L.ShadowMap([deck,floor],corners,512),receiver=map.receiver([0,1,0]);
 const vis=p=>map.visibility(...map.project(p),receiver);
 assert.ok(vis([3.25,0,-2.25])<.7,'Known sun-ray intersection is shadowed');
 assert.equal(vis([-10,0,0]),1,'Uncovered floor is lit');
 assert.equal(vis([0,5.5,0]),1,'Top does not self-shadow');
 const withoutDeck=new L.ShadowMap([floor],corners,512);
 assert.equal(withoutDeck.visibility(...withoutDeck.project([3.25,0,-2.25]),withoutDeck.receiver([0,1,0])),1,'Removing deck clears its shadow');
});
test('directional lighting separates top, side and underside while retaining material hue',()=>{
 const top=L.shade('#c8b898',[0,1,0]),side=L.shade('#c8b898',[1,0,0]),bottom=L.shade('#c8b898',[0,-1,0]);
 assert.ok(parseInt(top.slice(1,3),16)>parseInt(side.slice(1,3),16)+40);
 assert.ok(parseInt(top.slice(1,3),16)>parseInt(bottom.slice(1,3),16)+40);
 for(const c of [top,side,bottom])assert.ok(parseInt(c.slice(1,3),16)>parseInt(c.slice(5,7),16));
});
test('shadowed pixel colors preserve nearest-member selection and depth',()=>{
 const p=(x,y,z)=>({x,y,depth:z,light:[x,y,z,1]});
 const faces=[{p:[p(0,0,1),p(20,0,1),p(0,20,1)],color:'#ccddee',id:'floor'},
  {p:[p(2,2,2),p(15,2,2),p(2,15,2)],color:'#88aacc',id:'beam'}];
 const plain=new window.DepthSurface(24,24),lit=new window.DepthSurface(24,24);
 for(const face of faces){plain.add(face);lit.add({...face,shadow:{map:{visibility:()=>.5}}});}
 assert.equal(plain.pick(5,5),'beam');assert.equal(lit.pick(5,5),'beam');
 assert.equal(lit.z[5*24+5],plain.z[5*24+5]);
 assert.ok(lit.colors[(5*24+5)*4]<plain.colors[(5*24+5)*4]);
});
test('perspective and near-plane clipping retain finite light coordinates',()=>{
 const renderer=Object.create(window.LabRenderer.prototype);
 Object.assign(renderer,{mode:'3d',projection:'perspective',yaw:0,pitch:0,center:[0,0,0],extent:10,w:400,h:300,zoom:1,pan:[0,0]});
 const map=new L.ShadowMap([deck],corners,256);
 const q=renderer.projectFace([[-1,0,0],[1,0,0],[0,1,30]],map);
 assert.equal(q.length,4,'Triangle crossing near plane is clipped');
 for(const p of q){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(p.light.length,4);assert.ok(p.light.every(Number.isFinite));assert.ok(p.light[3]>0);}
});
