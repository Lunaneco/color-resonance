const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let browser, server, base, context, page, errors;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) { res.writeHead(404); res.end(); return; }
    try { const body = await fs.promises.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
afterEach(async () => { if (context) await context.close(); context = null; assert.deepEqual(errors || [], [], 'Skill forging must not have runtime errors or missing game files'); });
after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function boot(viewport = { width: 1100, height: 850 }, chapter = 'act2', storage = {}) {
  errors = []; context = await browser.newContext({ viewport, hasTouch: viewport.width < 900 });
  await context.addInitScript(({ chapter, storage }) => { localStorage.setItem('cr_unlocked', JSON.stringify(['prologue', 'act1', ...(chapter === 'act1' ? [] : ['act2'])])); for (const [key, value] of Object.entries(storage)) if (localStorage.getItem(key) == null) localStorage.setItem(key, JSON.stringify(value)); }, { chapter, storage });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' });
  await page.locator('#world').waitFor({ state: 'visible' }); await page.locator('[data-w="forge"]').click();
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cr_party')));
const craftParty = () => ({ aria: { lv: 8, exp: 0, skills: ['gran_wave', 'gran_spray'] }, spirits: { gran: { bond: 40, training: { enchant: 8, summon: 8 } } }, materials: { m_dust: 40, m_teal: 24, m_core: 2 } });

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:480},{width:667,height:375}]) {
  test(`The skill workshop fits ${viewport.width} × ${viewport.height} and explains locked skills and recipes`, async () => {
    await boot(viewport, 'act2', { cr_party: craftParty() });
    await page.locator('.sf-workshop').waitFor();
    await page.evaluate(async () => { await Promise.all(document.querySelector('#panel').getAnimations({subtree:true}).map(a => a.finished.catch(() => {}))); });
    assert.equal(await page.locator('[data-forge-card]').count(), 3);
    assert(await page.locator('[data-forge-card=gran_current] .sf-lock').isVisible());
    const bounds = await page.locator('.sf-workshop').evaluate(e => ({w:e.scrollWidth,c:e.clientWidth,doc:document.documentElement.scrollWidth,vw:innerWidth}));
    assert(bounds.w <= bounds.c + 1); assert(bounds.doc <= bounds.vw + 1);
    for (const button of await page.locator('.sf-spirits button,.sf-routes button').all()) assert((await button.boundingBox()).height >= 44);
    await page.locator('[data-forge-route=summon]').click(); assert(await page.locator('[data-upgrade=gran_spray]').isEnabled());
    assert.deepEqual(await page.locator('[data-forge-spirit]').evaluateAll(es => es.map(e => e.dataset.forgeSpirit)), ['gran']);
    for (const spirit of ['ivy','spinel','king']) assert.equal(await page.locator(`[data-forge-spirit=${spirit}]`).count(),0);
    await page.locator('.sf-bag summary').click(); assert.equal(await page.locator('.sf-inventory > div').count(),6);
    await page.screenshot({path:`/tmp/cr-forge-${viewport.width}x${viewport.height}.png`});
  });
}

