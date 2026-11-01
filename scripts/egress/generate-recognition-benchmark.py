"""Render a reproducible recognition benchmark, not a code-compliant example.

Usage: python generate-recognition-benchmark.py OUTPUT_DIRECTORY
Requires Pillow. Truth coordinates use source pixels; one metre is 40 pixels.
The production model receives only the PNG, never the truth JSON.
"""
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT, SCALE = 1400, 840, 3
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

walls = [((100, 100), (1100, 100)), ((1100, 100), (1100, 700)),
         ((1100, 700), (100, 700)), ((100, 700), (100, 100)),
         ((100, 350), (1100, 350)), ((100, 450), (1100, 450)),
         ((400, 100), (400, 350)), ((750, 100), (750, 350)),
         ((430, 450), (430, 700)), ((850, 450), (850, 700))]
doors = [dict(name='Classroom', a=[260, 350], b=[300, 350], side=-1, kind='single'),
         dict(name='Office', a=[540, 350], b=[580, 350], side=-1, kind='single'),
         dict(name='Meeting double door', a=[900, 350], b=[980, 350], side=-1, kind='double'),
         dict(name='Studio', a=[260, 450], b=[300, 450], side=1, kind='single'),
         dict(name='Restroom', a=[500, 450], b=[540, 450], side=1, kind='single'),
         dict(name='Courtyard sliding door', a=[950, 450], b=[1030, 450], side=1, kind='sliding'),
         dict(name='West exterior door', a=[100, 380], b=[100, 420], side=1, kind='single'),
         dict(name='East exterior door', a=[1100, 380], b=[1100, 420], side=-1, kind='single'),
         dict(name='Balcony door', a=[1100, 220], b=[1100, 260], side=-1, kind='single')]
spaces = [dict(name='CLASSROOM', kind='room', box=[100, 100, 400, 350]),
          dict(name='OFFICE', kind='room', box=[400, 100, 750, 350]),
          dict(name='MEETING', kind='room', box=[750, 100, 1100, 350]),
          dict(name='CORRIDOR', kind='corridor', box=[100, 350, 1100, 450]),
          dict(name='STUDIO', kind='room', box=[100, 450, 430, 700]),
          dict(name='RESTROOM', kind='room', box=[430, 450, 850, 700]),
          dict(name='OPEN COURTYARD', kind='exterior', roof='open', box=[850, 450, 1100, 700]),
          dict(name='COVERED BALCONY', kind='exterior', roof='covered', box=[1100, 100, 1300, 350])]

