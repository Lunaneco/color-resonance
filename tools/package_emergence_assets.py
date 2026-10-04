#!/usr/bin/env python3
"""Package editable enemy emergence masters, cels, GIFs and their exporter."""
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    records=json.loads((OUT/'emergence-set-11.json').read_text());ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text());assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=2,sourceSheets=2,pngCels=24,gifs=4)}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'emergence-set-11.json','review/emergence-set-11.png'}
    for asset in assets:
        files.update([asset['source'],asset['sheet'],*asset['frames'],f'review/{asset["id"]}.jpg'])
        for motion in asset['animations'].values():files.update([motion['gif'],motion['previewGif']])
    files.update(r['reference'] for r in records)
    files.update(r['editBase'] for r in records if 'editBase' in r)
    guide=(OUT/'README.md').read_text().split('## 敵の出現 第11セット',1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    root_guide=re.sub(r'\]\((?!https?://|#)([^)]+)\)',r'](assets/generated/\1)',guide)
    destination=OUT/'downloads/emergence-set11.zip';destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        archive.writestr('README.md','# Color Resonance 敵の出現 第11セット\n'+root_guide+'\n')
        archive.writestr('assets/generated/README.md','## 敵の出現 第11セット\n'+guide+'\n')
        archive.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        archive.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        quality=json.loads((OUT/'quality-report.json').read_text())
        archive.writestr('assets/generated/quality-report.json',json.dumps({'emergenceSet11':quality['emergenceSet11']},ensure_ascii=False,indent=2)+'\n')
        for path in sorted(files):archive.write(OUT/path,'assets/generated/'+path)
        for tool in ['build_game_assets.py','build_emergence_assets.py','package_emergence_assets.py']:
            archive.write(ROOT/'tools'/tool,'tools/'+tool)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert all(not p.startswith('/') and '..' not in Path(p).parts for p in archive.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} asset/source files')

if __name__=='__main__':main()
