"""Package the generated minigame originals without repainting any image."""
from PIL import Image, ImageOps
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent / 'assets' / 'minigames'
report = {'generator': 'built-in image_gen.imagegen',
          'operations': 'Mechanical copy, rectangular crop, uniform scaling and WebP encoding only',
          'assets': []}
for name in ['voyage', 'crystal', 'lantern', 'echo']:
    image = Image.open(root / 'source' / (name + '.png'))
    image.convert('RGB').resize((768, 512), Image.Resampling.LANCZOS).save(
        root / (name + '-cover.webp'), quality=84, method=6)
    report['assets'].append({'path': name + '-cover.webp',
                            'source': 'source/' + name + '.png', 'size': [768, 512]})

image = Image.open(root / 'source' / 'props.png').convert('RGBA')
names = ['ship', 'treasure', 'wind', 'heal', 'reef', 'tide', 'leaf',
         'gold', 'prism', 'lantern-on', 'lantern-off', 'nova']
width, height = image.size
# Row heights vary in the generated atlas. The cuts lie in inspected alpha gutters.
row_edges = [0, 383, 693, height]
for index, name in enumerate(names):
    row, col = divmod(index, 4)
    cell = (round(col * width / 4), row_edges[row],
            round((col + 1) * width / 4), row_edges[row + 1])
    tile = image.crop(cell)
    bounds = tile.getchannel('A').point(lambda p: 255 if p > 24 else 0).getbbox()
    assert bounds is not None
    resized = ImageOps.contain(tile.crop(bounds), (116, 116), Image.Resampling.LANCZOS)
    output = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    output.paste(resized, ((128 - resized.width) // 2, (128 - resized.height) // 2))
    output.save(root / (name + '.webp'), lossless=True, method=6)
    alpha = output.getchannel('A').getextrema()
    assert alpha == (0, 255)
    report['assets'].append({'path': name + '.webp', 'source': 'source/props.png',
                            'cell': list(cell), 'alphaBounds': list(bounds),
                            'size': [128, 128], 'alphaExtrema': list(alpha)})
report['deliveryBytes'] = sum(p.stat().st_size for p in root.glob('*.webp'))
(root / 'quality.json').write_text(json.dumps(report, indent=2) + '\n')
print('Minigame WebP delivery bytes:', report['deliveryBytes'])
