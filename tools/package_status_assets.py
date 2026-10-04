#!/usr/bin/env python3
"""Bundle the two continuous status loops, masters, references and exporter."""
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    records=json.loads((OUT/'status-set-06.json').read_text())
    ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text())
    assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=2,sourceSheets=2,pngCels=12,gifs=2)}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'status-set-06.json','review/status-set-06.png'}
    for a in assets:
        files.update([a['source'],a['sheet'],*a['frames'],f'review/{a["id"]}.jpg'])
        files.update(m['gif'] for m in a['animations'].values())
    for r in records:
        files.add(r['reference'])
        if 'editBase' in r:files.add(r['editBase'])
    guide=(OUT/'README.md').read_text().split('## 状態継続 第6セット',1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    readme='# Color Resonance 状態継続 第6セット\n\n'+guide+'\n'
    destination=OUT/'downloads/status-set06.zip'
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        archive.writestr('README.md',readme)
        archive.writestr('assets/generated/README.md','## 状態継続 第6セット\n'+guide+'\n')
        archive.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        archive.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        quality=json.loads((OUT/'quality-report.json').read_text())
        archive.writestr('assets/generated/quality-report.json',json.dumps({'statusSet06':quality['statusSet06']},ensure_ascii=False,indent=2)+'\n')
        for path in sorted(files):archive.write(OUT/path,'assets/generated/'+path)
        for tool in ['build_game_assets.py','build_status_assets.py','package_status_assets.py']:
            archive.write(ROOT/'tools'/tool,'tools/'+tool)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert all(not p.startswith('/') and '..' not in Path(p).parts for p in archive.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} asset/source files')

if __name__=='__main__':main()
