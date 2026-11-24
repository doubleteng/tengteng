"""Build the gallery teaching case in registered metres. Run with Python and NumPy."""
import json
import math
from pathlib import Path
import sys
import geometry as geo
from geometry import beam,box,clip,grade,plate,rect

G=2.50; B=G-140*.0254; L2=G+154*.0254; L3=L2+168*.0254
S='Structure / ';E='Enclosure / ';I='Interior / ';A='Circulation / ';M='Market / ';T='Site / ';P='Energy / '
RC='Board-formed concrete'; ST='Graphite steel'; WH='Galvanized silver'; RED='Vermilion steel'; YEL='Citron enamel'
GL='Vision glass'; TR='Translucent channel glass'; WD='Oiled birch'; FL='Terrazzo'; DARK='Dark reveal'; PV='Blue-black photovoltaics'
palette={RC:('aaa69d',.88,0,1),ST:('424b4a',.61,.16,1),WH:('d1d4cc',.52,.20,1),RED:('e35537',.54,.09,1),
 YEL:('c2d34d',.6,.06,1),GL:('659092',.32,.04,.37),TR:('b0c9bf',.43,.04,.72),WD:('bd956b',.8,0,1),
 FL:('dfdbcd',.85,0,1),DARK:('495454',.68,.04,1),PV:('384c60',.38,.17,1),'Basalt pavers':('9e9b8e',.9,0,1),
 'Planting':('869263',.93,0,1),'Ochre':('d5a649',.8,0,1),'Leaf':('71856b',.8,0,1),'Chalk':('ece8d9',.8,0,1)}
counts={'stalls':0,'classrooms':0,'offices':0,'pv':0,'canopyRoof':0,'insulatedRoof':0,'roofLights':0}
def frange(a,b,step):
    while a<=b+1e-8:
        yield a;a+=step

def footing(x,y,top,w=.52,base=B-.30):
    box(S+'Bearings and foundations',RC,x-.63,y-.63,base-.35,x+.63,y+.63,base)
    box(S+'Columns and cores',ST,x-w/2,y-w/2,base,x+w/2,y+w/2,top)

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

def handrail(a,b,baseA,baseB,layer,material=RED,posts=True):
    x,y=a;X,Y=b;length=math.hypot(X-x,Y-y)
    for h in (.10,.67,1.08):
        beam(layer,material,(x,y,baseA+h),(X,Y,baseB+h),.040 if h>.2 else .090,.045 if h>.2 else .14)
    if posts:
        n=max(1,math.ceil(length/1.55))
        for k in range(n+1):
            t=k/n;xx=x+t*(X-x);yy=y+t*(Y-y);zz=baseA+t*(baseB-baseA)
            box(layer,material,xx-.027,yy-.027,zz,xx+.027,yy+.027,zz+1.08)

# Graded, clipped parcel around a true basement excavation; each paving cell
# ends at a grade break or excavation edge (original registered ground triangles).
exc=(10.6,1.25,63.2,20.55)
triangles=[[(0,0),(82.906,0),(0,57.912)],[(82.906,0),(42.3677,57.912),(0,57.912)]]
for xa,xb in zip([0,10.6,63.2],[10.6,63.2,82.906]):
 for ya,yb in zip([0,1.25,20.55],[1.25,20.55,57.912]):
  if (xa,ya)==exc[:2]:continue
  for tri in triangles:
   poly=tri
   for ax,val,side in [(0,xa,True),(0,xb,False),(1,ya,True),(1,yb,False)]:poly=clip(poly,ax,val,side)
   if len(poly)>2:plate(T+'Registered stone paving','Basalt pavers',poly,lambda x,y:grade(x,y)+.024,.15)
# Four basement perimeter retaining walls; 18 in RC, 6 in basement slab.
x,y,X,Y=exc
box(S+'Lower-ground slab',RC,x,y,B-.1524,X,Y,B)
wall=.4572
for xx in (x,X-wall):box(S+'Retaining walls',RC,xx,y,B,xx+wall,Y,G+.2032)
for yy in (y,Y-wall):
    for a,b,top in [(x+wall,15.1,G+.2032),(15.1,60.9,G-.24),(60.9,X-wall,G+.2032)]:
        box(S+'Retaining walls',RC,a,yy,B,b,yy+wall,top)
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
core1=(32.4,1.6,39.7,4.90);core2=(49.7,14.8,53.55,21.0);lift=(53.85,15.55,56.85,18.75)
court=(32.18,6.25,40.16,16.50)
# South bay projects beyond the basement retaining line onto steel brackets.
floor_with_voids(S+'Ground floor',FL,(10.6,1.25,69.30,21.2),[core1,core2,lift],G)
hall=(10.6,1.55,32.10,18.85);small=(40.35,3.05,54.65,13.45)
wing=(3.2,1.25,69.3,21.2)
for level,label in [(L2,'Level 2'),(L3,'Level 3')]:
 holes=[hall,core1,core2,lift]
 if level==L3:holes.extend([small,court])
 floor_with_voids(S+label+' composite decks',FL,wing,holes,level,.27)
