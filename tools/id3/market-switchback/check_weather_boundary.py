"""Measure the occupied ground street enclosure and outdoor restroom sightlines of the exported GLB.

Requires Python with NumPy, SciPy, GDAL/OGR and VTK, plus Node for the case's
actual operating leaves. On Debian run /usr/bin/python3 check_weather_boundary.py FILE.
Distances and section stations use the registered case axes east, south, up in metres.
"""
import argparse
from dataclasses import dataclass
from hashlib import sha256
from itertools import product
import json
from pathlib import Path
import subprocess

import numpy as np
from osgeo import ogr
from scipy.spatial import ConvexHull
from vtkmodules.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
from vtkmodules.vtkCommonCore import reference, vtkPoints
from vtkmodules.vtkCommonDataModel import vtkCellArray, vtkGenericCell, vtkPolyData, vtkStaticCellLocator

from check_envelope import Part, read_parts

G, L2, L3 = 2.50, 6.4116, 10.6788
# The legacy portal/plan checks use a 40 mm probe to allow leaf movement. New
# street walls, tapered spandrels, soffits and stair-end closures are tested
# with a 2 mm probe. Areas refer to the complete measured gap.
TOL = .02


def foot(x):
    base = 6.05 + max(0., 13.4 - x) * 2.2116 / 10.8 + max(0., x - 45.8) * 1.70 / 10.8
    return base - np.interp(x, [13.4, 17.], [1.24, .58]) - .065


@dataclass
class Elevation:
    label: str
    normal: int
    at: float
    left: float
    right: float
    top: object
    bottom: object = G
    slab: float = .12

    def polygon(self):
        stations = sorted({self.left, self.right, *[x for x in (13.4, 17., 45.8) if self.left < x < self.right]})
        x = lambda s: s if self.normal == 1 else self.at
        def edge(value):
            return [(s, value(x(s)) if callable(value) else value) for s in stations]
        return poly(edge(self.bottom) + edge(self.top)[::-1])


def sections():
    # Edges of the conditioned footprint: the public porch beneath the west
    # cantilever and the arcade stay outdoors. The folded plinth steps around
    # two concrete piers. Its south and north edges return to the street annex.
    sec = [
        Elevation('west hall', 0, 13.94, 4.90, 18.32, foot, slab=.27),
        Elevation('west stair end', 0, 14., 1.70, 4.90, foot),
        Elevation('west stair north', 1, 1.78, 14., 21.4, foot),
        Elevation('west stair east return', 0, 21.32, 1.70, 3.65, foot),
        Elevation('north recessed hall', 1, 3.65, 21.4, 39.8, foot),
        Elevation('south folding hall', 1, 18.32, 14.04, 40., foot, slab=.16),
        Elevation('north hall-to-service return', 0, 39.8, 1.45, 3.65, foot),
        Elevation('south hall-to-service return', 0, 40., 18.32, 18.48, foot),
        Elevation('north main-to-annex return', 0, 57.06, 1.43, 1.45, foot),
        Elevation('south main-to-annex return', 0, 57.06, 17.94, 18.48, foot),
        Elevation('north annex', 1, 1.43, 57.06, 69.85, L2),
        Elevation('south annex', 1, 17.94, 57.06, 69.85, L2),
        Elevation('east annex', 0, 69.85, 1.43, 17.94, L2),
    ]
    for side, left, at, step in [('north', 39.8, 1.45, 1.140), ('south', 40., 18.48, 18.860)]:
        sec.extend([
            Elevation(side+' service west', 1, at, left, 45.10, foot),
            Elevation(side+' pier face', 1, step, 45.10, 46.50, foot),
            Elevation(side+' pier west cheek', 0, 45.10, min(at,step), max(at,step), foot),
            Elevation(side+' pier east cheek', 0, 46.50, min(at,step), max(at,step), foot),
            Elevation(side+' service east', 1, at, 46.50, 57.06, foot),
        ])
    return sec


