// Distances are metres. The figure faces local -Z, with its soles at the origin.
import * as T from './lib/three.module.min.js';

const C = {
  skin: 0xb87954, lips: 0x74423d, hair: 0x302625, hairLight: 0x49362e,
  jacket: 0x347e82, aqua: 0x55a4a0, deep: 0x225c61, knit: 0x20454a,
  trousers: 0x384559, seam: 0x506175, canvas: 0xeb7054, flap: 0xff906c,
  binding: 0x9f493d, webbing: 0x394b4d, cream: 0xf9dfae, paper: 0xffebcb,
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

// Rigid, vertex-colored batches keep every joint to a single draw. Normals
// stay smooth across color seams, while the caps have separate hard edges.
class Part {
  constructor() {
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
  shell(origin, rows, finish, sides = 10, exponent = 1, hem = null) {
    const points = [], faces = [];
    const color = (row, side) => typeof finish === 'function' ? finish(row, side) : finish;
    for (let row = 0; row < rows.length; row++) {
      const [y, w, d, z = 0, x = 0] = rows[row];
      for (let k = 0; k < sides; k++) {
        const angle = k * TAU / sides, s = Math.sin(angle), c = Math.cos(angle);
        points.push([
          origin[0] + x + w * Math.sign(s) * Math.abs(s) ** exponent,
          origin[1] + y + (hem ? hem(row, angle) : 0),
          origin[2] + z + d * Math.sign(c) * Math.abs(c) ** exponent,
        ]);
      }
    }
    for (let row = 0; row < rows.length - 1; row++) {
      for (let k = 0; k < sides; k++) {
        const a = row * sides + k, b = row * sides + (k + 1) % sides;
        const tint = color(row, k);
        faces.push([a, b, b + sides, tint], [a, b + sides, a + sides, tint]);
      }
    }
    for (const row of [0, rows.length - 1]) {
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

  attach(joint, material) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = joint.name + ' surface';
    mesh.userData.districtVertexColors = true;
    mesh.castShadow = mesh.receiveShadow = true;
    joint.add(mesh);
    return geometry;
  }
}

function jacket(part) {
  part.shell([0,0,0], [
    [.005,.143,.093],[.034,.148,.099],[.071,.157,.109],
    [.204,.151,.105],[.337,.170,.111],[.417,.193,.112],[.457,.184,.094],
    [.483,.122,.082],[.495,.069,.057],
  ], (row) => row === 0 ? C.knit : row >= 5 ? C.aqua : C.jacket, 16, .90);
  part.shell([0,0,0], [[.478,.082,.07],[.503,.073,.063],[.523,.067,.057]], C.deep, 12);
  part.shell([0,0,0], [[.508,.055,.050],[.556,.052,.046],[.582,.064,.057]], C.skin, 10);
  part.ribbon([[0,.023,-.099],[0,.077,-.110],[0,.204,-.106],[0,.34,-.113],
    [0,.419,-.114],[0,.46,-.095],[0,.493,-.061]], .009,.003,C.knit);
  for (const s of [-1, 1]) {
    part.ribbon([[s*.112,.124,.100],[s*.135,.37,.098],[s*.12,.463,.069],
      [s*.112,.482,.016],[s*.117,.472,-.055],[s*.127,.418,-.094],
      [s*.129,.325,-.089],[s*.132,.203,-.081],[s*.136,.136,-.071]],
    .035,.012,C.webbing);
    part.ribbon([[s*.13,.261,-.091],[s*.132,.238,-.088]],.039,.013,C.cream);
  }
  // A coral canvas rucksack with a contrasting pocket, stitched label and side flask.
  part.shell([0,0,.124], [
    [.099,.091,.043],[.115,.117,.060],[.143,.126,.067],[.340,.131,.076],
    [.394,.121,.070],[.425,.094,.055],[.431,.070,.035],
  ], row => row < 2 ? C.binding : C.canvas, 12, .63);
  part.shell([0,0,.176], [[.158,.085,.015],[.172,.101,.032],[.228,.102,.035],
    [.242,.092,.032],[.25,.085,.021]], row => row === 3 ? C.binding : C.flap,12,.54);
  part.shell([0,0,.19], [[.307,.040,.008],[.339,.040,.01]],
    C.cream,8,.5);
  part.shell([0,0,.201], [[.317,.021,.001],[.324,.021,.002]], C.deep, 8, .5);
  part.ribbon([[-.048,.406,.143],[-.035,.450,.131],[0,.457,.120],
    [.035,.450,.131],[.048,.406,.143]],.016,.011,C.binding);
  part.shell([.125,0,.136], [[.157,.025,.026],[.174,.030,.030],[.275,.027,.027],
    [.281,.021,.021],[.291,.021,.020]], row => row < 2 ? C.deep : row === 2 ? C.aqua : C.cream,8);
}

function face(part) {
  part.shell([0,0,-.004], [[0,.040,.046,-.012],[.019,.061,.060,-.018],
    [.053,.078,.080,-.011],[.10,.09,.088],[.150,.094,.090],[.19,.081,.083],
    [.21,.058,.058]], C.skin,16,.91);
  for (const s of [-1,1]) {
    part.oval([s*.087,.099,.002],.018,.031,.019,C.skin);
    part.oval([s*.039,.105,-.086],.010,.006,.004,C.eye);
    part.ribbon([[s*.029,.126,-.091],[s*.052,.13,-.082]],
      .013,.005,C.hair);
  }
  part.oval([0,.083,-.091],.016,.024,.019,C.skin);
  part.shell([0,.049,-.084], [[0,.015,.004],[.004,.016,.004]],C.lips,8);
  // The cap rises over the forehead and falls to the nape. The small gathered
  // puff and its narrow tie read clearly when the camera follows the character.
  part.shell([0,0,0], [[.081,.094,.087],[.157,.101,.097],[.202,.088,.087],
    [.227,.060,.061,.002,-.007],[.237,.029,.032,0,-.010]],
  (row,k) => row >= 2 && (k === 2 || k === 3) ? C.hairLight : C.hair,
  16, .94, (row,a) => row === 0 ? -.061*Math.cos(a) + .011*Math.sin(2*a) : 0);
  part.oval([-.022,.145,.091],.046,.041,.031,C.cream);
  part.oval([-.023,.155,.123],.061,.062,.050,C.hairLight,10);
  part.oval([-.045,.168,.140],.043,.041,.037,C.hair,8);
}

function sleeve(part, side) {
  part.shell([0,0,0], [[-.283,.048,.049],[ -.266,.050,.050],
    [-.249,.060,.057],[-.16,.063,.064],[-.078,.075,.072],
    [-.027,.076,.074],[.016,.066,.068],[.044,.036,.047]],
    row => row < 2 ? C.deep : row >= 5 ? C.aqua : C.jacket,10);
  part.shell([side*.065,-.105,.002],[[0,.011,.025],[.031,.012,.027]],C.cream,8,.6);
}

function forearm(part) {
  part.shell([0,0,0],[[-FOREARM,.038,.036],[-.218,.042,.040],
    [-.194,.047,.043],[-.106,.051,.048],[-.036,.059,.054],[.018,.048,.047]],
    row => row < 2 ? C.knit : C.jacket,10);
}

function hand(part, s) {
  part.shell([0,0,0],[[-.103,.018,.020,-.010],[-.089,.029,.024,-.010],
    [-.056,.035,.026,-.008],[-.025,.035,.026], [.01,.029,.025]], C.skin,8);
  part.oval([-s*.026,-.048,-.019],.015,.029,.013,C.skin);
}

function thigh(part, s) {
  part.shell([0,0,0], [[-THIGH-.004,.064,.060],[-.377,.072,.065],
    [-.269,.074,.074],[-.143,.090,.088],[0,.096,.093],[.031,.077,.074]],
    C.trousers, 10);
  part.shell([s*.076,-.217,.012],[[0,.013,.044],[.084,.021,.045],
    [.099,.020,.048]],row => row === 1 ? C.seam : C.trousers,8,.65);
}

function shin(part) {
  part.shell([0,0,0], [[-SHIN+.012,.049,.044],[-.350,.050,.047],[-.332,.055,.052],
    [-.202,.064,.065,.005],[-.105,.075,.070,.009],[-.045,.070,.060],[.022,.059,.057]],
    row => row < 2 ? C.seam : C.trousers,10);
  part.shell([0,0,0],[[-SHIN-.014,.042,.042],[-SHIN+.021,.046,.045]],C.cream);
}

function sneaker(part) {
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

export function createStreetAvatar() {
  const root = new T.Group();
  root.name = 'Street explorer';
  const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.92, metalness:0});
  const geometries = [];
  function mount(node, draw, side) {
    const part = new Part();
    draw(part, side);
    geometries.push(part.attach(node, material));
  }
  const hips = joint('Hips', root, 0,PELVIS,0);
  mount(hips, part => part.shell([0,0,0], [[-.092,.110,.073],[-.038,.147,.099],
    [.043,.145,.096],[.108,.131,.090]], C.trousers,12));
  const torso = joint('Jacket and backpack',hips,0,.066,0);
  mount(torso,jacket);
  const head = joint('Head',torso,0,.545,0);
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
    mount(hip,thigh,s); mount(knee,shin); mount(ankle,sneaker);
    mount(shoulder,sleeve,s); mount(elbow,forearm); mount(wrist,hand,s);
    return {s,hip,knee,ankle,shoulder,elbow,wrist};
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

  function pose({gait=0,speed=0,grounded=true,action=null,progress=0,verticalSpeed=0,grip=null,palms=null}={}) {
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
    const neutralHip = PELVIS - motion*(.035+run*.031) + bounce*motion*(.010+run*.016);
    hips.position.y = mix(neutralHip, PELVIS-.060, acting);
    hips.position.x = -.014*motion*Math.sin(gait)*(1-acting)*(1-airborne);
    const pitch = -.095*motion - .12*run - airborne*(.07+.07*landing);
    torso.rotation.x = mix(pitch, climb ? -.26-.22*Math.sin(Math.PI*p) : -.62, acting);
    torso.rotation.y = -.088*cycle*motion*(1-acting);
    torso.rotation.z = acting*(vault ? -.20 : .024*Math.sin(Math.PI*p));
    head.rotation.x = -.68*torso.rotation.x - .14*acting*(climb ? 1 : 0);
    head.rotation.y = -.54*torso.rotation.y;
    head.rotation.z = -.66*torso.rotation.z;

    for (const {s,hip,knee,ankle,shoulder,elbow,wrist} of limbs) {
      const phase = gait + (s < 0 ? Math.PI : 0);
      const swing = Math.max(0,-Math.sin(phase)), reach = Math.cos(phase);
      const footPitch = motion*(.12*reach - (.17+.14*run)*swing);
      const heelHeight = Math.max(.082*Math.sin(footPitch),-.177*Math.sin(footPitch),0);
      const footHeight = ANKLE + heelHeight + motion*(.079+.134*run)*swing**1.4;
      solve(THIGH,SHIN,motion*(.159+.117*run)*reach,footHeight-hips.position.y,
        -1,hip,knee);
      ankle.rotation.x = footPitch-hip.rotation.x-knee.rotation.x;
      hip.rotation.z = 0;
      shoulder.rotation.x = -.33*reach*motion-.42*run*reach;
      shoulder.rotation.z = s*(.095+.05*motion);
      shoulder.rotation.y = 0;
      elbow.rotation.x = .14+.19*motion+.67*run+.11*motion*Math.max(0,-reach);
      wrist.rotation.set(.018,0,0);

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
