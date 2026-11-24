"""Continuous returns between the raised timber shell, service plinth and L2 gallery."""
import geometry as g
from gallery_cantilevers import NORTH_GLAZING, SOUTH_SKIN
from shell_skin import EAST_SKIN, L2, tapered_post, wall_foot

ENC = 'Enclosure / '
LINING, COATING, CORE, GASKET = 'Oiled birch','Galvanized silver','Dark reveal','Graphite steel'
def gallery_penetrations():
    """Registered boxes of the actual steel arm, plate and existing weather boot."""
    cuts=[]
    for (layer,mat),(vertices,_) in g.layers.items():
        if layer.split(' / ',1)[-1] not in ('Gallery cantilever arms','Gallery timber connection plates',
                                            'Gallery penetration sleeves','Gallery sleeve seals'):
            continue
        for first in range(0,len(vertices),8):
            points=vertices[first:first+8]
            xs,hs,ys=zip(*points)
            box=(min(xs)-g.ORIGIN_X,min(ys),min(hs),max(xs)-g.ORIGIN_X,max(ys),max(hs))
            x,y,h,X,Y,H=box
            if 49.05<x<X<49.75 and Y>18.48 and y<18.875 and h<6.1 and H>5.72:
                cuts.append(box)
    return cuts


def cut_layers(name,mat,a,b,y,Y,low,high,solids):
    """Extrude the folded section left after subtracting the real occupied depths."""
    poly=[(a,wall_foot(a)+low),(b,wall_foot(b)+low),(b,wall_foot(b)+high),(a,wall_foot(a)+high)]
    sections=[poly]
    for z,Z in solids:
        sections=[piece for section in sections for piece in
                  (g.clip(section,1,z,False),g.clip(section,1,Z,True)) if len(piece)>2]
    for section in sections:
        points=[]
        for point in section:
            if not points or sum(abs(j-k) for j,k in zip(point,points[-1]))>1e-6:points.append(point)
        if len(points)>2 and sum(abs(j-k) for j,k in zip(points[-1],points[0]))<1e-6:points.pop()
        if len(points)<3:continue
        area=abs(sum(u*H-U*h for (u,h),(U,H) in zip(points,points[1:]+points[:1])))/2
        if area<1e-8:continue
        n=len(points)
        g.solid(ENC+name,mat,[(u,v,h) for v in (y,Y) for u,h in points],
                [list(range(n)),list(range(n,2*n))]+[[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)])


def plinth_folds():
    # The primary column bays project around their existing concrete plinths.
    # Each short reveal joins the real main-skin datum to the ground enclosure.
    penetrations=gallery_penetrations()
    # The flat steel connection plate crosses the folded weather surface.
    # Rebate its cap for a 10 mm compressible collar, with a 6 mm turned lip.
    plate=next(p for p in penetrations if .47<p[3]-p[0]<.50 and p[5]-p[2]>2)
    px,py,_,pX,pY,_=plate
    collar=(px-.010,py-.010,pX+.010,pY+.010)
    cuts=sorted({39.80,40.,45.10,45.8,46.50,56.65,EAST_SKIN,
                 collar[0],collar[2],*[v for x,y,h,X,Y,H in penetrations for v in (x,X)]})
    for a,b in zip(cuts,cuts[1:]):
        if b-a<.00005:continue
        x=(a+b)/2
        pier=45.1<x<46.5
        south=18.86 if pier else (18.32 if x<40 else 18.48)
        for start,end in ((NORTH_GLAZING,1.14 if pier else 1.45),(south,SOUTH_SKIN)):
            near,far=sorted((start,end))
            blockers=[entry for entry in penetrations if entry[0]<x<entry[3] and near<entry[4] and entry[1]<far]
            at_collar=collar[0]<x<collar[2] and near<collar[3] and far>collar[1]
            ycuts=sorted({near,far,*[v for v in (collar[1],collar[3]) if at_collar and near<v<far],*[v for entry in blockers for v in (entry[1],entry[4]) if near<v<far]})
            for lo,hi in zip(ycuts,ycuts[1:]):
                if hi-lo<.00005:continue
                y=(lo+hi)/2
                solids=[(h,H) for xx,yy,h,XX,YY,H in blockers if yy<y<YY]
                for name,mat,bottom,top in [('Service-wing plinth soffit',LINING,-.165,-.145),
                                            ('Service-wing soffit insulation',CORE,-.145,-.012),
                                            ('Service-wing soffit cap',COATING,-.012,0)]:
                    if at_collar and collar[1]<y<collar[3] and name=='Service-wing soffit cap':
                        name,mat,top='Service-wing flexible penetration collar','Dark reveal',.006
                    if solids:cut_layers(name,mat,a,b,lo,hi,bottom,top,solids)
                    else:g.plate(ENC+name,mat,g.rect(a,lo,b,hi),lambda u,v:wall_foot(u)+top,top-bottom)


