#!/usr/bin/env python3
"""Build Kaoru's sprite set from the user-supplied pixel-art reference sheet.

The reference (art-source/kaoru/reference.webp) is a tactics-style character sheet.
This tool does not redraw the character: it cuts the battle-animation poses out of the
sheet (flood-fill background removal, ground-shadow removal), places them on the game's
4 x 2 cel grid at one common scale and baseline, then runs the normal derived-file steps
(frames, sheet, GIFs, review sheet, manifest, catalog, quality records).
Requires Pillow, numpy and scipy.  Rebuild with: python3 tools/build_kaoru_assets.py
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
REF = ROOT / 'art-source/kaoru/reference.webp'
spec = importlib.util.spec_from_file_location('bga', ROOT / 'tools/build_game_assets.py')
bga = importlib.util.module_from_spec(spec); spec.loader.exec_module(bga)

BG = np.array([238, 236, 232.])
# Battle-animation row of the reference sheet (labels sit below these boxes).
BOXES = {'idle': (55, 530, 172, 722), 'walk': (232, 530, 350, 722), 'run': (396, 530, 527, 722),
         'win': (1268, 530, 1400, 722)}
SRC_CELL = (384, 512)          # source sheet is 1536 x 1024 like the other characters
SCALE = 2.45                   # one scale for every pose
FOOT_Y = int(SRC_CELL[1] * .90)


def extract(name):
    x0, y0, x1, y1 = BOXES[name]
    sub = np.array(Image.open(REF).convert('RGB')).astype(float)[y0:y1, x0:x1]
    h, w, _ = sub.shape
    d = np.sqrt(((sub - BG) ** 2).sum(2)); L = sub.mean(2)
    lab, _ = ndimage.label(d < 30)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(border))
    yfoot = np.where(fg & (L < 72))[0].max()
    yy = np.arange(h)[:, None] * np.ones((1, w))
    warm = (sub[..., 0] - sub[..., 2]) > 12            # skin / brown shoes stay
    shadow = fg & (L >= 80) & (L <= 232) & (yy > yfoot - 34) & ~warm
    shadow |= fg & (yy > yfoot + 1)
    shadow |= fg & (yy > yfoot - 16) & (L > 120) & ~warm   # pale ground patches between the feet
    fg &= ~shadow
    fg = ndimage.binary_opening(fg, iterations=1) | (fg & (L < 70))
    lab2, n = ndimage.label(ndimage.binary_closing(fg, iterations=1))
    sizes = ndimage.sum(np.ones_like(d), lab2, range(1, n + 1))
    fg &= lab2 == (np.argmax(sizes) + 1)
    fg = ndimage.binary_fill_holes(fg) & ~((d < 26) & (yy > h * .66))   # paper-coloured gaps between the legs stay clear
    band = fg & ~ndimage.binary_erosion(fg, iterations=2)
    fg &= ~(band & (L > 118) & ~warm)                      # pale anti-alias halo; the real outline is dark
    lab3, n3 = ndimage.label(fg)
    fg &= lab3 == (np.argmax(ndimage.sum(np.ones_like(d), lab3, range(1, n3 + 1))) + 1)
    rim = fg & ~ndimage.binary_erosion(fg, iterations=2)
    a = np.where(fg, 1.0, 0.0)
    a = np.where(rim, np.clip((d - 8) / 36, .35, 1), a)
    aa = np.maximum(a, .35)[..., None]
    rgb = np.where(rim[..., None], np.clip((sub - BG * (1 - aa)) / aa, 0, 255), sub)
    im = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


def place(cell, sprite, dx=0, dy=0, angle=0, flip=False):
    s = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else sprite
    s = s.resize((round(s.width * SCALE), round(s.height * SCALE)), Image.Resampling.LANCZOS)
    s = s.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    if angle:
        s = s.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True, center=(s.width / 2, s.height))
    cell.alpha_composite(s, (round(SRC_CELL[0] / 2 - s.width / 2 + dx), round(FOOT_Y - s.height + dy)))


def main():
    poses = {n: extract(n) for n in BOXES}
    cells = [Image.new('RGBA', SRC_CELL) for _ in range(8)]
    idle, walk, win = poses['idle'], poses['walk'], poses['win']
    place(cells[0], idle)                          # 0 idle
    place(cells[1], idle, dy=5)                    # 1 breathing
    place(cells[2], walk)                          # 2 left step
    place(cells[3], walk, flip=True)               # 3 right step (mirrored)
    place(cells[4], idle, dy=-7, angle=-1.6)       # 4 speaking, nod up
    place(cells[5], idle, dy=1, angle=1.6)         # 5 speaking, settling
    place(cells[6], win)                           # 6 greeting, hand raised
    place(cells[7], win, dy=-9)                    # 7 greeting, lifted
    sheet = Image.new('RGBA', (SRC_CELL[0] * 4, SRC_CELL[1] * 2))
    for i, c in enumerate(cells): sheet.alpha_composite(c, ((i % 4) * SRC_CELL[0], (i // 4) * SRC_CELL[1]))
    target = OUT / 'source/kaoru.png'; sheet.save(target)
    alpha = sheet.getchannel('A').getextrema(); assert alpha[0] == 0 and alpha[1] > 200

    frames = []
    for i, c in enumerate(cells):
        f = c.resize(bga.CELL, bga.RESAMPLE); (OUT / f'frames/kaoru').mkdir(parents=True, exist_ok=True)
        f.save(OUT / f'frames/kaoru/{i:03d}.png'); frames.append(f)
    out_sheet = Image.new('RGBA', (bga.CELL[0] * 4, bga.CELL[1] * 2))
    for i, f in enumerate(frames): out_sheet.alpha_composite(f, ((i % 4) * bga.CELL[0], (i // 4) * bga.CELL[1]))
    out_sheet.save(OUT / 'sheets/kaoru.png')

    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    entry = next(a for a in manifest['assets'] if a['id'] == 'kaoru')
    pal = bga.palette_for(frames)
    for key in ['idle', 'walk', 'talk', 'greet']:
        label, indices, durations, loop = bga.ANIMS[key]
        spec_ = bga.gif(OUT / f'gifs/kaoru/{key}.gif', [frames[i] for i in indices], durations, pal)
        entry['animations'][key] = {'name': label, 'sequence': indices, 'durationsMs': durations, 'loop': loop, **spec_}
    entry['pixelArt'] = True
    entry['reference'] = 'art-source/kaoru/reference.webp'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    (OUT / 'catalog-data.js').write_text('window.COLOR_ASSETS = ' + json.dumps(manifest, ensure_ascii=False) + ';\n', encoding='utf8')

    bga.contact([(f'kaoru / {i + 1}', f) for i, f in enumerate(frames)], OUT / 'review/kaoru.jpg')
    items = []
    for a in manifest['assets']:
        items.append((a['name'], Image.open(OUT / a['frames'][4 if a['category'] == 'fx' else 0]).convert('RGBA')))
    bga.contact(items, OUT / 'overview.jpg')

    quality = json.loads((OUT / 'quality-report.json').read_text(encoding='utf8'))
    for rec in quality['alpha']:
        if rec['id'] == 'kaoru': rec.update(sourceSize=list(sheet.size), alphaRange=list(alpha))
    (OUT / 'quality-report.json').write_text(json.dumps(quality, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    prompts = json.loads((OUT / 'prompts.json').read_text(encoding='utf8'))
    for rec in prompts:
        if rec['id'] == 'kaoru':
            rec.clear(); rec.update(id='kaoru', name='馨（カオル）', category='npc', tool='user-supplied reference sheet (cut out, not regenerated)',
                reference='art-source/kaoru/reference.webp', file='source/kaoru.png',
                subject='Kaoru as drawn in the supplied tactics-style pixel-art sheet: messy black hair, navy hooded jacket over a gray tee, black trousers.',
                poses='cel 1 idle / 2 breathing / 3-4 walk (mirrored) / 5-6 speaking (nod) / 7-8 greeting (raised hand) from the sheet\'s battle poses',
                processing='flood-fill background removal, ground-shadow removal, one scale and baseline, Lanczos resize with light unsharp mask',
                sheetSha256=hashlib.sha256((OUT / 'sheets/kaoru.png').read_bytes()).hexdigest())
    (OUT / 'prompts.json').write_text(json.dumps(prompts, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('kaoru rebuilt', sheet.size, alpha)


if __name__ == '__main__':
    main()