# The L2 planted terrace is open to sky through L3 and roof.
for a,b in [((32.55,7.4),(32.55,15.8)),((33.0,6.62),(38.2,6.62)),((39.75,14.0),(39.75,16.24))]:
 x,y=a;X,Y=b;box(T+'Sky court planters',RC,min(x,X)-.32,min(y,Y)-.32,L2,max(x,X)+.32,max(y,Y)+.32,L2+.43)
 box(T+'Sky court planting','Planting',min(x,X)-.27,min(y,Y)-.27,L2+.43,max(x,X)+.27,max(y,Y)+.27,L2+.63)
for a,b in [((32.18,6.25),(40.16,6.25)),((40.16,6.25),(40.16,16.50)),((32.18,6.25),(32.18,16.50)),((32.18,16.50),(40.16,16.50))]:
 handrail(a,b,L3,L3,A+'Sky court balustrade',ST)
# Ground and vertical circulation. Landings overlap no full floor above a stair.
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
stair('West',core1,True);stair('East',core2,False)
# Elevator doors face the common south gallery on each level.
x,y,X,Y=lift
for xx in [x,X-.17]:box(A+'Freight and passenger lift',RC,xx,y,B,xx+.17,Y,L3+3.05)
box(A+'Freight and passenger lift',RC,x+.17,y,B,X-.17,y+.18,L3+3.05)
for lo,hi in [(B,G),(G,L2),(L2,L3),(L3,L3+2.9)]:
 doorway(A+'Freight and passenger lift',RC,x,Y,X,Y,lo,hi,(x+.7,X-.7),.18)
 box(A+'Freight and passenger lift',WH,x+.7,Y-.12,lo,X-.7,Y-.08,lo+2.3)
for (x,y,X,Y),alongx in [(core1,True),(core2,False)]:
 for xx in ([x+.08,X-.08] if not alongx else [X-.08]):
    box(S+'Core shear walls',RC,xx-.08,y,B,xx+.08,Y,L3+2.9)
 for yy in ([y+.08,Y-.08] if alongx else [Y-.08]):
    if alongx and yy>y+.2:
        for lo,hi in [(B,G),(G,L2),(L2,L3),(L3,L3+2.9)]:
            doorway(S+'Core shear walls',RC,x,yy,X,yy,lo,hi,(x+.08,x+1.42),.16)
    else:box(S+'Core shear walls',RC,x,yy-.08,B,X,yy+.08,L3+2.9)
# Basement support rooms on two sides of the continuous service aisle.
for split in [31.1,37.8,44.4]:
 doorway(I+'Workshop, storage and plant',WH,split,1.7,split,16.16,B,G-.27,None)
for xa,xb in [(11.06,31.1),(31.1,37.8),(37.8,44.4),(44.4,62.74)]:
 doorway(I+'Workshop, storage and plant',WH,xa,16.16,xb,16.16,B,G-.27,(xa+1.0,xa+3.15))
# Large folding doors link the assembly floor to the public threshold.
doorway(I+'360-seat hall',WD,32.10,5.3,32.10,18.85,G,L3+1.15,(13.6,16.2))
slab(I+'360-seat hall',WD,11.1,2.4,31.4,4.25,G+.37,.37)
for a in [34.1,38.9]:
 doorway(I+'Hall support suites',WH,a,5.4,a,8.95,G,L2-.3,(6.1,7.3))
doorway(I+'100-seat hall',WD,40.35,3.05,40.35,13.45,L2,L3+2.52,(5.65,7.65))
doorway(I+'100-seat hall',WD,40.35,13.45,54.65,13.45,L2,L3+2.52,(50.4,52.4))
doorway(I+'100-seat hall',WD,54.65,3.05,54.65,13.45,L2,L3+2.52,(9.1,11.15))
# Teaching rooms: a through gallery, with two rooms on either side.
for yy,YY in [(1.5,8.26),(10.0,16.76)]:
 doorway(I+'Four classrooms',WH,63.00,yy,63.00,YY,L2,L3-.27)
 edge=YY if yy<2 else yy
 for x,X in [(56.80,63.),(63.,69.2)]:
    doorway(I+'Four classrooms',WH,x,edge,X,edge,L2,L3-.27,(x+1.0,x+2.25))
    counts['classrooms']+=1
    for dx in [1.20,3.65]:
     for dy in [2.0,4.1]:
      box(I+'Classroom furniture',WD,x+dx,yy+dy,L2+.68,x+dx+1.3,yy+dy+.65,L2+.76)
      box(I+'Classroom furniture',ST,x+dx+.60,yy+dy+.28,L2,x+dx+.70,yy+dy+.38,L2+.68)
