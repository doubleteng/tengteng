"""Draw both ground-support plans directly from two registered Market Crossing GLBs."""
import argparse
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
from scipy.spatial import ConvexHull

from check_envelope import read_parts
from geometry import clip


RAMP_DECKS = {
    'Market arcade inclines', 'Market turn', 'Arcade ground landing',
    'Forum threshold', 'Forum approach bridge', 'Forum vestibule link',
}
OLD_COLUMNS = {
    'Market turn posts', 'Forum gallery columns', 'Walk support trestles',
    'Arcade timber posts',
}


def outlines(model):
    roofs, ramps, counters, columns = [], [], [], {}
    for part, _, _ in read_parts(model, True, all_layers=True):
        system, _, name = part.layer.partition(' / ')
        if system == 'Structure' and name == 'CLT market roof deck':
            roofs.append(part)
        elif system == 'Market' and name == '120 vendor tables':
            counters.append(part)
        elif system == 'Circulation' and name in RAMP_DECKS:
            ramps.append(part)
        elif system == 'Structure' and part.lo[1] > 18.3 and part.hi[1] < 59.0:
            dx, dy, dz = part.hi - part.lo
            # Keep the footprint of the lowest timber segment on each axis.
            # This excludes guard posts, downpipes, upper bearing blocks and knees.
            if part.material not in ('Douglas-fir glulam', 'Glulam spruce'):
                continue
            if name not in OLD_COLUMNS and (max(dx, dy) > .80 or dz < .62
                    or not any(k in name.lower() for k in ('post', 'column', 'mast', 'pier', 'market frame'))):
                continue
            if part.lo[2] > 3.3:
                continue
            x, y = (part.lo[:2] + part.hi[:2]) * .5
            key = round(x, 3), round(y, 3)
            if key not in columns or part.lo[2] < columns[key].lo[2]:
                columns[key] = part
    return roofs, ramps, counters, columns


