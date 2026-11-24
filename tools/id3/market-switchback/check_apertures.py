"""Check built window and vent apertures against actual structural parts in the case GLB.

The glazing polygon is taken from the broad face of the exported convex solid.
A 2 mm perimeter tolerance excludes contacts at panel edges. Intrusions into
the pane, and structure in the adjacent clear opening, are reported separately.
The door check uses the runtime geometry for every panel and handle. Each pair
of poses bounds a short swept segment; the outer-edge chord error is below
0.5 mm for a 2.25-degree swing with a 2.2 m radius. Sashes use intervals of
at most 2 degrees about the measured hinge. Coordinates use the case design
grid (east, south, up), in metres.
"""
import argparse
from collections import Counter
from hashlib import sha256
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull

from check_envelope import extrema, read_parts


def main_face(part):
    triangles = part.v[part.faces]
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normal = normals[np.linalg.norm(normals, axis=1).argmax()]
    normal /= np.linalg.norm(normal)
    if normal[np.argmax(np.abs(normal))] < 0:
        normal *= -1
    distance = part.v @ normal
    point = part.v[np.argmax(distance)]
    width_axis = np.cross(normal, [0,0,1] if abs(normal[2]) < .85 else [1,0,0])
    width_axis /= np.linalg.norm(width_axis)
    basis = np.array([width_axis, np.cross(normal, width_axis)])
    # The outer solid's thin edge occasionally slopes (e.g. sealed rooflights).
    face_vertices = part.v[abs(distance - normal @ point) < 3e-5]
    outline = ConvexHull(face_vertices @ basis.T).equations
    edges = np.column_stack((outline[:, :2] @ basis, outline[:, 2]))
    return normal, distance.min(), distance.max(), edges


def portal_prism(leaves):
    """Unoccupied threshold between the closed jambs, 100 mm each side."""
    spans = []
    for leaf in leaves:
        basis = np.asarray(leaf['poses'][0])
        transform = basis[:6].reshape(2, 3)
        for x, y, z, X, Y, Z in leaf['boxes']:
            plan = np.array([[x, z, 1], [x, Z, 1], [X, Z, 1], [X, z, 1]]) @ transform.T
            for height in (y, Y):
                spans.append(np.column_stack([plan, np.full(len(plan), height + basis[6])]))
    cloud = np.concatenate(spans)
    lo, hi = cloud.min(axis=0), cloud.max(axis=0)
    axis = int(np.argmin(hi[:2] - lo[:2]))
    center = .5 * (hi[axis] + lo[axis])
    lo[axis], hi[axis] = center - .10, center + .10
    from itertools import product
    return np.array(list(product(*zip(lo, hi))))


def door_clearances(model, structure, mins, maxs, tol):
    """Sweep each modeled component, including door handles and folding panels."""
    helper = Path(__file__).with_name('door_sweep_geometry.mjs')
    raw = subprocess.check_output(['node', str(helper), str(model)], text=True)
    doors = json.loads(raw)
    conflicts = {}
    portal_conflicts = []
    leaf_count = 0
    for door in doors:
        portal = portal_prism(door['leaves'])
        matches = np.all((mins < portal.max(axis=0)-tol) & (maxs > portal.min(axis=0)+tol),axis=1)
        for i in np.flatnonzero(matches):
            member = structure[i]
            if solid_overlap(portal, member, tol):
                portal_conflicts.append({'door': door['id'], 'label': door['label'],
                                         'member_layer': member.layer, 'member': member.serial})
        for leaf_index, leaf in enumerate(door['leaves']):
            leaf_count += 1
            bases = np.array(leaf['poses'])
            transforms = bases[:, :6].reshape(-1, 2, 3)
            for index, (x, y, z, X, Y, Z) in enumerate(leaf['boxes']):
                corners = np.array([[x, z, 1], [x, Z, 1], [X, Z, 1], [X, z, 1]])
                xy = (transforms @ corners.T).transpose(0, 2, 1)
                bottom, top = bases[0, 6] + y, bases[0, 6] + Y
                overlaps = (maxs[:, 2] > bottom + tol) & (mins[:, 2] < top - tol)
                overlaps &= np.all((mins[:, :2] < xy.max(axis=(0, 1))) &
                                   (maxs[:, :2] > xy.min(axis=(0, 1))), axis=1)
                for i in np.flatnonzero(overlaps):
                    member = structure[i]
                    key = (door['id'], leaf_index, i)
                    if key in conflicts:
                        continue
                    for step, (start, end) in enumerate(zip(xy, xy[1:])):
                        outline = np.concatenate([start, end])
                        if (np.any(outline.max(axis=0) <= member.lo[:2] + tol)
                                or np.any(outline.min(axis=0) >= member.hi[:2] - tol)):
                            continue
                        sweep = np.concatenate([np.column_stack([outline, np.full(len(outline), h)])
                                                for h in (bottom, top)])
                        if solid_overlap(sweep, member, tol):
                            conflicts[key] = {
                                'door': door['id'], 'label': door['label'], 'leaf': leaf_index,
                                'component': index, 'swing_from_deg': round(90 * step / (len(xy)-1), 1),
                                'member_layer': member.layer, 'member': member.serial,
                                'member_center': np.round(member.center, 3).tolist(),
                            }
                            break
    if not doors or not leaf_count:
        raise ValueError('No operable Market Crossing doors were instantiated')
    return {'doors_tested': len(doors), 'leaves_tested': leaf_count,
            'angle_increment_deg': 90 / (len(bases)-1), 'door_pairs': list(conflicts.values()),
            'threshold_depth_m': .20, 'threshold_pairs': portal_conflicts}


