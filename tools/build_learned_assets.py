#!/usr/bin/env python3
"""Append learned-skill sprites from saved ImageGen sheets; retain existing assets."""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageSequence
from build_game_assets import gif, contact, write, RESAMPLE

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (288, 384)


def compose_gif_contour(rec):
    """Adopt generated contour colors only; keep base geometry/alpha exactly."""
    edit=rec['gifSourceEdit']
    base=Image.open(OUT/edit['base']).convert('RGBA')
    donor=Image.open(OUT/edit['generatedEdit']).convert('RGBA')
    assert base.size==donor.size==(1536,1024)
    result=base.copy()
    masks=Image.new('L',base.size)
    radius=edit['radiusPx']
    for cy in range(2):
        for cx in range(4):
            box=(cx*384,cy*512,(cx+1)*384,(cy+1)*512)
            original=base.crop(box)
            colors=donor.crop(box)
            opaque=original.getchannel('A').point(lambda a:255 if a>=96 else 0)
            band=ImageChops.subtract(opaque.filter(ImageFilter.MaxFilter(radius*2+1)),
                                     opaque.filter(ImageFilter.MinFilter(radius*2+1)))
            # Extend generated opaque edge colors to nearby antialias pixels,
            # independently per source cel. Never sample its zero-alpha RGB.
            pixels=list(colors.get_flattened_data())
            owner=[-1]*len(pixels)
            queue=deque()
            for i,pixel in enumerate(pixels):
                if pixel[3]>=200:owner[i]=i;queue.append(i)
            assert queue
            while queue:
                i=queue.popleft();x,y=i%384,i//384
                for j in ([i-1] if x else [])+([i+1] if x<383 else [])+([i-384] if y else [])+([i+384] if y<511 else []):
                    if owner[j]<0:owner[j]=owner[i];queue.append(j)
            original_pixels=list(original.get_flattened_data())
            band_pixels=list(band.get_flattened_data())
            replacement=[(*pixels[owner[i]][:3],pixel[3])
                         if band_pixels[i] and pixel[3] else pixel
                         for i,pixel in enumerate(original_pixels)]
            composed=Image.new('RGBA',(384,512));composed.putdata(replacement)
            result.paste(composed,(cx*384,cy*512));masks.paste(band,(cx*384,cy*512))
    assert result.getchannel('A').tobytes()==base.getchannel('A').tobytes()
    result.save(OUT/rec['gifSource'])
    masks.save(OUT/edit['mask'])


