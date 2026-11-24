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
const radius = new T.Box3().setFromObject(roots[0]).getSize(new T.Vector3()).length()*.54;
const viewer = Object.assign(Object.create(AtlasViewer.prototype), {
 project:roots[0], camera, controls, perspectiveCamera:camera, parallelCamera:new T.OrthographicCamera(),
 host:{clientWidth:1920,clientHeight:1080},height:57,width:106,radius,caseStudy:true,
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
