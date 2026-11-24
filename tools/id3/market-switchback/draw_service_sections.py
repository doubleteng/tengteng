"""Generate two true transverse sections through the north frontage of Market Crossing."""
import argparse
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
from scipy.spatial import ConvexHull

from check_envelope import read_parts
from geometry import clip, grade


def section_polygon(part, x):
    if not part.lo[0] < x < part.hi[0]:
        return []
    edges = np.vstack([part.faces[:, [0, 1]], part.faces[:, [1, 2]], part.faces[:, [2, 0]]])
    a, b = part.v[edges[:, 0]], part.v[edges[:, 1]]
    spans = ((a[:, 0] < x) & (b[:, 0] >= x)) | ((b[:, 0] < x) & (a[:, 0] >= x))
    a, b = a[spans], b[spans]
    points = a[:, 1:] + ((x-a[:, 0])/(b[:, 0]-a[:, 0]))[:, None] * (b[:, 1:]-a[:, 1:])
    points = np.unique(points.round(6), axis=0)
    if len(points) < 3 or np.linalg.matrix_rank(points-points.mean(axis=0), tol=1e-6) < 2:
        return []
    return points[ConvexHull(points).vertices]


def draw(model, output):
    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', viewBox='0 0 1040 684',
                     role='img', attrib={'aria-labelledby': 'title desc'})
    def add(parent, tag, **attrs):
        return ET.SubElement(parent, tag, {k.replace('_','-'):str(v) for k,v in attrs.items()})
    def text(parent, message, x, y, size=16, **attrs):
        add(parent, 'text', x=x, y=y, font_size=size, **attrs).text=message
    add(svg, 'title', id='title').text='The north frontage in section'
    add(svg, 'desc', id='desc').text='Two transverse cuts taken through the exported model at the public washroom and the raised ceiling over the ground-floor lobby. Both are shown at one scale with the street to the left. The elevation detail below isolates the tapered strip above the second floor.'
    add(svg, 'rect', width=1040, height=684, fill='#f7f6ef')
    drawing=add(svg,'g',font_family='Arial, Helvetica, sans-serif',fill='#263b3b')
    text(drawing,'North frontage in section',24,39,26,font_weight='bold')
    text(drawing,'The street is on the left in both cuts.',24,65,16)
    defs=add(svg,'defs')
    parts=[p for p,_,_ in read_parts(model,False,all_layers=True)
           if p.lo[1]<9.5 and p.hi[1]>-2.0 and p.lo[2]<9.8 and p.hi[2]>1
           and p.layer.startswith(('Structure /','Enclosure /','Interior /','Circulation /'))]
    for i,(station,title) in enumerate(((48.52,'Public washroom'),(54.2,'Ground-floor lobby'))):
        left=24+i*510
        bottom=399
        scale=38
        def point(y,z):
            return left+(y+2.1)*scale,bottom-(z-1.0)*scale
        clip_id=f'cut-{i}'
        add(add(defs,'clipPath',id=clip_id),'rect',x=left,y=80,width=486,height=320)
        panel=add(drawing,'g',clip_path=f'url(#{clip_id})')
        ground=grade(station,0)
        gx,gy=point(-2.2,ground)
        add(panel,'path',d=f'M{gx} {gy}h500',stroke='#84918b',stroke_width=1)
        for elev in (2.50,6.4116):
            _,y=point(0,elev)
            add(panel,'path',d=f'M{left} {y}h492',stroke='#b5bab2',stroke_width=.9,stroke_dasharray='3 5')
        count=0
        for part in parts:
            poly=section_polygon(part, station)
            if not len(poly):continue
            count+=1
            color='#80928b'
            if part.layer.startswith('Enclosure /'):color='#205c65'
            elif 'concrete' in part.material.lower():color='#8e9690'
            elif part.layer.startswith('Interior /'):color='#d6d4c6'
            elif part.material in ('Glulam spruce','CLT spruce','Oiled birch'):color='#bb8753'
            coords=' '.join(f'{X:.2f},{Y:.2f}' for X,Y in (point(y,z) for y,z in poly))
            add(panel,'polygon',points=coords,fill=color,stroke=color,stroke_width=.60)
        if count<20: raise ValueError(f'Insufficient section geometry at station {station}')
        text(drawing,title,left,429,21,font_weight='bold')
    for j,(color,label) in enumerate((('#205c65','Enclosure'),('#bb8753','Timber'),('#8e9690','Concrete'),('#d6d4c6','Interior fit-out'))):
        x=24+j*161
        add(drawing,'rect',x=x,y=453,width=17,height=10,fill=color)
        text(drawing,label,x+24,464,15)
    text(drawing,'0',888,466,14)
    text(drawing,'2 m',970,466,14)
    add(drawing,'path',d='M899 456v5h76v-5',fill='none',stroke='#263b3b',stroke_width=1.6)
    # Isolate the actual cassettes above the finished second-floor datum.
    floor=max(p.hi[2] for p in parts if p.layer=='Structure / Forum and terraces')
    cassettes=[p for p in parts if p.layer in ('Enclosure / Service plinth insulated cassettes',
              'Enclosure / Service plinth sealed joints','Enclosure / Service plinth insulated slab edge')
              and p.lo[1]<1.50 and p.hi[1]>1.45 and p.lo[0]>47.00 and p.hi[2]>floor+.003]
    outlines=[]
    for p in cassettes:
        pts=np.unique(p.v[:,[0,2]].round(6),axis=0)
        if len(pts)<3 or np.linalg.matrix_rank(pts-pts.mean(axis=0))<2:continue
        poly=clip(pts[ConvexHull(pts).vertices].tolist(),1,floor,True)
        if len(poly)>=3:outlines.append((p.layer,poly))
    if not outlines:raise ValueError('Missing tapered upper infill at the north frontage')
    points=[q for _,poly in outlines for q in poly]
    low=min(x for x,_ in points);high=max(x for x,_ in points)
    rise=max(z-floor for _,z in points)
    text(drawing,'North elevation at the second-floor edge',24,518,22,font_weight='bold')
    u=106
    def detail(x,z):
        return 40+(x-low)*u,630-(z-floor)*u
    for layer,poly in outlines:
        coords=' '.join(f'{X:.2f},{Y:.2f}' for X,Y in (detail(*p) for p in poly))
        add(drawing,'polygon',points=coords,fill='#315e63' if 'joints' in layer else '#628989')
    W=(high-low)*u
    add(drawing,'rect',x=37,y=630,width=W+6,height=5,fill='#bb8753')
    text(drawing,f'{high-low:.2f} m',40+W/2-22,665,16)
    add(drawing,'path',d=f'M40 647v5h{W:.2f}v-5',fill='none',stroke='#496360',stroke_width=1)
    text(drawing,'The sloping edge meets a level floor.',633,571,18,font_weight='bold')
    text(drawing,f'The infill tapers from {rise:.2f} m to zero.',633,599,17)
    text(drawing,'The timber chord continues above the joint.',633,625,17)
    ET.ElementTree(svg).write(output,encoding='utf-8',xml_declaration=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    draw(args.model,args.output)
