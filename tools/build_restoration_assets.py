"""Pack the saved restoration originals on their fixed 2 × 2 pose grid."""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/restoration'
OUT = ROOT / 'assets/generated'
manifest_path = OUT / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
report = {'generator': 'built-in imagegen', 'processing': 'fixed grid; transparent pad; encode only', 'assets': {}}


def animation(name, sequence, durations, loop=False):
    return {'name': name, 'sequence': sequence, 'durationsMs': durations,
            'loop': loop, 'durationMs': sum(durations)}


for asset_id, name in [('chrome_human', 'クロム（復興編）'), ('achroma', '均彩の管理者アクロマ')]:
    original = SOURCE / (asset_id + '.png')
    image = Image.open(original).convert('RGBA')
    width, height = (image.width + 1) // 2, (image.height + 1) // 2
    sheet = Image.new('RGBA', (width * 2, height * 2))
    sheet.paste(image, (0, 0))
    (OUT / 'frames' / asset_id).mkdir(parents=True, exist_ok=True)
    shutil.copy2(original, OUT / 'source' / (asset_id + '.png'))
    sheet.save(OUT / 'sheets' / (asset_id + '.png'))
    frames = []
    for n in range(4):
        frame = f'frames/{asset_id}/{n:03}.png'
        sheet.crop((n % 2 * width, n // 2 * height, (n % 2 + 1) * width, (n // 2 + 1) * height)).save(OUT / frame)
        frames.append(frame)
    asset = {'id': asset_id, 'name': name, 'category': 'ally' if asset_id == 'chrome_human' else 'enemy',
             'source': f'source/{asset_id}.png', 'sourceSize': list(image.size),
             'sheet': f'sheets/{asset_id}.png', 'frames': frames,
             'grid': {'columns': 2, 'rows': 2, 'cellSize': [width, height], 'order': 'row-major'},
             'animations': {
                 'idle': animation('待機', [0], [1600], True),
                 'walk': animation('移動', [0, 1], [190, 190], True),
                 'attack': animation('斬撃', [0, 2, 2, 0], [120, 180, 200, 220]),
                 'hurt': animation('被弾', [0, 0] if asset_id == 'chrome_human' else [3, 0], [160, 320]),
                 'purify': animation('浄化', [0, 3, 3, 0], [150, 350, 600, 200]),
                 'pray': animation('祈り', [0, 3, 3, 0], [150, 350, 600, 200]),
             }}
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] != asset_id] + [asset]
    report['assets'][asset_id] = {'sourceSize': list(image.size), 'cellSize': [width, height],
        'alphaRange': list(image.getchannel('A').getextrema()),
        'sheetSha256': hashlib.sha256((OUT / asset['sheet']).read_bytes()).hexdigest()}

Image.open(SOURCE / 'restoration_background.png').convert('RGB').save(ROOT / 'assets/bg/restoration.jpg', quality=90, optimize=True)
manifest['counts']['characters'] = sum(a['category'] != 'fx' for a in manifest['assets'])
manifest['counts']['sourceSheets'] = len(manifest['assets'])
manifest['counts']['pngCels'] = sum(len(a['frames']) for a in manifest['assets'])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(OUT / 'catalog-data.js').write_text('window.COLOR_ASSETS=' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')
(OUT / 'quality-restoration.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Packed 2 actors, 8 fixed-grid PNG poses and the restoration background.')