def unique_axes(vectors):
    lengths=np.linalg.norm(vectors,axis=1)
    rows=vectors[lengths>1e-8]/lengths[lengths>1e-8,None]
    if not len(rows):
        return np.empty((0,3))
    sign=np.sign(rows[np.arange(len(rows)),np.abs(rows).argmax(axis=1)])
    return np.unique(np.round(rows*sign[:,None],8),axis=0)


def hull_axes(vertices):
    hull=ConvexHull(vertices)
    triangles=vertices[hull.simplices]
    normals=unique_axes(hull.equations[:,:3])
    edges=unique_axes((np.roll(triangles,-1,axis=1)-triangles).reshape(-1,3))
    return normals,edges


def solid_overlap(test,member,tol):
    """3D separating-axis test on actual convex member and swept sash piece."""
    if np.any(test.max(axis=0)<=member.lo+tol) or np.any(test.min(axis=0)>=member.hi-tol):
        return False
    n1,e1=hull_axes(test)
    if not hasattr(member,'separation_axes'):
        member.separation_axes=hull_axes(member.v)
    n2,e2=member.separation_axes
    edges=unique_axes(np.cross(e1[:,None,:],e2[None,:,:]).reshape(-1,3))
    axes=np.concatenate([n1,n2,edges])
    p=test@axes.T;q=member.v@axes.T
    return np.all(np.minimum(p.max(axis=0),q.max(axis=0))-np.maximum(p.min(axis=0),q.min(axis=0))>tol)


def sash_sweep(pane, normal, members, mins, maxs, tol):
    # Tilted northlights have a top hinge parallel to their head rail.
    # Retain any actual head fall along x when returning a sash to vertical.
    if abs(normal[2])<.035 or abs(normal[1])<.70:
        return None
    ends=[]
    for x in (pane.lo[0],pane.hi[0]):
        side=pane.v[abs(pane.v[:,0]-x)<.0001]
        ends.append(side[side[:,2]>side[:,2].max()-.002].mean(axis=0))
    origin=ends[0]
    axis=ends[1]-origin;axis/=np.linalg.norm(axis)
    target=np.array([-axis[1],axis[0],0.]);target/=np.linalg.norm(target)
    if normal@target<0:normal=-normal
    angle=np.arctan2(axis@np.cross(normal,target),normal@target)
    rel=pane.v-origin
    # Max 2° per interval. The arc-to-chord deviation is below 0.2 mm at 1 m radius.
    count=max(1,int(np.ceil(abs(np.rad2deg(angle))/2)))
    poses=[]
    for theta in np.linspace(0.,angle,count+1):
        poses.append(origin+rel*np.cos(theta)+np.cross(axis,rel)*np.sin(theta)+
                     np.outer(rel@axis,axis)*(1.-np.cos(theta)))
    bounds=np.concatenate(poses)
    candidates=np.flatnonzero(np.all((mins<bounds.max(axis=0)-tol)&(maxs>bounds.min(axis=0)+tol),axis=1))
    collisions=[]
    for i in candidates:
        for step, (a,b) in enumerate(zip(poses,poses[1:])):
            if solid_overlap(np.concatenate([a,b]),members[i],tol):
                collisions.append({'pane_layer':pane.layer,'pane':pane.serial,'center':np.round(pane.center,3).tolist(),
                                    'member_layer':members[i].layer,'member':members[i].serial,
                                    'from_open_deg':round(step*abs(np.rad2deg(angle))/count,2)})
                break
    return collisions


