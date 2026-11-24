"""Five stepped timber tiers between the west collector and the portal crosshead."""
from geometry import beam, box, rect
from shell_skin import tapered_post

TIMBER = 'Douglas-fir glulam'
STEEL = 'Graphite steel'


def build_reading_tiers(level, chord):
    # The transverse CLT strips span between the stepped glulam stringers.
    # The aisle flushes with each tier. All five surface strips have a
    # common underside so each receives the same continuous bearing.
    west, east = 8.90, 13.40
    portal_face = east-.16
    tier_depth, skin = .90, .14
    ends = (2.22,17.90)
    bands = (ends[0],6.50,8.55,13.20,15.25,ends[1])
    stringers = (2.38,4.95,7.48,10.00,12.52,15.05,17.74)
    collector_x = 9.80
    west_face, east_face = collector_x-.36, collector_x+.36
    bearing_level=chord(collector_x)-.24
    collector_depth=.92

    def underside(x):
        distance = min(0,x-west_face)+max(0,x-east_face)
        return bearing_level-.195*distance

    collector='Structure / Reading tier collectors'
    box(collector,TIMBER,west_face,1.92,bearing_level-collector_depth,east_face,18.08,bearing_level)
    # Hanger soles carry the transverse collector on steel straps at each truss.
    for y,sign in ((1.65,1),(18.35,-1)):
        a,b=sorted((y+sign*.05,y+sign*.42))
        box('Structure / Collector seats',STEEL,west_face-.024,a,bearing_level-collector_depth-.03,
            east_face+.024,b,bearing_level-collector_depth)
        for x in (west_face-.018,east_face):
            box('Structure / Collector steel straps',STEEL,x,a,bearing_level-collector_depth,
                x+.018,b,chord(collector_x)+.20)
        for dz in (-.07,.10):
            beam('Structure / Collector seat pins',STEEL,(west_face-.025,y+sign*.13,chord(collector_x)+dz),
                 (east_face+.025,y+sign*.13,chord(collector_x)+dz),.027)
    for i in range(5):
        x,X=west+i*tier_depth,west+(i+1)*tier_depth
        z=level+(4-i)*.181
        for j,(y,Y) in enumerate(zip(bands,bands[1:])):
            layer='Circulation / Tribune treads' if j%2 else 'Interior / West reading tribune'
            mat='Chalk' if j%2 else 'Oiled birch'
            box(layer,mat,x,y,z-skin,min(X,portal_face),Y,z)
            if X>portal_face:
                # The last 160 mm seats directly on the existing crosshead.
                box(layer,mat,portal_face,y,level-.24,X,Y,z)
        cuts=sorted(set([x,min(X,portal_face)]+[u for u in (west_face,east_face) if x<u<min(X,portal_face)]))
        for y in stringers:
            for a,b in zip(cuts,cuts[1:]):
                tapered_post('Structure / Reading tier runners',TIMBER,rect(a,y-.095,b,y+.095),
                             lambda u,v:underside(u),lambda u,v:z-skin)
    # The stringer toes frame into the west face of the portal. The steel
    # shoes wrap the toes and fasten to the crosshead above its bottom face.
    for y in stringers:
        toe=underside(portal_face)
        tapered_post('Structure / Reading end shoes',STEEL,rect(portal_face-.16,y-.108,portal_face,y+.108),
                     lambda u,v:underside(u)-.018,lambda u,v:underside(u))
        for side in (-1,1):
            y0=y+side*.095
            ya,yb=sorted((y0,y0+side*.014))
            box('Structure / Reading end shoes',STEEL,portal_face-.12,ya,toe,portal_face,yb,level-.17)
            a,b=sorted((y0+side*.014,y0+side*.084))
            box('Structure / Reading end shoes',STEEL,portal_face-.014,a,toe,portal_face,b,level-.17)
            for zz in (toe+.07,level-.30):
                beam('Structure / Reading end shoe dowels',STEEL,
                     (portal_face-.015,y0+side*.046,zz),(portal_face+.13,y0+side*.046,zz),.024)
    for y in (ends[0]+.055,ends[1]-.055):
        # Set each base on its own level tread. The sloping rail spans above
        # the high side of every nosing, including the low curb rail.
        def rail_base(x):return level+.181*((east-x)/tier_depth)
        for h in (.095,.65,1.08):
            beam('Circulation / Tribune rails',STEEL,(west+.08,y,rail_base(west+.08)+h),
                 (east-.08,y,rail_base(east-.08)+h),.04,.042)
        for x in (west+.08,west+1.22,west+2.36,west+3.50,east-.08):
            z=level+(4-int((x-west)/tier_depth))*.181
            box('Circulation / Tribune rails',STEEL,x-.024,y-.024,z,x+.024,y+.024,rail_base(x)+1.08)