def poly(points):
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x,y in [*points,points[0]]:
        ring.AddPoint_2D(float(x),float(y))
    geom = ogr.Geometry(ogr.wkbPolygon)
    geom.AddGeometry(ring)
    return geom


def parts_of(polygeom):
    if polygeom.GetGeometryName() == 'POLYGON':
        yield polygeom
    else:
        for i in range(polygeom.GetGeometryCount()):
            yield from parts_of(polygeom.GetGeometryRef(i))


def projection(part, normal, lo, hi):
    # Clip the actual solid against the two depth planes. Projection of the
    # resulting convex component gives its exact cross-elevation silhouette.
    a = part.v[:,normal]
    vertices = [part.v[(a >= lo) & (a <= hi)]]
    edges = part.v[part.faces[:,[0,1,1,2,2,0]].reshape(-1,2)]
    for d in (lo,hi):
        if min(a) < d < max(a):
            p,q=edges[:,0],edges[:,1]
            keep=(p[:,normal]-d)*(q[:,normal]-d)<0.
            p,q=p[keep],q[keep]
            vertices.append(p+(q-p)*((d-p[:,normal])/(q[:,normal]-p[:,normal]))[:,None])
    axes = [i for i in range(3) if i!=normal]
    v = np.unique(np.round(np.concatenate(vertices)[:,axes],6),axis=0)
    if len(v)<3 or np.linalg.matrix_rank(v[1:]-v[0],tol=1e-5)<2:
        return None
    hull=ConvexHull(v)
    if hull.volume<1e-8:
        return None
    return poly(v[hull.vertices].tolist())


def gaps(domain, coverage, tolerance=TOL):
    uncovered = domain if coverage.IsEmpty() else domain.Difference(coverage.UnionCascaded())
    result=[]
    for region in parts_of(uncovered):
        if region.Area()<tolerance*tolerance or region.Buffer(-tolerance,6).IsEmpty():
            continue
        result.append(dict(area_m2=round(region.Area(),4),bounds_local=[round(float(v),3) for v in region.GetEnvelope()]))
    return sorted(result,key=lambda e:-e['area_m2'])


def is_barrier(p):
    return (p.layer.startswith(('Enclosure /','Runtime /')) or
            p.layer in {'Interior / Partitions and doors','Structure / Concrete stair cores',
                        'Structure / Primary bearing pedestals', 'Structure / Public ground floor',
                        'Structure / Eastern plinth','Structure / Forum and terraces',
                        'Structure / Annex junction floor returns','Circulation / Forum vestibule sill'})


def elevation_test(elements, walls=None):
    bars = [p for p in elements if is_barrier(p)]
    result = {}
    for wall in sections() if walls is None else walls:
        domain = wall.polygon()
        coverage = ogr.Geometry(ogr.wkbMultiPolygon)
        a,s = wall.normal, 1-wall.normal
        top=domain.GetEnvelope()[3]
        for p in bars:
            if (p.hi[a]<wall.at-wall.slab or p.lo[a]>wall.at+wall.slab or p.hi[s]<wall.left or
                    p.lo[s]>wall.right or p.hi[2]<G or p.lo[2]>top):
                continue
            shape = projection(p,a,wall.at-wall.slab,wall.at+wall.slab)
            if shape is not None:
                coverage.AddGeometry(shape)
        new_wall = any(tag in wall.label for tag in ('service','pier','annex return','west stair end'))
        tolerance = .001 if new_wall else TOL
        holes = gaps(domain,coverage,tolerance)
        result[wall.label]=dict(probe_diameter_mm=2000*tolerance,area_m2=round(domain.Area(),3),missing_m2=round(sum(h['area_m2'] for h in holes),3),gaps=holes)
    return result


