const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,browser,context,page,errors;

before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
  server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error();const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch();
  errors=[];context=await browser.newContext({viewport:{width:1440,height:900}});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await page.goto(base,{waitUntil:'networkidle'});
});
after(async()=>{if(context)await context.close();if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));assert.deepEqual(errors,[]);});

const all=()=>page.evaluate(()=>{
  const reg={...BOARDS,...FREE_STAGES,...SIDE_QUESTS,...RESTORATION_STAGES};
  return Object.values(reg).map(c=>({id:c.id,rec:c.recLv??c.lv,enemies:c.enemies||[],guardian:!!c.guardian,hasRegion:!!Regions.of(c),theme:c.theme,hue:c.hue}));
});

test('Every country has a name for each ordinary enemy, a trait, a tinted look and its own scenery',async()=>{
  const data=await page.evaluate(()=>({regions:Regions.REGIONS,traits:Regions.TRAITS,atmos:Regions.ATMOS}));
  assert.deepEqual(Object.keys(data.regions).sort(),['canyon','forest','hill','sea','spire','veil']);
  for(const [id,r] of Object.entries(data.regions)){
    for(const kind of ['shade','thorn','lead','membrane'])assert(r.names[kind],`${id} names ${kind}`);
    assert.equal(new Set(Object.values(r.names)).size,4,`${id} gives each enemy its own name`);
    assert(data.traits[r.trait],`${id} has a described trait`);assert(r.kinds.length>=2&&r.kinds.length<=3,`${id} trait stays on two or three enemy kinds`);
    assert(r.tint.key&&Array.isArray(r.tint.rgb),`${id} tint`);
  }
  assert.equal(new Set(Object.values(data.regions).map(r=>r.trait)).size,6,'each country plays differently');
  assert.equal(new Set(Object.values(data.regions).map(r=>r.tint.hue)).size,6,'each country has its own colour');
  for(const [id,list] of Object.entries(data.atmos))assert(new Set(list.map(a=>a.theme.bg+a.theme.preset+a.theme.fx)).size>=3,`${id} has varied scenery`);
});

test('Every battlefield with ordinary enemies belongs to a country, and neighbouring stages of one country do not look identical',async()=>{
  const stages=await all();
  for(const s of stages)assert(s.hasRegion,`${s.id} belongs to a country`);
  const byRegion={};
  for(const s of stages){const k=await page.evaluate(id=>Regions.regionOf[id],s.id);(byRegion[k]||=[]).push(s);}
  for(const [k,list] of Object.entries(byRegion)){
    const looks=new Set(list.map(s=>JSON.stringify([s.theme?.bg,s.theme?.preset,s.theme?.fx])));
    assert(looks.size>=Math.min(4,list.length),`${k} stages vary: ${looks.size}/${list.length}`);
  }
  // 復興編の8話は、それぞれ別の雰囲気
  const restore=stages.filter(s=>/^restore[1-8]$/.test(s.id));
  assert.equal(restore.length,8);assert(new Set(restore.map(s=>JSON.stringify(s.theme))).size>=6,'the eight restoration chapters look different');
});

test('Enemies in a country use its colours: names, tinted art and one trait',async()=>{
  const r=await page.evaluate(()=>{
    const v=(id,kind)=>Regions.variant(Regions.regionOf[id],kind);
    return {sea:v('f_mist','shade'),hill:v('f_fruit','thorn'),forest:v('f_maze','thorn'),canyon:v('q_gold','lead'),spire:v('q_palette','membrane'),veil:v('f_void','lead')};
  });
  assert.equal(r.sea.name,'雨だれの影');assert.equal(r.sea.trait,'push');assert.equal(r.hill.trait,'ember');assert.equal(r.forest.trait,'root');
  assert.equal(r.canyon.trait,null,'the armoured lead keeps its armour instead of a second defence');assert.equal(r.spire.trait,'drain');assert.equal(r.veil.trait,'mist');
  assert.notEqual(r.sea.tint.key,r.hill.tint.key);
});

test('Difficulty rises smoothly: story bosses climb, restoration chapters climb, and nothing is an outlier',async()=>{
  const stages=await all();
  const model=await page.evaluate(()=>{
    const GB=Board.gearBonus(null),armor={lead:.65};
    return Object.fromEntries([...Object.values({...BOARDS,...FREE_STAGES,...SIDE_QUESTS,...RESTORATION_STAGES})].filter(c=>c.enemies&&(c.recLv??c.lv)).map(c=>{
      const L=c.recLv??c.lv,a=Board.statsFor('aria',L,GB);a.atk+=L*.9;a.def+=L*.5;a.mhp+=L*3;
      const es=[];for(const e of c.enemies)for(let i=0;i<(e.n||1);i++)es.push({k:e.kind,...Board.statsFor(e.kind,e.lv||1,GB)});
      es.sort((x,y)=>x.mhp-y.mhp);let time=0,dmg=0;
      for(const e of es){const hit=Math.max(1,a.atk-e.def/2)*(armor[e.k]||1),hits=Math.ceil(e.mhp/hit);time+=hits/1.7;dmg+=Math.max(1,e.atk-a.def/2)*Math.max(0,time-1.5)*.55;}
      return [c.id,{L,ratio:dmg/a.mhp,turns:time}];
    }));
  });
  const r=id=>model[id].ratio;
  for(const [id,m] of Object.entries(model)){assert(m.ratio<2.3,`${id} is not an outlier (${m.ratio.toFixed(2)})`);assert(m.turns<16,`${id} does not drag on (${m.turns.toFixed(1)})`);}
  // 本編のボス：やさしい入口から、段々と
  assert(r('gran')<r('ivy')&&r('ivy')<r('king'),'story bosses climb');assert(r('gran')<1.3,'the first boss is welcoming');
  assert(r('king')>=1.3&&r('king')<=1.8);
  // 復興編：段階的に
  const chain=['restore1','restore2','restore3','restore4','restore5','restore6','restore7','restore8'].map(r);
  for(let i=1;i<chain.length;i++)assert(chain[i]>=chain[i-1]-.25,`restoration ${i+1} is not much easier than ${i}`);
  assert(chain[7]>chain[0]+.4,'the last chapter is clearly harder than the first');
  // 自由・サブ・伝説
  assert(r('f_stars')>r('f_fruit')&&r('f_void')>r('f_stars'),'free stages climb with their level');
  for(const id of ['lg_tide','lg_bloom','lg_gold','lg_prism','lg_night'])assert(r(id)>=r('restore8')-.15&&r(id)<=2.3,`${id} is the hardest tier`);
});
