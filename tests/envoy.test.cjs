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
test('The envoy camp battles are part of the story in three towns, not side trips, and Terra Cotta still has no battle', async () => {
  const c = await content();
  const r = JSON.parse(vm.runInContext(`JSON.stringify({ boards: CAMP_BATTLES.map(e => ({ id: e.id, chapter: e.chapter, town: e.town, mode: BOARDS[e.id].encounter.objective, camps: !!BOARDS[e.id].encounter.camps })),
    act1: SCRIPT.act1, act2: SCRIPT.act2, act4: SCRIPT.act4, act5: SCRIPT.act5, legacy: Envoy.LEGACY.map(k => SCRIPT[k].trim()), sides: Object.keys(EXTRA_SIDE_STORIES) })`, c));
  assert.deepEqual(r.boards.map(b => [b.id, b.chapter, b.town]), [['camp_port', 'act1', 'aquamist'], ['camp_valley', 'act4', 'stone'], ['camp_town', 'act5', 'rainbow']]);
  assert(r.boards.every(b => b.mode === 'camps' && b.camps));
  for (const [key, id, before, boss] of [['act1', 'camp_port', 'gp_gran', 'gran'], ['act4', 'camp_valley', 'gp_spinel', 'spinel'], ['act5', 'camp_town', 'gp_king', 'king']]) {
    const s = r[key], at = w => s.indexOf('@board ' + w);
    assert(at(before) >= 0 && at(before) < at(id) && at(id) < at(boss), `${key}: ${id} happens in the story between ${before} and ${boss}`);
  }
  assert(!/^@board/m.test(r.act2), 'Terra Cotta keeps its no-battle rule');
  for (const s of [r.act1, r.act4, r.act5]) assert(!/^ノアール「/m.test(s), 'Noir still does not speak before the finale');
  assert(r.legacy.every(t => t === '@sideend'), 'old side-trip saves only return to their checkpoint');
  assert.match(r.act1, /黒い旗/); assert.match(r.act1, /針みたいな字/);
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
const hook = `__camp: {
  state(){ return {running,busy,over,turn,phase,cp,cpMax,hud:document.getElementById('kegareCount').textContent,
    camps:cells.filter(c=>c.camp).map(c=>({r:c.r,c:c.c,owner:c.camp.owner,hq:!!c.camp.hq,floor:c.floor})),
    units:units.map(u=>({id:u.id,kind:u.kind,side:u.side,hp:u.hp,mhp:u.mhp,r:u.r,c:u.c,dead:!!u.dead,acted:!!u.acted,mov:u.mov,captain:!!u.captain,cmd:u.commander?u.commander.id:null,name:u.name,atk:u.atk,rng:u.rng,ambush:!!u.ambush}))}; },
  place(id, extra){ Object.assign(units.find(u=>u.id===id), extra); refreshHud(); },
  actHit(a, d){ const u=units.find(x=>x.id===a), o=units.find(x=>x.id===d); select(u,true); return act(u, () => attack(u, o, { normal:true }), true); },
  capture(id){ return tryCapture(units.find(u=>u.id===id)); },
  intercept(id){ return intercept(units.find(u=>u.id===id)); },
  kill(id){ const u=units.find(x=>x.id===id); u.hp=0; return defeat(u, ariaU()); },
  summonCells(){ return [...summonCells(ariaU())].map(i=>({r:cells[i].r,c:cells[i].c})); },
  map(){ return { cols, rows, blocked: cells.filter(c=>c.house||c.wall).map(c=>({r:c.r,c:c.c,walk:c.walk})), cover: cells.filter(c=>c.cover).map(c=>({r:c.r,c:c.c})), pier: cells.filter(c=>c.pier&&c.walk).length }; },
  dmg(a, d, cover){ const A=units.find(x=>x.id===a), D=units.find(x=>x.id===d), c=cellOf(D), old=c.cover; c.cover=cover; const v=calcDamage(A,D,{},null,false).dmg; c.cover=old; return v; },
  fog(){ const vis=visibleSet(); return { on: FOG(), vis: [...vis].map(i=>({r:cells[i].r,c:cells[i].c})), lurking: live().filter(u=>lurking(u,vis)).map(u=>u.id), targets: [...attackTargets(ariaU())], danger: [...dangerCells()].length }; },
  seenAt(r,c){ const u=seenAt(cellAt(r,c)); return u ? u.id : null; },
  enemyAct(id){ return enemyAct(units.find(u=>u.id===id)); },
  reinforce(t){ turn=t; return campReinforce(); },
  hqTargets(id){ return raids(units.find(u=>u.id===id)); },
  rainbowAround(r,c,d){ return cells.filter(x=>Math.abs(x.r-r)+Math.abs(x.c-c)<=d).filter(x=>x.walk).map(x=>x.floor); },
},
`;
async function battle(id, unlocked = ['prologue', 'act1', 'act2', 'act3', 'fury', 'vardbond', 'act4', 'act5', 'finale']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(u => { localStorage.setItem('cr_unlocked', JSON.stringify(u)); localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true })); localStorage.setItem('cr_speed', '0'); localStorage.setItem('cr_party', JSON.stringify({ aria: { lv: 30, exp: 0 }, noir: { joined: true, lv: 30, exp: 0, skills: [], known: {} }, gold: 0 })); }, unlocked);
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8'), marker = '    start, enterPhase1, help, stop,';
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace(marker, hook + marker) }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' }); await page.locator('#gate').click();
  if (id) {
    await page.evaluate(id => { Math.random = () => 0.5; World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS[id], intro: null }, () => {}); }, id);
    await page.waitForFunction(() => Board.__camp && Board.__camp.state().running && !Board.__camp.state().busy && Board.__camp.state().phase === 'player', {}, { timeout: 20000 });
  }
  return { ctx, page, errors };
}
const S = page => page.evaluate(() => Board.__camp.state());
const idle = page => page.waitForFunction(() => { const s = Board.__camp.state(); return s.over || !s.busy; }, {}, { timeout: 20000 });

