"""Street-facing ground enclosure and room-specific exterior privacy zones."""
import math
import geometry as g

GROUND=2.50
FORUM=6.4116
STUDIO=10.6788
THICK=.12
E='Enclosure / '
# The exterior reference line is directed so that the conditioned room
# is always on the left. The two small projecting pier bays enclose the true
# cross-girder support at its 1.16 x 1 m concrete pedestal.
NORTH=[(39.80,3.65),(39.80,1.45),(45.10,1.45),(45.10,1.14),
       (46.50,1.14),(46.50,1.45),(57.06,1.45)]
SOUTH=[(57.06,17.94),(57.06,18.48),(46.50,18.48),(46.50,18.86),
       (45.10,18.86),(45.10,18.48),(40.00,18.48),(40.00,18.32)]
FOYER_LIGHTS=((41.37,42.45),(42.64,43.72),(43.91,44.79))

def privacy_zones(a,b):
    """Return local horizontal extents and elevations opaque for exterior sightlines."""
    x,y=a;X,Y=b
    horizontal=abs(X-x)>abs(Y-y)
    limits=[]
    if horizontal and abs(y-17.94)<.006:
        # Family WCs flanking the through-lobby and the upper administrative WC.
        limits=[(57.03,60.08,GROUND-.02,FORUM),(63.,66.39,GROUND-.02,FORUM),
                (66.16,69.95,STUDIO-.20,18.0)]
    if not horizontal and abs(x-69.85)<.006:
        limits=[(14.48,18.03,STUDIO-.20,18.)]
    if horizontal and abs(y-1.235)<.005:
        limits=[(31.45,36.36,FORUM-.05,STUDIO+2.70)]
    start=x if horizontal else y;end=X if horizontal else Y
    sense=1 if end>start else -1
    out=[]
    for lo,hi,bottom,top in limits:
        p,q=sorted(((lo-start)*sense,(hi-start)*sense))
        p=max(0.,p);q=min(q,abs(end-start))
        if q>p:out.append((p,q,bottom,top))
    return out

