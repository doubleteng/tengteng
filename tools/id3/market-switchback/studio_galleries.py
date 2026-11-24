"""Floor-edge framing for the upper classroom approach over the large hall."""
from geometry import box, beam

S = 'Structure / '
TIMBER = 'Douglas-fir glulam'


def roof_girder_width(x):
    # The two girders also receive point loads from the classroom gallery.
    return .69 if any(abs(x-station)<.01 for station in (13.4,17.0)) else .55


def support_studio_approach(level, roof_girder_top, steel):
    top = level-.20
    bottom = top-.38
    rim = S+'Studio approach rims'
    hardware = S+'Studio approach seats'
    # A steel angle on the existing full transverse girder takes the inside edge
    # of the first CLT panel. The outer glulam rim hangs from the roof frame.
    box(hardware,steel,13.58,4.91,top-.042,13.96,11.025,top)
    box(hardware,steel,13.58,4.91,top-.25,13.61,11.025,top-.042)
    box(rim,TIMBER,15.34,4.94,bottom,15.62,11.02,top)
    box(rim,TIMBER,15.63,5.96,bottom,24.09,6.20,top)
    for y in (6.47,10.36):
        # The hanger rod runs outside the walking edge and bears on the
        # spreader between the two complete transverse roof girders.
        spreader_top=roof_girder_top-.10
        spreader_bottom=spreader_top-.31
        west=13.4+roof_girder_width(13.4)/2
        east=17.0-roof_girder_width(17.0)/2
        box(S+'Studio gallery spreaders',TIMBER,west+.015,y-.095,spreader_bottom,east-.015,y+.095,spreader_top)
        for face,sgn in ((west,1),(east,-1)):
            lo,hi=sorted((face,face+sgn*.19))
            box(hardware,steel,lo,y-.12,spreader_bottom-.02,hi,y+.12,spreader_bottom)
            lo,hi=sorted((face-.012,face+.012))
            box(hardware,steel,lo,y-.135,spreader_bottom-.06,hi,y+.135,spreader_top)
            for z in (spreader_bottom+.035,spreader_top-.045):
                beam(hardware,steel,(face-sgn*.22,y,z),(face+sgn*.012,y,z),.026)
        # Faces of the nut, washer and plate meet at the top of the spreader.
        hx=15.68
        box(hardware,steel,hx-.085,y-.08,spreader_top,hx+.085,y+.08,spreader_top+.020)
        beam(S+'Studio gallery suspension rods',steel,(hx,y,bottom-.035),(hx,y,spreader_top+.058),.044)
        box(hardware,steel,15.33,min(y-.07,5.95) if y<7 else y-.08,bottom-.035,
            15.82,y+.07,bottom)
    # Two triangular corbels on the solid stair wall support the middle edge
    # beam. Their wall plates and anchors sit clear of the stair entrance.
    for x in (17.0,20.6):
        box(hardware,steel,x-.12,4.895,bottom-1.05,x+.12,4.92,bottom+.025)
        beam(S+'Studio core corbels',steel,(x,4.92,bottom-.075),(x,6.19,bottom-.075),.16,.15)
        beam(S+'Studio core corbels',steel,(x,4.91,bottom-.97),(x,6.08,bottom-.13),.13,.14)
        for z in (bottom-.91,bottom-.09):
            beam(hardware,steel,(x,4.78,z),(x,4.92,z),.032)
    # Seat the east end of the rim on the first lounge bracket at x24.2.
    box(hardware,steel,23.87,5.94,bottom-.020,24.10,6.14,bottom)
    box(hardware,steel,24.09,5.94,bottom-.04,24.12,6.14,top)
    # Short ledgers let the re-entrant landing bear on the concrete core end.
    box(hardware,steel,21.385,3.66,top-.028,21.60,4.89,top)
    box(hardware,steel,21.38,3.66,top-.21,21.405,4.89,top-.028)


def office_edge(level, steel):
    # The two timber arms take the CLT directly. A framed edge joins their
    # outer ends and supports the exposed short edge of the adjacent bay.
    top=level-.20
    bottom=top-.33
    box(S+'Office balcony rim',TIMBER,35.12,7.23,bottom,38.48,7.45,top)
    for face,out in ((35.11,1),(38.49,-1)):
        lo,hi=sorted((face,face+out*.19))
        box(S+'Office rim shoes',steel,lo,7.21,bottom-.020,hi,7.45,bottom)
        box(S+'Office rim shoes',steel,face-.012,7.21,bottom-.04,face+.012,7.45,top-.018)
        for z in (bottom+.05,top-.09):
            beam(S+'Office rim dowels',steel,(face-out*.16,7.32,z),(face+out*.015,7.32,z),.025)
