"""Trace vertical rays along both public ramp systems in the serialized GLB. Run in Blender."""
import struct,json,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
import numpy as np
p=Path(sys.argv[sys.argv.index('--')+1]).read_bytes();n=struct.unpack_from('<I',p,12)[0];d=json.loads(p[20:20+n]);buf=p[28+n:];pts=[];fs=[];names=[]
def arr(i):
 a=d['accessors'][i];bv=d['bufferViews'][a['bufferView']];w=3 if a['type']=='VEC3' else 1
 return np.frombuffer(buf,{5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']],offset=bv['byteOffset'],count=a['count']*w).reshape(-1,w)
for nd in d['nodes']:
 m=d['meshes'][nd['mesh']]['primitives'][0];v=arr(m['attributes']['POSITION']);f=arr(m['indices']).reshape(-1,3).astype(int)+len(pts);pts.extend(v.tolist());fs.extend(f.tolist());names+=len(f)*[nd['extras']['layer']]
bvh=BVHTree.FromPolygons(pts,fs,all_triangles=True)
G=2.5;L2=6.4116;L3=10.6788;xa=2.16;xb=47.45;dist=(xb-xa)+(18.46-1.82)+(46.9-xa);q=(L3-L2)/dist;h=L2+q*(xb-xa);hh=h+q*(18.46-1.82)
violations=0
for title,ax,a,b,c,z,Z in [('lower outward',0,47.45,6.55,24.,G,(G+L2)/2),('lower return',0,6.55,47.45,21.5,(G+L2)/2,L2),('upper south',0,47.45,2.16,19.87,L2,h),('upper west',1,18.46,1.82,1.075,h,hh),('upper north',0,2.16,46.9,.58,hh,L3),('forum bridge',0,49.74,64,20.85,L2,L2),('forum access',1,20.85,17.65,63.4,L2,L2),('north gate',1,.8,2.35,46.98,L3,L3)]:
 bad={}
 for at in np.linspace(.014,.986,max(4,round(abs(b-a)/.22))):
    v=a+(b-a)*at;el=z+(Z-z)*at
    for off in [-.39,0,.39]:
        x,y=(v,c+off) if ax==0 else (c+off,v)
        target=bvh.ray_cast(Vector((x-82.906,el+.032,y)),Vector((0,1,0)),2.005)
        if target[2] is not None:
          name=names[target[2]]
          bad.setdefault(name,[]).append((round(x,1),round(y,1),round(target[3],2)))
 violations+=sum(len(v) for v in bad.values())
 print(title,[(k,len(v),v[:3],v[-2:]) for k,v in bad.items()])
# Check the ground street and the level porch at three inner points across the walking width.
for name,xs,ys,level in [('market street',np.arange(.25,67.9,.23),[20.89,21.24,21.59],lambda x:.33+2.17*x/46.55 if x<=46.55 else G-.05*min(1,(x-46.55)/19)),
                         ('hall porch',np.arange(15.1,46.54,.23),[19.,19.28,19.57],lambda x:G)]:
    hits=[]
    for x in xs:
        for y in ys:
            pos=bvh.ray_cast(Vector((x-82.906,level(x)+.034,y)),Vector((0,1,0)),2.003)
            if pos[2] is not None:hits.append((round(x,1),y,names[pos[2]]))
    violations+=len(hits)
    print(name,hits[:20])
if violations:raise ValueError(f'{violations} obstructions above sampled interior walk points')
