const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const party=gold=>({aria:{lv:8,exp:20},spirits:{gran:{lv:7,exp:30,bond:20}},gold,owned:['u_knot'],equip:{charm:'u_knot'},items:{i_tea:3},stages:{cove:{cleared:true,best:'S',missions:[true,true,true]}}});
async function saveContext(){
  const data=new Map();let failKey=null,removeKey=null;
  const c=vm.createContext({localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(k===failKey)throw Error('quota');data.set(k,String(v));},removeItem:k=>{if(k===removeKey)throw Error('storage unavailable');data.delete(k);}},Date,Intl});
  for(const name of ['progression','save'])vm.runInContext(await fs.readFile(path.join(root,'js/'+name+'.js'),'utf8'),c);
  vm.runInContext('globalThis.Save=SaveData',c);
  return {data,api:c.Save,fail:key=>failKey=key,failRemove:key=>removeKey=key};
}
test('Portable saves preserve items, equipment, spirit bonds, story position and display settings',async()=>{
  const a=await saveContext(),b=await saveContext();
  a.data.set('cr_party',JSON.stringify(party(321)));
  a.data.set('cr_save',JSON.stringify({chapter:'act2',idx:10,scene:{bg:'rain',preset:'night',fx:'rain:0.4',cgs:[]},colors:['teal'],shavings:1,sky:0}));
  a.data.set('cr_unlocked',JSON.stringify(['prologue','act1','act2']));a.data.set('cr_settings',JSON.stringify({reduceMotion:true,textSize:'large'}));
  const portable=a.api.exportText();assert.equal(a.api.previewText(portable).ok,true);
  assert.equal(b.api.importText(portable).ok,true);
  const saved=JSON.parse(b.data.get('cr_party'));
  assert.equal(saved.gold,321);assert.equal(saved.items.i_tea,3);assert.equal(saved.equip.charm,'u_knot');assert.equal(saved.spirits.gran.bond,20);
  assert(saved.aria.skills.includes('gran_mend'));assert.deepEqual(JSON.parse(b.data.get('cr_save')).colors,['teal']);
  assert.equal(JSON.parse(b.data.get('cr_settings')).textSize,'large');
});
test('Portable saves preserve separate skill routes and claimed rewards while converting old expert settings to hard',async()=>{
  const a=await saveContext(),b=await saveContext();const p=party(321);
  p.spirits.gran.training={enchant:20,summon:7};p.aria.skills=['gran_wave','gran_current'];
  p.stageDifficulty={cove:'expert'};p.stages.cove.difficulties={expert:{cleared:true,best:'S',clears:2,sRewardClaimed:true,missions:[true,true,true]}};
  a.data.set('cr_party',JSON.stringify(p));a.data.set('cr_diff','expert');
  assert.equal(b.api.importText(a.api.exportText()).ok,true);
  const saved=JSON.parse(b.data.get('cr_party'));
  assert.deepEqual(saved.spirits.gran.training,{enchant:20,summon:7});
  assert.deepEqual(saved.aria.skills,['gran_wave','gran_current']);
  assert(saved.stages.cove.difficulties.hard.sRewardClaimed);assert.equal(saved.stages.cove.difficulties.hard.clears,2);
  assert.equal(saved.stageDifficulty.cove,'hard');assert.equal(b.data.get('cr_diff'),'hard');
  assert.equal(b.api.previewText(b.api.exportText()).ok,true);
});
test('Portable saves preserve skill upgrades, material inventory and all one-time ingredient claims',async()=>{
  const a=await saveContext(),b=await saveContext(),p=party(123);
  p.aria.skills=['gran_wave'];p.aria.skillLevels={gran_wave:3};p.materials={m_dust:38,m_teal:19,m_core:2};
  p.stages.cove.difficulties={hard:{cleared:true,best:'S',materialMissions:[true,false,true],materialMasteryClaimed:true}};
  p.minigames={records:{lantern:{hard:{best:100,materialGrades:4,plays:1,clears:1,paid:140}}}};
  a.data.set('cr_party',JSON.stringify(p));assert(b.api.importText(a.api.exportText()).ok);
  const saved=JSON.parse(b.data.get('cr_party'));assert.equal(saved.aria.skillLevels.gran_wave,3);assert.equal(saved.materials.m_dust,38);assert.equal(saved.materials.m_teal,19);assert.equal(saved.materials.m_core,2);
  assert.deepEqual(saved.stages.cove.difficulties.hard.materialMissions,[true,false,true]);assert(saved.stages.cove.difficulties.hard.materialMasteryClaimed);assert.equal(saved.minigames.records.lantern.hard.materialGrades,4);
});
test('Invalid and unrelated save files cannot replace the current journey',async()=>{
  const s=await saveContext();s.data.set('cr_party',JSON.stringify(party(50)));
  const before=s.data.get('cr_party');
  for(const text of ['{}','invalid',JSON.stringify({format:'color-resonance',version:99,data:{}}),JSON.stringify({format:'color-resonance',version:1,data:{unrelated:'value'}}),JSON.stringify({format:'color-resonance',version:1,data:{cr_party:'{"aria":{"lv":2,"exp":0},"__proto__":{"polluted":true}}'}}),JSON.stringify({format:'color-resonance',version:1,data:{cr_save:JSON.stringify({chapter:'prologue',idx:-1})}})]){
    assert.equal(s.api.previewText(text).ok,false);assert.equal(s.api.importText(text).ok,false);assert.equal(s.data.get('cr_party'),before);
  }
});
test('Reset keeps preferences and a reversible previous-journey backup',async()=>{
  const s=await saveContext();s.data.set('cr_party',JSON.stringify(party(80)));s.data.set('cr_speed','14');
  assert.equal(s.api.clearProgress().ok,true);assert.equal(s.data.has('cr_party'),false);assert.equal(s.data.get('cr_speed'),'14');
  s.data.set('cr_party',JSON.stringify(party(12)));
  assert.equal(s.api.restoreBackup().ok,true);assert.equal(JSON.parse(s.data.get('cr_party')).gold,80);
  assert.equal(s.api.restoreBackup().ok,true);assert.equal(JSON.parse(s.data.get('cr_party')).gold,12);
});
test('A storage write failure rolls back the full imported snapshot',async()=>{
  const a=await saveContext(),b=await saveContext();
  a.data.set('cr_save',JSON.stringify({chapter:'act2',idx:20}));a.data.set('cr_party',JSON.stringify(party(200)));
  b.data.set('cr_save',JSON.stringify({chapter:'prologue',idx:5}));b.data.set('cr_party',JSON.stringify(party(10)));
  const before=[...b.data.entries()];b.fail('cr_party');assert.equal(b.api.importText(a.api.exportText()).ok,false);
  for(const [key,value]of before)assert.equal(b.data.get(key),value);
});
test('Failed imports preserve an existing backup and leave no new backup if none existed',async()=>{
  for(const hadBackup of [false,true]){
    const a=await saveContext(),b=await saveContext();a.data.set('cr_party',JSON.stringify(party(80)));
    if(hadBackup)b.data.set('cr_backup',a.api.exportText());
    const oldBackup=b.data.get('cr_backup');b.data.set('cr_party',JSON.stringify(party(12)));a.data.set('cr_party',JSON.stringify(party(300)));
    b.fail('cr_party');assert.equal(b.api.importText(a.api.exportText()).ok,false);assert.equal(JSON.parse(b.data.get('cr_party')).gold,12);assert.equal(b.data.get('cr_backup'),oldBackup);
    b.fail(null);if(hadBackup){assert.equal(b.api.restoreBackup().ok,true);assert.equal(JSON.parse(b.data.get('cr_party')).gold,80);}
  }
});
test('A failed journey reset restores both progress and the preceding backup',async()=>{
  const s=await saveContext();s.data.set('cr_party',JSON.stringify(party(80)));s.data.set('cr_backup',s.api.exportText());const backup=s.data.get('cr_backup');
  s.data.set('cr_party',JSON.stringify(party(12)));s.data.set('cr_save',JSON.stringify({chapter:'act2',idx:10}));const saved=s.data.get('cr_save');
  s.failRemove('cr_party');assert.equal(s.api.clearProgress().ok,false);assert.equal(s.data.get('cr_backup'),backup);assert.equal(s.data.get('cr_save'),saved);assert.equal(JSON.parse(s.data.get('cr_party')).gold,12);
});

