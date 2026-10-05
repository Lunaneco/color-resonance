const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const pure = vm.createContext({ document: { addEventListener() {} }, localStorage: { getItem() {} } });
for (const name of ['progression', 'minigames']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), pure);
vm.runInContext('globalThis.P = Progression; globalThis.M = Minigames;', pure);
const { P, M } = pure;
const clone = value => JSON.parse(JSON.stringify(value));
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('Every generated lighthouse puzzle can be completed at all three difficulties', () => {
  for (const difficulty of M.tiers) {
    const [rows, cols] = M.games.lantern.sizes[difficulty], full = (1 << rows * cols) - 1;
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = M.createLantern(difficulty, seeded(seed));
      assert.notEqual(puzzle.board, full);
      const solution = M.solve(rows, cols, puzzle.board); assert.notEqual(solution, null);
      let final = puzzle.board;
      for (let i = 0; i < rows * cols; i++) if (solution & 1 << i) final ^= M.crossMask(rows, cols, i);
      assert.equal(final, full, difficulty + ' seed ' + seed);
    }
  }
});

test('Rewards pay only the increase in achieved rank and remain capped across repeat plays', () => {
  const party = P.migrate({ aria: { lv: 1, exp: 0 }, spirits: {}, gold: 100 });
  assert.equal(M.record(party, 'lantern', 'gentle', 20, 10).gold, 20);
  assert.equal(M.record(party, 'lantern', 'gentle', 20, 11).gold, 0);
  assert.equal(M.record(party, 'lantern', 'gentle', 100, 5).gold, 50);
  assert.equal(M.record(party, 'lantern', 'gentle', 80, 8).gold, 0);
  assert.equal(party.gold, 170); assert.equal(party.minigames.records.lantern.gentle.bestMoves, 5);
  for (const id of Object.keys(M.games)) for (const difficulty of M.tiers) for (let i = 0; i < 10; i++) M.record(party, id, difficulty, 100);
  assert.equal(party.gold, 1340); assert.equal(party.minigames.records.echo.hard.paid, 140);
  assert.throws(() => M.record(party, 'unknown', 'gentle', 100), /Invalid/);
  assert.throws(() => M.record(party, 'echo', 'expert', 100), /Invalid/);
});

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
afterEach(async () => { if (context) await context.close(); context = null; assert.deepEqual(errors || [], [], 'Leisure must not have runtime errors or missing game files'); });
after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function boot(viewport = { width: 1100, height: 850 }, chapter = 'act2', storage = {}) {
  errors = []; context = await browser.newContext({ viewport, hasTouch: viewport.width < 900 });
  await context.addInitScript(({ chapter, storage }) => { localStorage.setItem('cr_unlocked', JSON.stringify(['prologue', 'act1', ...(chapter === 'act1' ? [] : ['act2'])])); for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value)); }, { chapter, storage });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' });
  await page.locator('#world').waitFor({ state: 'visible' }); await page.locator('[data-w="games"]').click();
}
async function begin(id, difficulty = 'gentle', practice = false) {
  await page.locator(`[data-game="${id}"] [data-tier="${difficulty}"]`).click();
  await page.locator(`[data-game="${id}"] [${practice ? 'data-practice' : 'data-start'}]`).click();
  await page.locator(`.mg-play[data-id="${id}"]`).waitFor();
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cr_party')));
async function solveVisible() {
  const s = (await saved()).minigames.active;
  const [rows, cols] = M.games.lantern.sizes[s.difficulty], solution = M.solve(rows, cols, s.board);
  for (let i = 0; i < rows * cols; i++) if (solution & 1 << i) await page.locator(`[data-lamp="${i}"]`).click();
  await page.locator('.mg-result').waitFor();
}

test('Town workshops unlock with the story and the town panel offers a clear entrance', async () => {
  await boot(undefined, 'act1');
  assert(await page.locator('[data-game="lantern"] [data-start]').isEnabled()); assert(await page.locator('[data-game="echo"] [data-start]').isDisabled());
  await page.locator('.pn-close').click(); assert(await page.locator('#wmPanel [data-a="games"]').isVisible());
  await page.locator('#wmPanel [data-a="games"]').click(); assert(await page.locator('.mg-catalog').isVisible());
});

for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
  test(`Lighthouse play, results and capped retry rewards work by touch at ${viewport.width} × ${viewport.height}`, async () => {
    await boot(viewport); await begin('lantern', 'hard');
    const buttons = await page.locator('.mg-lamp').count(); assert.equal(buttons, 16);
    const box = await page.locator('.mg-lantern').boundingBox(); assert(box.x >= 0 && box.x + box.width <= viewport.width);
    const s = (await saved()).minigames.active, solution = M.solve(4, 4, s.board);
    for (let i = 0; i < 16; i++) if (solution & 1 << i) await page.locator(`[data-lamp="${i}"]`).tap();
    assert.equal((await saved()).minigames.records.lantern.hard.best, 100);
    assert.equal((await saved()).gold, 140); assert.equal(await page.locator('#wmGold').textContent(), '140');
    assert.equal((await saved()).materials.m_core, 3);assert.equal((await saved()).minigames.records.lantern.hard.hardCoreClaimed, 2);
    await page.locator('[data-retry]').tap(); await solveVisible(); assert.equal((await saved()).gold, 140);assert.equal((await saved()).materials.m_core, 3);
    await page.locator('[data-home]').tap(); assert((await page.locator('[data-game="lantern"]').textContent()).includes('最高 S / 100点'));
  });
}

