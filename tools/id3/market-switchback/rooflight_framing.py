"""Bearing details of the civic rooflights and operable main clerestory."""
import geometry as g

ZINC='Galvanized silver'
STEEL='Graphite steel'
E='Enclosure / '

def rooflight_carriers(spans,stations,edges,top,roof_depth):
    """Seat every head and sill carrier on runners bearing on the actual roof timber.

    Runners overhang only at the eaves. They are continuous over the first
    timber member inside the eave and over the upper backspan.
    """
    for left,right in spans:
        for y in edges:
            g.plate(E+'Rooflight glazing rails',ZINC,g.rect(left,y-.045,right,y+.045),
                    lambda u,v:top(u,v)-.08,.14)
        for x in stations:
            if not left<x<right:continue
            g.plate(E+'Rooflight bearing runners',STEEL,g.rect(x-.054,edges[0]-.065,x+.054,edges[-1]+.065),
                    lambda u,v:top(u,v)-roof_depth+.045,.045)
            for y in edges:
                g.plate(E+'Rooflight bearing stools',STEEL,g.rect(x-.045,y-.045,x+.045,y+.045),
                        lambda u,v:top(u,v)-.08-.14,roof_depth-.08-.14-.045)

def monitor_backing(left,right,stations,seam,hinge):
    """Continuous hinge header in front of the stepped high-side rafter ends."""
    g.box(E+'Monitor hinge headers',STEEL,left,seam+.022,hinge,
          right,seam+.108,hinge+.14)
    for x in stations:
        if not left<x<right:continue
        # A welded shelf directly supports the header at the opaque jamb.
        # At its heel a tall backplate and two pins fasten into the rafter end.
        g.box(E+'Monitor header shoes',STEEL,x-.07,seam+.019,hinge-.018,
              x+.07,seam+.122,hinge)
        g.box(E+'Monitor header shoes',STEEL,x-.07,seam+.098,hinge-.018,
              x+.07,seam+.110,hinge+.095)
        for dx in (-.041,.041):
            g.beam(E+'Monitor header fasteners',STEEL,(x+dx,seam+.098,hinge+.02),
                   (x+dx,seam+.26,hinge+.02),.016,.016)

def girt_end(u,sense,face,inside,width,half_depth,level,out):
    """Seat one girt end and anchor its angle to the outer face of a timber post."""
    edge=u+sense*half_depth
    near=face+out*width/2
    x0,x1=sorted((edge-sense*.135,edge+sense*.145))
    # At the two deep north bearing posts the girt lies partly inboard of
    # the post's face. The shelf stays beyond the post end in X and covers
    # the full girt width in Y. The heel overlaps the face plate.
    y0=min(inside-.045,near);y1=max(inside+.045,near)
    sx0,sx1=sorted((edge,edge+sense*.145))
    bottom=level-.145/2
    g.box(E+'Inboard girt seats',STEEL,sx0,y0,bottom-.015,sx1,y1,bottom)
    a,b=sorted((near+out*.012,near))
    g.box(E+'Girt anchorage plates',STEEL,x0,a,bottom-.08,x1,b,level+.11)
    x=edge-sense*.075
    for z in (bottom-.035,level+.065):
        g.beam(E+'Girt anchorage bolts',STEEL,(x,near+out*.022,z),(x,near-out*.11,z),.014,.014)

def court_beam_shoe(axis,center,face,into,width,soffit,bolt_z):
    """A seated face hanger at a real timber-to-timber framing interface.

    Along-axis coordinates start at the receiving member's face. The seat
    puts a 12 mm backplate between the two timbers; the pair of anchor rows
    run into the host, never across the adjacent sky-court opening.
    """
    def point(a,b,h):
        t=face+into*a
        return (t,center+b,h) if axis==0 else (center+b,t,h)
    def block(layer,a,b,z,A,B,Z):
        p=point(a,b,z);q=point(A,B,Z)
        g.box(layer,STEEL,min(p[0],q[0]),min(p[1],q[1]),z,max(p[0],q[0]),max(p[1],q[1]),Z)
    half=width/2;label='Structure / Court roof transfer shoes'
    block(label,0,-half-.015,soffit-.018,.26,half+.015,soffit)
    block(label,0,-half-.015,soffit,.012,half+.015,bolt_z+.14)
    for side in (-1,1):
        l,r=sorted((side*half,side*(half+.012)))
        block(label,.012,l,soffit,.22,r,soffit+.19)
    for b in (-half*.62,half*.62):
        for z in (bolt_z,bolt_z+.085):
            g.beam('Structure / Court roof anchor pins',STEEL,point(-.16,b,z),point(.018,b,z),.018)
