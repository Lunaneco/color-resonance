const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browsers;
// Test-only fixtures and state access; normal gameplay uses the rendered UI.
// Private command calls verify that disabled actions cannot bypass the rules.
// No test API is included in the deployed game.
const hook=`__viewQA: {
  state(){return {running,busy,paused,over,phase,turn,mode,sp,rotation:viewRotation,down:stats?.down,uses:stats?.spiritUses,fallen:[...defeatedSpirits],
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,r:u.r,c:u.c,dir:u.dir,hp:u.hp,moved:u.moved,acted:u.acted,dead:u.dead,enchant:u.enchant,undo:!!u.undo,normalAttacks:u.normalAttacks,
      ...toScreen(unitXY(u).x,unitXY(u).y),bodyY:toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5).y})),
    cells:cells.map((c,i)=>({id:i,r:c.r,c:c.c,floor:c.floor,...toScreen(topOf(c).x,topOf(c).y)})),ends:moveInfo?[...moveInfo.ends]:[],targets:targets?[...targets]:[]};},
  arrange(){Math.random=()=>.5;Object.assign(ariaU(),{r:3,c:4,dir:0,atk:40,hp:10000,mhp:10000,def:10000});Object.assign(units.find(u=>u.side==='enemy'),{r:2,c:4,dir:0,hp:10000,mhp:10000,atk:999,mov:0,rng:[1,8]});refreshHud();select(ariaU(),true);},
  vulnerable(){Object.assign(ariaU(),{hp:1,def:0});},
  ally(kind,r,c,extra={}){const u=makeUnit(kind,'ally',1,cellAt(r,c),extra);units.push(u);refreshHud();return u.id;},
  pick(x,y){const c=pick(x,y);return c&&{r:c.r,c:c.c};},
  damage(){return calcDamage(ariaU(),units.find(u=>u.side==='enemy'),{normal:true},null,false);},
  command(k,arg){command(k,arg);},
  refresh(){refreshHud();}
}, `;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error('Invalid path');
    const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
  browsers={chromium:await chromium.launch(),webkit:await webkit.launch()};
});
after(async()=>{for(const b of Object.values(browsers||{}))await b.close();if(server)await new Promise(r=>server.close(r));});
async function session(engine,viewport,run){
  const context=await browsers[engine].newContext({viewport,hasTouch:viewport.width<900}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await context.addInitScript(()=>localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true})));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker));await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{await page.goto(base+'#board=king',{waitUntil:'networkidle'});await page.locator('#gate').click();await idle(page);await run(page,viewport);assert.deepEqual(errors,[]);}
  finally{await context.close();}
}
const state=page=>page.evaluate(()=>Board.__viewQA.state());
const idle=page=>page.waitForFunction(()=>{const s=Board.__viewQA.state();return s.running&&!s.busy&&!s.paused&&!s.over;},null,{timeout:20000});
const aria=s=>s.units.find(u=>u.kind==='aria');
const enemy=s=>s.units.find(u=>u.side==='enemy');
const logical=s=>({sp:s.sp,turn:s.turn,mode:s.mode,units:s.units.map(({x,y,bodyY,...u})=>u),floors:s.cells.map(c=>c.floor),ends:s.ends,targets:s.targets});
async function fixture(page,extra={}){
  await page.evaluate(extra=>Board.start({...BOARDS.king,cols:9,rows:7,spirits:['gran','ivy','spinel','king'],map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,water:null},enemies:[{kind:'shade',lv:1}],intro:null,tutorial:null,beats:[],spStart:12,...extra}),extra);
  await idle(page);await page.evaluate(()=>Board.__viewQA.arrange());
}
async function press(page,selector,viewport){if(viewport.width<900)await page.locator(selector).tap();else await page.locator(selector).click();}
async function fits(page,selector){
  const b=await page.locator(selector).boundingBox(),v=page.viewportSize();assert(b,selector+' must be visible');
  assert(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+.5&&b.y+b.height<=v.height+.5,JSON.stringify({selector,b,v}));
  return b;
}
async function point(page,p,viewport){if(viewport.width<900)await page.touchscreen.tap(p.x,p.bodyY??p.y);else await page.mouse.click(p.x,p.bodyY??p.y);}
async function openSpirits(page,viewport){await press(page,'#actHere',viewport);await press(page,'[data-k=spirit]',viewport);}
async function legalMove(page){return page.evaluate(()=>{const s=Board.__viewQA.state();return s.cells.find(c=>s.ends.includes(c.id)&&Board.__viewQA.pick(c.x,c.y)?.r===c.r&&Board.__viewQA.pick(c.x,c.y)?.c===c.c&&document.elementFromPoint(c.x,c.y)?.id==='boardCanvas');});}

