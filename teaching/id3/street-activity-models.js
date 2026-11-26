// Meters. Soles and tires touch local Y=0, and every actor faces local +Z.
import * as T from './lib/three.module.min.js';

const turn=2*Math.PI, poses=12;
const fixed=0, coat=1, skin=2, hair=3, pants=4;
const channels=['coatTint','skinTint','hairTint','pantsTint'];
const coats=[0x407b79,0xb45b48,0xe3ae58,0x627792,0x985f72,0x8b9976,0x475967,0xcfb48a];
const skins=[0x81583f,0xaa7657,0xd2a17c,0xeac3a1,0x664737];
const hairs=[0x3b302a,0x615046,0x967957,0xa29e94];
const trousers=[0x384652,0x565047,0x59686a,0x484350];
const paints=[0xdad8ce,0x713d3b,0x445865,0x83969e,0xbba17a,0x53736b,0x55565a,0xa26b4a];
const white=0xffffff, glass=0x495d66, trim=0x30373a, tire=0x303333;

class Shape {
 constructor(){this.xyz=[];this.rgb=[];this.slots=[];this.tint=new T.Color();}
 tri(a,b,c,shade,slot=fixed){
  this.xyz.push(...a,...b,...c);this.tint.setHex(shade);
  for(let i=0;i<3;i++){this.rgb.push(this.tint.r,this.tint.g,this.tint.b);this.slots.push(slot);}
 }
 // Joining successive counterclockwise horizontal rings generates tapered forms.
 loft(rings,shade,slot=fixed){
  const last=rings.length-1,n=rings[0].length;
  for(let j=0;j<last;j++)for(let i=0;i<n;i++){
   const k=(i+1)%n,lo=rings[j],hi=rings[j+1];
   this.tri(lo[i],lo[k],hi[k],shade,slot);this.tri(lo[i],hi[k],hi[i],shade,slot);
  }
  for(let i=1;i<n-1;i++){
   this.tri(rings[0][0],rings[0][i+1],rings[0][i],shade,slot);
   this.tri(rings[last][0],rings[last][i],rings[last][i+1],shade,slot);
  }
 }
 oval(x,z,rows,shade,slot=fixed,n=8,transform=null){
  const rings=rows.map(([y,w,d,dz=0])=>Array.from({length:n},(_,i)=>{
   const a=turn*(i+.5)/n,p=[x+w*Math.sin(a),y,z+dz+d*Math.cos(a)];
   return transform?transform(p):p;
  }));
  this.loft(rings,shade,slot);
 }
 box(x,y,z,w,h,d,shade,slot=fixed){
  const ring=height=>[[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,b])=>[x+a*w/2,height,z+b*d/2]);
  this.loft([ring(y-h/2),ring(y+h/2)],shade,slot);
 }
 geometry(){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(this.xyz,3));
  g.setAttribute('color',new T.Float32BufferAttribute(this.rgb,3));
  g.setAttribute('paletteSlot',new T.Float32BufferAttribute(this.slots,1));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
 }
}

