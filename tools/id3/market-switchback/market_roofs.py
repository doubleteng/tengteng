"""Three connected market halls on the surveyed wedge. Input units are metres.

The module compares three physical roof configurations with the same booth
layout. The web model uses the offset monitor configuration. Its main fields
share a south orientation; the folded west entrance pieces remain unpowered.
"""
from dataclasses import dataclass
import math

from geometry import beam, box, grade, plate, rect, solid


STEEL = 'Graphite steel'
ZINC = 'Galvanized silver'
GLASS = 'Translucent channel glass'
TIMBER = 'Oiled birch'
GLULAM = 'Glulam spruce'
CLT = 'CLT spruce'
PV = 'Blue-black photovoltaics'
CONCRETE = 'Board-formed concrete'
BAY = 2.4384
DEPTH = 3.048
AISLE = 4.65
BANK_DEPTH = 2 * DEPTH + AISLE
# Trina Solar Vertex N TSM-520NEG18R.20 frame, metres. The teaching grid
# reserves a 2.08 m bay per module for edge clamps and maintenance movement.
PANEL_SLOT = 2.08
PANEL_LENGTH = 1.961
PANEL_THICKNESS = .030
PANEL_WIDTH = 1.134
PITCH = math.radians(8.5)
TAN = math.tan(PITCH)
# The rows on each floor face one clear aisle; all tables lie inside their stall.
BANKS = ((25.40, 23, 1.10, 7.18), (36.146, 20, 1.08, 7.08),
         (46.892, 17, .62, 7.12))


@dataclass(frozen=True)
class Study:
    name: str
    monitor_offsets: tuple
    rises: tuple
    portal_rises: tuple
    west_fold: float
    east_taper: float
    monitor_setback: float
    eave_clearance: float
    max_frame_bays: int


STUDIES = (
    Study('01 / flush canopy', (5.37, 5.37, 5.37), (0, 0, 0), (0, 0, 0),
          .0, .0, .13, .13, 5),
    Study('02 / continuous high monitors', (4.76, 4.76, 4.76),
          (1.45, 1.45, 1.45), (1.0, 1.0, 1.0), 9.2, .52, 1.65, .22, 5),
    Study('03 / stepped market portals', (5.36, 5.64, 5.48),
          (1.24, .98, .79), (1.22, .84, .55), 4.4, .39, .40, .16, 4),
)


# Concept service-load comparison. Inputs are an assumed uniform roof dead
# load (incl. CLT, zinc, PV) and snow, plus each modeled beam's own weight.
# GL24h: Emean=11.5 GPa, Gmean=650 MPa, binderholz, EN 14080 GLT data:
# https://www.binderholz.com/fileadmin/user_upload/books/en/glulam/
# A product submittal and project-specific snow/drift, wind, connection,
# fire, moisture/creep and foundation designs are separate engineering work.
E_MEAN = 11.5e9
G_MEAN = .65e9
TIMBER_WEIGHT = 4.5e3
ROOF_SERVICE = 2600.     # 1.10 kPa dead + 1.50 kPa assumed uniform snow
CLT_DEPTH = .105
SKIN_DEPTH = .030
DECK_BOTTOM = CLT_DEPTH + SKIN_DEPTH
RAFTER = (.14, .36)


@dataclass(frozen=True)
class TimberFrame:
    bays: int
    primary: tuple
    girder: tuple
    post: tuple


FRAMES = {
    3: TimberFrame(3, (.24,.80), (.18,.60), (.28,.28)),
    4: TimberFrame(4, (.28,.88), (.20,.72), (.30,.32)),
    5: TimberFrame(5, (.28,.96), (.24,.84), (.36,.36)),
}


