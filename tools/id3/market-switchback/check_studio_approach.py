"""Check the classroom gallery supports and compare the gravity demand on the two
timber roof girders which receive its outer hangers. Screening model only."""
import argparse
import json
from pathlib import Path

import numpy as np

from check_case_frame import structural_parts
from check_gallery import touch,bearing_area
from check_shell import E,DECK_DEAD,DECK_LIVE,ROOF_DEAD,ROOF_VARIABLE,DENSITY


def audit(model):
    layers=structural_parts(model)
    panels=layers['Studio access gallery']
    rims=layers['Studio approach rims']
    rods=layers['Studio gallery suspension rods']
    spreaders=layers['Studio gallery spreaders']
    seats=layers['Studio approach seats']
    cores=layers['Concrete stair cores']
    majors=layers['Glulam roof girders']
    assert (len(panels),len(rims),len(rods),len(spreaders))==(3,2,2,2)
    assert all(any(bearing_area(p,r)>.10 and abs(p.lo[2]-r.hi[2])<.001 for r in rims) for p in panels)
    lower_hardware=[s for s in seats if any(touch(s,r) and abs(s.hi[2]-r.lo[2])<.001 for r in rims)]
    roof_beams=[]
    for rod in rods:
        assert any(touch(rod,s) for s in lower_hardware)
        [spreader]=[s for s in spreaders if touch(s,rod)]
        washers=[s for s in seats if touch(s,rod) and abs(s.lo[2]-spreader.hi[2])<.001 and touch(s,spreader)]
        assert washers,'Missing top suspension washer'
        ends=[s for s in seats if abs(s.hi[2]-spreader.lo[2])<.001 and touch(s,spreader)]
        assert len(ends)==2
        hosts=[]
        for clip in ends:
            connected=[b for b in majors if any(touch(s,b) and touch(s,clip) for s in seats)]
            assert len(connected)==1, 'A roof spreader end has no unique bearing'
            hosts+=connected
        assert len(set(p.serial for p in hosts))==2
        roof_beams=hosts
    for rim in rims:
        assert any(touch(rim,s) and any(touch(s,r) for r in rods) for s in lower_hardware)
    corbels=layers['Studio core corbels']
    assert len(corbels)==4
    assert all(any(touch(c,s) and any(touch(s,w) for w in cores) for s in seats) for c in corbels)
    east_rim=next(r for r in rims if r.hi[0]-r.lo[0]>8)
    assert sum(touch(east_rim,c) for c in corbels)==2
    assert any(touch(east_rim,s) and any(touch(s,b) for b in layers['Teaching balcony brackets']) for s in seats)
    # The long arm of the L-shaped landing spans to an inner steel ledger.
    west_deck=min(panels,key=lambda p:p.center[0])
    assert any(touch(west_deck,s) and any(touch(s,g) for g in layers['Glulam floor girders']) for s in seats)
    # Estimate loads from the two-way-supported CLT, including the end bay
    # of the adjoining edge beam. The remaining east bays sit on core corbels.
    pressure=(DECK_DEAD+DECK_LIVE)/1000
    y0,y1=west_deck.lo[1],west_deck.hi[1]
    rod_y=sorted(r.center[1] for r in rods)
    line=pressure*(west_deck.hi[0]-west_deck.lo[0])/2
    right=line*(y1-y0)*((y0+y1)/2-rod_y[0])/(rod_y[1]-rod_y[0])
    left=line*(y1-y0)-right
    next_cantilever=min(c.center[0] for c in corbels)
    extra=pressure*(6.42-4.90)/2*(next_cantilever-west_deck.hi[0])/2
    hanger_kN=[left+extra,right]
    # Simply supported constant-section glulam. Uniform roof loading and
    # self-weight plus the local gallery point loads; roof diaphragm not credited.
    x0,x1=sorted(p.center[0] for p in roof_beams)
    xf=rods[0].center[0]
    transfers=[(x1-xf)/(x1-x0),(xf-x0)/(x1-x0)]
    results=[]
    for girder,fraction in zip(sorted(roof_beams,key=lambda p:p.center[0]),transfers):
        width,span,depth=girder.hi-girder.lo
        y=np.linspace(0,span,1001)
        def response(w):
            inert=w*depth**3/12
            uniform=(ROOF_DEAD+ROOF_VARIABLE)*3.6+DENSITY*9.81*w*depth
            disp=uniform*y*(span**3-2*span*y**2+y**3)/(24*E*inert)
            ref=1000*disp.max()
            for load,location in zip(hanger_kN,rod_y):
                a=location-girder.lo[1];b=span-a;P=load*1000*fraction
                disp+=np.where(y<=a,P*b*y*(span**2-b**2-y**2),P*a*(span-y)*(span**2-a**2-(span-y)**2))/(6*span*E*inert)
            return round(float(ref),1),round(float(1000*disp.max()),1)
        ref,loaded=response(width)
        assert loaded<span*1000/360, 'A gallery-supported roof girder exceeds the study deflection target'
        results.append(dict(station_x_m=round(float(girder.center[0]),2),
                    girder_section_mm=[round(float(width*1000)),round(float(depth*1000))],
                    added_roof_reaction_kN=round(float(fraction*sum(hanger_kN)),2),
                    previous_550_mm_section_with_gallery_mm=response(.55)[1],
                    study_span_over_360_mm=round(float(span*1000/360),1),
                    roof_only_elastic_mm=ref,roof_plus_gallery_elastic_mm=loaded))
    return dict(supported_CLT_approach_pieces=len(panels),suspension_rods=len(rods),
            spreader_end_bearings=4,core_corbel_stations=2,existing_roof_girders=len(roof_beams),
            gallery_area_pressure_kPa=pressure,hanger_service_reactions_kN=[round(float(x),2) for x in hanger_kN],
            girders=results,scope='Elastic gravity comparison using the assumed studio loads. No connection resistance, creep, vibration, fire or lateral design is certified.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('model',type=Path);p.add_argument('--report',type=Path)
    args=p.parse_args();report=json.dumps(audit(args.model),indent=2)
    if args.report:args.report.write_text(report+'\n')
    print(report)
