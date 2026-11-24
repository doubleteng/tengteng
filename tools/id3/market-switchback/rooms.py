"""Fitted rooms of the teaching case. Local coordinates in metres, measured to room planning lines."""
from geometry import box, beam, plate, rect
from shell_skin import MAIN_GIRDER_TOP, tapered_post
from studio_galleries import roof_girder_width

B, G, L2, L3 = -1.056, 2.50, 6.4116, 10.6788
WOOD, STEEL, ZINC = 'Oiled birch', 'Graphite steel', 'Galvanized silver'
PLASTER, GLASS, FELT = 'Chalk', 'Vision glass', 'Leaf'
SQUARE_FOOT = .09290304
FURN = 'Interior / Loose furniture'
ACOUSTIC = 'Interior / Acoustic linings'
WALL = 'Interior / Partitions and doors'
# Clockwise staff lounge wall axes. The southwest recess is the public
# gallery around the glazed court. The south bay accommodates the kitchenette.
STAFF_OUTLINE = [(48.20,2.18),(52.88,2.18),(52.88,8.38),(50.94,8.38),
                (50.94,11.49),(49.50,11.49),(49.50,5.35),(48.20,5.35)]
# Public washroom around the lift bypass. The fixture bank keeps its original
# width. The lower western bay gives the accessible basin a clear approach.
PUBLIC_WC_SOUTH=[(46.45,7.04),(51.79,7.04),(51.79,8.72),(50.82,8.72),
                 (50.82,12.36),(47.12,12.36),(47.12,13.26),(44.60,13.26),
                 (44.60,11.96),(45.55,11.96),(45.55,10.35),(46.45,10.35)]


def wall(name, mat, a, b, z, top, doors=(), thick=.10):
    """Each opening is specified in increasing global coordinates along the wall."""
    x,y = a
    X,Y = b
    horizontal = abs(X-x) > abs(Y-y)
    lower, upper = (x,X) if horizontal else (y,Y)
    def piece(s,t,lo,hi):
        if horizontal:
            box(name,mat,s,y-thick/2,lo,t,y+thick/2,hi)
        else:
            box(name,mat,x-thick/2,s,lo,x+thick/2,t,hi)
    def segment(s,t,lo,hi):
        if z<L3-.002:
            piece(s,t,lo,hi)
            return
        # Stop partitions and glazing at visible timber rather than glazing
        # across a girder. Headers keep a small deflection gap under each beam.
        girders=[2.6+3.6*i for i in range(16)]
        def shoulder(x):return roof_girder_width(x)/2+.06
        pocket=13.52-.74-.055
        if horizontal:
            cuts=sorted({s,t,*[e for X in girders for e in (X-shoulder(X),X+shoulder(X)) if s<e<t]})
            for a,b in zip(cuts,cuts[1:]):
                over=any(abs((a+b)/2-c)<shoulder(c) for c in girders)
                piece(a,b,lo,min(hi,pocket) if over else hi)
        else:
            over=any(abs(x-c)<shoulder(c) for c in girders)
            piece(s,t,lo,min(hi,pocket) if over else hi)
    last = lower
    for start,end in doors:
        if lower <= start < end <= upper:
            segment(last,start,z,top)
            segment(start,end,min(z+2.35,top),top)
            last = end
    segment(last,upper,z,top)


def table(x,y,z,width,depth,mat=WOOD):
    box(FURN,mat,x,y,z+.695,x+width,y+depth,z+.755)
    for xx in [x+.15,x+width-.21]:
        box(FURN,STEEL,xx,y+.11,z,xx+.06,y+depth-.11,z+.695)


def chair(x,y,z):
    # Flat floor, individual stackable auditorium chairs, all facing west.
    box(FURN,STEEL,x+.09,y-.14,z,x+.14,y+.14,z+.42)
    box(FURN,'Ochre',x-.18,y-.212,z+.42,x+.20,y+.212,z+.483)
    box(FURN,'Ochre',x+.164,y-.212,z+.483,x+.201,y+.212,z+.845)


