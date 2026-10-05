const {test,before,after,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
let server,base,context,page,errors;
const browsers={};
before(async()=>{
  server=http.createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
      if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.'))throw Error('Invalid path');
      const body=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.gif':'image/gif','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
});
afterEach(async()=>{if(context)await context.close();context=null;assert.deepEqual(errors||[],[],'Inventory screens must load without runtime errors or missing files');});
after(async()=>{for(const b of Object.values(browsers))await b.close();if(server)await new Promise(r=>server.close(r));});
async function start(engine=chromium,viewport={width:1440,height:900},storage={}){
  errors=[];browsers[engine.name()]||=await engine.launch({headless:true});
  context=await browsers[engine.name()].newContext({viewport,hasTouch:viewport.width<900});
  await context.addInitScript(values=>{for(const [k,v]of Object.entries(values))if(localStorage.getItem(k)==null)localStorage.setItem(k,JSON.stringify(v));},storage);
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
}
async function decode(selector){return page.locator(selector).evaluateAll(async imgs=>{for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode()));return imgs.map(i=>[i.naturalWidth,i.naturalHeight]);});}
async function fits(selector){
  const b=await page.locator(selector).evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth,doc:document.documentElement.scrollWidth,vw:innerWidth}));
  assert(b.scroll<=b.width+1,`${selector} must not overflow horizontally: ${JSON.stringify(b)}`);assert(b.doc<=b.vw+1);
}

test('All 49 catalog assets have distinct, transparent, browser-decodable art in the published gallery',async()=>{
  const quality=JSON.parse(await fs.readFile(path.join(root,'assets/inventory/quality.json'),'utf8'));
  await start();await page.goto(base+'#world',{waitUntil:'networkidle'});
  const catalog=await page.evaluate(()=>({ids:[...Object.keys(EQUIP),...Object.keys(ITEMS),...Object.keys(Progression.materials)],art:InventoryArt.ids,unknown:InventoryArt.icon('../unknown')}));
  assert.equal(catalog.ids.length,49);assert.deepEqual([...catalog.art].sort(),catalog.ids.sort());assert.equal(catalog.unknown,'');
  assert.deepEqual(Object.keys(quality.assets).sort(),catalog.ids);
  const hashes=[];
  for(const [id,entry]of Object.entries(quality.assets)){const body=await fs.readFile(path.join(root,'assets/inventory',entry.file)),hash=crypto.createHash('sha256').update(body).digest('hex');assert.equal(hash,entry.sha256);hashes.push(hash);}
  assert.equal(new Set(hashes).size,49,'Every item must have its own generated illustration');
  await page.goto(base+'assets/inventory/index.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.card').count(),49);assert.deepEqual((await page.locator('.card').evaluateAll(cs=>cs.map(c=>c.dataset.id))).sort(),catalog.ids);
  const decoded=await decode('.card img');assert(decoded.every(([w,h])=>w===256&&h===256));
  const alpha=await page.locator('.card img').evaluateAll(imgs=>imgs.map(i=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(i,0,0);const data=x.getImageData(0,0,256,256).data;let clear=false,opaque=false;for(let n=3;n<data.length;n+=4){clear||=data[n]===0;opaque||=data[n]===255;}return clear&&opaque;}));assert(alpha.every(Boolean));
});

for(const [profile,engine,viewport]of [['desktop',chromium,{width:1440,height:900}],['small-phone',webkit,{width:320,height:480}],['landscape',chromium,{width:667,height:375}]]){
  test(`Illustrated purchases, equipment changes and material upgrades remain usable on ${profile}`,async()=>{
    await start(engine,viewport,{cr_unlocked:['prologue','act1','act2'],cr_settings:{reduceMotion:true},cr_party:{pos:'grey',gold:5000,owned:['e_glass'],equip:{blade:'e_glass'},aria:{lv:8,exp:0,skills:['gran_wave']},spirits:{gran:{bond:40,training:{enchant:8,summon:8}}},materials:{m_dust:40,m_teal:24,m_core:2},items:{i_tea:1,i_water:1,i_shard:1,i_powder:1,i_ward:1}}});
    await page.goto(base+'#world',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-a=shop]').click();
    assert((await decode('.sh-main img')).every(([w,h])=>w===256&&h===256));await fits('.shop');
    assert.equal(await page.locator('.sh-row:has([data-id=i_tea]) [data-inventory]').getAttribute('data-inventory'),'i_tea');
    await page.locator('.sh-buy[data-id=i_tea]').click();assert.equal(await page.evaluate(()=>Board.reloadParty().items.i_tea),2);assert.equal(await page.evaluate(()=>Board.party.gold),4970);
    const price=await page.evaluate(()=>EQUIP.e_tide.price);await page.locator('.sh-buy[data-id=e_tide]').click();assert(await page.locator('.sh-buy[data-id=e_tide]').isDisabled());assert.equal(await page.evaluate(()=>Board.party.gold),4970-price);
    await page.locator('.sh-buy[data-id=m_teal]').click();assert.equal(await page.evaluate(()=>Board.party.materials.m_teal),25);
    await page.locator('.sh-buy[data-id=i_tea]').scrollIntoViewIfNeeded();assert((await page.locator('.sh-buy[data-id=i_tea]').boundingBox()).height>=44);await page.screenshot({path:`/tmp/cr-inventory-${profile}-shop.png`});
    await page.locator('#shEquip').click();await page.locator('.eq-it[data-id=e_tide]').click();assert.equal(await page.evaluate(()=>Board.reloadParty().equip.blade),'e_tide');assert.equal(await page.locator('.eq-it[data-id=e_tide]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.eq-it[data-id=e_tide] [data-inventory]').getAttribute('data-inventory'),'e_tide');assert.equal(await page.locator('.eq-items [data-item]').count(),5);assert.equal(await page.locator('.eq-it.uq').count(),0,'Unowned rare gear stays absent');
    assert((await decode('.equip .inventory-art img')).every(([w,h])=>w===256&&h===256));await fits('.equip');await page.locator('.eq-it[data-id=e_tide]').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/cr-inventory-${profile}-equip.png`});
    await page.locator('.pn-close').click();await page.locator('[data-w=forge]').click();
    assert.deepEqual(await page.locator('.sf-cost [data-inventory]').evaluateAll(es=>es.map(e=>e.dataset.inventory)),['m_dust','m_teal']);await page.locator('.sf-bag summary').click();assert.equal(await page.locator('.sf-inventory [data-inventory]').count(),6);
    assert(!/アイビー|スピネル|パレット王/.test(await page.locator('.sf-inventory').textContent()),'Material art does not reveal unjoined characters');
    assert((await decode('.sf-workshop .inventory-art img')).every(([w,h])=>w===256&&h===256));await fits('.sf-workshop');await page.locator('.sf-costs').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/cr-inventory-${profile}-forge.png`});
    await page.locator('[data-upgrade=gran_wave]').click();const p=await page.evaluate(()=>Board.reloadParty());assert.equal(p.aria.skillLevels.gran_wave,1);assert.equal(p.materials.m_dust,37);assert.equal(p.materials.m_teal,23);
    await page.locator('.pn-close').click();await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});
    const restored=await page.evaluate(()=>Board.reloadParty());assert.equal(restored.equip.blade,'e_tide');assert.equal(restored.items.i_tea,2);assert.equal(restored.aria.skillLevels.gran_wave,1);
  });
}