test('Real upgrade clicks spend materials once, persist +3, and keep the other skill independent',async()=>{
  await boot(undefined, 'act2', {cr_party:craftParty()});
  await page.locator('[data-upgrade=gran_wave]').evaluate(b => { b.click(); b.click(); });
  let p=await saved();assert.equal(p.aria.skillLevels.gran_wave,1);assert.equal(p.materials.m_dust,37);assert.equal(p.materials.m_teal,22);
  for(const level of [2,3]) { await page.locator('[data-upgrade=gran_wave]').click(); assert.equal((await saved()).aria.skillLevels.gran_wave,level); }
  p=await saved();assert.equal(p.materials.m_dust,21);assert.equal(p.materials.m_teal,12);assert.equal(p.materials.m_core,1);assert(!p.aria.skillLevels.gran_spray);
  assert.equal(await page.locator('[data-upgrade=gran_wave]').count(),0);assert(await page.locator('[data-forge-card=gran_wave] .sf-max').isVisible());
  await page.reload({waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('[data-w=forge]').click();
  assert.match(await page.locator('[data-forge-card=gran_wave]').textContent(),/\+3 · MAX/);
  await page.locator('.pn-close').click();await page.locator('[data-w=party]').click();assert.match(await page.locator('.bond-skill.known').first().textContent(),/水鏡の矢 \+3/);
  await page.locator('#ptForge').click();assert(await page.locator('.sf-workshop').isVisible());
});

test('Only selected town shops sell ingredients, respecting money and material caps',async()=>{
  await boot(undefined,'act2',{cr_party:{...craftParty(),gold:1000,materials:{m_dust:998,m_teal:0,m_green:0},pos:'grey'}});
  await page.locator('.pn-close').click();await page.locator('[data-a=shop]').click();
  assert.equal(await page.locator('.sh-buy[data-id^=m_]').count(),3);
  const button=page.locator('.sh-buy[data-id=m_dust]');await button.click();assert(await button.isDisabled());assert.equal((await saved()).materials.m_dust,999);assert.equal((await saved()).gold,975);
  await page.locator('.sh-buy[data-id=m_teal]').click();assert.equal((await saved()).materials.m_teal,1);assert.equal((await saved()).gold,920);
  await page.locator('#shForge').click();assert(await page.locator('.sf-workshop').isVisible());
  await page.evaluate(()=>{Panel.close();Board.party.pos='aquamist';Board.saveParty();World.open();});await page.locator('[data-a=shop]').click();assert.equal(await page.locator('.sh-buy[data-id^=m_]').count(),0);
  await page.evaluate(()=>localStorage.setItem('cr_unlocked',JSON.stringify(['prologue','act1','act2','act3','act4','act5','finale'])));
  for(const [town,count] of [['stone',2],['rainbow',6]]) {
    await page.evaluate(town=>{Panel.close();Board.party.pos=town;Board.saveParty();World.open();},town);await page.locator('[data-a=shop]').click();assert.equal(await page.locator('.sh-buy[data-id^=m_]').count(),count);
  }
  await page.locator('.sh-buy[data-id=m_core]').click();assert.equal((await saved()).materials.m_core,1);assert.equal((await saved()).gold,620);
  await page.evaluate(()=>{Panel.close();Board.party.gold=54;Board.party.pos='grey';Board.saveParty();World.open();});await page.locator('[data-a=shop]').click();assert(await page.locator('.sh-buy[data-id=m_teal]').isDisabled());assert.equal((await saved()).gold,54);

});

test('Playing earns ingredients that can immediately upgrade a learned skill; practice and repeat ranks pay no extra',async()=>{
  await boot(undefined,'act2',{cr_party:{...craftParty(),materials:{},gold:0}});
  assert(await page.locator('[data-upgrade=gran_wave]').isDisabled());
  await page.locator('.pn-close').click();await page.locator('[data-w=games]').click();
  await page.locator('[data-game=lantern] [data-start]').click();
  const finish=async()=>{
    const presses=await page.evaluate(()=>{const s=Board.party.minigames.active,[rows,cols]=Minigames.games.lantern.sizes[s.difficulty],mask=Minigames.solve(rows,cols,s.board);return Array.from({length:rows*cols},(_,i)=>i).filter(i=>mask & 1<<i);});
    for(const i of presses)await page.locator(`[data-lamp="${i}"]`).click();await page.locator('.mg-result').waitFor();
  };
  await finish();let p=await saved();assert.equal(p.materials.m_dust,8);assert.equal(p.materials.m_teal,4);assert.equal(p.materials.m_gold,4);assert.equal(p.materials.m_core,1);assert.match(await page.locator('.r-materials').textContent(),/潮の雫晶 \+4/);
  await page.locator('[data-retry]').click();await finish();assert.deepEqual((await saved()).materials,p.materials);
  await page.locator('[data-home]').click();await page.locator('[data-game=lantern] [data-practice]').click();await page.locator('[data-lamp="1"]').click();assert.deepEqual((await saved()).materials,p.materials);
  await page.locator('.pn-close').click();await page.locator('[data-w=forge]').click();await page.locator('[data-forge-spirit=gran]').click();await page.locator('[data-forge-route=enchant]').click();await page.locator('[data-upgrade=gran_wave]').click();
  p=await saved();assert.equal(p.aria.skillLevels.gran_wave,1);assert.equal(p.materials.m_dust,5);assert.equal(p.materials.m_teal,2);
});


test('Unjoined characters stay absent from the workshop, party and letters even when growth records exist',async()=>{
  const p=craftParty();p.spirits=Object.fromEntries(['gran','ivy','spinel','king'].map(id=>[id,{lv:8,bond:40,training:{enchant:40,summon:40}}]));p.stages={gran:{cleared:true}};
  await boot({width:320,height:480},'act1',{cr_party:p});const before=await saved();
  assert.equal(await page.locator('[data-forge-spirit]').count(),0);assert.equal(await page.locator('[data-forge-card]').count(),0);assert.equal(await page.locator('.sf-art').count(),0);
  assert.match(await page.locator('.sf-skills').textContent(),/精霊が仲間になると/);
  await page.locator('.sf-bag summary').click();assert(!/グラン|アイビー|スピネル|パレット王/.test(await page.locator('.sf-workshop').textContent()));
  await page.locator('.pn-close').click();await page.locator('[data-w=party]').click();assert.equal(await page.locator('.bond-card').count(),0);assert(!/グラン|アイビー|スピネル|パレット王/.test(await page.locator('.pt').textContent()));
  await page.locator('.pn-close').click();await page.locator('[data-w=journal]').click();await page.locator('[data-journal-tab=letters]').click();assert.equal(await page.locator('.jn-spirit').count(),0);assert.equal(await page.locator('.jn-letter').count(),0);
  assert.deepEqual(await saved(),before,'Viewing hidden companions must preserve all growth and items');
});

test('All companion screens reveal only joined spirits and reset a stale workshop selection after importing earlier progress',async()=>{
  await boot(undefined,'act1',{cr_party:craftParty()});
  const stages=[['act2',['gran']],['act4',['gran','ivy']],['act5',['gran','ivy','spinel']],['finale',['gran','ivy','spinel','king']],['act2',['gran']]];
  for(const [chapter,expected] of stages){
    await page.evaluate(chapter=>{Panel.close();localStorage.setItem('cr_unlocked',JSON.stringify(['prologue','act1',chapter]));localStorage.removeItem('cr_save');World.open();},chapter);
    await page.locator('[data-w=forge]').click();assert.deepEqual(await page.locator('[data-forge-spirit]').evaluateAll(es=>es.map(e=>e.dataset.forgeSpirit)),expected);
    await page.locator(`[data-forge-spirit=${expected.at(-1)}]`).click();assert.equal(await page.locator('[data-forge-card]').count(),3);
    await page.locator('.pn-close').click();await page.locator('[data-w=party]').click();assert.equal(await page.locator('.bond-card').count(),expected.length);assert.equal(await page.locator('.bond-skill').count(),expected.length*6);
    await page.locator('.pn-close').click();await page.locator('[data-w=journal]').click();await page.locator('[data-journal-tab=letters]').click();assert.equal(await page.locator('.jn-spirit').count(),expected.length);
  }
});

test('An acquired story color reveals its spirit before the next chapter, and shop descriptions hide future names',async()=>{
  await boot(undefined,'act1',{cr_party:{...craftParty(),pos:'grey',gold:300}});
  await page.evaluate(()=>{Panel.close();localStorage.setItem('cr_save',JSON.stringify({chapter:'act1',idx:1,colors:['teal']}));});
  await page.locator('[data-w=forge]').click();assert.deepEqual(await page.locator('[data-forge-spirit]').evaluateAll(es=>es.map(e=>e.dataset.forgeSpirit)),['gran']);
  await page.locator('.pn-close').click();await page.evaluate(()=>{localStorage.setItem('cr_unlocked',JSON.stringify(['prologue','act1','act2']));World.open();});await page.locator('[data-a=shop]').click();
  const row=page.locator('.sh-row').filter({has:page.locator('[data-id=m_green]')});assert(!/アイビー/.test(await row.textContent()));assert.match(await row.textContent(),/これから覚える技/);
});
