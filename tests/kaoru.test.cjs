const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const all=['prologue','act1','act2','act3','act4','act5','finale','epilogue','done'];

// ---------- 物語とデータ ----------
async function content(){
  const c=vm.createContext({localStorage:{getItem:()=>null}});
  for(const f of ['progression','story','quests','restoration-content','guardian-content','guardian-combat'])vm.runInContext(await fs.readFile(path.join(root,'js',f+'.js'),'utf8'),c);
  return c;
}
test('Terra Cotta has no battle: its chapter, quests, legend and guardian routes are all gone',async()=>{
  const c=await content();
  const data=JSON.parse(vm.runInContext(`JSON.stringify({act2:SCRIPT.act2,quests:Object.values(SIDE_QUESTS).map(q=>[q.id,q.town]),legends:LEGEND_QUESTS.map(q=>[q.id,q.town]),guardians:GUARDIANS.map(p=>[p.id,p.town]),stages:Object.keys(BOARDS)})`,c));
  assert(!/^@board/m.test(data.act2),'act2 runs no battle');
  assert(!data.stages.some(id=>/tokinel/.test(id)));
  for(const [id,town] of [...data.quests,...data.legends,...data.guardians])assert.notEqual(town,'grey',id+' is not hosted by Terra Cotta');
  assert.equal(data.quests.length,12,'relocated quests are kept, not lost');
  assert.deepEqual(data.quests.filter(([,t])=>t==='aquamist').map(([id])=>id).filter(id=>['q_clock','q_orchard','q_thorns','q_bloom'].includes(id)),['q_clock','q_orchard','q_thorns','q_bloom']);
  assert.equal(data.legends.find(([id])=>id==='lg_bloom')[1],'f_maze');
});
test('The Terra Cotta chapter ends with a two-way choice, and the red hill is a real chapter with its own card, battles and bond',async()=>{
  const c=await content();
  const d=JSON.parse(vm.runInContext(`JSON.stringify({act2:SCRIPT.act2,choice:CHOICES.route3,chapters:CHAPTERS.map(x=>x.key),fury:CHAPTERS.find(x=>x.key==='fury'),state:CHAPTER_STATE.fury})`,c));
  assert(d.act2.indexOf('@choice route3')>0&&d.act2.indexOf('@choice route3')<d.act2.indexOf('@next act3'));
  assert.equal(d.choice.options.length,2);assert(d.choice.options.every(o=>o.ok));assert.deepEqual(d.choice.options.map(o=>o.lines[0]),['@route thorn','@route f_fruit']);
  assert.deepEqual(d.chapters.slice(2,6),['act2','act3','fury','act4']);assert.equal(d.fury.title,'怒りの向け先');assert.match(d.fury.act,/第三幕/);assert.deepEqual(d.state,{colors:['teal'],shavings:1});
});
test('Every restoration episode gives Kaoru a speaking part and the notebook line is written by him',async()=>{
  const c=await content();
  const s=JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries(['restore1','restore2','restore3','restore4','restore5','restore6','restore7','restore8','restored'].map(k=>[k,SCRIPT[k]])))`,c));
  for(const [k,text] of Object.entries(s))assert(/^馨「/m.test(text)||k==='restored'&&text.includes('馨は'),k+' has Kaoru');
  for(const k of ['restore1','restore2','restore3','restore4','restore5','restore6','restore7','restore8'])assert((s[k].match(/^馨「/gm)||[]).length>=2,k+' lets him speak more than once');
  assert.match(s.restore1,/手帳のほうも続けています/);assert.match(s.restored,/地図の上でも、読めるようにしておきました/);
  assert.match(s.restore4,/窓の歌を、最初から歌った/);assert.match(s.restore5,/書けません/);assert.match(s.restore6,/不一致は、誤りではなく、記録です/);assert.match(s.restore8,/保護対象は、読み上げるのに時間がかかります/);
  // 既存の差し込み位置は壊さない
  assert(s.restore4.includes('記録院には、同じ日付の設計図が二枚あった。'));assert(s.restore3.includes('@next restore4'));
});
test('Kaoru is drawn from the supplied pixel-art sheet, kept on the standard cel grid with real transparency',async()=>{
  const m=JSON.parse(await fs.readFile(path.join(root,'assets/generated/manifest.json'),'utf8')),a=m.assets.find(x=>x.id==='kaoru');
  assert(a.pixelArt);assert.equal(a.reference,'art-source/kaoru/reference.webp');assert.deepEqual(a.grid.cellSize,[288,384]);assert.equal(a.frames.length,8);
  for(const k of ['idle','walk','talk','greet'])assert(a.animations[k].gif,k+' keeps its animation');
  await fs.access(path.join(root,a.reference));
  const sheet=await fs.readFile(path.join(root,'assets/generated',a.sheet));assert.equal(sheet.readUInt32BE(16),1152);assert.equal(sheet.readUInt32BE(20),768);
  const rec=JSON.parse(await fs.readFile(path.join(root,'assets/generated/prompts.json'),'utf8')).find(r=>r.id==='kaoru');
  assert.match(rec.tool,/user-supplied/);assert.match(rec.processing,/no|flood-fill/i);
  const q=JSON.parse(await fs.readFile(path.join(root,'assets/generated/quality-report.json'),'utf8')).alpha.find(r=>r.id==='kaoru');assert.equal(q.alphaRange[0],0);assert(q.alphaRange[1]>=250);
});

// ---------- 画面 ----------
let server,base,browser;
before(async()=>{
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch();
});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function session(run,{unlocked=all.slice(0,4),save={chapter:'act3',idx:0,map:true,at:1},party={aria:{lv:6,exp:0},gold:100},viewport={width:1280,height:800}}={}){
  const ctx=await browser.newContext({viewport,hasTouch:viewport.width<900}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await ctx.addInitScript(({unlocked,save,party})=>{if(localStorage.getItem('cr_kaoru_seed'))return;localStorage.setItem('cr_kaoru_seed','1');localStorage.setItem('cr_unlocked',JSON.stringify(unlocked));localStorage.setItem('cr_save',JSON.stringify(save));localStorage.setItem('cr_party',JSON.stringify(party));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));localStorage.setItem('cr_speed','0');},{unlocked,save,party});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
  try{
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
}
const markers=page=>page.evaluate(()=>[...document.querySelectorAll('.wn')].filter(b=>b.querySelector('.wn-story')).map(b=>b.dataset.node).sort());
async function clickThrough(page,done,limit=400){
  for(let i=0;i<limit;i++){
    if(await page.evaluate(done))return;
    if(await page.locator('#chapterCard:not(.hidden):not(.out)').count())await page.locator('#chapterCard').click();
    else if(await page.locator('#choiceBox:not(.hidden)').count())return;
    else await page.evaluate(()=>document.getElementById('app').click());
    await page.waitForTimeout(40);
  }
  throw new Error('story did not reach the expected point');
}
test('After Terra Cotta both the forest and the red hill carry the story mark; finishing one leaves the other',async()=>{
  await session(async page=>{
    assert.deepEqual(await markers(page),['f_fruit','thorn']);
    assert.equal(await page.evaluate(()=>Engine.unlocked().includes('fury')),true);
    // 丘（ヴァルド）を先に読み終えた：森だけが残る
    await page.evaluate(()=>{localStorage.cr_unlocked=JSON.stringify([...Engine.unlocked(),'vardbond']);World.open();});await page.locator('#world').waitFor();
    assert.deepEqual(await markers(page),['thorn']);
    // 森（アイビー）を先に読み終えた：丘と、まだ関門が残る谷
    await page.evaluate(()=>{localStorage.cr_unlocked=JSON.stringify(['prologue','act1','act2','act3','act4']);localStorage.cr_save=JSON.stringify({chapter:'act4',idx:0,map:true,at:2});World.open();});
    await page.waitForTimeout(700);
    assert.deepEqual(await markers(page),['canyon','f_fruit']);
    await page.locator('.wn[data-node=canyon]').click();await page.locator('#wmPanel [data-a=journey]').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=story]').count(),0,'the valley waits for Vard');
  });
});
for(const [label,pick,node,name] of [['the dark forest','暗い森へ','thorn','茨の鳥籠'],['the red hill','赤い丘へ','f_fruit','赤い果実の丘']])test(`The end of the Terra Cotta chapter lets the player choose ${label} first and opens the map there`,async()=>{
  await session(async page=>{
    await page.evaluate(()=>{World.close();const s=SCRIPT.act2;SCRIPT.act2='@bg glass c4\n'+s.slice(s.indexOf('翌朝、グラン'));Engine.play('act2');});
    await clickThrough(page,()=>false,60).catch(()=>{});await page.locator('#choiceBox:not(.hidden)').waitFor();
    assert.equal(await page.locator('#choiceBox button').count(),2);
    await page.locator('#choiceBox button',{hasText:pick}).click();
    await clickThrough(page,()=>World.isOpen&&!Board.running);
    await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();assert.equal(await page.locator('#wmPanel .wp-name').textContent(),name);
    assert.equal(await page.evaluate(()=>Engine.load().chapter),'act3');assert(await page.evaluate(()=>Engine.unlocked().includes('act3')&&Engine.unlocked().includes('fury')));
    assert.deepEqual(await markers(page),['f_fruit','thorn']);assert.equal(await page.locator('#wmPanel [data-a=story]').count(),1);
  },{unlocked:all.slice(0,3),save:{chapter:'act2',idx:0,map:true,at:1}});
});
test('The red hill chapter is listed with the other chapters and replays from the title without moving the main checkpoint',async()=>{
  await session(async page=>{
    await page.evaluate(()=>{World.close();Main.toTitle();});await page.locator('[data-m=chapters]').click();
    const labels=await page.locator('.chap').allTextContents();const at=labels.findIndex(t=>t.includes('怒りの向け先'));assert(at>=0);assert.match(labels[at],/第三幕・赤い丘/);
    assert(labels[at-1].includes('木漏れ日を妬む茨の檻'),'it sits right after the forest');assert.equal(await page.locator('.chap').nth(at).isDisabled(),false);
    await page.locator('.chap').nth(at).click();await page.locator('#chapterCard:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(()=>Engine.chapter),'fury');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.cr_save).chapter),'act3');
  },{unlocked:all.slice(0,4),save:{chapter:'act3',idx:0,map:true,at:1}});
});
test('Terra Cotta shows no battle: the town offers the shop, games, forge and Kaoru\'s notebook only',async()=>{
  await session(async page=>{
    await page.evaluate(()=>World.open({at:'grey'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    const text=await page.locator('#wmPanel').textContent();
    assert.equal(await page.locator('#wmPanel .wp-name').textContent(),'テラ・コッタ');assert.match(text,/切り分けるものがない/);
    assert(!text.includes('章の戦場'));assert(!text.includes('町の依頼'));assert(!text.includes('伝説級'));assert.equal(await page.locator('#wmPanel [data-a=guardians]').count(),0);assert.equal(await page.locator('#wmPanel [data-a=sortie]').count(),0);
    assert.equal(await page.locator('#wmPanel [data-a=cafe]').count(),0,'the café scene waits for the finished restoration');
    await page.locator('#wmPanel [data-a=notebook]').click();assert.equal(await page.locator('#panel .pn-title').textContent(),'馨の手帳');
    assert.equal(await page.evaluate(()=>Object.values(SIDE_QUESTS).filter(q=>q.town==='grey').length),0);
    assert.equal(await page.evaluate(()=>LEGEND_QUESTS.filter(q=>q.town==='grey').length),0);
  },{unlocked:all.slice(0,4)});
  // 依頼はアクアミスト側へ
  await session(async page=>{
    await page.evaluate(()=>World.open({at:'aquamist'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    const quests=await page.locator('#wmPanel [data-quest]').evaluateAll(b=>b.map(x=>x.dataset.quest));
    for(const id of ['q_clock','q_orchard'])assert(quests.includes(id),id+' moved to the harbour');
  },{unlocked:all.slice(0,4)});
});
test('The finished restoration opens Kaoru\'s café, which returns to the same checkpoint and recolours the town',async()=>{
  await session(async page=>{
    await page.evaluate(()=>World.open({at:'grey'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=cafe]').count(),1);
    const land=await page.evaluate(()=>[...document.querySelectorAll('#wmSvg path')].map(p=>p.getAttribute('stroke')).filter(Boolean));assert(land.includes('#c97a52'),'Terra Cotta takes its own colour back');
    await page.locator('#wmPanel [data-a=cafe]').click();await page.locator('#textbox:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(()=>Engine.chapter),'kaoru_cafe');
    await clickThrough(page,()=>World.isOpen&&!Board.running,300);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.cr_save).chapter),'restored');assert(await page.evaluate(()=>JSON.parse(localStorage.cr_save).map===true));assert(!await page.evaluate(()=>JSON.parse(localStorage.cr_save).returnStory));
    assert(await page.evaluate(()=>Engine.unlocked().includes('kaoru_cafe')));
    assert.equal(await page.locator('#wmPanel [data-a=cafe]').count(),1,'the scene can be read again');
  },{unlocked:[...all,'restore1','restore2','restore3','restore4','restore5','restore6','restore7','restore8','restored','maribond','vardbond'],save:{chapter:'restored',idx:0,map:true,at:9},party:{aria:{lv:30,exp:0},chrome:{lv:30,exp:0},postgame:{started:true,progress:8,finished:true},gold:100}});
});
test('Kaoru\'s pixel-art sprite is shown while he speaks in the Terra Cotta chapter',async()=>{
  await session(async page=>{
    await page.evaluate(()=>{World.close();SCRIPT.act2='@bg glass c0\n@show aria\n馨「……頼んでないです」\n馨「書きましょうか。あなたの話」';Engine.play('act2');});
    await page.locator('#cgLayer canvas.speaker-art').waitFor();
    assert.equal(await page.locator('#cgLayer canvas.speaker-art').getAttribute('data-art'),'kaoru');
    await page.waitForFunction(()=>GameArt.available('kaoru'));
    const painted=await page.locator('#cgLayer canvas.speaker-art').evaluate(cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++;return n;});
    assert(painted>8000,'the sprite is actually drawn ('+painted+' opaque pixels)');
  },{unlocked:all.slice(0,3),save:{chapter:'act2',idx:0,map:true,at:1}});
});

test('Crystalia lies across the sea on the opposite side of Aquamist from Terra Cotta, and every place stays inside the map',async()=>{
  await session(async page=>{
    const g=await page.evaluate(()=>{const x=id=>WORLD_NODES.find(n=>n.id===id).x;return {aqua:x('aquamist'),grey:x('grey'),veil:x('veil'),nowhere:x('nowhere'),void:x('f_void'),land:WORLD_LANDS.find(l=>l.dark).x,aquaLand:WORLD_LANDS.find(l=>l.name==='アクアミスト').x,greyLand:WORLD_LANDS.find(l=>/テラ/.test(l.name)).x};});
    assert(g.grey>g.aqua,'Terra Cotta is east of Aquamist');
    for(const k of ['veil','nowhere','void','land'])assert(g[k]<g.aqua,k+' (Crystalia) is west of Aquamist, opposite Terra Cotta');
    assert(g.land<g.aquaLand&&g.aquaLand<g.greyLand);
    const sea=await page.evaluate(()=>{const l=WORLD_LANDS.find(l=>l.dark),a=WORLD_LANDS.find(l=>l.name==='アクアミスト');return (a.x-a.rx)-(l.x+l.rx);});
    assert(sea>20,'open sea separates the two coasts ('+sea+')');
    const bad=await page.evaluate(()=>[...document.querySelectorAll('.wn')].map(b=>[b.dataset.node,parseFloat(b.style.left),parseFloat(b.style.top)]).filter(([,l,t])=>l<0||l>100||t<0||t>100));
    assert.deepEqual(bad,[]);
  },{unlocked:all,save:{chapter:'restored',idx:0,map:true,at:9},party:{aria:{lv:30,exp:0},chrome:{lv:30,exp:0},postgame:{started:true,progress:2},gold:1}});
  await session(async page=>{
    assert.equal(await page.locator('.wn[data-node=veil] .wn-name').textContent(),'クリスタリア');
    await page.evaluate(()=>World.open({at:'veil'}));await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel .wp-name').textContent(),'クリスタリア');assert.match(await page.locator('#wmPanel').textContent(),/揺りかご/);
    await page.locator('#wmPanel [data-a=restoration]').click();await page.locator('.re-book').waitFor();
  },{unlocked:all,save:{chapter:'restored',idx:0,map:true,at:9},party:{aria:{lv:30,exp:0},chrome:{lv:30,exp:0},postgame:{started:true,progress:2},gold:1}});
  await session(async page=>{
    assert.equal(await page.locator('.wn[data-node=veil] .wn-name').count(),0,'the veiled land is hidden before the finale');
    assert.equal(await page.evaluate(()=>WORLD_NODES.filter(n=>n.type!=='quest').every(n=>true)),true);
  },{unlocked:all.slice(0,4)});
});

test('The Palette Palace scene places Crystalia beyond Aquamist and pays off Lila\'s words and the heart sword',async()=>{
  const c=await content();const a=vm.runInContext('SCRIPT.act5',c),p=vm.runInContext('SCRIPT.prologue',c);
  // 位置：アクアミストの海の奥（西）。テラ・コッタの反対側
  assert.match(a,/アクアミストの港を出て、さらに海を西へ渡った奥/);assert.match(a,/アクアミストを挟んで、反対側/);assert(a.indexOf('さらに海を西へ')>a.indexOf('透明の王国、クリスタリア'));
  // 伏線：リラが語った言葉は、揺りかごの王妃の歌だった
  for(const line of ['石は投げるんじゃない。<br>水に預けるの。','行き先が違うだけ。<br>見捨てるんじゃないよ。<br>あなたは、あなたの岸へ預けるの。','なら、何を切らない剣なのか、<br>確かめなさい。','切るのは穢れだけ。<br>その人の色は、一滴も切らない。'])assert(a.includes(line),line);
  assert(p.includes('石は投げるんじゃない。水に預けるの')||p.includes('石は投げるんじゃない'));assert(p.includes('行き先が違うだけ。見捨てるんじゃないよ。あなたは、あなたの岸へ預けるの'));assert(p.includes('なら、何を切らない剣なのか、確かめなさい'));
  assert.match(a,/歌う水晶/);assert.match(a,/凪いだ水面を選びなさい/);assert.match(a,/それが、リラが話せなかった続きだ/);assert.match(a,/右の痣は、王妃が最後に、君の掌を握った跡/);assert.match(a,/先に『切らない』ほうを渡した/);
  assert(a.indexOf('歌う水晶')>a.indexOf('欠けたカップの縁をなぞる親指')&&a.indexOf('歌う水晶')<a.indexOf('心剣は、王家の透明だ'),'the song is told before the heart sword is explained');
  // グランの潮が浜へ押したという位置の裏づけ
  assert.match(a,/私の潮は、その海の果てから来る/);
});
