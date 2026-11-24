"""Cantilever promenade, registered east/south/elevation coordinates in metres."""
from dataclasses import dataclass

import geometry as g

S = 'Structure / '
E = 'Enclosure / '
METAL = 'Galvanized silver'
STEEL = 'Graphite steel'
TIMBER = 'Douglas-fir glulam'
GASKET = 'Dark reveal'
WEST_SKIN, NORTH_SKIN, SOUTH_SKIN = 2.15, 1.235, 18.875
L2, L3 = 6.4116, 10.6788
# Original structural fixing line is retained. The north walk reaches the
# outside of a slim spandrel cap; the truss and insulation are inboard of it.
NORTH_WALK_EDGE, NORTH_PANEL_BACK = 1.273, 1.315
NORTH_GLAZING = (NORTH_WALK_EDGE+NORTH_PANEL_BACK)/2
XA, XB, NORTH_END = 2.16, 47.45, 46.90
SLOPE = (L3-L2)/((XB-XA)+(18.46-1.82)+(NORTH_END-XA))
WEST_LOW = L2+(XB-XA)*SLOPE
WEST_HIGH = WEST_LOW+(18.46-1.82)*SLOPE
ARM_WIDTH, ARM_DEPTH = .160, .260
BEAM_BOTTOM, SEAT = .455, .475
SIDES = {'north':(1, NORTH_SKIN, -1), 'south':(1, SOUTH_SKIN, 1), 'west':(0, WEST_SKIN, -1)}
STRINGERS = {'north':(.105,1.045),'south':(19.24,20.50),'west':(.24,1.91)}
WEST_STATIONS = (2.10, 5.85, 10.00, 14.15, 17.90)
REGULAR = tuple(round(2.6+3.6*i,2) for i in range(13))


def level(side, at):
    if side == 'north':
        return WEST_HIGH+SLOPE*max(0.,min(NORTH_END,at)-XA)
    if side == 'south':
        return L2+SLOPE*max(0.,XB-max(XA,at))
    return WEST_LOW+SLOPE*max(0.,18.46-max(1.82,at))


@dataclass(frozen=True)
class Arm:
    side: str
    at: float

    @property
    def top(self):
        return level(self.side,self.at)-SEAT

    @property
    def opening(self):
        half=ARM_WIDTH/2+.025
        return self.at-half,self.at+half,self.top-ARM_DEPTH-.025,self.top+.025


ARMS = tuple(Arm(side,at) for side,stations in (
    ('north',(*REGULAR,48.10)),('south',(*REGULAR,49.40)),('west',WEST_STATIONS)
) for at in stations)


def block(layer, mat, side, p0,p1, q0,q1, z,Z):
    """P runs along the facade; Q runs across it."""
    p,P=sorted((p0,p1));q,Q=sorted((q0,q1))
    if side=='west':
        g.box(layer,mat,q,p,z,Q,P,Z)
    else:
        g.box(layer,mat,p,q,z,P,Q,Z)


def weather_detail(arm):
    side,at=arm.side,arm.at
    _,face,out=SIDES[side]
    p,P,b,t=arm.opening
    wall_in,wall_out=face-out*.084,face+out*.101
    if side=='north':
        wall_in,wall_out=NORTH_PANEL_BACK+.003,NORTH_WALK_EDGE-.003
    # Four welded faces around a through-opening; a final 4 mm compressed
    # gasket closes the annulus between the sleeve and the steel neck.
    for mat,layer,qi,qo,x,X,y,Y,edge in [
        (METAL,E+'Gallery penetration sleeves',wall_in,wall_out,p,P,b,t,.006),
        (GASKET,E+'Gallery sleeve seals',wall_out,wall_out+out*.004,
         p+.006,P-.006,b+.006,t-.006,.019),
    ]:
        for a,A,c,C in ((x,X,y,y+edge),(x,X,Y-edge,Y),(x,x+edge,y+edge,Y-edge),
                        (X-edge,X,y+edge,Y-edge)):
            block(layer,mat,side,a,A,qi,qo,c,C)


