"""Test fixed weather profiles against actual open and closed browser door geometry."""
import argparse
import json
import subprocess
from itertools import product
from pathlib import Path

import numpy as np

from apertures import Framing
from check_apertures import door_clearances, solid_overlap
from check_envelope import read_parts
from check_gallery import bounds, candidates
from exterior_portals import FRAME, GLAZING, PANEL
from shell_skin import G, L2, L3, wall_foot


def leaf_meshes(doors, step):
    polys=[]
    for door in doors:
        for leaf in door['leaves']:
            m=np.asarray(leaf['poses'][step])
            for x,y,z,X,Y,Z in leaf['boxes']:
                plan=np.array([[a,b,1.] for a,b in product((x,X),(z,Z))])@m[:6].reshape(2,3).T
                polys.append(np.array([[u,v,h+m[6]] for u,v in plan for h in (y,Y)]))
    return polys


def runs(points, occupied):
    """Clear intervals across one horizontal line of a portal section."""
    free=np.flatnonzero(~occupied)
    if not len(free):return []
    groups=np.split(free,np.flatnonzero(np.diff(free)>1)+1)
    step=points[1]-points[0]
    return [(points[g[0]]-step/2,points[g[-1]]+step/2) for g in groups]


def occupied_at(shapes,x,height):
    mask=np.zeros_like(x,dtype=bool)
    for poly in shapes:
        crossing=[]
        for (a,z),(b,Z) in zip(poly,poly[1:]+poly[:1]):
            if (z<=height<Z) or (Z<=height<z):
                crossing.append(a+(b-a)*(height-z)/(Z-z))
        if crossing:
            mask|=(min(crossing)-.00001<=x)&(x<=max(crossing)+.00001)
    return mask


def audit(path):
    helper=Path(__file__).with_name('door_sweep_geometry.mjs')
    doors=json.loads(subprocess.check_output(['node',str(helper),str(path)],text=True))
    all_parts=[p for p,*_ in read_parts(path,True,all_layers=True)]
    fixed=[p for p in all_parts if p.layer in (FRAME,GLAZING,PANEL)]
    structure=[p for p in all_parts if p.layer.startswith('Structure / ')]
    mins,maxs=bounds(structure)
    for panel in fixed:
        for i in candidates(panel,mins,maxs):
            if solid_overlap(panel.v,structure[i],.002):
                raise ValueError(f'{panel.layer} #{panel.serial} penetrates {structure[i].layer} #{structure[i].serial}')
    sweep=door_clearances(path,fixed,np.array([p.lo for p in fixed]),np.array([p.hi for p in fixed]),.001)
    if sweep['door_pairs']:raise ValueError(f'Swing into fixed portal construction: {sweep["door_pairs"]}')

    # Include interior returns and the original shell: west hall doors and the
    # north promenade are recessed from their outer wall by different depths.
    fixed_vertices=[p.v for p in all_parts if not
                    (p.layer=='Interior / Partitions and doors' and p.material=='Vision glass'
                     and abs(p.lo[1]-18.23)<.001 and abs(p.hi[1]-18.96)<.001)]
    closed=Framing(fixed_vertices+leaf_meshes(doors,0))
    opened=Framing(fixed_vertices+leaf_meshes(doors,-1))
    openings=[
        ('west hall north',1,13.8,5.05,6.55,G,wall_foot(14.04)),
        ('west hall south',1,13.8,15.60,17.20,G,wall_foot(14.04)),
        ('north hall west',0,3.65,22.30,24.45,G,5.37),
        ('north hall east',0,3.65,36.40,38.20,G,5.37),
        ('south hall west',0,18.23,15.95,22.15,G,wall_foot),
        ('south hall east',0,18.23,29.30,35.5,G,wall_foot),
        ('south entrance',0,17.94,60.08,62.48,G,G+2.50),
        ('east café',1,69.85,9.18,11.15,G,G+2.65),
        ('upper gallery',0,17.94,64.10,65.90,L2,L2+2.45),
        ('upper promenade',0,3.09,46.35,47.55,L3,L3+2.40),
        ('north court',0,6.90,46.34,47.83,L2,L2+2.35),
        ('east court',1,47.95,10.75,12.65,L2,L2+2.35)]
    measurements={}
    for name,axis,plane,a,b,floor,head in openings:
        lo,hi=((a,plane),(b,plane)) if axis==0 else ((plane,a),(plane,b))
        height=lambda u:head(a+u) if callable(head) else head
        points=np.arange(.005,b-a,.01)
        max_z=max(height(u) for u in points)
        boundary=np.array([height(u) for u in points])
        fixed_closed=closed.profiles(lo,hi,.092,floor-.01,max_z+.01)
        # A 40 mm probe detects an unclosed joint between the leaf and its
        # weather rebate. Leave only the floor undercut out of the search.
        largest=0.
        for z in np.arange(floor+.019,max_z-.01,.023):
            block=occupied_at(fixed_closed,points,z)|(z>=boundary-.004)
            largest=max(largest,max((r-l for l,r in runs(points,block)),default=0))
        if largest>.0401:raise ValueError(f'{name}: continuous closed joint {(1000*largest):.0f} mm')
        fixed_open=opened.profiles(lo,hi,.092,floor+.09,floor+2.01)
        through=np.zeros_like(points,dtype=bool)
        for z in (floor+.12,floor+1.01,floor+1.97):
            through|=occupied_at(fixed_open,points,z)
        clear=max((r-l for l,r in runs(points,through)),default=0)
        if clear<.81:raise ValueError(f'{name}: physically clear open interval {clear:.3f} m')
        measurements[name]=dict(largest_closed_joint_m=round(largest,3),largest_open_interval_m=round(clear,3))
    return dict(doors_swept=sweep['doors_tested'],moving_leaves=sweep['leaves_tested'],
                sweep_increment_deg=sweep['angle_increment_deg'],exterior_sections=measurements)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('glb',type=Path)
    print(json.dumps(audit(p.parse_args().glb),indent=2))
