"""Check the exported basement support junctions, beam end faces and retaining ring."""
import argparse
from collections import Counter
import json
from pathlib import Path

import numpy as np

from check_envelope import read_parts

S = 'Structure / '
CONCRETE = {
    'Basement beams','Basement columns','Basement column pads','Columns and cores',
    'Concrete stair cores','Core foundation mats','Core to pile cap step','Indicative pile caps',
    'Primary bearing pedestals','Bearings and foundations','Retaining walls','Perimeter strip footings',
    'Perimeter footing steps','Lower-ground slab','Public ground floor','Eastern plinth',
    'Freight lift core','Freight lift pit floor','Freight lift lintels','Freight lift sill seats',
    'West entrance terrace bearings','Stair gallery lintel',
}
TOL=.001


def verify(model):
    parts=[p for p,*_ in read_parts(model,False,{S+n for n in CONCRETE}) if p.layer.startswith(S)
           and p.layer[len(S):] in CONCRETE and p.material=='Board-formed concrete']
    def group(name):return [p for p in parts if p.layer==S+name]
    low,high=np.asarray([p.lo for p in parts]),np.asarray([p.hi for p in parts])
    # Every identified concrete element is rectangular, so bounding boxes here
    # give exact volume intersections. Check this assumption against every solid.
    for p in parts:
        assert len(p.v)==8 and np.all(np.isclose(p.v,p.lo,atol=TOL)|np.isclose(p.v,p.hi,atol=TOL)),p.layer
    overlaps=[]
    for i,p in enumerate(parts):
        for j in np.flatnonzero((np.minimum(p.hi,high)-np.maximum(p.lo,low)>TOL).all(axis=1)):
            if j>i:overlaps.append((p.layer,parts[j].layer))
    assert not overlaps,Counter(overlaps)

    def hosts(x,y):
        xy=np.array([x,y])
        return np.flatnonzero(((low[:,:2]<=xy+TOL)&(high[:,:2]>=xy-TOL)).all(axis=1))
    def coverage(indices,start,end):
        elevation=start
        for bottom,top in sorted((low[i,2],high[i,2]) for i in indices):
            if top<elevation-TOL:continue
            if bottom>elevation+TOL:return False
            elevation=max(elevation,top)
            if elevation>end-TOL:return True
        return False
    # Position every section on the as-modeled retaining-wall axes. Follow the
    # walls through the floor joints to below the undersides of both adjacent slabs.
    walls=group('Retaining walls')
    limits=np.array([np.min([p.lo for p in walls],axis=0),np.max([p.hi for p in walls],axis=0)])
    thickness=min(min((p.hi-p.lo)[:2]) for p in walls if min((p.hi-p.lo)[:2])>.40)
    x,y=limits[0,:2]+thickness/2
    X,Y=limits[1,:2]-thickness/2
    samples=[]
    for u in np.linspace(x,X,1+int(np.ceil((X-x)/.10))):
        samples.extend(((u,y),(u,Y)))
    for v in np.linspace(y,Y,1+int(np.ceil((Y-y)/.10))):
        samples.extend(((x,v),(X,v)))
    floor=limits[0,2]
    for u,v in samples:
        assert coverage(hosts(u,v),floor-.48,limits[1,2]-.002),f'Break in wall or footing at {(u,v)}'

    # Concrete girders can butt into a monolithic wall/pier, or bear vertically
    # over a center column. Verify positive face area on the loaded side.
    support_names={'Basement columns','Retaining walls','Concrete stair cores','Freight lift core','Primary bearing pedestals'}
    support=[p for p in parts if p.layer.removeprefix(S) in support_names]
    ends=Counter()
    min_area=float('inf')
    for b in group('Basement beams'):
        for at,direction in ((b.lo[1],-1),(b.hi[1],1)):
            faces=[]
            for p in support:
                overlap=np.minimum(b.hi,p.hi)-np.maximum(b.lo,p.lo)
                if abs(p.hi[2]-b.lo[2])<=TOL and p.lo[1]-TOL<=at<=p.hi[1]+TOL:
                    area=overlap[0]*overlap[1] if min(overlap[:2])>0 else 0
                elif abs((p.hi[1] if direction<0 else p.lo[1])-at)<=TOL:
                    area=overlap[0]*overlap[2] if min(overlap[0],overlap[2])>0 else 0
                else:
                    continue
                if area>.05:faces.append((area,p))
            assert faces,(b.serial,at)
            area,host=max(faces,key=lambda pair:pair[0])
            ends[host.layer.removeprefix(S)]+=1
            min_area=min(min_area,area)
    assert len(group('Basement columns'))==7 and len(group('Basement column pads'))==7
    assert ends['Primary bearing pedestals']==2 and ends['Basement columns']==14
    return dict(concrete_pieces=len(parts),overlapping_solid_pairs=0,
                perimeter_sections_to_foundation=len(samples),freestanding_basement_columns=7,
                beam_end_faces=dict(ends),smallest_beam_end_area_m2=round(float(min_area),4))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    report=json.dumps(verify(args.model),indent=2)
    if args.report:args.report.write_text(report+'\n')
    print(report)
