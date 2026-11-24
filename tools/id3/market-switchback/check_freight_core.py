"""Measure the open shaft and trace both split diaphragm ties through the steel embedded in its concrete walls."""
import argparse
from collections import defaultdict
from itertools import product
import json
from pathlib import Path

from check_envelope import read_parts
from check_gallery import Probe, bearing_area, bounds, candidates, connected, touch


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit(model):
    parts = [part for part, _, _ in read_parts(model, True, all_layers=True)]
    layers = defaultdict(list)
    for part in parts:
        layers[part.layer.removeprefix('Structure / ')].append(part)

    # 8 mm inspection margin from the actual clear faces of the well.
    # Check every solid including moving-leaf source assemblies, deck, roof,
    # stair, collector and curtain wall across the full continuous volume.
    clear = Probe(list(product((52.468,55.022),(10.768,13.432),(-2.168,13.665))))
    low, high = bounds(parts)
    intrusions = [parts[i].layer for i in candidates(clear, low, high) if touch(clear, parts[i])]
    require(not intrusions, f'Objects in freight lift travel/overhead space: {intrusions}')

    steel_layers = ('Lift brace embed plates','Lift brace embed studs','Lift brace vertical collectors',
                    'Lift ring cross links','Lift ring reinforcement')
    connections = [p for name in steel_layers for p in layers[name]]
    nbhd = defaultdict(set)
    trace = {'Cantilever lateral cross ties': 'soffit', 'Collector ties': 'roof'}
    for name in trace:
        connections += [p for p in layers[name] if any(touch(p,s) for s in layers['Lift brace embed plates'])]
    low, high = bounds(connections)
    for i,p in enumerate(connections):
        for j in candidates(p, low, high):
            if j>i and touch(p,connections[j]):
                nbhd[i].add(j)
                nbhd[j].add(i)

    rings = []
    for layer, label in trace.items():
        ends = {i for i,p in enumerate(connections) if p.layer=='Structure / '+layer}
        require(len(ends)==2, f'{label}: expected an exterior brace on each side of cavity')
        start = min(ends)
        group = connected({start},nbhd,set(range(len(connections))))
        require(ends <= group, f'{label}: no force path through embedded steel')
        counts = {name: sum(connections[i].layer=='Structure / '+name for i in group) for name in steel_layers}
        require(list(counts.values())==[2,8,4,8,16], f'{label}: incomplete anchors or ring: {counts}')
        for i in ends:
            require(sum(connections[n].layer.endswith('/ Lift brace embed plates') for n in nbhd[i])==1,
                    f'{label}: exterior tie lacks its own end plate')
        concrete = layers['Freight lift core']+layers['Freight lift lintels']
        for i in group:
            part = connections[i]
            if part.layer.endswith('/ Lift ring reinforcement'):
                require(any(touch(part,c) for c in concrete), f'{label}: unsupported perimeter bar')
        rings.append(label)

    # Each timber trimmer ends on an embedded steel seat; the 400 mm
    # interval beside the staircase has a short coupling beam with two bearings.
    for name, count in [('Glulam roof girders',2),('Glulam floor girders',1),('Forum and court cross girders',1)]:
        near = [p for p in layers[name] if abs(p.center[0]-53)<.01 and
                (abs(p.hi[1]-10.582)<.003 or abs(p.lo[1]-13.618)<.003)]
        require(len(near)==count, f'{name}: incorrect members at lift shaft')
        for p in near:
            seats = [s for s in layers['Core beam seats'] if touch(p,s)]
            require(any(any(touch(seat,c) for c in layers['Freight lift core']) for seat in seats),
                    f'{name}: missing wall bearing')
    links = layers['Lift and stair coupling beams']
    require(len(links)==2 and all(all(any(touch(link,c) for c in layers[name]) for name in
                ('Freight lift core','Concrete stair cores')) for link in links),'Unseated stair coupling beam')
    [lintel] = layers['Stair gallery lintel']
    supports = [p for p in layers['Concrete stair cores'] if abs(p.hi[2]-lintel.lo[2])<.001 and
                touch(p,lintel) and bearing_area(p,lintel)>.03]
    require(len(supports)==2,'Staff gallery lintel needs two 200 mm end bearings')

    # The staff aisle crosses a new CLT strip above the loggia. Trace each
    # independent knee bracket through the actual old rim to a truss-bay girder.
    infill = sorted(layers['Staff gallery loggia infill'],key=lambda p:p.center[1])
    [front] = layers['Staff gallery edge beam']
    south_rim = max(layers['Loggia rim beams'],key=lambda p:p.center[1])
    require(len(infill)==2 and bearing_area(infill[0],front)>.65 and
            bearing_area(infill[1],south_rim)>.50,'Loggia deck lacks front or rear support')
    require(any(abs(p.center[0]-49.4)<.01 and touch(p,south_rim)
                for p in layers['Forum and court cross girders']),'Loggia rim is isolated from its timber bay')
    for x in (53.32,54.82,56.28):
        [flange,knee,plate] = [next(p for p in layers[name] if abs(p.center[0]-x)<.005)
                              for name in ('Staff gallery outrigger flange','Staff gallery outrigger knee',
                                           'Staff gallery rim connection')]
        bolts = [p for p in layers['Staff gallery rim bolts'] if abs(p.center[0]-x)<.06]
        require(touch(flange,front) and touch(flange,knee) and touch(knee,plate)
                and touch(flange,plate) and touch(plate,south_rim), f'Broken gallery bracket at x={x}')
        require(len(bolts)==4 and all(touch(p,plate) and touch(p,south_rim) for p in bolts),
                f'Missing through-bolts at x={x}')
    return {'unobstructed_hoistway_height_m':round(float(clear.hi[2]-clear.lo[2]),3),
            'diaphragm_transfers':rings,'stair_coupling_beams':len(links),
            'staff_gallery_lintel_end_bearings':len(supports),
            'staff_gallery_rim_brackets':3}


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    print(json.dumps(audit(parser.parse_args().model),indent=2))
