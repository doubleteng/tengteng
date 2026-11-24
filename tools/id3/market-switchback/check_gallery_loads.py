"""Vertical reactions from the upper public walk for the teaching case.
Run with python check_gallery_loads.py model.glb [report.json].
"""
import json
from pathlib import Path
import sys

import numpy as np

from check_envelope import read_parts
from check_shell import DECK_DEAD, DECK_LIVE, WEST, EAST, X, load_vector


SIDE = {
    'South overlook ramp': 'south',
    'North learning gallery': 'north',
    'Studios threshold': 'north',
    'Studios entrance': 'north',
    'Fourth Avenue belvedere': 'west',
    'West corner landings': 'west',
}


def exterior_walk(model):
    # Integration over horizontal projection. Each trapezoid is a closed solid.
    # For a sloped deck, take only the top surface, correcting winding to outward.
    area = {name: 0. for name in SIDE}
    north, south = 1.65, 18.35
    support_x = X[[WEST, EAST]]
    bearing_area = np.zeros((2, 2))  # [north/south, west/east principal bearing]
    west_frame_area = np.zeros(2)  # West face and first inboard frame.
    first_moment_x = 0.
    west_first_moment_x = 0.
    for part, _, _ in read_parts(model, False, {'Circulation / '+s for s in SIDE}):
        layer = part.layer.removeprefix('Circulation / ')
        if layer not in SIDE:
            continue
        for face in part.v[part.faces]:
            normal = np.cross(face[1]-face[0], face[2]-face[0])
            if normal@(face.mean(axis=0)-part.center)<0:
                normal *= -1
            if normal[2] <= 1.e-8:
                continue
            projected = normal[2]/2
            area[layer] += projected
            # Three-point triangle rule integrates the bilinear x/y split exactly.
            for i in range(3):
                x, y = ((3*face[i]+face.sum(axis=0))/6)[:2]
                dA = projected/3
                fraction = (y-north)/(south-north)
                if SIDE[layer] == 'west':
                    planes = np.array([1-fraction, fraction])
                    rear = (x-X[0])/(X[1]-X[0])
                    west_first_moment_x += dA*x
                    west_frame_area += dA*np.array([1-rear,rear])
                else:
                    planes = np.array([1.,0.]) if SIDE[layer]=='north' else np.array([0.,1.])
                east = (x-support_x[0])/(support_x[1]-support_x[0])
                bearing_area += dA*np.outer(planes,[1-east,east])
                first_moment_x += dA*x
    assert all(value>0 for value in area.values()), 'Missing walking surface'
    assert np.isclose(bearing_area.sum(),sum(area.values()))
    assert np.isclose(bearing_area.sum(axis=0)@support_x, first_moment_x)
    west_area = sum(v for k, v in area.items() if SIDE[k] == 'west')
    assert np.isclose(west_frame_area.sum(), west_area)
    assert np.isclose(west_frame_area@X[:2], west_first_moment_x)
    # Re-use the pin/roller benchmark for the two-deck reference pressure.
    original = -load_vector('full')[1::2].reshape(2,len(X)).sum(axis=0)/1000
    east = original@(X-support_x[0])/(support_x[1]-support_x[0])
    base = np.array([original.sum()-east,east])
    pressure = (DECK_DEAD+DECK_LIVE)/1000
    def pair(a):
        return {key:round(float(n),2) for key,n in zip(('west','east'),a)}
    return {
        'model_basis': 'Horizontal projected area of the three upper flights, both corner landings and upper studio threshold/link, measured from the loaded GLB.',
        'assumptions': 'One fully occupied walk at the same 2.70 kPa dead and 4.80 kPa live study pressures as the main decks. North and south flights load their adjoining truss. The west return and both corner landings are taken wholly by its transverse frames for this comparison. Their supports divide load by transverse position. Sign convention is positive downward on the supporting member.',
        'limits': 'Gravity reaction comparison only. Local connection strength and stiffness, eccentric torque, railing loads, snow, wind, vibration and foundation design require separate engineering.',
        'projected_area_m2': {k:round(v,3) for k,v in area.items()},
        'total_area_m2': round(sum(area.values()),3),
        'added_vertical_kN': round(sum(area.values())*pressure,2),
        'west_return_frame_reactions_kN': {
            'outer_frame_at_x_2_60': round(west_frame_area[0]*pressure,2),
            'backspan_at_x_6_20': round(west_frame_area[1]*pressure,2)},
        'full_load_reference_kN_per_truss':pair(base),
        'additional_principal_bearing_kN':{k:pair(row*pressure) for k,row in zip(('north','south'),bearing_area)},
        'combined_full_load_principal_bearing_kN':{k:pair(base+row*pressure) for k,row in zip(('north','south'),bearing_area)},
    }


if __name__ == '__main__':
    report = json.dumps(exterior_walk(Path(sys.argv[1])),indent=2,allow_nan=False)+'\n'
    if len(sys.argv)>2:
        Path(sys.argv[2]).write_text(report)
    else:
        print(report,end='')
