"""Bake ambient visibility for the three registered district GLBs.
Run: blender -b --python bake_district.py -- path/to/teaching/id3/models
The output is keyed by glTF mesh and primitive; source GLBs are never rewritten.
"""
import gzip
import json
import math
from pathlib import Path
import struct
import sys
from collections import defaultdict

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

SAMPLES = 32
DIRECTIONS = []
for i in range(SAMPLES):
    z = math.sqrt((i + .5) / SAMPLES)
    r = math.sqrt(1 - z*z)
    phi = i * math.pi * (3 - math.sqrt(5))
    DIRECTIONS.append((r * math.cos(phi), r * math.sin(phi), z))


def read_batches(path):
    raw = path.read_bytes()
    end = 20 + struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:end])
    data = memoryview(raw)[end + 8:]

    def array(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        dtype = np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        width = {'SCALAR':1,'VEC3':3}[a['type']]
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.ndarray((a['count'], width), dtype, data, offset,
                          (v.get('byteStride', width*dtype.itemsize), dtype.itemsize))

    batches = defaultdict(list)
    for node in doc['nodes']:
        meta = node.get('extras', {})
        if 'mesh' not in node or meta.get('initialHidden') or meta.get('groundSurface'):
            continue
        if any(k in node for k in ('matrix','translation','rotation','scale','children')):
            raise ValueError('Bake expects registered geometry in district coordinates')
        for j, p in enumerate(doc['meshes'][node['mesh']]['primitives']):
            if p.get('mode', 4) != 4:
                continue
            attrs = p['attributes']
            pos = array(attrs['POSITION'])
            tri = (array(p['indices']).astype(np.int32) if 'indices' in p else np.arange(len(pos))).reshape(-1,3)
            normal = array(attrs['NORMAL']) if 'NORMAL' in attrs else None
            mat = doc['materials'][p['material']]
            batches[meta['layer']].append((node['mesh'],j,pos,tri,normal,mat.get('alphaMode') != 'BLEND'))
    return batches


def bake_layer(parts, radius):
    vertices, triangles = [], []
    for _, _, pos, faces, _, opaque in parts:
        if opaque:
            triangles.extend((faces + len(vertices)).tolist())
            vertices.extend(pos.tolist())
    if not triangles:
        return
    tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    memo = {}
    for mesh, prim, pos, faces, normal, _ in parts:
        if normal is None:
            normal = np.zeros_like(pos)
            cross = np.cross(pos[faces[:,1]] - pos[faces[:,0]], pos[faces[:,2]] - pos[faces[:,0]])
            for col in faces.T:
                np.add.at(normal, col, cross)
        # Coarse walls can span an entire block with two triangles. A corner
        # sample cannot describe the middle of such a face; limit its contrast.
        span = np.zeros(len(pos))
        length = np.maximum.reduce([np.linalg.norm(pos[faces[:,i]]-pos[faces[:,(i+1)%3]],axis=1) for i in range(3)])
        for col in faces.T:
            np.maximum.at(span, col, length)
        values = np.full(len(pos), 255, dtype=np.uint8)
        # Several split primitives share accessors; sample only referenced vertices.
        for idx in np.unique(faces):
            point, n = Vector(pos[idx]), Vector(normal[idx])
            if n.length_squared < 1e-10:
                continue
            n.normalize()
            key = tuple(round(x, 4) for x in (*point,*n))
            if key not in memo:
                tangent = n.cross(Vector((1,0,0) if abs(n.x)<.8 else (0,0,1))).normalized()
                bitangent = n.cross(tangent)
                origin = point + .023*n
                blocked = 0.
                for x,y,z in DIRECTIONS:
                    distance = tree.ray_cast(origin, tangent*x + bitangent*y + n*z, radius)[3]
                    if distance is not None:
                        blocked += (1 - distance/radius)**1.5
                visibility = max(.38, 1 - .79*blocked/SAMPLES - .10*max(0,-n.y))
                memo[key] = round(255*visibility)
            confidence = min(1., radius*1.35/max(.001, span[idx]))
            values[idx] = 255 - round((255-memo[key])*confidence)
        if values.min() < 252:
            yield mesh, prim, values


def bake(path):
    chunks = []
    for layer, parts in read_batches(path).items():
        chunks.extend(bake_layer(parts, 1.25 if layer == 'Street trees' else 3.25))
    blob = bytearray(b'IDA1' + struct.pack('<I', len(chunks)))
    for mesh, prim, values in chunks:
        blob.extend(struct.pack('<III', mesh, prim, len(values)))
        blob.extend(values.tobytes())
    output = path.with_suffix('.ambient.gz')
    output.write_bytes(gzip.compress(bytes(blob), compresslevel=9, mtime=0))
    print(path.stem, len(chunks), len(blob), output.stat().st_size, flush=True)


if __name__ == '__main__':
    folder = Path(sys.argv[sys.argv.index('--') + 1])
    for name in ('urban-core-materials', 'urban-near', 'urban-outer'):
        bake(folder / (name + '.glb'))
