"""Fixed weather frames for the exterior doors drawn by walk-doors.js.

Coordinates are the as-built rough openings. The three concertina assemblies
remain the original indexed glass leaves in rooms.py, moved by the viewer.
"""
from geometry import box, plate, rect
from gallery_cantilevers import NORTH_WALK_EDGE, NORTH_PANEL_BACK
from shell_skin import G, L2, L3, wall_foot, tapered_post

FRAME = 'Enclosure / Entrance frames and thresholds'
GLAZING = 'Enclosure / Market hall fixed sidelights'
PANEL = 'Enclosure / Insulated entrance infill'
SILVER = 'Galvanized silver'
GASKET = 'Dark reveal'
WOOD = 'Oiled birch'
GLASS = 'Vision glass'


def strip(layer, material, axis, d, D, a, b, z, Z):
    if axis==0:
        box(layer,material,a,d,z,b,D,Z)
    else:
        box(layer,material,d,a,z,D,b,Z)


def swing_frame(axis, plane, a, b, floor, height, jamb, swing, rough_head, rough_plane=None):
    """Stop is on the non-swing side. Both the hinge knuckle and handle clear it."""
    head=floor+height
    outer=plane if rough_plane is None else rough_plane
    stop=plane-swing*.025
    back=plane-swing*.047
    d,D=sorted((stop,back))
    jambs=((a,a+jamb),(b-jamb,b))
    for i,(start,end) in enumerate(jambs):
        # A rebated frame backs the moving stile. Its narrow wing spans the
        # closed joint; the deep face stays clear of the rotating panel edge.
        l,r=(start,end-.027) if i==0 else (start+.027,end)
        strip(FRAME,SILVER,axis,plane-.023,plane+.023,l,r,floor,head)
        l,r=(start,end+.012) if i==0 else (start-.012,end)
        strip(FRAME,GASKET,axis,d,D,l,r,floor,head-.004)
    strip(FRAME,SILVER,axis,plane-.038,plane+.038,a,b,head-.017,head)
    strip(FRAME,GASKET,axis,d,D,a+jamb,b-jamb,head-.031,head-.017)
    # Compression seal below the closed leaf. Nine millimetres is below the
    # door undercut, and the 4 mm nose clears the open threshold.
    strip(FRAME,GASKET,axis,plane-.023,plane+.023,a+jamb,b-jamb,floor+.001,floor+.008)
    if rough_head>head+.001:
        strip(PANEL,WOOD,axis,plane-.052,plane+.052,a,b,head,rough_head)
    if abs(outer-plane)>.10:
        # The hall west doors swing at its inner framed plane; its recessed
        # jamb returns connect back to the insulated facade skins.
        d,D=sorted((outer,plane))
        for l,r in ((a-.04,a),(b,b+.04)):
            strip(PANEL,WOOD,axis,d,D,l,r,floor,rough_head)
        strip(PANEL,WOOD,axis,d,D,a,b,max(head,rough_head-.045),rough_head)


def hall_sidelight(a,b):
    """Inset fixed glazing in a continuous insulated frame behind the folded stacks."""
    bottom=G+.22
    top=5.08-.072
    for u,U in ((a,a+.060),(b-.060,b)):
        box(FRAME,SILVER,u,18.157,G,U,18.203,5.08)
    box(PANEL,WOOD,a+.060,18.160,G,b-.060,18.201,bottom)
    box(FRAME,SILVER,a+.060,18.157,bottom,b-.060,18.203,bottom+.050)
    box(FRAME,SILVER,a+.060,18.157,top,b-.060,18.203,5.08)
    width=b-a-.12
    count=max(1,round(width/1.40))
    for i in range(count):
        u=a+.060+width*i/count;U=a+.060+width*(i+1)/count
        if i:
            box(FRAME,SILVER,u-.022,18.159,bottom+.050,u+.022,18.202,top)
        box(GLAZING,GLASS,u+(.022 if i else 0),18.173,bottom+.050,
            U-(.022 if i+1<count else 0),18.190,top)


