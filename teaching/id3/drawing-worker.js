// Orthographic architectural linework. Inputs and returned SVG coordinates are metres.
const CREASE = Math.cos(20 * Math.PI / 180);
const UV_EPS = 1e-9;

function preparePart({xyz, indices}) {
  const aliases = new Uint32Array(xyz.length / 3);
  const welded = new Map();
  for (let i = 0; i < aliases.length; i++) {
    const at = i * 3;
    const key = [xyz[at], xyz[at+1], xyz[at+2]].map(v => Math.round(v*1e6)).join(',');
    if (!welded.has(key)) welded.set(key, i);
    aliases[i] = welded.get(key);
  }
  const edges = new Map(), normals = new Float32Array(indices.length);
  const n = aliases.length;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]*3, b = indices[i+1]*3, c = indices[i+2]*3;
    const ax = xyz[b]-xyz[a], ay = xyz[b+1]-xyz[a+1], az = xyz[b+2]-xyz[a+2];
    const bx = xyz[c]-xyz[a], by = xyz[c+1]-xyz[a+1], bz = xyz[c+2]-xyz[a+2];
    const nx = ay*bz-az*by, ny = az*bx-ax*bz, nz = ax*by-ay*bx;
    const length = Math.hypot(nx,ny,nz);
    if (!(length > 1e-14)) continue;
    normals[i] = nx/length; normals[i+1] = ny/length; normals[i+2] = nz/length;
    for (let j = 0; j < 3; j++) {
      const s = aliases[indices[i+j]], t = aliases[indices[i+(j+1)%3]];
      if (s === t) continue;
      const lo = Math.min(s,t), hi = Math.max(s,t), key = lo*n + hi;
      const old = edges.get(key), sign = s === lo ? 1 : -1;
      if (!old) edges.set(key, {a:lo, b:hi, first:i, firstSign:sign, second:-1});
      else if (old.second===-1) { old.second=i; old.secondSign=sign; }
      else { (old.extra ||= []).push({face:i, sign}); }
    }
  }
  const dot = (a,b) => normals[a]*normals[b] + normals[a+1]*normals[b+1] + normals[a+2]*normals[b+2];
  const drawable=[];
  for(const edge of edges.values()) {
    if(edge.extra) {
      // Adjacent closed fabrication cells may share an entire side wall. Its
      // opposed coincident faces would make a continuous top look triangulated.
      // Cancel only faces on the SAME side of the edge with opposite winding.
      const adjacent=[{face:edge.first,sign:edge.firstSign},{face:edge.second,sign:edge.secondSign},...edge.extra];
      for(let a=0;a<adjacent.length;a++) {
        const left=adjacent[a];
        if(left.cancelled) continue;
        const mate=adjacent.find((right,b)=>b>a && !right.cancelled && left.sign!==right.sign
          && dot(left.face,right.face)<-1+1e-6);
        if(mate) { left.cancelled=true; mate.cancelled=true; }
      }
      const remain=adjacent.filter(f=>!f.cancelled);
      if(!remain.length) continue;
      edge.first=remain[0].face;
      edge.second=remain.length>1?remain[1].face:-1;
      if(remain.length>2) {
        edge.crease=remain.some(f=>Math.abs(dot(edge.first,f.face))<CREASE);
      }
    }
    if(edge.second!==-1) {
      // Oppositely wound coplanar imported sheets also have no visible diagonal.
      const angle=Math.abs(dot(edge.first,edge.second));
      if(angle>1-1e-6 && !edge.crease) continue;
      edge.crease ||= angle<CREASE;
    }
    drawable.push(edge);
  }
  return {xyz, indices, normals, edges:drawable};
}

export function prepareDrawing(parts, bounds) {
  if (!parts.length) throw new Error('This project has no visible geometry.');
  return {parts:parts.map(preparePart), bounds};
}

