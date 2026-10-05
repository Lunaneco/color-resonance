#!/usr/bin/env python3
"""Package generated UI art. Equal-cell cropping, resizing and GIF encoding only."""
import json
from pathlib import Path
from PIL import Image, ImageSequence
import build_game_assets as packaging

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ui'

def main():
    source = Image.open(OUT / 'bloom-sheet-source.png').convert('RGBA')
    assert source.size == (1536, 1024) and source.getchannel('A').getextrema()[0] == 0
    packaging.OUT = OUT
    frames = []
    for i in range(6):
        x, y = i % 3 * 512, i // 3 * 512
        cel = source.crop((x, y, x + 512, y + 512)).resize((192, 192), Image.Resampling.LANCZOS)
        assert cel.getchannel('A').getextrema()[1] > 200
        frames.append(cel)
    frames[3].save(OUT / 'star-bloom-still.png')
    blank = Image.new('RGBA', (192, 192))
    durations = [80, 150, 160, 180, 250, 180, 160, 240]
    report = packaging.gif(OUT / 'star-bloom.gif', [blank] + frames + [blank], durations)
    # Upgrade is an event, so the deployed GIF has no looping extension.
    path = OUT / 'star-bloom.gif'
    extension = b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'
    raw = path.read_bytes()
    assert raw.count(extension) == 1
    path.write_bytes(raw.replace(extension, b''))
    with Image.open(path) as check:
        assert 'loop' not in check.info
        cels = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(check)]
        assert len(cels) == 8 and sum(f.info['duration'] for f in ImageSequence.Iterator(check)) == 1400
        assert cels[-1].getchannel('A').getextrema()[1] == 0
    bg = Image.open(OUT / 'star-grove-source.png')
    bg.save(OUT / 'star-grove.webp', quality=87)
    packaging.contact([(str(i + 1), f) for i, f in enumerate(cels[1:-1])], OUT / 'bloom-contact.jpg', columns=3)
    report.update(gifRepeatsForPreview=False, transparentEnd=True, sourceSize=list(source.size),
                  cellSize=[512, 512], grid=[3, 2], backgroundBytes=(OUT / 'star-grove.webp').stat().st_size,
                  gifBytes=path.stat().st_size, reducedMotion='No GIF inserted; static tree, stage lights and success message')
    (OUT / 'quality-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
