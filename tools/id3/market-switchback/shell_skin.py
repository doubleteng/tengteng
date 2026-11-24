"""Panelize the lifted hall, the street lantern and a stepped north-light roof.

Three reproducible substitutions use one envelope outline and the same court.
Calling the module directly writes the measured options to the supplied path.
"""
import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import geometry as g
from gallery_cantilevers import ARMS, SIDES, NORTH_SKIN, SOUTH_SKIN, WEST_SKIN

STEEL = 'Graphite steel'
ZINC = 'Galvanized silver'
CLEAR = 'Vision glass'
CHANNEL = 'Translucent channel glass'
TIMBER = 'Oiled birch'
GLULAM = 'Glulam spruce'
CLT = 'CLT spruce'
PV = 'Blue-black photovoltaics'
STONE = 'Board-formed concrete'
INNER = 'Dark reveal'
WHITE = 'Chalk'
BAND = 'Vermilion steel'
G, L2, L3 = 2.5, 6.4116, 10.6788
TILT = math.radians(8.5)
COURT = (39.85, 6.9, 47.95, 16.9)
MAIN = (2.01, 1.08, 57.17, 19.02)
ANNEX = (57.17, 1.30, 69.95, 18.05)
SEAM = 8.60
ZINC_DEPTH, INSULATION_DEPTH, CLT_DEPTH = .035, .145, .175
ROOF_DEPTH = ZINC_DEPTH + INSULATION_DEPTH + CLT_DEPTH
MAIN_GIRDER_TOP = 13.52
EAST_SKIN = 57.06

# At the occupied school end, the timber truss and reading-room collectors
# sit above one continuous folded soffit. The other end has a recessed loggia.
def wall_foot(x):
    drop = 1.24 if x <= 13.4 else .58
    if 13.4 < x < 17.0:
        drop = 1.24-(x-13.4)*(.66/3.6)
    return base(x)-drop-.065

FACES = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]

@dataclass(frozen=True)
class Study:
    title: str
    vision: float
    daylight: float
    modulation: float
    skylight: float
    monitor: float
    fins: float

OPTIONS = (
    Study('Continuous curtain', .74, .26, .12, .075, .00, .00),
    Study('Screen and deep reveals', .176, .086, .93, .188, .64, .62),
    Study('Occupied bays and north light', .200, .061, .58, .15, 1.28, .38),
)

def base(x):
    if x < 13.4: return 6.05 + (13.4-x)*2.2116/10.8
    if x > 45.8: return 6.05 + (x-45.8)*1.70/10.8
    return 6.05

def roof(y, north, annex, study):
    if annex: return 16.90-math.tan(TILT)*(y-ANNEX[1])
    if north: return 15.63-math.tan(TILT)*(y-MAIN[1])
    return roof(SEAM,True,False,study)+study.monitor-math.tan(TILT)*(y-SEAM)

def deck_soffit(v, north=True, annex=False, study=OPTIONS[-1]):
    return roof(v, north, annex, study)-ROOF_DEPTH

def tapered_post(layer, material, footprint, bottom, top):
    """A plumb solid with independent lower and upper bearing planes."""
    vs=[(u,v,fn(u,v)) for fn in (bottom,top) for u,v in footprint]
    g.solid(layer,material,vs,FACES)

def flange_layer(label): return 'Enclosure / '+label

def gridcuts(a,b,step):
    n=max(1,math.ceil((b-a)/step-1e-9))
    return [a+(b-a)*i/n for i in range(n+1)]

def gallery_openings(a,b):
    # Open only the actual outer facade (including the end-wall split at its roof monitor).
    openings=[]
    for arm in ARMS:
        axis,face,_=SIDES[arm.side]
        across=1-axis
        if abs(a[axis]-face)>.000001 or abs(b[axis]-face)>.000001:
            continue
        left,right,bottom,top=arm.opening
        lo,hi=sorted((a[across],b[across]))
        if left>=hi or right<=lo:
            continue
        sign=1 if b[across]>a[across] else -1
        u,U=sorted(((left-a[across])*sign,(right-a[across])*sign))
        openings.append((u,U,bottom,top))
    return openings


