#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mechanically split approved imagegen sheets; never paint or warp a pose.

Run with the system Python (Pillow): /usr/bin/python3 tools/package_cast_assets.py
Inputs and exact generation prompts live in art-source/cast-20261022/records.json.
"""
import copy
import json
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
SOURCE = ROOT / 'art-source/cast-20261022'
NAMES = dict(cmd_marina='青のマリナ', cmd_sion='藍のシオン', cmd_ocher='黄のオーカー',
             cmd_amber='橙のアンバー', cmd_viola='紫のヴィオラ', cmd_carmine='赤のカーマイン',
             cmd_verde='緑のヴェルデ', s_lance='王の槍兵', s_sword='王の剣兵', s_bow='王の弓兵',
             s_heavy='王の重装兵', s_cavalry='王の騎兵', s_captain='王の隊長', kaoru='馨', cocoon='闇の繭', mari='マリー')

def separate_cels(im, cols, rows):
    """Separate non-overlapping painted cels, including weapons past nominal lines.

    The generator's atlas spacing is approximate. Run-length components preserve
    complete existing pixels instead of cutting a hand/weapon on a nominal line.
    Every cel of one actor shares ONE scale; no individual pose is stretched.
    """
    alpha=np.array(im.getchannel('A')); solid=alpha>=120
    parent=[]; runs=[]; previous=[]
    def find(n):
        while parent[n]!=n:
            parent[n]=parent[parent[n]];n=parent[n]
        return n
    for y,row in enumerate(solid):
        edges=np.diff(np.r_[False,row,False].astype(np.int8))
        current=[];j=0
        for x0,x1 in zip(np.where(edges==1)[0],np.where(edges==-1)[0]):
            n=len(parent);parent.append(n);runs.append((y,int(x0),int(x1),n));current.append((x0,x1,n))
            while j<len(previous) and previous[j][1]<x0:j+=1
            k=j
            while k<len(previous) and previous[k][0]<=x1:
                a,b=find(n),find(previous[k][2]);parent[a]=b;k+=1
        previous=current
    groups={}
    for y,l,r,n in runs:
        key=find(n)
        g=groups.setdefault(key,dict(area=0,box=[im.width,im.height,0,0],runs=[]))
        g['area']+=r-l;g['box']=[min(g['box'][0],l),min(g['box'][1],y),max(g['box'][2],r),max(g['box'][3],y+1)];g['runs'].append((y,l,r))
    ordered=sorted(groups.values(),key=lambda g:g['area'],reverse=True)
    count=cols*rows;cores=ordered[:count]
    assert len(cores)==count and min(g['area'] for g in cores)>1000, 'incomplete/overlapping source poses'
    cores.sort(key=lambda g:(g['box'][1]+g['box'][3])/2)
    cores=[g for row in range(rows) for g in sorted(cores[row*cols:(row+1)*cols],key=lambda g:(g['box'][0]+g['box'][2])/2)]
    for small in ordered[count:]:
        if small['area']<8:continue
        l,t,r,b=small['box'];x,y=(l+r)/2,(t+b)/2
        def distance(g):
            L,T,R,B=g['box'];return max(L-x,0,x-R)**2+max(T-y,0,y-B)**2
        nearest=min(cores,key=distance);nearest['runs'].extend(small['runs'])
    sprites=[];anchors=[];boxes=[]
    for core in cores:
        mask=np.zeros(alpha.shape,dtype=np.uint8)
        for y,l,r in core['runs']:mask[y,l:r]=255
        mask=Image.fromarray(mask).filter(ImageFilter.MaxFilter(9))
        selected=np.where(np.array(mask)>0,alpha,0).astype(np.uint8)
        layer=im.copy();layer.putalpha(Image.fromarray(selected))
        box=layer.getchannel('A').getbbox();l,t,r,b=box
        # Calibrated foot contact: body pixels in the lowest fifth, excluding
        # tiny disconnected sparks. One fixed foot baseline in the output.
        L,T,R,B=core['box'];ys,xs=np.where(solid[int(T+(B-T)*.8):B,L:R])
        foot_x=L+float(np.median(xs)) if len(xs) else (L+R)/2
        sprites.append(layer.crop(box));anchors.append((foot_x-l,B-t));boxes.append(box)
    w,h=384,512
    extent_w=max(max(ax,s.width-ax) for s,(ax,ay) in zip(sprites,anchors))*2
    extent_h=max(s.height for s in sprites)
    scale=min((w-56)/extent_w,(h-64)/extent_h)
    frames=[]
    for sprite,(ax,ay) in zip(sprites,anchors):
        sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(w,h));frame.alpha_composite(sprite,(round(w/2-ax*scale),round(h*.9-ay*scale)))
        frame.putalpha(frame.getchannel('A').point(lambda a:255 if a>=245 else 0 if a<=3 else a));frames.append(frame)
    sheet=Image.new('RGBA',(w*cols,h*rows))
    for n,frame in enumerate(frames):sheet.alpha_composite(frame,(n%cols*w,n//cols*h))
    return sheet,frames,dict(sourceWindows=boxes,commonScale=scale,cellSize=[w,h],footBaseline=round(h*.9))

def main():
    manifest = json.loads((OUT / 'manifest.json').read_text())
    prototype = next(a for a in manifest['assets'] if a['id'] == 'thorn')
    prompts = json.loads((OUT / 'prompts.json').read_text())
    report = []
    records = json.loads((SOURCE / 'records.json').read_text())
    for record in records:
        ident = record['id']
        im = Image.open(SOURCE / (ident + '.png')).convert('RGBA')
        cols, rows = record.get('grid', [4, 2])
        assert im.getchannel('A').getextrema()[0] == 0, ident + ' needs genuine transparency'
        # Restore opaque interiors after the generator's 8-bit alpha quantization.
        # This changes neither geometry nor colour; soft silhouette edges remain.
        im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 245 else (0 if a <= 3 else a)))
        source_size=list(im.size)
        im,frames,extraction=separate_cels(im,cols,rows)
        w,h=extraction['cellSize']
        asset = copy.deepcopy(prototype)
        asset.update(id=ident, name=NAMES[ident], category='npc' if ident == 'kaoru' else 'ally' if ident == 'mari' else 'enemy',
                     source=f'source/{ident}.png', sheet=f'sheets/{ident}.png', scenes=[],
                     grid=dict(columns=cols, rows=rows, cellSize=[w, h], order='row-major'),
                     reference='art-source/cast-20261022/kaoru-reference.jpeg' if ident == 'kaoru' else 'art-source/cast-20261022/mari-reference.png' if ident == 'mari' else ('docs/rainbow-guard.md' if ident.startswith('cmd_') else 'js/mari-return.js' if ident == 'cocoon' else 'js/envoy.js'),
                     production='imagegen: actual pose and expression cels; whole alpha components, one common scale and foot baseline')
        if ident in ['kaoru','mari']:
            for name, seq, times, loop in [('talk',[0,8,9,8],[650,180,200,180],True),
                                            ('greet',[0,10,11],[260,650,480],False)]:
                asset['animations'][name] = dict(name={'talk':'会話','greet':'挨拶'}[name], sequence=seq, durationsMs=times, loop=loop)
        if ident == 'mari':
            asset['animations']['summon'] = copy.deepcopy(asset['animations']['cast'])
            asset['animations']['summon']['name'] = '召喚'
        if ident == 'cocoon':
            asset['animations']['walk'] = copy.deepcopy(asset['animations']['idle'])
        asset['frames'] = [f'frames/{ident}/{n:03d}.png' for n in range(len(frames))]
        for rel in [asset['source'], asset['sheet']]:
            (OUT / rel).parent.mkdir(parents=True, exist_ok=True)
            im.save(OUT / rel)
        for frame, rel in zip(frames, asset['frames']):
            (OUT / rel).parent.mkdir(parents=True, exist_ok=True)
            frame.save(OUT / rel)
        for name, clip in asset['animations'].items():
            clip.update(gif=f'gifs/{ident}/{name}.gif', size=[w,h], gifFrameCount=len(clip['sequence']),
                        durationMs=sum(clip['durationsMs']), gifRepeatsForPreview=True, gifAlphaThreshold=96)
            # GIF is a preview only. The game retains full-colour PNG alpha.
            gif_frames = []
            for n in clip['sequence']:
                rgba = frames[n]
                pal = rgba.convert('RGB').quantize(colors=255)
                mask = rgba.getchannel('A').point(lambda a:255 if a<96 else 0)
                pal.paste(255, mask=mask)
                pal.info['transparency'] = 255
                gif_frames.append(pal)
            dest = OUT / clip['gif']; dest.parent.mkdir(parents=True, exist_ok=True)
            gif_frames[0].save(dest, save_all=True, append_images=gif_frames[1:], duration=clip['durationsMs'],
                               loop=0, transparency=255, disposal=2)
        manifest['assets'] = [a for a in manifest['assets'] if a['id'] != ident] + [asset]
        prompts = [a for a in prompts if a.get('id') != ident] + [dict(id=ident, tool='built-in imagegen',
                   prompt=record['prompt'], reference=asset['reference'], processing='Whole alpha-component cel extraction; common scale and fixed foot contact; no repainting, pose warping or colour-key removal.')]
        report.append(dict(id=ident, sourceSize=source_size, extraction=extraction, alphaRange=list(im.getchannel('A').getextrema()),
                           frames=len(frames), actions=list(asset['animations'])))
    # Noir already has painted absorption/squash cels. Reuse these real poses
    # for the field unit instead of silently falling back to an idle blob.
    noir = next(a for a in manifest['assets'] if a['id']=='renoir')
    for name, original, sequence, times in [('attack','absorb',[0,2,4,0],[260,180,220,500]),
                                             ('hurt','walk',[0,5,0],[100,180,400])]:
        clip=copy.deepcopy(noir['animations'][original])
        dest=f'gifs/renoir/{name}.gif'
        clip.update(name='攻撃' if name=='attack' else '被ダメージ',sequence=sequence,durationsMs=times,
                    loop=False,gif=dest,gifFrameCount=len(sequence),durationMs=sum(times))
        # Build previews from exactly the same cels as the game's clock.
        cels=[]
        for n in sequence:
            rgba=Image.open(OUT/noir['frames'][n]).convert('RGBA')
            pal=rgba.convert('RGB').quantize(colors=255)
            pal.paste(255,mask=rgba.getchannel('A').point(lambda a:255 if a<96 else 0));cels.append(pal)
        cels[0].save(OUT/dest,save_all=True,append_images=cels[1:],duration=times,loop=0,transparency=255,disposal=2)
        noir['animations'][name]=clip
    # Precompute guide bounds: file:// canvases cannot read image pixels.
    for actor in manifest['assets']:
        if actor['category']=='fx':continue
        sheet=Image.open(OUT/actor['sheet']).convert('RGBA');W,H=actor['grid']['cellSize'];C=actor['grid']['columns']
        union=[W,H,0,0]
        for n in range(len(actor['frames'])):
            box=sheet.crop((n%C*W,n//C*H,(n%C+1)*W,(n//C+1)*H)).getchannel('A').point(lambda a:255 if a>40 else 0).getbbox()
            if box:union=[min(union[0],box[0]),min(union[1],box[1]),max(union[2],box[2]),max(union[3],box[3])]
        actor['displayBounds']=dict(zip(['l','t','r','b'],union))
    manifest['counts'] = dict(characters=sum(a['category']!='fx' for a in manifest['assets']),
                             effects=sum(a['category']=='fx' for a in manifest['assets']), sourceSheets=len(manifest['assets']),
                             pngCels=sum(len(a['frames']) for a in manifest['assets']),
                             gifs=sum(sum(bool(c.get('gif')) for c in a['animations'].values()) for a in manifest['assets']))
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS = '+json.dumps(manifest,ensure_ascii=False)+';\n')
    (OUT/'prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
    quality=json.loads((OUT/'quality-report.json').read_text())
    quality['cast20261022']=report
    old={r['id']:r for r in quality.get('alpha',[])}
    old.update({r['id']:r for r in report}); quality['alpha']=list(old.values())
    (OUT/'quality-report.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__': main()
