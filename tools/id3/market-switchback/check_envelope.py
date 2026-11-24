"""Audit weather surfaces against the as-exported mass-timber model.

Run with Python, NumPy and SciPy:
    python check_envelope.py project.glb --all-structure --report clashes.json

Each connected convex member is clipped to the finite face of each actual roof,
PV panel, window or cladding panel. For roofs the test catches projecting and
fully exposed wood above a closed panel. For facades, monitors and soffits it
requires the same member to extend through both sides of the local panel.
A neighbouring external frame is not itself a clash. Millimetre tolerances
discard edge-only contacts and fabrication faces bearing on one another.
"""
import argparse
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
import json
from pathlib import Path
import struct

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import ConvexHull


ROOFS = {
    'Enclosure / Standing seam zinc and membrane', 'Energy / Roof daylight apertures',
    'Enclosure / Arcade solar canopy', 'Market / Folded zinc roof planes',
}
WALLS = {
    'Enclosure / Insulated folded cassettes', 'Enclosure / Vision lights in recessed frames',
    'Enclosure / Diffuse upper lights', 'Enclosure / North facing monitor vents',
}
SERVICE_WALLS = {
    'Enclosure / Service plinth insulated cassettes', 'Enclosure / Service plinth sealed joints',
    'Enclosure / Service plinth concrete curb', 'Enclosure / West stair insulated end wall',
    'Enclosure / Service plinth insulated slab edge', 'Enclosure / Service plinth pier base flashing',
    'Enclosure / Public foyer thermally broken frames',
}
SOFFITS = {'Enclosure / Faceted western soffit', 'Enclosure / Service-wing plinth soffit'}
PV = 'Blue-black photovoltaics'
STEP_FLASHING = 'Enclosure / Folded roof step flashing'


@dataclass
class Part:
    layer: str
    material: str
    serial: int
    v: np.ndarray
    faces: np.ndarray

    def __post_init__(self):
        self.lo = self.v.min(axis=0)
        self.hi = self.v.max(axis=0)
        self.center = self.v.mean(axis=0)
        self._planes = None

    def planes(self):
        """Half-spaces of the exported convex solid, with parallel triangles merged."""
        if self._planes is None:
            self._planes = np.unique(np.round(ConvexHull(self.v).equations, 8), axis=0)
        return self._planes


