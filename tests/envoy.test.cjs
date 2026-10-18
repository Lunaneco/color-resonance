const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function content() {
  const c = vm.createContext({ localStorage: { getItem: () => null } });
  for (const f of ['progression', 'story', 'quests', 'restoration-content', 'guardian-content', 'guardian-combat', 'envoy']) vm.runInContext(await fs.readFile(path.join(root, 'js', f + '.js'), 'utf8'), c);
  return c;
}
test('Six envoy encounters, one per region, each a side story with its own victory condition', async () => {
  const c = await content();
  const r = JSON.parse(vm.runInContext(`JSON.stringify(ENVOYS.map(e => { const k = Envoy.keyOf(e), b = BOARDS[k]; return { k, town: e.town, objective: b.encounter.objective, story: SCRIPT[k], soldiers: b.enemies.every(x => x.kind.startsWith('s_')), side: !!EXTRA_SIDE_STORIES[k] }; }))`, c));
  assert.equal(r.length, 6);
  assert.deepEqual(r.map(x => x.town), ['aquamist', 'thorn', 'f_fruit', 'stone', 'rainbow', 'veil']);
  assert.deepEqual([...new Set(r.map(x => x.objective))].sort(), ['commander', 'protect', 'rout', 'seize', 'survive']);
  for (const x of r) {
    assert(x.soldiers, x.k + ' fights soldiers, not kegare');
    assert(x.side, x.k + ' is registered as a side story');
    assert(x.story.indexOf('@board ' + x.k) > 0 && x.story.indexOf('@board ' + x.k) < x.story.indexOf('@sideend'), x.k + ' story wraps its battle');
  }
  assert.match(r[0].story, /穢れじゃない/); assert.match(r[0].story, /針みたいな字/);
});

let browser, server, base;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => { try { const url = new URL(req.url, 'http://localhost'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) throw Error(); const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); });

// テストだけで使う戦闘の窓口。公開するJavaScriptには入れない。
const hook = `__envoy: {
  state(){ return {running,busy,over,turn,phase,danger:!document.getElementById('dangerZone').classList.contains('hidden'),dangerSize:dangerSet?dangerSet.size:0,goal:document.getElementById('kegareCount').textContent,
    decree:cells.filter(c=>c.decree).map(c=>({r:c.r,c:c.c})),units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,hp:u.hp,mhp:u.mhp,r:u.r,c:u.c,dead:!!u.dead,soldier:!!u.soldier,npc:!!u.npc,captain:!!u.captain,hold:!!u.hold,name:u.name}))}; },
  place(id, extra){ Object.assign(units.find(u=>u.id===id), extra); refreshHud(); },
  hit(a, d){ return attack(units.find(u=>u.id===a), units.find(u=>u.id===d), { normal:true }); },
  kill(id){ const u=units.find(x=>x.id===id); u.hp=0; return defeat(u, ariaU()); },
  check(){ return checkObjective(); }, setTurn(n){ turn=n; },
  blocked(id){ return absorbBlocked(units.find(u=>u.id===id)); },
  danger(){ toggleDanger(true); },
},
`;
async function battle(id, unlocked = ['prologue', 'act1', 'act2', 'act3', 'fury', 'vardbond', 'act4', 'act5', 'finale', 'epilogue', 'done']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(u => { localStorage.setItem('cr_unlocked', JSON.stringify(u)); localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true })); localStorage.setItem('cr_speed', '0'); localStorage.setItem('cr_party', JSON.stringify({ aria: { lv: 30, exp: 0 }, chrome: { lv: 30, exp: 0 }, postgame: { started: true, progress: 8, finished: true }, gold: 0 })); }, unlocked);
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8'), marker = '    start, enterPhase1, help, stop,';
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace(marker, hook + marker) }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click();
  if (id) {
    await page.evaluate(id => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS[id], intro: null }, () => {}); }, id);
    await page.waitForFunction(() => Board.__envoy && Board.__envoy.state().running && !Board.__envoy.state().busy, {}, { timeout: 20000 });
  }
  return { ctx, page, errors };
}
const S = page => page.evaluate(() => Board.__envoy.state());

