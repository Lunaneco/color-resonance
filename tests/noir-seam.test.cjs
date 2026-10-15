const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const main=['prologue','act1','act2','act3','fury','vardbond','act4','act5','finale','epilogue','done'];
const restored=[...main,'restore1','restore2','restore3','restore4','restore5','restore6','restore7','restore8','restored','maribond'];

// ---------- 物語とデータ ----------
async function content(){
  const c=vm.createContext({localStorage:{getItem:()=>null}});
  for(const f of ['progression','story','quests','restoration-content','guardian-content','guardian-combat'])vm.runInContext(await fs.readFile(path.join(root,'js',f+'.js'),'utf8'),c);
  vm.runInContext((await fs.readFile(path.join(root,'js/world.js'),'utf8')).split('const World =')[0],c);
  for(const f of ['fury','seam'])vm.runInContext(await fs.readFile(path.join(root,'js',f+'.js'),'utf8'),c);
  return c;
}
test('Renoir is renamed Noir everywhere the player can read, while save ids stay renoir',async()=>{
  const dirs=['js','css','tests','docs'];
  for(const dir of dirs)for(const f of await fs.readdir(path.join(root,dir))){
    if(!/\.(js|css|cjs|md)$/.test(f)||['noir-seam.test.cjs','noir-and-seam.md'].includes(f))continue;
    assert(!(await fs.readFile(path.join(root,dir,f),'utf8')).includes('ルノワール'),`${dir}/${f} still says the old name`);
  }
  assert(!(await fs.readFile(path.join(root,'index.html'),'utf8')).includes('ルノワール'));
  const c=await content();
  assert.equal(vm.runInContext(`SPEAKERS['ノアール']`,c),'renoir');
  const s=JSON.parse(vm.runInContext(`JSON.stringify({prologue:SCRIPT.prologue,finale:SCRIPT.finale,rescue:FINALE_EVENTS.rescue2,epilogue:SCRIPT.epilogue})`,c));
  assert.match(s.prologue,/ノアールというんだ。みんなが汚いと言った黒だけど/);
  assert.match(s.prologue,/わからないまま、寄ってきた/,'Noa is drawn to Aria without knowing why');
  assert.match(s.finale,/ほんとの名前は、ノア。古い言葉で、運ぶもの/);
  assert.match(s.finale,/クロムだけ、汚いって、言わなかった/);
  assert.match(s.finale,/どんな色も失わずに運ぶための、方舟/);
  assert.match(s.finale,/僕が作ったんじゃないよ/,'Chrome did not create the darkness');
  assert.match(s.rescue,/色を消すための器ではなかった/);
  assert(s.finale.indexOf('ただいま')<s.finale.indexOf('アリア「……ノア」'),'Aria names Noa only after he speaks');
});
test('The Palette King ends the colour countries, gives the twin-colour sceptre and never joins',async()=>{
  const c=await content();
  const act5=vm.runInContext('SCRIPT.act5',c);
  assert.doesNotMatch(act5,/精霊にはなれない/,'the king is a person, like Chrome, not a spirit who declines');assert.match(act5,/共には行けない/);assert.match(act5,/双彩の王笏/);assert.match(act5,/@toast 宝具「双彩の王笏」/);
  assert.match(act5,/色の国々は、この尖塔で終わる/);assert.match(act5,/光の国/);
  assert.match(act5,/あの黒は、あの男が生んだものではない/);
  assert.match(act5,/馨のペンが一度だけ止まった/,'Kaoru reacts when the falling darkness is mentioned');
  const r=JSON.parse(vm.runInContext(`JSON.stringify({all:Progression.companions(['done','vardbond','maribond'],['teal','green','gold','violet']),relic:[['act5'],['finale'],['done','restore2']].map(u=>Progression.paletteRelic(u)),quests:Object.values(SIDE_QUESTS).filter(q=>q.bondNeed?.spirit==='king'||q.missions.some(m=>m.spirit==='king')).map(q=>q.id),palette:SIDE_QUESTS.q_palette.missions.map(m=>m.type),violet:Progression.materials.m_violet.spirit})`,c));
  assert.deepEqual(r.all,['gran','ivy','spinel','vard','mari']);
  assert.deepEqual(r.relic,[false,true,true]);
  assert.deepEqual(r.quests,[],'no request needs the king as a spirit');
  assert.equal(r.palette[0],'doubleSummon');
  assert.equal(r.violet,'mari');
});
test('Mari never knew Terra Cotta, and the grey town is foreshadowed as something from elsewhere',async()=>{
  const c=await content();
  assert.match(vm.runInContext('SCRIPT.act2',c),/この街の話だけは、一度も聞いたことがない/);
  assert.match(vm.runInContext('SCRIPT.epilogue',c),/細い糸が一本、ずっと伸びているような音/);
  const r4=vm.runInContext('SCRIPT.restore7',c);assert(!/灰色の街の時計師/.test(r4),'Mari did not measure the wind with a Terra Cotta clockmaker');
  assert.match(vm.runInContext('SCRIPT.seam',c),/この街だけは、知らない/);
});
test('Vard lost his wife and unborn child to a stolen fruit of life, and his anger stays his own',async()=>{
  const c=await content();
  const s=vm.runInContext('SCRIPT.fury',c),p=JSON.parse(vm.runInContext(`JSON.stringify(GUARDIANS.find(p=>p.id==='vard'))`,c));
  for(const words of [/十年に一度だけ実る/,/生命の実/,/ルベラ/,/トルカ/,/怒っていいよ。それだけ、大切だったんでしょう/,/赤い紐/,/深紅のまま、翼の先へ向かうほど、朱に、橙に、そして金に/,/おまえを許す日は来ない/])assert.match(s,words);
  assert(s.indexOf('怒っていいよ')<s.indexOf('@board f_fruit'),'Aria accepts the anger before the boss fight');
  assert(!/嵐で畑が潰れた/.test(s),'the old storm backstory is gone');
  assert.match(p.lines[0][1][1],/怒っていいよ/);
});
test('The final chapter makes Kaoru the last boss: only the poured darkness is cut, then the worlds are separated',async()=>{
  const c=await content();
  const r=JSON.parse(vm.runInContext(`JSON.stringify({s:SCRIPT.seam,b:BOARDS.seam,p:GuardianCombat.profile('kaoru'),plan:[0,1,2].map(i=>GuardianCombat.plan(GuardianCombat.profile('kaoru'),i,{r:2,c:2},[{r:7,c:6}],Array.from({length:120},(_,n)=>({r:Math.floor(n/12),c:n%12,walk:true})),1).length)})`,c));
  assert.equal(r.b.guardian,'kaoru');assert.equal(r.b.bossArt,'kaoru');assert(r.b.postgame&&r.b.companion,'Aria and Chrome fight together');assert.equal(r.b.restoreBeacons,0);assert.equal(r.b.unique,'u_sheath');
  assert.equal(r.p.hpLabel,'降り注いだ闇HP');assert.equal(r.p.lines.length,3);assert(r.plan.every(n=>n>0));
  const s=r.s;
  for(const words of [/向こう側から、こぼれ落ちた街/,/それが、十六年前の夜です/,/わたしが、生まれた夜/,/俺ごと、向こうとここを、切り離してくれ/,/混ざりこんだものだけを、通さずに分ける/,/わたしは、嫌だ/,/誰の分かは、今日、決めた/,/乾いた土の茶色/])assert.match(s,words);
  const order=['@board seam','俺ごと','@sfx sword','@sealed','@sideend'].map(w=>s.indexOf(w));
  assert(order.every((n,i)=>n>=0&&(i===0||n>order[i-1])),'the battle comes before the request, and the cut before the end: '+order);
});

