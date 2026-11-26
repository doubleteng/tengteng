// Distances are metres. The figure faces local -Z, with its soles at the origin.
import * as T from './lib/three.module.min.js';
import {visitorLook} from './visitor-look.js?v=850b7c0e56';
import {readAnatomy} from './street-anatomy.js?v=f2f8b5f49c';

const C = {
  skin: 0xb77c60, lips: 0x965956, hair: 0x362b2a, hairLight: 0x4a3933,
  jacket: 0x637f71, aqua: 0x779081, deep: 0x465f55, knit: 0xe9ddc5,
  trousers: 0x3f4958, seam: 0x525f6a, canvas: 0xb26a42, flap: 0xc18355,
  binding: 0x805039, webbing: 0x394b4d, cream: 0xf9dfae, paper: 0xffebcb,
  sole: 0xc3b499, shoe: 0xf2e4c5, rubber: 0x57666a, eye: 0x332a2a,
};
const TAU = 2 * Math.PI;
const THIGH = .426, SHIN = .391, ARM = .282, FOREARM = .248;
const ANKLE = .092, PELVIS = THIGH + SHIN + ANKLE;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const mix = (a, b, t) => a + (b - a) * t;
function smooth(a, b, n) {
  const t = clamp((n - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Batch the cloth, stitching and skin by moving part. Colour changes share
// the same surface normals, and the small deformation maps only affect limbs.
class Part {
  constructor(palette) {
    this.palette=palette;
    this.positions = [];
    this.colors = [];
    this.normals = [];
    this.indices = [];
  }

  surface(points, faces) {
    const sums = points.map(() => [0, 0, 0]);
    for (const [a, b, c] of faces) {
      const p = points[a], q = points[b], r = points[c];
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
      const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [a, b, c]) {
        sums[i][0] += nx; sums[i][1] += ny; sums[i][2] += nz;
      }
    }
    const vertices = new Map(), tint = new T.Color();
    for (const [a, b, c, color] of faces) {
      tint.setHex(color);
      for (const i of [a, b, c]) {
        const key = i + ':' + color;
        if (!vertices.has(key)) {
          vertices.set(key, this.positions.length / 3);
          this.positions.push(...points[i]);
          const n = sums[i], length = Math.hypot(...n) || 1;
          this.normals.push(n[0] / length, n[1] / length, n[2] / length);
          this.colors.push(tint.r, tint.g, tint.b);
        }
        this.indices.push(vertices.get(key));
      }
    }
  }

  // Rows are [height, half width, half depth, Z offset, X offset].
  shell(origin, rows, finish, sides = 10, exponent = 1, hem = null, opening = null) {
    const points = [], faces = [], stride=opening?sides+1:sides;
    const color = (row, side) => typeof finish === 'function' ? finish(row, side) : finish;
    for (let row = 0; row < rows.length; row++) {
      const [y, w, d, z = 0, x = 0] = rows[row];
      for (let k = 0; k < stride; k++) {
        const gap=opening?opening[row]:0;
        const angle = opening?Math.PI+gap+k*(TAU-2*gap)/sides:k*TAU/sides, s = Math.sin(angle), c = Math.cos(angle);
        points.push([
          origin[0] + x + w * Math.sign(s) * Math.abs(s) ** exponent,
          origin[1] + y + (hem ? hem(row, angle) : 0),
          origin[2] + z + d * Math.sign(c) * Math.abs(c) ** exponent,
        ]);
      }
    }
    for (let row = 0; row < rows.length - 1; row++) {
      for (let k = 0; k < sides; k++) {
        const a = row * stride + k, b = row * stride + (k + 1) % stride;
        const tint = color(row, k);
        faces.push([a, b, b + stride, tint], [a, b + stride, a + stride, tint]);
      }
    }
    if(!opening)for (const row of [0, rows.length - 1]) {
      const start = points.length, top = row !== 0;
      points.push(...points.slice(row * sides, (row + 1) * sides));
      for (let k = 1; k < sides - 1; k++) {
        const b = start + k, c = b + 1;
        faces.push([start, top ? b : c, top ? c : b, color(top ? row - 1 : 0, k)]);
      }
    }
    this.surface(points, faces);
  }

  oval(center, w, h, d, color, sides = 8) {
    this.shell(center, [
      [-h, .15*w, .15*d], [-.68*h, .74*w, .74*d], [0, w, d],
      [.68*h, .74*w, .74*d], [h, .15*w, .15*d],
    ], color, sides);
  }

  // A ribbon follows the Y/Z surface from back to front, with its width along X.
  ribbon(path, width, thickness, color) {
    const points = [], faces = [];
    for (let k = 0; k < path.length; k++) {
      const [x, y, z] = path[k];
      const prev = path[Math.max(0, k - 1)], next = path[Math.min(path.length - 1, k + 1)];
      const dy = next[1] - prev[1], dz = next[2] - prev[2], len = Math.hypot(dy, dz) || 1;
      const oy = -dz / len * thickness / 2, oz = dy / len * thickness / 2;
      points.push([x-width/2,y+oy,z+oz],[x+width/2,y+oy,z+oz],
        [x+width/2,y-oy,z-oz],[x-width/2,y-oy,z-oz]);
    }
    for (let k = 0; k < path.length - 1; k++) {
      for (let j = 0; j < 4; j++) {
        const a = k*4 + j, b = k*4 + (j+1)%4;
        faces.push([a,b,b+4,color],[a,b+4,a+4,color]);
      }
    }
    const e = points.length - 4;
    faces.push([0,2,1,color],[0,3,2,color],[e,e+1,e+2,color],[e,e+2,e+3,color]);
    this.surface(points, faces);
  }

  // A sculpted area keeps its shared vertices, normals and subtle skin tones.
  anatomy(name,side,shade) {
    const {positions,indices}=readAnatomy(name), geom=new T.BufferGeometry();
    const coords=Float32Array.from(positions, (number,i)=>number*.0001*(i%3===0?side:1));
    const faces=indices.slice();
    if(side<0)for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
    geom.setAttribute('position',new T.BufferAttribute(coords,3));geom.setIndex(new T.BufferAttribute(faces,1));
    geom.computeVertexNormals();
    const start=this.positions.length/3,col=new T.Color();
    for(let i=0;i<coords.length;i+=3){
      col.setHex(shade(coords[i],coords[i+1],coords[i+2]));
      this.colors.push(col.r,col.g,col.b);
    }
    this.positions.push(...coords);this.normals.push(...geom.attributes.normal.array);
    for(const index of faces)this.indices.push(start+index);
    geom.dispose();
  }

  cord(path,radius,color,sides=5){
    const points=[],faces=[],v=new T.Vector3(),u=new T.Vector3(),w=new T.Vector3();
    for(let i=0;i<path.length;i++){
      const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],p=path[i];
      v.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
      u.set(1,0,0);if(Math.abs(v.x)>.90)u.set(0,0,1);
      u.addScaledVector(v,-u.dot(v)).normalize();w.crossVectors(v,u);
      for(let k=0;k<sides;k++){
        const r=radius*(p[3]??1),c=r*Math.cos(k*TAU/sides),d=r*Math.sin(k*TAU/sides);
        points.push([p[0]+c*u.x+d*w.x,p[1]+c*u.y+d*w.y,p[2]+c*u.z+d*w.z]);
        if(i){const a=(i-1)*sides+k,b=(i-1)*sides+(k+1)%sides;faces.push([a,b,b+sides,color],[a,b+sides,a+sides,color]);}
      }
    }
    this.surface(points,faces);
  }

  attach(joint, material) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = joint.name + ' surface';
    mesh.userData.districtVertexColors = true;
    geometry.userData.figureLighting = true;
    mesh.castShadow = mesh.receiveShadow = true;
    joint.add(mesh);
    return geometry;
  }
}

