"""Trace the street reveals, raised lobby ceiling and annexe floor corners in the exported GLB."""
from argparse import ArgumentParser
from collections import defaultdict
from itertools import product
import json
from pathlib import Path

import numpy as np

from check_envelope import read_parts
from check_gallery import bearing_area, touch


def require(condition, label):
    if not condition:
        raise ValueError(label)


def probe(parts,axis,a,b):
    start,end=np.asarray(a),np.asarray(b)
    delta=end[axis]-start[axis]
    lo,hi=np.minimum(start,end),np.maximum(start,end)
    hits=[]
    for part in parts:
        if np.any(lo>part.hi+1e-6) or np.any(hi<part.lo-1e-6):continue
        t0,t1=0.,1.
        for *normal,offset in part.planes():
            v=np.dot(normal,start)+offset
            d=normal[axis]*delta
            if abs(d)<1e-8:
                if v>1e-5:break
            elif d<0:t0=max(t0,-v/d)
            else:t1=min(t1,-v/d)
            if t0>t1+1e-7:break
        else:
            if t1>=t0-1e-7:hits.append((t0,t1,part))
    return sorted(hits,key=lambda hit:hit[0])


def audit(glb):
    labels=('Service-wing plinth soffit','Service-wing soffit insulation','Service-wing soffit cap',
            'Gallery cantilever arms','Gallery timber connection plates','Raised lobby ceiling lining',
            'Raised lobby ceiling structure','Raised lobby ceiling acoustic layer','Raised lobby ceiling cap',
            'Raised lobby ceiling returns','Staff gallery edge beam','Raised ceiling shelf','Raised ceiling shelf bolts',
            'Lobby ceiling rim beams','Annex junction floor returns','Gallery penetration sleeves',
            'Gallery sleeve seals','Annex floor return outriggers','Annex return dowels','Forum and terraces',
            'Studios and bridges','Service-wing flexible penetration collar')
    layers=defaultdict(list)
    for part,_,_ in read_parts(glb,True,all_layers=True):
        name=part.layer.split(' / ',1)[-1]
        if name in labels:layers[name].append(part)
    for name in labels:require(layers[name],f'Missing {name}')
    folds=[p for label in (*labels[:5],'Gallery penetration sleeves','Gallery sleeve seals','Service-wing flexible penetration collar') for p in layers[label]]
    [penetration]=[p for p in layers['Gallery timber connection plates'] if
                   49.1<p.lo[0]<49.2 and 18.65<p.lo[1]<18.67 and p.hi[2]-p.lo[2]>2]
    collar=layers['Service-wing flexible penetration collar']
    # All four edges of the real plate touch the flexible collar; the extended
    # arm occupies the center of the outboard side below the weather cap.
    for axis in (0,1):
        other=1-axis
        for edge in (penetration.lo[axis],penetration.hi[axis]):
            p=[*penetration.center]
            p[axis]=edge+(-.005 if edge==penetration.lo[axis] else .005)
            p[other]=penetration.lo[other]+.04 if other==0 else penetration.center[other]
            top=5.405+max(0,p[0]-45.8)*1.70/10.8
            require(probe(collar,2,(*p[:2],top-.013),(*p[:2],top+.009)),
                    'Unsealed steel plate at the folded soffit')
    samples=0
    for x in np.unique([*np.arange(39.82,57.05,.173),39.995,40.006,45.095,45.106,45.341,45.36,
                         45.797,46.24,46.258,46.49,46.51,57.05]):
        at_pier=45.10<x<46.50
        a=1.14 if at_pier else 1.45
        b=18.86 if at_pier else 18.32 if x<40 else 18.48
        top=5.405+max(0,x-45.80)*1.70/10.8
        for lo,hi in (sorted((1.294,a)),(b,18.875)):
            for y in np.linspace(lo+.001,hi-.001,15):
                hits=probe(folds,2,(x,y,top-.17),(x,y,top+.004))
                coverage=sorted((min(t,u),max(t,u)) for t,u,_ in hits)
                # Every point through the thickness hits real insulation,
                # timber or gasket: a detached trim above an opening fails.
                end=.035
                for t,u in coverage:
                    require(t<=end+.002, f'Disconnected reveal depth at {(x,y,top)}')
                    end=max(end,u)
                require(end>.97,f'Missing folded soffit at {(x,y,top)}')
                samples+=1
        for y in (1.12,18.94):
            require(not probe([p for label in labels[:3] for p in layers[label]],
                              2,(x,y,top-.17),(x,y,top+.004)), 'Exterior promenade sealed')
    roof=[p for label in labels[5:9] for p in layers[label]]
    [deck]=layers['Raised lobby ceiling structure']
    cheeks=layers['Raised lobby ceiling returns']
    require(len(cheeks)==4,'Four lobby ceiling cheeks required')
    for x,y in product(np.linspace(53.08,56.53,10),np.linspace(5.91,8.12,8)):
        height=5.405+(x-45.80)*1.70/10.80
        hits=probe(roof,2,(x,y,height-.02),(x,y,height+.20))
        require(len(hits)==4,f'Missing ceiling layer at {(x,y)}')
        require(all(abs(previous[1]-nxt[0])<.0002 for previous,nxt in zip(hits,hits[1:])),
                'Raised ceiling has separated layers')
    for axis,level,other,xa,xb in [(0,52.96,7.1,52.93,53.11),(0,56.65,7.1,56.50,56.68),
                                   (1,5.8,54.7,5.77,5.96),(1,8.23,54.7,8.06,8.26)]:
        x=level if axis==0 else other
        for h in np.linspace(6.416,5.405+(x-45.80)*1.70/10.80-.008,6):
            a,b=([xa,other,h],[xb,other,h]) if axis==0 else ([other,xa,h],[other,xb,h])
            require(probe(cheeks,axis,a,b),'Open cheek at '+str((axis,level,h)))
    require(all(touch(deck,p) for p in cheeks),'Roof of raised ceiling misses an edge return')
    north=min(cheeks, key=lambda p:p.center[1])
    south=max(cheeks, key=lambda p:p.center[1])
    require(any(bearing_area(north,rim)>.33 for rim in layers['Lobby ceiling rim beams']),
            'North raised-ceiling curb lacks rim bearing')
    require(any(bearing_area(south,seat)>.30 for seat in layers['Raised ceiling shelf']),
            'South raised-ceiling curb lacks shelf bearing')
    [rim]=layers['Staff gallery edge beam']
    require(len(layers['Raised ceiling shelf bolts'])==12 and all(touch(bolt,rim)
            and any(touch(bolt,plate) for plate in layers['Raised ceiling shelf'])
            for bolt in layers['Raised ceiling shelf bolts']),'South shelf is unanchored')
    returns=layers['Annex junction floor returns']
    for h,ys in ((6.4116,[17.89,18.30]),(10.6788,[1.355,1.49,17.89,18.70])):
        for y in ys:
            require(probe(returns,2,(56.90,y,h-.27),(56.90,y,h+.02)),f'Unclosed floor corner {(y,h)}')
    support=layers['Annex floor return outriggers']
    require(len(support)==6,'Each new corner requires two supports')
    for beam in support:
        deck=layers['Forum and terraces' if beam.center[2]<8 else 'Studios and bridges']
        rear=[p for p in deck if touch(p,beam)]
        front=[p for p in returns if touch(p,beam)]
        pins=[p for p in layers['Annex return dowels'] if touch(p,beam)]
        require(len(pins)==4 and sum(any(touch(p,d) for d in front) for p in pins)==2 and
                sum(any(touch(p,d) for d in rear) for p in pins)==2,'Detached CLT return or support backspan')
    return dict(street_reveal_samples=samples,lobby_ceiling_surface_probes=80,
                boxed_ceiling_edges=len(cheeks),steel_shelf_through_bolts=12,
                new_floor_returns=3,connected_floor_return_outriggers=6)


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    parser.add_argument('glb',type=Path)
    print(json.dumps(audit(parser.parse_args().glb),indent=2))