let server,browser,base,context,page,errors;
before(async()=>{
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';browser=await chromium.launch({headless:true});
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[]);});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function boot(viewport={width:1440,height:900}){
  errors=[];context=await browser.newContext({viewport,hasTouch:viewport.width<900});
  await context.addInitScript(()=>localStorage.setItem('cr_speed','0'));page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));await page.goto(base,{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});
}
const finishText=()=>page.locator('#nextMark.show').waitFor();
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:480},{width:667,height:375}])test(`Lila’s event CG is readable and saved at ${viewport.width} × ${viewport.height}`,async()=>{
  await boot(viewport);await page.evaluate(()=>{const l=SCRIPT.prologue.split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));Engine.play('prologue',l.indexOf('@cg lila-wave'));});
  await finishText();await page.locator('.event-cg img').waitFor();await page.waitForFunction(()=>document.querySelector('.event-cg img')?.naturalWidth>0);await page.waitForTimeout(1500);
  assert.match(await page.locator('#text').textContent(),/三度目の波/);assert.equal(await page.locator('.speaker-art').count(),0);
  const rect=await page.locator('#textbox').boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1);
  const save=await page.evaluate(()=>Engine.load());assert(save.scene.cgs.includes('lila-wave'));assert(save.cursor.id);
  await page.screenshot({path:`/tmp/cr-release-cg-${viewport.width}x${viewport.height}.png`});
  await page.evaluate(()=>Main.toTitle());assert.equal(await page.locator('.event-cg').count(),0);
});
test('Stable story cursors resume the same sentence after commands are inserted earlier',async()=>{
  await boot();await page.evaluate(()=>{SCRIPT.prologue='@bg rain\n最初の文章。\n次の文章。';Engine.play('prologue');});await finishText();
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('text').textContent==='次の文章。');await finishText();
  const saved=await page.evaluate(()=>localStorage.getItem('cr_save'));
  await page.evaluate(saved=>{Main.toTitle();SCRIPT.prologue='@wait 0\n'+SCRIPT.prologue;localStorage.setItem('cr_save',saved);Engine.cont();},saved);
  await finishText();assert.equal(await page.locator('#text').textContent(),'次の文章。');
});
test('Auto reading pauses while a log is open and resumes after closing it',async()=>{
  await boot();await page.evaluate(()=>{SCRIPT.prologue='一\n二\n三';Engine.play('prologue');});await finishText();await page.locator('[data-act=auto]').click();await page.waitForFunction(()=>document.getElementById('text').textContent==='二');await finishText();
  await page.locator('[data-act=log]').click();await page.waitForTimeout(2100);assert.equal(await page.locator('#text').textContent(),'二');assert(await page.locator('#panel').isVisible());
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('text').textContent==='三');
});
test('Cancelled typing, CG timers and sky animation cannot alter a new story',async()=>{
  await boot();await page.evaluate(()=>{window.reviewFlashes=[];const old=FX.flash;FX.flash=(...args)=>{reviewFlashes.push(args);old(...args);};SCRIPT.prologue='@cg slash\n@cg tear\n@sky\n古い場面。';Engine.play('prologue');});
  await page.waitForFunction(()=>document.querySelectorAll('.cgItem').length===2);
  await page.evaluate(()=>{Main.toTitle();localStorage.setItem('cr_speed','32');SCRIPT.prologue='@cg lila-wave\n'+('新しい物語。'.repeat(60));Engine.play('prologue');});
  const before=await page.evaluate(()=>reviewFlashes.length);await page.waitForTimeout(3150);
  assert.equal(await page.locator('.event-cg').count(),1);assert.equal(await page.evaluate(()=>reviewFlashes.length),before);assert.equal(await page.locator('#nextMark.show').count(),0);assert.equal(await page.evaluate(()=>Renoir.state.sky),0);
});
test('Story formatting preserves line breaks and emphasis without executable markup',async()=>{
  await boot();await page.evaluate(()=>{SCRIPT.prologue='アリア「<b>大切な色</b><br>ここにある。<img src="x" onerror="window.badMarkup=true">」';Engine.play('prologue');});await finishText();
  assert.equal(await page.locator('#text b').textContent(),'大切な色');assert.equal(await page.locator('#text br').count(),1);assert.equal(await page.locator('#text img').count(),0);assert.equal(await page.evaluate(()=>window.badMarkup),undefined);
});
test('A cancelled choice branch cannot reopen itself or run its remaining commands',async()=>{
  await boot();await page.evaluate(()=>{SCRIPT.prologue='@choice kaoru1\n選んだ後。';CHOICES.kaoru1.options[1].lines=['最初の返事。','@bg rain','残っていた返事。'];Engine.play('prologue');});
  await page.locator('#choiceBox button').nth(1).click();await finishText();
  await page.evaluate(()=>{Main.toTitle();SCRIPT.prologue='@cg lila-wave\n新しい場面。';Engine.play('prologue');});await finishText();await page.waitForTimeout(250);
  assert.equal(await page.locator('#text').textContent(),'新しい場面。');assert.equal(await page.locator('#choiceBox:not(.hidden)').count(),0);
  assert.equal(await page.evaluate(()=>Engine.load().scene.bg),null);assert.equal(await page.locator('.event-cg').count(),1);
});
test('Reduced story motion avoids shaking and cancelling a scene stops its active shake',async()=>{
  await boot();await page.evaluate(()=>{document.documentElement.dataset.motion='reduced';SCRIPT.prologue='@shake\n静かな場面。';Engine.play('prologue');});await finishText();
  assert.equal(await page.evaluate(()=>document.getElementById('app').getAnimations().length),0);
  await page.evaluate(()=>{document.documentElement.dataset.motion='full';Engine.play('prologue');});await page.waitForFunction(()=>document.getElementById('app').getAnimations().length>0);
  await page.evaluate(()=>Main.toTitle());assert.equal(await page.evaluate(()=>document.getElementById('app').getAnimations().length),0);
});
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:480},{width:667,height:375}])test(`The longest actual story sentence stays readable in large type at ${viewport.width} × ${viewport.height}`,async()=>{
  await boot(viewport);await page.evaluate(()=>{const longest=Object.values(SCRIPT).flatMap(s=>s.split('\n').map(l=>l.trim())).filter(l=>l&&!/^[@#>]/.test(l)).sort((a,b)=>b.length-a.length)[0];document.documentElement.dataset.textSize='large';SCRIPT.prologue=longest;Engine.play('prologue');});await finishText();
  const b=await page.locator('#textbox').boundingBox(),text=await page.locator('#text').boundingBox();assert(b.y>=0&&b.y+b.height<=viewport.height);assert(text.y>=b.y&&text.y+text.height<=b.y+b.height);
  for(const action of ['log','auto','skip','menu']){const r=await page.locator(`[data-act=${action}]`).boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1);}
});
test('Every original story chapter reaches its next map or ending with exportable scene records',async()=>{
  await boot();await page.evaluate(()=>{
    document.documentElement.dataset.motion='reduced';window.storyRecordErrors=[];window.seenChapters=[];
    const schedule=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>schedule(fn,Math.min(ms,1),...args);
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(k==='cr_save'){try{SaveData.exportText();}catch(e){storyRecordErrors.push(e.message);}}};
    Board.start=(conf,done)=>schedule(()=>done(true),1);
    const source=Object.keys(CHOICES);window.storyPilot=setInterval(()=>{const box=document.getElementById('choiceBox');if(!box.classList.contains('hidden')){const prompt=box.querySelector('.cprompt')?.textContent,key=source.find(k=>CHOICES[k].prompt===prompt),at=key&&CHOICES[key].options.findIndex(o=>o.ok);if(at>=0)box.querySelectorAll('button')[at]?.click();}},10);
    Engine.play('prologue');
  });
  await page.locator('[data-act=auto]').click();
  for(const [key,next]of [['prologue','act1'],['act1','act2'],['act2','act3'],['act3','act4'],['act4','act5'],['act5','finale'],['finale','epilogue']]){
    if(key!=='prologue')await page.evaluate(key=>Engine.play(key),key);
    await page.waitForFunction(next=>Engine.load()?.map&&Engine.load().chapter===next,next,{timeout:15000});assert((await page.evaluate(()=>Engine.unlocked())).includes(next));
  }
  await page.evaluate(()=>Engine.play('epilogue'));await page.waitForFunction(()=>Engine.unlocked().includes('done')&&document.getElementById('title').style.display!=='none',null,{timeout:15000});
  assert.deepEqual(await page.evaluate(()=>storyRecordErrors),[]);assert.equal(await page.evaluate(()=>SaveData.previewText(SaveData.exportText()).ok),true);await page.evaluate(()=>clearInterval(storyPilot));
});
test('Confirming a new journey clears old dialogue from the in-memory log',async()=>{
  await boot();await page.evaluate(()=>{document.documentElement.dataset.motion='reduced';SCRIPT.prologue='前の旅だけの言葉。';Engine.play('prologue');});await finishText();await page.evaluate(()=>{Main.toTitle();SCRIPT.prologue='新しい旅の言葉。';});
  await page.locator('[data-m=new]').click();await page.locator('#newConfirm').click();await finishText();
  await page.evaluate(()=>{SCRIPT.prologue='新しい旅の言葉。';Engine.play('prologue');});await finishText();await page.locator('[data-act=log]').click();
  const log=await page.locator('.pn-body').textContent();assert(log.includes('新しい旅の言葉'));assert(!log.includes('前の旅だけの言葉'));
});
