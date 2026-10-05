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
  state() { return {running,phase,turn,busy,over,paused,mode,sp,stage,skyCharges,tw,zoom:cam.z,itemUses:stats&&stats.items,artEffects:artEffects.map(e=>e.id),sel:sel&&sel.id,spiritUses:stats&&stats.spiritUses,skillUses:stats&&stats.skillUses,difficulty,recommendedLv:cfg&&cfg.recommendedLv,missionProgress:(cfg&&cfg.missions||[]).map(m=>missionState(m,false)),
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,dir:u.dir,lv:u.lv,atk:u.atk,def:u.def,armor:u.armor,root:u.root,guard:u.guard,r:u.r,c:u.c,hp:u.hp,mhp:u.mhp,moved:u.moved,acted:u.acted,normalAttacks:u.normalAttacks,undo:!!u.undo,dead:!!u.dead,hidden:!!u.hidden,enchant:u.enchant,until:u.until,
      ...toScreen(unitXY(u).x,unitXY(u).y),bodyY:toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5).y})),
    cells:cells.map((c,i)=>({id:i,r:c.r,c:c.c,floor:c.floor,...toScreen(topOf(c).x,topOf(c).y)})),
    ends:moveInfo?[...moveInfo.ends]:[],targets:targets?[...targets]:[],cfg:cfg&&cfg.id}; },
  arrange(updates) { for(const spec of updates){const u=units.find(u=>spec.id?u.id===spec.id:u.kind===spec.kind);Object.assign(u,spec);}refreshHud();select(ariaU(),true); },
  addAlly(kind,r,c,extra={}) { const u=makeUnit(kind,'ally',1,cellAt(r,c),extra);units.push(u);refreshHud();return u.id; },
  command(k,arg) { command(k,arg); },
  damage(fromId,toId) { return calcDamage(units.find(u=>u.id===fromId),units.find(u=>u.id===toId),{},null,false); },
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

async function boot(id='cove', viewport={width:1440,height:900}, storage={}, setup) {
  errors=[];
  context=await browser.newContext({viewport,hasTouch:viewport.width<900});
  await context.addInitScript(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,JSON.stringify(v));},storage);
  page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8');
  const marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker),'Battle test hook must match the public API');
  await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  if(setup)await setup(page);
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

