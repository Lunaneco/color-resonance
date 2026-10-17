const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function load() {
  const c = vm.createContext({ localStorage: { getItem: () => null } });
  vm.runInContext(await fs.readFile(path.join(root, 'js/progression.js'), 'utf8'), c);
  vm.runInContext(await fs.readFile(path.join(root, 'js/noir-absorb.js'), 'utf8'), c);
  return c;
}

test('the first absorb of a type teaches its skill and the same type never teaches it again', async () => {
  const c = await load();
  const r = vm.runInContext(`(() => {
    const rec = NoirAbsorb.blank(3);
    const shade = { kind: 'shade', hp: 5, mhp: 20 };
    const first = NoirAbsorb.absorb(rec, shade, 'cove');
    const again = NoirAbsorb.absorb(rec, { kind: 'shade', hp: 1, mhp: 20 }, 'cove');
    const thorn = NoirAbsorb.absorb(rec, { kind: 'thorn', hp: 2, mhp: 16 }, 'ivy');
    return { first, again, thorn, skills: rec.skills, known: rec.known };
  })()`, c);
  assert.equal(r.first.learned, true);
  assert.equal(r.first.skill.id, 'n_shade');
  assert.equal(r.first.skill.name, '影の一口');
  assert.equal(r.again.learned, false);
  assert.equal(r.again.alreadyType, true);
  assert.equal(r.thorn.learned, true);
  assert.equal(r.thorn.skill.id, 'n_thorn');
  assert.equal(JSON.stringify(r.skills), JSON.stringify(['n_shade', 'n_thorn']));
  assert.equal(r.known.k_shade, 'n_shade');
  assert.equal(r.known.k_thorn, 'n_thorn');
});

test('a shared skill id is kept once, bosses teach their own skill, and 30% is the line', async () => {
  const c = await load();
  const r = vm.runInContext(`(() => {
    const rec = NoirAbsorb.blank(8);
    const gran = NoirAbsorb.absorb(rec, { kind: 'boss', guardian: 'gran', hp: 10, mhp: 100 }, 'gran');
    const rivela = NoirAbsorb.absorb(rec, { kind: 'boss', guardian: 'rivela', hp: 9, mhp: 90 }, 'gb_rivela');
    const vard = NoirAbsorb.absorb(rec, { kind: 'boss', guardian: 'vard', hp: 8, mhp: 80 }, 'vard');
    const chrome = NoirAbsorb.absorb(rec, { kind: 'chrome', hp: 4, mhp: 40 }, 'chrome');
    const core = NoirAbsorb.absorb(rec, { kind: 'boss', hp: 3, mhp: 30 }, 'cove');
    const unknown = NoirAbsorb.absorb(rec, { kind: 'boss', guardian: 'zzz', hp: 2, mhp: 20 }, 'x');
    const sea = NoirAbsorb.absorb(rec, { kind: 'shade', variant: { art: 'sea_shade' }, trait: 'push', hp: 1, mhp: 10 }, 'cove');
    return {
      gran: gran.skill.id, rivela: { learned: rivela.learned, duplicate: rivela.duplicate, id: rivela.skill.id },
      vard: vard.skill.id, chrome: chrome.skill.id, core: core.skill.id, unknown: unknown.skill.id,
      sea: { learned: sea.learned, duplicate: sea.duplicate, key: sea.key, id: sea.skill.id },
      skills: rec.skills,
      line: [30, 31, 0].map(hp => NoirAbsorb.nearDeath({ hp, mhp: 100 })),
      range: NoirAbsorb.RANGE, threshold: NoirAbsorb.THRESHOLD,
    };
  })()`, c);
  assert.equal(r.gran, 'n_push');
  assert.equal(r.rivela.learned, false);
  assert.equal(r.rivela.duplicate, true);
  assert.equal(r.rivela.id, 'n_push');
  assert.equal(r.vard, 'n_roar');
  assert.notEqual(r.vard, r.gran);
  assert.equal(r.chrome, 'n_wave');
  assert.equal(r.core, 'n_core');
  assert.equal(r.unknown, 'n_gulp');
  assert.equal(r.sea.duplicate, true);
  assert.equal(r.sea.key, 'v_sea_shade');
  assert.equal(r.skills.filter(id => id === 'n_push').length, 1);
  assert.equal(JSON.stringify(r.line), JSON.stringify([true, false, false]));
  assert.equal(r.range, 2);
  assert.equal(r.threshold, 0.3);
});