function jacket(part) {
  const C=part.palette;
  // A cream jersey is visible between the two unfastened fronts.
  part.shell([0,0,-.002],[[-.060,.130,.087],[-.045,.141,.087],[.07,.139,.084],
    [.24,.141,.088,-.003],[.37,.155,.092,-.002],[.425,.160,.083],[.463,.071,.061]],C.knit,18);
  part.shell([0,0,0],[[.442,.071,.065],[.453,.066,.060],[.467,.061,.054]],0xd6cab2,16);
  part.shell([0,0,0],[[.448,.055,.053],[.49,.052,.052],[.531,.047,.047],[.552,.047,.043]],C.skin,16);
  const rows=[[-.077,.166,.108,.003],[-.066,.168,.110,.004],[.008,.164,.109,.004],
    [.08,.157,.109,.005],[.148,.154,.100,.006],[.244,.159,.110],[.33,.170,.116,-.004],
    [.39,.187,.113],[.427,.193,.102,.002],[.454,.164,.092,.008],[.478,.095,.071,.008]];
  const openings=[.26,.27,.26,.25,.24,.28,.37,.48,.55,.56,.63];
  part.shell([0,0,0],rows,(row)=>row===0?C.deep:C.jacket,24,.94,
    (row,a)=>(row<4?.009:.002)*Math.sin(3*a+.5)+(row<3?.005:0)*Math.cos(5*a-1),openings);
  for(const side of [-1,1]){
    const edge=rows.map(([y,w,d,z=0],i)=>[side*w*Math.sin(openings[i])**.94,y,z-d*Math.cos(openings[i])**.94-.001]);
    part.cord(edge,.0035,C.deep);
    const collar=[[side*.021,.398,-.108],[side*.044,.444,-.092],[side*.065,.481,-.058],
      [side*.090,.470,-.036],[side*.100,.433,-.080],[side*.074,.389,-.110]];
    const fold=[[0,1,5,C.aqua],[1,2,5,C.aqua],[2,3,4,C.aqua],[2,4,5,C.aqua]];
    part.surface(collar,fold);
    part.surface(collar,fold.map(([a,b,c,color])=>[c,b,a,color]));
    part.ribbon([[side*.098,.090,-.092],[side*.106,.058,-.090],[side*.111,.008,-.087]],.045,.005,C.jacket);
    part.cord([[side*.079,.086,-.098],[side*.096,.077,-.098],[side*.12,.066,-.088]],.0025,C.deep);
    part.ribbon([[side*.113,.124,.087],[side*.135,.34,.095],[side*.119,.442,.070],
      [side*.111,.467,.010],[side*.12,.448,-.065],[side*.138,.392,-.085],
      [side*.136,.30,-.081],[side*.137,.17,-.062],[side*.142,.094,-.053]],
      .027,.009,C.webbing);
  }
  for(const i of [2,4,5,6]){
    const [y,w,d,z=0]=rows[i],a=openings[i]+.044;
    part.oval([w*Math.sin(a)**.94,y,z-d*Math.cos(a)**.94-.002],.0034,.0034,.0025,0xb79163,6);
  }
}