// ---------- ブラウザ ----------
let browser,server,base;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true});
});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});

// テストだけで使う戦闘の窓口。公開するJavaScriptには入れない。
const hook=`__noir: {
  state(){return {running,busy,paused,phase,turn,sp,spirits:cfg&&cfg.spirits,menu:document.getElementById('cmdMenu').classList.contains('hidden')?'':document.getElementById('cmdMenu').innerText,
    units:(units||[]).map(u=>({id:u.id,kind:u.kind,side:u.side,acted:u.acted,chain:!!u.summonChain,until:u.until||0,dead:!!u.dead})),dbl:stats?missionState({type:'doubleSummon',n:1},false):null};},
  prep(){sp=30;refreshHud();select(ariaU(),true);},
  summon(id){select(ariaU(),true);command('summon',id);const t=targets&&[...targets][0];if(t==null)return false;execTarget(cells[t]);return true;},
  command(k,a){command(k,a);},
},
`;
async function battle(id,unlocked,run){
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await ctx.addInitScript(u=>{localStorage.setItem('cr_unlocked',JSON.stringify(u));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));localStorage.setItem('cr_party',JSON.stringify({aria:{lv:20,exp:0},gold:100}));},unlocked);
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker),'the battle test hook must match the public API');
  await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  try{
    await page.goto(base+'#board='+id,{waitUntil:'networkidle'});await page.locator('#gate').click();
    await page.waitForFunction(()=>{try{const s=Board.__noir&&Board.__noir.state();return s&&s.running&&!s.busy&&s.units.some(u=>u.kind==='aria');}catch{return false;}});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
}
const idle=page=>page.waitForFunction(()=>!Board.__noir.state().busy,{},{timeout:15000});
const aria=s=>s.units.find(u=>u.kind==='aria');

