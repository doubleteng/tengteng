/* Straight planar wireframe interchange. Parsers run only on demand in a worker. */

 'use strict';
 const MAX_RAW=100000;
 const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const mul=(a,b)=>Array.from({length:16},(_,i)=>{const r=Math.floor(i/4),c=i%4;let v=0;for(let k=0;k<4;k++)v+=a[r*4+k]*b[k*4+c];return v;});
 const xyz=p=>Array.isArray(p)?p.slice(0,3):[p.x,p.y,p.z??0];
 const transform=(m,p)=>{p=xyz(p);return [0,1,2].map(i=>m[i*4]*p[0]+m[i*4+1]*p[1]+m[i*4+2]*p[2]+m[i*4+3]);};
 const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>{const n=norm(a);if(n<1e-15)throw Error('Invalid plane direction.');return a.map(v=>v/n);};
 const mmUnits={Millimeters:1,Centimeters:10,Meters:1000,Inches:25.4,Feet:304.8,Yards:914.4,Microns:.001,Kilometers:1e6,Decimeters:100,Mils:.0254,Microinches:.0000254,Angstroms:1e-7,Nanometers:1e-6,Miles:1609344,PrinterPoints:25.4/72,PrinterPicas:25.4/6};
 function collector(format){
  const data={format,segments:[],layers:[],unitName:'Unitless',unitScale:null,ignored:{},warnings:[]};
  data.add=(a,b,layer,visible=true)=>{if(data.segments.length>=MAX_RAW)throw Error('Too many CAD segments. Select a smaller 2D plan or simplify dense curves.');if(![...a,...b].every(Number.isFinite))throw Error('CAD geometry contains invalid coordinates.');data.segments.push({a,b,layer:String(layer),visible});};
  data.skip=type=>data.ignored[type]=(data.ignored[type]||0)+1;
  data.finish=()=>{delete data.add;delete data.skip;delete data.finish;return data;};return data;
 }
 function read3dm(bytes,R){
  const doc=R.File3dm.fromByteArray(new Uint8Array(bytes));if(!doc)throw Error('This is not a readable Rhino 3DM file.');const data=collector('3dm');
  try{
   const u=doc.settings().modelUnitSystem,entry=Object.entries(R.UnitSystem).find(([k,v])=>v&&v.value===u.value);data.unitName=entry?.[0]||'Unknown';data.unitScale=mmUnits[data.unitName]??null;
   const layers=doc.layers(),objects=doc.objects(),defs=doc.instanceDefinitions(),byId=new Map(),byDef=new Map(),layerById=new Map();
   for(let i=0;i<layers.count;i++){const l=layers.get(i);const item={id:String(l.index),name:l.fullPath||l.name,visible:l.visible,parent:l.parentLayerId,uuid:l.id};data.layers.push(item);layerById.set(l.id,item);}
   for(const l of data.layers){let parent=layerById.get(l.parent),seen=new Set();while(parent&&!seen.has(parent.uuid)){seen.add(parent.uuid);l.visible=l.visible&&parent.visible;parent=layerById.get(parent.parent);}}
   const layerMap=new Map(data.layers.map(l=>[l.id,l]));
   for(let i=0;i<objects.count;i++){const o=objects.get(i);byId.set(o.attributes().id,o);}
   for(let i=0;i<defs.count;i++){const d=defs.get(i);byDef.set(d.id,d.getObjectIds());}
   function curve(g,m,layer,visible){
    if(g instanceof R.PolyCurve){for(let i=0;i<g.segmentCount;i++){const c=g.segmentCurve(i);try{curve(c,m,layer,visible);}finally{c.delete();}}return;}
    if(typeof g.isLinear==='function'&&g.isLinear(1e-8)){data.add(transform(m,g.pointAtStart),transform(m,g.pointAtEnd),layer,visible);return;}
    if(typeof g.tryGetPolyline==='function'){const poly=g.tryGetPolyline();if(poly){try{for(let i=1;i<poly.count;i++)data.add(transform(m,poly.get(i-1)),transform(m,poly.get(i)),layer,visible);}finally{poly.delete();}return;}}
    if(typeof g.pointAt==='function'&&g.domain){
     const dom=g.domain,lo=dom[0]??dom.t0,hi=dom[1]??dom.t1;
     if(Number.isFinite(lo)&&Number.isFinite(hi)){
      const tolerance=.003/(data.unitScale?data.unitScale/1000:1);
      function sample(a,b,pa,pb,depth){const mid=(a+b)/2,pm=xyz(g.pointAt(mid)),q=pa.map((v,i)=>(v+pb[i])/2);if(depth<9&&norm(sub(pm,q))>tolerance){sample(a,mid,pa,pm,depth+1);sample(mid,b,pm,pb,depth+1);}else data.add(transform(m,pa),transform(m,pb),layer,visible);}
      for(let i=0;i<16;i++){const a=lo+(hi-lo)*i/16,b=lo+(hi-lo)*(i+1)/16;sample(a,b,xyz(g.pointAt(a)),xyz(g.pointAt(b)),0);}return;
     }
    }
    data.skip(g.constructor?.name||'Unsupported geometry');
   }
   function visit(o,m,ancestors,visible=true){
    const a=o.attributes(),g=o.geometry(),layer=String(a.layerIndex);visible=visible&&a.visible;
    if(!layerMap.has(layer)){const item={id:layer,name:'Unassigned layer',visible:true};data.layers.push(item);layerMap.set(layer,item);}
    if(g instanceof R.InstanceReference){
     const id=g.parentIdefId;if(ancestors.includes(id)||ancestors.length>24)throw Error('Recursive or excessively nested Rhino block.');
     const ids=byDef.get(id);if(!ids){data.skip('Missing block definition');return;}
     const t=g.xform,x=Array.from({length:16},(_,i)=>t['m'+Math.floor(i/4)+(i%4)]),next=mul(m,x);t.delete();
     for(const child of ids){const found=byId.get(child);if(found)visit(found,next,[...ancestors,id],visible&&(layerMap.get(layer)?.visible??true));else data.skip('Missing block object');}
    }else curve(g,m,layer,visible);
   }
   for(const o of byId.values())if(!o.attributes().isInstanceDefinitionObject)visit(o,identity(),[]);
   return data.finish();
  }finally{doc.delete();}
 }
 // LibreDWG represents the omitted +Z extrusion direction as a zero vector.
 function ocs(direction){const raw=xyz(direction||{x:0,y:0,z:1}),n=norm(raw)<1e-15?[0,0,1]:unit(raw),x=unit(cross(Math.abs(n[0])<1/64&&Math.abs(n[1])<1/64?[0,1,0]:[0,0,1],n)),y=cross(n,x);return [x[0],y[0],n[0],0,x[1],y[1],n[1],0,x[2],y[2],n[2],0,0,0,0,1];}
 function fromDwg(db){
  const data=collector('dwg'),units={1:['Inches',25.4],2:['Feet',304.8],3:['Miles',1609344],4:['Millimeters',1],5:['Centimeters',10],6:['Meters',1000],7:['Kilometers',1e6],8:['Microinches',.0000254],9:['Mils',.0254],10:['Yards',914.4],11:['Angstroms',1e-7],12:['Nanometers',1e-6],13:['Microns',.001],14:['Decimeters',100]};
  const u=units[db.header?.INSUNITS];if(u)[data.unitName,data.unitScale]=u;
  data.layers=(db.tables?.LAYER?.entries||[]).map(l=>({id:l.name,name:l.name,visible:!l.off&&!l.frozen}));
  const blocks=new Map((db.tables?.BLOCK_RECORD?.entries||[]).map(b=>[b.name,b])),layerMap=new Map(data.layers.map(l=>[l.id,l]));
  function visit(e,m,ancestors,inheritedLayer=null,visible=true){
   if(e.isInPaperSpace){data.skip('Paper-space object');return;}
   const layer=e.layer==='0'&&inheritedLayer?inheritedLayer:(e.layer||'0');visible=visible&&e.isVisible!==false;
   if(!layerMap.has(layer)){const item={id:layer,name:layer,visible:true};data.layers.push(item);layerMap.set(layer,item);}
   if(e.type==='INSERT'){
    const b=blocks.get(e.name);if(!b||b.flags&12){data.skip('Unresolved/external block');return;}
    if(ancestors.includes(e.name)||ancestors.length>24)throw Error('Recursive or excessively nested DWG block.');
    const rows=Math.max(1,e.rowCount||1),cols=Math.max(1,e.columnCount||1);if(rows*cols>10000)throw Error('Too many block-array instances.');
    const rotation=e.rotation||0,c=Math.cos(rotation),s=Math.sin(rotation),sx=e.xScale??1,sy=e.yScale??1,sz=e.zScale??1,base=xyz(b.basePoint||[0,0,0]),insert=xyz(e.insertionPoint),axis=ocs(e.extrusionDirection);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
     const dx=col*(e.columnSpacing||0),dy=row*(e.rowSpacing||0),a=[c*sx,-s*sy,0,insert[0]+c*dx-s*dy-c*sx*base[0]+s*sy*base[1],s*sx,c*sy,0,insert[1]+s*dx+c*dy-s*sx*base[0]-c*sy*base[1],0,0,sz,insert[2]-sz*base[2],0,0,0,1],next=mul(m,mul(axis,a));
     for(const child of b.entities||[])visit(child,next,[...ancestors,e.name],layer,visible&&(layerMap.get(layer)?.visible??true));
    }return;
   }
   if(e.type==='LINE'){data.add(transform(m,e.startPoint),transform(m,e.endPoint),layer,visible);return;}
   const local=mul(m,ocs(e.extrusionDirection));
   const emit=(points,matrix=local)=>{for(let i=1;i<points.length;i++)data.add(transform(matrix,points[i-1]),transform(matrix,points[i]),layer,visible);};
   const arc=(center,r,start,sweep,matrix=local)=>{const count=Math.min(4096,Math.max(12,Math.ceil(Math.abs(sweep)*Math.sqrt(Math.max(1,r*(data.unitScale||1000)/1000)/.006))));emit(Array.from({length:count+1},(_,i)=>[center[0]+r*Math.cos(start+sweep*i/count),center[1]+r*Math.sin(start+sweep*i/count),center[2]||0]),matrix);};
   if(e.type==='ARC'||e.type==='CIRCLE'){let start=e.type==='CIRCLE'?0:e.startAngle,sweep=e.type==='CIRCLE'?Math.PI*2:e.endAngle-start;while(sweep<=0)sweep+=Math.PI*2;arc(xyz(e.center),e.radius,start,sweep);return;}
   if(e.type==='ELLIPSE'){const c=xyz(e.center),a=xyz(e.majorAxis),ratio=e.axisRatio??1,start=e.startParameter??0,end=e.endParameter??Math.PI*2;let sweep=end-start;while(sweep<=0)sweep+=Math.PI*2;const normal=xyz(e.extrusionDirection||[0,0,1]),b=cross(norm(normal)<1e-12?[0,0,1]:unit(normal),a).map(v=>v*ratio);emit(Array.from({length:129},(_,i)=>{const t=start+sweep*i/128;return c.map((v,j)=>v+a[j]*Math.cos(t)+b[j]*Math.sin(t));}),m);return;}
   if(['LWPOLYLINE','POLYLINE2D','POLYLINE3D'].includes(e.type)){
    if((e.type!=='LWPOLYLINE'&&(e.flag&6||e.flag&80))||e.smoothType){data.skip('Fitted/mesh polyline');return;}
    const vs=e.vertices||[],three=e.type==='POLYLINE3D',matrix=three?m:local,closed=!!(e.flag&(e.type==='LWPOLYLINE'?512:1));
    for(let i=0;i<vs.length-(closed?0:1);i++){const a=vs[i],b=vs[(i+1)%vs.length],pa=[a.x,a.y,e.elevation??a.z??0],pb=[b.x,b.y,e.elevation??b.z??0],bulge=a.bulge||0;if(!three&&Math.abs(bulge)>1e-10){const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy),sweep=4*Math.atan(bulge),radius=chord*(1+bulge*bulge)/(4*Math.abs(bulge)),off=chord*(1-bulge*bulge)/(4*bulge),c=[(a.x+b.x)/2-dy/chord*off,(a.y+b.y)/2+dx/chord*off,pa[2]];arc(c,radius,Math.atan2(a.y-c[1],a.x-c[0]),sweep,matrix);}else emit([pa,pb],matrix);}return;
   }
   if(e.type==='SPLINE'){
    const pts=e.controlPoints||[],knots=e.knots||[],degree=e.degree;
    if(pts.length>degree&&knots.length>=pts.length+degree+1){const lo=knots[degree],hi=knots[pts.length],weights=e.weights||[];function evalAt(u){let k=degree;while(k<pts.length-1&&knots[k+1]<=u)k++;const q=Array.from({length:degree+1},(_,j)=>{const ix=k-degree+j,p=xyz(pts[ix]),w=weights[ix]??1;return[p[0]*w,p[1]*w,p[2]*w,w];});for(let r=1;r<=degree;r++)for(let j=degree;j>=r;j--){const a=knots[k-degree+j],b=knots[k+1+j-r],alpha=b===a?0:(u-a)/(b-a);q[j]=q[j].map((v,l)=>(1-alpha)*q[j-1][l]+alpha*v);}return q[degree].slice(0,3).map(v=>v/q[degree][3]);}emit(Array.from({length:257},(_,i)=>evalAt(lo+(hi-lo)*i/256)),m);return;}
    data.skip('Fit-only spline (not approximated)');return;
   }
   data.skip(e.type||'Unknown entity');
  }
  for(const e of db.entities||[])visit(e,identity(),[]);
  return data.finish();
 }

export {read3dm,fromDwg};
