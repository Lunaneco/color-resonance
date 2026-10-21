const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), vm = require('node:vm');
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

test('Every tactic names real stages, real enemy kinds and sensible turns; prologue, guardians and the finale have none', async () => {
  const c = vm.createContext({ localStorage: { getItem: () => null }, document: { addEventListener() {} } });
  for (const f of ['progression', 'story', 'quests', 'restoration-content', 'guardian-content', 'guardian-combat']) vm.runInContext(await fs.readFile(path.join(root, 'js', f + '.js'), 'utf8'), c);
  vm.runInContext((await fs.readFile(path.join(root, 'js/world.js'), 'utf8')).split('const World =')[0], c);
  for (const f of ['fury', 'tactics']) vm.runInContext(await fs.readFile(path.join(root, 'js', f + '.js'), 'utf8'), c);
  const r = JSON.parse(vm.runInContext(`JSON.stringify({ table: Tactics.TABLE, stages: Object.keys({ ...BOARDS, ...SIDE_QUESTS, ...FREE_STAGES, ...RESTORATION_STAGES }).concat(['camp_valley', 'camp_town']), bosses: Object.values({ ...BOARDS, ...SIDE_QUESTS, ...FREE_STAGES, ...RESTORATION_STAGES }).filter(b => (b.enemies || []).some(e => e.kind === 'boss') && !b.guardian).map(b => b.id), guardians: Object.values({ ...BOARDS, ...FREE_STAGES }).filter(b => b.guardian || b.id === 'f_fruit').map(b => b.id) })`, c));
  const kinds = ['shade', 'thorn', 'lead', 'membrane', 's_sword', 's_lance', 's_bow'];
  for (const [id, t] of Object.entries(r.table)) {
    assert(r.stages.includes(id), `${id} is a real stage`);
    for (const w of t.waves || []) { assert(w.turn >= 2 && w.turn <= 6, `${id}: wave turn`); assert(['far', 'flank', 'rear', 'boss'].includes(w.from)); w.units.forEach(u => assert(kinds.includes(u.kind), `${id}: ${u.kind}`)); }
    for (const a of t.ambush || []) { assert(kinds.includes(a.kind)); assert(a.near >= 1); }
    if (t.second) { assert(t.second.who === 'captain' || r.bosses.includes(id), `${id}: a second form needs a core`); assert(t.second.hp > 0 && t.second.hp < 1); }
    if (t.charge) assert(t.charge.turn >= 2 && t.charge.turn <= 4);
  }
  for (const id of ['cove', 'chrome', ...r.guardians]) assert(!r.table[id], `${id} keeps its own rules`);
  const used = Object.values(r.table);
  assert(used.filter(t => t.waves).length >= 10 && used.filter(t => t.ambush).length >= 10 && used.filter(t => t.second).length >= 10 && used.filter(t => t.charge).length >= 8, 'all four tactics are used widely');
});