function pedestrian(longHair,phase){
 const s=new Shape(),sides=[-1,1];
 function swing(side){return phase+(side<0?Math.PI:0);}
 function leg(side){
  const t=swing(side),a=-.50*Math.sin(t),b=a+.08+.78*Math.max(0,-Math.cos(t));
  const ky=.89-.405*Math.cos(a),kz=-.405*Math.sin(a);
  return {a,b,ky,kz,ay:ky-.386*Math.cos(b),az:kz-.386*Math.sin(b)};
 }
 const legs=sides.map(leg),jog=.083-Math.min(legs[0].ay,legs[1].ay);
 const body=(x,z,rows,color,slot,n)=>s.oval(x,z,rows.map(([y,w,d,off])=>[y+jog,w,d,off]),color,slot,n);
 body(0,0,[[.82,.153,.111],[.93,.166,.119]],white,pants);
 body(0,0,[[.89,.169,.118],[1.08,.154,.106],[1.32,.202,.127],[1.385,.205,.112],[1.425,.09,.083]],white,coat);
 body(0,.014,[[1.414,.077,.067],[1.509,.069,.067]],white,skin);
 body(0,.013,[[1.464,.081,.086,.03],[1.505,.111,.103,.015],[1.615,.120,.127],[1.688,.106,.100]],white,skin);
 body(0,-.002,[[1.602,.123,.124,-.013],[1.689,.122,.119],[1.728,.079,.080]],white,hair);
 if(longHair)body(0,-.080,[[1.415,.087,.051],[1.47,.117,.062],[1.621,.119,.063]],white,hair);
 body(0,.120,[[1.538,.026,.017],[1.570,.019,.033],[1.594,.012,.009]],white,skin,5);
 sides.forEach((side,i)=>{
  const {a,b,ky,kz,ay,az}=legs[i],x=side*.088,t=swing(side);
  function bone(py,pz,angle){
   const co=Math.cos(angle),si=Math.sin(angle);
   return ([xx,yy,zz])=>[xx,py+jog+co*yy-si*zz,pz+si*yy+co*zz];
  }
  s.oval(x,0,[[-.418,.073,.075],[-.08,.094,.105],[.018,.081,.086]],white,pants,6,bone(.89,0,a));
  s.oval(x,0,[[-.388,.056,.059],[-.18,.071,.083],[.012,.071,.074]],white,pants,6,bone(ky,kz,b));
  s.oval(x,az,[[ay+jog-.083,.070,.130,.052],[ay+jog-.041,.073,.135,.054],[ay+jog+.017,.061,.081,.017]],0xcec6b1,fixed,8);
  const arm=.41*Math.sin(t),fore=arm-.24-.15*Math.max(0,Math.sin(t)),armX=side*.203;
  const ey=1.365-.262*Math.cos(arm),ez=-.262*Math.sin(arm);
  s.oval(armX,0,[[-.275,.054,.056],[-.100,.072,.077],[.016,.062,.063]],white,coat,6,bone(1.365,0,arm));
  s.oval(armX,0,[[-.215,.044,.043],[0,.054,.055]],white,coat,6,bone(ey,ez,fore));
  s.oval(armX,0,[[-.298,.028,.028],[-.258,.044,.041],[-.205,.039,.040]],white,skin,6,bone(ey,ez,fore));
 });
 return s.geometry();
}

function car(wagon){
 const s=new Shape();
 // y, half-width, front and back extents, chamfer width and length
 const ring=([y,w,f,b,c,d])=>[[-w+c,f],[w-c,f],[w,f-d],[w,b+d],[w-c,b],[-w+c,b],[-w,b+d],[-w,f-d]].map(([x,z])=>[x,y,z]);
 const tail=wagon?-2.04:-2.18,nose=wagon?2.04:2.18;
 const deck=wagon?.92:.86,top=wagon?1.55:1.40,rearGlass=wagon?-1.65:-1.41;
 s.loft([[.29,.755,nose-.055,tail+.05,.16,.17],[.39,.849,nose,tail,.135,.16]].map(ring),trim);
 s.loft([[.37,.849,nose-.002,tail+.002,.136,.16],[.64,.865,nose-.02,tail+.025,.12,.17],[deck,.812,nose-.18,tail+.10,.16,.19]].map(ring),white,coat);
 const base=[deck-.005,.795,.98,rearGlass,.125,.18],roof=[top-.077,.67,.36,wagon?-1.425:-.862,.095,.13];
 s.loft([base,roof].map(ring),glass);
 s.loft([roof,[top,.648,.31,roof[3]+.038,.115,.14]].map(ring),white,coat);
 for(const side of [-1,1]){
  // Body-coloured front/rear posts and slim dark B-pillars interrupt the glass band.
  for(const ratio of [0,.49,1]){
   const lo=base[2]-(base[2]-base[3])*ratio;
   const hi=roof[2]-(roof[2]-roof[3])*ratio;
   const spread=ratio===.49?.035:.065;
   const a=[side*(base[1]+.004),base[0],lo-.13*(1-2*ratio)-spread],b=[a[0],a[1],a[2]+2*spread];
   const c=[side*(roof[1]+.004),roof[0],hi-.088*(1-2*ratio)+spread],d=[c[0],c[1],c[2]-2*spread];
   const shade=ratio===.49?trim:white,slot=ratio===.49?fixed:coat;
   if(side<0){s.tri(a,b,c,shade,slot);s.tri(a,c,d,shade,slot);}
   else {s.tri(c,b,a,shade,slot);s.tri(d,c,a,shade,slot);}
  }
  s.box(side*.85,deck+.067,.635,.15,.108,.19,white,coat);
  s.box(side*.59,.643,nose-.023,.31,.102,.058,0xf4e5c7);
  s.box(side*.585,.673,tail+.020,.325,.130,.077,0x9c3e3c);
  for(const z of [wagon?1.26:1.31,wagon?-1.30:-1.36]){
   // Cylindrical wheel axes are parallel to local X.
   for(const [inner,outer,radius,shade] of [[.711,.889,.307,tire],[.891,.895,.155,0xa4a6a2]]){
    const wheel=[inner,outer].map(v=>Array.from({length:10},(_,i)=>{
     const a=turn*i/10;
     return [side*v,.307+radius*Math.cos(a),z+side*radius*Math.sin(a)];
    }));
    s.loft(wheel,shade);
   }
  }
 }
 s.box(0,.51,nose+.001,.77,.119,.04,trim);
 s.box(0,.55,tail-.004,.34,.105,.02,0xc4c0ac);
 return s.geometry();
}