def plan_sections(parts):
    # Orthogonal facade projections can conceal gaps between two setback
    # planes. For each horizontal slice, flood from outdoors around the actual
    # section polygons and record whether air can reach the inboard wall face.
    envelope=[p for p in parts if is_barrier(p)]
    result=[]
    elevations=(G+.19,G+.87,G+1.58,G+2.18)
    for z in elevations:
        coverage=ogr.Geometry(ogr.wkbMultiPolygon)
        for p in envelope:
            if p.hi[2]<z or p.lo[2]>z:continue
            shape=projection(p,2,z-.00001,z+.00001)
            if shape is not None:coverage.AddGeometry(shape)
        # Operational clearance at the existing closed doors is tested by the
        # dedicated elevation test. Use its joint diameter for connectivity.
        boundary=coverage.UnionCascaded().Buffer(TOL,4)
        space=poly([(8.,-2.),(74.,-2.),(74.,22.),(8.,22.)]).Difference(boundary)
        point=ogr.Geometry(ogr.wkbPoint)
        point.AddPoint_2D(10.,0.)
        exposed=next(q for q in parts_of(space) if q.Contains(point))
        lost=[]
        probes=0
        for wall in sections():
            side=-1 if wall.label.startswith(('south','east','west stair east')) or wall.label.startswith('north pier east') else 1
            if 'pier ' in wall.label and 'cheek' in wall.label:
                side=-1 if 'east cheek' in wall.label else 1
            # The north hall setback has occupied space to the east of its
            # return; the south main-to-annex return has occupied space west.
            if wall.label in ('south hall-to-service return','north main-to-annex return'):side=1
            for s in np.linspace(wall.left,wall.right,max(2,int((wall.right-wall.left)/.30)+1)):
                inset=min(.025,(wall.right-wall.left)/4)
                s=np.clip(s,wall.left+inset,wall.right-inset)
                pair=(wall.at+side*.265,s)
                x,y=pair if wall.normal==0 else pair[::-1]
                point=ogr.Geometry(ogr.wkbPoint)
                point.AddPoint_2D(x,y)
                probes+=1
                if exposed.Contains(point):
                    lost.append((wall.label,round(x,3),round(y,3)))
        result.append(dict(z=z,probes=probes,outdoor_connected=len(lost),examples=lost[:8]))
    return result


def corner_sections(parts):
    # A wall can appear continuous in two projected elevations while air can
    # still turn through a disconnected butt joint. Test the actual horizontal
    # polygons in a 640 mm square centred on each return. Local end limits avoid
    # accidentally following an unrelated distant door with an operating joint.
    paths = [
        [(38.8,3.65),(39.8,3.65),(39.8,1.45),(45.10,1.45),(45.10,1.14),
         (46.50,1.14),(46.50,1.45),(57.06,1.45),(57.06,1.43),(58.06,1.43)],
        [(58.06,17.94),(57.06,17.94),(57.06,18.48),(46.50,18.48),(46.50,18.86),
         (45.10,18.86),(45.10,18.48),(40.,18.48),(40.,18.32),(39.,18.32)],
        [(13.94,6.0),(13.94,4.90),(14.,4.90),(14.,1.70),(21.4,1.70),(21.4,3.65),(22.4,3.65)]
    ]
    members=[p for p in parts if is_barrier(p) or p.layer=='Structure / Glulam posts']
    tested=0
    lost=[]
    for path in paths:
        for a,q,b in zip(path,path[1:],path[2:]):
            q=np.array(q)
            tangent=lambda s:s/np.linalg.norm(s)
            u=tangent(q-a)+tangent(b-q)
            normal=tangent(np.array([-u[1],u[0]]))
            samples=(q-.24*normal,q+.24*normal)
            nearby=[p for p in members if np.all(p.lo[:2]<q+.32) and np.all(p.hi[:2]>q-.32)]
            region=poly((q+np.asarray([[-.32,-.32],[.32,-.32],[.32,.32],[-.32,.32]])).tolist())
            for z in (G+.015,G+.26,G+1.28,G+2.02,foot(q[0])-.09,foot(q[0])-.006):
                cover=ogr.Geometry(ogr.wkbMultiPolygon)
                for p in nearby:
                    if p.hi[2]>=z and p.lo[2]<=z:
                        shape=projection(p,2,z-.00001,z+.00001)
                        if shape is not None:cover.AddGeometry(shape)
                outside=region if cover.IsEmpty() else region.Difference(cover.UnionCascaded().Buffer(.001,8))
                points=[]
                for x,y in samples:
                    point=ogr.Geometry(ogr.wkbPoint)
                    point.AddPoint_2D(x,y)
                    points.append(point)
                tested+=1
                if any(all(piece.Contains(p) for p in points) for piece in parts_of(outside)):
                    lost.append([float(q[0]),float(q[1]),round(float(z),3)])
    return dict(radius_m=.32,probe_diameter_mm=2,sections=tested,unsealed=lost)


