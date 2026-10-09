// 生成素材のコマを、ゲームの時計で再生する。GIFのプレビュー用ループは使わない。
const GameArt = (() => {
  const ROOT = 'assets/generated/';
  const assets = new Map(), cache = new Map(), mounts = new WeakMap();
  const spiritEffects = { gran: 'gran_tide', ivy: 'ivy_vines', spinel: 'spinel_shield', king: 'king_prism', vard: 'crystal_slash', mari:'pray_heal' };
  const speakers = { アリア: 'aria', リラ: 'lila', 老漁師: 'fisher', ルミナ: 'lumina', 石の子: 'stone_child', 馨: 'kaoru', マリー: 'mari', グラン: 'gran', アイビー: 'ivy', スピネル: 'spinel', パレット王: 'king', クロム: 'chrome', ルノワール: 'renoir', アクロマ: 'achroma', ヴァルド: 'vard', 紅角のヴァルド: 'vard' };
  const ready = fetch(ROOT + 'manifest.json?v=20261010-regions1', { signal: AbortSignal.timeout(8000) })
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
      const entry = { image: null, bounds: null, tones: new Map(), tints: new Map() };
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
  function toneImage(id, phase) {
    const e=cache.get(id); if(!e?.image)return null;
    phase=Math.max(0,Math.min(2,Math.floor(phase)));
    if(e.tones.has(phase))return e.tones.get(phase);
    // Canvasのfilterに未対応のブラウザでも、穢れの3段階を同じ色で描く。
    // RGBだけを変え、原画の透過と髪の不透明度を保つ。各段階は一度だけ計算する。
    const cv=document.createElement('canvas');cv.width=e.image.naturalWidth;cv.height=e.image.naturalHeight;
    const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(e.image,0,0);
    const data=c.getImageData(0,0,cv.width,cv.height),pixels=data.data;
    const brightness=[.65,.82,.99][phase],saturation=[.18,.59,1][phase];
    for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3])continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],grey=r*.2126+g*.7152+b*.0722;
      pixels[i]=brightness*(grey+(r-grey)*saturation);pixels[i+1]=brightness*(grey+(g-grey)*saturation);pixels[i+2]=brightness*(grey+(b-grey)*saturation);
    }
    c.putImageData(data,0,0);e.tones.set(phase,cv);return cv;
  }
  // 土地の色へ染めた敵の絵。色相を回し、暗い部分にその土地の色を少し足す。透過は保ち、種類ごとに一度だけ計算する。
  function tintedImage(id, tint) {
    const e = cache.get(id); if (!e?.image || !tint) return null;
    if (e.tints.has(tint.key)) return e.tints.get(tint.key);
    const cv = document.createElement('canvas'); cv.width = e.image.naturalWidth; cv.height = e.image.naturalHeight;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(e.image, 0, 0);
    const data = c.getImageData(0, 0, cv.width, cv.height), px = data.data;
    const th = -tint.hue * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th), [tr, tg, tb] = tint.rgb;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const y = .299 * r + .587 * g + .114 * b, ii = (.596 * r - .274 * g - .322 * b) * tint.sat, q = (.211 * r - .523 * g + .312 * b) * tint.sat;
      const i2 = ii * cos - q * sin, q2 = ii * sin + q * cos, k = (1 - y / 255) * tint.glow;
      px[i] = Math.max(0, Math.min(255, y + .956 * i2 + .621 * q2 + tr * k));
      px[i + 1] = Math.max(0, Math.min(255, y - .272 * i2 - .647 * q2 + tg * k));
      px[i + 2] = Math.max(0, Math.min(255, y - 1.106 * i2 + 1.703 * q2 + tb * k));
    }
    c.putImageData(data, 0, 0); e.tints.set(tint.key, cv); return cv;
  }
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
    const source=opt.tone!=null?toneImage(id,opt.tone):opt.tint?(tintedImage(id,opt.tint)||e.image):e.image;
    c.drawImage(source, cel % a.grid.columns * w, Math.floor(cel / a.grid.columns) * h, w, h, -ax * scale, -ay * scale, w * scale, h * scale);
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
      'crystal_slash', 'pray_heal', 'night_sky', ...(conf.guardian ? Object.values(spiritEffects) : []), ...[...spirits, ...learnedSpirits].map(id => spiritEffects[id]),
      ...((conf.enemies || []).some(e => e.kind === 'chrome') ? ['chrome_wave'] : [])]);
  }
  const portrait = (id, cls = '') => `<img class="art-portrait ${cls}" src="${ROOT}frames/${id}/000.png" alt="" loading="lazy">`;
  return { ready, load, loadBattle, available, animation, sample, draw, drawMotion, mount, unmount, portrait, spiritEffects, speakers };
})();
