const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
let server, base, browser, context, page, errors;
before(async () => {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif' };
  server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!file.startsWith(root + path.sep)) throw Error();
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(await fs.promises.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
});
afterEach(async () => {
  if (context) await context.close(); if (browser) await browser.close();
  context = browser = null; assert.deepEqual(errors || [], []);
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
async function boot(viewport = { width: 1440, height: 900 }, engine = chromium) {
  errors = []; browser = await engine.launch({ headless: true });
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 900 });
  await context.addInitScript(() => localStorage.setItem('cr_unlocked', JSON.stringify(['prologue', 'act1', 'act2'])));
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' });
  await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' });
  await page.locator('[data-w=games]').click();
}
async function begin(id) {
  await page.locator(`[data-game=${id}] [data-tier=hard]`).click();
  await page.locator(`[data-game=${id}] [data-start]`).click();
  await page.locator('.mg-play img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  await page.evaluate(async () => { await Promise.all(document.querySelector('#panel').getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))); });
}
const active = () => page.evaluate(() => Board.party.minigames.active);
test('All four illustrated covers load and the game pieces keep meaningful names without relying on images', async () => {
  await boot();
  await page.locator('.mg-cover').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  assert.equal(await page.locator('.mg-cover').count(), 4);
  assert(await page.locator('.mg-cover').evaluateAll(imgs => imgs.every(i => i.naturalWidth === 768)));
  await begin('crystal');
  assert.equal(await page.locator('.mg-gem .mg-prop').count(), 25);
  for (const gem of await page.locator('[data-gem]').all()) {
    assert.match(await gem.getAttribute('aria-label'), /潮|芽|金|虹/);
    assert.match(await gem.textContent(), /潮|芽|金|虹/);
  }
});
test('Voyage shows the current ship, previews both dash cells, and distinguishes protected and damaging routes without spending a turn', async () => {
  await boot();
  await page.evaluate(() => {
    const s = PlayCore.createVoyage('hard', 1); s.map[0] = ['reef', 'charge', 'star']; s.map[1][2] = 'reef';
    Board.party.minigames.active = s; Board.saveParty(); Minigames.open();
  });
  await page.locator('[data-resume]').click(); const before = await active();
  assert.equal(await page.locator('.mg-ship-row .current').count(), 1);
  await page.locator('[data-mode=dash]').click();
  assert.equal(await page.locator('.mg-sea-row.will-travel').count(), 2);
  assert.match(await page.locator('[data-lane="2"].danger').textContent(), /−2/);
  await page.locator('[data-mode=guard]').click();
  assert.equal(await page.locator('.mg-sea-row.will-travel').count(), 1);
  assert.match(await page.locator('[data-lane="0"].safe').textContent(), /護りで安全/);
  assert.deepEqual(await active(), before);
});
test('Crystal selection marks only geometric neighbors and keeps moves, board and materials unchanged', async () => {
  await boot(); await begin('crystal'); const before = await active();
  const i = before.board.findIndex(n => n < 4); await page.locator(`[data-gem="${i}"]`).click();
  const neighbors = await page.locator('.mg-gem.neighbor').evaluateAll(buttons => buttons.map(b => +b.dataset.gem));
  const expected = Array.from({ length: 25 }, (_, j) => j).filter(j => Math.abs(Math.floor(j / 5) - Math.floor(i / 5)) + Math.abs(j % 5 - i % 5) === 1);
  assert.deepEqual(neighbors, expected);
  assert.match(await page.locator('.mg-board-cue').textContent(), /隣を選んで交換/);
  assert.deepEqual(await active(), before);
});
test('Nova and rainbow previews expose their actual blast area by keyboard and cancel without consuming the free ability', async () => {
  await boot();
  await page.evaluate(() => {
    const s = PlayCore.createCrystal('hard', 73); s.board[12] += 4;
    Board.party.minigames.active = s; Board.saveParty(); Minigames.open();
  });
  await page.locator('[data-resume]').click(); const before = await active();
  await page.locator('[data-gem="12"]').focus(); assert.equal(await page.locator('.area-preview').count(), 9);
  await page.locator('[data-rainbow]').click(); await page.locator('[data-gem="10"]').focus();
  assert.deepEqual(await page.locator('.area-preview').evaluateAll(bs => bs.map(b => +b.dataset.gem)), [10, 11, 12, 13, 14]);
  assert.match(await page.locator('.mg-board-cue').textContent(), /横一列/);
  await page.locator('[data-rainbow]').click(); assert.deepEqual(await active(), before);
});
test('Lighthouse previews the cross and updates actual lantern imagery together with its saved light state', async () => {
  await boot();
  await page.evaluate(() => {
    const s = Minigames.createLantern('hard', () => .3);
    s.board = s.initial = 65535 ^ Minigames.crossMask(4, 4, 0) ^ Minigames.crossMask(4, 4, 15);
    Board.party.minigames.active = s; Board.saveParty(); Minigames.open();
  });
  await page.locator('[data-resume]').click(); const before = await active();
  await page.locator('[data-lamp="5"]').focus();
  assert.deepEqual(await page.locator('.mg-lamp.affected').evaluateAll(bs => bs.map(b => +b.dataset.lamp)), [1, 4, 5, 6, 9]);
  assert.deepEqual(await active(), before);
  await page.locator('[data-lamp="5"]').click(); const after = await active();
  assert.equal(after.board, before.board ^ [1, 4, 5, 6, 9].reduce((n, i) => n | 1 << i, 0));
  for (const b of await page.locator('[data-lamp]').all()) {
    const on = !!(after.board & 1 << +(await b.getAttribute('data-lamp')));
    assert((await b.locator('img').getAttribute('src')).endsWith(on ? '/lantern-on.webp' : '/lantern-off.webp'));
  }
});
test('Echo shows whose turn it is and how many notes remain while preserving keyboard play', async () => {
  await boot(); await begin('echo');
  assert.match(await page.locator('.mg-echo-turn').textContent(), /お手本を見る/);
  await page.locator('[data-step]').click(); assert.match(await page.locator('.mg-echo-turn').textContent(), /お手本/);
  await page.locator('[data-answer]').click(); assert.match(await page.locator('.mg-echo-turn').textContent(), /あなたの番.*あと7音/);
  const first = (await active()).sequence[0]; await page.keyboard.press(String(first + 1));
  assert.match(await page.locator('.mg-echo-turn').textContent(), /あと6音/);
  assert.equal((await active()).input[0], first);
});
test('Reduced motion and large text retain image cues, and sounding notes use a stable highlight', async () => {
  await boot({ width: 320, height: 480 }, webkit);
  await page.evaluate(() => localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true, textSize: 'large' })));
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' }); await page.locator('[data-w=games]').click();
  await begin('echo'); await page.locator('[data-step]').click();
  assert.equal(await page.locator('.mg-pad.sounding .mg-prop').evaluate(e => getComputedStyle(e).transform), 'none');
  assert.equal(await page.locator('.mg-pad.sounding').evaluate(e => getComputedStyle(e).animationName), 'none');
  assert.match(await page.locator('.mg-status').textContent(), /音目/);
  await page.locator('[data-answer]').click(); assert(await page.locator('[data-pad="0"]').isEnabled());
});
for (const [engine, viewport] of [[chromium, { width: 390, height: 844 }], [webkit, { width: 320, height: 480 }], [webkit, { width: 667, height: 375 }]]) {
  test(`Every illustrated hard game keeps all main controls on screen at ${viewport.width}×${viewport.height}`, async () => {
    await boot(viewport, engine);
    for (const id of ['lantern', 'echo', 'voyage', 'crystal']) {
      await begin(id);
      const selector = { lantern: '[data-lamp],.mg-toolbar button', echo: '[data-pad],.mg-toolbar button', voyage: '[data-mode],[data-lane]', crystal: '[data-gem],[data-rainbow],[data-crystal-hint]' }[id];
      const area = await page.locator('.pn-body').boundingBox();
      for (const b of await page.locator(selector).all()) {
        const box = await b.boundingBox();
        assert(box.height >= 44 && box.width >= 40);
        assert(box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${id} controls fit: ${JSON.stringify(box)}`);
        assert(box.y >= area.y && box.y + box.height <= area.y + area.height + 1, id + ' controls are inside the visible panel');
      }
      if (id === 'voyage') assert(await page.locator('.mg-ship-row .current .mg-prop').isVisible());
      await page.keyboard.press('Escape'); await page.locator('[data-w=games]').click();
    }
  });
}
