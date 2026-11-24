"""Verify arcade roof and ramp bearing chains against the exported fabrication surfaces."""
import argparse
from collections import defaultdict
from pathlib import Path
import numpy as np
from check_envelope import read_parts

S='Structure / '
A='Circulation / '
def faces_at(part,point):
    """Vertical intersections with actual triangles at a point inside the bearing seat."""
    hits=[]
    for triangle in part.v[part.faces]:
        a,b,c=triangle
        ab,ac=b[:2]-a[:2],c[:2]-a[:2]
        det=ab[0]*ac[1]-ac[0]*ab[1]
        if abs(det)<1e-10:continue
        delta=point-a[:2]
        u=(delta[0]*ac[1]-delta[1]*ac[0])/det
        v=(ab[0]*delta[1]-ab[1]*delta[0])/det
        if u>=-1e-6 and v>=-1e-6 and u+v<=1+1e-6:
            hits.append(a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]))
    return hits

def bearing(upper,lower):
    """Require contact at four distinct points over a real plan overlap."""
    lo=np.maximum(upper.lo[:2],lower.lo[:2]);hi=np.minimum(upper.hi[:2],lower.hi[:2])
    if min(hi-lo)<.012:return False
    if upper.hi[2]<lower.lo[2] or lower.hi[2]+.04<upper.lo[2]:return False
    for t in ((.25,.25),(.25,.75),(.75,.25),(.75,.75)):
        p=lo+(hi-lo)*t;U=faces_at(upper,p);L=faces_at(lower,p)
        if not U or not L or abs(min(U)-max(L))>.001:return False
    return True

