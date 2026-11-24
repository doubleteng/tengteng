"""Audit the upper promenade against the exported Market Crossing GLB.

Checks connected convex parts, bearing locations, plate-to-timber contacts,
façade interference and continuous walking clearances. These geometry tests
do not calculate member or connection capacity.
"""
import argparse
from collections import Counter, defaultdict, deque
import json
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull

from check_envelope import plane_triples, read_parts
from check_topology import audit as check_topology

S = 'Structure / '
A = 'Circulation / '
FLIGHTS = [A + name for name in ('South overlook ramp', 'Fourth Avenue belvedere', 'North learning gallery')]
LANDINGS = A + 'West corner landings'
TERMINALS = [A + name for name in ('Forum threshold', 'Studios threshold', 'Studios entrance')]
OLD = {S + name for name in ('Exterior gallery pedestals', 'Independent gallery posts', 'Exterior gallery brackets')}
HOST = {S + name for name in ('Glulam posts', 'Glulam bearing columns', 'Glulam chords', 'Glulam floor girders',
                              'Glulam portal crossheads', 'Forum and court cross girders', 'Laterally braced lower rim')}
ARM = S + 'Gallery cantilever arms'
CONNECTION = S + 'Gallery timber connection plates'
STRINGER = S + 'Promenade glulam stringers'
PAD = S + 'Gallery bearing pads'
TRIMMER = S + 'Gallery threshold trimmer'
LINK = S + 'Gallery transfer links'
BOLTS = S + 'Gallery connection bolts'
SLEEVE = 'Enclosure / Gallery penetration sleeves'
SEAL = 'Enclosure / Gallery sleeve seals'
WINDOWS = {'Enclosure / Vision lights in recessed frames', 'Enclosure / Diffuse upper lights',
           'Enclosure / Insulated folded cassettes'}
TOLERANCE = .001
CLEAR_WIDTH = 48*.0254
CLEAR_HEIGHT = 2.0


class Probe:
    def __init__(self, vertices):
        self.v = np.asarray(vertices)
        self.lo = self.v.min(axis=0)
        self.hi = self.v.max(axis=0)


def gap(a, b):
    """Separating-plane distance: negative inside, zero at a bearing face.

    The hull of the pairwise vertex differences is the Minkowski difference
    of the two convex solids. Its unit face normals include edge/edge axes.
    """
    return float(ConvexHull((a.v[:, None, :] - b.v).reshape(-1, 3)).equations[:, 3].max())


def candidates(part, low, high, tolerance=TOLERANCE):
    return np.flatnonzero(np.all(high >= part.lo - tolerance, axis=1) &
                          np.all(low <= part.hi + tolerance, axis=1))


def bounds(parts):
    return (np.asarray([p.lo for p in parts]).reshape(-1, 3),
            np.asarray([p.hi for p in parts]).reshape(-1, 3))


def touch(a, b):
    return (np.all(a.hi >= b.lo-TOLERANCE) and np.all(b.hi >= a.lo-TOLERANCE)
            and gap(a,b) <= TOLERANCE)


def bearing_area(a,b):
    """Plan area of the contact patch, accumulated within a 1 mm contact slab."""
    planes=np.concatenate((a.planes(),b.planes()))
    # Leave side faces tight to avoid inflating the measured plan footprint.
    planes[np.abs(planes[:,2])>.85,3] -= TOLERANCE/2
    triples=planes[plane_triples(len(planes))]
    matrices=triples[:,:,:3]
    use=np.abs(np.linalg.det(matrices))>1e-9
    verts=np.linalg.solve(matrices[use],-triples[use,:,3,None])[:,:,0]
    xy=verts[np.all(verts@planes[:,:3].T+planes[:,3]<=2e-7,axis=1),:2]
    return float(ConvexHull(xy).volume) if len(xy)>=3 and np.linalg.matrix_rank(xy-xy[0])==2 else 0.


