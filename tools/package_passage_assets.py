#!/usr/bin/env python3
"""Package the registered heart-sword passage source and editable exporter."""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated'

def main():
    records=json.loads((OUT/'passage-set-12.json').read_text())
    ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text())
    assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=1,sourceSheets=1,pngCels=12,gifs=2)}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'passage-set-12.json','review/passage-set-12.png'}
    for asset in assets:
        files.update([asset['source'],asset['sheet'],*asset['frames'],f'review/{asset["id"]}.jpg'])
        for motion in asset['animations'].values():
            files.update([motion['gif'],motion['previewGif']])
    for rec in records:
        files.update(rec['references'])
        files.update([rec['editBase'],rec['priorEditMaster']])
    guide=(OUT/'README.md').read_text().split('## 心剣の通り抜け 第12セット',1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    root_guide=re.sub(r'\]\((?!https?://|#)([^)]+)\)',r'](assets/generated/\1)',guide)
    destination=OUT/'downloads/passage-set12.zip'
    destination.parent.mkdir(exist_ok=True)
    quality=json.loads((OUT/'quality-report.json').read_text())
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        z.writestr('README.md','# Color Resonance 心剣の通り抜け 第12セット\n'+root_guide+'\n')
        z.writestr('assets/generated/README.md','## 心剣の通り抜け 第12セット\n'+guide+'\n')
        z.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        z.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        z.writestr('assets/generated/quality-report.json',json.dumps({'passageSet12':quality['passageSet12']},ensure_ascii=False,indent=2)+'\n')
        for name in sorted(files):
            z.write(OUT/name,'assets/generated/'+name)
        for name in ['build_game_assets.py','build_passage_assets.py','package_passage_assets.py']:
            z.write(ROOT/'tools'/name,'tools/'+name)
    with zipfile.ZipFile(destination) as z:
        assert z.testzip() is None
        assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} source/media files')

if __name__=='__main__':
    main()