const hook = `__tac: {
  state(){ return {rows,cols,running,busy,over,turn,phase,hud:document.getElementById('kegareCount').textContent,box:document.getElementById('missionBox').textContent,
    warn:cells.filter(c=>c.waveWarn).map(c=>({r:c.r,c:c.c})), waves:waves.map(w=>({turn:w.turn,done:w.done,cells:w.cells.map(c=>({r:c.r,c:c.c}))})),
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,hp:u.hp,mhp:u.mhp,atk:u.atk,r:u.r,c:u.c,dead:!!u.dead,hidden:!!u.hidden,ambush:!!u.ambush,name:u.name,second:u.second?{used:u.second.used}:null,hold:!!u.hold,holdUntil:u.holdUntil||null,fresh:!!u.fresh}))}; },
  place(id, extra){ Object.assign(units.find(u=>u.id===id), extra); refreshHud(); },
  end(){ return endPlayerPhase(); },
  kill(id){ const u=units.find(x=>x.id===id); u.hp=0; return defeat(u, ariaU()); },
  walk(id, r, c){ const u=units.find(x=>x.id===id); select(u,true); moveInfo=reachable(u); const cell=cellAt(r,c); if(!moveInfo.ends.has(idx(r,c))) return false; doMove(u, cell); return true; },
  undoable(id){ return !!units.find(x=>x.id===id).undo; },
},
`;
async function battle(id, difficulty = 'normal') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => { localStorage.setItem('cr_unlocked', JSON.stringify(['prologue', 'act1', 'act2', 'act3', 'fury', 'vardbond', 'act4', 'act5', 'finale', 'epilogue', 'done'])); localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true })); localStorage.setItem('cr_speed', '0'); localStorage.setItem('cr_party', JSON.stringify({ aria: { lv: 40, exp: 0 }, gold: 0 })); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8'), marker = '    start, enterPhase1, help, stop,';
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace(marker, hook + marker) }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click();
  await page.evaluate(({ id, difficulty }) => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...(BOARDS[id] || SIDE_QUESTS[id] || FREE_STAGES[id] || RESTORATION_STAGES[id]), intro: null, beats: [], difficulty }, () => {}); }, { id, difficulty });
  await page.waitForFunction(() => Board.__tac && Board.__tac.state().running && !Board.__tac.state().busy && Board.__tac.state().phase === 'player', {}, { timeout: 20000 });
  return { ctx, page, errors };
}
const S = page => page.evaluate(() => Board.__tac.state());
const nextTurn = async page => { await page.evaluate(() => Board.__tac.end()); await page.waitForFunction(() => { const s = Board.__tac.state(); return s.over || (s.phase === 'player' && !s.busy); }, {}, { timeout: 30000 }); };
// アリアを敵から遠い隅へ置き、敵の手番で倒されないようにする
const park = page => page.evaluate(() => { const s = Board.__tac.state(); const a = s.units.find(u => u.kind === 'aria'); Board.__tac.place(a.id, { hp: 99999, mhp: 99999, def: 9999 }); });

