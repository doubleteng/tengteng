// Browser fallback for devices without WebGL 2. All distances are in metres.
// Vertices contain world x/y/z and diffuse intensity. Projected depth is 1/w.
let width:i32=0,height:i32=0,colors:usize=0,depths:usize=0,matrix:usize=0;
let axes:i32=0,level:f32=0,section:f32=0,near:f32=0;
const scratch:usize=memory.data(512);
const edge:usize=memory.data(128);
@inline function vf(p:usize,k:i32):f32{return load<f32>(p+(k<<2));}
@inline function sf(p:usize,k:i32,v:f32):void{store<f32>(p+(k<<2),v);}
@inline function cw(p:usize):f32{return vf(matrix,3)*vf(p,0)+vf(matrix,7)*vf(p,1)+vf(matrix,11)*vf(p,2)+vf(matrix,15);}
@inline function project(p:usize,d:usize):void{
 let x=vf(p,0),y=vf(p,1),z=vf(p,2),w=cw(p),r:f32=1/max(w,<f32>.000001);
 sf(d,0,((vf(matrix,0)*x+vf(matrix,4)*y+vf(matrix,8)*z+vf(matrix,12))*r+1)*<f32>width*.5);
 sf(d,1,(1-(vf(matrix,1)*x+vf(matrix,5)*y+vf(matrix,9)*z+vf(matrix,13))*r)*<f32>height*.5);
 sf(d,2,r);sf(d,3,vf(p,3));
}
@inline function planeDist(p:usize,axis:i32):f32{
 if(axis==1)return level-vf(p,1);
 if(axis==2)return section-vf(p,0);
 return cw(p)-near;
}
@inline function blend(p:usize,c:u32,a:i32):void{
 let b=load<u32>(p),ba=256-a;
 let rb=(((c&0x00ff00ff)*a+(b&0x00ff00ff)*ba)>>8)&0x00ff00ff;
 let g=(((c&0x0000ff00)*a+(b&0x0000ff00)*ba)>>8)&0x0000ff00;
 store<u32>(p,0xff000000|rb|g);
}
function triangle(a:usize,b:usize,c:usize,palette:usize,opacity:i32):void{
 let ax=vf(a,0),ay=vf(a,1),bx=vf(b,0),by=vf(b,1),cx=vf(c,0),cy=vf(c,1);
 let x0=max(0,<i32>Mathf.ceil(min(min(ax,bx),cx)-.5)),x1=min(width-1,<i32>Mathf.floor(max(max(ax,bx),cx)-.5));
 let y0=max(0,<i32>Mathf.ceil(min(min(ay,by),cy)-.5)),y1=min(height-1,<i32>Mathf.floor(max(max(ay,by),cy)-.5));if(x0>x1||y0>y1)return;
 let dx1=bx-ax,dy1=by-ay,dx2=cx-ax,dy2=cy-ay,det=dx1*dy2-dy1*dx2;if(abs(det)<.00001)return;
 let s:f32=1/det,ux=dy2*s,uy=-dx2*s,vx=-dy1*s,vy=dx1*s;
 let ur=(<f32>x0+.5-ax)*ux+(<f32>y0+.5-ay)*uy,vr=(<f32>x0+.5-ax)*vx+(<f32>y0+.5-ay)*vy;
 let az=vf(a,2),dz1=vf(b,2)-az,dz2=vf(c,2)-az,al=vf(a,3),dl1=vf(b,3)-al,dl2=vf(c,3)-al;
 for(let y=y0;y<=y1;y++){let u=ur,v=vr;let index=(y*width+x0)<<2;
   for(let x=x0;x<=x1;x++,index+=4,u+=ux,v+=vx){
    if(u<-.00001||v<-.00001||u+v>1.00001)continue;
    let z=az+dz1*u+dz2*v;if(z<=load<f32>(depths+index))continue;
    let light=min(255,max(0,<i32>(al+dl1*u+dl2*v)));let color=load<u32>(palette+(light<<2));
    if(opacity>=256){store<u32>(colors+index,color);store<f32>(depths+index,z);}else blend(colors+index,color,opacity);
   }ur+=uy;vr+=vy;
 }
}
function line(a:usize,b:usize,color:u32,bias:f32):void{
 let x=vf(a,0),y=vf(a,1),z=vf(a,2),ex=vf(b,0),ey=vf(b,1);
 let n=<i32>ceil(min(<f32>4000,max(abs(ex-x),abs(ey-y)))); if(n<1)return;
 let dx=(ex-x)/<f32>n,dy=(ey-y)/<f32>n,dz=(vf(b,2)-z)/<f32>n;
 for(let j=0;j<=n;j++,x+=dx,y+=dy,z+=dz){let px=<i32>floor(x),py=<i32>floor(y);if(px<0||px>=width||py<0||py>=height)continue;
   let idx=(py*width+px)<<2;if(z+bias>=load<f32>(depths+idx)){store<u32>(colors+idx,color);store<f32>(depths+idx,z);}
 }
}
export function begin(w:i32,h:i32,color:usize,depth:usize,m:usize,clip:i32,cutY:f32,cutX:f32,nearDist:f32):void{
 width=w;height=h;colors=color;depths=depth;matrix=m;axes=clip;level=cutY;section=cutX;near=nearDist;
 memory.fill(depths,0,w*h*4);for(let i=0;i<w*h;i++)store<u32>(colors+(i<<2),0xffe3e9e8);
}
export function draw(verts:usize,n:i32,indices:usize,count:i32,proj:usize,palette:usize,opacity:i32,lines:i32):void{
 for(let j=0;j<n;j++){
  let p=verts+(j<<4),d=proj+j*20;project(p,d);
  let code=(cw(p)<near?4:0)|((axes&1)&&vf(p,1)>level?1:0)|((axes&2)&&vf(p,0)>section?2:0);store<i32>(d+16,code);
 }
 let step=lines?2:3;
 for(let k=0;k<count;k+=step){
  let ia=load<u32>(indices+(k<<2)),ib=load<u32>(indices+((k+1)<<2));
  let pa=proj+ia*20,pb=proj+ib*20;let ca=load<i32>(pa+16),cb=load<i32>(pb+16);
  if(lines){if(!(ca|cb))line(pa,pb,0xff594c3e,.00004);continue;}
  let ic=load<u32>(indices+((k+2)<<2)),pc=proj+ic*20,cc=load<i32>(pc+16);
  if(ca&cb&cc)continue;let code=ca|cb|cc;
  if(!code){triangle(pa,pb,pc,palette,opacity);continue;}
  let src=scratch,dst=scratch+128;let size=3;
  memory.copy(src,verts+(ia<<4),16);memory.copy(src+16,verts+(ib<<4),16);memory.copy(src+32,verts+(ic<<4),16);
  for(let axis=1;axis<=4;axis*=2){
   if(!(code&axis))continue;let out=0;
   for(let a=0;a<size;a++){
    let u=src+(a<<4),v=src+(((a+1)%size)<<4);let du=planeDist(u,axis),dv=planeDist(v,axis);
    if(du>=0){memory.copy(dst+(out<<4),u,16);out++;}
    if((du<0)!=(dv<0)){let t=du/(du-dv);for(let f=0;f<4;f++)sf(dst+(out<<4),f,vf(u,f)+(vf(v,f)-vf(u,f))*t);out++;}
   }
   let swap=src;src=dst;dst=swap;size=out;if(size<3)break;
  }
  if(size<3)continue;
  for(let a=0;a<size;a++)project(src+(a<<4),scratch+256+(a<<4));
  for(let a=1;a<size-1;a++)triangle(scratch+256,scratch+256+(a<<4),scratch+256+((a+1)<<4),palette,opacity);
  if(opacity>=256&&(code&3))for(let a=0;a<size;a++){
   let b=(a+1)%size,va=src+(a<<4),vb=src+(b<<4);
   if(((code&1)&&abs(vf(va,1)-level)<.00002&&abs(vf(vb,1)-level)<.00002)||((code&2)&&abs(vf(va,0)-section)<.00002&&abs(vf(vb,0)-section)<.00002))
    line(scratch+256+(a<<4),scratch+256+(b<<4),0xff597da5,.000001);
  }
 }
}