function projection(options, bounds) {
  const type = options.type || 'plan';
  let d, h, v;
  if (type === 'plan') { h=[0,1]; v=[2,1]; d=[1,1]; }
  else {
    let direction = options.direction || 'front';
    if (type === 'section') {
      if (options.axis === 'x') direction = direction === 'left' ? 'left' : 'right';
      else direction = direction === 'back' ? 'back' : 'front';
    }
    if (direction === 'right') { h=[2,-1]; d=[0,1]; }
    else if (direction === 'left') { h=[2,1]; d=[0,-1]; }
    else if (direction === 'back') { h=[0,-1]; d=[2,-1]; }
    else { h=[0,1]; d=[2,1]; }
    v=[1,-1];
  }
  let cut = Infinity;
  if (type !== 'elevation') {
    const axis = d[0], mid = (bounds.min[axis]+bounds.max[axis])*.5;
    const value = Number.isFinite(options.offset) ? options.offset : mid;
    cut = value * d[1];
  }
  const ext = ([ax,sign]) => sign > 0 ? [bounds.min[ax],bounds.max[ax]] : [-bounds.max[ax],-bounds.min[ax]];
  return {h, v, d, cut, uRange:ext(h), vRange:ext(v)};
}

function project(xyz, {h,v,d}) {
  const out = new Float64Array(xyz.length);
  for (let i = 0; i < out.length; i += 3) {
    out[i] = xyz[i+h[0]]*h[1]; out[i+1] = xyz[i+v[0]]*v[1]; out[i+2] = xyz[i+d[0]]*d[1];
  }
  return out;
}

// The grid only indexes candidate occluders. Visibility is resolved analytically
// against the finite, projected triangles and their affine depth, without rasterization.
function buildOccluders(projected, view) {
  const span = Math.max(view.uRange[1]-view.uRange[0], view.vRange[1]-view.vRange[0], .001);
  const size = span/96, u0 = view.uRange[0]-size*.01, v0 = view.vRange[0]-size*.01;
  const cols = Math.floor((view.uRange[1]-u0)/size)+1;
  const rows = Math.floor((view.vRange[1]-v0)/size)+1;
  const bins = Array.from({length:cols*rows}, () => []), triangles = [];
  const cx = x => Math.min(cols-1,Math.max(0,Math.floor((x-u0)/size)));
  const cy = y => Math.min(rows-1,Math.max(0,Math.floor((y-v0)/size)));
  for (const {points:p, part:{indices}} of projected) {
    for (let i=0; i<indices.length; i+=3) {
      const a=indices[i]*3, b=indices[i+1]*3, c=indices[i+2]*3;
      const u=p[a], v=p[a+1], d=p[a+2];
      const du1=p[b]-u, dv1=p[b+1]-v, du2=p[c]-u, dv2=p[c+1]-v;
      const det = du1*dv2-dv1*du2;
      if (Math.abs(det)<1e-13 || Math.min(d,p[b+2],p[c+2])>view.cut+UV_EPS) continue;
      const id=triangles.length, maxD=Math.max(d,p[b+2],p[c+2]);
      triangles.push({u,v,d, su:dv2/det,sv:-du2/det,tu:-dv1/det,tv:du1/det,
        ds:p[b+2]-d,dt:p[c+2]-d,maxD});
      const minX=cx(Math.min(u,p[b],p[c])), maxX=cx(Math.max(u,p[b],p[c]));
      const minY=cy(Math.min(v,p[b+1],p[c+1])), maxY=cy(Math.max(v,p[b+1],p[c+1]));
      for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) bins[y*cols+x].push(id);
    }
  }
  return {bins,cols,rows,cx,cy,u0,v0,size,triangles,stamp:new Uint32Array(triangles.length),epoch:0};
}

// Intersect t in [0,1] with f(t)>=0.
function retain(interval, intercept, slope) {
  if (Math.abs(slope)<1e-14) return intercept>=0;
  const t = -intercept/slope;
  if (slope>0) interval[0]=Math.max(interval[0],t);
  else interval[1]=Math.min(interval[1],t);
  return interval[1] > interval[0] + 1e-9;
}

function visitEdgeBins(grid, x, y, dx, dy, visit) {
  let col=grid.cx(x), row=grid.cy(y);
  const endX=grid.cx(x+dx), endY=grid.cy(y+dy), sx=Math.sign(dx), sy=Math.sign(dy);
  const dtX=dx ? grid.size/Math.abs(dx) : Infinity, dtY=dy ? grid.size/Math.abs(dy) : Infinity;
  let tx=dx ? (grid.u0+(col+(sx>0?1:0))*grid.size-x)/dx : Infinity;
  let ty=dy ? (grid.v0+(row+(sy>0?1:0))*grid.size-y)/dy : Infinity;
  for(let step=0;step<=grid.cols+grid.rows+2;step++) {
    if(!visit(grid.bins[row*grid.cols+col])) return;
    if(col===endX&&row===endY) return;
    if(col!==endX && (row===endY || tx<=ty)) { col+=sx; tx+=dtX; }
    else { row+=sy; ty+=dtY; }
  }
}