def verify(file):
    from check_gallery import touch
    layers=defaultdict(list)
    for p,*_ in read_parts(file,True,all_layers=True):
        layers[p.layer].append(p)

    def group(name):return layers[S+name]
    def seats(p,others):return [q for q in others if bearing(p,q)]
    def contacts(p,others):return [q for q in others if touch(p,q)]
    def matches(part,others,count,test):
        found=test(part,others)
        assert len(found)==count,(part.layer,part.serial,part.center,len(found),count)
        return found

    masts=group('Arcade spine masts')
    footings=group('Arcade spine footings')
    heads=group('Arcade cantilever crossheads')
    girders=group('Arcade eave girders')
    ledgers=group('Arcade rafter ledgers')
    rafters=group('Arcade roof rafters')
    decks=group('Arcade CLT roof')
    assert len(masts)==len(footings)==14 and len(heads)==10
    assert len(decks)==3 and len(rafters)==21 and len(girders)==len(ledgers)==18
    assert np.min(np.diff(sorted(q.center[0] for q in masts)))>3.0
    assert len({round(q.center[1],3) for q in masts})==1

    for deck in decks:matches(deck,rafters,7,seats)
    for rafter in rafters:matches(rafter,ledgers,2,seats)
    for ledger in ledgers:
        girder=[q for q in girders if abs(ledger.center[0]-q.center[0])<.002 and touch(q,ledger)]
        assert len(girder)==1,(ledger.layer,ledger.serial)
    for girder in girders:matches(girder,heads,2,seats)
    for head in heads:matches(head,group('Arcade mast capitals'),1,seats)
    for cap in group('Arcade mast capitals'):matches(cap,masts,1,seats)
    for upper,lower in [('Arcade spine masts','Arcade spine base stems'),
                        ('Arcade spine base stems','Arcade spine base shoes'),
                        ('Arcade spine base shoes','Arcade spine pedestals'),
                        ('Arcade spine pedestals','Arcade spine footings')]:
        for component in group(upper):matches(component,group(lower),1,seats)
    foundations=group('Arcade foundation anchors')
    assert len(foundations)==4*len(footings)
    for footing in footings:matches(footing,foundations,4,contacts)
    for rod in foundations:matches(rod,group('Arcade embedded anchor heads'),1,seats)
    for mast in masts:matches(mast,group('Arcade base fork plates'),2,contacts)

    ramps=layers[A+'Market arcade inclines']
    runners=[p for p in group('Promenade glulam stringers') if abs(p.hi[0]-p.lo[0]-40.9)<.01]
    assert len(ramps)==2 and len(runners)==4
    for ramp in ramps:matches(ramp,runners,2,seats)
    forks=group('Arcade ramp fork arms')
    caps=group('Arcade ramp ground caps')
    toe=group('Ground ramp toe bearing')
    assert len(forks)==17 and len(caps)==2 and len(toe)==1
    for arm in forks+caps+toe:matches(arm, runners, 2,lambda p,qs:[q for q in qs if bearing(q,p)])
    for runner in runners:
        stations=sorted(q.center[0] for q in seats(runner,forks+caps+toe))
        assert len(stations)==10 and max(np.diff(stations))<5.15
    for cap in caps:matches(cap,group('Arcade ramp foundation arms'),1,seats)
    for cast_arm in group('Arcade ramp foundation arms'):matches(cast_arm,footings,1,seats)
    shoes=group('Arcade branch shoes')
    knees=group('Arcade underside knees')
    bridge_arms=group('Arcade bridge fork arms')
    for arm in forks+bridge_arms:
        matches(arm,shoes,1,seats)
        head_seat=matches(arm,group('Arcade knee head seats'),1,seats)[0]
        matches(head_seat,knees,1,seats)
    for knee in knees:
        matches(knee,group('Arcade knee heel seats'),1,seats)
        matches(knee,group('Arcade knee heel plates'),1,contacts)
        assert len(contacts(knee,group('Arcade knee gussets')))>=2
    for shoe in shoes:
        assert contacts(shoe,group('Arcade base fork plates')),(shoe.layer,shoe.serial)

    turn_beam=group('Arcade turn cantilever')[0]
    turn_joists=group('Market turn crossheads')
    matches(layers[A+'Market turn'][0],turn_joists,2,seats)
    for joist in turn_joists:matches(joist,[turn_beam],1,seats)
    matches(turn_beam,group('Arcade turn root shoe'),1,seats)
    turn_seat=matches(turn_beam,group('Arcade turn knee head plate'),1,seats)[0]
    turn_knee=matches(turn_seat,group('Arcade turn knee'),1,seats)[0]
    matches(turn_knee,group('Arcade turn knee heel seat'),1,seats)
    matches(turn_knee,group('Arcade turn knee bearing plates'),1,contacts)
    assert contacts(masts[0],group('Arcade turn root shoe'))
    assert contacts(masts[0],group('Arcade turn connection plates'))
    matches(layers[A+'Arcade ground landing'][0],group('Arcade landing foundation'),1,seats)
    for terrace in layers[A+'West hall entrance terrace']+layers[A+'West entrance landing']:
        assert len(seats(terrace,group('West entrance terrace bearings')))>=2

    longitudinal=group('Arcade bridge longitudinal girders')
    bridge_joists=group('Arcade bridge joists')
    assert len(longitudinal)==2 and len(bridge_arms)==5
    for girder in longitudinal:matches(girder,bridge_arms,5,seats)
    for joist in bridge_joists:matches(joist,longitudinal,2,seats)
    for name in ('Forum approach bridge','Forum vestibule link','Forum threshold'):
        deck=layers[A+name][0]
        assert len(seats(deck,bridge_joists))>=3,(name,'missing direct bearing')
    transverse=group('Arcade transverse stability links')
    vendor=[p for lst in layers.values() for p in lst if 'glulam' in p.material.lower()
            and abs(p.center[1]-25.76)<.001 and abs(p.hi[1]-p.lo[1]-.32)<.001
            and p.lo[2]<5.66<p.hi[2]]
    assert len(transverse)==5 and len(vendor)>=5
    for link in transverse:
        pins=matches(link,group('Arcade wind pins'),2,contacts)
        for pin in pins:
            cheeks=matches(pin,group('Arcade wind clevis'),2,contacts)
            clips=[q for q in group('Arcade wind clips') if np.linalg.norm((q.center-pin.center))<.15]
            assert len(clips)==1 and all(touch(cheek,clips[0]) for cheek in cheeks)
            assert contacts(clips[0],vendor if clips[0].center[1]>25 else masts)
    return (f'{len(masts)} founded common masts, {len(heads)} canopy frames, {len(rafters)} roof rafters, '
            f'{len(forks)} ramp cantilevers, {len(caps)} low-level concrete outrigger caps, '
            f'{len(bridge_arms)} bridge cantilevers, two turn joists and {len(bridge_joists)} bridge joists. '
            'Roof, flights, turning deck, threshold, bridge and vestibule have continuous bearings.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('model',type=Path)
    print(verify(parser.parse_args().model))