for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:667,height:375}]){
  test(`The first battle explanation can be dismissed without taking an action at ${viewport.width} × ${viewport.height}`,async()=>{
    await boot('cove',viewport);const before=await state();
    assert(await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
    await inViewport('hintClose');
    if(viewport.width<900)await page.locator('#hintClose').tap();else await page.locator('#hintClose').click();
    assert(!await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
    const after=await state();assert.deepEqual([aria(after).r,aria(after).c,after.turn,after.mode],[aria(before).r,aria(before).c,before.turn,before.mode]);
    assert(!aria(after).moved&&!aria(after).acted);
    await page.locator('#boardHelp').click();assert(await page.evaluate(()=>Panel.isOpen()));
    assert((await page.locator('.pn-body').textContent()).includes('動かし方'));
  });
}

test('Opening the action menu clears the first battle explanation',async()=>{
  await boot();await openMenu();assert(!await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
});

test('The first battle explanation expires even when the player takes no action',async()=>{
  await boot();await page.waitForFunction(()=>!document.getElementById('hint').classList.contains('show'),{},{timeout:10000});
  const s=await state();assert.equal(s.turn,1);assert(!aria(s).moved&&!aria(s).acted);
});

test('Dismissing a tutorial preserves later instructions, and the last instruction clears on the next turn',async()=>{
  await boot();
  await page.evaluate(()=>Board.start({...BOARDS.cove,map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,water:null},enemies:[{kind:'shade',lv:1,n:2}],beats:[]}));
  await idle();
  await page.evaluate(()=>{Math.random=()=>.5;const foes=Board.__test.state().units.filter(u=>u.side==='enemy');Board.__test.arrange([{kind:'aria',r:5,c:4,hp:1000,mhp:1000,atk:999},{id:foes[0].id,r:2,c:2,hp:1},{id:foes[1].id,r:1,c:1,hp:1000,mhp:1000,atk:1}]);});
  await page.locator('#hintClose').click();
  const cell=await legalCell();assert(cell);await page.mouse.click(cell.x,cell.y);await idle();
  assert((await page.locator('#hintText').textContent()).includes('歩いた床は'));
  assert(await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
  await page.evaluate(()=>{const s=Board.__test.state(),a=s.units.find(u=>u.kind==='aria'),e=s.units.find(u=>u.side==='enemy');Board.__test.arrange([{id:e.id,r:a.r===0?1:a.r-1,c:a.c}]);});
  await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);
  await page.waitForFunction(()=>document.getElementById('hintText').textContent.includes('言葉が煙になって'));
  assert(await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
  assert(!await page.locator('#hint').evaluate(e=>e.classList.contains('show')));
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
    await page.locator('[data-k=facewait][aria-current=true]').click();
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

for(const viewport of [{width:1440,height:900},{width:320,height:480},{width:667,height:375}])test(`Illustrated healing items are selectable, consumed once and saved at ${viewport.width} × ${viewport.height}`,async()=>{
  await boot('cove',viewport,{cr_party:{aria:{lv:1,exp:0},items:{i_tea:2,i_water:1,i_shard:1,i_powder:1,i_ward:1}}});await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:10}]));
  await openMenu();await page.locator('[data-k=item]').click();
  const icons=page.locator('[data-k=useitem] .inventory-art img');assert.equal(await icons.count(),5);await icons.evaluateAll(async imgs=>{for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode()));});
  for(const button of await page.locator('[data-k=useitem]').all()){await button.scrollIntoViewIfNeeded();const r=await button.boundingBox();assert(r.x>=0&&r.x+r.width<=viewport.width+1&&r.height>=44);}
  await page.locator('[data-k=useitem][data-a=i_tea]').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/cr-inventory-items-${viewport.width}.png`});
  await page.locator('[data-k=useitem][data-a=i_tea]').click();await clickUnit(aria(await state()),true);
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

async function enchantBattle(id='king',viewport={width:1440,height:900}) {
  await boot('king',viewport);await fixture('king',{spStart:6,spirits:['gran','ivy','spinel','king']});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25,hp:200,mhp:1000},{kind:'shade',hp:1000,mhp:1000,atk:1,dir:2}]));
  await openMenu();await page.locator('[data-k=spirit]').click();
  assert.match(await page.locator('.cm-spirit-choice').textContent(),/通常攻撃が毎ターン2回/);
  await page.locator(`[data-k=enchant][data-a=${id}]`).click();await idle();
}
async function enchantedHit(target) {
  target=target||enemy(await state());
  if(!await page.locator('#cmdMenu').isVisible())await openMenu();
  await page.locator('[data-k=attack]').click();await clickUnit(target,true);
  await page.waitForFunction(()=>{const s=Board.__test.state();return !s.busy||s.over;},{},{timeout:15000});
}

for(const id of ['gran','ivy','spinel','king']) {
  test(`Enchanted ${id} grants exactly two normal attacks with its effect on both hits`,async()=>{
    await enchantBattle(id);await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
    if(id==='spinel'){await page.evaluate(()=>Board.__test.arrange([{kind:'shade',armor:3,def:999}]));await openMenu();}
    const before=await state();assert.match(await page.locator('.cm-combo').textContent(),/残り2回/);
    if(id==='king'){await page.keyboard.press('Escape');await clickUnit(enemy(await state()),true);await idle();}else await enchantedHit();
    const first=await state(),a=aria(first),d=enemy(first);
    assert.equal(first.turn,1);assert(!a.acted&&a.moved);assert.equal(a.normalAttacks,1);assert(!a.undo);assert(d.hp<enemy(before).hp);assert.equal(first.sp,4);
    assert.match(await page.locator('.cm-combo').textContent(),/残り1回/);
    assert.equal(await page.locator('[data-k=flash],[data-k=pray],[data-k=spirit],[data-k=learned],[data-k=item],[data-k=undo]').count(),0);
    if(id==='gran')assert.deepEqual([d.r,d.c],[3,4]);
    if(id==='ivy'){assert(a.hp>aria(before).hp);assert.equal(d.root,1);}
    if(id==='spinel')assert.equal(d.armor,0);
    assert.equal(first.cells.find(c=>c.r===enemy(before).r&&c.c===enemy(before).c).floor,'rainbow');
    await enchantedHit();const second=await state();assert(aria(second).acted);assert.equal(aria(second).normalAttacks,2);assert(enemy(second).hp<d.hp);assert.equal(second.sp,5);assert.equal(second.turn,1);
    if(id==='ivy')assert(aria(second).hp>a.hp);
    await clickUnit(enemy(second),true);await page.keyboard.press('a');await page.waitForTimeout(300);
    assert.equal(enemy(await state()).hp,enemy(second).hp,'A third attack is unavailable');
  });
}

test('Enchanted follow-up can target a different enemy and cannot undo movement or use another action',async()=>{
  await enchantBattle();
  await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
  const cell=await legalCell();assert(cell);await page.mouse.click(cell.x,cell.y);await idle();const moved=aria(await state());assert(moved.undo);
  await page.evaluate(()=>{const s=Board.__test.state(),a=s.units.find(u=>u.kind==='aria'),n=s.cells.filter(c=>Math.abs(c.r-a.r)+Math.abs(c.c-a.c)===1&&!s.units.some(u=>u.r===c.r&&u.c===c.c));Board.__test.arrange([{kind:'shade',r:n[0].r,c:n[0].c}]);Board.__test.addAlly('shade',n[1].r,n[1].c,{side:'enemy',hp:1000,mhp:1000,atk:1});});
  await enchantedHit();const first=await state(),hit=enemy(first),a=aria(first);
  assert(!a.undo);assert.equal(await page.locator('#cancelSel').textContent(),'選び直す');
  assert.match(await page.locator('#skills .skill').filter({hasText:'アイビー'}).textContent(),/追撃か待機を選択/);
  await page.evaluate(()=>{for(const k of ['undo','flash','pray','spirit','learned','item','sky','enchant','summon'])Board.__test.command(k,'ivy');});
  const guarded=await state(),afterGuard=aria(guarded);assert.equal(guarded.sp,first.sp);assert.deepEqual([afterGuard.r,afterGuard.c,afterGuard.dir,afterGuard.normalAttacks,afterGuard.acted,afterGuard.enchant],[a.r,a.c,a.dir,a.normalAttacks,a.acted,a.enchant]);assert.equal(guarded.mode,'selected');assert.equal(guarded.itemUses,0);
  await page.locator('#skills .skill').first().click();assert.equal((await state()).mode,'selected');assert.equal(await page.locator('[data-k=summon]').count(),0);
  await page.locator('[data-k=attack]').click();await page.keyboard.press('Escape');assert.equal((await state()).mode,'selected');assert.equal(aria(await state()).normalAttacks,1);
  await page.locator('#cancelSel').click();assert.equal((await state()).mode,'idle');assert.deepEqual([aria(await state()).r,aria(await state()).c],[moved.r,moved.c]);
  await clickUnit(aria(await state()),true);assert.equal((await state()).ends.length,0);assert.match(await page.locator('.cm-combo').textContent(),/残り1回/);
  const other=(await state()).units.find(u=>u.side==='enemy'&&u.id!==hit.id);
  await enchantedHit(other);const end=await state();assert(end.units.find(u=>u.id===other.id).hp<other.hp);assert.equal(end.units.find(u=>u.id===hit.id).hp,hit.hp);assert(aria(end).acted);
});

test('A missed enchanted attack uses one opportunity, and waiting can abandon the follow-up with a chosen facing',async()=>{
  await enchantBattle();await page.evaluate(()=>{Board.__test.addAlly('gran',1,1);Math.random=()=>0;});
  const before=await state();await enchantedHit();const missed=await state();assert.equal(enemy(missed).hp,enemy(before).hp);assert.equal(missed.sp,before.sp);assert.equal(aria(missed).normalAttacks,1);assert(!aria(missed).acted);
  await page.keyboard.press('w');assert.equal((await state()).mode,'facing');await page.keyboard.press('Escape');assert(!aria(await state()).acted);assert.match(await page.locator('.cm-combo').textContent(),/残り1回/);
  await page.keyboard.press('w');await page.keyboard.press('4');const end=await state();assert(aria(end).acted);assert.equal(aria(end).dir,3);assert.equal(aria(end).normalAttacks,1);
});

test('An enchanted kill with no target in reach keeps a usable wait option',async()=>{
  await enchantBattle('gran');await page.evaluate(()=>{Board.__test.arrange([{kind:'shade',hp:1}]);Board.__test.addAlly('shade',0,0,{side:'enemy',hp:1000,mhp:1000,root:10});});
  await enchantedHit();assert(!aria(await state()).acted);assert(await page.locator('[data-k=attack]').isDisabled());assert.match(await page.locator('.cm-combo').textContent(),/届く敵がいません/);
  await page.keyboard.press('w');await page.keyboard.press('2');
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});assert.equal(aria(await state()).normalAttacks,0);
});

test('Enchanted attacks reset on the next turn and return to one attack after the three-turn effect expires',async()=>{
  await enchantBattle();await enchantedHit();await enchantedHit();
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
  const next=await state();assert.equal(aria(next).enchant.turns,2);assert.equal(aria(next).normalAttacks,0);assert(!aria(next).moved&&!aria(next).acted);
  await openMenu();assert.match(await page.locator('.cm-combo').textContent(),/残り2回/);
  for(const turn of [3,4]){await page.locator('#endTurn').click();await page.waitForFunction(turn=>Board.__test.state().turn===turn&&!Board.__test.state().busy,turn,{timeout:25000});}
  assert.equal(aria(await state()).enchant,null);await page.evaluate(()=>Board.__test.addAlly('gran',1,1));await openMenu();
  assert.equal(await page.locator('.cm-combo').count(),0);await enchantedHit();assert(aria(await state()).acted);assert.equal(aria(await state()).normalAttacks,1);
});

test('Using a skill while enchanted still consumes the whole action',async()=>{
  await enchantBattle();await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
  await page.locator('[data-k=flash]').click();await clickUnit(enemy(await state()),true);await idle();
  const end=await state();assert(aria(end).acted);assert.equal(aria(end).normalAttacks,0);assert.equal(end.sp,1);assert(await page.locator('#cmdMenu').evaluate(e=>e.classList.contains('hidden')));
});

test('A summoned spirit still has one normal attack per turn',async()=>{
  await boot('king');await fixture('king',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:1000,mhp:1000},{kind:'shade',hp:1000,mhp:1000,atk:1,r:1,c:1,root:10}]));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=summon][data-a=gran]').click();const cell=await legalCell('targets');assert(cell);await page.mouse.click(cell.x,cell.y);
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
  const su=(await state()).units.find(u=>u.kind==='gran');assert(su);
  await page.evaluate(id=>{const s=Board.__test.state(),u=s.units.find(u=>u.id===id);Board.__test.arrange([{kind:'shade',r:u.r-1,c:u.c,dir:2},{id,moved:true}]);},su.id);
  await clickUnit((await state()).units.find(u=>u.id===su.id),true);await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);await idle();
  const end=await state(),spirit=end.units.find(u=>u.id===su.id);assert(spirit.acted);assert.equal(spirit.normalAttacks,1);assert.equal(end.turn,2);assert(!aria(end).acted);
});

test('The first enchanted hit can win immediately and an interrupted hit cannot grant the next battle a follow-up',async()=>{
  await enchantBattle();await page.evaluate(()=>Board.__test.arrange([{kind:'shade',hp:1}]));await enchantedHit();await page.locator('#resNext').waitFor({timeout:12000});assert((await state()).over);
  assert(await page.locator('#cmdMenu').evaluate(e=>e.classList.contains('hidden')));await page.locator('#resNext').click();
  await fixture('king',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',enchant:{id:'king',turns:3,from:1}},{kind:'shade',hp:1000}]));
  await openMenu();await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);await page.evaluate(()=>Board.stop());await fixture('cove');await page.waitForTimeout(1500);
  const fresh=await state();assert.equal(fresh.cfg,'cove');assert.equal(aria(fresh).normalAttacks,0);assert(!aria(fresh).acted&&!aria(fresh).enchant);assert.equal(enemy(fresh).hp,1);
});

for(const viewport of [{width:320,height:480},{width:390,height:844},{width:667,height:375}]) {
  test(`Enchanted follow-up is visible and tappable at ${viewport.width}×${viewport.height}`,async()=>{
    await enchantBattle('king',viewport);await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
    await page.locator('[data-k=attack]').tap();await page.touchscreen.tap(enemy(await state()).x,enemy(await state()).bodyY);await idle();
    await inViewport('cmdMenu');assert.match(await page.locator('.cm-combo').textContent(),/残り1回/);
    await page.screenshot({path:`/tmp/cr-balance-followup-${viewport.width}.png`});
    const button=page.locator('[data-k=attack]'),box=await button.boundingBox();assert(box.height>=40&&box.width>=44);
    await button.tap();await page.touchscreen.tap(enemy(await state()).x,enemy(await state()).bodyY);await idle();assert(aria(await state()).acted);assert.equal(aria(await state()).normalAttacks,2);
  });
}

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
  await page.keyboard.press('Escape');assert(await page.evaluate(()=>Panel.isOpen()),'Escape must not dismiss the required result action');
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'resNext');
  await page.keyboard.press('Enter');assert(!(await state()).running);assert(!(await page.evaluate(()=>Panel.isOpen())));
});

test('Defeat can be retried without old turn work continuing',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:1},{kind:'shade',hp:1000,atk:1000}]));
  await page.locator('#endTurn').click();await page.locator('#resRetry').waitFor({timeout:12000});
  await page.keyboard.press('Escape');assert(await page.evaluate(()=>Panel.isOpen()));
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'resRetry');
  await page.keyboard.press('Enter');await idle();
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

const allChapters=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done'];
const partyWithBond=points=>({aria:{lv:1,exp:0},spirits:Object.fromEntries(['gran','ivy','spinel','king'].map(id=>[id,{lv:1,exp:0,bond:points,uses:0}]))});
const partyWithTraining=points=>{const p=partyWithBond(points);for(const r of Object.values(p.spirits))r.training={enchant:points,summon:points};return p;};
async function chooseLearned(id) {
  const route=await page.evaluate(id=>Progression.skills.find(s=>s.id===id).route,id);
  await page.locator('[data-k=learned]').click();
  await page.locator(`[data-k=learnedroute][data-a=${route}]`).click();
  await page.locator(`[data-k=skill][data-a=${id}]`).click();
}

for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:480},{width:667,height:375}]) {
  test(`Map shows levels, selectable difficulty and twelve quests at ${viewport.width} × ${viewport.height}`,async()=>{
    await boot('cove',viewport,{cr_unlocked:allChapters,cr_party:partyWithBond(40)});
    await page.evaluate(()=>World.open());
    assert.match(await page.locator('[data-node=cove] .wn-meta').textContent(),/LV1・ふつう/);
    await page.locator('[data-w=quests]').click();
    assert.equal(await page.locator('#panel [data-quest]').count(),12);
    await page.locator('#panel [data-quest=q_tide]').click();
    await page.locator('#wmPanel [data-diff=hard]').waitFor();
    assert.equal(await page.locator('#wmPanel [data-diff]').count(),3);
    assert.equal(await page.locator('#wmPanel [data-reward-kind=equipment]').count(),1);
    await page.locator('#wmPanel [data-diff=gentle]').click();
    assert.equal(await page.locator('#wmPanel [data-reward-kind=items]').count(),1);
    assert.equal(await page.locator('#wmPanel [data-reward-kind=unique]').count(),0);
    await page.locator('#wmPanel [data-diff=hard]').click();
    assert.equal(await page.locator('#wmPanel [data-reward-kind=unique]').count(),1);
    assert.match(await page.locator('#wmPanel [data-reward-kind=unique]').textContent(),/潮騒の刻印/);
    assert.match(await page.locator('#wmPanel').textContent(),/適正LV 8/);
    assert(await page.locator('#wmPanel [data-diff=hard]').getAttribute('aria-pressed')==='true');
    const panelBounds=await inViewport('wmPanel');
    if(viewport.width===320)assert(panelBounds.w>=viewport.width-20,'Small portrait screens need a full-width stage panel to read difficulty and reward labels');
    if(viewport.width===390)await page.screenshot({path:'/tmp/cr-map-390.png'});
    if(viewport.width===1440)await page.screenshot({path:'/tmp/cr-map-desktop.png'});
    await page.locator('#wmPanel [data-a=sortie]').click();await idle();
    assert.equal((await state()).cfg,'q_tide');assert.equal((await state()).difficulty,'hard');assert.equal((await state()).recommendedLv,8);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.cr_party).stageDifficulty.q_tide),'hard');
  });
}

test('Quest chapter and bond gates prevent early access, and bond skills are visible in the party panel',async()=>{
  await boot('cove',{width:390,height:844},{cr_unlocked:['prologue','act1'],cr_party:partyWithBond(0)});
  await page.evaluate(()=>World.open());await page.locator('[data-w=quests]').click();
  assert.equal(await page.locator('#panel [data-quest]').count(),1);
  await page.locator('.pn-close').click();
  await page.evaluate(()=>{localStorage.cr_unlocked=JSON.stringify(['prologue','act1','act2','act3','act4']);World.open();});
  await page.locator('[data-w=quests]').click();await page.locator('#panel [data-quest=q_bloom]').click();
  await page.locator('#wmPanel .wp-name').filter({hasText:'花守りの試練'}).waitFor();
  assert.match(await page.locator('#wmPanel').textContent(),/受注条件：アイビーとの絆 8/);
  assert.equal(await page.locator('#wmPanel [data-a=sortie]').count(),0);
  await page.locator('[data-w=party]').click();
  assert.equal(await page.locator('.pn-body').evaluate(e=>e.scrollTop),0);
  assert.equal(await page.locator('.bond-skill').count(),12);
  assert.equal(await page.locator('.bond-route').count(),4);
  assert.match(await page.locator('.pn-body').textContent(),/熟練8で習得/);
  await page.waitForTimeout(350);
  await page.screenshot({path:'/tmp/cr-bond-390.png'});
});

test('Difficulty clears and first quest rewards are separate, while old clears remain intact',async()=>{
  const old=partyWithBond(0);old.stages={cove:{cleared:true,best:'S',missions:[true,true,true],clears:2}};
  await boot('cove',{width:1440,height:900},{cr_party:old});
  assert.equal(await page.evaluate(()=>Board.party.stages.cove.difficulties.normal.clears),2);
  const rewards=[];
  for(const key of ['normal','hard','hard']) {
    await fixture('cove',{id:'q_harbor',difficulty:key,reward:100,firstItems:{i_shard:1},missions:[]});
    await attack();await page.locator('#resNext').waitFor({timeout:12000});
    rewards.push(await page.evaluate(()=>Board.party.gold));await page.locator('#resNext').click();
  }
  const p=await page.evaluate(()=>Board.reloadParty());
  assert.equal(p.stages.cove.clears,2);
  assert.equal(p.stages.q_harbor.difficulties.normal.clears,1);assert.equal(p.stages.q_harbor.difficulties.hard.clears,2);
  assert.equal(p.stages.q_harbor.clears,3);assert.equal(p.items.i_shard,2);
  assert(rewards[1]-rewards[0]>rewards[0]);
});

test('Real victories award easy S items, normal S equipment, and hard S unique gear only once per tier',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:partyWithTraining(0)});
  for(const key of ['gentle','normal','hard']) {
    for(let attempt=0;attempt<2;attempt++) {
      await fixture('cove',{id:'q_harbor',unique:'u_quest_harbor',difficulty:key,firstItems:{i_tea:1},missions:[]});
      await attack();await page.locator('#resNext').waitFor({timeout:12000});
      const p=await page.evaluate(()=>Board.reloadParty());
      assert(p.stages.q_harbor.difficulties[key].sRewardClaimed);
      assert(p.stages.q_harbor.difficulties[key].materialMasteryClaimed);
      assert.equal(p.materials.m_core,['gentle','normal','hard'].indexOf(key)+1);
      assert.equal(await page.locator('.r-materials').count(),attempt?1:2);
      assert.match(await page.locator('.r-materials').first().textContent(),/戦闘クリア素材/);
      assert.equal(p.items.i_shard,1);assert.equal(p.items.i_powder,1);
      assert.deepEqual(p.owned,key==='gentle'?[]:key==='normal'?['e_glass']:['e_glass','u_quest_harbor']);
      const result=await page.locator('.result').textContent();
      if(!attempt)assert.match(result,key==='gentle'?/やさしいのS評価報酬/:key==='normal'?/通常装備/:/ユニーク装備/);
      else assert.equal(await page.locator('.r-unique').count(),0,'A repeat S clear cannot award another rank reward');
      if(!attempt){
        const rewardId=key==='gentle'?'i_shard':key==='normal'?'e_glass':'u_quest_harbor';
        assert(await page.locator(`.result [data-inventory=${rewardId}]`).count()>0);
        assert(await page.locator('.result [data-inventory=m_core]').count()>0);
        await page.locator('.result .inventory-art img').evaluateAll(async imgs=>{for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode()));});
      }
      await page.locator('#resNext').click();
    }
  }
});

test('Hard A grants no unique gear, a later hard S grants it, and another quest has its own unique reward',async()=>{
  await boot('cove');
  await fixture('cove',{id:'q_harbor',unique:'u_quest_harbor',difficulty:'hard',missions:[{type:'noItem'},{type:'hp',n:60},{type:'back',n:99}]});
  await attack();await page.locator('#resNext').waitFor({timeout:12000});
  assert.equal(await page.locator('.r-rank').textContent(),'A');
  assert(!await page.evaluate(()=>Board.party.owned.includes('u_quest_harbor')));
  assert(!await page.evaluate(()=>Board.party.stages.q_harbor.difficulties.hard.sRewardClaimed));
  await page.locator('#resNext').click();
  for(const id of ['q_harbor','q_lantern']) {
    await fixture('cove',{id,unique:'u_quest_'+id.slice(2),difficulty:'hard',missions:[]});
    await attack();await page.locator('#resNext').waitFor({timeout:12000});
    assert.equal(await page.locator('.r-rank').textContent(),'S');
    assert(await page.evaluate(id=>Board.party.owned.includes('u_quest_'+id.slice(2)),id));
    await page.locator('#resNext').click();
  }
  assert.equal(await page.evaluate(()=>Board.party.owned.filter(id=>id.startsWith('u_quest_')).length),2);
});

test('An owned normal S reward converts to half its shop price once and every stage reward names valid equipment',async()=>{
  const p=partyWithTraining(0);p.owned=['e_glass'];
  await boot('cove',{width:1440,height:900},{cr_party:p});
  assert(await page.evaluate(()=>[...Object.values(BOARDS),...Object.values(FREE_STAGES),...Object.values(SIDE_QUESTS)].every(c=>{
    const n=Progression.rewards(c,'normal').sEquipment,h=Progression.rewards(c,'hard').sEquipment;
    return EQUIP[n]&&!EQUIP[n].unique&&EQUIP[h]?.unique;
  })));
  for(let attempt=0;attempt<2;attempt++) {
    const before=await page.evaluate(()=>Board.party.gold);
    await fixture('cove',{id:'q_harbor',unique:'u_quest_harbor',difficulty:'normal',missions:[]});
    await attack();await page.locator('#resNext').waitFor({timeout:12000});
    const clearGold=Number(await page.locator('.r-stats div').last().locator('b').textContent());
    const after=await page.evaluate(()=>Board.party.gold);
    assert.equal(after-before,clearGold+(attempt?0:60));
    if(!attempt)assert.match(await page.locator('.r-equipment').textContent(),/60しずくに交換/);
    else assert.equal(await page.locator('.r-equipment').count(),0);
    assert.deepEqual(await page.evaluate(()=>Board.party.owned),['e_glass']);
    await page.locator('#resNext').click();
  }
});

test('Hard enemies are stronger without raising Aria’s level, and retry keeps the chosen difficulty',async()=>{
  await boot();
  const start=key=>page.evaluate(key=>Board.start({...BOARDS.cove,difficulty:key,tutorial:null,intro:null,enemies:[{kind:'shade',lv:4}]}),key);
  await start('normal');await idle();const normal=enemy(await state());
  await start('hard');await idle();const hard=enemy(await state());
  assert.equal(hard.lv,normal.lv+2);assert(hard.mhp>normal.mhp&&hard.atk>normal.atk);assert.equal(aria(await state()).lv,1);
  await page.evaluate(()=>{Math.random=()=>.5;Board.setDifficulty('gentle');Board.__test.arrange([{kind:'aria',hp:1},{kind:'shade',hp:1000,atk:1000,r:4,c:4}]);});
  assert.equal((await state()).difficulty,'hard');
  await page.locator('#endTurn').click();await page.locator('#resRetry').waitFor({timeout:15000});await page.locator('#resRetry').click();await idle();
  assert.equal((await state()).difficulty,'hard');assert.equal(enemy(await state()).lv,hard.lv);
});

test('Committed enchanting trains only that route, unlocks a permanent skill, and improves shared bond strength',async()=>{
  const p=partyWithTraining(0);p.spirits.gran.bond=6;p.spirits.gran.training.enchant=6;
  await boot('king',{width:1440,height:900},{cr_party:p});
  await fixture('king',{spStart:12});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25,hp:1000,mhp:1000},{kind:'shade',hp:500,mhp:500,atk:1}]));
  const before=await page.evaluate(()=>Board.statsFor('gran',10));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=back]').click();
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),6);
  await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();await idle();
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),8);
  assert(await page.evaluate(()=>Board.party.aria.skills.includes('gran_wave')));
  assert(!await page.evaluate(()=>Board.party.aria.skills.includes('gran_spray')));
  assert.deepEqual(await page.evaluate(()=>Board.party.spirits.gran.training),{enchant:8,summon:0});
  const after=await page.evaluate(()=>Board.statsFor('gran',10));assert(after.atk>before.atk&&after.mhp>before.mhp);
  await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);
  await page.waitForFunction(()=>Board.party.spirits.gran.bond===9);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.cr_party));
  assert.equal(saved.spirits.gran.uses,2);assert.equal(saved.spirits.ivy.bond,0);
  assert.deepEqual(saved.spirits.gran.training,{enchant:9,summon:0});
  await page.evaluate(()=>Board.stop());await fixture('cove',{spStart:6});await openMenu();
  assert(await page.locator('[data-k=learned]').isVisible());
});

test('An interrupted spirit cut-in grants no bond, route training or learned skill',async()=>{
  const p=partyWithTraining(0);p.spirits.gran.bond=6;p.spirits.gran.training.enchant=6;
  await boot('king',{width:1440,height:900},{cr_party:p});
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();
  await page.evaluate(()=>Board.stop());await fixture('cove');await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),6);
  assert.deepEqual(await page.evaluate(()=>Board.party.spirits.gran.training),{enchant:6,summon:0});
  assert(!await page.evaluate(()=>Board.party.aria.skills.includes('gran_wave')));
});

test('Summoning and a summoned attack train only the summon route and unlock its distinct skill',async()=>{
  const p=partyWithTraining(0);p.spirits.gran.training.summon=5;
  await boot('king',{width:1440,height:900},{cr_party:p});await fixture('king',{spStart:12});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',hp:1000,mhp:1000},{kind:'shade',r:0,c:0,hp:1000,mhp:1000,atk:1,root:10}]));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=summon][data-a=gran]').click();
  const cell=await legalCell('targets');assert(cell);await page.mouse.click(cell.x,cell.y);
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:25000});
  assert.deepEqual(await page.evaluate(()=>Board.party.spirits.gran.training),{enchant:0,summon:8});
  assert(await page.evaluate(()=>Board.party.aria.skills.includes('gran_spray')));
  assert(!await page.evaluate(()=>Board.party.aria.skills.includes('gran_wave')));
  const spirit=(await state()).units.find(u=>u.kind==='gran');assert(spirit);
  await page.evaluate(id=>{const u=Board.__test.state().units.find(u=>u.id===id);Board.__test.arrange([{kind:'shade',r:u.r-1,c:u.c,dir:2},{id,moved:true}]);},spirit.id);
  await clickUnit((await state()).units.find(u=>u.id===spirit.id),true);await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);await idle();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.cr_party).spirits.gran.training),{enchant:0,summon:9});
  assert.equal(await page.evaluate(()=>Board.party.spirits.ivy.training.summon),0);
});

const skillIds=['gran_wave','gran_mend','gran_tide','ivy_bind','ivy_bloom','ivy_dance','spinel_break','spinel_guard','spinel_sun','king_prism','king_canvas','king_resonance','gran_current','gran_spray','gran_ocean','ivy_renew','ivy_grove','ivy_sanctuary','spinel_polish','spinel_verdict','spinel_spark','king_edge','king_mantle','king_spectrum'];
test('Ivy’s learned bind prevents movement for two enemy turns, then expires',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:partyWithBond(40)});
  await fixture('cove',{spStart:12});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:30,hp:1000,mhp:1000},{kind:'shade',r:3,c:4,hp:500,mhp:500,atk:1}]));
  await openMenu();await page.locator('[data-k=learned]').click();await page.locator('[data-k=skill][data-a=ivy_bind]').click();
  await clickUnit(enemy(await state()),true);
  await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy,{},{timeout:15000});
  let e=enemy(await state());assert.equal(e.root,1);assert.deepEqual([e.r,e.c],[3,4]);
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().turn===3&&!Board.__test.state().busy,{},{timeout:15000});
  e=enemy(await state());assert.equal(e.root,0);assert.deepEqual([e.r,e.c],[3,4]);
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().turn===4&&!Board.__test.state().busy,{},{timeout:15000});
  e=enemy(await state());assert.notDeepEqual([e.r,e.c],[3,4]);
});

test('A quest requiring Ivy’s learned skills does not count another spirit’s magic',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:partyWithBond(40)});
  await fixture('cove',{spStart:12,missions:[{type:'skillUse',spirit:'ivy',n:1},{type:'skillUse',n:1}]});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:40},{kind:'shade',hp:500,mhp:500,atk:1}]));
  await openMenu();await page.locator('[data-k=learned]').click();await page.locator('[data-k=skill][data-a=gran_wave]').click();
  await clickUnit(enemy(await state()),true);await page.waitForFunction(()=>Board.__test.state().skillUses===1&&!Board.__test.state().busy);
  const progress=(await state()).missionProgress;
  assert.equal(progress[0].ok,null);assert.equal(progress[0].prog,'0/1');assert.equal(progress[1].ok,true);
});

test('All twenty-four learned skills, route tabs and the back button can be reached on a small touchscreen',async()=>{
  await boot('cove',{width:320,height:480},{cr_party:partyWithTraining(40)});
  await fixture('cove',{spStart:12});await openMenu();await page.locator('[data-k=learned]').click();
  assert.equal(await page.locator('[data-k=skill]').count(),12);
  await inViewport('cmdMenu');
  const widths=await page.locator('#cmdMenu').evaluate(e=>({menu:e.clientWidth,button:e.querySelector('[data-k=skill]').clientWidth}));
  assert(widths.button>=widths.menu-24,'Each learned skill must have a readable full-width row');
  await page.waitForTimeout(200);
  await page.screenshot({path:'/tmp/cr-skills-320.png'});
  await page.locator('[data-k=learnedroute][data-a=summon]').tap();
  assert.equal(await page.locator('[data-k=skill]').count(),12);
  await page.locator('[data-k=skill][data-a=king_resonance]').scrollIntoViewIfNeeded();
  assert(await page.locator('[data-k=skill][data-a=king_resonance]').isVisible());
  await page.locator('[data-k=skill][data-a=king_resonance]').hover();
  assert.equal(await page.locator('#cmdMenu .cm-desc').evaluate(e=>getComputedStyle(e).display),'none');
  assert.match(await page.locator('[data-k=skill][data-a=king_resonance] small').textContent(),/七色の斬撃/);
  await page.locator('[data-k=back]').click();assert(await page.locator('[data-k=learned]').isVisible());
});

for(const id of skillIds) {
  test(`Aria can use ${id} without summoning, applying its effect and paying once`,async()=>{
    await boot('cove',{width:1440,height:900},{cr_party:partyWithTraining(40)});
    await fixture('cove',{spStart:12});
    await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:40,hp:10},{kind:'shade',hp:500,mhp:500,atk:1,armor:3}]));
    const skill=await page.evaluate(id=>Progression.skills.find(s=>s.id===id),id);
    assert(await page.evaluate(id=>GameArt.available(GameArt.spiritEffects[id]),skill.spirit),'Learned skills need their art even on a stage without that spirit');
    await recordArt();
    await openMenu();await chooseLearned(id);
    // Cancelling a target selection must not pay or grant progress.
    assert.equal((await state()).sp,12);assert.equal(await page.evaluate(id=>Board.party.spirits[id].bond,skill.spirit),40);
    await page.locator('#cancelSel').click();
    await openMenu();await chooseLearned(id);
    await clickUnit(skill.target==='ally'?aria(await state()):enemy(await state()),true);
    await drew(await page.evaluate(id=>GameArt.spiritEffects[id],skill.spirit),3);
    await page.waitForFunction(()=>Board.__test.state().skillUses===1&&!Board.__test.state().busy);
    const s=await state(),a=aria(s),e=enemy(s);
    assert.equal(s.sp,12-skill.cost+(skill.power?1:0));assert.equal(s.spiritUses,1);
    assert.equal(await page.evaluate(id=>Board.party.spirits[id].bond,skill.spirit),42);
    assert.deepEqual(await page.evaluate(id=>Board.party.spirits[id].training,skill.spirit),{enchant:40,summon:40},'Using a learned skill cannot train either acquisition route');
    assert.equal(a.enchant,null);assert.equal(s.units.filter(u=>u.side==='ally').length,1);
    if(skill.heal)assert(a.hp>10);
    if(skill.power)assert(e.hp<500);
    if(skill.root)assert.equal(e.root,skill.root);
    if(skill.guard)assert.equal(a.guard,skill.guard);
    if(skill.pierce)assert.equal(e.armor,0);
    if(skill.drain)assert(a.hp>10);
    assert(s.cells.some(c=>c.floor==='rainbow'));
  });
}

// Observe the cels actually sent to game canvases, as well as the resulting gameplay.
async function recordArt() {
  await page.evaluate(()=>{
    window.artCels=[];
    if(window.artRecording)return;
    window.artRecording=true;
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(im,...args){
      if(im.src?.includes('/generated/sheets/')&&args.length===8&&(this.canvas.id==='boardCanvas'||this.canvas.dataset.art)){
        const id=im.src.split('/').pop().replace('.png',''),cel=args[0]/288+args[1]/384*4;
        const key=`${this.canvas.id||this.canvas.dataset.art}:${id}:${cel}`;
        if(!window.artCels.includes(key))window.artCels.push(key);
      }
      return draw.call(this,im,...args);
    };
  });
}
const drew=(id,cel,canvas='boardCanvas')=>page.waitForFunction(({id,cel,canvas})=>window.artCels.includes(`${canvas}:${id}:${cel}`),{id,cel,canvas},{timeout:5000});

test('All enemy types use their generated art and load only the current battle’s characters',async()=>{
  await boot('king');await recordArt();
  await fixture('king',{enemies:['shade','thorn','lead','boss','membrane','chrome'].map(kind=>({kind,lv:1}))});
  for(const id of ['aria','shade','thorn','lead','boss','membrane','chrome'])await drew(id,0);
  assert(!await page.evaluate(()=>GameArt.available('lila')),'Story characters should not delay battle loading');
  assert(await page.locator('#unitInfo .art-portrait').evaluate(e=>e.complete&&e.naturalWidth>0));
});

test('Walking, attacking, taking damage and the slash effect play on the game canvas',async()=>{
  await boot();await fixture();await recordArt();
  const cell=await legalCell();assert(cell);await page.mouse.click(cell.x,cell.y);
  await drew('aria',2);await drew('aria',3);await idle();
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',r:5,c:4,atk:18,moved:false},{kind:'shade',r:4,c:4,hp:500,mhp:500}]));
  await attack();await drew('aria',4);await drew('aria',5);await drew('shade',6);await drew('crystal_slash',3);
  await page.waitForFunction(()=>Board.__test.state().mode==='idle');
  assert(enemy(await state()).hp<500);
  await page.waitForTimeout(1800);assert.deepEqual((await state()).artEffects,[],'One-shot effects must finish');
});

test('Each spirit has an animated enchant cut-in and no effect survives leaving battle',async()=>{
  await boot('king');await recordArt();
  for(const id of ['gran','ivy','spinel','king']){
    await fixture('king',{spStart:12,spirits:['gran','ivy','spinel','king']});await openMenu();await page.locator('[data-k=spirit]').click();await page.locator(`[data-k=enchant][data-a=${id}]`).click();
    await page.locator('#cutin canvas').waitFor();await drew('aria',7,'aria');
    const fx=await page.evaluate(id=>GameArt.spiritEffects[id],id);await drew(fx,3,'aria');
    await idle();assert.equal(aria(await state()).enchant.id,id);
    await page.evaluate(()=>window.artCels=[]);
  }
  await page.evaluate(()=>Board.stop());assert.deepEqual((await state()).artEffects,[]);
  assert(!await page.locator('#cutin').isVisible());
});

test('Battle remains playable if a generated sprite sheet cannot load',async()=>{
  await boot('cove',{width:390,height:844},{},async p=>p.route('**/assets/generated/sheets/aria.png',r=>r.abort()));
  assert(!await page.evaluate(()=>GameArt.available('aria')));await fixture();await attack();
  await page.waitForFunction(()=>Board.__test.state().over);assert.equal(enemy(await state()),undefined);
});

test('Conversation sprites show every prepared NPC and are cleared on returning to the title',async()=>{
  await boot('king',{width:390,height:844});await page.evaluate(()=>Board.stop());await recordArt();
  for(const [who,id] of [['リラ','lila'],['老漁師','fisher'],['ルミナ','lumina'],['石の子','stone_child'],['馨','kaoru'],['マリー','mari']]){
    await page.evaluate(who=>{SCRIPT.artReview=`@bg forest\n${who}「ここで話す」`;Engine.play('artReview');},who);
    await page.locator(`.speaker-art[data-art=${id}]`).waitFor();await drew(id,4,id);
    const r=await page.locator('.speaker-art').boundingBox();assert(r.x<390&&r.x+r.width>0&&r.y<600&&r.y+r.height>250);
    assert.equal(await page.locator('.speaker-art').evaluate(e=>getComputedStyle(e).pointerEvents),'none','The portrait must not block dialogue controls');
  }
  await page.evaluate(()=>Main.toTitle());assert.equal(await page.locator('.speaker-art').count(),0);
});

const facingCases=[{dir:0,dr:-1,dc:0,arrow:'↗',name:'右上'},{dir:1,dr:0,dc:1,arrow:'↘',name:'右下'},{dir:2,dr:1,dc:0,arrow:'↙',name:'左下'},{dir:3,dr:0,dc:-1,arrow:'↖',name:'左上'}];
async function inspectByHover(){const e=enemy(await state());await page.mouse.move(0,0);await page.mouse.move(e.x,e.bodyY);await page.locator('.ui-facing').waitFor();}

test('Enemy front and rear indicators distinguish all four directions and agree with attack positioning',async()=>{
  await boot();await fixture();
  for(const f of facingCases){
    await page.evaluate(f=>Board.__test.arrange([{kind:'shade',r:4,c:4,dir:f.dir,hp:500,mhp:500},{kind:'aria',r:7,c:7,atk:18}]),f);
    await inspectByHover();assert.equal(await page.locator('.ui-facing').getAttribute('data-dir'),String(f.dir));
    assert.match(await page.locator('.ui-facing').textContent(),new RegExp(f.arrow+'.*'+f.name));
    const s=await state(),e=enemy(s);
    await page.waitForTimeout(100);
    const pixel=await page.evaluate(({e,tw,dr,dc})=>{
      const cv=document.getElementById('boardCanvas'),c=cv.getContext('2d');
      const fx=(dc-dr)*tw/2,fy=(dc+dr)*tw*.54/2;
      const get=(x,y)=>{const data=c.getImageData(Math.round(x*devicePixelRatio)-1,Math.round(y*devicePixelRatio)-1,3,3).data;return Array.from({length:9},(_,i)=>[...data.slice(i*4,i*4+4)]);};
      return {front:get(e.x+fx*.75,e.y+fy*.75),rear:get(e.x-fx*.66,e.y-fy*.66)};
    },{e,tw:s.tw,...f});
    assert(pixel.front.some(p=>p[0]>220&&p[1]>180&&p[2]<160),`A visible amber arrow must point to the actual front: ${JSON.stringify(pixel)}`);
    assert(pixel.rear.some(p=>p[0]<170&&p[1]>200&&p[2]>220),`Visible cyan marks must identify the actual rear: ${JSON.stringify(pixel)}`);
    await page.evaluate(f=>Board.__test.arrange([{kind:'aria',r:4+f.dr,c:4+f.dc}]),f);await inspectByHover();
    assert.equal(await page.locator('.ui-approach').getAttribute('data-side'),'front');
    await page.evaluate(f=>Board.__test.arrange([{kind:'aria',r:4-f.dr,c:4-f.dc}]),f);await inspectByHover();
    assert.equal(await page.locator('.ui-approach').getAttribute('data-side'),'back');assert.match(await page.locator('.ui-approach').textContent(),/背後から \+25%/);
    await page.evaluate(f=>Board.__test.arrange([{kind:'aria',r:4+f.dc,c:4-f.dr}]),f);await inspectByHover();
    assert.equal(await page.locator('.ui-approach').getAttribute('data-side'),'side');assert.match(await page.locator('.ui-approach').textContent(),/側面から \+10%/);
  }
});

for(const viewport of [{width:320,height:480},{width:390,height:844},{width:667,height:375}]){
  test(`Enemy facing can be inspected by touch without attacking at ${viewport.width} × ${viewport.height}`,async()=>{
    await boot('cove',viewport);await fixture();await page.locator('#cancelSel').tap();
    const before=await state(),e=enemy(before);await page.touchscreen.tap(e.x,e.bodyY);
    await page.locator('.ui-facing').waitFor();assert.match(await page.locator('.ui-facing').textContent(),/↙.*左下/);
    const after=await state();assert.equal(enemy(after).hp,e.hp);assert.equal(after.turn,before.turn);assert(!aria(after).acted);
    await inViewport('unitInfo');
    await page.locator('#boardHelp').tap();assert.match(await page.locator('.pn-body').textContent(),/橙の矢印が正面.*青の二本線が背後/s);
  });
}

test('Enemy movement and attacks update the facing information for the next player turn',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'shade',dir:0,hp:500,mhp:500,atk:1},{kind:'aria',hp:1000,mhp:1000,atk:1}]));
  await inspectByHover();assert.equal(await page.locator('.ui-facing').getAttribute('data-dir'),'0');
  assert.equal(await page.locator('.ui-approach').getAttribute('data-side'),'back');
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy);
  await inspectByHover();const e=enemy(await state());
  assert.equal(e.dir,2);assert.equal(await page.locator('.ui-facing').getAttribute('data-dir'),'2');
  assert.equal(await page.locator('.ui-approach').getAttribute('data-side'),'front');
});

test('Waiting chooses all four directions without spending resources before confirmation',async()=>{
  await boot();await fixture();
  await page.evaluate(()=>Board.__test.addAlly('gran',1,1,{until:4,summon:3}));
  for(const dir of [0,1,2,3]) {
    await page.evaluate(()=>Board.__test.arrange([{kind:'aria',acted:false,moved:false,dir:0},{kind:'shade',hp:500,mhp:500}]));
    const before=await state();await openMenu();await page.locator('[data-k=wait]').click();
    const choosing=await state();assert.equal(choosing.mode,'facing');assert(!aria(choosing).acted&&!aria(choosing).moved);
    if(dir===0){await page.waitForTimeout(200);await page.screenshot({path:'/tmp/cr-wait-desktop.png'});}
    assert.equal(choosing.sp,before.sp);assert.equal(choosing.turn,before.turn);assert.equal(aria(choosing).dir,0);
    assert(await page.locator('#endTurn').isDisabled());
    await page.keyboard.press('e');assert.equal((await state()).turn,before.turn,'Turn shortcut must not skip the direction choice');
    await page.locator(`[data-k=facewait][data-a="${dir}"]`).click();
    const after=await state();assert.equal(aria(after).dir,dir);assert(aria(after).acted&&aria(after).moved);
    assert.equal(after.sp,before.sp);assert.equal(after.turn,before.turn);assert.equal(after.mode,'idle');
    assert.match(await page.locator('#unitInfo .ui-facing').textContent(),new RegExp(facingCases[dir].name));
  }
});

test('Cancelling the direction choice keeps the moved position and permits a complete movement undo',async()=>{
  await boot();await fixture();const before=await state();
  const cell=await legalCell();assert(cell);await page.mouse.click(cell.x,cell.y);await idle();
  const moved=await state();assert(aria(moved).moved);
  await page.locator('[data-k=wait]').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
  const cancelled=await state();assert.equal(cancelled.mode,'selected');assert(!aria(cancelled).acted);
  assert.deepEqual([aria(cancelled).r,aria(cancelled).c,aria(cancelled).dir],[aria(moved).r,aria(moved).c,aria(moved).dir]);
  assert.deepEqual(cancelled.cells.map(c=>c.floor),moved.cells.map(c=>c.floor));
  await page.locator('#cancelSel').click();const undone=await state();
  assert.deepEqual([aria(undone).r,aria(undone).c,aria(undone).dir],[aria(before).r,aria(before).c,aria(before).dir]);
  assert(!aria(undone).moved&&!aria(undone).acted);assert.deepEqual(undone.cells.map(c=>c.floor),before.cells.map(c=>c.floor));
});

test('The direction choice supports keyboard focus, confirmation, and the back button',async()=>{
  await boot('king');await fixture('king');await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
  await page.keyboard.press('w');assert.equal((await state()).mode,'facing');
  assert.equal(await page.locator(':focus').getAttribute('data-a'),'0');
  await page.locator('#skills .skill').first().click();assert.equal((await state()).mode,'facing');assert.equal(await page.locator('[data-k=facewait]').count(),4,'Spirit shortcuts must not bypass the pending direction choice');
  await page.locator('[data-k=facewait][data-a="0"]').focus();
  await page.keyboard.press('ArrowDown');assert.equal(await page.locator(':focus').getAttribute('data-a'),'1');
  await page.keyboard.press('Enter');assert.equal(aria(await state()).dir,1);assert(aria(await state()).acted);
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',acted:false,moved:false,dir:3}]));
  await openMenu();await page.locator('[data-k=wait]').click();await page.locator('[data-k=back]').click();
  assert.equal((await state()).mode,'selected');assert.equal(aria(await state()).dir,3);assert(!aria(await state()).acted);
  await page.keyboard.press('w');await page.keyboard.press('3');assert.equal(aria(await state()).dir,2);assert(aria(await state()).acted);
});

for(const viewport of [{width:320,height:480},{width:390,height:844},{width:667,height:375}]) {
  test(`The wait direction panel is readable and tappable at ${viewport.width}×${viewport.height}`,async()=>{
    await boot('cove',viewport);await fixture();await page.evaluate(()=>Board.__test.addAlly('gran',1,1));
    await page.locator('#actHere').tap();await page.locator('[data-k=wait]').tap();
    await inViewport('cmdMenu');
    const buttons=page.locator('[data-k=facewait]');assert.equal(await buttons.count(),4,`Mode: ${(await state()).mode}`);
    for(const b of await buttons.all()) {
      const box=await b.boundingBox();assert(box.width>=44&&box.height>=44,'Direction choices need usable touch targets');
      assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
    }
    await page.waitForTimeout(200);await page.screenshot({path:`/tmp/cr-wait-${viewport.width}.png`});
    await page.locator('[data-k=facewait][data-a="3"]').tap();const s=await state();
    assert.equal(aria(s).dir,3);assert(aria(s).acted&&aria(s).moved);assert.equal(s.turn,1);
  });
}

test('A summoned spirit can select its facing and the choice changes real rear attack damage',async()=>{
  await boot('king');await fixture('king',{spStart:6});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',r:7,c:7},{kind:'shade',r:4,c:4,hp:1000,mhp:1000,atk:30}]));
  const spiritId=await page.evaluate(()=>Board.__test.addAlly('gran',5,4,{until:4,summon:3,dir:0}));
  const s=await state(),spirit=s.units.find(u=>u.id===spiritId),e=enemy(s);
  const front=await page.evaluate(({from,to})=>Board.__test.damage(from,to),{from:e.id,to:spiritId});
  await page.locator('#cancelSel').click();await clickUnit(spirit,true);await openMenu();await page.locator('[data-k=wait]').click();
  await page.locator('[data-k=facewait][data-a="2"]').click();const after=await state(),a=after.units.find(u=>u.id===spiritId);
  assert.equal(a.dir,2);assert(a.acted&&a.moved);assert(!aria(after).acted,'Waiting one spirit must keep the other ally available');
  const back=await page.evaluate(({from,to})=>Board.__test.damage(from,to),{from:e.id,to:spiritId});
  assert.equal(front.side,'front');assert.equal(back.side,'back');assert(back.dmg>front.dmg,'Chosen facing must drive combat damage, not just the icon');
});

test('Stopping during a direction choice removes the panel and cannot consume the next battle’s action',async()=>{
  await boot();await fixture();await openMenu();await page.locator('[data-k=wait]').click();
  await page.evaluate(()=>{Board.stop();Board.start({...BOARDS.cove,intro:null,tutorial:null,beats:[]});});await idle();
  const after=await state();assert.equal(after.turn,1);assert.equal(after.mode,'selected');assert(!aria(after).acted);
  assert(await page.locator('#cmdMenu').isHidden());assert(!(await page.locator('#endTurn').isDisabled()));
});

test('Rapid item targeting consumes one item and a two-turn guard expires after two enemy turns',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:{aria:{lv:1,exp:0},spirits:{},items:{i_ward:1}}});await fixture();
  await page.evaluate(()=>{
    Board.__test.arrange([{kind:'aria',hp:1000,mhp:1000},{kind:'shade',r:0,c:0,root:8,hp:1000,mhp:1000,atk:25}]);
    Board.__test.addAlly('gran',1,0,{hp:1000,mhp:1000});
  });
  const before=await state(),a=aria(before),e=enemy(before);
  const normal=await page.evaluate(({from,to})=>Board.__test.damage(from,to),{from:e.id,to:a.id});
  await openMenu();await page.locator('[data-k=item]').click();await page.locator('[data-k=useitem][data-a=i_ward]').click();
  await page.mouse.dblclick(a.x,a.bodyY);await page.waitForFunction(()=>Board.__test.state().mode==='idle');
  let s=await state();assert.equal(s.itemUses,1);assert.equal(aria(s).guard,2);
  assert.equal(await page.evaluate(()=>Board.party.items.i_ward||0),0);
  const protectedDamage=await page.evaluate(({from,to})=>Board.__test.damage(from,to),{from:e.id,to:a.id});assert(protectedDamage.dmg<normal.dmg);
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().turn===2&&!Board.__test.state().busy);
  assert.equal(aria(await state()).guard,1);
  await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__test.state().turn===3&&!Board.__test.state().busy);
  assert.equal(aria(await state()).guard,0);
});

test('A three-turn summoned spirit remains playable for exactly three following player turns',async()=>{
  await boot('king');await fixture('king',{spStart:12});
  await page.evaluate(()=>Board.__test.arrange([{kind:'aria',r:7,c:7,atk:1,hp:1000,mhp:1000},{kind:'shade',r:0,c:0,root:12,hp:1000,mhp:1000,atk:1}]));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=summon][data-a=gran]').click();
  const cell=await legalCell('targets');assert(cell);await page.mouse.click(cell.x,cell.y);
  for(const turn of [2,3,4]) {
    await page.waitForFunction(turn=>Board.__test.state().turn===turn&&!Board.__test.state().busy,turn,{timeout:25000});
    const spirit=(await state()).units.find(u=>u.kind==='gran');assert(spirit&&!spirit.dead&&!spirit.acted);
    await page.locator('#endTurn').click();
  }
  await page.waitForFunction(()=>Board.__test.state().turn===5&&!Board.__test.state().busy,{},{timeout:25000});
  assert(!(await state()).units.some(u=>u.kind==='gran'&&!u.dead));
  await openMenu();await page.locator('[data-k=spirit]').click();
  for(const route of ['summon','enchant'])assert(!await page.locator(`[data-k=${route}][data-a=gran]`).isDisabled(),'Expiry must allow both summon and enchant again');
  assert.equal(await page.locator('.cm-sp.fallen').count(),0);
});

test('Reduced motion keeps attack damage while suppressing battle zoom and screen shake',async()=>{
  await boot('cove',{width:1440,height:900},{cr_settings:{reduceMotion:true,textSize:'normal'}});await fixture();
  await page.evaluate(()=>{
    window.boardShakes=0;const original=Element.prototype.animate;
    Element.prototype.animate=function(...args){if(this.id==='boardScreen')window.boardShakes++;return original.apply(this,args);};
    Board.__test.arrange([{kind:'aria',atk:25,hp:1000,mhp:1000},{kind:'shade',hp:500,mhp:500}]);
    Board.__test.addAlly('gran',1,1);
  });
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
  await attack();await page.waitForFunction(()=>Board.__test.state().units.find(u=>u.kind==='shade').hp<500);
  assert.equal((await state()).zoom,1);assert.equal(await page.evaluate(()=>window.boardShakes),0);
});

test('Stopping an attack immediately cancels its screen vibration before a new battle',async()=>{
  await boot();await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25},{kind:'shade',hp:500,mhp:500}]));
  await attack();await page.waitForFunction(()=>document.getElementById('boardScreen').getAnimations().length>0);
  await page.evaluate(()=>Board.stop());
  assert.equal(await page.locator('#boardScreen').evaluate(e=>e.getAnimations().length),0);
  await page.evaluate(()=>Board.start({...BOARDS.cove,intro:null,tutorial:null,beats:[]}));await idle();
  assert.equal((await state()).turn,1);assert(!aria(await state()).acted);
});

test('Actual attack and victory rewards cap Aria at LV99 and keep the save exportable after further battles',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:{aria:{lv:98,exp:99},spirits:{}}});
  for(const round of [0,1]) {
    await fixture();await page.evaluate(()=>Board.__test.arrange([{kind:'shade',lv:99,hp:1,armor:0}]));
    await attack();await page.locator('#resNext').waitFor({timeout:12000});
    const s=await state(),record=await page.evaluate(()=>Board.party.aria);
    assert.equal(record.lv,99);assert.equal(record.exp,0);assert.equal(aria(s).lv,99);
    assert.match(await page.locator('.r-exp').textContent(),/成長上限/);
    assert.equal(await page.locator('.r-lv').count(),round===0?1:0,'The cap must not produce another level-up');
    const exported=await page.evaluate(()=>{const text=SaveData.exportText();return {result:SaveData.previewText(text),party:JSON.parse(JSON.parse(text).data.cr_party)};});
    assert(exported.result.ok,exported.result.message);assert.equal(exported.result.level,99);
    assert.equal(exported.party.aria.lv,99);assert.equal(exported.party.aria.exp,0);
    await page.locator('#resNext').click();
  }
});

test('Actual summon hit, kill, and arrival experience cap a spirit at LV99 and preserve save export',async()=>{
  await boot('king',{width:1440,height:900},{cr_party:{aria:{lv:11,exp:0},spirits:{gran:{lv:98,exp:99,bond:0,uses:0}}}});
  for(const round of [0,1]) {
    await fixture('king',{spStart:6});await page.evaluate(()=>Board.__test.arrange([{kind:'shade',lv:99,hp:1,armor:0}]));
    await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=summon][data-a=gran]').click();
    const cell=await legalCell('targets');assert(cell);await page.mouse.click(cell.x,cell.y);
    await page.locator('#resNext').waitFor({timeout:12000});
    const record=await page.evaluate(()=>Board.party.spirits.gran),spirit=(await state()).units.find(u=>u.kind==='gran');
    assert.equal(record.lv,99);assert.equal(record.exp,0);assert.equal(spirit.lv,99);
    assert.equal(await page.locator('.r-lv').count(),round===0?1:0);
    const exported=await page.evaluate(()=>{const text=SaveData.exportText();return {result:SaveData.previewText(text),party:JSON.parse(JSON.parse(text).data.cr_party)};});
    assert(exported.result.ok,exported.result.message);assert.equal(exported.party.spirits.gran.lv,99);assert.equal(exported.party.spirits.gran.exp,0);
    await page.locator('#resNext').click();
  }
});


test('A material-upgraded attack deals more actual damage while keeping its resonance cost',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:partyWithTraining(40)});
  const damage=[];
  for(const level of [0,3]) {
    await page.evaluate(level=>{Board.party.aria.skillLevels.gran_wave=level;Board.saveParty();},level);
    await fixture('cove',{spStart:12});await page.evaluate(()=>{Board.__test.arrange([{kind:'aria',atk:40,hp:1000,mhp:1000},{kind:'shade',hp:5000,mhp:5000,atk:1,def:0}]);Board.__test.addAlly('ivy',2,2);});
    await openMenu();await page.locator('[data-k=learned]').click();await page.locator('[data-k=learnedroute][data-a=enchant]').click();
    assert.match(await page.locator('[data-k=skill][data-a=gran_wave]').textContent(),level?/水鏡の矢 \+3/:/水鏡の矢/);
    await page.locator('[data-k=skill][data-a=gran_wave]').click();await clickUnit(enemy(await state()),true);
    await page.waitForFunction(()=>Board.__test.state().skillUses===1&&!Board.__test.state().busy);
    damage.push(5000-enemy(await state()).hp);assert.equal((await state()).sp,10);
  }
  assert(damage[1]>damage[0]*1.25,JSON.stringify(damage));
});

test('A material-upgraded support skill applies its displayed healing and extra guard turn',async()=>{
  await boot('cove',{width:1440,height:900},{cr_party:partyWithTraining(40)});
  for(const level of [0,2]) {
    await page.evaluate(level=>{Board.party.aria.skillLevels.gran_current=level;Board.saveParty();},level);
    await fixture('cove',{spStart:12});await page.evaluate(()=>{Board.__test.arrange([{kind:'aria',hp:20,mhp:100},{kind:'shade',hp:5000,mhp:5000,atk:1}]);Board.__test.addAlly('ivy',2,2);});
    await openMenu();await chooseLearned('gran_current');await clickUnit(aria(await state()),true);
    await page.waitForFunction(()=>Board.__test.state().skillUses===1&&!Board.__test.state().busy);
    assert.equal(aria(await state()).hp,level?70:59);assert.equal(aria(await state()).guard,level?2:1);assert.equal((await state()).sp,9);
  }
});
