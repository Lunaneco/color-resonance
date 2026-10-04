#!/usr/bin/env python3
"""Split generated cels on a fixed grid and export transparent PNG/GIF assets.

This does not generate, redraw, remove backgrounds, or individually crop/align poses.
Requires Pillow. Rebuild with: python3 tools/build_game_assets.py --force
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
from PIL import GifImagePlugin, Image, ImageDraw, ImageFont, ImageOps, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'
CELL = (288, 384)
RESAMPLE = Image.Resampling.LANCZOS
ANIMS = {
    'idle': ('待機', [0, 1, 0], [1100, 160, 900], True),
    'walk': ('移動', [2, 0, 3, 0], [150, 100, 150, 100], True),
    'attack': ('攻撃', [0, 4, 5, 0], [260, 200, 180, 600], False),
    'hurt': ('被ダメージ', [0, 6, 0], [260, 180, 700], False),
    'cast': ('力の発動', [0, 7, 0], [280, 720, 600], False),
    'talk': ('会話', [4, 5, 4, 5, 0], [220, 140, 180, 140, 700], True),
    'greet': ('挨拶', [0, 6, 7, 0], [280, 350, 300, 600], False),
    'absorb': ('色を吸いこむ', [0, 4, 5, 0], [300, 240, 350, 600], False),
}
FX_TIMES = [100, 100, 100, 90, 160, 140, 140, 160, 650]
SPECIALS = [
    ('aria', 'flash', '透明の一閃', 'crystal_slash'),
    ('aria', 'pray', '凪の祈り', 'pray_heal'),
    ('gran', 'summon', '潮騒の帰還', 'gran_tide'),
    ('ivy', 'summon', '茨ほどき', 'ivy_vines'),
    ('spinel', 'summon', '黄金の傷の光', 'spinel_shield'),
    ('king', 'summon', '虹の尖塔', 'king_prism'),
    ('chrome', 'wave', '漆黒の波', 'chrome_wave'),
    ('renoir', 'sky', '小さな夜空', 'night_sky'),
    ('aria', 'enchant_gran', '深碧の刃', 'gran_tide'),
    ('aria', 'enchant_ivy', '翠蔦の刃', 'ivy_vines'),
    ('aria', 'enchant_spinel', '金継ぎの刃', 'spinel_shield'),
    ('aria', 'enchant_king', '虹彩の刃', 'king_prism'),
]
SCENES = {
    'shade': ['cove', 'gran', 'ivy', 'king'], 'thorn': ['ivy'],
    'lead': ['spinel', 'king'], 'boss': ['gran', 'ivy', 'spinel', 'king'],
    'membrane': ['chrome'], 'chrome': ['chrome'],
    'aria': ['cove', 'gran', 'ivy', 'spinel', 'king', 'chrome'],
    'gran': ['ivy', 'spinel', 'king', 'chrome'], 'ivy': ['spinel', 'king', 'chrome'],
    'spinel': ['king', 'chrome'], 'king': ['chrome'],
    'lila': ['prologue'], 'fisher': ['act1'], 'lumina': ['act3', 'epilogue'],
    'stone_child': ['act4', 'epilogue'], 'kaoru': ['act2', 'epilogue'],
    'mari': ['act1', 'act2'], 'renoir': ['act1', 'act2', 'act3', 'act4', 'act5', 'finale'],
}

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

def palette_for(frames):
    # One shared palette for the whole motion: no per-frame palette flicker.
    w, h = frames[0].size
    atlas = Image.new('RGB', (w * len(frames), h), (27, 32, 48))
    for i, frame in enumerate(frames):
        flat = Image.new('RGBA', frame.size, (27, 32, 48, 255))
        flat.alpha_composite(frame)
        atlas.paste(flat.convert('RGB'), (i * w, 0))
    return atlas.quantize(colors=255, method=Image.Quantize.MEDIANCUT)

def gif(path, frames, durations, palette=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    palette = palette or palette_for(frames)
    colors = (palette.getpalette() or [])[:765] + [0, 0, 0]
    indexed = []
    for frame in frames:
        image = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        image.putpalette(colors)
        clear = frame.getchannel('A').point(lambda a: 255 if a < 96 else 0)
        image.paste(255, mask=clear)
        image.info['transparency'] = 255
        indexed.append(image)
    # Explicit full frames retain fully transparent pauses. Pillow's multi-frame
    # optimizer can omit a blank last frame after disposal=2, losing its duration.
    with path.open('wb') as output:
        header, _ = GifImagePlugin.getheader(indexed[0], info={
            'loop': 0, 'background': 255, 'transparency': 255, 'optimize': False})
        for block in header: output.write(block)
        for frame, duration in zip(indexed, durations, strict=True):
            for block in GifImagePlugin.getdata(frame, duration=duration,
                    transparency=255, disposal=2, include_color_table=False):
                output.write(block)
        output.write(b';')
    with Image.open(path) as check:
        decoded = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(check)]
        assert len(decoded) == len(frames), f'{path}: missing frames'
        assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in decoded}) >= 2
        assert all(f.getchannel('A').getextrema()[0] == 0 for f in decoded)
        assert sum(f.info.get('duration', 0) for f in ImageSequence.Iterator(check)) == sum(durations)
        assert all(f.disposal_method == 2 for f in ImageSequence.Iterator(check))
        return {'gif': path.relative_to(OUT).as_posix(), 'size': list(check.size),
                'gifFrameCount': len(decoded), 'durationMs': sum(durations),
                'gifRepeatsForPreview': True, 'gifAlphaThreshold': 96}

def contact(items, path, columns=4):
    width, height = 248, 290
    canvas = Image.new('RGB', (width * columns, height * math.ceil(len(items)/columns)), '#101827')
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 18)
    except OSError:
        font = ImageFont.load_default(size=16)
    for i, (name, image) in enumerate(items):
        x, y = (i % columns) * width, (i // columns) * height
        image = ImageOps.contain(image, (224, 244), RESAMPLE)
        plate = Image.new('RGBA', (width, height), '#182337')
        plate.alpha_composite(image, ((width-image.width)//2, 4+(244-image.height)//2))
        canvas.paste(plate.convert('RGB'), (x, y))
        draw.text((x+12, y+260), name, font=font, fill='#e5edff')
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, quality=92)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--records', type=Path)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    records = json.loads((args.records or OUT/'prompts.json').read_text(encoding='utf8'))
    if (OUT/'manifest.json').exists() and not args.force:
        raise SystemExit('Outputs already exist; use --force to rebuild derived files.')
    frames_by_id, entries, provenance, edges, alpha_report = {}, [], [], [], []
    for record in records:
        aid = record['id']
        source = Path(record['sourcePath']) if 'sourcePath' in record else OUT/record['file']
        target = OUT/'source'/f'{aid}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != target.resolve():
            if target.exists() and hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest() and not args.force:
                raise SystemExit(f'{aid}: original exists and differs; use a new version or --force.')
            shutil.copy2(source, target)
        im = Image.open(target).convert('RGBA')
        assert im.width % 4 == 0 and im.height % 2 == 0, f'{aid}: unequal grid'
        alpha = im.getchannel('A')
        assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] > 200, f'{aid}: missing transparency or subject'
        alpha_report.append({'id':aid,'sourceSize':list(im.size),'alphaRange':alpha.getextrema()})
        fw, fh = im.width//4, im.height//2
        frames, frame_paths = [], []
        for i in range(8):
            x, y = (i % 4)*fw, (i//4)*fh
            original = im.crop((x, y, x+fw, y+fh))
            a = original.getchannel('A')
            strips = [a.crop((0,0,2,fh)),a.crop((fw-2,0,fw,fh)),a.crop((0,0,fw,2)),a.crop((0,fh-2,fw,fh))]
            strong = sum(sum(v>=160 for v in s.get_flattened_data()) for s in strips)
            if strong: edges.append({'id':aid,'cel':i,'strongEdgePixels':strong})
            frame = original.resize(CELL, RESAMPLE)
            assert frame.getchannel('A').getextrema()[1] > 96, f'{aid}/{i}: empty cel'
            rel = f'frames/{aid}/{i:03d}.png'
            (OUT/rel).parent.mkdir(parents=True,exist_ok=True)
            frame.save(OUT/rel)
            frame_paths.append(rel)
            frames.append(frame)
        frames_by_id[aid] = frames
        sheet = Image.new('RGBA',(CELL[0]*4,CELL[1]*2))
        for i, frame in enumerate(frames): sheet.alpha_composite(frame,((i%4)*CELL[0],(i//4)*CELL[1]))
        sheet_path = f'sheets/{aid}.png'
        (OUT/'sheets').mkdir(exist_ok=True)
        sheet.save(OUT/sheet_path)
        entry = {'id':aid,'name':record['name'],'category':record['category'],
                 'source':f'source/{aid}.png','sheet':sheet_path,'frames':frame_paths,
                 'grid':{'columns':4,'rows':2,'cellSize':list(CELL),'order':'row-major'},
                 'scenes':SCENES.get(aid,[]),'animations':{}}
        pal = palette_for(frames)
        if record['category']=='fx':
            blank = Image.new('RGBA',CELL)
            spec = gif(OUT/f'gifs/{aid}/effect.gif',frames+[blank],FX_TIMES,pal)
            entry['animations']['effect'] = {'name':'発動エフェクト','sequence':list(range(8))+[None],
                                               'durationsMs':FX_TIMES,'loop':False,**spec}
        else:
            keys = ['idle','walk','talk','greet'] if record['category']=='npc' else ['idle','walk','absorb','cast'] if record['category']=='support' else ['idle','walk','attack','hurt','cast']
            for key in keys:
                label, indices, durations, loop = ANIMS[key]
                spec = gif(OUT/f'gifs/{aid}/{key}.gif',[frames[i] for i in indices],durations,pal)
                entry['animations'][key] = {'name':label,'sequence':indices,'durationsMs':durations,'loop':loop,**spec}
        entries.append(entry)
        provenance.append({k:v for k,v in record.items() if k not in ('sourcePath','file')})
        provenance[-1].update(file=f'source/{aid}.png',tool='built-in imagegen')
        contact([(f'{aid} / {i+1}',f) for i,f in enumerate(frames)],OUT/f'review/{aid}.jpg')

    lookup = {e['id']:e for e in entries}
    for actor, action, label, effect in SPECIALS:
        char_frames, effect_frames = frames_by_id[actor], frames_by_id[effect]
        composite, durations = [], [280,220]+FX_TIMES[:-1]+[650]
        if actor == 'aria' and action == 'flash':
            # The sword strike uses its actual swing pose; the final stages
            # return to rest while the crescent dissipates.
            effect_sequence = [(5 if i < 5 else 0, i) for i in range(8)]
        else:
            effect_sequence = [(7,i) for i in range(8)]
        sequence = [(0,None),(6 if actor=='renoir' else 4,None)]+effect_sequence+[(0,None)]
        for ci, ei in sequence:
            frame = Image.new('RGBA',(384,480))
            frame.alpha_composite(char_frames[ci],(48,80))
            if ei is not None: frame.alpha_composite(effect_frames[ei],(48,16))
            composite.append(frame)
        spec = gif(OUT/f'gifs/{actor}/{action}.gif',composite,durations)
        lookup[actor]['animations'][action] = {'name':label,'loop':False,'layers':{'actor':actor,'effect':effect},
                                              'layerSequence':[{'actorCel':ci,'effectCel':ei} for ci,ei in sequence],
                                              'durationsMs':durations,**spec}
    counts = {'characters':sum(e['category']!='fx' for e in entries),'effects':sum(e['category']=='fx' for e in entries),
              'sourceSheets':len(entries),'pngCels':len(entries)*8,'gifs':sum(len(e['animations']) for e in entries)}
    manifest = {'version':1,'title':'Color Resonance ゲーム素材','counts':counts,
                'production':{'generator':'built-in imagegen','spriteGrid':[4,2],
                              'gifTransparency':'1-bit; PNG retains original smooth alpha',
                              'poseAlignment':'fixed source grid; no per-pose crop or scale',
                              'directionCount':1},'assets':entries}
    write(OUT/'manifest.json',manifest)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS = ' + json.dumps(manifest, ensure_ascii=False) + ';\n', encoding='utf8')
    write(OUT/'prompts.json',provenance)
    write(OUT/'quality-report.json',{'counts':counts,'alpha':alpha_report,'edgeReview':edges,
                                   'gifChecks':['full decode','multiple distinct frames','transparent pixels','duration matches sequence','disposal 2'],
                                   'visualReviewChecklist':['identity','pose transitions','loop boundary','cropping','translucent PNG on light/dark backdrops']})
    contact([(e['name'],frames_by_id[e['id']][4 if e['category']=='fx' else 0]) for e in entries],OUT/'overview.jpg')
    print(json.dumps({'counts':counts,'edgeReview':edges},ensure_ascii=False))

if __name__ == '__main__': main()
