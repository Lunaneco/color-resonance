#!/usr/bin/env python3
"""Package the first learned-skill set with editable sources and timing data."""
import argparse
import json
import re
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--records',type=Path,default=OUT/'learned-set-01.json')
    args=parser.parse_args()
    set_name=args.records.stem
    number=set_name.rsplit('-',1)[-1]
    records=json.loads(args.records.read_text())
    ids={r['id'] for r in records}
    manifest=json.loads((OUT/'manifest.json').read_text())
    assets=[a for a in manifest['assets'] if a['id'] in ids]
    subset={**manifest,'assets':assets,'counts':dict(characters=0,effects=len(assets),
            sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
            gifs=sum(len(a['animations'])*2 for a in assets))}
    prompts=[r for r in json.loads((OUT/'prompts.json').read_text()) if r['id'] in ids]
    files={args.records.name,f'review/{set_name}.png'}
    for asset in assets:
        files.update([asset['source'],asset['sheet'],*asset['frames']])
        files.add(f'review/{asset["id"]}.jpg')
        for motion in asset['animations'].values():files.update([motion['gif'],motion['previewGif']])
    for rec in records:
        files.add(f'source/{rec["reference"]}.png')
        if 'referenceCel' in rec:files.add(rec['referenceCel'])
        if 'editBase' in rec:files.add(rec['editBase'])
        if 'sourceEdit' in rec:files.update([rec['sourceEdit']['base'],rec['sourceEdit']['generatedEdit']])
    heading=f'## 習得技 第{int(number)}セット'
    full_guide=(OUT/'README.md').read_text()
    guide=full_guide.split(heading,1)[1].split('\n## ',1)[0]
    guide='\n'.join(line for line in guide.splitlines() if 'まとめて保存](downloads/' not in line)
    readme=f'# Color Resonance 習得技 第{int(number)}セット\n\n'+ '・'.join(r['name'] for r in records)+f'の{len(records)}点です。ファイルは `assets/generated/` にあります。\n\n## 使い方\n'+guide
    if number!='01':
        common=re.search(r'```js\n.*?```',full_guide,re.S)
        if common:readme+='\n\n## Canvasの共通例\n\n'+common.group(0)+'\n'
    destination=OUT/f'downloads/learned-set{number}.zip'
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        archive.writestr('README.md',readme)
        archive.writestr('assets/generated/manifest.json',json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
        archive.writestr('assets/generated/prompts.json',json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
        quality=json.loads((OUT/'quality-report.json').read_text())
        archive.writestr('assets/generated/quality-report.json',json.dumps(
            {k:quality[k] for k in ['learnedSet'+number,'playbackContract'] if k in quality},ensure_ascii=False,indent=2)+'\n')
        for path in sorted(files):archive.write(OUT/path,'assets/generated/'+path)
        for tool in ['build_game_assets.py','build_learned_assets.py']:
            archive.write(ROOT/'tools'/tool,'tools/'+tool)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert all(not p.startswith('/') and '..' not in Path(p).parts for p in archive.namelist())
    print(f'{destination.name}: {destination.stat().st_size} bytes; {len(files)} asset/source files')

if __name__=='__main__':main()
