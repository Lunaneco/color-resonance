#!/usr/bin/env python3
"""Animate generated exterior shell plates with rigid motion and one ground plane."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from build_game_assets import gif, contact, write, RESAMPLE

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (256, 192)


def visible_box(image):
    return image.getchannel('A').point(lambda a: 255 if a >= 96 else 0).getbbox()


def contact_x(image):
    box=visible_box(image); alpha=image.getchannel('A')
    row=[x for x in range(box[0],box[2]) if alpha.getpixel((x,box[3]-1))>=96]
    return sum(row)/len(row)


def prepare_piece(source, spec, gravity, ground):
    crop = source.crop(tuple(spec['cropBoxPx']))
    bounds = visible_box(crop)
    assert bounds
    # Isolate each authored object; maintain one scale throughout its motion.
    box = (max(0, bounds[0]-2), max(0, bounds[1]-2),
           min(crop.width, bounds[2]+2), min(crop.height, bounds[3]+2))
    crop = crop.crop(box)
    scale = spec['targetWidthPx'] / (bounds[2]-bounds[0])
    image = crop.resize((round(crop.width*scale), round(crop.height*scale)), RESAMPLE)
    x0, y0 = spec['startCenterPx']; vx, vy = spec['velocityPxPerSec']

    def flight(t):
        angle = spec['rotationDeg'] + spec['angularVelocityDegPerSec']*t
        rotated = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        bbox = visible_box(rotated)
        x = x0 + vx*t
        y = y0 + vy*t + gravity*t*t/2
        bottom = y - rotated.height/2 + bbox[3]
        return rotated, bbox, x, y, bottom

    # Determine first contact at 1ms resolution using the plate's rotated hull.
    hit = None
    for millis in range(1201):
        rotated, bbox, x, y, bottom = flight(millis/1000)
        if bottom >= ground:
            hit = dict(timeMs=millis, x=x, top=ground-bbox[3],
                       angle=spec['rotationDeg']+spec['angularVelocityDegPerSec']*millis/1000)
            hit['contactPointX']=round(x-rotated.width/2)+contact_x(rotated)
            break
    assert hit is not None and hit['timeMs'] <= 640

    def sample(millis, decay=1):
        if millis >= hit['timeMs']:
            rotated = image.rotate(hit['angle'], resample=Image.Resampling.BICUBIC, expand=True)
            if decay != 1:
                rotated=rotated.resize((max(1,round(rotated.width*decay)),max(1,round(rotated.height*decay))),RESAMPLE)
            bbox = visible_box(rotated)
            left=round(hit['contactPointX']-contact_x(rotated)) if decay!=1 else round(hit['x']-rotated.width/2)
            return rotated, left, ground-bbox[3], True
        assert decay == 1, 'no shrinking before landing'
        rotated, bbox, x, y, bottom = flight(millis/1000)
        return rotated, round(x-rotated.width/2), min(round(y-rotated.height/2), ground-bbox[3]), False

    return sample, dict(name=spec['name'], uniformScale=scale, contactTimeMs=hit['timeMs'],
                        contactCenterX=hit['x'], contactPointX=hit['contactPointX'],contactRotationDeg=hit['angle'])


def main():
    records=json.loads((OUT/'armor-set-08.json').read_text())
    manifest=json.loads((OUT/'manifest.json').read_text())
    prompts=json.loads((OUT/'prompts.json').read_text())
    quality=json.loads((OUT/'quality-report.json').read_text())
    ids={r['id'] for r in records}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids]
    prompts=[a for a in prompts if a['id'] not in ids]
    checks=[]; review_items=[]
    for rec in records:
        aid=rec['id']; source=Image.open(OUT/rec['source']).convert('RGBA')
        samplers=[]; physics=[]
        for piece in rec['pieces']:
            sample, measure=prepare_piece(source,piece,rec['gravityPxPerSec2'],rec['groundY'])
            samplers.append(sample);physics.append(measure)
        cels=[];gif_cels=[];paths=[];positions=[]
        for i,(at,opacity) in enumerate(zip(rec['frameStartsRelativeMs'],rec['celOpacities'],strict=True)):
            cel=Image.new('RGBA',CELL); frame_positions=[]
            for piece,sample in zip(rec['pieces'],samplers,strict=True):
                decay=rec['celDissipationScales'][i]
                image,x,y,landed=sample(at,decay)
                bounds=visible_box(image)
                frame_positions.append(dict(name=piece['name'],x=x,y=y,
                    opaqueBbox=[x+bounds[0],y+bounds[1],x+bounds[2],y+bounds[3]],landed=landed,
                    dissipationScale=decay,contactPointX=x+contact_x(image) if landed else None))
                assert y+bounds[3] <= rec['groundY']
                if opacity != 1:
                    image=image.copy();image.putalpha(image.getchannel('A').point(lambda a:round(a*opacity)))
                cel.alpha_composite(image,(x,y))
            if at >= 720: assert all(p['landed'] for p in frame_positions)
            alpha=cel.getchannel('A')
            for border in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192)]:
                assert alpha.crop(border).getextrema()[1]==0,(aid,i,border)
            path=OUT/f'frames/{aid}/{i:03}.png';path.parent.mkdir(parents=True,exist_ok=True)
            cel.save(path);paths.append(path.relative_to(OUT).as_posix());cels.append(cel)
            # GIF cannot preserve partial alpha. Give its final three cels an
            # explicit color decay, while retaining PNG's original alpha fade.
            gif_cel=cel.copy()
            if opacity != 1:
                channels=[c.point(lambda v:round(v*opacity)) for c in gif_cel.split()[:3]]
                gif_cel=Image.merge('RGBA',(*channels,gif_cel.getchannel('A')))
            gif_cels.append(gif_cel)
            positions.append(dict(cel=i,relativeTimeMs=at,opacity=opacity,pieces=frame_positions))
        sheet=Image.new('RGBA',(1024,576))
        for i,cel in enumerate(cels):sheet.alpha_composite(cel,((i%4)*256,(i//4)*192))
        sheet.save(OUT/f'sheets/{aid}.png')
        blank=Image.new('RGBA',CELL);frames=[blank]+gif_cels+[blank]
        durations=[rec['preRollMs']]+rec['celDurationsMs']+[rec['transparentTailMs']]
        preview=gif(OUT/f'gifs/{aid}/preview.gif',frames,durations)
        destination=OUT/f'gifs/{aid}/effect.gif'
        raw=(OUT/preview['gif']).read_bytes()
        extension=b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'
        assert raw.count(extension)==1
        destination.write_bytes(raw.replace(extension,b''))
        clock=[0]
        for ms in durations:clock.append(clock[-1]+ms)
        with Image.open(destination) as check:
            assert 'loop' not in check.info
            decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(check)]
            gif_times=[f.info['duration'] for f in ImageSequence.Iterator(check)]
        assert len(decoded)==14 and gif_times==durations
        assert decoded[0].getchannel('A').getextrema()[1]==0
        assert decoded[-1].getchannel('A').getextrema()[1]==0
        gif_end=max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        png_end=max(clock[i+1] for i,f in enumerate(frames) if f.getchannel('A').getextrema()[1]>0)
        means=[]
        for f in decoded[9:13]:
            values=[(r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a]
            means.append(sum(values)/len(values))
        assert all(a>b for a,b in zip(means,means[1:]))
        animation=dict(name=rec['name'],sequence=[None]+list(range(12))+[None],durationsMs=durations,
            frameStartsMs=clock[:-1],loop=False,
            **{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},
            previewGif=preview['gif'],visibleEndMs=gif_end,pngVisibleEndMs=png_end,
            gifTransparentTailMs=clock[-1]-gif_end,
            gifEndMethod='after landing, shrink to fixed contact point at .65/.35/.12 plus RGB dimming and binary-alpha edge loss',
            pngEndMethod='after landing, same fixed-contact shrink with partial alpha fade',
            phases=[dict(name='外向き剥離と重力落下',startMs=80,endMs=720),
                    dict(name='着地保持',startMs=720,endMs=800),
                    dict(name='着地後の消失縮小',startMs=800,endMs=1160)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='armor-event',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),pivotPx=rec['pivotPx'],
            scaleReferenceTileWidthPx=80,groundY=128,direction='front-isometric',armorTrigger=rec['trigger'],
            productionSet='armor-set-08',scenes=['spinel','king'],animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'isolated GPT Image plates; fixed scale during outward velocity/gravity; rigid rotation; first-contact ground clamp; stop; shrink only after landing toward fixed contact point, with PNG alpha fade and GIF RGB decay',
            'contactMeasurements':physics,'celPositions':positions})
        guided=[]
        for i,cel in enumerate(cels):
            plate=Image.new('RGBA',CELL,'#182337');d=ImageDraw.Draw(plate)
            d.line([(24,128),(232,128)],fill='#6d869f',width=1)
            d.line([(128,32),(128,156)],fill='#293d52',width=1)
            plate.alpha_composite(cel);guided.append((f'{aid} / {i:02} / {rec["frameStartsRelativeMs"][i]}ms',plate))
        contact(guided,OUT/f'review/{aid}.jpg',columns=4)
        review_items.extend([(aid,cels[4]),(aid+' landed',cels[8])])
        max_fringe=max(c.getchannel('A').crop((0,129,256,192)).getextrema()[1] for c in cels)
        assert all(abs(p['contactPointX']-physical['contactPointX'])<=.5
            for frame in positions for p,physical in zip(frame['pieces'],physics,strict=True) if p['landed'])
        checks.append(dict(id=aid,pngCels=12,gifFrames=14,totalDurationMs=clock[-1],loop=False,
            visibleEndMs=gif_end,pngVisibleEndMs=png_end,gifTransparentTailMs=clock[-1]-gif_end,
            firstAndLastBlank=True,exteriorPlates=len(samplers),noTargetBody=True,groundY=128,
            allOpaqueHullsAboveOrOnGround=True,allPlatesLandedBeforeFade=True,
            contactMeasurements=physics,celPositions=positions,transparentClearancePx=24,
            gifLastFourOpaqueRgbMeans=means,gifColorDecayFactors=[1,.85,.65,.45],
            gifPartialAlpha='not supported; RGB dimming approximates end, PNG keeps actual partial alpha',
            postLandingDissipationScales=rec['celDissipationScales'],maxContactPointRoundingErrorPx=.5,
            maximumPngAlphaBelowGroundLine=max_fringe,
            groundBoundaryScope='opaque alpha>=96 hull; faint antialiased fringe may extend below ground',
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets']
    manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
        gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['armorSet08']=dict(assetCount=2,checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    contact(review_items,OUT/'review/armor-set-08.png',columns=2)
    print(json.dumps(dict(counts=manifest['counts'],checks=[{k:v for k,v in c.items() if k!='celPositions'} for c in checks])))


if __name__=='__main__':main()
