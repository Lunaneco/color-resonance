const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browser,context,page,errors;

// 終章のクロム戦：絶望 → ルノワールの救援 → 夜が戻る → 白い膜を切り分ける本戦
const hook=`__t: {
  state(){const ch=units.find(u=>u.kind==='chrome');return {running,turn,busy,over,paused,stage,sp,skyCharges,awakened,rescueTurn,pool:spiritPool(),
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,hp:u.hp,mhp:u.mhp,r:u.r,c:u.c,dead:!!u.dead,hidden:!!u.hidden,gp:u.guardianPhase,...toScreen(unitXY(u).x,unitXY(u).y),bodyY:toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5).y})),
    floors:cells.reduce((m,c)=>{m[c.floor]=(m[c.floor]||0)+1;return m},{}),
    danger:ch&&ch.intent?[...ch.intent.ids]:[],cols};},
  patch(f){f({units,cells})}
},
`;

before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch();
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[],'The final battle must have no runtime errors or failed requests');});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});

const base_store={cr_unlocked:['prologue','act1','act2','act3','fury','act4','act5','finale'],cr_speed:'0',cr_settings:{reduceMotion:true,textSize:'normal'},cr_party:{aria:{lv:16,exp:0},gold:100}};
async function open({hash='#board=chrome',save}={}){
  errors=[];
  context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(({store,save})=>{if(localStorage.cr_finale_seed)return;localStorage.cr_finale_seed='1';for(const [k,v] of Object.entries(store))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));if(save)localStorage.setItem('cr_save',JSON.stringify(save));},{store:base_store,save});
  page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';
  assert(source.includes(marker));
  await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.goto(base+hash,{waitUntil:'networkidle'});
  await page.locator('#gate').click();
}
const S=()=>page.evaluate(()=>Board.__t.state());
const idle=()=>page.waitForFunction(()=>{const s=Board.__t.state();return s.running&&!s.busy&&!s.paused;},{},{timeout:30000});
const aria=s=>s.units.find(u=>u.kind==='aria');
const chrome=s=>s.units.find(u=>u.kind==='chrome');
const membranes=s=>s.units.filter(u=>u.kind==='membrane'&&!u.dead&&!u.hidden);
async function endTurn(){const turn=(await S()).turn;await page.locator('#endTurn').click();await page.waitForFunction(t=>{const s=Board.__t.state();return s.over||s.turn>t&&!s.busy&&!s.paused;},turn,{timeout:40000});}
// 予告の床に立たせ、HPを指定する
async function standInDanger(hp){
  const s=await S();assert(s.danger.length>0,'the despair wave is forecast');
  await page.evaluate(({id,hp})=>Board.__t.patch(({units,cells})=>{const a=units.find(u=>u.kind==='aria'),c=cells[id];a.r=c.r;a.c=c.c;a.hp=hp;}),{id:s.danger.filter(i=>{const r=Math.floor(i/s.cols),c=i%s.cols;return !s.units.some(u=>!u.dead&&!u.hidden&&u.r===r&&u.c===c);}).sort((a,b)=>Math.hypot(Math.floor(a/s.cols)-4.5,a%s.cols-4.5)-Math.hypot(Math.floor(b/s.cols)-4.5,b%s.cols-4.5))[0],hp});
}
async function attackChrome(){
  await page.evaluate(()=>{Math.random=()=>.5;}); // 外れ・会心で揺れない
  await page.evaluate(()=>Board.__t.patch(({units})=>{const a=units.find(u=>u.kind==='aria'),c=units.find(u=>u.kind==='chrome');c.r=a.r-1>=0?a.r-1:a.r+1;c.c=a.c;a.atk=999;}));
  await page.locator('#actHere').click();await page.waitForTimeout(200);await page.locator('[data-k=attack]').click();
  const c=chrome(await S());await page.mouse.click(c.x,c.bodyY);
}
async function reachStage1(){
  await idle();await standInDanger(20);await endTurn();
  await page.waitForFunction(()=>Board.__t.state().stage===1&&!Board.__t.state().paused&&!Board.__t.state().busy,{},{timeout:40000});
}