def connected(start, neighbours, included):
    seen=set(start)
    queue=deque(start)
    while queue:
        next_ids=(neighbours[queue.popleft()] & included)-seen
        seen.update(next_ids)
        queue.extend(next_ids)
    return seen


def surface(deck, upper=True):
    """Fit the exported upper rectangular face, independently of generator slopes."""
    v = deck.v
    xy = np.unique(v[:, :2], axis=0)
    limit=np.max if upper else np.min
    top = np.array([limit(v[np.all(v[:, :2] == point, axis=1), 2]) for point in xy])
    matrix = np.column_stack((xy, np.ones(len(xy))))
    fit = np.linalg.lstsq(matrix, top, rcond=None)[0]
    if np.max(np.abs(matrix @ fit - top)) > .0002:
        raise ValueError(f'Nonplanar walk surface: {deck.layer} {deck.serial}')
    return fit


def check_passage(top, axis, end0, end1, crossing, solids, low, high, name, failures):
    sides = (crossing-CLEAR_WIDTH/2, crossing+CLEAR_WIDTH/2)
    xy = [(u, v) if axis == 0 else (v, u) for u in (end0, end1) for v in sides]
    probe = Probe([(x, y, np.dot(top, (x, y, 1))+.032+h) for x,y in xy for h in (0, CLEAR_HEIGHT)])
    hits = [solids[i] for i in candidates(probe, low, high) if gap(probe, solids[i]) < -TOLERANCE]
    if hits:
        failures.append(f'{name}: blocked walking corridor: '+', '.join(sorted(set(p.layer for p in hits))))


def edge_width(a,b):
    overlap = np.minimum(a.hi[:2], b.hi[:2]) - np.maximum(a.lo[:2], b.lo[:2])
    return float(max(overlap)) if min(overlap) >= -TOLERANCE and touch(a,b) else 0.


