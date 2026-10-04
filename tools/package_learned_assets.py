#!/usr/bin/env python3
"""Package the first learned-skill set with editable sources and timing data."""
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    records=json.loads((OUT/'learned-set-01.json').read_text())
    ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text())
    assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=len(assets),
            sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
            gifs=sum(len(a['animations'])*2 for a in assets))}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'learned-set-01.json','review/learned-set-01.png'}
    for asset in assets:
        files.update([asset['source'],asset['sheet'],*asset['frames']])
        files.add(f'review/{asset["id"]}.jpg')
        for motion in asset['animations'].values():files.update([motion['gif'],motion['previewGif']])
    for rec in records:
        files.add(f'source/{rec["reference"]}.png')
        if 'sourceEdit' in rec:files.update([rec['sourceEdit']['base'],rec['sourceEdit']['generatedEdit']])
    guide=(OUT/'README.md').read_text().split('## 習得技 第1セット',1)[1]
    readme='# Color Resonance 習得技 第1セット\n\n水鏡の矢・花守り・金継ぎの突きの3点です。ファイルは `assets/generated/` にあります。\n\n## 使い方\n'+guide
    destination=OUT/'downloads/learned-set01.zip'
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        archive.writestr('README.md',readme)
        archive.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        archive.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        quality=json.loads((OUT/'quality-report.json').read_text())
        archive.writestr('assets/generated/quality-report.json',json.dumps(
            {k:quality[k] for k in ['learnedSet01','playbackContract'] if k in quality},ensure_ascii=False,indent=2)+'\n')
        for path in sorted(files):archive.write(OUT/path,'assets/generated/'+path)
        for tool in ['build_game_assets.py','build_learned_assets.py']:
            archive.write(ROOT/'tools'/tool,'tools/'+tool)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert all(not p.startswith('/') and '..' not in Path(p).parts for p in archive.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} asset/source files')

if __name__=='__main__':main()
