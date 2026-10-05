const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const fullJourney = {
  cr_unlocked: JSON.stringify(['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue']),
  cr_save: JSON.stringify({ chapter: 'act4', idx: 0, map: true }),
};
let server, browser, context, page, base, errors;

before(async () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});
afterEach(async () => {
  if (context) await context.close();
  context = null;
  assert.deepEqual(errors || [], [], 'Game UI must have no runtime errors or failed game requests');
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function boot(viewport = { width: 1440, height: 900 }, storage = fullJourney, options = {}, openGate = true) {
  errors = [];
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 900, ...options });
  await context.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, storage);
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(base, { waitUntil: 'networkidle' });
  if (!openGate) return;
  await page.locator('#gate').focus();
  await page.keyboard.press('Enter');
  await page.locator('#gate').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.classList.contains('t-primary'));
}
async function fits(selector) {
  const box = await page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, reachable: element === hit || element.contains(hit) };
  });
  assert(box.x >= -0.5 && box.y >= -0.5 && box.right <= box.viewportWidth + 0.5 && box.bottom <= box.viewportHeight + 0.5, `${selector} must fit: ${JSON.stringify(box)}`);
  assert(box.reachable, `${selector} must not be covered by artwork or another control`);
  return box;
}
async function settings() {
  await page.locator('[data-m=settings]').click();
  await page.waitForFunction(() => Panel.isOpen());
  await page.waitForTimeout(50);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 480 }, { width: 667, height: 375 }]) {
  test(`Title, keyboard guide and world navigation are usable at ${viewport.width} × ${viewport.height}`, async () => {
    await boot(viewport);
    assert((await page.locator('.t-save-summary').textContent()).includes('第四幕'));
    for (const action of ['new', 'continue', 'chapters', 'world', 'settings', 'guide', 'journal', 'about']) {
      const box = await fits(`[data-m=${action}]`);
      assert(box.height >= 33, 'Title controls must remain large enough to activate');
    }
    await page.locator('[data-m=guide]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Panel.isOpen());
    assert.equal(await page.locator('.pn-title').textContent(), '旅のはじめかた');
    assert((await page.locator('.pn-body').textContent()).includes('背後は +25%'));
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => !!document.activeElement.closest('#panel')), 'Panel must keep keyboard focus inside');
    }
    await page.keyboard.press('Escape');
    assert(!await page.evaluate(() => Panel.isOpen()));
    assert.equal(await page.evaluate(() => document.activeElement.dataset.m), 'guide', 'Closing the guide must restore its entry control');
    await page.locator('[data-m=settings]').click();
    await fits('.pn-close');
    await page.locator('#exportSave').scrollIntoViewIfNeeded();
    await fits('#exportSave');
    await page.locator('.pn-close').click();
    await page.locator('[data-m=world]').click();
    await page.waitForFunction(() => World.isOpen);
    for (const action of ['quests', 'games', 'journal', 'equip', 'party', 'title']) {
      await page.locator(`[data-w=${action}]`).scrollIntoViewIfNeeded();
      await fits(`[data-w=${action}]`);
    }
    await page.locator('[data-w=quests]').click();
    await page.waitForFunction(() => Panel.isOpen());
    assert((await page.locator('.pn-body').textContent()).includes('依頼'));
    assert(await page.locator('.quest-card').count() > 0);
    await fits('.pn-close');
  });
}

