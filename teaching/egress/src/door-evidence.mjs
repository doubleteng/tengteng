import {dist,lerp} from './geometry.mjs?v=portal-network-1';

// Test a real jamb gap for a quarter-circle swing, on either side and hinge.
// Gap-only evidence is not enough: windows and broken scans also make gaps.
export function doorSwingEvidence(a,b,{width,height,mask},unit=1){
 const span=dist(a,b),tol=Math.max(1,1.5*unit);if(span<5)return {score:0};
 const hit=q=>{for(let dx=-Math.ceil(tol);dx<=tol;dx++)for(let dy=-Math.ceil(tol);dy<=tol;dy++){if(dx*dx+dy*dy>tol*tol+1)continue;const x=Math.round(q.x+dx),y=Math.round(q.y+dy);if(x>=0&&y>=0&&x<width&&y<height&&mask[y*width+x])return true;}return false;};
 let best={score:0};
 for(const hinge of [0,1])for(const side of [-1,1])for(const fraction of [1,.5]){
  const c=hinge?b:a,end=hinge?a:b,r=span*fraction,u={x:(end.x-c.x)/span,y:(end.y-c.y)/span},n={x:-u.y*side,y:u.x*side};
  if(r<5)continue;
  let arc=0,leaf=0;const samples=24;
  for(let i=0;i<samples;i++){const angle=(15+60*i/(samples-1))*Math.PI/180;if(hit({x:c.x+r*(u.x*Math.cos(angle)+n.x*Math.sin(angle)),y:c.y+r*(u.y*Math.cos(angle)+n.y*Math.sin(angle))}))arc++;const t=.2+.7*i/(samples-1);if(hit({x:c.x+n.x*r*t,y:c.y+n.y*r*t}))leaf++;}
  // Require distributed arc support, not a single crossing line or endpoint.
  const score=arc/samples*.8+leaf/samples*.2;
  if(arc/samples>=.5&&leaf/samples>=.25&&score>best.score)best={score,arc:arc/samples,leaf:leaf/samples,hinge,side,fraction};
 }
 return best;
}
