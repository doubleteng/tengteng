"""Combined glulam frame for both market inclines, the canopy and the annex bridge.

The center masts occupy only the existing separation between the two ramps.
For lateral stability five frames tie back above walking height to the north
vendor frame. Nothing from the high roof bears on a stair or ramp deck.
"""
import math
import geometry as g

S='Structure / '
WOOD='Douglas-fir glulam'
STEEL='Graphite steel'
ZINC='Galvanized silver'
RC='Board-formed concrete'
G,L2=2.50,6.4116
SPINE=22.75
STATIONS=(6.86,10.65,14.35,19.48,23.0456,27.9224,32.7992,37.676,
          42.5528,47.45,53.12,57.1832,62.06,65.30)
ROOF=STATIONS[3:-1]
VENDOR=(23.0456,32.7992,42.5528,52.3064,57.1832)
EAVES=(20.61,25.12)
WOOD_HALF=.086
HALF=.098
MIDDLE=(G+L2)/2
SLOPE=(L2-G)/(2*(47.45-6.55))
ROOF_RANGES=((19.20,33.90),(34.02,48.72),(48.84,63.54))
FACES=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]

def roof(x,y):
    return 10.42-(y-20.48)*math.tan(math.radians(8.5))

def wedge(label,material,x,y,X,Y,top,bottom):
    footprint=g.rect(x,y,X,Y)
    g.solid(S+label,material,[(u,v,f(u,v) if callable(f) else f) for f in (bottom,top)
                              for u,v in footprint],FACES)

def block(label,material,x,y,z,X,Y,Z):
    g.box(S+label,material,x,y,z,X,Y,Z)

def rod(label,material,a,b,w,h=None):
    g.beam(S+label,material,a,b,w,h)

def branch(x,side,y_end,top,depth,width,label,terrain):
    """Seat the inner end and triangulate the arm back to its own mast."""
    face=SPINE+side*HALF
    lower=lambda u,v:top(u,v)-depth
    y,Y=sorted((face+side*.014,y_end))
    if side>0 and x>=37:
        # The final two bents approach grade. A tapered reinforced concrete
        # cantilever grows out from the SAME spread footing below each mast.
        # Join the split pour at the pedestal side; no second foundation.
        cap_depth=.17
        wedge('Arcade ramp ground caps',RC,x-width/2,y,x+width/2,Y,top,
              lambda u,v:top(u,v)-cap_depth)
        foot_top=terrain(x,SPINE)-.68
        wedge('Arcade ramp foundation arms',RC,x-.16,SPINE+.36,x+.16,24.88,
              lambda u,v:top(u,v)-cap_depth,foot_top)
        return
    wedge(label,WOOD,x-width/2,y,x+width/2,Y,top,lower)
    h=top(x,face)
    # Keep the pocket between timber faces. Plate under the root takes gravity.
    y,Y=sorted((face,face+side*.014))
    block('Arcade branch shoes',STEEL,x-width/2-.015,y,h-depth-.020,x+width/2+.015,Y,h-.025)
    y,Y=sorted((face,face+side*.19))
    wedge('Arcade branch shoes',STEEL,x-width/2-.015,y,x+width/2+.015,Y,lower,
          lambda u,v:lower(u,v)-.020)
    for dx in (-width*.30,width*.30):
        for zz in (h-depth*.32,h-depth*.72):
            rod('Arcade branch fasteners',STEEL,(x+dx,face-side*.135,zz),(x+dx,face+side*.028,zz),.014)
    tip=face+.71*(y_end-face)
    reach=abs(tip-face)
    drop=min(.95,.55*reach)
    if side<0 and x>46:drop=min(drop,.40)
    start_z=max(h-depth-drop, min(h-depth-.05,terrain(x,face)+.17))
    # Slender lower branches near the landing receive a shallow, welded haunch.
    # The floor-side heel stays within the slot; the knee only occupies the
    # section beneath its own stringers.
    # Plumb cut at the column and horizontal bearing cut under the fork.
    # The paired heel and toe shoes take compression across real faces;
    # the pins restrain uplift, not the entire compression reaction.
    width_k=min(width,.14)
    top_z=h-depth-.014
    rate=(top_z-start_z)/reach
    dz=.185*math.sqrt(1+rate**2)/2
    toe_near=reach-dz/rate
    toe_far=reach+dz/rate
    def pt(dx,d,z):
        return (x+dx,face+side*d,z+lower(x+dx,face)-lower(x,face))
    heel=.014
    profile=[(heel,start_z+rate*heel-dz),(heel,start_z+rate*heel+dz),
             (toe_near,top_z),(toe_far,top_z)]
    g.solid(S+'Arcade underside knees',WOOD,
            [pt(dx,d,z) for dx in (-width_k/2,width_k/2) for d,z in profile],FACES)
    a,b=sorted((face,face+side*heel))
    wedge('Arcade knee heel plates',STEEL,x-width_k/2-.012,a,x+width_k/2+.012,b,
          lambda u,v:start_z+rate*heel+dz+lower(u,v)-lower(x,face),
          lambda u,v:start_z+rate*heel-dz+lower(u,v)-lower(x,face))
    a,b=sorted((face,face+side*.16))
    heel_low=lambda u,v:start_z+rate*side*(v-face)-dz+lower(u,v)-lower(x,face)
    wedge('Arcade knee heel seats',STEEL,x-width_k/2-.012,a,x+width_k/2+.012,b,heel_low,
          lambda u,v:heel_low(u,v)-.015)
    a,b=sorted((face+side*toe_near,face+side*toe_far))
    wedge('Arcade knee head seats',STEEL,x-width_k/2,a,x+width_k/2,b,lower,
          lambda u,v:lower(u,v)-.014)
    for yy,zz in ((face,start_z),(tip,top(x,tip)-depth+.035)):
        a,b=sorted((yy-side*.10,yy+side*.13))
        block('Arcade knee gussets',STEEL,x-.009,a,zz-.085,x+.009,b,zz+.085)
    for yy,zz in ((face-side*.055,start_z),(tip,top(x,tip)-depth+.035)):
        rod('Arcade branch fasteners',STEEL,(x-width*.52,yy,zz),(x+width*.52,yy,zz),.018)

