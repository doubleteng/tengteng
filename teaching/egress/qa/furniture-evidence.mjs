import {strokeMask} from './import-quality.mjs?v=topology-rebuild-2';
import {area,dist,crosses} from './geometry.mjs?v=topology-rebuild-2';

// Recognition supplies an object location, never a license to turn a group
// of tables, chairs and aisles into one obstacle. Only an independently
// supported closed contour is fitted; unresolved proposals remain editable.
export function usableFurnitureGeometry(e){
 return e.kind!=='furniture'||e.confirmed===true||e.recognition?.reviewed===true||e.sourceGeometry?.status==='fitted'||!e.recognition&&!e.confidence&&!e.sourceGeometry;
}
export function refineFurnitureGeometry(result,imageData){
 const source=strokeMask(imageData),{width:w,height:h,mask}=source,unit=Math.max(w,h)/2000;
 const radius=Math.max(3,Math.min(16,8*unit)),tolerance=Math.max(.75,Math.min(1.5,unit));
 const hit=q=>{for(let x=-Math.ceil(tolerance);x<=tolerance;x++)for(let y=-Math.ceil(tolerance);y<=tolerance;y++){if(x*x+y*y>tolerance*tolerance+.1)continue;const xx=Math.round(q.x+x),yy=Math.round(q.y+y);if(xx>=0&&yy>=0&&xx<w&&yy<h&&mask[yy*w+xx])return true;}return false;};
 const measure=(a,b)=>{const l=dist(a,b),count=Math.max(12,Math.min(160,Math.ceil(l*1.5)));let hits=0,gap=0,longest=0;for(let i=0;i<count;i++){const t=.04+.92*i/(count-1),q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(hit(q)){hits++;gap=0;}else longest=Math.max(longest,++gap);}return{coverage:hits/count,gapFraction:longest/count};};
 const intersect=(s,t)=>{const u={x:s.b.x-s.a.x,y:s.b.y-s.a.y},v={x:t.b.x-t.a.x,y:t.b.y-t.a.y},d=u.x*v.y-u.y*v.x;if(Math.abs(d)<1e-7)return null;const z=((t.a.x-s.a.x)*v.y-(t.a.y-s.a.y)*v.x)/d;return{x:s.a.x+u.x*z,y:s.a.y+u.y*z};};
 return {...result,elements:result.elements.map(e=>{
  if(e.kind!=='furniture'||e.confirmed)return e;
  const original=e.points.map(([x,y])=>({x:x*w/1000,y:y*h/1000})),fits=[];let coverage=1;
  for(let i=0;i<original.length;i++){
   const a=original[i],b=original[(i+1)%original.length],l=dist(a,b);if(l<3){coverage=0;break;}
   const n={x:-(b.y-a.y)/l,y:(b.x-a.x)/l};let best=null;
   for(let slope=-.10;slope<=.1001;slope+=.025)for(let offset=-radius;offset<=radius;offset+=.5){
    const aa={x:a.x+n.x*(offset-slope*l/2),y:a.y+n.y*(offset-slope*l/2)},bb={x:b.x+n.x*(offset+slope*l/2),y:b.y+n.y*(offset+slope*l/2)},m=measure(aa,bb),score=m.coverage-Math.abs(offset)/radius*.035-Math.abs(slope)*.2;
    if(!best||score>best.score)best={a:aa,b:bb,...m,score};
   }
   fits.push(best);coverage=Math.min(coverage,best.coverage);
  }
  let points=fits.length===original.length?fits.map((s,i)=>intersect(fits[(i+fits.length-1)%fits.length],s)):[];
  let valid=points.length===original.length&&points.every((p,i)=>p&&dist(p,original[i])<=radius*2.5&&p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h)&&fits.every(f=>f.coverage>=.8&&f.gapFraction<=.12);
  if(valid){const ratio=area(points)/area(original);valid=ratio>.6&&ratio<1.6;}
  if(valid)for(let i=0;i<points.length;i++){const m=measure(points[i],points[(i+1)%points.length]);coverage=Math.min(coverage,m.coverage);if(m.coverage<.8||m.gapFraction>.12)valid=false;for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;if(crosses(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))valid=false;}}
  return {...e,points:valid?points.map(p=>[p.x/w*1000,p.y/h*1000]):e.points,sourceGeometry:{version:1,status:valid?'fitted':'unresolved',coverage,note:valid?'Contour fitted to nearby source strokes; object identity still needs checking.':'No reliable closed furniture contour at this location. Original symbols remain in the underlay; redraw or read a detail.'}};
 })};
}
