"""Fit rectangular glazing and its rebate between the actual fabricated members.

All distances are metres. A vertical light reserves a 600 mm unobstructed
reveal on both sides of the glass. Projecting only the portion of a member
inside that zone permits real diagonal trusses to remain in the building.
"""
import numpy as np

from geometry import clip, member_layer, ORIGIN_X

REVEAL = .66   # Includes the half glass thickness, subframe and erection gap.
REBATE = .035

def hull(points):
    points=sorted(set((float(x),float(y)) for x,y in points))
    if len(points)<3:return []
    def half(seq):
        result=[]
        for x,y in seq:
            while len(result)>=2:
                a,b=result[-2];c,d=result[-1]
                if (c-a)*(y-b)-(d-b)*(x-a)>1.e-9:break
                result.pop()
            result.append((x,y))
        return result
    return half(points)[:-1]+half(reversed(points))[:-1]

class Framing:
    def __init__(self,members):
        self.vertices=[]
        for member in members:
            v=np.asarray(member,dtype=float).copy()
            # Use the actual glTF coordinate precision when choosing between
            # otherwise nearly equal openings, even before the file is written.
            v[:,0]+=ORIGIN_X
            v=v.astype(np.float32).astype(float)
            v[:,0]-=ORIGIN_X
            self.vertices.append(v.round(5))
        self.lo=np.array([v.min(axis=0) for v in self.vertices])
        self.hi=np.array([v.max(axis=0) for v in self.vertices])

    @classmethod
    def from_model(cls,path):
        from check_envelope import read_parts
        return cls(p.v for p,_,_ in read_parts(path,True,all_layers=True) if member_layer(p.layer))

    def profiles(self,a,b,depth=REVEAL,minimum=-4,maximum=25):
        """Convex projected silhouettes inside a finite, axis-aligned wall reveal."""
        if not self.vertices:return []
        axis=0 if abs(a[0]-b[0])>abs(a[1]-b[1]) else 1
        cross=1-axis;plane=a[cross]
        start,end=sorted([a[axis],b[axis]])
        mask=(self.hi[:,cross]>plane-depth)&(self.lo[:,cross]<plane+depth)&(self.hi[:,axis]>start)&(self.lo[:,axis]<end)&(self.hi[:,2]>minimum)&(self.lo[:,2]<maximum)
        sign=1 if b[axis]>a[axis] else -1
        shapes=[]
        for i in np.flatnonzero(mask):
            q=self.vertices[i];off=q[:,cross]-plane
            section=list(q[(off>=-depth)&(off<=depth)])
            for cut in (-depth,depth):
                low=q[off<cut];high=q[off>cut]
                if not len(low) or not len(high):continue
                # The hull of these chord intersections is the exact plane cut
                # of the convex fabrication solid; internal chords add no extrema.
                for p in low:
                    t=(plane+cut-p[cross])/(high[:,cross]-p[cross])
                    section.extend(p+(high-p)*t[:,None])
            if section:
                points=hull(((p[axis]-a[axis])*sign,p[2]) for p in section)
                if len(points)>2:shapes.append(points)
        return shapes

def clear_opening(s,e,low,high,centre,height,profiles,minimum=(.36,.35)):
    """Choose a fabricable rectangular lite, scoring area and target eye height."""
    if e-s<minimum[0] or high-low<minimum[1]:return None
    spans=[]
    for poly in profiles:
        lo=min(u for u,z in poly);hi=max(u for u,z in poly)
        if lo>=e+REBATE or hi<=s-REBATE:continue
        if min(z for u,z in poly)>=high+REBATE or max(z for u,z in poly)<=low-REBATE:continue
        spans.append((lo,hi,poly))
    # Slot edges follow structural jambs; a small number of intermediate
    # stations allow an adequately wide light on either side of a diagonal.
    offsets=[s,e,*[s+(e-s)*i/8 for i in range(1,8)]]
    for a,b,poly in spans:
        offsets.extend(q for q in (a-REBATE,b+REBATE) if s<q<e)
    offsets=sorted(set(round(v,5) for v in offsets))
    best=None;score=0
    for i,left in enumerate(offsets):
        for right in offsets[i+1:]:
            width=right-left
            if width<minimum[0] or width*min(high-low,height)<score:continue
            blocked=[]
            for a,b,poly in spans:
                if b<=left-REBATE+1e-6 or a>=right+REBATE-1e-6:continue
                clipped=clip(clip(poly,0,left-REBATE,True),0,right+REBATE,False)
                if clipped:blocked.append((min(z for u,z in clipped)-REBATE,max(z for u,z in clipped)+REBATE))
            sill=low
            for bottom,top in sorted(blocked)+[(high,high)]:
                available=min(bottom,high)-sill
                h=min(height,available)
                if h>=minimum[1]:
                    z0=min(max(centre-h/2,sill),min(bottom,high)-h)
                    value=width*h/(1+.13*abs(z0+h/2-centre))
                    if value>score:best=(left,right,z0,z0+h);score=value
                sill=max(sill,top)
                if sill>=high:break
    return best
