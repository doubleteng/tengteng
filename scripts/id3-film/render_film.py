"""Render an Ava Camera Study path using Blender 4.3+ and its built-in Cycles renderer."""
import argparse
import time
import bisect
import gzip
import json
import math
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
FPS = 24


def load_assets(folder, assets, project_model):
    (folder / "foliage-86e71ddf75.png").write_bytes((assets / "foliage-86e71ddf75.png").read_bytes())
    for name in [project_model, "urban-core-materials.glb", "urban-near.glb", "urban-outer.glb"]:
        model = assets / name
        if model.suffix == ".gz":
            target = folder / model.stem
            target.write_bytes(gzip.decompress(model.read_bytes()))
        else:
            target = folder / name
            target.symlink_to(model.resolve())
        bpy.ops.import_scene.gltf(filepath=str(target))
    for obj in bpy.context.scene.objects:
        parent = obj.parent
        if obj.get("initialHidden") or (parent and parent.get("initialHidden")):
            obj.hide_render = True


def prepare_glass():
    for material in bpy.data.materials:
        if "Low-tint architectural glass" not in material.name:
            continue
        nodes = material.node_tree.nodes
        link = material.node_tree.links.new
        output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
        fresnel = nodes.new("ShaderNodeFresnel")
        fresnel.inputs["IOR"].default_value = 1.48
        transparent = nodes.new("ShaderNodeBsdfTransparent")
        transparent.inputs[0].default_value = (.94, .973, .985, 1)
        reflection = nodes.new("ShaderNodeBsdfGlossy")
        reflection.inputs["Roughness"].default_value = .075
        mix = nodes.new("ShaderNodeMixShader")
        link(fresnel.outputs[0], mix.inputs[0])
        link(transparent.outputs[0], mix.inputs[1])
        link(reflection.outputs[0], mix.inputs[2])
        link(mix.outputs[0], output.inputs[0])


def light_scene(scene, project):
    scene.world = bpy.data.worlds.new("Kerrytown daylight")
    scene.world.use_nodes = True
    tree = scene.world.node_tree
    sky = tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False
    sky.sun_elevation = math.radians(39)
    sky.sun_rotation = math.radians(225)
    sky.air_density = 1.15
    sky.dust_density = .75
    bg = tree.nodes.get("Background")
    bg.inputs[1].default_value = .20
    tree.links.new(sky.outputs[0], bg.inputs[0])
    bpy.ops.object.light_add(type="SUN")
    sun = bpy.context.object
    sun.data.energy = 3.4
    sun.data.color = (1, .90, .78)
    sun.data.angle = .045
    sun.rotation_euler = Vector((.56, .60, -.63)).to_track_quat("-Z", "Y").to_euler()
    # Broad photographic fill for presentation views in the canopy and lounge.
    fills = [
        ((-44, -41, 4.7), (-41, -37, 1.4), 520, 5),
        ((-44, -30, 5.2), (-44, -24, 1.5), 600, 6),
        ((-40, -20, 4.45), (-39, -19, 1.5), 610, 5),
        ((-32, -21, 4.5), (-32, -20, 1.6), 480, 5),
        ((-49, -19, 4.45), (-45, -21, 1.4), 420, 4.5),
    ]
    for pos, target, power, size in (fills if project == "ava-barbat" else []):
        bpy.ops.object.light_add(type="AREA", location=pos)
        lamp = bpy.context.object
        lamp.data.shape = "DISK"
        lamp.data.size = size
        lamp.data.energy = power * .8
        lamp.visible_glossy = lamp.visible_transmission = False
        lamp.data.specular_factor = 0
        lamp.data.color = (1, .94, .85)
        lamp.rotation_euler = (Vector(target) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=1800, location=(-45, -25, -13.65))
    ground = bpy.data.materials.new("Exhibition ground")
    ground.diffuse_color = (.56, .55, .50, 1)
    bpy.context.object.data.materials.append(ground)


def component(key, name):
    value = key[name]
    if name == "fov":
        return value
    x, y, z = value
    return Vector((x, -z, y))


def interpolate(keys, t, name):
    i = max(0, min(len(keys) - 2, bisect.bisect_right([k["at"] for k in keys], t) - 1))
    a, b = keys[i:i + 2]
    prev, after = keys[max(0, i - 1)], keys[min(len(keys) - 1, i + 2)]
    h = b["at"] - a["at"]
    u = (t - a["at"]) / h
    x, y = component(a, name), component(b, name)
    dx = (y - component(prev, name)) * (h / (b["at"] - prev["at"]))
    dy = (component(after, name) - x) * (h / (after["at"] - a["at"]))
    return (2*u**3 - 3*u*u + 1)*x + (u**3 - 2*u*u + u)*dx + (3*u*u - 2*u**3)*y + (u**3-u*u)*dy