test('The final battle opens as a real fight in despair: the whole field is white membrane, nobody can hurt Chrome, no spirits answer',async()=>{
  await open();await idle();
  const s=await S();
  assert.equal(s.stage,0);assert.deepEqual(s.pool,[]);assert.equal(s.floors.rainbow||0,0,'no night sky yet');assert(s.floors.dull>=90,'the board starts as white membrane');
  assert.equal(chrome(s).side,'enemy');assert.equal(s.units.filter(u=>u.side==='ally').length,1,'only Aria stands');
  assert(s.danger.length>40,'the despair wave covers most of the board');
  assert.equal(await page.locator('#skills .skill.spirit').count(),0);
  assert(await page.locator('#guardianHud').isVisible());assert((await page.locator('#guardianHud').textContent()).includes('？？？'));
  // 刃は届かない
  await attackChrome();await page.waitForFunction(()=>Board.__t.state().busy===false,{},{timeout:15000});
  const after=await S();assert.equal(chrome(after).hp,chrome(after).mhp);assert.equal(after.stage,0);
});

test('Despair waves never kill, and Renoir’s rescue turns the field back to night one step at a time',async()=>{
  await open();await reachStage1();
  let s=await S();
  assert(!s.over,'the wave left Aria standing');assert(aria(s).hp>1&&!aria(s).dead,'Aria is healed by Renoir’s sky');
  assert.equal(s.stage,1);assert.equal(s.awakened,1);assert.deepEqual(s.pool,['gran']);assert.equal(s.skyCharges,4);
  assert(s.floors.rainbow>10,'night sky spreads from Aria');assert.equal(s.floors.dull||0,0,'the white membrane is undone');
  assert.equal(chrome(s).hp,chrome(s).mhp,'Chrome is still untouchable');assert.equal(membranes(s).length,0,'membranes are not revealed yet');
  await page.locator('#skills .skill.spirit').first().waitFor();assert.equal(await page.locator('#skills .skill.spirit').count(),1);
  // ターンごとに精霊が一人ずつ戻る
  await page.evaluate(()=>Board.__t.patch(({units})=>{const a=units.find(u=>u.kind==='aria');a.hp=a.mhp=9999;}));
  await endTurn();s=await S();assert.equal(s.awakened,2);assert.deepEqual(s.pool,['gran','ivy']);
  await endTurn();s=await S();assert.equal(s.awakened,3);
});

test('The first cut at Chrome after the rescue passes through his black, reveals the membranes and starts the boss fight',async()=>{
  await open();await reachStage1();
  await page.evaluate(()=>Board.__t.patch(({units})=>{const a=units.find(u=>u.kind==='aria');a.hp=a.mhp=9999;}));
  await attackChrome();
  await page.waitForFunction(()=>Board.__t.state().stage===2&&!Board.__t.state().busy&&!Board.__t.state().paused,{},{timeout:30000});
  const s=await S();
  assert.equal(membranes(s).length,6);assert.equal(chrome(s).hp,chrome(s).mhp,'the first cut did not touch him');assert.equal(chrome(s).side,'enemy');
  assert.equal(s.pool.length,4,'every spirit has returned');
  const hud=await page.locator('#guardianHud').textContent();assert(hud.includes('Ⅰ')&&hud.includes('黒を塗る声'),hud);assert(!hud.includes('？？？'));
});

