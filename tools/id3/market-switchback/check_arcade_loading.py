"""One-sided occupancy and uplift screening of the built arcade mast and pad geometry.

Units are m, kN, and kPa. The walking dead load is 1.12 kPa and only one wing
has 5.0 kPa occupancy. The 0.95 kPa canopy dead load is tested with zero or
1.0 kPa uniform gross uplift. Treat each stringer/eave bay as simply supported
with its actual end overhang. Compare load resultants to pad kern and compute
elastic soil contact pressures. Ground density, stiffness, settlement, seismic,
snow drift, component safety factors, joints and load combinations need separate
project inputs. The diagrammatic service values do not size a buildable joint.
"""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import numpy as np
from check_envelope import read_parts

S='Structure / '
C='Circulation / '
DECK_DEAD=1.12
CROWD=5.
ROOF_DEAD=.95
GROSS_UPLIFT=1.
CONCRETE_WEIGHT=24.

def verify(path):
    all_parts=defaultdict(list)
    for part,*_ in read_parts(path,True,all_layers=True):all_parts[part.layer].append(part)
    masts=sorted(all_parts[S+'Arcade spine masts'],key=lambda p:p.center[0])
    pads=sorted(all_parts[S+'Arcade spine footings'],key=lambda p:p.center[0])
    assert len(masts)==len(pads)==14
    axes=np.array([p.center[0] for p in masts])
    def axis_at(x):
        j=np.argmin(abs(axes-x))
        return j if abs(axes[j]-x)<.2 else None

    loads=defaultdict(lambda:np.zeros((len(axes),2)))
    spine_y=masts[0].center[1]
    def distribute(name,p,stations,indices):
        # Integrate linear end-reaction influence functions exactly on each
        # bearing span. Extrapolation gives the correct overhang reaction.
        l,r=p.lo[0],p.hi[0]
        breaks=sorted({l,r,*[x for x in stations if l<x<r]})
        width=p.hi[1]-p.lo[1]
        arm=(p.hi[1]+p.lo[1])/2-spine_y
        for a,b in zip(breaks,breaks[1:]):
            x=(a+b)/2
            j=max(0,min(len(stations)-2,np.searchsorted(stations,x)-1))
            f=(x-stations[j])/(stations[j+1]-stations[j])
            for index,influence in ((indices[j],1-f),(indices[j+1],f)):
                if index is not None:loads[name][index]+=(b-a)*width*influence*np.array([1,arm])

    forks=all_parts[S+'Arcade ramp fork arms']+all_parts[S+'Arcade ramp ground caps']
    for ramp in all_parts[C+'Market arcade inclines']:
        south=ramp.center[1]>spine_y
        stations=sorted(p.center[0] for p in forks if (p.center[1]>spine_y)==south)
        indices=[axis_at(x) for x in stations]
        if south:
            stations.append(all_parts[S+'Ground ramp toe bearing'][0].center[0])
            indices.append(None) # Terminal apron has its own on-grade bearing.
        distribute('south' if south else 'north',ramp,stations,indices)
    turn=all_parts[C+'Market turn'][0]
    area=np.prod(turn.hi[:2]-turn.lo[:2])
    loads['turn'][0]=area*np.array([1,turn.center[1]-spine_y])
    for name,supports,zones in [
        ('roof', 'Arcade cantilever crossheads',[S+'Arcade CLT roof']),
        ('bridge','Arcade bridge fork arms',[C+'Forum threshold',C+'Forum approach bridge',C+'Forum vestibule link'])]:
        stations=sorted(p.center[0] for p in all_parts[S+supports])
        for zone in zones:
            for p in all_parts[zone]:distribute(name,p,stations,[axis_at(x) for x in stations])

    result=[]
    for i,(mast,foot) in enumerate(zip(masts,pads)):
        a,b,h=foot.hi-foot.lo
        max_kern=max_q=max_m=max_t=0.
        anchors=[p.center[1] for p in all_parts[S+'Arcade foundation anchors'] if abs(p.center[0]-axes[i])<.5]
        lever=max(anchors)-min(anchors)
        assert len(anchors)==4 and lever>.26
        for side in ('north','south','all','empty'):
            for uplift in (0,GROSS_UPLIFT):
                force,moment=np.sum([val[i]*(ROOF_DEAD-uplift if key=='roof' else DECK_DEAD)
                                     for key,val in loads.items()],axis=0)
                for key in loads:
                    if key=='roof':continue
                    active=side=='all' or (side=='north' and key in ('north','bridge')) or (side=='south' and key=='south')
                    if active:
                        force+=CROWD*loads[key][i,0]
                        moment+=CROWD*loads[key][i,1]
                # Foot weight is favorable only for the ground-stability check.
                # Ignore column and overburden weight, plus adjoining post ties.
                base_m=moment+force*(spine_y-foot.center[1])
                reaction=force+a*b*h*CONCRETE_WEIGHT
                kern=6*abs(base_m)/reaction/b
                max_kern=max(max_kern,kern)
                max_q=max(max_q,reaction*(1+kern)/a/b)
                max_m=max(max_m,abs(moment))
                max_t=max(max_t,abs(moment)/(2*lever)) # no favorable axial weight
        assert max_kern<=1,(round(axes[i],2),'soil resultant outside middle third',round(max_kern,3))
        result.append(dict(x_m=round(axes[i],3),max_kern_fraction=round(max_kern,3),
                           max_soil_pressure_kPa=round(max_q,1),max_mast_moment_kNm=round(max_m,1),
                           tension_per_anchor_kN=round(max_t,1)))
    return {'cases_per_station':8,'stations':result}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    print(json.dumps(verify(parser.parse_args().model),indent=2))
