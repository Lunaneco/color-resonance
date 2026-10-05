#!/usr/bin/env python3
"""Register one GPT Image trace once, then translate it through a fixed target."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from build_game_assets import gif, contact, write

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (256, 192)

def component_sizes(im, threshold=96):
    alpha = im.getchannel('A')
    width, height = im.size
    data = list(alpha.get_flattened_data())
    remaining = {i for i, a in enumerate(data) if a >= threshold}
    sizes = []
    while remaining:
        start = remaining.pop()
        queue = [start]
        count = 1
        while queue:
            i = queue.pop()
            x, y = i % width, i // width
            for dx, dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                xx, yy = x + dx, y + dy
                if 0 <= xx < width and 0 <= yy < height:
                    j = yy * width + xx
                    if j in remaining:
                        remaining.remove(j)
                        queue.append(j)
                        count += 1
        sizes.append(count)
    return sorted(sizes, reverse=True)

def main():
    records = json.loads((OUT / 'passage-set-12.json').read_text())
    manifest = json.loads((OUT / 'manifest.json').read_text())
    prompts = json.loads((OUT / 'prompts.json').read_text())
    quality = json.loads((OUT / 'quality-report.json').read_text())
    ids = {r['id'] for r in records}
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in ids]
    prompts = [p for p in prompts if p['id'] not in ids]
    checks = []
    for rec in records:
        aid = rec['id']
        source = Image.open(OUT / rec['source']).convert('RGBA')
        left, top, right, bottom = rec['sourceCropBoxPx']
        registered = source.crop((left, top, right, bottom))
        anchor_x, anchor_y = rec['sourceAnchorPx']
        core_width = rec['sourceCoreBox96Px'][2] - rec['sourceCoreBox96Px'][0]
        png_cels, gif_cels, paths, cel_checks = [], [], [], []
        for i, (center, envelope, opacity) in enumerate(zip(rec['celCenterXPx'], rec['celScaleEnvelope'], rec['celPngOpacities'], strict=True)):
            scale = rec['peakCoreWidthPx'] / core_width * envelope
            cel = registered.transform(CELL, Image.Transform.AFFINE,
                (1/scale, 0, anchor_x-left-center/scale,
                 0, 1/scale, anchor_y-top-96/scale), resample=Image.Resampling.BICUBIC)
            alpha = cel.getchannel('A')
            for box in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192)]:
                assert alpha.crop(box).getextrema()[1] == 0, (aid, i, 'clear edge', box)
            assert alpha.getextrema()[1] >= 96, (aid, i, 'empty trace')
            gif_cels.append(cel.copy())
            if opacity != 1:
                cel.putalpha(alpha.point(lambda value: round(value*opacity)))
            path = OUT / f'frames/{aid}/{i:03}.png'
            path.parent.mkdir(parents=True, exist_ok=True)
            cel.save(path)
            png_cels.append(cel)
            paths.append(path.relative_to(OUT).as_posix())
            cel_checks.append(dict(cel=i, registeredCenterPx=[center,96], uniformScale=scale,
                pngOpacity=opacity, alphaBoxPx=list(cel.getchannel('A').getbbox()),
                preOpacityCoreComponents96=component_sizes(gif_cels[-1])))
        assert all(a < b for a,b in zip(rec['celCenterXPx'], rec['celCenterXPx'][1:]))
        sheet = Image.new('RGBA', (1024,576))
        for i, cel in enumerate(png_cels):
            sheet.alpha_composite(cel, ((i%4)*256,(i//4)*192))
        sheet.save(OUT / f'sheets/{aid}.png')
        blank = Image.new('RGBA', CELL)
        frames = [blank] + gif_cels + [blank]
        durations = [rec['preRollMs']] + rec['celDurationsMs'] + [rec['transparentTailMs']]
        preview = gif(OUT / f'gifs/{aid}/preview.gif', frames, durations)
        extension = b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'
        raw = (OUT / preview['gif']).read_bytes()
        assert raw.count(extension) == 1
        path = OUT / f'gifs/{aid}/effect.gif'
        path.write_bytes(raw.replace(extension,b''))
        with Image.open(path) as im:
            assert 'loop' not in im.info
            decoded = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
            actual_durations = [f.info['duration'] for f in ImageSequence.Iterator(im)]
        assert len(decoded) == 14 and actual_durations == durations and sum(durations) == 700
        assert decoded[0].getchannel('A').getextrema()[1] == decoded[-1].getchannel('A').getextrema()[1] == 0
        clock = [0]
        for ms in durations:
            clock.append(clock[-1]+ms)
        gif_end = max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        png_end = max(clock[i+1] for i,f in enumerate([blank]+png_cels+[blank]) if f.getchannel('A').getextrema()[1]>0)
        assert gif_end == png_end == 500
        areas = [sum(a>0 for a in f.getchannel('A').get_flattened_data()) for f in decoded[1:-1]]
        assert all(a>b for a,b in zip(areas[5:],areas[6:])), areas
        components = [component_sizes(f,1) for f in decoded[1:-1]]
        assert all(len(parts) == 1 for parts in components), components
        end_means = [sum((r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a)/area for f,area in zip(decoded[9:13],areas[8:])]
        assert min(end_means) >= 200, end_means
        animation = dict(name=rec['name'], sequence=[None]+list(range(12))+[None],
            durationsMs=durations, frameStartsMs=clock[:-1], loop=False,
            **{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},
            previewGif=preview['gif'], visibleEndMs=500, pngVisibleEndMs=500, gifTransparentTailMs=200,
            phases=[dict(name='止まらず右へ通り抜ける',startMs=20,endMs=500)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='non-hit-passage',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),pivotPx=rec['pivotPx'],
            scaleReferenceTileWidthPx=80,direction=rec['direction'],triggerCondition=rec['trigger'],
            productionSet='passage-set-12',animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'single registered generated trace; uniform scaling plus monotonic rightward translation; no target pixels or particle system',
            'celRegistrations':cel_checks})
        contact([(f'{i:02} / {clock[i+1]}ms',c) for i,c in enumerate(png_cels)],OUT/f'review/{aid}.jpg',columns=4)
        evidence=[]
        for bg,label in [((21,23,31),'dark'),((242,242,246),'light')]:
            for i in [2,5,8,11]:
                base=Image.new('RGBA',CELL,bg+(255,));base.alpha_composite(png_cels[i])
                d=ImageDraw.Draw(base);d.line((128,24,128,168),fill=(105,130,150,160),width=1)
                evidence.append((f'{label} {i:02}',base))
        contact(evidence,OUT/'review/passage-set-12.png',columns=4)
        checks.append(dict(id=aid,pngCels=12,gifFrames=14,durationMs=700,visibleEndMs=gif_end,pngVisibleEndMs=png_end,
            loop=False,firstLastBlank=True,transparentTailMs=200,pivotPx=rec['pivotPx'],transparentClearancePx=24,
            sourceRegistration='one measured master anchor; no per-cel crop or centering',
            geometry='one generated trace, monotonic rightward translation, uniform scale',
            targetBodyOrDamageOrErasureDrawn=False,additionalParticleSystem=False,celRegistrations=cel_checks,
            gifOpaqueAreas=areas,gifCoreComponentSizes=components,
            gifVisibleComponents=1,componentAdjacency='8-neighbor; all 12 visible GIF cels',
            gifEndRgbMeans=end_means,pngEndMethod='uniform contraction and partial alpha',gifEndMethod='contraction retaining source color; no RGB darkening',
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets']
    manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
        gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['passageSet12']=dict(assetCount=len(records),checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    print(json.dumps({'counts':manifest['counts'],'checks':checks}))

if __name__=='__main__':
    main()