for yy,YY in [(1.55,5.55),(7.2,11.2)]:
 for n in range(3):
    x=57.9+n*3.52;X=x+3.52
    doorway(I+'Six administrative offices',WH,x,yy,x,YY,L3,L3+2.82)
    edge=YY if yy<2 else yy;doorway(I+'Six administrative offices',WH,x,edge,X,edge,L3,L3+2.82,(x+.45,x+1.5))
    counts['offices']+=1
for yy in [11.24,15.8]:
 doorway(I+'Administration and conference',WH,57.9,yy,68.55,yy,L3,L3+2.72,(59,60.2))
# Cafe and gallery at grade. A compact service bank occupies the quieter north edge.
for x,y,X,Y,opening in [(56.6,1.55,56.6,13.,(8.2,10.2)),(56.6,7.6,63.0,7.6,(58.,59.5)),
 (44.35,1.55,44.35,9.35,(5.,6.5)),(44.35,9.35,55.65,9.35,(48.7,50.5))]:
 doorway(I+'Cafe, kitchen and gallery',WH,x,y,X,Y,G,L2-.27,opening)
box(I+'Cafe, kitchen and gallery',WD,58.,8.4,G,63.5,9.18,G+1.02)
for j in range(5):
 x=58.05+j*2.0
 box(I+'Cafe, kitchen and gallery',WD,x,11.5,G+.70,x+1.04,12.15,G+.77)
 box(I+'Cafe, kitchen and gallery',ST,x+.46,11.72,G,x+.58,11.89,G+.70)
# Ground-floor public service rooms and screens, including two family toilets.
for x in [33.0,36.4,39.8,42.8]:
 doorway(I+'Public restrooms and service',WH,x,10.0,x,17.8,G,L2-.27,(15.9,17.1))
for xa,xb in [(33.,36.4),(36.4,39.8),(39.8,42.8)]:
 doorway(I+'Public restrooms and service',WH,xa,10.,xb,10.,G,L2-.27)
for yy in [12.5,15.]:
 doorway(I+'Public restrooms and service',WH,39.8,yy,42.8,yy,G,L2-.27,(40.3,41.3))
# Paired storey-deep Warren trusses: backspan and cantilever share continuous chords.
stations=[3.2+3.7*k for k in range(11)]
for yy in [1.40,19.20]:
 for z in [6.05,10.25]:beam(S+'West occupied cantilever trusses',ST,(3.2,yy,z),(40.2,yy,z),.30,.30)
 for i,x in enumerate(stations):
    beam(S+'West occupied cantilever trusses',ST,(x,yy,6.05),(x,yy,10.25),.20,.20)
    if i<10:beam(S+'West occupied cantilever trusses',ST,(x,yy,10.25 if i%2 else 6.05),(stations[i+1],yy,6.05 if i%2 else 10.25),.25,.25)
 for x in (10.6,40.2):footing(x,yy,6.05,.54)
# Orthogonal edge transfers at the smaller east cantilever and perimeter frames.
for yy in [1.43,17.03]:
 for x in [40.2,54.85,64.05]:footing(x,yy,L3+.32,.38)
 for z in [L2-.35,L3-.35]:
    beam(S+'East transfer frames',ST,(40.2,yy,z),(69.3,yy,z),.30,.62)
 for x in [40.2,47.525,54.85,59.45,64.05,69.3]:
    beam(S+'East transfer frames',WH,(x,yy,L2-.05),(x,yy,L3-.58),.17,.17)
 for i,(x,X) in enumerate(zip([40.2,47.525,54.85,59.45,64.05],[47.525,54.85,59.45,64.05,69.3])):
    beam(S+'East transfer frames',WH,(x,yy,L2 if i%2==0 else L3-.48),(X,yy,L3-.48 if i%2==0 else L2),.17,.21)
# In the clear hall, perimeter columns, roof rafters and purlins stay outside the room volume.
pitch=math.tan(math.radians(8.5))
def westroof(x,y):return 16.37-(y-1.25)*pitch
def eastroof(x,y):return 15.88-(y-1.25)*pitch
for x in stations:
 for yy in [1.4,19.20]:
    beam(S+'Hall roof frames',WH,(x,yy,10.25),(x,yy,westroof(x,yy)-.22),.17,.20)
 for ya,yb in ([(1.4,19.04)] if x<=32.18 else [(1.4,6.25),(16.5,19.04)]):
    beam(S+'Hall roof frames',WH,(x,ya,westroof(x,ya)-.57),(x,yb,westroof(x,yb)-.57),.18,.72)
 if x<=10.60:
    for z in [L2-.25,L3-.24]:beam(S+'West transverse floor beams',ST,(x,1.4,z),(x,19.20,z),.18,.45)