def build_ground_enclosure(stats,draw,foot):
    def emit(layer,material,poly,bottom,top):
        if not draw or len(poly)<3:return
        points=[]
        for p in poly:
            if not points or math.dist(points[-1],p)>1e-7:points.append(p)
        if len(points)>1 and math.dist(points[0],points[-1])<1e-7:points.pop()
        if len(points)<3:return
        def height(f,u,v):return f(u,v) if callable(f) else f
        low=[(u,v,height(bottom,u,v)) for u,v in points]
        high=[(u,v,height(top,u,v)) for u,v in points]
        if max(q[2]-p[2] for p,q in zip(low,high))<.0001:return
        # At the start of a triangular spandrel the lower/upper vertices
        # coincide. Weld them before closing the prismatic solid.
        verts=[];indices=[]
        for p in low+high:
            found=next((j for j,q in enumerate(verts) if math.dist(p,q)<1e-6),None)
            if found is None:found=len(verts);verts.append(p)
            indices.append(found)
        n=len(points)
        faces=[]
        for f in [list(range(n)),list(range(n,2*n))]+[[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]:
            ids=list(dict.fromkeys(indices[i] for i in f))
            if len(ids)>=3:faces.append(ids)
        g.solid(E+layer,material,verts,faces)

    # The loaded CLT stops at the inside face of the opaque insulated fascia.
    def strip(poly,cap,material,layer,has_floor):
        cx=sum(t[0] for t in poly)/len(poly);cy=sum(t[1] for t in poly)/len(poly)
        pier=45.10-.001<cx<46.50+.001 and (cy<1.451 or cy>18.479)
        curb=poly
        if pier:
            # Concrete is already present at the bearing. The 8-mm outer
            # metal plinth cover turns down past grade and clears its face.
            if max(p[1] for p in poly)<1.265:curb=g.clip(poly,1,1.148,False)
            elif min(p[1] for p in poly)>18.737:curb=g.clip(poly,1,18.852,True)
            elif cx<45.22:curb=g.clip(poly,0,45.108,False)
            elif cx>46.38:curb=g.clip(poly,0,46.492,True)
            emit('Service plinth pier base flashing','Galvanized silver',curb,GROUND,GROUND+.34)
            skirt=g.clip(curb,1,1.45,False) if cy<5 else g.clip(curb,1,18.75,True)
            emit('Service plinth pier base flashing','Galvanized silver',skirt,lambda x,y:g.grade(x,y)-.04,GROUND)
        else:emit('Service plinth concrete curb','Board-formed concrete',poly,GROUND,GROUND+.34)
        # Rebate only the inner insulation at exactly the steel hanger
        # stations. The full, flush external weather face is uninterrupted.
        if cy>18.32 and any(abs(cx-x)<.054 for x in (49.4,53.0)):
            poly=g.clip(poly,1,18.412,True)
        light=next(((a,b) for a,b in FOYER_LIGHTS if a<cx<b),None) if cy>18.32 else None
        if light:
            sill,head=GROUND+.93,GROUND+2.27
            emit(layer,material,poly,GROUND+.34,sill);emit(layer,material,poly,head,cap)
            a,b=light;frames='Public foyer thermally broken frames'
            if a+.044<cx<b-.044:
                emit(frames,'Dark reveal',poly,sill,sill+.05);emit(frames,'Dark reveal',poly,head-.05,head)
                glass=g.clip(g.clip(poly,1,18.405,True),1,18.437,False)
                emit('Vision lights in recessed frames','Vision glass',glass,sill+.05,head-.05)
                area=(max(p[0] for p in poly)-min(p[0] for p in poly))*(head-sill-.10)
                stats['vision_m2']+=area;stats['south_glass_m2']+=area
                stats['south_sample_vision_m2']+=area
            else:emit(frames,'Dark reveal',poly,sill,head)
            return
        if not has_floor:
            emit(layer,material,poly,GROUND+.34,cap);return
        emit(layer,material,poly,GROUND+.34,lambda x,y:min(cap(x,y),FORUM-.24))
        if min(cap(x,y) for x,y in poly)>=FORUM-.24-.00001:
            emit('Service plinth insulated slab edge','Galvanized silver',poly,FORUM-.24,lambda x,y:min(cap(x,y),FORUM))
        if min(cap(x,y) for x,y in poly)>=FORUM-.00001:
            emit(layer,material,poly,FORUM,cap)

    def ribbon(path):
        dirs=[];norm=[]
        for p,q in zip(path,path[1:]):
            dx=q[0]-p[0];dy=q[1]-p[1];l=math.hypot(dx,dy)
            dirs.append((dx/l,dy/l));norm.append((-dy/l,dx/l))
        inside=[]
        for i,(x,y) in enumerate(path):
            n=norm[max(0,i-1)]
            m=norm[min(i,len(norm)-1)]
            nx,ny=n if n==m else (n[0]+m[0],n[1]+m[1])
            inside.append((x+THICK*nx,y+THICK*ny))
        cap=lambda x,y:foot(x)
        for i,(a,b) in enumerate(zip(path,path[1:])):
            u,v=dirs[i];horizontal=abs(u)>.5
            direction=('north' if u>0 else 'south') if horizontal else ('east' if v>0 else 'west')
            length=math.dist(a,b)
            if horizontal:
                knots=sorted({a[0],b[0],*[x for x in (45.8,) if min(a[0],b[0])<x<max(a[0],b[0])]})
                area=sum((r-l)*(.5*(foot(l)+foot(r))-GROUND) for l,r in zip(knots,knots[1:]))
            else:area=length*(foot(a[0])-GROUND)
            stats['gross_wall_m2']+=area;stats[direction+'_gross_m2']+=area
            raw=[a,b,inside[i+1],inside[i]]
            # Rows of real butt-jointed front panels terminate at the folded
            # soffit, the floor line and every change of perimeter direction.
            axis=0 if horizontal else 1
            small=min(p[axis] for p in raw);large=max(p[axis] for p in raw)
            origin=min(a[axis],b[axis]);count=max(1,round(length/1.20))
            cuts={small,large}
            for n in range(1,count):
                t=origin+length*n/count
                cuts.update((t-.008,t+.008))
            # Cut both faces at the slope kink, at each horizontal floor
            # datum crossing, and at the stepped end of the L2 slab.
            stations=(45.8,45.8+(FORUM-.24-foot(45.8))*10.8/1.70,
                      45.8+(FORUM-foot(45.8))*10.8/1.70,56.65)
            if horizontal and a[1]>18.32:
                cuts.update(q for a0,b0 in FOYER_LIGHTS for q in (a0,a0+.045,b0-.045,b0) if small<q<large)
                cuts.update(q for x in (49.4,53.) for q in (x-.054,x+.054) if small<q<large)
            if horizontal:cuts.update(q for q in stations if small<q<large)
            pieces=[]
            for l,r in zip(sorted(cuts),sorted(cuts)[1:]):
                if r-l<=.0001:continue
                shape=g.clip(g.clip(raw,axis,l,True),axis,r,False)
                if len(shape)>=3:pieces.append((shape,r-l<.017))
            # Orthogonal returns can also span a floor boundary in the other
            # direction. Keep the exact floor projection in both coordinates.
            for poly,seam in pieces:
                split=[poly]
                for ax,value in [(0,q) for q in stations]+[(1,17.855)]:
                    split=[s for p in split for s in
                           ([g.clip(p,ax,value,False),g.clip(p,ax,value,True)]
                            if min(t[ax] for t in p)<value-1e-7<value+1e-7<max(t[ax] for t in p) else [p])]
                for p in split:
                    x=sum(q[0] for q in p)/len(p);y=sum(q[1] for q in p)/len(p)
                    has_floor=x<=56.65 or y<17.855
                    strip(p,cap,'Dark reveal' if seam else 'Galvanized silver',
                          'Service plinth sealed joints' if seam else 'Service plinth insulated cassettes',has_floor)
    for line in (NORTH,SOUTH):ribbon(line)
    # The west stair landing exits to the south. Its west face fronts the
    # sheltered outside terrace below the folded belly only at ground level.
    poly=g.rect(14.,1.86,14.12,4.74)
    emit('West stair insulated end wall','Board-formed concrete',poly,GROUND,lambda x,y:foot(x))
    area=2.88*(foot(14.)-GROUND)
    stats['gross_wall_m2']+=area;stats['west_gross_m2']+=area
    if draw:
        # A partial-depth screen turns the route into each family WC away
        # from the fixture. Their doors can remain open to the public lobby.
        for x,X,y in [(57.08,58.65,15.61),(63.05,64.74,15.89)]:
            g.box('Interior / Partitions and doors','Oiled birch',x,y,GROUND,X,y+.08,GROUND+2.28)
        # The last stall in each public bank needs a solid outside cheek in
        # addition to the existing internal cubicle divisions.
        for y in (1.72,7.04):
            g.box('Interior / Partitions and doors','Galvanized silver',50.40,y+.06,GROUND+.16,
                  50.45,y+1.60,GROUND+2.04)
