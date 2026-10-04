#!/usr/bin/env python3
"""Short fixed-impact pulses from one generated pressure-trace master per enemy."""
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageSequence
from build_game_assets import gif,contact,write

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'
CELL=(256,192)

def main():
    records=json.loads((OUT/'impact-set-10.json').read_text())
    manifest=json.loads((OUT/'manifest.json').read_text());prompts=json.loads((OUT/'prompts.json').read_text())
    quality=json.loads((OUT/'quality-report.json').read_text());ids={r['id'] for r in records}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids];prompts=[r for r in prompts if r['id'] not in ids]
    checks=[];overview=[]
    for rec in records:
        aid=rec['id'];source=Image.open(OUT/rec['source']).convert('RGBA')
        left,top,right,bottom=rec['sourceCropBoxPx'];original=source.crop((left,top,right,bottom))
        px,py=rec['sourceImpactPivotPx'];ax,ay=rec['impactPivotPx']
        base_scale=rec['peakWidthPx']/(right-left);cels=[];gif_cels=[];paths=[]
        for i,envelope in enumerate(rec['celScaleEnvelope']):
            scale=base_scale*envelope
            cel=original.transform(CELL,Image.Transform.AFFINE,
                (1/scale,0,px-left-ax/scale,0,1/scale,py-top-ay/scale),resample=Image.Resampling.BICUBIC)
            alpha=cel.getchannel('A')
            for box in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192)]:
                assert alpha.crop(box).getextrema()[1]==0,(aid,i,box)
            assert alpha.getpixel((ax,ay))==0,(aid,i,'impact point must remain empty')
            gif_cels.append(cel.copy())
            opacity=rec['celPngOpacities'][i]
            if opacity!=1:cel.putalpha(alpha.point(lambda a:round(a*opacity)))
            path=OUT/f'frames/{aid}/{i:03}.png';path.parent.mkdir(parents=True,exist_ok=True);cel.save(path)
            paths.append(path.relative_to(OUT).as_posix());cels.append(cel)
        sheet=Image.new('RGBA',(1024,576))
        for i,cel in enumerate(cels):sheet.alpha_composite(cel,((i%4)*256,(i//4)*192))
        sheet.save(OUT/f'sheets/{aid}.png')
        blank=Image.new('RGBA',CELL);frames=[blank]+gif_cels+[blank]
        durations=[rec['preRollMs']]+rec['celDurationsMs']+[rec['transparentTailMs']]
        preview=gif(OUT/f'gifs/{aid}/preview.gif',frames,durations)
        raw=(OUT/preview['gif']).read_bytes();extension=b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00';assert raw.count(extension)==1
        path=OUT/f'gifs/{aid}/effect.gif';path.write_bytes(raw.replace(extension,b''))
        clock=[0]
        for ms in durations:clock.append(clock[-1]+ms)
        with Image.open(path) as im:
            assert 'loop' not in im.info;decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
            assert [f.info['duration'] for f in ImageSequence.Iterator(im)]==durations
        assert len(decoded)==14
        gif_end=max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        png_frames=[blank]+cels+[blank]
        png_end=max(clock[i+1] for i,f in enumerate(png_frames) if f.getchannel('A').getextrema()[1]>0)
        assert gif_end==png_end==700
        assert decoded[0].getchannel('A').getextrema()[1]==decoded[-1].getchannel('A').getextrema()[1]==0
        assert all(f.getchannel('A').getpixel((ax,ay))==0 for f in decoded)
        end_areas=[sum(a>0 for a in f.getchannel('A').get_flattened_data()) for f in decoded[9:13]]
        assert all(a>b for a,b in zip(end_areas,end_areas[1:])),end_areas
        if aid=='membrane_pressure_hit':
            end_means=[sum((r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a)/area for f,area in zip(decoded[9:13],end_areas)]
            assert min(end_means)>=200,end_means
        else:end_means=None
        animation=dict(name=rec['name'],sequence=[None]+list(range(12))+[None],durationsMs=durations,frameStartsMs=clock[:-1],
            loop=False,**{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},previewGif=preview['gif'],
            visibleEndMs=700,pngVisibleEndMs=700,gifTransparentTailMs=500,
            phases=[dict(name='着弾の広がり',startMs=60,endMs=180),dict(name='圧力跡のピーク',startMs=180,endMs=260),
                    dict(name='圧力跡の収縮',startMs=260,endMs=700)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='enemy-ranged-impact',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),impactPivotPx=rec['impactPivotPx'],
            scaleReferenceTileWidthPx=80,direction=rec['direction'],triggerCondition=rec['trigger'],productionSet='impact-set-10',animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'fixed source impact pivot; whole-glyph scale pulse and contraction; PNG final alpha fade; GIF preserves source colors with geometric contraction only'})
        contact([(f'{aid} / {i:02}',c) for i,c in enumerate(cels)],OUT/f'review/{aid}.jpg',columns=4)
        overview.extend([(aid,cels[3]),(aid+' final',cels[11])])
        checks.append(dict(id=aid,pngCels=12,gifFrames=14,durationMs=clock[-1],visibleEndMs=700,pngVisibleEndMs=700,transparentTailMs=500,
            loop=False,firstLastBlank=True,impactPivotPx=rec['impactPivotPx'],impactPivotAlpha=0,transparentClearancePx=24,
            sourceMajorTraces=3,additionalParticleSystem=False,rasterIsolatedPixels='1–3px raster separations may remain, including alpha200/193 in thorn cel006 and alpha130/117 in membrane cel002/008; not all are low-alpha AA',
            readability='three major traces distinguishable at 64px peak; onset/tail become dots; membrane contrast weak on light floors; actual game visibility NOT VERIFIED',
            gifEndOpaqueAreas=end_areas,gifWhiteEndRgbMeans=end_means,pngEndMethod='geometric contraction plus partial alpha',
            gifEndMethod='geometric contraction retaining source colors; no RGB darkening',
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets'];manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['impactSet10']=dict(assetCount=2,checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    contact(overview,OUT/'review/impact-set-10.png',columns=2)
    print(json.dumps(dict(counts=manifest['counts'],checks=checks)))

if __name__=='__main__':main()
