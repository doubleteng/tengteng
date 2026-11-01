import {dist} from './geometry.mjs?v=auto-enclosure-1';

export function readDoorSymbol(item){
 const out={};
 if(Array.isArray(item.swingPoint)&&item.swingPoint.length===2&&item.swingPoint.every(n=>Number.isFinite(n)&&n>=0&&n<=1000))out.swingPoint=[...item.swingPoint];
 if(['start','end','both','unknown'].includes(item.hinge))out.hinge=item.hinge;
 if(Number.isFinite(item.swingAngle)&&item.swingAngle>=5&&item.swingAngle<=180)out.swingAngle=item.swingAngle;
 return out;
}

// Store the observed symbol relative to its host, so moving or rotating a wall
// moves the leaf and swing with it. The travel direction is a separate value.
export function hostedDoorSymbol(candidate,wall){
 if(['sliding','folding'].includes(candidate.doorType))return null;
 if(!candidate.swingPoint||!candidate.openingEvidence)return null;
 const evidence=candidate.openingEvidence,hinge=evidence.hinge;
 if(!['start','end','both'].includes(hinge))return null;
 const l=dist(wall.a,wall.b);if(!l)return null;
 const u={x:(wall.b.x-wall.a.x)/l,y:(wall.b.y-wall.a.y)/l},[a,b]=candidate.points,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const side=u.x*(candidate.swingPoint.y-center.y)-u.y*(candidate.swingPoint.x-center.x);if(Math.abs(side)<1e-6)return null;
 const q=hinge==='end'?b:a,along=(q.x-center.x)*u.x+(q.y-center.y)*u.y;
 return {version:1,hingeSide:along<0?-1:1,openSide:side<0?-1:1,angle:Math.max(5,Math.min(180,evidence.swingAngle||90)),double:hinge==='both'};
}

export function doorSymbolLines(door,wall){
 const symbol=door.symbol;if(!symbol||!wall||!(door.width>0))return [];
 const l=dist(wall.a,wall.b);if(!l)return [];
 const u={x:(wall.b.x-wall.a.x)/l,y:(wall.b.y-wall.a.y)/l},n={x:-u.y,y:u.x},angle=symbol.angle*Math.PI/180,lines=[];
 for(const hingeSide of symbol.double?[-1,1]:[symbol.hingeSide]){
  const hinge={x:door.x+u.x*hingeSide*door.width/2,y:door.y+u.y*hingeSide*door.width/2},radius=door.width/(symbol.double?2:1),arc=[];
  for(let i=0;i<=24;i++){const a=angle*i/24;arc.push({x:hinge.x+radius*(-hingeSide*u.x*Math.cos(a)+symbol.openSide*n.x*Math.sin(a)),y:hinge.y+radius*(-hingeSide*u.y*Math.cos(a)+symbol.openSide*n.y*Math.sin(a))});}
  lines.push([hinge,arc.at(-1)],arc);
 }
 return lines;
}