def roof_head(x):
    bottoms=[roof(x,y+.13)-.23-.51 for y in EAVES]
    lower=bottoms[-1]-.39
    ys=(EAVES[0]-.13,EAVES[0]+.13,EAVES[1]-.13,EAVES[1]+.13)
    zs=(bottoms[0],bottoms[0],bottoms[1],bottoms[1])
    pts=[(X,y,lower if low else z) for y,z in zip(ys,zs)
         for X,low in ((x-.18,True),(x+.18,True),(x+.18,False),(x-.18,False))]
    faces=[[0,1,2,3],[12,13,14,15]]
    for n in (0,4,8):
        faces.extend([[n+i,n+(i+1)%4,n+4+(i+1)%4,n+4+i] for i in range(4)])
    g.solid(S+'Arcade cantilever crossheads',WOOD,pts,faces)
    block('Arcade mast capitals',STEEL,x-.226,SPINE-.086,lower-.024,x+.226,SPINE+.086,lower)
    # Two side cheeks and pins restrain uplift and rolling of the header.
    for dx in (-.187,.187):
        block('Arcade mast cap cheeks',STEEL,x+dx-.007,SPINE-.115,lower,x+dx+.007,SPINE+.115,lower+.22)
    for h in (lower+.07,lower+.16):
        rod('Arcade cap pins',STEEL,(x-.203,SPINE,h),(x+.203,SPINE,h),.018)
    return lower-.024

