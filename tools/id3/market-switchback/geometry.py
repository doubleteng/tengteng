"""Closed convex fabrication parts; indexed glTF batches respect the viewer's layers."""
from collections import Counter, defaultdict
import json
import struct
from pathlib import Path
import numpy as np

# Coordinates on the board are east, south and elevation, all in metres.
ORIGIN_X = -82.906
PARCEL = [(0, 0), (82.906, 0), (42.3677, 57.912), (0, 57.912)]
layers = defaultdict(lambda: [[], []])
parts = Counter()
checked = 0
outliers = []

def grade(x,y):
    if x <= 82.906*(1-y/57.912):
        return .3048+2.1336*x/82.906
    return 2.4384+2.1336*(x-82.906+40.5383*y/57.912)/42.3677

def clip(poly, axis, threshold, greater):
    out = []
    for a,b in zip(poly, poly[1:]+poly[:1]):
        da=(a[axis]-threshold)*(1 if greater else -1)
        db=(b[axis]-threshold)*(1 if greater else -1)
        if da>=0: out.append(a)
        if da*db<0:
            t=da/(da-db);out.append(tuple(a[k]+t*(b[k]-a[k]) for k in (0,1)))
    return out

def rect(x,y,X,Y): return [(x,y),(X,y),(X,Y),(x,Y)]

def solid(layer,mat,verts,faces):
    global checked
    # Enforce outward winding after changing to the gallery's Y-up coordinates.
    vs=np.array([(x+ORIGIN_X,z,y) for x,y,z in verts], dtype=np.float32)
    centre=vs.mean(axis=0)
    edges=Counter();tri=[];vol=0
    for face in faces:
        ids=list(face)
        a,b,c=vs[ids[:3]].astype(float)
        if np.dot(np.cross(b-a,c-a), a-centre)<0:ids.reverse()
        for i in range(1,len(ids)-1):
            ia,ib,ic=ids[0],ids[i],ids[i+1]
            a,b,c=vs[[ia,ib,ic]].astype(float)-centre
            cross=np.cross(b-a,c-a)
            if np.linalg.norm(cross)<1e-9:raise ValueError((layer,'zero face',verts))
            vol+=np.dot(a,cross)/6
            for key in [(ia,ib),(ib,ic),(ic,ia)]:edges[key]+=1
            tri.extend([ia,ib,ic])
    if vol<=1e-10 or any(v!=1 or edges[b,a]!=1 for (a,b),v in edges.items()):
        raise ValueError(('open or nonmanifold',layer,vol))
    for x,y,z in verts:
        if x<-.001 or y<-.001 or y>57.913 or x>82.906-40.5383*y/57.912+.001:
            outliers.append((layer,x,y,z))
    points,inds=layers[layer,mat]
    inds.extend(len(points)+i for i in tri);points.extend(vs.tolist());parts[layer]+=1;checked+=1

def plate(layer,mat,poly,top,t):
    if len(poly)<3:return
    def h(x,y):return top(x,y) if callable(top) else top
    n=len(poly);v=[(x,y,h(x,y)-dz) for dz in (t,0) for x,y in poly]
    solid(layer,mat,v,[list(range(n)),list(range(n,2*n))]+[[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)])
def box(l,m,x,y,z,X,Y,Z):
    if X-x<.0001 or Y-y<.0001 or Z-z<.0001:return
    plate(l,m,rect(x,y,X,Y),Z,Z-z)
def beam(l,m,a,b,w,h=None):
    h=w if h is None else h
    a=np.array(a,dtype=float);b=np.array(b,dtype=float);axis=b-a
    if np.linalg.norm(axis)<.0002:return
    axis/=np.linalg.norm(axis)
    side=np.cross(axis,(0,0,1) if abs(axis[2])<.94 else (0,1,0));side*=w/(2*np.linalg.norm(side))
    up=np.cross(axis,side);up*=h/(2*np.linalg.norm(up))
    verts=[p+i*side+j*up for p in (a,b) for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    solid(l,m,verts,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def linear_hex(s):
    def lin(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
    return [lin(int(s[i:i+2],16)/255) for i in (0,2,4)]

def write(path,palette):
    doc={'asset':{'version':'2.0','generator':'Market Switchback / ID3 teaching case'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'bufferViews':[],'accessors':[]}
    buf=bytearray()
    def accessor(a,ct,kind,target):
        while len(buf)%4:buf.append(0)
        data=a.tobytes();bv=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(data),'target':target});buf.extend(data)
        ac={'bufferView':bv,'componentType':ct,'count':len(a),'type':kind}
        if kind=='VEC3':ac.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        doc['accessors'].append(ac);return len(doc['accessors'])-1
    for name,(color,rough,metal,alpha) in palette.items():
        m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':linear_hex(color)+[alpha],'roughnessFactor':rough,'metallicFactor':metal},'doubleSided':False}
        if alpha<1:m['alphaMode']='BLEND'
        doc['materials'].append(m)
    for (layer,mat),(points,inds) in layers.items():
        n=len(doc['nodes']);k=5123 if len(points)<65536 else 5125
        pos=accessor(np.array(points,dtype='<f4'),5126,'VEC3',34962)
        ix=accessor(np.asarray(inds,dtype='<u2' if k==5123 else '<u4'),k,'SCALAR',34963)
        doc['meshes'].append({'primitives':[{'attributes':{'POSITION':pos},'indices':ix,'material':list(palette).index(mat)}]})
        doc['nodes'].append({'name':layer+' | '+mat,'mesh':n,'extras':{'layer':layer}});doc['scenes'][0]['nodes'].append(n)
    doc['buffers']=[{'byteLength':len(buf)}]
    while len(buf)%4:buf.append(0)
    header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*((-len(header))%4)
    data=struct.pack('<4sII',b'glTF',2,28+len(header)+len(buf))+struct.pack('<I4s',len(header),b'JSON')+header+struct.pack('<I4s',len(buf),b'BIN\0')+buf
    Path(path).write_bytes(data)
    return {'parts':checked,'triangles':sum(len(a[1])//3 for a in layers.values()),'batches':len(layers),'glbBytes':len(data),'byLayer':dict(parts)}
