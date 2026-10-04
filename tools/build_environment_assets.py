#!/usr/bin/env python3
"""Project generated water materials onto one fixed isometric tile plane."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from build_game_assets import gif, contact, write, RESAMPLE

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated'
CELL=(256,192)
VERTICES=[(128,42),(228,96),(128,150),(28,96)]
DURATIONS=[200]*12

def bilinear(image, x, y, wrap=False):
    n=image.width
    if wrap:x%=n;y%=n
    else:x=max(0,min(n-1,x));y=max(0,min(n-1,y))
    ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
    nx=(ix+1)%n if wrap else min(ix+1,n-1)
    ny=(iy+1)%n if wrap else min(iy+1,n-1)
    pixels=image.load()
    return tuple((pixels[ix,iy][k]*(1-fx)+pixels[nx,iy][k]*fx)*(1-fy)+
                 (pixels[ix,ny][k]*(1-fx)+pixels[nx,ny][k]*fx)*fy for k in range(3))

def periodize_material(source, rec):
    # Square UV coordinates are the two lattice axes of the diamond.
    n=256
    if rec.get('sourceLayout')=='square-uv':
        raw=source.crop(tuple(rec['sourceUvCropPx'])).resize((n+1,n+1),Image.Resampling.BICUBIC)
    else:
        left,top,right,bottom=rec['sourcePlaneBoxPx'];cx,cy=rec['sourcePlaneCenterPx']
        hx=(right-left)*(1-rec['uvInset'])/2;hy=(bottom-top)*(1-rec['uvInset'])/2
        raw=source.transform((n+1,n+1),Image.Transform.AFFINE,
            (hx/n,-hx/n,cx,hy/n,hy/n,cy-hy),resample=Image.Resampling.BICUBIC)
    alpha_min=raw.getchannel('A').getextrema()[0];assert alpha_min>=200
    raw_rgb=raw.convert('RGB');raw_rgb.save(OUT/rec['unperiodizedUv'])
    texture=Image.new('RGB',(n,n));pixels=texture.load()
    for y in range(n):
        for x in range(n):
            color=[0.,0.,0.]
            for a in [0,1]:
                s=(x/n+a*.5)%1;wx=math.sin(math.pi*s)**2
                for b in [0,1]:
                    t=(y/n+b*.5)%1;weight=wx*math.sin(math.pi*t)**2
                    sample=bilinear(raw_rgb,(s if a==0 else 1-s)*n,(t if b==0 else 1-t)*n)
                    for k in range(3):color[k]+=sample[k]*weight
            pixels[x,y]=tuple(round(v) for v in color)
    def mean_luminance(im):
        values=im.tobytes()
        return sum(.2126*values[i]+.7152*values[i+1]+.0722*values[i+2] for i in range(0,len(values),3))/(len(values)//3)
    source_mean=mean_luminance(raw_rgb);periodic_mean=mean_luminance(texture)
    gain=source_mean/periodic_mean
    texture=texture.point(lambda v:min(255,round(v*gain)))
    texture.save(OUT/rec['periodicUv'])
    return texture,alpha_min,dict(sourceUvMean=source_mean,beforeNormalization=periodic_mean,
        uniformRgbGain=gain,afterNormalization=mean_luminance(texture))

def render_plane(texture, coverage, rec, phase):
    base=Image.new('RGBA',CELL);pixels=base.load();alpha=coverage.load()
    for y in range(CELL[1]):
        for x in range(CELL[0]):
            if alpha[x,y]==0:continue
            # Rational lattice coordinates avoid a rounding difference when
            # neighboring pixels are displaced by exactly (100,54).
            uu=(54*(2*x+1-256)+100*(2*y+1-192)+10800)%21600
            vv=(-54*(2*x+1-256)+100*(2*y+1-192)+10800)%21600
            u=uu/21600;v=vv/21600
            rgb=bilinear(texture,u*texture.width,v*texture.height,wrap=True)
            weight=(1+math.cos(2*math.pi*((u-phase)%1)))/2
            pixels[x,y]=(*[min(255,round(rgb[k]+rec['reflectionAddRgb'][k]*weight)) for k in range(3)],alpha[x,y])
    return base

def neighbor_difference(frame):
    pixels=frame.load();worst=0;pairs=0
    for dx,dy in [(100,54),(-100,54)]:
        for y in range(CELL[1]):
            for x in range(CELL[0]):
                xx,yy=x+dx,y+dy
                if 0<=xx<CELL[0] and 0<=yy<CELL[1] and pixels[x,y][3]>=200 and pixels[xx,yy][3]>=200:
                    worst=max(worst,max(abs(pixels[x,y][k]-pixels[xx,yy][k]) for k in range(3)));pairs+=1
    return worst,pairs

def main():
    records=json.loads((OUT/'environment-set-07.json').read_text())
    manifest=json.loads((OUT/'manifest.json').read_text())
    prompts=json.loads((OUT/'prompts.json').read_text())
    quality=json.loads((OUT/'quality-report.json').read_text())
    ids={r['id'] for r in records}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids]
    prompts=[a for a in prompts if a['id'] not in ids]
    high=Image.new('L',(CELL[0]*4,CELL[1]*4))
    # A 2% coverage apron overlaps the antialiased edge of neighboring tiles.
    # Logical footprint remains 200x108; source-over does not darken a shared rim.
    ImageDraw.Draw(high).polygon([(round((128+(x-128)*1.02)*4),round((96+(y-96)*1.02)*4)) for x,y in VERTICES],fill=255)
    coverage=high.resize(CELL,Image.Resampling.BOX)
    checks=[]
    for rec in records:
        aid=rec['id'];source=Image.open(OUT/rec['source']).convert('RGBA')
        texture,source_alpha_min,luminance_normalization=periodize_material(source,rec)
        assert coverage.crop((0,0,24,192)).getextrema()==(0,0)
        assert coverage.crop((232,0,256,192)).getextrema()==(0,0)
        assert coverage.crop((0,0,256,24)).getextrema()==(0,0)
        assert coverage.crop((0,168,256,192)).getextrema()==(0,0)
        cels=[render_plane(texture,coverage,rec,i/12) for i in range(12)]
        assert cels[0].tobytes()==render_plane(texture,coverage,rec,1).tobytes()
        neighbor_checks=[neighbor_difference(f) for f in cels]
        assert all(diff==0 and pairs>0 for diff,pairs in neighbor_checks),neighbor_checks
        paths=[]
        for i,cel in enumerate(cels):
            path=OUT/f'frames/{aid}/{i:03}.png';path.parent.mkdir(parents=True,exist_ok=True);cel.save(path)
            paths.append(path.relative_to(OUT).as_posix())
        sheet=Image.new('RGBA',(CELL[0]*4,CELL[1]*3))
        for i,cel in enumerate(cels):sheet.alpha_composite(cel,((i%4)*CELL[0],(i//4)*CELL[1]))
        sheet.save(OUT/f'sheets/{aid}.png')
        spec=gif(OUT/f'gifs/{aid}/ambient.gif',cels,DURATIONS);spec['gifRepeatsForPreview']=False
        with Image.open(OUT/spec['gif']) as im:
            decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
            assert im.info['loop']==0
        assert len({f.getchannel('A').tobytes() for f in decoded})==1
        assert all(f.getchannel('A').getpixel((128,96))==255 for f in decoded)
        assert all(neighbor_difference(f)[0]==0 for f in decoded)
        groups=[]
        for cel in cels:
            group=Image.new('RGBA',(880,480))
            for row in range(4):
                for col in range(4):group.alpha_composite(cel,(440+(col-row)*100-128,72+(col+row)*54-96))
            groups.append(group)
        gif(OUT/f'review/{aid}-4x4.gif',groups,DURATIONS)
        animation=dict(name='水面の広い反射',sequence=list(range(12)),durationsMs=DURATIONS,
            frameStartsMs=[200*i for i in range(12)],loop=True,**spec)
        manifest['assets'].append(dict(id=aid,name=rec['name'],category='fx',assetRole='environment',
            facing='floor-isometric',source=rec['source'],sourceSize=list(source.size),sheet=f'sheets/{aid}.png',
            frames=paths,grid=dict(columns=4,rows=3,cellSize=list(CELL),order='row-major'),
            pivotPx=[128,96],planeVerticesPx=VERTICES,footprintWidthPx=200,coverageApronScale=1.02,
            floorCondition=rec['floorCondition'],productionSet='environment-set-07',tilePreviewGif=f'review/{aid}-4x4.gif',animations={'ambient':animation}))
        prompts.append({**rec,'sourceSha256':hashlib.sha256((OUT/rec['source']).read_bytes()).hexdigest(),
            'animationMethod':'sin-squared overlap-add of half-period shifted/reflected UV patches; periodic bilinear sampling; cos(2*pi*(u-phase)) lighting; 200x108 logical plane',
            'planeCoverageAlpha':'fixed geometric mask with 2% coverage apron; not the original source alpha',
            'luminanceNormalization':luminance_normalization,
            'reflectionPhases':[i/12 for i in range(12)],'durationsMs':DURATIONS})
        contact([(f'{aid} / {i}',c) for i,c in enumerate(cels)],OUT/f'review/{aid}.jpg',columns=4)
        checks.append(dict(id=aid,pngCels=12,gifFrames=12,durationMs=2400,loop=True,
            phaseAtPeriodReturnsStart=True,loopBoundaryPhaseStep=1/12,noDuplicateHoldFrame=True,
            allPngAlphaIdentical=True,allGifAlphaIdentical=True,centerAlpha=255,
            planeVerticesPx=VERTICES,minimumSampledSourceAlpha=source_alpha_min,transparentClearancePx=24,
            allFrameNeighborOpaqueRgbDifference=0,neighborPairsPerFrame=neighbor_checks[0][1],coverageApronScale=1.02,
            luminanceNormalization=luminance_normalization,
            continuousVisualPlayback='NOT VERIFIED',actualGamePlacement='NOT VERIFIED'))
    assets=manifest['assets'];manifest['counts']=dict(characters=sum(a['category']!='fx' for a in assets),
        effects=sum(a['category']=='fx' for a in assets),sourceSheets=len(assets),pngCels=sum(len(a['frames']) for a in assets),
        gifs=sum(len(a['animations'])+sum('previewGif' in v for v in a['animations'].values()) for a in assets))
    quality['environmentSet07']=dict(assetCount=2,checks=checks)
    write(OUT/'manifest.json',manifest);write(OUT/'prompts.json',prompts);write(OUT/'quality-report.json',quality)
    (OUT/'catalog-data.js').write_text('window.COLOR_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
    contact([(a['id'],Image.open(OUT/a['frames'][4 if a['category']=='fx' else 0]).convert('RGBA')) for a in assets],OUT/'overview.jpg',columns=6)
    overview=Image.new('RGB',(768,768),'#152033');draw=ImageDraw.Draw(overview)
    for col,rec in enumerate(records):
        for row,bg in enumerate(['#182337','#e8eef3']):
            plate=Image.new('RGBA',(384,384),bg);cel=Image.open(OUT/f'frames/{rec["id"]}/004.png').convert('RGBA')
            plate.alpha_composite(cel,(64,96));overview.paste(plate.convert('RGB'),(col*384,row*384))
            draw.text((col*384+20,row*384+20),rec['id'],fill='white' if row==0 else '#172332')
    overview.save(OUT/'review/environment-set-07.png')
    print(json.dumps(dict(counts=manifest['counts'],checks=checks)))

if __name__=='__main__':main()