def mast(x,terrain,top):
    low=terrain(x,SPINE)
    transfer=x==47.45
    cap=low-(.97 if transfer else .68)
    pad=low-.27
    side=.105 if transfer else .36
    # The annex bridge lies wholly to the north. Its foundations shift toward
    # that load so their soil resultants remain inside the middle third.
    offset=-1.18 if x==STATIONS[-1] else -.76 if x>=47.45 else 0.
    width=3.20 if x==STATIONS[-1] else 3.00
    length=2.35 if x==STATIONS[-1] else 2.18 if x>=47.45 else 2.02
    depth=.64 if x==STATIONS[-1] else .58 if x>=47.45 else .55
    block('Arcade spine footings',RC,x-length/2,SPINE+offset-width/2,cap-depth,
          x+length/2,SPINE+offset+width/2,cap)
    north=.69 if transfer else .36
    block('Arcade spine pedestals',RC,x-.52,SPINE-north,cap,x+.52,SPINE+side,pad)
    block('Arcade spine base shoes',STEEL,x-.40,SPINE-(.595 if transfer else .30),pad,x+.40,SPINE+min(.30,side),pad+.03)
    block('Arcade spine base stems',STEEL,x-.255,SPINE-WOOD_HALF,pad+.03,x+.255,SPINE+WOOD_HALF,low+.23)
    block('Arcade spine masts',WOOD,x-.255,SPINE-WOOD_HALF,low+.23,x+.255,SPINE+WOOD_HALF,top)
    for dx in (-.32,.32):
        for dy in (-.52 if transfer else -.235,.065 if transfer else .235):
            seat=cap-depth+.09
            rod('Arcade foundation anchors',STEEL,(x+dx,SPINE+dy,seat),(x+dx,SPINE+dy,pad+.052),
                .034 if transfer else .030)
            block('Arcade embedded anchor heads',STEEL,x+dx-.054,SPINE+dy-.054,seat-.014,
                  x+dx+.054,SPINE+dy+.054,seat)
    # Welded triangular stiffeners take the base flange force to the anchor
    # rows, particularly on the wide north heel at the bridge threshold.
    for dx in (-.206,.206):
        for side_dir,reach in ((-1,.55 if transfer else .265),(1,.102 if transfer else .265)):
            y1=SPINE+side_dir*HALF
            y2=SPINE+side_dir*reach
            if abs(y2-y1)<.07:continue
            z=pad+.03
            pts=[(xx,yy,zz) for xx in (x+dx-.008,x+dx+.008)
                 for yy,zz in ((y1,z),(y2,z),(y1,z+.25))]
            g.solid(S+'Arcade base plate ribs',STEEL,pts,
                    [[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]])
    # Twin collected steel flanges form the fore/aft tension couple for
    # single-sided deck loading. Welded to the base plate, each runs to the
    # highest fork anchor. The wood section remains continuous to the roof.
    branch_top=(MIDDLE+(x-6.55)*SLOPE-.455 if x<=47.45 else L2-.19-.26-.45)
    flange_top=min(top,branch_top+.035)
    for y in (SPINE-(HALF+WOOD_HALF)/2,SPINE+(HALF+WOOD_HALF)/2):
        block('Arcade base fork plates',STEEL,x-.25,y-.006,pad+.03,x+.25,y+.006,flange_top)
    count=math.ceil((flange_top-low-.44)/.46)
    for dx in (-.145,.145):
        for i in range(count+1):
            z=low+.34+(flange_top-low-.44)*i/count
            rod('Arcade base through pins',STEEL,(x+dx,SPINE-HALF-.007,z),(x+dx,SPINE+HALF+.007,z),.020)

def turn(mast_x):
    """The turning deck's two crossbeams bear on one triangulated west arm."""
    cross_top=MIDDLE-.17
    spine_top=cross_top-.33
    end=mast_x-.255
    block('Arcade turn cantilever',WOOD,4.23,SPINE-.12,spine_top-.415,end-.012,SPINE+.12,spine_top)
    block('Arcade turn root shoe',STEEL,end-.012,SPINE-.133,spine_top-.44,end,SPINE+.133,spine_top)
    block('Arcade turn root shoe',STEEL,end-.21,SPINE-.133,spine_top-.435,end,SPINE+.133,spine_top-.415)
    for x in (4.45,6.30):
        block('Market turn crossheads',WOOD,x-.11,20.39,spine_top,x+.11,25.11,cross_top)
    heel_z=spine_top-1.20
    seat_z=spine_top-.415-.014
    rate=(seat_z-heel_z)/(end-4.60)
    dz=.24*math.sqrt(1+rate**2)/2
    d=(end-4.60)
    toe_x=(end-d-dz/rate,end-d+dz/rate)
    profile=[(end-.014,heel_z+rate*.014-dz),(end-.014,heel_z+rate*.014+dz),
             (toe_x[1],seat_z),(toe_x[0],seat_z)]
    g.solid(S+'Arcade turn knee',WOOD,[(xx,yy,zz) for yy in (SPINE-.095,SPINE+.095) for xx,zz in profile],FACES)
    block('Arcade turn knee bearing plates',STEEL,end-.014,SPINE-.106,heel_z+rate*.014-dz,
          end,SPINE+.106,heel_z+rate*.014+dz)
    block('Arcade turn knee head plate',STEEL,toe_x[0],SPINE-.095,seat_z,toe_x[1],SPINE+.095,seat_z+.014)
    heel_low=lambda u,v:heel_z+rate*(end-u)-dz
    wedge('Arcade turn knee heel seat',STEEL,end-.16,SPINE-.106,end,SPINE+.106,
          heel_low,lambda u,v:heel_low(u,v)-.015)
    for z in (spine_top-.16,spine_top-1.20):
        block('Arcade turn connection plates',STEEL,end-.16,SPINE-.009,z-.105,end+.15,SPINE+.009,z+.105)
    for x,z in ((end+.09,spine_top-.16),(end+.09,spine_top-1.20),(4.60,spine_top-.43)):
        rod('Arcade turn bolts',STEEL,(x,SPINE-.142,z),(x,SPINE+.142,z),.023)