def seating(hall, bounds, z, seats, rows, pitch_row, pitch_seat, midgap, crossgap, put=False):
    x,y,X,Y=bounds
    banks=seats//2
    across=seats*pitch_seat+midgap
    sides=((Y-y)-across)/2
    usable_length = X-x-3.0
    depth=(rows-1)*pitch_row+.40+crossgap
    front=(usable_length-depth)/2
    result=dict(study=hall,chairs=seats*rows,side_aisle_m=round(sides,3),
                central_aisle_m=midgap,cross_aisle_m=round(crossgap+pitch_row-.40,2),
                front_clear_m=round(front,3),row_pitch_m=pitch_row)
    corner_shift=0.72 if hall.startswith('C ·') else 0.0
    corner_gap = 1.34 if corner_shift else midgap
    if bounds[0] == 13.8:
        first_x = x+3.0+front+.18
        at_notch = first_x-.18 < 21.4
        outer_chair_setback=pitch_seat/2-.212
        module_offset=min(sides-1.25+corner_shift,sides-corner_shift+midgap-corner_gap) if at_notch else sides
        result['side_aisle_at_stair_notch_m'] = round(module_offset+outer_chair_setback,3)
        result['central_aisle_at_stair_notch_m'] = corner_gap if at_notch else midgap
    if put:
        for row in range(rows):
            xx=x+3.0+front+.18+row*pitch_row+(crossgap if row>=rows//2 else 0)
            # Ease the banks back over four rows after clearing the stair.
            # An abrupt sideways shift leaves a narrow diagonal neck even
            # when the nominal center and perimeter aisles both look wide.
            notch=max(0,min(1,(21.40+4*pitch_row-(xx-.18))/(4*pitch_row))) if corner_shift else 0
            row_gap=midgap+notch*(corner_gap-midgap)
            for n in range(seats):
                yy=y+sides+notch*corner_shift+(n+.5)*pitch_seat
                if n>=banks:
                    yy+=row_gap
                chair(xx,yy,z)
    return result


def suspended_reflectors():
    # Each panel is entirely over the open seating volume. Two short
    # spreaders bear against one girder soffit. Its four drops end at
    # flush, level bosses on the inclined upper face of the reflector.
    panel = 'Interior / Suspended hall reflectors'
    hardware = 'Interior / Reflector suspension'
    beam_bottom = MAIN_GIRDER_TOP-.74
    for x in (20.6,24.2,31.4,35.0):
        for y,tilt in ((9.40,.095),(14.25,-.095)):
            def panel_top(u,v): return 11.69+(v-y)*tilt
            plate(panel,WOOD,rect(x-1.06,y-1.14,x+1.06,y+1.14),panel_top,.072)
            for yy in (y-.80,y+.80):
                box(hardware,STEEL,x-.19,yy-.075,beam_bottom-.020,x+.19,yy+.075,beam_bottom)
                rail_top=beam_bottom-.020
                box(hardware,STEEL,x-.87,yy-.035,rail_top-.070,x+.87,yy+.035,rail_top)
                for xx in (x-.77,x+.77):
                    # A small tapered shoe presents a flat face to the rod.
                    top=panel_top(xx,yy)+.022
                    tapered_post(hardware,STEEL,rect(xx-.042,yy-.045,xx+.042,yy+.045),
                                 panel_top,lambda u,v:top)
                    box(hardware,STEEL,xx-.009,yy-.009,top,xx+.009,yy+.009,rail_top-.070)


def fitted_halls():
    big=(13.8,3.65,40.0,18.32)
    little=(56.95,1.6,69.95,13.04)
    alternatives=[
        seating('A · two banks of twelve',big,G,24,15,.86,.52,1.50,.90),
        seating('B · two banks of ten',big,G,20,18,.86,.53,1.50,.90),
        # The south market wall has a continuous insulated frame inside the
        # folding stacks. Keep the full perimeter aisle beside that frame.
        seating('C · two banks of nine',big,G,18,20,.87,.515,1.65,.98,True)]
    # Multiple sides admit the public. The south wall is pocketed back on market days.
    wall(WALL,PLASTER,(13.8,3.65),(13.8,18.32),G,L3,((5.05,6.55),(15.6,17.2)),.14)
    wall(WALL,PLASTER,(13.98,3.65),(13.98,18.32),L3,12.9,((9.35,11.0),),.14)
    wall(WALL,PLASTER,(40.0,3.65),(40.0,18.32),G,12.9,((5.0,7.4),(12.85,15.35)),.14)
    wall(WALL,PLASTER,(21.46,3.65),(40.0,3.65),G,8.4,((22.30,24.45),(36.4,38.2)))
    for x in (19.23,29.39,34.47):
        # The browser animates these three original stacks. Their fixed
        # sidelights and framed head follow the two openings in the shell.
        for k in range(3):
            box(WALL,GLASS,x+k*.078,18.23,G,x+k*.078+.043,18.96,G+2.58)
    box('Interior / Demountable stages',WOOD,14.14,6.65,G,16.45,14.6,G+.33)
    # The slatted stage lining is fixed to two battens on the inside of
    # the insulated plinth. Stop it below the teaching balcony and at
    # the stage face, leaving both side doors and the upper landing free.
    for z in (3.22,4.52):
        box(ACOUSTIC,WOOD,14.12,6.68,z,14.18,15.38,z+.065)
    for i in range(20):
        y=6.70+.45*i
        box(ACOUSTIC,WOOD,14.18,y,G+.48,14.245,y+.115,4.76)
    suspended_reflectors()
    study=seating('Two banks of five',little,L2,10,10,.78,.54,1.5,.70,True)
    wall(WALL,PLASTER,(56.95,1.6),(56.95,13.04),L2,13.28,((3.95,5.60),(10.65,12.3)),.12)
    wall(WALL,WOOD,(56.95,13.04),(69.95,13.04),L2,13.28,((57.7,59.4),(65.7,67.5)),.12)
    box('Interior / Demountable stages',WOOD,57.05,6.32,L2,58.71,10.48,L2+.22)
    for i in range(9):
        x=59.9+i*.69
        if i==5: x+=.17  # leave a full reveal beside the column at the wall
        bottom=L2+2.48 if x+.42>65.6 and x<67.6 else L2+.55
        box(ACOUSTIC,FELT,x,12.92,bottom,x+.42,12.98,12.49-(i%3)*.16)
    return alternatives,study


def classrooms():
    lo,mid,hi=2.75,8.265,13.78
    spans=[(1.75,9.35),(11.0,18.6)]
    areas=[]
    for y,Y in spans:
        wall(WALL,PLASTER,(mid,y),(mid,Y),L3,L3+3.08)
        # The end wall leaves the full central gallery open to the return landing.
        wall(WALL,PLASTER,(hi,y),(hi,Y),L3,L3+3.08)
        edge=Y if y<5 else y
        for x,X in [(lo,mid),(mid,hi)]:
            door=(x+.43,x+1.67) if x==lo else (10.55,11.79)
            wall(WALL,WOOD,(x,edge),(X,edge),L3,L3+2.43,(door,))
            # The south-east corner also contains the studio landing's
            # transverse hanger spreader. Terminate its clerestory at the
            # adjacent main girder, leaving that hanger shoe in the solid bay.
            glass_end=13.40 if edge==11.0 and X==hi else X
            wall(WALL,GLASS,(x,edge),(glass_end,edge),L3+2.43,L3+2.65)
            for ox in (1.03,3.14):
                for oy in (1.85,4.35):
                    table(x+ox,y+oy,L3,1.42,.74)
            box(FURN,'Chalk',X-.081,y+1.25,L3+.94,X-.050,y+3.70,L3+2.07)
            areas.append(round((X-x)*(Y-y)/SQUARE_FOOT))
    return areas


def east_rooms():
    # The north promenade opens straight into an entrance passage between the
    # office banks. The parallel gallery skirts the guard at the open court.
    areas=[]
    def office(x,y,X,Y,d,edge):
        wall(WALL,PLASTER,(x,y),(x,Y),L3,L3+2.95)
        wall(WALL,WOOD,(x,edge),(X,edge),L3,L3+2.24,((d,d+1.09),))
        wall(WALL,GLASS,(x,edge),(X,edge),L3+2.24,L3+2.65)
        wall(WALL,PLASTER,(x,Y if edge==y else y),(X,Y if edge==y else y),L3,L3+2.95)
        # Place the two annex desks against the solid rear wall, between
        # the timber posts, with a lateral approach from the office door.
        desk_offset = (2.12 if x>61 else .96) if y>13 else .42
        table(x+desk_offset,Y-.98 if edge==y else y+.45,L3,1.50,.68)
        areas.append(round((X-x-.10)*(Y-y-.10)/SQUARE_FOOT))
    for x,X,d in [(40.04,44.50,40.62),(47.96,52.42,50.15),(52.42,56.87,53.85)]:
        office(x,1.72,X,5.04,d,5.04)
    for x in (44.50,56.87):
        wall(WALL,PLASTER,(x,1.72),(x,5.04),L3,L3+2.95)
    office(35.86,3.68,39.75,7.56,36.87,3.68)
    wall(WALL,PLASTER,(39.75,3.68),(39.75,7.56),L3,L3+2.95)
    # Two offices occupy the occupied south strip of the annex. The gallery
    # along the tall auditorium joins all three doors to the stair.
    for x,X,d in [(56.90,61.53,59.17),(61.53,66.16,64.18)]:
        office(x,14.58,X,17.85,d,14.58)
    wall(WALL,PLASTER,(66.16,14.58),(66.16,17.85),L3,L3+2.95)
    # Conference and staff lounge face a common landing on the solid north
    # strip. Both door swings and their furniture clear the exposed truss ties.
    x,X,y,Y=40.01,46.24,1.975,6.63
    wall(WALL,WOOD,(x,y),(X,y),L2,L3-.24)
    wall(WALL,WOOD,(x,Y),(X,Y),L2,L3-.24)
    wall(WALL,PLASTER,(x,y),(x,Y),L2,L3-.24)
    wall(WALL,GLASS,(X,y),(X,Y),L2,L2+2.95,((3.87,5.17),))
    # Leave the court trimmer exposed above the conference-room glazing.
    for lo,hi,top in ((y,6.44,L3-.24),(6.44,Y,L3-1.09)):
        wall(WALL,WOOD,(X,lo),(X,hi),L2+2.95,top)
    for a,b in zip(STAFF_OUTLINE,STAFF_OUTLINE[1:]):
        a,b=sorted((a,b))
        wall(WALL,WOOD,a,b,L2,L3-.24)
    a,b=STAFF_OUTLINE[0],STAFF_OUTLINE[-1]
    wall(WALL,GLASS,a,b,L2,L2+2.95,((3.73,5.03),))
    wall(WALL,WOOD,a,b,L2+2.95,L3-.24)
    table(41.25,3.42,L2,2.75,1.12)
    for x in (49.15,51.00):
        box(FURN,FELT,x,3.16,L2,x+1.46,3.73,L2+.46)
    box(FURN,WOOD,49.60,10.79,L2,50.84,11.40,L2+.92)
    box(FURN,ZINC,49.81,10.88,L2+.92,50.49,11.27,L2+.95)
    box(FURN,WOOD,51.08,7.63,L2,52.79,8.28,L2+.92)
    # A separate washroom at the end of the headhouse gallery.
    wall(WALL,PLASTER,(56.97,13.04),(69.86,13.04),13.28,L3+2.86)
    wall(WALL,PLASTER,(66.24,14.58),(69.82,14.58),L3,L3+2.86,((67.48,68.67),))
    # The two connected arms of reception face the full-height light court.
    # The low counter faces the main east route and the lift landing.
    # The 1.28 m north aisle and the clear east route are outside this room.
    box(FURN,WOOD,52.04,7.61,L3,52.76,9.76,L3+.75)
    box(FURN,WOOD,52.04,8.76,L3+.75,52.76,9.76,L3+1.01)
    box(FURN,WOOD,50.92,7.61,L3,52.04,8.29,L3+.75)
    for y in (7.60,10.72):
        box(FURN,FELT,48.47,y,L3,49.13,y+2.07,L3+.46)
        box(FURN,WOOD,48.47,y,L3+.46,48.61,y+2.07,L3+.80)
    return areas


def washroom(x,y,X,Y,z,single,basins=None):
    if single:
        if z==G:
            # The bowl faces into the room from the west plumbing wall.
            # A short privacy return shields it from the open street lobby.
            box(FURN,'Chalk',x+.055,Y-1.52,z,x+.725,Y-1.13,z+.51)
            box(WALL,PLASTER,x+.05,Y-2.29,z,x+1.18,Y-2.19,z+1.87)
        else:
            box(FURN,'Chalk',x+.35,Y-.83,z,x+1.02,Y-.44,z+.51)
        box(FURN,'Chalk',X-.93,Y-1.35,z+.70,X-.31,Y-.86,z+.84)
        # A rear pedestal provides a bearing for the basin away from the wall.
        box(FURN,ZINC,X-.74,Y-1.03,z,X-.48,Y-.88,z+.70)
        return
    for n in range(3):
        a=x+.18+n*1.25
        box(FURN,'Chalk',a+.3,y+.2,z,a+.8,y+.82,z+.45)
        if n:
            box(WALL,ZINC,a,y+.06,z+.2,a+.04,y+1.60,z+1.82)
    if basins is None:basins=[(x+.45+n*1.02,Y) for n in range(3)]
    for a,back in basins:
        box(FURN,'Chalk',a,back-.60,z+.71,a+.71,back-.12,z+.82)
        for xx in (a+.09,a+.56):
            box(FURN,ZINC,xx,back-.48,z+.655,xx+.06,back-.05,z+.71)


def service():
    # Hall support, public WCs and family WCs
    wall(WALL,PLASTER,(46.45,1.72),(46.45,10.35),G,L2-.24)
    wall(WALL,PLASTER,(39.98,10.35),(46.45,10.35),G,L2-.24,((43.95,45.35),))
    for xx in [40.35,41.78]:
        box(FURN,ZINC,xx,2.45,G,xx+.56,4.5,G+1.65)
    wall(WALL,PLASTER,(46.45,7.04),(51.79,7.04),G,L2-.24)
    wall(WALL,PLASTER,(51.79,1.72),(51.79,7.04),G,L2-.24,((3.58,4.82),))
    washroom(46.52,1.72,51.79,7.04,G,False)
    # The north room and hall support already provide the other three shared
    # walls. The exposed returns meet a closed ceiling below the local cross girder.
    top=G+2.50
    for a,b in zip(PUBLIC_WC_SOUTH[1:10],PUBLIC_WC_SOUTH[2:11]):
        doors=((9.63,10.89),) if a[0]==b[0]==50.82 else ()
        wall(WALL,PLASTER,*sorted((a,b)),G,top,doors)
    for xa,ya,xb,yb in [(46.45,7.04,51.79,8.72),(46.45,8.72,50.82,10.35),
                         (45.55,10.35,50.82,11.96),(44.60,11.96,50.82,12.36),
                         (44.60,12.36,47.12,13.26)]:
        box(WALL,PLASTER,xa,ya,top,xb,yb,top+.055)
    washroom(46.52,7.04,50.82,12.36,G,False,[(45.96,13.26),(47.79,12.36),(49.05,12.36)])
    # Service rooms flank a through-lobby from the street door to the café
    # and the hall. The old middle WC closed off the entrance from inside.
    for n,(x,X,y,door) in enumerate([(57.03,60.19,13.20,(58.27,59.48)),
                                     (63.00,66.39,13.56,(64.10,65.32)),
                                     (66.39,69.81,13.56,(67.51,68.73))]):
        wall(WALL,PLASTER,(x,y),(x,17.91),G,L2-.24)
        if n!=1: wall(WALL,PLASTER,(X,y),(X,17.91),G,L2-.24)
        wall(WALL,WOOD,(x,y),(X,y),G,L2-.24,(door,))
        if n<2:
            washroom(x,y+.25,X,17.91,G,True)
        else:
            box(FURN,ZINC,x+.44,16.95,G,x+2.10,17.60,G+1.34)
    # Café serving counter outside the working kitchen, accessible from the south gallery.
    wall(WALL,PLASTER,(63.55,1.68),(63.55,7.53),G,L2-.24,((5.1,6.45),))
    wall(WALL,PLASTER,(63.55,7.53),(69.92,7.53),G,L2-.24,((66.4,67.8),))
    box(FURN,WOOD,63.93,7.89,G,65.76,8.65,G+.97)
    box(FURN,WOOD,63.93,8.65,G,64.64,11.50,G+.97)
    box(FURN,ZINC,65.0,2.2,G,69.31,2.92,G+.89)
    for x,y in [(57.7,3.0),(60.5,3.0),(58.5,6.75),(57.8,10.3),(61.1,10.3),(65.25,10.35)]:
        table(x,y,G,1.21,.72)
    # The public foyer's long counter sits below the three new street
    # windows, keeping the whole approach to both double doors clear.
    box(FURN,WOOD,40.92,17.62,G,45.06,18.34,G+.89)
    # Upper hall support opens off the gallery; remaining strip works as an interval foyer.
    wall(WALL,PLASTER,(61.28,13.10),(61.28,17.50),L2,L3-.26,((14.50,15.94),))
    wall(WALL,PLASTER,(57.02,17.50),(61.28,17.50),L2,L3-.26)
    for x in (62.41,67.74):
        box(FURN,WOOD,x,13.72,L2,x+1.58,14.24,L2+.46)
    washroom(66.24,14.58,69.80,17.70,L3,True)
    # Lower ground stock and workshop face independent service passages on the north side of the lift.
    wall(WALL,PLASTER,(21.46,3.70),(47.98,3.70),B,G-.26,((21.85,23.2),))
    wall(WALL,PLASTER,(47.98,3.70),(47.98,15.0),B,G-.26,((8.61,10.41),))
    wall(WALL,PLASTER,(13.98,15.0),(47.98,15.0),B,G-.26,((18.0,20.2),(43.8,46.0)))
    # Take the electrical-room corner north of the basement column; widening
    # the east bay maintains the equipment room and frees the receiving aisle.
    wall(WALL,PLASTER,(54.59,2.00),(54.59,7.80),B,G-.26)
    wall(WALL,PLASTER,(48.06,7.80),(54.59,7.80),B,G-.26,((50.4,51.8),))
    wall(WALL,PLASTER,(56.67,1.96),(56.67,13.30),B,G-.26,((8.24,10.04),))
    
    wall(WALL,PLASTER,(56.67,13.30),(65.14,13.30),B,G-.26,((60.00,61.40),))
    wall(WALL,PLASTER,(57.44,13.30),(57.44,18.29),B,G-.26,((15.0,16.4),))
    for x in (17.1,22.3,27.5,32.7,37.9,43.1):
        for y in (5.62,10.75):
            # Shelves bear on folded ledges at both end frames.
            for dx in (0,2.79):
                box(FURN,STEEL,x+dx,y+.04,B,x+dx+.06,y+.74,B+2.10)
            for dz in (.48,1.25,2.02):
                for dx in (.06,2.68):
                    box(FURN,STEEL,x+dx,y+.05,B+dz-.035,x+dx+.11,y+.73,B+dz)
                box(FURN,ZINC,x+.06,y,B+dz,x+2.79,y+.78,B+dz+.06)
    for y in (3.89,8.63):
        table(60.42,y,B,3.35,1.18)


def teaching_lounge():
    # A balcony off the classroom gallery shares its level and overlooks the
    # large event hall. The adjacent WC has its own door off the north passage.
    x,X,y,Y=31.92,35.86,3.68,6.25
    wall(WALL,PLASTER,(x,y),(x,Y),L3,L3+2.48)
    wall(WALL,PLASTER,(x,Y),(X,Y),L3,L3+2.48)
    wall(WALL,WOOD,(x,y),(X,y),L3,L3+2.48,((32.84,34.08),))
    washroom(x,y,X,Y,L3,True)
    for xx in (24.06,27.03):
        box(FURN,FELT,xx,5.28,L3,xx+2.14,5.94,L3+.47)
        box(FURN,WOOD,xx,5.84,L3+.47,xx+2.14,5.94,L3+.81)
    table(29.80,5.04,L3,1.28,.68)


def build_rooms(counts):
    trials,small=fitted_halls()
    classroom_areas=classrooms()
    office_areas=east_rooms()
    service()
    teaching_lounge()
    counts['classrooms']=len(classroom_areas)
    counts['offices']=len(office_areas)
    counts['largeHallChairs']=trials[-1]['chairs']
    counts['smallHallChairs']=small['chairs']
    # For an orthogonal polygon an inward half-wall offset subtracts
    # width × perimeter and adds four square return corners.
    def orthogonal_room_area(boundary):
        edges=list(zip(boundary,boundary[1:]+boundary[:1]))
        area=abs(sum(x*Y-X*y for (x,y),(X,Y) in edges))/2
        perimeter=sum(abs(X-x)+abs(Y-y) for (x,y),(X,Y) in edges)
        return area-.05*perimeter+4*.05**2
    staff_net=orthogonal_room_area(STAFF_OUTLINE)
    return dict(large_hall_trials=trials,small_hall=small,classroom_planning_area_sf=classroom_areas,
        office_planning_area_sf=office_areas,
        large_hall_after_stair_notch_sf=round((26.2*14.67-7.4*1.25)/SQUARE_FOOT),
        stock_storage_after_stair_notch_sf=round((34*11.30-7.4*1.2)/SQUARE_FOOT),
        planning_areas_sf={'staff lounge with kitchenette':round(staff_net/SQUARE_FOOT),'administrative reception':round(
            ((55.65-48.06)*(10.60-6.32)+(52.30-48.06)*(13.94-10.60))/SQUARE_FOOT),
            **{k:round(w*d/SQUARE_FOOT) for k,w,d in [
            ('large assembly bounding rectangle',26.20,14.67),('small assembly',13.0,11.44),
            ('large hall support',6.47,8.63),('small hall support',4.26,4.40),
            ('kitchen',6.37,5.85),('north public restroom',5.27,5.32),
            ('west family restroom',3.06,4.61),('east family restroom',3.29,4.25),('janitor',3.32,4.25),('stock storage bounding rectangle',34,11.30),
            ('workshop',8.37,11.24),('electrical',54.54-48.03,7.75-1.9072),('mechanical',7.60,4.89),
            ('conference',6.13,4.555),
            ('upper administrative WC',3.48,3.17),('education lounge',8.82,2.50),('education WC',3.84,2.47)]},
            'south public restroom':round(orthogonal_room_area(PUBLIC_WC_SOUTH)/SQUARE_FOOT)})


if __name__ == '__main__':
    import json
    print(json.dumps(build_rooms({}),indent=2))
