"""Build Market Crossing, a layered gallery teaching case in registered metres. Run with Python and NumPy."""
import json
import math
from pathlib import Path
import sys
import geometry as geo
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

def handrail(a,b,baseA,baseB,layer,material=RED,posts=True,curbside=False):
    x,y=a;X,Y=b;length=math.hypot(X-x,Y-y)
    for h in (.10,.67,1.08):
        beam(layer,material,(x,y,baseA+h),(X,Y,baseB+h),.040 if h>.2 else (.045 if curbside else .090),.045 if h>.2 else .14)
    if posts:
        n=max(1,math.ceil(length/1.55))
        for k in range(n+1):
            t=k/n;xx=x+t*(X-x);yy=y+t*(Y-y);zz=baseA+t*(baseB-baseA)
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
def street_height(x):
    if x<=46.55:return .33+(G-.33)*x/46.55
    return G-.05*min(1,(x-46.55)/19)
def terrain(x,y):
    t=max(0,min(1,(y-10)/8.75,(25.4-y)/3.4))
    return grade(x,y)+.024+(street_height(x)-grade(x,y)-.024)*t
xbreak=[0,2.6,6.2,13.4,15.0,24.2,35.0,45.8,46.55,56.6,65.6,82.906]
ybreak=[0,1.45,10,15.5,18.75,19.88,20.3,22.0,22.5,25.4,57.912]
for xa,xb in zip(xbreak,xbreak[1:]):
 for ya,yb in zip(ybreak,ybreak[1:]):
    if xa>=exc[0] and xb<=exc[2] and ya>=exc[1] and yb<=exc[3]:continue
    if 15.0<=xa and xb<=46.55 and ya==18.75:continue
    for fac in [[(0,0),(82.906,0),(0,57.912)],[(82.906,0),(42.3677,57.912),(0,57.912)]]:
        poly=fac
        for a,v,side in [(0,xa,True),(0,xb,False),(1,ya,True),(1,yb,False)]:poly=clip(poly,a,v,side)
        for k in range(1,len(poly)-1):
            tri=[poly[0],poly[k],poly[k+1]]
            plate(T+'Market court paving','Chalk' if 18.75<=ya<20.3 else 'Basalt pavers',tri,terrain,.14)

x,y,X,Y=exc
slab(S+'Lower-ground slab',RC,x,y,X,Y,B,.1524)
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
        floor_with_voids(S+layer,CLT,(47.96,NORTH_SKIN+.085,56.65,18.48),[west,east,lift,(48.0,5.80,56.65,9.0)],z)
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
for i in range(10):
    x=8.13+i*.38;top=G-(9-i)*.1778
    box(A+'Fourth Avenue entrance steps',RC,x,14.56,.55,x+.38,18.12,top)
slab(A+'West entrance landing',RC,11.93,14.56,13.4,18.12,G,.27)
for y in (14.62,18.05):
    handrail((8.14,y),(11.92,y),G-9*.1778,G,A+'West entrance handrails',ST)
plate(A+'Public foyer threshold','Chalk',rect(46.55,18.75,59.5,19.23),lambda x,y:G+(terrain(x,19.23)-G)*(y-18.75)/.48,.12)
for name,bounds in [('West',west),('East',east)]:
    stair(name,bounds,True)
    x,y,X,Y=bounds
    for yy in [y+.08,Y-.08]:
        for lo,hi in [(B,G),(G,L2),(L2,L3),(L3,L3+2.86)]:
            doorway(S+'Concrete stair cores',RC,x,yy,X,yy,lo,hi,(x+.11,x+1.46) if yy>y+.2 else None,.16)
    box(S+'Concrete stair cores',RC,X-.16,y+.16,B,X,Y-.16,L3+2.86)
