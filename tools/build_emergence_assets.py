#!/usr/bin/env python3
"""Two source plumes rise and contract about fixed side bases; no target body."""
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
from build_game_assets import gif,contact,write

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'
CELL=(256,192)

def main():
    records=json.loads((OUT/'emergence-set-11.json').read_text())
    manifest=json.loads((OUT/'manifest.json').read_text());prompts=json.loads((OUT/'prompts.json').read_text())
    quality=json.loads((OUT/'quality-report.json').read_text());ids={r['id'] for r in records}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids];prompts=[r for r in prompts if r['id'] not in ids]
    checks=[];overview=[]
    for rec in records:
        aid=rec['id'];source=Image.open(OUT/rec['source']).convert('RGBA');cels=[];gif_cels=[];paths=[];bottoms=[]
        for i,(ex,ey) in enumerate(zip(rec['celWidthEnvelope'],rec['celHeightEnvelope'],strict=True)):
            cel=Image.new('RGBA',CELL);parts=[]
            for spec in rec['pieces']:
                left,top,right,bottom=spec['cropBoxPx'];original=source.crop((left,top,right,bottom))
                sx=rec['peakCoreHeightPx']/spec['sourceCoreHeightPx']*ex;sy=rec['peakCoreHeightPx']/spec['sourceCoreHeightPx']*ey
                px,py=spec['sourceBasePx'];ax,ay=spec['stageBasePx']
                piece=original.transform(CELL,Image.Transform.AFFINE,
                    (1/sx,0,px-left-ax/sx,0,1/sy,py-top-ay/sy),resample=Image.Resampling.BICUBIC)
                cel.alpha_composite(piece)
                core=piece.getchannel('A').point(lambda a:255 if a>=96 else 0).getbbox()
                assert core and core[3]==128,(aid,i,'fixed core baseline',core)
                parts.append(dict(basePx=[ax,ay],coreBoxPx=list(core) if core else None,coreBottomPx=core[3] if core else None))
            alpha=cel.getchannel('A')
            for box in [(0,0,24,192),(232,0,256,192),(0,0,256,24),(0,168,256,192),tuple(rec['centralClearWindowPx'])]:
                assert alpha.crop(box).getextrema()[1]==0,(aid,i,box)
            gif_cels.append(cel.copy());opacity=rec['celPngOpacities'][i]
            if opacity!=1:cel.putalpha(alpha.point(lambda a:round(a*opacity)))
            path=OUT/f'frames/{aid}/{i:03}.png';path.parent.mkdir(parents=True,exist_ok=True);cel.save(path)
            paths.append(path.relative_to(OUT).as_posix());cels.append(cel);bottoms.append(parts)
        assert cels[5].tobytes()==cels[6].tobytes(),aid
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
        assert all(f.getchannel('A').crop(tuple(rec['centralClearWindowPx'])).getextrema()[1]==0 for f in decoded)
        gif_end=max(clock[i+1] for i,f in enumerate(decoded) if f.getchannel('A').getextrema()[1]>0)
        png_end=max(clock[i+1] for i,f in enumerate([blank]+cels+[blank]) if f.getchannel('A').getextrema()[1]>0)
        assert gif_end==png_end==1080
        assert decoded[0].getchannel('A').getextrema()[1]==decoded[-1].getchannel('A').getextrema()[1]==0
        end_areas=[sum(a>0 for a in f.getchannel('A').get_flattened_data()) for f in decoded[8:13]]
        assert all(a>b for a,b in zip(end_areas,end_areas[1:])),end_areas
        end_means=[sum((r+g+b)/3 for r,g,b,a in f.get_flattened_data() if a)/area for f,area in zip(decoded[8:13],end_areas)]
        if aid=='membrane_emergence':assert min(end_means)>=200,end_means
        animation=dict(name=rec['name'],sequence=[None]+list(range(12))+[None],durationsMs=durations,frameStartsMs=clock[:-1],
            loop=False,**{**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False},previewGif=preview['gif'],
            visibleEndMs=1080,pngVisibleEndMs=1080,gifTransparentTailMs=520,
            phases=[dict(name='固定根元から立ち上がり',startMs=40,endMs=440),dict(name='出現フェードの終端を保持',startMs=440,endMs=600),
                    dict(name='根元へ収縮して消失',startMs=600,endMs=1080)])
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='enemy-emergence',
            source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),pivotPx=rec['pivotPx'],
            scaleReferenceTileWidthPx=80,direction=rec['direction'],triggerCondition=rec['trigger'],productionSet='emergence-set-11',animations={'effect':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'two generated side plumes; anisotropic rise about fixed bases then uniform contraction; PNG final partial alpha, GIF original colors retained',
            'celCoreBoxesAndBases':bottoms})
        marked=[]
        for i,c in enumerate(cels):
            review=c.copy();d=ImageDraw.Draw(review);d.line((24,128,232,128),fill=(70,180,160,180),width=1)
            marked.append((f'{aid} / {i:02}',review))
        contact(marked,OUT/f'review/{aid}.jpg',columns=4)
        overview.extend([(aid,cels[5]),(aid+' final',cels[11])])
        checks.append(dict(id=aid,pngCels=12,gifFrames=14,durationMs=clock[-1],visibleEndMs=1080,pngVisibleEndMs=1080,transparentTailMs=520,
            loop=False,firstLastBlank=True,pivotPx=rec['pivotPx'],fixedSideBasesPx=[p['stageBasePx'] for p in rec['pieces']],
            centralClearWindowPx=rec['centralClearWindowPx'],centralWindowAlpha=0,transparentClearancePx=24,
            sourceMajorPlumes=2,additionalParticleSystem=False,rasterFringe='small isolated raster pixels may remain; not all necessarily low-alpha AA',
            identicalPeakCels=[5,6],peakHoldMs=160,birthAlphaFadeEndsAtMs=600,celCoreBoxesAndBases=bottoms,
            gifEndOpaqueAreas=end_areas,gifEndRgbMeans=end_means,pngEndMethod='geometric contraction plus partial alpha',
            gifEndMethod='geometric contraction retaining source colors; no RGB darkening',
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets'];manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),effects=sum(a['category']=='fx' for a in assets),
        sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['emergenceSet11']=dict(assetCount=2,checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    contact(overview,OUT/'review/emergence-set-11.png',columns=2)
    print(json.dumps(dict(counts=manifest['counts'],checks=[{k:v for k,v in c.items() if k!='celCoreBoxesAndBases'} for c in checks])))

if __name__=='__main__':main()
