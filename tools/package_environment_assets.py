#!/usr/bin/env python3
"""Bundle water surface loops, generated masters, references and exporter."""
import json
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    records=json.loads((OUT/'environment-set-07.json').read_text());ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text());assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=2,sourceSheets=2,pngCels=24,gifs=2)}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={'environment-set-07.json','review/environment-set-07.png','review/sea_surface_prism-4x4.gif','review/sea_surface_dull-4x4.gif'}
    for a in assets:
        files.update([a['source'],a['sheet'],*a['frames'],f'review/{a["id"]}.jpg'])
        files.update(m['gif'] for m in a['animations'].values())
    for r in records:
        files.update([r['reference'],r['editBase'],r['periodicUv'],r['unperiodizedUv']])
        if 'originalTileReference' in r:files.add(r['originalTileReference'])
        for history in r.get('sourceHistory',[]):
            files.update(history[key] for key in ['source','editBase','reference','geometryReference'] if key in history)
    guide=(OUT/'README.md').read_text().split('## 環境水面 第7セット',1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    destination=OUT/'downloads/environment-set07.zip';destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        archive.writestr('README.md','# Color Resonance 環境水面 第7セット\n'+guide+'\n')
        archive.writestr('assets/generated/README.md','## 環境水面 第7セット\n'+guide+'\n')
        archive.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        archive.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        quality=json.loads((OUT/'quality-report.json').read_text())
        archive.writestr('assets/generated/quality-report.json',json.dumps({'environmentSet07':quality['environmentSet07']},ensure_ascii=False,indent=2)+'\n')
        for path in sorted(files):archive.write(OUT/path,'assets/generated/'+path)
        for tool in ['build_game_assets.py','build_environment_assets.py','package_environment_assets.py']:
            archive.write(ROOT/'tools'/tool,'tools/'+tool)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert all(not p.startswith('/') and '..' not in Path(p).parts for p in archive.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} asset/source files')

if __name__=='__main__':main()