test('Camps, command points, re-action with shrinking movement, capture painting the floor, interception and summons beside camps', async () => {
  const { ctx, page, errors } = await battle('camp_port');
  try {
    let s = await S(page);
    const allyHq = s.camps.find(c => c.hq && c.owner === 'ally'), enemyHq = s.camps.find(c => c.hq && c.owner === 'enemy');
    const aria = s.units.find(u => u.kind === 'aria'), cap = s.units.find(u => u.captain);
    assert(allyHq && enemyHq, 'each side has a headquarters');
    assert.deepEqual([allyHq.r, allyHq.c], [aria.r, aria.c], 'the player headquarters is where Aria starts');
    assert.deepEqual([cap.r, cap.c], [enemyHq.r, enemyHq.c], 'the captain guards the enemy headquarters');
    assert.equal(s.camps.filter(c => c.owner === 'neutral').length, 2); assert.equal(s.camps.filter(c => c.owner === 'enemy' && !c.hq).length, 1);
    assert.equal(s.cp, 4, '3 command points plus one for the headquarters'); assert.match(s.hud, /指揮4\/4/);
    // 行動すると指揮点を1使い、同じアリアがまた動ける（移動は1減る）
    const foe = s.units.find(u => u.kind === 's_lance');
    await page.evaluate(({ a, f, r, c }) => { Board.__camp.place(f, { r: r - 1 >= 0 ? r - 1 : r + 1, c, hp: 9999, mhp: 9999 }); }, { a: aria.id, f: foe.id, r: aria.r, c: aria.c });
    const mov0 = aria.mov;
    await page.evaluate(({ a, f }) => Board.__camp.actHit(a, f), { a: aria.id, f: foe.id }); await idle(page);
    s = await S(page);
    let me = s.units.find(u => u.id === aria.id);
    assert.equal(s.cp, 3); assert.equal(me.acted, false, 'Aria may act again while points remain'); assert.equal(me.mov, mov0 - 1, 'a second action moves one tile less');
    // 迎撃：敵の攻撃範囲にいるアリアへ、敵が打ちこむ
    const hp0 = me.hp;
    await page.evaluate(id => Board.__camp.intercept(id), aria.id); await idle(page);
    assert((await S(page)).units.find(u => u.id === aria.id).hp < hp0, 'an enemy in range intercepts');
    // 中立の拠点：隣に敵がいなければ、アリアが立つと奪える。周りの床が虹に染まる
    await page.evaluate(id => Board.__camp.place(id, { r: 0, c: 0 }), foe.id);
    const neutral = (await S(page)).camps.find(c => c.owner === 'neutral');
    await page.evaluate(({ a, n }) => { const s = Board.__camp.state(); s.units.filter(u => u.side === 'enemy' && Math.abs(u.r - n.r) + Math.abs(u.c - n.c) <= 1).forEach(u => Board.__camp.place(u.id, { r: 0, c: 0 })); Board.__camp.place(a, { r: n.r, c: n.c }); }, { a: aria.id, n: neutral });
    await page.evaluate(id => Board.__camp.capture(id), aria.id); await idle(page);
    s = await S(page);
    assert.equal(s.camps.find(c => c.r === neutral.r && c.c === neutral.c).owner, 'ally');
    const around = await page.evaluate(n => Board.__camp.rainbowAround(n.r, n.c, 2), neutral);
    assert(around.filter(f => f === 'rainbow').length >= Math.ceil(around.length * 0.8), 'capturing paints the floor around it rainbow');
    assert((await page.evaluate(() => Board.__camp.summonCells())).some(c => Math.abs(c.r - neutral.r) + Math.abs(c.c - neutral.c) <= 1), 'spirits can be summoned beside a held camp');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('Each camp battle is fought on its hand-drawn map: flags, captain, soldiers and Aria stand where the map marks them, houses block, sandbags cover', async () => {
  for (const id of ['camp_port', 'camp_valley', 'camp_town']) {
    const { ctx, page, errors } = await battle(id);
    try {
      const L = await page.evaluate(id => CAMP_LAYOUTS[id], id), s = await S(page), m = await page.evaluate(() => Board.__camp.map());
      const marks = ch => L.marks.flatMap((row, r) => [...row].map((k, c) => k === ch ? [r, c] : null)).filter(Boolean);
      const key = x => x.map(([r, c]) => r + ',' + c).sort();
      assert.deepEqual([m.cols, m.rows], [L.ground[0].length, L.ground.length], `${id}: the board is the size of its map`);
      const aria = s.units.find(u => u.kind === 'aria'), cap = s.units.find(u => u.captain);
      assert.deepEqual([[aria.r, aria.c]], marks('A'), `${id}: Aria starts on the marked headquarters`);
      assert.deepEqual([[cap.r, cap.c]], marks('E'), `${id}: the captain holds the marked enemy headquarters`);
      assert.deepEqual(key(s.camps.filter(c => c.owner === 'neutral').map(c => [c.r, c.c])), key(marks('n')), `${id}: neutral flags`);
      assert.deepEqual(key(s.camps.filter(c => c.owner === 'enemy' && !c.hq).map(c => [c.r, c.c])), key(marks('e')), `${id}: enemy flags`);
      const posts = '123456789'.split('').flatMap(marks), soldiers = s.units.filter(u => u.side === 'enemy' && !u.captain && !u.cmd && !u.ambush).map(u => [u.r, u.c]);
      assert.deepEqual(key(soldiers), key(posts), `${id}: every soldier stands on a marked post`);
      assert(m.blocked.length > 0 && m.blocked.every(c => !c.walk), `${id}: houses and walls cannot be walked through`);
      assert.deepEqual(key(m.cover.map(c => [c.r, c.c])), key(marks('s')), `${id}: sandbags are where the map marks them`);
      assert(s.camps.filter(c => c.owner === 'enemy').every(c => c.floor === 'dull'), `${id}: enemy flags start on dull floor`);
      if (id === 'camp_port') assert(m.pier > 0, 'the harbour has walkable piers');
      // 虹の近衛：本陣の隊長と、敵の旗ごとに一人
      const guards = await page.evaluate(id => BOARDS[id].encounter.camps.commanders.map(g => g.id), id);
      const cmds = s.units.filter(u => u.cmd);
      assert.equal(cap.cmd, guards[0], `${id}: the headquarters captain is ${guards[0]}`);
      assert.deepEqual(key(cmds.filter(u => !u.captain).map(u => [u.r, u.c])), key(marks('e')), `${id}: a guard stands on every enemy flag`);
      assert.deepEqual(cmds.map(u => u.cmd).sort(), guards.slice().sort());
      const plain = s.units.find(u => u.side === 'enemy' && !u.cmd && !u.captain);
      assert(cmds.every(u => u.mhp > plain.mhp), `${id}: guards are much tougher than soldiers`);
      // 土嚢：離れた弓の矢は4割減る。隣からの攻撃には効かない
      const bow = s.units.find(u => u.kind === 's_bow');
      await page.evaluate(a => Board.__camp.place(a, { def: 0 }), aria.id);
      const pos = await page.evaluate(({ a, b }) => { const cand = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dr, dc]) => ({ r: b.r + dr, c: b.c + dc })); const ok = cand.find(p => p.r >= 0 && p.c >= 0 && p.r < Board.__camp.map().rows && p.c < Board.__camp.map().cols); Board.__camp.place(a, ok); return ok; }, { a: aria.id, b: bow });
      assert(pos);
      const far = await page.evaluate(({ b, a }) => [Board.__camp.dmg(b, a, false), Board.__camp.dmg(b, a, true)], { a: aria.id, b: bow.id });
      assert(far[1] < far[0] && Math.abs(far[1] - Math.max(1, Math.round(far[0] * 0.6))) <= 1, `${id}: sandbags cut a ranged hit by 40% (${far})`);
      await page.evaluate(({ a, b }) => Board.__camp.place(a, { r: b.r, c: b.c + 1 < Board.__camp.map().cols ? b.c + 1 : b.c - 1 }), { a: aria.id, b: bow });
      const near = await page.evaluate(({ b, a }) => [Board.__camp.dmg(b, a, false), Board.__camp.dmg(b, a, true)], { a: aria.id, b: bow.id });
      assert.equal(near[0], near[1], `${id}: sandbags do not help against a neighbour`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
});
test('Fog: only the cells near allies, the rainbow floor and its edge, and own flags are visible; hidden soldiers cannot be seen, picked, targeted or shown as danger', async () => {
  const { ctx, page, errors } = await battle('camp_port');
  try {
    const s = await S(page), F = () => page.evaluate(() => Board.__camp.fog());
    let f = await F();
    assert.equal(f.on, true);
    const aria = s.units.find(u => u.kind === 'aria'), noir = s.units.find(u => u.kind === 'noir'), cap = s.units.find(u => u.captain), foe = s.units.find(u => u.kind === 's_sword');
    const visOf = f => new Set(f.vis.map(c => c.r + ',' + c.c));
    let vis = visOf(f);
    assert(vis.has(aria.r + ',' + aria.c) && !vis.has(cap.r + ',' + cap.c), 'Aria’s tile is visible, the far headquarters is not');
    assert(f.lurking.includes(cap.id), 'the captain lurks in the fog');
    assert.equal(await page.evaluate(({ r, c }) => Board.__camp.seenAt(r, c), cap), null, 'a lurking soldier cannot be picked');
    assert.equal(f.lurking.length, s.units.filter(u => u.side === 'enemy').length, 'at the start every soldier is in the fog');
    assert.equal(f.danger, 0, 'so the danger zone shows nothing yet');
    // 藍のシオンが立っているあいだは霧が濃い。ノアールでも4マス
    await page.evaluate(n => Board.__camp.place(n, { r: 5, c: 4 }), noir.id);
    vis = visOf(await F());
    assert(vis.has('1,4') && !vis.has('0,4'), 'while the indigo guard stands, the fog is thick: Noir sees four tiles');
    // シオンを解放すると霧が薄れ、ノアールは斥候として5マス先まで見える。ほかの仲間は3マス
    const sion = s.units.find(u => u.cmd === 'sion');
    await page.evaluate(id => Board.__camp.kill(id), sion.id); await idle(page);
    await page.evaluate(n => Board.__camp.place(n, { r: 5, c: 4 }), noir.id);
    vis = visOf(await F());
    assert(vis.has('0,4') && !vis.has('0,3'), 'Noir sees five tiles away, no further');
    // 霧の中の敵は狙えない。見えれば狙える
    await page.evaluate(({ a, f, n }) => { Board.__camp.place(n, { r: 10, c: 12 }); Board.__camp.place(f, { r: 5, c: 3 }); Board.__camp.place(a, { r: 8, c: 3 }); }, { a: aria.id, f: foe.id, n: noir.id });
    f = await F();
    assert(!f.lurking.includes(foe.id), 'a soldier within three tiles of Aria is seen');
    await page.evaluate(({ f }) => Board.__camp.place(f, { r: 4, c: 3 }), { f: foe.id });
    f = await F();
    assert(f.lurking.includes(foe.id), 'four tiles away, outside the rainbow, the soldier hides again');
    await page.evaluate(({ f }) => Board.__camp.place(f, { r: 7, c: 3 }), { f: foe.id });
    assert((await F()).targets.length > 0, 'a seen neighbour can be attacked');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('Rainbow guards never leave their flag, freeing a guard stops its flag’s reinforcements, and freeing one paints the floor', async () => {
  const { ctx, page, errors } = await battle('camp_town');
  try {
    let s = await S(page);
    const aria = s.units.find(u => u.kind === 'aria'), viola = s.units.find(u => u.cmd === 'viola'), verde = s.units.find(u => u.cmd === 'verde'), carmine = s.units.find(u => u.cmd === 'carmine');
    assert.equal(viola.captain, true);
    // アリアがヴィオラの射程の少し外に来ても、ヴィオラは門を離れない
    await page.evaluate(({ a, v }) => Board.__camp.place(a, { r: v.r + 4, c: v.c }), { a: aria.id, v: viola });
    await page.evaluate(id => Board.__camp.enemyAct(id), viola.id); await idle(page);
    s = await S(page);
    const v2 = s.units.find(u => u.id === viola.id);
    assert.deepEqual([v2.r, v2.c], [viola.r, viola.c], 'the guard captain stays on the gate');
    // 増援：ヴェルデが立つ旗からは兵が出る。ヴェルデを解放すると出なくなる
    const count = () => page.evaluate(() => Board.__camp.state().units.filter(u => u.side === 'enemy' && !u.dead).length);
    let n0 = await count();
    await page.evaluate(() => Board.__camp.reinforce(4)); await idle(page);
    const n1 = await count();
    assert.equal(n1 - n0, 2, 'both guarded flags send a soldier');
    await page.evaluate(id => Board.__camp.kill(id), verde.id); await idle(page);
    const around = await page.evaluate(v => Board.__camp.rainbowAround(v.r, v.c, 2), verde);
    assert(around.filter(f => f === 'rainbow').length >= Math.ceil(around.length * 0.8), 'the guard’s colour comes back to the floor around them');
    // 増援の上限に届かないよう、ふつうの兵を三人解放してから数える
    for (const u of (await S(page)).units.filter(u => u.side === 'enemy' && !u.cmd && !u.captain && !u.dead).slice(0, 3)) { await page.evaluate(id => Board.__camp.kill(id), u.id); await idle(page); }
    n0 = await count();
    await page.evaluate(() => Board.__camp.reinforce(8)); await idle(page);
    assert.equal((await count()) - n0, 1, 'the freed guard’s flag sends no one');
    assert.equal(await page.evaluate(id => Board.__camp.hqTargets(id), carmine.id), true, 'the red rider raids the headquarters');
    assert.equal(await page.evaluate(id => Board.__camp.hqTargets(id), s.units.find(u => u.kind === 's_bow' && !u.cmd).id), false, 'archers do not');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('Taking the enemy headquarters wins; losing your own headquarters loses', async () => {
  {
    const { ctx, page, errors } = await battle('camp_port');
    try {
      const s = await S(page), hq = s.camps.find(c => c.hq && c.owner === 'enemy'), aria = s.units.find(u => u.kind === 'aria'), cap = s.units.find(u => u.captain);
      await page.evaluate(id => Board.__camp.kill(id), cap.id);
      await page.evaluate(({ a, hq }) => { const s = Board.__camp.state(); s.units.filter(u => u.side === 'enemy' && !u.dead && Math.abs(u.r - hq.r) + Math.abs(u.c - hq.c) <= 1).forEach(u => Board.__camp.place(u.id, { r: 0, c: 0 })); Board.__camp.place(a, { r: hq.r, c: hq.c }); return Board.__camp.capture(a); }, { a: aria.id, hq });
      await page.waitForFunction(() => Board.__camp.state().over, {}, { timeout: 10000 });
      assert(!(await page.locator('#resRetry').isVisible()), 'won by taking the headquarters');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
  {
    const { ctx, page } = await battle('camp_port');
    try {
      const s = await S(page), hq = s.camps.find(c => c.hq && c.owner === 'ally'), aria = s.units.find(u => u.kind === 'aria'), foe = s.units.find(u => u.kind === 's_sword');
      await page.evaluate(({ a, f, hq }) => { Board.__camp.place(a, { r: hq.r <= 4 ? 9 : 0, c: hq.c <= 5 ? 11 : 0 }); const s = Board.__camp.state(); s.units.filter(u => u.side === 'ally' && u.kind !== 'aria').forEach(u => Board.__camp.place(u.id, { r: hq.r <= 4 ? 9 : 0, c: hq.c <= 5 ? 10 : 1 })); Board.__camp.place(f, { r: hq.r, c: hq.c }); return Board.__camp.capture(f); }, { a: aria.id, f: foe.id, hq });
      await page.locator('#resRetry').waitFor({ timeout: 10000 });
    } finally { await ctx.close(); }
  }
});
test('Once the story battle is behind, the town offers it again from the map', async () => {
  const { ctx, page, errors } = await battle(null, ['prologue', 'act1']);
  try {
    await page.evaluate(() => World.open({ at: 'aquamist' })); await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=envoy]').count(), 0, 'not before the first act is read');
    await page.evaluate(() => { localStorage.cr_unlocked = JSON.stringify(['prologue', 'act1', 'act2']); World.open({ at: 'aquamist' }); });
    await page.locator('#wmPanel:not(.hidden) .wp-name').waitFor();
    assert.equal(await page.locator('#wmPanel [data-a=envoy][data-id=camp_port]').count(), 1);
    await page.evaluate(() => { Board.start = (conf, done) => { window.__conf = { id: conf.id, mode: conf.encounter.objective }; return Promise.resolve(true); }; });
    await page.locator('#wmPanel [data-a=envoy]').click();
    assert.deepEqual(await page.evaluate(() => window.__conf), { id: 'camp_port', mode: 'camps' });
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