for (const difficulty of ['normal', 'hard']) test(`Reinforcements are announced on their floors at the start of their turn and arrive in that enemy phase (${difficulty})`, async () => {
  const { ctx, page, errors } = await battle('gp_gran', difficulty);
  try {
    await park(page);
    let s = await S(page);
    assert.match(s.box, /敵の作戦：増援 3ターン目/);
    const planned = s.waves[0].cells;
    assert.equal(planned.length, 2);
    assert.deepEqual(s.warn, [], 'nothing is announced before its turn');
    await nextTurn(page); await nextTurn(page);
    s = await S(page);
    assert.equal(s.turn, 3);
    assert.deepEqual(s.warn.map(c => c.r + ',' + c.c).sort(), planned.map(c => c.r + ',' + c.c).sort(), 'turn 3 marks exactly where they will appear');
    const before = s.units.filter(u => u.side === 'enemy' && !u.dead).length;
    await nextTurn(page);
    s = await S(page);
    const fresh = s.units.filter(u => u.side === 'enemy' && !u.dead).slice(before);
    assert.equal(fresh.length, 2, 'two shades arrived');
    assert.deepEqual(s.warn, [], 'the warning clears');
    assert(s.waves[0].done);
    const stayed = fresh.filter(u => planned.some(c => c.r === u.r && c.c === u.c)).length;
    if (difficulty === 'normal') assert.equal(stayed, 2, 'on normal, they do not act on arrival');
    assert.doesNotMatch(s.box, /増援/, 'the plan leaves the mission box once it has come');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('An ambush stays hidden, stops the ally who walks near it, cannot be undone, and appears before victory if left', async () => {
  const { ctx, page, errors } = await battle('gp_ivy');
  try {
    let s = await S(page);
    const hidden = s.units.filter(u => u.ambush);
    assert.equal(hidden.length, 2);
    assert(hidden.every(u => u.hidden), 'the ambushers start hidden');
    const aria = s.units.find(u => u.kind === 'aria'), target = hidden[0];
    // 伏兵の3マス先まで道を空けてから、伏兵の隣を越える先へ歩かせる
    const spot = await page.evaluate(({ a, t }) => {
      const s = Board.__tac.state();
      for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const d = Math.abs(dr) + Math.abs(dc); if (d !== 3) continue; const r = t.r + dr, c = t.c + dc; if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) continue; Board.__tac.place(a, { r: t.r + dr, c: t.c + dc }); if (Board.__tac.walk(a, t.r + Math.sign(dr), t.c + Math.sign(dc))) return { dr, dc }; }
      return null;
    }, { a: aria.id, t: target });
    assert(spot, 'found a walk towards the ambush');
    await page.waitForFunction(() => !Board.__tac.state().busy, {}, { timeout: 10000 });
    s = await S(page);
    const me = s.units.find(u => u.id === aria.id), t2 = s.units.find(u => u.id === target.id);
    assert.equal(t2.hidden, false, 'the ambusher appears');
    assert(Math.abs(me.r - t2.r) + Math.abs(me.c - t2.c) >= 2, 'Aria stopped before stepping onto it');
    assert.equal(await page.evaluate(id => Board.__tac.undoable(id), aria.id), false, 'the stopped move cannot be undone');
    // 見える敵を倒しきっても、残りの伏兵が出てくる（もう一人の伏兵は隠れたままにしておく）
    const other = hidden.find(u => u.id !== target.id);
    await page.evaluate(id => Board.__tac.place(id, { hidden: true, r: 0, c: 0 }), other.id);
    for (const u of (await S(page)).units.filter(u => u.side === 'enemy' && !u.hidden && !u.dead)) await page.evaluate(id => Board.__tac.kill(id), u.id);
    await page.waitForTimeout(800);
    s = await S(page);
    assert.equal(s.over, false, 'not yet won while an ambusher hides');
    assert(s.units.filter(u => u.ambush && !u.dead).every(u => !u.hidden), 'the last ambusher appears');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('A core with a second form rises once with half its health and stronger attack, calls help, and falls for good the second time', async () => {
  const { ctx, page, errors } = await battle('q_orchard');
  try {
    let s = await S(page);
    const boss = s.units.find(u => u.kind === 'boss');
    assert(boss.second && !boss.second.used);
    const count = s.units.filter(u => u.side === 'enemy' && !u.dead && !u.hidden).length;
    await page.evaluate(id => Board.__tac.kill(id), boss.id); await page.waitForFunction(() => !Board.__tac.state().busy, {}, { timeout: 10000 });
    s = await S(page);
    const b2 = s.units.find(u => u.id === boss.id);
    assert.equal(b2.dead, false, 'it rises');
    assert(Math.abs(b2.hp - Math.round(b2.mhp * 0.55)) <= 1, 'with about half its health');
    assert(b2.atk > boss.atk, 'and a stronger attack');
    assert.match(b2.name, /苦い殻を割った核/);
    assert.equal(s.units.filter(u => u.side === 'enemy' && !u.dead && !u.hidden).length, count + 1, 'it calls a thorn');
    await page.evaluate(id => Board.__tac.kill(id), boss.id); await page.waitForTimeout(600);
    assert.equal((await S(page)).units.find(u => u.id === boss.id).dead, true, 'the second fall is final');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('With a set advance turn, the enemy holds its ground until then and the mission box says when', async () => {
  const { ctx, page, errors } = await battle('q_clock');
  try {
    await park(page);
    let s = await S(page);
    assert.match(s.box, /3ターン目から進軍/);
    const foes = s.units.filter(u => u.side === 'enemy' && u.kind !== 'boss');
    assert(foes.every(u => u.hold && u.holdUntil === 3));
    // アリアを隅へ置く。近づかれていない敵は、1ターン目の敵の手番に動かない
    await page.evaluate(() => { const a = Board.__tac.state().units.find(u => u.kind === 'aria'); Board.__tac.place(a.id, { r: 0, c: 0 }); });
    const far = foes.filter(u => u.r + u.c > 8);
    assert(far.length > 0);
    await nextTurn(page);
    s = await S(page);
    assert.deepEqual(far.map(f => { const u = s.units.find(x => x.id === f.id); return u.r + ',' + u.c; }), far.map(u => u.r + ',' + u.c), 'they wait before the advance turn');
    await nextTurn(page);
    assert.match((await S(page)).box, /この手番の終わりから進軍/);
    await nextTurn(page);
    s = await S(page);
    assert(s.units.filter(u => foes.some(f => f.id === u.id) && !u.dead).every(u => !u.hold), 'from the enemy phase of turn 3 they all advance');
    assert.doesNotMatch(s.box, /進軍/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