def timber_check(span, section, line=0., centre=0., cantilever=0.):
    """Simple or cantilever service UDL plus optional midspan point load.

    Includes elementary Timoshenko shear displacement (k=5/6). A centred
    transfer approximates the small real eccentricity conservatively.
    """
    b,h=section
    A=b*h; I=b*h**3/12; Z=b*h*h/6
    q=line+TIMBER_WEIGHT*A
    shear_stiffness=(5/6)*G_MEAN*A
    moment=q*span**2/8+centre*span/4
    flex=5*q*span**4/(384*E_MEAN*I)+centre*span**3/(48*E_MEAN*I)
    shear=q*span**2/(8*shear_stiffness)+centre*span/(4*shear_stiffness)
    tip_moment=q*cantilever**2/2
    tip_flex=q*cantilever**4/(8*E_MEAN*I)+q*cantilever**2/(2*shear_stiffness)
    return dict(section_mm=[round(b*1000),round(h*1000)],span_m=round(span,3),
                bending_mpa=round(moment/Z/1e6,2),deflection_mm=round((flex+shear)*1000,2),
                end_projection_m=round(cantilever,3),end_moment_stress_mpa=round(tip_moment/Z/1e6,2),
                end_deflection_mm=round(tip_flex*1000,2))


def roof_area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in
                   zip(poly, poly[1:]+poly[:1])))/2


def sample_range(start, stop, spacing):
    count = math.floor((stop-start)/spacing+1e-7)
    return [start+i*spacing for i in range(max(0, count+1))]


def web(layer, material, a, b, width, top_a, top_b, depth_a, depth_b):
    """A vertical tapered plate with tapered depth, used as folded sheet and fascia."""
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=math.hypot(dx,dy)
    nx,ny=-dy/length*width/2,dx/length*width/2
    corners=[]
    for side in (-1,1):
        corners.extend([(a[0]+side*nx,a[1]+side*ny,top_a-depth_a),
                        (b[0]+side*nx,b[1]+side*ny,top_b-depth_b),
                        (b[0]+side*nx,b[1]+side*ny,top_b),
                        (a[0]+side*nx,a[1]+side*ny,top_a)])
    solid(layer,material,corners,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],
                                 [2,3,7,6],[3,0,4,7]])


