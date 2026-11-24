import {Box3, Float32BufferAttribute, Matrix4, Ray, Vector3} from './lib/three.module.min.js';

// Test the eye's movement in world space. The district and case meshes are static.
// Consecutive triangles usually describe one physical element, so small runs have
// tight bounds even when an entire glazing or framing layer is batched as one mesh.
const trianglesPerRun = 32;
const runsPerBlock = 16;
const clearance = .25;
const identity = new Matrix4();

function indexMesh(mesh) {
 const {position} = mesh.geometry.attributes, index = mesh.geometry.index;
 const vertex = new Vector3();
 let vertices = position;
 if (!mesh.matrixWorld.equals(identity)) {
  vertices = new Float32BufferAttribute(new Float32Array(position.count * 3), 3);
  for (let i = 0; i < position.count; i++) {
   vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
   vertices.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
 }
 const indices = index?.array;
 const length = index ? index.count : position.count;
 const blocks = [], bounds = new Box3();
 let block;
 for (let start = 0; start < length; start += trianglesPerRun * 3) {
  if (!block || block.runs.length === runsPerBlock) {
   block = {bounds:new Box3(), runs:[]};
   blocks.push(block);
  }
  const end = Math.min(start + trianglesPerRun * 3, length), run = new Box3();
  for (let i = start; i < end; i++) run.expandByPoint(vertex.fromBufferAttribute(vertices, indices ? indices[i] : i));
  block.runs.push({start, end, bounds:run});
  block.bounds.union(run);
  bounds.union(run);
 }
 return {mesh, vertices, indices, blocks, bounds};
}

export class CameraClearance {
 constructor(roots) {
  this.meshes = [];
  for (const root of roots) {
   root?.updateWorldMatrix(true, true);
   root?.traverse(object => {
    if (object.isMesh && object.geometry?.attributes.position && !object.userData.contextSourceSupport)
     this.meshes.push(indexMesh(object));
   });
  }
  this.eye = new Vector3();
  this.target = new Vector3();
  this.ray = new Ray();
  this.hit = new Vector3();
  this.sweep = new Box3();
  this.a = new Vector3(); this.b = new Vector3(); this.c = new Vector3();
 }
 reset(eye, target) {
  this.eye.copy(eye);
  this.target.copy(target);
 }
 constrain(eye, target) {
  const ray = this.ray;
  ray.origin.copy(this.eye);
  ray.direction.subVectors(eye, this.eye);
  const distance = ray.direction.length();
  if (distance < 1e-8) { this.reset(eye, target); return; }
  ray.direction.divideScalar(distance);
  let nearest = distance + clearance;
  const end = ray.at(nearest, this.hit);
  this.sweep.makeEmpty().expandByPoint(this.eye).expandByPoint(end);
  for (const {mesh, vertices, indices, blocks, bounds} of this.meshes) {
   if (!this.sweep.intersectsBox(bounds)) continue;
   let ancestor = mesh;
   while (ancestor && ancestor.visible) ancestor = ancestor.parent;
   if (ancestor) continue;
   for (const block of blocks) {
    if (!this.sweep.intersectsBox(block.bounds)) continue;
    for (const run of block.runs) {
     if (!this.sweep.intersectsBox(run.bounds)) continue;
     for (let i = run.start; i < run.end; i += 3) {
      this.a.fromBufferAttribute(vertices, indices ? indices[i] : i);
      this.b.fromBufferAttribute(vertices, indices ? indices[i+1] : i+1);
      this.c.fromBufferAttribute(vertices, indices ? indices[i+2] : i+2);
      if (ray.intersectTriangle(this.a, this.b, this.c, false, this.hit))
       nearest = Math.min(nearest, ray.origin.distanceTo(this.hit));
     }
    }
   }
  }
  const travel = Math.max(0, nearest - clearance);
  if (travel < distance - 1e-8) {
   ray.at(travel, eye);
   target.lerpVectors(this.target, target, travel / distance);
  }
  this.reset(eye, target);
 }
}