def render_gif_source(rec,set_name):
    """Use the same exporter in isolation, retaining the canonical PNG set."""
    with tempfile.TemporaryDirectory(prefix='color-resonance-gif-') as directory:
        root=Path(directory);out=root/'assets/generated';(out/'source').mkdir(parents=True)
        (out/'sheets').mkdir();(out/'review').mkdir()
        (root/'tools').mkdir()
        for name in ['build_game_assets.py','build_learned_assets.py']:
            shutil.copyfile(ROOT/'tools'/name,root/'tools'/name)
        alternate={k:v for k,v in rec.items() if k not in ['gifSource','gifSourceEdit','gifEdgePrompt']}
        alternate['source']=rec['gifSource']
        shutil.copyfile(OUT/rec['gifSource'],out/rec['gifSource'])
        write(out/'manifest.json',{'assets':[],'production':{}})
        write(out/'prompts.json',[]);write(out/'quality-report.json',{})
        records=out/(set_name+'.json');write(records,[alternate])
        subprocess.run([sys.executable,str(root/'tools/build_learned_assets.py'),'--records',str(records)],
                       cwd=root,check=True,stdout=subprocess.DEVNULL)
        for name in ['effect.gif','preview.gif']:
            path=f'gifs/{rec["id"]}/{name}';shutil.copyfile(out/path,OUT/path)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--records',type=Path,default=OUT/'learned-set-01.json')
    args=parser.parse_args()
    set_name=args.records.stem
    qc_key='learnedSet'+set_name.rsplit('-',1)[-1]
    records = json.loads(args.records.read_text())
    manifest = json.loads((OUT / 'manifest.json').read_text())
    ids = {r['id'] for r in records}
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in ids]
    prompts = json.loads((OUT / 'prompts.json').read_text())
    prompts = [r for r in prompts if r['id'] not in ids]
    qc = []
    for rec in records:
        aid = rec['id']
        if 'sourceEdit' in rec:
            edit=rec['sourceEdit']
            master=Image.open(OUT/edit['base']).convert('RGBA')
            donor=Image.open(OUT/edit['generatedEdit']).convert('RGBA')
            assert master.size == donor.size == (1536,1024)
            box=edit['region']
            # Replace the exact generated edit region, retaining every pixel
            # outside it from the source master.
            master.paste(donor.crop(tuple(box)),(box[0],box[1]))
            master.save(OUT/rec['source'])
        source = Image.open(OUT / rec['source']).convert('RGBA')
        assert source.size == (1536, 1024)
        assert source.getchannel('A').getextrema()[0] == 0
        cels, paths, bboxes = [], [], []
        for i in range(8):
            x, y = (i % 4) * 384, (i // 4) * 512
            original = source.crop((x, y, x + 384, y + 512))
            # Remove inter-cell bleed using fixed, documented extraction
            # windows. This is sheet segmentation, not a redraw or fitted crop.
            guard=rec.get('extractionGuardPx',0)
            box=rec.get('cellClipSourcePx',{}).get(str(i),[guard,guard,384-guard,512-guard])
            isolated=Image.new('RGBA',(384,512))
            isolated.alpha_composite(original.crop(tuple(box)),(box[0],box[1]))
            original=isolated
            # One identical transform for every fixed grid cell, preserving
            # relative sizes/positions; never fit or recenter individual poses.
            scale = rec['uniformInsetScale']
            reduced = original.resize((round(CELL[0]*scale), round(CELL[1]*scale)), RESAMPLE)
            cel = Image.new('RGBA', CELL)
            dx,dy = rec['frameOffsetsSourcePx'][i]
            cel.alpha_composite(reduced, ((CELL[0]-reduced.width)//2 + round(dx * reduced.width / 384),
                                         (CELL[1]-reduced.height)//2 + round(dy * reduced.height / 512)))
            alpha = cel.getchannel('A')
            assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] > 96
            for edge in (alpha.crop((0,0,24,384)), alpha.crop((264,0,288,384)),
                         alpha.crop((0,0,288,32)), alpha.crop((0,352,288,384))):
                assert edge.getextrema()[1] == 0, f'{aid}/{i}: edge not clear'
            bboxes.append(alpha.point(lambda a: 255 if a >= 96 else 0).getbbox())
            path = f'frames/{aid}/{i:03d}.png'
            (OUT / path).parent.mkdir(parents=True, exist_ok=True)
            cel.save(OUT / path)
            paths.append(path)
            cels.append(cel)
        # Optional animation transforms reuse a whole generated pose about a
        # fixed landmark. This avoids dropping individual leaves/parts when a
        # separately drawn release pose has a different silhouette.
        originals=[cel.copy() for cel in cels]
        for index,step in rec.get('phaseTransforms',{}).items():
            i=int(index)
            ax,ay=step['anchorPx']
            scale=step['scale']
            angle=step.get('rotationDeg',0)
            if angle:
                # Positive angles rotate clockwise in screen coordinates.
                radians=math.radians(angle)
                c,s=math.cos(radians)/scale,math.sin(radians)/scale
                coefficients=(c,s,ax-c*ax-s*ay,-s,c,ay+s*ax-c*ay)
            else:
                # Retain the exact old arithmetic for existing unrotated sets.
                coefficients=(1/scale,0,ax-ax/scale,0,1/scale,ay-ay/scale)
            cel=originals[step['sourceCel']].transform(
                CELL,Image.Transform.AFFINE,coefficients,
                resample=Image.Resampling.BICUBIC)
            cel.putalpha(cel.getchannel('A').point(lambda a: round(a*step['opacity'])))
            cel.save(OUT/paths[i])
            cels[i]=cel
            bboxes[i]=cel.getchannel('A').point(lambda a:255 if a>=96 else 0).getbbox()
        # The remaining magic contracts about one fixed landmark and fades.
        # This deliberate decay also stays readable in GIF's 1-bit alpha.
        ax,ay=rec['decayAnchorPx']
        for opacity,scale in zip(rec['fadeOpacities'],rec['decayScales'],strict=True):
            cel=cels[7].transform(CELL,Image.Transform.AFFINE,
                                 (1/scale,0,ax-ax/scale,0,1/scale,ay-ay/scale),
                                 resample=Image.Resampling.BICUBIC)
            cel.putalpha(cel.getchannel('A').point(lambda a: round(a * opacity)))
            i=len(cels)
            path=f'frames/{aid}/{i:03d}.png'
            cel.save(OUT/path)
            paths.append(path)
            cels.append(cel)
        for i,cel in enumerate(cels):
            alpha=cel.getchannel('A')
            for edge in (alpha.crop((0,0,24,384)),alpha.crop((264,0,288,384)),
                         alpha.crop((0,0,288,32)),alpha.crop((0,352,288,384))):
                assert edge.getextrema()[1]==0,f'{aid}/{i}: transformed edge not clear'
        sheet = Image.new('RGBA', (1152,1152))
        for i, cel in enumerate(cels):
            sheet.alpha_composite(cel, ((i%4)*288,(i//4)*384))
        sheet.save(OUT / f'sheets/{aid}.png')
        blank = Image.new('RGBA', CELL)
        sequence = [None] + list(range(len(cels))) + [None]
        durations = [100] + rec['durationsMs'] + rec['fadeDurationsMs'] + [720]
        frames = [blank] + cels + [blank]
        preview = gif(OUT / f'gifs/{aid}/preview.gif', frames, durations)
        # The one-shot GIF has no NETSCAPE extension. Preview repetition is an
        # explicitly separate file; both have identical frames/timing/palette.
        netscape = b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'
        blob=(OUT/preview['gif']).read_bytes()
        assert blob.count(netscape) == 1
        (OUT/f'gifs/{aid}/effect.gif').write_bytes(blob.replace(netscape,b'',1))
        if 'gifSource' in rec:
            compose_gif_contour(rec)
            render_gif_source(rec,set_name)
        spec={**preview,'gif':f'gifs/{aid}/effect.gif','gifRepeatsForPreview':False,
              'previewGif':preview['gif'],'previewGifLoops':True}
        clock = [0]
        for duration in durations: clock.append(clock[-1] + duration)
        with Image.open(OUT/spec['gif']) as check:
            decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(check)]
        gif_end=max(clock[i+1] for i,f in enumerate(decoded)
                    if f.getchannel('A').getextrema()[1]>0)
        png_end=max(clock[i+1] for i,f in enumerate(frames)
                    if f.getchannel('A').getextrema()[1]>0)
        phases = [dict(name=name, startMs=clock[start+1], endMs=clock[end+1])
                  for name,start,end in rec['phases']]
        phases[-1]['endMs']=gif_end
        png_phases=[dict(phase) for phase in phases]
        png_phases[-1]['endMs']=png_end
        animation = dict(name=rec['name'], sequence=sequence, durationsMs=durations,
                         loop=False, phases=phases,
                         visibleEndMs=gif_end,pngVisibleEndMs=png_end,
                         gifTransparentTailMs=clock[-1]-gif_end,
                         pngPhases=png_phases,frameStartsMs=clock[:-1],
                         **({'gifSource':rec['gifSource']} if 'gifSource' in rec else {}),
                         **spec)
        manifest['assets'].append(dict(
            id=aid,name=rec['name'],category='fx',source=rec['source'],
            sheet=f'sheets/{aid}.png',frames=paths,
            grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),
            scenes=[rec['spirit'],'chrome'],
            skillId=rec['skillId'],spirit=rec['spirit'],
            direction=rec['direction'],anchorPx=[144,192],
            productionSet=set_name,animations={'effect':animation}))
        prompts.append(dict(id=aid,name=rec['name'],category='fx',
                            file=rec['source'],tool='built-in imagegen',
                            reference=rec.get('referenceCel',f'source/{rec["reference"]}.png'),
                            prompt=rec['prompt'],
                            **({'repairPrompt':rec['repairPrompt']} if 'repairPrompt' in rec else {}),
                            **({'sourceEdit':rec['sourceEdit'],'impactRepairPrompt':rec['impactRepairPrompt']} if 'sourceEdit' in rec else {}),
                            **({'editBase':rec['editBase']} if 'editBase' in rec else {}),
                            **({key:rec[key] for key in ['gifSource','gifSourceEdit','gifEdgePrompt']}
                               if 'gifSource' in rec else {}),
                            **({key:rec[key] for key in ['adoptedSourceCells','unusedSourceCells','sourceSelectionReason']}
                               if 'adoptedSourceCells' in rec else {}),
                            export=dict(cellSize=list(CELL),uniformInsetScale=rec['uniformInsetScale'],
                                        fixedGrid=True,frameOffsetsSourcePx=rec['frameOffsetsSourcePx'],
                                        fadeOpacities=rec['fadeOpacities'],
                                        decayScales=rec['decayScales'],decayAnchorPx=rec['decayAnchorPx'],
                                        phaseTransforms=rec.get('phaseTransforms',{}),
                                        extractionGuardPx=rec.get('extractionGuardPx',0),
                                        cellClipSourcePx=rec.get('cellClipSourcePx',{}))))
        contact([(f'{aid} / {i}', f) for i,f in enumerate(cels)],OUT/f'review/{aid}.jpg')
        with Image.open(OUT/spec['gif']) as check:
            decoded = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(check)]
            assert decoded[0].getchannel('A').getextrema() == (0,0)
            assert decoded[-1].getchannel('A').getextrema() == (0,0)
            assert 'loop' not in check.info
            assert b'NETSCAPE2.0' not in (OUT/spec['gif']).read_bytes()
            qc.append(dict(id=aid,pngCellSize=list(CELL),pngCount=len(cels),
                           gifFrameCount=len(decoded),durationMs=sum(durations),
                           clearBorderPx=[24,32],transparentFirstAndLast=True,
                           sharedPalette=True,disposal=2,pngAlphaPreserved=True,
                           singleShotGif=True,separateLoopPreview=True,
                           gifVisibleEndMs=gif_end,pngVisibleEndMs=png_end,
                           gifTransparentTailMs=clock[-1]-gif_end,
                           finalOpacity=rec['fadeOpacities'][-1],
                           finalScale=rec['decayScales'][-1],opaqueBboxes=bboxes))
    assets = manifest['assets']
    manifest['production']['extendedSpriteGrid']=[4,3]
    manifest['production']['gridAuthority']='assets[].grid'
    manifest['production']['poseAlignment']='fixed source grid; explicit effect landmarks and extraction windows; decay transform only in derived cels'
    manifest['counts'] = dict(characters=sum(a['category']!='fx' for a in assets),
                              effects=sum(a['category']=='fx' for a in assets),
                              sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
                              gifs=sum(len(a['animations']) + sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    write(OUT/'manifest.json',manifest)
    write(OUT/'prompts.json',prompts)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS = '+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['name'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA'))
             for a in assets],OUT/'overview.jpg',columns=5)
    quality=json.loads((OUT/'quality-report.json').read_text())
    quality['counts']=manifest['counts']
    quality[qc_key]=dict(assetCount=len(records),checks=qc)
    write(OUT/'quality-report.json',quality)
    overview=Image.new('RGB',(288*len(records),1536),'#152033')
    for col,rec in enumerate(records):
        for row,(cel,bg) in enumerate([(2,'#152033'),(4,'#152033'),(4,'#f2efea'),(7,'#f2efea')]):
            plate=Image.new('RGBA',CELL,bg)
            plate.alpha_composite(Image.open(OUT/f'frames/{rec["id"]}/{cel:03d}.png').convert('RGBA'))
            overview.paste(plate.convert('RGB'),(col*288,row*384))
    overview.save(OUT/f'review/{set_name}.png')
    print(json.dumps(dict(counts=manifest['counts'],checks=qc),ensure_ascii=False))


if __name__ == '__main__':
    main()
