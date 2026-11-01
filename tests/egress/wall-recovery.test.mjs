import test from 'node:test';import assert from 'node:assert/strict';
import {refineSourceWalls} from '../../teaching/egress/src/source-refinement.mjs';
import {normalizeWallNetwork} from '../../teaching/egress/src/wall-network.mjs';
import {materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {openingHost} from '../../teaching/egress/src/import-quality.mjs';
import {dist} from '../../teaching/egress/src/geometry.mjs';
function missingHost(angle=0,returns=true){
 const width=400,height=400,data=new Uint8ClampedArray(width*height*4).fill(255),c=Math.cos(angle),s=Math.sin(angle);
 const rotate=([x,y])=>[200+(x-200)*c-(y-200)*s,200+(x-200)*s+(y-200)*c];
 const norm=q=>rotate(q).map(v=>v/width*1000);
 const draw=(a,b)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=0;i<=len*4;i++){const t=i/(len*4),[x,y]=rotate([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]).map(Math.round);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const k=((y+dy)*width+x+dx)*4;data[k]=data[k+1]=data[k+2]=20;}}};
 const segments=[[[50,80],[350,80]],[[200,140],[350,140]]];segments.forEach(([a,b])=>draw(a,b));
 if(returns){draw([200,80],[200,95]);draw([200,125],[200,140]);}
 const elements=segments.map((points,i)=>({id:'wall'+i,kind:'wall',label:'Wall',points:points.map(norm)}));elements.push({id:'door',kind:'door',label:'Door',points:[[200,95],[200,125]].map(norm)});
 return {result:{version:1,outline:[],elements,warnings:[]},imageData:{width,height,data}};
}
for(const angle of [0,.37,-.29])test('Recover source-supported short jamb returns omitted by the model, rotation '+angle,()=>{
 const f=missingHost(angle),r=refineSourceWalls(f.result,f.imageData),m=materializeInterpretation(r,{x:0,y:0,width:20,height:20,calibrated:true},{deriveRooms:false});
 assert.equal(m.candidates.length,1);assert.ok(m.walls.length>=4);assert.equal(openingHost(m.walls,m.candidates[0].points).error,undefined);
});
test('Door proposals never invent absent wall returns on blank source pixels',()=>{
 const f=missingHost(0,false),r=refineSourceWalls(f.result,f.imageData),m=materializeInterpretation(r,{x:0,y:0,width:20,height:20,calibrated:true},{deriveRooms:false});
 assert.ok(openingHost(m.walls,m.candidates[0].points).error);assert.equal(m.doors.length,0);
});
test('Noisy duplicate axes within a folded wall produce two runs with one shared corner',()=>{
 const line=(a,b)=>({a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},band:4,explicit:true});
 const result=normalizeWallNetwork([line([30,20],[70,100]),line([70,100],[160,100]),line([32,24],[70.8,98]),line([71,102],[154,99]),line([70,101],[90,102])],{unit:.2,supported:()=>true});
 assert.equal(result.length,2);assert.ok([result[0].a,result[0].b].some(a=>[result[1].a,result[1].b].some(b=>dist(a,b)<1e-8)));
});
test('A genuine nearby parallel wall and a doorway gap survive normalization',()=>{
 const line=(x1,y1,x2,y2)=>({a:{x:x1,y:y1},b:{x:x2,y:y2},band:2,explicit:true});
 const result=normalizeWallNetwork([line(0,0,40,0),line(60,0,100,0),line(0,20,100,20)],{unit:.2,supported:()=>true,openingAt:q=>q.x>40&&q.x<60&&Math.abs(q.y)<2});assert.equal(result.length,3);
});
