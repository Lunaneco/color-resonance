const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let browser, server, base;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => { try { const url = new URL(req.url, 'http://localhost'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) throw Error(); const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); });

// 自動テスト中は説明が開かない決まりなので、cr_tutorials_force で開くようにして確かめる
async function open(unlocked, seen) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(({ unlocked, seen }) => {
    if (sessionStorage.getItem('booted')) return; sessionStorage.setItem('booted', '1');
    localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true })); localStorage.setItem('cr_unlocked', JSON.stringify(unlocked));
    localStorage.setItem('cr_party', JSON.stringify({ aria: { lv: 6, exp: 0 }, noir: { joined: true, lv: 6, exp: 0, skills: [], known: {} }, gold: 0 }));
    localStorage.setItem('cr_tutorials_force', '1');
    if (seen) localStorage.setItem('cr_tutorials', JSON.stringify(seen)); else localStorage.removeItem('cr_tutorials');
  }, { unlocked, seen });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click();
  return { ctx, page, errors };
}
const fight = (page, id) => page.evaluate(id => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS[id], intro: null }, () => {}); }, id);
const hud = page => page.evaluate(() => document.getElementById('kegareCount').textContent);

test('The first camp battle opens the camp, fog and guard lessons before the first turn, once; the battle waits until they are read', async () => {
  const { ctx, page, errors } = await open(['prologue', 'act1']);
  try {
    await fight(page, 'camp_port');
    await page.locator('#panel:not(.hidden) .tut-page').waitFor();
    const topics = [];
    for (let i = 0; i < 30; i++) {
      topics.push((await page.locator('#panel .pn-title').textContent()).split('·')[1].trim());
      assert.match(await hud(page), /TURN0/, 'the first turn waits for the lesson');
      const done = page.locator('#panel [data-tut=done]');
      if (await done.count()) { await done.click(); break; }
      await page.locator('#panel [data-tut=next]').click();
    }
    assert.deepEqual([...new Set(topics)], ['陣取り戦', '霧（潜伏）', '虹の近衛', 'ノアールの吸収'], 'every new system in this battle, in order');
    assert(topics.filter(t => t === '陣取り戦').length >= 5, 'the camp lesson has several pages');
    await page.waitForFunction(() => /TURN1/.test(document.getElementById('kegareCount').textContent));
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.cr_tutorials).sort()), ['camp', 'fog', 'guard', 'noir']);
    // もう一度戦っても、説明は開かない
    await page.evaluate(() => Board.stop()); await fight(page, 'camp_port');
    await page.waitForFunction(() => /TURN1/.test(document.getElementById('kegareCount').textContent));
    assert.equal(await page.locator('#panel:not(.hidden)').count(), 0);
    // 「？」から、いつでも読み直せる。読み直しは記録を変えない
    await page.evaluate(() => Board.help());
    // 読み直しの一覧は、読んだ説明だけ。まだ出会っていない仕組みや仲間の名前は出ない
    assert.deepEqual((await page.locator('[data-tut-topic]').evaluateAll(b => b.map(x => x.dataset.tutTopic))).sort(), ['camp', 'fog', 'guard', 'noir']);
    const help = await page.locator('#panel .pn-body').textContent();
    for (const name of ['クロム', 'スピネル', 'マリー', 'グラン', 'アイビー', 'ヴァルド']) assert(!help.includes(name), `the first-act help does not name ${name}`);
    await page.locator('[data-tut-topic=fog]').click();
    assert.match(await page.locator('#panel .pn-title').textContent(), /しくみの説明 · 霧（潜伏）/);
    await page.locator('#panel [data-tut=next]').click(); await page.locator('#panel [data-tut=done]').click();
    assert.equal(await page.locator('#panel:not(.hidden)').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('A save that already went past a system is not taught it again, but still meets the new camp lessons', async () => {
  const { ctx, page, errors } = await open(['prologue', 'act1', 'act2', 'act3', 'fury', 'vardbond', 'act4', 'act5']);
  try {
    await fight(page, 'camp_town');
    await page.locator('#panel:not(.hidden) .tut-page').waitFor();
    const known = await page.evaluate(() => JSON.parse(localStorage.cr_tutorials));
    for (const id of ['spirits', 'noir', 'guardian', 'fury']) assert(known.includes(id), `${id} is already known to this save`);
    assert.match(await page.locator('#panel .pn-title').textContent(), /陣取り戦/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('Under automation the lessons never open on their own, so every other battle test starts as before', async () => {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  try {
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click();
    await fight(page, 'camp_port');
    await page.waitForFunction(() => /TURN1/.test(document.getElementById('kegareCount').textContent));
    assert.equal(await page.locator('#panel:not(.hidden)').count(), 0);
  } finally { await ctx.close(); }
});

test('A tactic lesson opens once, the first time it happens, and then never again', async () => {
  const { ctx, page, errors } = await open(['prologue', 'act1', 'act2', 'act3'], ['camp', 'fog', 'guard', 'charge', 'reinforce', 'second', 'spirits', 'noir', 'guardian', 'companion', 'beacons', 'sceptre', 'fury']);
  try {
    await fight(page, 'gp_gran');
    await page.waitForFunction(() => /TURN1/.test(document.getElementById('kegareCount').textContent));
    const first = page.evaluate(() => Tutorials.once('ambush').then(() => 'closed'));
    await page.locator('#panel:not(.hidden) .tut-page').waitFor();
    assert.match(await page.locator('#panel .pn-title').textContent(), /伏兵/);
    await page.locator('#panel [data-tut=done]').click();
    assert.equal(await first, 'closed');
    assert.equal(await page.evaluate(() => Tutorials.once('ambush').then(() => Panel.isOpen())), false, 'the second time resolves without opening');
    assert(await page.evaluate(() => JSON.parse(localStorage.cr_tutorials).includes('ambush')));
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('System lessons never name a companion; each companion is introduced once, the first battle they join', async () => {
  const c = require('node:vm').createContext({ localStorage: { getItem: () => null, setItem() {} }, navigator: {} });
  require('node:vm').runInContext(await fs.readFile(path.join(root, 'js/tutorials.js'), 'utf8') + ';globalThis.T=Tutorials;', c);
  const names = ['グラン', 'アイビー', 'スピネル', 'マリー', 'ヴァルド', 'クロム'];
  const own = { ally_gran: 'グラン', ally_ivy: 'アイビー', ally_spinel: 'スピネル', ally_mari: 'マリー', fury: 'ヴァルド', companion: 'クロム', beacons: 'クロム' };  // 復興の灯はクロムが加わった復興編だけに出る
  for (const t of c.T.LIST) {
    const text = t.title + t.pages.map(p => p.h + p.t + (p.fig || '')).join('');
    for (const n of names) if (own[t.id] !== n) assert(!text.includes(n), `${t.id} must not name ${n}`);
  }
  const { ctx, page, errors } = await open(['prologue', 'act1', 'act2', 'act3'], ['spirits', 'noir', 'guardian', 'fury']);
  try {
    await fight(page, 'gp_ivy');
    await page.locator('#panel:not(.hidden) .tut-page').waitFor();
    const titles = [];
    for (let i = 0; i < 10; i++) { titles.push(await page.locator('#panel .pn-title').textContent()); const done = page.locator('#panel [data-tut=done]'); if (await done.count()) { await done.click(); break; } await page.locator('#panel [data-tut=next]').click(); }
    assert(titles.some(t => /新しい仲間 · グラン/.test(t)), 'Gran is introduced when she joins the battle');
    assert(!titles.some(t => /スピネル|マリー/.test(t)), 'companions who have not joined are not introduced');
    await page.waitForFunction(() => /TURN1/.test(document.getElementById('kegareCount').textContent));
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
