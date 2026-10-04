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
  state() { return {running,phase,turn,busy,over,paused,mode,sp,stage,skyCharges,tw,sel:sel&&sel.id,spiritUses:stats&&stats.spiritUses,skillUses:stats&&stats.skillUses,difficulty,recommendedLv:cfg&&cfg.recommendedLv,missionProgress:(cfg&&cfg.missions||[]).map(m=>missionState(m,false)),
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,lv:u.lv,atk:u.atk,def:u.def,armor:u.armor,root:u.root,guard:u.guard,r:u.r,c:u.c,hp:u.hp,mhp:u.mhp,moved:u.moved,acted:u.acted,dead:!!u.dead,hidden:!!u.hidden,enchant:u.enchant,until:u.until,
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

async function boot(id='cove', viewport={width:1440,height:900}, storage={}) {
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

const allChapters=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done'];
const partyWithBond=points=>({aria:{lv:1,exp:0},spirits:Object.fromEntries(['gran','ivy','spinel','king'].map(id=>[id,{lv:1,exp:0,bond:points,uses:0}]))});

for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:667,height:375}]) {
  test(`Map shows levels, selectable difficulty and twelve quests at ${viewport.width} × ${viewport.height}`,async()=>{
    await boot('cove',viewport,{cr_unlocked:allChapters,cr_party:partyWithBond(40)});
    await page.evaluate(()=>World.open());
    assert.match(await page.locator('[data-node=cove] .wn-meta').textContent(),/LV1・ふつう/);
    await page.locator('[data-w=quests]').click();
    assert.equal(await page.locator('#panel [data-quest]').count(),12);
    await page.locator('#panel [data-quest=q_tide]').click();
    await page.locator('#wmPanel [data-diff=hard]').waitFor();
    await page.locator('#wmPanel [data-diff=hard]').click();
    assert.match(await page.locator('#wmPanel').textContent(),/適正LV 8/);
    assert(await page.locator('#wmPanel [data-diff=hard]').getAttribute('aria-pressed')==='true');
    await inViewport('wmPanel');
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
  assert.match(await page.locator('.pn-body').textContent(),/絆8で習得/);
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

test('Committed spirit use grows only that spirit’s bond, unlocks a permanent skill, and improves its strength',async()=>{
  const p=partyWithBond(0);p.spirits.gran.bond=6;
  await boot('king',{width:1440,height:900},{cr_party:p});
  await fixture('king',{spStart:12});await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:25,hp:1000,mhp:1000},{kind:'shade',hp:500,mhp:500,atk:1}]));
  const before=await page.evaluate(()=>Board.statsFor('gran',10));
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=back]').click();
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),6);
  await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();await idle();
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),8);
  assert(await page.evaluate(()=>Board.party.aria.skills.includes('gran_wave')));
  const after=await page.evaluate(()=>Board.statsFor('gran',10));assert(after.atk>before.atk&&after.mhp>before.mhp);
  await page.locator('[data-k=attack]').click();await clickUnit(enemy(await state()),true);
  await page.waitForFunction(()=>Board.party.spirits.gran.bond===9);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.cr_party));
  assert.equal(saved.spirits.gran.uses,2);assert.equal(saved.spirits.ivy.bond,0);
  await page.evaluate(()=>Board.stop());await fixture('cove',{spStart:6});await openMenu();
  assert(await page.locator('[data-k=learned]').isVisible());
});

test('An interrupted spirit cut-in grants no bond or learned skill',async()=>{
  const p=partyWithBond(0);p.spirits.gran.bond=6;
  await boot('king',{width:1440,height:900},{cr_party:p});
  await openMenu();await page.locator('[data-k=spirit]').click();await page.locator('[data-k=enchant][data-a=gran]').click();
  await page.evaluate(()=>Board.stop());await fixture('cove');await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(()=>Board.party.spirits.gran.bond),6);
  assert(!await page.evaluate(()=>Board.party.aria.skills.includes('gran_wave')));
});

const skillIds=['gran_wave','gran_mend','gran_tide','ivy_bind','ivy_bloom','ivy_dance','spinel_break','spinel_guard','spinel_sun','king_prism','king_canvas','king_resonance'];
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

test('All twelve learned skills and the back button can be reached on a small touchscreen',async()=>{
  await boot('cove',{width:320,height:480},{cr_party:partyWithBond(40)});
  await fixture('cove',{spStart:12});await openMenu();await page.locator('[data-k=learned]').click();
  assert.equal(await page.locator('[data-k=skill]').count(),12);
  await inViewport('cmdMenu');
  const widths=await page.locator('#cmdMenu').evaluate(e=>({menu:e.clientWidth,button:e.querySelector('[data-k=skill]').clientWidth}));
  assert(widths.button>=widths.menu-24,'Each learned skill must have a readable full-width row');
  await page.waitForTimeout(200);
  await page.screenshot({path:'/tmp/cr-skills-320.png'});
  await page.locator('[data-k=skill][data-a=king_resonance]').scrollIntoViewIfNeeded();
  assert(await page.locator('[data-k=skill][data-a=king_resonance]').isVisible());
  await page.locator('[data-k=back]').click();assert(await page.locator('[data-k=learned]').isVisible());
});

for(const id of skillIds) {
  test(`Aria can use ${id} without summoning, applying its effect and paying once`,async()=>{
    await boot('cove',{width:1440,height:900},{cr_party:partyWithBond(40)});
    await fixture('cove',{spStart:12});
    await page.evaluate(()=>Board.__test.arrange([{kind:'aria',atk:40,hp:10},{kind:'shade',hp:500,mhp:500,atk:1,armor:3}]));
    const skill=await page.evaluate(id=>Progression.skills.find(s=>s.id===id),id);
    await openMenu();await page.locator('[data-k=learned]').click();await page.locator(`[data-k=skill][data-a=${id}]`).click();
    // Cancelling a target selection must not pay or grant progress.
    assert.equal((await state()).sp,12);assert.equal(await page.evaluate(id=>Board.party.spirits[id].bond,skill.spirit),40);
    await page.locator('#cancelSel').click();
    await openMenu();await page.locator('[data-k=learned]').click();await page.locator(`[data-k=skill][data-a=${id}]`).click();
    await clickUnit(skill.target==='ally'?aria(await state()):enemy(await state()),true);
    await page.waitForFunction(()=>Board.__test.state().skillUses===1&&!Board.__test.state().busy);
    const s=await state(),a=aria(s),e=enemy(s);
    assert.equal(s.sp,12-skill.cost+(skill.power?1:0));assert.equal(s.spiritUses,1);
    assert.equal(await page.evaluate(id=>Board.party.spirits[id].bond,skill.spirit),42);
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
