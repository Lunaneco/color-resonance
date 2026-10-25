const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const stillCamera=require('./still-camera.cjs');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let browser, server, base;

// テストだけで使う戦闘の窓口。公開するJavaScriptには入れない。
const hook = `__pinch: {
  state(){ const a=ariaU(); const p=a&&toScreen(unitXY(a).x,unitXY(a).y-tw*a.hgt*.5); const c=p&&pick(p.x,p.y);
    return {running,busy,mode,sel:sel&&sel.kind,z:view.z,ox:view.ox,oy:view.oy,W,H,aria:p&&{x:p.x,y:p.y},picked:c&&{r:c.r,c:c.c},ariaCell:a&&{r:a.r,c:a.c}}; },
},
`;
before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => { try { const url = new URL(req.url, 'http://localhost'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) throw Error(); const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); });

async function boot() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { localStorage.setItem('cr_settings', JSON.stringify({ reduceMotion: true, textSize: 'normal' })); });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const source = await fs.readFile(path.join(root, 'js/board.js'), 'utf8'), marker = '    start, enterPhase1, help, stop,';
  assert(source.includes(marker), 'the battle test hook must match the public API');
  await page.route('**/js/board.js*', r => r.fulfill({ contentType: 'application/javascript', body: stillCamera(source.replace(marker, hook + marker)) }));
  await page.goto(base + '#world', { waitUntil: 'networkidle' });
  await page.locator('#gate').click();
  await page.evaluate(() => { World.close(); Engine.resetStage(); document.getElementById('title').style.display = 'none'; Board.start({ ...BOARDS.cove, tutorial: null, intro: null }, () => {}); });
  await page.waitForFunction(() => Board.__pinch && Board.__pinch.state().running && !Board.__pinch.state().busy);
  return { ctx, page, errors, cdp: await ctx.newCDPSession(page) };
}
// CDP で2本指のタッチを送る（Playwrightのtouchscreenは1本指だけ）。
async function pinch(cdp, cx, cy, from, to, steps = 6) {
  const pts = d => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + (to - from) * i / steps) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const S = page => page.evaluate(() => Board.__pinch.state());

test('Two fingers zoom the battle map around the pinch, taps still pick the right tile, and no tile is chosen by the pinch', async () => {
  const { ctx, page, errors, cdp } = await boot();
  try {
    // 戦闘の始まりはアリアが選ばれているので、いったん外す
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    let s = await S(page);
    assert.equal(s.sel, null);
    assert.equal(s.z, 1);
    assert.deepEqual(s.picked, s.ariaCell, 'before zooming, Aria’s screen position picks her tile');
    await pinch(cdp, s.aria.x, s.aria.y, 80, 240);
    await page.waitForTimeout(200);
    s = await S(page);
    assert(s.z > 1.8, 'spreading two fingers zooms in: ' + s.z);
    assert(s.z <= 2.5, 'zoom stays within its limit');
    assert.equal(s.sel, null, 'the pinch does not select anything');
    assert.deepEqual(s.picked, s.ariaCell, 'while zoomed, Aria’s screen position still picks her tile');
    assert(s.aria.x > -1 && s.aria.x < s.W + 1 && s.aria.y > -1 && s.aria.y < s.H + 1, 'the pinched point stays on screen');
    // 1本指のタップは、今までどおり人や床を選ぶ
    await page.touchscreen.tap(s.aria.x, s.aria.y);
    await page.waitForTimeout(250);
    assert.equal((await S(page)).sel, 'aria');
    // つまんで小さくする。下限より小さくはならない
    await pinch(cdp, s.W / 2, s.H / 2, 300, 40);
    await page.waitForTimeout(200);
    s = await S(page);
    assert(s.z >= 0.75 && s.z < 1, 'pinching in zooms out to the lower limit: ' + s.z);
    assert.deepEqual(s.picked, s.ariaCell, 'zoomed out, picking still matches');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
