// 生成素材のコマを、ゲームの時計で再生する。GIFのプレビュー用ループは使わない。
const GameArt = (() => {
  const ROOT = 'assets/generated/';
  const assets = new Map(), cache = new Map(), mounts = new WeakMap();
  const spiritEffects = { gran: 'gran_tide', ivy: 'ivy_vines', spinel: 'spinel_shield', king: 'king_prism' };
  const speakers = { アリア: 'aria', リラ: 'lila', 老漁師: 'fisher', ルミナ: 'lumina', 石の子: 'stone_child', 馨: 'kaoru', マリー: 'mari', グラン: 'gran', アイビー: 'ivy', スピネル: 'spinel', パレット王: 'king', クロム: 'chrome', ルノワール: 'renoir', アクロマ: 'achroma' };
  const ready = fetch(ROOT + 'manifest.json?v=20261005-restoration1', { signal: AbortSignal.timeout(8000) })
    .then(r => { if (!r.ok) throw new Error('art manifest'); return r.json(); })
    .then(m => m.assets.forEach(a => assets.set(a.id, a))).catch(() => {});

  function bounds(image, a) {
    const [w, h] = a.grid.cellSize, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    let left = w, top = h, right = 0, bottom = 0;
    // 倍率と足元は全コマで固定。エフェクトだけは全コマの共通範囲を使う。
    for (let n = 0; n < (a.category === 'fx' ? a.frames.length : 1); n++) {
      c.clearRect(0, 0, w, h);
      c.drawImage(image, n % a.grid.columns * w, Math.floor(n / a.grid.columns) * h, w, h, 0, 0, w, h);
      const data = c.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) {
        left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
    }
    return right > left ? { left, top, right, bottom, width: right - left, height: bottom - top } : { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
  }
  async function load(ids) {
    await ready;
    return Promise.all([...new Set(ids.filter(Boolean))].map(id => {
      if (cache.has(id)) return cache.get(id).promise;
      const a = assets.get(id); if (!a) return null;
      const entry = { image: null, bounds: null };
      entry.promise = new Promise(resolve => {
        const im = new Image(); let settled = false;
        const finish = ok => {
          if (settled) return; settled = true; clearTimeout(timer);
          im.onload = im.onerror = null;
          if (ok) { try { entry.bounds = bounds(im, a); entry.image = im; } catch {} }
          resolve(entry.image);
        };
        const timer = setTimeout(() => finish(false), 8000);
        im.onload = () => finish(true); im.onerror = () => finish(false); im.src = ROOT + a.sheet;
      });
      cache.set(id, entry); return entry.promise;
    }));
  }
  const available = id => !!cache.get(id)?.image;
  const animation = (id, action) => assets.get(id)?.animations[action];
  function sample(id, action, elapsed) {
    const a = animation(id, action); if (!a) return null;
    const duration = a.durationsMs.reduce((s, v) => s + v, 0);
    if (!a.loop && elapsed >= duration) return null;
    let time = Math.max(0, elapsed) % duration, i = 0;
    while (i < a.durationsMs.length - 1 && time >= a.durationsMs[i]) time -= a.durationsMs[i++];
    return a.layerSequence ? a.layerSequence[i] : a.sequence[i];
  }
  function draw(c, id, cel, x, y, height, maxWidth, opt = {}) {
    const a = assets.get(id), e = cache.get(id);
    if (!e?.image || !a || cel == null) return false;
    const b = e.bounds, [w, h] = a.grid.cellSize;
    const scale = Math.min(height / b.height, maxWidth / b.width);
    const ax = (b.left + b.right) / 2, ay = opt.center ? (b.top + b.bottom) / 2 : b.bottom;
    c.save(); c.translate(x, y); if (opt.flip) c.scale(-1, 1);
    c.drawImage(e.image, cel % a.grid.columns * w, Math.floor(cel / a.grid.columns) * h, w, h, -ax * scale, -ay * scale, w * scale, h * scale);
    c.restore(); return true;
  }
  function drawMotion(c, id, action, elapsed, x, y, height, maxWidth, opt) {
    let cel = sample(id, action, elapsed);
    if (cel && typeof cel === 'object') cel = cel.actorCel;
    return draw(c, id, cel, x, y, height, maxWidth, opt);
  }
  function unmount(cv) { mounts.get(cv)?.(); mounts.delete(cv); }
  function mount(cv, id, action = 'idle', opt = {}) {
    unmount(cv);
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    let stopped = false, raf = null, start = performance.now();
    const cancel = () => { stopped = true; cancelAnimationFrame(raf); };
    mounts.set(cv, cancel);
    cv.dataset.art = id; cv.dataset.action = action;
    if (opt.fallback) { cv.style.background = `center / contain no-repeat url("${opt.fallback}")`; }
    ready.then(() => load([id, animation(id, action)?.layers?.effect])).then(() => {
      if (stopped || !cv.isConnected || !available(id)) return;
      if (opt.fallback) cv.style.background = '';
      start = performance.now(); const c = cv.getContext('2d');
      const loop = now => {
        if (stopped || !cv.isConnected) return;
        c.clearRect(0, 0, cv.width, cv.height);
        const clip = animation(id, action), elapsed = (now - start) * (opt.rate || 1);
        let pose = sample(id, action, elapsed);
        if (pose == null && assets.get(id)?.category !== 'fx') pose = sample(id, 'idle', now - start);
        const layer = pose && typeof pose === 'object';
        draw(c, id, layer ? pose.actorCel : pose, cv.width / 2, cv.height * .94, cv.height * .88, cv.width * .90);
        if (layer && clip?.layers?.effect) draw(c, clip.layers.effect, pose.effectCel, cv.width / 2, cv.height * .47, cv.height * .88, cv.width, { center: true });
        if (opt.once && elapsed >= (clip?.durationMs || 0)) { mounts.delete(cv); return; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return cancel;
  }
  function loadBattle(conf, learnedSpirits = []) {
    const spirits = conf.spirits || [];
    return load(['aria', 'renoir', ...(conf.enemies || []).map(e => e.kind), conf.bossArt, ...(conf.companion ? ['chrome_human'] : []), ...spirits,
      'crystal_slash', 'pray_heal', 'night_sky', ...[...spirits, ...learnedSpirits].map(id => spiritEffects[id]),
      ...((conf.enemies || []).some(e => e.kind === 'chrome') ? ['chrome_wave'] : [])]);
  }
  const portrait = (id, cls = '') => `<img class="art-portrait ${cls}" src="${ROOT}frames/${id}/000.png" alt="" loading="lazy">`;
  return { ready, load, loadBattle, available, animation, sample, draw, drawMotion, mount, unmount, portrait, spiritEffects, speakers };
})();