def arm_bearings(arm):
    side,at=arm.side,arm.at
    for q in STRINGERS[side]:
        p0,p1=at-.07,at+.07
        if side=='west':
            poly=g.rect(q-.063,p0,q+.063,p1)
            z=lambda x,y:level(side,y)-BEAM_BOTTOM
        else:
            poly=g.rect(p0,q-.063,p1,q+.063)
            z=lambda x,y:level(side,x)-BEAM_BOTTOM
        vs=[(x,y,arm.top) for x,y in poly]+[(x,y,z(x,y)) for x,y in poly]
        g.solid(S+'Gallery bearing pads',STEEL,vs,[[0,1,2,3],[4,5,6,7],[0,1,5,4],
                                                   [1,2,6,5],[2,3,7,6],[3,0,4,7]])


def node_plate(arm, truss, out, chord, half_post):
    p,side=arm.at,arm.side
    # A folded plate sits flush against the widest bottom chord and wraps
    # to both cheeks of the actual truss upright above the node.
    timber_face=truss+out*.315
    arm_root=timber_face+out*.016
    z0=max(chord+.69,arm.top-.16)
    z1=z0+.44
    block(S+'Gallery timber connection plates',METAL,side,p-half_post-.016,p+half_post+.016,
          timber_face,arm_root,min(arm.top-ARM_DEPTH,z0-.09),z1+.10)
    for sign in (-1,1):
        x=p+sign*half_post
        block(S+'Gallery timber connection plates',METAL,side,x,x+sign*.016,
              truss-out*.105,timber_face,z0-.09,z1+.10)
    for z in (z0,z1):
        for q in (truss-.071,truss+.071):
            g.beam(S+'Gallery connection bolts',STEEL,(p-half_post-.023,q,z),
                   (p+half_post+.023,q,z),.028,.028)
    return arm_root


def north_threshold():
    # The terminal arm lies beyond the occupied door: a collector below the
    # sill spans between the two real uprights (45.80 and 49.40).
    z=L3-SEAT
    x0,x1=45.8+.45,49.4-.225
    g.box(S+'Gallery threshold trimmer',METAL,x0+.016,1.55,z-.30,x1-.016,1.75,z)
    for x,sign in ((x0,1),(x1,-1)):
        block(S+'Gallery timber connection plates',METAL,'north',x,x+sign*.016,
              1.53,1.77,z-.37,z+.05)
        for q in (1.59,1.71):
            for zz in (z-.24,z-.06):
                g.beam(S+'Gallery connection bolts',STEEL,(x-sign*.20,q,zz),(x+sign*.023,q,zz),.024)


def west_transfer(arm):
    y,top=arm.at,arm.top
    # A continuous backspan transfers the moment between the first and second
    # transverse L3 floor girders. Front links carry tension; rear links can
    # take compression. Both bolted saddles engage the timber side faces.
    girder_bottom=L3-.20-1.22
    for x in (2.60,6.20):
        block(S+'Gallery transfer links',METAL,'west',y-.056,y+.056,x-.056,x+.056,
              top,girder_bottom-.016)
        g.box(S+'Gallery timber connection plates',METAL,x-.207,y-.080,girder_bottom-.016,
              x+.207,y+.080,girder_bottom)
        for sign in (-1,1):
            a=x+sign*.19
            block(S+'Gallery timber connection plates',METAL,'west',y-.080,y+.080,
                  a,a+sign*.017,girder_bottom,girder_bottom+.37)
        for zz in (girder_bottom+.102,girder_bottom+.288):
            g.beam(S+'Gallery connection bolts',STEEL,(x-.216,y,zz),(x+.216,y,zz),.028)
    return 6.26