for(const engine of ['chromium','webkit']){
  for(const viewport of [{width:1440,height:900},{width:320,height:480},{width:667,height:375}]){
    test(`${engine}: rotated rectangular map preserves targeting, movement, undo and facing at ${viewport.width} × ${viewport.height}`,async()=>session(engine,viewport,async page=>{
      await fixture(page);await page.evaluate(()=>Board.__viewQA.ally('gran',5,7));
      const start=await state(page),damage=await page.evaluate(()=>Board.__viewQA.damage());
      for(let q=0;q<4;q++){
        if(q){const before=await state(page);await press(page,'#rotateRight',viewport);assert.deepEqual(logical(await state(page)),logical(before));}
        let s=await state(page);assert.equal(s.rotation,q);
        for(const id of ['#rotateLeft','#rotateRight']){const b=await fits(page,id);assert(b.width>=44&&b.height>=44);}
        assert((await fits(page,'#cmdBar')).height<110);
        assert.deepEqual(await page.evaluate(()=>Board.__viewQA.damage()),damage,'Rotation cannot change rear attack damage');
        assert.equal(await page.locator('.ui-facing').getAttribute('data-dir'),'0');assert.equal(await page.locator('.ui-facing').getAttribute('data-view-dir'),String(q));
        for(const c of s.cells)assert(c.x>=-1&&c.x<=viewport.width+1&&c.y>=0&&c.y<=viewport.height,'Rotated rectangle must stay centered and visible');
        const move=await legalMove(page);assert(move,'A projected legal floor must remain tappable');const beforeMove=await state(page);
        await point(page,move,viewport);await idle(page);assert.deepEqual([aria(await state(page)).r,aria(await state(page)).c],[move.r,move.c]);
        await press(page,'#rotateLeft',viewport);assert(aria(await state(page)).undo,'Rotation must retain movement undo');
        await press(page,'#cancelSel',viewport);s=await state(page);assert.deepEqual([aria(s).r,aria(s).c],[3,4]);assert.deepEqual(s.cells.map(c=>c.floor),beforeMove.cells.map(c=>c.floor));
        await press(page,'#rotateRight',viewport);assert.equal((await state(page)).rotation,q);
        await page.keyboard.press('a');s=await state(page);assert.equal(s.mode,'target');const targets=s.targets;
        await press(page,'#rotateRight',viewport);assert.deepEqual((await state(page)).targets,targets);
        const target=enemy(await state(page));const picked=await page.evaluate(p=>Board.__viewQA.pick(p.x,p.bodyY),target);assert.deepEqual(picked,{r:target.r,c:target.c},'Rotated enemy body must pick the attack target');
        await page.keyboard.press('Escape');await press(page,'#rotateLeft',viewport);
        await page.keyboard.press('w');const beforeFacing=await state(page);assert.equal(beforeFacing.mode,'facing');
        await page.keyboard.press('r');s=await state(page);assert.equal(s.mode,'facing');assert(!aria(s).acted);
        const current=page.locator('[data-k=facewait][aria-current=true]');assert.equal(await current.getAttribute('data-a'),'0');
        assert.equal(await current.locator('b').textContent(),['↗','↘','↙','↖'][s.rotation]);
        assert.equal(await page.locator(':focus').getAttribute('data-a'),'0','Rotation must preserve focused wait choice');
        await page.keyboard.press('q');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
      }
      await press(page,'#rotateRight',viewport);const restored=await state(page);assert.equal(restored.rotation,0);
      assert.deepEqual(restored.cells.map(({id,x,y})=>({id,x,y})),start.cells.map(({id,x,y})=>({id,x,y})),'Four quarter turns must restore every screen coordinate');
      await page.keyboard.press('q');assert.equal((await state(page)).rotation,3);await page.keyboard.press('0');assert.equal((await state(page)).rotation,0);
      await press(page,'#boardHelp',viewport);await page.keyboard.press('r');assert.equal((await state(page)).rotation,0,'Panel must block rotation shortcuts');
      assert.match(await page.locator('.pn-body').textContent(),/再召喚も心剣に宿すこともできません/);
    }));
  }
  test(`${engine}: attacks hit the same enemy and keep rear damage at all four camera angles`,async()=>session(engine,{width:1440,height:900},async(page,viewport)=>{
    const damage=[];
    for(let q=0;q<4;q++){
      await fixture(page);await page.evaluate(()=>Board.__viewQA.ally('gran',5,7));
      for(let i=0;i<q;i++)await press(page,'#rotateRight',viewport);
      await page.keyboard.press('a');const foe=enemy(await state(page));await point(page,foe,viewport);
      await page.waitForFunction(()=>Board.__viewQA.state().busy);const rotation=(await state(page)).rotation;
      await page.keyboard.press('r');assert.equal((await state(page)).rotation,rotation,'An ongoing attack must block rotation');
      await idle(page);const s=await state(page);damage.push(foe.hp-enemy(s).hp);assert(aria(s).acted);assert.equal(aria(s).normalAttacks,1);
    }
    assert(damage[0]>0);assert(damage.every(d=>d===damage[0]),JSON.stringify(damage));
  }));
  test(`${engine}: screen-facing number keys commit the displayed direction after rotation`,async()=>session(engine,{width:1440,height:900},async(page,viewport)=>{
    for(let q=0;q<4;q++){
      await fixture(page);await page.evaluate(()=>Board.__viewQA.ally('gran',5,7));
      for(let i=0;i<q;i++)await press(page,'#rotateRight',viewport);
      await page.keyboard.press('w');await page.keyboard.press('1');const s=await state(page);
      assert.equal(aria(s).dir,(4-q)%4);assert(aria(s).acted);assert.equal(s.turn,1);
      assert.match(await page.locator('.ui-facing').textContent(),/↗.*右上/);
    }
  }));
  test(`${engine}: each defeated summoned spirit locks both routes for later turns without spending resonance or training`,async()=>session(engine,{width:1440,height:900},async(page,viewport)=>{
    for(const id of ['gran','ivy','spinel','king']){
      await fixture(page);assert.deepEqual((await state(page)).fallen,[],'A new battle must clear the previous restriction');await page.evaluate(id=>Board.__viewQA.ally(id,2,3,{hp:1,mhp:1,def:0,until:4,summon:3}),id);
      await press(page,'#endTurn',viewport);await page.waitForFunction(()=>Board.__viewQA.state().turn===2&&!Board.__viewQA.state().busy);
      let s=await state(page);assert(s.fallen.includes(id));assert.equal(s.down,1);assert(!s.over);assert(!s.units.some(u=>u.kind===id&&!u.dead));
      await openSpirits(page,viewport);
      for(const route of ['summon','enchant'])assert(await page.locator(`[data-k=${route}][data-a=${id}]`).isDisabled());
      assert.match(await page.locator('.cm-sp.fallen small').textContent(),/この戦闘中は使用不可/);
      assert(await page.locator('.skill.spirit.fallen').isDisabled());
      const other=id==='gran'?'ivy':'gran';for(const route of ['summon','enchant'])assert(!await page.locator(`[data-k=${route}][data-a=${other}]`).isDisabled());
      const before=logical(await state(page)),record=await page.evaluate(()=>JSON.stringify(Board.party));
      await page.evaluate(id=>{Board.__viewQA.command('summon',id);Board.__viewQA.command('enchant',id);Board.reloadParty();Board.__viewQA.refresh();},id);
      assert.deepEqual(logical(await state(page)),before);assert.equal(await page.evaluate(()=>JSON.stringify(Board.party)),record);
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');await press(page,'#endTurn',viewport);
      await page.waitForFunction(()=>Board.__viewQA.state().turn===3&&!Board.__viewQA.state().busy);s=await state(page);
      assert(!s.units.some(u=>u.kind===id),'Dead sprite should be pruned while the restriction remains');assert(s.fallen.includes(id));
      await openSpirits(page,viewport);for(const route of ['summon','enchant'])assert(await page.locator(`[data-k=${route}][data-a=${id}]`).isDisabled());
    }
  }));
  test(`${engine}: an actual summon killed by enemy AI stays unavailable until retry or the next battle`,async()=>session(engine,{width:390,height:844},async(page,viewport)=>{
    await fixture(page,{spStart:12});await openSpirits(page,viewport);await press(page,'[data-k=summon][data-a=gran]',viewport);
    const cell=await page.evaluate(()=>{const s=Board.__viewQA.state();return s.cells.find(c=>s.targets.includes(c.id)&&c.r===3&&c.c===3);});assert(cell);await point(page,cell,viewport);
    await page.waitForFunction(()=>Board.__viewQA.state().turn===2&&!Board.__viewQA.state().busy,null,{timeout:25000});
    assert((await state(page)).fallen.includes('gran'));await openSpirits(page,viewport);
    for(const route of ['summon','enchant'])assert(await page.locator(`[data-k=${route}][data-a=gran]`).isDisabled());
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await press(page,'#rotateRight',viewport);
    // Exercise the real loss and retry UI, lowering only fixture HP/defense.
    await page.evaluate(()=>Board.__viewQA.vulnerable());await press(page,'#endTurn',viewport);
    await page.locator('#resRetry').waitFor({timeout:20000});await page.keyboard.press('r');assert.equal((await state(page)).rotation,1,'The result screen must block rotation');
    await press(page,'#resRetry',viewport);await idle(page);assert.deepEqual((await state(page)).fallen,[]);assert.equal((await state(page)).rotation,0);
    await openSpirits(page,viewport);for(const route of ['summon','enchant'])assert(!await page.locator(`[data-k=${route}][data-a=gran]`).isDisabled());
    const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('cr_party')));assert(!('defeatedSpirits' in saved));
  }));
  test(`${engine}: four defeated spirits remain readable without covering touch controls on a small phone`,async()=>session(engine,{width:320,height:480},async(page,viewport)=>{
    await fixture(page);
    for(const [index,id] of ['gran','ivy','spinel','king'].entries()){
      await page.evaluate(id=>Board.__viewQA.ally(id,2,3,{hp:1,mhp:1,def:0,until:20,summon:20}),id);
      await press(page,'#endTurn',viewport);await page.waitForFunction(turn=>Board.__viewQA.state().turn===turn&&!Board.__viewQA.state().busy,index+2);
    }
    assert.equal(await page.locator('.skill.spirit.fallen').count(),4);const skills=await fits(page,'#skills'),bar=await fits(page,'#cmdBar');assert(skills.y+skills.height<bar.y,'Status list must not cover the camera or action buttons');
    await page.locator('.skill.spirit.fallen').last().scrollIntoViewIfNeeded();assert.match(await page.locator('.skill.spirit.fallen').last().getAttribute('aria-label'),/戦闘不能/);
    await press(page,'#rotateRight',viewport);assert.equal((await state(page)).rotation,1);
    await openSpirits(page,viewport);assert.equal(await page.locator('.cm-sp.fallen').count(),4);
    for(const route of ['summon','enchant'])assert.equal(await page.locator(`[data-k=${route}]:disabled`).count(),4);
    await fixture(page);assert.deepEqual((await state(page)).fallen,[],'The next battle must restore all four spirits');
  }));
}
