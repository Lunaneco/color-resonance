const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const chapters=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done'];
test('Postgame adds a full campaign, twelve gated requests and five distinct hard-only legends',async()=>{
  const c=vm.createContext({localStorage:{getItem:()=>null}});
  for(const name of ['progression','story','quests','restoration-content'])vm.runInContext(await fs.readFile(path.join(root,'js/'+name+'.js'),'utf8'),c);
  const data=JSON.parse(vm.runInContext('JSON.stringify({chapters:RESTORATION_CHAPTERS,requests:RESTORATION_REQUESTS,legends:LEGEND_QUESTS,stages:RESTORATION_STAGES,scripts:SCRIPT,gear:RESTORATION_GEAR})',c));
  assert.equal(data.chapters.length,8);assert.equal(data.requests.length,12);assert.equal(data.legends.length,5);assert.equal(Object.keys(data.stages).length,25);
  assert.equal(new Set(data.legends.map(q=>q.unique)).size,5);
  for(const ch of data.chapters){assert(data.scripts[ch.key].includes('@board '+ch.key));assert(data.scripts[ch.key].includes('@restore '));assert(ch.note.length>30);}
  for(const stage of Object.values(data.stages)){assert(stage.companion&&stage.postgame);assert(stage.restoreBeacons>=2);assert.equal(stage.missions.length,3);assert(stage.enemies.length>=3);}
  for(const q of data.legends){assert(q.hardOnly);assert(data.gear[q.unique].legendary);const d=vm.runInContext(`Progression.prepare(RESTORATION_STAGES.${q.id},'gentle')`,c);assert.equal(d.difficulty,'hard');assert.equal(d.recommendedLv,q.lv+3);}
  assert(data.scripts.finale.includes('リラは戻らない'));assert(data.scripts.restore4.includes('街を壊すと決めたのは僕だ'));assert(data.scripts.restore5.includes('リラがここにいることは'));assert(data.scripts.restore8.includes('機構そのものは壊さず'));assert(data.scripts.restore1.includes('僕自身の力'));assert(data.scripts.restore1.includes('みんなが倒れても消えない'));
});
test('Portable saves preserve the human companion, restoration choice, progress and independent S claims',async()=>{
  const c=vm.createContext({localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},Date,Intl}),data=new Map();
  for(const name of ['progression','save'])vm.runInContext(await fs.readFile(path.join(root,'js/'+name+'.js'),'utf8'),c);
  data.set('cr_party',JSON.stringify({aria:{lv:26,exp:15},chrome:{lv:25,exp:83},postgame:{started:true,progress:6,priority:'garden'},owned:['u_legend_tide'],stages:{lg_tide:{cleared:true,difficulties:{hard:{cleared:true,best:'S',sRewardClaimed:true}}}}}));
  data.set('cr_save',JSON.stringify({chapter:'restore7',idx:3,scene:{bg:'restoration'}}));data.set('cr_unlocked',JSON.stringify([...chapters,'restore1','restore7']));
  assert(vm.runInContext('SaveData.previewText(SaveData.exportText()).ok',c));assert(vm.runInContext('SaveData.importText(SaveData.exportText()).ok',c));
  const p=JSON.parse(data.get('cr_party'));assert.equal(p.chrome.exp,83);assert.equal(p.postgame.priority,'garden');assert.equal(p.postgame.progress,6);assert(p.stages.lg_tide.difficulties.hard.sRewardClaimed);assert.equal(JSON.parse(data.get('cr_save')).scene.bg,'restoration');
  const repaired=JSON.parse(vm.runInContext(`JSON.stringify(Progression.migrate({aria:{lv:1,exp:0},chrome:{lv:Infinity,exp:-9},postgame:{started:false,progress:99,finished:true,priority:'bad'}}))`,c));
  assert.equal(repaired.chrome.lv,1);assert.equal(repaired.postgame.progress,0);assert(!repaired.postgame.finished);assert.equal(repaired.postgame.priority,null);
});
let server,base,browsers;
const hook=`__restQA: {
 ready:()=>running&&!busy&&!paused&&!over,
 state(){return {turn,phase,mode,sp,over,used:renoirUsed,fallen:[...defeatedSpirits],cfg:{id:cfg.id,difficulty,beacons:cfg.restoreBeacons},units:units.filter(u=>!u.hidden).map(u=>({id:u.id,kind:u.kind,side:u.side,r:u.r,c:u.c,hp:u.hp,mhp:u.mhp,lv:u.lv,armor:u.armor,root:u.root,acted:u.acted,moved:u.moved,normalAttacks:u.normalAttacks,resonance:u.resonance,until:u.until,dead:u.dead,art:u.artId||u.kind,...toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5)})),cells:cells.filter(c=>c.beacon).map(c=>({r:c.r,c:c.c,on:c.beaconOn,walk:c.walk,...toScreen(topOf(c).x,topOf(c).y)}))};},
 place(kind,r,c){Object.assign(units.find(u=>u.kind===kind),{r,c});refreshHud();},
 pick(kind){select(units.find(u=>u.kind===kind&&!u.dead),true);showMenu(sel);},
 point(r,c){const p=topOf(cellAt(r,c));return toScreen(p.x,p.y);},
 set(){Math.random=()=>.5;Object.assign(ariaU(),{r:6,c:5,def:999});Object.assign(units.find(u=>u.kind==='chrome_human'),{r:5,c:5,hp:100,mhp:500,atk:70,def:999});const e=units.find(u=>u.side==='enemy');Object.assign(e,{r:4,c:5,dir:0,hp:10000,mhp:10000,def:1000,armor:3,atk:1,mov:0});refreshHud();},
 command(k,arg){command(k,arg);},
 finish(){units.filter(u=>u.side==='enemy').forEach(u=>u.dead=true);cells.filter(c=>c.beacon).forEach(c=>c.beaconOn=true);stats.purify=3;stats.back=3;win();},
 noEnemies(){units.filter(u=>u.side==='enemy').forEach(u=>u.dead=true);win();},
 fallen(){['gran','ivy','spinel','king'].forEach(id=>defeatedSpirits.add(id));refreshHud();},
 refill(){sp=6;refreshHud();},
 reachableObjectives(){const seen=flood(cellOf(ariaU()));return {goals:cells.filter(c=>c.beacon).length,reachable:cells.filter(c=>c.beacon&&seen.has(c)).length,heroes:live().filter(u=>u.side==='ally'&&seen.has(cellOf(u))).length};},
 strike(){const a=units.find(u=>u.kind==='chrome_human'),e=units.find(u=>u.side==='enemy');return strike(a,e,{normal:true,sure:true,noCrit:true});},
 next(){live().filter(u=>u.side==='ally').forEach(u=>u.acted=false);return runTask(playerPhase());},
 defeatHuman(){return runTask(defeat(units.find(u=>u.kind==='chrome_human')));},
 resetBeacons(){cells.filter(c=>c.beacon).forEach(c=>c.beaconOn=false);refreshHud();},
 lightAll(){cells.filter(c=>c.beacon).forEach(c=>c.beaconOn=true);refreshHud();}
}, `;
before(async()=>{
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browsers={chromium:await chromium.launch(),webkit:await webkit.launch()};
});
after(async()=>{for(const b of Object.values(browsers||{}))await b.close();if(server)await new Promise(r=>server.close(r));});
async function session(engine,viewport,run,{done=true,started=true,progress=0}={}){
  const ctx=await browsers[engine].newContext({viewport,hasTouch:viewport.width<900}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await ctx.addInitScript(({chapters,done,started,progress})=>{
    if(localStorage.getItem('cr_rest_test_seeded'))return;
    localStorage.setItem('cr_rest_test_seeded','1');
    localStorage.setItem('cr_unlocked',JSON.stringify(done?chapters:['prologue']));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));localStorage.setItem('cr_speed','0');
    localStorage.setItem('cr_party',JSON.stringify({aria:{lv:16,exp:0},postgame:{started,progress},chrome:{lv:16,exp:95},gold:300}));
  },{chapters,done,started,progress});
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';assert(source.includes(marker));
  await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});await run(page);assert.deepEqual(errors,[]);}finally{await ctx.close();}
}
const state=page=>page.evaluate(()=>Board.__restQA.state());
const ready=page=>page.waitForFunction(()=>Board.__restQA.ready(),null,{timeout:20000});
async function fixture(page,{shield=false,hardOnly=false}={}){
  await page.evaluate(({shield,hardOnly})=>{World.close();Board.start({...BOARDS.restore1,hardOnly,difficulty:'gentle',bossShield:shield,bossArt:shield?'achroma':null,cols:8,rows:8,map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,waterAmt:0,obsAmt:0},enemies:[{kind:shield?'boss':'lead',lv:16}],intro:null},()=>World.open());},{shield,hardOnly});await ready(page);
}
async function fits(page,selector){const b=await page.locator(selector).evaluate(e=>({sw:e.scrollWidth,w:e.clientWidth,doc:document.documentElement.scrollWidth,vw:innerWidth}));assert(b.sw<=b.w+1,JSON.stringify(b));assert(b.doc<=b.vw+1);}
for(const engine of ['chromium','webkit']){
  test(`${engine}: restoration and human portraits stay hidden before joining; old clear saves can begin`,async()=>{
    await session(engine,{width:390,height:844},async page=>{assert(await page.locator('[data-w=restoration]').isHidden());await page.locator('[data-w=party]').click();assert.equal(await page.locator('img[src*=chrome_human]').count(),0);await page.evaluate(()=>Restoration.begin('restore1'));assert.equal(await page.evaluate(()=>Engine.chapter),null);},{done:false,started:false});
    await session(engine,{width:390,height:844},async page=>{await page.locator('[data-w=restoration]').click();assert.equal(await page.locator('.re-place:not(:disabled)').count(),1);assert.equal(await page.locator('.re-duo').count(),0);await page.locator('[data-re-tab=requests]').click();assert.equal(await page.locator('.re-contract:not(:disabled)').count(),0);},{started:false});
  });
  for(const viewport of [{width:1440,height:900},{width:320,height:480},{width:667,height:375}])test(`${engine}: illustrated kingdom and legendary controls fit at ${viewport.width} × ${viewport.height}`,async()=>{
    await session(engine,viewport,async page=>{await page.locator('[data-w=restoration]').click();await fits(page,'.re-book');assert.equal(await page.locator('.re-place').count(),8);assert.equal(await page.locator('[data-re-story-diff]').count(),3);await page.locator('[data-re-story-diff=hard]').click();assert.equal(await page.evaluate(()=>Board.party.stageDifficulty.restore1),'hard');await page.screenshot({path:`/tmp/cr-restoration-${engine}-${viewport.width}-map.png`});await page.locator('[data-re-tab=legends]').click();assert.equal(await page.locator('.re-contract').count(),5);await page.locator('[data-re-stage=lg_tide]').click();assert.equal(await page.locator('[data-re-diff]').count(),1);const b=await page.locator('#reSortie').boundingBox();assert(b.height>=44&&b.y>=0&&b.y+b.height<=viewport.height+1);await fits(page,'.re-stage');await page.screenshot({path:`/tmp/cr-restoration-${engine}-${viewport.width}-legend.png`});});
  });
  test(`${engine}: a permanent human can purify objectives and enemies alone cannot finish restoration`,async()=>{
    await session(engine,{width:390,height:844},async page=>{
      await fixture(page);assert.equal((await state(page)).units.filter(u=>u.side==='ally').length,2);assert(!(await state(page)).units.find(u=>u.kind==='chrome_human').until);
      assert(await page.locator('.battle-companion').isEnabled());await page.locator('.battle-companion').click();await page.locator('#actHere').click();assert((await page.locator('.cm-head').textContent()).includes('クロム'));assert.equal(await page.locator('[data-k=summon]').count(),0);
      await page.evaluate(()=>Board.__restQA.noEnemies());assert(!(await state(page)).over);
      const beacons=(await state(page)).cells;
      for(const [i,c] of beacons.entries()){
        const kind=i?'aria':'chrome_human';await page.evaluate(({kind,c})=>{Board.__restQA.place(kind,c.r,c.c);Board.__restQA.pick(kind);},{kind,c});
        await page.locator('[data-k=purify]').click();await page.mouse.click(c.x,c.y);
        if(i===beacons.length-1)await page.locator('#resNext').waitFor({timeout:15000});else await ready(page);
        assert((await state(page)).cells[i].on);
      }
      assert((await state(page)).over);await page.locator('#resNext').click();
      await fixture(page);
      await page.evaluate(()=>Board.__restQA.set());await page.evaluate(()=>Board.__restQA.pick('chrome_human'));assert(await page.locator('[data-k=purify]').isEnabled());
      await page.locator('[data-k=purify]').click();const point=await page.evaluate(()=>Board.__restQA.point(5,5));await page.mouse.click(point.x,point.y);await ready(page);
      assert((await state(page)).units.find(u=>u.kind==='chrome_human').acted);assert.equal(await page.evaluate(()=>Board.party.chrome.lv),17);assert.equal(await page.evaluate(()=>Board.party.spirits.chrome_human),undefined);
      await page.evaluate(()=>Board.__restQA.defeatHuman());await page.locator('#resRetry').waitFor({timeout:10000});await page.locator('#resRetry').click();await ready(page);assert.equal((await state(page)).units.filter(u=>u.side==='ally'&&!u.dead).length,2);
    });
  });
  test(`${engine}: Renoir owns the fourfold power regardless of fallen spirits and can use it once per battle`,async()=>{
    await session(engine,{width:390,height:844},async page=>{
      await fixture(page);await page.evaluate(()=>Board.__restQA.set());await page.evaluate(()=>Board.__restQA.pick('chrome_human'));
      const prior=await state(page);assert.equal(await page.locator('[data-k=summon]').count(),0);await page.locator('[data-k=renoir]').click();await ready(page);let s=await state(page);assert(s.used);assert.equal(s.sp,prior.sp-6);assert.equal(s.units.find(u=>u.kind==='chrome_human').resonance.turns,3);assert(!s.units.find(u=>u.kind==='chrome_human').acted);assert(await page.locator('[data-k=renoir]').isDisabled());
      await page.evaluate(()=>{Board.__restQA.refill();Board.__restQA.pick('aria');Board.__restQA.command('spirit');});assert(await page.locator('[data-k=summon]:not(:disabled)').count()>0,'Aria may still summon using her own power');
      await page.evaluate(()=>Board.__restQA.pick('chrome_human'));await page.locator('[data-k=attack]').click();const enemy=(await state(page)).units.find(u=>u.side==='enemy');await page.mouse.click(enemy.x,enemy.y);await ready(page);s=await state(page);
      const ch=s.units.find(u=>u.kind==='chrome_human'),foe=s.units.find(u=>u.side==='enemy');assert.equal(ch.normalAttacks,1);assert(!ch.acted);assert.equal(foe.armor,0);assert.equal(foe.root,1);assert(ch.hp>100);assert(foe.r!==4||foe.c!==5,'teal effect must push the target');assert.equal(await page.locator('[data-k=pray]').count(),0,'follow-up offers only attack or wait');
      await page.evaluate(()=>{Board.__restQA.command('renoir');});assert.equal((await state(page)).sp,s.sp);
      for(let i=0;i<3;i++){await page.evaluate(()=>Board.__restQA.next());await ready(page);}assert.equal((await state(page)).units.find(u=>u.kind==='chrome_human').resonance,null);
      await page.evaluate(()=>Board.__restQA.pick('chrome_human'));assert(await page.locator('[data-k=renoir]').isDisabled());
      await page.evaluate(()=>Board.__restQA.defeatHuman());await page.locator('#resRetry').waitFor();await page.locator('#resRetry').click();await ready(page);assert(!(await state(page)).used,'retry restores the one use');
      await fixture(page);assert(!(await state(page)).used);await page.evaluate(()=>{Board.__restQA.fallen();Board.__restQA.pick('chrome_human');});assert(await page.locator('[data-k=renoir]').isEnabled());await page.locator('[data-k=renoir]').click();await ready(page);assert((await state(page)).used);assert((await state(page)).units.find(u=>u.kind==='chrome_human').resonance);assert((await state(page)).fallen.includes('gran'));
    });
  });
  test(`${engine}: the true boss shield and legend reward obey objectives and persist after returning`,async()=>{
    await session(engine,{width:320,height:480},async page=>{
      await fixture(page,{shield:true});await page.evaluate(()=>Board.__restQA.set());const before=(await state(page)).units.find(u=>u.side==='enemy').hp;assert((await page.evaluate(()=>Board.__restQA.strike())).pass);assert.equal((await state(page)).units.find(u=>u.side==='enemy').hp,before);await page.evaluate(()=>Board.__restQA.lightAll());assert(!(await page.evaluate(()=>Board.__restQA.strike())).pass);assert((await state(page)).units.find(u=>u.side==='enemy').hp<before);
      await page.evaluate(()=>{Board.stop();World.open();Restoration.stage('lg_tide','legends');});await page.locator('#reSortie').click();await ready(page);assert.equal((await state(page)).cfg.difficulty,'hard');assert.equal((await state(page)).cfg.beacons,3);
      await page.evaluate(()=>Board.__restQA.finish());await page.locator('#resNext').waitFor({timeout:15000});assert(await page.evaluate(()=>Board.party.owned.includes('u_legend_tide')));await page.locator('#resNext').click();await page.locator('.re-book').waitFor();assert(await page.evaluate(()=>Board.party.stages.lg_tide.difficulties.hard.sRewardClaimed));await page.locator('[data-re-stage=lg_tide]').click();assert((await page.locator('.re-reward').textContent()).includes('受取済み'));
      const portable=await page.evaluate(()=>SaveData.exportText());assert(await page.evaluate(t=>SaveData.importText(t).ok,portable));assert(await page.evaluate(()=>Board.reloadParty().owned.includes('u_legend_tide')));
    });
  });
}