for x in [43.23,48.4,54.85,59.5,64.05,69.13]:
 for yy in [1.47,17.03]:
    beam(S+'East roof frames',WH,(x,yy,L3-.35),(x,yy,eastroof(x,yy)-.23),.18,.22)
 beam(S+'East roof frames',ST,(x,1.46,eastroof(x,1.46)-.42),(x,19.08,eastroof(x,19.08)-.42),.19,.62)
# Floor joists at the occupied east wing, interrupted over the small hall at L3.
for z in [L2,L3]:
 for x in frange(40.5,69.2,2.9):
    lo=13.5 if z==L3 and x<54.65 else 1.5
    if x<43.15:lo=max(lo,16.5)
    beam(S+'Composite floor joists',ST,(x,lo,z-.42),(x,17.05,z-.42),.15,.38)
# Braced lateral bays and roof-plane collectors.
for yy in [1.52,18.9]:
 beam(S+'Stability bracing',ST,(32.8,yy,G),(40.2,yy,6.05),.16)
for y0,y1 in [(1.5,5.8),(16.8,19.2)]:
 for x in [10.6,18.,25.4]:
    beam(S+'Roof-plane bracing',ST,(x,y0,westroof(x,y0)-.35),(x+7.4,y1,westroof(x+7.4,y1)-.35),.085)
