"""Compare direct and inclined glulam supports, including bearing-column compliance."""
import sys
from pathlib import Path
import json
import numpy as np
import check_shell as s

BASE_Z=2.90
bottom=np.interp(s.X,s.X[[0,s.WEST,s.EAST,-1]],[8.2616,6.05,6.05,7.75])
W=s.WEST; E=s.EAST; n=4*s.N; bays=(W+1,E-1)
p=np.column_stack([s.load_vector(name) for name in s.CASE_NAMES])
completed=[s.CASE_NAMES.index(name) for name in s.OCCUPANCY]
def analyse(joint, supports='fixed', knee=(.585,.855), posts=False):
    M,bars,volume=s.stiffness(bottom,'Warren',s.SECTIONS,joint)
    legs=[]
    # At both ends the toe is at x of the main bearing. Top node at the neighboring panel.
    # Fixed toes go directly to the RC plinth. For the 'guided' case the toe and
    # head on the east side have the same free x translation, with a rigid local
    # force couple transmitted through the support (requires constrained rotation).
    if knee:
        for end,to in zip((W,E),bays):
            dx=s.X[to]-s.X[end]; dz=bottom[to]-BASE_Z; length=np.hypot(dx,dz)
            axis=np.array([dx,dz])/length
            area=np.prod(knee); k=1/(length/(s.E*area)+2/(joint*1e9))
            pr=np.zeros(n);pr[2*to:2*to+2]=axis
            if end==E and supports=='guided':pr[2*E]-=axis[0]
            M+=k*np.outer(pr,pr)
            legs.append((k,pr,axis,length,area))
    fixed=[2*W]
    col_stiff=1/((bottom[W]-BASE_Z)/(s.E*.63*.9)+2/(joint*1e9))
    if posts:
        for end in (W,E):M[2*end+1,2*end+1]+=col_stiff
    else:
        fixed += [2*W+1,2*E+1]
    free=np.setdiff1d(np.arange(n), fixed)
    disp=np.zeros_like(p)
    disp[free] = np.linalg.solve(M[np.ix_(free,free)],p[free])
    R=M@disp-p
    assert abs(R[free]).max()<1.e-4
    dy=disp[1:n//2:2]*1000
    base={}
    if legs:
        for i,c in enumerate(s.CASE_NAMES):
            forces=[float(k*pr@disp[:,i])/1000 for k,pr,axis,l,a in legs]
            # vector from toe to top. Tension pulls toe up, leading to negative foundation Ry.
            toe=-np.array([f*bar[2] for f,bar in zip(forces,legs)])
            cols=np.array([-col_stiff*disp[2*end+1,i]/1000 if posts else R[2*end+1,i]/1000 for end in (W,E)])
            base_shear=toe[:,0].copy()
            base_shear[0]+=R[2*W,i]/1000
            if supports=='guided':base_shear=np.array([base_shear[0],0.])
            net_R=cols+toe[:,1]
            assert abs(net_R.sum()+sum(p[1::2,i])/1000)<1.e-5
            assert abs(sum(base_shear))<1.e-5
            base[c]={'leg_axial_kN':np.round(forces,1).tolist(),
                     'knee_toe_support_H_kN':np.round(toe[:,0],1).tolist(),
                     'knee_toe_support_V_kN':np.round(toe[:,1],1).tolist(),
                     'main_column_support_V_kN':np.round(cols,1).tolist(),
                     'west_original_node_horizontal_support_kN':round(R[2*W,i]/1000,1),
                     'combined_H_plinth_kN':np.round(base_shear,1).tolist(),
                     'combined_V_plinth_kN':np.round(net_R,1).tolist()}
    f=dy[:,completed] + .5*dy[:,[0]]
    settlement = np.vstack([dy[W],dy[E]])
    fraction=(s.X-s.X[W])/(s.X[E]-s.X[W])
    reference=settlement[0][None,:]+fraction[:,None]*(settlement[1]-settlement[0])[None,:]
    return {'support_line_relative_dry_1_5':s.service_envelope(dy-reference,1.5),
            'joint_GN_per_m':joint,'knee_mm':[round(x*1000) for x in knee] if knee else None,'leg_length_m':round(legs[0][3],3) if knee else None,'dry_1_5':s.service_envelope(dy,1.5),'dry_2_0':s.service_envelope(dy,2.0),'instantaneous':s.service_envelope(dy,1.),'tips_dry_each_mm':[[round(float(f[j].min()),2),round(float(f[j].max()),2)] for j in (0,-1)],'support_cases':base}
results={}
for joint in (.5,1.,2.):
 for supports,knee,posts,name in [('fixed',None,False,'original'),('fixed',None,True,'flex_main_posts_only'),('fixed',(.585,.855),False,'fixed_toe'),('guided',(.585,.855),False,'guided_east_foot'),('fixed',(.585,.855),True,'fixed_toe_flex_posts'),('guided',(.585,.855),True,'guided_east_flex_posts')]:
    a=analyse(joint,supports,knee,posts);results[f'{name}_{joint}']=a
    b=a['support_cases'].get('full',{})
    print(joint,name, a['dry_1_5'],b.get('leg_axial_kN'),b.get('combined_H_plinth_kN'),b.get('combined_V_plinth_kN'))
results['assumptions'] = {
    'geometry': 'Two 4.78 m inward knees in each longitudinal truss plane at 2.90 m toe elevation, top connections at x17.0/42.2, z6.05. Trial knee width 585 mm, depth 855 mm. Member E and load patterns from check_shell.py.',
    'springs': 'Every knee and, in compliant-column cases, each 3.15 m primary column uses full timber EA/L and one per-end spring (two per member). Foundation and core are rigid. All two-way axial members respond in both tension/compression.',
    'toe_variants': 'Fixed toes restrain both translations. Guided-east couples lateral movement of east toe with the original east bearing node, condensing them into the same longitudinal translation; implementing it would require a rigid moment-transferring guided support assembly. Retain original bracing concept with no knees.',
    'absolute_vs_relative': 'Reported main sag and tip displacements in comparison are absolute z. Separate support-line values subtract the line through both main bearing displacements, extrapolated to each tip.',
    'equilibrium': 'Numerical solutions verified free-node and global horizontal and vertical equilibrium. Toe forces are foundation reactions acting on the assembly; positive vertical points upward. Knee axial force is positive in tension.',
    'scope': 'Rejected as a soft-joint remedy; no knee/foundation design. Ground flexibility, lateral stability and uplift/wind/seismic/erection combinations are unverified. These results do not modify the selected design.'}
Path(sys.argv[1] if len(sys.argv)>1 else 'bearing-comparison.json').write_text(json.dumps(results,indent=2))
