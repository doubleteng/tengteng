"""Map real column axes, nearby supports and colliding foundations from one registered GLB.

A small face-to-face gap is an architectural coordination item, not automatically
a structural defect. A folded roof jack, stacked plinth and inclined Warren web
each has a different job. Dimensions and bearing contacts are read from mesh
vertices, not the design generator. This is not a capacity calculation.
"""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
from itertools import combinations
import json
from pathlib import Path

import numpy as np

from check_apertures import solid_overlap
from check_envelope import read_parts
from check_gallery import bounds, candidates, touch


PREFIX='Structure / '
WIDTH=1.2192
AXIS_SEARCH=2.10
FAMILIES={
    'Basement columns':'basement column','Primary bearing pedestals':'primary concrete pier',
    'Glulam bearing columns':'primary timber bearing','Glulam posts':'truss-panel upright',
    'Columns and cores':'annex concrete pier','Head house glulam columns':'annex timber column',
    'Glulam roof upstands':'roof jack','Forum gallery columns':'forum bridge column',
    'Walk support trestles':'ramp column','Market turn posts':'ramp landing column',
    'Arcade timber posts':'arcade roof column','Glulam market frames':'market column',
    'West entrance terrace bearings':'west terrace rib','Studio gallery suspension rods':'suspended studio landing',
    'Arcade spine masts':'arcade roof column','Vendor glulam columns':'market column'
}
FOUNDATION_NAMES={'Core to pile cap step','Drilled shaft heads','Bearings and foundations',
                  'Market plinths','Forum gallery plinths','Ground ramp toe bearing','Freight lift pit floor'}
CONCRETE_CLASSES={'basement column','primary concrete pier','annex concrete pier','west terrace rib'}
CORE_NAMES={'Concrete stair cores','Freight lift core','Retaining walls','Freight lift lintels','Stair gallery lintel'}
OUTSIDE={'market column','arcade roof column','ramp column','ramp landing column','forum bridge column'}


def number(v):return round(float(v),4)
def tag(p):return p.layer.removeprefix(PREFIX)

def family(p):
    name=tag(p)
    if name in FAMILIES:
        cat=FAMILIES[name]
    else:
        # Discover added posts without admitting diagonals, brackets, PV legs,
        # carpentry or bolts. Unknown families remain identifiable in the audit.
        n=name.casefold()
        if any(t in n for t in ('shoe','bolt','connection','pin','clamp','pad','cap','base','stem','seat','transfer','head','plate','bearer')):return None
        if not any(word in n for word in ('column','post','upright','pier','trestle','bent','mast','standard')):return None
        if 'market' in n:cat='market column'
        elif 'arcade' in n:cat='arcade roof column'
        elif 'ramp' in n or 'trestle' in n:cat='ramp column'
        elif 'gallery' in n or 'forum' in n:cat='forum bridge column'
        else:cat=name
    plan=np.unique(np.round(p.v[:,:2],4),axis=0)
    span=p.hi-p.lo
    if len(plan)!=4 or span[2]<.002:return None
    if cat=='market column':
        if max(span[:2])>.95:return None
        if p.lo[2]>4 and span[2]<1.60:return 'market roof jack'
    return cat


def foundation(p):
    n=tag(p)
    return 'concrete' in p.material.casefold() and (n in FOUNDATION_NAMES or any(v in n.lower() for v in
        ('foundation','footing','pile caps','column pads','spine pedestals')))


def reference(p):
    return {'layer':tag(p),'part':int(p.serial),'center_xy_m':[number(i) for i in (p.lo[:2]+p.hi[:2])/2],
            'height_range_m':[number(p.lo[2]),number(p.hi[2])]}


def near_reason(ca,cb,delta,face,overlap):
    kinds={ca,cb}
    if overlap<=.02:return 'different elevation or stacked support'
    if 'roof jack' in kinds or 'market roof jack' in kinds:return 'short roof bearings; compare the roof planes they carry'
    if 'suspended studio landing' in kinds:return 'suspension rod anchored to upper framing'
    if 'truss-panel upright' in kinds:return 'upright is part of a longitudinal truss, not a freestanding street column'
    if kinds=={'primary concrete pier','basement column'}:return 'transfer basement beam bearing into primary concrete pier'
    if kinds=={'market column'} and face<WIDTH:return 'adjacent roof banks can share a market column'
    if kinds=={'arcade roof column'} and face<WIDTH:return 'adjacent arcade roof ends can share one support with joint detailing'
    if kinds<={'ramp column','ramp landing column'} and face<.75:return 'two close ramp or landing bearing points can share a crosshead'
    if len(kinds)>1 and kinds<=OUTSIDE and face<WIDTH:return 'coordinate different exterior superstructures on one support or a common transfer'
    if ca==cb and face>=WIDTH:return 'separate load lines with a full-width intervening space'
    if 'west terrace rib' in kinds:return 'terrace retaining/bearing rib; check concrete intersection at the wall'
    return 'adjacent support lines; inspect the loads, occupied level and intervening space'


