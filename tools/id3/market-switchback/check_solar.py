"""Estimate PV energy after local obstruction shading on the actual gallery meshes.

blender -b -P check_solar.py -- MODEL.glb --city-dir PATH/TO/models \
    --weather-dir /tmp/id3-pvwatts --output solar.json

The weather cache is populated by the official PVWatts v8 API on first use.
Set PVWATTS_API_KEY to use a personal NLR developer key. Source GLBs use metres,
Y up and contain their registered world coordinates with no node transforms.
"""
import argparse
import calendar
from collections import defaultdict
import json
import math
import os
from pathlib import Path
import struct
import sys
import urllib.parse
import urllib.request

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


LAT = 42.283917
LON = -83.746722
NORTH_OFFSET = -2.25147  # Model azimuth = true azimuth + gallery registration.
CITY_FILES = ['urban-core-materials.glb', 'urban-near.glb', 'urban-outer.glb']
API = 'https://developer.nlr.gov/api/pvwatts/v8.json'


def geometry(path):
    blob = path.read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    doc = json.loads(blob[20:20 + size])
    payload = memoryview(blob)[28 + size:]
    scalar = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}

    def accessor(index):
        a = doc['accessors'][index]
        view = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        dtype = np.dtype(scalar[a['componentType']])
        return np.ndarray((a['count'], width), dtype=dtype, buffer=payload,
                          offset=view.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))

    for node in doc['nodes']:
        if node.get('extras', {}).get('initialHidden', False) or 'mesh' not in node:
            continue
        if any(k in node for k in ('matrix', 'translation', 'rotation', 'scale')):
            raise ValueError(f'{path}: transformed geometry requires world-space conversion.')
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                continue
            points = accessor(primitive['attributes']['POSITION'])
            indices = accessor(primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(points))
            mat = doc['materials'][primitive['material']].get('name', '') if 'material' in primitive else ''
            yield mat, points, indices.reshape(-1, 3)


def module_tops(vertices, faces):
    # In each closed plate, only the two broad triangles of its upper surface
    # share an edge and face up. Join them by actual indices, irrespective of
    # the order of vertices or triangles in the exported GLB.
    pts = vertices[faces].astype(float)
    normals = np.cross(pts[:, 1] - pts[:, 0], pts[:, 2] - pts[:, 0])
    areas2 = np.linalg.norm(normals, axis=1)
    mask = (normals[:, 1] > areas2 * 0.65) & (areas2 > 0.1)
    top_faces = faces[mask]
    point_faces = defaultdict(list)
    for i, face in enumerate(top_faces):
        for vertex in face:
            point_faces[int(vertex)].append(i)
    pending = set(range(len(top_faces)))
    while pending:
        stack = [pending.pop()]
        corners = set()
        while stack:
            for vertex in top_faces[stack.pop()]:
                corners.add(int(vertex))
                for j in point_faces[int(vertex)]:
                    if j in pending:
                        pending.remove(j)
                        stack.append(j)
        if len(corners) != 4:
            raise ValueError(f'PV upper surface has {len(corners)} corners. Review plate construction.')
        corners = vertices[sorted(corners)].astype(float)
        normal = np.cross(corners[1] - corners[0], corners[2] - corners[0])
        normal /= np.linalg.norm(normal)
        if normal[1] < 0:
            normal *= -1
        center = corners.mean(axis=0)
        tilt = math.degrees(math.acos(np.clip(normal[1], -1, 1)))
        az = (math.degrees(math.atan2(normal[0], -normal[2])) - NORTH_OFFSET) % 360 if tilt > .1 else 180
        yield center, corners, normal, (round(tilt * 2) / 2, round(az) % 360)


def weather(cache_dir, tilt, az):
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / f'{tilt:g}_{az:g}.json'
    if not path.exists():
        parameters = dict(api_key=os.environ.get('PVWATTS_API_KEY', 'DEMO_KEY'), system_capacity=1,
                          azimuth=az, tilt=tilt, module_type=0, losses=14, array_type=1,
                          timeframe='hourly', lat=LAT, lon=LON, gcr=.4)
        url = API + '?' + urllib.parse.urlencode(parameters)
        with urllib.request.urlopen(url, timeout=45) as response:
            result = json.load(response)
        if result.get('errors') or len(result['outputs']['ac']) != 8760:
            raise ValueError(result.get('errors', 'Expected 8760 PVWatts hourly samples'))
        result['inputs'].pop('api_key', None)
        path.write_text(json.dumps(result, separators=(',', ':')))
    return json.loads(path.read_text())