def landing_splices():
    # Along the west edge, paired 12 mm side plates and two rows of through-
    # bolts carry the landing moment across the change of pitch. Each splice
    # continues past the nearest building arm and into the supported span.
    for side,joint,remote,landing,bolt_stations in (
        ('north',1.82,3.50,.05,(.25,.75,1.33,1.62,2.02,2.36,2.87,3.30)),
        ('south',18.46,16.20,20.55,(16.48,17.06,17.64,18.24,18.68,19.05,19.62,20.26)),
    ):
        zflat=level('west',landing)
        for q in STRINGERS['west']:
            for sign in (-1,1):
                inside=q+sign*.075
                x,X=sorted((inside,inside+sign*.012))
                for y,Y in ((joint,remote),(joint,landing)):
                    y,Y=sorted((y,Y))
                    g.plate(S+'Gallery landing splice plates',METAL,g.rect(x,y,X,Y),
                            lambda u,v:level('west',v)-.187,.268)
            for v in bolt_stations:
                z=level('west',v)
                for zz in (z-.24,z-.40):
                    g.beam(S+'Gallery landing bolts',STEEL,(q-.094,v,zz),(q+.094,v,zz),.020)
        # Each crosspiece sits on two physical shelf seats welded to the paired
        # side plates of the perpendicular runners. The short outer tail has
        # a seat at its root and joins the adjacent supported flight stringer.
        for y in STRINGERS[side]:
            for x,sgn in ((.315,1),(1.835,-1),(1.985,1)):
                x0,x1=sorted((x,x+sgn*.16))
                g.box(S+'Gallery landing beam seats',METAL,x0,y-.066,zflat-BEAM_BOTTOM-.016,
                      x1,y+.066,zflat-BEAM_BOTTOM)
            for sy in (-1,1):
                # A stepped plate follows the 140/150 mm beam width transition.
                for x,X,half in ((1.997,XA,.070),(XA,3.42,.075)):
                    edge=y+sy*half
                    y0,y1=sorted((edge,edge+sy*.012))
                    g.plate(S+'Gallery landing splice plates',METAL,g.rect(x,y0,X,y1),
                            lambda u,v:level(side,u)-.187,.268)
            for x in (2.035,2.116,2.36,2.80,3.23):
                for zz in (level(side,x)-.24,level(side,x)-.40):
                    g.beam(S+'Gallery landing bolts',STEEL,(x,y-.096,zz),(x,y+.096,zz),.018)


def build_gallery(soffit):
    north_threshold()
    for arm in ARMS:
        side,p=arm.side,arm.at
        if side=='west':
            root=west_transfer(arm);tip=.164
        else:
            north=side=='north'
            truss,out=(1.65,-1) if north else (18.35,1)
            if north and p==48.10:
                root=1.55
            else:
                half=.45 if p in (13.4,45.8) else .225
                root=node_plate(arm,truss,out,soffit(p),half)
            tip=.012 if north else 20.565
        block(S+'Gallery cantilever arms',METAL,side,p-ARM_WIDTH/2,p+ARM_WIDTH/2,
              root,tip,arm.top-ARM_DEPTH,arm.top)
        arm_bearings(arm)
        weather_detail(arm)

    # Continue both longitudinal stringers through each end platform.
    for side,a,b in (('north',NORTH_END,48.48),('south',XB,49.73),
                     ('west',.01,1.82),('west',18.46,20.58)):
        z=level(side,(a+b)/2)
        for q in STRINGERS[side]:
            block(S+'Gallery landing beams',TIMBER,side,a,b,q-.075,q+.075,z-BEAM_BOTTOM,z-.17)

    # The two ends of each landing are boxed. Crosspieces butt into the west
    # runners and continue out to the two stringers of the next flight.
    for side,z in (('south',WEST_LOW),('north',WEST_HIGH)):
        for y in STRINGERS[side]:
            for x,X in ((.327,1.823),(1.997,XA)):
                g.box(S+'Gallery landing beams',TIMBER,x,y-.070,z-BEAM_BOTTOM,X,y+.070,z-.17)
    landing_splices()