def fold_test(parts):
    # Flatten each straight sloping run into (east, south, height relative to
    # the lower skin). A rain joint is geometrically sealed if any actual
    # weather sheet, gasket or full-depth bearing closes that vertical ray.
    result={}
    for a,b in zip((39.8,40.,45.10,45.8,46.50),(40.,45.10,45.8,46.50,57.06)):
        slope=(foot(b)-foot(a))/(b-a)
        c=foot(a)-slope*a
        for side in ('north','south'):
            pier=45.10<(a+b)/2<46.50
            y,Y = (sorted((1.294,1.140 if pier else 1.45)) if side=='north' else
                   (18.860 if pier else (18.32 if a<40. else 18.48),18.875))
            domain=poly([(a,y),(b,y),(b,Y),(a,Y)])
            cover=ogr.Geometry(ogr.wkbMultiPolygon)
            for part in parts:
                if not (is_barrier(part) or part.layer in {'Structure / Glulam posts',
                        'Structure / Gallery timber connection plates','Structure / Gallery cantilever arms'}):
                    continue
                if part.hi[0]<a or part.lo[0]>b or part.hi[1]<y or part.lo[1]>Y:
                    continue
                if part.hi[2]<min(foot(a),foot(b))-.19 or part.lo[2]>max(foot(a),foot(b))+.02:
                    continue
                vertices=part.v.copy()
                vertices[:,2]-=slope*vertices[:,0]+c
                if vertices[:,2].max()<-.19 or vertices[:,2].min()>.02:
                    continue
                q=Part(part.layer,part.material,part.serial,vertices,part.faces)
                shape=projection(q,2,-.19,.02)
                if shape is not None:cover.AddGeometry(shape)
            holes=gaps(domain,cover,.001)
            result[f'{side} {a:.2f}–{b:.2f}']=dict(area_m2=round(domain.Area(),4),
                        missing_m2=round(sum(h['area_m2'] for h in holes),4),gaps=holes)
    return result


def posed_leaves(items, state):
    for door in items:
        for leaf in door['leaves']:
            pose=np.array(leaf['poses'][state])
            m=pose[:6].reshape(2,3)
            for ix,(x,y,z,X,Y,Z) in enumerate(leaf['boxes']):
                xy=np.array([[x,z,1],[X,z,1],[X,Z,1],[x,Z,1]])@m.T
                v=np.concatenate([np.column_stack([xy,np.full(4,h+pose[6])]) for h in (y,Y)])
                yield Part('Runtime / '+door['label'],'Door panel',ix,v,ConvexHull(v).simplices)