x,y,X,Y=lift
for xx in [x,X-.16]:box(S+'Freight lift core',RC,xx,y,B,xx+.16,Y,L3+3.0)
box(S+'Freight lift core',RC,x+.16,y,B,X-.16,y+.16,L3+3.0)
for z,Z in [(B,G),(G,L2),(L2,L3),(L3,L3+2.88)]:
    doorway(A+'Lift landings',RC,x,Y,X,Y,z,Z,(x+.62,X-.62),.16)
    box(A+'Lift doors',WH,x+.62,Y-.12,z,X-.62,Y-.07,z+2.32)

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
# Direct cross girders to the paired shell walls. A pair of rim trimmers bridges the court.
for i,x in enumerate(stations):
    for a,b in ([(1.965,6.64),(17.16,18.035)] if court[0]<x<court[2] else [(1.965,18.035)]):
        beam(S+'Glulam roof girders',GLULAM,(x,a,MAIN_GIRDER_TOP-.45),(x,b,MAIN_GIRDER_TOP-.45),.30,.90)
    for y,end in ((1.965,1),(18.035,-1)):
        ya,yb=sorted((y,y+end*.22))
        slab(S+'Roof girder hangers',ST,x-.169,ya,x+.169,yb,MAIN_GIRDER_TOP-.90,.018)
        for side in (-1,1):
            edge=x+side*.158
            box(S+'Roof girder hangers',ST,edge-.008,ya,MAIN_GIRDER_TOP-.90,edge+.008,yb,MAIN_GIRDER_TOP-.09)
        ya,yb=sorted((y-end*.012,y))
        box(S+'Roof girder hangers',ST,x-.169,ya,MAIN_GIRDER_TOP-.90,x+.169,yb,MAIN_GIRDER_TOP+.12)
    if x<13.6 or 40<x<56.7:
        for a,b in ([(1.7,6.65),(17.15,18.3)] if court[0]<x<court[2] else [(1.7,18.3)]):
            beam(S+'Glulam floor girders',GLULAM,(x,a,L3-.20-.61),(x,b,L3-.20-.61),.38,1.22)
    if i%2==0 and i<15 and not (36<x<48):
        beam(S+'Collector ties',ST,(x,1.70,MAIN_GIRDER_TOP-.10),(x+3.60,18.30,MAIN_GIRDER_TOP-.10),.058)
for x in (2.6,6.2,9.8,13.4,42.2,45.8,49.4,53.0,56.6):
    for y in (1.65,18.35):
        box(S+'Floor girder saddles',ST,x-.23,y-.35,L3-1.46,x+.23,y+.35,L3-1.40)
        for ox in (-.223,.223):
            box(S+'Floor girder saddles',ST,x+ox-.01,y-.25,L3-1.43,x+ox+.01,y+.25,L3-.12)
# Horizontal trussed rims restrain lower nodes even at openings in the upper floors.
for yy,edge in ((1.65,2.76),(18.35,17.23)):
    for xa,xb in zip(stations,stations[1:]):
        za,zb=soffit(xa)-.18,soffit(xb)-.18
        beam(S+'Laterally braced lower rim',GLULAM,(xa,edge,za),(xb,edge,zb),.17,.26)
        beam(S+'Lateral rim ties',ST,(xa,yy,za),(xa,edge,za),.08,.12)
        beam(S+'Lateral rim ties',ST,(xa,yy,za),(xb,edge,zb),.050)
        beam(S+'Lateral rim ties',ST,(xa,edge,za),(xb,yy,zb),.050)
for y in (6.64,17.16):
    for z in (L3,14.1):beam(S+'Court rim girders',GLULAM,(38.6,y,z-.60),(49.4,y,z-.60),.32,.85)
for x in (13.4,45.8):
    beam(S+'Glulam portal crossheads',GLULAM,(x,1.65,6.0),(x,18.35,6.0),.32,.70)
