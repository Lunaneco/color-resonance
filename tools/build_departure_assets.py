#!/usr/bin/env python3
"""Animate one registered GPT Image ring at the summoned spirit's fixed foot."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from build_game_assets import gif, contact, write

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (256, 192)

def components(im, threshold=1):
    width, height = im.size
    remaining = {i for i,a in enumerate(im.getchannel('A').get_flattened_data()) if a >= threshold}
    sizes = []
    while remaining:
        queue = [remaining.pop()]
        count = 1
        while queue:
            i = queue.pop(); x,y = i%width,i//width
            for dx,dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                xx,yy = x+dx,y+dy
                if 0 <= xx < width and 0 <= yy < height:
                    j = yy*width+xx
                    if j in remaining:
                        remaining.remove(j); queue.append(j); count += 1
        sizes.append(count)
    return sorted(sizes, reverse=True)

def main():
    records = json.loads((OUT/'departure-set-13.json').read_text())
    manifest = json.loads((OUT/'manifest.json').read_text())
    prompts = json.loads((OUT/'prompts.json').read_text())
    quality = json.loads((OUT/'quality-report.json').read_text())
    ids = {r['id'] for r in records}
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in ids]
    prompts = [p for p in prompts if p['id'] not in ids]
    checks = []
    for rec in records:
        aid = rec['id']
        source = Image.open(OUT/rec['source']).convert('RGBA')
        left,top,right,bottom = rec['sourceCropBoxPx']
        registered = source.crop((left,top,right,bottom))
        ax,ay = rec['sourceAnchorPx']
        px,py = rec['pivotPx']
        core_width = rec['sourceCoreBox96Px'][2]-rec['sourceCoreBox96Px'][0]
        png_cels, gif_cels, paths, registrations = [],[],[],[]
        for i,(envelope,opacity) in enumerate(zip(rec['celScaleEnvelope'],rec['celPngOpacities'],strict=True)):
            scale = rec['peakCoreWidthPx']/core_width*envelope
            sample_scale = scale*rec['supersampleFactor']
            factor = rec['supersampleFactor']
            cel = registered.transform((CELL[0]*factor,CELL[1]*factor),Image.Transform.AFFINE,
                (1/sample_scale,0,ax-left-px*factor/sample_scale,
                 0,1/sample_scale,ay-top-py*factor/sample_scale),resample=Image.Resampling.BICUBIC)
            cel = cel.resize(CELL,Image.Resampling.LANCZOS)
            alpha = cel.getchannel('A')
            for box in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192)]:
                assert alpha.crop(box).getextrema()[1] == 0,(aid,i,'clear edge',box)
            assert alpha.getpixel((px,py)) == 0,(aid,i,'hollow pivot')
            assert alpha.getextrema()[1] >= 96,(aid,i,'empty ring')
            gif_cels.append(cel.copy())
            if opacity != 1:
                cel.putalpha(alpha.point(lambda value:round(value*opacity)))
            path = OUT/f'frames/{aid}/{i:03}.png'
            path.parent.mkdir(parents=True,exist_ok=True); cel.save(path)
            paths.append(path.relative_to(OUT).as_posix()); png_cels.append(cel)
            registrations.append(dict(cel=i,registeredCenterPx=[px,py],uniformScale=scale,
                pngOpacity=opacity,alphaBoxPx=list(cel.getchannel('A').getbbox()),
                pivotAlpha=cel.getchannel('A').getpixel((px,py))))
        assert png_cels[3].tobytes() == png_cels[4].tobytes()
        sheet = Image.new('RGBA',(1024,576))
        for i,cel in enumerate(png_cels):
            sheet.alpha_composite(cel,((i%4)*256,(i//4)*192))
        sheet.save(OUT/f'sheets/{aid}.png')
        blank = Image.new('RGBA',CELL)
        frames = [blank]+gif_cels+[blank]
        durations = [rec['preRollMs']]+rec['celDurationsMs']+[rec['transparentTailMs']]
        preview = gif(OUT/f'gifs/{aid}/preview.gif',frames,durations)
        extension = b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'
        raw = (OUT/preview['gif']).read_bytes(); assert raw.count(extension) == 1
        path = OUT/f'gifs/{aid}/effect.gif'; path.write_bytes(raw.replace(extension,b''))
        with Image.open(path) as im:
            assert 'loop' not in im.info
            decoded = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
            actual_durations = [f.info['duration'] for f in ImageSequence.Iterator(im)]
        assert len(decoded) == 14 and actual_durations == durations and sum(durations) == 1400
        assert decoded[0].getchannel('A').getextrema()[1] == decoded[-1].getchannel('A').getextrema()[1] == 0
        clock = [0]
        for ms in durations: clock.append(clock[-1]+ms)
        gif_end = max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        png_end = max(clock[i+1] for i,f in enumerate([blank]+png_cels+[blank]) if f.getchannel('A').getextrema()[1]>0)
        assert gif_end == png_end == 1000
        areas = [sum(a>0 for a in f.getchannel('A').get_flattened_data()) for f in decoded[1:-1]]
        assert all(a<b for a,b in zip(areas[:3],areas[1:4])) and areas[3] == areas[4]
        assert all(a>b for a,b in zip(areas[4:],areas[5:])),areas
        parts = [components(f) for f in decoded[1:-1]]
        assert all(len(p) == 1 for p in parts),parts
        assert all(f.getchannel('A').getpixel((px,py)) == 0 for f in decoded)
        end_means = [sum((r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a)/area for f,area in zip(decoded[9:13],areas[8:])]
        assert min(end_means) >= 195,end_means
        animation = dict(name=rec['name'],sequence=[None]+list(range(12))+[None],
            durationsMs=durations,frameStartsMs=clock[:-1],loop=False,
            **{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},
            previewGif=preview['gif'],visibleEndMs=1000,pngVisibleEndMs=1000,gifTransparentTailMs=400,
            phases=[dict(name='環が現れ広がる',startMs=40,endMs=280),
                    dict(name='ピーク保持',startMs=280,endMs=440),
                    dict(name='足元に閉じる',startMs=440,endMs=1000)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='summoned-spirit-expiry-return',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),pivotPx=rec['pivotPx'],
            scaleReferenceTileWidthPx=80,direction=rec['direction'],triggerCondition=rec['trigger'],
            productionSet='departure-set-13',animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'one registered hollow master; ring appears at 72% scale then grows and contracts at fixed foot pivot; final GIF raster becomes a tiny open U; 4x affine sampling then Lanczos reduction; no body pixels or particle system',
            'celRegistrations':registrations})
        contact([(f'{i:02} / {clock[i+1]}ms',c) for i,c in enumerate(png_cels)],OUT/f'review/{aid}.jpg',columns=4)
        evidence=[]
        for bg,label in [((21,23,31),'dark'),((242,242,246),'light')]:
            for i in [0,3,8,11]:
                base=Image.new('RGBA',CELL,bg+(255,));base.alpha_composite(png_cels[i])
                d=ImageDraw.Draw(base);d.line((128,100,128,156),fill=(105,130,150,160),width=1)
                evidence.append((f'{label} {i:02}',base))
        contact(evidence,OUT/'review/departure-set-13.png',columns=4)
        checks.append(dict(id=aid,pngCels=12,uniquePngCels=11,gifFrames=14,durationMs=1400,
            visibleEndMs=gif_end,pngVisibleEndMs=png_end,loop=False,firstLastBlank=True,
            transparentTailMs=400,pivotPx=rec['pivotPx'],transparentClearancePx=24,
            sourceRegistration='one measured master anchor; no per-cel crop or centering',
            geometry='one hollow master appears at 72% scale, grows then contracts at fixed foot point; final GIF cel is a tiny open U, not a closed loop',
            onsetNote=rec['onsetNote'],lateRasterTopology=rec['lateRasterTopology'],
            peakHold=dict(cels=[3,4],startMs=280,endMs=440),pivotAlphaZeroAllPngAndGifCels=True,
            bodyOrDamageOrErasureDrawn=False,additionalParticleSystem=False,
            celRegistrations=registrations,gifOpaqueAreas=areas,gifCoreComponentSizes=parts,
            gifVisibleComponents=1,componentAdjacency='8-neighbor; all 12 visible GIF cels',
            gifEndRgbMeans=end_means,pngEndMethod='uniform contraction and partial alpha',
            gifEndMethod='contraction retaining source color; no RGB darkening',
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets']
    manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
        gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['departureSet13']=dict(assetCount=len(records),checks=checks,
        sourceCropAlphaNote=records[0]['sourceCropAlphaNote'],
        independentAudit=records[0]['independentAudit'])
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    print(json.dumps({'counts':manifest['counts'],'checks':checks}))

if __name__=='__main__':
    main()
