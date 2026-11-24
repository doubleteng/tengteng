"""Verify arcade roof and ramp bearing chains against the exported fabrication surfaces."""
import argparse
from collections import defaultdict
from pathlib import Path
import numpy as np
from check_envelope import read_parts

S='Structure / '
A='Circulation / '
LAYERS={
    S+'Arcade CLT roof',S+'Arcade roof rafters',S+'Arcade eave girders',
    S+'Arcade cantilever crossheads',S+'Arcade timber posts',S+'Arcade post shoes',
    S+'Arcade foundation stems',S+'Arcade spread footings',A+'Market arcade inclines',
    S+'Promenade glulam stringers',S+'Walk trestle crossheads',S+'Walk support trestles',
    S+'Walk footings',A+'West hall entrance terrace',A+'West entrance landing',
    S+'West entrance terrace bearings', S+'Ground ramp toe bearing', A+'Market turn',
    S+'Market turn crossheads',S+'Market turn posts',S+'Market turn foundations',
    A+'Arcade ground landing',S+'Arcade landing foundation',
}

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
    layers=defaultdict(list)
    for p,*_ in read_parts(file,False,LAYERS):
        if p.layer in LAYERS:layers[p.layer].append(p)
    def group(name):return layers[S+name]
    def seats(p,others):return [q for q in others if bearing(p,q)]
    heads=group('Arcade cantilever crossheads')
    girders=[p for p in group('Arcade eave girders') if p.hi[1]-p.lo[1]>.20]
    ledgers=[p for p in group('Arcade eave girders') if p.hi[1]-p.lo[1]<.10]
    rafters=group('Arcade roof rafters');deck=group('Arcade CLT roof')
    assert len(heads)==len(rafters)==9 and len(girders)==len(ledgers)==6
    for rafter in rafters:
        assert len(seats(rafter,ledgers))==2 and len([p for p in deck if bearing(p,rafter)])==1
    for ledger in ledgers:
        edge=min(abs(ledger.hi[1]-p.lo[1]) if abs(ledger.hi[1]-p.lo[1])<abs(p.hi[1]-ledger.lo[1])
                 else abs(p.hi[1]-ledger.lo[1]) for p in girders if abs(ledger.center[0]-p.center[0])<.01)
        assert edge<.001, 'Rafter ledger detached from its longitudinal girder'
    for girder in girders:assert len(seats(girder,heads))==3, ('Unsupported eave',girder.center)
    for head in heads:assert len(seats(head,group('Arcade timber posts')))==2
    for first,next_layer in [('Arcade timber posts','Arcade post shoes'),('Arcade post shoes','Arcade foundation stems'),
                             ('Arcade foundation stems','Arcade spread footings')]:
        assert len(group(first))==18
        for member in group(first):assert len(seats(member,group(next_layer)))==1,(first,member.center)
    ramps=layers[A+'Market arcade inclines']
    runners=[p for p in group('Promenade glulam stringers') if abs(p.hi[0]-p.lo[0]-40.9)<.01]
    assert len(ramps)==2 and len(runners)==4
    for ramp in ramps:assert len(seats(ramp,runners))==2
    bents=group('Walk trestle crossheads')
    for bent in bents:
        assert len([s for s in runners if bearing(s,bent)])==2
        assert len(seats(bent,group('Walk support trestles')))==2
    for runner in runners:
        supports=sorted(q.center[0] for q in seats(runner,bents))
        assert len(supports)>=7 and max(np.diff(supports))<5.11
    for leg in group('Walk support trestles'):assert len(seats(leg,group('Walk footings')))==1
    toe=group('Ground ramp toe bearing')[0]
    assert sum(bearing(runner,toe) for runner in runners)==2
    for first,second,total in [('Market turn','Market turn crossheads',2),
                               ('Arcade ground landing','Arcade landing foundation',1)]:
        assert len(seats(layers[A+first][0],group(second)))==total
    for head in group('Market turn crossheads'):assert len(seats(head,group('Market turn posts')))==3
    for post in group('Market turn posts'):assert len(seats(post,group('Market turn foundations')))==1
    for terrace in layers[A+'West hall entrance terrace']+layers[A+'West entrance landing']:
        assert len(seats(terrace,group('West entrance terrace bearings')))>=2
    return (f'{len(heads)} continuous cantilever crossheads, 18 canopy posts to spread footings, '
            f'{len(bents)} ramp bents and two west entrance landings have bearing contact.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('model',type=Path)
    print(verify(parser.parse_args().model))
