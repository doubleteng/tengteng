"""Fitted rooms of the teaching case. Local coordinates in metres, measured to room planning lines."""
from geometry import box, beam

B, G, L2, L3 = -1.056, 2.50, 6.4116, 10.6788
WOOD, STEEL, ZINC = 'Oiled birch', 'Graphite steel', 'Galvanized silver'
PLASTER, GLASS, FELT = 'Chalk', 'Vision glass', 'Leaf'
SQUARE_FOOT = .09290304
FURN = 'Interior / Loose furniture'
ACOUSTIC = 'Interior / Acoustic linings'
WALL = 'Interior / Partitions and doors'


def wall(name, mat, a, b, z, top, doors=(), thick=.10):
    """Each opening is specified in increasing global coordinates along the wall."""
    x,y = a
    X,Y = b
    horizontal = abs(X-x) > abs(Y-y)
    lower, upper = (x,X) if horizontal else (y,Y)
    def segment(s,t,lo,hi):
        if horizontal:
            box(name,mat,s,y-thick/2,lo,t,y+thick/2,hi)
        else:
            box(name,mat,x-thick/2,s,lo,x+thick/2,t,hi)
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
    corner_gap = 1.39 if corner_shift else midgap
    if bounds[0] == 13.8:
        first_x = x+3.0+front+.18
        at_notch = first_x-.18 < 21.4
        result['side_aisle_at_stair_notch_m'] = round(min(sides-1.25+corner_shift,
             sides-corner_shift+midgap-corner_gap) if at_notch else sides,3)
        result['central_aisle_at_stair_notch_m'] = corner_gap if at_notch else midgap
    if put:
        for row in range(rows):
            xx=x+3.0+front+.18+row*pitch_row+(crossgap if row>=rows//2 else 0)
            for n in range(seats):
                notched = bounds[0] == 13.8 and xx-.18<21.40
                yy=y+sides+(corner_shift if notched else 0)+(n+.5)*pitch_seat
                if n>=banks:
                    yy+=corner_gap if notched else midgap
                chair(xx,yy,z)
    return result


def fitted_halls():
    big=(13.8,3.65,40.0,18.32)
    little=(56.95,1.6,69.95,13.04)
    alternatives=[
        seating('A · two banks of twelve',big,G,24,15,.86,.52,1.50,.90),
        seating('B · two banks of ten',big,G,20,18,.86,.53,1.50,.90),
        seating('C · two banks of nine',big,G,18,20,.87,.53,1.65,.98,True)]
    # Multiple sides admit the public. The south wall is pocketed back on market days.
    wall(WALL,PLASTER,(13.8,3.65),(13.8,18.32),G,L3,((5.05,6.55),(15.6,17.2)),.14)
    wall(WALL,PLASTER,(13.8,3.65),(13.8,18.32),L3,12.9,((9.35,11.0),),.14)
    wall(WALL,PLASTER,(40.0,3.65),(40.0,18.32),G,12.9,((5.0,7.4),(12.85,15.35)),.14)
    wall(WALL,PLASTER,(21.46,3.65),(40.0,3.65),G,8.4,((21.6,23.4),(36.4,38.2)))
    for i in range(5):
        x=14.15+i*5.08
        # Leaves stacked at the jamb; upper fixed ribbon keeps high sidelight.
        for k in range(3):
            box(WALL,GLASS,x+k*.078,18.23,G,x+k*.078+.043,18.96,G+2.58)
        box(WALL,ZINC,x-.06,18.24,G+2.58,x+4.9,18.38,G+2.73)
    box('Interior / Demountable stages',WOOD,14.14,6.65,G,16.45,14.6,G+.33)
    for i in range(20):
        y=6.68+.45*i
        box(ACOUSTIC,WOOD,13.91,y,G+.45,14.05,y+.155,11.50-(i%4)*.16)
    # Suspended faceted reflectors over each seat bank. The centre line stays clear for daylight.
    for i in range(4):
        x=18.5+i*5.0
        for y in (6.75,13.6):
            z=10.63+(i%2)*.32
            beam(ACOUSTIC,WOOD,(x,y,z),(x+2.5,y,z+.26),2.6,.105)
            for xx,zz in [(x+.18,z+.05),(x+2.32,z+.29)]:
                beam(ACOUSTIC,STEEL,(xx,y,zz),(xx,y,13.05),.022)
    study=seating('Two banks of five',little,L2,10,10,.78,.54,1.5,.70,True)
    wall(WALL,PLASTER,(56.95,1.6),(56.95,13.04),L2,13.28,((2.15,3.8),(10.65,12.3)),.12)
    wall(WALL,WOOD,(56.95,13.04),(69.95,13.04),L2,13.28,((57.7,59.4),(65.7,67.5)),.12)
    box('Interior / Demountable stages',WOOD,57.05,4.2,L2,58.32,10.5,L2+.22)
    for i in range(9):
        x=59.9+i*.69
        box(ACOUSTIC,FELT,x,12.92,L2+.55,x+.42,12.98,12.49-(i%3)*.16)
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
            wall(WALL,WOOD,(x,edge),(X,edge),L3,L3+2.43,((x+.43,x+1.67),))
            wall(WALL,GLASS,(x,edge),(X,edge),L3+2.43,L3+3.08)
            for ox in (1.03,3.14):
                for oy in (1.85,4.35):
                    table(x+ox,y+oy,L3,1.42,.74)
            box(FURN,'Chalk',X-.12,y+1.25,L3+.94,X-.075,y+3.70,L3+2.07)
            areas.append(round((X-x)*(Y-y)/SQUARE_FOOT))
    return areas


def east_rooms():
    # Four north-lit offices share a passage with two south offices.
    north_start,north_finish=43.0,56.3
    for k in range(4):
        x=north_start+(north_finish-north_start)*k/4
        X=north_start+(north_finish-north_start)*(k+1)/4
        wall(WALL,PLASTER,(x,1.82),(x,6.08),L3,L3+2.95)
        wall(WALL,WOOD,(x,6.08),(X,6.08),L3,L3+2.22,((x+.31,x+1.36),))
        wall(WALL,GLASS,(x,6.08),(X,6.08),L3+2.22,L3+2.95)
        table(x+.78,2.85,L3,1.48,.73)
    wall(WALL,PLASTER,(56.3,1.82),(56.3,6.08),L3,L3+2.95)
    areas=[round((north_finish-north_start)/4*4.26/SQUARE_FOOT)]*4
    for x,X,Y in [(48.03,51.84,11.55),(51.84,56.85,10.56)]:
        wall(WALL,PLASTER,(x,7.78),(x,Y),L3,L3+2.95)
        wall(WALL,WOOD,(x,7.78),(X,7.78),L3,L3+2.24,((x+.31,x+1.4),))
        wall(WALL,GLASS,(x,7.78),(X,7.78),L3+2.24,L3+2.95)
        wall(WALL,PLASTER,(x,Y),(X,Y),L3,L3+2.95)
        table(x+1.18,8.9,L3,1.52,.68)
        areas.append(round((X-x)*(Y-7.78)/SQUARE_FOOT))
    wall(WALL,PLASTER,(56.85,7.78),(56.85,10.56),L3,L3+2.95)
    # Shared conference and staff lounge lie under the upper offices; circulation stays to the east.
    for y,Y in [(1.76,6.12),(6.18,10.53)]:
        wall(WALL,PLASTER,(48.02,y),(48.02,Y),L2,L3-.24)
        wall(WALL,WOOD,(48.02,Y),(54.55,Y),L2,L3-.24)
        wall(WALL,GLASS,(54.55,y),(54.55,Y),L2,L3-.24,((y+.40,y+1.7),))
    table(49.15,3.35,L2,3.55,1.18)
    for x in (49.05,51.2):
        box(FURN,FELT,x,7.52,L2,x+1.86,8.13,L2+.46)
        box(FURN,FELT,x,9.57,L2,x+1.86,10.18,L2+.46)
    # South gallery of the east headhouse. The assembly double-height room ends at y13.04.
    wall(WALL,PLASTER,(56.97,13.17),(69.86,13.17),L3,L3+2.86)
    wall(WALL,PLASTER,(67.32,13.17),(67.32,17.87),L3,L3+2.86,((15.34,16.53),))
    for x in (59.1,62.35):
        table(x,14.22,L3,2.25,.78)
    table(64.60,15.68,L3,1.72,.80)
    return areas


def washroom(x,y,X,Y,z,single):
    if single:
        box(FURN,'Chalk',x+.35,y+.27,z,x+1.02,y+.66,z+.51)
        box(FURN,'Chalk',X-.93,y+.15,z+.70,X-.31,y+.64,z+.84)
        return
    for n in range(3):
        a=x+.18+n*1.25
        box(FURN,'Chalk',a+.3,y+.2,z,a+.8,y+.82,z+.45)
        if n:
            box(WALL,ZINC,a,y+.06,z+.2,a+.04,y+1.60,z+1.82)
    for n in range(3):
        a=x+.45+n*1.02
        box(FURN,'Chalk',a,Y-.60,z+.71,a+.71,Y-.12,z+.82)


def service():
    # Hall support, public WCs and family WCs
    wall(WALL,PLASTER,(46.45,1.72),(46.45,10.35),G,L2-.24)
    wall(WALL,PLASTER,(39.98,10.35),(46.45,10.35),G,L2-.24,((43.95,45.35),))
    for xx in [40.35,41.78]:
        box(FURN,ZINC,xx,2.45,G,xx+.56,4.5,G+1.65)
    for y,Y in [(1.72,7.04),(7.04,12.36)]:
        wall(WALL,PLASTER,(46.52,Y),(51.79,Y),G,L2-.24)
        wall(WALL,PLASTER,(51.79,y),(51.79,Y),G,L2-.24,((y+1.86,y+3.1),))
        washroom(46.52,y,51.79,Y,G,False)
    for n in range(3):
        x=57.02+n*4.28
        X=x+4.28
        wall(WALL,PLASTER,(x,14.62),(x,17.91),G,L2-.24)
        wall(WALL,WOOD,(x,14.62),(X,14.62),G,L2-.24,((x+1.32,x+2.58),))
        if n<2:
            washroom(x,14.62,X,17.91,G,True)
        else:
            box(FURN,ZINC,x+.42,16.95,G,x+2.1,17.6,G+1.34)
    wall(WALL,PLASTER,(69.86,14.62),(69.86,17.91),G,L2-.24)
    # Café serving counter outside the working kitchen, accessible from the south gallery.
    wall(WALL,PLASTER,(63.55,1.68),(63.55,7.53),G,L2-.24,((5.1,6.45),))
    wall(WALL,PLASTER,(63.55,7.53),(69.92,7.53),G,L2-.24,((66.4,67.8),))
    box(FURN,WOOD,63.93,7.89,G,68.92,8.65,G+.97)
    box(FURN,ZINC,65.0,2.2,G,69.31,2.92,G+.89)
    for x,y in [(57.7,3.0),(60.5,3.0),(58.5,6.75),(57.8,10.3),(61.1,10.3),(65.25,10.35)]:
        table(x,y,G,1.21,.72)
    box(FURN,WOOD,41.27,11.65,G,45.41,12.37,G+1.00)
    # Upper hall support opens off the gallery; remaining strip works as an interval foyer.
    wall(WALL,PLASTER,(61.28,13.10),(61.28,17.50),L2,L3-.26)
    wall(WALL,PLASTER,(57.02,17.50),(61.28,17.50),L2,L3-.26,((58.38,59.82),))
    for x in (62.56,65.47):
        box(FURN,WOOD,x,15.17,L2,x+2.03,15.74,L2+.46)
    washroom(67.32,13.37,69.8,17.70,L3,True)
    # Lower ground stock and workshop face independent service passages on the north side of the lift.
    wall(WALL,PLASTER,(21.46,3.70),(47.98,3.70),B,G-.26,((21.85,23.2),))
    wall(WALL,PLASTER,(47.98,3.70),(47.98,15.0),B,G-.26,((8.61,10.41),))
    wall(WALL,PLASTER,(13.98,15.0),(47.98,15.0),B,G-.26,((18.0,20.2),(43.8,46.0)))
    wall(WALL,PLASTER,(54.06,2.00),(54.06,8.20),B,G-.26)
    wall(WALL,PLASTER,(48.06,8.2),(54.06,8.2),B,G-.26,((50.4,51.8),))
    wall(WALL,PLASTER,(56.54,2.00),(56.54,12.91),B,G-.26,((10.50,12.45),))
    wall(WALL,PLASTER,(56.54,12.91),(65.12,12.91),B,G-.26)
    wall(WALL,PLASTER,(56.90,13.60),(65.14,13.60),B,G-.26,((58.3,59.7),))
    wall(WALL,PLASTER,(56.90,13.60),(56.90,18.16),B,G-.26,((15.0,16.4),))
    for x in (17.1,22.3,27.5,32.7,37.9,43.1):
        for y in (5.05,10.75):
            for dz in (.48,1.25,2.02):
                box(FURN,ZINC,x,y,B+dz,x+2.85,y+.78,B+dz+.06)
            for dx in (.03,2.77):
                box(FURN,STEEL,x+dx,y+.22,B,x+dx+.07,y+.52,B+2.10)
    for y in (3.89,8.63):
        table(58.25,y,B,3.35,1.18)


def build_rooms(counts):
    trials,small=fitted_halls()
    classroom_areas=classrooms()
    office_areas=east_rooms()
    service()
    counts['classrooms']=len(classroom_areas)
    counts['offices']=len(office_areas)
    counts['largeHallChairs']=trials[-1]['chairs']
    counts['smallHallChairs']=small['chairs']
    return dict(large_hall_trials=trials,small_hall=small,classroom_planning_area_sf=classroom_areas,
        office_planning_area_sf=office_areas,
        large_hall_after_stair_notch_sf=round((26.2*14.67-7.4*1.25)/SQUARE_FOOT),
        stock_storage_after_stair_notch_sf=round((34*11.30-7.4*1.2)/SQUARE_FOOT),
        planning_areas_sf={k:round(w*d/SQUARE_FOOT) for k,w,d in [
            ('large assembly bounding rectangle',26.20,14.67),('small assembly',13.0,11.44),
            ('large hall support',6.47,8.63),('small hall support',4.26,4.40),
            ('kitchen',6.37,5.85),('public restroom each',5.27,5.32),
            ('family restroom each and janitor',4.28,3.29),('stock storage bounding rectangle',34,11.30),
            ('workshop',8.58,10.91),('electrical',6,6.2),('mechanical',8.24,4.56),
            ('conference',6.53,4.36),('staff lounge',6.53,4.35),
            ('shared reception',10.35,4.70),('upper WC',2.54,4.70)]})


if __name__ == '__main__':
    import json
    print(json.dumps(build_rooms({}),indent=2))