for style in ['solid', 'double']:
    image = Image.new('RGB', (WIDTH*SCALE, HEIGHT*SCALE), 'white')
    d = ImageDraw.Draw(image)
    def line(points, width=1, color=40):
        d.line([(round(x*SCALE), round(y*SCALE)) for x,y in points], fill=(color,)*3, width=max(1, round(width*SCALE)))
    def rectangle(box, width=1, color=70):
        x0,y0,x1,y1 = box
        line([(x0,y0),(x1,y0),(x1,y1),(x0,y1),(x0,y0)], width, color)
    def ellipse(box, color=90):
        d.ellipse(tuple(round(v*SCALE) for v in box), outline=(color,)*3, width=SCALE)
    def text(position, label, size=17):
        d.text(tuple(round(v*SCALE) for v in position), label, fill=(45,)*3,
               font=ImageFont.truetype(FONT, size*SCALE), anchor='mm')
    def swing(a,b,side,double=False,thin=False):
        span=math.dist(a,b)
        for flip in ([False, True] if double else [False]):
            c,end=(b,a) if flip else (a,b)
            ux,uy=(end[0]-c[0])/span,(end[1]-c[1])/span
            side_here=-side if flip else side
            nx,ny=-uy*side_here,ux*side_here
            radius=span/(2 if double else 1)
            points=[(c[0]+radius*(ux*math.cos(t*math.pi/120)+nx*math.sin(t*math.pi/120)),
                     c[1]+radius*(uy*math.cos(t*math.pi/120)+ny*math.sin(t*math.pi/120))) for t in range(61)]
            line(points,.8 if thin else 1.2,90 if thin else 45)
            line([c,points[-1]],.8 if thin else 1.6,90 if thin else 45)

    for a,b in walls:
        length=math.dist(a,b); nx,ny=-(b[1]-a[1])/length,(b[0]-a[0])/length
        if style=='solid': line([a,b],7)
        else:
            for offset in [-3.5,3.5]: line([(a[0]+nx*offset,a[1]+ny*offset),(b[0]+nx*offset,b[1]+ny*offset)],1.2)
    # Glazing is continuous through the aperture, with repeated mullions.
    for x0,x1 in [(170,330),(460,650),(820,1030)]:
        line([(x0,100),(x1,100)],12,255)
        for y in [96.5,100,103.5]: line([(x0,y),(x1,y)],.9,70)
        for x in range(x0,x1+1,40): line([(x,96.5),(x,103.5)],.9,70)
    for door in doors:
        a,b,side=door['a'],door['b'],door['side'];line([a,b],13,255)
        length=math.dist(a,b); nx,ny=-(b[1]-a[1])/length,(b[0]-a[0])/length
        for p in [a,b]: line([(p[0]-nx*3.5,p[1]-ny*3.5),(p[0]+nx*3.5,p[1]+ny*3.5)],1.2)
        if door['kind']=='sliding':
            line([a,((a[0]+b[0])/2,a[1])],1.5)
            line([((a[0]+b[0])/2,b[1]+4),(b[0],b[1]+4)],1.5)
            text((990,474),'SLIDING',11)
        else: swing(a,b,side,door['kind']=='double')
    # Guardrail and overhead canopy, neither is an indoor enclosure wall.
    line([(1100,100),(1300,100),(1300,350),(1100,350)],1,100)
    for a,b in [((1100,87),(1313,87)),((1313,87),(1313,363)),((1313,363),(1100,363))]:
        length=math.dist(a,b)
        for start in range(0,int(length),14):
            line([(a[0]+(b[0]-a[0])*start/length,a[1]+(b[1]-a[1])*start/length),
                  (a[0]+(b[0]-a[0])*min(length,start+7)/length,a[1]+(b[1]-a[1])*min(length,start+7)/length)],.8,120)
    # Loose furniture stays visible; its closed rectangles are not rooms.
    for x in [155,245,335]:
        for y in [180,240]:
            rectangle([x-24,y-14,x+24,y+14],1,90)
            rectangle([x-10,y+17,x+10,y+29],.8,100)
    for x in [490,650]:
        rectangle([x-30,170,x+30,220],1,90);ellipse([x-12,225,x+12,249])
    rectangle([840,170,1010,230],1,90)
    for x in [865,915,965]:
        ellipse([x-10,145,x+10,165]);ellipse([x-10,235,x+10,255])
    for x in [170,280,375]:
        for y in [540,620]: rectangle([x-22,y-17,x+22,y+17],1,90)
    # Three lightweight toilet cubicles, their gates and fixtures.
    for y in [500,560,620,680]: line([(710,y),(845,y)],1,85)
    for y in [500,560,620]:
        line([(710,y),(710,y+20)],1,85);swing((710,y+20),(710,y+56),-1,thin=True)
        rectangle([806,y+18,832,y+31],.8,100);ellipse([800,y+27,835,y+52])
    for y in [520,575,630]: rectangle([445,y,475,y+30],.8,90);ellipse([449,y+4,471,y+25])
    for space in spaces:
        x0,y0,x1,y1=space['box']; y=(y0+y1)/2
        if space['name'] in ['CLASSROOM','OFFICE','MEETING']: y=300
        if space['name']=='STUDIO': y=485
        if space['name']=='RESTROOM': y=490
        label=space['name'].replace('COVERED BALCONY','COVERED\nBALCONY').replace('OPEN COURTYARD','OPEN\nCOURTYARD')
        for i,part in enumerate(label.split('\n')): text(((x0+x1)/2,y+i*23),part,16)
    text((700,775),'Recognition benchmark — synthetic geometry, not a teaching precedent',13)
    image.resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS).save(OUT/f'plan-{style}.png')

truth = dict(width=WIDTH,height=HEIGHT,pixelsPerMetre=40,
    indoorSpaces=6,exteriorSpaces=2,doorways=9,doors=doors,spaces=spaces,walls=walls)
(OUT/'truth.json').write_text(json.dumps(truth,indent=2))

# Independent presentation stress case: the same known architecture in a
# rotated, larger sheet with faint solid walls. Neither JSON is sent to AI.
from copy import deepcopy
angle, scale, dw, dh = math.radians(17), 1.2, 2000, 1400
c,s = math.cos(angle),math.sin(angle)
def transform(p):
    x,y=p[0]-WIDTH/2,p[1]-HEIGHT/2
    return [dw/2+scale*(c*x-s*y),dh/2+scale*(s*x+c*y)]
inverse=(c/scale,s/scale,WIDTH/2-(c*dw+s*dh)/(2*scale),
         -s/scale,c/scale,HEIGHT/2+(s*dw-c*dh)/(2*scale))
source=Image.open(OUT/'plan-solid.png')
rotated=source.transform((dw,dh),Image.Transform.AFFINE,inverse,
                         resample=Image.Resampling.BICUBIC,fillcolor='white')
rotated.point(lambda value:round(165+value*90/255)).save(OUT/'plan-rotated-gray.png')
rotated_truth=deepcopy(truth)
rotated_truth.update(width=dw,height=dh,pixelsPerMetre=40*scale)
for space in rotated_truth['spaces']:
    x0,y0,x1,y1=space.pop('box')
    space['points']=[transform(p) for p in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]]
for door in rotated_truth['doors']:
    door['a'],door['b']=transform(door['a']),transform(door['b'])
rotated_truth['walls']=[[transform(a),transform(b)] for a,b in walls]
(OUT/'truth-rotated-gray.json').write_text(json.dumps(rotated_truth,indent=2))
print(OUT)