def read_parts(path, all_structure, extra_layers=(), *, all_layers=False):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    binary = memoryview(data)[28 + length:]

    def read(index):
        accessor = doc['accessors'][index]
        view = doc['bufferViews'][accessor['bufferView']]
        width = 3 if accessor['type'] == 'VEC3' else 1
        dtype = np.dtype({5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[accessor['componentType']])
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', width * dtype.itemsize)
        return np.ndarray(
            (accessor['count'], width), dtype=dtype, buffer=binary,
            offset=offset, strides=(stride, dtype.itemsize),
        )

    for node in doc['nodes']:
        if any(k in node for k in ('matrix', 'translation', 'rotation', 'scale', 'children')):
            raise ValueError('Expected registered untransformed model nodes')
        layer = node['extras']['layer']
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            material = doc['materials'][primitive['material']]['name']
            timber = any(s in material.casefold() for s in ('glulam', 'clt', 'laminated timber'))
            weather = (
                layer in ROOFS | WALLS | SERVICE_WALLS | SOFFITS
                or layer == STEP_FLASHING
                or material == PV
                or (layer == 'Market / Operable northlight vents' and 'glass' in material)
            )
            member = timber or (all_structure and layer.startswith('Structure /'))
            if not (all_layers or member or weather or layer in extra_layers):
                continue

            # Undo site registration. Local U points east, V south, height up (metres).
            vertices = read(primitive['attributes']['POSITION'])[:, [0, 2, 1]].astype(float)
            vertices[:, 0] += 82.906
            faces = read(primitive['indices']).reshape(-1, 3).astype(int)
            edges = np.concatenate((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
            graph = csr_matrix((np.ones(len(edges)), edges.T), (len(vertices), len(vertices)))
            _, group = connected_components(graph, directed=False)
            vertex_groups = grouped_indices(group)
            face_groups = grouped_indices(group[faces[:, 0]])
            for serial, (vi, fi) in enumerate(zip(vertex_groups, face_groups, strict=True)):
                yield Part(
                    layer, material, serial, vertices[vi], np.searchsorted(vi, faces[fi])
                ), member, weather


def grouped_indices(labels):
    order = np.argsort(labels, kind='stable')
    breaks = np.flatnonzero(np.diff(labels[order])) + 1
    return np.split(order, breaks)


def face_planes(panel, roof):
    """Finite convex polygon faces; retain both top faces on any folded roof."""
    faces = panel.v[panel.faces]
    normals = np.cross(faces[:, 1] - faces[:, 0], faces[:, 2] - faces[:, 0])
    areas = np.linalg.norm(normals, axis=1)
    normals /= areas[:, None]
    normals *= np.sign(np.sum(normals * (faces[:, 0] - panel.center), axis=1))[:, None]
    if roof or panel.layer in SOFFITS:
        eligible = normals[:, 2] > .65
    else:
        eligible = abs(normals[:, 2]) < .55
        # Either orientation can define a through-condition; keep one broad side.
        eligible &= np.where(
            abs(normals[:, 0]) > abs(normals[:, 1]), normals[:, 0] > 0, normals[:, 1] > 0
        )
    candidates = np.flatnonzero(eligible)
    if not len(candidates):
        raise RuntimeError(f'No weather face found on {panel.layer} {panel.serial}')
    if not roof:
        candidates = [candidates[np.argmax(areas[candidates])]]

    used = []
    for index in candidates:
        normal = normals[index]
        offset = normal @ faces[index, 0]
        if any(np.dot(normal, n) > .999999 and abs(offset - h) < .0001 for n, h in used):
            continue
        used.append((normal, offset))
        vertices = panel.v[np.abs(panel.v @ normal - offset) < .0001]
        if len(vertices) < 3:
            raise ValueError(panel.layer)
        if roof:
            # Vertical projection compares heights at the same point in plan.
            # Orthogonal projection onto sloping roofs can wrap around a clerestory.
            basis = np.eye(3)[:2]
        else:
            across = np.cross(normal, (1, 0, 0) if abs(normal[0]) < .85 else (0, 1, 0))
            across /= np.linalg.norm(across)
            basis = np.array([across, np.cross(normal, across)])
        outline = ConvexHull(vertices @ basis.T).equations
        edges = np.column_stack([outline[:, :2] @ basis, outline[:, 2]])
        yield normal, offset, edges


@lru_cache(maxsize=32)
def plane_triples(count):
    return np.array(list(combinations(range(count), 3)))


def extrema(part, boundary, normal):
    """Clip a convex member to the panel footprint and find both depth extremes.

    Every corner of this bounded intersection lies on a triple of independent
    planes. Enumerating triples handles thin plates, coincident lines and
    edge contact without an optimizer's feasibility heuristics.
    """
    if np.all(part.v @ boundary[:, :3].T + boundary[:, 3] <= 1e-8):
        vertices = part.v
    else:
        constraints = np.concatenate([boundary, part.planes()])
        triples = constraints[plane_triples(len(constraints))]
        matrices = triples[:, :, :3]
        use = np.abs(np.linalg.det(matrices)) > 1e-9
        if not use.any():
            return None
        solved = np.linalg.solve(matrices[use], -triples[use, :, 3, None])[:, :, 0]
        feasible = np.all(solved @ constraints[:, :3].T + constraints[:, 3] <= 2e-7, axis=1)
        vertices = solved[feasible]
        if not len(vertices):
            return None
    distances = vertices @ normal
    low, high = distances.argmin(), distances.argmax()
    return (distances[low], vertices[low]), (distances[high], vertices[high])


def is_roof(skin):
    if skin.layer != STEP_FLASHING:
        return skin.layer in ROOFS or skin.material == PV
    # The same flashing batch contains sloped caps and vertical returns.
    triangles = skin.v[skin.faces]
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    broad_face = normals[np.argmax(np.linalg.norm(normals, axis=1))]
    return abs(broad_face[2]) > .65 * np.linalg.norm(broad_face)


def check(model, tol, all_structure=False):
    if tol < 0:
        raise ValueError('Tolerance must be non-negative')
    members, skins = [], []
    for part, member, weather in read_parts(model, all_structure):
        if member:
            members.append(part)
        if weather:
            skins.append(part)
    found = Counter(p.layer for p in skins)
    if not members or not (ROOFS | WALLS).issubset(found) or not any(p.material == PV for p in skins):
        raise ValueError('Missing timber members or expected roof, glass, wall or PV layer')

    low = np.array([p.lo for p in members])
    high = np.array([p.hi for p in members])
    hits = []
    for skin in skins:
        roof = is_roof(skin)
        # For roof surfaces include disconnected members completely above the skin.
        axes = slice(0, 2 if roof else 3)
        overlap = np.all(
            (high[:, axes] > skin.lo[axes] + tol) & (low[:, axes] < skin.hi[axes] - tol),
            axis=1,
        )
        overlap &= high[:, 2] > skin.lo[2] + tol
        for normal, outer, edges in face_planes(skin, roof):
            boundary = np.array(edges)
            boundary[:, 3] += tol  # erode the finite footprint in-plane
            inner = (skin.v @ normal).min()
            for index in np.flatnonzero(overlap):
                part = members[index]
                depth = part.v @ normal
                if depth.max() <= outer + tol or (not roof and depth.min() >= inner - tol):
                    continue
                extent = extrema(part, boundary, normal)
                if extent is None:
                    continue
                (lower, inside_point), (upper, outside_point) = extent
                if upper <= outer + tol or (not roof and lower >= inner - tol):
                    continue

                magnitude = (upper - outer) / normal[2] if roof else upper - outer
                witness = outside_point
                if not roof and inner - lower < magnitude:
                    magnitude = inner - lower
                    witness = inside_point
                hits.append({
                    'member': part.layer, 'member_index': part.serial,
                    'skin': skin.layer, 'panel_index': skin.serial,
                    'penetration_m': round(float(magnitude), 4),
                    'skin_center': np.round(skin.center, 3).tolist(),
                    'point': np.round(witness, 3).tolist(),
                })
    return {
        'scope': 'all Structure layers and mass timber' if all_structure else 'mass timber',
        'tested_members': len(members),
        'tested_weather_panels': len(skins),
        'weather_panels_by_layer': dict(found),
        'tolerance_m': tol,
        'pair_count': len(hits),
        'pairs': hits,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--tolerance-mm', type=float, default=2.)
    parser.add_argument(
        '--all-structure', action='store_true',
        help='Also test non-timber Structure layers such as concrete and steel collectors',
    )
    args = parser.parse_args()
    report = check(args.model, args.tolerance_mm / 1000, args.all_structure)
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(
        f"{report['tested_members']} {report['scope']} parts and "
        f"{report['tested_weather_panels']} weather panels; {report['pair_count']} intersections."
    )
    for pair, count in Counter((h['skin'], h['member']) for h in report['pairs']).most_common():
        print(count, *pair, sep=' | ')
    return bool(report['pairs'])


if __name__ == '__main__':
    raise SystemExit(main())
