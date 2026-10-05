#!/usr/bin/env python3
"""Package the summoned-spirit departure master and editable exporter."""
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    records=json.loads((OUT/'departure-set-13.json').read_text())
    ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text())
    assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=1,sourceSheets=1,pngCels=12,gifs=2)}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'departure-set-13.json','review/departure-set-13.png'}
    for a in assets:
        files.update([a['source'],a['sheet'],*a['frames'],f'review/{a["id"]}.jpg'])
        for motion in a['animations'].values(): files.update([motion['gif'],motion['previewGif']])
    for rec in records: files.update(rec['references'])
    guide=(OUT/'README.md').read_text().split('## 精霊の帰還 第13セット',1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    root_guide=re.sub(r'\]\((?!https?://|#)([^)]+)\)',r'](assets/generated/\1)',guide)
    destination=OUT/'downloads/departure-set13.zip'
    quality=json.loads((OUT/'quality-report.json').read_text())
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        z.writestr('README.md','# Color Resonance 精霊の帰還 第13セット\n'+root_guide+'\n')
        z.writestr('assets/generated/README.md','## 精霊の帰還 第13セット\n'+guide+'\n')
        z.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        z.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        z.writestr('assets/generated/quality-report.json',json.dumps({'departureSet13':quality['departureSet13']},ensure_ascii=False,indent=2)+'\n')
        for name in sorted(files): z.write(OUT/name,'assets/generated/'+name)
        for name in ['build_game_assets.py','build_departure_assets.py','package_departure_assets.py']:
            z.write(ROOT/'tools'/name,'tools/'+name)
    with zipfile.ZipFile(destination) as z:
        assert z.testzip() is None
        assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} source/media files')

if __name__=='__main__':
    main()