def write_drawing(before, after, output):
    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', viewBox='0 0 1040 797',
                     role='img', attrib={'aria-labelledby': 'title desc'})
    def add(parent, tag, **attrs):
        return ET.SubElement(parent, tag, {k.replace('_', '-'): str(v) for k, v in attrs.items()})
    def label(parent, s, x, y, size, **attrs):
        add(parent, 'text', x=x, y=y, font_size=size, **attrs).text = s
    add(svg, 'title', id='title').text = 'Market roof and ramp columns at grade'
    add(svg, 'desc', id='desc').text = ('Two plans at the same scale show the locations of the '
        'ground-bearing timber columns before and after the roof and walk frames were coordinated.')
    add(svg, 'rect', width=1040, height=797, fill='#f9faf4')
    base = add(svg, 'g', font_family='Arial, Helvetica, sans-serif', fill='#284447')
    label(base, 'Market roof and ramp columns at grade', 24, 40, 29, font_weight='bold')
    label(base, 'Fourth Avenue is at the left. Detroit Street cuts diagonally across the east ends of the stalls.', 24, 68, 17)
    factor = 7.28
    for i, (model, heading) in enumerate(((before, 'Previous frame'), (after, 'Coordinated frame'))):
        roofs, ramps, counters, columns = outlines(model)
        if not roofs or not ramps or not columns:
            raise ValueError('Missing support-plan geometry')
        left, upper = 98, 114 + i * 332
        def xy(x,y):
            # Screen east is to the right and south is down.
            return left + factor * x, upper + factor * (y-18)
        def footprint(group, part, color):
            pts = np.unique(part.v[:, :2].round(5), axis=0)
            hull = pts[ConvexHull(pts).vertices]
            path = ' '.join(f'{X:.2f},{Y:.2f}' for X,Y in (xy(x,y) for x,y in hull))
            add(group, 'polygon', points=path, fill=color, stroke=color, stroke_width='.55')
        label(base, heading, 24, upper-13, 20, font_weight='bold')
        panel = add(base, 'g', aria_label=heading)
        for part in roofs:
            footprint(panel, part, '#dde4d9')
        for part in counters:
            footprint(panel, part, '#bfcbbd')
        for part in ramps:
            footprint(panel, part, '#f4c5a6')
        for (x,y), part in sorted(columns.items()):
            X,Y=xy(x,y)
            a = add(panel, 'circle', cx=f'{X:.2f}', cy=f'{Y:.2f}', r=2.65,
                    fill='#203f42', stroke='#ffffff', stroke_width='.48')
            name=part.layer.split(' / ')[-1]
            add(a,'title').text=f'{name} · {x:.2f} m east, {y:.2f} m south'
        # Enlarge the two model areas where few-decimetre gaps disappear at block scale.
        zoom = add(base, 'g')
        label(zoom, 'Ramp / canopy', 695, upper+20, 15, font_weight='bold')
        label(zoom, 'Stall roof seam', 865, upper+20, 15, font_weight='bold')
        for j,(cy,low,high) in enumerate(((22.75,19.9,25.65),(36.15,34.15,38.15))):
            x0,y0=695+j*170,upper+31
            add(zoom,'rect',x=x0,y=y0,width=151,height=174,rx=3,fill='#f0f1e9',stroke='#c7d0c5')
            # Station 26.6 lies at a former roof / ramp near-duplicate.
            # The stall-roof seam is cut by the adjacent frame at station 23.
            xmin = 22.55 if j == 0 else 18.85
            xmax = xmin + 8.30
            def inset(x,y):
                return x0+7+(x-xmin)*16.5, y0+87+(y-cy)*16.5
            detail=add(zoom,'g')
            for members, fill in ((roofs,'#dde4d9'), (counters,'#bfcbbd'), (ramps,'#f4c5a6')):
                for part in members:
                    if part.hi[0]<xmin or part.lo[0]>xmax or part.hi[1]<cy-6 or part.lo[1]>cy+6:
                        continue
                    pts=np.unique(part.v[:,:2].round(5),axis=0)
                    hull=pts[ConvexHull(pts).vertices].tolist()
                    for axis, limit, above in ((0,xmin-7/16.5,True), (0,xmin+144/16.5,False),
                                                (1,cy-87/16.5,True), (1,cy+87/16.5,False)):
                        hull=clip(hull,axis,limit,above)
                        if not hull:
                            break
                    if len(hull)<3:
                        continue
                    points=' '.join(f'{X:.2f},{Y:.2f}' for X,Y in (inset(x,y) for x,y in hull))
                    add(detail,'polygon',points=points,fill=fill,stroke=fill,stroke_width='.4')
            for (x,y),p in columns.items():
                if xmin <= x <= xmax and low<y<high:
                    X,Y=inset(x,y)
                    w,h=(p.hi[:2]-p.lo[:2])*16.5
                    add(detail,'rect',x=f'{X-w/2:.2f}',y=f'{Y-h/2:.2f}',width=f'{w:.2f}',
                        height=f'{h:.2f}',fill='#203f42')
            label(zoom, '8.3 m along the street', x0, y0+192, 12)
        label(panel, f'{len(columns)} timber support axes', 695, upper+265, 18, font_weight='bold')
    for x, color, name in ((24,'#203f42','Column axis'),(208,'#f4c5a6','Ramp or landing'),(430,'#dde4d9','Canopy over vendors')):
        add(base,'rect',x=x,y=766,width=18,height=12,fill=color)
        label(base,name,x+26,778,15)
    add(base,'path',d='M860 769v6h72.8v-6',fill='none',stroke='#284447',stroke_width='2')
    label(base,'10 m',944,778,15)
    output.write_bytes(ET.tostring(svg, encoding='utf-8') + b'\n')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for arg in ('previous','current','output'):
        parser.add_argument(arg,type=Path)
    args=parser.parse_args()
    write_drawing(args.previous,args.current,args.output)
