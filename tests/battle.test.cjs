const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let browser, server, base, context, page, errors;

// Test-only access to battle state. The deployed JavaScript has no test API.
const hook = `__test: {
  state() { return {running,phase,turn,busy,over,paused,mode,sp,stage,skyCharges,tw,sel:sel&&sel.id,spiritUses:stats&&stats.spiritUses,
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,r:u.r,c:u.c,hp:u.hp,mhp:u.mhp,moved:u.moved,acted:u.acted,dead:!!u.dead,hidden:!!u.hidden,enchant:u.enchant,until:u.until,
      ...toScreen(unitXY(u).x,unitXY(u).y),bodyY:toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5).y})),
    cells:cells.map((c,i)=>({id:i,r:c.r,c:c.c,floor:c.floor,...toScreen(topOf(c).x,topOf(c).y)})),
    ends:moveInfo?[...moveInfo.ends]:[],targets:targets?[...targets]:[],cfg:cfg&&cfg.id}; },
  arrange(updates) { for(const spec of updates){const u=units.find(u=>spec.id?u.id===spec.id:u.kind===spec.kind);Object.assign(u,spec);}refreshHud();select(ariaU(),true); },
  pick(x,y){const c=pick(x,y);return c&&{r:c.r,c:c.c};}
},
`;

before(async () => {
  const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.mp3':'audio/mpeg', '.png':'image/png', '.jpg':'image/jpeg' };
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) { res.writeHead(404); res.end(); return; }
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless:true });
});

afterEach(async () => {
  if (context) await context.close();
  context = null;
  assert.deepEqual(errors || [], [], 'Battle must have no runtime errors or failed game requests');
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function boot(id='cove', viewport={width:1440,height:900}) {
  errors=[];
  context=await browser.newContext({viewport,hasTouch:viewport.width<900});
  page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8');
  const marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker),'Battle test hook must match the public API');
  await page.route('**/js/board.js',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.goto(base+'#board='+id,{waitUntil:'networkidle'});
  await page.locator('#gate').click();
  await idle();
  await page.locator('#gate').waitFor({state:'detached'});
}
const state=()=>page.evaluate(()=>Board.__test.state());
const idle=()=>page.waitForFunction(()=>Board.__test.state().running&&!Board.__test.state().busy&&!Board.__test.state().paused,{}, {timeout:15000});
const aria=s=>s.units.find(u=>u.kind==='aria');
const enemy=s=>s.units.find(u=>u.side==='enemy'&&!u.dead&&!u.hidden);
async function fixture(id='cove', extra={}) {
  await page.evaluate(({id,extra})=>Board.start({...BOARDS[id],map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,water:null},enemies:[{kind:'shade',lv:1}],intro:null,tutorial:null,beats:[],...extra}),{id,extra});
  await idle();
  await page.evaluate(()=>{Math.random=()=>0.5;Board.__test.arrange([{kind:'aria',r:5,c:4,dir:0,atk:999},{kind:'shade',r:4,c:4,dir:2,hp:1}]);});
}
async function openMenu(){await page.locator('#actHere').click();await page.waitForTimeout(200);}
async function clickUnit(u, body=false) {await page.mouse.click(u.x,body?u.bodyY:u.y);}
async function attack(){await openMenu();await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);}
async function leave(){await page.locator('#boardMenu').click();await page.locator('#gmTitle').click();}
async function legalCell(kind='ends') {
  return page.evaluate(kind=>{
    const s=Board.__test.state();
    const a=s.units.find(u=>u.kind==='aria');
    const candidates=s.cells.filter(c=>s[kind].includes(c.id));
    if(kind==='ends')candidates.sort((x,y)=>(Math.abs(y.r-a.r)+Math.abs(y.c-a.c))-(Math.abs(x.r-a.r)+Math.abs(x.c-a.c)));
    return candidates.find(c=>{
      const picked=Board.__test.pick(c.x,c.y);
      return picked&&picked.r===c.r&&picked.c===c.c&&document.elementFromPoint(c.x,c.y)?.id==='boardCanvas';
    });
  },kind);
}
async function inViewport(id) {
  const r=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});
  assert(r.x>=-0.5&&r.y>=-0.5&&r.right<=r.vw+0.5&&r.bottom<=r.vh+0.5,`${id} must fit the viewport: ${JSON.stringify(r)}`);
  return r;
}

test('Clicking Aria’s body opens her menu without moving to a floor behind her',async()=>{
  await boot();const before=aria(await state());await clickUnit(before,true);await page.waitForTimeout(600);
  const after=aria(await state());assert.deepEqual([after.r,after.c],[before.r,before.c]);
  assert(await page.locator('#cmdMenu').isVisible());
});

