"""Market truss — preliminary geometric stiffness comparison; SI throughout.
Pin-jointed 2D small-displacement elastic truss, E = 200 GPa. Identical members and
service pressure at every tested depth. No member, stability, lateral, vibration,
connection, uplift/anchor, construction, or code check is implied.
"""
from dataclasses import dataclass
import numpy as np

X = np.array([3.2, 6.9, 10.6, 14.3, 18., 21.7, 25.4, 29.1, 32.8, 36.5, 40.2])
E = 200.e9
WIDTH = 8.9
FLOOR, FRAME = 5_500., 1_000.  # N/m², conceptual unfactored pressures

def box_area(b, t):
    # Idealized sharp-corner welded square box, 4 plates; b = outside dimension.
    return b*b - (b-2*t)**2

AREAS = {'chord': box_area(.30, .012), 'diagonal': box_area(.25, .010), 'vertical': box_area(.20, .008)}

@dataclass
class Member:
    start: int
    end: int
    family: str

def build(depth):
    n = len(X)
    points = np.column_stack((np.tile(X, 2), np.repeat([6.05, 6.05+depth], n)))
    members = []
    for i in range(n-1):
        members.append(Member(i, i+1, 'chord'))
        members.append(Member(i+n, i+1+n, 'chord'))
        # West panel rises from lower west to upper east; subsequent panels alternate.
        if i % 2 == 0:
            members.append(Member(i, i+1+n, 'diagonal'))
        else:
            members.append(Member(i+n, i+1, 'diagonal'))
    members.extend(Member(i, i+n, 'vertical') for i in range(n))
    return points, members

def load_vector(points, floor_in, frame_in):
    f = np.zeros(2*len(points))
    for i in range(len(X)-1):
        q = WIDTH*(FLOOR*floor_in(i) + FRAME*frame_in(i))
        half = q*(X[i+1]-X[i])/2
        f[2*i+1] -= half
        f[2*(i+1)+1] -= half
    return f

def analyse(depth, floor_in=lambda i:True, frame_in=lambda i:True):
    points, members = build(depth)
    k = np.zeros((2*len(points), 2*len(points)))
    transform = []
    for m in members:
        delta = points[m.end] - points[m.start]
        length = np.linalg.norm(delta)
        cx, cy = delta/length
        strain = np.array([-cx,-cy,cx,cy])
        dofs = np.array([2*m.start,2*m.start+1,2*m.end,2*m.end+1])
        ea_over_l = E*AREAS[m.family]/length
        k[np.ix_(dofs,dofs)] += ea_over_l*np.outer(strain, strain)
        transform.append((dofs, strain, ea_over_l))
    f = load_vector(points, floor_in, frame_in)
    fixed = [4,5,21]  # lower node 2 pin and lower node 10 vertical roller
    free = np.setdiff1d(np.arange(len(f)),fixed)
    u = np.zeros_like(f)
    u[free] = np.linalg.solve(k[np.ix_(free,free)],f[free])
    r = k@u - f
    forces = np.array([scale*(strain@u[dof]) for dof,strain,scale in transform])
    assert np.linalg.norm(r[free]) < 1.e-6
    assert abs(f[1::2].sum() + r[5] + r[21]) < 1.e-6
    assert abs(f[1:2*len(X):2] @ (X-X[2]) + r[21]*(X[-1]-X[2])) < 1.e-5
    return members, r[5]/1000, r[21]/1000, u[1:2*len(X):2]*1000, forces/1000

if __name__ == '__main__':
    for depth in (3.2,4.2,5.2):
        members, near, far, y, forces = analyse(depth)
        print(f'{depth=}  R(kN)={near:.2f}, {far:.2f}. Tip(mm)={y[0]:+.2f}. Lowest-node(mm)={y.min():+.2f} at x={X[y.argmin()]:.1f}')
        for family in AREAS:
            vals = np.array([forces[j] for j,m in enumerate(members) if m.family==family])
            print(f'  {family}: {vals.min():.1f}..{vals.max():.1f} kN')
    for label, floor_in, frame_in in [
        ('West floor, full frame', lambda i:i<2, lambda i:True),
        ('Backspan floor, full frame', lambda i:i>=2, lambda i:True),
        ('West isolated load only / diagnostic', lambda i:i<2, lambda i:i<2),
    ]:
        _, r1, r2, y, n = analyse(4.2,floor_in,frame_in)
        print(f'{label}: R={r1:.2f}, {r2:.2f} kN. Tip={y[0]:+.2f} mm, backspan min={y[2:].min():+.2f} mm; N={n.min():.1f}..{n.max():.1f} kN')
