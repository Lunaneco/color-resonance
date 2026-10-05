const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browsers;
const chapters=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done'];
const hook=`__resultQA: {
  ready:()=>running&&!busy&&!paused&&!over,
  arrange(){Object.assign(ariaU(),{r:5,c:4,dir:0,atk:999});Object.assign(units.find(u=>u.side==='enemy'),{r:4,c:4,dir:0,hp:1});refreshHud();select(ariaU(),true);},
  enemy(){const u=units.find(u=>u.side==='enemy');return toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5);}
}, `;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error('Invalid path');
    const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
  browsers={chromium:await chromium.launch(),webkit:await webkit.launch()};
});
after(async()=>{for(const b of Object.values(browsers||{}))await b.close();if(server)await new Promise(r=>server.close(r));});

async function session(engine,viewport,run,hash='#world'){
  const context=await browsers[engine].newContext({viewport,hasTouch:viewport.width<900}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await context.addInitScript(unlocked=>{
    localStorage.setItem('cr_unlocked',JSON.stringify(unlocked));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true}));
    localStorage.setItem('cr_party',JSON.stringify({aria:{lv:1,exp:95},gold:100,stages:{cove:{cleared:true,best:'S',missions:[true,true,true]}}}));
  },chapters);
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker));await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{await page.goto(base+hash,{waitUntil:'networkidle'});
    await page.evaluate(()=>{
      const fixture={map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,water:null},enemies:[{kind:'shade',lv:1}],tutorial:null,intro:null,beats:[],missions:[{type:'turns',n:20},{type:'noItem'},{type:'hp',n:1}]};
      Object.assign(BOARDS.cove,fixture);Object.assign(SIDE_QUESTS.q_tide,fixture);
    });
    await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});
    await run(page);assert.deepEqual(errors,[],'Result navigation must have no runtime errors or failed game requests');
  }finally{await context.close();}
}
async function ready(page){await page.waitForFunction(()=>Board.__resultQA.ready(),{},{timeout:15000});}
async function clear(page){
  await ready(page);await page.evaluate(()=>{Math.random=()=>.5;Board.__resultQA.arrange();});
  await page.locator('#actHere').click();await page.locator('[data-k=attack]').click();
  const point=await page.evaluate(()=>Board.__resultQA.enemy());await page.mouse.click(point.x,point.y);
  await page.locator('#resNext').waitFor({timeout:15000});
}
async function visibleAction(page){
  const b=await page.locator('#resNext').boundingBox(),v=page.viewportSize();
  assert(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,'Result action must be fully on screen without scrolling');
  assert(b.height>=44,'Result action must remain touch friendly');
  assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x:b.x+b.width/2,y:b.y+b.height/2}),'resNext','The visible result action must receive taps');
  return b;
}
for(const engine of ['chromium','webkit'])for(const [id,viewport] of [['cove',{width:1440,height:900}],['q_tide',{width:320,height:480}],['cove',{width:667,height:375}]]){
  test(`${engine}: clear ${id}, use the visible footer and return to the same map stage at ${viewport.width} × ${viewport.height}`,async()=>{
    await session(engine,viewport,async page=>{
      if(id==='q_tide'){await page.locator('[data-w=quests]').click();await page.locator('#panel [data-quest=q_tide]').click();}
      else await page.locator('[data-node=cove]').click();
      await page.locator('#wmPanel [data-diff=hard]').waitFor();await page.locator('#wmPanel [data-diff=hard]').click();
      await page.locator('#wmPanel [data-a=sortie]').click();await clear(page);
      assert.equal(await page.locator('#resNext').textContent(),'マップへ戻る');
      assert.equal(await page.locator('.pn-body').evaluate(e=>e.scrollTop),0);
      assert(await page.locator('.pn-body').evaluate(e=>e.scrollHeight>e.clientHeight),'Exercise a reward list that actually overflows');
      const top=await visibleAction(page);
      await page.locator('.pn-body').evaluate(e=>e.scrollTop=e.scrollHeight);const bottom=await visibleAction(page);assert.equal(bottom.y,top.y,'Scrolling rewards must not move the action');
      await page.locator('.pn-body').evaluate(e=>e.scrollTop=0);
      await page.screenshot({path:`/tmp/cr-result-${engine}-${viewport.width}-clear.png`});
      const rewards=await page.evaluate(id=>({gold:Board.party.gold,record:Board.party.stages[id].difficulties.hard,clears:Board.party.stages[id].clears,materials:Board.party.materials,owned:Board.party.owned,items:Board.party.items}),id);
      if(viewport.width<900)await page.touchscreen.tap(top.x+top.width/2,top.y+top.height/2);else await page.mouse.click(top.x+top.width/2,top.y+top.height/2);
      await page.locator('#world').waitFor({state:'visible'});await page.locator(`#wmPanel[data-node="${id}"]`).waitFor({state:'visible',timeout:5000});
      assert(!await page.evaluate(()=>Board.running||Panel.isOpen()));assert.equal(await page.locator('.pn-footer button').count(),0);
      assert.deepEqual(await page.evaluate(id=>({gold:Board.party.gold,record:Board.party.stages[id].difficulties.hard,clears:Board.party.stages[id].clears,materials:Board.party.materials,owned:Board.party.owned,items:Board.party.items}),id),rewards,'Returning to the map must not reaward a clear');
      await page.screenshot({path:`/tmp/cr-result-${engine}-${viewport.width}-map.png`});
      await page.locator('[data-w=equip]').click();assert(await page.evaluate(()=>Panel.isOpen()));assert(await page.locator('.pn-footer').evaluate(e=>e.classList.contains('hidden')));
      await page.locator('.pn-close').click();await page.locator('#wmPanel [data-a=sortie]').click();await ready(page);assert(await page.evaluate(()=>Board.running));
    });
  });
}
test('A story battle retains its continuation and advances past the battle checkpoint',async()=>{
  await session('chromium',{width:390,height:844},async page=>{
    await page.evaluate(()=>{World.close();SCRIPT.prologue='@board cove\nアリア「色が戻った。」';Engine.play('prologue');});await clear(page);
    assert.equal(await page.locator('#resNext').textContent(),'物語をつづける');await visibleAction(page);
    await page.locator('#resNext').tap();await page.locator('#textbox').waitFor({state:'visible'});
    assert(!await page.evaluate(()=>Board.running||Panel.isOpen()||World.isOpen));
    await page.waitForFunction(()=>document.getElementById('text').textContent.includes('色が戻った。'));
    assert.equal(await page.evaluate(()=>Engine.load().idx),1,'The saved story cursor must have advanced beyond the battle');
  });
});
test('A battle without a completion callback falls back to the map',async()=>{
  await session('webkit',{width:390,height:844},async page=>{
    await page.evaluate(()=>{World.close();Board.start(BOARDS.cove);});await clear(page);await visibleAction(page);await page.locator('#resNext').tap();
    await page.locator('#world').waitFor({state:'visible'});assert(!await page.evaluate(()=>Board.running||Panel.isOpen()));
    await page.evaluate(()=>Board.start(BOARDS.cove));await ready(page);assert(!await page.evaluate(()=>World.isOpen),'Starting another battle must hide the map');
  });
});
test('A direct battle link retains its return to title',async()=>{
  await session('chromium',{width:1440,height:900},async page=>{
    await clear(page);assert.equal(await page.locator('#resNext').textContent(),'タイトルへ戻る');await visibleAction(page);await page.locator('#resNext').click();
    await page.locator('#title').waitFor({state:'visible'});assert(!await page.evaluate(()=>Board.running||Panel.isOpen()||World.isOpen));
  },'#board=cove');
});