for(const viewport of [{width:320,height:480},{width:320,height:640},{width:390,height:844},{width:820,height:600},{width:667,height:375},{width:844,height:390},{width:1440,height:900}]){
  test(`Battle controls and spirit menu fit ${viewport.width} × ${viewport.height}`,async()=>{
    await boot('king',viewport);
    for(const id of ['cmdBar','actHere','cancelSel','endTurn'])await inViewport(id);
    const bar=await inViewport('cmdBar');assert(bar.h<110,'Action bar must not grow into the play area');
    if(viewport.height<500&&viewport.width>viewport.height)assert((await state()).tw>=24,'Landscape tiles must remain selectable');
    if(viewport.width<900)await page.locator('#actHere').tap();else await page.locator('#actHere').click();
    await page.waitForTimeout(200);await inViewport('cmdMenu');
    await page.locator('[data-k=spirit]').click();await page.waitForTimeout(200);await inViewport('cmdMenu');
    assert.deepEqual(await page.locator('#app').evaluate(e=>[e.scrollLeft,e.scrollTop]),[0,0],'Opening menus must not scroll the canvas');
    if(viewport.width<=820||viewport.height<500)assert(await page.locator('#cmdMenu').evaluate(e=>e.classList.contains('sheet')));
  });
}

test('Movement and undo restore position and every changed floor',async()=>{
  await boot();const before=await state();const target=await legalCell();assert(target);
  await page.mouse.click(target.x,target.y);await idle();assert(aria(await state()).moved);
  assert((await state()).cells.some((c,i)=>c.floor!==before.cells[i].floor),'The move must actually paint a floor');
  await page.locator('#cancelSel').click();const after=await state();
  assert.deepEqual([aria(after).r,aria(after).c],[aria(before).r,aria(before).c]);
  assert.deepEqual(after.cells.map(c=>c.floor),before.cells.map(c=>c.floor));assert(!aria(after).moved);
});

for(const id of ['gran','ivy','spinel']){
  test(`Stage ${id} renders and completes an enemy turn`,async()=>{
    await boot(id);assert((await state()).ends.length>0);await openMenu();
    await page.locator('[data-k=wait]').click();
    await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
    const s=await state();assert.equal(s.cfg,id);assert(!s.over);assert(!aria(s).acted);
  });
}

test('Attack and enemy turn finish and restore the next player turn',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25,hp:1000,mhp:1000},{kind:'shade',hp:500,mhp:500}]));
  await attack();await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:20000});
  const s=await state();assert(enemy(s).hp<500);assert(aria(s).hp<1000);assert(!aria(s).acted&&!aria(s).moved);assert(s.sp>=0);
});

test('Prayer targets the selected character’s body and consumes resonance once',async()=>{
  await boot();await fixture('cove',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:10}]));
  const before=await state();await openMenu();await page.locator('[data-k=pray]').click();await clickUnit(aria(await state()),true);
  await page.waitForFunction(()=>Board.__test.state().mode==='idle');const s=await state();
  assert.equal(s.sp,before.sp-2);assert.equal(aria(s).hp,10+Math.round(aria(s).mhp*.35));
});

test('A healing item is consumed once and saved',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:10}]));
  await openMenu();await page.locator('[data-k=item]').click();await page.locator('[data-k=useitem][data-a=i_tea]').click();await clickUnit(aria(await state()),true);
  await page.waitForFunction(()=>Board.__test.state().mode==='idle');
  assert(aria(await state()).hp>10);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cr_party')).items.i_tea),1);
});

test('Transparent strike targets a direction and paints its path',async()=>{
  await boot();await fixture('cove',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25},{kind:'shade',hp:500,mhp:500}]));
  await openMenu();await page.locator('[data-k=flash]').click();const target=enemy(await state());await clickUnit(target,true);
  await page.waitForFunction(()=>Board.__test.state().mode==='idle');const s=await state();
  assert(enemy(s).hp<500);assert.equal(s.sp,4);assert.equal(s.cells.find(c=>c.r===target.r&&c.c===target.c).floor,'rainbow');
});

test('Leaving target selection through a spirit badge preserves movement choices',async()=>{
  await boot('king');const before=await state();await openMenu();await page.locator('[data-k=flash]').click();
  await page.locator('#skills .skill').first().click();await page.locator('[data-k=back]').click();await page.keyboard.press('Escape');
  const after=await state();assert.equal(after.mode,'selected');assert.equal(after.ends.length,before.ends.length);assert(after.ends.length>0);
});