function backpack(part){
  const C=part.palette;
  part.shell([0,0,.123],[[.070,.055,.030],[.080,.107,.050],[.108,.119,.061],
    [.16,.128,.062,.005,-.004],[.24,.123,.075,.004,-.006],[.31,.129,.068,.001,-.004],
    [.355,.111,.060],[.385,.100,.039],[.395,.070,.030]],
    row=>row<2?C.binding:C.canvas,16,.76,(row,a)=>.005*Math.sin(a*3+row*.78));
  part.shell([-.005,0,.150],[[.226,.081,.044,.008],[.236,.107,.053],[.303,.123,.055],[.344,.120,.053],
    [.369,.095,.041],[.381,.074,.031]],row=>row===0?C.binding:C.flap,16,.78,(r,a)=>r<3?.009*Math.sin(a+.5):0);
  for(const s of [-1,1]){
    part.ribbon([[s*.067,.308,.193],[s*.070,.279,.202],[s*.069,.234,.203],
      [s*.070,.199,.196],[s*.070,.175,.193]],.014,.006,C.binding);
    part.ribbon([[s*.070,.207,.201],[s*.070,.215,.201]],.02,.006,0xd2ad72);
  }
  part.cord([[-.039,.377,.13],[-.031,.407,.128],[0,.417,.126],[.033,.405,.127],[.039,.378,.13]],.006,C.binding);
}