def raised_lobby_ceiling():
    # The raised bay is the ceiling of the conditioned ground lobby, below
    # the L2 staff-gallery guard. Its four upstands return to the real floor
    # edge, while the public passage remains on the outside of the south curb.
    x,y,X,Y=52.96,5.80,56.65,8.23
    t=.095
    fp=g.rect(x,y,X,Y)
    foot=lambda u,v:wall_foot(u)
    g.plate(ENC+'Raised lobby ceiling lining',LINING,g.rect(x+t,y+t,X-t,Y-t),
            lambda u,v:foot(u,v)+.025,.025)
    g.plate(ENC+'Raised lobby ceiling structure','CLT spruce',fp,lambda u,v:foot(u,v)+.130,.105)
    g.plate(ENC+'Raised lobby ceiling acoustic layer',CORE,fp,lambda u,v:foot(u,v)+.151,.021)
    g.plate(ENC+'Raised lobby ceiling cap',COATING,fp,lambda u,v:foot(u,v)+.166,.015)
    def cheek(x0,y0,x1,y1,bottom):
        tapered_post(ENC+'Raised lobby ceiling returns','CLT spruce',g.rect(x0,y0,x1,y1),
                     lambda u,v:bottom,lambda u,v:foot(u,v)+.025)
    # Square, nonoverlapping corner joints. Reveals and the head share their
    # actual slope; a vertical section never sees daylight beside the rim.
    cheek(x,y,X,y+t,L2-.175)
    cheek(x,Y-t,X,Y,L2-.24)
    for lo,hi in ((x,x+t),(X-t,X)):
        cheek(lo,y+t,hi,Y-t,L2-.175)
    # The north curb bears directly on the old glulam rim. The narrower CLT
    # infill moved the south edge: a bolted steel shelf takes that curb to the
    # actual edge beam. The bearing hardware stays under the gallery deck.
    g.box('Structure / Raised ceiling shelf','Graphite steel',x,Y-t-.011,L2-.252,X,Y-.012,L2-.24)
    g.box('Structure / Raised ceiling shelf','Graphite steel',x,Y-.012,L2-.44,X,Y,L2-.24)
    for xx in (53.12,53.83,54.53,55.23,55.94,56.50):
        for h in (L2-.29,L2-.39):
            g.beam('Structure / Raised ceiling shelf bolts','Graphite steel',
                   (xx,Y-.015,h),(xx,Y+.145,h),.016)


def floor_seam_returns():
    # Short CLT returns have pockets for the actual upright, saddle and beam
    # tops. Each return bears on two steel outriggers screwed into the deck
    # on both sides of the seam. The L2 north slab already meets the plinth.
    from shell_skin import L3
    import numpy as np
    framing=[]
    for shape in g.coordination_members:
        points=np.asarray(shape)
        lo,hi=points.min(axis=0),points.max(axis=0)
        if lo[0]>=56.975 or hi[0]<=56.65 or hi[1]<1.32 or lo[1]>18.79:continue
        if not any(lo[2]<h-.002 and hi[2]>h-.238 for h in (L2,L3)):continue
        if all(len(np.unique(np.round(points[:,axis],5)))==2 for axis in range(3)):
            framing.append((*lo,*hi))
    for h,north,X,near,far in ((L2,False,56.94,17.855,18.36),
                                (L3,True,56.975,NORTH_GLAZING+.026,1.515),
                                (L3,False,56.975,17.855,SOUTH_SKIN-.085)):
        blocks=[p for p in framing if p[0]<X and p[3]>56.65 and p[1]<far and p[4]>near
                and p[2]<h and p[5]>h-.24]
        xs=sorted({56.65,X,*[q for p in blocks for q in (p[0],p[3]) if 56.65<q<X]})
        ys=sorted({near,far,*[q for p in blocks for q in (p[1],p[4]) if near<q<far]})
        for x,u in zip(xs,xs[1:]):
            for y,v in zip(ys,ys[1:]):
                depths=[(h-.24,h)]
                for a,b,c,A,B,C in blocks:
                    if a<(x+u)/2<A and b<(y+v)/2<B:
                        depths=[(p,q) for low,high in depths for p,q in
                                ((low,min(high,c)),(max(low,C),high)) if q-p>.001]
                for lo,hi in depths:
                    g.box('Structure / Annex junction floor returns','CLT spruce',x,y,lo,u,v,hi)
        seam=far if north else near
        sign=-1 if north else 1
        projection=far-near
        backspan=max(.53,1.45*projection)
        length=sorted((seam+sign*(projection-.025),seam-sign*backspan))
        # Keep the eastern L2 outrigger 3 mm inside the return-wall lining.
        east_fixing=56.916 if h==L2 and not north else 56.922
        for x in (56.856,east_fixing):
            g.box('Structure / Annex floor return outriggers', 'Graphite steel',
                  x-.021,length[0],h-.365,x+.021,length[1],h-.24)
            # Two lag screws in the new piece, two farther into the backspan.
            for offset in (projection*.28,projection*.72,-backspan*.25,-backspan*.85):
                y=seam+sign*offset
                g.beam('Structure / Annex return dowels','Galvanized silver',
                       (x,y,h-.370),(x,y,h-.035),.013)


def build_east_soffit():
    plinth_folds()
    raised_lobby_ceiling()
    floor_seam_returns()
