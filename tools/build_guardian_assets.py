"""Export native transparent guardian cels on the two generated fixed grids."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/guardians'
OUT = ROOT / 'assets/generated'
groups = [
    ('atlas-main.png', 4, 2, [None, 'tokinel', None, None, None, 'nephra', 'farol', 'rivela']),
    ('atlas-restoration.png', 3, 2, ['pomela', 'folio', 'fiamma', 'lucerna', 'coronel', 'aster']),
]
names = dict(zip(['tokinel','nephra','farol','rivela','pomela','folio','fiamma','lucerna','coronel','aster'], ['時針のトキネル','夜渡りのネフラ','港灯のファロル','水紐のリヴェラ','苗耳のポメラ','紙翼のフォリオ','炉火のフィアンマ','灯翅のルチェルナ','冠枝のコロネル','星璃のアステル']))
manifest = json.loads((OUT / 'manifest.json').read_text())
report = {'generator': 'built-in imagegen', 'processing': 'fixed grid; transparent pad; native alpha; no repaint', 'assets': {}}
unused = ['guardian_miranel','guardian_neldia','guardian_aurum','guardian_prielle']
manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in unused]
for asset_id in unused:
    for folder in ['source','sheets']:
        (OUT / folder / (asset_id + '.png')).unlink(missing_ok=True)
    target = OUT / 'frames' / asset_id
    if target.exists(): shutil.rmtree(target)
for source, columns, rows, ids in groups:
    im = Image.open(SOURCE / source).convert('RGBA')
    width, height = (im.width + columns - 1) // columns, (im.height + rows - 1) // rows
    padded = Image.new('RGBA', (width * columns, height * rows))
    padded.paste(im, (0, 0))
    for i, guardian in enumerate(ids):
        if guardian is None: continue
        asset_id = 'guardian_' + guardian
        cel = padded.crop((i % columns * width, i // columns * height, (i % columns + 1) * width, (i // columns + 1) * height))
        (OUT / 'frames' / asset_id).mkdir(parents=True, exist_ok=True)
        for target in [OUT / 'source' / (asset_id + '.png'), OUT / 'sheets' / (asset_id + '.png'), OUT / 'frames' / asset_id / '000.png']:
            cel.save(target)
        animations = {action: {'name': label, 'sequence': [0], 'durationsMs': [900], 'durationMs': 900, 'loop': action in ['idle', 'walk']} for action, label in [('idle', '待機'), ('walk', '移動'), ('attack', '特殊行動'), ('hurt', '被弾')]}
        asset = {'id': asset_id, 'name': names[guardian], 'category': 'enemy', 'source': 'source/' + asset_id + '.png', 'sheet': 'sheets/' + asset_id + '.png', 'frames': ['frames/' + asset_id + '/000.png'], 'grid': {'columns': 1, 'rows': 1, 'cellSize': [width, height], 'order': 'row-major'}, 'animations': animations}
        manifest['assets'] = [a for a in manifest['assets'] if a['id'] != asset_id] + [asset]
        report['assets'][asset_id] = {'atlas': source, 'cell': i, 'alphaRange': list(cel.getchannel('A').getextrema()), 'size': list(cel.size), 'sha256': hashlib.sha256((OUT / asset['sheet']).read_bytes()).hexdigest()}
manifest['counts']['characters'] = sum(a['category'] != 'fx' for a in manifest['assets'])
manifest['counts']['sourceSheets'] = len(manifest['assets'])
manifest['counts']['pngCels'] = sum(len(a['frames']) for a in manifest['assets'])
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(OUT / 'catalog-data.js').write_text('window.COLOR_ASSETS=' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')
(OUT / 'quality-guardians.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Exported 10 transparent guardian cels; motion and recovery are rendered by the game.')
