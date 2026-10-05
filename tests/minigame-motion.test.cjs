const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..'), pure = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/play-core.js'), 'utf8') + ';globalThis.C=PlayCore;', pure);
const C = pure.C, copy = value => JSON.parse(JSON.stringify(value));
let server, base, browser, context, page, errors;
before(async () => {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif' };
  server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!file.startsWith(root + path.sep)) throw Error();
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(await fs.promises.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}/`;
});
afterEach(async () => { if (context) await context.close(); if (browser) await browser.close(); context = browser = null; assert.deepEqual(errors || [], [], 'no errors or missing art'); });
after(async () => { await new Promise(r => server.close(r)); });
async function boot(engine = chromium, viewport = { width: 1200, height: 900 }, settings = null, osMotion = 'no-preference') {
  errors = []; browser = await engine.launch({ headless: true }); context = await browser.newContext({ viewport, hasTouch: viewport.width < 900, reducedMotion: osMotion });
  await context.addInitScript(settings => {
    localStorage.setItem('cr_unlocked', JSON.stringify(['prologue', 'act1', 'act2', 'act3', 'act4']));
    if (settings) localStorage.setItem('cr_settings', JSON.stringify(settings));
  }, settings);
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click(); await page.locator('#gate').waitFor({ state: 'detached' });
  await page.locator('[data-w=games]').click();
}
async function resume(active) {
  await page.evaluate(active => { Board.party.minigames.active = active; Board.saveParty(); Minigames.open(); }, copy(active));
  await page.locator('[data-resume]').click();
  await page.locator('.mg-play').evaluate(async host => { await Promise.all([...host.querySelectorAll('img')].map(i => i.decode())); });
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cr_party')));
const moving = () => page.locator('#panel').evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
async function settled() { await page.waitForFunction(() => !document.querySelector('.mg-motion-layer,[data-effect]')); }

test('Cascade traces describe the exact erased cells, retained novas and falling sources across seeded turns', () => {
  for (let seed = 0; seed < 150; seed++) {
    const state = C.createCrystal('hard', seed);
    for (let turn = 0; turn < 4 && state.power < 210; turn++) {
      const nova = state.board.findIndex(n => n >= 4), move = C.crystalMoves(state.board)[0];
      const result = C.crystalTurn(state, nova >= 0 ? { type: 'burst', index: nova } : { type: 'swap', a: move.a, b: move.b });
      assert.equal(result.frames.length, result.chain); assert(result.frames.length <= 20);
      assert.equal(result.frames.reduce((sum, f) => sum + f.gain, 0), result.gain);
      assert.equal(result.frames.reduce((sum, f) => sum + f.clear.length, 0), result.count);
      result.frames.forEach((frame, index) => {
        assert.equal(frame.falls.length, 25); assert.equal(new Set(frame.clear).size, frame.clear.length);
        assert(!frame.clear.includes(frame.nova));
        frame.falls.forEach(f => {
          assert.equal(f.to % 5, ((f.from % 5) + 5) % 5); assert(f.from <= f.to);
          assert.equal(frame.after[f.to], f.value);
          if (f.from >= 0) { assert(!frame.clear.includes(f.from)); assert.equal(f.value, f.from === frame.nova ? frame.before[f.from] % 4 + 4 : frame.before[f.from]); }
        });
        if (index) assert.deepEqual(copy(frame.before), copy(result.frames[index - 1].after));
      });
      if (!result.shuffled) assert.deepEqual(copy(state.board), copy(result.frames.at(-1).after));
      assert.equal(state.frames, undefined);
    }
  }
});
test('Voyage feedback reports treasure, wind, actual healing, reef hits and guard without changing the save shape', () => {
  const s = C.createVoyage('hard', 4); s.map[0] = ['star', 'heart', 'reef']; s.map[1][0] = 'charge';
  const r = C.voyageTurn(s, 0, 'dash'); assert.equal(r.events.length, 2); assert.equal(r.events.reduce((n, e) => n + e.gain, 0), r.gain); assert.equal(r.events[1].charge, 1);
  const shield = C.createVoyage('hard', 4); shield.map[0][1] = 'reef'; const out = C.voyageTurn(shield, 1, 'guard'); assert(out.events[0].guarded); assert.equal(out.events[0].hp, 0); assert.equal(shield.events, undefined);
});
test('A crystal swap plays its real clear/fall trace, settles once and preserves exact state during motion', async () => {
  await boot(); const s = C.createCrystal('hard', 4), move = C.crystalMoves(s.board)[0], expected = copy(s);
  const result = C.crystalTurn(expected, { type: 'swap', a: move.a, b: move.b }); assert(!result.won);
  await resume(s); await page.locator(`[data-gem="${move.a}"]`).click(); await page.locator(`[data-gem="${move.b}"]`).click();
  assert(await page.locator('.mg-motion-playing').count()); assert(await moving() > 0); assert.equal(await page.locator('.mg-motion-cell').count(), 25);
  const snapshot = await saved(); assert.deepEqual(snapshot.minigames.active, expected);
  await settled(); assert.deepEqual(await saved(), snapshot); assert.equal(await page.locator('.mg-motion-layer').count(), 0);
  assert.equal(await page.locator('.mg-gem>.mg-prop').first().evaluate(e => getComputedStyle(e).opacity), '1');
});
test('A rejected swap returns the two crystals and spends no turn; the next action cancels stale motion', async () => {
  await boot(); const s = C.createCrystal('hard', 4);
  const valid = C.crystalMoves(s.board), bad = Array.from({ length: 24 }, (_, a) => ({ a, b: a + 1 })).find(m => Math.floor(m.a / 5) === Math.floor(m.b / 5) && !valid.some(v => v.a === m.a && v.b === m.b));
  await resume(s); const before = await saved(); await page.locator(`[data-gem="${bad.a}"]`).click(); await page.locator(`[data-gem="${bad.b}"]`).click();
  assert.equal(await page.locator('.mg-crystal-grid').getAttribute('data-effect'), 'miss'); assert(await moving() > 0); assert.deepEqual(await saved(), before);
  await page.locator('[data-rainbow]').click(); assert.equal(await page.locator('.mg-motion-layer').count(), 0); assert.equal(await page.locator('.mg-motion-playing').count(), 0);
  await page.locator('[data-gem="12"]').click(); assert.equal(await page.locator('.mg-crystal-grid').getAttribute('data-effect'), 'rainbow');
  const after = await saved(); assert.equal(after.minigames.active.movesLeft, s.movesLeft); assert(after.minigames.active.boostUsed);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.mg-motion-layer').count(), 0);
  await page.waitForTimeout(2100); assert.deepEqual(await saved(), after); assert.equal(await moving(), 0);
});
test('Nova and fever animate actual bursts; landing inputs are guarded and skipping restores the final board without a hint or extra turn', async () => {
  await boot(); const s = C.createCrystal('hard', 4); s.board[12] = s.board[12] % 4 + 4; s.charge = 12;
  const expected = copy(s), result = C.crystalTurn(expected, { type: 'burst', index: 12 }); assert(result.fever); assert(result.bursts > 0); assert(!result.won);
  await resume(s); await page.locator('[data-gem="12"]').click();
  assert.equal(await page.locator('.mg-crystal-grid').getAttribute('data-effect'), 'fever'); assert.equal(await page.locator('.mg-crystal-grid').getAttribute('aria-busy'), 'true');
  assert(await page.locator('[data-gem="12"]').isDisabled()); const snapshot = await saved(); assert.deepEqual(snapshot.minigames.active, expected);
  await page.locator('[data-gem="0"]').dispatchEvent('click'); assert.deepEqual(await saved(), snapshot);
  assert.match(await page.locator('[data-crystal-hint]').textContent(), /早送り/); await page.locator('[data-crystal-hint]').click();
  assert.equal(await page.locator('.mg-motion-layer').count(), 0); assert(await page.locator('[data-gem="12"]').isEnabled()); assert.equal(await page.locator('.mg-gem.hinted').count(), 0);
  assert.match(await page.locator('[data-crystal-hint]').textContent(), /つながる一手/); assert.deepEqual(await saved(), snapshot);
  await page.waitForTimeout(2100); assert.deepEqual(await saved(), snapshot);
});
test('Reducing motion, resizing or replacing the panel cancels a cascade and restores usable controls without replaying its turn', async () => {
  await boot(); await resume(C.createCrystal('hard', 4)); await page.locator('[data-rainbow]').click(); await page.locator('[data-gem="12"]').click();
  const snapshot = await saved(); await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; });
  await page.waitForFunction(() => !document.querySelector('.mg-motion-layer')); assert(await page.locator('[data-gem="12"]').isEnabled()); assert.deepEqual(await saved(), snapshot);
  await page.evaluate(() => { document.documentElement.dataset.motion = 'full'; });
  await resume(C.createCrystal('hard', 4)); await page.locator('[data-rainbow]').click(); await page.locator('[data-gem="12"]').click();
  const second = await saved(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => !document.querySelector('.mg-motion-layer'));
  assert(await page.locator('[data-gem="12"]').isEnabled()); assert.deepEqual(await saved(), second);
  await resume(C.createCrystal('hard', 4)); await page.locator('[data-rainbow]').click(); await page.locator('[data-gem="12"]').click();
  const third = await saved(); await page.evaluate(() => Panel.open('別の画面', '<p>旅へ戻る</p>')); await page.waitForTimeout(2100); assert.deepEqual(await saved(), third); assert.equal(await moving(), 0);
});
test('Lantern light travels only through the pressed cross, and another press remains responsive', async () => {
  await boot(); const initial = 65535 ^ 19, s = { id: 'lantern', difficulty: 'hard', initial, board: initial, moves: 0, hints: 0, history: [] };
  await resume(s); await page.locator('[data-lamp="5"]').click(); assert.equal(await page.locator('.mg-motion-link').count(), 4); assert(await moving() > 0);
  await page.locator('[data-lamp="6"]').click(); const snap = await saved(); assert.equal(snap.minigames.active.moves, 2); assert.deepEqual(snap.minigames.active.history, [5, 6]);
  await settled(); assert.deepEqual(await saved(), snap);
});
test('Echo notes pulse in the demo and answers, light a verse star and offer a gentle retry on a wrong note', async () => {
  await boot(); await resume({ id: 'echo', difficulty: 'gentle', sequence: [0, 1, 2, 3, 0], round: 0, mistakes: 0, aids: 0 });
  await page.locator('[data-step]').click(); assert.equal(await page.locator('.mg-echo').getAttribute('data-effect'), 'listen'); assert(await moving() > 0);
  await page.locator('[data-answer]').click(); await page.keyboard.press('1'); assert.equal(await page.locator('.mg-echo').getAttribute('data-effect'), 'answer');
  await page.keyboard.press('2'); await page.keyboard.press('3'); assert.equal(await page.locator('.mg-echo').getAttribute('data-effect'), 'verse');
  assert.equal(await page.locator('.mg-verse-stars .lit').count(), 1); assert.equal((await saved()).minigames.active.round, 1);
  await page.locator('[data-step]').click(); await page.locator('[data-answer]').click(); await page.keyboard.press('2');
  assert.equal(await page.locator('.mg-echo').getAttribute('data-effect'), 'wrong'); assert.equal((await saved()).minigames.active.mistakes, 1); await settled();
});
test('The boat travels, collects doubled treasure, shows a combo and protects a guarded reef', async () => {
  await boot(); const s = C.createVoyage('hard', 4); s.map[0][1] = s.map[1][1] = 'star'; s.map[2][1] = 'reef'; s.map[3][1] = 'charge';
  await resume(s); await page.locator('[data-mode=dash]').click(); await page.locator('[data-lane="1"]').click();
  assert.equal(await page.locator('.mg-route-map').getAttribute('data-effect'), 'dash'); assert.match(await page.locator('.mg-motion-layer').textContent(), /2 COMBO/); assert(await moving() > 0);
  let snap = await saved(); assert.equal(snap.minigames.active.step, 2); assert.equal(snap.minigames.active.points, 60); await settled(); assert.deepEqual(await saved(), snap);
  await page.locator('[data-lane="1"]').click(); assert.match(await page.locator('.mg-motion-layer').textContent(), /船体 −?\-1/); snap = await saved(); assert.equal(snap.minigames.active.hp, 2);
  s.map[0][1] = 'reef'; await resume(s); await page.locator('[data-mode=guard]').click(); await page.locator('[data-lane="1"]').click();
  assert.match(await page.locator('.mg-motion-layer').textContent(), /護り成功/); assert.equal((await saved()).minigames.active.hp, 3);
});
for (const [engine, viewport] of [[chromium, { width: 390, height: 844 }], [webkit, { width: 320, height: 480 }], [webkit, { width: 667, height: 375 }]]) {
  test(`Effects stay decorative and all controls remain reachable at ${viewport.width}×${viewport.height}`, async () => {
    await boot(engine, viewport);
    for (const id of ['voyage', 'lantern', 'echo', 'crystal']) {
      if (id === 'voyage') { await resume(C.createVoyage('hard', 4)); await page.locator('[data-lane="0"]').tap(); }
      if (id === 'crystal') { await resume(C.createCrystal('hard', 4)); await page.locator('[data-rainbow]').tap(); await page.locator('[data-gem="12"]').tap(); }
      if (id === 'echo') { await resume({ id, difficulty: 'hard', sequence: [0, 1, 2, 3, 0, 1, 2, 3, 0], round: 0, aids: 0, mistakes: 0 }); await page.locator('[data-step]').tap(); }
      if (id === 'lantern') { await resume({ id, difficulty: 'hard', initial: 65535 ^ 19, board: 65535 ^ 19, moves: 0, hints: 0, history: [] }); await page.locator('[data-lamp="5"]').tap(); }
      const layer = page.locator('.mg-motion-layer'); assert.equal(await layer.getAttribute('aria-hidden'), 'true'); assert.equal(await layer.evaluate(e => getComputedStyle(e).pointerEvents), 'none');
      const selector = { voyage: '[data-mode],[data-lane]', crystal: '[data-gem],[data-rainbow],[data-crystal-hint]', lantern: '[data-lamp],.mg-toolbar button', echo: '[data-pad],.mg-toolbar button' }[id];
      for (const button of await page.locator(selector).all()) { const b = await button.boundingBox(); assert(b.height >= 44); assert(b.x >= 0 && b.x + b.width <= viewport.width + 1 && b.y >= 0 && b.y + b.height <= viewport.height + 1, id + ' controls stay in view'); }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  });
}
for (const [settings, osMotion] of [[{ reduceMotion: true, textSize: 'large' }, 'no-preference'], [{ reduceMotion: false }, 'reduce']]) {
  test(`Motion reduction skips moving effects, retains state and note cues (${osMotion})`, async () => {
    await boot(webkit, { width: 320, height: 480 }, settings, osMotion);
    await resume(C.createCrystal('hard', 4)); await page.locator('[data-rainbow]').click(); await page.locator('[data-gem="12"]').click();
    assert.equal(await page.locator('.mg-motion-layer').count(), 0); assert.equal(await moving(), 0); assert.equal((await saved()).minigames.active.boostUsed, true);
    await resume({ id: 'echo', difficulty: 'gentle', sequence: [0, 1, 2, 3, 0], round: 0, mistakes: 0, aids: 0 }); await page.locator('[data-step]').click();
    assert.equal(await moving(), 0); assert.equal(await page.locator('.mg-pad.sounding').count(), 1); assert.match(await page.locator('.mg-status').textContent(), /潮/);
  });
}
test('Closing a clear celebration cannot duplicate its first-hard reward', async () => {
  await boot(); const s = C.createVoyage('hard', 4); s.step = 17; s.map[17][1] = 'star'; await resume(s);
  await page.locator('[data-lane="1"]').click(); assert.equal(await page.locator('.mg-result').getAttribute('data-effect'), 'clear'); assert(await moving() > 0);
  const snap = await saved(); assert.equal(snap.materials.m_core, 2); assert.equal(snap.minigames.records.voyage.hard.clears, 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1600); assert.deepEqual(await saved(), snap); assert.equal(await moving(), 0);
});