function visibleIntervals(grid, u,v,d, du,dv,dd, cut, eps) {
  const range = [0,1];
  if (Number.isFinite(cut) && !retain(range,cut-d,-dd)) return [];
  let pieces = [range];
  const epoch = ++grid.epoch, minDepth=Math.min(d,d+dd), test=[0,1];
  visitEdgeBins(grid,u,v,du,dv, ids => {
    for (const id of ids) {
      if (grid.stamp[id]===epoch) continue;
      grid.stamp[id]=epoch;
      const face=grid.triangles[id];
      if (face.maxD<=minDepth+eps) continue;
      const x=u-face.u, y=v-face.v;
      const s=face.su*x+face.sv*y, t=face.tu*x+face.tv*y;
      const ds=face.su*du+face.sv*dv, dt=face.tu*du+face.tv*dv;
      test[0]=range[0]; test[1]=range[1];
      if (!retain(test,s+UV_EPS,ds) || !retain(test,t+UV_EPS,dt) || !retain(test,1-s-t+UV_EPS,-ds-dt)) continue;
      const depth=face.d+face.ds*s+face.dt*t, delta=face.ds*ds+face.dt*dt;
      if (!retain(test,depth-d-eps,delta-dd)) continue;
      if (Number.isFinite(cut) && !retain(test,cut-depth,-delta)) continue;
      const lo=test[0], hi=test[1];
      const next=[];
      for (const [a,b] of pieces) {
        if (hi<=a || lo>=b) { next.push([a,b]); continue; }
        if (lo>a+1e-8) next.push([a,lo]);
        if (hi<b-1e-8) next.push([hi,b]);
      }
      pieces=next;
      if(!pieces.length) return false;
    }
    return true;
  });
  return pieces;
}

function slicePaths(points, indices, cut, fmt, snap) {
  const vertices=[], ids=new Map(), segments=[], incident=[];
  function id(u,v) {
    const key=Math.round(u/snap)+','+Math.round(v/snap);
    if (ids.has(key)) return ids.get(key);
    const i=vertices.length; vertices.push([u,v]); ids.set(key,i); incident.push([]);
    return i;
  }
  for(let i=0;i<indices.length;i+=3) {
    let enter=-1,leave=-1;
    for(let j=0;j<3;j++) {
      const a=indices[i+j]*3,b=indices[i+(j+1)%3]*3;
      const da=points[a+2]-cut,db=points[b+2]-cut;
      if ((da<=0)===(db<=0)) continue;
      const t=da/(da-db);
      const vertex=id(points[a]+(points[b]-points[a])*t,points[a+1]+(points[b+1]-points[a+1])*t);
      if(da>0) enter=vertex; else leave=vertex;
    }
    if(enter<0 || leave<0 || enter===leave) continue;
    const index=segments.length;
    segments.push([enter,leave]); incident[enter].push(index); incident[leave].push(index);
  }
  const used=new Uint8Array(segments.length), closed=[], open=[];
  function walk(start, first) {
    const path=[start]; let current=start, edge=first;
    while(edge!==undefined && !used[edge]) {
      used[edge]=1;
      const [a,b]=segments[edge]; current=current===a?b:a;
      if(current===start) break;
      path.push(current);
      // Keep the oriented cut winding (including openings), falling back to
      // an undirected walk for student meshes with inconsistent face winding.
      edge=incident[current].find(k=>!used[k] && segments[k][0]===current)
        ??incident[current].find(k=>!used[k]);
    }
    const closedLoop=current===start;
    if(path.length < (closedLoop?3:2)) return;
    const clean=[];
    for(const n of path) {
      const p=vertices[n];
      if(clean.length>1) {
        const a=clean.at(-2),b=clean.at(-1),x=b[0]-a[0],y=b[1]-a[1];
        if(Math.abs(x*(p[1]-a[1])-y*(p[0]-a[0]))<=snap*Math.hypot(x,y)
          && x*(p[0]-b[0])+y*(p[1]-b[1])>=0) clean.pop();
      }
      clean.push(p);
    }
    const line=clean.map(([u,v],k)=>(k?'L':'M')+fmt(u)+' '+fmt(v)).join('');
    if(closedLoop) closed.push(line+'Z'); else open.push(line);
  }
  incident.forEach((list,vertex)=>{ if(list.length===1 && !used[list[0]]) walk(vertex,list[0]); });
  segments.forEach(([a],i)=>{ if(!used[i]) walk(a,i); });
  return {closed,open};
}

