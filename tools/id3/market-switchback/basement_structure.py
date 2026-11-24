"""Coordinate the concrete wall, core, post and footing volumes below the case."""
from geometry import box

CONCRETE = 'Board-formed concrete'
WALL = .4572
PEDESTALS = [(x-.58, y-.50, x+.58, y+.50)
             for x in (13.4, 45.8) for y in (1.65, 18.35)]
PILE_CAPS = [(x-1.24, y-1.15, x+1.24, y+1.15)
             for x in (13.4, 45.8) for y in (1.65, 18.35)]
FORUM_X = (57.42, 63.25, 69.23)
FORUM_Y = (1.90, 13.12, 17.45)
FORUM_STEMS = [(x-.16, y-.16, x+.16, y+.16) for x in FORUM_X for y in FORUM_Y]
FORUM_PADS = [(x-.63, y-.63, x+.63, y+.63) for x in FORUM_X for y in FORUM_Y]
THROUGH_PIERS = PEDESTALS + FORUM_STEMS


def intersection(area, other):
    a,b,A,B = area
    c,d,C,D = other
    rect = max(a,c), max(b,d), min(A,C), min(B,D)
    return rect if rect[2]-rect[0] > 1e-6 and rect[3]-rect[1] > 1e-6 else None


def remainder(area, cutters):
    """Split the stock into non-overlapping closed rectangles around actual joints."""
    result = [area]
    for cutter in cutters:
        trimmed = []
        for stock in result:
            cut = intersection(stock, cutter)
            if cut is None:
                trimmed.append(stock)
                continue
            x,y,X,Y = stock
            a,b,A,B = cut
            for piece in ((x,y,a,Y), (A,y,X,Y), (a,y,A,b), (a,B,A,Y)):
                if piece[2]-piece[0] > 1e-6 and piece[3]-piece[1] > 1e-6:
                    trimmed.append(piece)
        result = trimmed
    return result


def panels(layer, areas, low, high):
    for x,y,X,Y in areas:
        box('Structure / '+layer, CONCRETE, x,y,low,X,Y,high)


def perimeter(bounds, width, overhang=0):
    x,y,X,Y = bounds
    o = overhang
    return [(x-o,y-o,x+width+o,Y+o), (X-width-o,y-o,X+o,Y+o),
            (x+width+o,y-o,X-width-o,y+width+o),
            (x+width+o,Y-width-o,X-width-o,Y+o)]


def build(basement, ground, bounds, west, east):
    """Give each piece of concrete one owner at floor, wall and foundation joints."""
    x,y,X,Y = bounds
    # The stair's north wall also retains the earth at basement level.
    stair_wall = (west[0], y, west[2], west[1]+.16)
    panels('Concrete stair cores', [stair_wall], basement, ground-.22)
    panels('Concrete stair cores', [(west[0],west[1],west[2],west[1]+.16)], ground-.22, ground)
    cutoff = (west[0], y, west[2], y+WALL)
    for band in perimeter(bounds, WALL):
        panels('Retaining walls', remainder(band, THROUGH_PIERS+[cutoff]), basement, ground-.22)

    mats = [(a-.24,b-.20,A+.24,B+.20) for a,b,A,B in (west,east)]
    top = basement-.1524
    def foundation(layer, region, depth):
        pad_levels = [(p, basement-.25) for p in PILE_CAPS]+[(p, basement-.30) for p in FORUM_PADS]
        panels(layer, remainder(region, PILE_CAPS+FORUM_PADS), top-depth, top)
        # A thin level step transfers the wall/mat load onto the deeper cap
        # around a pedestal. No extra concrete is placed through the column base.
        for pad, seat in pad_levels:
            shared = intersection(region, pad)
            if shared:
                name = 'Core to pile cap step' if layer=='Core foundation mats' else 'Perimeter footing steps'
                panels(name, remainder(shared, THROUGH_PIERS), seat, top)
    for mat in mats:
        foundation('Core foundation mats', mat, .60)
    for band in perimeter(bounds, WALL, .26):
        for end in remainder(band, mats):
            foundation('Perimeter strip footings', end, .55)


def clear_beam_spans(x, bounds, west, east, lift):
    """Straight beam ends frame into solid concrete faces; center columns carry the lap."""
    north = bounds[1]+WALL
    south = bounds[3]-WALL
    for a,b,A,B in PEDESTALS:
        if a <= x <= A:
            if b < north < B: north = B
            if b < south < B: south = b
    spans = [(north,9.40),(9.40,south)]
    for left,near,right,far in (west,east,lift):
        if left < x < right:
            spans = [(a,b) for lo,hi in spans for a,b in
                     ((lo,min(hi,near)),(max(lo,far),hi)) if b-a > .005]
    return spans