def open_routes(elements):
    # Find the widest continuous opening of at least 2.0 m height. Project
    # every obstacle (including a handle) into the registered rough opening
    # from 40 mm above the sill to 2 m above the walking finish.
    routes=[('west hall north',0,13.90,5.05,6.55,G),('west hall south',0,13.90,15.60,17.20,G),
            ('north hall west',1,3.65,22.30,24.45,G),('north hall east',1,3.65,36.40,38.20,G),
            ('south hall west',1,18.23,15.95,22.15,G),('south hall east',1,18.23,29.3,35.5,G),
            ('south annex',1,17.94,60.08,62.48,G),('east café',0,69.85,9.18,11.15,G),
            ('upper gallery',1,17.94,64.10,65.90,L2),('upper promenade',1,3.09,46.35,47.55,L3),
            ('north courtyard',1,6.90,46.34,47.83,L2),('east courtyard',0,47.95,10.75,12.65,L2)]
    mask=[p for p in elements if is_barrier(p) or p.layer.startswith('Structure /')]
    out={}
    for name,a,at,l,r,z in routes:
        width=r-l
        domain=poly([(l,z+.04),(r,z+.04),(r,z+2.),(l,z+2.)])
        along=1-a
        blocked=[]
        for p in mask:
            if (p.lo[a]>at+.15 or p.hi[a]<at-.15 or p.lo[along]>=r or p.hi[along]<=l
                    or p.lo[2]>=z+2. or p.hi[2]<=z+.04):continue
            shape=projection(p,a,at-.15,at+.15)
            if shape is None:continue
            clip=domain.Intersection(shape)
            if not clip.IsEmpty() and clip.GetDimension()==2 and clip.Area()>1.e-6:
                blocked.append(clip.GetEnvelope()[:2])
        cursor=l
        runs=[]
        for s,S in sorted(blocked):
            if s>cursor:runs.append((cursor,s))
            cursor=max(cursor,S)
        if r>cursor:runs.append((cursor,r))
        best=max((b-a for a,b in runs),default=0.)
        out[name]=dict(clear_width_m=round(best,3),opening_width_m=round(width,3))
    return out