test('Enchanting keeps the action available and prevents a second enchant or summon',async()=>{
  await boot('king');await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();
  assert(await page.locator('#endTurn').isDisabled());await idle();const s=await state();
  assert.equal(aria(s).enchant.id,'gran');assert(!aria(s).acted);assert.equal(s.sp,3);assert(!(await page.locator('#endTurn').isDisabled()));
  await page.locator('[data-k=spirit]').click();assert(await page.locator('[data-k=enchant][data-a=ivy]').isDisabled());assert(await page.locator('[data-k=summon][data-a=gran]').isDisabled());
});

test('A summoned spirit becomes selectable on the next turn',async()=>{
  await boot('king');await fixture('king',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25,hp:1000,mhp:1000},{kind:'shade',hp:1000,mhp:1000,atk:1,r:1,c:1}]));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=summon][data-a=gran]').click();const cell=await legalCell('targets');assert(cell);await page.mouse.click(cell.x,cell.y);
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
  const spirit=(await state()).units.find(u=>u.kind==='gran');assert(spirit&&!spirit.dead&&!spirit.acted);await clickUnit(spirit,true);
  assert.equal((await state()).mode,'selected');assert.equal((await state()).sel,spirit.id);
});

test('Victory rewards and continuation work normally',async()=>{
  await boot();await fixture();await attack();await page.locator('#resNext').waitFor({timeout:12000});
  assert(await page.evaluate(()=>Board.party.stages.cove.cleared));assert(await page.evaluate(()=>Board.party.gold>0));
  await page.locator('#resNext').click();assert(!(await state()).running);assert(!(await page.evaluate(()=>Panel.isOpen())));
});

test('Defeat can be retried without old turn work continuing',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:1},{kind:'shade',hp:1000,atk:1000}]));
  await page.locator('#endTurn').click();await page.locator('#resRetry').waitFor({timeout:12000});await page.locator('#resRetry').click();await idle();
  const s=await state();assert.equal(s.turn,1);assert.equal(aria(s).hp,aria(s).mhp);assert(!s.over);assert.equal(await page.locator('#resRetry').count(),0);
});

test('Returning to title after victory does not reopen the result panel',async()=>{
  await boot();await fixture();await attack();await page.waitForFunction(()=>Board.__test.state().over);await leave();await page.waitForTimeout(2500);
  assert(!await page.evaluate(()=>Panel.isOpen()));assert(!(await state()).running);
});

test('A delayed defeat panel cannot replace a new battle',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:1},{kind:'shade',hp:1000,atk:1000}]));
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().over);await leave();await page.evaluate(()=>Board.start(BOARDS.gran));await page.waitForTimeout(2300);
  assert(!await page.evaluate(()=>Panel.isOpen()));assert.equal((await state()).cfg,'gran');
});

test('An interrupted enchant cannot mutate the next battle',async()=>{
  await boot('king');await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();
  await leave();await page.evaluate(()=>Board.start(BOARDS.cove));await page.waitForTimeout(2200);
  const s=await state();assert.equal(s.cfg,'cove');assert.equal(s.spiritUses,0);assert(!aria(s).enchant);assert(!s.busy);
});

test('Interrupting a move cannot unlock the next battle before its opening banner ends',async()=>{
  await boot('king');const cell=await legalCell();assert(cell);await page.mouse.click(cell.x,cell.y);
  await page.evaluate(()=>{Board.stop();Board.start(BOARDS.cove);});await page.waitForTimeout(500);
  assert((await state()).busy);await idle();assert.equal((await state()).cfg,'cove');assert.equal((await state()).turn,1);
});

test('Final battle reveals membranes after two attacks and protects neutral Chrome',async()=>{
  await boot('chrome');await page.evaluate(()=>{Math.random=()=>.5;Board.__test.arrange([{kind:'aria',r:5,c:4,hp:1000,mhp:1000},{kind:'chrome',r:4,c:4,dir:2}]);});
  const hp=enemy(await state()).hp;
  await attack();await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:18000});
  // Put Chrome next to Aria again after his enemy movement.
  await page.evaluate(()=>{const a=Board.__test.state().units.find(u=>u.kind==='aria');Board.__test.arrange([{kind:'chrome',r:a.r-1,c:a.c,dir:2}]);});
  await attack();await page.waitForFunction(()=>Board.__test.state().stage===1&&!Board.__test.state().busy&&!Board.__test.state().paused,{},{timeout:18000});
  const s=await state(),chrome=s.units.find(u=>u.kind==='chrome');assert.equal(chrome.hp,hp);assert.equal(chrome.side,'neutral');assert.equal(s.units.filter(u=>u.kind==='membrane'&&!u.hidden).length,6);assert.equal(s.skyCharges,4);
});