# Short basement spans carry the slab over the assembly space without obstructing the hall.
for xx in frange(16.8,65,7.2):
 for yy in (1.75,9.40,18.39):
    if west[0]<xx<west[2] and west[1]<yy<west[3] or east[0]<xx<east[2] and east[1]<yy<east[3]:continue
    box(S+'Basement columns',RC,xx-.23,yy-.23,B,xx+.23,yy+.23,G-.45)
 for ya,yb in [(1.75,9.40),(9.40,18.39)]:
    beam(S+'Basement beams',RC,(xx,ya,G-.43),(xx,yb,G-.43),.32,.46)
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
    ys=sorted({1.65,18.35,*[a for h in [east,lift,(48.0,5.8,56.65,9.0)] if h[0]<x<h[2] for a in [h[1],h[3]]]})
    z=L2-.20
    for a,b in zip(ys,ys[1:]):
        if any(h[0]<x<h[2] and h[1]<(a+b)/2<h[3] for h in [east,lift,(48.0,5.8,56.65,9.0)]):continue
        depth=1.12 if b-a>10 else .56
        beam(S+'Forum and court cross girders',GLULAM,(x,a,z-depth/2),(x,b,z-depth/2),.36,depth)
for yy in [5.8,9.0]:
    beam(S+'Loggia rim beams',GLULAM,(47.90,yy,L2-.50),(56.72,yy,L2-.50),.29,.65)
for x in (42.2,49.4,53.0):
    for yy in [1.65,18.35]:
        beam(S+'Deck hanger plates',ST,(x,yy,L2-.6),(x,yy,soffit(x)+.24),.088,.105)
# Braced soffit planes and collectors at the two bearing lines couple the paired trusses.
for x in (2.6,9.8,46.0,53.0):
    for ya,yb in [(1.8,10.0),(10.0,18.2)]:
        beam(S+'Cantilever lateral cross ties',ST,(x,ya,soffit(x)-.22),(x+3.55,yb,soffit(x+3.55)-.22),.052)
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
# The court has solid planters, continuous slab below and genuine openings overhead.
for xx,yy,X,Y in [(40.3,7.25,40.95,12.2),(41.4,15.85,46.0,16.43)]:
    box(T+'Sky garden water beds',RC,xx,yy,L2,X,Y,L2+.38)
    box(T+'Sky garden plants','Planting',xx+.08,yy+.08,L2+.38,X-.08,Y-.08,L2+.55)
# The overlook guard is mounted on the occupied rim, clear of the court glazing.
guard=rect(court[0]-.20,court[1]-.20,court[2]+.20,court[3]+.20)
for a,b in zip(guard,guard[1:]+guard[:1]):handrail(a,b,L3,L3,A+'Court overlook',ST)

# Three different ascents: the public graded ground, the paired arcade inclines,
# and a quieter upper walk winding around the lifted western end.
def flight(label,axis,start,end,center,width,lo,hi,wall_side=False):
    run=abs(end-start)
    height=lambda v:lo+(hi-lo)*(v-start)/(end-start)
    def point(v,ac,h):return (v,ac,h) if axis==0 else (ac,v,h)
    a,b=sorted([start,end]);c,d=center-width/2,center+width/2
    bounds=(a,c,b,d) if axis==0 else (c,a,d,b)
    top=lambda x,y:height((x,y)[axis])
    plate(A+label,CLT,rect(*bounds),top,.145)
    for off in [c+(.0125 if wall_side else .065),d-.065]:
        left,right=point(start,off,lo-.22),point(end,off,hi-.22)
        joist_off=max(.085,off) if wall_side else off
        beam(S+'Promenade glulam stringers',GLULAM,point(start,joist_off,lo-.22),point(end,joist_off,hi-.22),.15,.31)
        if not wall_side or off<center:
            handrail(left[:2],right[:2],lo,hi,A+'Promenade rails',ST,curbside=wall_side)
    for v in frange(a+3.6,b-.3,3.6):
        beam(S+'Walk cross blocking',GLULAM,point(v,c,height(v)-.16),point(v,d,height(v)-.16),.12,.20)
    return run