test('Partial lighthouse progress survives closing and reload; practice leaves it intact', async () => {
  await boot(); await begin('lantern', 'normal'); await page.locator('[data-hint]').click();
  const before = (await saved()).minigames.active; await page.locator('.pn-close').click(); await page.reload({ waitUntil: 'networkidle' }); await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' });
  await page.locator('[data-w="games"]').click(); await page.locator('[data-resume]').click();
  assert.deepEqual((await saved()).minigames.active, before);
  await page.keyboard.press('Escape'); await page.locator('[data-w="games"]').click(); await begin('lantern', 'gentle', true);
  await page.locator('[data-lamp="1"]').click(); assert(await page.locator('.mg-result').isVisible());
  assert.equal((await saved()).gold, 0); assert.deepEqual((await saved()).minigames.active, before);
});

test('Echo can be played one note at a time with keyboard input, mistakes and no time pressure', async () => {
  await boot(); await begin('echo');
  const sequence = (await saved()).minigames.active.sequence;
  for (let round = 0; round < 3; round++) {
    const length = 3 + round;
    for (let i = 0; i < length; i++) await page.locator('[data-step]').click();
    await page.locator('[data-answer]').click();
    if (round === 0) {
      await page.keyboard.press(String((sequence[0] + 1) % 4 + 1));
      assert((await page.locator('.mg-status').textContent()).includes('違う響き'));
      for (let i = 0; i < length; i++) await page.locator('[data-step]').click();
      await page.locator('[data-answer]').click();
    }
    for (let i = 0; i < length; i++) await page.keyboard.press(String(sequence[i] + 1));
  }
  assert(await page.locator('.mg-result').isVisible()); const party = await saved();
  assert.equal(party.minigames.records.echo.gentle.best, 88); assert.equal(party.gold, 50);
  assert.equal(party.minigames.active, null);
});

test('Leaving a playing echo cancels its playback and preserves current returned notes', async () => {
  await boot(); await begin('echo', 'hard'); await page.locator('[data-listen]').click(); await page.locator('[data-back]').click();
  await page.waitForTimeout(1300); assert(await page.locator('.mg-catalog').isVisible());
  await page.locator('[data-resume]').click(); await page.locator('[data-step]').click(); await page.locator('[data-answer]').click();
  const first = (await saved()).minigames.active.sequence[0]; await page.keyboard.press(String(first + 1));
  await page.keyboard.press('Escape'); const active = (await saved()).minigames.active; assert.deepEqual(active.input, [first]);
  await page.locator('[data-w="games"]').click(); await page.locator('[data-resume]').click(); assert.equal(await page.locator('[data-input]').textContent(), '1 / 7');
});