function randomPick(list,random){return list[Math.min(list.length-1,Math.floor(random()*list.length))];}
function shapeTemplate(walk,variant){
 const frames=walk?Array.from({length:poses},(_,i)=>pedestrian(variant,turn*i/poses)):[car(variant)];
 return {frames,walk,slots:[]};
}
function makeTintedGeometry(base,palette,colorCache){
 const g=new T.BufferGeometry();
 const slots=base.getAttribute('paletteSlot').array;
 let color=colorCache.get(palette);
 if(!color){
  const values=base.getAttribute('color').array.slice();
  for(let i=0;i<slots.length;i++)if(slots[i]){
   const c=palette[slots[i]-1],j=i*3;values[j]*=c.r;values[j+1]*=c.g;values[j+2]*=c.b;
  }
  color=new T.BufferAttribute(values,3);colorCache.set(palette,color);
 }
 g.setAttribute('position',base.getAttribute('position'));g.setAttribute('normal',base.getAttribute('normal'));g.setAttribute('color',color);
 g.boundingSphere=base.boundingSphere;g.userData.figureLighting=true;return g;
}

export function createActivityModels(personCount,vehicleCount,random=Math.random,software=false){
 const group=new T.Group();group.name='Street activity';group.userData.streetActivity=true;
 const instances=[],people=[],cars=[],personSizes=[],vehicleSizes=[],generated=[];
 const materials=[],colorCache=new Map(),toColor=hex=>new T.Color(hex);
 // Software rasterization can use the same geometry as a cached, one-draw posed figure.
 const poseMaterial=new T.MeshLambertMaterial({vertexColors:true});materials.push(poseMaterial);
 function createSet(walk,count,list,sizes){
  if(count===0)return;
  const templates=[shapeTemplate(walk,false),shapeTemplate(walk,true)];
  for(let i=0;i<count;i++){
   const variant=random()<.5?0:1;
   const palette=(walk?[randomPick(coats,random),randomPick(skins,random),randomPick(hairs,random),randomPick(trousers,random)]:
    [randomPick(paints,random),white,white,white]).map(toColor);
   const height=walk?.92+.17*random():.98+.045*random();
   const width=walk?.91+.18*random():.97+.06*random(),length=walk?height:.95+.1*random();
   const spec={palette,template:templates[variant],height,width,length,index:i,cpu:null};
   sizes.push(walk?{width:.55*width,height:1.74*height,length:.38*length}:
    {width:1.86*width,height:(variant?1.55:1.4)*height,length:(variant?4.12:4.4)*length});
   list.push(spec);spec.template.slots.push(spec);
  }
  for(const template of templates){
   generated.push(...template.frames);
   if(!template.slots.length)continue;
   if(software){
    for(const spec of template.slots){
     spec.cpu=new T.Mesh(undefined,poseMaterial);
     spec.cpu.visible=false;spec.cpu.receiveShadow=true;
     spec.cpu.userData.streetActivity=true;spec.cpu.userData.districtVertexColors=true;
     spec.cpu.userData.streetPoseIds=[];
     group.add(spec.cpu);generated.push(spec.cpu.geometry);
     spec.poses=Array(template.frames.length);
    }
    continue;
   }
   const geometry=template.frames[0],n=template.slots.length;
   if(walk){
    geometry.morphAttributes.position=template.frames.map(g=>g.attributes.position);
    geometry.morphAttributes.normal=template.frames.map(g=>g.attributes.normal);
   }
   for(const channel of channels)geometry.setAttribute(channel,new T.InstancedBufferAttribute(new Float32Array(3*n),3));
   const mat=new T.MeshLambertMaterial({vertexColors:true});
   mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <color_pars_vertex>',
     '#include <color_pars_vertex>\nattribute float paletteSlot;\n'+channels.map(c=>'attribute vec3 '+c+';').join('\n'));
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',
     '#include <color_vertex>\nif(paletteSlot>.5){vColor.xyz *= paletteSlot<1.5 ? coatTint : (paletteSlot<2.5 ? skinTint : (paletteSlot<3.5 ? hairTint : pantsTint));}');
   };
   materials.push(mat);
   const mesh=new T.InstancedMesh(geometry,mat,n);mesh.userData.streetActivity=true;mesh.frustumCulled=false;mesh.receiveShadow=true;
   mesh.name=walk?'Walking pedestrians':'Moving vehicles';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   group.add(mesh);
   const weights=walk?{morphTargetInfluences:new Float32Array(poses)}:null;
   if(walk){mesh.setMorphAt(0,weights);mesh.morphTexture.needsUpdate=true;}
   mesh.count=0;
   instances.push({mesh,template,weights,previous:new Int32Array(n).fill(-1)});
  }
 }
 createSet(true,personCount,people,personSizes);createSet(false,vehicleCount,cars,vehicleSizes);
 const object=new T.Object3D();
 function position(obj,pose,spec){
  obj.position.set(pose.x,pose.y,pose.z);obj.rotation.set(0,pose.heading,0);obj.scale.set(spec.width,spec.height,spec.length);
 }
 function update(peopleState,carState){
  if(software){
   for(const [list,states] of [[people,peopleState],[cars,carState]])for(const spec of list){
    const pose=states[spec.index],mesh=spec.cpu;
    mesh.visible=!!pose&&pose.visible!==false;if(!mesh.visible)continue;
    const {frames,walk}=spec.template;
    const k=walk?T.MathUtils.euclideanModulo(Math.round((pose.phase||0)*poses/turn),poses):0;
    if(!spec.poses[k]){
     spec.poses[k]=makeTintedGeometry(frames[k],spec.palette,colorCache);
     generated.push(spec.poses[k]);mesh.userData.streetPoseIds.push(spec.poses[k].uuid);
    }
    mesh.geometry=spec.poses[k];position(mesh,pose,spec);
   }
   return;
  }
  for(const {mesh,template,weights,previous} of instances){
   const states=template.walk?peopleState:carState;let active=0,paletteChanged=false;
   for(const spec of template.slots){
    const pose=states[spec.index];if(!pose||pose.visible===false)continue;
    position(object,pose,spec);object.updateMatrix();mesh.setMatrixAt(active,object.matrix);
    if(previous[active]!==spec.index){
     for(let k=0;k<channels.length;k++){
      const c=spec.palette[k];mesh.geometry.attributes[channels[k]].setXYZ(active,c.r,c.g,c.b);
     }
     paletteChanged=true;previous[active]=spec.index;
    }
    if(weights){
     const phase=T.MathUtils.euclideanModulo((pose.phase||0)*poses/turn,poses),k=Math.floor(phase);
     const w=weights.morphTargetInfluences;w.fill(0);w[k]=1-(phase-k);w[(k+1)%poses]=phase-k;
     mesh.setMorphAt(active,weights);
    }
    active++;
   }
   mesh.visible=active>0;mesh.count=active;
   mesh.instanceMatrix.needsUpdate=true;
   if(paletteChanged)for(const channel of channels)mesh.geometry.attributes[channel].needsUpdate=true;
   if(weights)mesh.morphTexture.needsUpdate=true;
  }
 }
 return {group,personSizes,vehicleSizes,update,dispose(){
  group.removeFromParent();
  for(const {mesh} of instances)mesh.dispose();
  for(const geometry of generated)geometry.dispose();
  for(const material of materials)material.dispose();
  group.clear();colorCache.clear();
 }};
}
