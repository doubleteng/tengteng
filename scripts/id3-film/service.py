"""Production Film service for the ID3 gallery. Deploy once per code release."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.request import Request, urlopen

import modal
from film_jobs import CONTEXT, fingerprint, model_file, normalize_job

ROOT = Path(__file__).resolve().parent
STORE = Path('/films')
REPO = 'https://api.github.com/repos/doubleteng/tengteng'
RAW = 'https://raw.githubusercontent.com/doubleteng/tengteng'
ID = re.compile(r'[0-9a-f]{40}')
app = modal.App('id3-studio-films')
volume = modal.Volume.from_name('id3-studio-films-v1', create_if_missing=True)
live = modal.Dict.from_name('id3-studio-film-progress-v1', create_if_missing=True)
base = modal.Image.debian_slim(python_version='3.11').pip_install('fastapi==0.116.1', 'starlette==0.47.3')
def sources(image):
    return image.add_local_python_source('film_jobs').add_local_file(ROOT/'roster.json','/id3/roster.json')
api_image = sources(base)
gpu_image = sources(modal.Image.from_registry('ubuntu:22.04', add_python='3.11')
    .apt_install('ca-certificates','curl','xz-utils','libgl1','libxrender1','libxfixes3','libxkbcommon0','libxi6','libsm6','libxext6','libxxf86vm1','ffmpeg')
    .run_commands('cd /tmp && curl -fsSLO --retry 3 https://download.blender.org/release/Blender4.3/blender-4.3.2-linux-x64.tar.xz && curl -fsSLO --retry 3 https://download.blender.org/release/Blender4.3/blender-4.3.2.sha256 && grep "blender-4.3.2-linux-x64.tar.xz$" blender-4.3.2.sha256 | sha256sum -c - && tar -xJf blender-4.3.2-linux-x64.tar.xz -C /opt && rm blender-4.3.2-linux-x64.tar.xz')
    ).add_local_file(ROOT/'render_film.py','/id3/render_film.py')

def put(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value))
    os.replace(tmp,path)

def read(path):
    return json.loads(path.read_text()) if path.is_file() else {}

def published(url):
    return json.load(urlopen(Request(url, headers={'User-Agent':'ID3-Studio-Film'}),timeout=25))

@lru_cache(maxsize=2)
def catalog(minute):
    rev = published(REPO+'/commits?path=teaching/id3/models&per_page=1')[0]['sha']
    prefix = RAW+'/'+rev+'/teaching/id3/'
    projects = published(prefix+'models/catalog.json')['projects']
    files = {f['name']:f['sha'] for f in published(REPO+'/contents/teaching/id3/models?ref='+rev)}
    return projects,files,prefix

def job_dir(job):
    if not ID.fullmatch(job):
        raise ValueError('Unknown film.')
    return STORE/job

def status(d):
    req = read(d/'request.json')
    if not req:
        return {}
    dispatch = read(d/'attempt.json')
    attempt = dispatch.get('attempt','')
    state = read(d/attempt/'result.json') if attempt else {}
    if not state and attempt:
        state = live.get(attempt, {})
        if not state:
            state = {}
    if not state or state.get('state') in ('running','queued'):
        stamp = state.get('updated',dispatch.get('started',0))
        if time.time()-stamp>150 and dispatch.get('call'):
            try:
                modal.FunctionCall.from_id(dispatch['call']).get(timeout=0)
            except TimeoutError:
                pass
            except Exception as exc:
                print('Film call check:',type(exc).__name__,flush=True)
                if type(exc).__name__ in {'ExecutionError','RemoteError','NotFoundError','FunctionTimeoutError','InvalidError','InternalFailure'}:
                    state = {'state':'failed','error':'The cloud worker stopped. Submit the preview again.'}
        if not dispatch.get('call') and time.time()-dispatch.get('started',req['created'])>180:
            state = {'state':'failed','error':'Submission was interrupted. Submit the preview again.'}
    return dict(id=d.name,project=req['camera']['project'],director=req['director'],frames=req['frames'],
                created=req['created'],**({'state':'queued'}|state))

@app.function(image=api_image, volumes={'/films':volume},max_containers=1,timeout=120)
def submit_job(body):
    # A single writer admits jobs, including the active-per-student check and dispatch.
    volume.reload()
    roster = read(Path('/id3/roster.json'))
    try:
        camera, frames = normalize_job(body, roster)
        projects, files, prefix = catalog(int(time.time()//60))
        project = next((p for p in projects if p['key']==camera['project']),None)
        if not project or body['revision']!=project.get('url'):
            return 409,{'error':'The model was updated. Reload Film and export a new preview.'}
        name = model_file(project['url'])
        assets = {n:files[n] for n in (name,*CONTEXT)}
    except (ValueError,KeyError) as exc:
        return 400,{'error':str(exc)}
    director = body['director']
    d = job_dir(fingerprint(director,camera,assets))
    existing = status(d)
    if existing and existing['state']!='failed':
        return 200,existing
    for f in STORE.glob('*/request.json'):
        if f.parent!=d and read(f).get('director')==director:
            other = status(f.parent)
            if other.get('state') in ('running','queued'):
                return 409,{'error':'Your previous film is still rendering.', 'job':other}
    if not existing:
        put(d/'request.json',dict(director=director,camera=camera,frames=frames,model=name,assets=assets,prefix=prefix,created=time.time()))
    attempt = uuid.uuid4().hex
    dispatch = {'attempt':attempt,'started':time.time()}
    put(d/'attempt.json',dispatch)
    volume.commit()
    try:
        call = render_film.spawn(d.name,attempt)
    except Exception:
        put(d/attempt/'result.json',{'state':'failed','error':'Modal could not start the worker. Check the workspace quota and retry.'})
        volume.commit()
        return 503,{'error':'Modal could not start the worker. Please retry.'}
    put(d/'attempt.json', dict(dispatch,call=call.object_id))
    volume.commit()
    return 202,status(d)

def download_assets(req, dest):
    cache=Path('/tmp/id3-assets')
    cache.mkdir(exist_ok=True)
    for name, sha in req['assets'].items():
        cached=cache/sha
        if not cached.exists():
            part=cached.with_suffix('.part')
            with urlopen(req['prefix']+'models/'+name,timeout=90) as r, part.open('wb') as f:
                shutil.copyfileobj(r,f)
            h=hashlib.sha1(('blob '+str(part.stat().st_size)+'\0').encode())
            with part.open('rb') as f:
                for b in iter(lambda:f.read(2**20),b''):
                    h.update(b)
            if h.hexdigest()!=sha:
                raise ValueError('Published model checksum failed.')
            os.replace(part,cached)
        (dest/name).symlink_to(cached)

@app.function(image=gpu_image,gpu='L4',cpu=(2,2),memory=8192,max_containers=1,min_containers=0,scaledown_window=2,timeout=21600,volumes={'/films':volume})
def render_film(job,attempt):
    volume.reload()
    d=job_dir(job)
    req=read(d/'request.json')
    if read(d/'attempt.json').get('attempt')!=attempt:
        return
    result=d/attempt
    result.mkdir(exist_ok=True)
    if read(result/'result.json').get('state')=='ready':
        return
    try:
        live[attempt]={'state':'running','frame':0,'updated':time.time()}
        with tempfile.TemporaryDirectory() as folder:
            tmp=Path(folder)
            download_assets(req,tmp)
            camera=tmp/'camera.json'
            put(camera,req['camera'])
            movie=tmp/'film.mp4'
            cmd=['/opt/blender-4.3.2-linux-x64/blender','-b','--python-exit-code','1','--python','/id3/render_film.py','--',
                 '--path',str(camera),'--assets',str(tmp),'--project-model',req['model'],'--height','1080','--samples','32','--output',str(movie)]
            prev=0
            with subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,errors='replace') as proc:
                for line in proc.stdout:
                    m=re.search(r'Append frame (\d+)',line)
                    if m and (time.time()-prev>=10 or int(m[1])==req['frames']):
                        live[attempt]={'state':'running','frame':int(m[1]),'updated':time.time()}
                        prev=time.time()
                    elif 'ID3 GPU:' in line or 'Error:' in line or 'Traceback' in line:
                        print(line.rstrip(),flush=True)
                if proc.wait():
                    raise RuntimeError('Blender could not finish this scene.')
            stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames,duration','-of','json',str(movie)]))['streams'][0]
            if (stream['codec_name'],stream['width'],stream['height'],stream['avg_frame_rate'],int(stream['nb_frames']))!=('h264',1920,1080,'24/1',req['frames']) or abs(float(stream['duration'])-req['frames']/24)>.02:
                raise ValueError('The encoded movie failed frame validation.')
            # Put the MP4 header at the front for presentation playback and seeking.
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(movie),'-c','copy','-movflags','+faststart',str(result/'film.mp4')],check=True)
            with (result/'film.mp4').open('rb') as f:
                checksum=hashlib.file_digest(f,'md5').hexdigest()
            end=dict(state='ready',size=(result/'film.mp4').stat().st_size,md5=checksum,finished=time.time(),frame=req['frames'])
    except Exception as exc:
        print('Render failed:',repr(exc),flush=True)
        end=dict(state='failed',error='The cloud render stopped. You can submit the preview again.')
    put(result/'result.json',end)
    volume.commit()
    live[attempt]=end

@app.function(image=api_image,volumes={'/films':volume},min_containers=0,max_containers=8,timeout=900)
@modal.asgi_app(label='id3-film')
def web():
    from fastapi import FastAPI, Request as WebRequest, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, FileResponse
    api=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
    api.add_middleware(CORSMiddleware,allow_origins=['https://teng-teng.org','https://www.teng-teng.org'],allow_methods=['GET','POST','HEAD'],allow_headers=['Content-Type','Range'],expose_headers=['Content-Range','Content-Length','Accept-Ranges'])
    @api.get('/health')
    def health():
        return {'service':'id3-film','fps':24,'height':1080}
    @api.post('/jobs')
    async def submit(request:WebRequest):
        if request.headers.get('origin') not in ('https://teng-teng.org','https://www.teng-teng.org'):
            raise HTTPException(403,'Use the Film editor.')
        buf=bytearray()
        async for chunk in request.stream():
            buf.extend(chunk)
            if len(buf)>1024*1024:
                raise HTTPException(413,'Camera path too large.')
        try:
            body=json.loads(buf)
        except (ValueError,UnicodeError):
            raise HTTPException(400,'Invalid camera path.')
        if not isinstance(body,dict):
            raise HTTPException(400,'Invalid submission.')
        code,data=await submit_job.remote.aio(body)
        return JSONResponse(data,status_code=code)
    @api.get('/jobs/{job}')
    def detail(job:str):
        if not ID.fullmatch(job):
            raise HTTPException(404)
        volume.reload()
        data=status(job_dir(job))
        if not data:
            raise HTTPException(404,'Film not found.')
        return data
    @api.get('/films')
    def films(project:str=''):
        volume.reload()
        rows=[]
        for f in STORE.glob('*/*/result.json'):
            res=read(f)
            d=f.parent.parent
            if res.get('state')!='ready' or read(d/'attempt.json').get('attempt')!=f.parent.name:
                continue
            req=read(d/'request.json')
            if not project or req['camera']['project']==project:
                rows.append(dict(id=d.name,project=req['camera']['project'],director=req['director'],frames=req['frames'],**res))
        return {'films':sorted(rows,key=lambda r:r['finished'],reverse=True)}
    @api.api_route('/jobs/{job}/movie',methods=['GET','HEAD'])
    def media(job:str,download:bool=False):
        if not ID.fullmatch(job):
            raise HTTPException(404)
        volume.reload()
        d=job_dir(job)
        target=d/read(d/'attempt.json').get('attempt','missing')
        if read(target/'result.json').get('state')!='ready' or not (target/'film.mp4').exists():
            raise HTTPException(404)
        return FileResponse(target/'film.mp4',media_type='video/mp4',filename=f'{read(d/"request.json")["camera"]["project"]}-{job[:8]}.mp4',content_disposition_type='attachment' if download else 'inline')
    return api
