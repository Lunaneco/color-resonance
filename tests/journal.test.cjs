const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
test('Journal marks derive from completed play and do not award drops or invent progress',async()=>{
  const c=vm.createContext({localStorage:{getItem(){}}});
  for(const name of ['progression','journal'])vm.runInContext(await fs.readFile(path.join(root,'js/'+name+'.js'),'utf8'),c);
  const result=vm.runInContext(`(()=>{const p=Progression.migrate({aria:{lv:4,exp:0},spirits:{},gold:42});const before=JSON.stringify(p), empty=Journal.achievements(p,['prologue']);
    p.stages={one:{cleared:true,best:'S',difficulties:{expert:{cleared:true}}},two:{cleared:true},three:{cleared:true}};
    for(const id of Object.keys(Progression.spirits))p.spirits[id]={lv:4,exp:0,bond:40,training:{enchant:40,summon:40}};
    for(const id of ['lantern','echo'])for(const tier of ['gentle','normal','hard'])p.minigames.records[id][tier]={clears:1};
    Progression.migrate(p);const rich=JSON.stringify(p),complete=Journal.achievements(p,['prologue','act1','act2','act4','act5','finale','done']);
    return {empty,complete,unchanged:rich===JSON.stringify(p),gold:p.gold};})()`,c);
  assert(result.empty.every(m=>m.now===0));assert(result.complete.every(m=>m.now===m.total));assert(result.unchanged);assert.equal(result.gold,42);
});
let browser,server,base,context,page,errors;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';browser=await chromium.launch({headless:true});
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[]);});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function boot(viewport={width:1440,height:900},unlocked=['prologue','act1','act2'],bond=20){
  errors=[];context=await browser.newContext({viewport,hasTouch:viewport.width<900});
  await context.addInitScript(({unlocked,bond})=>{localStorage.setItem('cr_unlocked',JSON.stringify(unlocked));localStorage.setItem('cr_party',JSON.stringify({aria:{lv:3,exp:0},spirits:{gran:{lv:3,exp:0,bond}},gold:42}));localStorage.setItem('cr_save',JSON.stringify({chapter:'act2',idx:12}));},{unlocked,bond});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('#world').waitFor({state:'visible'});
  await page.locator('[data-w=journal]').click();await page.locator('.jn-book').waitFor();
}
test('Only completed chapters and met spirits reveal journal prose',async()=>{
  await boot();assert.equal(await page.locator('.jn-chapter.read').count(),2);assert.equal(await page.locator('.jn-chapter').count(),8);
  assert((await page.locator('.jn-chapter').nth(2).textContent()).includes('旅の途中'));assert((await page.locator('.jn-chapter').nth(3).textContent()).includes('まだ開いていないページ'));
  assert(!(await page.locator('.jn-timeline').textContent()).includes('クリスタは、最初から'));
  await page.locator('[data-journal-tab=letters]').click();assert.equal(await page.locator('.jn-letter.opened').count(),2);assert.equal(await page.locator('.jn-letter').count(),12);
  assert((await page.locator('.jn-spirit').nth(0).textContent()).includes('あと 20'));assert(!(await page.locator('.jn-letters').textContent()).includes('黄金の庇護'));
});
test('Journal pages preserve the current story and return keyboard focus to their entrance',async()=>{
  await boot();const before=await page.evaluate(()=>localStorage.getItem('cr_save'));
  await page.locator('[data-journal-tab=journey]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[aria-selected=true]').getAttribute('data-journal-tab'),'letters');
  await page.keyboard.press('End');assert.equal(await page.locator('[aria-selected=true]').getAttribute('data-journal-tab'),'marks');
  assert.equal(await page.locator('.jn-mark').count(),8);for(let i=0;i<4;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#panel')));}
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.w),'journal');assert.equal(await page.evaluate(()=>localStorage.getItem('cr_save')),before);
  assert.equal(await page.evaluate(()=>Board.party.gold),42);
});
test('Unfinished prologue does not expose its event illustration in the gallery',async()=>{
  await boot(undefined,['prologue'],0);await page.locator('[data-journal-tab=memories]').click();assert.equal(await page.locator('.jn-memory img').count(),0);assert(await page.locator('.jn-locked-memory').isVisible());
});
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:480},{width:667,height:375}])test(`Journal tabs and its event gallery are accessible at ${viewport.width} × ${viewport.height}`,async()=>{
  await boot(viewport);await page.waitForTimeout(150);await page.screenshot({path:`/tmp/cr-journal-journey-${viewport.width}x${viewport.height}.png`});
  for(const id of ['journey','letters','marks','memories']){
    const button=page.locator(`[data-journal-tab=${id}]`);await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1);
    const hit=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);});assert(hit);await button.click();
  }
  await page.waitForFunction(()=>document.querySelector('.jn-memory img')?.naturalWidth>0);await page.locator('.jn-memory').scrollIntoViewIfNeeded();const img=await page.locator('.jn-memory img').boundingBox();assert(img.x>=0&&img.x+img.width<=viewport.width+1);
  await page.screenshot({path:`/tmp/cr-journal-memory-${viewport.width}x${viewport.height}.png`});
});
