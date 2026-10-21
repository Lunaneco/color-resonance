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
    assert(await page.locator('[data-tut-topic]').count() >= 8);
    await page.locator('[data-tut-topic=guardian]').click();
    assert.match(await page.locator('#panel .pn-title').textContent(), /しくみの説明 · 守り手との戦い/);
    await page.locator('#panel [data-tut=next]').click(); await page.locator('#panel [data-tut=done]').click();
    assert.equal(await page.locator('#panel:not(.hidden)').count(), 0);
    assert(!(await page.evaluate(() => JSON.parse(localStorage.cr_tutorials))).includes('guardian'));
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
