const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
let browsers, server, base;

// テストだけで使う戦闘の窓口。公開するJavaScriptには入れない。
const hook = `__portrait: {
  settle(){ settleView(); },
  state(){ const a=ariaU(); const p=a&&toScreen(unitXY(a).x,unitXY(a).y-tw*a.hgt*.5);
    return {running,busy,mode,phase,sel:sel&&sel.kind,moved:!!(a&&a.moved),z:view.z,ox:view.ox,oy:view.oy,W,H,frame,aria:p&&{x:p.x,y:p.y},menuTop:cmdMenu.classList.contains('hidden')?null:cmdMenu.offsetTop}; },
  // 光る移動先の縁のすぐ外で、指なら移動先、マウスなら別の床（か何もない所）になる点を探す
  edge(){
    if(!moveInfo) return null;
    const ok=moveInfo.ends;
    for(const id of ok){ const c=cells[id], p=topOf(c);
      for(let i=0;i<16;i++){ const a=i/16*Math.PI*2, d=1.18, ex=Math.cos(a), ey=Math.sin(a), k=d/(Math.abs(ex)+Math.abs(ey));
        const s=toScreen(p.x+ex*k*tw/2, p.y+ey*k*th/2);
        if(s.x<10||s.x>W-10||s.y<frame.top||s.y>H-frame.bottom) continue;
        const m=pick(s.x,s.y,false), t=pick(s.x,s.y,true);
        if(t===c && (!m || !ok.has(idx(m.r,m.c))) && !unitAt(m)) return {x:s.x,y:s.y,r:c.r,c:c.c}; } }
    return null; },
  // 光っていない歩ける床の真ん中は、指でもそのまま（行けない理由を知らせるため）
  plain(){
    if(!moveInfo) return null;
    for(const c of cells){ const id=idx(c.r,c.c); if(!c.walk||moveInfo.ends.has(id)||unitAt(c)) continue;
      const p=topOf(c), s=toScreen(p.x,p.y); if(s.x<20||s.x>W-20||s.y<frame.top||s.y>H-frame.bottom) continue;
      const t=pick(s.x,s.y,true); if(t===c) return {ok:true}; if(t&&moveInfo.ends.has(idx(t.r,t.c))) return {ok:false,r:c.r,c:c.c}; }
    return null; },
},
`;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => { try { const url = new URL(req.url, 'http://localhost'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) throw Error(); const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}/`;
  browsers = { chromium: await chromium.launch({ headless: true }), webkit: await webkit.launch({ headless: true }) };
});
after(async () => { for (const b of Object.values(browsers || {})) await b.close(); if (server) await new Promise(r => server.close(r)); });

async function boot(engine, settings, board = 'cove') {
  const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === 'chromium' });
  await ctx.addInitScript(s => { localStorage.setItem('cr_settings', JSON.stringify(s)); localStorage.setItem('cr_speed', '0'); }, settings);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8'), marker = '    start, enterPhase1, help, stop,';
  assert(source.includes(marker), 'the battle test hook must match the public API');
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace(marker, hook + marker) }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' });
  await page.locator('#gate').click();
  await page.evaluate(b => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS[b], tutorial: null, intro: null }, () => {}); }, board);
  await page.waitForFunction(() => Board.__portrait && Board.__portrait.state().running && !Board.__portrait.state().busy && Board.__portrait.state().sel === 'aria');
  return { ctx, page, errors };
}
const S = page => page.evaluate(() => Board.__portrait.state());
// 寄せの行き先を確かめる。WebKit は同時に動くと描画の手番（requestAnimationFrame）が止まることがあるので、
// 動き終わるのを待たず、行き先へ直接置いてから測る。滑らかに動くこと自体は、動きが進んでいることで確かめる。
const settle = async page => { await page.evaluate(() => Board.__portrait.settle()); return S(page); };

for (const engine of ['chromium', 'webkit'])
test(`${engine}: on a portrait phone the map centres the chosen ally without changing its size, keeps her above the menu, and returns to its place`, async () => {
  const { ctx, page, errors } = await boot(engine, { reduceMotion: false, textSize: 'normal' });
  try {
    let s = await settle(page);
    assert(s.frame, 'portrait layout has a free frame between the top chips and the bottom dock');
    assert.equal(s.z, 1, 'the map keeps its size');
    assert(Math.abs(s.aria.x - s.W / 2) < 1, 'Aria is centred across the screen: ' + s.aria.x);
    assert(Math.abs(s.aria.y - (s.frame.top + s.H - s.frame.bottom) / 2) < 1, 'Aria is centred in the free part of the screen: ' + s.aria.y);
    // 光る床の縁に指で触れると、外れずにその床へ動く
    const e = await page.evaluate(() => Board.__portrait.edge());
    assert(e, 'there is a point just outside a lit tile that only the finger snaps to');
    await page.touchscreen.tap(e.x, e.y);
    await page.waitForFunction(() => { const s = Board.__portrait.state(); return s.moved && !s.busy; });
    s = await settle(page);
    assert(s.menuTop != null, 'after moving, the action menu opens');
    assert(s.aria.y < s.menuTop, 'Aria stays above the action menu: ' + s.aria.y + ' < ' + s.menuTop);
    assert.equal(s.z, 1, 'the map still keeps its size');
    // 選び直すと、盤の全体へ戻る
    await page.locator('#cancelSel').click();
    await page.waitForFunction(() => !Board.__portrait.state().moved);
    await page.locator('#cancelSel').click();
    await page.waitForFunction(() => Board.__portrait.state().sel === null);
    s = await settle(page);
    assert(Math.abs(s.z - 1) < 0.01 && Math.abs(s.ox) < 1 && Math.abs(s.oy) < 1, 'without a chosen ally the map returns to its place: ' + JSON.stringify([s.z, s.ox, s.oy]));
    assert.match(await page.locator('#phaseLabel').textContent(), /味方を選んで/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('With reduced motion the map never moves by itself, and a finger in the middle of an unlit tile is not pulled to a lit one', async () => {
  const { ctx, page, errors } = await boot('chromium', { reduceMotion: true, textSize: 'normal' });
  try {
    await page.waitForTimeout(400);
    const s = await S(page);
    assert.equal(s.z, 1, 'reduced motion keeps the map still');
    const plain = await page.evaluate(() => Board.__portrait.plain());
    assert(plain && plain.ok, 'the centre of an unlit tile still picks that tile: ' + JSON.stringify(plain));
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('The battle brightness setting lights the board on phones by default and can be changed', async () => {
  const { ctx, page, errors } = await boot('chromium', { reduceMotion: true, textSize: 'normal' });
  try {
    const filter = () => page.evaluate(() => getComputedStyle(document.getElementById('boardCanvas')).filter);
    assert.match(await filter(), /brightness\(1\.18\)/, 'auto brightens the board on a phone');
    // 文字と操作の欄には掛けない
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('cmdBar')).filter), 'none');
    await page.evaluate(() => Main.settings());
    await page.locator('#battleLight [data-v="brighter"]').click();
    assert.match(await filter(), /brightness\(1\.36\)/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cr_settings')).battleLight), 'brighter');
    await page.locator('#battleLight [data-v="normal"]').click();
    assert.equal(await filter(), 'none');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('On a computer the board keeps its look and the map does not move in by itself', async () => {
  const ctx = await browsers.chromium.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: false, textSize: 'normal' })); });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8');
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: source.replace('    start, enterPhase1, help, stop,', hook + '    start, enterPhase1, help, stop,') }));
  try {
    await page.goto(base + '#world', { waitUntil: 'networkidle' });
    await page.locator('#gate').click();
    await page.evaluate(() => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS.cove, tutorial: null, intro: null }, () => {}); });
    await page.waitForFunction(() => Board.__portrait && Board.__portrait.state().sel === 'aria' && !Board.__portrait.state().busy);
    await page.waitForTimeout(500);
    const s = await S(page);
    assert.equal(s.z, 1);
    assert.equal(s.frame, null);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('boardCanvas')).filter), 'none');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
