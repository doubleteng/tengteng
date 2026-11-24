"""Render exhibition views with Blender. Run blender -b -P render_views.py -- project.glb output-dir [draft]."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
model=Path(args[0]).resolve()
out=Path(args[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
draft=len(args)>2 and args[2]=='draft'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
s=bpy.context.scene
s.world=bpy.data.worlds.new('Clear Michigan daylight')
s.world.use_nodes=True
sky=s.world.node_tree.nodes.get('Background')
sky.inputs[0].default_value=(.8,.89,1,1);sky.inputs[1].default_value=.92
bpy.ops.mesh.primitive_plane_add(size=1500,location=(0,0,-.02))
mat=bpy.data.materials.new('Model ground');mat.diffuse_color=(.67,.65,.59,1)
bpy.context.object.data.materials.append(mat)
bpy.ops.object.light_add(type='SUN')
sun=bpy.context.object;sun.data.energy=3.6;sun.data.angle=.12
sun.rotation_euler=Vector((.62,-.30,-.88)).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
cam=bpy.context.object;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=5 if draft else 88;s.cycles.use_denoising=False
s.render.image_settings.file_format='WEBP';s.render.image_settings.quality=88;s.view_settings.view_transform='AgX'
def p(q):return Vector((q[0]-82.906,-q[1],q[2]))
def take(name,eye,target,scale=None,lens=29):
    cam.location=p(eye);cam.rotation_euler=(p(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO' if scale else 'PERSP';cam.data.clip_start=.08;cam.data.clip_end=1000
    if scale:cam.data.ortho_scale=scale
    else:cam.data.lens=lens
    s.render.resolution_x=1092;s.render.resolution_y=590
    s.render.resolution_percentage=50 if draft else 100
    s.render.filepath=str(out/(name+'.webp'));bpy.ops.render.render(write_still=True)
take('market-switchback',(-48,-62,49),(33,26,4.20),102)
# Street-level view across Fourth Avenue, wide enough to show both returning gallery edges.
take('market-switchback-ramp',(-10,-11.5,2.08),(20,9.1,7.4),lens=22.5)
take('market-switchback-aisle',(1.72,30.58,2.05),(41,30.90,3.10),lens=26)
# This didactic plate uses the same complete model with all cladding and loose furnishing hidden.
for o in s.objects:
    if o.type!='MESH':continue
    if o.name.startswith('Structure /'):
        o.hide_render=any(q in o.name.lower() for q in ['clt market roof','clt roof','cross laminated roof panels','studios and bridges','forum and terraces','lower-ground slab','arcade clt'])
    elif o.name!='Plane':o.hide_render=True
take('market-crossing-frame',(-38,-68,40),(33,24,4.4),101)
