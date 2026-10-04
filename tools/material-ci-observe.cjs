'use strict';
// Best-effort failure observation. Original calls/errors remain outside observation catches.
const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module');
const safelyWrite=message=>{try{process.stderr.write(message);}catch{}};
function observeWithin(fn,ms){
  let timer;
  return Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('observation deadline')),ms);
  })]).finally(()=>clearTimeout(timer));
}
try{
  if(process.env.CI_MATERIAL_DIAGNOSTIC==='1'&&process.argv.some(a=>/[\\/]tests[\\/]battle\.test\.cjs$/.test(path.resolve(a)))){
    const requireGame=createRequire(path.join(process.cwd(),'package.json')),{chromium}=requireGame('playwright');
    const originalLaunch=chromium.launch;
    const knownIds=['aria','renoir','boss','lead','thorn','shade','gran','ivy','spinel','king','crystal_slash','pray_heal','night_sky','gran_tide','ivy_vines','spinel_shield','king_prism','thorn_ranged_hit','membrane_pressure_hit'];
    let failures=0;
    chromium.launch=function(...args){
      const pending=originalLaunch.apply(this,args);
      return pending.then(browser=>{
        try{
          const newContext=browser.newContext;
          browser.newContext=function(...contextArgs){
            const originalContext=newContext.apply(this,contextArgs);
            return originalContext.then(async context=>{
              let probeRegistered=false;
              try{
                await observeWithin(()=>context.addInitScript(()=>{
                  'use strict';
                  try{
                    const state={trace:[],dropped:0,rafInstalled:false,drawInstalled:false},limit=2400,draw=CanvasRenderingContext2D.prototype.drawImage,raf=requestAnimationFrame;
                    let rafTime=null;
                    try{window.__MATERIAL_CI_OBSERVE__=state;}catch{}
                    try{
                      window.requestAnimationFrame=function(...args){
                        const callback=args[0];
                        if(typeof callback!=='function')return raf.apply(this,args);
                        const observed=function(now){const prior=rafTime;rafTime=now;try{return callback.call(this,now);}finally{rafTime=prior;}};
                        return raf.apply(this,[observed,...args.slice(1)]);
                      };
                      state.rafInstalled=true;
                    }catch{}
                    try{
                      CanvasRenderingContext2D.prototype.drawImage=function(...args){
                        const result=draw.apply(this,args);
                        try{
                          const [im,...cell]=args;
                          if(cell.length===8&&this.canvas.dataset.art==='aria'&&this.canvas.closest('#cutin')){
                            const match=new URL(im.src,location.href).pathname.match(/^\/assets\/generated\/sheets\/([a-z0-9_]+)\.png$/);
                            if(match){
                              if(state.trace.length===limit){state.trace.shift();state.dropped++;}
                              state.trace.push({rafTimeMs:rafTime,performanceNowMs:performance.now(),id:match[1],actor:this.canvas.dataset.art,action:this.canvas.dataset.action,
                                cel:cell[0]/cell[2]+cell[1]/cell[3]*4,sx:cell[0],sy:cell[1],cellWidth:cell[2],cellHeight:cell[3]});
                            }
                          }
                        }catch{}
                        return result;
                      };
                      state.drawInstalled=true;
                    }catch{}
                  }catch{}
                }),750);
                probeRegistered=true;
              }catch{}
              try{
                const newPage=context.newPage;
                context.newPage=function(...pageArgs){
                  const originalPage=newPage.apply(this,pageArgs);
                  return originalPage.then(page=>{
                    try{
                      const requests=[],start=process.hrtime.bigint();
                      const record=(request,event,status)=>{try{
                        const match=new URL(request.url()).pathname.match(/^\/assets\/generated\/(manifest\.json|sheets\/[a-z0-9_]+\.png)$/);
                        if(match&&requests.length<300)requests.push({hostRelativeMs:Number(process.hrtime.bigint()-start)/1e6,path:match[1],event,...(status==null?{}:{status})});
                      }catch{}};
                      try{page.on('request',r=>record(r,'requested'));}catch{}
                      try{page.on('response',r=>{try{record(r.request(),'response',r.status());}catch{}});}catch{}
                      try{page.on('requestfinished',r=>record(r,'finished'));}catch{}
                      try{page.on('requestfailed',r=>record(r,'failed'));}catch{}
                      const waitForFunction=page.waitForFunction;
                      page.waitForFunction=function(...waitArgs){
                        const originalWait=waitForFunction.apply(this,waitArgs);
                        return originalWait.catch(async error=>{
                          try{
                            const target=waitArgs[1];
                            if(error.name==='TimeoutError'&&String(waitArgs[0]).includes('artCels.includes')&&target&&knownIds.includes(target.id)){
                              const failureHostRelativeMs=Number(process.hrtime.bigint()-start)/1e6;
                              let snapshot=null,snapshotStatus='unavailable';
                              try{
                                snapshot=await observeWithin(()=>page.evaluate(ids=>{
                                  const observer=window.__MATERIAL_CI_OBSERVE__,cutin=document.getElementById('cutin'),cv=cutin?.querySelector('canvas');
                                  const available=typeof GameArt==='undefined'?null:Object.fromEntries(ids.map(id=>[id,GameArt.available(id)]));
                                  return {browserPerformanceNowMs:performance.now(),cutinClass:cutin?.className||null,
                                    canvas:cv?{connected:cv.isConnected,actor:cv.dataset.art,action:cv.dataset.action,width:cv.width,height:cv.height}:null,
                                    available,probeState:observer?{rafInstalled:observer.rafInstalled,drawInstalled:observer.drawInstalled}:null,
                                    droppedDrawRecords:observer?.dropped??null,cutinDraws:observer?.trace||[]};
                                },knownIds),750);
                                snapshotStatus='captured';
                              }catch{}
                              const fxToSpirit={gran_tide:'gran',ivy_vines:'ivy',spinel_shield:'spinel',king_prism:'king'};
                              const report={schemaVersion:2,snapshotCommit:process.env.CI_MATERIAL_SNAPSHOT,
                                failure:{name:'TimeoutError',hostRelativeMs:failureHostRelativeMs,waitedFor:{id:target.id,cel:Number.isInteger(target.cel)?target.cel:null,canvas:['aria','boardCanvas'].includes(target.canvas)?target.canvas:null},spirit:fxToSpirit[target.id]||null},
                                probeRegistered,snapshotStatus,snapshotDeadlineMs:750,networkRequests:requests,observation:snapshot,
                                limitations:['Observation wrappers can change timing slightly; instrumented pass does not disprove prior failure.',
                                  'available is the cached usable image state at failure, not earlier.',
                                  'Existing sheets have four columns; source cell dimensions are logged.']};
                              const output=path.join(process.cwd(),'ci-observe');fs.mkdirSync(output,{recursive:true});
                              const filename='failure-'+String(++failures).padStart(2,'0')+'.json';fs.writeFileSync(path.join(output,filename),JSON.stringify(report,null,2)+'\n');
                              safelyWrite('[material-ci-observe] saved '+filename+' for '+target.id+'\n');
                            }
                          }catch{safelyWrite('[material-ci-observe] observation unavailable; original error preserved\n');}
                          throw error;
                        });
                      };
                    }catch{}
                    return page;
                  });
                };
              }catch{}
              return context;
            });
          };
        }catch{}
        return browser;
      });
    };
  }
}catch{}