function xmlText(value) {
  return String(value).replace(/[<>&"']/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
}

export function renderDrawing(model, options={}) {
  const view=projection(options,model.bounds);
  const projected=model.parts.map(part=>({part,points:project(part.xyz,view)}));
  const grid=buildOccluders(projected,view);
  const width=view.uRange[1]-view.uRange[0], height=view.vRange[1]-view.vRange[0];
  const span=Math.max(width,height,.001), padding=span*.026;
  const viewBox=[view.uRange[0]-padding,view.vRange[0]-padding,width+2*padding,height+2*padding];
  const precision=Math.max(3,Math.min(8,Math.ceil(-Math.log10(span/200000))));
  const fmt=n=>String(Number(n.toFixed(precision)));
  const sharp=[], cuts=[], outlines=[], unique=new Set();
  const snap=Math.max(span*1e-8,1e-8), depthEps=Math.max(span*1e-8,1e-8);
  let cutLoops=0, openCuts=0;
  for (const {part,points:p} of projected) {
    for (const edge of part.edges) {
      if(edge.second!==-1 && !edge.crease) {
        const d=view.d[0], front=part.normals[edge.first+d], back=part.normals[edge.second+d];
        if ((front>1e-6 && back>1e-6) || (front< -1e-6 && back< -1e-6)
          || (Math.abs(front)<1e-6 && Math.abs(back)<1e-6)) continue;
      }
      const a=edge.a*3,b=edge.b*3;
      const u=p[a],v=p[a+1],d=p[a+2],du=p[b]-u,dv=p[b+1]-v,dd=p[b+2]-d;
      if ((Math.abs(du)+Math.abs(dv)<snap) || Math.min(d,d+dd)>view.cut) continue;
      for (const [lo,hi] of visibleIntervals(grid,u,v,d,du,dv,dd,view.cut,depthEps)) {
        const first=fmt(u+lo*du)+' '+fmt(v+lo*dv),last=fmt(u+hi*du)+' '+fmt(v+hi*dv);
        if(first===last) continue;
        const key=first<last?first+'L'+last:last+'L'+first;
        if(!unique.has(key)){ unique.add(key); sharp.push('M'+key); }
      }
    }
    if(Number.isFinite(view.cut)) {
      const {closed,open}=slicePaths(p,part.indices,view.cut,fmt,snap);
      if(closed.length) cuts.push('<path d="'+closed.join('')+'"/>');
      if(open.length) outlines.push(...open);
      cutLoops+=closed.length; openCuts+=open.length;
    }
  }
  const title=xmlText(options.title || ({elevation:'Elevation',section:'Section',plan:'Floor plan'}[options.type]||'Floor plan'));
  const vb=viewBox.map(fmt).join(' '), weight=span/1450;
  const svg=[
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="'+vb+'" width="1200" height="'+Math.max(1,Math.round(1200*viewBox[3]/viewBox[2]))+'">',
    '<title>'+title+'</title>',
    '<g stroke-linecap="round" stroke-linejoin="round">',
    '<path data-ink="projection" fill="none" stroke="#52636a" stroke-width="'+fmt(weight)+'" d="'+sharp.join('')+'"/>',
    '<g data-ink="cut" stroke="#192e33" fill="#c5d1cc" fill-rule="nonzero" stroke-width="'+fmt(weight*2.05)+'">'+cuts.join('')+'</g>',
    outlines.length?'<path data-ink="open-cut" fill="none" stroke="#192e33" stroke-width="'+fmt(weight*2.05)+'" d="'+outlines.join('')+'"/>':'',
    '</g></svg>',
  ].join('');
  return {svg,viewBox,units:'m',metresPerUnit:1,bounds:model.bounds,
    stats:{visibleEdges:sharp.length,cutLoops,openCuts}};
}

if(typeof WorkerGlobalScope!=='undefined' && self instanceof WorkerGlobalScope) {
  let model;
  self.onmessage=({data})=>{
    if(data.type==='init') {
      try { model=prepareDrawing(data.parts,data.bounds); }
      catch(error){ self.postMessage({fatal:error.message}); }
    } else if(data.type==='render') {
      try { self.postMessage({id:data.id,result:renderDrawing(model,data.options)}); }
      catch(error){ self.postMessage({id:data.id,error:error.message}); }
    }
  };
}