test('With the twin-colour sceptre Aria summons two different spirits in one turn and nothing else in between',async()=>{
  await battle('spinel',main,async page=>{
    await page.evaluate(()=>Board.__noir.prep());
    assert(await page.evaluate(()=>Board.__noir.summon('gran')));await idle(page);
    let s=await page.evaluate(()=>Board.__noir.state());
    assert.equal(aria(s).acted,false,'the first summon leaves the turn');assert.equal(aria(s).chain,true);
    assert.match(s.menu,/双彩の王笏/);assert.match(s.menu,/2体目/);assert.doesNotMatch(s.menu,/心剣|覚えた技/);
    await page.evaluate(()=>Board.__noir.command('attack'));await page.evaluate(()=>Board.__noir.command('item'));
    s=await page.evaluate(()=>Board.__noir.state());assert.equal(aria(s).acted,false);assert.equal(aria(s).chain,true,'attacks and items wait for the second summon');
    assert(await page.evaluate(()=>Board.__noir.summon('ivy')));await idle(page);
    s=await page.evaluate(()=>Board.__noir.state());
    assert.deepEqual(s.units.filter(u=>u.side==='ally'&&u.until).map(u=>u.kind).sort(),['gran','ivy']);
    assert(aria(s).acted||s.phase!=='player','the second summon ends the turn');assert.equal(aria(s).chain,false);assert.equal(s.dbl.ok,true);
  });
});
test('Before the sceptre a summon still ends the turn, and the king is never offered as a spirit',async()=>{
  await battle('spinel',['prologue','act1','act2','act3','fury','vardbond','act4','act5'],async page=>{
    await page.evaluate(()=>Board.__noir.prep());
    assert(await page.evaluate(()=>Board.__noir.summon('gran')));await idle(page);
    const s=await page.evaluate(()=>Board.__noir.state());
    assert(aria(s).acted||s.phase!=='player');assert.equal(aria(s).chain,false);assert.equal(s.dbl.ok,null);
    await page.evaluate(()=>Board.start({...BOARDS.spinel,spirits:['gran','king','ivy'],intro:null,beats:[]},()=>{}));
    await page.waitForFunction(()=>Board.__noir.state().running);
    assert.deepEqual((await page.evaluate(()=>Board.__noir.state())).spirits,['gran','ivy','vard'],'Vard joins every battle after the red hill; the king never does');
  });
});