def audit(path):
    solids = [p for p, _, _ in read_parts(path, True, all_layers=True)]
    layers = defaultdict(list)
    for p in solids:
        layers[p.layer].append(p)
    failures = []
    old = {name: len(layers[name]) for name in sorted(OLD)}
    if any(old.values()):
        failures.append('Freestanding promenade columns, bases or their original brackets remain.')
    for name in FLIGHTS:
        if len(layers[name]) != 1:
            raise ValueError(f'Expected one walk slab in {name}')
    flights = [layers[name][0] for name in FLIGHTS]
    corners = [[p for p in layers[LANDINGS] if (p.center[1] < 10) == north] for north in (False, True)]
    ramps = []
    low, high = bounds(solids)
    for i, walk in enumerate(flights):
        run_axis = 1 if i == 1 else 0
        across = 1-run_axis
        gradient = surface(walk)
        crossing=.659 if i==2 else walk.center[across]
        check_passage(gradient,run_axis,walk.lo[run_axis],walk.hi[run_axis],crossing,
                      solids,low,high,walk.layer,failures)
        run = walk.hi[run_axis]-walk.lo[run_axis]
        width = walk.hi[across]-walk.lo[across]
        rise = abs(gradient[run_axis])*run
        if abs(abs(gradient[run_axis])-.04) > .00005 or abs(gradient[across]) > .00001:
            failures.append(f'{walk.layer}: longitudinal or cross slope has changed.')
        if abs(width-(1.42,1.83,1.263)[i]) > TOLERANCE:
            failures.append(f'{walk.layer}: clear deck width has changed.')
        ramps.append(dict(layer=walk.layer, run_m=round(float(run),3), rise_m=round(float(rise),4),
                          grade_percent=round(float(100*rise/run),4), deck_width_m=round(float(width),3)))

    # A walk-to-corner seam may span more than one contiguous CLT infill panel.
    for group, a,b in zip(corners,flights,flights[1:]):
        if not group or any(np.linalg.norm(surface(p)[:2]) > .00001 for p in group):
            failures.append('A western corner landing is missing or tilted.')
            continue
        corner=surface(group[0])
        if any(abs(surface(p)[2]-corner[2])>TOLERANCE for p in group):
            failures.append('Mismatched CLT top faces within a level corner.')
        point=np.mean([p.center for p in group],axis=0)
        elbows=[]
        for walk in (a,b):
            if sum(edge_width(walk, piece) for piece in group) < CLEAR_WIDTH:
                failures.append(f'{walk.layer}: no continuous end connection to the level corner.')
            axis=int(np.argmax((walk.hi-walk.lo)[:2]))
            edge=min((walk.lo[axis],walk.hi[axis]), key=lambda u:abs(u-point[axis]))
            xy=walk.center[:2].copy()
            xy[axis]=edge
            if walk.layer==FLIGHTS[2]:xy[1-axis]=.659
            elbows.append((axis,xy))
            if abs(surface(walk) @ [*xy,1] - corner[2])>TOLERANCE:
                failures.append(f'{walk.layer}: step between flight and turning platform.')
        for (_,destination),(axis,start) in ((elbows[0],elbows[1]),(elbows[1],elbows[0])):
            check_passage(corner,axis,start[axis],destination[axis],start[1-axis],
                          solids,low,high,LANDINGS,failures)
    for deck, end_name in [(flights[0],TERMINALS[0]),(flights[2],TERMINALS[1])]:
        if not any(edge_width(deck,p) >= CLEAR_WIDTH for p in layers[end_name]):
            failures.append(f'{deck.layer}: entry or exit threshold disconnected.')

    # Do not use walk slabs or stringers to establish a building-side anchor.
    # A single supported bay must not certify unrelated unanchored bays via
    # their common continuous deck.
    hardware = [p for p in solids if p.layer.startswith(S+'Gallery ')]
    hosts = [p for p in solids if p.layer in HOST and 'glulam' in p.material.lower()]
    labels = Counter(p.layer for p in hardware)
    if not labels[ARM] or not labels[CONNECTION]:
        failures.append('Building-side arms or timber connection plates missing.')
    anchors = {}
    adjacency = defaultdict(set)
    hlow,hhigh = bounds(hardware)
    tlo,thi = bounds(hosts)
    for i, member in enumerate(hardware):
        for j in candidates(member, hlow,hhigh):
            if j>i and touch(member,hardware[j]):
                adjacency[i].add(j)
                adjacency[j].add(i)
        direct=[hosts[j] for j in candidates(member, tlo,thi) if touch(member,hosts[j])]
        if direct:
            anchors[i]=direct
    anchored=connected(anchors,adjacency,set(range(len(hardware))))
    stations=[]
    for i,arm in enumerate(hardware):
        if arm.layer!=ARM:
            continue
        west=arm.lo[0]<2.15<arm.hi[0]
        axis=1 if west else 0
        at=arm.center[axis]
        north=arm.center[1]<10
        terminal=not west and north and at>47
        # Restrict anchor proof to this connection and its local host nodes.
        # Excluding pads, deck and landing beams prevents borrowing a
        # neighbouring cantilever's anchor through continuous floor framing.
        radius=3 if terminal else .65
        local={j for j,q in enumerate(hardware) if q.layer in (ARM,CONNECTION,BOLTS,LINK,TRIMMER)
               and q.lo[axis]<=at+radius and q.hi[axis]>=at-radius}
        ids=connected([i],adjacency,local)
        touched={id(q):q for j in ids for q in anchors.get(j,[])}
        if west:
            xs={round(float(q.center[0]),2) for q in touched.values() if q.layer==S+'Glulam floor girders'}
            ok={2.6,6.2}<=xs
        else:
            xs={round(float(q.center[0]),2) for q in touched.values()
                if q.layer in (S+'Glulam posts',S+'Glulam bearing columns')}
            ok={45.8,49.4}<=xs if terminal else any(abs(x-at)<.02 for x in xs)
        side='west' if west else ('north' if north else 'south')
        sleeves=[p for p in layers[SLEEVE] if touch(arm,p) or
                 (np.all(p.hi>=arm.lo-.03) and np.all(p.lo<=arm.hi+.03) and gap(arm,p)<.026)]
        seals=[p for p in layers[SEAL] if touch(arm,p)]
        sealed=len(sleeves)==4 and len(seals)==4 and all(any(touch(g,s) for s in sleeves) for g in seals)
        if not ok:
            failures.append(f'{side} arm at {at:.2f}: missing timber anchorage at its own station.')
        if not sealed:
            failures.append(f'{side} arm at {at:.2f}: incomplete sleeve or gasket around wall opening.')
        stations.append(dict(side=side,at_m=round(float(at),3),local_anchors_x_m=sorted(xs),
                             sleeve_faces=len(sleeves),seal_faces=len(seals)))
    # Explicit screw/seat material is allowed in the structural timber, but
    # no new arm, screw or bearing plate may overlap a glazed or opaque panel.
    panels=[p for p in solids if p.layer in WINDOWS]
    plow,phigh=bounds(panels)
    wall_hits=[]
    passages=hardware+layers[SLEEVE]+layers[SEAL]
    for p in passages:
        for j in candidates(p, plow,phigh):
            penetration=-gap(p,panels[j])
            if penetration > .0005:
                wall_hits.append((p.layer,p.serial,panels[j].layer,panels[j].serial,round(penetration,5)))
    if wall_hits:
        failures.append(f'{len(wall_hits)} connections enter a façade panel.')
    paving=layers['Site / Market court paving']
    ground_violations=[]
    for p in hardware:
        for grade in paving:
            if touch(p,grade):
                ground_violations.append((p.layer,p.serial))
                break
    # Detect the former freestanding arrangement by geometry as well as name.
    # Lower arcade trestles deliberately stop at their own separate ramp.
    lower=layers[A+'Market arcade inclines']
    decks=flights+layers[LANDINGS]
    aligned_posts=[]
    for p in solids:
        dx,dy,height=p.hi-p.lo
        if height<3 or height<8*max(dx,dy) or p.lo[2]>3:
            continue
        def ends_under(deck,lower_bound,upper_bound):
            overlap=np.minimum(p.hi[:2],deck.hi[:2])-np.maximum(p.lo[:2],deck.lo[:2])
            if min(overlap)<=0:
                return False
            drop=surface(deck) @ [*p.center[:2],1]-p.hi[2]
            return lower_bound<=drop<=upper_bound
        if (any(ends_under(k,-.15,1.4) for k in decks)
                and not any(ends_under(k,.06,.32) for k in lower)):
            aligned_posts.append((p.layer,p.serial))
    if ground_violations or aligned_posts:
        failures.append('Exterior gallery hardware still reaches grade or has a freestanding post beneath it.')

    bearings=[]
    lap_anchors=set()
    splices=[]
    for i, walk in enumerate(flights):
        axis = 1 if i==1 else 0
        gradient=surface(walk)
        rails=[p for p in layers[STRINGER]
               if .15<np.dot(gradient,(*p.center[:2],1))-p.center[2]<.36
               and p.hi[axis]-p.lo[axis]>.8*(walk.hi[axis]-walk.lo[axis]) and touch(walk,p)]
        if len(rails)!=2:
            failures.append(f'{walk.layer}: expected two bearing stringers, got {len(rails)}.')
        for rail in rails:
            positions=[]
            areas=[]
            for j in candidates(rail, hlow,hhigh):
                p=hardware[j]
                if j not in anchored or p.layer!=PAD or not touch(p,rail):
                    continue
                seated_on_arm=any(hardware[k].layer==ARM and k in anchored for k in adjacency[j])
                area=bearing_area(p,rail)
                xy=np.column_stack((p.v[:,:2],np.ones(len(p.v))))
                mismatch=np.max(np.abs(xy @ (surface(p)-surface(rail,upper=False))))
                if seated_on_arm and area>.002 and mismatch<=TOLERANCE:
                    positions.append(round(float(p.center[axis]),3))
                    areas.append(area)
            positions=sorted(set(positions))
            spacing=np.diff([rail.lo[axis],*positions,rail.hi[axis]])
            maximum=round(float(max(spacing)),3)
            supported=len(positions)>=2 and maximum<=6.2 and max(spacing[0],spacing[-1])<=1.85
            if not supported:
                failures.append(f'{walk.layer} stringer {rail.serial}: missing distributed timber-supported bearings.')
            # Only a lapped, bolted load path can transfer a landing moment
            # back to a flight. End-grain touching alone earns no credit.
            for j in candidates(rail, hlow,hhigh):
                plate=hardware[j]
                if not supported or plate.layer!=S+'Gallery landing splice plates' or not touch(plate,rail):
                    continue
                crosses_support=any(plate.lo[axis]+.04<t<plate.hi[axis]-.04 for t in positions)
                bolts=[hardware[k] for k in adjacency[j] if hardware[k].layer==S+'Gallery landing bolts'
                       and touch(hardware[k],rail)]
                stations_bolted={round(float(q.center[axis]),2) for q in bolts}
                if crosses_support and len(bolts)>=4 and len(stations_bolted)>=2:
                    lap_anchors.add(j)
                    splices.append(dict(plate=plate.serial,stringer=rail.serial,bolts=len(bolts)))
            bearings.append(dict(walk=walk.layer,stringer=rail.serial,seats=positions,max_interval_m=maximum,
                                 smallest_pad_bearing_cm2=round(10000*min(areas),1) if areas else 0))

    anchored=connected(anchored|lap_anchors,adjacency,set(range(len(hardware))))
    for i,p in enumerate(hardware):
        if i not in anchored:
            failures.append(f'No timber load path: {p.layer} {p.serial}')

    # A corner panel loads its own landing framing, or a continuously
    # bearing adjacent panel. Do not bridge gaps using just AABB contact.
    corner_contacts=[]
    landing_groups=[('southwest',corners[0]),('northwest',corners[1]),
                    ('forum threshold',layers[TERMINALS[0]]),
                    ('studio threshold',layers[TERMINALS[1]]+layers[TERMINALS[2]])]
    for name,group in landing_groups:
        seated={i for i,p in enumerate(group) if any(
            j in anchored and hardware[j].layer==S+'Gallery landing beams'
            and touch(p,hardware[j]) and bearing_area(p,hardware[j])>.0002
            for j in candidates(p, hlow,hhigh))}
        initial=len(seated)
        queue=deque(seated)
        while queue:
            p=group[queue.popleft()]
            for i,q in enumerate(group):
                if i not in seated and edge_width(p,q) > .04:
                    seated.add(i)
                    queue.append(i)
        if not initial or len(seated)!=len(group):
            failures.append(f'Incomplete timber-supported {name} landing.')
        corner_contacts.append(dict(landing=name,panels=len(group),directly_supported=initial,connected=len(seated)))

    topology = check_topology(path)
    if topology['failed_parts']:
        failures.append('GLB contains mesh or parcel faults.')
    return dict(former_parts=old, flights=ramps, checked_central_corridor_m=[CLEAR_WIDTH,CLEAR_HEIGHT],
                hardware=dict(labels), anchored_hardware=len(anchored), stations=stations,
                building_contacts=dict(Counter(q.layer for ps in anchors.values() for q in ps)),
                bearings=bearings, verified_splices=splices, corner_bearings=corner_contacts, facade_hits=wall_hits,
                ground_hits=ground_violations, freestanding_posts=aligned_posts, mesh_faults=topology['failed_parts'],
                failures=failures)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    report=audit(args.model)
    if args.report:
        args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(f"{len(report['stations'])} cantilever stations; {report['anchored_hardware']} anchored parts; "
          f"{len(report['facade_hits'])} window or cassette clashes.")
    for failure in report['failures']:
        print(failure)
    raise SystemExit(bool(report['failures']))
