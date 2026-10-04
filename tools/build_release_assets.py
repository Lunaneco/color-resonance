#!/usr/bin/env python3
"""Export two-piece exterior-wrapper detachment; no character or new particles."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from build_game_assets import gif, contact, write, RESAMPLE

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'
CELL=(256,192)

def visible_box(image):
    return image.getchannel('A').point(lambda a:255 if a>=96 else 0).getbbox()

def main():
    records=json.loads((OUT/'release-set-09.json').read_text())
    manifest=json.loads((OUT/'manifest.json').read_text())
    prompts=json.loads((OUT/'prompts.json').read_text())
    quality=json.loads((OUT/'quality-report.json').read_text())
    ids={r['id'] for r in records}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids]
    prompts=[a for a in prompts if a['id'] not in ids]
    checks=[];review_items=[]
    for rec in records:
        aid=rec['id'];source=Image.open(OUT/rec['source']).convert('RGBA')
        pieces=[];scales=[]
        for spec in rec['pieces']:
            original=source.crop(tuple(spec['cropBoxPx']));box=visible_box(original);assert box
            crop=original.crop((max(0,box[0]-2),max(0,box[1]-2),min(original.width,box[2]+2),min(original.height,box[3]+2)))
            scale=spec['targetWidthPx']/(box[2]-box[0]);scales.append(scale)
            pieces.append(crop.resize((round(crop.width*scale),round(crop.height*scale)),RESAMPLE))
        cels=[];gif_cels=[];paths=[];positions=[]
        for i,at in enumerate(rec['frameStartsRelativeMs']):
            cel=Image.new('RGBA',CELL);gif_layer=Image.new('RGBA',CELL);info=[];decay=rec['celDissipationScales'][i]
            assert decay==1 if at<640 else True
            for master,spec in zip(pieces,rec['pieces'],strict=True):
                angle=spec['rotationDeg']+spec['angularVelocityDegPerSec']*at/1000
                image=master.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
                if decay!=1:image=image.resize((max(1,round(image.width*decay)),max(1,round(image.height*decay))),RESAMPLE)
                x=spec['startCenterPx'][0]+spec['velocityPxPerSec'][0]*at/1000
                y=spec['startCenterPx'][1]+spec['velocityPxPerSec'][1]*at/1000
                image=image.copy();opacity=rec['celOpacities'][i]
                if opacity!=1:image.putalpha(image.getchannel('A').point(lambda a:round(a*opacity)))
                cel.alpha_composite(image,(round(x-image.width/2),round(y-image.height/2)))
                if 'gifDissipationAnchorTimeMs' in rec:
                    gif_at=min(at,rec['gifDissipationAnchorTimeMs'])
                    gif_angle=spec['rotationDeg']+spec['angularVelocityDegPerSec']*gif_at/1000
                    gif_image=master.rotate(gif_angle,resample=Image.Resampling.BICUBIC,expand=True)
                    gif_decay=rec['gifDissipationScales'][i]
                    if gif_decay!=1:gif_image=gif_image.resize((max(1,round(gif_image.width*gif_decay)),max(1,round(gif_image.height*gif_decay))),RESAMPLE)
                    gif_x=spec['startCenterPx'][0]+spec['velocityPxPerSec'][0]*gif_at/1000
                    gif_y=spec['startCenterPx'][1]+spec['velocityPxPerSec'][1]*gif_at/1000
                    gif_layer.alpha_composite(gif_image,(round(gif_x-gif_image.width/2),round(gif_y-gif_image.height/2)))
                info.append(dict(name=spec['name'],centerPx=[x,y],rotationDeg=angle,dissipationScale=decay))
            alpha=cel.getchannel('A')
            for border in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192),tuple(rec['centralClearWindowPx'])]:
                assert alpha.crop(border).getextrema()[1]==0,(aid,i,border)
            path=OUT/f'frames/{aid}/{i:03}.png';path.parent.mkdir(parents=True,exist_ok=True);cel.save(path)
            paths.append(path.relative_to(OUT).as_posix());cels.append(cel)
            factor=rec['gifRgbDecayFactors'][i]
            gif_cel=gif_layer if 'gifDissipationAnchorTimeMs' in rec else cel.copy()
            if factor!=1:
                channels=[c.point(lambda v:round(v*factor)) for c in gif_cel.split()[:3]]
                gif_cel=Image.merge('RGBA',(*channels,gif_cel.getchannel('A')))
            gif_cels.append(gif_cel);positions.append(dict(cel=i,relativeTimeMs=at,pieces=info))
        sheet=Image.new('RGBA',(1024,576))
        for i,cel in enumerate(cels):sheet.alpha_composite(cel,((i%4)*256,(i//4)*192))
        sheet.save(OUT/f'sheets/{aid}.png')
        blank=Image.new('RGBA',CELL);frames=[blank]+gif_cels+[blank]
        durations=[rec['preRollMs']]+rec['celDurationsMs']+[rec['transparentTailMs']]
        preview=gif(OUT/f'gifs/{aid}/preview.gif',frames,durations)
        raw=(OUT/preview['gif']).read_bytes();extension=b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00';assert raw.count(extension)==1
        destination=OUT/f'gifs/{aid}/effect.gif';destination.write_bytes(raw.replace(extension,b''))
        clock=[0]
        for ms in durations:clock.append(clock[-1]+ms)
        with Image.open(destination) as image:
            assert 'loop' not in image.info
            decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(image)]
            assert [f.info['duration'] for f in ImageSequence.Iterator(image)]==durations
        assert len(decoded)==14
        assert all(f.getchannel('A').crop(tuple(rec['centralClearWindowPx'])).getextrema()[1]==0 for f in decoded)
        assert decoded[0].getchannel('A').getextrema()[1]==decoded[-1].getchannel('A').getextrema()[1]==0
        gif_end=max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        assert gif_end==1200
        means=[];areas=[]
        for f in decoded[8:13]:
            values=[(r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a]
            means.append(sum(values)/len(values));areas.append(len(values))
        if 'gifDissipationAnchorTimeMs' not in rec:assert all(a>b for a,b in zip(means,means[1:])),means
        else:assert min(means)>=200,means
        assert all(a>b for a,b in zip(areas,areas[1:])),areas
        animation=dict(name=rec['name'],sequence=[None]+list(range(12))+[None],durationsMs=durations,
            frameStartsMs=clock[:-1],loop=False,**{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},
            previewGif=preview['gif'],visibleEndMs=1200,pngVisibleEndMs=1200,gifTransparentTailMs=640,
            phases=[dict(name='外向きの切り離し',startMs=80,endMs=720),dict(name='小さくなって消失',startMs=720,endMs=1200)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='exterior-release',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),pivotPx=rec['pivotPx'],
            scaleReferenceTileWidthPx=80,triggerCondition=rec['trigger'],productionSet='release-set-09',
            direction='front-isometric',animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':('two GPT Image wrappers; fixed-scale detachment; PNG shrinks about drifting centers with alpha fade; white GIF holds centers/rotation from 640ms and shrinks without RGB dimming'
                if 'gifDissipationAnchorTimeMs' in rec else 'two GPT Image wrappers; fixed-scale detachment; later shrink about drifting centers; PNG alpha fade and gray GIF RGB dimming'),
            'uniformDetachmentScales':scales,'celPositions':positions})
        contact([(f'{aid} / {i:02}',cel) for i,cel in enumerate(cels)],OUT/f'review/{aid}.jpg',columns=4)
        review_items.extend([(aid,cels[3]),(aid+' final',cels[11])])
        checks.append(dict(id=aid,pngCels=12,gifFrames=14,totalDurationMs=clock[-1],loop=False,
            visibleEndMs=1200,pngVisibleEndMs=1200,transparentTailMs=640,noTargetBody=True,
            deliberateWrapperCount=2,noAdditionalParticleSystem=True,
            alphaFringeLimit='faint isolated antialias pixels can remain; not an assertion of zero isolated pixels',
            centralClearWindowPx=rec['centralClearWindowPx'],centralWindowAlpha=0,
            transparentClearancePx=24,uniformDetachmentScales=scales,celPositions=positions,
            gifLastFiveOpaqueRgbMeans=means,gifLastFiveOpaqueAreas=areas,
            pngEndMethod='four-stage shrink and partial alpha fade',
            gifEndMethod=('ivory/lavender colors retained; fixed centers/rotation after 640ms; .75/.5/.28/.06 shrink, no RGB dimming'
                if 'gifDissipationAnchorTimeMs' in rec else 'four-stage shrink and RGB dimming with binary-alpha edge loss'),
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets'];manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['releaseSet09']=dict(assetCount=2,checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    contact(review_items,OUT/'review/release-set-09.png',columns=2)
    print(json.dumps(dict(counts=manifest['counts'],checks=[{k:v for k,v in c.items() if k!='celPositions'} for c in checks])))

if __name__=='__main__':main()