def solar_hours(tz):
    """NOAA fractional-year solar position, mid-hour in local standard time."""
    h = np.arange(8760) % 24 + .5
    day = np.arange(8760) // 24 + 1
    gamma = 2 * np.pi / 365 * (day - 1 + (h - 12) / 24)
    eq = 229.18 * (.000075 + .001868 * np.cos(gamma) - .032077 * np.sin(gamma)
                   - .014615 * np.cos(2 * gamma) - .040849 * np.sin(2 * gamma))
    dec = (.006918 - .399912 * np.cos(gamma) + .070257 * np.sin(gamma)
           - .006758 * np.cos(2 * gamma) + .000907 * np.sin(2 * gamma)
           - .002697 * np.cos(3 * gamma) + .00148 * np.sin(3 * gamma))
    hour_angle = np.radians((60 * h + eq + 4 * LON - 60 * tz) / 4 - 180)
    lat = math.radians(LAT)
    east = -np.cos(dec) * np.sin(hour_angle)
    up = math.sin(lat) * np.sin(dec) + math.cos(lat) * np.cos(dec) * np.cos(hour_angle)
    north = math.cos(lat) * np.sin(dec) - math.sin(lat) * np.cos(dec) * np.cos(hour_angle)
    heading = np.arctan2(east, north) + math.radians(NORTH_OFFSET)
    horizontal = np.hypot(east, north)
    return np.column_stack((horizontal * np.sin(heading), up, -horizontal * np.cos(heading)))


def sky_directions(normal, count):
    """Deterministic cosine-weighted hemisphere sequence in the panel frame."""
    normal = np.asarray(normal)
    tangent = np.cross(normal, [0., 0., 1.])
    tangent /= np.linalg.norm(tangent)
    bitangent = np.cross(normal, tangent)
    upper = []
    for i in range(count):
        r = math.sqrt((i + .5) / count)
        angle = i * math.pi * (3 - math.sqrt(5))
        direction = tangent * (r * math.cos(angle)) + bitangent * (r * math.sin(angle)) + normal * math.sqrt(1 - r*r)
        if direction[1] > 0:
            upper.append(Vector(direction))
    return upper


def zone(center):
    if center[2] < 25:
        return 'civic'
    if center[2] < 36.146:
        return 'market north'
    if center[2] < 46.892:
        return 'market middle'
    return 'market south'


def build_bvh(model, city_dir, samples):
    points, triangles, arrays = [], [], defaultdict(list)
    scene_counts = {}
    for p in [model] + [city_dir / name for name in CITY_FILES]:
        prev_count = len(triangles)
        for mat, verts, faces in geometry(p):
            if p == model and 'photovoltaic' in mat.casefold():
                for center, corners, normal, orientation in module_tops(verts, faces):
                    # A 20 mm normal offset clears the module itself, never a parapet.
                    sites = [center] if samples == 1 else center + (corners - center) * .5
                    probes = [Vector(v + normal * .02) for v in sites]
                    arrays[(zone(center), *orientation)].append((probes, normal))
            # Any point visible above the low roof can shade it. Do not discard
            # trees, other arrays, glass canopies or lower neighbouring terrain.
            triangles.extend((faces + len(points)).tolist() if faces.dtype.itemsize >= 4
                             else (faces.astype('i8') + len(points)).tolist())
            points.extend(verts.tolist())
        scene_counts[p.name] = len(triangles) - prev_count
    if not arrays:
        raise ValueError('No roof PV modules found in the project GLB')
    return BVHTree.FromPolygons(points, triangles, all_triangles=True), arrays, scene_counts


def visibility(bvh, probes, direction):
    return sum(bvh.ray_cast(p, direction)[0] is not None for p in probes) / len(probes)