function face(part) {
  const C=part.palette;
  const base=new T.Color(C.skin),lip=new T.Color(C.lips),cheek=new T.Color(C.cheek??0xc1826a),tint=new T.Color();
  part.anatomy('head',1,(x,y,z)=>{
    const ax=Math.abs(x);
    const blush=Math.exp(-(((ax-.049)/.024)**2+((y-.089)/.020)**2))*smooth(.045,.075,-z);
    const mouth=Math.exp(-((x/.024)**4+((y-.054)/.008)**4))*smooth(.091,.100,-z);
    return tint.copy(base).lerp(cheek,.42*blush).lerp(lip,.72*mouth).getHex();
  });
  for(const side of [-1,1]){
    const x=side*.0322;
    part.oval([x,.120,-.0677],.0142,.0134,.0142,0xd4c9b1,14);
    part.oval([x,.1195,-.0803],.0061,.0063,.0024,0x513d31,12);
    part.oval([x,.1195,-.0823],.0028,.0034,.0012,0x261f1d,10);
    part.cord([[side*.014,.136,-.095,.42],[side*.026,.140,-.093],[side*.040,.141,-.086],
      [side*.053,.137,-.075,.25]],.0028,C.hair);
  }
  // A swept crown changes depth toward the nape, with a loose chignon and temple curls.
  const rows=[[.101,.091,.102,.012],[.145,.099,.111,.010],[.181,.097,.110,.010],
    [.209,.087,.100,.011],[.231,.070,.084,.013,-.002],[.247,.047,.057,.014,-.006],[.253,.016,.023,.017,-.006]];
  const wave=(r,a)=>r===0?-.061*Math.cos(a)-.012*Math.cos(2*a)+.009*Math.sin(3*a+.4):r===1?-.021*Math.cos(a):0;
  part.shell([0,0,0],rows,C.hair,32,.97,wave);
  for(let k=0;k<21;k++){
    const path=rows.map(([y,w,d,z,x=0],i)=>{
      const a=k*TAU/21 + .11*Math.sin(k*1.44)+.13*i;
      return [x+(w+.001)*Math.sin(a),y+wave(i,a),z+(d+.001)*Math.cos(a),i===0?.30:i===6?.20:1];
    });
    part.cord(path,.0019,k%4===0?C.hair:C.hairLight,5);
  }
  for(const side of [-1,1]){
    part.cord([[side*.085,.132,-.035],[side*.089,.111,-.030],[side*.085,.080,-.026],
      [side*.079,.064,-.024],[side*.081,.056,-.021,.15]],.004,C.hairLight);
  }
  if(C.style===1)return; // Cropped swept hair.
  if(C.style===2){
    part.shell([0,0,0],[[.035,.079,.040,.081],[.061,.093,.055,.076],[.112,.099,.062,.066],[.163,.095,.060,.047]],C.hair,20);
    return;
  }
  part.oval([-.006,.097,.11],.048,.035,.035,0x85634b,14);
  for(let k=0;k<9;k++){
    const a=k*TAU/9;
    part.oval([-.011+.041*Math.sin(a),.104+.039*Math.cos(a),.134+.008*Math.cos(2*a)],
      .035,.039,.035,k%3===0?C.hairLight:C.hair,14);
  }
  part.oval([-.008,.106,.149],.047,.040,.040,C.hair,16);
}

function arm(part,side){
  const C=part.palette;
  // One continuous sleeve bends over the elbow. The rolled cuff leaves a
  // short length of forearm visible between cloth and wrist.
  part.shell([0,0,0],[[-ARM-FOREARM,.029,.025],[-.49,.036,.032],[-.442,.044,.038],
    [-.398,.047,.043],[-.348,.048,.045],[-.31,.043,.042]],C.skin,14);
  const rows=[[-.410,.049,.048],[-.402,.055,.055],[-.389,.057,.055,.001],
    [-.381,.054,.051],[-.374,.058,.054],[-.367,.059,.056],[ -.350,.055,.052],
    [-.331,.052,.052],[-.309,.057,.054,.005],[-.289,.060,.055,.008],[-.273,.056,.055,.007],
    [-.252,.059,.057,.004],[-.208,.064,.061],[-.16,.067,.064],[-.106,.068,.068],
    [-.055,.073,.072],[-.012,.075,.070],[.023,.065,.061],[.047,.037,.038]];
  part.shell([0,0,0],rows,r=>r<=5?(r===3?C.deep:C.aqua):C.jacket,16,.99,
    (r,a)=>r<11?.004*Math.sin(a*2+r*.63)+.002*side*Math.cos(a):0);
}
function hand(part,s){part.anatomy('hand',s,()=>part.palette.skin);}

