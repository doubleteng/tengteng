// Run with Node: node tools/id3/market-switchback/check_camera.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {OrbitControls} from '../../../teaching/id3/lib/controls/OrbitControls.js';
import {AtlasViewer} from '../../../teaching/id3/viewer.js';
import {CameraClearance} from '../../../teaching/id3/camera-clearance.js';

// The GLB loader decodes embedded pavement textures. The collision test only consumes geometry.
globalThis.self = globalThis;
globalThis.createImageBitmap ??= async () => ({width:1, height:1, close(){}});
const modelDir = new URL('../../../teaching/id3/models/', import.meta.url);
const loader = new GLTFLoader();
const roots = await Promise.all(['market-switchback','urban-core-materials','urban-near','urban-outer'].map(async name => {
 const bytes = await readFile(new URL(name+'.glb',modelDir));
 const {scene} = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 scene.traverse(o => {if (o.userData.initialHidden) o.visible=false;});
 return scene;
}));

const camera = new T.PerspectiveCamera(44, 16/9, .05, 1000);
const controls = new OrbitControls(camera,null);
const projectBounds = new T.Box3().setFromObject(roots[0]);
const radius = projectBounds.getSize(new T.Vector3()).length()*.54;
const viewer = Object.assign(Object.create(AtlasViewer.prototype), {
 project:roots[0], camera, controls, perspectiveCamera:camera, parallelCamera:new T.OrthographicCamera(),
 host:{clientWidth:1920,clientHeight:1080},height:57,width:106,radius,projectBounds,caseStudy:true,
 clearance:new CameraClearance(roots),center:new T.Vector3(-47.5,5.5,26),
 renderer:{setSize(){}},inkViewHeight:{},draw(){},activate(){}
});
controls.addEventListener('change', () => viewer.cameraChanged());

function firstVisibleHit() {
 const direction = camera.getWorldDirection(new T.Vector3());
 return new T.Raycaster(camera.position,direction).intersectObjects(roots,true).find(hit=>hit.object.visible);
}
viewer.view('perspective',false);
const start = camera.position.clone(), firstRoof = firstVisibleHit();
assert.ok(firstRoof && firstRoof.distance < start.distanceTo(controls.target));
for (let i=0;i<30;i++) viewer.changeZoom(1.22);
const travel = start.distanceTo(camera.position);
assert.ok(Math.abs(firstRoof.distance-travel-.25)<.002, 'Repeated dolly must stop before the roof.');
viewer.changeZoom(1/1.22);
assert.ok(start.distanceTo(camera.position)<travel,'Dolly away from the roof must remain possible.');
const beforeResize = camera.position.clone();
viewer.host.clientWidth=850;viewer.host.clientHeight=950;viewer.resize();
assert.ok(camera.position.distanceTo(beforeResize)<1e-8,'Changing aspect after navigation must preserve the eye.');

viewer.view('case-arcade',false);
assert.ok(camera.position.distanceTo(new T.Vector3(-11.106,4.17,25.4))<1e-5,
 'Keep the arcade view at street level on Detroit Street.');
assert.ok(firstVisibleHit()?.distance>5,'The arcade view must show the frame beyond the street.');
viewer.view('case-hall',false);
const hall = new T.Vector3(-45.16,4.16,16.06);
assert.ok(camera.position.distanceTo(hall)<1e-8,'Preserve the requested gallery eye height.');
viewer.changeZoom(1.04);
assert.ok(camera.position.distanceTo(hall)>.01,'The hall must permit interior navigation.');
viewer.view('case-node',false);
const bearing = firstVisibleHit();
assert.match(bearing.object.name,/bearing_columns|node_seats/i);
assert.ok(bearing.distance>4,'The bearing view must include the support and its pedestal.');
viewer.view('case-roof',false);
assert.match(firstVisibleHit().object.name,/roof|photovoltaic/i);
viewer.host.clientWidth=1920;viewer.host.clientHeight=1080;viewer.view('perspective',false);
assert.ok(camera.position.distanceTo(start)<1e-8,'Fit must restore the exterior view.');

const panel = new T.Mesh(new T.BoxGeometry(4,.15,3),new T.MeshBasicMaterial());
panel.rotation.z=.5;panel.position.set(6,4,1);
const group = new T.Group();group.add(panel);
const guard = new CameraClearance([group]), eye = new T.Vector3(6,9,1), target = new T.Vector3(7,9,1);
guard.reset(eye,target);eye.y=target.y=-1;guard.constrain(eye,target);
assert.ok(eye.y>4.25 && eye.y<4.5,'A large pan must not tunnel through a tilted panel.');
assert.ok(Math.abs(target.distanceTo(eye)-1)<1e-8);
group.visible=false;eye.y=target.y=-1;guard.constrain(eye,target);
assert.equal(eye.y,-1,'Hidden layers must allow passage.');
console.log('Passed exterior dolly, fullscreen resize, interior navigation, bearing/roof views, fit, pan and hidden-layer checks.');