test('Volume, text size and reduced motion apply immediately and survive reload', async () => {
  await boot({ width: 390, height: 844 }, fullJourney, { reducedMotion: 'reduce' });
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced', 'OS motion preference must be respected on first visit');
  await settings();
  assert.equal(await page.locator('label[for=vB]').textContent(), '音楽');
  await page.locator('#vB').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#vBValue').textContent(), '0%');
  assert.equal(await page.evaluate(() => Audio2.vol.bgm), 0);
  await page.locator('#textSize [data-v=large]').click();
  await page.locator('#reduceMotion').uncheck();
  assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
  assert.equal(await page.locator('#textSize [data-v=large]').getAttribute('aria-pressed'), 'true');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cr_settings')));
  assert.deepEqual(stored, { reduceMotion: false, textSize: 'large' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#gate').press('Enter');
  await page.locator('#gate').waitFor({ state: 'detached' });
  assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
  assert.equal(await page.evaluate(() => Audio2.vol.bgm), 0);
});

test('The quiet start option reaches the title with music and effects muted', async () => {
  await boot({ width: 320, height: 480 }, {}, {}, false);
  await fits('.g-quiet');
  await page.locator('.g-quiet').tap();
  await page.locator('#gate').waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => ({ ...Audio2.vol })), { bgm: 0, sfx: 0 });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cr_vol'))), { bgm: 0, sfx: 0 });
  assert(await page.locator('[data-m=new]').isEnabled());
  assert(await page.locator('#title').isVisible());
});

test('The completed story points to the remaining journey and the journal remains accessible', async () => {
  await boot({ width: 390, height: 844 }, { ...fullJourney, cr_unlocked: JSON.stringify([...JSON.parse(fullJourney.cr_unlocked), 'done']) });
  assert((await page.locator('.t-save-summary').textContent()).includes('物語を読み終えました'));
  assert.equal(await page.evaluate(() => document.querySelector('.t-primary').dataset.m), 'world');
  await fits('[data-m=journal]');
  await page.locator('[data-m=journal]').click();
  assert.equal(await page.locator('.pn-title').textContent(), '旅の手帳');
  assert((await page.locator('#journal-page').textContent()).includes('読み終えた物語'));
  await page.locator('.pn-close').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.m), 'journal');
});