def test(model, tol=.002, facade_clearance=.60, roof_clearance=.32):
    parts=[p for p,_,_ in read_parts(model,True,all_layers=True)]
    # Structural supports can also be assigned to Enclosure in the gallery.
    backing = {'Glulam secondary girts', 'Inboard girt seats', 'Girt anchorage plates',
               'Girt anchorage bolts', 'Monitor hinge headers', 'Monitor header shoes',
               'Monitor header fasteners', 'Rooflight glazing rails', 'Rooflight bearing stools',
               'Rooflight bearing runners', 'Northlight curb anchors', 'Northlight head channels',
               'Northlight sill channels', 'Northlight sill returns'}
    structure = [p for p in parts if p.layer.startswith('Structure /') or
                 p.layer.rsplit(' / ', 1)[-1] in backing or
                 'glulam' in p.material.lower() or 'clt' in p.material.lower()]
    panes=[p for p in parts if 'glass' in p.material.lower()]
    mins=np.array([p.lo for p in structure]); maxs=np.array([p.hi for p in structure])
    if not structure or not panes:
        raise ValueError('Expected both the structural frame and modeled glazing')
    checked=Counter()
    hits=[];sash_hits=[];sash_count=0
    for pane in panes:
        normal,inner,outer,edge=main_face(pane)
        roof=abs(normal[2])>.66
        if roof:
            # The case rooflights are vertical extrusions of their sloping tops.
            # Project their exact polygon vertically when checking headroom below.
            outline=ConvexHull(pane.v[:,:2]).equations
            edge=np.column_stack([outline[:,:2],np.zeros(len(outline)),outline[:,2]])
        edge[:,3]+=tol
        interior=pane.layer.startswith('Interior /')
        vent='vent' in pane.layer.lower() or 'sash' in pane.layer.lower()
        if vent:
            sweep=sash_sweep(pane,normal,structure,mins,maxs,tol)
            if sweep is not None:
                sash_count+=1;sash_hits.extend(sweep)
        # Physical contact is tested for every pane. The clear sight/opening
        # zone also includes 600 mm either side of a vertical exterior pane or
        # the first 320 mm vertically below a rooflight (its support zone).
        # Interior fixed transoms have no user-defined view-depth requirement.
        near=0 if interior or vent else roof_clearance*abs(normal[2]) if roof else facade_clearance
        low=inner-near
        high=outer if roof else outer+near
        pad=np.array([0,0,roof_clearance]) if roof else abs(normal)*near
        candidates=np.flatnonzero(np.all((maxs>=pane.lo-pad-tol)&(mins<=pane.hi+pad+tol),axis=1))
        checked[pane.layer]+=1
        for i in candidates:
            member=structure[i]
            extent=extrema(member,edge,normal)
            if extent is None:
                continue
            (a,_),(b,_)=extent
            required_low = low
            if roof and member.layer == 'Enclosure / Rooflight glazing rails':
                # The head and sill glazing rails intentionally carry the
                # glass on their top faces; their seating is checked separately.
                required_low = inner
            if min(b,high)-max(a,required_low)<=tol:
                continue
            # A sash can be thickened along a global axis. Its face prism is a
            # broad-phase shape only: test the eight actual glass vertices
            # before describing an edge contact as physical penetration.
            direct = min(b,outer)-max(a,inner)>tol and solid_overlap(pane.v,member,tol)
            if not direct and required_low == inner and high == outer:
                continue
            gap=max(inner-b,a-outer,0.)
            hits.append({'kind':'glass intersection' if direct else 'adjacent clear opening',
                         'pane_layer':pane.layer,'pane':pane.serial,'center':np.round(pane.center,3).tolist(),
                         'member_layer':member.layer,'member':member.serial,'material':member.material,
                         'member_center':np.round(member.center,3).tolist(),'gap_m':round(float(gap),4)})
    return {'model_sha256':sha256(model.read_bytes()).hexdigest(),'parts_tested':len(structure),'panes_tested':len(panes),'panes_by_layer':dict(checked),
            'tolerance_m':tol,'vertical_clearance_m':facade_clearance,'below_rooflight_m':roof_clearance,
            'operable_sashes_tested':sash_count,'sash_pairs':sash_hits,
            'pairs':hits,**door_clearances(model,structure,mins,maxs,tol)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    report=test(args.model)
    print('Glazing pieces',report['panes_tested'],'structural pieces',report['parts_tested'])
    for key,n in Counter((a['kind'],a['pane_layer'],a['member_layer']) for a in report['pairs']).most_common():
        print(n,*key,sep=' | ')
    print(report['operable_sashes_tested'],'operable sashes;',len(report['sash_pairs']),'sash sweep collisions.')
    print(report['doors_tested'],'operable doors;',len(report['door_pairs']),'swing collisions;',
          len(report['threshold_pairs']),'threshold collisions.')
    if args.report:
        args.report.write_text(json.dumps(report,indent=2)+'\n')
    return bool(report['pairs'] or report['door_pairs'] or report['sash_pairs'] or report['threshold_pairs'])


if __name__=='__main__':
    raise SystemExit(main())
