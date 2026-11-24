"""Shared back-to-back market eave supports. Coordinates are east, south and height."""
from dataclasses import dataclass
import math

import numpy as np

from geometry import beam, box, grade, plate, rect

S='Structure / '
WOOD='Glulam spruce'
STEEL='Graphite steel'
ZINC='Galvanized silver'
RC='Board-formed concrete'


@dataclass
class Bearing:
    bank:int
    side:int
    x:float
    y:float
    soffit:float
    beam_width:float
    post_width:float
    post_depth:float
    reaction_kn:float
    eave_top:tuple = ()


def common_axes(banks,depth,bay,step):
    stations=[]
    for y,n,first,h in banks:
        series=list(range(1,n,step))
        if n-series[-1]==1 and len(series)>1:series[-1]-=1
        stations.append([first+i*bay for i in [*series,n]])
    plan={(i,side,x):(x,y+(.36 if side==0 else depth-.36))
          for i,(y,n,first,h) in enumerate(banks) for side in (0,1) for x in stations[i]}
    for i in range(len(banks)-1):
        for x in stations[i]:
            adjacent=min(stations[i+1],key=lambda u:abs(x-u))
            if abs(x-adjacent)>.65:continue
            a,b=(i,1,x),(i+1,0,adjacent)
            shared=((x+adjacent)/2,(plan[a][1]+plan[b][1])/2)
            plan[a]=plan[b]=shared
    return stations,plan


def footprint(x,y,edge):
    # Clip the foundation to a plane parallel to the surveyed Detroit Street
    # parcel edge, rather than moving its whole bearing face away from the pier.
    lower=min(y-edge/2,57.87-edge)
    poly=rect(x-edge/2,lower,x+edge/2,lower+edge)
    def clear(point):return 82.906-40.5383*point[1]/57.912-.03-point[0]
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        A,B=clear(a),clear(b)
        if A>=0:out.append(a)
        if A*B<0:out.append(tuple(u+(v-u)*A/(A-B) for u,v in zip(a,b)))
    return out


def contact_pressures(poly,x,y,load):
    # Linear bearing-pressure distribution from the actual clipped polygon.
    v=np.array(poly)-[x,y];w=np.roll(v,-1,axis=0)
    x,y=v.T;X,Y=w.T
    cross=x*Y-X*y
    area=cross.sum()/2
    centre=np.array([((x+X)*cross).sum(),((y+Y)*cross).sum()])/(6*area)
    Ixx=((x*x+x*X+X*X)*cross).sum()/12-area*centre[0]**2
    Iyy=((y*y+y*Y+Y*Y)*cross).sum()/12-area*centre[1]**2
    Ixy=((x*Y+2*x*y+2*X*Y+X*y)*cross).sum()/24-area*centre.prod()
    gradient=np.linalg.solve([[Ixx,Ixy],[Ixy,Iyy]],-load*centre)
    pressure=load/area+(v-centre)@gradient
    return area,-centre,pressure.min(),pressure.max()


