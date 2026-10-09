const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browser;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch();
});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});

test('Marii is rescued as a darkness-stained bird in a dark cavern, and her colours return only as the black is cut away',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>{localStorage.cr_unlocked=JSON.stringify(['prologue','act1','act2','act3','fury','act4','act5','finale','epilogue','done','restore1','restore2','restore3']);localStorage.cr_speed='0';localStorage.cr_settings=JSON.stringify({reduceMotion:true,textSize:'normal'});});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();
    const script=await page.evaluate(()=>SCRIPT.restore4);
    // 場面の順序：暗い洞窟 → 闇に染まったマリー → 闇がはがれる → 夜明け
    const at=s=>script.indexOf(s);
    assert(at('@bg cave_sky dark')>=0&&at('@bg cave_sky storm')>at('@bg cave_sky dark'),'the descent and the cocoon are dark');
    assert(script.lastIndexOf('@show mari dark')>at('@board mr_cocoon'),'Marii appears stained after the cocoon opens');
    assert(at('@show mari dim')>script.lastIndexOf('@show mari dark')&&at('@show mari clear')>at('@show mari dim'),'her colours return in steps');
    assert(at('@show mari clear')<at('@maribond'),'she is clear again only when she joins');
    assert(at('@bg restoration clear')>at('@show mari dim'),'the morning returns after the black is cut away');
    assert(script.includes('墨')&&script.includes('帰るな'),'the corruption is serious, not a cheerful reunion');
    // 実際の表示：暗い色合いが即座にかかり、あとで元へ戻る
    await page.evaluate(()=>{World.close();const s=SCRIPT.restore4,a=s.indexOf('繭がほどけた'),b=s.indexOf('@show mari dim');SCRIPT.act2='@bg cave_sky storm\n@show aria\n'+s.slice(a,b)+'マリー「……」\n@end';Engine.play('act2');});
    const filter=()=>page.evaluate(()=>document.querySelector('[data-show=mari] canvas')?.style.filter||'');
    for(let i=0;i<40&&!(await filter());i++){await page.keyboard.press('Enter');await page.waitForTimeout(80);}
    assert.match(await filter(),/brightness\(0?\.24\)/);
    assert.equal(await page.evaluate(()=>Engine.load().scene.bg),'cave_sky');
    await page.evaluate(()=>Engine.stop?.());
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
