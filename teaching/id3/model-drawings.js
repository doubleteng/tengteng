// Snapshot the selected project only. The worker owns topology, projection and visibility.
import { Matrix4, Vector3 } from './lib/three.module.min.js';

function drawingMeshes(root) {
  const parts = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const point = new Vector3(), instance = new Matrix4(), world = new Matrix4();
  root.updateWorldMatrix(true, true);
  function visit(object) {
    const flags = object.userData || {};
    if (!object.visible || flags.drawingSupport || flags.contextOutline || flags.annotation || flags.isAnnotation) return;
    const geom = object.geometry;
    if (object.isMesh && geom?.attributes.position) {
      const pos = geom.attributes.position;
      const sourceIndex = geom.index;
      const limit = sourceIndex ? sourceIndex.count : pos.count;
      const drawStart = Math.max(0, geom.drawRange.start), drawEnd = Math.min(limit, drawStart + geom.drawRange.count);
      const groups = Array.isArray(object.material) ? geom.groups : [{start:0, count:limit, materialIndex:0}];
      const range = [];
      for (const group of groups) {
        const mat = Array.isArray(object.material) ? object.material[group.materialIndex] : object.material;
        if (!mat || mat.visible === false || (mat.transparent && mat.opacity <= 0)) continue;
        const start = Math.max(drawStart, group.start), end = Math.min(drawEnd, group.start + group.count);
        for (let i = start; i + 2 < end; i += 3) {
          for (let j = i; j < i + 3; j++) range.push(sourceIndex ? sourceIndex.getX(j) : j);
        }
      }
      if (range.length) {
        // Compact unused vertices (e.g. a hidden material group) out of the bounds and worker payload.
        const remap = new Map(), vertices = [];
        const indices = Uint32Array.from(range, index => {
          if (!remap.has(index)) { remap.set(index, vertices.length); vertices.push(index); }
          return remap.get(index);
        });
        const count = object.isInstancedMesh ? object.count : 1;
        for (let k = 0; k < count; k++) {
          world.copy(object.matrixWorld);
          if (object.isInstancedMesh) { object.getMatrixAt(k, instance); world.multiply(instance); }
          const xyz = new Float64Array(vertices.length * 3);
          vertices.forEach((source, i) => {
            object.getVertexPosition(source, point).applyMatrix4(world);
            xyz[i*3] = point.x; xyz[i*3+1] = point.y; xyz[i*3+2] = point.z;
            for (let axis = 0; axis < 3; axis++) {
              const value = xyz[i*3 + axis];
              min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
            }
          });
          parts.push({xyz, indices});
        }
      }
    }
    for (const child of object.children) visit(child);
  }
  if (root) visit(root);
  if (!parts.length || !min.every(Number.isFinite) || !max.every(Number.isFinite)) {
    throw new Error('The visible project contains no drawable mesh.');
  }
  return {parts, bounds:{min, max}};
}

export function createModelDrawingSource(modelRoot) {
  if (!modelRoot) throw new Error('No project is available for drawing.');
  const {parts, bounds} = drawingMeshes(modelRoot);
  const workerURL = new URL('./drawing-worker.js?v=57e5af0c51', import.meta.url);
  const worker = new Worker(workerURL, {type:'module'});
  const buffers = new Set(parts.flatMap(part => [part.xyz.buffer, part.indices.buffer]));
  worker.postMessage({type:'init', parts, bounds}, [...buffers]);
  const cache = new Map();
  let busy = false, disposed = false, nextId = 0, current = null, queued = null;
  const abort = () => new DOMException('Drawing superseded.', 'AbortError');

  function start(job) {
    current = job; busy = true;
    worker.postMessage({type:'render', id:job.id, options:job.options});
  }
  function rejectAll(error) {
    current?.reject(error); queued?.reject(error);
    queued = null; current = null; busy = false;
  }
  worker.onmessage = ({data}) => {
    if (data.fatal) { rejectAll(new Error(data.fatal)); disposed = true; worker.terminate(); return; }
    if (!current || current.id !== data.id) return;
    if (data.error) current.reject(new Error(data.error));
    else {
      if (cache.size >= 5) cache.delete(cache.keys().next().value);
      cache.set(current.key, data.result);
      current.resolve(data.result);
    }
    current = null; busy = false;
    if (queued) { const waiting = queued; queued = null; start(waiting); }
  };
  worker.onerror = event => {
    rejectAll(new Error(event.message || 'The drawing worker failed.'));
    disposed = true; worker.terminate();
  };
  return {
    bounds,
    render(options = {}) {
      if (disposed) return Promise.reject(abort());
      const key = JSON.stringify(options);
      if (current?.key === key && !queued && !current.superseded) return current.promise;
      if (queued?.key === key) return queued.promise;
      if (current) { current.reject(abort()); current.superseded = true; }
      if (queued) { queued.reject(abort()); queued = null; }
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      const job = {id:++nextId, options, key};
      job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
      if (busy) queued = job; else start(job);
      return job.promise;
    },
    dispose() {
      disposed = true; worker.terminate(); rejectAll(abort()); cache.clear();
    },
  };
}
