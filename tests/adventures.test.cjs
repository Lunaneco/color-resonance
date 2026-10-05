const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), vm = require('node:vm');
const { chromium } = require('playwright');
const root=path.resolve(__dirname,'..'),pure=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'js/play-core.js'),'utf8')+';globalThis.C=PlayCore;',pure);const C=pure.C;
let browser,server,base,context,page,errors;
before(async()=>{
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();const data=await fs.promises.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({headless:true});
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[],'adventures must not have runtime errors or missing assets');});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function boot(viewport={width:1200,height:900},active=null,settings=null,chapter='act2'){
  errors=[];context=await browser.newContext({viewport,hasTouch:viewport.width<900});
  await context.addInitScript(({active,settings,chapter})=>{
    if(!localStorage.getItem('cr_unlocked'))localStorage.setItem('cr_unlocked',JSON.stringify(['prologue','act1',...(chapter==='act2'?['act2']:[])]));
    if(active&&!localStorage.getItem('cr_party'))localStorage.setItem('cr_party',JSON.stringify({aria:{lv:1,exp:0},minigames:{active}}));
    if(settings)localStorage.setItem('cr_settings',JSON.stringify(settings));
  },{active,settings,chapter});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-w=games]').click();
}
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cr_party')));
async function begin(id,tier='gentle',practice=false){await page.locator(`[data-game=${id}] [data-tier=${tier}]`).click();await page.locator(`[data-game=${id}] [${practice?'data-practice':'data-start'}]`).click();}
async function voyage(low=false,keyboard=false){
  for(let turn=0;turn<30;turn++){
    const s=(await saved()).minigames.active;if(!s||await page.locator('.mg-result').count())return;
    if(s.camp){await page.locator(`[data-camp=${low?'repair':'treasure'}]`).click();continue;}
    const value=low?{water:0,heart:1,charge:2,star:3}:{star:0,charge:1,heart:2,water:3};
    const lanes=[0,1,2].filter(l=>Math.abs(l-s.lane)<=1&&s.map[s.step][l]!=='reef').sort((a,b)=>value[s.map[s.step][a]]-value[s.map[s.step][b]]);
    if(keyboard)await page.keyboard.press(String(lanes[0]+1));else await page.locator(`[data-lane="${lanes[0]}"]`).click();
  }
  assert.fail('voyage did not finish');
}
async function crystal(){
  for(let turn=0;turn<30;turn++){
    const s=(await saved()).minigames.active;if(!s||await page.locator('.mg-result').count())return;
    const nova=s.board.findIndex(n=>n>=4),move=C.crystalMoves(s.board).find(m=>s.board[m.a]<4&&s.board[m.b]<4);
    if(s.movesLeft<=2&&!s.boostUsed){await page.locator('[data-rainbow]').click();await page.locator('[data-gem="12"]').click();}
    else if(nova>=0)await page.locator(`[data-gem="${nova}"]`).click();
    else{assert(move);await page.locator(`[data-gem="${move.a}"]`).click();await page.locator(`[data-gem="${move.b}"]`).click();}
  }
  assert.fail('crystal did not finish');
}
test('New adventures unlock with the right chapter and explicitly show an unranked first-hard treasure',async()=>{
  await boot(undefined,null,null,'act1');assert(await page.locator('[data-game=voyage] [data-start]').isEnabled());assert(await page.locator('[data-game=crystal] [data-start]').isDisabled());
  assert.match(await page.locator('.mg-prize-intro').textContent(),/評価C/);assert.equal(await page.locator('.mg-hard-prize').count(),4);
});
for(const viewport of [{width:320,height:480},{width:390,height:844},{width:667,height:375}])for(const id of ['voyage','crystal']){
  test(`${id} uses real touch controls, fits the panel, and completes at ${viewport.width}×${viewport.height}`,async()=>{
    await boot(viewport,id==='voyage'?C.createVoyage('gentle',73):C.createCrystal('gentle',73));await page.locator('[data-resume]').tap();
    const bounds=await page.locator('.mg-play').evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth,doc:document.documentElement.scrollWidth,vw:innerWidth}));assert(bounds.scroll<=bounds.width+1);assert(bounds.doc<=bounds.vw+1);
    for(const button of await page.locator(id==='voyage'?'[data-lane],[data-mode]':'[data-gem],[data-rainbow],[data-crystal-hint]').all()){
      const box=await button.boundingBox();assert(box.height>=44);assert(box.x>=0&&box.x+box.width<=viewport.width+1);assert(box.y>=0&&box.y+box.height<=viewport.height+1,'core controls are visible together');
    }
    if(id==='voyage')await voyage();else await crystal();
    assert(await page.locator('.mg-result:not(.mg-failed)').isVisible());const p=await saved();assert.equal(p.minigames.active,null);assert.equal(p.minigames.records[id].gentle.clears,1);assert(p.gold>0);
  });
}
test('A real hard voyage cleared at C grants the rare treasure once; later S is independent and survives reload',async()=>{
  await boot(undefined,C.createVoyage('hard',1));await page.locator('[data-resume]').click();await voyage(true,true);
  assert.equal(await page.locator('.mg-result-rank').textContent(),'C');assert.match(await page.locator('.mg-hard-award').textContent(),/澄明の核 \+2/);
  let p=await saved();assert.equal(p.materials.m_core,2);assert.equal(p.minigames.records.voyage.hard.hardCoreClaimed,2);
  await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-w=games]').click();
  assert.match(await page.locator('[data-game=voyage] .mg-hard-prize').textContent(),/受取済み/);
  await begin('voyage','hard');await voyage();p=await saved();assert.equal(p.minigames.records.voyage.hard.clears,2);assert.equal(p.minigames.records.voyage.hard.hardCoreClaimed,2);assert(p.materials.m_core<=3);
});
test('Adventure actions resume exactly; a practice attempt leaves the real map, materials, and claims intact',async()=>{
  await boot(undefined,C.createVoyage('hard',73));await page.locator('[data-resume]').click();await page.locator('[data-mode=guard]').click();await page.locator('[data-lane="0"]').click();
  const before=await saved();await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-w=games]').click();await page.locator('[data-resume]').click();
  assert.deepEqual((await saved()).minigames.active,before.minigames.active);await page.locator('[data-back]').click();await begin('crystal','gentle',true);
  await page.locator('[data-rainbow]').click();await page.locator('[data-gem="12"]').click();await page.keyboard.press('Escape');
  const after=await saved();assert.deepEqual(after.minigames.active,before.minigames.active);assert.deepEqual(after.materials,before.materials);assert.deepEqual(after.minigames.records,before.minigames.records);assert.equal(after.gold,before.gold);
});
test('Crystal selection, arrow keys, free hints, rainbow cancellation and used status survive close/reload',async()=>{
  await boot({width:390,height:844},C.createCrystal('hard',4),{reduceMotion:true,textSize:'large'});await page.locator('[data-resume]').click();
  await page.locator('[data-gem="0"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.gem),'1');
  await page.locator('[data-crystal-hint]').click();assert.equal(await page.locator('.mg-gem.hinted').count(),2);
  let before=await saved();await page.locator('[data-rainbow]').click();await page.locator('[data-rainbow]').click();assert.deepEqual((await saved()).minigames.active,before.minigames.active);
  await page.locator('[data-rainbow]').click();await page.locator('[data-gem="12"]').click();assert(await page.locator('[data-rainbow]').isDisabled());
  before=await saved();assert.equal(before.minigames.active.movesLeft,14);assert(before.minigames.active.boostUsed);
  await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-w=games]').click();await page.locator('[data-resume]').click();
  assert.deepEqual((await saved()).minigames.active,before.minigames.active);assert(await page.locator('[data-rainbow]').isDisabled());
  const duration=await page.locator('.mg-cascade-feedback').evaluate(e=>getComputedStyle(e).animationName);assert.equal(duration,'none');assert.equal(await page.locator('.mg-bloom').count(),0);
});
test('A failed voyage and failed crystal attempt pay no rewards and leave first-hard treasure unclaimed',async()=>{
  const s=C.createVoyage('hard',5);s.hp=1;s.map[0][1]='reef';await boot(undefined,s);await page.locator('[data-resume]').click();await page.locator('[data-lane="1"]').click();
  assert(await page.locator('.mg-failed').isVisible());let p=await saved();assert.equal(p.gold,0);assert.equal(p.materials.m_core,0);assert.equal(p.minigames.active,null);assert.deepEqual(p.minigames.records.voyage,{});
  await page.locator('[data-home]').click();assert.match(await page.locator('[data-game=voyage] .mg-hard-prize').textContent(),/未受取/);
  const crystal=C.createCrystal('hard',5);crystal.movesLeft=1;crystal.boostUsed=true;
  await page.evaluate(active=>{Board.party.minigames.active=active;Board.saveParty();Minigames.open();},JSON.parse(JSON.stringify(crystal)));await page.locator('[data-resume]').click();
  const move=C.crystalMoves(crystal.board).find(m=>crystal.board[m.a]<4&&crystal.board[m.b]<4);await page.locator(`[data-gem="${move.a}"]`).click();await page.locator(`[data-gem="${move.b}"]`).click();
  assert(await page.locator('.mg-failed').isVisible());p=await saved();assert.equal(p.gold,0);assert.equal(p.materials.m_core,0);assert.deepEqual(p.minigames.records.crystal,{});
});