walks=[]
x0,x1=6.55,47.45
for y0,start,end,h,H in [(24.00,x1,x0,G,(G+L2)/2),(21.50,x0,x1,(G+L2)/2,L2)]:
    walks.append(flight('Market arcade inclines',0,start,end,y0,2.27,h,H))
slab(A+'Market turn',CLT,4.18,20.365,x0,25.135,(G+L2)/2,.17)
handrail((4.23,20.40),(4.23,25.10),(G+L2)/2,(G+L2)/2,A+'Promenade rails',ST)
slab(A+'Arcade ground landing',CLT,x1,22.865,x1+3.0,25.135,G,.17)
# East crossover closes the short gap between the market arcade and the next ascent.
slab(A+'Forum threshold',CLT,x1,SOUTH_SKIN+.085,x1+2.28,22.635,L2,.17)
# Continue to the annex beyond the sloping timber chord; no threshold cuts through a chord.
slab(A+'Forum approach bridge',CLT,49.73,19.98,64.25,21.74,L2,.19)
slab(A+'Forum vestibule link',CLT,62.44,18.025,64.25,19.98,L2,.19)
# The walking finish crosses only the trimmed door, on a recessed sill above its plinth.
slab(A+'Forum vestibule sill',WH,62.56,17.855,64.14,18.025,L2,.08)
for aa,bb in [((49.73,20.02),(62.44,20.02)),((49.73,21.68),(64.18,21.68)),((64.19,21.68),(64.19,18.08))]:
    handrail(aa,bb,L2,L2,A+'Forum gallery rails',ST)
for xx in [50,54.2,58.4,62.6]:
    for yy in [20.08,21.91]:
        z=terrain(xx,yy)
        box(S+'Forum gallery columns',GLULAM,xx-.12,yy-.12,z+.18,xx+.12,yy+.12,L2-.25)
        box(S+'Forum gallery plinths',RC,xx-.16,yy-.16,z-.10,xx+.16,yy+.16,z+.18)
    beam(S+'Forum gallery joists',GLULAM,(xx,20.00,L2-.28),(xx,21.99,L2-.28),.15,.32)
# West return stays outside the occupied studios; north side is a narrow city balcony.
xa,xb=2.16,47.45
us=[xb-xa,18.46-1.82,46.9-xa]
unit=(L3-L2)/sum(us);h1=L2+us[0]*unit;h2=h1+us[1]*unit
walks.append(flight('South overlook ramp',0,xb,xa,19.87,1.42,L2,h1))
floor_with_voids(A+'West corner landings',CLT,(.16,18.46,xa,20.58),[(WEST_SKIN-.085,18.46,xa,SOUTH_SKIN+.085)],h1,.17)
walks.append(flight('Fourth Avenue belvedere',1,18.46,1.82,1.075,1.83,h1,h2))
floor_with_voids(A+'West corner landings',CLT,(.16,.01,xa,1.82),[(WEST_SKIN-.085,NORTH_SKIN-.085,xa,1.82)],h2,.17)
walks.append(flight('North learning gallery',0,xa,46.90,.58,1.14,h2,L3,wall_side=True))
slab(A+'Studios threshold',CLT,46.9,.01,48.48,1.15,L3,.17)
slab(A+'Studios entrance',CLT,46.35,1.15,47.55,NORTH_SKIN+.085,L3,.17)
for a,b,z in [((.21,20.30),(.21,18.47),h1),((.21,.16),(2.12,.16),h2),((48.94,.17),(48.94,1.30),L3)]:
    handrail(a,b,z,z,A+'Promenade rails',ST)
