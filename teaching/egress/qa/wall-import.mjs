import {dist,lerp} from './geometry.mjs?v=topology-rebuild-2';

// Conservative proposals only: two straight, nearly parallel, substantially
// overlapping faces on the same layer, with no competing mate. The UI requires
// review before these centerlines become analysis walls; original CAD is retained.
export function pairWallFaces(segments,{minThickness=.07,maxThickness=.6}={}) {
  if(!(minThickness>0)||!(maxThickness>=minThickness))throw Error('Enter a valid wall thickness range.');
  if(segments.length>1500)throw Error('Select at most 1,500 wall-face segments for pairing.');
  const proposals=[],matches=segments.map(()=>[]);
  for(let i=0;i<segments.length;i++){
    const a=segments[i],la=dist(a.a,a.b);if(la<.5)continue;
    const u={x:(a.b.x-a.a.x)/la,y:(a.b.y-a.a.y)/la};
    for(let j=i+1;j<segments.length;j++){
      const b=segments[j],lb=dist(b.a,b.b);if(lb<.5||a.layer!==b.layer)continue;
      const vx=(b.b.x-b.a.x)/lb,vy=(b.b.y-b.a.y)/lb;
      if(Math.abs(u.x*vy-u.y*vx)>Math.sin(Math.PI/180))continue;
      const off=q=>(q.x-a.a.x)*-u.y+(q.y-a.a.y)*u.x;
      const o1=off(b.a),o2=off(b.b),thickness=Math.abs((o1+o2)/2);
      if(o1*o2<=0||Math.abs(o1-o2)>.02||thickness<minThickness||thickness>maxThickness)continue;
      const along=q=>(q.x-a.a.x)*u.x+(q.y-a.a.y)*u.y;
      const t1=along(b.a),t2=along(b.b),lo=Math.max(0,Math.min(t1,t2)),hi=Math.min(la,Math.max(t1,t2));
      if(hi-lo<.5||(hi-lo)/Math.max(la,lb)<.85)continue;
      const offset=(o1+o2)/4;
      const at=t=>({x:a.a.x+u.x*t-u.y*offset,y:a.a.y+u.y*t+u.x*offset});
      const candidate={a:at(lo),b:at(hi),thickness,source:[i,j]};
      matches[i].push(candidate);matches[j].push(candidate);proposals.push(candidate);
    }
  }
  const pairs=proposals.filter(c=>c.source.every(i=>matches[i].length===1));
  const paired=new Set(pairs.flatMap(c=>c.source));
  return {pairs,unpaired:segments.map((_,i)=>i).filter(i=>!paired.has(i)),ambiguous:matches.filter(m=>m.length>1).length};
}