for(const engine of ['chromium','webkit'])for(const viewport of [{width:1440,height:900},{width:846,height:784},{width:320,height:480},{width:667,height:375}]){
  test(`${engine}: map stage descriptions dismiss by tap without changing progress at ${viewport.width} × ${viewport.height}`,async()=>{
    await session(engine,viewport,async page=>{
      const node=page.locator('#wmNodes [data-node=cove]'),card=page.locator('#wmPanel[data-node=cove]');
      const activate=locator=>viewport.width<900?locator.tap():locator.click();
      await activate(node);await card.waitFor({state:'visible'});
      await activate(card.locator('[data-diff=hard]'));
      assert(await card.isVisible(),'Difficulty controls must not dismiss the description');
      assert.equal(await card.locator('[data-diff=hard]').getAttribute('aria-pressed'),'true');
      const bounds=await card.boundingBox(),header=await page.locator('#wmTop').boundingBox();
      assert(bounds.y>=header.y+header.height,'The map header must not cover the close control');
      const close=card.locator('[data-a=dismiss]'),button=await close.boundingBox();
      assert(button.width>=44&&button.height>=44);
      assert(await close.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
      const record=()=>page.evaluate(()=>({story:localStorage.getItem('cr_save'),party:localStorage.getItem('cr_party'),running:Board.running}));
      const before=await record();
      await page.screenshot({path:`/tmp/cr-stage-dismiss-${engine}-${viewport.width}-open.png`});
      await activate(card.locator('.wp-desc'));await card.waitFor({state:'hidden'});
      assert.deepEqual(await record(),before,'Dismissing text cannot move, battle, spend or change the journey');
      assert.equal(await page.locator(':focus').getAttribute('data-node'),'cove');
      await page.screenshot({path:`/tmp/cr-stage-dismiss-${engine}-${viewport.width}-hidden.png`});
      await activate(node);await card.waitFor({state:'visible'});
      await activate(card.locator('[data-a=dismiss]'));await card.waitFor({state:'hidden'});
      assert.deepEqual(await record(),before);
      await activate(node);await card.waitFor({state:'visible'});
      await activate(card.locator('.wp-info'));await card.waitFor({state:'hidden'});
      assert.deepEqual(await record(),before,'Tapping nested information must also be safe');
      await activate(node);await card.waitFor({state:'visible'});
      await activate(card.locator('[data-a=sortie]'));await ready(page);
      assert(await page.evaluate(()=>Board.running&&!World.isOpen),'Sortie must still start the battle');
    });
  });
}