test('Save file preview never changes progress before confirmation; previous journey can be restored', async () => {
  await boot();
  await page.evaluate(() => { Board.party.gold = 123; Board.saveParty(); });
  const source = await page.evaluate(() => SaveData.exportText());
  const imported = JSON.parse(source);
  const party = JSON.parse(imported.data.cr_party);
  party.aria.lv = 7; party.aria.exp = 0; party.gold = 845;
  imported.data.cr_party = JSON.stringify(party);
  imported.data.cr_save = JSON.stringify({ chapter: 'act2', idx: 0, map: true });
  imported.data.cr_settings = JSON.stringify({ reduceMotion: true, textSize: 'large' });
  await settings();
  await page.locator('#importSave').setInputFiles({ name: 'journey.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('#importConfirm').waitFor();
  assert((await page.locator('#savePreview').textContent()).includes('アリア LV 7'));
  assert.equal(await page.evaluate(() => Board.party.gold), 123);
  assert.equal(await page.evaluate(() => Engine.load().chapter), 'act4');
  await page.locator('#importConfirm').click();
  await page.waitForFunction(() => !Panel.isOpen());
  assert.equal(await page.evaluate(() => Board.party.gold), 845);
  assert.equal(await page.evaluate(() => Engine.load().chapter), 'act2');
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced');
  assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
  await settings();
  await page.locator('#restoreSave').click();
  assert.equal(await page.evaluate(() => Board.party.gold), 845, 'Restoring also requires concrete confirmation');
  await page.locator('#restoreConfirm').click();
  await page.waitForFunction(() => !Panel.isOpen());
  assert.equal(await page.evaluate(() => Board.party.gold), 123);
  assert.equal(await page.evaluate(() => Engine.load().chapter), 'act4');
});

test('Malformed save files are rejected without touching the current journey', async () => {
  await boot();
  const before = await page.evaluate(() => localStorage.getItem('cr_save'));
  await settings();
  await page.locator('#importSave').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"color-resonance","version":1,"data":{"cr_save":"<script>"}}') });
  await page.waitForFunction(() => document.getElementById('saveStatus').classList.contains('error'));
  assert.equal(await page.evaluate(() => localStorage.getItem('cr_save')), before);
  assert.equal(await page.locator('#importConfirm').count(), 0);
  assert(!await page.locator('#savePreview').isVisible());
});

test('Exported journey file contains the current game record', async () => {
  await boot();
  await page.evaluate(() => { Board.party.gold = 314; Board.saveParty(); });
  await settings();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportSave').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^color-resonance-save-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.equal(saved.format, 'color-resonance');
  assert.equal(JSON.parse(saved.data.cr_party).gold, 314);
  assert.equal(JSON.parse(saved.data.cr_save).chapter, 'act4');
});

test('Starting a new journey requires confirmation and resets party while preserving settings and backup', async () => {
  await boot({ width: 320, height: 480 }, { ...fullJourney, cr_settings: JSON.stringify({ reduceMotion: true, textSize: 'large' }) });
  await page.evaluate(() => { Board.party.aria.lv = 8; Board.party.gold = 777; Board.saveParty(); });
  await page.locator('[data-m=new]').click();
  assert(await page.evaluate(() => Panel.isOpen()));
  assert.equal(await page.evaluate(() => Board.party.aria.lv), 8);
  await fits('#newContinue'); await fits('#newConfirm');
  await page.locator('#newConfirm').click();
  await page.waitForFunction(() => Engine.chapter === 'prologue');
  assert.equal(await page.evaluate(() => Board.party.aria.lv), 1);
  assert.equal(await page.evaluate(() => Board.party.gold), 0);
  assert(await page.evaluate(() => SaveData.hasBackup()));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cr_settings'))), { reduceMotion: true, textSize: 'large' });
});

test('Deleting a journey can be cancelled before any progress changes', async () => {
  await boot({ width: 390, height: 844 });
  const before = await page.evaluate(() => localStorage.getItem('cr_save'));
  await settings();
  await page.locator('#resetSave').click();
  await fits('#resetCancel'); await fits('#resetDo');
  await page.locator('#resetCancel').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('cr_save')), before);
  assert(!await page.locator('#resetConfirm').isVisible());
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 480 }, { width: 667, height: 375 }]) {
  test(`Large story text, log and menu fit ${viewport.width} × ${viewport.height}`, async () => {
    await boot(viewport, { ...fullJourney, cr_speed: '0', cr_settings: JSON.stringify({ reduceMotion: true, textSize: 'large' }) });
    await page.locator('[data-m=chapters]').click();
    await page.locator('.chap[data-k=act1]').click();
    await page.waitForFunction(() => document.getElementById('text').textContent.startsWith('鐘楼へ上がる階段'), {}, { timeout: 15000 });
    // Chapter entry now includes a playable approach battle. The guardian suite
    // verifies that route; begin this layout check at the existing story scene.
    const sceneIndex = await page.evaluate(() => {
      const lines = SCRIPT.act1.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      const index = lines.findIndex(line => line.startsWith('鐘楼の屋根'));
      if (index >= 0) Engine.play('act1', index);
      return index;
    });
    assert(sceneIndex >= 0, 'The original bell-tower scene must remain in chapter one');
    await page.waitForFunction(() => document.getElementById('text').textContent.startsWith('鐘楼の屋根'), {}, { timeout: 15000 });
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(() => document.getElementById('nextMark').classList.contains('show'));
      const previous = await page.locator('#text').textContent();
      await page.locator('#text').click();
      await page.waitForFunction(previous => document.getElementById('text').textContent !== previous, previous);
    }
    await page.waitForFunction(() => document.getElementById('speaker').textContent === 'アリア');
    assert(await page.locator('#charAria').evaluate(element => element.classList.contains('show')));
    await fits('#textbox');
    for (const action of ['log', 'auto', 'skip', 'menu']) await fits(`[data-act=${action}]`);
    const line = await page.locator('#text').textContent();
    await page.locator('[data-act=log]').click();
    assert((await page.locator('.pn-body').textContent()).includes('鐘楼の屋根'));
    await fits('.pn-close');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#text').textContent(), line, 'Closing the log must preserve the current line');
    await page.locator('[data-act=menu]').click();
    await fits('#gmSet'); await fits('#gmGuide'); await fits('#gmJournal'); await fits('#gmTitle');
  });
}