def clean_panel(poly):
    points=[]
    for p in poly:
        if not points or math.dist(p,points[-1])>1e-8:
            points.append(p)
    if len(points)>1 and math.dist(points[-1],points[0])<1e-8:
        points.pop()
    return [b for a,b,c in zip(points[-1:]+points[:-1],points,points[1:]+points[:1])
            if abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-9]


def cut_panel(outline,opening):
    left,right,low,high=opening
    if (min(u for u,z in outline)>=right or max(u for u,z in outline)<=left
            or min(z for u,z in outline)>=high or max(z for u,z in outline)<=low):
        return [outline]
    middle=g.clip(g.clip(outline,1,low,True),1,high,False)
    parts=[g.clip(outline,1,low,False),g.clip(outline,1,high,True),
           g.clip(middle,0,left,False),g.clip(middle,0,right,True)]
    return [clean for part in parts if len(clean:=clean_panel(part))>=3]


def wall(study, stats, draw, label, a, b, low, high, treatment, portals=(), max_width=1.8, external=True):
    """Clad an oriented plane in thermal cassettes. Portals trim all band geometry."""
    ax,ay=a; bx,by=b
    length=math.hypot(bx-ax,by-ay); ux,uy=(bx-ax)/length,(by-ay)/length; nx,ny=-uy,ux
    if abs(ux)>.95:
        direction='north' if any(abs(ay-q)<.015 for q in (NORTH_SKIN,3.65,1.43,16.90)) else 'south'
        if (direction=='north' and ny>0) or (direction=='south' and ny<0):nx,ny=-nx,-ny
    else:
        direction='west' if any(abs(ax-q)<.015 for q in (WEST_SKIN,14.04,COURT[2])) else 'east'
        if (direction=='west' and nx>0) or (direction=='east' and nx<0):nx,ny=-nx,-ny
    breaks={0.,length}
    if abs(ux)>.95:
        breaks.update((x-ax)/ux for x in (2.6,7.0,13.4,17.0,39.8,45.8,56.6) if 0<(x-ax)/ux<length)
    for s,e,_,_ in portals: breaks.update((max(0,s),min(length,e)))
    sections=sorted(breaks)
    def xyz(i,d,h):return (ax+ux*i+nx*d,ay+uy*i+ny*d,h)
    def val(f,t):return f(ax+ux*t,ay+uy*t) if callable(f) else f
    holes=gallery_openings(a,b)
    def surface(s,e,u,v,U,V,m,tag,depth):
        regions=[[(s,u),(e,v),(e,V),(s,U)]]
        for hole in holes:
            regions=[piece for poly in regions for piece in cut_panel(poly,hole)]
        for poly in regions:
            area=.5*abs(sum(q*Z-Q*z for (q,z),(Q,Z) in zip(poly,poly[1:]+poly[:1])))
            if area<.00001:continue
            if external:
                stats['gross_wall_m2']+=area
                stats[direction+'_gross_m2']+=area
                if m in (CLEAR,CHANNEL):stats[direction+'_glass_m2']+=area
                if m==CLEAR:stats['vision_m2']+=area
                if m==CHANNEL:stats['diffuse_m2']+=area
            if not draw:continue
            n=len(poly)
            vv=[xyz(q,d,z) for d in (-depth/2,depth/2) for q,z in poly]
            faces=[list(range(n)),list(range(n,2*n))]+[
                [i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]
            g.solid(flange_layer(tag),m,vv,faces)

    def trim_line(tag,mat,s,z,e,h,d,width,depth):
        # Stop exposed cover sections at the sleeve frame, including their end caps.
        intervals=[(0.,1.)]
        for left,right,low,high in holes:
            entry,exit=0.,1.
            for start,delta,lo,hi in ((s,e-s,left-width/2,right+width/2),(z,h-z,low-depth/2,high+depth/2)):
                if abs(delta)<1e-9:
                    if start<lo or start>hi:entry,exit=1.,0.;break
                else:
                    A,B=sorted(((lo-start)/delta,(hi-start)/delta))
                    entry=max(entry,A);exit=min(exit,B)
            if entry<exit:
                intervals=[(A,B) for a,b in intervals for A,B in
                           ((a,min(b,entry)),(max(a,exit),b)) if B-A>1e-6]
        for A,B in intervals:
            g.beam(flange_layer(tag),mat,xyz(s+(e-s)*A,d,z+(h-z)*A),
                   xyz(s+(e-s)*B,d,z+(h-z)*B),width,depth)
    module=0
    for start,end in zip(sections,sections[1:]):
        cuts=gridcuts(start,end,max_width)
        for s,e in zip(cuts,cuts[1:]):
            p=(s+e)/2;lo0,lo1,hi0,hi1=val(low,s),val(low,e),val(high,s),val(high,e)
            portal=next(((lo,hi) for left,right,lo,hi in portals if left+.00001<p<right-.00001),None)
            # Bands vary with room use. Upper windows in the classroom end always
            # cross seated eye level; the hall's broad south band reveals the truss.
            n=module;module+=1
            light=study.vision;trans=study.daylight;sil=.17
            if study==OPTIONS[-1]:
                light*={'north':1.16,'south':.92,'west':.83,'east':.93}[direction]
                trans*=1.26 if direction=='north' else .83
            if treatment=='school':
                light*=1.12;sil=.31;trans*=.69
            if treatment=='hall':
                light*=1.34 if n%9 in (2,3,4,5) else .67;sil=.18;trans*=1.11
            if treatment=='lantern':
                light*=1.37;trans*=1.35;sil=.08
            if treatment=='court':
                light*=1.68;trans*=.3;sil=.18
            if treatment=='end':
                light*=1.65;trans*=.64;sil=.20
            if treatment=='plinth':
                light*=1.78;trans=0.;sil=.10
            modulation=(math.cos((ax+ux*p+ay+uy*p)*.19)*.5+.5)*study.modulation
            sil=min(.42,sil+.14*modulation)
            light=min(light,1-sil-.05);trans=min(trans,1-sil-light-.025)
            u0,u1=lo0+sil*(hi0-lo0),lo1+sil*(hi1-lo1)
            v0,v1=u0+light*(hi0-lo0),u1+light*(hi1-lo1)
            t0,t1=hi0-trans*(hi0-lo0),hi1-trans*(hi1-lo1)
            opaque=STONE if treatment=='plinth' else ZINC
            if treatment in ('end','school'):
                # Split the school end's window at the real upper floor/belt.
                # Move, rather than hide, the clear band to the level of the desks.
                if min(hi0,hi1)>14 and L3>min(lo0,lo1):
                    u0=min(hi0-.68,max(lo0+.45,L3+.62));u1=min(hi1-.68,max(lo1+.45,L3+.62))
                    v0=min(t0-.035,u0+light*(hi0-lo0));v1=min(t1-.035,u1+light*(hi1-lo1))
            if treatment=='hall' and direction=='north' and study==OPTIONS[-1]:
                span0=v0-u0;span1=v1-u1
                v0=t0-.25;v1=t1-.25;u0=v0-span0;u1=v1-span1
            # Lift the clear band and its projecting hood over the actual rising public gallery.
            on_gallery=direction=='south' and abs(ay-SOUTH_SKIN)<.015 and min(ax,bx)<47.5
            if on_gallery and study==OPTIONS[-1]:
                for side,px in enumerate((ax+ux*s,ax+ux*e)):
                    minimum=L2+.040004*(47.45-px)+2.43
                    if side==0:
                        d0=max(0,min(t0-.07-v0,minimum-v0));v0+=d0;u0+=d0
                    else:
                        d1=max(0,min(t1-.07-v1,minimum-v1));v1+=d1;u1+=d1
            if treatment=='plinth' and direction=='south' and abs(ay-18.32)<.01 and study==OPTIONS[-1]:
                # The operable market-wall hoods clear a standing person on the *raised* porch.
                d0=max(0,min(t0-.06-v0,G+2.35-v0));v0+=d0;u0+=d0
                d1=max(0,min(t1-.06-v1,G+2.35-v1));v1+=d1;u1+=d1
            if treatment=='school' and not portal and max(u0,u1)<L3+1.15<min(v0,v1):
                stats['classroom_eye_level_window_line_m']+=e-s
            if direction=='south' and not portal:
                height=(v0+v1-u0-u1)/2
                # Unobstructed normal-incidence solar sections at local solar noon;
                # output is aperture-height shading from THIS fixed hood alone.
                hood=study.fins*(2.8 if treatment in ('school','hall') else 1.65)
                stats['south_sample_vision_m2']+=(e-s)*height
                for month,alt in [('june',71.16),('december',24.28)]:
                    stats[month+'_noon_shade_m2']+=(e-s)*min(height,hood*math.tan(math.radians(alt)))
                if draw and hood>.001:
                    g.solid(flange_layer('Folded exterior light shelves'),ZINC,
                            [xyz(q,offset,h+dz) for dz in (-.055,0) for q,offset,h in
                             ((s,.065,v0),(e,.065,v1),(e,hood+.065,v1-.035),(s,hood+.065,v0-.035))],FACES)
            bands=[(lo0,lo1,u0,u1,opaque,'Insulated folded cassettes',.16),
                   (u0,u1,v0,v1,CLEAR,'Vision lights in recessed frames',.045),
                   (v0,v1,t0,t1,opaque,'Insulated folded cassettes',.16),
                   (t0,t1,hi0,hi1,CHANNEL,'Diffuse upper lights',.08)]
            for z,Z,h,H,m,tag,d in bands:
                if min(h-z,H-Z)<.001:continue
                if portal:
                    pz,pZ=portal
                    # Each portal is a genuine open interval, including its full width.
                    for loA,loB,hiA,hiB in [(z,Z,min(h,pz),min(H,pz)),(max(z,pZ),max(Z,pZ),h,H)]:
                        if min(hiA-loA,hiB-loB)>.001:surface(s,e,loA,loB,hiA,hiB,m,tag,d)
                else:surface(s,e,z,Z,h,H,m,tag,d)
            if draw and not portal:
                # North-side covers remain flush with the cassette face to
                # preserve the clear width of the gently rising promenade.
                trim_d=.005 if abs(ay-NORTH_SKIN)<.001 and abs(ux)>.95 else .04
                seam_d=.045 if abs(ay-NORTH_SKIN)<.001 and abs(ux)>.95 else .09
                # Recessed stop and outward folded seams give grazing light a profile.
                for z,Z in ((u0,u1),(v0,v1)):
                    trim_line('Window heads and sills',INNER,s,z,e,Z,trim_d,.13,.055)
                trim_line('Extruded mullions and seams',ZINC,s,lo0+.07,s,hi0-.07,seam_d,.046,.065)
                if treatment in ('school','hall','lantern') and ny>.25 and study.fins and n%2==0 and not on_gallery:
                    g.beam(flange_layer('South sun fins'),ZINC,xyz(s,.15,u0-.06),xyz(s+.14,study.fins+.12,v0+.10),.065,study.fins)
            if portal:
                if draw:
                    for q in ((s,) if abs(s-start)<1e-8 else ()) + ((e,) if abs(e-end)<1e-8 else ()):
                        jamb_d=-.035 if abs(ay-NORTH_SKIN)<.001 and abs(ux)>.95 else .01
                        g.beam(flange_layer('Portal reveals'),ZINC,xyz(q,jamb_d,portal[0]+.06),xyz(q,jamb_d,portal[1]-.06),.12,.19)
                if external:
                    clear=max(0,(e-s)*(min((hi0+hi1)/2,portal[1])-max((lo0+lo1)/2,portal[0])))
                    stats['portal_clear_m2']+=clear;stats[direction+'_gross_m2']+=clear


def build(study,draw=False):
    stats=defaultdict(float)
    # Rooflights replace metal between cap bars – there is no duplicate opaque face.
    for x,y,X,Y,annex in [(*MAIN,False),(*ANNEX,True)]:
        fields=[(y,Y,True)] if annex else [(y,SEAM,True),(SEAM,Y,False)]
        for a,b,north in fields:
            z=lambda u,v:roof(v,north,annex,study)
            # Rooflights advance or recede per bank over the large hall, school,
            # and east small hall. Solar cassettes drain down an uninterrupted fall.
            slot=(b-a)*study.skylight
            ym=a+slot
            stops=[x,X] if annex else [x,COURT[0],COURT[2],X]
            for left,right in zip(stops,stops[1:]):
                between=not annex and left==COURT[0]
                ys=sorted({a,ym,b,*[v for v in (COURT[1],COURT[3]) if between and a<v<b]})
                for v,V in zip(ys,ys[1:]):
                    if between and COURT[1]<(v+V)/2<COURT[3]:continue
                    lit=(v+V)/2<ym
                    stats['skylight_plan_m2' if lit else 'opaque_roof_plan_m2']+=(right-left)*(V-v)
                    if draw:
                        footprint=g.rect(left,v,right,V)
                        if not lit:
                            g.plate(flange_layer('Standing seam zinc and membrane'),ZINC,footprint,z,ZINC_DEPTH)
                            g.plate(flange_layer('Continuous roof insulation'),INNER,footprint,lambda u,q:z(u,q)-ZINC_DEPTH,INSULATION_DEPTH)
                            g.plate('Structure / Exposed cross laminated roof panels',CLT,footprint,lambda u,q:z(u,q)-ZINC_DEPTH-INSULATION_DEPTH,CLT_DEPTH)
                        else:
                            g.plate('Energy / Roof daylight apertures',CHANNEL,footprint,z,.08)
                        if lit:
                            for xx in gridcuts(left,right,1.8):
                                g.beam(flange_layer('Standing seam rooflight caps'),WHITE,(xx,v,z(xx,v)+.024),(xx,V,z(xx,V)+.024),.04,.052)
                    if not lit:
                        d=1.134*math.cos(TILT);r=v+.082
                        while r+d<=V-.075+1e-7:
                            u=left+.10;last=u
                            while u+1.961<=right-.10+1e-7:
                                stats['modules']+=1
                                if draw:g.plate('Energy / Roof photovoltaics',PV,g.rect(u,r,u+1.961,r+d),lambda xx,yy:z(xx,yy)+.18,.030)
                                last=u+1.961;u+=1.997
                            if draw and last>left+.12:
                                for rr in (r+.21,r+d-.21):
                                    g.beam('Energy / Roof PV carrier rails',ZINC,(left+.10,rr,z(left+.10,rr)+.110),(last,rr,z(last,rr)+.110),.05,.09)
                            r+=d+.025
            if draw:
                # Two glazing rails transfer rooflight loads through short stools
                # to the timber below. Both lines stop at the actual open court.
                spans=[(x+.30,X-.30)] if annex or north else [(x+.30,COURT[0]-.20),(COURT[2]+.20,X-.30)]
                positions=(57.42,60.34,63.25,66.24,69.23) if annex else [2.6+3.6*i for i in range(16)]
                first=(1.90 if annex else (1.70 if north else a+.30))
                for q in (min(first,ym-.18),ym-.12):
                    for u,U in spans:
                        rail_top=lambda xx,yy:z(xx,yy)-.08
                        g.plate(flange_layer('Rooflight glazing rails'),ZINC,g.rect(u,q-.04,U,q+.04),rail_top,.12)
                        for xx in positions:
                            if u<xx<U:
                                g.plate(flange_layer('Rooflight bearing stools'),STEEL,g.rect(xx-.045,q-.04,xx+.045,q+.04),
                                        lambda X,Y:rail_top(X,Y)-.12,ROOF_DEPTH-.20)
            if not annex and not north and study.monitor:
                for xa,xb in ((x,COURT[0]),(COURT[2],X)):
                    for u,U in zip(gridcuts(xa,xb,1.80),gridcuts(xa,xb,1.80)[1:]):
                        zl=roof(SEAM,True,False,study);zh=z(u,SEAM)
                        stats['north_monitor_m2']+=(U-u)*(zh-zl)
                        if draw:
                            g.box(flange_layer('North facing monitor vents'),CHANNEL,u,SEAM-.045,zl,U,SEAM+.045,zh)
                            g.box(flange_layer('Monitor cap and operable frames'),STEEL,u,SEAM-.058,zl,u+.045,SEAM+.058,zh)
                            g.beam(flange_layer('Monitor cap and operable frames'),ZINC,(u,SEAM,zh),(U,SEAM,zh),.18,.07)
            if draw:
                # Ends have upstands; exposed low eaves discharge into a box gutter.
                for xx in (x+.04,X-.04):
                    runs=[(a,b)]
                    if annex and xx < x+.05:
                        runs=[]
                    elif not annex and xx > X-.05:
                        runs=[(lo,hi) for lo,hi in ((a,min(b,ANNEX[1])),(max(a,ANNEX[3]),b)) if hi>lo]
                    for lo,hi in runs:
                        g.beam(flange_layer('Folded roof edge trims'),ZINC,(xx,lo,z(xx,lo)),(xx,hi,z(xx,hi)),.12,.28)
                for u,U in ((x,X),) if annex or b<=COURT[1] or b>=COURT[3] else ((x,COURT[0]),(COURT[2],X)):
                    g.beam(flange_layer('Low-eave gutters'),ZINC,(u,b-.06,z(u,b)-.065),(U,b-.06,z(U,b)-.065),.18,.21)

    if draw:
        # Fold the high field over an insulated vertical return to the lower roof.
        for a,b,north in ((ANNEX[1],SEAM,True),(SEAM,ANNEX[3],False)):
            roof1=lambda u,v:roof(v,north,False,study)
            roof2=lambda u,v:roof(v,True,True,study)
            low,high=sorted((roof1,roof2),key=lambda f:f(ANNEX[0],a))
            sign=1 if high is roof2 else -1
            x=ANNEX[0]
            def strip(f0,f1):
                return g.rect(min(f0,f1),a,max(f0,f1),b)
            tapered_post(flange_layer('Insulated roof step'),INNER,strip(x,x+.085*sign),low,high)
            tapered_post(flange_layer('Folded roof step flashing'),ZINC,strip(x-.014*sign,x),low,high)
            g.plate(flange_layer('Folded roof step flashing'),ZINC,strip(x-.060*sign,x+.09*sign),
                    lambda u,v:high(u,v)+.012,.012)
            g.plate(flange_layer('Folded roof step flashing'),ZINC,strip(x-.085*sign,x),
                    lambda u,v:low(u,v)+.012,.012)

    def W(label,a,b,lo,hi,t,doors=(),max_width=1.8,ext=True):
        wall(study,stats,draw,label,a,b,lo,hi,t,doors,max_width,ext)
    def roof_wall(label,a,b,low,north,annex,treatment,doors=(),max_width=1.8):
        # End the glass at its head channel below timber. Across rooflights
        # a deeper metal head closes the space up to the glazing gasket.
        sill=lambda u,v:deck_soffit(v,north,annex,study)-.026
        W(label,a,b,low,sill,treatment,doors,max_width)
        if not draw:return
        start,end=(ANNEX[1],ANNEX[3]) if annex else ((MAIN[1],SEAM) if north else (SEAM,MAIN[3]))
        limit=start+study.skylight*(end-start)
        x,y=a;X,Y=b
        ts=[0,1]
        if abs(Y-y)>.00001 and 0<(limit-y)/(Y-y)<1:
            ts.insert(1,(limit-y)/(Y-y))
        for t,T in zip(ts,ts[1:]):
            ax,ay=x+t*(X-x),y+t*(Y-y)
            bx,by=x+T*(X-x),y+T*(Y-y)
            glazed=(ay+by)*.5<limit
            top=lambda u,v:roof(v,north,annex,study)-(.08 if glazed else ROOF_DEPTH)
            if abs(ax-bx)<.00001:
                fp=g.rect(ax-.042,min(ay,by),ax+.042,max(ay,by))
            else:
                fp=g.rect(min(ax,bx),ay-.042,max(ax,bx),ay+.042)
            tapered_post(flange_layer('Metal heads at roof and glazing'),ZINC,fp,sill,top)

    # Long street sides rise clear of the pedestrian entrances at both ends.
    for yy,north in [(NORTH_SKIN,True),(SOUTH_SKIN,False)]:
        long_bays=[(WEST_SKIN,13.4,'school'),(13.4,39.8,'hall'),(39.8,EAST_SKIN,'lantern')]
        for left,right,kind in long_bays:
            doors=[]
            if right>45.8 and north:
                doors.append((46.35-left,47.55-left,L3-.25,L3+2.57))
            roof_wall('Long bay',(left,yy),(right,yy),lambda x,y:wall_foot(x),north,False,kind,doors)
    for a,b,north in [(NORTH_SKIN,SEAM,True),(SEAM,SOUTH_SKIN,False)]:
        roof_wall('Fourth Avenue end',(WEST_SKIN,a),(WEST_SKIN,b),wall_foot(WEST_SKIN),north,False,'end')
    # The annex meets most of the east end. Only exposed returns and the
    # band between the two roof levels are exterior walls at this shared seam.
    for a,b,north in [(NORTH_SKIN,1.43,True),(17.94,SOUTH_SKIN,False)]:
        roof_wall('East end return',(EAST_SKIN,a),(EAST_SKIN,b),wall_foot(EAST_SKIN),north,False,'lantern')
    # Recessed assembly lobby and folding portals leave an uninterrupted ground-level hall.
    # At the north-west notch the concrete stair wall already forms the perimeter.
    # Butt the hall panels to its exterior face, keeping the plinth head under
    # the truss shoes and the continuous external soffit.
    for a,b,doors in [((21.4,3.65),(39.8,3.65),[(.90,3.05,G,5.37)]),
                      ((14.04,18.32),(40.00,18.32),[(1.91,8.11,G,5.67),(15.26,21.46,G,5.67)]),
                      ((14.04,4.90),(14.04,18.32),[(.15,1.65,G,5.59),(10.70,12.30,G,5.59)])]:
        W('Retractable hall wall',a,b,G,lambda x,y:wall_foot(x),'plinth',doors)
    for a,b,doors in [((EAST_SKIN,1.43),(69.85,1.43),()),
                      ((EAST_SKIN,17.94),(69.85,17.94),[(60.68-EAST_SKIN,63.78-EAST_SKIN,G,G+2.5)]),
                      ((69.85,1.43),(69.85,17.94),[(5.35,8.2,G,G+2.65)])]:
        gallery_side=a[1]==b[1]==17.94
        joint=L2-.12 if gallery_side else L2-.10
        # The upper entry stays clear of the deep timber shell and its webs;
        # a 1.70 m open bay meets the gallery within the east annex.
        upper_doors=[(62.5-a[0],64.2-a[0],joint,L2+2.45)] if gallery_side else []
        W('Street annex',a,b,G,joint,'plinth',doors)
        roof_wall('Street annex',a,b,joint,True,True,'lantern',upper_doors)
    # Seal the court to all occupied sides; one physically clear pair of entry openings.
    x,y,X,Y=COURT
    for a,b in [((x,y),(X,y)),((x,Y),(X,Y)),((x,y),(x,SEAM)),((x,SEAM),(x,Y)),
                ((X,y),(X,SEAM)),((X,SEAM),(X,Y))]:
        north=(a[1]+b[1])/2<=SEAM
        doors=[(1.45,3.35,L2-.15,L2+2.35)] if a[1]==b[1] else []
        roof_wall('Court glass',a,b,L2,north,False,'court',doors,1.65)
    if draw:
        # Both weather walls enclose the primary timber frames.
        # Portal/bay widths set the REAL bolt-face position; the plate and its
        # rectangular slip slot are modeled as independent, closed parts.
        stations=[2.6+3.6*i for i in range(16)]
        for truss,face in ((1.65,NORTH_SKIN),(18.35,SOUTH_SKIN)):
            out=1 if truss>5 else -1
            inside=face-out*.135
            for level in (L3+.25,12.40):
                for i,(x,X) in enumerate(zip(stations,stations[1:])):
                    if truss<5 and x<47.55 and X>46.35:continue
                    left=.45 if i in (3,12) else .225
                    right=.45 if i+1 in (3,12) else .225
                    g.beam(flange_layer('Glulam secondary girts'),GLULAM,(x+left,inside,level),(X-right,inside,level),.090,.145)
                for i,u in enumerate(stations):
                    if truss<5 and 45.7<u<49.81:continue
                    width=.630 if i in (3,12) else .315
                    near=truss+out*width/2
                    for sense in ([1] if i==0 else [-1] if i==15 else [-1,1]):
                        edge=u+sense*(.45 if i in (3,12) else .225)
                        x0,x1=sorted((edge,edge+sense*.105))
                        yt,Yt=sorted((inside-out*.045,near))
                        g.box(flange_layer('Inboard girt seats'),STEEL,x0,yt,level-.09,x1,Yt,level-.07)
                        g.box(flange_layer('Inboard girt seats'),STEEL,x0,yt,level-.09,x0+.014,Yt,level+.05)
            if truss<5:continue
            for u in (13.4,35,53):
                top=roof(MAIN[3]-.06,False,False,study)-.16
                drop=SOUTH_SKIN+.105
                g.beam(flange_layer('Rain leaders and outlets'),ZINC,(u,MAIN[3]-.045,top),
                       (u,drop,top-.33),.13,.13)
                g.beam(flange_layer('Rain leaders and outlets'),ZINC,(u,drop,top-.33),
                       (u,drop,base(u)+.31),.115,.115)
        # Plumb-ended rafters stop on each side of the roof monitor and the court glass.
        for x in stations:
            fields=[(1.42,SEAM-.11,True),(SEAM+.11,18.68,False)]
            if COURT[0]<x<COURT[2]:
                fields=[(1.42,COURT[1]-.22,True),(COURT[3]+.22,18.68,False)]
            for a,b,north in fields:
                top=lambda u,v:deck_soffit(v,north,False,study)
                g.plate('Structure / Glulam secondary roof rafters',GLULAM,g.rect(x-.0775,a,x+.0775,b),top,.32)
                for q in (max(a+.25,2.12),min(b-.25,17.88)):
                    if a+.1<q<b-.1:
                        tapered_post('Structure / Glulam roof upstands',GLULAM,g.rect(x-.077,q-.10,x+.077,q+.10),
                                     lambda u,v:MAIN_GIRDER_TOP,lambda u,v:top(u,v)-.32)
        # Twenty-centimetre insulated kerbs and a metal coping turn up around the
        # actual opening, split where the high monitor changes roof elevation.
        x,y,X,Y=COURT
        for a,b in [((x,y),(X,y)),((x,Y),(X,Y)),((x,y),(x,SEAM)),((x,SEAM),(x,Y)),((X,y),(X,SEAM)),((X,SEAM),(X,Y))]:
            north=(a[1]+b[1])*.5<=SEAM
            h,H=roof(a[1],north,False,study),roof(b[1],north,False,study)
            g.beam(flange_layer('Court roof upstands and copings'),INNER,(*a,h+.075),(*b,H+.075),.18,.23)
            g.beam(flange_layer('Court roof upstands and copings'),ZINC,(*a,h+.212),(*b,H+.212),.235,.044)
    gross=stats['gross_wall_m2']+stats['portal_clear_m2']
    for d in ('north','east','south','west'):
        stats[d+'_wwr_pct']=100*stats[d+'_glass_m2']/stats[d+'_gross_m2']
    for m in ('june','december'):
        stats[m+'_south_noon_hood_shade_pct']=100*stats[m+'_noon_shade_m2']/stats['south_sample_vision_m2']
    stats['wwr_pct']=100*(stats['vision_m2']+stats['diffuse_m2'])/gross
    stats['skylight_plan_pct']=100*stats['skylight_plan_m2']/(stats['opaque_roof_plan_m2']+stats['skylight_plan_m2'])
    return {k:(int(v) if k=='modules' else round(v,3)) for k,v in stats.items()}

def build_skin(counts):
    s=build(OPTIONS[-1],True)
    counts['pv']+=s['modules'];counts['roofLights']+=s['skylight_plan_m2'];counts['insulatedRoof']+=s['opaque_roof_plan_m2']
    counts['wallArea']=counts.get('wallArea',0)+s['gross_wall_m2']+s['portal_clear_m2']
    counts['wallLight']=counts.get('wallLight',0)+s['diffuse_m2']+s['vision_m2']
    return s

if __name__=='__main__':
    results=[{'option':o.title,**build(o)} for o in OPTIONS]
    if len(sys.argv)>1:Path(sys.argv[1]).write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2))
