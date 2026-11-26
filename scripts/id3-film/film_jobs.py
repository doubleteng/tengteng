import hashlib
import json
import math
import re
from urllib.parse import urlsplit

FPS = 24
RENDER_VERSION = 'cycles-4.3.2-32-1'
CONTEXT = ('urban-core-materials.glb', 'urban-near.glb', 'urban-outer.glb', 'foliage-86e71ddf75.png')

def number(v):
    return type(v) in (float, int) and math.isfinite(v)

def normalize_job(body, roster):
    if not isinstance(body, dict) or body.get('director') not in roster:
        raise ValueError('Enter a name on the studio roster.')
    project, revision, shots = (body.get(k) for k in ('project', 'revision', 'shots'))
    if not isinstance(project, str) or not re.fullmatch('[a-zA-Z0-9_-]{1,80}', project):
        raise ValueError('Choose a published student project.')
    if not isinstance(revision, str) or len(revision) > 220:
        raise ValueError('Refresh the project model.')
    if not isinstance(shots, list) or not 1 <= len(shots) <= 32:
        raise ValueError('Add at least one finished shot.')
    clean, frames, seconds = [], 0, 0
    for s in shots:
        if not isinstance(s, dict):
            raise ValueError('Invalid shot.')
        length, keys, name = s.get('seconds'), s.get('keys'), s.get('name')
        if not number(length) or not 0 < length <= 120 or not isinstance(keys, list) or not 2 <= len(keys) <= 120:
            raise ValueError('Each shot needs a duration and at least two keyframes.')
        if not isinstance(name, str) or not 0 < len(name) <= 100:
            raise ValueError('Invalid shot name.')
        prev, values = -1, []
        for k in keys:
            if not isinstance(k, dict):
                raise ValueError('Invalid camera key.')
            at, eye, target, fov = (k.get(n) for n in ('at','eye','target','fov'))
            if not number(at) or not prev < at <= 1 or not number(fov) or not 25 <= fov <= 95:
                raise ValueError('Check keyframe times and field of view.')
            if not all(isinstance(v,list) and len(v)==3 and all(number(n) and abs(n)<10000 for n in v) for v in (eye,target)) or math.dist(eye,target)<0.05:
                raise ValueError('Invalid camera position.')
            values.append(dict(at=at,eye=eye,target=target,fov=fov))
            prev = at
        if values[0]['at'] != 0 or prev != 1:
            raise ValueError('Shots must span the full preview.')
        clean.append(dict(name=name,seconds=length,keys=values))
        frames += max(1,math.floor(length*FPS+.5))
        seconds += length
    if seconds > 120.000001 or frames > 2880:
        raise ValueError('Keep the sequence within two minutes.')
    return dict(version=1,project=project,shots=clean), frames

def model_file(url):
    path = urlsplit(url).path
    match = re.fullmatch(r'(?:\./)?models/([A-Za-z0-9._-]+\.glb(?:\.gz)?)',path)
    if not match or urlsplit(url).netloc:
        raise ValueError('The project needs a published GLB model.')
    return match[1]

def fingerprint(director, camera, assets):
    identity = json.dumps([RENDER_VERSION,director,camera,assets], sort_keys=True, separators=(',',':'))
    return hashlib.sha256(identity.encode()).hexdigest()[:40]