test('Chrome is a three-phase boss: membranes are re-laid at each phase and cutting the last layer ends the battle',async()=>{
  await open();await idle();
  await page.evaluate(()=>Board.enterPhase1());
  await page.waitForFunction(()=>Board.__t.state().stage===2&&!Board.__t.state().busy&&!Board.__t.state().paused,{},{timeout:30000});
  await page.evaluate(()=>Board.__t.patch(({units})=>{const a=units.find(u=>u.kind==='aria');a.hp=a.mhp=9999;units.filter(u=>u.kind==='membrane').slice(0,3).forEach(m=>{m.dead=true;});}));
  await attackChrome();
  await page.waitForFunction(()=>Board.__t.state().units.find(u=>u.kind==='chrome').gp===1,{},{timeout:30000});
  let s=await S();
  assert.equal(chrome(s).hp,Math.ceil(chrome(s).mhp*2/3),'damage stops at the phase boundary');
  assert.equal(membranes(s).length,6,'membranes are re-laid when the second voice starts');
  assert((await page.locator('#hintText').textContent()).includes('リラ'),'the second voice names Lila');
  // 最後の膜
  await page.evaluate(()=>Board.__t.patch(({units})=>{const c=units.find(u=>u.kind==='chrome');c.guardianPhase=2;c.hp=1;}));
  await page.locator('#hintClose').click().catch(()=>{});
  await page.waitForFunction(()=>{const s=Board.__t.state();return !s.busy&&!s.paused;},{},{timeout:30000});
  await endTurn();
  await attackChrome();
  await page.locator('#resNext').waitFor({timeout:20000});
  s=await S();assert(s.over);assert.equal(membranes(s).length,0,'the membranes dissolve with him');
});

test('In the story, the rescue and the cut that passes through play over the battle and hand control back',async()=>{
  await open({hash:'#world',save:{chapter:'finale',idx:0}});
  const advance=async(pred)=>{for(let i=0;i<400;i++){if(await page.evaluate(pred))return;if(await page.locator('#chapterCard:not(.hidden):not(.out)').count())await page.locator('#chapterCard').click();else if(await page.locator('#textbox:not(.hidden),#centerText.show').count()){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');}await page.waitForTimeout(60);}assert.fail('story did not advance: '+await page.evaluate(()=>document.getElementById('text').textContent));};
  await page.locator('#world').waitFor({state:'visible'});
  // 守護者の道中戦は飛ばして、クロム戦の場面から
  await page.evaluate(()=>{World.close();const s=SCRIPT.finale;SCRIPT.finale='@bg none black\n@fx none\n'+s.slice(s.indexOf('@board chrome'));Engine.play('finale');});
  await advance(()=>Board.running&&Board.__t.state().stage===0);await idle();
  assert.equal((await S()).stage,0);
  await standInDanger(20);
  await page.locator('#endTurn').click();
  // ルノワールの場面が、盤の上に重なる
  await page.waitForFunction(()=>/漆黒の波が、また/.test(document.getElementById('text').textContent)&&!document.getElementById('textbox').classList.contains('hidden'),{},{timeout:30000});
  assert((await S()).paused);
  await advance(()=>Board.__t.state().stage===1&&!Board.__t.state().paused&&!Board.__t.state().busy);
  assert(await page.locator('#textbox').evaluate(e=>e.classList.contains('hidden')),'the text box closes after the scene');
  assert.equal((await S()).awakened,1);
  await page.evaluate(()=>Board.__t.patch(({units})=>{const a=units.find(u=>u.kind==='aria');a.hp=a.mhp=9999;}));
  await attackChrome();
  await page.waitForFunction(()=>/右の掌/.test(document.getElementById('text').textContent)&&!document.getElementById('textbox').classList.contains('hidden'),{},{timeout:30000});
  await advance(()=>Board.__t.state().stage===2&&!Board.__t.state().paused&&!Board.__t.state().busy);
  assert.equal(membranes(await S()).length,6);
  // 勝つと、物語がつづく
  await page.evaluate(()=>Board.__t.patch(({units})=>{const c=units.find(u=>u.kind==='chrome');c.guardianPhase=2;c.hp=1;}));
  await page.locator('#hintClose').click().catch(()=>{});
  await endTurn();
  await attackChrome();
  await page.locator('#resNext').waitFor({timeout:20000});await page.locator('#resNext').click();
  await page.waitForFunction(()=>/白い膜が、はがれ落ちた|最後の白い膜/.test(document.getElementById('text').textContent),{},{timeout:30000});
});
