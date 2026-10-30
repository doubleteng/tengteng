// PDF.js 5.6.205 operator-list linework adapter. Coordinates are normalized to
// the rendered page so calibration and floor alignment affect pixels and lines
// together. Text is deliberately excluded; linework still needs semantic review.
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const map=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
export function pdfLinework(operatorList,OPS,viewport){
  const segments=[],stack=[];let matrix=[1,0,0,1,0,0],ignoredCurves=0;
  const convert=p=>{const q=map(viewport.transform,map(matrix,p));return {x:q.x/viewport.width,y:1-q.y/viewport.height};};
  const add=(a,b)=>{if(!a||!b||segments.length>=35000)return;const p=convert(a),q=convert(b);if(Math.hypot(p.x-q.x,p.y-q.y)<1e-6)return;if([p,q].some(p=>p.x<-.01||p.y<-.01||p.x>1.01||p.y>1.01))return;segments.push({a:p,b:q});};
  for(let i=0;i<operatorList.fnArray.length;i++){
    const op=operatorList.fnArray[i],args=operatorList.argsArray[i]||[];
    if(op===OPS.save){stack.push([...matrix]);continue;}
    if(op===OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
    if(op===OPS.transform){matrix=mul(matrix,args);continue;}
    if(op===OPS.paintFormXObjectBegin){stack.push([...matrix]);if(args[0])matrix=mul(matrix,args[0]);continue;}
    if(op===OPS.paintFormXObjectEnd){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
    if(op!==OPS.constructPath||!args[2])continue;
    const data=args[1]?.[0];if(!data?.length)continue;let current=null,start=null;
    for(let j=0;j<data.length;){const verb=data[j++];if(verb===0){current={x:data[j++],y:data[j++]};start={...current};}else if(verb===1){const next={x:data[j++],y:data[j++]};add(current,next);current=next;}else if(verb===4){add(current,start);current=start;}else if(verb===2||verb===3){
      if(!current)break;const origin=current,control1={x:data[j++],y:data[j++]},control2=verb===2?{x:data[j++],y:data[j++]}:null,end={x:data[j++],y:data[j++]};
      for(let k=1;k<=16;k++){const t=k/16,u=1-t,next=verb===2?{x:u**3*origin.x+3*u*u*t*control1.x+3*u*t*t*control2.x+t**3*end.x,y:u**3*origin.y+3*u*u*t*control1.y+3*u*t*t*control2.y+t**3*end.y}:{x:u*u*origin.x+2*u*t*control1.x+t*t*end.x,y:u*u*origin.y+2*u*t*control1.y+t*t*end.y};add(current,next);current=next;}
    }else{ignoredCurves++;break;}}
  }
  return {segments,method:'PDF vector paths',warnings:['Review walls separately from dimensions, grids, hatches and door symbols. PDF clipping and fill semantics are not analysis boundaries.',...(ignoredCurves?['Some unsupported paths were omitted.']:[])]};
}

// Binary centerline vectorization for scanned sheets. Zhang-Suen thinning
// preserves diagonal/curved strokes and junctions; polyline simplification keeps
// the result editable. Semantic wall/door interpretation remains a review step.
export function rasterLinework(imageData){
  const {width:w,height:h,data}=imageData,n=w*h,mask=new Uint8Array(n);let active=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,k=i*4;if(data[k+3]>128&&data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722<150){mask[i]=1;active.push(i);}}
  let changed=true,iterations=0;
  while(changed&&iterations++<80){changed=false;for(let phase=0;phase<2;phase++){
    const remove=[];for(const i of active){const a=mask[i-w],b=mask[i-w+1],c=mask[i+1],d=mask[i+w+1],e=mask[i+w],f=mask[i+w-1],g=mask[i-1],h=mask[i-w-1],sum=a+b+c+d+e+f+g+h;if(sum<2||sum>6)continue;
      const changes=(!a&&b)+(!b&&c)+(!c&&d)+(!d&&e)+(!e&&f)+(!f&&g)+(!g&&h)+(!h&&a);if(changes!==1)continue;
      if(phase===0?(a*c*e||c*e*g):(a*c*g||a*e*g))continue;remove.push(i);
    }if(remove.length){changed=true;for(const i of remove)mask[i]=0;active=active.filter(i=>mask[i]);}
  }}
  const neighbors=i=>{const list=[];for(const step of [-w,1,w,-1])if(mask[i+step])list.push(i+step);for(const [step,a,b]of [[-w+1,-w,1],[w+1,w,1],[w-1,w,-1],[-w-1,-w,-1]])if(mask[i+step]&&!mask[i+a]&&!mask[i+b])list.push(i+step);return list;};
  const visited=new Set(),segments=[],minimum=Math.max(10,Math.min(w,h)*.012),coord=i=>({x:i%w,y:Math.floor(i/w)}),key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
  const simplify=(points,epsilon=1.2)=>{if(points.length<3)return points;const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q.x-p.x,dy=q.y-p.y,l=dx*dx+dy*dy;let max=epsilon*epsilon,index=-1;for(let i=a+1;i<b;i++){const r=points[i],t=l?Math.max(0,Math.min(1,((r.x-p.x)*dx+(r.y-p.y)*dy)/l)):0,d=(r.x-p.x-dx*t)**2+(r.y-p.y-dy*t)**2;if(d>max){max=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}return [...keep].sort((a,b)=>a-b).map(i=>points[i]);};
  function walk(start,next){if(visited.has(key(start,next)))return;const path=[coord(start)];let previous=start,current=next,total=0;
    for(let limit=0;limit<=active.length;limit++){const k=key(previous,current);if(visited.has(k))break;visited.add(k);const q=coord(current),last=path.at(-1);total+=Math.hypot(q.x-last.x,q.y-last.y);path.push(q);const opts=neighbors(current).filter(i=>i!==previous);if(opts.length!==1||current===start)break;previous=current;current=opts[0];}
    if(total<minimum)return;const poly=simplify(path);for(let i=1;i<poly.length;i++)if(segments.length<35000)segments.push({a:{x:poly[i-1].x/w,y:1-poly[i-1].y/h},b:{x:poly[i].x/w,y:1-poly[i].y/h}});
  }
  for(const i of active){const ns=neighbors(i);if(ns.length!==2)for(const j of ns)walk(i,j);}
  for(const i of active)for(const j of neighbors(i))walk(i,j);
  return {segments,method:'Scanned centerline vectors',warnings:['Image vectors follow dark strokes, including angled and curved lines. Review scale, wall thickness, gaps, text and furniture before assigning walls. Recognition does not infer door or room meaning.',...(changed?['Thick dark regions exceeded the thinning limit; simplify or crop the source image.']:[]),...(segments.length>=35000?['Vector output reached the 35,000-segment limit. Use a simpler image.']:[])]};
}

export function referenceLinework(image){
  const c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0),point=p=>{const x=p.x*image.width,y=p.y*image.height;return [image.x+c*x-s*y,image.y+s*x+c*y,0];};
  return {format:'pdf/image',unitName:'Meters',unitScale:1000,layers:[{id:'plan',name:image.linework.method,visible:true}],segments:image.linework.segments.map(s=>({a:point(s.a),b:point(s.b),layer:'plan',visible:true})),ignored:{},warnings:image.linework.warnings};
}