def opaque_locator(parts):
    # All runtime doors are held out of the visibility calculation, which
    # also covers permanently open door leaves. Do not credit glass, loose
    # furniture, timber framing or fittings with shielding a toilet.
    solids=[p for p in parts if 'glass' not in p.material.lower() and
            (p.layer.startswith('Enclosure /') or p.layer=='Interior / Partitions and doors'
             or p.layer in {'Structure / Concrete stair cores','Structure / Public ground floor',
                'Structure / Forum and terraces','Structure / Studios and bridges','Structure / Eastern plinth','Structure / Forum and terraces',
                        'Structure / Annex junction floor returns','Circulation / Forum vestibule sill'})]
    triangles=np.concatenate([p.v[p.faces] for p in solids])
    points=vtkPoints()
    points.SetData(numpy_to_vtk(np.ascontiguousarray(triangles.reshape(-1,3)),deep=True))
    cells=vtkCellArray()
    bounds=np.arange(0,triangles.size//3+1,3,dtype='int64')
    ids=np.arange(triangles.size//3,dtype='int64')
    cells.SetData(numpy_to_vtkIdTypeArray(bounds,deep=True),numpy_to_vtkIdTypeArray(ids,deep=True))
    mesh=vtkPolyData()
    mesh.SetPoints(points)
    mesh.SetPolys(cells)
    loc=vtkStaticCellLocator()
    loc.SetDataSet(mesh)
    loc.BuildLocator()
    return loc


def observers():
    # Four street elevations include ground-level and elevated views. Also use
    # real outdoor promenades, the forum bridge and both sides of the sky court.
    eyes=set()
    for z in (.9,1.55,2.1,3.55,4.15,7.6,8.06,11.88,12.33,13.6):
        for x in np.arange(2.,70.16,.5):
            eyes.update(((x,-.6,z),(x,20.,z)))
        for y in np.arange(1.,19.,.5):
            eyes.update(((.6,y,z),(71.,y,z)))
    for h in (1.12,1.65):
        for x in np.arange(2.25,47.45,.5):
            eyes.add((x,.54,L3-(46.90-x)*.04+h))
            eyes.add((x,19.88,L2+(47.45-x)*.04+h))
        for x in np.arange(40.05,47.85,.35):
            for y in (7.12,16.68):
                eyes.add((x,y,L2+h))
        for y in np.arange(7.10,16.85,.35):
            for x in (40.09,47.70):
                eyes.add((x,y,L2+h))
        for x in np.arange(47.65,66.,.5):
            eyes.add((x,21.2,L2+h))
    return sorted(eyes)


def privacy(parts):
    fixtures=[p for p in parts if p.layer=='Interior / Loose furniture' and p.material=='Chalk' and
              any(abs((p.hi-p.lo)[2]-v)<.001 for v in (.45,.51)) and
              any(abs(p.lo[2]-z)<.001 for z in (G,L3))]
    if len(fixtures)!=10:
        raise ValueError(f'Expected 10 actual toilet fixture boxes, found {len(fixtures)}')
    loc=opaque_locator(parts)
    t,id_,sub=reference(.0),reference(0),reference(0)
    hit,coords,cell=[0.]*3,[0.]*3,vtkGenericCell()
    eyes=observers()
    sample_count=0
    result=[]
    for p in fixtures:
        # Rim and occupied positions; include both front corners of each rim.
        targets=[(*p.center[:2],p.lo[2]+h) for h in (.45,.9,1.2,1.60)]
        targets.extend((x,y,p.hi[2]) for x,y in product(*zip(p.lo[:2]+.015,p.hi[:2]-.015)))
        bad=0
        example=None
        for target in targets:
            for eye in eyes:
                sample_count+=1
                if not loc.IntersectWithLine(target,eye,1.e-5,t,hit,coords,sub,id_,cell):
                    bad+=1
                    if example is None:
                        example={'eye':np.round(eye,3).tolist(),'target':np.round(target,3).tolist()}
        result.append({'fixture':np.round(p.center,3).tolist(),'sightlines':bad,'example':example})
    return dict(fixtures=len(fixtures),exterior_observers=len(eyes),rays=sample_count,
                exposed_fixtures=sum(bool(f['sightlines']) for f in result),results=result)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('model',type=Path)
    ap.add_argument('--report',type=Path)
    args=ap.parse_args()
    parts=[p for p,_,_ in read_parts(args.model,True,all_layers=True)]
    items=json.loads(subprocess.check_output(['node',str(Path(__file__).with_name('door_sweep_geometry.mjs')),str(args.model)]))
    closed=[*parts,*posed_leaves(items,0)]
    opened=[*parts,*posed_leaves(items,-1)]
    clear_widths=open_routes(opened)
    start=45.8+(L2-foot(45.8))*10.8/1.70
    wedges=elevation_test(closed,[Elevation(k+' tapered service spandrel',1,at,start,57.06,foot,L2)
                                  for k,at in (('north',1.45),('south',18.48))])
    weather=elevation_test(closed)
    plans=plan_sections(closed)
    folds=fold_test(parts)
    corners=corner_sections(closed)
    result=dict(model_sha256=sha256(args.model.read_bytes()).hexdigest(),joint_diameter_m=2*TOL,
                elevations=weather,tapered_spandrels=wedges,soffit_folds=folds,
                plan_continuity=plans,local_corners=corners,open_entrances=clear_widths,privacy=privacy(parts))
    if args.report:
        args.report.write_text(json.dumps(result,indent=2)+'\n')
    print('Closed-position elevation outlines:',len(weather),' Uncovered area (m²):',
          round(sum(v['missing_m2'] for v in weather.values()),3))
    print('Interior probes connected outdoors:',sum(v['outdoor_connected'] for v in plans),'/',sum(v['probes'] for v in plans))
    print('Local corner sections with an open path:',len(corners['unsealed']),'/',corners['sections'])
    print('Missing soffit return projection (m²):', round(sum(v['missing_m2'] for v in folds.values()),4))
    print('Toilets exposed to one or more outdoor viewpoints:',result['privacy']['exposed_fixtures'],
          '/',result['privacy']['fixtures'],'   Sight rays:',result['privacy']['rays'])
    for k,v in weather.items():
        if v['gaps']:print(k,v['missing_m2'],v['gaps'][:3])
    missing = any(v['gaps'] for v in [*weather.values(),*wedges.values(),*folds.values()])
    obstructed = any(v['clear_width_m']<.8 for v in clear_widths.values())
    leaking = any(v['outdoor_connected'] for v in plans)
    return int(missing or obstructed or leaking or bool(corners['unsealed']) or bool(result['privacy']['exposed_fixtures']))


if __name__=='__main__':
    raise SystemExit(main())
