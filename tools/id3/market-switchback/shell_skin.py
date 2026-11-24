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
MAIN = (2.38, 1.26, 56.72, 19.02)
ANNEX = (56.72, 1.30, 69.95, 18.05)
SEAM = 8.60
NORTH_SKIN, SOUTH_SKIN = 2.17, 18.875
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
    if annex: return 15.27-math.tan(TILT)*(y-1.30)
    if north: return 15.63-math.tan(TILT)*(y-MAIN[1])
    return roof(SEAM,True,False,study)+study.monitor-math.tan(TILT)*(y-SEAM)

def flange_layer(label): return 'Enclosure / '+label

def gridcuts(a,b,step):
    n=max(1,math.ceil((b-a)/step-1e-9))
    return [a+(b-a)*i/n for i in range(n+1)]

def wall(study, stats, draw, label, a, b, low, high, treatment, portals=(), max_width=1.8, external=True):
    """Clad an oriented plane in thermal cassettes. Portals trim all band geometry."""
    ax,ay=a; bx,by=b
    length=math.hypot(bx-ax,by-ay); ux,uy=(bx-ax)/length,(by-ay)/length; nx,ny=-uy,ux
    if abs(ux)>.95:
        direction='north' if any(abs(ay-q)<.015 for q in (NORTH_SKIN,3.65,1.43,16.90)) else 'south'
        if (direction=='north' and ny>0) or (direction=='south' and ny<0):nx,ny=-nx,-ny
    else:
        direction='west' if any(abs(ax-q)<.015 for q in (2.48,13.8,COURT[2])) else 'east'
        if (direction=='west' and nx>0) or (direction=='east' and nx<0):nx,ny=-nx,-ny
    breaks={0.,length}
    if abs(ux)>.95:
        breaks.update((x-ax)/ux for x in (2.6,7.0,13.4,39.8,45.8,56.6) if 0<(x-ax)/ux<length)
    for s,e,_,_ in portals: breaks.update((max(0,s),min(length,e)))
    sections=sorted(breaks)
    def xyz(i,d,h):return (ax+ux*i+nx*d,ay+uy*i+ny*d,h)
    def val(f,t):return f(ax+ux*t,ay+uy*t) if callable(f) else f
    def surface(s,e,u,v,U,V,m,tag,depth):
        area=(e-s)*(U+V-u-v)/2
        if area<.00001:return
        if external:
            stats['gross_wall_m2']+=area
            stats[direction+'_gross_m2']+=area
            if m in (CLEAR,CHANNEL):stats[direction+'_glass_m2']+=area
            if m==CLEAR:stats['vision_m2']+=area
            if m==CHANNEL:stats['diffuse_m2']+=area
        if not draw:return
        vv=[xyz(q,d,h) for d in (-depth/2,depth/2) for q,h in ((s,u),(e,v),(e,V),(s,U))]
        g.solid(flange_layer(tag),m,vv,FACES)
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
                # Recessed stop and outward folded seams give grazing light a profile.
                for z,Z in ((u0,u1),(v0,v1)):
                    g.beam(flange_layer('Window heads and sills'),INNER,xyz(s,.04,z),xyz(e,.04,Z),.13,.055)
                g.beam(flange_layer('Extruded mullions and seams'),ZINC,xyz(s,.09,lo0+.07),xyz(s,.09,hi0-.07),.046,.065)
                if treatment in ('school','hall','lantern') and ny>.25 and study.fins and n%2==0 and not on_gallery:
                    g.beam(flange_layer('South sun fins'),ZINC,xyz(s,.15,u0-.06),xyz(s+.14,study.fins+.12,v0+.10),.065,study.fins)
            if portal:
                if draw:
                    for q in ((s,) if abs(s-start)<1e-8 else ()) + ((e,) if abs(e-end)<1e-8 else ()):
                        g.beam(flange_layer('Portal reveals'),ZINC,xyz(q,.01,portal[0]+.06),xyz(q,.01,portal[1]-.06),.12,.19)
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
                            g.plate(flange_layer('Standing seam zinc and membrane'),ZINC,footprint,z,.035)
                            g.plate(flange_layer('Continuous roof insulation'),INNER,footprint,lambda u,q:z(u,q)-.035,.145)
                            g.plate('Structure / Exposed cross laminated roof panels',CLT,footprint,lambda u,q:z(u,q)-.180,.175)
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
                    g.beam(flange_layer('Folded roof edge trims'),ZINC,(xx,a,z(xx,a)),(xx,b,z(xx,b)),.12,.28)
                for u,U in ((x,X),) if annex or b<=COURT[1] or b>=COURT[3] else ((x,COURT[0]),(COURT[2],X)):
                    g.beam(flange_layer('Low-eave gutters'),ZINC,(u,b-.06,z(u,b)-.065),(U,b-.06,z(U,b)-.065),.18,.21)

    def W(label,a,b,lo,hi,t,doors=(),max_width=1.8,ext=True):
        wall(study,stats,draw,label,a,b,lo,hi,t,doors,max_width,ext)
    # Long street sides rise clear of the pedestrian entrances at both ends.
    for yy,north in [(NORTH_SKIN,True),(SOUTH_SKIN,False)]:
        h=roof(yy,north,False,study)-.12
        long_bays=[(2.6,13.4,'school'),(13.4,39.8,'hall'),(39.8,56.6,'lantern')]
        if north:
            # The north side of the enclosed exit stair already forms the
            # thermal boundary in this bay. Keep the occupied stair free of panels.
            long_bays[1:2]=[(13.4,14.0,'hall'),(14.0,21.4,'core'),(21.4,39.8,'hall')]
        for left,right,kind in long_bays:
            doors=[]
            if left<7:doors.append((0,4.40,base(2.6)-.25,L3-.27))
            if right>45.8 and north:
                doors.append((46.35-left,47.55-left,L3-.25,L3+2.57))
            if kind=='core':
                top=L3+2.86
                # The recessed thermal line meets the core below. The opaque
                # core itself lives in the Structure layer and is counted once.
                wall_area=(right-left)*(top-base(left)+.06)
                stats['gross_wall_m2']+=wall_area;stats['north_gross_m2']+=wall_area
                if draw:
                    g.plate(flange_layer('Stair-head flashing'),ZINC,g.rect(left,1.685,right,yy+.03),
                            lambda u,q:top+.030+.014*(q-1.685)/(yy-1.685),.045)
                W('Stair-head transom',(left,yy),(right,yy),top,h,'hall',[])
                continue
            W('Long bay', (left,yy),(right,yy),lambda x,y:base(x)-.06,h,kind,doors)
    for x,kind in [(2.48,'end'),(56.65,'lantern')]:
        for a,b,north in [(NORTH_SKIN,SEAM,True),(SEAM,SOUTH_SKIN,False)]:
            doors=[]
            if x>50:
                # Gallery thresholds connecting to the auditorium foyer.
                if a<8:doors=[(3.12-a,5.35-a,L2-.28,L3+2.70)]
            W('Short end',(x,a),(x,b),base(max(2.6,min(56.6,x)))-.04,
              lambda xx,yy:roof(yy,north,False,study)-.12,kind,doors)
    # Recessed assembly lobby and folding portals leave an uninterrupted ground-level hall.
    for a,b,kind,doors in [((13.8,3.65),(39.8,3.65),'plinth',[(8.50,10.65,G,5.37)]),
                            ((13.8,18.32),(40.00,18.32),'plinth',[(2.15,8.35,G,5.67),(15.5,21.7,G,5.67)]),
                            ((13.8,3.65),(13.8,18.32),'plinth',[(1.4,2.9,G,5.59),(11.95,13.55,G,5.59)])]:
        W('Retractable hall wall',a,b,G,6.04,kind,doors)
    for a,b,doors in [((56.68,1.43),(69.85,1.43),()),((56.68,17.94),(69.85,17.94),[(4.0,7.1,G,G+2.5)]),
                      ((69.85,1.43),(69.85,17.94),[(5.35,8.2,G,G+2.65)])]:
        gallery_side=a[1]==b[1]==17.94
        joint=L2-.12 if gallery_side else L2-.10
        # The upper entry stays clear of the deep timber shell and its webs;
        # a 1.70 m open bay meets the gallery within the east annex.
        upper_doors=[(62.5-a[0],64.2-a[0],joint,L2+2.45)] if gallery_side else []
        W('Street annex',a,b,G,joint,'plinth',doors)
        W('Street annex',a,b,joint,lambda x,y:roof(y,True,True,study)-.12,'lantern',upper_doors)
    # Seal the court to all occupied sides; one physically clear pair of entry openings.
    x,y,X,Y=COURT
    for a,b in [((x,y),(X,y)),((x,Y),(X,Y)),((x,y),(x,SEAM)),((x,SEAM),(x,Y)),
                ((X,y),(X,SEAM)),((X,SEAM),(X,Y))]:
        north=(a[1]+b[1])/2<=SEAM
        doors=[(1.45,3.35,L2-.15,L2+2.35)] if a[1]==b[1] else []
        W('Court glass',(a[0],a[1]),(b[0],b[1]),L2,
          lambda xx,yy:roof(yy,north,False,study)-.16,'court',doors,1.65)
    if draw:
        # The north thermal boundary steps behind the sheltered timber frame.
        # Portal/bay widths set the REAL bolt-face position; the plate and its
        # rectangular slip slot are modeled as independent, closed parts.
        stations=[2.6+3.6*i for i in range(16)]
        for truss,face in ((1.65,NORTH_SKIN),(18.35,SOUTH_SKIN)):
            inside=face-.130
            for level in (L3+.25,12.40):
                for x,X in zip(stations,stations[1:]):
                    if truss<5 and ((x<49.8 and X>45.8) or (x<21.4 and X>14.0)):continue
                    g.beam(flange_layer('Glulam secondary girts'),GLULAM,(x,inside,level),(X,inside,level),.092,.145)
                for i,u in enumerate(stations):
                    if truss<5 and (45.7<u<49.81 or 14.0<u<21.4):continue
                    width=.630 if i in (3,12) else .315
                    seat=truss+width/2
                    foot=level-.085
                    # Back plate with a 20 x 42 mm open slot. The steel seat folds
                    # back to the spruce girt and the slot allows vertical movement.
                    for a,A,h,H in ((-.080,-.010,-.065,.065),(.010,.080,-.065,.065),
                                     (-.010,.010,-.065,-.021),(-.010,.010,.021,.065)):
                        g.box(flange_layer('Slotted steel saddle cleats'),STEEL,
                              u+a,seat,foot+h,u+A,seat+.016,foot+H)
                    g.box(flange_layer('Slotted steel saddle cleats'),STEEL,u-.08,seat+.016,foot-.064,
                          u+.08,inside+.046,foot-.048)
                    # Two through-bolt nut/washer pairs remain visible on the
                    # outer face of the sheltered north glulam frame.
                    for dx in (-.054,.054):
                        for y0,y1 in ((truss-width/2-.014,truss-width/2),(seat+.016,seat+.03)):
                            g.box(flange_layer('Exposed saddle fasteners'),ZINC,u+dx-.018,y0,foot-.008,
                                  u+dx+.018,y1,foot+.028)
            if truss<5:continue
            for u in (13.4,35,53):
                top=roof(MAIN[3]-.06,False,False,study)-.16
                drop=SOUTH_SKIN+.105
                g.beam(flange_layer('Rain leaders and outlets'),ZINC,(u,MAIN[3]-.045,top),
                       (u,drop,top-.33),.13,.13)
                g.beam(flange_layer('Rain leaders and outlets'),ZINC,(u,drop,top-.33),
                       (u,drop,base(u)+.31),.115,.115)
        # A sloped secondary timber rafter at each cross frame bears on upstands
        # rising from the main roof framing. The CLT spans between these axes.
        for annex in (False,True):
            xx=stations if not annex else (56.85,60.,63.25,66.50,69.7)
            for x in xx:
                fields=[(MAIN[1]+.08,SEAM,True),(SEAM,MAIN[3]-.08,False)] if not annex else [(ANNEX[1]+.08,ANNEX[3]-.08,True)]
                if not annex and COURT[0]<x<COURT[2]:
                    fields=[(MAIN[1]+.08,COURT[1]-.09,True),(COURT[3]+.09,MAIN[3]-.08,False)]
                for a,b,north in fields:
                    h=roof(a,north,annex,study)-.515;H=roof(b,north,annex,study)-.515
                    g.beam('Structure / Glulam secondary roof rafters',GLULAM,(x,a,h),(x,b,H),.155,.320)
                    for q in (a+.34,b-.34):
                        z=roof(q,north,annex,study)-.675
                        sill=13.80 if annex else 13.62
                        if z>sill:
                            g.box('Structure / Glulam roof upstands',GLULAM,x-.077,q-.105,sill,x+.077,q+.105,z)
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
