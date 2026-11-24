"""Build Market Crossing, a layered gallery teaching case in registered metres. Run with Python and NumPy."""
import json
import math
from pathlib import Path
import sys
import geometry as geo
import gallery_cantilevers as gallery
from geometry import beam,box,clip,grade,plate,rect
from shell_skin import WEST_SKIN,EAST_SKIN,NORTH_SKIN,SOUTH_SKIN,wall_foot,deck_soffit,tapered_post,MAIN_GIRDER_TOP

G=2.50; B=G-140*.0254; L2=G+154*.0254; L3=L2+168*.0254
S='Structure / ';E='Enclosure / ';I='Interior / ';A='Circulation / ';M='Market / ';T='Site / ';P='Energy / '
RC='Board-formed concrete'; ST='Graphite steel'; WH='Galvanized silver'; RED='Vermilion steel'; YEL='Citron enamel'
GL='Vision glass'; TR='Translucent channel glass'; WD='Oiled birch'; FL='Terrazzo'; DARK='Dark reveal'; PV='Blue-black photovoltaics'
palette={RC:('aaa69d',.88,0,1),ST:('424b4a',.61,.16,1),WH:('d1d4cc',.52,.20,1),RED:('e35537',.54,.09,1),
 YEL:('c2d34d',.6,.06,1),GL:('659092',.32,.04,.37),TR:('b0c9bf',.43,.04,.72),WD:('bd956b',.8,0,1),
 FL:('dfdbcd',.85,0,1),DARK:('495454',.68,.04,1),PV:('384c60',.38,.17,1),'Basalt pavers':('9e9b8e',.9,0,1),
 'Planting':('869263',.93,0,1),'Ochre':('d5a649',.8,0,1),'Leaf':('71856b',.8,0,1),'Chalk':('ece8d9',.8,0,1)}
GLULAM='Douglas-fir glulam';CLT='CLT spruce'
palette[GLULAM]=('af8259',.78,0,1)
palette['Glulam spruce']=('bd9f78',.78,0,1)
palette[CLT]=('d7b68a',.82,0,1)
counts={'stalls':0,'classrooms':0,'offices':0,'pv':0,'canopyRoof':0,'insulatedRoof':0,'roofLights':0}
# Flush bands are cut into the actual paving mesh. Both finishes share each
# edge and elevation, including the turns around the surveyed Fourth Ave trees.
from market_roofs import BANKS, DEPTH, AISLE, CROSS_AISLES
paving_finish='Buff limestone pavers'
palette[paving_finish]=('c7b89d',.91,0,1)
def street_ribbons(x):
    # The last market aisle reaches Fourth north of the trunk at (-.62,53.08).
    # Its route bends back into the stall aisle inside the first two bays.
    shift=max(0.,min(1.,(7.0-x)/5.0))*1.35
    result=[]
    for i,(n,_,_,_) in enumerate(BANKS):
        c=n+DEPTH+AISLE/2-(shift if i==2 else 0)
        result.append((c-.93,c+.93))
    # The two arcades meet at the east landing. The lower-level corridor
    # eases into the opening between the separate forum bridge posts.
    centre=21.10+.46*max(0.,min(1.,(49.65-x)/(49.65-47.40)))
    result.append((centre-.66,centre+.66))
    if 50.45<=x<=52.55: result.append((21.1,24.92))
    if x<=7.75: result.extend([(8.62,10.42),(15.43,17.23)])
    if 60.38<=x<=62.18: result.append((18.75,21.10))
    if x>=69.765: result.append((9.02,11.30))
    return result

def split_paving(poly, at):
    # Split a convex polygon at a straight line, preserving shared endpoints.
    negative=[]; positive=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da,db=at(*a),at(*b)
        if da<=1e-9: negative.append(a)
        if da>=-1e-9: positive.append(a)
        if da*db < -1e-15 and abs(da)>1e-9 and abs(db)>1e-9:
            c=tuple(a[i]+(b[i]-a[i])*da/(da-db) for i in range(2))
            negative.append(c);positive.append(c)
    return negative,positive

def emit_pavers(poly,xa,xb,ya):
    if len(poly)<3:return
    # Small inset selects the interior side at the end of a piecewise band.
    delta=(xb-xa)*1e-7
    xm=(xa+xb)/2
    first,last=street_ribbons(xa+delta),street_ribbons(xb-delta)
    if any(abs(xm-c)<.9 for c in CROSS_AISLES):
        # Only the western crossing has full headroom below both arcade ramps.
        first.append((20.42 if xm<CROSS_AISLES[1]-.9 else BANKS[0][0]+DEPTH+AISLE/2,53.2))
        last.append(first[-1])
    cells=[poly]
    for pair0,pair1 in zip(first,last):
        for edge,other in zip(pair0,pair1):
            slope=(other-edge)/(xb-xa-2*delta)
            cut=lambda x,y:y-edge-(x-xa-delta)*slope
            pieces=[]
            for cell in cells:
                if min(cut(*p) for p in cell)<-1e-8 and max(cut(*p) for p in cell)>1e-8:
                    pieces.extend(split_paving(cell,cut))
                else:pieces.append(cell)
            cells=pieces
    for cell in cells:
        cx=sum(p[0] for p in cell)/len(cell);cy=sum(p[1] for p in cell)/len(cell)
        light=any(lo<cy<hi for lo,hi in street_ribbons(cx))
        light=light or (any(abs(cx-c)<.90 for c in CROSS_AISLES) and
                        (20.42 if cx<CROSS_AISLES[1]-.9 else BANKS[0][0]+DEPTH+AISLE/2)<cy<53.2)
        mat=paving_finish if light else ('Chalk' if 18.75<=ya<20.3 else 'Basalt pavers')
        for i in range(1,len(cell)-1):
            vs=[cell[0],cell[i],cell[i+1]]
            cross=(vs[1][0]-vs[0][0])*(vs[2][1]-vs[0][1])-(vs[1][1]-vs[0][1])*(vs[2][0]-vs[0][0])
            if abs(cross)>1e-7:plate(T+'Market court paving',mat,vs,terrain,.14)

def frange(a,b,step):
    while a<=b+1e-8:
        yield a;a+=step

def footing(x,y,top,w=.52,base=B-.30):
    box(S+'Bearings and foundations',RC,x-.63,y-.63,base-.35,x+.63,y+.63,base)
    box(S+'Columns and cores',RC,x-w/2,y-w/2,base,x+w/2,y+w/2,G+.14)
    tapered_post(S+'Head house glulam columns',GLULAM,rect(x-w/2,y-w/2,x+w/2,y+w/2),lambda u,v:G+.14,top)

def doorway(l,m,x,y,X,Y,lo,hi,opening=None,t=.13):
    """Wall along an axis with a real opening and separate lintel."""
    horiz=abs(X-x)>abs(Y-y)
    def segment(a,b,z,Z):
        if horiz:box(l,m,a,y-t/2,z,b,y+t/2,Z)
        else:box(l,m,x-t/2,a,z,x+t/2,b,Z)
    a,b=(x,X) if horiz else (y,Y)
    if opening:
        p,q=opening;segment(a,p,lo,hi);segment(q,b,lo,hi);segment(p,q,min(lo+2.35,hi),hi)
    else:segment(a,b,lo,hi)

guard_posts=set()
def handrail(a,b,baseA,baseB,layer,material=RED,posts=True,curbside=False):
    x,y=a;X,Y=b;length=math.hypot(X-x,Y-y)
    for h in (.10,.67,1.08):
        beam(layer,material,(x,y,baseA+h),(X,Y,baseB+h),.040 if h>.2 else (.045 if curbside else .090),.045 if h>.2 else .14)
    if posts:
        n=max(1,math.ceil(length/1.55))
        for k in range(n+1):
            t=k/n;xx=x+t*(X-x);yy=y+t*(Y-y);zz=baseA+t*(baseB-baseA)
            key=(layer,material,round(xx,4),round(yy,4),round(zz,4))
            if key in guard_posts:continue
            guard_posts.add(key)
            half=.021 if curbside else .027
            box(layer,material,xx-half,yy-half,zz,xx+half,yy+half,zz+1.08)