test('Shop respects stock caps, unique ownership, affordability and wardrobe slot validation', async () => {
  await boot(undefined, 'act1', { cr_party: { aria: { lv: 1, exp: 0 }, spirits: {}, gold: 3000, owned: ['removed_equipment', 'e_glass'], equip: { cloth: 'e_glass', charm: 'removed_equipment' }, items: { i_tea: 8 } } });
  await page.locator('.pn-close').click(); await page.locator('#wmPanel [data-a="shop"]').click();
  const before = await saved(); assert.deepEqual(before.owned, ['e_glass']); assert.equal(before.equip.cloth, null); assert.equal(before.equip.charm, null);
  assert(await page.locator('.sh-buy[data-id="e_glass"]').isDisabled());
  await page.locator('.sh-buy[data-id="i_tea"]').click(); assert(await page.locator('.sh-buy[data-id="i_tea"]').isDisabled());
  assert.equal((await saved()).items.i_tea, 9); assert.equal((await saved()).gold, 2970);
  await page.locator('.sh-buy[data-id="a_rain"]').click(); assert(await page.locator('.sh-buy[data-id="a_rain"]').isDisabled()); assert.equal((await saved()).gold, 2860);
  await page.locator('#shEquip').click(); await page.locator('.eq-it[data-id="a_rain"]').click(); await page.locator('.eq-it[data-id="e_glass"]').click();
  const equipped = await saved(); assert.equal(equipped.equip.cloth, 'a_rain'); assert.equal(equipped.equip.blade, 'e_glass');
  await page.locator('.eq-off[data-s="blade"]').click(); assert.equal((await saved()).equip.blade, null); assert.equal((await saved()).gold, 2860);
});

test('An unfinished stage record does not bypass the first-clear story gate', async () => {
  await boot(undefined, 'act1', { cr_party: { aria: { lv: 1, exp: 0 }, spirits: {}, stages: { gran: { cleared: false, difficulties: {} } } } });
  await page.locator('.pn-close').click(); await page.locator('.wn[data-node="belfry"]').click();
  await page.locator('#wmPanel .wp-name').filter({ hasText: '鐘楼の空' }).waitFor();
  assert.equal(await page.locator('#wmPanel [data-a="sortie"]').count(), 0); assert((await page.locator('#wmPanel').textContent()).includes('物語が進むと'));
});

test('Closing the map cancels pending arrival and movement panel updates', async () => {
  await boot(); await page.locator('.pn-close').click(); await page.locator('.wn[data-node="belfry"]').click();
  await page.locator('[data-w="title"]').click(); await page.waitForTimeout(900);
  assert(await page.locator('#world').evaluate(el => el.classList.contains('hidden'))); assert(await page.locator('#wmPanel').evaluate(el => el.classList.contains('hidden')));
});

for (const viewport of [{ width: 320, height: 480 }, { width: 667, height: 375 }]) {
  test(`All four echo signals and playback controls share the visible area at ${viewport.width} × ${viewport.height}`, async () => {
    await boot(viewport); await begin('echo', 'hard');
    for (const selector of ['[data-pad="0"]', '[data-pad="1"]', '[data-pad="2"]', '[data-pad="3"]', '[data-listen]', '[data-step]', '[data-answer]']) {
      const box = await page.locator(selector).boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, selector + ' fits the visible area');
    }
    await page.locator('[data-step]').tap(); await page.locator('[data-answer]').tap(); assert(await page.locator('[data-pad="0"]').isEnabled());
  });
}