def trace_footing(p, layers, stages):
    """Find registered bearing interfaces in order, without transferring through a deck or another column."""
    paths=[[p]]
    for name in stages:
        next_paths=[]
        for path in paths:
            node=path[-1]
            for q in layers[name]:
                if name=='Basement column pads' and np.min(np.minimum(p.hi[:2],q.hi[:2])-np.maximum(p.lo[:2],q.lo[:2]))<.04:
                    continue
                if abs(q.hi[2]-node.lo[2])<.002 and touch(q,node):
                    next_paths.append([*path,q])
        paths=next_paths
    if not paths:return None
    return [reference(q) for q in paths[0]]


def audit(path):
    parts=[p for p,*_ in read_parts(path,True,all_layers=True) if p.layer.startswith(PREFIX)]
    low,high=bounds(parts)
    columns=[(p,c) for p in parts if (c:=family(p))]
    by_layer=defaultdict(list)
    for p in parts:by_layer[tag(p)].append(p)
    foundations=[p for p in parts if foundation(p)]
    cores=[p for p in parts if tag(p) in CORE_NAMES]
    # Exposed shafts remain four separate elements under each pile cap.
    # Stem-to-foundation or column-to-pedestal stacking is not a second column.
    nominal=[];close=[];touching_axes=[]
    for (a,ca),(b,cb) in combinations(columns,2):
        ac=(a.lo[:2]+a.hi[:2])/2;bc=(b.lo[:2]+b.hi[:2])/2
        d=np.linalg.norm(ac-bc)
        if d>AXIS_SEARCH:continue
        up=min(a.hi[2],b.hi[2])-max(a.lo[2],b.lo[2])
        if up<-.60:continue
        sep=np.maximum(0,np.maximum(a.lo[:2]-b.hi[:2],b.lo[:2]-a.hi[:2]))
        gap=float(np.linalg.norm(sep))
        rec={'a':reference(a),'b':reference(b),'axis_distance_m':number(d),'face_clear_m':number(gap),
             'simultaneous_height_m':number(up),'classification':near_reason(ca,cb,d,gap,up)}
        nominal.append(rec)
        if up>.02 and gap<WIDTH:close.append(rec)
        if up>.002 and gap<.002 and solid_overlap(a.v,b,.002):touching_axes.append(rec)
    concrete=[p for p in parts if 'concrete' in p.material.casefold()]
    lo,hi=bounds(concrete)
    overlaps=[];coupling=[]
    for i,p in enumerate(concrete):
        for j in candidates(p,lo,hi):
            if j<=i:continue
            q=concrete[j]
            h=np.minimum(p.hi,q.hi)-np.maximum(p.lo,q.lo)
            if h.min()>.002 and solid_overlap(p.v,q,.002):
                rec={'a':reference(p),'b':reference(q),'overlap_extent_m':[number(v) for v in h]}
                names={tag(p),tag(q)}
                # Two RC coupling beams embed 80 mm into each of their
                # structural wall ends. A long beam running along a wall or a
                # repeated column inside a wall will never meet this test.
                if ('Lift and stair coupling beams' in names and len(names & {'Concrete stair cores','Freight lift core'})==1
                        and abs(h[1]-.080)<.001):
                    beam=p if tag(p)=='Lift and stair coupling beams' else q
                    end=min(p.hi[1],q.hi[1]);begin=max(p.lo[1],q.lo[1])
                    if min(abs(beam.lo[1]-begin),abs(beam.hi[1]-end))<.001:
                        coupling.append(rec)
                        continue
                overlaps.append(rec)
    # Inspect only actual touching faces/edges near the two ends of each
    # upright. A neighbour 50 mm away is not a modeled connection.
    contacts=[]
    foot_paths=[]
    stage_sets={
        'Arcade spine masts':('Arcade spine base stems','Arcade spine base shoes','Arcade spine pedestals','Arcade spine footings'),
        'Vendor glulam columns':('Vendor column shoes','Market plinths','Vendor spread footings'),
        'Head house glulam columns':('Columns and cores','Bearings and foundations'),
        'Basement columns':('Lower-ground slab','Basement column pads'),
        'Glulam bearing columns':('Hold-down shoes','Primary bearing pedestals','Indicative pile caps','Drilled shaft heads'),
        'Market turn posts':('Market turn foundations',),'Forum gallery columns':('Forum gallery plinths',),
        'Walk support trestles':('Walk footings',),'Arcade timber posts':('Arcade post shoes','Arcade foundation stems','Arcade spread footings'),
        'Glulam market frames':('Concealed timber connections','Market plinths')
    }
    for p,c in columns:
        base=[];top=[];transfers=[]
        for i in candidates(p,low,high):
            q=parts[i]
            if q is p:continue
            near_base=q.lo[2]<=p.lo[2]+.04 and q.hi[2]>=p.lo[2]-.001
            near_head=q.hi[2]>=p.hi[2]-.04 and q.lo[2]<=p.hi[2]+.001
            trunk_contact=tag(p)=='Arcade spine masts' and tag(q) in ('Arcade branch shoes','Arcade mast capitals','Arcade underside knees')
            if not (near_base or near_head or trunk_contact) or not touch(p,q):continue
            if near_base:base.append(tag(q))
            if near_head:top.append(tag(q))
            if trunk_contact:transfers.append(tag(q))
        contacts.append({**reference(p),'family':c,'lower_contact':sorted(set(base)),'upper_contact':sorted(set(top)),
                         'side_or_cap_support_connections':sorted(set(transfers))})
        if tag(p) in stage_sets and c!='market roof jack':
            foot_paths.append({'support':reference(p),'bearing_path':trace_footing(p,by_layer,stage_sets[tag(p)])})
    # Walls and shafts are listed separately, including nearby clearances to
    # each real column. Reporting the actual solids avoids treating a complete
    # stair shaft boundary as a single column at the plan centre of the stair.
    core_neighbours=[]
    for p,c in columns:
        if c in ('roof jack','market roof jack'):continue
        for q in cores:
            if min(p.hi[2],q.hi[2])-max(p.lo[2],q.lo[2])<.12:continue
            sep=np.maximum(0,np.maximum(p.lo[:2]-q.hi[:2],q.lo[:2]-p.hi[:2]))
            dist=np.linalg.norm(sep)
            if dist<WIDTH:
                core_neighbours.append({'column':reference(p),'wall':reference(q),'face_clear_m':number(dist)})
    return dict(model=path.name,model_sha256=sha256(path.read_bytes()).hexdigest(),
                axis_search_m=AXIS_SEARCH,occupiable_corridor_reference_m=WIDTH,
                column_families=dict(sorted(Counter(c for _,c in columns).items())),
                foundation_and_stem_solids=len(foundations),core_and_retaining_wall_pieces=len(cores),
                axis_neighbours=nominal,simultaneous_close_axes=len(close),
                close_axis_classifications=dict(Counter(r['classification'] for r in close)),
                overlapping_column_axes=touching_axes,concrete_overlaps=overlaps,
                coupling_beam_embeds=coupling,column_core_neighbours=core_neighbours,ends=contacts,
                column_to_foundation=foot_paths)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('--report',type=Path)
    parser.add_argument('--require-clean',action='store_true',help='Fail on true overlaps and incomplete registered post-to-footing paths.')
    args=parser.parse_args()
    result=audit(args.model)
    if args.report:args.report.write_text(json.dumps(result,indent=2)+'\n')
    print(sum(result['column_families'].values()),'uprights;',result['foundation_and_stem_solids'],'foundation and stem solids;',
          len(result['axis_neighbours']),'neighbour pairs;',len(result['concrete_overlaps']),'concrete overlaps.')
    print(json.dumps(result['close_axis_classifications'],indent=2))
    missing=[p for p in result['column_to_foundation'] if not p['bearing_path']]
    print(len(result['column_to_foundation'])-len(missing),'of',len(result['column_to_foundation']),
          'registered column-to-foundation chains are physically connected.')
    if args.require_clean and (result['concrete_overlaps'] or result['overlapping_column_axes'] or missing):raise SystemExit(1)