def slab(layer,mat,x,y,X,Y,z,depth=.20): box(layer,mat,x,y,z-depth,X,Y,z)
# Regular planar building floor with openings subtracted once at all shared edges.
def floor_with_voids(l,m,bounds,holes,z,depth=.24):
 x,y,X,Y=bounds;xs=sorted({x,X,*[a for h in holes for a in (h[0],h[2]) if x<a<X]})
 ys=sorted({y,Y,*[a for h in holes for a in (h[1],h[3]) if y<a<Y]})
 for a,b in zip(xs,xs[1:]):
  for c,d in zip(ys,ys[1:]):
   if not any(u<(a+b)/2<U and v<(c+d)/2<V for u,v,U,V in holes):
    poly=rect(a,c,b,d)
    bound=lambda xy:82.906-40.5383*xy[1]/57.912-xy[0]-.04
    result=[]
    for q,r in zip(poly,poly[1:]+poly[:1]):
        k,h=bound(q),bound(r)
        if k>=0:result.append(q)
        if k*h<0:result.append(tuple(q[i]+(r[i]-q[i])*k/(k-h) for i in (0,1)))
    if len(result)>2:plate(l,m,result,z,depth)
def stair(name,bounds,alongx):
 x,y,X,Y=bounds
 def part(l,m,a,b,c,d,z,Z):
    if alongx:box(l,m,x+a,y+b,z,x+c,y+d,Z)
    else:box(l,m,x+b,y+a,z,x+d,y+c,Z)
 length=(X-x) if alongx else (Y-y);width=(Y-y) if alongx else (X-x)
 ww=(width-.22)/2;landing=1.44;bottom=0
 for lo,hi in [(B,G),(G,L2),(L2,L3)]:
    steps=round((hi-lo)/.1778);n1=steps//2;n2=steps-n1;r=(hi-lo)/steps
    for n,left,z0,rev in [(n1,.07,lo,False),(n2,width/2+.04,lo+n1*r,True)]:
      tread=.2794;run=n*tread
      for i in range(n):
       a=landing+(run-(i+1)*tread if rev else i*tread)
       part(A+name+' stair',WH,a,left,a+tread,left+ww,z0+(i+1)*r-.13,z0+(i+1)*r)
      for yy in [left+.035,left+ww-.035]:
       def point(a,h):return (x+a,y+yy,h) if alongx else (x+yy,y+a,h)
       beam(A+name+' stair',ST,point(landing,z0+(n*r if rev else 0)-.17),point(landing+run,z0+(0 if rev else n*r)-.17),.10,.25)
       beam(A+name+' stair',ST,point(landing,z0+(n*r if rev else 0)+.90),point(landing+run,z0+(0 if rev else n*r)+.90),.052,.052)
    part(A+name+' stair',WH,landing+n1*.2794,0,length,width,lo+n1*r-.16,lo+n1*r)
    part(A+name+' stair',FL,0,0,landing,width,lo-.18,lo)
 part(A+name+' stair',FL,0,0,landing,width,L3-.18,L3)

# Build only the parts of the surveyed ground which lie outside the excavation.
# Paving nodes on the shared edges have identical coordinates. The public threshold
# eases up to the hall datum while the three vendor aisles retain the registered grade.
exc=(13.4,1.45,65.6,18.75)
court=(39.85,6.90,47.95,16.90)
court_slab=(court[0]-.085,court[1]-.085,court[2]+.085,court[3]+.085)
west=(14.0,1.70,21.4,4.90)
east=(48.3,14.0,55.65,17.65)
lift=(52.3,10.60,55.30,13.60)
def core_trimmed_spans(x,start,end,cores):
    """Seat transverse members on solid walls at every shaft on their axis."""
    spans=[(start,end)]
    for left,near,right,far in cores:
        if not left<x<right:continue
        spans=[(a,b) for lo,hi in spans for a,b in
               ((lo,min(hi,near+.08)),(max(lo,far-.08),hi)) if b-a>.01]
    return spans
def core_floor_girder(label,x,a,b,top,width,depth):
    """Seat timber on the faces of transverse core walls."""
    if lift[0]<x<lift[2] and abs(a-lift[3])<.09 and abs(b-east[1])<.09:
        # Only 400 mm between these concrete cores. The short concrete link bears
        # directly on both walls rather than squeezing two hangers into this gap.
        box(S+'Lift and stair coupling beams',RC,x-width/2,lift[3]-.08,top-depth,
            x+width/2,east[1]+.08,top)
        return
    for left,near,right,far in (west,east,lift):
        if not left < x < right:continue
        for face,out in ((near,-1),(far,1)):
            if min(abs(a-face),abs(b-face))>.081:continue
            end=face+out*.018
            if abs(a-face)<abs(b-face):a=end
            else:b=end
            y0,y1=sorted((face,face+out*.27))
            z=top-depth
            box(S+'Core beam seats',ST,x-width/2-.015,y0,z-.024,x+width/2+.015,y1,z)
            y0,y1=sorted((face,face+out*.014))
            box(S+'Core beam embeds',ST,x-width/2-.035,y0,z-.13,x+width/2+.035,y1,z+.26)
            for ox in (-width*.30,width*.30):
                for h in (-.065,.19):
                    beam(S+'Core embed anchors',ST,(x+ox,face,z+h),(x+ox,face-out*.12,z+h),.024)
    if b>a:beam(S+label,GLULAM,(x,a,top-depth/2),(x,b,top-depth/2),width,depth)

def street_height(x):
    if x<=46.55:return .33+(G-.33)*x/46.55
    return G-.05*min(1,(x-46.55)/19)
def terrain(x,y):
    t=max(0,min(1,(y-10)/8.75,(25.4-y)/3.4))
    z=grade(x,y)+.024+(street_height(x)-grade(x,y)-.024)*t
    if 44.15<x<58.85 and 20.3<y<27.8:
        # Raise the apron to meet the bottom of the switchback. At its former
        # east edge the landing floated more than half a metre over the court.
        across=max(0.,min(1.,(y-20.3)/(22.865-20.3),(27.8-y)/(27.8-25.135)))
        along=max(0.,min(1.,(x-44.15)/(47.45-44.15),(58.85-x)/(58.85-52.55)))
        z+=(G-z)*across*along
    if x>=69.765 and 8.5<=y<=11.82:
        # The café sill adjoins a level landing with splayed graded flanks
        # and a sloping apron running toward the Detroit Street sidewalk.
        across=max(0.,min(1.,(y-8.5)/.52,(11.82-y)/.52))
        along=max(0.,min(1.,(74.55-x)/(74.55-71.08)))
        z+=(G-z)*across*along
    return z
xbreak=[0,2.6,6.2,13.4,15.0,24.2,35.0,45.8,46.55,56.6,65.6,82.906]
xbreak=sorted(set(xbreak+[2.,7.,7.75,44.15,47.40,47.45,49.65,50.45,52.55,58.85,59.5,60.38,62.18,69.765,71.08,74.55]+[x+d for x in CROSS_AISLES for d in (-.9,.9)]))
ybreak=[0,1.45,8.5,9.02,10,11.30,11.82,15.5,18.75,19.88,20.3,22.0,22.5,22.865,25.135,25.4,27.80,57.912]
for xa,xb in zip(xbreak,xbreak[1:]):
 for ya,yb in zip(ybreak,ybreak[1:]):
    if xa>=exc[0] and xb<=exc[2] and ya>=exc[1] and yb<=exc[3]:continue
    if 47.45<=xa and xb<=50.45 and 22.865<=ya and yb<=25.135:continue
    if 15.0<=xa and xb<=46.55 and ya==18.75:continue
    for fac in [[(0,0),(82.906,0),(0,57.912)],[(82.906,0),(42.3677,57.912),(0,57.912)]]:
        poly=fac
        for a,v,side in [(0,xa,True),(0,xb,False),(1,ya,True),(1,yb,False)]:poly=clip(poly,a,v,side)
        emit_pavers(poly,xa,xb,ya)

x,y,X,Y=exc
floor_with_voids(S+'Lower-ground slab',RC,(x,y,X,Y),[lift],B,.1524)
# The two load-bearing stair walls continue across the floor to a local thickened
# concrete mat. At the NW pile cap the shallower step joins the existing cap;
# the two concrete solids share faces at their joint.
core_mats=[(left-.24,near-.20,right+.24,far+.20) for left,near,right,far in (west,east)]
pile=(13.4-1.24,1.65-1.15,13.4+1.24,1.65+1.15)
for bounds in core_mats:
    floor_with_voids(S+'Core foundation mats',RC,bounds,[pile],B-.1524,.60)
    x0,y0=max(bounds[0],pile[0]),max(bounds[1],pile[1])
    x1,y1=min(bounds[2],pile[2]),min(bounds[3],pile[3])
    if x1>x0 and y1>y0:slab(S+'Core to pile cap step',RC,x0,y0,x1,y1,B-.1524,.25-.1524)