test('old saves without noir stay without it, and a present record is cleaned without growing twice', async () => {
  const c = await load();
  const plain = vm.runInContext(`(() => { const p = Progression.migrate({ aria: { lv: 4, exp: 2 }, gold: 9 }); return Object.hasOwn(p, 'noir'); })()`, c);
  assert.equal(plain, false);
  const saved = vm.runInContext(`(() => {
    const p = Progression.migrate({ aria: { lv: 4, exp: 2 }, noir: { joined: true, lv: 4, exp: 3, skills: ['n_shade', 'invented'], known: { k_shade: 'n_shade', bad: 'nope', v_sea_shade: 'n_push' } } });
    const once = JSON.stringify(p.noir);
    Progression.migrate(p);
    return { once, twice: JSON.stringify(p.noir), joined: p.noir.joined };
  })()`, c);
  assert.equal(saved.once, saved.twice);
  const noir = JSON.parse(saved.once);
  assert.equal(noir.joined, true);
  assert.deepEqual(noir.skills, ['n_shade', 'n_push']);
  assert.deepEqual(noir.known, { k_shade: 'n_shade', v_sea_shade: 'n_push' });
  const absent = vm.runInContext(`Progression.migrate({ aria: { lv: 1, exp: 0 }, noir: { joined: false, lv: 1, exp: 0, skills: [], known: {} } }).noir.joined`, c);
  assert.equal(absent, false);
});

const hook = `__noirQA: {
  state() { return { running, phase, busy, over, paused, allies: units.filter(u => u.side === 'ally' && !u.hidden).map(u => u.kind),
    units: units.map(u => ({ id: u.id, kind: u.kind, side: u.side, hp: u.hp, mhp: u.mhp, r: u.r, c: u.c, dead: !!u.dead, acted: !!u.acted })) }; },
  place(id, extra) { Object.assign(units.find(u => u.id === id), extra); refreshHud(); },
  pick(kind) { select(units.find(u => u.kind === kind && !u.dead), true); showMenu(sel); },
  screen(id) { const u = units.find(x => x.id === id); const p = toScreen(unitXY(u).x, unitXY(u).y - tw * u.hgt * 0.45); return { x: p.x, y: p.y }; },
},
`;

