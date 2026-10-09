const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browsers;
before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browsers={chromium:await chromium.launch(),webkit:await webkit.launch()};
});
after(async()=>{for(const b of Object.values(browsers||{}))await b.close();if(server)await new Promise(r=>server.close(r));});
const all=['prologue','act1','act2','act3','fury','act4','act5','finale','epilogue','done','vardbond','maribond','restore1','restore2','restore3','restore4'];
const overlap=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
for(const engine of ['chromium','webkit'])for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768},{width:1366,height:640},{width:390,height:844},{width:820,height:1180}])
test(`${engine}: six spirits, the mission list and resonance never overlap at ${viewport.width} × ${viewport.height}`,async()=>{
  const ctx=await browsers[engine].newContext({viewport,hasTouch:viewport.width<900}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(({all})=>{localStorage.setItem('cr_unlocked',JSON.stringify(all));localStorage.setItem('cr_settings',JSON.stringify({reduceMotion:true,textSize:'normal'}));localStorage.setItem('cr_speed','0');localStorage.setItem('cr_party',JSON.stringify({aria:{lv:30,exp:0},chrome:{lv:30,exp:0},postgame:{started:true,progress:4},gold:100}));localStorage.setItem('cr_save',JSON.stringify({chapter:'restore5',idx:0,map:true,at:1}));},{all});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  try{
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#world').waitFor({state:'visible'});
    await page.evaluate(()=>{World.close();Engine.resetStage();document.getElementById('title').style.display='none';Board.start({...BOARDS.king,intro:null,tutorial:null,beats:[],spirits:['gran','ivy','spinel','king','vard','mari'],spStart:12},()=>{});});
    await page.locator('#skills .skill.spirit').nth(5).waitFor();await page.waitForTimeout(900);
    const r=await page.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom}};
      return {vw:innerWidth,vh:innerHeight,cards:[...document.querySelectorAll('#skills .skill.spirit')].map(rect),mission:rect(document.getElementById('missionBox')),resonance:rect(document.getElementById('resonance')),skills:rect(document.getElementById('skills')),count:document.querySelectorAll('#skills .skill.spirit').length,sk:document.getElementById('skills').className,screen:document.getElementById('boardScreen').className,scroll:document.getElementById('skills').scrollHeight>document.getElementById('skills').clientHeight+1};});
    assert.equal(r.count,6);
    for(const [i,c] of r.cards.entries()){
      assert(!overlap(c,r.mission),`card ${i} must not cover the mission list: ${JSON.stringify({card:c,mission:r.mission,sk:r.sk,screen:r.screen,vh:r.vh})}`);assert(!overlap(c,r.resonance),`card ${i} must not cover the resonance counter`);
      if(!r.scroll){assert(c.left>=0&&c.right<=r.vw+1&&c.top>=0&&c.bottom<=r.vh+1,`card ${i} stays on screen`);}
    }
    assert(!overlap(r.skills,r.mission),'the spirit column stays clear of the mission list');
    // 札は押せて、精霊メニューが開く
    if(!r.scroll){await page.locator('#actHere').click({timeout:3000}).catch(()=>{});}
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
