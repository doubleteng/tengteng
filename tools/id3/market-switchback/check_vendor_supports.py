"""Audit the physical vendor roof-to-footing connections, including both sides of every shared eave."""
from argparse import ArgumentParser
from collections import defaultdict
from itertools import combinations
import json
from pathlib import Path

import numpy as np

from check_envelope import read_parts
from check_gallery import bearing_area, touch
from market_roofs import BANKS, BANK_DEPTH, STUDIES


def require(test, label):
    if not test:
        raise ValueError(label)


def audit(model):
    layers=defaultdict(list)
    for part,*_ in read_parts(model,True,all_layers=True):
        layers[part.layer.split(' / ',1)[-1]].append(part)
    caps=layers['Vendor shared capitals']
    columns=layers['Vendor glulam columns']
    bases=layers['Market plinths']
    pads=layers['Vendor spread footings']
    require(len(columns)==len(bases)==len(pads)==26,'36 eave bearings must use 26 actual posts')
    require(len(caps)==10,'Expected ten independent shared capitals')
    for post in columns:
        base=next(b for b in bases if np.linalg.norm(b.center[:2]-post.center[:2])<.01)
        shoes=[s for s in layers['Vendor column shoes'] if touch(s,post) and touch(s,base) and
               bearing_area(s,post)>.06]
        require(shoes and any(bearing_area(base,p)>.20 for p in pads if touch(base,p)),
                f'Post has no actual bearing path to its own foundation: {post.center}')
    # A physical footing shared by two adjacent posts is not a consolidated post.
    require(all(np.linalg.norm(a.center[:2]-b.center[:2])>=2 for a,b in combinations(columns,2)),
            'Closely paired vendor uprights remain')
    require(not any(touch(a,b) for a,b in combinations(pads,2)),'Vendor footings overlap')
    pins=layers['Vendor moving bearing pins']
    keepers=layers['Vendor slotted bearing keepers']
    require(len(pins)==20 and len(keepers)==80,'Both sides of every shared capital need independent guides')
    travel=[]
    for pin in pins:
        near=[k for k in keepers if np.linalg.norm(pin.center[:2]-k.center[:2])<.20 and
              abs(pin.center[2]-k.center[2])<.17]
        slot_sides=[k for k in near if k.lo[2]<pin.center[2]<k.hi[2]]
        require(len(near)==4 and len(slot_sides)==2 and not any(touch(pin,k) for k in near),
                'Moving roof pin obstructed by fixed keeper')
        left,right=sorted(slot_sides,key=lambda k:k.center[0])
        clearance=min(pin.lo[0]-left.hi[0],right.lo[0]-pin.hi[0])
        require(clearance>.028,'Missing longitudinal movement allowance at shared eave')
        travel.append(float(clearance)*1000)
    frame_count=0
    arrangements=defaultdict(int)
    collector_nodes=0
    for i,(north,n,first,h) in enumerate(BANKS):
        south=north+BANK_DEPTH
        monitor=north+STUDIES[-1].monitor_offsets[i]
        frames=[p for p in layers['Glulam market frames'] if north<p.center[1]<south
                and p.hi[1]-p.lo[1]>8.]
        for frame in frames:
            x=frame.center[0]
            for side,v in enumerate((north+.36,south-.36)):
                region=lambda p: abs(p.center[0]-x)<.80 and abs(p.center[1]-v)<.70
                direct=[p for p in columns if region(p) and touch(frame,p) and bearing_area(frame,p)>.025]
                if direct:
                    arrangements['direct on post']+=1
                elif i==0 and side==0:
                    hang=[p for p in layers['Vendor transverse hangers'] if region(p)]
                    require(any(touch(p,frame) and bearing_area(p,frame)>.04 for p in hang),
                            f'North market crosshead lacks shelf at {x:.3f}')
                    post=next(p for p in columns if region(p))
                    require(any(touch(plate,post) and any(touch(plate,bolt) and touch(post,bolt)
                            for bolt in layers['Vendor hanger bolts'] if region(bolt)) for plate in hang),
                            'North hanger lacks physical bolts into continuous post')
                    arrangements['north post side hanger']+=1
                else:
                    capital=next((p for p in caps if region(p)),None)
                    require(capital is not None,f'No shared capital at {(x,v)}')
                    post=next(p for p in columns if np.linalg.norm(p.center[:2]-capital.center[:2])<.28)
                    require(touch(capital,post) and bearing_area(capital,post)>.14,'Unseated shared capital')
                    pads_local=[p for p in layers['Vendor movement bearing pads'] if region(p)]
                    steel=[p for p in layers['Vendor movement bearings'] if region(p)]
                    require(any(touch(p,s) and touch(s,frame) and bearing_area(s,frame)>.045
                                for p in pads_local for s in steel),'Shared eave shoe detached from frame')
                    steps=[p for p in layers['Vendor stepped bearings'] if region(p) and touch(p,capital)]
                    require(any(touch(p,s) and any(touch(s,b) for b in [capital]+steps)
                                for p in pads_local for s in steel),'Shared roof pad detached from capital')
                    arrangements['independent seat on shared capital']+=1
                frame_count+=1
            for v in (north+.36,monitor-.12,monitor+1.26,south-.36):
                adjacent=[p for p in layers['Glulam market collectors'] if abs(p.center[1]-v)<.01
                          and p.lo[0]<x+.5 and p.hi[0]>x-.5]
                require(adjacent,f'Missing roof collector at {(x,v)}')
                for girder in adjacent:
                    if i==0 and v==north+.36:
                        post=next(p for p in columns if np.linalg.norm(p.center[:2]-[x,v])<.01)
                        require(touch(girder,post),'Continuous north post detached from eave')
                    else:
                        top=[p for p in layers['Vendor collector bearings'] if abs(p.center[0]-x)<.01 and abs(p.center[1]-v)<.01]
                        if top:
                            require(any(touch(b,girder) and touch(b,frame) for b in top),'Detached collector block')
                        else:
                            seats=[p for p in layers['Vendor collector hanger seats'] if abs(p.center[0]-x)<.4 and abs(p.center[1]-v)<.01 and touch(p,girder)]
                            backs=[p for p in layers['Vendor collector hanger backs'] if abs(p.center[0]-x)<.2 and abs(p.center[1]-v)<.01 and touch(p,frame)]
                            require(any(touch(s,b) for s in seats for b in backs),'Girder hanger misses beam or seat')
                collector_nodes+=1
    decks=layers['CLT market roof deck']
    rafters=layers['Glulam market rafters']
    roof=layers['Folded zinc roof planes']
    for panel in decks:
        require(sum(touch(panel,r) for r in rafters)>=2,'Roof panel has fewer than two supporting rafters')
    collectors=layers['Glulam market collectors']
    for rafter in rafters:
        positions=[]
        for seat in layers['Vendor rafter shelves']:
            if not touch(rafter,seat):continue
            backs=[p for p in layers['Vendor rafter hanger backs'] if touch(seat,p)]
            # Where the roof folds, both halves of the bent plate share the
            # same weld. The support must still reach a bolted collector.
            require(any(any(touch(back,bolt) and any(touch(bolt,g) for g in collectors)
                        for bolt in layers['Vendor rafter hanger bolts']) for back in backs),
                    f'Rafter hanger not bolted to collector at {rafter.center}')
            positions.append(seat.center[1])
        positions += [g.center[1] for g in collectors if touch(rafter,g) and bearing_area(rafter,g)>.003]
        for stool in layers['Vendor rafter transfer stools']:
            if touch(rafter,stool) and bearing_area(rafter,stool)>.003:
                require(any(touch(stool,frame) and bearing_area(stool,frame)>.045 for frame in
                            layers['Glulam market frames']),'Rafter transfer stool detached from crosshead')
                positions.append(stool.center[1])
        require(positions and max(positions)-min(positions)>2.,
                f'Rafter lacks separate bearings at both ends at {rafter.center}')
    require(all(any(touch(z,d) for d in decks) for z in roof),'Zinc roof detached from CLT roof deck')
    return dict(market_roof_banks=3,roof_plane_patches=len(roof),clt_panels=len(decks),
                transverse_frames=frame_count//2,frame_end_bearings=frame_count,
                posts=len(columns),footings=len(pads),shared_capitals=len(caps),
                separate_end_seats=arrangements['independent seat on shared capital'],
                collector_to_transverse_nodes=collector_nodes,
                rafter_solids_with_two_bearing_lines=len(rafters),slotted_eave_guides=len(pins),
                minimum_sliding_clearance_each_direction_mm=round(min(travel),2),
                arrangements=dict(arrangements))


if __name__=='__main__':
    p=ArgumentParser(description=__doc__);p.add_argument('glb',type=Path)
    print(json.dumps(audit(p.parse_args().glb),indent=2))