const {siteFootprint}=await import('../../../teaching/id3/site-model.js');
const registered=siteFootprint();
const districtGuard=new CameraClearance(roots,{registeredSite:registered,fallback:-13.8});
const close=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(expected-actual)<tol,`Expected ${expected}, got ${actual}`);
close(districtGuard.minimumEyeHeight(-90,16),.1524+.25);
close(districtGuard.minimumEyeHeight(-27,42),2.4384+.25);
assert.ok(districtGuard.minimumEyeHeight(-196,-115)<-3,'Keep surveyed grades below the parcel datum.');
assert.ok(districtGuard.minimumEyeHeight(160,160)>8,'An uphill district road must retain its grade.');
close(districtGuard.minimumEyeHeight(800,800),-13.8+.25);
const siteOnly=new CameraClearance([],{registeredSite:registered,fallback:-10});
assert.ok(siteOnly.minimumEyeHeight(-68,20)<siteOnly.minimumEyeHeight(-47,20),'The registered parcel follows its eastward slope.');

const ridgeGeometry=new T.BufferGeometry();
ridgeGeometry.setAttribute('position',new T.Float32BufferAttribute([
 0,0,-2, 0,0,2, 3,3,-2, 3,3,2, 6,0,-2, 6,0,2
],3));
ridgeGeometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);
const ridge=new T.Mesh(ridgeGeometry);
ridge.userData.groundSurface=true;
ridge.visible=false;
const ridgeGuard=new CameraClearance([ridge],{fallback:-2});
let from=new T.Vector3(0,1.25,0), to=new T.Vector3(6,1.25,0), anchor=new T.Vector3(6,2,0);
ridgeGuard.reset(from,anchor);
ridgeGuard.constrain(to,anchor);
close(to.x,1,2e-6);
assert.ok(to.y>=ridgeGuard.minimumEyeHeight(to.x,to.z),'A fast horizontal pan cannot tunnel through a ridge.');

viewer.caseStudy=false;
viewer.clearance=new CameraClearance([],{fallback:2});
viewer.view('perspective',false);
viewer.orbit(0,1.20);
close(camera.position.y,2.25,2e-6);
assert.ok(camera.position.y<controls.target.y,'An ordinary project can be viewed from below the orbit target.');
viewer.orbit(.11,0);
assert.ok(camera.position.y>=2.25-1e-6);

const targetSpan=()=>2*camera.position.distanceTo(controls.target)*Math.tan(T.MathUtils.degToRad(camera.fov/2));
viewer.view('perspective',false);
const heading=camera.getWorldDirection(new T.Vector3());
let frame=targetSpan();
close(viewer.setDollyZoom(30),30);close(targetSpan(),frame);
assert.ok(camera.getWorldDirection(new T.Vector3()).distanceTo(heading)<1e-7);
close(viewer.setDollyZoom(71),71);close(targetSpan(),frame);
viewer.view('perspective',false);close(viewer.getDollyZoom(),44);

const wall=new T.Mesh(new T.BoxGeometry(8,8,.2));
wall.position.set(0,4,8);
viewer.clearance=new CameraClearance([wall],{fallback:0});
controls.target.set(0,4,0);camera.position.set(0,4,12);viewer.clearance.place(camera.position,controls.target);controls.update();
frame=targetSpan();
const limited=viewer.setDollyZoom(85);
assert.ok(limited>44&&limited<85);
close(camera.position.z,8.35,3e-6);close(targetSpan(),frame);
viewer.clearance=new CameraClearance([],{fallback:2});
controls.target.set(0,-2,0);camera.position.set(0,4,8);viewer.clearance.place(camera.position,controls.target);controls.update();
camera.fov=44;camera.updateProjectionMatrix();frame=targetSpan();
assert.ok(viewer.setDollyZoom(85)<85,'Limit the lens when the optical axis intersects the ground.');
close(camera.position.y,2.25,2e-6);close(targetSpan(),frame);
viewer.view('axon',false);assert.equal(viewer.getDollyZoom(),null);assert.equal(viewer.setDollyZoom(35),null);
viewer.view('case-hall',false);close(viewer.getDollyZoom(),74);
console.log('Passed surveyed floors, parcel grade, terrain-edge sweep, low orbit, dolly framing, wall/ground limits and lens reset.');