def folded_hall():
    for a,b,banks in ((15.95,22.15,[(17.0615,19.2515)]),
                      (29.30,35.50,[(29.4115,31.6015),(32.3015,34.4915)])):
        at=a
        for left,right in banks:
            if left-at>.19:
                hall_sidelight(at,left)
            else:
                box(FRAME,SILVER,at,18.157,G,left,18.203,5.08)
            # The backstop overlaps the outer edges in projection. The
            # concertina hardware moves south from the rear weather rebate.
            for l,r in ((left-.018,left+.012),(right-.012,right+.018)):
                box(FRAME,GASKET,l,18.196,G,r,18.205,5.08)
            at=right
        hall_sidelight(at,b)
        # The continuous head fills the sloping perimeter up to the underside
        # of the building, including the real change of gradient at x17.
        cuts=sorted({a,b,*[x for x in (17.0,) if a<x<b]})
        for l,r in zip(cuts,cuts[1:]):
            # The local soffit rises through the door head at the west end.
            # Use the true full height up to the shell. The existing panel
            # takes over where the catalogue opening is lower than the soffit.
            tapered_post(PANEL,WOOD,rect(l,18.157,r,18.318),lambda x,y:5.138,
                         lambda x,y:min(5.67,wall_foot(x)))
        # The front face is clear of the moving leaves below. A weather brush
        # at the rear bridges the small fitting clearance.
        box(FRAME,SILVER,a,18.176,5.084,b,18.287,5.138)
        box(FRAME,GASKET,a,18.197,5.068,b,18.205,5.085)
        for l,r in ((a-.035,a),(b,b+.035)):
            box(PANEL,WOOD,l,18.157,G,r,18.320,min(5.67,wall_foot((l+r)/2)))


def promenade():
    # The public entrance is recessed behind the main timber truss. Its
    # weather line turns into the recess, then crosses at the existing door.
    # The first soffit slips below the continuous upper chord. It rises only
    # after clearing the back of the chord, over the door's real transom.
    x0, x1 = 46.274,47.598
    start=NORTH_PANEL_BACK
    knee=2.025
    knuckle=2.175
    bottom=L3+2.12
    swing_head=L3+2.48
    head=L3+2.78
    def ceiling(y):
        if y<=knee:return bottom
        if y<knuckle:return bottom+(swing_head-bottom)*(y-knee)/(knuckle-knee)
        return swing_head+(head-swing_head)*(y-knuckle)/(3.04-knuckle)
    for lo,hi in ((start,knee),(knee,knuckle),(knuckle,3.04)):
        plate(PANEL,WOOD,rect(x0,lo,x1,hi),lambda x,y:ceiling(y)+.042,.042)
        for a,b in ((x0,x0+.04),(x1-.024,x1)):
            tapered_post(PANEL,WOOD,rect(a,lo,b,hi),lambda x,y:L3,lambda x,y:ceiling(y))
    # Insulated front face and shoulder returns terminate at the outer skin.
    for a,b in ((x0,46.35),(47.55,x1)):
        box(PANEL,WOOD,a,NORTH_WALK_EDGE,L3,b,start,bottom+.042)
    box(PANEL,WOOD,46.35,NORTH_WALK_EDGE,bottom+.042,47.55,start,L3+2.57)
    # The outer entry board is 170 mm thick. The weather break in the wall
    # continues a further 80 mm below it, with a closure across the reveal.
    box(PANEL,WOOD,46.35,NORTH_WALK_EDGE,L3-.25,47.55,start,L3-.17)
    swing_frame(0,3.09,46.35,47.55,L3,2.40,.16,-1,L3+2.40)


def build_exterior_portals():
    for a,b in ((22.30,24.45),(36.40,38.20)):
        swing_frame(0,3.65,a,b,G,2.35,.16,-1,5.37)
    for a,b in ((5.05,6.55),(15.60,17.20)):
        swing_frame(1,13.8,a,b,G,2.35,.052,-1,min(5.59,wall_foot(14.04)),14.04)
    folded_hall()
    swing_frame(0,17.94,60.08,62.48,G,2.50,.16,1,G+2.50)
    swing_frame(1,69.85,9.18,11.15,G,2.65,.16,1,G+2.65)
    swing_frame(0,17.94,64.10,65.90,L2,2.45,.16,1,L2+2.45)
    # The upper gallery weather joint begins 120 mm below the threshold. Its
    # recessed sill tray closes under the 80 mm board and turns up at its ends.
    box(FRAME,SILVER,64.10,17.855,L2-.12,65.90,18.025,L2-.08)
    for a,b in ((64.10,64.16),(65.84,65.90)):
        box(FRAME,SILVER,a,17.855,L2-.08,b,18.025,L2)
    swing_frame(0,6.90,46.34,47.83,L2,2.35,.16,1,L2+2.35)
    swing_frame(1,47.95,10.75,12.65,L2,2.35,.16,-1,L2+2.35)
    promenade()