async function session(run,unlocked){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await ctx.addInitScript(u=>{if(localStorage.getItem('cr_seam_seed'))return;localStorage.setItem('cr_seam_seed','1');localStorage.setItem('cr_unlocked',JSON.stringify(u));localStorage.setItem('cr_save',JSON.stringify({chapter:'restored',idx:0,map:true,at:9}));localStorage.setItem('cr_party',JSON.stringify({aria:{lv:34,exp:0},chrome:{lv:34,exp:0},postgame:{started:true,progress:8,finished:true},gold:100}));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));localStorage.setItem('cr_speed','0');},unlocked);
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
}
async function clickThrough(page,done,limit=1500){
  for(let i=0;i<limit;i++){
    if(await page.evaluate(done))return;
    if(await page.locator('#chapterCard:not(.hidden):not(.out)').count())await page.locator('#chapterCard').click();
    else await page.evaluate(()=>document.getElementById('app').click());
    await page.waitForTimeout(30);
  }
  throw new Error('story did not reach the expected point: '+JSON.stringify(await page.evaluate(()=>({chapter:Engine.chapter,text:document.getElementById('textbox').innerText.slice(0,80),world:World.isOpen,running:Board.running}))));
}
test('The final chapter opens at Terra Cotta after the café, returns to the same checkpoint and turns the café into a memory',async()=>{
  await session(async page=>{
    await page.evaluate(()=>World.open({at:'grey'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=seam]').count(),0,'the café comes first');
  },restored);
  await session(async page=>{
    await page.evaluate(()=>World.open({at:'grey'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=seam]').count(),1);
    // 戦闘そのものは別のテストで確かめる。ここでは物語の流れだけを見る。
    await page.evaluate(()=>{Board.start=(conf,done)=>{window.__seamConf={id:conf.id,guardian:conf.guardian,companion:conf.companion};setTimeout(()=>done(true),1);return Promise.resolve(true);};});
    await page.locator('#wmPanel [data-a=seam]').click();await page.locator('#textbox:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(()=>Engine.chapter),'seam');
    await clickThrough(page,()=>World.isOpen&&!Board.running);
    assert.deepEqual(await page.evaluate(()=>window.__seamConf),{id:'seam',guardian:'kaoru',companion:true});
    const save=await page.evaluate(()=>JSON.parse(localStorage.cr_save));assert.equal(save.chapter,'restored');assert.equal(save.map,true);assert(!save.returnStory);
    assert(await page.evaluate(()=>Engine.unlocked().includes('sealed')));
    await page.evaluate(()=>World.open({at:'grey'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.match(await page.locator('#wmPanel [data-a=seam]').textContent(),/読み返す/);
    assert.match(await page.locator('#wmPanel [data-a=cafe]').textContent(),/思い出/);
  },[...restored,'kaoru_cafe']);
});
test('Kaoru fights as a guardian boss whose HP is the darkness poured on him',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(u=>{localStorage.setItem('cr_unlocked',JSON.stringify(u));localStorage.setItem('cr_save',JSON.stringify({chapter:'restored',idx:0,map:true,at:9}));localStorage.setItem('cr_party',JSON.stringify({aria:{lv:34,exp:0},chrome:{lv:34,exp:0},postgame:{started:true,progress:8,finished:true},gold:100}));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));},[...restored,'kaoru_cafe']);
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});
    await page.evaluate(()=>{World.close();Engine.resetStage();document.getElementById('title').style.display='none';Board.start({...BOARDS.seam,intro:null},()=>{});});
    await page.locator('#guardianHud:not(.hidden)').waitFor();
    const hud=await page.locator('#guardianHud').textContent();assert.match(hud,/馨/);assert.match(hud,/降り注いだ闇HP/);
    assert.equal(await page.locator('#skills .skill.spirit').count(),5,'Gran, Ivy, Spinel, Vard and Mari — no Palette King');
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