def evaluate(bvh, groups, options):
    summaries = []
    calendar_days = np.repeat(np.arange(365), 24)
    for (name, tilt, az), modules in sorted(groups.items()):
        data = weather(options.weather_dir, tilt, az)
        w = data['outputs']
        directions = solar_hours(float(data['station_info']['tz']))
        normal = np.mean([item[1] for item in modules], axis=0)
        normal /= np.linalg.norm(normal)
        probes = [p for module, _ in modules for p in module]
        count = len(modules)
        # Weight shaded irradiance by AC, respecting temperature and inverter
        # behaviour in the unshaded baseline. This remains a linear shade model.
        ac = np.asarray(w['ac']) / 1000 * count * options.module_kw
        beam_poa = np.asarray(w['dn']) * np.maximum(directions @ normal, 0)
        beam_poa[directions[:, 1] <= 0] = 0
        ratio = np.clip(beam_poa / np.maximum(np.asarray(w['poa']), 1e-6), 0, 1)
        beam = ac * ratio
        diffuse = ac - beam
        sky = sky_directions(normal, options.sky_directions)
        diffuse_obstruction = np.mean([visibility(bvh, probes, d) for d in sky])
        months = []
        first_day = 0
        bin_count = 0
        for month in range(1, 13):
            days = calendar.monthrange(2021, month)[1]
            mask = (calendar_days >= first_day) & (calendar_days < first_day + days)
            direct_loss = 0.
            for start in range(first_day, first_day + days, options.days_per_bin):
                end = min(first_day + days, start + options.days_per_bin)
                for hour in range(24):
                    ix = np.arange(start * 24 + hour, end * 24, 24)
                    weights = beam[ix]
                    if weights.sum() < 1e-9:
                        continue
                    ray = np.sum(directions[ix] * weights[:, None], axis=0)
                    ray /= np.linalg.norm(ray)
                    direct_loss += weights.sum() * visibility(bvh, probes, Vector(ray))
                    bin_count += 1
            monthly_ac = ac[mask].sum()
            diffuse_loss = diffuse[mask].sum() * diffuse_obstruction
            months.append(dict(month=month, open_kwh=round(monthly_ac, 2),
                               beam_loss_kwh=round(direct_loss, 2),
                               diffuse_loss_kwh=round(diffuse_loss, 2),
                               shaded_kwh=round(monthly_ac - direct_loss - diffuse_loss, 2)))
            first_day += days
        summaries.append(dict(zone=name, panels=count, kwdc=round(count * options.module_kw, 3),
                              tilt_deg=tilt, true_azimuth_deg=az, unshaded_yield_kwh_per_kw=round(w['ac_annual'], 3),
                              sky_obstruction_pct=round(100 * diffuse_obstruction, 3),
                              sun_directions=bin_count, weather=data['station_info']['weather_data_source'],
                              weather_station=data['station_info']['location'], months=months))
    return summaries


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    parser.add_argument('--city-dir', type=Path)
    parser.add_argument('--weather-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--module-kw', type=float, default=.520)
    parser.add_argument('--samples', type=int, choices=[1, 4], default=4)
    parser.add_argument('--days-per-bin', type=int, default=10)
    parser.add_argument('--sky-directions', type=int, default=128)
    args = parser.parse_args(argv)
    if args.days_per_bin < 1 or args.sky_directions < 8 or args.module_kw <= 0:
        parser.error('Positive bin duration and module capacity and at least eight sky directions required.')
    bvh, groups, triangles = build_bvh(args.model, args.city_dir or args.model.parent, args.samples)
    zones = evaluate(bvh, groups, args)
    months = []
    for i in range(12):
        months.append({k: round(sum(z['months'][i][k] for z in zones), 2)
                       for k in ('open_kwh', 'beam_loss_kwh', 'diffuse_loss_kwh', 'shaded_kwh')})
        months[-1]['month'] = i + 1
    yearly = {k: round(sum(m[k] for m in months), 1)
              for k in ('open_kwh', 'beam_loss_kwh', 'diffuse_loss_kwh', 'shaded_kwh')}
    yearly['local_loss_pct'] = round(100 * (1 - yearly['shaded_kwh'] / yearly['open_kwh']), 2)
    result = dict(method='PVWatts v8 hourly AC, fixed roof, 14% assumed other losses. '
                  'Beam weighted by DNI times incidence / POA, residual irradiance treated as isotropic diffuse; '
                  'area-linear shade response. Visible city meshes, including trees and glazing, are opaque all year. '
                  'No electrical string mismatch or explicit seasonal snow-cover model; conceptual estimate.',
                  latitude=LAT, longitude=LON, true_north_offset_degrees=NORTH_OFFSET,
                  module_kwp=args.module_kw, surface_samples_per_panel=args.samples,
                  max_days_per_time_bin=args.days_per_bin, sky_directions=args.sky_directions,
                  triangles=triangles, panels=sum(z['panels'] for z in zones), zones=zones, monthly=months, annual=yearly)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(panels=result['panels'], **yearly), indent=2))


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