test('Soldiers counter when struck, a freed captain sends the rest away, and Noir will not swallow a person', async () => {
  const { ctx, page, errors } = await battle('envoy_sea');
  try {
    let s = await S(page);
    assert(s.danger, 'the danger-zone button appears in encounters');
    assert.match(s.goal, /目標：隊長を解放する/);
    const aria = s.units.find(u => u.kind === 'aria'), lance = s.units.find(u => u.kind === 's_lance'), cap = s.units.find(u => u.captain);
    assert(cap && cap.hold, 'the captain holds his post');
    assert.equal(lance.name, '遣いの槍兵');
    assert.match(await page.evaluate(id => Board.__envoy.blocked(id), lance.id), /人は飲まない/);
    await page.evaluate(() => Board.__envoy.danger());
    assert((await S(page)).dangerSize > 0, 'danger zone lists the floors enemies can reach');
    // 槍兵の隣に立って打つ。槍兵は倒れずに打ち返す。
    await page.evaluate(({ a, l }) => { Math.random = () => 0.5; Board.__envoy.place(l, { r: 4, c: 4, hp: 9999, mhp: 9999 }); Board.__envoy.place(a, { r: 5, c: 4, hp: 500, mhp: 500 }); }, { a: aria.id, l: lance.id });
    await page.evaluate(({ a, l }) => Board.__envoy.hit(a, l), { a: aria.id, l: lance.id });
    s = await S(page);
    assert(s.units.find(u => u.id === aria.id).hp < 500, 'the lance struck back: ' + JSON.stringify([s.units.find(u => u.id === aria.id), s.units.find(u => u.id === lance.id)]));
    // 隊長の黒を剥がすと、残りの兵は退き、戦いは終わる
    await page.evaluate(id => Board.__envoy.kill(id), cap.id);
    await page.waitForFunction(() => Board.__envoy.state().over, {}, { timeout: 10000 });
    s = await S(page);
    assert(s.units.filter(u => u.side === 'enemy').every(u => u.dead), 'every soldier left once the captain was freed');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('Protect fails when a villager falls and succeeds after the turns; reaching the decree board wins the seize battle', async () => {
  {
    const { ctx, page, errors } = await battle('envoy_forest');
    try {
      const s = await S(page), vil = s.units.filter(u => u.npc);
      assert.equal(vil.length, 2); assert.equal(vil[0].name, '森の薬師');
      await page.evaluate(id => Board.__envoy.kill(id), vil[0].id);
      await page.waitForFunction(() => Board.__envoy.state().over, {}, { timeout: 10000 });
      await page.locator('#resRetry').waitFor({ timeout: 10000 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
  {
    const { ctx, page } = await battle('envoy_forest');
    try {
      await page.evaluate(() => { Board.__envoy.setTurn(6); Board.__envoy.check(); });
      await page.waitForFunction(() => Board.__envoy.state().over, {}, { timeout: 10000 });
      assert(!(await page.locator('#resRetry').isVisible()), 'holding for five turns wins');
    } finally { await ctx.close(); }
  }
  {
    const { ctx, page } = await battle('envoy_canyon');
    try {
      const s = await S(page);
      assert.equal(s.decree.length, 1);
      assert(s.units.filter(u => u.kind === 's_heavy').every(u => u.hold));
      const aria = s.units.find(u => u.kind === 'aria');
      await page.evaluate(({ a, d }) => { Board.__envoy.place(a, d); Board.__envoy.check(); }, { a: aria.id, d: s.decree[0] });
      await page.waitForFunction(() => Board.__envoy.state().over, {}, { timeout: 10000 });
    } finally { await ctx.close(); }
  }
});
test('The map offers the envoy only once its chapter is open, and the side story returns to the same checkpoint', async () => {
  const { ctx, page, errors } = await battle(null, ['prologue', 'act1']);
  try {
    await page.evaluate(() => World.open({ at: 'aquamist' })); await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=envoy]').count(), 0, 'not before the second act');
    await page.evaluate(() => { localStorage.cr_unlocked = JSON.stringify(['prologue', 'act1', 'act2']); localStorage.cr_save = JSON.stringify({ chapter: 'act2', idx: 0, map: true, at: 1 }); World.open({ at: 'aquamist' }); });
    await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=envoy]').count(), 1);
    await page.evaluate(() => { Board.start = (conf, done) => { window.__conf = { id: conf.id, objective: conf.encounter && conf.encounter.objective }; setTimeout(() => done(true), 1); return Promise.resolve(true); }; });
    await page.locator('#wmPanel [data-a=envoy]').click();
    for (let i = 0; i < 400 && !(await page.evaluate(() => World.isOpen && !Board.running && Engine.chapter === 'envoy_sea' && JSON.parse(localStorage.cr_save).chapter === 'act2')); i++) {
      if (await page.locator('#chapterCard:not(.hidden):not(.out)').count()) await page.locator('#chapterCard').click(); else await page.evaluate(() => document.getElementById('app').click());
      await page.waitForTimeout(30);
    }
    assert.deepEqual(await page.evaluate(() => window.__conf), { id: 'envoy_sea', objective: 'commander' });
    const save = await page.evaluate(() => JSON.parse(localStorage.cr_save)); assert.equal(save.chapter, 'act2'); assert(!save.returnStory);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
