// WebGL lineWidth is limited to one pixel on many browsers. Extrude a short
// screen-space quad for each cut segment and keep normal scene depth testing.
import * as T from './lib/three.module.min.js';
export const cutWidth=3.5;
export function sectionStroke(webgl){
 if(!webgl){
  const out=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x292d2b,depthWrite:false}));
  out.userData.cutStroke=true;out.renderOrder=4;return out;
 }
 const material=new T.ShaderMaterial({
  uniforms:{viewport:{value:new T.Vector2(1,1)},nearPlane:{value:.05},strokeWidth:{value:cutWidth}},
  transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
  vertexShader:`
   #include <common>
   #include <logdepthbuf_pars_vertex>
   attribute vec3 startPoint,endPoint;
   uniform vec2 viewport;uniform float nearPlane,strokeWidth;
   void main(){
    vec3 a=(viewMatrix*vec4(startPoint,1.)).xyz,b=(viewMatrix*vec4(endPoint,1.)).xyz;
    if(max(-a.z,-b.z)<nearPlane){gl_Position=vec4(2.,2.,2.,1.);return;}
    if(-a.z<nearPlane)a=mix(a,b,(-nearPlane-a.z)/(b.z-a.z));
    if(-b.z<nearPlane)b=mix(b,a,(-nearPlane-b.z)/(a.z-b.z));
    vec4 p=projectionMatrix*vec4(a,1.),q=projectionMatrix*vec4(b,1.);
    vec2 d=(q.xy/q.w-p.xy/p.w)*viewport;d/=max(length(d),.0001);
    gl_Position=mix(p,q,position.x);
    gl_Position.xy+=(vec2(-d.y,d.x)*position.y+d*(position.x*2.-1.)*.45)*strokeWidth/viewport*gl_Position.w;
    gl_Position.z-=.000001*gl_Position.w;
    #include <logdepthbuf_vertex>
    #ifdef USE_LOGDEPTHBUF
     vFragDepth=max(1e-6,vFragDepth*.999985);
    #endif
   }`,
  fragmentShader:`
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=vec4(.15,.17,.16,1.);
   }`
 });
 const out=new T.Mesh(new T.BufferGeometry(),material);out.frustumCulled=false;out.renderOrder=4;
 out.onBeforeRender=(r,s,c)=>{const u=material.uniforms;r.getSize(u.viewport.value);u.nearPlane.value=c.near;};
 return out;
}
export function setStrokeSegments(object,points){
 object.geometry.dispose();
 if(object.isLine){
  object.geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(points,3));return;
 }
 const g=new T.InstancedBufferGeometry(),pairs=new T.InstancedInterleavedBuffer(points,6);
 g.setAttribute('position',new T.Float32BufferAttribute([0,-1,0,1,-1,0,1,1,0,0,1,0],3));
 g.setIndex([0,1,2,0,2,3]);g.setAttribute('startPoint',new T.InterleavedBufferAttribute(pairs,3,0));g.setAttribute('endPoint',new T.InterleavedBufferAttribute(pairs,3,3));
 g.instanceCount=points.length/6;object.geometry=g;
}