function leg(part,side) {
  const C=part.palette;
  const rows=[[-THIGH-SHIN+.015,.052,.051],[-.784,.058,.056,-.002],[-.766,.055,.052],
    [-.743,.058,.055,.002],[-.70,.056,.055,.004],[-.61,.063,.064,.009],
    [-.54,.073,.071,.012],[-.487,.072,.069,.006],[-.460,.069,.068],
    [-.438,.067,.069,-.004],[-.415,.070,.071,-.007],[-.392,.068,.069,-.005],
    [-.366,.071,.072,-.003],[-.30,.078,.078],[-.207,.085,.085],
    [-.108,.091,.093],[.004,.095,.091],[.054,.078,.076]];
  part.shell([0,0,0],rows,r=>r===0||r===1?C.seam:C.trousers,18,.97,
    (r,a)=>(r<4?.004:r>=8&&r<=12?.005:.0015)*Math.sin(2*a+r*.6));
  const seam=rows.map(([y,w,d,z=0],i)=>[side*(w+.0006),y,z+.008+(i<4?.004:0)]);
  part.cord(seam,.0017,C.seam,4);
  part.shell([0,0,0],[[-THIGH-SHIN-.017,.040,.04],[-.795,.048,.045]],C.knit,14);
}

function sneaker(part) {
  const C=part.palette;
  part.shell([0,0,0], [[-ANKLE,.060,.127,-.047],[-.077,.066,.132,-.047],
    [-.059,.066,.132,-.047],[-.048,.065,.128,-.047],[-.027,.060,.117,-.037],
    [-.008,.054,.091,-.022],[.013,.050,.059]], (row,k) => {
    if (row === 0) return C.rubber;
    if (row === 1) return C.sole;
    if (row === 2) return C.paper;
    if (k === 11 || k === 0) return C.canvas;
    return C.shoe;
  },12,.76);
  for (let i = 0; i < 2; i++) {
    const z = -.102 + i*.024, y = -.025 + i*.012;
    part.ribbon([[0,y,z],[0,y+.004,z+.010]],.060,.004,C.deep);
  }
}

function joint(name, parent, x, y, z) {
  const obj = new T.Group();
  obj.name = name; obj.position.set(x,y,z); parent.add(obj);
  return obj;
}

// Solve a sagittal-plane two-link chain. A positive X rotation carries a
// hanging limb forward. Knees fold backward and elbows fold forward.
function solve(first, second, forward, up, bendSign, proximal, distal) {
  const distance2 = forward*forward + up*up;
  const bend = bendSign * Math.acos(clamp((distance2-first*first-second*second)/(2*first*second),-1,1));
  proximal.rotation.x = Math.atan2(forward,-up) - Math.atan2(second*Math.sin(bend),first+second*Math.cos(bend));
  distal.rotation.x = bend;
}

// Dual-quaternion blending around a single hinge reduces to a fractional
// rotation about that hinge. This preserves the volume of a rounded knee or cuff.
function flexibleCloth(geometry,joint,length,band){
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  const rest=position.array.slice(),restNormal=normal.array.slice(),weights=new Float32Array(position.count);
  for(let i=0;i<weights.length;i++)weights[i]=smooth(-band,band,-rest[3*i+1]-length);
  position.setUsage(T.DynamicDrawUsage);normal.setUsage(T.DynamicDrawUsage);
  geometry.userData.posedCloth=true;
  const prev=new T.Quaternion(),identity=new T.Quaternion(),rotation=new T.Quaternion();
  const v=new T.Vector3(),n=new T.Vector3();
  return ()=>{
    if(prev.angleTo(joint.quaternion)<.00005)return;
    prev.copy(joint.quaternion);
    for(let i=0;i<weights.length;i++){
      const weight=weights[i];if(!weight)continue;
      if(weight===1)rotation.copy(prev);else rotation.slerpQuaternions(identity,prev,weight);
      v.fromArray(rest,3*i);v.y+=length;v.applyQuaternion(rotation);v.y-=length;
      n.fromArray(restNormal,3*i).applyQuaternion(rotation);
      position.setXYZ(i,v.x,v.y,v.z);normal.setXYZ(i,n.x,n.y,n.z);
    }
    position.needsUpdate=normal.needsUpdate=true;
    // Bounds are computed from the current cloth, including elbows folded up to a rail.
    geometry.computeBoundingSphere();
  };
}

export function strideLength(speed){return mix(1.52,2.58,smooth(2.2,4.8,speed));}