for xx in [x,X-.4572]:box(S+'Retaining walls',RC,xx,y,B,xx+.4572,Y,G-.22)
for yy in [y,Y-.4572]:box(S+'Retaining walls',RC,x+.4572,yy,B,X-.4572,yy+.4572,G-.22)
floor_with_voids(S+'Public ground floor',RC,(13.4,1.45,65.6,18.75),[west,east,lift],G,.22)
floor_with_voids(S+'Eastern plinth',RC,(65.6,1.515,69.765,17.855),[],G,.22)
# A bridge along the hall's north rim delivers the upper route to the west studios.
hall=(13.80,3.65,40.0,18.32)
small=(56.95,1.60,69.95,13.04)
for z,layer in [(L2,'Forum and terraces'),(L3,'Studios and bridges')]:
    openings=[hall,west,east,lift]
    if z==L3:openings += [court_slab,small]
    if z==L2:
        # Inhabited west theatre steps and the sloped east underside replace a flat tip slab.
        floor_with_voids(S+layer,CLT,(13.4,NORTH_SKIN+.085,47.96,18.48),openings,z)
        floor_with_voids(S+layer,CLT,(47.96,NORTH_SKIN+.085,56.65,18.48),[west,east,lift,(52.96,5.80,56.65,9.0)],z)
        # A 770 mm infill strips the pinch out of the staff-to-lift gallery.
        # Both long edges of this separate deck have real bearing lines.
        slab(S+'Staff gallery loggia infill',CLT,52.96,8.23,56.65,8.855,L2,.24)
        # Rebate the underside over the existing rim; the floor top is flush.
        slab(S+'Staff gallery loggia infill',CLT,52.96,8.855,56.65,9.00,L2,.175)
    else:
        floor_with_voids(S+layer,CLT,(WEST_SKIN+.085,NORTH_SKIN+.085,56.65,SOUTH_SKIN-.085),openings,z)
    floor_with_voids(S+layer,CLT,(56.65,1.515,69.765,17.855),openings,z)