let browser, server, base, context, page, errors;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) throw Error();
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
afterEach(async () => {
  if (context) await context.close();
  context = null;
  assert.deepEqual(errors || [], []);
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

test('Noir joins a battle only when flagged, absorbs a dying shade, and lists the skill once', async () => {
  errors = [];
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('cr_speed', '0'));
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8');
  const marker = '    start, enterPhase1, help, stop,';
  assert(source.includes(marker));
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace(marker, hook + marker) }));
  await page.goto(base + '#board=cove', { waitUntil: 'networkidle' });
  await page.locator('#gate').click();
  await page.waitForFunction(() => Board.__noirQA.state().running && !Board.__noirQA.state().busy, null, { timeout: 20000 });
  assert.deepEqual(await page.evaluate(() => Board.__noirQA.state().allies), ['aria']);

  await page.evaluate(() => {
    Board.party.noir = NoirAbsorb.blank(Board.party.aria.lv);
    Board.saveParty();
    Board.start({
      ...BOARDS.cove, region: false, renoir: true, hideSide: false, finale: false, tutorial: null, intro: null, beats: [],
      map: { low: ['land_flat'], mid: ['land_flat'], high: ['land_flat'], hills: 0, obsAmt: 0, water: null },
      enemies: [{ kind: 'shade', lv: 1 }, { kind: 'shade', lv: 1 }],
    }, () => {});
  });
  await page.waitForFunction(() => Board.__noirQA.state().running && !Board.__noirQA.state().busy, null, { timeout: 20000 });
  const opened = await page.evaluate(() => Board.__noirQA.state().allies);
  assert.deepEqual(opened.sort(), ['aria', 'noir']);

  const ids = await page.evaluate(() => {
    Math.random = () => 0.5;
    const s = Board.__noirQA.state();
    const noir = s.units.find(u => u.kind === 'noir');
    const shades = s.units.filter(u => u.kind === 'shade');
    Board.__noirQA.place(noir.id, { r: 5, c: 5, acted: false, moved: false });
    Board.__noirQA.place(shades[0].id, { r: 4, c: 5, hp: Math.ceil(shades[0].mhp * 0.5) });
    Board.__noirQA.place(shades[1].id, { r: 7, c: 1, hp: shades[1].mhp });
    Board.__noirQA.pick('noir');
    return { noir: noir.id, a: shades[0].id, b: shades[1].id };
  });
  assert(await page.locator('[data-k=absorb]').isDisabled());
  await page.evaluate(ids => {
    const s = Board.__noirQA.state().units.find(u => u.id === ids.a);
    Board.__noirQA.place(ids.a, { hp: Math.floor(s.mhp * 0.30) });
    Board.__noirQA.pick('noir');
  }, ids);
  assert(await page.locator('[data-k=absorb]').isEnabled());
  await page.screenshot({ path: '/tmp/cr-noir-absorb-menu.png' });
  await page.locator('[data-k=absorb]').click();
  const point = await page.evaluate(id => Board.__noirQA.screen(id), ids.a);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => document.getElementById('skillName').classList.contains('show'), null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/cr-noir-absorb-battle.png' });
  await page.waitForFunction(() => Board.__noirQA.state().running && !Board.__noirQA.state().busy, null, { timeout: 20000 });
  const after = await page.evaluate(() => ({
    dead: Board.__noirQA.state().units.filter(u => u.kind === 'shade' && u.dead).length,
    skills: Board.party.noir.skills.slice(),
    known: { ...Board.party.noir.known },
  }));
  assert.equal(after.dead, 1);
  assert.deepEqual(after.skills, ['n_shade']);
  assert.equal(after.known.k_shade, 'n_shade');

  await page.evaluate(ids => {
    const foe = Board.__noirQA.state().units.find(u => u.id === ids.b);
    Board.__noirQA.place(ids.b, { r: 4, c: 5, hp: Math.max(1, Math.floor(foe.mhp * 0.30)) });
    Board.__noirQA.place(ids.noir, { acted: false, moved: false });
    Board.__noirQA.pick('noir');
  }, ids);
  await page.locator('[data-k=absorb]').click();
  const again = await page.evaluate(id => Board.__noirQA.screen(id), ids.b);
  await page.mouse.click(again.x, again.y);
  await page.waitForFunction(() => { const s = Board.__noirQA.state(); return s.over || (s.running && !s.busy); }, null, { timeout: 20000 });
  const second = await page.evaluate(() => ({ dead: Board.__noirQA.state().units.filter(u => u.kind === 'shade' && u.dead).length, skills: Board.party.noir.skills.slice() }));
  assert.equal(second.dead, 2);
  assert.equal(JSON.stringify(second.skills), JSON.stringify(['n_shade']));

  await page.evaluate(() => { Board.stop(); World.open(); document.getElementById('wmPanel')?.classList.add('hidden'); });
  await page.locator('#world').waitFor({ state: 'visible' });
  await page.locator('[data-w=party]').click();
  await page.locator('[data-noir-skill=n_shade]').waitFor();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('wmPanel')?.classList.add('hidden'));
  assert.match(await page.locator('[data-noir-row]').innerText(), /ノアール/);
  assert.match(await page.locator('[data-noir-skill=n_shade]').innerText(), /影の一口/);
  await page.screenshot({ path: '/tmp/cr-noir-skill-list.png' });

  await page.evaluate(() => { Panel.close(); Board.start({ ...BOARDS.chrome, region: false, intro: null, tutorial: null, beats: [], onEvent: null }, () => {}); });
  await page.waitForFunction(() => Board.__noirQA.state().running && !Board.__noirQA.state().busy && Board.__noirQA.state().phase === 'player', null, { timeout: 20000 });
  assert.deepEqual(await page.evaluate(() => Board.__noirQA.state().allies), ['aria'], 'the finale despair is still Aria alone');
});
