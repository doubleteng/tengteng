"""Trace the two teaching balconies and staff infill to as-exported foundation bearings."""
import argparse
from collections import defaultdict, deque
import json
from pathlib import Path

from check_envelope import read_parts
from check_gallery import bearing_area, bounds, candidates, touch


STATIONS = (24.2, 27.8, 31.4, 35.0, 38.6)
FRAME = {
    'Glulam posts', 'Glulam chords', 'Glulam Warren webs', 'Concealed node plates',
    'Chord splice plates', 'Steel node seats', 'Glulam bearing columns',
    'Hold-down shoes', 'Primary bearing pedestals', 'Indicative pile caps', 'Drilled shaft heads'
}


def audit(glb):
    layers = defaultdict(list)
    for p, _, _ in read_parts(glb, True):
        if p.layer.startswith('Structure / '):
            layers[p.layer.removeprefix('Structure / ')].append(p)

    def one(parts, label):
        found = list(parts)
        if len(found) != 1:
            raise ValueError(f'{label}: expected one component, found {len(found)}')
        return found[0]

    def at(layer, x):
        return [p for p in layers[layer] if abs(p.center[0]-x) < .005]

    def require(condition, description):
        if not condition:
            raise ValueError(description)

    # Keep horizontal floors out of the transfer graph. A disconnected arm
    # cannot qualify by borrowing its neighbour's supports through shared CLT.
    frame = [p for k in sorted(FRAME) for p in layers[k] if p.hi[1] < 3.0]
    low, high = bounds(frame)
    adjacency = defaultdict(list)
    toes = {i for i, p in enumerate(frame) if p.layer.endswith('/ Drilled shaft heads')}
    for i,p in enumerate(frame):
        for j in candidates(p,low,high):
            if j>i and touch(p,frame[j]):
                adjacency[i].append(j)
                adjacency[j].append(i)

    def foundation(start):
        queue = deque([(start,[start])])
        seen = {start}
        while queue:
            node, route = queue.popleft()
            if node in toes:
                return route
            for neighbour in adjacency[node]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    queue.append((neighbour,route+[neighbour]))
        raise ValueError('No continuous physical contact from truss to registered drilled shaft head')

    routes = []
    for x in STATIONS:
        brackets = at('Teaching balcony brackets', x)
        require(len(brackets)==2, f'x={x}: incomplete glulam triangle')
        arm,knee = sorted(brackets,key=lambda p:p.hi[2]-p.lo[2])
        deck = one(layers['North office balcony' if x==38.6 else 'Teaching lounge balcony'], 'CLT')
        area = bearing_area(arm,deck)
        require(area>.48 and touch(arm,knee), f'x={x}: missing slab or diagonal bearing')
        post = one((i for i,p in enumerate(frame) if p.layer.endswith('/ Glulam posts')
                    and abs(p.center[0]-x)<.005), f'truss post at {x}')
        shoes = at('Teaching balcony bracket shoes', x)
        pins = at('Teaching balcony through-dowels',x)
        require(len(shoes)==4 and len(pins)==8,f'x={x}: incomplete paired shoes and pin groups')
        for wood in (arm,knee):
            group = [s for s in shoes if touch(s,wood)]
            require(len(group)==2,f'x={x}: outrigger end lacks both body and knife plate')
            knife = min(group,key=lambda s:s.hi[0]-s.lo[0])
            shoe = max(group,key=lambda s:s.hi[0]-s.lo[0])
            require(touch(knife,frame[post]) and touch(shoe,knife),f'x={x}: unanchored steel shoe')
            connected = [p for p in pins if touch(p,knife)]
            require(sum(touch(p,wood) for p in connected)==2 and
                    sum(touch(p,frame[post]) for p in connected)==2,f'x={x}: missing through-dowels')
        path = foundation(post)
        routes.append(dict(grid_m=x,bearing_m2=round(area,3),
                           drilled_shaft_x_m=round(float(frame[path[-1]].center[0]),2)))

    # The rim is seated in shoes at both independently anchored brackets.
    rim = one(layers['Office balcony rim'],'east balcony rim')
    deck = one(layers['North office balcony'],'office CLT')
    require(bearing_area(rim,deck)>.50,'Office rim is detached from CLT')
    for x in STATIONS[-2:]:
        arm = max(at('Teaching balcony brackets',x),key=lambda p:p.lo[2])
        shoes = [p for p in layers['Office rim shoes'] if abs(p.center[0]-x)<.35]
        require(any(touch(s,arm) for s in shoes) and any(touch(s,rim) for s in shoes)
                and len(shoes)==2 and touch(*shoes),f'x={x}: office rim seat missing')

    # Follow each patch of the former loggia opening individually. Both steel
    # hanger and cross-girder are required; CLT alone cannot link to a truss.
    patch = [p for p in layers['Forum and terraces'] if p.lo[0]<52.90 and p.hi[0]>48.01 and
             p.lo[1]<8.99 and p.hi[1]>5.81]
    total_area = sum(max(0,min(p.hi[0],52.96)-max(p.lo[0],48.0))*
                     max(0,min(p.hi[1],9.0)-max(p.lo[1],5.8)) for p in patch)
    require(abs(total_area-4.96*3.2)<.002,'Unfilled area in staff lounge deck')
    rims = layers['Loggia rim beams']
    require(len(rims)==2 and all(all(touch(p,r) for r in rims) for p in patch),
            'Infill CLT lacks one of its two long-edge loggia beams')
    girder = one((p for p in at('Forum and court cross girders',49.4) if all(touch(p,r) for r in rims)),
                 'infill cross-girder')
    hanger = one((p for p in at('Deck hanger plates',49.4) if p.center[1]<3 and touch(p,girder)),
                 'connected north hanger')
    anchors = [i for i,p in enumerate(frame) if p.layer.endswith('/ Glulam chords') and touch(hanger,p)]
    require(anchors, 'Deck hanger does not land on a truss chord')
    foundation(anchors[0])
    return dict(teaching_brackets=routes,through_dowels=8*len(routes),
                office_rim_seated_ends=2,staff_infill_m2=round(float(total_area),3),
                staff_infill_rim_beams=len(rims))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb',type=Path)
    print(json.dumps(audit(parser.parse_args().glb),indent=2))