# Grade-level front of house joins the public ground walk via a shallow sloping apron.
# A continuous level porch serves both banks of folding hall doors, returning to the gentle street walk.
for xa,xb in [(15.0,24.2),(24.2,35.0),(35.0,45.8),(45.8,46.55)]:
    corners=rect(xa,18.75,xb,19.88)
    vs=[(u,v,terrain(u,v)-.16) for u,v in corners]+[(u,v,G) for u,v in corners]
    geo.solid(A+'Level hall porch','Chalk',vs,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
handrail((15.08,19.82),(37.02,19.82),G,G,A+'Porch edge rail',ST)
# Public terrace under the lifted western room; the accessible route joins the same hall doors from the east.
for i in range(-1,10):
    x=8.13+i*.38;top=G-(9-i)*.1778
    box(A+'Fourth Avenue entrance steps',RC,x,14.56,.55,x+.38,18.12,top)
slab(A+'West entrance landing',RC,11.93,14.56,13.4,18.12,G,.27)
# Recess a second arrival into the west forecourt. The upper landing turns
# north to the hall door while the stair reaches Fourth at plan ordinate 9.52,
# clear of the street tree aligned with that door at ordinate 6.48.
slab(A+'West hall entrance terrace',RC,11.93,4.88,13.4,14.56,G,.27)
# A low transverse wall below each landing bay bears on the western forecourt.
for yy in (5.00,8.35,10.69,14.56,17.98):
    base=min(terrain(12.02,yy),terrain(13.40,yy))-.18
    box(S+'West entrance terrace bearings',RC,12.02,yy-.09,base,13.40,yy+.09,G-.27)
handrail((11.97,18.07),(13.37,18.07),G,G,A+'West terrace edge guards',ST)
for i in range(11):
    a=7.75+i*.38;top=G-(10-i)*.1778
    box(A+'West hall entrance steps',RC,a,8.35,.48,a+.38,10.69,top)
for yy in (8.39,10.65):
    handrail((7.77,yy),(11.91,yy),G-10*.1778,G,A+'West entrance handrails',ST)
for lo,hi in ((4.9,8.35),(10.69,14.56)):
    handrail((11.97,lo),(11.97,hi),G,G,A+'West terrace edge guards',ST)
handrail((11.97,4.91),(13.37,4.91),G,G,A+'West terrace edge guards',ST)
for y in (14.62,18.05):
    handrail((7.76,y),(11.92,y),G-10*.1778,G,A+'West entrance handrails',ST)
plate(A+'Public foyer threshold','Chalk',rect(46.55,18.75,59.5,19.23),lambda x,y:G+(terrain(x,19.23)-G)*(y-18.75)/.48,.12)
for name,bounds in [('West',west),('East',east)]:
    stair(name,bounds,True)
    x,y,X,Y=bounds
    for yy in [y+.08,Y-.08]:
        for lo,hi in [(B,G),(G,L2),(L2,L3),(L3,L3+2.86)]:
            opening=(x+.11,x+1.46) if yy>y+.2 else None
            if name=='East' and yy<y+.2 and lo==L2:
                # A second exit from the level landing serves the staff wing
                # on the west side of the lift and the light-court gallery.
                # Cast the lintel into 200 mm pockets in the side piers.
                p,q=48.51,49.71
                for xa,xb in ((x,p),(q,X)):
                    box(S+'Concrete stair cores',RC,xa,y,lo,xb,y+.16,lo+2.35)
                for xa,xb in ((x,p-.20),(q+.20,X)):
                    box(S+'Concrete stair cores',RC,xa,y,lo+2.35,xb,y+.16,lo+2.68)
                box(S+'Stair gallery lintel',RC,p-.20,y,lo+2.35,q+.20,y+.16,lo+2.68)
                box(S+'Concrete stair cores',RC,x,y,lo+2.68,X,y+.16,hi)
                for xa,xb in ((p,p+.16),(q-.16,q)):
                    box(A+'Stair gallery door casing',WH,xa,y+.122,lo,xb,y+.151,lo+2.35)
            else:doorway(S+'Concrete stair cores',RC,x,yy,X,yy,lo,hi,opening,.16)
    box(S+'Concrete stair cores',RC,X-.16,y+.16,B,X,Y-.16,L3+2.86)
x,y,X,Y=lift
# The stair lies only 0.40 m south of the shaft. The freight door therefore
# opens east at every stop, toward the gallery and its level maneuvering space.
lift_low, lift_high=y+.62,Y-.62
lift_back, lift_top, pit=X-.27,L3+3.00,B-1.12
slab(S+'Freight lift pit floor',RC,x,y,X,Y,pit,.30)
box(S+'Freight lift core',RC,x,y,pit,x+.16,Y,lift_top)
for lo,hi in [(y,y+.16),(Y-.16,Y)]:
    box(S+'Freight lift core',RC,x+.16,lo,pit,X,hi,lift_top)
for lo,hi in [(y+.16,lift_low),(lift_high,Y-.16)]:
    box(S+'Freight lift core',RC,lift_back,lo,pit,X,hi,lift_top)
box(S+'Freight lift core',RC,lift_back,lift_low,pit,X,lift_high,B-.13)
for level,head in [(B,G-.13),(G,L2-.13),(L2,L3-.13),(L3,lift_top)]:
    # The concrete head spans the opening between continuous side piers.
    # The steel sill ends exactly at the deck edge, with no overlaid face.
    box(S+'Freight lift lintels',RC,lift_back,lift_low,level+2.35,X,lift_high,head)
    box(S+'Freight lift sill seats',RC,lift_back,lift_low,level-.13,X,lift_high,level-.032)
    box(A+'Freight lift thresholds',WH,lift_back,lift_low,level-.032,X,lift_high,level)
    mid=(lift_low+lift_high)/2
    for lo,hi in [(lift_low,mid-.002),(mid+.002,lift_high)]:
        box(A+'Lift doors',WH,lift_back,lo,level,lift_back+.045,hi,level+2.35)

# Continuous reinforced-concrete wall bands receive the two diaphragm braces.
# Their four closed longitudinal bars stay within the concrete, including the
# east door head. Vertical bars connect the lower soffit ties to the first band.
def lift_ring(height):
    left,near,right,far=lift
    for cover in (.054,.105):
        corners=rect(left+cover,near+cover,right-cover,far-cover)
        for level in (height-.052,height+.052):
            for start,end in zip(corners,corners[1:]+corners[:1]):
                beam(S+'Lift ring reinforcement',ST,(*start,level),(*end,level),.018)

def lift_framed_tie(layer,a,b,width,ring_height):
    # Intersect the brace axis with the four actual exterior wall faces. Two
    # disjoint exterior bars terminate at embedded plates on the concrete
    # ring; its perimeter bars transfer the reaction around the hoistway.
    left,near,right,far=lift
    delta=[v-u for u,v in zip(a,b)]
    intersections=[]
    for axis,face,inward in ((0,left,1),(0,right,-1),(1,near,1),(1,far,-1)):
        if abs(delta[axis])<1e-8:continue
        t=(face-a[axis])/delta[axis]
        if not 0<t<1:continue
        p=tuple(u+d*t for u,d in zip(a,delta))
        minimum,maximum=(near,far) if axis==0 else (left,right)
        if minimum<p[1-axis]<maximum:intersections.append((t,p,axis,inward))
    if not intersections:
        beam(S+layer,ST,a,b,width)
        return
    assert len(intersections)==2,'Brace must have a physical end on each side of the lift'
    intersections.sort()
    beam(S+layer,ST,a,intersections[0][1],width)
    beam(S+layer,ST,intersections[1][1],b,width)
    for _,entry,axis,inward in intersections:
        def point(depth,side,height):
            run=list(entry)
            run[axis]+=inward*depth
            run[1-axis]+=side
            run[2]=height
            return tuple(run)
        h=entry[2]
        ends=zip(point(-.012,-.12,h-.13),point(.016,.12,h+.13))
        extents=[sorted(pair) for pair in ends]
        box(S+'Lift brace embed plates',ST,*(p[0] for p in extents),*(p[1] for p in extents))
        for side in (-.073,.073):
            for offset in (-.052,.052):
                level=h+offset
                beam(S+'Lift brace embed studs',ST,point(.013,side,level),point(.108,side,level),.022)
                beam(S+'Lift ring cross links',ST,point(.050,side,ring_height+offset),
                     point(.109,side,ring_height+offset),.016)
            beam(S+'Lift brace vertical collectors',ST,point(.080,side,min(h,ring_height)-.065),
                 point(.080,side,max(h,ring_height)+.065),.025)

for level in (L2+2.65,MAIN_GIRDER_TOP-.10):lift_ring(level)
# Behind this short screen the rising diagonal enters the concrete. The
# public hall entrance and the hall-support gallery are reached to the east.
for xx in (52.73,53.66):
    handrail((xx,9.88),(xx,10.56),L2,L2,A+'Lift brace bay guards',ST)
handrail((52.73,9.88),(53.66,9.88),L2,L2,A+'Lift brace bay guards',ST)
handrail((53.00,8.27),(56.60,8.27),L2,L2,A+'Staff gallery loggia guard',ST)

# Two continuous side trusses. Sloping ends lift the belly clear of the streets.
stations=[2.6+3.6*i for i in range(16)]
def soffit(x):
    return 6.05+max(0,13.4-x)*2.2116/10.8+max(0,x-45.8)*1.7/10.8
# Actual member dimensions are used in both the wire-frame calculation and mesh.
# Width always runs north–south. Depth is perpendicular to grain in the truss plane.
def shell_member(layer,y,a,b,width,depth):
    x,z=a;X,Z=b
    axis=math.hypot(X-x,Z-z)
    dx=-(Z-z)/axis*depth/2;dz=(X-x)/axis*depth/2
    vertices=[(u+sign*dx,y+side*width/2,v+sign*dz)
              for u,v in [a,b] for side,sign in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    geo.solid(S+layer,GLULAM,vertices,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
chord=(.63,.990);diagonal=(.585,.855);upright=(.315,.45);bearingpost=(.63,.90)
for y in (1.65,18.35):
 for i,x in enumerate(stations):
    low=soffit(x)
    width,depth=bearingpost if i in (3,12) else upright
    shell_member('Glulam posts',y,(x,low-.22 if i in (3,12) else low+.22),(x,13.35-.22),width,depth)
    for zz in [low,13.35]:
        # Timber ends transfer through buried plates; the visible circles are the pin ends.
        for oy in [-.115,.115]:
            box(S+'Concealed node plates',ST,x-.28,y+oy-.010,zz-.29,x+.28,y+oy+.010,zz+.29)
        for ox,dz in [(-.16,0),(.16,0),(0,.12),(0,-.12)]:
            beam(S+'Node dowels',WH,(x+ox,y-chord[0]/2-.006,zz+dz),(x+ox,y+chord[0]/2+.006,zz+dz),.042)
    if i in (3,12):
        # Direct, parallel-to-grain load path to the concrete pedestal; node tie to the core at floor level.
        box(S+'Primary bearing pedestals',RC,x-.58,y-.50,B-.25,x+.58,y+.50,G+.33)
        box(S+'Hold-down shoes',ST,x-.49,y-.38,G+.33,x+.49,y+.38,G+.41)
        box(S+'Glulam bearing columns',GLULAM,x-bearingpost[1]/2,y-bearingpost[0]/2,G+.41,x+bearingpost[1]/2,y+bearingpost[0]/2,low-.31)
        box(S+'Steel node seats',ST,x-.51,y-.34,low-.32,x+.51,y+.34,low-.22)
        for off in (-.21,.21):
            box(S+'Chord splice plates',ST,x-.81,y+off-.012,low-.19,x+.81,y+off+.012,low+.19)
        # Fixed line and guided line have different seats. Both deliver vertical reactions by bearing.
        if i==12:
            for off in (-.33,.33):box(S+'Guided shoe cheeks',ST,x-.50,y+off-.018,G+.38,x+.50,y+off+.018,G+.50)
        else:
            for off in (-.41,.41):box(S+'Fixed shoe stops',ST,x+off-.025,y-.34,G+.38,x+off+.025,y+.34,G+.50)
        slab(S+'Indicative pile caps',RC,x-1.24,y-1.15,x+1.24,y+1.15,B-.25,.86)
        # Only the shaft heads are drawn. Boring logs and pile tests determine the foundation below.
        for ox in (-.62,.62):
            for oy in (-.54,.54):
                ring=[(x+ox+.32*math.cos(j*math.pi/6),y+oy+.32*math.sin(j*math.pi/6)) for j in range(12)]
                plate(S+'Drilled shaft heads',RC,ring,B-1.11,1.04)
    if i==15:continue
    nx=stations[i+1];nl=soffit(nx)
    a=x+(.46 if i in (3,12) else 0);b=nx-(.46 if i+1 in (3,12) else 0)
    shell_member('Glulam chords',y,(a,soffit(a)),(b,soffit(b)),*chord)
    if i%3==0:shell_member('Glulam chords',y,(x,13.35),(stations[min(15,i+3)],13.35),*chord)
    z,Z=(low,13.35) if i%2==0 else (13.35,nl)
    # Trim wood clear of chord joinery; slotted knife plates transfer forces across the node.
    t=.30/abs(Z-z)
    shell_member('Glulam Warren webs',y,(x+3.6*t,z+(Z-z)*t),(nx-3.6*t,Z+(z-Z)*t),*diagonal)
# A broad, shallow girder gives the highest occupied floor clear headroom.
# 0.55 x 0.74 m retains the original 0.30 x 0.90 m girder's strong-axis
# second moment of area. The bearing shoe and cheek plates fit the wider beam.
from rooflight_framing import court_beam_shoe
from studio_galleries import roof_girder_width
roof_depth=.74
roof_rim_width=.32
for i,x in enumerate(stations):
    roof_width=roof_girder_width(x)
    for a,b in ([(1.965,6.64-roof_rim_width/2-.012),(17.16+roof_rim_width/2+.012,18.035)] if court[0]<x<court[2] else [(1.965,18.035)]):
        for lo,hi in core_trimmed_spans(x,a,b,(lift,)):
            if lift[0]<x<lift[2]:
                core_floor_girder('Glulam roof girders',x,lo,hi,MAIN_GIRDER_TOP,roof_width,roof_depth)
            else:
                beam(S+'Glulam roof girders',GLULAM,(x,lo,MAIN_GIRDER_TOP-roof_depth/2),
                     (x,hi,MAIN_GIRDER_TOP-roof_depth/2),roof_width,roof_depth)
    if court[0]<x<court[2]:
        for y,sense in ((6.64-roof_rim_width/2,-1),(17.16+roof_rim_width/2,1)):
            court_beam_shoe(1,x,y,sense,roof_width,MAIN_GIRDER_TOP-roof_depth,13.22)
    shoe_half=roof_width/2+.019
    for y,end in ((1.965,1),(18.035,-1)):
        ya,yb=sorted((y,y+end*.22))
        slab(S+'Roof girder hangers',ST,x-shoe_half,ya,x+shoe_half,yb,MAIN_GIRDER_TOP-roof_depth,.018)
        for side in (-1,1):
            edge=x+side*(roof_width/2+.008)
            box(S+'Roof girder hangers',ST,edge-.008,ya,MAIN_GIRDER_TOP-roof_depth,edge+.008,yb,MAIN_GIRDER_TOP-.09)
        ya,yb=sorted((y-end*.012,y+end*.001))
        box(S+'Roof girder hangers',ST,x-shoe_half,ya,MAIN_GIRDER_TOP-roof_depth,x+shoe_half,yb,MAIN_GIRDER_TOP+.12)
        # Four embedded anchors carry hanger reaction into the top chord.
        # At truss ends both rows are kept inside the end of the timber.
        offsets=(.075,.22) if i==0 else (-.22,-.075) if i==len(stations)-1 else (-.13,.13)
        for offset in offsets:
            for zz in (13.20,13.39):
                xx=x+offset
                beam(S+'Roof hanger chord anchors',ST,(xx,y-end*.19,zz),(xx,y+end*.003,zz),.020)
    if x<13.6 or 40<x<56.7:
        for a,b in ([(1.7,6.65),(17.15,18.3)] if court[0]<x<court[2] else [(1.7,18.3)]):
            for lo,hi in core_trimmed_spans(x,a,b,(west,east,lift)):
                core_floor_girder('Glulam floor girders',x,lo,hi,L3-.20,.38,1.22)
    if i%2==0 and i<15 and not (36<x<48):
        lift_framed_tie('Collector ties',(x,1.70,MAIN_GIRDER_TOP-.10),(x+3.60,18.30,MAIN_GIRDER_TOP-.10),.058,MAIN_GIRDER_TOP-.10)
for x in (2.6,6.2,9.8,13.4,42.2,45.8,49.4,53.0,56.6):
    for y in (1.65,18.35):
        saddle_start=max(y-.35,gallery.NORTH_PANEL_BACK+.004) if y<2 else y-.35
        box(S+'Floor girder saddles',ST,x-.23,saddle_start,L3-1.46,x+.23,y+.35,L3-1.40)
        for ox in (-.223,.223):
            box(S+'Floor girder saddles',ST,x+ox-.01,y-.25,L3-1.43,x+ox+.01,y+.25,L3-.12)
# Horizontal trussed rims restrain lower nodes even at openings in the upper floors.
for yy,edge in ((1.65,2.76),(18.35,17.23)):
    for xa,xb in zip(stations,stations[1:]):
        za,zb=soffit(xa)-.18,soffit(xb)-.18
        if yy<2 and xa<west[2] and xb>west[0]:
            # The north chord is tied directly to the continuous stair-core wall
            # across these bays. Keep the stair headroom clear of an inboard rim.
            if xa<west[0]:
                # Return the unsupported end of the rim to the concrete end bay.
                # A short transverse collector joins the primary node to the rim.
                core_start=west[0]+.12
                z=soffit(core_start)-.18
                beam(S+'Laterally braced lower rim',GLULAM,(xa,edge,za),(core_start,edge,z),.17,.26)
                beam(S+'Lateral rim ties',ST,(xa,yy,za),(xa,edge,za),.08,.12)
                beam(S+'Lateral rim ties',ST,(xa,edge,za),(core_start,yy,z),.050)
            if west[0]<xa<west[2]:
                box(S+'Stair core tie plates',ST,xa-.125,1.75,za-.16,xa+.125,1.84,za+.16)
            if xb>west[2]:
                core_end=west[2]-.08
                z=soffit(core_end)-.18
                beam(S+'Laterally braced lower rim',GLULAM,(core_end,edge,z),(xb,edge,zb),.17,.26)
                beam(S+'Lateral rim ties',ST,(core_end,edge,z),(xb,yy,zb),.050)
            continue
        beam(S+'Laterally braced lower rim',GLULAM,(xa,edge,za),(xb,edge,zb),.17,.26)
        beam(S+'Lateral rim ties',ST,(xa,yy,za),(xa,edge,za),.08,.12)
        beam(S+'Lateral rim ties',ST,(xa,yy,za),(xb,edge,zb),.050)
        beam(S+'Lateral rim ties',ST,(xa,edge,za),(xb,yy,zb),.050)
for y in (6.64,17.16):
    beam(S+'Court rim girders',GLULAM,(38.6,y,L3-.60),(49.4,y,L3-.60),.32,.85)
    left=38.6+roof_girder_width(38.6)/2;right=49.4-roof_girder_width(49.4)/2
    beam(S+'Court rim girders',GLULAM,(left+.012,y,13.50),(right-.012,y,13.50),roof_rim_width,.85)
    court_beam_shoe(0,y,left,1,roof_rim_width,13.50-.425,13.26)
    court_beam_shoe(0,y,right,-1,roof_rim_width,13.50-.425,13.26)
for x in (13.4,45.8):
    beam(S+'Glulam portal crossheads',GLULAM,(x,1.65,6.0),(x,18.35,6.0),.32,.70)
# Short basement spans carry the slab over the assembly space without obstructing the hall.
for xx in frange(16.8,65,7.2):
 for yy in (1.75,9.40,18.39):
    if west[0]<xx<west[2] and west[1]<yy<west[3] or east[0]<xx<east[2] and east[1]<yy<east[3]:continue
    box(S+'Basement columns',RC,xx-.23,yy-.23,B,xx+.23,yy+.23,G-.45)
    # Where a column adjoins a stair mat the two footings meet at a formed joint.
    floor_with_voids(S+'Basement column pads',RC,(xx-.57,yy-.57,xx+.57,yy+.57),core_mats,B-.1524,.50)

 for ya,yb in [(1.75,9.40),(9.40,18.39)]:
    for a,b in core_trimmed_spans(xx,ya,yb,(west,east,lift)):
        beam(S+'Basement beams',RC,(xx,a,G-.43),(xx,b,G-.43),.32,.46)
# Keep the low zone below the west studio girders behind a continuous wall.
# Only the five inner tiers offer occupation; the outer part remains a closed service wedge.
for i in range(7,12):
    x=2.6+i*.9;z=L2+(11-i)*.181
    for ya,yb in [(2.0,6.5),(8.55,13.2),(15.25,18.24)]:
        slab(I+'West reading tribune',WD,x,ya,x+.9,yb,z,.19)
        box(I+'West reading tribune',WD,x+.72,ya,z-.19,x+.9,yb,z+.07)
    for ya,yb in [(6.5,8.55),(13.2,15.25)]:slab(A+'Tribune treads','Chalk',x,ya,x+.9,yb,z,.15)
    for ya,yb in zip((1.75,5.88,10.00,14.12),(5.88,10.00,14.12,18.25)):
        beam(S+'Reading tier cross joists',GLULAM,(x,ya,z-.26),(x,yb,z-.26),.16,.29)
for x in (9.80,13.4):
    z=soffit(x)-.60
    beam(S+'Reading tier collectors',GLULAM,(x,1.65,z),(x,18.35,z),.38,1.12)
    for yy in (1.65,18.35):
        box(S+'Collector seats',ST,x-.23,yy-.33,z-.57,x+.23,yy+.33,z-.49)
        for ox in [-.22,.22]:
            box(S+'Collector steel straps',ST,x+ox-.012,yy-.28,z-.51,x+ox+.012,yy+.28,soffit(x)+.23)
for yy in (1.75,5.88,10.00,14.12,18.25):
    beam(S+'Reading tier runners',GLULAM,(8.87,yy,soffit(8.87)-.02),(13.4,yy,soffit(13.4)-.02),.19,.43)
# Complete CLT support around the tall hall and the Level 2 court floor.
for x in [42.2,45.8,49.4,53.0,56.6]:
    # Lift, stair and loggia openings break up the small cross spans; edge beams frame the cuts.
    ys=sorted({1.65,18.35,*[a for h in [east,lift,(52.96,5.8,56.65,9.0)] if h[0]<x<h[2] for a in [h[1],h[3]]]})
    z=L2-.20
    for a,b in zip(ys,ys[1:]):
        if any(h[0]<x<h[2] and h[1]<(a+b)/2<h[3] for h in [east,lift,(52.96,5.8,56.65,9.0)]):continue
        depth=1.12 if b-a>10 else .56
        core_floor_girder('Forum and court cross girders',x,a,b,z,.36,depth)
for yy in [5.8,9.0]:
    beam(S+'Loggia rim beams',GLULAM,(47.90,yy,L2-.50),(56.72,yy,L2-.50),.29,.65)
# The old south loggia rim is continuous to the x49.4 and x56.6 truss bays.
# Three bolted brackets carry the new front edge without columns in the loggia.
beam(S+'Staff gallery edge beam',GLULAM,(52.96,8.32,L2-.36),(56.65,8.32,L2-.36),.18,.24)
for xx in (53.32,54.82,56.28):
    # Top flange under the edge beam, compression strut into a welded plate
    # on the existing rim face, and through-bolts into the timber rim.
    beam(S+'Staff gallery outrigger flange',ST,(xx,8.22,L2-.494),(xx,8.87,L2-.494),.14,.028)
    beam(S+'Staff gallery outrigger knee',ST,(xx,8.32,L2-.513),(xx,8.86,L2-.76),.075,.075)
    box(S+'Staff gallery rim connection',ST,xx-.095,8.84,L2-.795,xx+.095,8.86,L2-.435)
    for level in (L2-.49,L2-.72):
        for dx in (-.053,.053):
            beam(S+'Staff gallery rim bolts',ST,(xx+dx,8.83,level),(xx+dx,9.151,level),.016)
for x in (42.2,49.4,53.0):
    for yy in [1.65,18.35]:
        beam(S+'Deck hanger plates',ST,(x,yy,L2-.6),(x,yy,soffit(x)+.24),.088,.105)
# Braced soffit planes and collectors at the two bearing lines couple the paired trusses.
for x in (2.6,9.8,46.0,53.0):
    for ya,yb in [(1.8,10.0),(10.0,18.2)]:
        lift_framed_tie('Cantilever lateral cross ties',(x,ya,soffit(x)-.22),
                        (x+3.55,yb,soffit(x+3.55)-.22),.052,L2+2.65)
# The east core is anchored to the full truss panel beyond the court.
# Longitudinal collector and transverse tie meet at the same solid panel point.
for z in [L2-.23,L3-.23,13.35]:
    beam(S+'Core drag ties',ST,(45.8,18.2,z),(49.4,18.2,z),.14,.24)
for x,corex,corey in [(13.4,14.2,2.05),(49.4,48.6,14.22)]:
    for z in [L2-.23,L3-.23,13.35]:
        beam(S+'Core drag ties',ST,(x,1.75 if x<20 else 18.2,z),(corex,corey,z),.14,.24)
box(E+'Reading room end wall',WD,8.79,2.02,L2+.57,8.87,18.22,L3-.25)
for y in (2.02,18.22):handrail((8.9,y),(13.4,y),L2+.724,L2,A+'Tribune rails',ST)
# Recessed intermediate east passage rises *with* its folded underside.
# The locally recessed structural floor at the east end of L2 is supported by the annex backspan.
# Three transverse girder lines carry the downslope rafters. Every timber top
# follows the actual deck soffit, including the column end cuts and bearing seats.
rows=(1.90,13.12,17.45)
girder_width=.32
def forum_top(x,y):return deck_soffit(y,True,True)
for y in rows:
    for x in (57.42,63.25,69.23):
        footing(x,y,lambda u,v:forum_top(u,v)-.72,.32)
    plate(S+'Forum glulam roof frame',GLULAM,rect(57.23,y-girder_width/2,69.42,y+girder_width/2),forum_top,.72)
for x in (57.42,60.34,63.25,66.24,69.23):
    for a,b in zip(rows,rows[1:]):
        lo,hi=a+girder_width/2,b-girder_width/2
        depth=.82 if hi-lo>8 else .46
        plate(S+'Forum glulam roof frame',GLULAM,rect(x-.14,lo+.006,x+.14,hi-.006),forum_top,depth)
        for q,direction in ((lo,1),(hi,-1)):
            q0,q1=sorted((q,q+direction*.185))
            plate(S+'Forum concealed rafter shoes',ST,rect(x-.085,q0,x+.085,q1),
                  lambda u,v:forum_top(u,v)-depth,.012)
            q0,q1=sorted((q,q+direction*.009))
            plate(S+'Forum concealed rafter shoes',ST,rect(x-.085,q0,x+.085,q1),
                  lambda u,v:forum_top(u,v)-.12,depth-.12)
            for offset in (-.055,.055):
                h=forum_top(x+offset,q)-.29
                beam(S+'Forum rafter shoe pins',ST,(x+offset,q-direction*.14,h),
                     (x+offset,q+direction*.011,h),.016)
# The court has solid planters, continuous slab below and genuine openings overhead.
for xx,yy,X,Y in [(40.28,8.98,40.93,14.88),(41.2,15.48,44.55,16.03)]:
    box(T+'Sky garden water beds',RC,xx,yy,L2,X,Y,L2+.38)
    box(T+'Sky garden plants','Planting',xx+.08,yy+.08,L2+.38,X-.08,Y-.08,L2+.55)
# The overlook guard is mounted on the occupied rim, clear of the court glazing.
guard=rect(court[0]-.20,court[1]-.20,court[2]+.20,court[3]+.20)
for a,b in zip(guard,guard[1:]+guard[:1]):
    # The full-height, closed upper court wall behind the reception banquette
    # already encloses this edge. The open overlook retains its guard.
    if a[0]==b[0]==guard[2][0]:continue
    handrail(a,b,L3,L3,A+'Court overlook',ST)

# Three different ascents: the public graded ground, the paired arcade inclines,
# and a quieter upper walk winding around the lifted western end.
def flight(label,axis,start,end,center,width,lo,hi,wall_side=False,gallery_side=None):
    run=abs(end-start)
    height=lambda v:lo+(hi-lo)*(v-start)/(end-start)
    def point(v,ac,h):return (v,ac,h) if axis==0 else (ac,v,h)
    a,b=sorted([start,end]);c,d=center-width/2,center+width/2
    bounds=(a,c,b,d) if axis==0 else (c,a,d,b)
    top=lambda x,y:height((x,y)[axis])
    plate(A+label,CLT,rect(*bounds),top,.145)
    for i,off in enumerate([c+(.0125 if wall_side else .065),d-.065]):
        left,right=point(start,off,lo-.22),point(end,off,hi-.22)
        if gallery_side:
            q=gallery.STRINGERS[gallery_side][i]
            poly=rect(a,q-.075,b,q+.075) if axis==0 else rect(q-.075,a,q+.075,b)
            plate(S+'Promenade glulam stringers',GLULAM,poly,lambda x,y:top(x,y)-.145,.310)
        else:
            # Both arcade stringers are pitch-cut tight to the CLT underside.
            poly=rect(a,off-.075,b,off+.075)
            plate(S+'Promenade glulam stringers',GLULAM,poly,lambda x,y:top(x,y)-.145,.310)
        if not wall_side or off<center:
            handrail(left[:2],right[:2],lo,hi,A+'Promenade rails',ST,curbside=bool(gallery_side))
    for v in frange(a+3.6,b-.3,3.6):
        if gallery_side:
            q,Q=gallery.STRINGERS[gallery_side]
            poly=rect(v-.06,q+.075,v+.06,Q-.075) if axis==0 else rect(q+.075,v-.06,Q-.075,v+.06)
            plate(S+'Walk cross blocking',GLULAM,poly,lambda x,y:top(x,y)-.145,.20)
        else:
            plate(S+'Walk cross blocking',GLULAM,rect(v-.06,c+.14,v+.06,d-.14),lambda x,y:top(x,y)-.145,.20)
    return run
walks=[]
x0,x1=6.55,47.45
# The north edge of the return flight leaves a true separation from the
# upper overlook's guard as the two decks converge at their east landing.
arcade_flights=[(24.0,2.27,x1,x0,G,(G+L2)/2),(21.6375,1.995,x0,x1,(G+L2)/2,L2)]
for centre,width,start,end,h,H in arcade_flights:
    walks.append(flight('Market arcade inclines',0,start,end,centre,width,h,H))
slab(A+'Market turn',CLT,4.18,20.365,x0,25.135,(G+L2)/2,.17)
for a,b in [((6.55,20.705),(6.55,20.40)),((6.55,20.40),(4.23,20.40)),
            ((4.23,20.40),(4.23,25.07)),((4.23,25.07),(6.55,25.07))]:
    handrail(a,b,(G+L2)/2,(G+L2)/2,A+'Promenade rails',ST)
slab(A+'Arcade ground landing',CLT,x1,22.865,x1+3.0,25.135,G,.17)
slab(S+'Arcade landing foundation',RC,x1,22.865,x1+3.0,25.135,G-.17,.36)
toe_top=lambda x,y:G+(x1-x)*(L2-G)/(2*(x1-x0))-.145-.310
plate(S+'Ground ramp toe bearing',RC,rect(47.04,22.86,x1,25.14),toe_top,.40)
# The level switchback rests on two transverse glulam beams. The end
# posts sit between, or outside, the two occupied aisles on the ground.
for xx in (4.44,6.30):
    cap=(G+L2)/2-.17
    box(S+'Market turn crossheads',GLULAM,xx-.09,20.37,cap-.36,xx+.09,25.13,cap)
    for yy in (20.49,22.75,25.02):
        low=terrain(xx,yy)
        box(S+'Market turn posts',GLULAM,xx-.085,yy-.085,low+.16,xx+.085,yy+.085,cap-.36)
        box(S+'Market turn foundations',RC,xx-.20,yy-.20,low-.44,xx+.20,yy+.20,low+.16)
# East crossover closes the short gap between the market arcade and the next ascent.
slab(A+'Forum threshold',CLT,x1,SOUTH_SKIN+.085,x1+2.28,22.635,L2,.17)
# Continue to the annex beyond the sloping timber chord; no threshold cuts through a chord.
slab(A+'Forum approach bridge',CLT,49.73,19.98,65.98,21.74,L2,.19)
slab(A+'Forum vestibule link',CLT,64.02,18.025,65.98,19.98,L2,.19)
# The walking finish crosses only the trimmed door, on a recessed sill above its plinth.
slab(A+'Forum vestibule sill',WH,64.16,17.855,65.84,18.025,L2,.08)
for aa,bb in [((49.73,20.02),(64.02,20.02)),((49.73,21.68),(65.91,21.68)),((65.91,21.68),(65.91,18.08))]:
    handrail(aa,bb,L2,L2,A+'Forum gallery rails',ST)
for xx in [50,54.2,58.4,62.6,65.72]:
    for yy in [20.08,21.91]:
        z=terrain(xx,yy)
        box(S+'Forum gallery columns',GLULAM,xx-.12,yy-.12,z+.18,xx+.12,yy+.12,L2-.25)
        box(S+'Forum gallery plinths',RC,xx-.16,yy-.16,z-.10,xx+.16,yy+.16,z+.18)
    beam(S+'Forum gallery joists',GLULAM,(xx,20.00,L2-.28),(xx,21.99,L2-.28),.15,.32)
# West return stays outside the occupied studios; north side is a narrow city balcony.
xa,xb=gallery.XA,gallery.XB
unit,h1,h2=gallery.SLOPE,gallery.WEST_LOW,gallery.WEST_HIGH
walks.append(flight('South overlook ramp',0,xb,xa,19.87,1.42,L2,h1,gallery_side='south'))
floor_with_voids(A+'West corner landings',CLT,(.16,18.46,xa,20.58),[(WEST_SKIN-.085,18.46,xa,SOUTH_SKIN+.085)],h1,.17)
walks.append(flight('Fourth Avenue belvedere',1,18.46,1.82,1.075,1.83,h1,h2,gallery_side='west'))
floor_with_voids(A+'West corner landings',CLT,(.16,.01,xa,1.82),[(WEST_SKIN-.085,gallery.NORTH_WALK_EDGE,xa,1.82)],h2,.17)
walks.append(flight('North learning gallery',0,xa,46.90,(gallery.NORTH_WALK_EDGE+.01)/2,gallery.NORTH_WALK_EDGE-.01,h2,L3,wall_side=True,gallery_side='north'))
slab(A+'Studios threshold',CLT,46.9,.01,48.48,gallery.NORTH_WALK_EDGE,L3,.17)
slab(A+'Studios entrance',CLT,46.35,gallery.NORTH_WALK_EDGE,47.55,NORTH_SKIN+.085,L3,.17)
# The operable door is recessed beyond the perimeter truss, within an entrance
# passage between the two office banks. The outer opening is a covered portal.
box(E+'Promenade vestibule',WD,45.90,3.04,L3,46.15,3.14,MAIN_GIRDER_TOP-roof_depth-.055)
for x,X in ((46.15,46.35),(47.55,47.96)):
    box(E+'Promenade vestibule',WD,x,3.04,L3,X,3.14,L3+2.40)
box(E+'Promenade vestibule',GL,46.15,3.04,L3+2.40,47.96,3.14,L3+2.78)
# Guards return around the actual edges of the turning decks, including
# the short north edge of the upper studio landing and its closed end.
for points,z in [([(.225,18.46),(.225,20.515),(xa,20.515)],h1),
                 ([(.225,1.82),(.225,.0225),(xa,.0225)],h2),
                 ([(46.9,.0225),(48.45,.0225),(48.45,gallery.NORTH_WALK_EDGE-.024)],L3)]:
    for a,b in zip(points,points[1:]):
        handrail(a,b,z,z,A+'Promenade rails',ST,curbside=True)
# The upper promenade takes its reactions directly to the timber building.
gallery.build_gallery(soffit)
# Each arcade incline has its own two-leg bent. All four post lines stay
# beneath their respective stringers, clear of the upper promenade projection
# and the paved ground-level passage between the frames.
for centre,width,start,end,h,H in arcade_flights:
    runners=(centre-width/2+.065,centre+width/2-.065)
    posts=runners
    def bent_top(x,y):return h+(H-h)*(x-start)/(end-start)-.145-.310
    for xx in frange(6.55,47.45,5.1):
        support_y=[yy for yy in posts if bent_top(xx,yy)>terrain(xx,yy)+.27]
        if not support_y:continue
        y0=min(*runners,*posts)-.11; y1=max(*runners,*posts)+.11
        plate(S+'Walk trestle crossheads',GLULAM,rect(xx-.10,y0,xx+.10,y1),bent_top,.20)
        for yy in posts:
            low=terrain(xx,yy);sole=bent_top(xx,yy)-.20
            # The low end tapers out on a concrete seat in the graded court.
            foot=min(low+.14,sole-.02)
            box(S+'Walk footings',RC,xx-.16,yy-.16,min(low-.20,foot-.16),xx+.16,yy+.16,foot)
            tapered_post(S+'Walk support trestles',GLULAM,rect(xx-.095,yy-.095,xx+.095,yy+.095),
                         lambda x,y:foot,lambda x,y:bent_top(x,y)-.20)
# Landing to court and west studios: these short galleries run along the edges of the tall hall.
for bounds in [(13.8,4.90,15.65,11.04),(15.65,4.90,21.4,6.42),(21.4,3.65,23.0,6.42)]:
    slab(S+'Studio access gallery',CLT,*bounds,L3,.20)
from studio_galleries import support_studio_approach, office_edge
support_studio_approach(L3,MAIN_GIRDER_TOP,ST)
# The teaching lounge extends the gallery along the north rim of the hall.
# Each bracket bears on a post of the primary truss, at two elevations.
# The compression knee supports the occupied outer edge; no extra columns
# touch the assembly floor. CLT spans the 3.60 m bracket spacing.
slab(S+'Teaching lounge balcony',CLT,23.0,3.65,35.86,6.25,L3,.20)
slab(S+'North office balcony',CLT,35.86,3.65,39.75,7.56,L3,.20)
def teaching_balcony_bracket(xx,out=6.13):
    upper=L3-.43
    lower=soffit(xx)+.31 # existing restrained lower chord/post node
    beam(S+'Teaching balcony brackets',GLULAM,(xx,1.98,upper),(xx,out,upper),.22,.46)
    beam(S+'Teaching balcony brackets',GLULAM,(xx,1.98,lower),(xx,out-.06,L3-.66),.22,.34)
    for z in (upper,lower):
        box(S+'Teaching balcony bracket shoes',ST,xx-.145,1.80,z-.20,xx+.145,2.05,z+.20)
        # Knife plate crosses the post and the bracket end. Through-dowels
        # at the post and the bracket show both ends of the force transfer.
        box(S+'Teaching balcony bracket shoes',ST,xx-.010,1.59,z-.14,xx+.010,2.25,z+.14)
        for y,half in ((1.65,.24),(2.12,.12)):
            for dz in (-.082,.082):
                beam(S+'Teaching balcony through-dowels',WH,(xx-half,y,z+dz),(xx+half,y,z+dz),.024,.024)
for xx in (24.2,27.8,31.4,35.0):
    teaching_balcony_bracket(xx,7.45 if xx==35.0 else 6.13)
teaching_balcony_bracket(38.6,7.45)
office_edge(L3,ST)
for a,b in [((15.65,11.04),(15.65,6.42)),((15.65,6.42),(23.0,6.42)),
            ((23.0,6.42),(23.0,6.25)),((23.0,6.25),(31.92,6.25))]:
    handrail(a,b,L3,L3,A+'Hall gallery guard',ST)
# At the market entrance the headhouse gives the first ramp a rain cover and additional PV.
tan=math.tan(math.radians(8.5))
roofH=lambda x,y:10.42-(y-20.48)*tan
ranges=[(19.2,33.9),(34.02,48.72),(48.84,63.54)]
for bay_index,(a,b) in enumerate(ranges):
    poly=rect(a,20.48,b,25.25)
    plate(E+'Arcade solar canopy',WH,poly,roofH,.08)
    plate(S+'Arcade CLT roof',CLT,poly,lambda x,y:roofH(x,y)-.08,.15)
    # Pitch-cut the rafter tops to the deck soffit. Their ends frame flush
    # into the eave beams, on ledgers bearing on the inside face of each beam.
    deck_soffit_h=lambda x,y:roofH(x,y)-.23
    eaves=(20.61,25.12)
    for xx in (a+.36,(a+b)/2,b-.36):
        plate(S+'Arcade roof rafters',GLULAM,
              rect(xx-.12,eaves[0]+.13,xx+.12,eaves[1]-.13),deck_soffit_h,.42)
    for yy,direction in zip(eaves,(1,-1)):
        girder_bottom=deck_soffit_h(a,yy+.13)-.62
        tapered_post(S+'Arcade eave girders',GLULAM,rect(a+.12,yy-.13,b-.12,yy+.13),
                     lambda x,y:girder_bottom,deck_soffit_h)
        ledger0,ledger1=sorted((yy+direction*.13,yy+direction*.21))
        plate(S+'Arcade eave girders',GLULAM,rect(a+.12,ledger0,b-.12,ledger1),
              lambda x,y:deck_soffit_h(x,y)-.42,.12)
    # Cantilever the north edge over the public walks. Each continuous
    # transverse beam picks up both eaves, bearing on the divider between
    # ramp flights and on the outer post line. Nothing lands in the aisle.
    def transfer_top(x,y):
        # Level bearing across each 260 mm eave girder. Interpolate only
        # between the two seats so neither beam embeds in the mating timber.
        t=max(0.,min(1.,(y-eaves[0]-.13)/(eaves[1]-eaves[0]-.26)))
        return deck_soffit_h(x,eaves[0]+.13+(eaves[1]-eaves[0])*t)-.62
    for xx in (a+.36,(a+b)/2,b-.36):
        bearing_edges=(eaves[0]-.13,eaves[0]+.13,eaves[1]-.13,eaves[1]+.13)
        # All four bearing stations share vertices along one continuous beam.
        # The level seats are cut into the same sloping glulam blank.
        beam_bottom=transfer_top(xx,eaves[1])-.390
        vertices=[(x,y,beam_bottom if lower else transfer_top(x,y)) for y in bearing_edges
                  for x,lower in ((xx-.145,True),(xx+.145,True),(xx+.145,False),(xx-.145,False))]
        faces=[[0,1,2,3],[12,13,14,15]]
        for i in (0,4,8):
            faces.extend([[i+k,i+(k+1)%4,i+4+(k+1)%4,i+4+k] for k in range(4)])
        geo.solid(S+'Arcade cantilever crossheads',GLULAM,vertices,faces)
        for yy in (22.75,eaves[1]):
            low=terrain(xx,yy)
            # The inboard pier takes the long eave overhang. Both post lines
            # bear on concrete foundations rather than on the paving finish.
            half=.70 if yy==22.75 else .46
            # Adjacent bay ends share a single level footing below the joint.
            # This avoids intersecting two pads at slightly different grades.
            left=right=xx
            if xx==a+.36 and bay_index>0:left=ranges[bay_index-1][1]-.36
            if xx==b-.36 and bay_index<len(ranges)-1:right=ranges[bay_index+1][0]+.36
            foundation_cap=min(terrain(left,yy),terrain(right,yy))-.94
            if xx==left:
                box(S+'Arcade spread footings',RC,left-half,yy-half,foundation_cap-.34,right+half,yy+half,foundation_cap)
            box(S+'Arcade foundation stems',RC,xx-.19,yy-.17,foundation_cap,xx+.19,yy+.17,low-.15)
            box(S+'Arcade post shoes',RC,xx-.16,yy-.14,low-.15,xx+.16,yy+.14,low+.20)
            tapered_post(S+'Arcade timber posts',GLULAM,rect(xx-.125,yy-.105,xx+.125,yy+.105),
                         lambda x,y:low+.20,lambda x,y:beam_bottom)
    for j in range(7):
        for k in range(4):
            xx=a+.17+j*2.07;yy=20.53+k*1.17;d=1.134*math.cos(math.radians(8.5))
            plate(P+'Arcade photovoltaics',PV,rect(xx,yy,xx+1.961,yy+d),lambda x,y:roofH(x,y)+.105,.030)
            counts['pv']+=1
    for k in range(4):
        yy=20.72+k*1.17
        beam(P+'Arcade mounting rails',WH,(a+.12,yy,roofH(a,yy)+.045),(b-.12,yy,roofH(b,yy)+.045),.058,.06)
# The soffit follows the bottom of the actual cross collectors, and returns
# into the perimeter cassettes below the lower chord and its steel straps.
# The sealed projection wraps the west stair and two bearing piers. Each
# cut follows the actual footprint at soffit height, with a separate slim
# metal collar covering the movement joint against the exposed timber.
shoes=[(13.4-.45,v-.315,13.4+.45,v+.315) for v in (1.65,18.35)]
soffit_cuts=[west,*[(x-.026,y-.026,X+.026,Y+.026) for x,y,X,Y in shoes]]
def soffit_zone(a,c,b,d):
    mask=[r for r in soffit_cuts if a<r[2] and r[0]<b and c<r[3] and r[1]<d]
    floor_with_voids(E+'Faceted western soffit',WD,(a,c,b,d),mask,
                     lambda x,y:wall_foot(x)+.065,.065)
for a,b in ((WEST_SKIN,2.6),(2.6,6.2),(6.2,9.8),(9.8,13.4),(13.4,14.04)):
    soffit_zone(a,NORTH_SKIN,b,SOUTH_SKIN)
for a,b in ((14.04,17.0),(17.0,21.4),(21.4,39.8)):
    soffit_zone(a,NORTH_SKIN,b,3.65)
    soffit_zone(a,18.32,b,SOUTH_SKIN)
for x,y,X,Y in shoes:
    for a,c,b,d in ((x-.027,y-.027,X+.027,y),(x-.027,Y,X+.027,Y+.027),
                    (x-.027,y,x,Y),(X,y,X+.027,Y)):
        plate(E+'Soffit movement collars',ST,rect(a,c,b,d),lambda u,v:wall_foot(u)+.012,.012)
# The recessed loggia starts at the actual floor opening, and its cheeks
# sit against the clear faces of the timber rim beams beside the void.
for a,b in ((52.96,53.0),(53.0,56.6)):
    plate(E+'Eastern loggia soffit',WD,rect(a,5.95,b,8.16),lambda x,y:wall_foot(x)+.065,.065)

from market_roofs import build_market
from shell_skin import build_skin
from rooms import build_rooms
build_market(counts)
build_rooms(counts)
build_skin(counts)
if geo.outliers:raise ValueError(('outside property',geo.outliers[:10]))
assert counts['stalls']==120 and counts['classrooms']==4 and counts['offices']==6
dest=Path(sys.argv[1]);dest.parent.mkdir(parents=True,exist_ok=True)
print(json.dumps({**geo.write(dest,palette),**counts,'courtM2':81.0,
 'arcadePV':84,'marketRampSlope':(L2-G)/sum(walks[:2]),
 'upperRampSlope':unit,'gradeWalkSlope':(G-.33)/46.55},indent=2))