export function createStreetAvatar(appearance) {
  const palette=appearance==null?C:{...C,...visitorLook(appearance)};
  const root = new T.Group();
  root.name = 'Street explorer';
  const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.92, metalness:0});
  const geometries = [];
  function mount(node, draw, side) {
    const part = new Part(palette);
    draw(part, side);
    const geometry=part.attach(node,material);geometries.push(geometry);return geometry;
  }
  const hips = joint('Hips', root, 0,PELVIS,0);
  mount(hips, part => part.shell([0,0,0], [[-.092,.110,.073],[-.038,.147,.099],
    [.043,.145,.096],[.108,.131,.090]], palette.trousers,12));
  const torso = joint('Jacket and backpack',hips,0,.066,0);
  mount(torso,jacket);
  const bag=joint('Canvas daypack',torso,0,0,0);mount(bag,backpack);
  const head = joint('Head',torso,0,.520,-.002);
  mount(head,face);

  // At the broad palm ring this point lies on the skin. Pitching the hand
  // ninety degrees puts this surface downward and the fingertips over the lip.
  const palmPoint = new T.Vector3(0,-.056,.018);
  const xAxis = new T.Vector3(1,0,0);
  const handOrientation = new T.Quaternion().setFromAxisAngle(xAxis,Math.PI/2);
  const wristToPalm = palmPoint.clone().applyQuaternion(handOrientation);

  const limbs = [-1,1].map(s => {
    const side = s < 0 ? 'Left ' : 'Right ';
    const hip = joint(side+'hip',hips,s*.088,0,0);
    const knee = joint(side+'knee',hip,0,-THIGH,0);
    const ankle = joint(side+'ankle',knee,0,-SHIN,0);
    const shoulder = joint(side+'shoulder',torso,s*.180,.425,0);
    const elbow = joint(side+'elbow',shoulder,0,-ARM,0);
    const wrist = joint(side+'wrist',elbow,0,-FOREARM,0);
    joint(side+'palm contact',wrist,palmPoint.x,palmPoint.y,palmPoint.z);
    const trouserLeg=flexibleCloth(mount(hip,leg,s),knee,THIGH,.105);
    const shirtSleeve=flexibleCloth(mount(shoulder,arm,s),elbow,ARM,.090);
    mount(ankle,sneaker);mount(wrist,hand,s);
    return {s,hip,knee,ankle,shoulder,elbow,wrist,trouserLeg,shirtSleeve,foot:{}};

  });

  const shoulderPosition = new T.Vector3(), direction = new T.Vector3(), pole = new T.Vector3();
  const axisX = new T.Vector3(), axisY = new T.Vector3(), axisZ = new T.Vector3();
  const basis = new T.Matrix4(), upper = new T.Quaternion(), bend = new T.Quaternion();
  const local = new T.Quaternion();

  // The two-link solution runs in root space, including shoulder movement from
  // trunk pitch and roll. The elbow pole keeps the joint on the same side of
  // the arm as the target moves through chest and shoulder height.
  function plantPalm(s,shoulder,elbow,wrist,grip,climb,weight,explicitContact) {
    shoulderPosition.copy(shoulder.position).applyQuaternion(torso.quaternion)
      .add(torso.position).add(hips.position);
    direction.copy(grip).sub(wristToPalm);
    if (climb && !explicitContact) direction.x += s*.18;
    direction.sub(shoulderPosition);
    const requested = direction.length();
    if (requested < 1e-6) direction.set(0,-1,0);
    else direction.multiplyScalar(1/requested);
    const distance = clamp(requested,Math.abs(ARM-FOREARM)+.012,ARM+FOREARM-.002);
    const along = (distance*distance+ARM*ARM-FOREARM*FOREARM)/(2*distance);
    const across = Math.sqrt(Math.max(0,ARM*ARM-along*along));
    pole.set(s*(climb?.56:.70),-.59,.87);
    pole.addScaledVector(direction,-pole.dot(direction));
    if (pole.lengthSq()<1e-6) {
      pole.set(0,0,1).addScaledVector(direction,-direction.z);
    }
    pole.normalize();
    axisX.crossVectors(pole,direction).normalize();
    axisY.copy(direction).multiplyScalar(-along).addScaledVector(pole,-across).normalize();
    axisZ.crossVectors(axisX,axisY);
    upper.setFromRotationMatrix(basis.makeBasis(axisX,axisY,axisZ));
    const angle = Math.acos(clamp((distance*distance-ARM*ARM-FOREARM*FOREARM)/(2*ARM*FOREARM),-1,1));
    bend.setFromAxisAngle(xAxis,angle);
    local.copy(torso.quaternion).invert().multiply(upper);
    shoulder.quaternion.slerp(local,weight);
    elbow.quaternion.slerp(bend,weight);
    local.copy(upper).multiply(bend).invert().multiply(handOrientation);
    wrist.quaternion.slerp(local,weight);
  }

  function pose({gait=0,speed=0,time=0,turn=0,look=0,impact=0,grounded=true,action=null,progress=0,verticalSpeed=0,grip=null,palms=null}={}) {
    const motion = smooth(0,.80,speed), run = smooth(1.45,5.5,speed);
    const cycle = Math.cos(gait), bounce = Math.sin(gait)**2;
    const p = clamp(progress,0,1), climb = action === 'climb', vault = action === 'vault';
    const acting = (climb || vault) ? smooth(0,.13,p)*(1-smooth(.79,1,p)) : 0;
    const plant = grip && (climb||vault) ? (climb
      ? smooth(.045,.18,p)*(1-smooth(.64,.81,p))
      : smooth(.07,.22,p)*(1-smooth(.52,.71,p))) : 0;
    const onWall = action === 'wall';
    const airborne = grounded || climb || vault || onWall ? 0 : 1;
    const landing = smooth(-4.5, 2, verticalSpeed);
    const walking=grounded&&!action?motion:0,rest=grounded&&!action?1-motion:0;
    const stride=strideLength(speed),stance=mix(.56,.37,run);
    let hipY=PELVIS-.026-.045*walking-.032*run*walking+.025*walking*bounce-.065*impact;
    for(const limb of limbs){
      const phase=((gait/TAU+(limb.s<0?.5:0))%1+1)%1;
      const t=clamp((phase-stance)/(1-stance),0,1);
      // During stance the shoe travels backward at the visitor's world speed.
      // The swing interpolant matches that velocity at toe-off and heel-strike.
      const longitudinal=phase<stance?stride*(stance/2-phase):
        stride*(-stance/2-(1-stance)*t+smooth(0,1,t));
      const lift=Math.sin(t*Math.PI);
      const roll=phase<stance?
        -.18*(1-smooth(0,.14,phase))+.35*smooth(stance*.65,stance,phase):
        mix(.35,-.18,smooth(0,1,t));
      const foot=limb.foot;
      foot.pitch=walking*roll;
      foot.forward=mix(limb.s*.080,longitudinal,walking);
      foot.y=ANKLE*Math.cos(foot.pitch)+Math.max(.080*Math.sin(foot.pitch),-.174*Math.sin(foot.pitch))
        +walking*(.115+.13*run)*lift**1.5;
      hipY=Math.min(hipY,foot.y+Math.sqrt(Math.max(.05,(THIGH+SHIN-.004)**2-foot.forward**2)));
    }
    hips.position.y=mix(hipY,PELVIS-.060,acting);
    hips.position.x=.028*rest-.023*walking*Math.sin(gait);
    hips.rotation.y=.046*rest+.072*cycle*walking;
    torso.rotation.x=mix(-.025*rest-.082*walking-.102*run*walking-.11*impact
      -airborne*(.07+.07*landing),climb?-.26-.22*Math.sin(Math.PI*p):-.62,acting);
    torso.rotation.y=-.064*rest-.15*cycle*walking;
    torso.rotation.z=.052*rest+.027*walking*Math.sin(gait)+.070*turn*walking
      +acting*(vault?-.20:.024*Math.sin(Math.PI*p));
    head.rotation.x=-.68*torso.rotation.x-.14*acting*(climb?1:0)+.018*rest+.16*look*(1-acting);
    head.rotation.y=-.65*torso.rotation.y-.042*rest-.13*turn*walking;
    head.rotation.z=-.68*torso.rotation.z;
    const breath=.0026*rest*Math.sin(time*1.55);
    torso.position.y=.066+breath;
    bag.rotation.set(.024*walking*Math.sin(2*gait-.6)+.06*impact,0,-.05*walking*Math.cos(gait-.35));
    bag.position.y=.005*walking*Math.sin(2*gait-.65);
    for(const {s,hip,knee,ankle,shoulder,elbow,wrist,trouserLeg,shirtSleeve,foot} of limbs){
      const phase=gait+(s<0?Math.PI:0),reach=Math.cos(phase);
      solve(THIGH,SHIN,foot.forward,foot.y-hips.position.y,-1,hip,knee);
      ankle.rotation.x=foot.pitch-hip.rotation.x-knee.rotation.x;
      hip.rotation.z=rest*(s*.025+.015);
      shoulder.position.y=.425+s*(.007*rest+.005*walking*Math.sin(gait));
      shoulder.rotation.x=-.082+s*.11*rest-(.41+.37*run)*reach*walking;
      shoulder.rotation.z=s*(.075+.055*walking+.018*Math.sin(phase)*walking)+.015*rest;
      shoulder.rotation.y=s*.055-.10*walking*Math.sin(phase);
      elbow.rotation.x=.30+s*.14*rest+.32*walking+.53*run*walking+.18*walking*Math.max(0,-reach);
      wrist.rotation.set(.03-.07*walking*Math.sin(phase),s*(1.04-.23*walking),s*.044);
      if (airborne) {
        hip.rotation.x = s > 0 ? .51+.34*landing : .20-.41*landing;
        knee.rotation.x = s > 0 ? -.98-.22*landing : -.56-.48*landing;
        ankle.rotation.x = -.35*hip.rotation.x-.68*knee.rotation.x-.24;
        shoulder.rotation.x = s > 0 ? .55-.95*landing : -.12+.84*landing;
        shoulder.rotation.z = s*(.27+.15*(1-landing));
        elbow.rotation.x = .55+.26*landing;
      }

      if (onWall) {
        // Opposite hand and foot trade support as the body climbs the wall.
        const stroke = Math.sin(progress*8 + (s < 0 ? Math.PI : 0));
        solve(THIGH,SHIN,.22+.04*stroke,-.65+.11*stroke,-1,hip,knee);
        ankle.rotation.x = -.22-hip.rotation.x-knee.rotation.x;
        solve(ARM,FOREARM+.047,.33,.10-.17*stroke,1,shoulder,elbow);
        shoulder.rotation.x -= torso.rotation.x;
        shoulder.rotation.z = s*.16;
        if(palms)plantPalm(s,shoulder,elbow,wrist,palms[s>0?1:0],true,1,true);
      }
      if (acting > 0) {
        const lead = s > 0;
        const raised = climb ? (lead ? 1.22 : .49 + .71*smooth(.36,.85,p)) :
          (lead ? 1.23 : .88) + .26*Math.sin(Math.PI*p);
        const tucked = climb ? (lead ? -1.46 : -1.06) : (lead ? -1.77 : -1.96);
        hip.rotation.x = mix(hip.rotation.x,raised,acting);
        knee.rotation.x = mix(knee.rotation.x,tucked,acting);
        hip.rotation.z = -s*acting*(vault ? .22 : .066);
        ankle.rotation.x = mix(ankle.rotation.x,-raised-.8*tucked-.11,acting);
        const baseShoulder = shoulder.rotation.x, baseElbow = elbow.rotation.x;
        if (climb || lead) {
          const travel = smooth(.17,.81,p);
          const forward = climb ? mix(.34,.29,travel) : mix(.38,-.13,travel);
          const up = climb ? mix(.245,-.345,travel) : mix(-.16,-.432,travel);
          solve(ARM,FOREARM+.047,forward,up,1,shoulder,elbow);
          shoulder.rotation.x = mix(baseShoulder,shoulder.rotation.x-torso.rotation.x,acting);
          elbow.rotation.x = mix(baseElbow,elbow.rotation.x,acting);
          shoulder.rotation.z = mix(shoulder.rotation.z,s*(climb ? .10 : .21),acting);
          wrist.rotation.x = acting*(climb ? -.47 : -.72);
          if (plant > 0) plantPalm(s,shoulder,elbow,wrist,palms?.[lead ? 1 : 0] || grip,climb,plant,!!palms);
        } else {
          shoulder.rotation.x = mix(baseShoulder,-.71,acting);
          shoulder.rotation.z = mix(shoulder.rotation.z,s*.68,acting);
          elbow.rotation.x = mix(baseElbow,.48,acting);
        }
      }
      trouserLeg();shirtSleeve();
    }
  }

  pose();
  function dispose() {
    root.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    material.dispose();
  }
  return {root,pose,dispose};
}
