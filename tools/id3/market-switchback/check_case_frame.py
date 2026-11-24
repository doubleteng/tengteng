"""Verify primary timber continuity and the support chains at remodeled stair openings.

Checks the exported solids and contact patches. This study describes the modeled
load path and does not determine member or connection design resistance.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

from check_envelope import read_parts
from check_gallery import bearing_area, touch

S = 'Structure / '
MAIN = ('Glulam posts', 'Glulam chords', 'Glulam Warren webs', 'Glulam bearing columns',
        'Primary bearing pedestals', 'Steel node seats', 'Hold-down shoes', 'Indicative pile caps',
        'Drilled shaft heads')


def structural_parts(model):
    layers = defaultdict(list)
    for part, _, _ in read_parts(model, True, all_layers=True):
        if part.layer.startswith(S):
            layers[part.layer.removeprefix(S)].append(part)
    return layers


def signature(parts):
    return sorted(tuple(sorted(tuple(v) for v in np.round(p.v, 5))) for p in parts)


def audit(model, reference=None):
    groups = structural_parts(model)
    if reference:
        previous = structural_parts(reference)
        for name in MAIN:
            assert signature(groups[name]) == signature(previous[name]), f'Changed primary member geometry in {name}'
    for name, count in zip(MAIN, (32,40,30,4,4,4,4,4,16)):
        assert len(groups[name]) == count, f'Missing primary frame solids in {name}'
    # Follow the timber column and both of its actual bearing connections to the pile cap.
    for post in groups['Glulam bearing columns']:
        pedestal, shoe, cap, seat = [min(groups[name],key=lambda p: np.linalg.norm(p.center[:2]-post.center[:2]))
            for name in ('Primary bearing pedestals', 'Hold-down shoes', 'Indicative pile caps','Steel node seats')]
        assert all(touch(a,b) for a,b in ((cap,pedestal),(pedestal,shoe),(shoe,post),(post,seat)))
        assert any(touch(seat,upper) for upper in groups['Glulam posts'])
        assert sum(touch(cap,p) for p in groups['Drilled shaft heads']) == 4
    girders = groups['Glulam floor girders'] + groups['Forum and court cross girders'] + groups['Glulam roof girders']
    cores = groups['Concrete stair cores']
    mats = groups['Core foundation mats'] + groups['Core to pile cap step']
    floors = groups['Lower-ground slab']
    def ground_panels(xy):
        return [p for p in floors if np.all(p.lo[:2]<=xy+.001) and np.all(p.hi[:2]>=xy-.001)]
    assert len(groups['Core beam seats']) == 10
    stair_bearings=lift_bearings=0
    [pit]=groups['Freight lift pit floor']
    minimum_bearing = 1.
    lintel_supports = 0
    for seat in groups['Core beam seats']:
        supported = [p for p in girders if abs(p.lo[2]-seat.hi[2])<.001 and touch(p,seat)]
        assert len(supported)==1, f'Unseated girder at {seat.center}'
        area = bearing_area(seat,supported[0])
        assert area >= .085, f'Insufficient modeled seat contact at {seat.center}'
        minimum_bearing=min(minimum_bearing,area)
        [embed] = [p for p in groups['Core beam embeds'] if touch(p,seat)]
        anchors = [p for p in groups['Core embed anchors'] if touch(p,embed)]
        assert len(anchors)==4
        hosts = [p for p in cores if touch(p,embed) and all(touch(p,a) for a in anchors)]
        if not hosts:
            lift_hosts=[w for w in groups['Freight lift core'] if touch(w,embed) and all(touch(w,a) for a in anchors)]
            assert lift_hosts and any(touch(w,pit) for w in lift_hosts), f'Core embed missing its wall or mat at {embed.center}'
            lift_bearings+=1
            continue
        stair_bearings+=1
        # A seat above a stair entrance loads the concrete lintel and both jambs.
        # A seat in uninterrupted wall bears straight down. Follow only elements
        # at this wall line, and require both piers when the beam is over a door.
        wall=hosts[0]
        peers=[p for p in cores+groups['Stair gallery lintel'] if p.lo[1]-.001<=wall.center[1]<=p.hi[1]+.001]
        def on_mat(xy):
            return any(np.all(m.lo[:2]<=xy) and np.all(m.hi[:2]>=xy)
                       and any(touch(f,m) for f in ground_panels(xy)) for m in mats)
        def supported(x,top,allow_lintel):
            xy=np.array([x,wall.center[1]])
            floor_z=max((f.hi[2] for f in ground_panels(xy)),default=-1e6)
            # Follow the section vertically down through actual overlapping
            # contact faces. Stop at the first void beneath the point of load.
            at=top
            while at>floor_z+.001:
                below=[p for p in peers if p.lo[0]-.0002<=x<=p.hi[0]+.0002
                       and p.lo[2]<at-.0002 and p.hi[2]>=at-.0002]
                if not below:break
                at=min(p.lo[2] for p in below)
            if at<=floor_z+.001:return on_mat(xy)
            if not allow_lintel:return False
            # Find the header directly above the void. The old monolithic stair
            # walls have full-height jambs at each end; the new stepped header
            # has measurable overlap onto the shoulders of the concrete piers.
            header=next((p for p in peers if abs(p.lo[2]-at)<.001 and p.lo[0]<=x<=p.hi[0]),None)
            if header is None:return False
            piers=[p for p in peers if p.lo[2]<at-.001 and p.hi[2]>=at-.001 and touch(header,p)]
            def jamb(left):
                for pier in piers:
                    lo=max(header.lo[0],pier.lo[0]);hi=min(header.hi[0],pier.hi[0])
                    if hi-lo>.05:station=(lo+hi)/2
                    elif abs(pier.hi[0]-header.lo[0])<.002 or abs(pier.lo[0]-header.hi[0])<.002:
                        station=pier.center[0]
                    else:continue
                    if (station<x)==left and supported(station,at,False):return True
                return False
            return jamb(True) and jamb(False)
        if not supported(embed.center[0],embed.center[2],False):
            lintel_supports+=1
            assert supported(embed.center[0],embed.center[2],True), f'Incomplete lintel bearing path at {embed.center}'
    couplers=groups['Lift and stair coupling beams']
    assert len(couplers)==2 and all(any(touch(b,w) for w in cores) and
           any(touch(b,w) and touch(w,pit) for w in groups['Freight lift core']) for b in couplers)
    # Cast-in-place basement girders terminate in the core wall or at their RC column.
    # Check physical support at each end, in addition to the missing-beam regressions.
    basement = groups['Basement beams']
    columns = groups['Basement columns']
    assert len(basement)>=14
    beam_supports = cores+columns+groups['Freight lift core']+groups['Retaining walls']+groups['Primary bearing pedestals']
    for girder in basement:
        for endpoint in (girder.lo[1],girder.hi[1]):
            assert any(p.lo[1]-.001<=endpoint<=p.hi[1]+.001 and touch(p,girder) for p in beam_supports), (girder.serial,endpoint)
    for col in columns:
        local=ground_panels(col.center[:2])
        assert any(touch(col,f) for f in local)
        assert any(any(touch(f,pad) for f in local) and np.all(pad.lo[:2]<=col.center[:2]) and np.all(pad.hi[:2]>=col.center[:2])
                   for pad in groups['Basement column pads']+mats)
    return dict(primary_frame_parts={k:len(groups[k]) for k in MAIN},
                same_primary_geometry_as_reference=bool(reference),truss_to_foundation_chains=4,
                core_girder_bearings=stair_bearings+lift_bearings,
                stair_wall_seats=stair_bearings,lift_wall_seats=lift_bearings,concrete_coupling_beams=len(couplers), bearings_carried_by_core_lintels=lintel_supports, modeled_minimum_bearing_contact_m2=round(minimum_bearing,3),
                core_embed_anchors=len(groups['Core embed anchors']), basement_beams=len(basement),
                basement_columns=len(columns),basement_beam_ends_verified=2*len(basement))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('model',type=Path)
    p.add_argument('--reference',type=Path)
    p.add_argument('--report',type=Path)
    args=p.parse_args()
    result=json.dumps(audit(args.model,args.reference),indent=2)
    if args.report:args.report.write_text(result+'\n')
    print(result)
