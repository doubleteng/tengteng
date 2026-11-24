"""Build the ID3 proposal's repeatable, neutral finish tiles.

The original color photographs are CC0 assets from Poly Haven
(https://polyhaven.com/license), specifically:
  https://polyhaven.com/a/coated_pine
  https://polyhaven.com/a/plywood
  https://polyhaven.com/a/concrete_wall_007
  https://polyhaven.com/a/concrete_floor_02

The wood photographs supply surface figuring, not scientific species identification.
Material hue and assembly dimensions are specified separately in proposal-finishes.js.
Run: python bake_finishes.py SOURCE_CACHE WEB_ROOT/models/finishes
"""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import argparse

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def photograph(cache, name):
    path = cache / (name + '.jpg')
    if not path.is_file():
        url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{name}/{name}_diff_1k.jpg'
        with urlopen(Request(url, headers={'User-Agent': 'ID3 material study'}), timeout=45) as response:
            content = response.read()
        with Image.open(BytesIO(content)) as image:
            image.verify()
        path.write_bytes(content)
    with Image.open(path) as image:
        return np.array(image.convert('L'), dtype=np.float32)


def standardized(a):
    # Keep natural figure. A robust range prevents a single deep knot from
    # forcing all of the surrounding board into a nearly flat midtone.
    p10, p90 = np.percentile(a, [10, 90])
    return np.clip((a - np.median(a)) / max(6, (p90-p10)/2), -2.8, 2.3)


def rows_from_scan(scan, n, width, height, mean, variation, rng, dark_seam):
    result = np.empty((height, width))
    step = height//n
    source = standardized(scan)
    for j in range(n):
        start = rng.integers(0, len(scan))
        ys = (start + np.arange(round(len(scan)/n))) % len(scan)
        strip = np.roll(source[ys], rng.integers(width), axis=1)
        patch = np.asarray(Image.fromarray(strip.astype('float32')).resize((width,step), Image.Resampling.BICUBIC))
        patch = (mean + rng.uniform(-13, 13)) + variation * patch
        # A thin dark glue line plus a narrow light arris keeps the layup readable.
        patch[0] -= dark_seam
        patch[1] -= dark_seam*.31
        patch[-1] += dark_seam*.13
        result[j*step:(j+1)*step] = patch
    return result


def build(cache, out):
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(3114)
    pine = photograph(cache, 'coated_pine')
    veneer = photograph(cache, 'plywood')
    concrete = standardized(photograph(cache, 'concrete_wall_007'))
    stone = standardized(photograph(cache, 'concrete_floor_02'))

    def write(key, value, quality=84):
        tile = Image.fromarray(np.uint8(np.clip(value, 0, 255))).convert('RGB')
        tile.save(out/(key+'.webp'), format='WEBP', quality=quality, method=6)

    write('glulam',rows_from_scan(pine, 8, 512, 256, 217, 17, rng, 22))
    write('clt',rows_from_scan(pine, 4, 512, 256, 219, 16, rng, 25))

    # A running 2:1 panel layout. Broad contrast changes at the sheet boundary
    # can be read at street distance even when the tiny physical reveal is filtered.
    sheet = np.asarray(Image.fromarray(standardized(veneer)).resize((256,256)))
    birch = np.empty((512,512))
    for row in range(2):
        for col in range(2):
            patch = np.roll(sheet, (rng.integers(256), rng.integers(256)), axis=(0,1))
            patch = 220 + [-9, 5, -2, 12][row*2+col] + 15 * patch
            patch[0] -= 50
            patch[:,0] -= 50
            patch[1] -= 13
            patch[:,1] -= 13
            birch[row*256:(row+1)*256,col*256:(col+1)*256] = patch
    birch[256:] = np.roll(birch[256:], 128, axis=1)
    write('birch-panels', birch)

    form = np.asarray(Image.fromarray(concrete).resize((512,512)))
    write('formed-concrete', 220 + 16*form)
    stone = np.asarray(Image.fromarray(stone).resize((512,512)))
    pavers = 224 + 12*stone
    for j in range(8):
        for i in range(4):
            cell = pavers[j*64:(j+1)*64,i*128:(i+1)*128]
            cell += rng.uniform(-8,8)
            cell[0] -= 50
            cell[:,0] -= 48
            cell[1] -= 12
            cell[:,1] -= 12
        if j%2:
            pavers[j*64:(j+1)*64] = np.roll(pavers[j*64:(j+1)*64],64,axis=1)
    write('court-pavers',pavers)

    noise = rng.normal(size=(256,256))
    sheen = gaussian_filter(noise, (2,14), mode='wrap')
    zinc = 235 + 4*standardized(sheen*700) + 1.7*noise
    write('zinc',zinc,80)

    # Dark cells with subtle, continuous collectors. The whole 2 x 1 m
    # module has no runtime subgeometry and uses one hardware-filtered tile.
    pv = np.full((256,512), 212.)
    for row in range(6):
        for col in range(12):
            left,right = round(col*512/12), round((col+1)*512/12)
            top,bottom = round(row*256/6), round((row+1)*256/6)
            cell=pv[top:bottom,left:right]
            cell += rng.uniform(-3,3)
            cell[:1,:] = 249
            cell[:,:1] = 249
            cell[:, (right-left)//2] = 227
            cell[4::5,:] += 2
    write('pv-cells',pv,91)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    build(args.cache,args.output)