def build_bank(index, study, counts, frame):
    north,n,first,h= BANKS[index]
    south=north+BANK_DEPTH
    monitor=north+study.monitor_offsets[index]
    rise=study.rises[index]
    # Recess the high-side girder so it does not fill the clerestory.
    # Continuous rafters cantilever over this inboard support to the vent sill.
    high_collector=monitor+(1.26 if rise else .12)
    left=.28
    west=left+study.west_fold
    last=first+n*BAY+.10
    # The end cut is shallow enough for the roof to remain inside Detroit Street
    # at its low corner and to cover the last 3.048 m deep stall.
    def end(v):
        return last+study.east_taper*(south-v)
    def folded(u):
        return (study.portal_rises[index]*max(0,1-(u-left)/study.west_fold)
                if study.west_fold else 0.)
    def roof(u,v,high):
        return h-TAN*(v-north)+(rise if high else 0.)+folded(u)
    edge=.12
    ya=north+edge;yb=south-edge
    zone_list=[(ya,monitor-.04,False),(monitor+.04,yb,True)]
    skins='Market / Folded zinc roof planes'
    portal='Market / Folded entrance reveals'
    primary='Structure / Glulam market collectors'
    transverse='Structure / Glulam market frames'
    fittings='Structure / Concealed timber connections'
    drainage='Market / Box gutters and rain leaders'
    vents='Market / Operable northlight vents'
    solar='Energy / Roof photovoltaics'
    areas=0.
    module_counts=[0,0]
    opening_area=0.
    station_indices=list(range(1,n,frame.bays))
    if n-station_indices[-1] == 1 and len(station_indices)>1:
        station_indices[-1]-=1
    station_indices.append(n)
    stations=[first+i*BAY for i in station_indices]
    g_width,g_depth=frame.girder
    p_width,p_depth=frame.primary
    c_width,c_depth=frame.post
    frame_lows=[]
    rafter_design_span=0.
    max_rafter_tributary=0.
    max_rafter_tail=0.
    max_overhang=0.
    # Clip and retain the actual four-corner east return rather than extending
    # rectangular roofs across the diagonal street line.
    for side,(a,b,high) in enumerate(zone_list):
        if west>left:
            patches=[[(left,a),(west,a),(west,b),(left,b)],
                     [(west,a),(end(a),a),(end(b),b),(west,b)]]
        else:
            patches=[[(left,a),(end(a),a),(end(b),b),(left,b)]]
        top=lambda x,y,high=high:roof(x,y,high)
        for poly in patches:
            plate(skins,ZINC,poly,top,SKIN_DEPTH)
            areas+=roof_area(poly)
            # Factory panels stop at the fold. The CLT spans in the long
            # direction of the market, between adjacent transverse rafters.
            A,B,C,D=poly
            width=max(B[0]-A[0],C[0]-D[0])
            panels=max(1,math.ceil(width/BAY))
            max_rafter_tributary=max(max_rafter_tributary,width/panels)
            rail=lambda k,v0,v1:v0+(v1-v0)*k/panels
            for k in range(panels):
                near=rail(k,A[0],B[0]);far=rail(k,D[0],C[0])
                near1=rail(k+1,A[0],B[0]);far1=rail(k+1,D[0],C[0])
                gap=.002
                panel=[(near+gap,a),(near1-gap,a),(far1-gap,b),(far+gap,b)]
                plate('Structure / CLT market roof deck',CLT,panel,
                      lambda x,y:top(x,y)-SKIN_DEPTH-.001,CLT_DEPTH)
            for k in range(panels+1):
                if k==0 and A[0]==west and west>left:continue
                xa=rail(k,A[0],B[0]);xb=rail(k,D[0],C[0])
                if k==0:xa+=.12;xb+=.12
                if k==panels and B[0]!=west:xa-=.12;xb-=.12
                # Geometric support faces: beams frame into the outside
                # collector and the monitor collector on a concealed hanger.
                outer=north+.36 if not high else south-.36
                inner=monitor-.12 if not high else high_collector
                near_y,far_y=sorted((outer,inner))
                trim=frame.girder[0]*.47
                v0=(a+.055 if high and rise else near_y+trim);v1=far_y-trim
                loc=lambda v:xa+(xb-xa)*(v-a)/(b-a)
                za=top(loc(v0),v0)-DECK_BOTTOM-.001
                zb=top(loc(v1),v1)-DECK_BOTTOM-.001
                web('Structure / Glulam market rafters',GLULAM,(loc(v0),v0),
                    (loc(v1),v1),RAFTER[0],za,zb,RAFTER[1],RAFTER[1])
                rafter_design_span=max(rafter_design_span,
                    math.hypot(loc(far_y)-loc(near_y),far_y-near_y)/math.cos(PITCH))
                if high and rise:
                    max_rafter_tail=max(max_rafter_tail,
                        math.hypot(loc(inner)-loc(a),inner-a)/math.cos(PITCH))

        # At Fourth the exposed belly folds upward and is lined in timber.
        # The east edge cuts diagonally, with a shallow eave and a deeper root.
        web(portal,ZINC,(left,a),(left,b),.065,top(left,a),top(left,b),.17,.17)
        web(portal,ZINC,(end(a),a),(end(b),b),.062,
            top(end(a),a),top(end(b),b),.23,.12)
        if west>left:
            for k in range(5):
                u=left+.38+k*.65
                yy0=a+.07;yy1=b-.07
                beam(portal,TIMBER,(u,yy0,top(u,yy0)-.177),
                     (u,yy1,top(u,yy1)-.177),.064,.08)
        # Each field exposes its lower eave. Split slope gutter falls to a
        # downpipe on an actual steel portal at approximately 9.75 m centres.
        ydrain=b+.044
        runs=[left+.08,*stations,end(ydrain)-.12]
        def invert(x):
            return top(x,b)-.092+.004*min(abs(x-d) for d in stations)
        for k,(u,U) in enumerate(zip(runs,runs[1:])):
            divisions=sorted({u,U,*([west] if u<west<U else []),
                              *([(u+U)/2] if 0<k<len(runs)-2 else [])})
            for x,X in zip(divisions,divisions[1:]):
                for offset in (-.051,.051):
                    v=ydrain+offset
                    beam(drainage,ZINC,(x,v,invert(x)+.065),(X,v,invert(X)+.065),.013,.13)
                beam(drainage,ZINC,(x,ydrain,invert(x)),(X,ydrain,invert(X)),.109,.02)
        # PV is mounted on the steady 8.5° south pitched fields only. The north
        # maintenance strip is clear of the upstand's strongest near shadow.
        panel_depth=PANEL_WIDTH*math.cos(PITCH)
        first_y=a+study.eave_clearance
        south_margin=study.monitor_setback if not high and rise else study.eave_clearance
        rows=sample_range(first_y,b-south_margin-panel_depth,panel_depth+.023)
        for v in rows:
            x0=max(west+.14,left+.28)
            limit=min(end(v),end(v+panel_depth))-.20
            for slot in sample_range(x0,limit-PANEL_SLOT,PANEL_SLOT+.035):
                u=slot+(PANEL_SLOT-PANEL_LENGTH)/2
                plate(solar,PV,rect(u,v,u+PANEL_LENGTH,v+panel_depth),
                      lambda x,y:top(x,y)+.168,PANEL_THICKNESS/math.cos(PITCH))
                module_counts[side]+=1
            for rail_y in (v+.23,v+panel_depth-.23):
                beam('Energy / Market PV cross rails',ZINC,(x0,rail_y,top(x0,rail_y)+.103),
                     (limit,rail_y,top(limit,rail_y)+.103),.060,.115)
                for clip_x in sample_range(x0+.14,limit-.1,2*BAY):
                    plate('Energy / Market PV cross rails',ZINC,
                          rect(clip_x-.055,rail_y-.075,clip_x+.055,rail_y+.075),
                          lambda x,y:top(x,y)+.064,.07)
        # Two continuous GL24h collectors flank each CLT field. At the
        # monitor the lower and higher collectors sit on the transfer beam.
        for v in ((north+.36,monitor-.12) if not high else (high_collector,south-.36)):
            cut=sorted({left+.13,*stations,end(v)-.15,*([west] if west>left else [])})
            max_overhang=max(max_overhang,stations[0]-cut[0],cut[-1]-stations[-1])
            girder_offset=DECK_BOTTOM+(RAFTER[1] if v==high_collector and rise else 0.)
            for x,X in zip(cut,cut[1:]):
                web(primary,GLULAM,(x,v),(X,v),g_width,
                    top(x,v)-girder_offset,top(X,v)-girder_offset,g_depth,g_depth)
    # Every fourth glazed panel is a top-hung, partially opened sash.
    if rise:
        u=left+.12;right=end(monitor)-.12
        breaks=[u]
        if west>u:breaks.append(west)
        breaks.append(right)
        for xa,xb in zip(breaks,breaks[1:]):
            panels=max(1,round((xb-xa)/1.22))
            for i in range(panels):
                x=xa+(xb-xa)*i/panels+.012;X=xa+(xb-xa)*(i+1)/panels-.012
                z0,z1=roof(x,monitor,False),roof(X,monitor,False)
                low=.09;vent_h=rise-.20
                if i%4!=1:
                    web(vents,GLASS,(x,monitor),(X,monitor),.038,z0+rise-.10,z1+rise-.10,
                        vent_h,vent_h)
                else:
                    # The top-hung sash projects outward to the north.
                    H=vent_h;shift=min(.23,H*.35)
                    beam(vents,ZINC,(x,monitor-.02,z0+rise-.10),
                         (X,monitor-.02,z1+rise-.10),.045,.050)
                    a=(x,monitor,z0+rise-.10);b_=(X,monitor,z1+rise-.10)
                    c=(X,monitor-shift,z1+low);d=(x,monitor-shift,z0+low)
                    poly=[a,b_,c,d]
                    solid(vents,GLASS,poly+[(px,py+.024,pz) for px,py,pz in poly],
                          [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
                beam(vents,ZINC,(x,monitor,z0+.01),(x,monitor,z0+rise-.02),.048,.045)
                opening_area+=(X-x)*vent_h
    yN=north+.36;yS=south-.36
    for x in stations:
        # The shallowest roof point sets the continuous transfer elevation.
        member_top=min(roof(x,yN,False),roof(x,monitor-.12,False),
                       roof(x,yS,True))-DECK_BOTTOM
        underside=member_top-p_depth
        frame_lows.append((x,underside))
        # Horizontal beam terminates on both timber post bearing faces.
        web(transverse,GLULAM,(x,yN),(x,yS),p_width,member_top,member_top,p_depth,p_depth)
        for v,high,direction in ((yN,False,1),(yS,True,-1)):
            ground=grade(x,v)
            bearing=roof(x,v,high)-DECK_BOTTOM-g_depth
            base=ground+.29
            box('Structure / Market plinths',CONCRETE,x-.23,v-.23,ground-.15,
                x+.23,v+.23,ground+.24)
            box(fittings,STEEL,x-.13,v-.13,ground+.24,x+.13,v+.13,base)
            box(transverse,GLULAM,x-c_width/2,v-c_depth/2,base,
                x+c_width/2,v+c_depth/2,max(bearing,underside))
            knee_end=v+direction*1.18
            beam(transverse,GLULAM,(x,v,underside-.66),(x,knee_end,underside+.08),.16,.20)
            # Internal steel knife plate and two dowels, visible only at the tips.
            box(fittings,STEEL,x-.009,v-.11,underside-.28,x+.009,v+.11,underside+.34)
            for level in (underside-.17,underside+.17):
                beam(fittings,STEEL,(x-c_width/2-.002,v,level),
                     (x+c_width/2+.002,v,level),.029,.029)
            beam(drainage,STEEL,(x+.19,v,ground+.17),(x+.19,v,roof(x,v,high)-.25),.066,.09)
        for v,high in ((monitor-.12,False),(high_collector,True)):
            bearing=roof(x,v,high)-DECK_BOTTOM-g_depth-(RAFTER[1] if high and rise else 0.)
            if bearing>member_top:
                box(transverse,GLULAM,x-.12,v-.09,member_top,x+.12,v+.09,bearing)
            box(fittings,STEEL,x-.012,v-.065,min(member_top,bearing)-.15,
                x+.012,v+.065,max(member_top,bearing)+.12)
        for outlet,post,high in ((monitor+.004,yN,False),(yb+.044,yS,True)):
            drop=roof(x,outlet,high)-.20
            beam(drainage,STEEL,(x+.19,outlet,drop+.105),(x+.19,outlet,drop),.08,.09)
            beam(drainage,STEEL,(x+.19,outlet,drop),(x+.19,post,drop-.035),.082,.095)

    # Longitudinal stability bays and the CLT diaphragm carry wind to the
    # plinths. Braces remain entirely in the two booth-back support lines.
    for v,high in ((yN,False),(yS,True)):
        for j in sorted({0,len(stations)-2}):
            x,X=stations[j:j+2];mid=(x+X)/2
            beam(transverse,GLULAM,(x,v,grade(x,v)+.42),
                 (mid,v,roof(mid,v,high)-DECK_BOTTOM-g_depth),.14,.20)
            beam(transverse,GLULAM,(X,v,grade(X,v)+.42),
                 (mid,v,roof(mid,v,high)-DECK_BOTTOM-g_depth),.14,.20)
    for i in range(n):
        u=first+i*BAY
        for sign,y0 in [(-1,north+DEPTH),(1,south-DEPTH)]:
            v=y0+sign*.84
            z=grade(u+BAY/2,v)+.855
            box('Market / 120 vendor tables',TIMBER,u+.018,v-.4572,z-.075,
                u+BAY-.018,v+.4572,z)
            for xx in (u+.26,u+BAY-.26):
                for yy in (v-.31,v+.31):
                    box('Market / Table trestles',STEEL,xx-.035,yy-.04,grade(xx,yy)+.028,
                        xx+.035,yy+.04,z-.073)
            if (i+index+sign)%3:
                for k in (0,1):
                    box('Market / Produce trays',['Leaf','Ochre','Chalk'][(i+k+index)%3],
                        u+.25+k*.82,v-.26,z,u+.94+k*.82,v+.22,z+.14)
            counts['stalls']+=1
    counts['pv']+=sum(module_counts)
    counts['canopyRoof']+=areas
    aisle_y0=north+DEPTH
    aisle_y1=south-DEPTH
    # Exact primary soffit relative to the worst point of the graded aisle.
    clear=min(z-max(grade(x,aisle_y0),grade(x,aisle_y1))-.024 for x,z in frame_lows)
    spacing=max(b-a for a,b in zip(stations,stations[1:]))
    # Reaction-width envelope for each field. The high field's short
    # cantilever increases the reaction at its recessed monitor collector.
    high_clear=yS-high_collector
    high_tail=high_collector-(monitor+.04)
    high_reaction_width=high_clear/2+high_tail+high_tail**2/(2*high_clear)
    low_reaction_width=(monitor-north)/2
    width=max(low_reaction_width,high_reaction_width)
    load=ROOF_SERVICE*(low_reaction_width+high_reaction_width)*spacing
    # The two inner collectors and their timber rafters deliver additional
    # member dead weight through their pairs of reactions to this beam.
    load+=(2*TIMBER_WEIGHT*g_width*g_depth
           +TIMBER_WEIGHT*RAFTER[0]*RAFTER[1]*BANK_DEPTH/(2*max_rafter_tributary))*spacing
    member_checks={
        'transverse_transfer':timber_check(yS-yN,frame.primary,centre=load),
        'longitudinal_collector':timber_check(spacing,frame.girder,
            line=ROOF_SERVICE*width+TIMBER_WEIGHT*RAFTER[0]*RAFTER[1]*width/max_rafter_tributary,
            cantilever=max_overhang),
        'secondary_rafter':timber_check(rafter_design_span,RAFTER,
            line=ROOF_SERVICE*max_rafter_tributary,cantilever=max_rafter_tail)}
    return dict(bank=index+1,stalls=n*2,aisle_width_m=AISLE,aisle_north_v=round(aisle_y0,3),
                aisle_south_v=round(aisle_y1,3),entry_points=2,roof_plan_m2=round(areas,2),
                northlight_m2=round(opening_area,2),south_pv_count=sum(module_counts),
                north_blade_modules=module_counts[0],south_blade_modules=module_counts[1],
                solar_pitch_deg=8.5,solar_model='Trina TSM-520NEG18R.20',
                west_fold_rise_m=study.portal_rises[index],
                northlight_step_m=rise,
                max_primary_bay_m=round(max(b-a for a,b in zip(stations,stations[1:])),2),
                min_primary_frame_aisle_headroom_m=round(clear,2),
                clt_deck_mm=105,timber_checks=member_checks,post_count=2*len(stations),
                highest_west_roof_m=round(max(roof(left,ya,False),roof(left,monitor,True)),2))


def build_market(counts, design=STUDIES[-1], frame=None):
    """Append the market solids to geometry.layers and the shared model totals."""
    if any(key not in counts for key in ('stalls','pv','canopyRoof')):
        raise KeyError('Initialize stalls, pv and canopyRoof before building the market.')
    frame=frame or FRAMES[design.max_frame_bays]
    report=[build_bank(i,design,counts,frame) for i in range(len(BANKS))]
    counts['marketRoofStudy']=design.name
    counts['marketRoofBanks']=report
    return report
