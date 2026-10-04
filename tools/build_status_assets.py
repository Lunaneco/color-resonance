#!/usr/bin/env python3
"""Export fixed-geometry status loops from single GPT Image masters."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageSequence, ImageDraw
from build_game_assets import gif, contact, write, RESAMPLE

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (256, 192)
SEQUENCE = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]
DURATIONS = [160, 120, 120, 120, 120, 160, 160, 120, 120, 120, 120, 160]

def main():
    records = json.loads((OUT / 'status-set-06.json').read_text())
    manifest = json.loads((OUT / 'manifest.json').read_text())
    prompts = json.loads((OUT / 'prompts.json').read_text())
    quality = json.loads((OUT / 'quality-report.json').read_text())
    ids = {r['id'] for r in records}
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in ids]
    prompts = [a for a in prompts if a['id'] not in ids]
    checks = []
    for rec in records:
        aid = rec['id']; source = Image.open(OUT / rec['source']).convert('RGBA')
        crop = tuple(rec['cropBoxPx']); master = source.crop(crop)
        scale = rec['uniformScale']; px, py = rec['sourcePivotPx']; ax, ay = rec['pivotPx']
        # One transform for the entire asset; never fit individual animation cels.
        base = master.transform(CELL, Image.Transform.AFFINE,
            (1 / scale, 0, px - crop[0] - ax / scale,
             0, 1 / scale, py - crop[1] - ay / scale),
            resample=Image.Resampling.BICUBIC)
        alpha = base.getchannel('A'); cels = []
        for brightness in rec['brightnessFactors']:
            channels = [channel.point(lambda v, k=brightness: round(v * k)) for channel in base.split()[:3]]
            cel = Image.merge('RGBA', (*channels, alpha)); cels.append(cel)
        assert alpha.getpixel((ax, ay)) == 0
        assert max(alpha.crop((0, 0, 24, CELL[1])).getextrema()) == 0
        assert max(alpha.crop((CELL[0]-24, 0, CELL[0], CELL[1])).getextrema()) == 0
        assert max(alpha.crop((0, 0, CELL[0], 24)).getextrema()) == 0
        assert max(alpha.crop((0, CELL[1]-24, CELL[0], CELL[1])).getextrema()) == 0
        paths = []
        for i, cel in enumerate(cels):
            path = OUT / f'frames/{aid}/{i:03}.png'; path.parent.mkdir(parents=True, exist_ok=True)
            cel.save(path); paths.append(path.relative_to(OUT).as_posix())
        sheet = Image.new('RGBA', (CELL[0]*3, CELL[1]*2))
        for i, cel in enumerate(cels): sheet.alpha_composite(cel, ((i%3)*CELL[0], (i//3)*CELL[1]))
        sheet_path = OUT / f'sheets/{aid}.png'; sheet.save(sheet_path)
        spec = gif(OUT / f'gifs/{aid}/status.gif', [cels[i] for i in SEQUENCE], DURATIONS)
        frames = []
        with Image.open(OUT / spec['gif']) as im:
            assert im.info['loop'] == 0
            for frame in ImageSequence.Iterator(im): frames.append(frame.convert('RGBA').copy())
        assert frames[0].tobytes() == frames[-1].tobytes()
        assert len({f.getchannel('A').tobytes() for f in frames}) == 1
        assert all(f.getchannel('A').getpixel((ax, ay)) == 0 for f in frames)
        assert len({f.getchannel('A').tobytes() for f in cels}) == 1
        spec['gifRepeatsForPreview'] = False
        animation = dict(name=rec['name']+'（状態継続）', sequence=SEQUENCE,
            durationsMs=DURATIONS, loop=True, **spec,
            semanticLoop='while unit status is active',
            frameStartsMs=[sum(DURATIONS[:i]) for i in range(len(DURATIONS))])
        footprint = alpha.point(lambda v: 255 if v >= 96 else 0).getbbox()
        asset = dict(id=aid, name=rec['name'], category='fx', assetRole='status',
            statusCondition=rec['statusCondition'], facing='floor-isometric',
            source=rec['source'], sourceSize=list(source.size), sheet=f'sheets/{aid}.png',
            frames=paths, grid=dict(columns=3, rows=2, cellSize=list(CELL), order='row-major'),
            pivotPx=rec['pivotPx'], footprintWidthPx=footprint[2]-footprint[0],
            placement=rec['placement'], productionSet='status-set-06',
            animations={'status':animation})
        manifest['assets'].append(asset)
        prompts.append({**rec, 'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'single GPT Image master; fixed alpha/geometry; RGB brightness pulse only'})
        contact([(f'{aid} / {i}', c) for i,c in enumerate(cels)], OUT/f'review/{aid}.jpg',columns=3)
        checks.append(dict(id=aid, cellSize=list(CELL), pngCels=6, gifFrames=12,
            durationMs=sum(DURATIONS), loop=True, firstLastGifBytesIdentical=True,
            allPngAlphaIdentical=True, allGifAlphaIdentical=True, pivotPx=rec['pivotPx'],
            pivotAlpha=0, transparentClearancePx=24, gifAlphaThreshold=96,
            actualGamePlacement='not verified', continuousVisualPlayback='not verified'))
    assets = manifest['assets']
    manifest['counts'] = dict(characters=sum(a['category']!='fx' for a in assets),
        effects=sum(a['category']=='fx' for a in assets), sourceSheets=len(assets),
        pngCels=sum(len(a['frames']) for a in assets),
        gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['statusSet06'] = dict(assetCount=2, checks=checks)
    write(OUT/'manifest.json', manifest); write(OUT/'prompts.json', prompts); write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets], OUT/'overview.jpg',columns=6)
    overview=Image.new('RGB',(768,768),'#152033'); draw=ImageDraw.Draw(overview)
    for col, rec in enumerate(records):
        for row, bg in enumerate(['#182337','#e8eef3']):
            plate=Image.new('RGBA',(384,384),bg); cel=Image.open(OUT/f'frames/{rec["id"]}/005.png').convert('RGBA')
            plate.alpha_composite(cel,(64,96)); overview.paste(plate.convert('RGB'),(col*384,row*384))
            draw.text((col*384+20,row*384+20), rec['id']+' / dark' if row==0 else rec['id']+' / light',fill='white' if row==0 else '#172332')
    overview.save(OUT/'review/status-set-06.png')
    print(json.dumps(dict(counts=manifest['counts'],checks=checks),ensure_ascii=False))

if __name__ == '__main__': main()