def bridge():
    """Common longitudinal girders carry joists into the threshold, bridge and entrance."""
    girder_top=L2-.19-.26
    for y in (20.08,21.60):
        block('Arcade bridge longitudinal girders',WOOD,47.45,y-.09,girder_top-.45,65.98,y+.09,girder_top)
    groups=[(47.45,49.73,18.99,22.61,.17),(49.73,64.02,19.98,21.74,.19),(64.02,65.98,18.04,21.74,.19)]
    for a,b,y,Y,thick in groups:
        n=max(2,math.ceil((b-a)/1.30))
        for i in range(n+1):
            x=a+.10+(b-a-.20)*i/n
            # Continuous joist over BOTH longitudinal bearings. The short
            # cantilever into the annex keeps the ground entrance clear.
            block('Arcade bridge joists',WOOD,x-.073,y,girder_top,x+.073,Y,L2-thick)
            for yy in (20.08,21.60):
                for dx in (-.078,.078):
                    block('Arcade bridge hold-downs',STEEL,x+dx-.005,yy-.055,girder_top-.12,
                          x+dx+.005,yy+.055,girder_top+.13)
                rod('Arcade bridge hold-downs',STEEL,(x-.088,yy,girder_top+.075),(x+.088,yy,girder_top+.075),.015)

def roof_deck():
    # Expansion joints are in the three CLT roof fields. Longitudinal glulam
    # joints are over shared bents, with generous bearing on both sides.
    joins=[19.20,*ROOF[1:-1],63.54]
    for y,direction in zip(EAVES,(1,-1)):
        base=roof(0,y+.13)-.23-.51
        for l,r in zip(joins,joins[1:]):
            wedge('Arcade eave girders',WOOD,l,y-.13,r,y+.13,lambda u,v:roof(u,v)-.23,base)
            yy,YY=sorted((y+direction*.13,y+direction*.22))
            g.plate(S+'Arcade rafter ledgers',WOOD,g.rect(l,yy,r,YY),lambda u,v:roof(u,v)-.23-.34,.12)
    for a,b in ROOF_RANGES:
        n=math.ceil((b-a)/2.5)
        for j in range(n+1):
            x=a+.14+(b-a-.28)*j/n
            g.plate(S+'Arcade roof rafters',WOOD,g.rect(x-.080,EAVES[0]+.13,x+.080,EAVES[1]-.13),
                    lambda u,v:roof(u,v)-.23,.34)
    # Roof diaphragm collectors take longitudinal action into two braced
    # centerline bays. X-rods are wholly inside the protected center gap.
    for a,b in ((23.0456,27.9224),(53.12,57.1832)):
        for z,Z in ((7.03,8.49),(8.49,7.03)):
            rod('Arcade longitudinal wind ties',STEEL,(a,SPINE,z),(b,SPINE,Z),.032)
            for x,h in ((a,z),(b,Z)):
                block('Arcade wind clips',STEEL,x-.070,SPINE-.055,h-.09,x+.070,SPINE+.055,h+.09)
    # Each pinned, high transverse link restrains the spine out of plane.
    # Its far end is on an existing vendor post, not on the roof skin.
    for x in VENDOR:
        axis=53.12 if x==52.3064 else x
        rod('Arcade transverse stability links',STEEL,(axis,SPINE+.135,8.16),(x,25.55,5.66),.11,.14)
        for u,face,d,h in ((axis,SPINE+WOOD_HALF,1,8.16),(x,25.60,-1,5.66)):
            a,b=sorted((face,face+d*.014))
            block('Arcade wind clips',STEEL,u-.105,a,h-.14,u+.105,b,h+.14)
            a,b=sorted((face+d*.012,face+d*.083))
            for dx in (-.063,.063):
                block('Arcade wind clevis',STEEL,u+dx-.007,a,h-.074,u+dx+.007,b,h+.074)
            rod('Arcade wind pins',STEEL,(u-.077,face+d*.05,h),(u+.077,face+d*.05,h),.025)
            for dx in (-.075,.075):
                for z in (h-.105,h+.105):
                    rod('Arcade wind anchors',STEEL,(u+dx,face-d*.13,z),(u+dx,face+d*.018,z),.016)

def build_arcade(terrain):
    for x in STATIONS:
        if x in ROOF:top=roof_head(x)
        elif x<19:top=MIDDLE+(x-6.55)*SLOPE-.455-.025
        else:top=L2-.19-.26-.45-.025
        mast(x,terrain,top)
        if x<=47.45:
            for side,end in ((-1,20.64),(1,25.135)):
                if x==47.45 and side==1:continue # Independent toe on grade.
                u=x-.12 if x==47.45 else x
                top=lambda X,Y,side=side:MIDDLE-side*(X-6.55)*SLOPE-.455
                branch(u,side,end,top,.30,.22,'Arcade ramp fork arms',terrain)
        if x>=47.45:
            u=x+.12 if x==47.45 else x
            branch(u,-1,19.97,lambda X,Y:L2-.19-.26-.45,.37,.23,'Arcade bridge fork arms',terrain)
    turn(STATIONS[0]);bridge();roof_deck()
