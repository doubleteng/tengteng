import {dist,lerp} from './geometry.mjs?v=auto-enclosure-1';

export function windowOverlaps(a,b,windows,tolerance=.12){
 const length=dist(a,b);if(!length)return null;
 const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,along=p=>(p.x-a.x)*ux+(p.y-a.y)*uy,offset=p=>Math.abs((p.x-a.x)*uy-(p.y-a.y)*ux);
 return windows.find(w=>w.points?.slice(1).some((d,i)=>{const c=w.points[i],l=dist(c,d);if(!l||Math.abs((d.x-c.x)*uy-(d.y-c.y)*ux)/l>.1||Math.max(offset(c),offset(d))>tolerance)return false;const lo=Math.min(along(c),along(d)),hi=Math.max(along(c),along(d));return Math.min(length,hi)-Math.max(0,lo)>=Math.min(length,l)*.5;}))||null;
}

// Multiple continuous rails through the aperture conflict with a clear jamb
// gap. This is a rejection cue, not proof that every such symbol is a window.
export function glazingBarrierEvidence(a,b,{width,height,mask},unit=1){
 const span=dist(a,b);if(span<8)return {score:0};
 const ux=(b.x-a.x)/span,uy=(b.y-a.y)/span,limit=Math.max(3,span*.12),runs=[];let start=null,best=0;
 for(let offset=-Math.ceil(limit);offset<=Math.ceil(limit);offset++){
  let hits=0;const count=30;
  for(let i=0;i<count;i++){const t=.15+.7*i/(count-1),x=Math.round(a.x+(b.x-a.x)*t-uy*offset),y=Math.round(a.y+(b.y-a.y)*t+ux*offset);if(x>=0&&y>=0&&x<width&&y<height&&mask[y*width+x])hits++;}
  const ratio=hits/count;if(ratio>=.8){if(start===null)start=offset;best=Math.max(best,ratio);}else if(start!==null){runs.push([start,offset-1]);start=null;}
 }
 if(start!==null)runs.push([start,Math.ceil(limit)]);
 return {score:runs.some((r,i)=>runs.slice(i+1).some(s=>s[0]-r[1]>=Math.max(2,2*unit)))?best:0};
}

// Test a real jamb gap for a quarter-circle swing, on either side and hinge.
// Gap-only evidence is not enough: windows and broken scans also make gaps.
export function doorSwingEvidence(a,b,{width,height,mask},unit=1){
 const span=dist(a,b),tol=Math.max(1,1.5*unit);if(span<5)return {score:0};
 const hit=q=>{for(let dx=-Math.ceil(tol);dx<=tol;dx++)for(let dy=-Math.ceil(tol);dy<=tol;dy++){if(dx*dx+dy*dy>tol*tol+1)continue;const x=Math.round(q.x+dx),y=Math.round(q.y+dy);if(x>=0&&y>=0&&x<width&&y<height&&mask[y*width+x])return true;}return false;};
 let best={score:0};const matches=[];
 for(const hinge of [0,1])for(const side of [-1,1])for(const fraction of [1,.5]){
  const c=hinge?b:a,end=hinge?a:b,r=span*fraction,u={x:(end.x-c.x)/span,y:(end.y-c.y)/span},n={x:-u.y*side,y:u.x*side};
  if(r<5)continue;
  let arc=0,leaf=0;const samples=24;
  for(let i=0;i<samples;i++){const angle=(15+60*i/(samples-1))*Math.PI/180;if(hit({x:c.x+r*(u.x*Math.cos(angle)+n.x*Math.sin(angle)),y:c.y+r*(u.y*Math.cos(angle)+n.y*Math.sin(angle))}))arc++;const t=.2+.7*i/(samples-1);if(hit({x:c.x+n.x*r*t,y:c.y+n.y*r*t}))leaf++;}
  // Require distributed arc support, not a single crossing line or endpoint.
  const score=arc/samples*.8+leaf/samples*.2;
  if(arc/samples>=.5&&leaf/samples>=.25){const match={score,arc:arc/samples,leaf:leaf/samples,hinge,side,fraction,openSide:hinge?-side:side};matches.push(match);if(score>best.score)best=match;}
 }
 if(!best.score)return best;
 const pair=matches.filter(m=>m.fraction===.5&&m.openSide===best.openSide&&m.score>=.55);
 const double=pair.some(m=>m.hinge===0)&&pair.some(m=>m.hinge===1);
 const ambiguous=matches.some(m=>m.openSide!==best.openSide&&m.score>=Math.max(.55,best.score-.1));
 const center=lerp(a,b,.5),normal={x:-(b.y-a.y)/span,y:(b.x-a.x)/span};
 best={...best,doorType:double?'double':best.fraction===1?'single':'unknown',leafCount:double?2:best.fraction===1?1:null,
  swingPoint:ambiguous?null:{x:center.x+normal.x*best.openSide*span*.3,y:center.y+normal.y*best.openSide*span*.3}};
 return best;
}