def render(args):
    payload = json.loads(args.path.read_text(encoding="utf-8"))
    if not payload.get("project") or payload.get("version") != 1:
        raise ValueError("Choose an exported Film camera path.")
    shots = payload["shots"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    with tempfile.TemporaryDirectory(prefix="ava-camera-") as temp:
        load_assets(Path(temp), args.assets, args.project_model)
        prepare_glass()
        light_scene(scene, payload["project"])
        bpy.ops.object.camera_add()
        camera = bpy.context.object
        scene.camera = camera
        camera.data.clip_start, camera.data.clip_end = .05, 1400
        camera.data.sensor_fit, camera.data.sensor_height = "VERTICAL", 24
        bounds = [0]
        for shot in shots:
            bounds.append(bounds[-1] + max(1, math.floor(shot["seconds"] * FPS + .5)))

        def move(current_scene, _graph=None):
            frame = max(0, min(bounds[-1]-1, current_scene.frame_current - 1))
            i = bisect.bisect_right(bounds, frame) - 1
            t = (frame - bounds[i]) / max(1, bounds[i+1] - bounds[i] - 1)
            keys = shots[i]["keys"]
            camera.location = interpolate(keys, t, "eye")
            direction = interpolate(keys, t, "target") - camera.location
            camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
            fov = max(25, min(95, interpolate(keys, t, "fov")))
            camera.data.lens = 12 / math.tan(math.radians(fov) / 2)

        scene.render.engine = "CYCLES"
        if args.device == "GPU":
            preferences = bpy.context.preferences.addons["cycles"].preferences
            for backend in ("OPTIX", "CUDA"):
                try:
                    preferences.compute_device_type = backend
                    preferences.refresh_devices()
                except (TypeError, RuntimeError):
                    continue
                devices = [d for d in preferences.devices if d.type == backend]
                if devices:
                    for d in preferences.devices:
                        d.use = d.type == backend
                    scene.cycles.device = "GPU"
                    print("ID3 GPU:", backend, [d.name for d in devices], flush=True)
                    break
            else:
                raise RuntimeError("No Cycles GPU available on the assigned worker.")
        scene.cycles.samples = max(1, args.samples)
        scene.cycles.use_denoising = getattr(bpy.app.build_options, "openimagedenoise", False)
        scene.cycles.max_bounces = 5
        scene.cycles.diffuse_bounces = scene.cycles.glossy_bounces = 3
        scene.cycles.transparent_max_bounces = 8
        scene.cycles.sample_clamp_indirect = 3
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.exposure = .18
        scene.render.use_persistent_data = True
        scene.render.resolution_x = args.height * 16 // 9
        scene.render.resolution_y = args.height
        scene.render.resolution_percentage = 100
        scene.render.fps = FPS
        scene.frame_start, scene.frame_end = 1, bounds[-1]
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"
        args.output.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(args.output.resolve())
        bpy.app.handlers.frame_change_pre.append(move)
        try:
            scene.frame_set(1)
            if args.benchmark:
                measurements = []
                for i, shot in enumerate(shots):
                    for fraction in (0, .5, 1):
                        frame_number = bounds[i] + 1 + round((bounds[i+1]-bounds[i]-1)*fraction)
                        scene.frame_set(frame_number)
                        start = time.perf_counter()
                        bpy.ops.render.render(write_still=False)
                        measurements.append({"shot": shot["name"], "frame": frame_number,
                                             "seconds": round(time.perf_counter()-start, 3)})
                args.output.write_text(json.dumps(measurements, indent=2))
            else:
                bpy.ops.render.render(animation=True)
        finally:
            bpy.app.handlers.frame_change_pre.remove(move)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=Path, default=ROOT/"Ava-camera-path.json")
    parser.add_argument("--assets", type=Path, default=ROOT/"models")
    parser.add_argument("--project-model", default="ava-barbat.glb.gz")
    parser.add_argument("--benchmark", action="store_true")
    parser.add_argument("--device", choices=("CPU","GPU"), default="GPU")
    parser.add_argument("--output", type=Path, default=ROOT/"Ava-camera-film.mp4")
    parser.add_argument("--height", type=int, choices=(720, 1080), default=720)
    parser.add_argument("--samples", type=int, default=64)
    start = sys.argv.index("--")+1 if "--" in sys.argv else len(sys.argv)
    args = parser.parse_args(sys.argv[start:])
    if args.output.exists():
        parser.error("The output already exists. Choose another --output filename.")
    render(args)