# The long facades have a folded, rising opaque band. Glazed lights below the
# band follow the diagonal without copying the geometry of a historic precedent.
def facade(label,a,b,bottom,top,pattern='gallery',doors=()):
 x0,y0=a; x1,y1=b;length=math.hypot(x1-x0,y1-y0)
 ux=(x1-x0)/length;uy=(y1-y0)/length;nx=-uy;ny=ux
 def pt(t,d,z):return (x0+ux*t+nx*d,y0+uy*t+ny*d,z)
 def surface(t,T,lo,hi,mat,dep):
    # A planar trapezoidal cassette with a constant finite thickness.
    vs=[pt(p,d,f(p)) for d in (-dep/2,dep/2) for p,f in [(t,lo),(T,lo),(T,hi),(t,hi)]]
    if mat in (GL,TR) and i%7 in (1,4,6):mat=WH
    area=(T-t)*(hi(t)+hi(T)-lo(t)-lo(T))/2
    counts['wallArea']=counts.get('wallArea',0)+area
    if mat in (GL,TR):counts['wallLight']=counts.get('wallLight',0)+area
    geo.solid(E+label,mat,vs,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
 roof=lambda p:top(x0+ux*p,y0+uy*p) if callable(top) else top
 pieces=math.ceil(length/1.14)
 for i in range(pieces):
    t=i*length/pieces+.008;T=(i+1)*length/pieces-.008
    if any(lo<=.5*(t+T)<=hi for lo,hi in doors):
       if min(roof(t),roof(T))>bottom+2.85:surface(t,T,lambda p:bottom+2.85,roof,TR,.065)
       continue
    if pattern=='fold':
       sill=lambda p:bottom+.22
       head=lambda p:bottom+1.00+2.72*p/length
       upper=lambda p:roof(p)-.68
       surface(t,T,lambda p:bottom,sill,WH,.12)
       surface(t,T,sill,head,GL,.042);surface(t,T,head,upper,WH,.135);surface(t,T,upper,roof,TR,.055)
    elif pattern=='civic':
       sill=lambda p:bottom+.42
       head=lambda p:bottom+1.78
       surface(t,T,lambda p:bottom,sill,RC,.14)
       surface(t,T,sill,head,GL,.045);surface(t,T,head,roof,WD if i%14==0 else WH,.13)
    elif pattern=='high':
       split=lambda p:roof(p)-1.28
       surface(t,T,lambda p:bottom,split,WH,.14);surface(t,T,split,roof,TR,.065)
    else:
       s=lambda p:bottom+.24;h=lambda p:roof(p)-.37
       surface(t,T,lambda p:bottom,s,WH,.12);surface(t,T,s,h,GL,.044);surface(t,T,h,roof,WH,.11)
    if i%2==0:
       xx,yy,zz=pt(t,.02,0)
       beam(E+'Facade girts and mullions',ST,(xx,yy,bottom),(xx,yy,roof(t)),.066,.078)
for y in [1.28,18.85]:
 facade('Hall base and public openings',(10.68,y),(32.02,y),G,L2-.18,'civic',[(5.,8.4),(15.3,18.9)] if y>10 else [])
for y in [1.63,18.88]:
 facade('Folded metal cassettes and ribbon windows',(3.2,y),(32.15,y),L2,westroof,'fold')
facade('Cantilever end glazing',(3.22,1.26),(3.22,19.15),L2,westroof,'glass')
facade('Hall end glazing',(10.65,1.65),(10.65,18.78),G,L2-.15,'glass',[(4.3,8.9)])
for lo,hi,pattern in [(G,L2-.06,'glass'),(L2,L3-.08,'civic'),(L3,eastroof,'high')]:
 for y in [1.27,17.04]:
    start=40.24 if y<10 else 42.2
    end=64.05 if lo==G else 69.25
    facade('East wing panel walls',(start,y),(end,y),lo,hi,pattern,[(14.2,17.7),(22.,24.6)] if y>10 else [])
 end=64.05 if lo==G else 69.24
 facade('Detroit frontage',(end,1.28),(end,17.05),lo,hi,'glass',[(6.35,9.95)] if lo==G else [])
# Conditioned boundary around the open upper court, deep reveals and doors from both wings.
for a,b in [((32.18,6.25),(32.18,16.5)),((40.16,6.25),(40.16,16.50)),((32.18,6.25),(40.16,6.25)),((32.18,16.50),(40.16,16.50))]:
 for lo,hi in [(L2,L3-.02),(L3,lambda x,y:min(westroof(x,y),eastroof(x,y))-.18)]:
    facade('Sky court glazing',a,b,lo,hi,'glass',[(2.,4.45)] if lo==L2 else [])
# Slopes provide the spatial promenade. Each full return gains one storey.
# Paths A/C share direction, stacked about four metres apart; level balconies
# connect directly to the building at the east landing at G, L2 and L3.
def ramp(name,x,X,y,Y,h,H):
 z=lambda u,v:h+(H-h)*(u-x)/(X-x)
 plate(A+name,FL,rect(x,y,X,Y),z,.16)
 for yy in [y+.045,Y-.045]:
    beam(A+'Promenade edge girders',RED,(x,yy,h-.26),(X,yy,H-.26),.16,.49)
    handrail((x,yy),(X,yy),h,H,A+'Promenade handrails',RED)
    # Dense folded plate balustrade visually unifies the long ascending runs.
    beam(A+'Promenade parapets',RED,(x,yy,h+.30),(X,yy,H+.30),.068,.53)
 for xx in frange(x+.5,X-.1,3.7):
    beam(A+'Promenade cross beams',ST,(xx,y,z(xx,y)-.19),(xx,Y,z(xx,Y)-.19),.085,.18)
west,east=10.95,57.70
a1,a2,b1,b2=21.25,23.73,23.82,26.30
start=.36
ramp('Fourth Avenue arrival',.22,53.0,a1,a2,start,G)
for lo,hi in [(G,L2),(L2,L3)]:
 mid=(lo+hi)/2
 ramp('Return flights',west,east,b1,b2,mid,lo);ramp('Return flights',west,east,a1,a2,mid,hi)
 slab(A+'West turn balconies',FL,west-2.7,a1,west,b2,mid)
 handrail((west-2.6,a1),(west-2.6,b2),mid,mid,A+'Promenade handrails')
 for yy in [a1+.06,b2-.06]:handrail((west-2.6,yy),(west,yy),mid,mid,A+'Promenade handrails')
for z in [G,L2,L3]:
 slab(A+'East turn balconies',FL,east,21.20,east+3.4,b2,z)
 if z==L3:
    handrail((east+3.32,21.28),(east+3.32,22.68),z,z,A+'Promenade handrails')
    handrail((east+3.32,24.65),(east+3.32,b2),z,z,A+'Promenade handrails')
 else:handrail((east+3.32,21.28),(east+3.32,b2),z,z,A+'Promenade handrails')
 handrail((east,b2-.05),(east+3.32,b2-.05),z,z,A+'Promenade handrails')
slab(A+'Fourth Avenue arrival',FL,53,a1,east,a2,G,.16)
# At Detroit grade the short splayed approach reaches the east ground landing.
plate(A+'Detroit approach',FL,[(61.10,21.20),(67.95,21.20),(66.1,23.99),(61.10,23.99)],
 lambda x,y:G-.007*(x-61.10),.15)
# Bents bear outside the two clear walking lanes so the market remains open.
for x in [10.0,21.5,33.2,45.0,59.8]:
 for yy in [21.34,26.20]:
    top=(L3 if x>=east else (L2+L3)/2 + (L3-L2)*.5*(max(west,x)-west)/(east-west))-.31
    if yy>25 and x<east:top=L2+(L3-L2)/2*(east-max(west,x))/(east-west)-.31
    zbase=grade(x,yy)
    box(S+'Promenade bents',RC,x-.30,yy-.30,zbase-.13,x+.30,yy+.30,zbase+.30)
    beam(S+'Promenade bents',ST,(x,yy,zbase+.27),(x,yy,top),.19,.23)
 for lo,hi in [(G,L2),(L2,L3)]:
    t=(min(east,max(west,x))-west)/(east-west);mid=(lo+hi)/2
    for ya,yb,h in [(a1,a2,mid+(hi-mid)*t),(b1,b2,mid+(lo-mid)*t)]:
       beam(S+'Promenade bents',ST,(x,ya,h-.30),(x,yb,h-.30),.13,.25)
# South-facing insulated roofs, diffuse north-light bands and roof-mounted PV.
def roofpatch(name,x,y,X,Y,roof,sky=False):
 if X<=x or Y<=y:return
 plate((P+'Roof daylight apertures') if sky else (E+name),TR if sky else WH,rect(x,y,X,Y),roof,.09 if sky else .17)
 counts['roofLights' if sky else 'insulatedRoof']+=(X-x)*(Y-y)
 if sky:
    for xx in frange(x+.04,X,1.45):
       beam(E+'Rooflight cap bars',ST,(xx,y,roof(xx,y)+.032),(xx,Y,roof(xx,Y)+.032),.044,.062)
def array(x,y,X,Y,roof):
 # 520 W module, 2.08 x 1.134 m on slope. Module pitch leaves drainage joints.
 for xx in frange(x,X-2.08,2.116):
  for yy in frange(y,Y-1.121,1.149):
    plate(P+'Roof photovoltaics',PV,rect(xx,yy,xx+2.08,yy+1.121),lambda u,v:roof(u,v)+.126,.038)
    counts['pv']+=1
 # Two bearing rails per transverse row tie the module frames to the purlins.
 for yy in frange(y+.24,Y-.65,1.149):
    for dy in (0,.59):
       beam(P+'PV rails',WH,(x,yy+dy,roof(x,yy+dy)+.076),(X,yy+dy,roof(X,yy+dy)+.076),.045,.061)
for x,X,y,Y,rf in [(3.2,32.18,1.22,19.23,westroof),(40.16,69.30,1.22,19.12,eastroof)]:
 breaks=[y,y+7.06,y+9.90,Y]
 for i,(a,b) in enumerate(zip(breaks,breaks[1:])):
    roofpatch('Insulated hall roof',x,a,X,b,rf,i==1)
    if i!=1:array(x+.25,a+.18,X-.22,b-.16,rf)
 for yy in frange(y+.12,Y,1.42):
    beam(S+'Roof purlins',WH,(x,yy,rf(x,yy)-.20),(X,yy,rf(X,yy)-.20),.10,.19)
 for yy in [y,Y]:
    beam(E+'Roof caps',WH,(x,yy,rf(x,yy)),(X,yy,rf(X,yy)),.12,.25)
for y,Y in [(1.22,6.25),(16.5,19.16)]:
 roofpatch('Court bridges',32.18,y,40.16,Y,westroof);array(32.45,y+.12,39.95,Y-.12,westroof)
 for xx in [32.26,36.2,40.1]:
    beam(S+'Roof purlins',WH,(xx,y,westroof(xx,y)-.27),(xx,Y,westroof(xx,Y)-.27),.14,.32)
# Canopies are three split plates with a continuous open slot above each public aisle.
# All booths turn inward to the 4.65 m clear aisle. Posts are on the backs of booths.
stallW=2.4384;stallD=3.048;aisle=4.65
for j,(north,n,first,height) in enumerate([(25.4,23,1.10,8.23),(36.146,20,1.08,7.09),(46.892,17,.62,6.14)]):
 south=north+2*stallD+aisle;mid=(north+south)/2
 left=max(.18,first-.40);right=first+n*stallW+.17
 rf=lambda x,y,north=north,height=height:height-(y-north)*pitch
 for ya,yb in [(north+.015,mid-.56),(mid+.56,south-.015)]:
    plate(M+'Folded market canopies',WH,rect(left,ya,right,yb),rf,.115)
    counts['canopyRoof']+=(right-left)*(yb-ya)
    array(left+.13,ya+.11,right-.11,yb-.11,rf)
    for yy in [ya+.09,(ya+yb)/2,yb-.09]:
       beam(S+'Market purlins',ST,(left,yy,rf(left,yy)-.14),(right,yy,rf(right,yy)-.14),.12,.22)
    for yy in [ya,yb]:
       beam(M+'Market roof fascias',WH,(left,yy,rf(left,yy)-.05),(right,yy,rf(right,yy)-.05),.065,.22)
 # Tapered cantilever roof ribs; beam lines along the booth divisions.
 supports=[first+(i*stallW) for i in range(2,n,5)]
 if right-supports[-1]>6.4:supports.append(first+(n-2)*stallW)
 for x in supports:
    for yy in [north+.16,south-.16]:
       base=grade(x,yy);peak=rf(x,yy)-.22
       box(S+'Market piers',RC,x-.29,yy-.30,base-.1,x+.29,yy+.30,base+.32)
       beam(S+'Market canopy frames',ST,(x,yy,base+.29),(x,yy,peak),.18,.23)
       toward=1 if yy<mid else -1
       beam(S+'Market canopy frames',ST,(x,yy,peak-1.22),(x,yy+2.43*toward,rf(x,yy+2.43*toward)-.28),.12,.17)
    beam(S+'Market canopy frames',WH,(x,north+.15,rf(x,north+.15)-.33),(x,south-.15,rf(x,south-.15)-.33),.16,.40)
 for i in range(n):
  u=first+i*stallW
  for y0,sgn in [(north+stallD,-1),(south-stallD,1)]:
    v=y0+sgn*.84
    z=grade(u+stallW/2,v)+.855
    slab(M+'120 vendor tables',WD,u+.018,v-.4572,u+stallW-.018,v+.4572,z,.075)
    for xx in [u+.26,u+stallW-.26]:
       for yy in [v-.31,v+.31]:
          box(M+'Table trestles',ST,xx-.035,yy-.04,grade(xx,yy)+.028,xx+.035,yy+.04,z-.073)
    if (i+j+int(sgn))%3:
       for k in [0,1]:
          box(M+'Produce trays',['Leaf','Ochre','Chalk'][(i+k+j)%3],u+.25+k*.82,v-.26,z,u+.94+k*.82,v+.22,z+.14)
    counts['stalls']+=1
# Two outside entry/service shelters use the projecting building frame as their backspan.
for x,y,X,Y,h in [(3.2,1.25,10.6,18.85,L2-.28),(60.4,19.18,65.0,25.23,L2-.46)]:
 # First element is the occupied west cantilever itself; only the service wing needs a roof.
 if x>50:
    def service_roof(u,v):return h-.035*(v-y)
    plate(M+'Service canopy',WH,rect(x,y,X,Y),service_roof,.16)
    for xx in [x+.20,X-.23]:
       beam(S+'Service canopy outriggers',ST,(xx,17.03,h),(xx,Y,h-.52),.15,.32)
 counts['canopyRoof']+=(X-x)*(Y-y)
# Low planting only occupies the unused east wedge near the north alley.
for j,(x,y,X,Y) in enumerate([(71.4,1.4,77.,4.2),(70.75,5.1,74.9,7.4),(69.95,8.1,72.1,10.3)]):
 plate(T+'Rain beds','Planting',rect(x+.12,y+.12,X-.12,Y-.12),lambda u,v:grade(u,v)+.17,.18)
 for xx in (x,X-.13):
    plate(T+'Rain beds',RC,rect(xx,y,xx+.13,Y),lambda u,v:grade(u,v)+.20,.19)
# Complete the two high public galleries with guards at the independent edge.
for zz in [L2,L3]:
 for xa,xb in [(3.23,57.69)]+([] if zz==L3 else [(61.11,67.95)]):
    handrail((xa,21.15),(xb,21.15),zz,zz,A+'Upper public gallery guards',ST)
 handrail((3.24,19.24),(3.24,21.14),zz,zz,A+'Upper public gallery guards',ST)
 handrail((69.24,17.08),(69.24,19.2),zz,zz,A+'Upper public gallery guards',ST)
 handrail((69.24,19.2),(67.96,21.12),zz,zz,A+'Upper public gallery guards',ST)
# Close the short ends of the bridge galleries at the two roof abutments.
for yy in [1.26,19.15]:
 for lo,hi in [(G,L2-.08),(L2,L3-.08),(L3,westroof)]:
    facade('Bridge ends',(32.2,yy),(40.16,yy),lo,hi,'civic',[(1.5,3.2)] if yy>10 and lo==G else [])
# Accessible gates into the triple-height hall and columns below its floor.
for xx in [11.05,21.35,31.6,43.55,54.7,62.6]:
 for yy in [1.70,10.25,18.68]:
    box(S+'Lower-ground frame',RC,xx-.19,yy-.19,B,xx+.19,yy+.19,G-.23)
 for yy in (1.74,10.25,18.65):
    beam(S+'Lower-ground frame',ST,(max(10.98,xx-5.0),yy,G-.43),(min(62.67,xx+5.0),yy,G-.43),.18,.39)
# Removable seats are grouped for both an occupied and a completely clear floor.
for name,cols,rows,x0,y0,spacing,pitchY,z in [
 ('Large hall',20,18,13.35,4.90,.71,.746,G),('Small hall',10,10,42.65,4.65,.79,.74,L2)]:
 for row in range(rows):
  for j in range(cols):
    xx=x0+j*spacing+(1.30 if j>=cols//2 else 0);yy=y0+row*pitchY
    box(I+name+' movable seating',WD,xx,yy,z+.398,xx+.45,yy+.406,z+.462)
    box(I+name+' movable seating',WD,xx,yy+.405,z+.453,xx+.45,yy+.455,z+.77)
    box(I+name+' movable seating',ST,xx+.193,yy+.15,z,xx+.246,yy+.26,z+.398)
 counts[name+' seats']=cols*rows
# Furniture and plumbing fixtures make the support spaces legible in layer views.
for xx in [33.65,37.05]:
 for j in range(4):
    yy=10.86+j*1.12
    box(I+'Restroom fixtures',WH,xx,yy,G,xx+.44,yy+.63,G+.42)
    box(I+'Restroom fixtures',WH,xx-.12,yy-.10,G,xx+.81,yy-.06,G+1.53)
for xx in [34.7,38.1,41.1]:
 box(I+'Restroom fixtures',WH,xx,15.45,G+.75,xx+.56,16.05,G+.83)
doorway(I+'Workshop, storage and plant',WH,37.8,8.95,44.4,8.95,B,G-.3,(38.45,39.8))
# Grade/Detroit canopy: covered dock with a clear approach adjacent to the lift.
for y0 in [21.0,22.5]:
 beam(I+'Service dock',YEL,(60.90,y0,G+.14),(62.60,y0,G+.14),.07,.125)
# A third inhabited projection turns the upper promenade toward Detroit Street.
prow=[(61.12,21.20),(67.86,21.20),(64.63,25.65),(61.12,25.65)]
plate(S+'Detroit reading bay',FL,prow,L3,.26)
prowroof=lambda x,y:13.76+.14*(y-19.12)
cap=[(61.12,19.12),(68.18,19.12),(64.63,25.65),(61.12,25.65)]
plate(E+'Raised reading bay roof',WH,cap,prowroof,.18)
counts['insulatedRoof']+=abs(sum(x*Y-X*y for (x,y),(X,Y) in zip(cap,cap[1:]+cap[:1])))/2
# The two longitudinal ties return past the knee supports to the north frame.
for xx,tip in [(61.21,(61.21,25.52)),(66.62,(64.50,25.52))]:
    for a,b in [((xx,1.45,L3-.31),(xx,17.03,L3-.31)),((xx,17.03,L3-.31),(tip[0],tip[1],L3-.31))]:
        beam(S+'Detroit reading bay',ST,a,b,.21,.52)
    beam(S+'Detroit reading bay',ST,(xx,17.03,G+.35),(xx-.52 if xx>65 else xx,20.85,L3-.36),.28,.31)
    beam(S+'Detroit reading bay',ST,(xx,17.03,L3-.35),(xx,17.03,prowroof(xx,17.03)-.2),.19,.19)
    beam(S+'Detroit reading bay',ST,(xx,17.03,prowroof(xx,17.03)-.2),(tip[0],tip[1],L3-.20),.16,.19)
for a,b in [(cap[1],cap[2]),(cap[2],cap[3]),(cap[3],cap[0])]:
    facade('Detroit reading bay',a,b,L3,prowroof,'glass',[(1.1,2.65)] if a==cap[3] else [])
# Breathing room around the three steps of the sharp end, with a reading bench.
box(I+'Detroit reading room',WD,61.92,23.44,L3+.38,64.11,24.06,L3+.53)
for x in [62.10,63.65]:box(I+'Detroit reading room',ST,x,23.6,L3,x+.13,23.89,L3+.38)
for z in [L2,L3]:
 for yy in [1.49,6.08,18.90,20.96]:
    span=(32.2,40.2) if yy<17 else (3.2,67.96)
    beam(S+'Gallery collectors',ST,(span[0],yy,z-.37),(span[1],yy,z-.37),.18,.39)
 for xx in [10.60,18.,25.4,32.8,40.2,47.5,54.85,64.05]:
    beam(S+'Gallery collectors',ST,(xx,17.17 if xx>40 else 18.96,z-.35),(xx,20.96,z-.35),.15,.31)
# The upper galleries overlook the assembly space. Protect each open floor edge.
for z in (L2,L3):
 handrail((10.52,1.60),(10.52,18.86),z,z,A+'Hall gallery balustrades',ST)
 handrail((10.60,18.92),(32.02,18.92),z,z,A+'Hall gallery balustrades',ST)
# Shared lounge and toilets immediately outside the education and staff suites.
for z,Z,name in [(L2,L3-.27,'Education lounge and restroom'),(L3,13.00,'Staff lounge and restroom')]:
 for x in [58.0,62.7]:
    doorway(I+name,WH,x,17.12,x,19.16,z,Z,None)
 doorway(I+name,WH,58.,19.16,62.7,19.16,z,Z,(59.0,60.25))
 box(I+'Restroom fixtures',WH,61.60,17.46,z,62.05,18.13,z+.43)
 box(I+'Restroom fixtures',WH,58.34,17.43,z+.75,58.92,17.99,z+.84)
 for u in [63.3,66.4]:
    box(I+name,WD,u,17.45,z+.36,u+1.6,18.07,z+.51)
# Whole-model closed-part and parcel checks before publication.
if geo.outliers:raise ValueError(('outside property',geo.outliers[:12],len(geo.outliers)))
assert counts['stalls']==120 and counts['classrooms']==4 and counts['offices']==6
dest=Path(sys.argv[1]);dest.parent.mkdir(parents=True,exist_ok=True)
stats=geo.write(dest,palette);print(json.dumps({**stats,**counts,'maxInteriorRampSlope':(L3-L2)/2/(east-west),'courtM2':(40.16-32.18)*(16.5-6.25)},indent=2))