# The public promenade is an independent exterior structure. Each steel
# frame sits on its own curbside pedestal; the short triangular bracket
# supports the deck from below and no arm enters an insulated facade panel.
def gallery_bent(x,y,h,tip,across_y):
    plinth=terrain(x,y)
    if across_y:
        # North boundary is a registered parcel limit.
        width=.30 if y<1 else .28
        x0,X=x-.14,x+.14;y0,Y=y-width/2,y+width/2
        end=(x,tip,h-.34)
    else:
        x0,X=x-.105,x+.105;y0,Y=y-.14,y+.14
        end=(tip,y,h-.34)
    box(S+'Exterior gallery pedestals',RC,x0-.035,max(.001,y0-.035),plinth-.26,X+.035,Y+.035,plinth+.13)
    box(S+'Independent gallery posts',ST,x0,y0,plinth+.13,X,Y,h-.18)
    beam(S+'Exterior gallery brackets',ST,(x,y,h-.34),end,.16,.20)
    beam(S+'Exterior gallery brackets',ST,(x,y,h-1.04),end,.095,.115)
for u in (2.76,8.45,14.15,19.85,25.55,31.25,36.95,42.65,46.65):
    gallery_bent(u,.205,h2+(L3-h2)*(u-xa)/us[2],1.09,True)
    gallery_bent(u,20.46,L2+(h1-L2)*(xb-u)/us[0],19.29,True)
for v in (1.85,5.90,10.00,14.1,18.40):
    gallery_bent(.16,v,h1+(h2-h1)*(18.46-v)/us[1],1.92,False)
for xx in frange(6.55,47.45,5.1):
    for yy in [20.37,22.75,25.15]:
        low=terrain(xx,yy)
        stop=(G+L2)/2+((L2-G)/2)*(xx-6.55)/40.9 if yy<22.75 else (G+L2)/2-((L2-G)/2)*(xx-6.55)/40.9
        if stop-low>.28:
            box(S+'Walk footings',RC,xx-.16,yy-.16,low-.20,xx+.16,yy+.16,low+.14)
            box(S+'Walk support trestles',GLULAM,xx-.095,yy-.095,low+.14,xx+.095,yy+.095,stop-.14)
# Landing to court and west studios: these short galleries run along the edges of the tall hall.
for bounds in [(13.8,4.90,15.65,11.04),(15.65,4.90,21.4,6.42),(21.4,3.65,23.0,6.42)]:
    slab(S+'Studio access gallery',CLT,*bounds,L3,.20)
for a,b in [((15.65,11.04),(15.65,6.42)),((15.65,6.42),(23.0,6.42)),((23.0,6.42),(23.0,3.65))]:
    handrail(a,b,L3,L3,A+'Hall gallery guard',ST)
# At the market entrance the headhouse gives the first ramp a rain cover and additional PV.
tan=math.tan(math.radians(8.5))
roofH=lambda x,y:10.42-(y-20.48)*tan
for i,(a,b) in enumerate([(19.2,33.9),(34.02,48.72),(48.84,63.54)]):
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
        for xx in (a+.36,(a+b)/2,b-.36):
            low=terrain(xx,yy)
            box(S+'Arcade post shoes',RC,xx-.19,yy-.19,low-.15,xx+.19,yy+.19,low+.24)
            box(S+'Arcade timber posts',GLULAM,xx-.11,yy-.11,low+.24,
                xx+.11,yy+.11,girder_bottom)
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
for a,b in ((48.0,49.4),(49.4,53.0),(53.0,56.6)):
    plate(E+'Eastern loggia soffit',WD,rect(a,5.95,b,8.85),lambda x,y:wall_foot(x)+.065,.065)

from market_roofs import build_market
from shell_skin import build_skin
from rooms import build_rooms
build_market(counts)
build_skin(counts)
build_rooms(counts)
if geo.outliers:raise ValueError(('outside property',geo.outliers[:10]))
assert counts['stalls']==120 and counts['classrooms']==4 and counts['offices']==6
dest=Path(sys.argv[1]);dest.parent.mkdir(parents=True,exist_ok=True)
print(json.dumps({**geo.write(dest,palette),**counts,'courtM2':81.0,
 'arcadePV':84,'marketRampSlope':(L2-G)/sum(walks[:2]),
 'upperRampSlope':unit,'gradeWalkSlope':(G-.33)/46.55},indent=2))