def support_banks(bearings,plan):
    groups={}
    for node in bearings:
        groups.setdefault(plan[node.bank,node.side,node.x],[]).append(node)
    results=[]
    for (cx,cy),nodes in groups.items():
        shared=len(nodes)==2
        load=sum(n.reaction_kn for n in nodes)
        width=.40 if shared else nodes[0].post_width
        depth=.42 if shared else nodes[0].post_depth
        grade_z=grade(cx,cy)
        cap_top=min(n.soffit for n in nodes)-(.050 if shared else 0)
        cap_depth=.40 if shared else 0
        head=cap_top-cap_depth
        floor=grade_z+.29
        # Indicative footings under the documented uniform roof service case.
        # No site-specific soil or lateral capacity is represented by this area.
        size=max(1.10,math.ceil(math.sqrt(load/105)*10)/10)
        shape=footprint(cx,cy,size)
        pad_top=grade_z-.43
        plate(S+'Vendor spread footings',RC,shape,pad_top,.40)
        base_width=.58 if shared else .46
        box(S+'Market plinths',RC,cx-base_width/2,cy-base_width/2,pad_top,
            cx+base_width/2,cy+base_width/2,grade_z+.24)
        box(S+'Vendor column shoes',STEEL,cx-width/2-.012,cy-depth/2-.012,grade_z+.24,
            cx+width/2+.012,cy+depth/2+.012,floor)
        if nodes[0].eave_top:
            from geometry import solid
            top=nodes[0].eave_top
            solid(S+'Vendor glulam columns',WOOD,[(x,y,floor) for x,y,h in top]+list(top),
                  [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
            # The northern eave post runs directly to its own sloped girder;
            # the market crossbeam meets the post on a bolted inboard shelf.
            face=cy+depth/2
            box(S+'Vendor transverse hangers',STEEL,cx-.16,face,head-.19,cx+.16,face+.012,head+.30)
            box(S+'Vendor transverse hangers',STEEL,cx-.15,face+.012,head-.026,cx+.15,face+.235,head)
            for ox in (-.092,.092):
                for level in (head-.095,head+.18):
                    beam(S+'Vendor hanger bolts',ZINC,(cx+ox,cy-depth/2-.006,level),
                         (cx+ox,face+.016,level),.022)
        else:
            box(S+'Vendor glulam columns',WOOD,cx-width/2,cy-depth/2,floor,cx+width/2,cy+depth/2,head)
        # Hold-down anchors and two through-dowels tie each base shoe to its stem.
        for ox in (-width*.30,width*.30):
            for oy in (-depth*.30,depth*.30):
                beam(S+'Vendor base anchors',ZINC,(cx+ox,cy+oy,grade_z-.11),(cx+ox,cy+oy,floor),.023)
        for ox in (-width/2-.009,width/2+.009):
            box(S+'Vendor column shoes',STEEL,cx+ox-.008,cy-.080,floor,cx+ox+.008,cy+.080,floor+.25)
        for z in (floor+.085,floor+.19):
            beam(S+'Vendor base dowels',ZINC,(cx-width/2-.020,cy,z),(cx+width/2+.020,cy,z),.017)
        if shared:
            cap_width=max(.49,max(abs(n.x-cx) for n in nodes)*2+nodes[0].beam_width+.10)
            first,last=sorted(nodes,key=lambda n:n.y)
            box(S+'Vendor shared capitals',WOOD,cx-cap_width/2,first.y-.19,head,
                cx+cap_width/2,last.y+.19,cap_top)
            for ox in (-.10,.10):
                beam(S+'Vendor capital dowels',STEEL,(cx+ox,cy,head-.18),(cx+ox,cy,head+.19),.026)
            for node in nodes:
                # Independent bearing pedestals keep differently pitched roofs
                # from sharing a rigid eave; no timber crosses the roof joint.
                a,b=node.x,node.y
                if node.soffit-cap_top>.052:
                    box(S+'Vendor stepped bearings',WOOD,a-.17,b-.17,cap_top,a+.17,b+.17,node.soffit-.05)
                box(S+'Vendor movement bearings',STEEL,a-.155,b-.15,node.soffit-.05,
                    a+.155,b+.15,node.soffit-.029)
                box(S+'Vendor movement bearing pads','Dark reveal',a-.15,b-.145,node.soffit-.029,
                    a+.15,b+.145,node.soffit-.014)
                box(S+'Vendor movement bearings',ZINC,a-.15,b-.145,node.soffit-.014,
                    a+.15,b+.145,node.soffit)
                # A pin fixed to this crosshead passes through a lengthwise
                # slot in a separate steel keeper. The two roofs can move
                # separately along their respective eaves on the resilient pads.
                out=-1 if node.side==0 else 1
                face=b+out*.158
                y0,y1=sorted((face,face+out*.014))
                z=node.soffit+.09
                for low,high in ((node.soffit-.048,z-.023),(z+.023,z+.075)):
                    box(S+'Vendor slotted bearing keepers',STEEL,a-.115,y0,low,a+.115,y1,high)
                for left,right in ((a-.115,a-.040),(a+.040,a+.115)):
                    box(S+'Vendor slotted bearing keepers',STEEL,left,y0,z-.023,right,y1,z+.023)
                y0,y1=sorted((b+out*.13,face+out*.014))
                box(S+'Vendor keeper heels',STEEL,a-.115,y0,node.soffit-.050,
                    a+.115,y1,node.soffit-.030)
                beam(S+'Vendor moving bearing pins',ZINC,(a,b+out*.07,z),(a,face+out*.022,z),.022)
        for node in nodes:
            direction=1 if node.side==0 else -1
            # The two knees meet the actual shared column at different planes.
            beam(S+'Vendor transverse knees',WOOD,(cx,cy,head-.68),
                 (node.x,node.y+direction*1.18,node.soffit+.07),.16,.20)
        height=(np.mean([z for x,y,z in nodes[0].eave_top]) if nodes[0].eave_top else head)-floor
        wood_weight=4.5*width*depth*height
        if shared:wood_weight+=4.5*cap_width*(last.y-first.y+.38)*cap_depth
        stem_weight=24.*base_width**2*(grade_z+.24-pad_top)
        area,offset,qmin,qmax=contact_pressures(shape,cx,cy,load+wood_weight+stem_weight)
        pad_weight=24.*.40
        cap_moment=max((n.reaction_kn*max(0,abs(n.y-cy)-depth/2) for n in nodes),default=0) if shared else 0
        results.append(dict(axis_m=[round(cx,3),round(cy,3)],banks=[n.bank+1 for n in nodes],
            column_mm=[round(width*1000),round(depth*1000)],footing_m=size,
            service_gravity_kn=round(load,2),footing_area_m2=round(area,3),
            footing_eccentricity_m=[round(float(e),3) for e in offset],
            gravity_contact_min_kpa=round(float(qmin)+pad_weight,2),
            gravity_contact_envelope_kpa=round(float(qmax)+pad_weight,2),
            gravity_column_mpa=round((load+wood_weight)/width/depth/1000,2),
            capital_root_bending_knm=round(cap_moment,2),
            capital_root_bending_mpa=round(6*cap_moment/cap_width/cap_depth**2/1000,2) if shared else 0.,
            separate_bearing_levels_m=[round(n.soffit,3) for n in nodes]))
    return results
