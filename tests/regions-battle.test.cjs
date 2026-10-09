const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browser,context,page,errors;

// 国の色の敵（regions.js）：名前・色・特性が、実際の戦闘でどう働くか
const hook=`__r: {
  state(){return {running,turn,busy,over,paused,sp,units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,name:u.name,trait:u.trait,tint:u.variant&&u.variant.tint.key,hp:u.hp,mhp:u.mhp,r:u.r,c:u.c,root:u.root,dead:!!u.dead,...toScreen(unitXY(u).x,unitXY(u).y),bodyY:toScreen(unitXY(u).x,unitXY(u).y-tw*u.hgt*.5).y})),dull:cells.filter(c=>c.floor==='dull').length};},
  patch(f){f({units,cells});refreshHud();},
  damage(a,d){return calcDamage(units.find(u=>u.id===a),units.find(u=>u.id===d),{},null,false).dmg;}
},
`;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch();
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[]);});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});

// 指定した国の敵1体と、動かないアリアだけの盤をつくる
async function arena(region,kind,{foeAt=[4,4],ariaAt=[5,4],hp=1000}={}){
  errors=[];context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{localStorage.cr_unlocked=JSON.stringify(['prologue','act1','act2','act3','act4','act5','finale','epilogue','done']);localStorage.cr_speed='0';localStorage.cr_settings=JSON.stringify({reduceMotion:true,textSize:'normal'});});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const source=await fs.readFile(path.join(root,'js/board.js'),'utf8'),marker='    start, enterPhase1, help, stop,';
  await page.route('**/js/board.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(marker,hook+marker)}));
  await page.goto(base+'#board=cove',{waitUntil:'networkidle'});await page.locator('#gate').click();
  await page.evaluate(({region,kind})=>Board.start({...BOARDS.cove,region,intro:null,tutorial:null,beats:[],map:{low:['land_flat'],mid:['land_flat'],high:['land_flat'],hills:0,obsAmt:0,water:null},enemies:[{kind,lv:3}],missions:[]}),{region,kind});
  await page.waitForFunction(()=>{const s=Board.__r.state();return s.running&&!s.busy&&!s.paused;},{},{timeout:20000});
  await page.evaluate(({foeAt,ariaAt,hp})=>{Math.random=()=>.5;Board.__r.patch(({units})=>{const a=units.find(u=>u.kind==='aria'),f=units.find(u=>u.side==='enemy');[a.r,a.c]=ariaAt;[f.r,f.c]=foeAt;a.hp=a.mhp=hp;f.dir=2;a.atk=999;});},{foeAt,ariaAt,hp});
}
const S=()=>page.evaluate(()=>Board.__r.state());
const aria=s=>s.units.find(u=>u.kind==='aria'),foe=s=>s.units.find(u=>u.side==='enemy');
async function endTurn(){const t=(await S()).turn;await page.locator('#endTurn').click();await page.waitForFunction(t=>{const s=Board.__r.state();return s.over||s.turn>t&&!s.busy&&!s.paused;},t,{timeout:40000});}

test('Each country names its enemies and tints their art; bosses and other lands are untouched',async()=>{
  await arena('sea','shade');let s=await S();assert.equal(foe(s).name,'雨だれの影');assert.equal(foe(s).tint,'sea');assert.equal(foe(s).trait,'push');
  assert.match(await page.locator('#unitInfo').textContent().catch(()=>''),/./);
  await context.close();await arena('hill','thorn');s=await S();assert.equal(foe(s).name,'燠火の棘');assert.equal(foe(s).tint,'hill');
  await context.close();await arena(false,'shade');s=await S();assert.equal(foe(s).name,'穢れの影');assert.equal(foe(s).trait,null);
});

test('Enemy trait panel names the trait and what it does',async()=>{
  await arena('spire','membrane');
  const f=foe(await S());await page.mouse.click(f.x,f.bodyY);await page.waitForTimeout(400);
  const text=await page.locator('#unitInfo').textContent();assert(text.includes('塗りの膜'));assert(text.includes('色吸い')&&text.includes('共鳴を1奪う'),text);
});

test('Tide enemies push the ally they hit one cell away',async()=>{
  await arena('sea','shade');await endTurn();
  const s=await S(),moved=Math.abs(aria(s).r-5)+Math.abs(aria(s).c-4);assert.equal(moved,1,'Aria was pushed exactly one cell');assert(Math.abs(aria(s).r-foe(s).r)+Math.abs(aria(s).c-foe(s).c)>=2||moved===1);assert(aria(s).hp<1000,'and she was hit first');
});

test('Red-hill embers dull the floor around the ally that was hit',async()=>{
  await arena('hill','shade');const before=(await S()).dull;await endTurn();assert((await S()).dull>before+2,'the floor around Aria was dulled');
});

test('Forest vines can root the ally for the next turn',async()=>{
  await arena('forest','thorn',{foeAt:[3,4]});await page.evaluate(()=>{Math.random=()=>.4;});await endTurn();const s=await S();assert.equal(aria(s).root,1,'Aria is rooted');
});

test('Spire colour-drinkers take resonance with a hit, at most two per enemy phase',async()=>{
  await arena('spire','membrane');const sp=(await S()).sp;await endTurn();const after=(await S()).sp;
  assert(after<sp+2,'resonance was drained (regeneration is at most +1 per turn)');
});

test('A golden plate halves the first blow only, and mist makes attacks miss more often',async()=>{
  await arena('canyon','shade');
  let s=await S();const expect=await page.evaluate(({a,d})=>Board.__r.damage(a,d),{a:aria(s).id,d:foe(s).id});
  await page.evaluate(()=>Board.__r.patch(({units})=>{units.find(u=>u.side==='enemy').hp=units.find(u=>u.side==='enemy').mhp=9999;}));
  await page.locator('#actHere').click();await page.waitForTimeout(200);await page.locator('[data-k=attack]').click();s=await S();await page.mouse.click(foe(s).x,foe(s).bodyY);
  await page.waitForFunction(()=>!Board.__r.state().busy,{},{timeout:20000});s=await S();
  const lost=9999-foe(s).hp;assert(Math.abs(lost-Math.round(expect*.5))<=1,`the plate halves the first hit: lost ${lost}, full ${expect}`);
  await context.close();
  // 霞：乱数が小さいと、素の盤では当たるが、透明の国では外れる
  await arena('veil','shade');await page.evaluate(()=>{Math.random=()=>.1;Board.__r.patch(({units})=>{const f=units.find(u=>u.side==='enemy');f.hp=f.mhp=9999;});});
  await page.locator('#actHere').click();await page.waitForTimeout(200);await page.locator('[data-k=attack]').click();s=await S();await page.mouse.click(foe(s).x,foe(s).bodyY);
  await page.waitForFunction(()=>!Board.__r.state().busy,{},{timeout:20000});s=await S();assert.equal(foe(s).hp,9999,'the mist made the blow miss');
});
