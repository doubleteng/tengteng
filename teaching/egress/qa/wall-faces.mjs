import {dist,lerp,project} from './geometry.mjs?v=topology-rebuild-2';

// Opposite faces of one drawn wall are paired before junctions or room faces
// are built. The pixel evidence and occupied-space veto are both mandatory.
export function collapseWallFaces(input,{unit=1,faceEvidence=()=>false,interiorAt=()=>false}={}){
 const lines=input.map(s=>({...s,a:{...s.a},b:{...s.b}}));
 const axis=s=>{const length=dist(s.a,s.b);return {x:(s.b.x-s.a.x)/length,y:(s.b.y-s.a.y)/length,length};};
 const at=(p,u,d)=>({x:p.x+u.x*d,y:p.y+u.y*d});
 const maxGap=Math.max(4,16*unit),minGap=Math.max(1.2,1.5*unit);
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const s=lines[i],t=lines[j],u=axis(s),v=axis(t);if(!u.length||!v.length||Math.min(u.length,v.length)/Math.max(u.length,v.length)<.45)continue;
  if(Math.abs(u.x*v.y-u.y*v.x)>.045)continue;
  const n={x:-u.y,y:u.x},dot=p=>(p.x-s.a.x)*u.x+(p.y-s.a.y)*u.y,normal=p=>(p.x-s.a.x)*n.x+(p.y-s.a.y)*n.y;
  const ta=dot(t.a),tb=dot(t.b),lo=Math.max(0,Math.min(ta,tb)),hi=Math.min(u.length,Math.max(ta,tb));
  if(hi-lo<Math.min(u.length,v.length)*.75)continue;
  const da=normal(t.a),db=normal(t.b),gap=Math.abs((da+db)/2);
  if(da*db<=0||gap<minGap||gap>maxGap||Math.abs(da-db)>Math.max(1.5,4*unit))continue;
  // Already centered, broad wall bands do not supply another wall face.
  if((s.band||0)>gap*.6||(t.band||0)>gap*.6)continue;
  let supported=0,veto=false;
  for(let k=1;k<=11;k++){
   const a=at(s.a,u,lo+(hi-lo)*k/12),b=project(a,t.a,t.b),m=lerp(a,b,.5);
   if(interiorAt(m,gap)){veto=true;break;}
   if(faceEvidence(a,b))supported++;
  }
  if(veto||supported<9)continue;
  const origin=at(s.a,n,(da+db)/4),a=at(origin,u,Math.min(0,ta,tb)),b=at(origin,u,Math.max(u.length,ta,tb));
  lines[i]={...s,a,b,explicit:s.explicit||t.explicit,pairedFaces:true,band:gap/2+Math.max(1,s.band||0,t.band||0)};
  lines.splice(j--,1);
 }
 return lines;
}
