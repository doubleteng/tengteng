"""Check the exported fit-out, its actual supports and the occupied gallery edge."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

import numpy as np
from check_envelope import read_parts
from check_gallery import Probe, bounds, candidates, gap, touch

FITOUT = {'Interior / Loose furniture','Interior / Acoustic linings','Interior / Demountable stages',
          'Interior / West reading tribune','Circulation / Tribune treads',
          'Interior / Suspended hall reflectors','Interior / Reflector suspension'}


def check(model):
    parts=[p for p,_,_ in read_parts(model,True,all_layers=True)]
    low,high=bounds(parts)
    fitted={i for i,p in enumerate(parts) if p.layer in FITOUT}
    contacts={i:set() for i in fitted}
    collisions=[]
    for i in sorted(fitted):
        p=parts[i]
        for j in candidates(p,low,high):
            if j==i or (j in fitted and j<i):continue
            q=parts[j]
            distance=gap(p,q)
            if distance<=.001:
                contacts[i].add(j)
                if j in fitted:contacts[j].add(i)
            if distance<-.003:
                collisions.append(dict(parts=[p.layer,q.layer],at=p.center.round(3).tolist(),
                                       penetration_mm=round(-distance*1000)))
    # Follow each connected fit-out assembly until it meets the building.
    unanchored=[]
    unseen=set(fitted)
    while unseen:
        seed=unseen.pop();stack=[seed];group=[seed];attached=False
        while stack:
            i=stack.pop()
            for j in contacts[i]:
                if j not in fitted:attached=True
                if j in unseen:
                    stack.append(j);unseen.remove(j);group.append(j)
        if not attached:unanchored.append(parts[seed].center.round(3).tolist())

    def indices(name):return [i for i,p in enumerate(parts) if p.layer==name]
    panels=indices('Interior / Suspended hall reflectors')
    suspension=set(indices('Interior / Reflector suspension'))
    girders=set(indices('Structure / Glulam roof girders'))
    failures=[];drops_verified=0
    for panel in panels:
        feet=contacts[panel]&suspension
        rods={j for foot in feet for j in contacts[foot]&suspension if np.ptp(parts[j].v[:,2])>.30}
        bars={j for rod in rods for j in contacts[rod]&suspension if np.ptp(parts[j].v[:,0])>1.0}
        plates={j for rail in bars for j in contacts[rail]&suspension if .30<np.ptp(parts[j].v[:,0])<.60}
        if len(feet)!=4 or len(rods)!=4 or len(bars)!=2 or len(plates)!=2 or any(
                len(contacts[j]&girders)!=1 for j in plates):
            failures.append('Incomplete reflector suspension at '+str(parts[panel].center))
        else:drops_verified+=len(rods)
    if len(panels)!=8:failures.append('Expected eight individually traceable reflectors')

    def check_volume(name,limits):
        (x,y,z,X,Y,Z)=limits
        probe=Probe([[u,v,h] for u in (x,X) for v in (y,Y) for h in (z,Z)])
        for j in candidates(probe,low,high,-.002):
            if gap(probe,parts[j])<-.002:failures.append(f'{name} intersects {parts[j].layer}')
    l3=10.6788
    check_volume('Lounge passage',(23.02,3.765,l3+.003,31.85,5.265,l3+2.05))
    for start in (24.06,27.03):
        check_volume('Seated occupant',(start+.10,5.30,l3+.48,start+2.04,5.82,l3+1.43))
    check_volume('Study table approach',(29.85,4.41,l3+.003,30.99,5.315,l3+2.05))

    # The last short CLT end bears directly on the portal. The rest is
    # traced through the actual stepped stringer pieces on both supports.
    stringers=indices('Structure / Reading tier runners')
    collectors=indices('Structure / Reading tier collectors')
    portals=indices('Structure / Glulam portal crossheads')
    shoes=indices('Structure / Reading end shoes')
    tiers=indices('Interior / West reading tribune')+indices('Circulation / Tribune treads')
    if not tiers or any(not (contacts[i]&(set(stringers)|set(portals))) for i in tiers):
        failures.append('Reading tier without a bearing')
    groups={}
    for i in stringers:groups.setdefault(round(float(parts[i].center[1]),3),[]).append(i)
    if len(groups)!=7:failures.append('Expected seven independent reading-tier stringers')
    for y,ids in groups.items():
        ordered=sorted((parts[j] for j in ids),key=lambda p:p.lo[0])
        if not all(touch(a,b) for a,b in zip(ordered,ordered[1:])):failures.append(f'Broken stringer at {y}')
        if not any(touch(a,parts[b]) for a in ordered for b in collectors):failures.append(f'Missing west bearing at {y}')
        if not any(touch(ordered[-1],parts[s]) and any(touch(parts[s],parts[p]) for p in portals)
                   for s in shoes):failures.append(f'Missing portal shoe at {y}')
    # At each truss, trace the west collector seat into the chord through
    # its actual strap and pin. Check the east crosshead against both chords.
    chords=indices('Structure / Glulam chords')
    straps=indices('Structure / Collector steel straps')
    pins=indices('Structure / Collector seat pins')
    west_seats=indices('Structure / Collector seats')
    if len(collectors)!=1 or len(west_seats)!=2:
        failures.append('West collector is missing an end seat')
    else:
        for seat in west_seats:
            fixed=[j for j in straps if touch(parts[j],parts[seat])]
            if (not touch(parts[seat],parts[collectors[0]]) or len(fixed)!=2 or
                not all(any(touch(parts[p],parts[j]) and any(touch(parts[p],parts[c]) for c in chords)
                            for p in pins) for j in fixed)):
                failures.append('Collector end lacks a continuous pin-to-chord connection')
    posts=indices('Structure / Glulam bearing columns')
    for station in (13.4,45.8):
        spans=[i for i in portals+indices('Structure / Forum and court cross girders')
               if parts[i].lo[0]<station<parts[i].hi[0]]
        if len(spans)!=1:
            failures.append(f'Duplicate or missing transverse girder at {station}')
            continue
        sp=parts[spans[0]]
        seats=[i for i in indices('Structure / Portal seat shelves') if touch(parts[i],sp)]
        if len(seats)!=2:failures.append(f'Transverse girder has no paired end seats at {station}')
        for seat in seats:
            ps=[i for i in indices('Structure / Portal bearing plates') if touch(parts[seat],parts[i])]
            if len(ps)!=1 or not any(touch(parts[j],parts[ps[0]]) and
                 any(touch(parts[j],parts[k]) for k in posts) for j in indices('Structure / Portal bearing dowels')):
                failures.append(f'Missing end connection to bearing column at {station}')
        for i in candidates(sp,low,high,-.003):
            q=parts[i]
            if i!=spans[0] and q.layer.startswith('Structure /') and ('glulam' in q.material.lower() or
                    'CLT' in q.material) and gap(sp,q)<-.003:
                failures.append(f'Transverse girder at {station} overlaps {q.layer}')
    return dict(model_sha256=hashlib.sha256(model.read_bytes()).hexdigest(),
                fitout_solids_checked=len(fitted),by_layer=dict(Counter(parts[i].layer for i in fitted)),
                penetrations=collisions,unattached_assemblies=unanchored,
                verified_reflector_suspension_drops=drops_verified,reading_stringers=len(groups),
                lounge_passage_probe_m=[1.225,2.05],other_failures=failures)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    result=check(args.model);data=json.dumps(result,indent=2)
    if args.report:args.report.write_text(data+'\n')
    print(data)
    raise SystemExit(bool(result['penetrations'] or result['unattached_assemblies'] or result['other_failures']))
