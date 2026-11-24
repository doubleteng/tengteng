"""Reopen the exported case GLB and validate every indexed shell and parcel vertex.

Run with Python, NumPy and SciPy:
    python check_topology.py project.glb --report topology.json
"""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

import numpy as np

from check_envelope import read_parts


def invalid_vertex_links(faces):
    """On a closed 2-manifold the triangles around every vertex form one ring."""
    links = defaultdict(list)
    for a, b, c in faces:
        links[a].append((b, c))
        links[b].append((c, a))
        links[c].append((a, b))
    invalid = 0
    for link_edges in links.values():
        adjacent = defaultdict(list)
        for a, b in link_edges:
            adjacent[a].append(b)
            adjacent[b].append(a)
        if len(adjacent) < 3 or any(len(neighbours) != 2 for neighbours in adjacent.values()):
            invalid += 1
            continue
        start = next(iter(adjacent))
        visited = {start}
        previous, vertex = start, adjacent[start][0]
        while vertex not in visited:
            visited.add(vertex)
            left, right = adjacent[vertex]
            previous, vertex = vertex, left if left != previous else right
        if vertex != start or len(visited) != len(adjacent):
            invalid += 1
    return invalid


def audit(path):
    counts = Counter()
    problems = []
    batches = set()
    min_area = min_volume = float('inf')
    for part, _, _ in read_parts(path, False, all_layers=True):
        counts['parts'] += 1
        counts['triangles'] += len(part.faces)
        counts['vertices'] += len(part.v)
        batches.add((part.layer, part.material))
        errors = {}
        vertices = part.v
        faces = part.faces.tolist()
        directed = Counter(edge for a, b, c in faces for edge in ((a, b), (b, c), (c, a)))
        paired = Counter()
        for (a, b), count in directed.items():
            paired[min(a, b), max(a, b)] += count
        errors['boundary_edges'] = sum(n == 1 for n in paired.values())
        errors['nonmanifold_edges'] = sum(n > 2 or a == b for (a, b), n in paired.items())
        errors['inconsistent_edge_winding'] = sum(
            n == 2 and directed[a, b] != directed[b, a] for (a, b), n in paired.items()
        )
        errors['nonmanifold_vertices'] = invalid_vertex_links(faces)
        errors['nonfinite_vertices'] = np.count_nonzero(~np.isfinite(vertices).all(axis=1))

        # Signed volume is evaluated in the exported right-handed Y-up basis;
        # local east/south/height (used for the parcel) reverses the handedness.
        points = vertices[:, [0, 2, 1]]
        triangles = (points - points.mean(axis=0))[part.faces]
        normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        areas = .5 * np.linalg.norm(normals, axis=1)
        volume = float(np.sum(triangles[:, 0] * normals) / 6)
        errors['degenerate_or_nonfinite_triangles'] = np.count_nonzero(
            (areas <= 5e-10) | ~np.isfinite(areas)
        )
        errors['nonpositive_or_nonfinite_volume_parts'] = int(not np.isfinite(volume) or volume <= 1e-10)
        min_area = min(min_area, float(areas.min()))
        min_volume = min(min_volume, volume)

        # Registered survey board, with a 1 mm allowance for parcel-boundary vertices.
        east, south = vertices[:, 0], vertices[:, 1]
        east_limit = 82.906 - 40.5383 * south / 57.912
        outside = (east < -.001) | (south < -.001) | (south > 57.913) | (east > east_limit + .001)
        errors['parcel_outlier_vertices'] = np.count_nonzero(outside)
        counts.update({key: int(value) for key, value in errors.items()})
        if any(errors.values()):
            problems.append({
                'layer': part.layer, 'material': part.material, 'part': part.serial,
                'errors': {key: int(value) for key, value in errors.items() if value},
            })

    if not counts['parts']:
        raise ValueError('No solids found in exported model')
    return {
        **counts, 'batches': len(batches), 'smallest_triangle_area_m2': min_area,
        'smallest_signed_volume_m3': min_volume, 'failed_parts': len(problems),
        'problems': problems,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = audit(args.model)
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'problems'}, indent=2))
    return bool(report['failed_parts'])


if __name__ == '__main__':
    raise SystemExit(main())
