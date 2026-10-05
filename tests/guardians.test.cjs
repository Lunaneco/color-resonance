const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
async function content(){const ctx=vm.createContext({localStorage:{getItem:()=>null}});for(const f of ['progression','story','quests','restoration-content','guardian-content','guardian-combat'])vm.runInContext(await fs.readFile(path.join(root,'js',f+'.js'),'utf8'),ctx);return ctx;}
test('Original Gran, Ivy, Spinel and Palette King are the actual corrupted bosses, once in their original chapters',async()=>{
 const c=await content(),data=JSON.parse(vm.runInContext('JSON.stringify({profiles:GUARDIANS,stages:GUARDIAN_STAGES,boards:BOARDS,scripts:SCRIPT})',c));
 assert.equal(data.profiles.length,14);assert.equal(Object.keys(data.stages).length,28);
 for(const [chapter,id] of [['act1','gran'],['act3','ivy'],['act4','spinel'],['act5','king']]){
  const p=data.profiles.find(p=>p.chapter===chapter),b=data.boards[id],script=data.scripts[chapter];
  assert.equal(p.id,id);assert.equal(p.art,id);assert.equal(p.bossId,id);assert.equal(b.guardian,id);assert.equal(b.bossArt,id);assert.match(b.bossName,/汚染された/);assert.equal(b.beats.length,0);
  assert.equal(script.split('\n').filter(l=>l.trim()==='@board '+id).length,1);
  assert(script.indexOf('@board '+p.pathId)<script.indexOf('@board '+id));assert(!data.boards['gb_'+id]);
 }
 for(const p of data.profiles){assert.equal(p.lines.length,3);assert.equal(p.skills.length,3);for(const lines of p.lines){assert.equal(lines.length,2);assert(lines[1][1].length>6);}const script=data.scripts[p.chapter];assert(script.includes('@board '+p.pathId));assert(script.includes('@board '+p.bossId));assert(script.indexOf('@board '+p.pathId)<script.indexOf('@board '+p.bossId));}
 assert(data.scripts.act2.indexOf('@board gb_tokinel')>data.scripts.act2.indexOf('翌朝'));assert(data.scripts.restore1.indexOf('@board gp_farol')>data.scripts.restore1.indexOf('二人で。一振りも、一緒に'));
});
test('Every HP threshold, armour phase and fourteen distinct forecasts use walkable stable map coordinates',async()=>{
 const c=await content();vm.runInContext(`
 globalThis.checks=GUARDIANS.map(p=>{const cells=Array.from({length:100},(_,id)=>({r:Math.floor(id/10),c:id%10,walk:id!==0}));const boss={r:3,c:3},heroes=[{r:6,c:5}];return {id:p.id,plans:[0,1,2].map(i=>GuardianCombat.plan(p,i,boss,heroes,cells,1)),modes:[0,1,2].map(i=>GuardianCombat.mode(p,i))};});
 globalThis.phases=[100,68,67,35,34,0].map(h=>GuardianCombat.phase(h,100));globalThis.gates=[0,1,2].map((phase)=>GuardianCombat.damage([100,67,34][phase],100,phase,9999));`,c);
 const checks=JSON.parse(vm.runInContext('JSON.stringify(checks)',c));assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(phases)',c)),[0,0,1,1,2,2]);assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(gates)',c)),[33,33,34]);
 assert.equal(new Set(checks.map(p=>JSON.stringify(p.plans))).size,14);
 for(const p of checks){for(const plan of p.plans){assert(plan.length);assert.equal(new Set(plan.map(c=>c.r+','+c.c)).size,plan.length);assert(plan.every(c=>c.r>=0&&c.r<10&&c.c>=0&&c.c<10&&(c.r||c.c)));}assert(p.modes[2].power<p.modes[0].power);assert.equal(p.modes[2].rng[1],3);}
 assert.deepEqual(checks.find(p=>p.id==='spinel').modes.map(m=>m.armor),[3,2,0]);
});
test('Boss mission limits follow local hazards, available allies and active tactical goals',async()=>{
 const c=await content();vm.runInContext((await fs.readFile(path.join(root,'js/world.js'),'utf8')).split('const World =')[0],c);
 const boards=JSON.parse(vm.runInContext('JSON.stringify([...Object.values(BOARDS),...Object.values(SIDE_QUESTS),...Object.values(RESTORATION_STAGES),...Object.values(FREE_STAGES)])',c));
 const bosses=boards.filter(b=>b.enemies.some(e=>['boss','chrome'].includes(e.kind)));
 for(const id of ['gran','chrome','restore8','lg_night','q_echo','f_void'])assert(bosses.some(b=>b.id===id),id+' is audited');
 const limits={ivy:70,spinel:75,gb_pomela:80};
 for(const b of bosses)for(const m of b.missions.filter(m=>m.type==='dullMax'))assert.equal(m.n,limits[b.id],b.id+' has a justified local pollution limit');
 for(const [id,n] of Object.entries(limits))assert(boards.find(b=>b.id===id).missions.some(m=>m.type==='dullMax'&&m.n===n));
 const gran=boards.find(b=>b.id==='gran');assert.deepEqual(gran.missions.map(m=>m.type),['turns','hp','back']);assert.equal(gran.missions[1].n,65);assert.equal(gran.unique,'u_bell');
 for(const b of boards.filter(b=>b.guardian)){
  assert.equal(b.missions.length,3);assert(!b.missions.some(m=>['guardianVoice','crit'].includes(m.type)),b.id+' requires player tactics, not automatic phases or luck');
  assert(b.missionGuide.length>20);assert(b.missions[0].n>=11&&b.missions[0].n<=14);
  const enemies=b.enemies.reduce((n,e)=>n+(e.n||1),0);
  for(const m of b.missions){if(['enchantKill','summonKill'].includes(m.type))assert(m.n<=enemies);if(m.type==='teamHP'||m.type==='purify')assert(b.postgame,'Two heroes and purification must be available');}
 }
 for(const b of boards.filter(b=>/^restore[1-8]$/.test(b.id))){assert(b.missions.some(m=>m.type==='purify'&&m.n>b.restoreBeacons),'S purification exceeds the required beacon count');}
});
test('All routes use valid illustrated rewards, original boss art and ten native transparent new sprites',async()=>{
 const c=await content(),manifest=JSON.parse(await fs.readFile(path.join(root,'assets/generated/manifest.json'),'utf8')),quality=JSON.parse(await fs.readFile(path.join(root,'assets/generated/quality-guardians.json'),'utf8'));
 const profiles=JSON.parse(vm.runInContext('JSON.stringify(GUARDIANS)',c)),rewards=JSON.parse(vm.runInContext(`JSON.stringify(Object.values(GUARDIAN_STAGES).map(b=>({id:b.id,g:Progression.rewards(b,'gentle'),n:Progression.rewards(b,'normal'),h:Progression.rewards(b,'hard'),m:Progression.battleMaterials(b,'hard')})))`,c));
 for(const p of profiles){const a=manifest.assets.find(a=>a.id===p.art);assert(a,p.art);await fs.access(path.join(root,'assets/generated',a.sheet));}
 for(const r of rewards){assert.equal(r.g.sEquipment,null);assert(r.n.sEquipment);assert(r.h.sEquipment);assert.equal(r.m.m_dust,4);assert(Object.keys(r.m).length===2);}
 assert.equal(Object.keys(quality.assets).length,10);for(const a of Object.values(quality.assets)){assert.equal(a.alphaRange[0],0);assert(a.alphaRange[1]>=250);}
});
let server,base,browsers;
const hook=`__guardianQA:{
 ready:()=>running&&!busy&&!paused&&!over,
 state(){return {turn,rotation:viewRotation,sp,over,cfg:cfg.id,difficulty,tw,stats:{...stats},history:guardianHistory,units:units.filter(u=>!u.hidden).map(u=>({id:u.id,kind:u.kind,side:u.side,name:u.name,art:u.artId||u.kind,guardian:u.guardian,phase:u.guardianPhase,hp:u.hp,mhp:u.mhp,atk:u.atk,armor:u.armor,guard:u.guard,root:u.root,r:u.r,c:u.c,dir:u.dir,dead:u.dead,moved:u.moved,acted:u.acted,intent:u.intent?[...u.intent.ids]:null,...toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5)})),cells:cells.map(c=>({r:c.r,c:c.c,floor:c.floor,walk:c.walk,...toScreen(topOf(c).x,topOf(c).y)}))};},
 arrange(rear=false){Math.random=()=>.5;Object.assign(ariaU(),{r:5,c:4,dir:0,atk:9999,def:999,hp:1000,mhp:1000});const e=live().find(u=>u.guardian);Object.assign(e,{r:4,c:4,dir:rear?0:2,hp:300,mhp:300,def:0});cells.forEach(c=>paint(c,'neutral'));guardianIntent(e);refreshHud();select(ariaU(),true);},
 strike(){const e=live().find(u=>u.guardian);strike(ariaU(),e,{sure:true,noCrit:true});refreshHud();},
 heal(){const e=live().find(u=>u.guardian);e.hp=e.mhp;guardianTransition(e);refreshHud();},
 setIntent(safe){const e=live().find(u=>u.guardian);const a=ariaU();e.intent={turn,phase:e.guardianPhase,ids:new Set([idx(a.r,a.c)])};paint(cellOf(a),safe?'rainbow':'neutral');refreshHud();},
 resolve(){return runTask(guardianResolve(live().find(u=>u.guardian)));},
 next(){return runTask(playerPhase());},
 fall(){return runTask(defeat(ariaU()));},
 finish(peak=0){units.filter(u=>u.side==='enemy').forEach(u=>u.dead=true);stats.guardianVoices=3;stats.purify=3;stats.back=3;stats.dullMax=peak/100;stats.enchantKills=3;stats.summonKills=3;cells.forEach(c=>paint(c,'rainbow'));win();},
 pollute(){cells.forEach(c=>paint(c,'dull'));refreshHud();},
 winPolluted(){units.filter(u=>u.side==='enemy').forEach(u=>u.dead=true);win();},
 pollution(value){stats.dullMax=value/100;renderMissions();return (cfg.missions||[]).map(m=>missionState(m,true));},
 reach(){const seen=flood(cellOf(ariaU()));return {foes:live().filter(u=>u.side==='enemy').length,unreachable:live().filter(u=>!seen.has(cellOf(u))).length};}
}, `;
before(async()=>{
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browsers={chromium:await chromium.launch(),webkit:await webkit.launch()};
});
after(async()=>{for(const b of Object.values(browsers||{}))await b.close();if(server)await new Promise(r=>server.close(r));});
async function session(engine,viewport,run,{unlocked=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done',...Array.from({length:8},(_,i)=>'restore'+(i+1))],started=true,progress=8}={}){
 const ctx=await browsers[engine].newContext({viewport,hasTouch:viewport.width<900}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 await ctx.addInitScript(({unlocked,started,progress})=>{if(localStorage.cr_guardian_seeded)return;localStorage.cr_guardian_seeded='1';localStorage.cr_unlocked=JSON.stringify(unlocked);localStorage.cr_settings=JSON.stringify({reduceMotion:true,textSize:'normal'});localStorage.cr_speed='0';localStorage.cr_party=JSON.stringify({aria:{lv:16,exp:0},postgame:{started,progress},chrome:{lv:16,exp:0},gold:400});},{unlocked,started,progress});
 const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';assert(source.includes(marker));await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 try{await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});try{await run(page);}catch(e){e.message+='; browser errors: '+JSON.stringify(errors);throw e;}assert.deepEqual(errors,[]);}finally{await ctx.close();}
}
const state=page=>page.evaluate(()=>Board.__guardianQA.state()),ready=page=>page.waitForFunction(()=>Board.__guardianQA.ready(),null,{timeout:20000});
async function battle(page,id,{flat=true}={}){await page.evaluate(({id,flat})=>{Panel.close();World.close();const c=BOARDS[id];Board.start({...c,...(flat?{cols:8,rows:8,map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,waterAmt:0},enemies:[{kind:'boss',lv:1}]}:{}),intro:null,tutorial:null},()=>World.open());},{id,flat});await ready(page);}
const boss=s=>s.units.find(u=>u.guardian&&!u.dead),hero=s=>s.units.find(u=>u.kind==='aria');
for(const engine of ['chromium','webkit']){
 test(`${engine}: Gran earns hard S after high pollution and old mission rewards remain claimed`,async()=>{
  await session(engine,{width:390,height:844},async page=>{
   await page.evaluate(()=>{
    const old={cleared:true,best:'A',clears:1,missions:[true,true,false],materialMissions:[true,true,false]};
    Board.party.stages.gran={...old,difficulties:{hard:{...old}}};Board.party.stageDifficulty.gran='hard';Board.party.pos='belfry';Board.saveParty();World.open();
    Object.assign(BOARDS.gran,{cols:8,rows:8,map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,waterAmt:0},enemies:[{kind:'boss',lv:1}],intro:null});
   });
   assert.match(await page.locator('#wmPanel .wp-ms').textContent(),/背後から2回/);
   assert(!/くすみ/.test(await page.locator('#wmPanel .wp-ms').textContent()));
   for(let attempt=0;attempt<2;attempt++){
    await page.locator('[data-w=guardians]').click();await page.locator('[data-gj-chapter=act1]').click();await page.locator('[data-gj-stage=gran]').click();
    assert.match(await page.locator('.gj-missions').textContent(),/背後から2回/);
    assert(!/くすみ/.test(await page.locator('.gj-missions ul').textContent()));
    await page.locator('#gjSortie').click();await ready(page);
    assert.equal((await state(page)).difficulty,'hard');
    assert.match(await page.locator('#missionBox').textContent(),/HPを65%/);
    const before=await page.evaluate(()=>({...Board.party.materials}));
    await page.evaluate(()=>{Board.__guardianQA.arrange(true);Board.__guardianQA.pollute();Board.__guardianQA.strike();Board.__guardianQA.strike();});
    const s=await state(page);assert.equal(s.stats.guardianVoices,3);assert(s.stats.dullMax>=.9);assert(s.cells.filter(c=>c.floor==='dull').length>s.cells.length*.5);
    await page.evaluate(()=>Board.__guardianQA.winPolluted());await page.locator('#resNext').waitFor();
    assert.equal(await page.locator('.r-rank').textContent(),'S');assert.equal(await page.locator('.r-ms .ng').count(),0);
    assert.equal(await page.locator('.r-unique:not(.r-equipment)').count(),attempt?0:1);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.cr_party)),record=saved.stages.gran.difficulties.hard;
    assert.equal(record.clears,attempt+2);assert.deepEqual(record.missions,[true,true,true]);assert.deepEqual(record.materialMissions,[true,true,true]);
    assert.equal(saved.owned.filter(id=>id==='u_bell').length,1);
    assert.equal(saved.materials.m_dust-before.m_dust,attempt?4:5);assert.equal(saved.materials.m_teal-before.m_teal,attempt?3:4);assert.equal(saved.materials.m_core-before.m_core,attempt?0:1);
    await page.screenshot({path:`/tmp/cr-boss-missions-${engine}-${attempt}-result.png`});
    await page.locator('#resNext').click();await page.locator('.gj-book').waitFor();await page.locator('.pn-close').click();
   }
  },{started:false,progress:0});
 });
 test(`${engine}: Ivy local pollution boundary is shown consistently and determines the earned rank`,async()=>{
  await session(engine,{width:390,height:844},async page=>{
   await page.evaluate(()=>{Board.party.stages.ivy={cleared:true};Board.party.stageDifficulty.ivy='hard';Board.party.pos='thorn';Board.saveParty();World.open();});
   assert.match(await page.locator('#wmPanel .wp-ms').textContent(),/くすみを70%未満/);assert.match(await page.locator('.wp-mission-guide').textContent(),/グラン/);
   await page.locator('[data-w=guardians]').click();await page.locator('[data-gj-chapter=act3]').click();await page.locator('[data-gj-stage=ivy]').click();
   assert.match(await page.locator('.gj-missions').textContent(),/くすみを70%未満/);assert.match(await page.locator('.gj-mission-guide').textContent(),/局所的/);
   for(const [peak,rank] of [[69,'S'],[70,'A']]){
    await battle(page,'ivy');const states=await page.evaluate(peak=>Board.__guardianQA.pollution(peak),peak);assert.equal(states[2].ok,peak<70);
    assert.match(await page.locator('#missionBox').textContent(),new RegExp('最大'+peak+'%'));
    await page.evaluate(peak=>Board.__guardianQA.finish(peak),peak);await page.locator('#resNext').waitFor();
    assert.equal(await page.locator('.r-rank').textContent(),rank);assert.equal(await page.locator('.r-ms .ng').count(),rank==='S'?0:1);
    assert.equal(await page.locator('.r-unique:not(.r-equipment)').count(),rank==='S'?1:0);
    assert.equal(await page.evaluate(()=>Board.party.stages.ivy.difficulties.hard.best),'S','A later failure preserves the earned S record');
    await page.screenshot({path:`/tmp/cr-boss-tactics-${engine}-ivy-${peak}.png`});
    await page.locator('#resNext').click();await page.locator('#world').waitFor({state:'visible'});
   }
  });
 });
 test(`${engine}: pollution visibly clears on all four original sprites while preserving every alpha pixel`,async()=>{
  await session(engine,{width:390,height:844},async page=>{for(const id of ['gran','ivy','spinel','king']){await battle(page,id);const report=await page.evaluate(id=>{
    const render=tone=>{const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d',{willReadFrequently:true});GameArt.draw(c,id,0,256,490,400,400,tone==null?{}:{tone});return c.getImageData(0,0,512,512).data;};
    const original=render(null),stages=[0,1,2].map(render);let alphaChanges=0,count=0;const sums=[0,0,0,0];
    for(let i=0;i<original.length;i+=4){if(stages.some(s=>s[i+3]!==original[i+3]))alphaChanges++;if(original[i+3]>100){count++;[original,...stages].forEach((s,n)=>sums[n]+=(s[i]+s[i+1]+s[i+2])/3);}}
    return {count,alphaChanges,brightness:sums.map(s=>s/count)};
  },id);assert(report.count>1000,id);assert.equal(report.alphaChanges,0,id);const [original,a,b,c]=report.brightness;assert(a+10<b&&b+10<c,id+' '+JSON.stringify(report));assert(Math.abs(original-c)<original*.05,id+' returns to its own colours');}});
 });
 test(`${engine}: all four original bosses draw their own identity and advance through every conversation and invasion phase`,async()=>{
  await session(engine,{width:390,height:844},async page=>{
   for(const id of ['gran','ivy','spinel','king']){
    await battle(page,id);await page.evaluate(()=>Board.__guardianQA.arrange());let s=await state(page);assert.equal(boss(s).art,id);assert.match(boss(s).name,/汚染された/);assert.equal(boss(s).phase,0);assert.equal(s.history.length,1);assert(await page.evaluate(id=>GameArt.available(id),id));
    await page.evaluate(()=>Board.__guardianQA.strike());s=await state(page);assert.equal(boss(s).hp,200);assert.equal(boss(s).phase,1);assert.equal(s.history.length,2);assert(s.cells.filter(c=>c.floor==='dull').length>0);const dull=s.cells.filter(c=>c.floor==='dull').length;
    await page.evaluate(()=>Board.__guardianQA.strike());s=await state(page);assert.equal(boss(s).hp,100);assert.equal(boss(s).phase,2);assert.equal(s.history.length,3);assert(s.cells.filter(c=>c.floor==='dull').length>dull);assert.equal(s.stats.guardianVoices,3);assert.equal(await page.locator('#guardianHud').getAttribute('data-phase'),'3');
    if(id==='spinel')assert.equal(boss(s).armor,0);await page.evaluate(()=>Board.__guardianQA.heal());assert.equal(boss(await state(page)).phase,2,'Healing cannot remove recovered reason');
    await page.locator('#guardianHud button').click();assert.equal(await page.locator('.gj-voices section').count(),3);assert.match(await page.locator('.gj-voices').textContent(),/帰ってきた理性/);await page.evaluate(()=>Panel.close());
   }
  });
 });
 test(`${engine}: an actual canvas attack advances Gran and the forecast keeps its cells through four rotations`,async()=>{
  await session(engine,{width:1440,height:900},async page=>{await battle(page,'gran');await page.evaluate(()=>Board.__guardianQA.arrange());await page.locator('#actHere').click();await page.locator('[data-k=attack]').click();const e=boss(await state(page));await page.mouse.click(e.x,e.y);await ready(page);let s=await state(page);assert.equal(boss(s).phase,1);assert.match(await page.locator('#hintText').textContent(),/あの子の/);await page.waitForTimeout(800);assert(await page.locator('#hint').isVisible(),'Recovered dialogue remains until dismissed');assert.equal((await state(page)).turn,1,'Automatic enemy turn waits for the recovered voice');const ids=boss(s).intent;for(let i=0;i<4;i++){await page.locator('#rotateRight').click();s=await state(page);assert.deepEqual(boss(s).intent,ids);}assert.equal(s.rotation,0);await page.locator('#hintText').click();assert(!(await page.locator('#hint').evaluate(e=>e.classList.contains('show'))));await page.waitForFunction(()=>Board.__guardianQA.state().turn===2&&Board.__guardianQA.ready(),null,{timeout:20000});});
 });
 test(`${engine}: rainbow suppresses forecast HP, SP and root effects; neutral cells apply them and root lasts the next turn`,async()=>{
  await session(engine,{width:390,height:844},async page=>{
   for(const id of ['ivy','gb_tokinel']){await battle(page,id);await page.evaluate(()=>Board.__guardianQA.arrange());await page.evaluate(()=>Board.__guardianQA.setIntent(true));let before=await state(page);await page.evaluate(()=>Board.__guardianQA.resolve());await ready(page);let s=await state(page);assert.equal(hero(s).hp,hero(before).hp);assert.equal(s.sp,before.sp);assert.equal(hero(s).root,0);
    await page.evaluate(()=>Board.__guardianQA.setIntent(false));before=await state(page);await page.evaluate(()=>Board.__guardianQA.resolve());await ready(page);s=await state(page);assert(hero(s).hp<hero(before).hp);if(id==='gb_tokinel')assert.equal(s.sp,before.sp-1);else{assert.equal(hero(s).root,1);await page.evaluate(()=>Board.__guardianQA.next());await ready(page);assert.equal(hero(await state(page)).root,1);await page.evaluate(()=>Board.__guardianQA.next());await ready(page);assert.equal(hero(await state(page)).root,0);}}
  });
 });
 test(`${engine}: actual enemy turns execute recovered boss intents and retry restores the first phase`,async()=>{
  await session(engine,{width:390,height:844},async page=>{await battle(page,'gran');await page.evaluate(()=>Board.__guardianQA.arrange());await page.evaluate(()=>Board.__guardianQA.strike());await page.locator('#hint').click({force:true});const before=await state(page);await page.locator('#endTurn').click();await page.waitForFunction(()=>Board.__guardianQA.state().turn===2&&Board.__guardianQA.ready(),null,{timeout:20000});const after=await state(page);assert(after.cells.filter(c=>c.floor==='dull').length>before.cells.filter(c=>c.floor==='dull').length);assert.equal(boss(after).phase,1);assert(boss(after).intent.length);await page.evaluate(()=>Board.__guardianQA.fall());await page.locator('#resRetry').waitFor();await page.locator('#resRetry').click();await ready(page);const fresh=await state(page);assert.equal(boss(fresh).phase,0);assert.equal(boss(fresh).hp,boss(fresh).mhp);assert.equal(fresh.history.length,1);assert.equal(fresh.stats.guardianVoices,1);});
 });
 test(`${engine}: chapter gating, path completion, original save replay and difficulty-specific rewards survive result return`,async()=>{
  await session(engine,{width:390,height:844},async page=>{
   await page.locator('[data-w=guardians]').click();await page.locator('[data-gj-chapter=act1]').click();assert(await page.locator('[data-gj-stage=gran]').isDisabled());await page.locator('[data-gj-stage=gp_gran]').click();assert.equal(await page.locator('[data-gj-diff]').count(),3);assert.match(await page.locator('.gj-missions').textContent(),/12ターン/);await page.locator('[data-gj-diff=hard]').click();await page.locator('#gjSortie').click();await ready(page);assert.equal((await state(page)).cfg,'gp_gran');assert.equal((await state(page)).difficulty,'hard');await page.evaluate(()=>Board.__guardianQA.finish());await page.locator('#resNext').waitFor();await page.locator('#resNext').click();await page.locator('.gj-book').waitFor();assert(await page.locator('[data-gj-stage=gran]').isEnabled());
   await page.locator('[data-gj-stage=gran]').click();await page.locator('[data-gj-diff=normal]').click();await page.locator('#gjSortie').click();await ready(page);await page.evaluate(()=>Board.__guardianQA.finish());await page.locator('#resNext').waitFor();assert.equal(await page.locator('.r-unique:not(.r-equipment)').count(),0);assert(await page.evaluate(()=>Board.party.owned.includes('a_wool')));await page.locator('#resNext').click();await page.locator('#gjRecall').click();assert.equal(await page.locator('.gj-voices section').count(),4);
   await page.evaluate(()=>{Panel.close();Board.party.stages.gp_gran=undefined;Board.saveParty();GuardianJourney.open('act1');});assert(await page.locator('[data-gj-stage=gran]').isEnabled(),'Existing original boss clear permits replay');
  });
  await session(engine,{width:390,height:844},async page=>{await page.locator('[data-w=guardians]').click();assert.equal(await page.locator('[data-gj-chapter]').count(),1);assert.equal(await page.locator('img[src*=guardian_]').count(),0);assert(await page.evaluate(()=>!GuardianJourney.available(BOARDS.gb_tokinel)));},{unlocked:['prologue','act1'],started:false,progress:0});
 });
 for(const viewport of [{width:1440,height:900},{width:320,height:480},{width:390,height:844},{width:667,height:375}])test(`${engine}: original polluted boss HUD and chapter controls fit ${viewport.width} × ${viewport.height}`,async()=>{
  await session(engine,viewport,async page=>{await page.locator('[data-w=guardians]').click();await page.locator('[data-gj-chapter=act5]').click();await page.screenshot({path:`/tmp/cr-guardians-${engine}-${viewport.width}-book.png`});assert(await page.locator('.gj-guardian img').getAttribute('src').then(s=>s.includes('/king')));assert(await page.locator('[data-gj-stage=king]').isDisabled());await page.locator('[data-gj-stage=gp_king]').click();const sortie=await page.locator('#gjSortie').boundingBox();assert(sortie.height>=44&&sortie.y+sortie.height<=viewport.height+1);await battle(page,'king',{flat:false});await page.locator('#hint').click({force:true});const b=await page.locator('#guardianHud').boundingBox(),voice=await page.locator('#guardianHud button').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1);assert(voice.height>=44);assert((await state(page)).tw>=17,'Tactical tiles remain selectable');const doc=await page.evaluate(()=>document.documentElement.scrollWidth);assert(doc<=viewport.width);await page.screenshot({path:`/tmp/cr-guardians-${engine}-${viewport.width}-king.png`});});
 });
}
test('All 24 new battlefields and four original bosses generate connected reachable maps with both postgame heroes',async()=>{
 await session('chromium',{width:1440,height:900},async page=>{
  const ids=await page.evaluate(()=>Object.keys(GUARDIAN_STAGES));for(const id of ids){await battle(page,id,{flat:false});const reachable=await page.evaluate(()=>Board.__guardianQA.reach());assert.equal(reachable.unreachable,0,id);assert(reachable.foes>=3);if(id.includes('farol')||id.includes('aster'))assert.equal((await state(page)).units.filter(u=>u.side==='ally').length,2);}
 });
});

test('Legacy numeric story positions resume the original boss instead of replaying an inserted path',async()=>{
 await session('chromium',{width:390,height:844},async page=>{for(const [chapter,id] of [['act1','gran'],['act3','ivy'],['act4','spinel'],['act5','king']]){
  await page.evaluate(({chapter,id})=>{Board.stop();World.close();Panel.close();const old=GUARDIAN_LEGACY_SCRIPTS[chapter].split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));localStorage.cr_save=JSON.stringify({chapter,idx:old.indexOf('@board '+id),scriptVersion:2,colors:CHAPTER_STATE[chapter].colors,scene:{bg:'stars',preset:'night',cgs:[]}});Engine.cont();},{chapter,id});await ready(page);assert.equal((await state(page)).cfg,id);
 }});
});