async function advanceUntil(page,predicate){
  for(let i=0;i<160;i++){
    if(await page.evaluate(predicate))return;
    if(await page.locator('#choiceBox:not(.hidden)').count())await page.locator('#choiceBox button').nth(1).click();
    else if(await page.locator('#textbox:not(.hidden),#centerText.show').count()) {await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');}
    await page.waitForTimeout(75);
  }
  const info=await page.evaluate(()=>({chapter:Engine.chapter,save:Engine.load(),world:World.isOpen,board:Board.running,party:Board.party.postgame,panel:Panel.isOpen(),text:document.getElementById('text')?.textContent,choice:document.getElementById('choiceBox')?.className,focused:document.activeElement?.id||document.activeElement?.tagName}));
  assert.fail('Story failed to reach its next map checkpoint: '+JSON.stringify(info));
}
test('The actual eight story battles advance restoration, keep the chosen repair and return from the new ending',async()=>{
  await session('chromium',{width:390,height:844},async page=>{
    for(let n=1;n<=8;n++){
      await page.evaluate(n=>{Panel.close();const key='restore'+n;const lines=SCRIPT[key].split('\n').map(l=>l.trim()).filter(Boolean);Engine.play(key,lines.indexOf('@board '+(n===4?'gp_cocoon':key)));},n);
      if(n===4){for(const id of ['gp_cocoon','mr_cocoon']){await ready(page);assert.equal((await state(page)).cfg.id,id);await page.evaluate(()=>Board.__restQA.finish());await page.locator('#resNext').waitFor();await page.locator('#resNext').click();await advanceUntil(page,()=>Board.running);}assert(await page.evaluate(()=>MariReturn.joined()));}
      await ready(page);assert.equal((await state(page)).units.filter(u=>u.side==='ally').length,2);await page.evaluate(()=>Board.__restQA.finish());await page.locator('#resNext').waitFor({timeout:15000});await page.locator('#resNext').click();
      await advanceUntil(page,()=>World.isOpen&&document.querySelector('.re-book'));
      assert.equal(await page.evaluate(()=>Board.party.postgame.progress),n);assert(await page.evaluate(n=>Engine.unlocked().includes(n<8?'restore'+(n+1):'restored'),n));
      if(n>=5)assert.equal(await page.evaluate(()=>Board.party.postgame.priority),'garden');
    }
    await page.locator('[data-re-story=restored]').first().click();await advanceUntil(page,()=>World.isOpen&&Board.party.postgame.finished);
    assert.equal(await page.evaluate(()=>Engine.load().chapter),'restored');assert(await page.evaluate(()=>Engine.load().map));assert(await page.evaluate(()=>SaveData.previewText(SaveData.exportText()).ok));
    await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('[data-w=restoration]').click();assert((await page.locator('.re-progress').textContent()).includes('100%'));assert.equal(await page.locator('.re-place.restored').count(),8);
  });
});
test('The real opening joins Chrome willingly and equips the human art without rewriting the old ending',async()=>{
  await session('webkit',{width:390,height:844},async page=>{
    await page.locator('[data-w=restoration]').click();await page.locator('[data-re-story-diff=hard]').click();await page.locator('.re-next [data-re-story=restore1]').click();
    await advanceUntil(page,()=>Board.running);await ready(page);assert.equal((await state(page)).cfg.difficulty,'hard');assert(await page.evaluate(()=>Restoration.joined()));assert.equal((await state(page)).units.find(u=>u.kind==='chrome_human').art,'chrome_human');assert(await page.evaluate(()=>GameArt.available('chrome_human')));
    await page.screenshot({path:'/tmp/cr-restoration-opening-battle.png'});
  },{started:false});
});
test('Every restoration and legend battlefield has all reachable lights and both humans, across two map seeds',async()=>{
  await session('chromium',{width:1440,height:900},async page=>{
    for(const seed of [12345,90512])for(const id of await page.evaluate(()=>Object.keys(RESTORATION_STAGES))){
      await page.evaluate(({id,seed})=>{let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223|0)>>>0)/4294967296;World.close();Panel.close();Board.start({...RESTORATION_STAGES[id],intro:null},()=>World.open());},{id,seed});
      await ready(page);const s=await page.evaluate(()=>Board.__restQA.reachableObjectives());const count=await page.evaluate(id=>RESTORATION_STAGES[id].restoreBeacons,id);assert.equal(s.goals,count,id);assert.equal(s.reachable,count,id);assert.equal(s.heroes,2,id);
    }
  },{progress:8});
});
