// 戦場：虹の床と、くすんだ床。アリアと精霊が、穢れだけを切り分ける
const Board = (() => {
  const $id = (s) => document.getElementById(s);
  const screen = $id('boardScreen');
  const cv = $id('boardCanvas');
  const g = cv.getContext('2d');
  const floatLayer = $id('floatLayer');
  const hintEl = $id('hint');
  const hintTextEl = $id('hintText');
  const subjEl = $id('boardSubject');
  const vignette = $id('vignette');
  const cmdMenu = $id('cmdMenu');
  const unitInfo = $id('unitInfo');
  const bannerEl = $id('phaseBanner');
  const skillEl = $id('skillName');
  const cutinEl = $id('cutin');
  const endBtn = $id('endTurn');
  const phaseLabel = $id('phaseLabel');
  const spiritBox = $id('skills');
  const guardianHud = document.createElement('div');
  guardianHud.id = 'guardianHud'; guardianHud.className = 'hidden'; screen.append(guardianHud);
  guardianHud.addEventListener('click', e => { e.stopPropagation(); if (!busy && !over) GuardianJourney.history(guardianHistory, cfg.guardian); });

  // ---------- 画像 ----------
  const IMG = {}; let META = null;
  const PIC = {};
  const RAINBOW_FLOOR_ALPHA = 0.45;
  const FLOOR_AURAS = {};
  const ready = Promise.all([
    fetch('assets/tiles/meta.json').then(r => r.json()).then(m => {
      META = m;
      return Promise.all(Object.keys(m).map(k => new Promise(res => { const i = new Image(); i.onload = res; i.onerror = res; i.src = `assets/tiles/${k}.png`; IMG[k] = i; })));
    }),
    ...['aria', 'gran', 'gran_front', 'sword'].map(k => new Promise(res => { const i = new Image(); i.onload = res; i.onerror = res; i.src = `assets/img/${k}.png`; PIC[k] = i; })),
  ]);

  // ---------- 定数 ----------
  const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const FACING = [{ arrow: '↗', name: '右上' }, { arrow: '↘', name: '右下' }, { arrow: '↙', name: '左下' }, { arrow: '↖', name: '左上' }];
  const APPROACH = { front: '正面から', side: '側面から +10%', back: '背後から +25%' };
  const BLOCK = new Set(['sea_deep', 'sea_rough', 'rocks', 'mt_small', 'mt_mid', 'mt_big']);
  const OBST = new Set(['rocks', 'mt_small', 'mt_mid', 'mt_big']);
  // [基礎, LVごとの伸び]
  const GROW = {
    aria: { hp: [60, 10], atk: [18, 3.2], def: [8, 2.2], mov: 4, jump: 1, rng: [1, 1], h: 1.3 },
    chrome_human: { hp: [80, 10], atk: [26, 3.5], def: [12, 2.4], mov: 4, jump: 1, rng: [1, 1], h: 1.3 },
    gran: { hp: [70, 9], atk: [16, 2.8], def: [9, 2], mov: 5, jump: 9, rng: [1, 2], fly: true, h: 1.12 },
    ivy: { hp: [48, 7], atk: [15, 2.8], def: [6, 1.6], mov: 3, jump: 1, rng: [2, 3], h: 0.95 },
    spinel: { hp: [80, 10], atk: [14, 2.4], def: [13, 2.6], mov: 3, jump: 1, rng: [1, 1], h: 0.95 },
    king: { hp: [60, 8], atk: [18, 3.1], def: [8, 2], mov: 4, jump: 2, rng: [1, 3], h: 1.05 },
    shade: { hp: [20, 5], atk: [9, 2.4], def: [3, 1.2], mov: 3, jump: 1, rng: [1, 1], h: 0.78 },
    thorn: { hp: [16, 4.5], atk: [9, 2.3], def: [2, 1.1], mov: 2, jump: 1, rng: [2, 3], h: 0.82 },
    lead: { hp: [22, 5], atk: [9, 2.3], def: [5, 1.8], mov: 2, jump: 1, rng: [1, 1], armor: 2, h: 0.82 },
    boss: { hp: [60, 14], atk: [12, 3], def: [5, 1.8], mov: 2, jump: 1, rng: [1, 2], h: 1.1 },
    membrane: { hp: [20, 5], atk: [9, 2.4], def: [3, 1.2], mov: 3, jump: 1, rng: [1, 2], h: 0.82 },
    chrome: { hp: [999, 0], atk: [14, 2.6], def: [99, 0], mov: 2, jump: 2, rng: [1, 2], h: 1.3 },
  };
  const KIND_NAME = { aria: 'アリア', chrome_human: 'クロム', shade: '穢れの影', thorn: '茨の影', lead: '鉛の殻', boss: '穢れの核', membrane: '白い膜', chrome: 'クロム' };
  const SPIRITS = {
    gran: {
      name: 'グラン', color: '#3fb4c9', rgb: '110,205,240',
      summon: { name: '潮騒の帰還', desc: '降り立った周り2マスの穢れを押し流し、床を虹に染める', rad: 2 },
      enchant: { name: '深碧の刃', desc: '射程が2に。当てた場所から十字に虹が広がり、敵を押し流す' },
    },
    ivy: {
      name: 'アイビー', color: '#5fd07a', rgb: '130,230,150',
      summon: { name: '茨ほどき', desc: '周り3マスの穢れを縛り、1ターン動けなくする', rad: 3 },
      enchant: { name: '翠蔦の刃', desc: '当てた穢れを縛る。与えた傷の3割を癒す' },
    },
    spinel: {
      name: 'スピネル', color: '#ffd25e', rgb: '255,215,120',
      summon: { name: '黄金の傷の光', desc: '味方全員を癒し、2ターン守りを固める', rad: 2 },
      enchant: { name: '金継ぎの刃', desc: '鉛を一太刀で砕き、守りを無視して切る' },
    },
    king: {
      name: 'パレット王', color: '#b48cff', rgb: '200,160,255',
      summon: { name: '虹の尖塔', desc: '戦場すべての穢れを打ち、周り3マスを虹に染める', rad: 3 },
      enchant: { name: '虹彩の刃', desc: '攻撃+25%。当てた周り3×3を虹に染める' },
    },
  };
  // 床の加護（割合 25% / 45% / 65%）
  const TIER = [
    { atk: 1, def: 1, sp: 0, regen: 0 },
    { atk: 1.1, def: 1, sp: 0, regen: 0 },
    { atk: 1.2, def: 1.15, sp: 1, regen: 0 },
    { atk: 1.3, def: 1.25, sp: 2, regen: 0.08 },
  ];
  const TIER_AT = [0.25, 0.45, 0.65];
  const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'];
  const SP_MAX = 12, COST_SUMMON = 6, COST_ENCHANT = 3, COST_PRAY = 2;
  const spCap = () => SP_MAX + GB.spMax;
  const flashCost = () => Math.max(1, 3 - GB.flashCost);

  // ---------- 仲間の記録（LV） ----------
  const PARTY_KEY = 'cr_party';
  function loadParty() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(PARTY_KEY) || 'null'); } catch (e) {}
    if (!p || !p.aria) p = { aria: { lv: 1, exp: 0 }, spirits: {} };
    return fillParty(p);
  }
  function fillParty(p) {
    p.spirits = p.spirits || {};
    if (p.gold == null) p.gold = 0;
    p.items = p.items || { i_tea: 2 };
    p.owned = p.owned || [];
    p.equip = Object.assign({ blade: null, cloth: null, charm: null }, p.equip || {});
    p.stages = p.stages || {};
    return Progression.migrate(p);
  }
  // 装備の効果を合計する
  function gearBonus(equip) {
    const b = { atk: 0, def: 0, hp: 0, mov: 0, jump: 0, crit: 0, spMax: 0, spTurn: 0, spStart: 0, back: 0, enchantTurns: 0, summonTurns: 0, paintStep: 0, splash: 0, dullGuard: 0, killHeal: 0, evade: 0, rng: 0, flashCost: 0, regen: 0, killSp: 0 };
    Object.values(equip || {}).forEach(id => { const e = id && typeof EQUIP !== 'undefined' && EQUIP[id]; if (e) for (const k in e.fx) b[k] = (b[k] || 0) + e.fx[k]; });
    return b;
  }
  let GB = gearBonus(null);
  function saveParty() { try { localStorage.setItem(PARTY_KEY, JSON.stringify(party)); } catch (e) {} }
  let party = loadParty();
  function rec(kind) { if (kind === 'aria') return party.aria; if (kind === 'chrome_human') return party.chrome; return party.spirits[kind] || (party.spirits[kind] = { lv: party.aria.lv, exp: 0, bond: 0, uses: 0, training: { enchant: 0, summon: 0 } }); }
  const bondRank = id => Progression.rank(rec(id).bond);
  function gainBond(id, amount, use = false, route = null) {
    const r = rec(id), before = bondRank(id);
    r.bond += amount;
    if (use) { r.uses++; stats.bondUses[id] = (stats.bondUses[id] || 0) + 1; }
    stats.bondGains[id] = (stats.bondGains[id] || 0) + amount;
    const learned = route ? Progression.practice(party, id, route, amount) : [];
    if (route) {
      const gains = stats.trainingGains[id] || (stats.trainingGains[id] = { enchant: 0, summon: 0 });
      gains[route] += amount;
    }
    learned.forEach(s => stats.learned.push(s.id));
    if (learned.length) { Engine.toast('アリアが「' + learned.map(s => s.name).join('」「') + '」を覚えた！'); Audio2.sfx.levelup(); }
    if (bondRank(id) > before) {
      const u = live().find(o => o.kind === id);
      if (u) { const next = statsFor(id, u.lv); u.hp += next.mhp - u.mhp; Object.assign(u, next); }
    }
    saveParty();
  }

  // ---------- 状態 ----------
  let cfg = null, baseCfg = null, onDone = null;
  let cells = [], cellsFront = [], cellsOrder = [], cols = 0, rows = 0, units = [], uid = 1;
  let viewRotation = 0;
  const defeatedSpirits = new Set();
  let tw = 80, th = 43, hStep = 18, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;
  const cam = { z: 1, x: 0, y: 0, tz: 1, tx: 0, ty: 0 };
  const fxp = [];
  const artEffects = [];
  let cutinCancel = null;
  let shakeAnimation = null;
  let t0 = performance.now(), running = false, sess = 0, renderFrame = null;
  let turn = 0, phase = 'player', stage = 1, busy = false, over = false, paused = false;
  let sel = null, mode = 'idle', moveInfo = null, targets = null, targetCmd = null, hover = null, threat = null, menuSub = null, infoU = null;
  let sp = 0, skyCharges = 0, enchantUsed = false, renoirUsed = false;
  let stats = null, difficulty = 'normal', tierA = 0, tierE = 0, ratioA = 0, ratioE = 0, kegIdx = 0, colorIdx = 0, totalFoes = 0;
  let hudReady = false;
  let guardianHistory = [];

  // 終了・やり直しをまたいで、古い戦闘の演出や行動を続けない。
  const cancelled = Symbol('battle cancelled');
  const pending = new Set();
  const runTask = (work) => work.catch(e => { if (e !== cancelled) throw e; });
  function cancelPending() { for (const cancel of [...pending]) cancel(); }
  function later(fn, ms) {
    const my = sess;
    const cancel = () => { clearTimeout(timer); pending.delete(cancel); };
    const timer = setTimeout(() => { pending.delete(cancel); if (my === sess && running) fn(); }, ms);
    pending.add(cancel);
    return cancel;
  }
  function wait(ms) {
    const my = sess;
    return new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); pending.delete(cancel); reject(cancelled); };
      const timer = setTimeout(() => { pending.delete(cancel); if (my === sess && running) resolve(); else reject(cancelled); }, ms);
      pending.add(cancel);
    });
  }
  // 画面が隠れていても止まらないように（タブを切り替えたときなど）
  function tween(dur, fn) {
    const my = sess;
    return new Promise((res, reject) => {
      const s = performance.now();
      let frame, timer;
      const cancel = () => { cancelAnimationFrame(frame); clearTimeout(timer); pending.delete(cancel); reject(cancelled); };
      const next = () => { if (document.hidden) timer = setTimeout(step, 16); else frame = requestAnimationFrame(step); };
      const step = () => {
        if (my !== sess || !running) { cancel(); return; }
        const k = Math.min(1, (performance.now() - s) / dur); fn(k);
        if (k < 1) next(); else { pending.delete(cancel); res(); }
      };
      pending.add(cancel);
      next();
    });
  }

  // ---------- 盤 ----------
  const idx = (r, c) => r * cols + c;
  const cellAt = (r, c) => (r >= 0 && r < rows && c >= 0 && c < cols) ? cells[idx(r, c)] : null;
  const cellOf = (u) => cells[idx(u.r, u.c)];
  const live = () => units.filter(u => !u.dead && !u.hidden);
  const unitAt = (cell) => cell ? units.find(u => !u.dead && !u.hidden && u.r === cell.r && u.c === cell.c) : null;
  const dist = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  const nb4 = (cell) => DIRS.map(([dr, dc]) => cellAt(cell.r + dr, cell.c + dc)).filter(Boolean);
  const nb8 = (cell) => { const o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const x = cellAt(cell.r + dr, cell.c + dc); if (x) o.push(x); } return o; };
  const pickOf = (arr) => arr[(Math.random() * arr.length) | 0];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ariaU = () => units.find(u => u.kind === 'aria' && !u.dead);
  const foe = (a, b) => (a.side === 'ally' && b.side === 'enemy') || (a.side === 'enemy' && b.side === 'ally');
  const areaCells = (center, rad) => cells.filter(c => dist(c, center) <= rad);

  function buildCells(M, flat) {
    cells = [];
    const s1 = Math.random() * 9, s2 = Math.random() * 9;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let h = 0;
      if (!flat) {
        const n = (Math.sin(c * 0.62 + s1) + Math.cos(r * 0.57 - s2) + Math.sin((c - r) * 0.41 + s2 * 1.3)) / 3;
        const hv = (n + 1) / 2 * 0.86 + Math.random() * 0.14;
        h = hv > 1 - M.hills * 0.42 ? 2 : hv > 1 - M.hills ? 1 : 0;
      }
      cells.push({ r, c, h, t: pickOf(h === 2 ? M.high : h === 1 ? M.mid : M.low), walk: true, floor: 'neutral', prev: 'neutral', flipT: 0, sd: Math.random() * 100 });
    }
    if (flat) return;
    if (M.water) {
      let seeds = Math.round(cells.length * M.waterAmt / 3);
      while (seeds-- > 0) {
        let c = pickOf(cells.filter(x => x.h === 0 && x.t !== M.water)); if (!c) break;
        for (let k = 0; k < 3; k++) { c.t = M.water; c = pickOf(nb4(c).filter(x => x.h === 0)) || c; }
      }
    }
    let obs = Math.round(cells.length * M.obsAmt);
    while (obs-- > 0) pickOf(cells).t = pickOf(M.obstacles);
  }
  function flood(start) {
    const seen = new Set([start]), q = [start];
    while (q.length) { const c = q.shift(); nb4(c).forEach(n => { if (!seen.has(n) && n.walk && Math.abs(n.h - c.h) <= 1) { seen.add(n); q.push(n); } }); }
    return seen;
  }
  function genMap() {
    const M = Object.assign({ low: ['sea_flat', 'sea_calm'], mid: ['land_flat'], high: ['land_high'], water: null, waterAmt: 0, hills: 0.3, obstacles: ['rocks'], obsAmt: 0.04 }, cfg.map || {});
    const list = [];
    (cfg.enemies || []).forEach(e => { for (let i = 0; i < (e.n || 1); i++) list.push(e); });
    list.sort((a, b) => (b.kind === 'boss' || b.kind === 'chrome') - (a.kind === 'boss' || a.kind === 'chrome'));
    for (let tries = 0; tries < 160; tries++) {
      buildCells(M, tries >= 110);
      const relax = tries > 60 ? 2 : 0;
      const aCell = cellAt(rows - 2, Math.min(cols - 2, Math.floor(cols * 0.55)));
      const used = [aCell], plan = [];
      let ok = true;
      for (const spec of list) {
        const boss = spec.kind === 'boss' || spec.kind === 'chrome';
        const lim = boss ? (rows + cols) * 0.32 + 1 + relax : (rows + cols) * 0.62 + relax;
        const cand = cells.filter(c => !used.includes(c) && dist(c, aCell) >= (boss ? 6 : 4) - relax && c.r + c.c <= lim && used.every(u => dist(u, c) >= 2));
        if (!cand.length) { ok = false; break; }
        const cell = pickOf(cand); used.push(cell); plan.push({ spec, cell });
      }
      if (!ok) continue;
      used.forEach(c => [c, ...nb4(c)].forEach(x => { if (BLOCK.has(x.t)) x.t = pickOf(x.h === 2 ? M.high : x.h === 1 ? M.mid : M.low); }));
      cells.forEach(c => { c.walk = !BLOCK.has(c.t); });
      const seen = flood(aCell);
      if (!plan.every(p => seen.has(p.cell))) continue;
      if (seen.size < cells.filter(c => c.walk).length * 0.8) continue;
      return { aria: aCell, enemies: plan };
    }
    // 万一のとき：平らな盤に置く
    buildCells(M, true); cells.forEach(c => { c.t = M.low[0]; c.walk = true; });
    const aCell = cellAt(rows - 1, cols - 1);
    return { aria: aCell, enemies: list.map((spec, i) => ({ spec, cell: cells[(i * 3) % (cells.length - 1)] })) };
  }
  function initFloors(plan) {
    cells.forEach(c => { c.floor = c.prev = c.walk ? 'neutral' : 'none'; c.flipT = 0; });
    const set = (c, f) => { if (c.walk) c.floor = c.prev = f; };
    areaCells(plan.aria, 2).forEach(c => set(c, 'rainbow'));
    plan.enemies.forEach(p => { if (p.spec.kind === 'chrome' || p.spec.phase === 1) return; areaCells(p.cell, p.spec.kind === 'boss' ? 2 : 1).forEach(c => set(c, 'dull')); });
    if (cfg.dullStart) {
      let n = Math.round(cells.length * cfg.dullStart / 4);
      while (n-- > 0) { const c = pickOf(cells.filter(x => x.walk && x.floor === 'neutral' && dist(x, plan.aria) > 3)); if (!c) break; [c, ...nb4(c)].forEach(x => { if (x.floor === 'neutral') set(x, 'dull'); }); }
    }
  }

  // ---------- 床を染める ----------
  function paint(c, f, delay = 0) {
    if (!c || !c.walk || c.floor === f) return false;
    c.prev = c.floor; c.floor = f; c.flipT = performance.now() + delay;
    return true;
  }
  function paintArea(center, rad, f, stagger = 70) {
    let n = 0;
    areaCells(center, rad).forEach(c => { if (paint(c, f, dist(c, center) * stagger)) n++; });
    if (n) refreshHud();
    return n;
  }
  function ratios() {
    let R = 0, D = 0, N = 0;
    cells.forEach(c => { if (!c.walk) return; N++; if (c.floor === 'rainbow') R++; else if (c.floor === 'dull') D++; });
    return { R: N ? R / N : 0, D: N ? D / N : 0 };
  }
  const tierOf = (x) => x >= TIER_AT[2] ? 3 : x >= TIER_AT[1] ? 2 : x >= TIER_AT[0] ? 1 : 0;
  const floorNames = () => cfg.inverted ? ['夜空', '白い膜'] : ['虹', 'くすみ'];
  const ownFloor = (u, c) => (u.side === 'ally' && c.floor === 'rainbow') || (u.side === 'enemy' && c.floor === 'dull');
  const oppFloor = (u, c) => (u.side === 'ally' && c.floor === 'dull') || (u.side === 'enemy' && c.floor === 'rainbow');

  // ---------- 配置計算 ----------
  function layout() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const narrow = matchMedia('(max-width: 820px), (max-height: 500px)').matches;
    const short = narrow && H <= 500 && W > H;
    screen.classList.toggle('compact', narrow);
    screen.classList.toggle('short', short);
    const top = (narrow ? (short ? 74 : 128) : 96) + (cfg.guardian && !short ? 44 : 0), bottom = narrow ? (short ? 70 : cfg.guardian && H<600?180:200) : 84;
    const availW = Math.max(80, narrow ? W - (short ? 340 : 12) : W - 60);
    const availH = Math.max(60, H - top - bottom);
    const span = (cols + rows) / 2;
    tw = Math.min(availW / span, availH / (span * 0.54 + 1.05), 116);
    th = tw * 0.54; hStep = th * 0.44;
    ox = W / 2 + (viewRotation % 2 ? cols - rows : rows - cols) * tw / 4;
    oy = top + (availH - span * th) / 2 + th / 2 + tw * 0.62;
  }
  function viewCell(r, c) {
    if (viewRotation === 1) return { r: c, c: rows - 1 - r };
    if (viewRotation === 2) return { r: rows - 1 - r, c: cols - 1 - c };
    if (viewRotation === 3) return { r: cols - 1 - c, c: r };
    return { r, c };
  }
  const viewDir = dir => (dir + viewRotation) % 4;
  const worldDir = dir => (dir - viewRotation + 4) % 4;
  const facingOf = dir => FACING[viewDir(dir)];
  const viewDepth = cell => { const p = viewCell(cell.r, cell.c); return p.r + p.c; };
  function orderCells() {
    cellsOrder = cells.slice().sort((a, b) => viewDepth(a) - viewDepth(b) || viewCell(a.r, a.c).c - viewCell(b.r, b.c).c);
    cellsFront = cellsOrder.slice().reverse();
    decor.sort((a, b) => viewDepth(a) - viewDepth(b));
    decor.forEach(d => { d.back = viewDepth(d) < (cols + rows - 2) / 2; });
  }
  const base = (r, c) => { const p = viewCell(r, c); return { x: ox + (p.c - p.r) * tw / 2, y: oy + (p.c + p.r) * th / 2 }; };
  function topOf(cell) { const b = base(cell.r, cell.c); return { x: b.x, y: b.y - cell.h * hStep }; }
  const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + cam.x, y: (y - cam.y) * cam.z + cam.y });
  const toWorld = (x, y) => ({ x: (x - cam.x) / cam.z + cam.x, y: (y - cam.y) / cam.z + cam.y });
  const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';
  function focus(x, y, z = 1.15) { cam.tx = x; cam.ty = y; cam.tz = reducedMotion() ? 1 : z; }
  function unfocus() { cam.tz = 1; }

  function unitXY(u, now = performance.now()) {
    let x, y;
    if (u.mv) { x = u.mv.x; y = u.mv.y; } else { const p = topOf(cellAt(u.r, u.c)); x = p.x; y = p.y; }
    if (u.lunge) {
      const k = (now - u.lunge.t0) / u.lunge.dur;
      if (k >= 1) u.lunge = null; else { const e = Math.sin(Math.PI * Math.min(1, k * 1.15)); x += u.lunge.dx * e; y += u.lunge.dy * e; }
    }
    if (u.knock) {
      const k = (now - u.knock.t0) / 320;
      if (k >= 1) u.knock = null; else { const e = Math.sin(Math.PI * k) * (1 - k); x += u.knock.dx * e + Math.sin(k * 40) * 3 * (1 - k); y += u.knock.dy * e; }
    }
    return { x, y };
  }
  function pick(sx, sy) {
    const { x: mx, y: my } = toWorld(sx, sy);
    // 床：上面に加えて、段の側面も「その床」として拾う（手前から順に）
    let tile = null;
    for (const c of cellsFront) {
      const p = topOf(c), yb = base(c.r, c.c).y;
      const yy = Math.max(p.y, Math.min(yb, my));
      if (Math.abs(mx - p.x) / (tw / 2) + Math.abs(my - yy) / (th / 2) <= 1) { tile = c; break; }
    }
    const tid = tile ? idx(tile.r, tile.c) : -1;
    let hitUnit = null;
    const us = live().sort((a, b) => viewDepth(b) - viewDepth(a));
    for (const u of us) {
      const p = unitXY(u), hw = tw * 0.22, top = p.y - tw * u.hgt * 0.9;
      if (mx > p.x - hw && mx < p.x + hw && my > top && my < p.y + th * 0.2) { hitUnit = u; break; }
    }
    const uid = hitUnit ? idx(hitUnit.r, hitUnit.c) : -1;
    // 本人・味方・届く敵の体に触れたら、その者を選ぶ。
    // それ以外の体に隠れた移動先は、床を選べるようにしておく。
    if (hitUnit && mode === 'selected' && sel && (hitUnit === sel || hitUnit.side === 'ally' || attackTargets(sel).has(uid))) return cellOf(hitUnit);
    if (hitUnit && mode === 'target' && targets && targets.has(uid)) return cellOf(hitUnit);
    if (tile && mode === 'selected' && sel && !sel.moved && moveInfo && moveInfo.ends.has(tid)) return tile;
    if (tile && mode === 'target' && targets && targets.has(tid)) return tile;
    return hitUnit ? cellOf(hitUnit) : tile;
  }

  // ---------- 描画 ----------
  function diamond(x, y, w, h) { g.beginPath(); g.moveTo(x, y - h / 2); g.lineTo(x + w / 2, y); g.lineTo(x, y + h / 2); g.lineTo(x - w / 2, y); g.closePath(); }
  function sprite(name, x, y, alpha = 1, scale = 1) {
    const m = META[name], im = IMG[name]; if (!m || !im || !im.complete || alpha <= 0) return;
    const s = (tw / m.w) * 1.035 * scale;
    g.globalAlpha = alpha;
    g.drawImage(im, x - (m.w * s) / 2, y - m.vy * s, m.w * s, m.h * s);
    g.globalAlpha = 1;
  }

  function floorAura(x, y, amount, night = false) {
    if (amount <= 0) return;
    const key = night ? 'night' : 'rainbow';
    let im = FLOOR_AURAS[key];
    if (!im) {
      im = document.createElement('canvas'); im.width = 256; im.height = 139;
      const ctx = im.getContext('2d'), w = im.width, h = im.height;
      ctx.beginPath(); ctx.moveTo(w / 2, h * .01); ctx.lineTo(w * .99, h / 2);
      ctx.lineTo(w / 2, h * .99); ctx.lineTo(w * .01, h / 2); ctx.closePath();
      const color = night ? ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .6) : ctx.createLinearGradient(0, 0, w, h);
      const colors = night ? [[0, '#465ac8'], [1, '#141e5a']] : [[0, '#7fd7dd'], [.22, '#b6a6ec'], [.44, '#ecaac9'], [.65, '#f3d89b'], [.84, '#c3e3a3'], [1, '#9ce0c8']];
      colors.forEach(([at, c]) => color.addColorStop(at, c)); ctx.fillStyle = color; ctx.fill();
      if (!night) {
        const edge = ctx.createLinearGradient(0, h / 2, w, h / 2);
        edge.addColorStop(0, '#cab8f4'); edge.addColorStop(.5, '#f6ddb1'); edge.addColorStop(1, '#b2e2cf');
        ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.stroke();
      }
      FLOOR_AURAS[key] = im;
    }
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = RAINBOW_FLOOR_ALPHA * amount;
    g.drawImage(im, x - tw / 2, y - th / 2, tw, th); g.restore();
  }

  function render(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    if (reducedMotion()) cam.z = cam.tz = 1;
    cam.z += (cam.tz - cam.z) * 0.12; cam.x += (cam.tx - cam.x) * 0.12; cam.y += (cam.ty - cam.y) * 0.12;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.x * (1 - cam.z), dpr * cam.y * (1 - cam.z));
    const inv = cfg.inverted;
    // 足元の影
    const bc = base((rows - 1) / 2, (cols - 1) / 2);
    const sh = g.createRadialGradient(bc.x, bc.y + th, 10, bc.x, bc.y + th, (cols + rows) * tw * 0.42);
    // 背景は #bgLayer にある章ごとの風景。影を薄くし、虹の光を柔らかく見せる。
    sh.addColorStop(0, inv ? 'rgba(0,0,10,.24)' : 'rgba(5,10,30,.18)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(-W, -H, W * 3, H * 3);
    drawDecor(true);

    const byCell = new Map();
    for (const u of units) {
      if (u.hidden) continue;
      if (u.dead && (!u.dieT || now - u.dieT > 950)) continue;
      const k = u.dk != null ? u.dk : idx(u.r, u.c);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(u);
    }
    const area = mode === 'target' && hover ? areaOf(targetCmd, hover) : null;
    const path = mode === 'selected' && sel && moveInfo && hover && moveInfo.ends.has(idx(hover.r, hover.c)) ? new Set(pathTo(moveInfo, idx(hover.r, hover.c))) : null;
    const atkSet = mode === 'selected' && sel ? attackTargets(sel) : null;
    for (const cell of cellsOrder) {
      drawCell(cell, t, now, area, path, atkSet);
      if (cell.beacon) drawBeacon(cell, t);
      const us = byCell.get(idx(cell.r, cell.c));
      if (us) us.forEach(u => drawUnit(u, t, now));
    }
    drawDecor(false);
    drawArtEffects(now);
    drawParticles();
    for (const u of units) if (!u.hidden && !u.dead && (!u.bornT || now - u.bornT > 300)) {
      const p = unitXY(u, now);
      if (u.side === 'enemy') drawFacing(u, p);
      drawBar(u, p.x, p.y);
    }
    updateBar();
    // 穢れの気配
    if (Math.random() < 0.3) {
      const v = cells.filter(c => c.floor === 'dull');
      if (v.length) { const c = pickOf(v); const p = topOf(c); fxp.push({ k: 'smoke', x: p.x + (Math.random() - .5) * tw * 0.4, y: p.y - 4, vx: (Math.random() - .5) * 0.2, vy: -0.25 - Math.random() * 0.3, r: 2, a: inv ? 0.22 : 0.18, col: inv ? '235,240,255' : '20,12,24', life: 0, max: 3 }); }
    }
    if (Math.random() < 0.18 && !inv) {
      const v = cells.filter(c => c.floor === 'rainbow');
      if (v.length) { const c = pickOf(v); const p = topOf(c); fxp.push({ k: 'spark', x: p.x + (Math.random() - .5) * tw * 0.5, y: p.y - Math.random() * 6, vx: 0, vy: -0.3, r: 4, h: [190, 260, 320, 50, 150][(Math.random() * 5) | 0], life: 0, max: 1.2, nograv: true }); }
    }
    renderFrame = requestAnimationFrame(render);
  }

  function initBeacons(start) {
    if (!cfg.restoreBeacons) return;
    // Keep every objective reachable by a walking human, independent of random hills.
    const reachableCells = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length; i++) for (const c of nb4(queue[i])) {
      if (c.walk && Math.abs(c.h - queue[i].h) <= 1 && !reachableCells.has(c)) { reachableCells.add(c); queue.push(c); }
    }
    const chosen = [];
    for (let n = 0; n < cfg.restoreBeacons; n++) {
      const candidates = [...reachableCells].filter(c => !chosen.includes(c) && dist(c, start) >= 3 && !unitAt(c));
      candidates.sort((a, b) => Math.min(dist(b, start), ...chosen.map(c => dist(b, c))) - Math.min(dist(a, start), ...chosen.map(c => dist(a, c))));
      const cell = candidates[0]; if (cell) { cell.beacon = n + 1; cell.beaconOn = false; chosen.push(cell); }
    }
    cfg.restoreBeacons = chosen.length;
  }
  function drawBeacon(c, t) {
    const p = topOf(c); g.save();
    g.strokeStyle = c.beaconOn ? '#adf0cf' : '#ffd696'; g.fillStyle = c.beaconOn ? '#153d32' : '#352642'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(p.x, p.y - th * .7); g.lineTo(p.x + tw * .14, p.y - th * .15); g.lineTo(p.x, p.y + th * .2); g.lineTo(p.x - tw * .14, p.y - th * .15); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.beaconOn ? '#d6ffea' : '#ffe9bd'; g.font = `bold ${Math.max(10, tw * .2)}px sans-serif`; g.textAlign = 'center'; g.fillText(c.beaconOn ? '✓' : c.beacon, p.x, p.y - th * .12);
    if (!c.beaconOn) { g.globalAlpha = reducedMotion() ? .4 : .35 + Math.sin(t * 2) * .15; g.beginPath(); g.ellipse(p.x, p.y, tw * .25, th * .23, 0, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }
  function drawCell(c, t, now, area, path, atkSet) {
    const b = base(c.r, c.c), x = b.x;
    const inv = cfg.inverted;
    let k = 1;
    if (c.flipT) { k = (now - c.flipT) / 480; if (k < 0) k = 0; if (k >= 1) { k = 1; c.flipT = 0; c.prev = c.floor; } }
    const lift = k > 0 && k < 1 ? -Math.sin(Math.PI * k) * th * 0.22 : 0;
    const y = b.y - c.h * hStep + lift;
    // 味方になっても地形素材は通常の床のまま。虹は上面の光として重ねる。
    const layer = (name, yy) => {
      if (!c.walk && (OBST.has(c.t) || c.t === name)) { sprite('dark_' + name, x, yy, 1 - ratioA * 0.9); sprite('crys_' + name, x, yy, ratioA * 0.9); }
      else sprite('dark_' + name, x, yy, 1);
    };
    const colName = OBST.has(c.t) ? 'land_flat' : c.t;
    for (let i = 0; i < c.h; i++) layer(colName, b.y - i * hStep + lift * (i / Math.max(1, c.h)));
    if (OBST.has(c.t) && c.h > 0) layer('land_flat', y);
    layer(c.t, y);
    if (!c.walk) {
      if (!OBST.has(c.t)) { g.save(); diamond(x, y, tw * 0.98, th * 0.98); g.fillStyle = 'rgba(4,10,24,.42)'; g.fill(); g.strokeStyle = `rgba(120,170,220,${0.12 + 0.08 * Math.sin(t * 2 + c.sd)})`; g.lineWidth = 1; g.stroke(); g.restore(); }
      return;
    }
    // 床の色
    const wDull = c.floor === 'dull' ? k : c.prev === 'dull' ? 1 - k : 0;
    const wRain = c.floor === 'rainbow' ? k : c.prev === 'rainbow' ? 1 - k : 0;
    if (!inv) {
      if (wDull > 0) {
        g.save(); diamond(x, y, tw * 0.99, th * 0.99);
        g.globalAlpha = wDull; g.globalCompositeOperation = 'color'; g.fillStyle = '#6f6458'; g.fill();
        g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(30,22,28,.34)'; g.fill();
        g.clip();
        for (let i = 0; i < 3; i++) {
          const bx = x + Math.sin(c.sd + i * 2.1) * tw * 0.22, by = y + Math.cos(c.sd * 1.7 + i) * th * 0.2, br = tw * (0.12 + 0.05 * Math.sin(t * 0.7 + i + c.sd));
          const gr = g.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, 'rgba(40,30,34,.45)'); gr.addColorStop(1, 'rgba(40,30,34,0)');
          g.fillStyle = gr; g.fillRect(bx - br, by - br, br * 2, br * 2);
        }
        g.restore();
      } else if (wRain <= 0) {
        g.save(); diamond(x, y, tw * 0.98, th * 0.98); g.fillStyle = 'rgba(10,16,34,.12)'; g.fill(); g.restore();
      }
      if (wRain > 0) {
        // 虹の光は再利用し、毎フレーム・全マスでグラデーションを作り直さない。
        floorAura(x, y, wRain);
        const sw = (t * 0.55 + (c.c + c.r) * 0.13) % 3.2;
        if (sw < 1) { g.save(); diamond(x, y, tw, th); g.clip(); const gx = x - tw + sw * tw * 2; const gr = g.createLinearGradient(gx - 30, y, gx + 30, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,241,215,${0.09 * wRain})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - tw, y - th, tw * 2, th * 2); g.restore(); }
      }
    } else {
      // 終章：味方の床は夜空、敵の床は白い膜
      g.save(); diamond(x, y, tw * 0.99, th * 0.99);
      g.fillStyle = `rgba(2,3,9,${0.5 - wRain * 0.38})`; g.fill();
      floorAura(x, y, wRain, true);
      if (wDull > 0) { const gr = g.createLinearGradient(x - tw / 2, y - th / 2, x + tw / 2, y + th / 2); gr.addColorStop(0, `rgba(250,250,255,${0.78 * wDull})`); gr.addColorStop(1, `rgba(210,220,238,${0.6 * wDull})`); g.fillStyle = gr; g.fill(); }
      g.restore();
      if (wRain > 0) drawStars(c, x, y, t, wRain);
    }
    // 範囲
    const id = idx(c.r, c.c);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    if (mode === 'selected' && moveInfo && moveInfo.ends.has(id)) tint(x, y, '120,215,255', 0.14 + 0.04 * pulse, 0.95, true);
    if (threat && threat.ends.has(id)) tint(x, y, '255,120,150', 0.13, 0.35);
    if (atkSet && atkSet.has(id)) tint(x, y, '255,120,140', 0.2 + 0.1 * pulse, 0.85);
    if (mode === 'target' && targets && targets.has(id)) tint(x, y, targetCmd === 'pray' ? '150,255,190' : targetCmd && (targetCmd.startsWith('summon') || targetCmd === 'sky') ? '200,170,255' : '255,120,150', 0.32 + 0.12 * pulse, 0.95, true);
    if (area && area.has(id)) tint(x, y, '255,245,200', 0.28, 0.9);
    if (path && path.has(id)) { g.save(); g.fillStyle = 'rgba(230,245,255,.9)'; g.shadowColor = '#bfe3ff'; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, Math.max(2.5, tw * 0.05), 0, 6.29); g.fill(); g.restore(); }
    if (hover === c && !busy && !over) { g.save(); diamond(x, y, tw * 0.96, th * 0.96); g.shadowColor = 'rgba(230,240,255,1)'; g.shadowBlur = 14; g.strokeStyle = 'rgba(235,245,255,.9)'; g.lineWidth = 2; g.stroke(); g.restore(); }
    const warning = units.some(u => !u.dead && u.guardian && u.intent?.ids.has(id));
    if (warning) {
      const safe = c.floor === 'rainbow';
      g.save(); diamond(x, y, tw * .9, th * .9); g.fillStyle = safe ? 'rgba(107,230,193,.1)' : 'rgba(240,137,131,.22)'; g.fill();
      g.strokeStyle = safe ? '#83edca' : '#ffbb9c'; g.lineWidth = 1.8; g.setLineDash([4,3]); g.stroke(); g.setLineDash([]);
      g.font = `bold ${Math.max(8,tw*.18)}px sans-serif`; g.textAlign = 'center'; g.fillStyle = safe ? '#b1ffde' : '#ffe1c7'; g.fillText(safe ? '◇' : '!',x,y+tw*.055); g.restore();
    }
  }
  function tint(x, y, col, a, sa, glow) {
    g.save(); diamond(x, y, tw * 0.9, th * 0.9);
    g.fillStyle = `rgba(${col},${a})`; g.fill();
    if (glow) { g.shadowColor = `rgba(${col},1)`; g.shadowBlur = 10; }
    g.strokeStyle = `rgba(${col},${sa})`; g.lineWidth = 1.6; g.stroke(); g.restore();
  }
  function drawStars(c, x, y, t, a) {
    g.save(); diamond(x, y, tw * 0.92, th * 0.92); g.clip();
    const cols4 = ['190,230,255', '170,255,190', '255,230,150', '220,190,255'];
    for (let i = 0; i < 7; i++) {
      const sd = (c.r * 31 + c.c * 17 + i * 7.3);
      const px = x + Math.sin(sd) * tw * 0.3, py = y + Math.cos(sd * 1.3) * th * 0.3;
      const tw2 = 0.5 + 0.5 * Math.sin(t * (1 + i * 0.37) + sd);
      const col = i % 3 === 0 ? cols4[(c.r + c.c + i) % 4] : '235,240,255';
      g.fillStyle = `rgba(${col},${a * (0.4 + tw2 * 0.6)})`;
      g.beginPath(); g.arc(px, py, (i % 3 === 0 ? 1.6 : 1) * (tw / 80), 0, 6.29); g.fill();
      if (i % 3 === 0) FX.drawSpark(g, px, py, 4 * tw2 * (tw / 80), `rgba(${col},${a * tw2 * 0.8})`);
    }
    g.restore();
  }

  const decor = [];
  function makeDecor() {
    decor.length = 0;
    if (!cfg.decor) return;
    const spots = [[-1.6, -1.2], [cols + 0.4, -1.4], [-1.4, rows + 0.4], [cols + 0.6, rows + 0.6], [-1.2, rows * 0.5], [cols * 0.5, -1.5]];
    spots.forEach(([c, r]) => decor.push({ c, r, name: pickOf(cfg.decor), back: c + r < (cols + rows) / 2, s: 0.9 + Math.random() * 0.4 }));
  }
  function drawDecor(back) {
    decor.forEach(d => {
      if (d.back !== back) return;
      const { x, y } = base(d.r, d.c);
      if (cfg.inverted) { sprite('dark_' + d.name, x, y, 0.7, d.s); return; }
      sprite('dark_' + d.name, x, y, 0.85 * (1 - ratioA), d.s);
      sprite('crys_' + d.name, x, y, 0.85 * ratioA, d.s);
    });
  }

  // ---------- 者を描く ----------
  function drawUnit(u, t, now) {
    const p = unitXY(u, now);
    let alpha = 1;
    if (u.dieT) { const k = (now - u.dieT) / 900; if (k >= 1) return; alpha = 1 - k; }
    if (u.bornT) { const k = (now - u.bornT) / 600; if (k < 1) alpha *= Math.max(0, k); }
    const done = u.side === 'ally' && phase === 'player' && u.acted;
    g.save();
    g.globalAlpha = alpha;
    // 影
    g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(p.x, p.y + 1, tw * 0.22, th * 0.2, 0, 0, 6.29); g.fill();
    // 足元の環
    if (u === sel) {
      g.strokeStyle = 'rgba(225,240,255,.95)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.lineDashOffset = -t * 24;
      g.beginPath(); g.ellipse(p.x, p.y, tw * 0.34, th * 0.34, 0, 0, 6.29); g.stroke(); g.setLineDash([]);
    } else if (u.side === 'ally' && phase === 'player' && !u.acted && !busy) {
      g.strokeStyle = `rgba(150,215,255,${0.35 + 0.25 * Math.sin(t * 3)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(p.x, p.y, tw * 0.3, th * 0.3, 0, 0, 6.29); g.stroke();
    }
    if (u.root) { g.strokeStyle = 'rgba(120,230,140,.8)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(p.x, p.y - tw * 0.1 * i - 4, tw * (0.26 - i * 0.03), th * (0.22 - i * 0.03), Math.sin(t + i) * 0.2, 0.3, 5.9); g.stroke(); } }
    if (u.guard) { g.strokeStyle = `rgba(255,220,130,${0.5 + 0.3 * Math.sin(t * 3)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y - tw * 0.45, tw * 0.32, tw * 0.55, 0, 0, 6.29); g.stroke(); }
    if (u.guardian) {
      g.strokeStyle = ['#8c769e','#bfa5da','#a1e5d6'][u.guardianPhase]; g.lineWidth = 2;
      g.beginPath(); g.ellipse(p.x,p.y,tw*.36,th*.36,0,0,Math.PI*2); g.stroke();
    }
    if (done) g.globalAlpha = alpha * 0.6;
    const flash = u.flash > now ? (u.flash - now) / 220 : 0;
    if (GameArt.available(u.artId || u.kind)) drawGenerated(u, p, now, flash);
    else if (u.kind === 'aria') drawAria(u, p.x, p.y, t, flash);
    else if (SPIRITS[u.kind]) drawSpirit(u, p.x, p.y, t, flash);
    else drawKegare(u, p.x, p.y, t, flash);
    g.restore();
  }
  function playMotion(u, action, rate = 1, offset = 0) { u.artMotion = { action, rate, offset, t0: performance.now() }; }
  function drawGenerated(u, p, now, flash) {
    const artId = u.artId || u.kind;
    let action = u.mv ? 'walk' : 'idle', elapsed = now - (u.walkT || u.bornT || 0);
    const m = u.artMotion;
    if (m && (now - m.t0) * m.rate + m.offset < (GameArt.animation(artId, m.action)?.durationMs || 0)) {
      action = m.action; elapsed = (now - m.t0) * m.rate + m.offset;
    }
    if (u.resonance) {
      for (const [i, colour] of ['#65d8ed', '#94e4a7', '#ffdc8d', '#cab0ef'].entries()) { g.strokeStyle = colour; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y - tw * .05 * i, tw * (.26 + i * .04), th * (.22 + i * .025), 0, (reducedMotion() ? 0 : now / 600) + i * 1.57, (reducedMotion() ? 0 : now / 600) + i * 1.57 + 1.2); g.stroke(); }
    }
    if (u.enchant) {
      const s = SPIRITS[u.enchant.id], h = tw * u.hgt;
      const glow = g.createRadialGradient(p.x, p.y - h * .4, 0, p.x, p.y - h * .4, h * .55);
      glow.addColorStop(0, `rgba(${s.rgb},.35)`); glow.addColorStop(1, `rgba(${s.rgb},0)`);
      g.fillStyle = glow; g.fillRect(p.x - h, p.y - h, h * 2, h);
      g.strokeStyle = s.color; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y, tw * .3, th * .3, 0, now / 500, now / 500 + 4.5); g.stroke();
    }
    const dir = viewDir(u.dir);
    const flip = artId === 'gran' ? dir === 0 || dir === 1 : dir === 2 || dir === 3;
    const height = tw * u.hgt, width = tw * (artId === 'gran' ? (u.guardian?1.6:1.25) : .98);
    g.save();
    const bob = u.guardian && !reducedMotion() ? Math.sin(now/680+u.id)*tw*.025 : 0;
    const artOptions={flip,...(u.guardian?{tone:u.guardianPhase}:{})};
    GameArt.drawMotion(g, artId, action, elapsed, p.x, p.y + th * .08 + bob, height, width, artOptions); g.restore();
    if (flash > 0) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= flash;
      GameArt.drawMotion(g, artId, action, elapsed, p.x, p.y + th * .08, height, width, artOptions); g.restore();
    }
    if (u.armor > 0) { g.strokeStyle = 'rgba(200,210,225,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y - tw * .28, tw * .29, th * .3, 0, 0, 6.29); g.stroke(); }
  }
  function artEffect(id, cell, size = 2) { if (id) artEffects.push({ id, r: cell.r, c: cell.c, size, t0: performance.now() }); }
  function drawArtEffects(now) {
    for (let i = artEffects.length - 1; i >= 0; i--) {
      const e = artEffects[i], elapsed = now - e.t0;
      if (elapsed >= (GameArt.animation(e.id, 'effect')?.durationMs || 0)) { artEffects.splice(i, 1); continue; }
      const p = topOf(cellAt(e.r, e.c));
      g.save(); g.globalAlpha = .82;
      GameArt.drawMotion(g, e.id, 'effect', elapsed, p.x, p.y - tw * .45, tw * e.size, tw * e.size * 1.2, { center: true }); g.restore();
    }
  }
  function drawAria(u, x, y, t, flash) {
    const im = PIC.aria; if (!im || !im.complete) return;
    const Hh = tw * 1.3, Ww = Hh * im.width / im.height, bob = Math.sin(t * 2 + u.id) * 1.2;
    if (u.enchant) {
      const s = SPIRITS[u.enchant.id];
      const gr = g.createRadialGradient(x, y - Hh * 0.45, 0, x, y - Hh * 0.45, Hh * 0.6);
      gr.addColorStop(0, `rgba(${s.rgb},${0.6 + 0.2 * Math.sin(t * 3)})`); gr.addColorStop(1, `rgba(${s.rgb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y - Hh * 0.45, Hh * 0.6, 0, 6.29); g.fill();
      g.strokeStyle = `rgba(${s.rgb},.9)`; g.lineWidth = 2; g.shadowColor = `rgba(${s.rgb},1)`; g.shadowBlur = 12;
      g.beginPath(); g.ellipse(x, y, tw * 0.3, th * 0.3, 0, t * 2, t * 2 + 4.5); g.stroke(); g.shadowBlur = 0;
      if (Math.random() < 0.35) fxp.push({ k: 'spark', x: x + (Math.random() - .5) * tw * 0.5, y: y - Math.random() * Hh, vx: 0, vy: -0.6, r: 5, col: s.rgb, life: 0, max: 0.9, nograv: true });
    }
    g.drawImage(im, x - Ww / 2, y - Hh + th * 0.14 + bob, Ww, Hh);
    if (flash > 0) { g.globalCompositeOperation = 'lighter'; const a = g.globalAlpha; g.globalAlpha = a * flash; g.drawImage(im, x - Ww / 2, y - Hh + th * 0.14 + bob, Ww, Hh); g.globalAlpha = a; g.globalCompositeOperation = 'source-over'; }
  }
  function drawSpirit(u, x, y, t, flash) {
    const s = SPIRITS[u.kind];
    if (u.kind === 'gran' && PIC.gran_front && PIC.gran_front.complete) {
      const w = tw * 2.3, h = w * PIC.gran_front.height / PIC.gran_front.width;
      const yy = y - tw * 0.85 + Math.sin(t * 1.6 + u.id) * 4;
      const gr = g.createRadialGradient(x, yy, 0, x, yy, w * 0.6); gr.addColorStop(0, 'rgba(120,210,255,.5)'); gr.addColorStop(1, 'rgba(120,210,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, yy, w * 0.6, 0, 6.29); g.fill();
      g.shadowColor = 'rgba(90,190,255,1)'; g.shadowBlur = 16;
      g.drawImage(PIC.gran_front, x - w / 2, yy - h / 2, w, h);
      g.shadowBlur = 0;
      // 水の翼のしずく
      if (Math.random() < 0.25) fxp.push({ k: 'spark', x: x + (Math.random() - .5) * w * 0.8, y: yy + h * 0.2, vx: 0, vy: 0.4, r: 4, col: '170,230,255', life: 0, max: 0.8, nograv: true });
      if (flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha *= flash; g.drawImage(PIC.gran_front, x - w / 2, yy - h / 2, w, h); g.globalCompositeOperation = 'source-over'; }
      return;
    }
    const R = tw * 0.24, cy = y - tw * 0.52 + Math.sin(t * 2 + u.id) * 3;
    const gl = g.createRadialGradient(x, cy, 0, x, cy, R * 2.4); gl.addColorStop(0, `rgba(${s.rgb},.5)`); gl.addColorStop(1, `rgba(${s.rgb},0)`);
    g.fillStyle = gl; g.beginPath(); g.arc(x, cy, R * 2.4, 0, 6.29); g.fill();
    if (u.kind === 'ivy') {
      g.strokeStyle = 'rgba(70,170,90,.9)'; g.lineWidth = 2.4;
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + t * 0.4; g.beginPath(); g.moveTo(x, cy); g.bezierCurveTo(x + Math.cos(a) * R * 1.4, cy + Math.sin(a) * R * 0.6 - R, x + Math.cos(a + 0.8) * R * 1.8, cy + Math.sin(a + .8) * R, x + Math.cos(a + 1.2) * R * 1.5, cy + R * 1.4); g.stroke(); }
    } else if (u.kind === 'spinel') {
      g.save(); g.translate(x, cy); g.rotate(Math.sin(t) * 0.1);
      g.beginPath(); g.moveTo(0, -R * 1.5); g.lineTo(R * 0.9, -R * 0.2); g.lineTo(0, R * 1.3); g.lineTo(-R * 0.9, -R * 0.2); g.closePath();
      const cg = g.createLinearGradient(-R, -R, R, R); cg.addColorStop(0, '#fff6cf'); cg.addColorStop(0.5, '#ffd25e'); cg.addColorStop(1, '#b8862a');
      g.fillStyle = cg; g.shadowColor = '#ffd25e'; g.shadowBlur = 18; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-R * 0.4, -R * 0.6); g.lineTo(R * 0.1, -R * 0.1); g.lineTo(-R * 0.1, R * 0.4); g.lineTo(R * 0.3, R * 0.8); g.stroke();
      g.restore();
    } else if (u.kind === 'king') {
      g.save(); g.fillStyle = '#ffe28a'; g.shadowColor = '#ffe28a'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(x - R * 0.7, cy - R * 0.9); g.lineTo(x - R * 0.7, cy - R * 1.6); g.lineTo(x - R * 0.35, cy - R * 1.2); g.lineTo(x, cy - R * 1.8); g.lineTo(x + R * 0.35, cy - R * 1.2); g.lineTo(x + R * 0.7, cy - R * 1.6); g.lineTo(x + R * 0.7, cy - R * 0.9); g.closePath(); g.fill(); g.restore();
    }
    const core = g.createRadialGradient(x - R * 0.2, cy - R * 0.25, 0, x, cy, R);
    core.addColorStop(0, '#fff'); core.addColorStop(0.35, s.color); core.addColorStop(1, `rgba(${s.rgb},.15)`);
    if (u.kind !== 'spinel') { g.fillStyle = core; g.beginPath(); g.arc(x, cy, R, 0, 6.29); g.fill(); }
    g.strokeStyle = `rgba(${s.rgb},.7)`; g.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) { const k = ((t * 0.6 + i * 0.5) % 1); g.globalAlpha *= 1; g.beginPath(); g.ellipse(x, cy, R * (1 + k * 1.2), R * (1 + k * 1.2) * 0.5, 0, 0, 6.29); g.stroke(); }
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash})`; g.beginPath(); g.arc(x, cy, R * 1.2, 0, 6.29); g.fill(); }
  }
  function drawKegare(u, x, y, t, flash) {
    const inv = cfg.inverted;
    if (u.kind === 'chrome') return drawChrome(u, x, y, t, flash);
    const big = u.kind === 'boss', mem = u.kind === 'membrane';
    const R = tw * (big ? 0.34 : 0.24);
    const cy = y - R * 1.25 - Math.sin(t * 2.2 + u.id) * 2.5;
    g.beginPath();
    const n = 54, spikes = u.kind === 'thorn' ? 9 : big ? 11 : 0;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      let k = 1 + 0.12 * Math.sin(a * 3 + t * 2.4 + u.id) + 0.07 * Math.sin(a * 7 - t * 3.1);
      if (spikes && i % Math.round(n / spikes) === 0) k += big ? 0.5 : 0.42;
      const px = x + Math.cos(a) * R * k * 0.92, py = cy + Math.sin(a) * R * k * (a > 0.2 && a < 2.9 ? 1.2 : 0.95);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    const gr = g.createRadialGradient(x - R * 0.3, cy - R * 0.4, R * 0.1, x, cy, R * 1.4);
    if (mem) { gr.addColorStop(0, 'rgba(255,255,255,.96)'); gr.addColorStop(0.6, 'rgba(226,232,246,.88)'); gr.addColorStop(1, 'rgba(190,200,222,.65)'); }
    else if (u.kind === 'lead') { gr.addColorStop(0, '#4a4a56'); gr.addColorStop(0.55, '#16141c'); gr.addColorStop(1, '#000'); }
    else if (u.kind === 'thorn') { gr.addColorStop(0, '#1f3326'); gr.addColorStop(0.55, '#0a120c'); gr.addColorStop(1, '#000'); }
    else { gr.addColorStop(0, big ? '#3e2450' : '#2c2236'); gr.addColorStop(0.55, '#0d0912'); gr.addColorStop(1, '#000'); }
    g.fillStyle = gr; g.shadowColor = mem ? 'rgba(235,242,255,.95)' : big ? 'rgba(180,80,230,.85)' : 'rgba(120,70,170,.6)'; g.shadowBlur = big ? 24 : 12; g.fill();
    g.shadowBlur = 0; g.strokeStyle = mem ? 'rgba(255,255,255,.85)' : big ? 'rgba(210,140,255,.6)' : 'rgba(170,120,220,.45)'; g.lineWidth = 1.3; g.stroke();
    if (u.armor > 0) {
      for (let i = 0; i < u.armor; i++) {
        g.strokeStyle = `rgba(${170 - i * 20},${176 - i * 20},${190 - i * 20},.95)`; g.lineWidth = Math.max(2, tw * 0.035);
        g.beginPath(); g.ellipse(x, cy + R * 0.25, R * (1.05 + i * 0.2), R * (0.5 + i * 0.12), 0, 0.15, Math.PI - 0.15); g.stroke();
      }
    }
    const blink = Math.sin(t * 1.3 + u.id * 2) > 0.97 ? 0.15 : 1;
    const eye = mem ? 'rgba(60,70,110,.85)' : big ? 'rgba(255,160,220,.98)' : u.kind === 'thorn' ? 'rgba(200,255,200,.9)' : 'rgba(235,225,255,.92)';
    g.fillStyle = eye; g.shadowColor = eye; g.shadowBlur = inv ? 2 : 8;
    const ex = R * 0.32, ey = cy - R * 0.08;
    g.beginPath(); g.ellipse(x - ex, ey, R * 0.14, R * 0.07 * blink, -0.3, 0, 6.29); g.fill();
    g.beginPath(); g.ellipse(x + ex, ey, R * 0.14, R * 0.07 * blink, 0.3, 0, 6.29); g.fill();
    g.shadowBlur = 0;
    if (flash > 0) { const fg = g.createRadialGradient(x, cy, 0, x, cy, R * 1.4); fg.addColorStop(0, `rgba(255,255,255,${flash * 0.8})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = fg; g.beginPath(); g.arc(x, cy, R * 1.4, 0, 6.29); g.fill(); g.globalCompositeOperation = 'source-over'; }
    if (Math.random() < 0.06 && !u.dead) fxp.push({ k: 'smoke', x: x + (Math.random() - .5) * R, y: cy + R * 0.6, vx: (Math.random() - .5) * .3, vy: -.4, r: 3, a: .3, col: mem ? '240,244,255' : '15,5,25', life: 0, max: 1.6 });
  }
  function drawChrome(u, x, y, t, flash) {
    const Hh = tw * 1.25, cy = y - Hh * 0.5 + Math.sin(t * 1.4) * 2;
    const calm = stage === 1;
    // コート
    g.beginPath(); g.moveTo(x, y - Hh); g.bezierCurveTo(x + tw * 0.32, y - Hh * 0.85, x + tw * 0.34, y - Hh * 0.2, x + tw * 0.3, y); g.lineTo(x - tw * 0.3, y); g.bezierCurveTo(x - tw * 0.34, y - Hh * 0.2, x - tw * 0.32, y - Hh * 0.85, x, y - Hh); g.closePath();
    const gr = g.createLinearGradient(x, y - Hh, x, y); gr.addColorStop(0, '#15131c'); gr.addColorStop(1, '#020205');
    g.fillStyle = gr; g.shadowColor = calm ? 'rgba(150,170,255,.8)' : 'rgba(0,0,0,.9)'; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0;
    if (calm) {
      g.save(); g.clip();
      for (let i = 0; i < 18; i++) { const sx = x + Math.sin(i * 12.9) * tw * 0.26, sy = y - Hh * (0.1 + 0.8 * ((i * 0.37) % 1)); const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i)); g.fillStyle = `rgba(230,236,255,${a})`; g.beginPath(); g.arc(sx, sy, 1.2, 0, 6.29); g.fill(); }
      g.restore();
    }
    g.fillStyle = '#e8e6ee'; g.beginPath(); g.ellipse(x, y - Hh * 0.86, tw * 0.07, tw * 0.09, 0, 0, 6.29); g.fill();
    g.fillStyle = '#0a0a10'; g.beginPath(); g.ellipse(x, y - Hh * 0.92, tw * 0.09, tw * 0.06, 0, Math.PI, 0); g.fill();
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.5})`; g.beginPath(); g.arc(x, cy, tw * 0.4, 0, 6.29); g.fill(); }
  }
  function drawBar(u, x, y) {
    const w = tw * 0.5, h = Math.max(3, tw * 0.045), top = y - tw * u.hgt - 4;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, top - 1, w + 2, h + 2);
    if (u.kind === 'chrome' && stage === 0) { g.fillStyle = '#222'; g.fillRect(x - w / 2, top, w, h); }
    else if (u.side !== 'neutral') {
      const k = Math.max(0, u.hp / u.mhp);
      g.fillStyle = u.side === 'ally' ? (k > 0.5 ? '#8fe8ff' : k > 0.25 ? '#ffe08a' : '#ff8a8a') : (cfg.inverted ? '#e8eeff' : '#c58cff');
      g.fillRect(x - w / 2, top, w * k, h);
    }
    if (u.side !== 'neutral') {
      g.font = `600 ${Math.max(9, tw * 0.13)}px "Cormorant Garamond", serif`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText('Lv' + u.lv, x - w / 2 - 3, top + h / 2);
      g.fillStyle = u.side === 'ally' ? '#dff3ff' : '#e6d6ff'; g.fillText('Lv' + u.lv, x - w / 2 - 3, top + h / 2);
    }
    if (u.side !== 'neutral') {
      const size = Math.max(14, tw * .19), bx = x + w / 2 + 3, by = top + h / 2 - size / 2;
      const color = u.side === 'ally' ? '#8fe8ff' : '#ffd07a';
      g.fillStyle = 'rgba(5,10,25,.95)'; g.fillRect(bx, by, size, size);
      g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(bx, by, size, size);
      g.fillStyle = color; g.font = `700 ${size - 1}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(facingOf(u.dir).arrow, bx + size / 2, by + size / 2);
    }
    g.restore();
  }
  // 攻撃の正面／背後判定と同じDIRSを床の4方向へ投影する。
  // 床の後で描く。近くの別キャラクターの体は避け、HP横にも方向を出す。
  function drawFacing(u, p) {
    const dir = viewDir(u.dir), [dr, dc] = DIRS[dir], [sr, sc] = DIRS[(dir + 1) % 4];
    const f = { x: (dc - dr) * tw / 2, y: (dc + dr) * th / 2 };
    const s = { x: (sc - sr) * tw / 2, y: (sc + sr) * th / 2 };
    const point = (a, b = 0) => [p.x + f.x * a + s.x * b, p.y + f.y * a + s.y * b];
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    for (const other of units) {
      if (other === u || other.hidden || other.dead) continue;
      const q = unitXY(other);
      if (Math.abs(q.x - p.x) > tw * 1.1 || Math.abs(q.y - p.y) > tw * 1.5) continue;
      g.beginPath(); g.rect(-W, -H, W * 3, H * 3);
      g.rect(q.x - tw * .26, q.y - tw * other.hgt * .95, tw * .52, tw * other.hgt * .95 + th * .12);
      g.clip('evenodd');
    }
    g.beginPath(); g.moveTo(...point(.88)); g.lineTo(...point(.48, .18)); g.lineTo(...point(.59)); g.lineTo(...point(.48, -.18)); g.closePath();
    g.strokeStyle = '#08101f'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#ffd07a'; g.fill();
    for (const a of [-.66, -.82]) {
      g.beginPath(); g.moveTo(...point(a, -.12)); g.lineTo(...point(a, .12));
      g.strokeStyle = '#08101f'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = '#81e7ff'; g.lineWidth = 2; g.stroke();
    }
    g.restore();
  }

  // ---------- 粒子 ----------
  function drawParticles() {
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i];
      if (p.delay > 0) { p.delay -= 1 / 60; continue; }
      p.life += 1 / 60;
      const k = p.life / p.max; if (k >= 1) { fxp.splice(i, 1); continue; }
      if (p.k === 'smoke') {
        p.x += p.vx; p.y += p.vy; p.vy *= 0.985; p.r += 0.35;
        g.fillStyle = `rgba(${p.col},${(1 - k) * p.a})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fill();
      } else if (p.k === 'spark') {
        p.x += p.vx; p.y += p.vy; if (!p.nograv) p.vy += 0.05;
        FX.drawSpark(g, p.x, p.y, p.r * (1 - k), p.col ? `rgba(${p.col},${1 - k})` : `hsla(${p.h},100%,88%,${1 - k})`);
      } else if (p.k === 'ring') {
        g.strokeStyle = `rgba(${p.col},${(1 - k) * 0.85})`; g.lineWidth = (p.w || 2) * (1 - k) + 0.5;
        const rr = p.r + k * p.grow;
        g.beginPath(); g.ellipse(p.x, p.y, rr, rr * 0.54, 0, 0, 6.29); g.stroke();
      } else if (p.k === 'orb') {
        const e = k * k * (3 - 2 * k);
        const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e - Math.sin(Math.PI * k) * 120;
        g.fillStyle = 'rgba(10,8,16,.9)'; g.beginPath(); g.arc(x, y, 5 * (1 - k * 0.5), 0, 6.29); g.fill();
        g.strokeStyle = 'rgba(150,140,200,.5)'; g.stroke();
        if (k > 0.97 && !p.done) { p.done = 1; Renoir.gulp(); Audio2.sfx.absorb(); }
      } else if (p.k === 'slash') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot || -0.6);
        const L = tw * (p.len || 1.3), a = 1 - k;
        const grd = g.createLinearGradient(-L, 0, L, 0);
        const c1 = p.col || '220,235,255';
        grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.4 + k * 0.2, `rgba(${c1},${a})`); grd.addColorStop(0.5 + k * 0.2, `rgba(255,240,252,${a})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.shadowColor = `rgba(${c1},1)`; g.shadowBlur = 16; g.beginPath(); g.ellipse(0, 0, L, 3 + 7 * a, 0, 0, 6.29); g.fill();
        g.restore();
      } else if (p.k === 'beam') {
        const a = Math.sin(Math.PI * k);
        const w = tw * (p.w || 0.5) * (0.6 + 0.4 * a);
        const gr = g.createLinearGradient(p.x - w, 0, p.x + w, 0);
        gr.addColorStop(0, `rgba(${p.col},0)`); gr.addColorStop(0.5, `rgba(${p.col},${0.75 * a})`); gr.addColorStop(1, `rgba(${p.col},0)`);
        g.fillStyle = gr; g.fillRect(p.x - w, p.y - H, w * 2, H);
        g.fillStyle = `rgba(255,255,255,${0.6 * a})`; g.fillRect(p.x - w * 0.15, p.y - H, w * 0.3, H);
      } else if (p.k === 'line') {
        const a = 1 - k;
        g.save(); g.strokeStyle = `rgba(${p.col},${a})`; g.lineWidth = tw * 0.16 * a + 1; g.shadowColor = `rgba(${p.col},1)`; g.shadowBlur = 24; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (p.tx - p.x) * Math.min(1, k * 4), p.y + (p.ty - p.y) * Math.min(1, k * 4)); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = tw * 0.05 * a + 0.5; g.stroke(); g.restore();
      } else if (p.k === 'starburst') {
        FX.drawSpark(g, p.x + p.vx * k * 40, p.y + p.vy * k * 40, 3 + 4 * (1 - k), `rgba(240,245,255,${1 - k})`);
      }
    }
  }
  function burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) fxp.push({ k: 'spark', x, y, vx: (Math.random() - .5) * (opt.sp || 4), vy: -Math.random() * (opt.sp || 3.5), r: opt.r || 7, h: [200, 260, 320, 50, 150][i % 5], col: opt.col, life: 0, max: opt.max || 1, delay: opt.delay || 0 });
  }
  function smoke(x, y, n, col, opt = {}) {
    for (let i = 0; i < n; i++) fxp.push({ k: 'smoke', x: x + (Math.random() - .5) * tw * 0.5, y, vx: (Math.random() - .5) * (opt.sp || 0.8), vy: -.5 - Math.random() * 1.4, r: 3 + Math.random() * 3, a: opt.a || .5, col, life: 0, max: 1.8 + Math.random() });
  }

  // ---------- 文字・演出 ----------
  function floatText(x, y, text, cls, color) {
    const p = toScreen(x, y);
    const d = document.createElement('div'); d.className = 'floatWord ' + cls; d.textContent = text;
    d.style.left = Math.max(120, Math.min(W - 120, p.x)) + 'px'; d.style.top = p.y + 'px';
    if (color) { d.style.color = color; d.style.textShadow = `0 0 14px ${color}, 0 2px 10px rgba(0,0,0,.9)`; }
    floatLayer.appendChild(d); setTimeout(() => d.remove(), 4400);
  }
  function popNum(x, y, text, cls = '') {
    const p = toScreen(x, y);
    const d = document.createElement('div'); d.className = 'dmg ' + cls; d.textContent = text;
    d.style.left = p.x + (Math.random() - .5) * 10 + 'px'; d.style.top = p.y + 'px';
    floatLayer.appendChild(d); setTimeout(() => d.remove(), 1600);
  }
  function shake(px = 7) {
    shakeAnimation?.cancel(); shakeAnimation = null;
    if (reducedMotion()) return;
    const animation = screen.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px * 0.5}px)` }, { transform: `translate(${px}px,${-px * 0.6}px)` }, { transform: `translate(${-px * 0.5}px,${px * 0.3}px)` }, { transform: 'translate(0,0)' }], { duration: 380 });
    shakeAnimation = animation;
    animation.onfinish = () => { if (shakeAnimation === animation) shakeAnimation = null; };
  }
  let hintTimer = null;
  function say(who, text, ms = 8000) {
    hintTextEl.innerHTML = (who ? `<span class="hn">${who}</span>` : '') + text;
    hintEl.classList.add('show');
    if (hintTimer) hintTimer();
    hintTimer = ms ? later(() => hintEl.classList.remove('show'), ms) : null;
  }
  function hideSay() { if (hintTimer) hintTimer(); hintTimer = null; hintEl.classList.remove('show'); }
  hintEl.addEventListener('click', e => { e.stopPropagation(); hideSay(); });
  $id('hintClose').addEventListener('click', e => { e.stopPropagation(); hideSay(); });
  async function showBanner(kind, main, sub) {
    bannerEl.className = '';
    bannerEl.innerHTML = `<div class="pb-line"></div><div class="pb-main">${main}</div><div class="pb-sub">${sub}</div>`;
    void bannerEl.offsetWidth;
    bannerEl.className = 'show ' + kind;
    Audio2.sfx.phase(kind === 'enemy');
    await wait(1250);
    bannerEl.className = '';
  }
  async function skillBanner(name, color = '#d8e8ff') {
    skillEl.innerHTML = `<span>${name}</span>`;
    skillEl.style.setProperty('--c', color);
    skillEl.className = '';
    void skillEl.offsetWidth;
    skillEl.className = 'show';
    await wait(520);
    later(() => { skillEl.className = ''; }, 700);
  }
  async function cutIn(kind, id) {
    const s = SPIRITS[id];
    const generated = GameArt.available(kind === 'enchant' ? 'aria' : id);
    const art = generated ? '<canvas class="ci-generated" width="384" height="480" aria-label="技の発動"></canvas>' : kind === 'enchant'
      ? `<img class="ci-sword" src="assets/img/sword.png">`
      : id === 'gran' ? `<img class="ci-gran" src="assets/img/gran.png">`
        : `<div class="ci-orb aura" style="--c:${s.color}"><div class="core"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div></div>`;
    cutinEl.innerHTML = `<div class="ci-dim"></div><div class="ci-band"></div><div class="ci-art">${art}</div>
      <div class="ci-text"><div class="ci-sub">${kind === 'summon' ? '精霊召喚' : '心剣に宿す'}</div><div class="ci-name">${s.name}</div><div class="ci-skill">「${kind === 'summon' ? s.summon.name : s.enchant.name}」</div></div>`;
    cutinEl.style.setProperty('--c', s.color);
    cutinEl.style.setProperty('--rgb', s.rgb);
    cutinEl.className = '';
    void cutinEl.offsetWidth;
    cutinEl.className = 'show ' + kind;
    cutinCancel?.();
    cutinCancel = generated ? GameArt.mount(cutinEl.querySelector('canvas'), kind === 'enchant' ? 'aria' : id, kind === 'enchant' ? 'enchant_' + id : 'summon', { rate: 1.3, once: true }) : null;
    Audio2.sfx.summon();
    FX.flash(s.rgb, 0.35);
    await wait(1650);
    cutinEl.className = 'out ' + kind;
    await wait(320);
    cutinCancel?.(); cutinCancel = null;
    cutinEl.className = '';
  }

  // ---------- 移動 ----------
  function canStep(u, a, b) {
    if (u.fly) return true;
    return b.walk && Math.abs(a.h - b.h) <= u.jump;
  }
  function reachable(u) {
    const start = idx(u.r, u.c);
    const d = new Map([[start, 0]]), prev = new Map(), q = [start];
    const mov = u.root ? 0 : u.mov;
    while (q.length) {
      const i = q.shift(), di = d.get(i); if (di >= mov) continue;
      const c = cells[i];
      for (const n of nb4(c)) {
        const j = idx(n.r, n.c); if (d.has(j)) continue;
        if (!canStep(u, c, n)) continue;
        const o = unitAt(n); if (o && o.side !== u.side) continue;
        d.set(j, di + 1); prev.set(j, i); q.push(j);
      }
    }
    const ends = new Set();
    d.forEach((_, j) => { const c = cells[j]; if (c.walk && (j === start || !unitAt(c))) ends.add(j); });
    ends.delete(start);
    return { d, prev, ends, start };
  }
  function pathTo(info, id) {
    const out = []; let cur = id;
    while (cur !== info.start && cur !== undefined) { out.unshift(cur); cur = info.prev.get(cur); }
    return out;
  }
  function face(u, cell) {
    const dr = cell.r - u.r, dc = cell.c - u.c;
    if (!dr && !dc) return;
    u.dir = Math.abs(dr) >= Math.abs(dc) ? (dr < 0 ? 0 : 2) : (dc > 0 ? 1 : 3);
  }
  async function moveAlong(u, path, paintIt) {
    u.walkT = performance.now(); u.artMotion = null;
    for (const id of path) {
      if (!running) return;
      const to = cells[id], from = cellAt(u.r, u.c);
      face(u, to);
      const a = topOf(from), b = topOf(to);
      u.dk = viewDepth(to) >= viewDepth(from) ? id : idx(from.r, from.c);
      const hop = u.fly ? th * 0.2 : to.h !== from.h ? th * 0.55 : th * 0.12;
      Audio2.sfx.step();
      await tween(u.fly ? 110 : 135, k => { u.mv = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * hop }; });
      u.r = to.r; u.c = to.c; u.mv = null; u.dk = null;
      if (paintIt) {
        const list = u.kind === 'aria' && GB.paintStep ? [to, ...nb4(to)] : [to];
        list.forEach((c, i) => { if (u.undo) u.undo.floors.push([c, c.floor]); paint(c, u.side === 'ally' ? 'rainbow' : 'dull', i * 40); });
        refreshHud();
      }
    }
  }

  // ---------- 攻撃の計算 ----------
  const effRng = (u) => u.resonance ? [1, 2] : u.kind !== 'aria' ? u.rng : [1, (u.enchant && u.enchant.id === 'gran' ? 2 : 1) + GB.rng];
  function inRange(u, from, tc) {
    const d = dist(from, tc), rng = effRng(u);
    if (d < rng[0] || d > rng[1]) return false;
    if (rng[1] === 1 && !u.fly && Math.abs(from.h - tc.h) > 1) return false;
    return true;
  }
  function attackTargets(u, from) {
    const f = from || cellOf(u), set = new Set();
    live().forEach(o => { if (foe(u, o) && inRange(u, f, cellOf(o))) set.add(idx(o.r, o.c)); });
    return set;
  }
  function attackSide(fromCell, d) {
    const v = DIRS[d.dir], ar = fromCell.r - d.r, ac = fromCell.c - d.c;
    const dot = ar * v[0] + ac * v[1];
    return dot > 0 ? 'front' : dot < 0 ? 'back' : 'side';
  }
  function calcDamage(a, d, opt = {}, from = null, rnd = true) {
    const ac = from || cellOf(a), dc = cellOf(d);
    const TA = TIER[a.side === 'ally' ? tierA : tierE], TD = TIER[d.side === 'ally' ? tierA : tierE];
    let atk = a.atk * TA.atk * (opt.power || 1);
    if (ownFloor(a, ac)) atk *= 1.1;
    if (opt.normal && (a.resonance || a.enchant && a.enchant.id === 'king')) atk *= 1.25;
    if (opt.normal && a.enchant) atk *= 1 + (bondRank(a.enchant.id) - 1) * 0.03;
    const pierce = opt.pierce || (opt.normal && (a.resonance || a.enchant && a.enchant.id === 'spinel'));
    let def = pierce ? 0 : d.def * TD.def * (d.guard ? 1.3 : 1) * (oppFloor(d, dc) && !(d.kind === 'aria' && GB.dullGuard) ? 0.9 : 1);
    const dh = ac.h - dc.h;
    let m = dh > 0 ? 1.15 : dh < 0 ? 0.9 : 1;
    const side = attackSide(ac, d);
    m *= side === 'back' ? 1.25 + (a.kind === 'aria' ? GB.back / 100 : 0) : side === 'side' ? 1.1 : 1;
    let dmg = atk * m * (rnd ? 0.92 + Math.random() * 0.16 : 1) - def * 0.5;
    if (d.armor > 0 && !pierce) dmg *= 0.35;
    if (d.side === 'ally' && difficulty === 'gentle') dmg *= 0.6;
    return { dmg: Math.max(1, Math.round(dmg)), side, dh };
  }

  // ---------- 経験とLV ----------
  const MAX_LV = 99;
  const expHit = (a, d) => Math.max(2, Math.min(25, 8 + (d.lv - a.lv) * 2));
  const expKill = (a, d) => Math.max(6, Math.min(80, 30 + (d.lv - a.lv) * 7 + (d.kind === 'boss' ? 30 : 0)));
  function gainExp(kind, amt, u) {
    const r = rec(kind);
    // セーブの育成範囲と統一。上限に届く分だけ受け取り、経験値の繰り越しを止める。
    const gain = Math.min(Number.isFinite(amt) ? Math.max(0, Math.floor(amt)) : 0, Math.max(0, (MAX_LV - r.lv) * 100 - r.exp));
    if (kind === 'aria') stats.expA += gain;
    r.exp += gain;
    while (r.lv < MAX_LV && r.exp >= 100) {
      r.exp -= 100;
      const oldLv = r.lv, before = statsOf(kind, oldLv);
      r.lv++;
      const after = statsOf(kind, r.lv);
      stats.levelUps.push({ name: KIND_NAME[kind] || SPIRITS[kind].name, from: oldLv, to: r.lv, hp: after.mhp - before.mhp, atk: after.atk - before.atk, def: after.def - before.def });
      if (u && !u.dead) {
        const af = statsFor(kind, r.lv);
        u.lv = r.lv; u.mhp = af.mhp; u.atk = af.atk; u.def = af.def; u.hp = Math.min(u.mhp, u.hp + (after.mhp - before.mhp));
        const p = unitXY(u);
        popNum(p.x, p.y - tw * u.hgt - 10, 'LEVEL UP!', 'lvup');
        fxp.push({ k: 'beam', x: p.x, y: p.y, col: '255,236,170', w: 0.45, life: 0, max: 1.1 });
        burst(p.x, p.y - tw * 0.5, 14, { col: '255,236,170', r: 6 });
        Audio2.sfx.levelup();
      } else if (u === null) {
        // 心剣に宿っている精霊
        const a = ariaU(); if (a) { const p = unitXY(a); popNum(p.x + tw * 0.3, p.y - tw * 1.1, `${SPIRITS[kind].name} LV UP`, 'lvup small'); }
      }
    }
    if (r.lv >= MAX_LV) r.exp = 0;
    saveParty();
  }

  // ---------- 攻撃 ----------
  function statsOf(kind, lv) { const s = GROW[kind]; return { mhp: Math.round(s.hp[0] + s.hp[1] * lv), atk: Math.round(s.atk[0] + s.atk[1] * lv), def: Math.round(s.def[0] + s.def[1] * lv) }; }
  // アリアは装備のぶんを足す
  function statsFor(kind, lv, gb = GB) {
    const s = statsOf(kind, lv);
    if (kind === 'aria') { s.mhp += gb.hp; s.atk += gb.atk; s.def += gb.def; }
    else if (SPIRITS[kind]) {
      const rank = bondRank(kind) - 1;
      s.mhp = Math.round(s.mhp * (1 + rank * 0.05)); s.atk = Math.round(s.atk * (1 + rank * 0.04)); s.def = Math.round(s.def * (1 + rank * 0.02));
    }
    return s;
  }
  function makeUnit(kind, side, lv, cell, extra = {}) {
    const G = GROW[kind], s = statsFor(kind, lv), ar = kind === 'aria';
    if (side === 'enemy' && cfg.enemyBoost) { if (kind !== 'chrome') s.mhp = Math.round(s.mhp * cfg.enemyBoost.hp); s.atk = Math.round(s.atk * cfg.enemyBoost.atk); }
    return Object.assign({
      id: uid++, kind, side, lv, r: cell.r, c: cell.c, hp: s.mhp, mhp: s.mhp, atk: s.atk, def: s.def, mov: G.mov + (ar ? GB.mov : 0), jump: G.jump + (ar ? GB.jump : 0), rng: G.rng, fly: !!G.fly, armor: G.armor || 0, hgt: G.h,
      dir: side === 'ally' ? 0 : 2, moved: false, acted: false, normalAttacks: 0, root: 0, guard: 0, enchant: null, summon: 0, name: KIND_NAME[kind] || (SPIRITS[kind] && SPIRITS[kind].name) || kind, word: '',
      flash: 0, lunge: null, knock: null, mv: null, dk: null, dieT: 0, bornT: performance.now(), hidden: false, dead: false,
    }, extra);
  }

  // 一撃を当てる（演出の中心）
  function strike(a, d, opt = {}) {
    const pd = unitXY(d);
    if (d.kind === 'chrome' && stage === 0) {
      stats.phase0 = (stats.phase0 || 0) + 1;
      Audio2.sfx.miss();
      fxp.push({ k: 'slash', x: pd.x, y: pd.y - tw * 0.6, life: 0, max: 0.5, col: '230,236,255', len: 1.6 });
      floatText(pd.x, pd.y - tw * 1.4, '刃は、黒を通り抜けた', 'color', '#e8eeff');
      return { pass: true };
    }
    if (d.kind === 'boss' && cfg.bossShield && cells.some(c => c.beacon && !c.beaconOn)) {
      floatText(pd.x, pd.y - tw * 1.3, '防壁：復興の灯をすべて浄化して解除', 'sys');
      Audio2.sfx.miss(); return { pass: true };
    }
    const res = calcDamage(a, d, opt);
    const miss = !opt.sure && res.side !== 'back' && Math.random() < 0.05 + (d.kind === 'aria' ? GB.evade / 100 : 0);
    const crit = !miss && !opt.noCrit && Math.random() < (res.side === 'back' ? 0.18 : 0.08) + (a.kind === 'aria' ? GB.crit / 100 : 0);
    if (a.side === 'ally' && !miss) { if (res.side === 'back') stats.back++; if (crit) stats.crit++; }
    const col = opt.col || '220,235,255';
    fxp.push({ k: 'slash', x: pd.x, y: pd.y - tw * d.hgt * 0.5, rot: -0.6 + (Math.random() - .5) * 0.5, life: 0, max: 0.42, col, len: crit ? 1.8 : 1.3 });
    if (miss) { popNum(pd.x, pd.y - tw * d.hgt * 0.6, 'MISS', 'miss'); Audio2.sfx.miss(); d.knock = { t0: performance.now(), dx: tw * 0.25, dy: 0 }; return { miss: true }; }
    let dmg = res.dmg; if (crit) dmg = Math.round(dmg * 1.5);
    if (d.guardian) dmg = GuardianCombat.damage(d.hp,d.mhp,d.guardianPhase,dmg);
    if (crit) { FX.flash('255,255,255', 0.55); shake(11); Audio2.sfx.crit(); popNum(pd.x, pd.y - tw * d.hgt - 26, 'CRITICAL!', 'critw'); }
    else { Audio2.sfx.hit(); shake(4); }
    if (a.side === 'ally' && res.side !== 'front' && !opt.quiet) floatText(pd.x, pd.y - tw * d.hgt - 34, res.side === 'back' ? '背後から！' : '側面から', 'sys');
    if (res.dh > 0 && a.side === 'ally' && !opt.quiet) floatText(pd.x + tw * 0.4, pd.y - tw * d.hgt - 14, '高所', 'sys');
    d.hp = Math.max(0, d.hp - dmg);
    if (d.guardian && d.hp > 0) guardianTransition(d);
    playMotion(d, 'hurt', 1.5, 260);
    d.flash = performance.now() + 220;
    const pa = unitXY(a), L = Math.hypot(pd.x - pa.x, pd.y - pa.y) || 1;
    d.knock = { t0: performance.now(), dx: (pd.x - pa.x) / L * tw * 0.18, dy: (pd.y - pa.y) / L * tw * 0.1 };
    popNum(pd.x, pd.y - tw * d.hgt * 0.55, dmg, crit ? 'crit' : d.side === 'ally' ? 'hurt' : '');
    burst(pd.x, pd.y - tw * d.hgt * 0.5, crit ? 18 : 9, { col: opt.col, r: crit ? 9 : 6 });
    if (d.side === 'ally') stats.taken += dmg;
    // 鉛
    if (d.armor > 0) {
      const brk = (opt.pierce || (opt.normal && (a.resonance || a.enchant && a.enchant.id === 'spinel'))) ? d.armor : 1;
      d.armor = Math.max(0, d.armor - brk);
      Audio2.sfx.crack();
      burst(pd.x, pd.y - tw * 0.4, 10, { col: '255,215,120', r: 5 });
      floatText(pd.x, pd.y - tw * d.hgt - 50, d.armor ? (cfg.layerLine || '外側の鉛が一枚、剥がれた') : '鉛が、砕けた', 'sys');
    }
    paint(cellOf(d), a.side === 'ally' ? 'rainbow' : 'dull');
    if (a.kind === 'aria' && GB.splash) paintArea(cellOf(d), 1, 'rainbow', 50);
    if (a.side === 'ally') {
      gainExp(a.kind, expHit(a, d), a);
      if (opt.normal && a.enchant) gainExp(a.enchant.id, 4, null);
      sp = Math.min(spCap(), sp + 1);
    }
    return { dmg, crit };
  }

  async function attack(a, d, opt = {}) {
    const my = sess;
    face(a, cellOf(d));
    const pa = unitXY(a), pd = unitXY(d);
    focus((pa.x + pd.x) / 2, (pa.y + pd.y) / 2 - tw * 0.5, 1.18);
    const en = opt.normal && a.enchant ? SPIRITS[a.enchant.id] : null;
    if (en) { opt.col = en.rgb; opt.skill = opt.skill || en.enchant.name; opt.color = en.color; }
    if (opt.skill) await skillBanner(opt.skill, opt.color);
    else await wait(160);
    if (my !== sess) return;
    const dx = pd.x - pa.x, dy = pd.y - pa.y, L = Math.hypot(dx, dy) || 1;
    const ranged = dist(cellOf(a), cellOf(d)) > 1;
    const reach = ranged ? tw * 0.18 : Math.min(L * 0.45, tw * 0.45);
    playMotion(a, a.kind === 'chrome' ? 'wave' : 'attack', 2.5);
    a.lunge = { dx: dx / L * reach, dy: dy / L * reach, t0: performance.now(), dur: 360 };
    Audio2.sfx.sword();
    if (ranged) fxp.push({ k: 'line', x: pa.x, y: pa.y - tw * a.hgt * 0.5, tx: pd.x, ty: pd.y - tw * d.hgt * 0.5, col: opt.col || (a.side === 'ally' ? '200,230,255' : '170,110,220'), life: 0, max: 0.5 });
    await wait(180);
    if (my !== sess) return;
    const r = strike(a, d, opt);
    if (!r.miss) {
      if (a.kind === 'chrome') artEffect('chrome_wave', cellOf(d), 2.3);
      else if (en) artEffect(GameArt.spiritEffects[a.enchant.id], cellOf(d), 1.8);
      else if (SPIRITS[a.kind]) artEffect(GameArt.spiritEffects[a.kind], cellOf(d), 1.2);
      else if (a.kind === 'aria' || a.kind === 'chrome_human') artEffect('crystal_slash', cellOf(d), 1.1);
    }
    if (r.pass) { await wait(700); unfocus(); return 'phase0'; }
    if (!r.miss && a.side === 'ally') {
      if (SPIRITS[a.kind]) gainBond(a.kind, 1, true, a.until ? 'summon' : null);
      else if (opt.normal && a.enchant) gainBond(a.enchant.id, 1, true, 'enchant');
    }
    if (r.crit) { focus(pd.x, pd.y - tw * 0.5, 1.32); await wait(110); }
    if (!r.miss && opt.normal && (a.enchant || a.resonance)) await enchantEffect(a, d, r.dmg);
    refreshHud();
    await wait(420);
    if (my !== sess) return;
    if (d.hp <= 0 && !d.dead) await defeat(d, a);
    unfocus();
    await wait(180);
  }

  async function enchantEffect(a, d, dmg) {
    const id = a.enchant?.id, all = !!a.resonance, dc = cellOf(d), p = unitXY(d);
    if (all || id === 'gran') {
      [dc, ...nb4(dc)].forEach((c, i) => paint(c, 'rainbow', i * 60));
      fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.2, grow: tw * 1.4, col: '120,210,255', life: 0, max: 1, w: 4 });
      if (d.hp > 0) {
        const dr = Math.sign(d.r - a.r), dcc = Math.sign(d.c - a.c);
        const v = Math.abs(d.r - a.r) >= Math.abs(d.c - a.c) ? [dr, 0] : [0, dcc];
        const n = cellAt(d.r + v[0], d.c + v[1]);
        if (n && n.walk && !unitAt(n) && Math.abs(n.h - dc.h) <= 1) {
          const from = topOf(dc), to = topOf(n);
          d.dk = viewDepth(n) >= viewDepth(dc) ? idx(n.r, n.c) : idx(dc.r, dc.c);
          await tween(180, k => { d.mv = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }; });
          d.r = n.r; d.c = n.c; d.mv = null; d.dk = null;
          floatText(to.x, to.y - tw, '押し流した', 'sys');
        }
      }
    }
    if (all || id === 'ivy') {
      if (d.hp > 0) { d.root = 1; floatText(p.x, p.y - tw * 1.2, '蔦が、縛った', 'color', '#a8f0b0'); }
      const h = Math.max(1, Math.round(dmg * 0.3)); heal(a, h);
    }
    if (all || id === 'spinel') {
      burst(p.x, p.y - tw * 0.4, 12, { col: '255,220,130' });
    }
    if (all || id === 'king') {
      paintArea(dc, 1, 'rainbow', 50);
      fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.3, grow: tw * 1.8, col: '210,180,255', life: 0, max: 1.1, w: 4 });
    }
    refreshHud();
  }
  function heal(u, amt) {
    const p = unitXY(u);
    const before = u.hp; u.hp = Math.min(u.mhp, u.hp + amt);
    popNum(p.x, p.y - tw * u.hgt * 0.6, '+' + (u.hp - before), 'heal');
    for (let i = 0; i < 8; i++) fxp.push({ k: 'spark', x: p.x + (Math.random() - .5) * tw * .5, y: p.y - Math.random() * tw * u.hgt, vx: 0, vy: -1, r: 5, col: '170,255,200', life: 0, max: 1, nograv: true, delay: i * 0.04 });
  }

  async function defeat(d, killer) {
    if (d.dead) return;
    d.dead = true; d.dieT = performance.now();
    const p = unitXY(d), dc = cellOf(d);
    const inv = cfg.inverted;
    if (d.side === 'enemy') {
      if (d.guardian) {
        const p = GuardianCombat.profile(d.guardian);
        const lines = [[p.name,p.freed],['アリア','穢れだけ、切り分けられた。あなたの色は残ってる。']];
        guardianHistory.push({phase:3,lines}); say('戻ってきた声',lines.map(([who,text])=>`<b>${who}</b> ${text}`).join('<br>'),9000);
        d.intent = null;
      }
      stats.kills++;
      stats.gold += 8 + d.lv * 2;
      if (killer && killer.until) stats.summonKills++;
      if (killer && (killer.resonance || killer.kind === 'aria' && killer.enchant)) stats.enchantKills++;
      if (d.kind === 'boss' && live().some(u => u.side === 'enemy')) stats.bossEarly = true;
      stats.lastBoss = d.kind === 'boss';
      if (killer && killer.kind === 'aria') { if (GB.killHeal) heal(killer, Math.round(killer.mhp * GB.killHeal / 100)); if (GB.killSp) sp = Math.min(spCap(), sp + GB.killSp); }
      Audio2.sfx.cut();
      smoke(p.x, p.y - tw * 0.4, 26, inv ? '245,248,255' : '70,66,80');
      burst(p.x, p.y - tw * 0.4, 18, { delay: 0.05, max: 1.2 });
      fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.3, grow: tw * 1.6, col: '255,255,255', life: 0, max: 1.2 });
      if (inv) for (let i = 0; i < 8; i++) fxp.push({ k: 'starburst', x: p.x, y: p.y - tw * 0.4, vx: Math.cos(i * 0.785), vy: Math.sin(i * 0.785) * 0.54, life: 0, max: 1.4 });
      const left = live().filter(u => u.side === 'enemy').length;
      const word = left === 0 && cfg.rootWord ? cfg.rootWord : d.word;
      if (word) floatText(p.x, p.y - tw * 0.9, word, 'kegare');
      paintArea(dc, 1, 'rainbow', 90);
      if (!inv && cfg.renoir !== false) {
        const rb = $id('renoirBox').getBoundingClientRect();
        if (rb.width) { const tgt = toWorld(rb.left + rb.width / 2, rb.top + rb.height / 2); fxp.push({ k: 'orb', x: p.x, y: p.y - tw * 0.4, tx: tgt.x, ty: tgt.y, life: 0, max: 1.3, delay: 0.5 }); }
      }
      if (killer && killer.side === 'ally') { gainExp(killer.kind, expKill(killer, d), killer); if (killer.enchant) gainExp(killer.enchant.id, 12, null); sp = Math.min(spCap(), sp + 2); }
      maybeColorWord(p);
      (cfg.beats || []).forEach(b => { if (!b.shown && stats.kills >= b.at) { b.shown = true; later(() => { if (!over) say(b.who, b.text, 4600); }, 900); } });
      updateSubject();
      tutorialStep('kill');
      refreshHud();
      await wait(450);
      if (stage === 1 && !live().some(u => u.side === 'enemy')) win();
    } else if (d.kind === 'aria' || d.kind === 'chrome_human') {
      smoke(p.x, p.y - tw * 0.5, 20, '20,10,30');
      lose();
    } else {
      stats.down++;
      if (d.until && SPIRITS[d.kind]) defeatedSpirits.add(d.kind);
      floatText(p.x, p.y - tw, `${d.name}は、アリアの胸の中へ還った${defeatedSpirits.has(d.kind) ? '（この戦闘中は使えない）' : ''}`, 'color', SPIRITS[d.kind] ? SPIRITS[d.kind].color : '#fff');
      fxp.push({ k: 'beam', x: p.x, y: p.y, col: SPIRITS[d.kind] ? SPIRITS[d.kind].rgb : '255,255,255', w: 0.4, life: 0, max: 1 });
      refreshHud();
      await wait(300);
    }
  }
  function maybeColorWord(p) {
    const words = cfg.colorWords || [];
    if (!words.length || stats.kills % 2 === 0 && stats.kills > 1) return;
    later(() => floatText(p.x + tw * 0.6, p.y - tw * 1.6, words[colorIdx++ % words.length], 'color', cfg.wordHue || cfg.hue), 700);
  }

  // ---------- 技 ----------
  async function flashStrike(a, cell) {
    const my = sess;
    face(a, cell);
    const v = [cell.r - a.r, cell.c - a.c];
    const line = [cell, cellAt(cell.r + v[0], cell.c + v[1])].filter(Boolean);
    const pa = unitXY(a), end = topOf(line[line.length - 1]);
    focus((pa.x + end.x) / 2, (pa.y + end.y) / 2 - tw * 0.5, 1.15);
    await skillBanner('透明の一閃', '#e6f2ff');
    if (my !== sess) return;
    a.lunge = { dx: (end.x - pa.x) * 0.3, dy: (end.y - pa.y) * 0.3, t0: performance.now(), dur: 380 };
    playMotion(a, 'flash', 2.5);
    Audio2.sfx.sword();
    fxp.push({ k: 'line', x: pa.x, y: pa.y - tw * 0.6, tx: end.x, ty: end.y - tw * 0.4, col: '230,240,255', life: 0, max: 0.6 });
    await wait(200);
    artEffect('crystal_slash', cell, 2.1);
    line.forEach((c, i) => paint(c, 'rainbow', i * 80));
    const hit = [];
    for (const c of line) { const o = unitAt(c); if (o && foe(a, o)) { const r = strike(a, o, { power: 1.35, sure: true, col: '230,240,255' }); if (r.pass) { await wait(700); unfocus(); return 'phase0'; } hit.push(o); await wait(130); } }
    if (!hit.length) floatText(end.x, end.y - tw, '光だけが、床を澄ませた', 'sys');
    if (hit.length >= 2) stats.flashMulti++;
    refreshHud();
    await wait(450);
    for (const o of hit) if (o.hp <= 0 && !o.dead) await defeat(o, a);
    unfocus(); await wait(150);
  }
  function doRenoir(u) { return runTask((async () => {
    const my = sess; busy = true; hideMenu(); endBtn.disabled = true;
    renoirUsed = true; sp -= 6;
    await skillBanner('ルノワール · 四響エンチャント', '#dac1fa');
    if (my !== sess) return;
    u.resonance = { turns: 3, from: turn }; playMotion(u, 'purify', 1.5);
    for (const id of Object.values(GameArt.spiritEffects)) artEffect(id, cellOf(u), 1.5);
    Audio2.sfx.skill(); await wait(700);
    if (my !== sess || over) return;
    busy = false; endBtn.disabled = false; refreshHud(); select(u, true); showMenu(u);
  })()); }
  async function purify(a, cell) {
    const my = sess;
    await skillBanner(a.kind === 'chrome_human' ? 'ルノワールの浄化' : '透明の浄化', '#dacfff');
    if (my !== sess) return;
    playMotion(a, 'purify', 1.5); artEffect('night_sky', cell, 1.8); Audio2.sfx.heal();
    paintArea(cell, 2, 'rainbow', 60); stats.purify++;
    if (cell.beacon && !cell.beaconOn) {
      cell.beaconOn = true; const p = topOf(cell); floatText(p.x, p.y - tw, '復興の灯が、つながった', 'color', '#bfe9d0');
      if (!cells.some(c => c.beacon && !c.beaconOn) && cfg.bossShield) say('ルノワール', '灯が届いた。防壁が開く、核に届くよ。', 4500);
    }
    gainExp(a.kind, 10, a); refreshHud(); await wait(700);
    if (my === sess && !live().some(u => u.side === 'enemy')) win();
  }
  async function pray(a, target) {
    const p = unitXY(target);
    focus(p.x, p.y - tw * 0.5, 1.12);
    await skillBanner(a.kind === 'chrome_human' ? '夜の祈り' : '凪の祈り', '#bfffd6');
    playMotion(a, 'pray', 2, 500); artEffect('pray_heal', cellOf(target), 1.6);
    Audio2.sfx.heal();
    fxp.push({ k: 'beam', x: p.x, y: p.y, col: '170,255,210', w: 0.5, life: 0, max: 1.1 });
    fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.2, grow: tw * 1.2, col: '190,255,220', life: 0, max: 1 });
    heal(target, Math.round(target.mhp * 0.35));
    paintArea(cellOf(target), 1, 'rainbow', 70);
    gainExp(a.kind, 10, a);
    await wait(700); unfocus(); await wait(120);
  }
  function skillTargets(a, skill) {
    const set = new Set();
    if (skill.target === 'area') cells.filter(c => c.walk && dist(c, a) <= skill.range).forEach(c => set.add(idx(c.r, c.c)));
    else live().filter(o => dist(o, a) <= skill.range && (skill.target === 'ally' ? o.side === 'ally' : foe(a, o))).forEach(o => set.add(idx(o.r, o.c)));
    return set;
  }
  async function spiritSkill(a, skill, cell) {
    const s = SPIRITS[skill.spirit], p = topOf(cell);
    face(a, cell); focus(p.x, p.y - tw * 0.5, 1.15);
    await skillBanner(skill.name, s.color);
    playMotion(a, 'cast', 1.8, 280); artEffect(GameArt.spiritEffects[skill.spirit], cell, 1.6 + Math.min(1, (skill.radius || 0) * .3));
    gainBond(skill.spirit, 2, true); stats.spiritUses++; stats.skillUses++;
    stats.skillBySpirit[skill.spirit] = (stats.skillBySpirit[skill.spirit] || 0) + 1;
    Audio2.sfx.skill();
    fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.2, grow: tw * (1.5 + (skill.radius || 0)), col: s.rgb, life: 0, max: 1, w: 4 });
    fxp.push({ k: 'beam', x: p.x, y: p.y, col: s.rgb, w: 0.5, life: 0, max: 1 });
    paintArea(cell, skill.paint, 'rainbow', 60);
    const targets = live().filter(o => dist(o, cell) <= (skill.radius || 0) && (skill.target === 'ally' ? o.side === 'ally' : foe(a, o)));
    let damage = 0;
    for (const o of targets) {
      if (skill.heal) heal(o, Math.round(o.mhp * Math.min(0.8, skill.heal * (1 + (bondRank(skill.spirit) - 1) * 0.04))));
      if (skill.guard) o.guard = Math.max(o.guard, skill.guard);
      if (skill.power) {
        const r = strike(a, o, { power: skill.power * (1 + (bondRank(skill.spirit) - 1) * 0.03), pierce: skill.pierce, sure: true, col: s.rgb, quiet: true });
        damage += r.dmg || 0;
        if (skill.root && o.hp > 0) o.root = Math.max(o.root, skill.root);
      }
      await wait(100);
    }
    if (skill.drain && damage) heal(a, Math.round(damage * skill.drain));
    if (skill.heal) gainExp('aria', 10, a);
    gainExp(skill.spirit, 6, null);
    refreshHud(); await wait(450);
    for (const o of targets) if (o.hp <= 0 && !o.dead) await defeat(o, a);
    unfocus(); await wait(150);
  }
  async function useItem(a, id, cell) {
    const it = ITEMS[id], t = unitAt(cell) || a, p = topOf(cell);
    focus(p.x, p.y - tw * 0.5, 1.12);
    await skillBanner(it.name, '#ffe9b8');
    if (it.heal) { Audio2.sfx.heal(); fxp.push({ k: 'beam', x: p.x, y: p.y, col: '190,255,215', w: 0.45, life: 0, max: 1 }); heal(t, Math.max(1, Math.round(t.mhp * it.heal))); }
    if (it.sp) { sp = Math.min(spCap(), sp + it.sp); const q = unitXY(t); popNum(q.x, q.y - tw * t.hgt * 0.6, `共鳴+${it.sp}`, 'heal'); Audio2.sfx.star(4); burst(q.x, q.y - tw * 0.5, 12, { col: '220,200,255' }); }
    if (it.guard) { t.guard = it.guard; const q = unitXY(t); floatText(q.x, q.y - tw * 1.3, '守りが固まった', 'sys'); Audio2.sfx.choose(); }
    if (it.paint) { paintArea(cell, it.paint, 'rainbow', 70); Audio2.sfx.star(2); burst(p.x, p.y - tw * 0.2, 16, {}); }
    refreshHud();
    await wait(650); unfocus(); await wait(120);
  }
  async function nightSky(a, cell) {
    const p = topOf(cell);
    focus(p.x, p.y - tw * 0.4, 1.12);
    await skillBanner('小さな夜空', '#cfd8ff');
    playMotion(a, 'cast', 1.8, 280); artEffect('night_sky', cell, 2.6);
    Audio2.sfx.star(3); Renoir.skyCast();
    for (let i = 0; i < 16; i++) fxp.push({ k: 'starburst', x: p.x, y: p.y - tw * 0.3, vx: Math.cos(i * 0.39) * 1.6, vy: Math.sin(i * 0.39) * 0.9, life: 0, max: 1.5 });
    paintArea(cell, 2, 'rainbow', 80);
    const hit = live().filter(o => foe(a, o) && dist(cellOf(o), cell) <= 2);
    await wait(300);
    for (const o of hit) { strike(a, o, { power: 0.9, sure: true, col: '200,215,255', quiet: true }); await wait(120); }
    await wait(450);
    for (const o of hit) if (o.hp <= 0 && !o.dead) await defeat(o, a);
    unfocus(); await wait(150);
  }
  async function summon(a, id, cell) {
    const my = sess;
    await cutIn('summon', id);
    if (my !== sess) return;
    const s = SPIRITS[id], lv = rec(id).lv;
    const u = makeUnit(id, 'ally', lv, cell, { summon: 3 + GB.summonTurns, until: turn + 3 + GB.summonTurns, acted: true, moved: true, dir: a.dir });
    stats.spiritUses++;
    units.push(u);
    playMotion(u, 'summon', 1, 500); artEffect(GameArt.spiritEffects[id], cell, 2.5);
    gainBond(id, 3, true, 'summon');
    const p = topOf(cell);
    focus(p.x, p.y - tw * 0.5, 1.14);
    fxp.push({ k: 'beam', x: p.x, y: p.y, col: s.rgb, w: 0.8, life: 0, max: 1.3 });
    for (let i = 0; i < 3; i++) fxp.push({ k: 'ring', x: p.x, y: p.y, r: tw * 0.3, grow: tw * (1.5 + i), col: s.rgb, life: 0, max: 1.2 + i * 0.2, w: 4, delay: i * 0.12 });
    burst(p.x, p.y - tw * 0.5, 22, { col: s.rgb, r: 8 });
    Audio2.sfx.skill();
    await wait(500);
    await skillBanner(s.summon.name, s.color);
    paintArea(cell, s.summon.rad === 3 && id === 'ivy' ? 1 : s.summon.rad, 'rainbow', 70);
    const foes = live().filter(o => o.side === 'enemy');
    if (id === 'gran') {
      Audio2.sfx.wave();
      const hit = foes.filter(o => dist(cellOf(o), cell) <= 2);
      for (const o of hit) { strike(u, o, { power: 1.2, sure: true, col: s.rgb, quiet: true }); await wait(110); }
      await wait(400); for (const o of hit) if (o.hp <= 0) await defeat(o, u);
    } else if (id === 'ivy') {
      const hit = foes.filter(o => dist(cellOf(o), cell) <= 3);
      for (const o of hit) { strike(u, o, { power: 0.5, sure: true, col: s.rgb, quiet: true, noCrit: true }); if (o.hp > 0) o.root = 1; await wait(90); }
      if (hit.length) floatText(p.x, p.y - tw * 1.4, '茨が、穢れだけを縛った', 'color', '#a8f0b0');
      await wait(400); for (const o of hit) if (o.hp <= 0) await defeat(o, u);
    } else if (id === 'spinel') {
      Audio2.sfx.heal();
      live().filter(o => o.side === 'ally').forEach(o => { heal(o, Math.round(o.mhp * (0.35 + (bondRank(id) - 1) * 0.02))); o.guard = 2; });
      floatText(p.x, p.y - tw * 1.4, '傷のところが、いちばん強く光った', 'color', '#ffe09a');
      await wait(500);
    } else if (id === 'king') {
      FX.flash('230,210,255', 0.6);
      for (const o of foes) { strike(u, o, { power: 0.65, sure: true, col: s.rgb, quiet: true }); await wait(70); }
      await wait(450); for (const o of foes) if (o.hp <= 0) await defeat(o, u);
    }
    gainExp(id, 20, u);
    refreshHud();
    unfocus(); await wait(200);
  }
  function doEnchant(a, id) { return runTask((async () => {
    busy = true; hideMenu(); endBtn.disabled = true;
    sp -= COST_ENCHANT; enchantUsed = true;
    await cutIn('enchant', id);
    const s = SPIRITS[id];
    a.enchant = { id, turns: 3 + GB.enchantTurns, from: turn };
    playMotion(a, 'enchant_' + id, 1.8, 500); artEffect(GameArt.spiritEffects[id], cellOf(a), 1.6);
    stats.spiritUses++;
    gainBond(id, 2, true, 'enchant');
    const p = unitXY(a);
    fxp.push({ k: 'beam', x: p.x, y: p.y, col: s.rgb, w: 0.55, life: 0, max: 1 });
    burst(p.x, p.y - tw * 0.7, 16, { col: s.rgb });
    floatText(p.x, p.y - tw * 1.6, `${s.name}が、心剣に宿った`, 'color', s.color);
    busy = false; endBtn.disabled = false;
    refreshHud();
    if (sel === a) { if (!a.moved) moveInfo = reachable(a); showMenu(a); showInfo(a); }
  })()); }
  async function departSpirit(u) {
    const p = unitXY(u);
    floatText(p.x, p.y - tw * 1.2, `${u.name}は、アリアの胸の中へ還った`, 'color', SPIRITS[u.kind].color);
    fxp.push({ k: 'beam', x: p.x, y: p.y, col: SPIRITS[u.kind].rgb, w: 0.4, life: 0, max: 1 });
    u.dead = true; u.dieT = performance.now();
    await wait(500);
  }

  function summonCells(a) {
    const set = new Set();
    cells.forEach(c => { const d = dist(c, cellOf(a)); if (d >= 1 && d <= 2 && c.walk && !unitAt(c)) set.add(idx(c.r, c.c)); });
    return set;
  }
  function areaOf(cmd, cell) {
    if (!cmd || !cell || !targets || !targets.has(idx(cell.r, cell.c))) return null;
    const s = new Set();
    const add = (c) => { if (c) s.add(idx(c.r, c.c)); };
    if (cmd === 'flash' && sel) { const v = [cell.r - sel.r, cell.c - sel.c]; add(cell); add(cellAt(cell.r + v[0], cell.c + v[1])); }
    else if (cmd === 'sky' || cmd === 'purify') areaCells(cell, 2).forEach(add);
    else if (cmd === 'pray') areaCells(cell, 1).forEach(add);
    else if (cmd.startsWith('item:')) { const it = ITEMS[cmd.slice(5)]; if (it && it.paint) areaCells(cell, it.paint).forEach(add); else add(cell); }
    else if (cmd.startsWith('summon:')) { const id = cmd.slice(7); areaCells(cell, SPIRITS[id].summon.rad).forEach(add); }
    else add(cell);
    return s;
  }

  // ---------- 手番 ----------
  async function playerPhase() {
    const my = sess;
    turn++; phase = 'player'; enchantUsed = false;
    units = units.filter(u => !u.dead || performance.now() - u.dieT < 1000);
    if (turn > 1) {
      for (const u of live().filter(u => u.until)) { u.summon = u.until - turn; if (u.summon < 0) await departSpirit(u); }
      const a = ariaU();
      const ch = live().find(u => u.kind === 'chrome_human');
      if (ch?.resonance && turn > ch.resonance.from) { ch.resonance.turns--; if (ch.resonance.turns <= 0) { ch.resonance = null; say('ルノワール', '四つの光が、静かな剣へ戻った。四響はこの戦闘では使用済み。', 4000); } }
      if (a && a.enchant && turn > a.enchant.from) {
        a.enchant.turns--;
        if (a.enchant.turns <= 0) { const p = unitXY(a); floatText(p.x, p.y - tw * 1.5, `${SPIRITS[a.enchant.id].name}が、心剣から離れた`, 'sys'); a.enchant = null; }
      }
      live().filter(u => u.side === 'ally').forEach(u => { if (u.guard) u.guard--; });
      const T = TIER[tierA];
      sp = Math.min(spCap(), sp + 1 + T.sp + GB.spTurn);
      const ar = ariaU(); if (ar && GB.regen && ar.hp < ar.mhp) heal(ar, Math.round(ar.mhp * GB.regen / 100));
      if (T.regen) live().filter(u => u.side === 'ally' && u.hp < u.mhp).forEach(u => heal(u, Math.round(u.mhp * T.regen)));
    }
    live().filter(u => u.side === 'ally').forEach(u => { u.moved = false; u.acted = false; u.normalAttacks = 0; u.undo = null; if (u.hazardRootUntil != null && turn > u.hazardRootUntil) { u.root = 0; u.hazardRootUntil = null; } });
    live().filter(u=>u.guardian).forEach(e=>guardianIntent(e));
    refreshHud();
    await showBanner('player', 'PLAYER PHASE', `TURN ${turn}　—　${floorNames()[0]}の手番`);
    if (my !== sess || over) return;
    busy = false; mode = 'idle';
    refreshHud();
    phaseLabel.textContent = '味方を選んでください';
    endBtn.disabled = false;
    const a = ariaU();
    if (a && (live().filter(u => u.side === 'ally').length === 1 || turn === 1)) select(a, true);
    tutorialStep('turn');
  }
  function endPlayerPhase() { return runTask((async () => {
    if (phase !== 'player' || busy || over || paused || mode === 'facing') return;
    hideSay();
    const my = sess;
    busy = true; deselect(); threat = null; endBtn.disabled = true;
    phaseLabel.textContent = '';
    await enemyPhase();
    if (my !== sess || over) return;
    await playerPhase();
  })()); }
  async function enemyPhase() {
    const my = sess;
    phase = 'enemy';
    await showBanner('enemy', 'ENEMY PHASE', cfg.inverted ? '白い膜の手番' : '穢れの手番');
    if (my !== sess || over) return;
    const T = TIER[tierE];
    if (T.regen) live().filter(u => u.side === 'enemy' && u.hp < u.mhp).forEach(u => heal(u, Math.round(u.mhp * T.regen)));
    const nearest = (e) => Math.min(99, ...live().filter(u => u.side === 'ally').map(u => dist(u, e)));
    const es = live().filter(u => u.side === 'enemy').sort((a, b) => nearest(a) - nearest(b));
    for (const e of es) {
      if (my !== sess || over || !running) return;
      if (e.dead) continue;
      await enemyAct(e);
      await wait(140);
    }
    unfocus();
  }
  function distField(e, allies) {
    const f = new Map(), q = [];
    allies.forEach(a => { const i = idx(a.r, a.c); f.set(i, 0); q.push(i); });
    while (q.length) {
      const i = q.shift(), c = cells[i], d = f.get(i);
      for (const n of nb4(c)) { const j = idx(n.r, n.c); if (f.has(j)) continue; if (!canStep(e, n, c)) continue; f.set(j, d + 1); q.push(j); }
    }
    return f;
  }
  async function enemyAct(e) {
    const my = sess;
    if (e.kind === 'chrome' && stage === 1) return;
    const ec = cellOf(e);
    if (e.guardian) { await guardianResolve(e); if (my !== sess || over || !running) return; }
    // 侵食：まわりの床をくすませる
    if (e.kind !== 'chrome') {
      const n = e.kind === 'boss' ? 2 : 1;
      const cand = shuffle(nb8(ec).filter(c => c.walk && c.floor !== 'dull'));
      cand.slice(0, n).forEach((c, i) => { paint(c, 'dull', i * 120); const p = topOf(c); smoke(p.x, p.y, 5, cfg.inverted ? '240,244,255' : '25,12,30', { a: 0.4 }); });
      if (cand.length) refreshHud();
    }
    // 核は言葉を産む
    if (e.kind === 'boss' && !e.guardian && turn % 3 === 0 && live().filter(u => u.side === 'enemy').length < (cfg.spawnCap || 5)) {
      const free = shuffle(nb4(ec).filter(c => c.walk && !unitAt(c)));
      if (free.length) {
        const words = cfg.kegWords || [];
        const u = makeUnit(cfg.spawnKind || 'shade', 'enemy', Math.max(1, e.lv - 2), free[0], { word: words[kegIdx++ % Math.max(1, words.length)] || '' });
        units.push(u); totalFoes++;
        const p = topOf(free[0]);
        focus(p.x, p.y - tw * 0.4, 1.08);
        smoke(p.x, p.y - tw * 0.3, 18, '15,5,25');
        Audio2.sfx.expose();
        floatText(p.x, p.y - tw * 1.1, '穢れが、言葉を産んだ', 'sys');
        paint(free[0], 'dull');
        await wait(700);
        if (my !== sess) return;
      }
    }
    const allies = live().filter(u => u.side === 'ally');
    if (!allies.length) return;
    const rch = reachable(e);
    const options = [rch.start, ...rch.ends];
    let best = null;
    for (const id of options) {
      const cell = cells[id];
      for (const a of allies) {
        if (!inRange(e, cell, cellOf(a))) continue;
        const est = calcDamage(e, a, {}, cell, false).dmg;
        const score = est + (est >= a.hp ? 60 : 0) + (a.kind === 'aria' ? 6 : 0) + (cell.floor === 'dull' ? 4 : 0) + (cell.h - cellOf(a).h) * 2 - (rch.d.get(id) || 0) * 0.3 + Math.random();
        if (!best || score > best.score) best = { score, id, a };
      }
    }
    if (best) {
      const p = unitXY(e);
      focus(p.x, p.y - tw * 0.4, 1.06);
      if (best.id !== rch.start) await moveAlong(e, pathTo(rch, best.id), false);
      if (my !== sess || !running) return;
      await attack(e, best.a, { col: cfg.inverted ? '235,240,255' : '170,110,220', skill: e.guardian ? GuardianCombat.profile(e.guardian).skills[e.guardianPhase] : e.kind === 'boss' && Math.random() < 0.5 ? (cfg.bossSkill || '黒い言葉') : e.kind === 'chrome' ? '漆黒の波' : null, color: '#c9a8ff' });
    } else if (!e.root) {
      const f = distField(e, allies);
      let pickId = null, bestV = f.has(rch.start) ? f.get(rch.start) : 999;
      for (const id of rch.ends) {
        const v = (f.has(id) ? f.get(id) : 999) - (cells[id].floor !== 'dull' ? 0.3 : 0);
        if (v < bestV) { bestV = v; pickId = id; }
      }
      if (pickId != null) {
        const p = unitXY(e); focus(p.x, p.y - tw * 0.4, 1.04);
        await moveAlong(e, pathTo(rch, pickId), false);
      }
    }
    if (e.dead) return;
    e.root = Math.max(0, e.root - 1);
    if (e.kind !== 'chrome' && paint(cellOf(e), 'dull')) refreshHud();
  }

  function guardianIntent(e) {
    if (e.dead) return;
    const p = GuardianCombat.profile(e.guardian);
    const forecast = GuardianCombat.plan(p,e.guardianPhase,e,live().filter(u=>u.side==='ally'),cells,turn);
    e.intent = {turn,phase:e.guardianPhase,ids:new Set(forecast.map(c=>idx(c.r,c.c)))};
  }
  function guardianTransition(e, initial=false) {
    const next = Math.max(e.guardianPhase || 0,GuardianCombat.phase(e.hp,e.mhp));
    if (!initial && next === e.guardianPhase) return;
    e.guardianPhase = next;
    const p = GuardianCombat.profile(e.guardian), m = GuardianCombat.mode(p,next);
    e.atk = Math.round(e.guardianAtk*m.power); e.mov=m.mov; e.rng=m.rng; e.armor=m.armor;
    guardianHistory.push({phase:next,lines:p.lines[next]});
    if (stats) stats.guardianVoices=next+1;
    if (!initial) {
      areaCells(cellOf(e),next+2).filter(c=>c.floor!=='dull').sort((a,b)=>dist(a,e)-dist(b,e)).slice(0,8+next*6).forEach((c,i)=>paint(c,'dull',i*25));
      const q=unitXY(e); fxp.push({k:'ring',x:q.x,y:q.y,r:tw*.3,grow:tw*3,col:next===1?'170,140,205':'145,230,210',life:0,max:1.1}); Audio2.sfx.expose();
      guardianIntent(e);
      say('戦場の声',p.lines[next].map(([who,text])=>`<b>${who}</b> ${text}`).join('<br>')+'<small>穢れが外へ流れ出した。予告の床を虹にして防ごう。</small>',10000);
    }
  }
  async function guardianResolve(e) {
    const p=GuardianCombat.profile(e.guardian), intent=e.intent;
    if (!intent || intent.turn !== turn) return;
    e.guard=0;
    const danger = [...intent.ids].map(id=>cells[id]).filter(c=>c.floor!=='rainbow');
    const ids = new Set(danger.map(c=>idx(c.r,c.c)));
    const hit = live().filter(u=>u.side==='ally'&&ids.has(idx(u.r,u.c)));
    await skillBanner(p.skills[intent.phase],p.colour);
    danger.forEach((c,i)=>paint(c,'dull',i*12));
    const q=unitXY(e); artEffect(GameArt.spiritEffects[p.material==='m_teal'?'gran':p.material==='m_green'?'ivy':p.material==='m_gold'?'spinel':'king'],cellOf(e),2.4);
    fxp.push({k:'ring',x:q.x,y:q.y,r:tw*.3,grow:tw*2,col:'210,155,200',life:0,max:1});
    for (const u of hit) {
      const damage=Math.max(1,Math.round(Math.min(u.mhp*(.08+intent.phase*.02),e.atk*.7)*(difficulty==='gentle'?.6:1)*(u.guard?.65:1)));
      u.hp=Math.max(0,u.hp-damage);stats.taken+=damage; const t=unitXY(u);popNum(t.x,t.y-tw*u.hgt,damage,'hurt');playMotion(u,'hurt');
      if (p.effect==='root') {u.root=1;u.hazardRootUntil=turn+1;}
      if (p.effect==='unguard') u.guard=0;
      if (p.effect==='push') {
        const dr=Math.sign(u.r-e.r),dc=Math.sign(u.c-e.c),n=cellAt(u.r+(Math.abs(u.r-e.r)>=Math.abs(u.c-e.c)?dr:0),u.c+(Math.abs(u.r-e.r)<Math.abs(u.c-e.c)?dc:0));
        if(n?.walk&&!unitAt(n)&&Math.abs(n.h-cellOf(u).h)<=1){u.r=n.r;u.c=n.c;}
      }
    }
    if (p.effect==='sp'&&hit.length) sp=Math.max(0,sp-1);
    if (p.effect==='guard'&&danger.length) e.guard=1;
    if (p.effect==='ember') danger.forEach(c=>nb4(c).forEach(n=>{if(n.floor!=='rainbow')paint(n,'dull');}));
    e.intent=null;refreshHud();await wait(420);
    for (const u of hit) if(u.hp<=0&&!u.dead){await defeat(u);if(over)return;}
  }

  // ---------- 選択と命令 ----------
  const normalAttackLimit = u => stage && (u.resonance || u.kind === 'aria' && u.enchant) ? 2 : 1;
  const followUpPending = u => u && !u.acted && u.normalAttacks > 0 && u.normalAttacks < normalAttackLimit(u);
  const selectionPrompt = u => followUpPending(u) ? 'あと1回攻撃できます／待機で向きを選んで終了' : u.moved ? '行動を選んでください' : '光る床へ移動／本人に触れて、その場で行動';
  function select(u, quiet) {
    sel = u; mode = 'selected'; threat = null; menuSub = null;
    moveInfo = u.moved ? null : reachable(u);
    // 移動先を選ぶ間はメニューを閉じておく（床を隠さないように）
    if (u.moved || !moveInfo.ends.size) showMenu(u); else hideMenu();
    showInfo(u);
    if (!quiet) Audio2.sfx.choose();
    phaseLabel.textContent = selectionPrompt(u);
    tutorialStep('select');
  }
  function deselect() {
    sel = null; mode = 'idle'; moveInfo = null; targets = null; targetCmd = null; menuSub = null;
    hideMenu();
    if (phase === 'player' && !busy) phaseLabel.textContent = '味方を選んでください';
  }
  function cancel() {
    if (busy || over) return;
    hideSay();
    if (mode === 'facing') { closeFacing(); return; }
    if (mode === 'target') { targets = null; targetCmd = null; mode = 'selected'; if (sel) { moveInfo = sel.moved ? null : reachable(sel); showMenu(sel, menuSub); phaseLabel.textContent = selectionPrompt(sel); } return; }
    if (mode === 'selected' && sel) {
      if (menuSub) { showMenu(sel); return; }
      if (!sel.moved && !cmdMenu.classList.contains('hidden')) { hideMenu(); return; }
      if (sel.moved && !sel.acted && sel.undo && !sel.normalAttacks) { undoMove(sel); return; }
      deselect();
    }
    threat = null;
  }
  function undoMove(u) {
    if (!u.undo || u.acted || u.normalAttacks) return;
    for (let i = u.undo.floors.length - 1; i >= 0; i--) { const [c, f] = u.undo.floors[i]; c.floor = c.prev = f; c.flipT = 0; }
    u.r = u.undo.r; u.c = u.undo.c; u.dir = u.undo.dir; u.moved = false; u.undo = null;
    Audio2.sfx.page();
    refreshHud();
    select(u, true);
  }
  function enterTarget(cmd, set) {
    if (!set || !set.size) { Audio2.sfx.wrong(); return; }
    mode = 'target'; targetCmd = cmd; targets = set; moveInfo = null;
    hideMenu();
    phaseLabel.textContent = '対象を選んでください（右クリック／Escで戻る）';
  }
  function act(u, fn, normal = false) {
    if (!running || phase !== 'player' || busy || over || paused || u.acted || (u.normalAttacks && !normal) || (normal && u.normalAttacks >= normalAttackLimit(u))) return;
    return runTask((async () => {
    const my = sess;
    busy = true; hideMenu(); targets = null; targetCmd = null; mode = 'acting'; threat = null;
    endBtn.disabled = true; phaseLabel.textContent = '';
    const r = await fn();
    if (my !== sess || !running) return;
    // 空振りも1回に数える。1撃目を確定したら、移動や別の行動には戻せない。
    if (normal) u.normalAttacks++;
    u.acted = !(normal && u.normalAttacks < normalAttackLimit(u));
    u.moved = true; u.undo = null;
    if (over) return;
    busy = false; endBtn.disabled = false;
    deselect();
    refreshHud();
    tutorialStep('attack');
    if (stage === 0 && (stats.phase0 || 0) >= 2 && !paused) {
      paused = true; busy = true; endBtn.disabled = true;
      later(() => {
        if (my !== sess || !running) return;
        if (cfg.onPhase0) cfg.onPhase0();
        else enterPhase1({ skyCharges: 4, say: { who: 'アリア', text: 'あなたの黒は、穢れじゃない。<br>白い膜だけを、切り分ける。' } });
      }, 1400);
      return;
    }
    void r;
    if (followUpPending(u)) { select(u, true); return; }
    autoEnd();
  })()); }
  function autoEnd() {
    if (paused || over) return;
    if (live().filter(u => u.side === 'ally').every(u => u.acted)) later(() => { if (phase === 'player' && !busy && !over && !paused) endPlayerPhase(); }, 500);
  }
  function openFacing(u) {
    // 向きを確定するまで行動も移動取り消しの記録も消費しない。
    mode = 'facing'; targets = null; targetCmd = null; moveInfo = null;
    endBtn.disabled = true;
    phaseLabel.textContent = '正面を向ける方向を選んで待機（Escで戻る）';
    showMenu(u, 'facing'); updateBar();
    cmdMenu.querySelector(`[data-k="facewait"][data-a="${u.dir}"]`)?.focus({ preventScroll: true });
  }
  function closeFacing() {
    mode = 'selected'; endBtn.disabled = false;
    if (!sel) { deselect(); return; }
    moveInfo = sel.moved ? null : reachable(sel);
    showMenu(sel); updateBar(); showInfo(sel);
    phaseLabel.textContent = selectionPrompt(sel);
    cmdMenu.querySelector('[data-k="wait"]')?.focus({ preventScroll: true });
  }
  function finishWait(u, dir) {
    if (mode !== 'facing' || !Number.isInteger(dir) || dir < 0 || dir >= DIRS.length) return;
    u.dir = dir; u.acted = true; u.moved = true; u.undo = null;
    endBtn.disabled = false;
    deselect(); showInfo(u); refreshHud(); autoEnd();
  }
  function command(k, arg) {
    if (!running || phase !== 'player' || busy || !sel || over || paused || Panel.isOpen()) return;
    hideSay();
    const u = sel;
    if (u.acted || (followUpPending(u) && !['attack', 'wait', 'facewait', 'back'].includes(k))) return;
    if (mode === 'facing' && k !== 'facewait' && k !== 'back') return;
    Audio2.sfx.choose();
    if (k === 'attack') enterTarget('attack', attackTargets(u));
    else if (k === 'flash') { const s = new Set(); nb4(cellOf(u)).forEach(c => s.add(idx(c.r, c.c))); enterTarget('flash', s); }
    else if (k === 'renoir') {
      if (!cfg.postgame || u.kind !== 'chrome_human' || renoirUsed || sp < 6) return;
      doRenoir(u);
    }
    else if (k === 'purify') {
      if (!cfg.postgame || !['aria', 'chrome_human'].includes(u.kind) || sp < 2) return;
      const set = new Set(cells.filter(c => c.walk && dist(c, u) <= 2).map(c => idx(c.r, c.c)));
      enterTarget('purify', set);
    }
    else if (k === 'pray') { const s = new Set(); live().filter(o => o.side === 'ally' && dist(o, u) <= 1).forEach(o => s.add(idx(o.r, o.c))); enterTarget('pray', s); }
    else if (k === 'spirit') showMenu(u, 'spirit');
    else if (k === 'learned' && u.kind === 'aria' && stage) { if (!Progression.learned(party, null, learnedRoute).length && Progression.learned(party).length) learnedRoute = Progression.learned(party)[0].route; showMenu(u, 'learned'); }
    else if (k === 'learnedroute' && u.kind === 'aria' && stage && Object.hasOwn(Progression.routes, arg)) { learnedRoute = arg; showMenu(u, 'learned'); }
    else if (k === 'skill') {
      const skill = Progression.learned(party).find(s => s.id === arg);
      if (u.kind !== 'aria' || !stage || !skill || sp < skill.cost) return;
      enterTarget('skill:' + arg, skillTargets(u, skill));
    }
    else if (k === 'item') showMenu(u, 'item');
    else if (k === 'useitem') {
      const it = ITEMS[arg], s = new Set();
      if (it.target === 'self') s.add(idx(u.r, u.c));
      else if (it.target === 'ally') live().filter(o => o.side === 'ally' && dist(o, u) <= 1).forEach(o => s.add(idx(o.r, o.c)));
      else cells.forEach(c => { if (c.walk && dist(c, u) <= 2) s.add(idx(c.r, c.c)); });
      enterTarget('item:' + arg, s);
    }
    else if (k === 'back') { if (mode === 'facing') closeFacing(); else showMenu(u); }
    else if (k === 'summon') { if (u.kind !== 'aria' || !stage || !(cfg.spirits || []).includes(arg) || defeatedSpirits.has(arg) || sp < COST_SUMMON || u.enchant || live().some(x => x.until)) return; enterTarget('summon:' + arg, summonCells(u)); }
    else if (k === 'enchant') { if (u.kind !== 'aria' || !stage || !(cfg.spirits || []).includes(arg) || defeatedSpirits.has(arg) || enchantUsed || sp < COST_ENCHANT || u.enchant?.id === arg || live().some(x => x.until)) return; doEnchant(u, arg); }
    else if (k === 'sky') { const s = new Set(); cells.forEach(c => { if (c.walk && dist(c, u) <= 4) s.add(idx(c.r, c.c)); }); enterTarget('sky', s); }
    else if (k === 'wait') openFacing(u);
    else if (k === 'facewait') finishWait(u, Number(arg));
    else if (k === 'undo') undoMove(u);
  }
  function execTarget(cell) {
    const u = sel, cmd = targetCmd, o = unitAt(cell);
    if (!u || u.acted || !cmd || (followUpPending(u) && cmd !== 'attack')) return;
    if (cmd === 'attack' && o && foe(u, o) && attackTargets(u).has(idx(cell.r, cell.c))) act(u, () => attack(u, o, { normal: true }), true);
    else if (cmd === 'flash') { sp -= flashCost(); act(u, () => flashStrike(u, cell)); }
    else if (cmd === 'purify') {
      if (!cfg.postgame || !['aria', 'chrome_human'].includes(u.kind) || sp < 2 || !cell.walk || dist(cell, u) > 2) return;
      sp -= 2; act(u, () => purify(u, cell));
    }
    else if (cmd === 'pray' && o) { sp -= COST_PRAY; act(u, () => pray(u, o)); }
    else if (cmd.startsWith('skill:')) {
      const skill = Progression.learned(party).find(s => s.id === cmd.slice(6));
      if (!skill || sp < skill.cost || !skillTargets(u, skill).has(idx(cell.r, cell.c))) return;
      sp -= skill.cost; act(u, () => spiritSkill(u, skill, cell));
    }
    else if (cmd.startsWith('summon:')) { const id = cmd.slice(7); if (defeatedSpirits.has(id) || sp < COST_SUMMON) return; sp -= COST_SUMMON; act(u, () => summon(u, id, cell)); }
    else if (cmd === 'sky') { skyCharges--; act(u, () => nightSky(u, cell)); }
    else if (cmd.startsWith('item:')) {
      const id = cmd.slice(5);
      if (!(party.items[id] > 0)) return;
      party.items[id]--; if (!party.items[id]) delete party.items[id];
      stats.items++; saveParty();
      act(u, () => useItem(u, id, cell));
    }
  }
  function onClick(cell) {
    if (!running || busy || over || phase !== 'player' || paused || Panel.isOpen()) return;
    hideSay();
    if (mode === 'facing') return;
    if (!cell) { if (mode !== 'selected') cancel(); return; }
    const id = idx(cell.r, cell.c), u = unitAt(cell);
    if (mode === 'target') {
      if (targets && targets.has(id)) execTarget(cell);
      else { Audio2.sfx.wrong(); const p = topOf(cell); floatText(p.x, p.y - tw * 0.5, '光っている場所を選んで（右クリックで戻る）', 'sys'); }
      return;
    }
    if (mode === 'selected' && sel) {
      if (!sel.moved && moveInfo && moveInfo.ends.has(id) && !u) { doMove(sel, cell); return; }
      if (u && foe(sel, u) && attackTargets(sel).has(id)) { const a = sel; act(a, () => attack(a, u, { normal: true }), true); return; }
      if (u === sel) { if (cmdMenu.classList.contains('hidden')) showMenu(sel); else if (!sel.moved) hideMenu(); return; }
      if (u && u.side === 'ally') {
        if (sel.moved) { const p = unitXY(sel); floatText(p.x, p.y - tw * 1.5, '行動か待機を選んで', 'sys'); return; }
        if (!u.acted) { select(u); return; }
      }
      // 選んだままにしておく：敵は情報だけ、届かない床は知らせるだけ
      if (u) { showInfo(u); Audio2.sfx.hover(); return; }
      if (!sel.moved) { Audio2.sfx.wrong(); const p = topOf(cell); floatText(p.x, p.y - tw * 0.5, cell.walk ? 'そこへは届かない' : 'そこは歩けない', 'sys'); }
      return;
    }
    threat = null;
    if (u && u.side === 'ally' && !u.acted) select(u);
    else if (u) inspect(u);
  }
  function inspect(u) {
    showInfo(u);
    threat = u.side === 'enemy' ? reachable(u) : null;
    Audio2.sfx.hover();
  }
  function doMove(u, cell) { return runTask((async () => {
    busy = true; hideMenu();
    const path = pathTo(moveInfo, idx(cell.r, cell.c));
    u.undo = { r: u.r, c: u.c, dir: u.dir, floors: [] };
    moveInfo = null;
    await moveAlong(u, path, true);
    if (!running) return;
    u.moved = true; busy = false;
    tutorialStep('move');
    if (sel === u) { showMenu(u); showInfo(u); phaseLabel.textContent = '行動を選んでください'; }
  })()); }

  // ---------- 画面の部品 ----------
  const actHereBtn = $id('actHere'), cancelBtn = $id('cancelSel');
  let barState = '';
  function updateBar() {
    const canRotate = running && !busy && !over && !paused && !Panel.isOpen();
    $id('rotateLeft').disabled = $id('rotateRight').disabled = !canRotate;
    const st = phase === 'player' && !busy && !over && !paused && sel ? (mode === 'facing' ? 'f' : mode === 'target' ? 't' : followUpPending(sel) ? 'a' : sel.moved ? 'm' : 's') : '';
    if (st === barState) return;
    barState = st;
    actHereBtn.classList.toggle('hidden', st !== 's');
    cancelBtn.classList.toggle('hidden', !st);
    cancelBtn.textContent = st === 't' || st === 'f' ? '戻る' : st === 'm' ? '移動を戻す' : '選び直す';
  }
  actHereBtn.addEventListener('click', e => { e.stopPropagation(); if (sel && !busy) { hideSay(); Audio2.sfx.choose(); showMenu(sel); } });
  cancelBtn.addEventListener('click', e => { e.stopPropagation(); if (!sel || busy) return; hideSay(); if (mode === 'selected' && !sel.moved && !menuSub) { deselect(); return; } cancel(); });
  function hideMenu() { cmdMenu.classList.add('hidden'); }
  let learnedRoute = 'enchant';
  function showMenu(u, sub) {
    if (!u || u.acted) { hideMenu(); return; }
    const followUp = followUpPending(u);
    if (followUp && sub !== 'facing') sub = null;
    const changed = cmdMenu.dataset.sub !== (sub || '');
    cmdMenu.dataset.sub = sub || '';
    cmdMenu.classList.toggle('learned', sub === 'learned');
    cmdMenu.classList.toggle('facing', sub === 'facing');
    cmdMenu.classList.toggle('followup', followUp && sub !== 'facing');
    cmdMenu.classList.toggle('renoir', u.kind === 'chrome_human');
    menuSub = sub || null;
    const it = [];
    const btn = (k, label, opt = {}) => `<button class="cm-b${opt.art ? ' cm-item' : ''}" data-k="${k}" ${opt.a ? `data-a="${opt.a}"` : ''} ${opt.dis ? 'disabled' : ''} data-d="${opt.d || ''}">${opt.art ? `<span>${InventoryArt.icon(opt.art)}<span>${label}</span>${opt.cost != null ? `<em>${opt.cost}</em>` : ''}</span>` : `${label}${opt.cost != null ? `<em>${opt.cost}</em>` : ''}`}${opt.key ? `<kbd>${opt.key}</kbd>` : ''}</button>`;
    if (sub === 'facing') {
      it.push(`<div class="cm-head">向きを選んで待機<small>${u.name}</small></div>`);
      it.push('<p class="cm-facing-help">選んだ方向が正面になります。背後からの攻撃に気をつけて。</p>');
      it.push(`<div class="cm-facing-grid" role="group" aria-label="待機する向き">${[3, 0, 2, 1].map(screenDir => { const dir = worldDir(screenDir); return `<button class="cm-face${u.dir === dir ? ' current' : ''}" data-k="facewait" data-a="${dir}" aria-label="${FACING[screenDir].name}を向いて待機" ${u.dir === dir ? 'aria-current="true"' : ''}><b aria-hidden="true">${FACING[screenDir].arrow}</b><span>${FACING[screenDir].name}</span><small>${u.dir === dir ? '現在の向き' : 'この向きで待機'}</small></button>`; }).join('')}</div>`);
      it.push(btn('back', '戻る', { d: '向きと行動を確定せず戻る', key: 'Esc' }));
      it.push('<p class="cm-facing-keys">方向キー＋Enter · 1↗ 2↘ 3↙ 4↖</p>');
    } else if (sub === 'spirit') {
      it.push(`<div class="cm-head">精霊<small>共鳴 ${sp}</small></div>`);
      it.push('<div class="cm-note cm-spirit-choice"><b>召喚 6</b>：登場の大技＋精霊が別行動<br><b>宿す 3</b>：アリアの通常攻撃が毎ターン2回</div>');
      const summoned = live().find(x => x.until);
      const enchanted = u.enchant;
      if (summoned) it.push(`<div class="cm-note">${summoned.name}を召喚している間は、心剣に宿せない</div>`);
      else if (enchanted) it.push(`<div class="cm-note">${SPIRITS[enchanted.id].name}が心剣に宿っている間は、召喚できない</div>`);
      (cfg.spirits || []).forEach(id => {
        const s = SPIRITS[id];
        const fallen = defeatedSpirits.has(id);
        const canSum = !fallen && !summoned && !enchanted && sp >= COST_SUMMON && summonCells(u).size > 0;
        const canEn = !fallen && !summoned && !enchantUsed && sp >= COST_ENCHANT && !(enchanted && enchanted.id === id);
        const why = (k) => fallen ? '（戦闘不能：この戦闘中は使えない）' : k === 'summon' ? (summoned ? '（いまは召喚中）' : enchanted ? '（宿している間は召喚できない）' : sp < COST_SUMMON ? '（共鳴が足りない）' : '')
          : (summoned ? '（召喚している間は宿せない）' : enchantUsed ? '（このターンはもう宿した）' : sp < COST_ENCHANT ? '（共鳴が足りない）' : '');
        it.push(`<div class="cm-sp${fallen ? ' fallen' : ''}" style="--sc:${s.color}"><div class="cm-spn">${s.name}<small>${fallen ? '戦闘不能 · この戦闘中は使用不可' : `Lv${rec(id).lv}・絆${bondRank(id)}`}</small></div>
          <button class="cm-s" data-k="summon" data-a="${id}" ${canSum ? '' : 'disabled'} data-d="【召喚】${s.summon.name}：${s.summon.desc}。${3 + GB.summonTurns}ターン共に戦う（行動を使う）${why('summon')}">召喚<em>${COST_SUMMON}</em></button>
          <button class="cm-s" data-k="enchant" data-a="${id}" ${canEn ? '' : 'disabled'} data-d="【心剣に宿す】${s.enchant.name}：${s.enchant.desc}。${3 + GB.enchantTurns}ターン、通常攻撃が毎ターン2回（移動は1回・技や道具は1回）。宿す行動は消費なし・1ターンに1度${why('enchant')}">宿す<em>${COST_ENCHANT}</em></button></div>`);
      });
      it.push(btn('back', 'もどる', { d: '' }));
    } else if (sub === 'learned') {
      it.push(`<div class="cm-head">精霊から覚えた技<small>共鳴 ${sp}</small></div>`);
      it.push(`<div class="cm-route-tabs" role="group" aria-label="習得した系統">${Object.entries(Progression.routes).map(([id, route]) => `<button data-k="learnedroute" data-a="${id}" aria-pressed="${learnedRoute === id}">${route.name}<small>${Progression.learned(party, null, id).length}種</small></button>`).join('')}</div>`);
      const list = Progression.learned(party, null, learnedRoute);
      if (!list.length) it.push(`<div class="cm-note">${Progression.routes[learnedRoute].name}の熟練度8・20・40で技を覚えます。「仲間・絆」で進みぐあいを確認できます。</div>`);
      list.forEach(s => {
        it.push(`<div class="cm-skill-label" style="color:${SPIRITS[s.spirit].color}">${SPIRITS[s.spirit].name}・${Progression.routes[s.route].name}で習得・${s.type}</div>`);
        it.push(`<button class="cm-b cm-learned" data-k="skill" data-a="${s.id}" data-d="" ${sp < s.cost || !skillTargets(u, s).size ? 'disabled' : ''}><span>${s.name}<em>${s.cost}</em></span><small>${s.desc}</small></button>`);
      });
      it.push(btn('back', 'もどる'));
    } else if (sub === 'item') {
      it.push(`<div class="cm-head">道具<small>いくつ持っているか</small></div>`);
      Object.keys(party.items).filter(k => party.items[k] > 0 && ITEMS[k]).forEach(k => it.push(btn('useitem', ITEMS[k].name, { a: k, art: k, cost: '×' + party.items[k], d: ITEMS[k].desc })));
      it.push(btn('back', 'もどる', { d: '' }));
    } else {
      const atk = attackTargets(u).size > 0;
      it.push(`<div class="cm-head">${u.name}<small>Lv${u.lv}</small></div>`);
      if (normalAttackLimit(u) === 2) it.push(`<div class="cm-combo" role="status" aria-live="polite"><span>通常攻撃</span><b>残り${2 - u.normalAttacks}回</b><small>${followUp ? (atk ? '同じ敵にも、別の敵にも追撃できます。' : '届く敵がいません。待機で向きを選べます。') : '1ターンに2回。技・道具を選ぶと行動終了。'}</small></div>`);
      it.push(btn('attack', (followUp ? '追撃 · ' : '') + (u.kind === 'aria' ? (u.enchant ? SPIRITS[u.enchant.id].enchant.name : '心剣') : '攻撃'), { dis: !atk, key: 'A', d: atk ? '届く敵を選んで攻撃する。敵に直接触れても攻撃できる' : '届く場所に敵がいない' }));
      if (cfg.postgame && ['aria', 'chrome_human'].includes(u.kind) && !followUp) it.push(btn('purify', '浄化 · 灯を繋ぐ', { cost: 2, dis: sp < 2, d: '2マス以内の床を選び、周り2マスを虹に。選んだ復興の灯を点ける（行動を使う）' }));
      if (u.kind === 'chrome_human' && !followUp) {
        const why = renoirUsed ? '使用済み · 1戦闘に1回' : '1戦闘に1回 · 3ターン';
        it.push(btn('renoir', '四響エンチャント', { cost: 6, dis: renoirUsed || sp < 6, d: `${why}。精霊から吸収して身につけたルノワール自身の能力。精霊の戦闘不能に影響されない。射程2・攻撃+25%・守りと鉛を貫通・押し流し・拘束・30%吸収・虹床拡張。通常攻撃は毎ターン2回。宿す時は行動を使わない` }));
        it.push(`<div class="cm-note">ルノワール · ${why}</div>`);
        it.push(btn('pray', '夜の祈り', { cost: COST_PRAY, dis: sp < COST_PRAY, d: '自分か隣の味方を35%癒す。ルノワールが夜に灯を残す' }));
        it.push(btn('item', '道具 ▸', { d: '共有の道具を使う（行動を使う）' }));
      }
      if (u.kind === 'aria' && !followUp) {
        if (stage) it.push(btn('flash', '透明の一閃', { cost: flashCost(), dis: sp < flashCost(), d: '前方2マスを貫く一閃。必中・威力1.35倍、通り道を虹に染める' }));
        it.push(btn('pray', '凪の祈り', { cost: COST_PRAY, dis: sp < COST_PRAY, d: '自分か隣の味方のHPを35%癒し、周りを虹に染める' }));
        if (stage && (cfg.spirits || []).length) it.push(btn('spirit', '精霊 ▸', { d: '召喚6：大技＋精霊の別行動／宿す3：通常攻撃が毎ターン2回（どちらか一方だけ）' }));
        if (stage && Progression.learned(party).length) it.push(btn('learned', '覚えた技 ▸', { d: 'エンチャントと召喚、それぞれの熟練で覚えた技。習得後は宿しや召喚なしでも使える' }));
        const nItems = Object.keys(party.items).filter(k => party.items[k] > 0 && typeof ITEMS !== 'undefined' && ITEMS[k]).length;
        it.push(btn('item', '道具 ▸', { dis: !nItems, d: nItems ? '道具を使う（行動を使う）' : '道具を持っていない' }));
        if (stage && skyCharges > 0) it.push(btn('sky', '小さな夜空', { cost: '×' + skyCharges, d: 'ルノワールの夜空。周り2マスを夜空に変え、白い膜を打つ' }));
      }
      it.push(btn('wait', '待機 · 向きを選ぶ', { key: 'W', d: '4方向から正面を向ける方向を選んで、行動を終える' }));
      if (u.moved && u.undo && !u.normalAttacks) it.push(btn('undo', '移動を戻す', { d: '歩く前の場所に戻る' }));
    }
    it.push('<div class="cm-desc"></div>');
    cmdMenu.innerHTML = it.join('');
    cmdMenu.classList.remove('hidden');
    if (changed) cmdMenu.scrollTop = 0;
    const desc = cmdMenu.querySelector('.cm-desc');
    cmdMenu.querySelectorAll('button').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); command(b.dataset.k, b.dataset.a); };
      // タッチの疑似ホバーで説明が増えると、下端固定メニューが指の下から動いてしまう。
      b.onmouseenter = () => { if (matchMedia('(hover: hover) and (pointer: fine)').matches) desc.textContent = b.dataset.d || ''; };
    });
    // 位置（狭い画面では下に敷く）
    const narrow = screen.classList.contains('compact');
    cmdMenu.classList.toggle('sheet', narrow);
    if (narrow) { cmdMenu.style.left = cmdMenu.style.top = ''; return; }
    const p = toScreen(unitXY(u).x, unitXY(u).y);
    const mw = cmdMenu.offsetWidth || 200, mh = cmdMenu.offsetHeight || 200;
    let top = p.y - tw * 1.35;
    // 左右のうち、ほかの者を隠さないほうへ
    const others = live().filter(o => o !== u).map(o => { const q = unitXY(o); return toScreen(q.x, q.y - tw * o.hgt * 0.5); });
    const cover = (l) => others.filter(q => q.x > l - 10 && q.x < l + mw + 10 && q.y > top - 10 && q.y < top + mh + 30).length;
    const L = p.x - tw * 0.5 - mw, R = p.x + tw * 0.5;
    const okL = L >= 10, okR = R + mw <= W - 10;
    let left = !okL ? R : !okR ? L : (cover(L) < cover(R) ? L : cover(R) < cover(L) ? R : (p.x < W / 2 ? L : R));
    if (cover(left) && W >= 820) { const alt = p.y - tw * 1.35 - mh - 10 > 70 ? p.y - tw * 1.35 - mh : p.y + th; const c0 = cover(left); top = alt; if (cover(left) >= c0) top = p.y - tw * 1.35; }
    // 情報窓・精霊の札と重ならないように
    const boxes = [unitInfo, spiritBox, guardianHud, hintEl.classList.contains('show') ? hintEl : null].filter(b => b && !b.classList.contains('hidden') && b.offsetParent).map(b => b.getBoundingClientRect());
    const hit = (l, t) => boxes.find(b => l < b.right && l + mw > b.left && t < b.bottom && t + mh > b.top);
    top = Math.max(70, Math.min(H - mh - 70, top));
    let b = hit(left, top);
    if (b) {
      const up = b.top - mh - 8, down = b.bottom + 8;
      if (up >= 70 && !hit(left, up)) top = up;
      else if (down + mh <= H - 60 && !hit(left, down)) top = down;
      else { const other = left < p.x ? p.x + tw * 0.5 : p.x - tw * 0.5 - mw; if (other >= 8 && other + mw <= W - 8 && !hit(other, top)) left = other; }
    }
    cmdMenu.style.left = Math.max(8, Math.min(W - mw - 8, left)) + 'px';
    cmdMenu.style.top = Math.max(8, Math.min(H - mh - 8, top)) + 'px';
  }
  function showInfo(u) {
    if (!u) { unitInfo.classList.add('hidden'); infoU = null; return; }
    infoU = u;
    const ally = u.side === 'ally', s = SPIRITS[u.kind];
    const port = GameArt.available(u.artId||u.kind) ? `<div class="ui-port generated">${GameArt.portrait(u.artId||u.kind)}</div>` : u.kind === 'aria' ? `<div class="ui-port"><img src="assets/img/aria.png"></div>`
      : s ? `<div class="ui-port orb" style="--c:${s.color}"></div>`
        : `<div class="ui-port foe ${u.kind}"></div>`;
    const r = ally ? rec(u.kind) : null;
    const st = [];
    if (u.enchant) { const es = SPIRITS[u.enchant.id]; st.push(`<span style="--c:${es.color}">宿：${es.enchant.name}・${u.enchant.turns}</span>`); if (normalAttackLimit(u) === 2) st.push(`<span style="--c:${es.color}">通常攻撃${phase === 'player' ? ` 残り${u.acted ? 0 : 2 - u.normalAttacks}回` : '2回'}</span>`); }
    if (u.resonance) st.push(`<span style="--c:#d2beff">四響エンチャント · あと${u.resonance.turns}ターン / 通常攻撃 残り${u.acted ? 0 : 2 - u.normalAttacks}回</span>`);
    if (u.until) st.push(`<span style="--c:${s.color}">${u.summon > 0 ? `召喚 あと${u.summon}ターン` : '召喚 このターンまで'}</span>`);
    if (u.root) st.push('<span style="--c:#7fd67a">縛られている</span>');
    if (u.guard) st.push('<span style="--c:#ffd25e">守り</span>');
    if (u.armor) st.push(`<span style="--c:#b8bcc8">鉛×${u.armor}</span>`);
    const f = cellOf(u).floor, fn = floorNames();
    const ft = f === 'rainbow' ? `<span class="ft rainbow">${fn[0]}の床</span>` : f === 'dull' ? `<span class="ft dull">${fn[1]}の床</span>` : '<span class="ft">素の床</span>';
    const rng = effRng(u);
    const unknown = u.kind === 'chrome' && stage === 0;
    const neutral = u.side === 'neutral';
    const facing = neutral ? null : facingOf(u.dir);
    const side = u.side === 'enemy' && sel && !sel.dead && sel.side === 'ally' ? attackSide(cellOf(sel), u) : null;
    unitInfo.className = 'side-' + u.side;
    unitInfo.innerHTML = `${port}<div class="ui-main">
      <div class="ui-top"><span class="ui-name">${u.name}</span>${neutral ? '' : `<span class="ui-lv">LV<b>${u.lv}</b></span>`}</div>
      ${facing ? `<div class="ui-facing" data-dir="${u.dir}" data-view-dir="${viewDir(u.dir)}"><b>${facing.arrow}</b><span>正面：${facing.name}</span></div>${side ? `<div class="ui-approach ${side}" data-side="${side}">${APPROACH[side]}</div>` : ''}` : ''}
      ${u.word ? `<div class="ui-word">「${u.word}」</div>` : ''}
      ${neutral ? '<div class="ui-word">——その人の色は、切らない</div>' : `<div class="ui-bar hp"><i style="width:${unknown ? 100 : Math.round(u.hp / u.mhp * 100)}%"></i><span>${u.guardian?'穢れHP':'HP'} ${unknown ? '？？？' : `${u.hp} / ${u.mhp}`}</span></div>`}
      ${r ? `<div class="ui-bar exp"><i style="width:${r.lv >= MAX_LV ? 100 : r.exp}%"></i><span>${r.lv >= MAX_LV ? 'EXP MAX · 成長上限' : `EXP ${r.exp} / 100`}</span></div>` : ''}
      ${neutral ? '' : `<div class="ui-st"><span>攻<b>${u.atk}</b></span><span>防<b>${unknown ? '?' : u.def}</b></span><span>移<b>${u.mov}</b></span><span>射<b>${rng[0] === rng[1] ? rng[0] : rng[0] + '-' + rng[1]}</b></span></div>`}
      <div class="ui-tags">${ft}${st.join('')}</div></div>`;
  }
  function renderSpirits() {
    const list = stage ? (cfg.spirits || []) : [];
    spiritBox.innerHTML = '';
    if (!list.length) { spiritBox.style.display = 'none'; return; }
    spiritBox.style.display = '';
    const a = ariaU();
    if (cfg.companion) {
      const ch = live().find(u => u.kind === 'chrome_human');
      if (ch) {
        const b = document.createElement('button'); b.className = 'skill battle-companion';
        b.innerHTML = `${GameArt.portrait('chrome_human', 'skill-face')}<span>クロム<small>HP ${ch.hp}/${ch.mhp} · ${ch.acted ? '行動済み' : '操作する'}</small></span>`;
        b.disabled = ch.acted || busy || phase !== 'player' || over;
        b.onclick = e => { e.stopPropagation(); if (!busy && !paused && !ch.acted && phase === 'player' && !over && mode !== 'facing' && !Panel.isOpen()) { hideSay(); select(ch); } };
        spiritBox.appendChild(b);
      }
    }
    list.forEach(id => {
      const s = SPIRITS[id], r = rec(id), su = live().find(u => u.kind === id);
      const anySum = live().some(u => u.until), en = a && a.enchant;
      const fallen = defeatedSpirits.has(id);
      const state = fallen ? '戦闘不能 · この戦闘中は使用不可' : su ? (su.summon > 0 ? `召喚中・あと${su.summon}ターン` : '召喚中・このターンまで') : (en && en.id === id) ? `通常攻撃2回・あと${en.turns}ターン`
        : followUpPending(a) ? '追撃か待機を選択' : anySum ? '召喚中は宿せない' : en ? (enchantUsed ? 'このターンは宿し済み' : sp >= COST_ENCHANT ? '宿し替えできる' : '宿し中は召喚できない')  : sp >= COST_SUMMON ? '召喚・宿しができる' : sp >= COST_ENCHANT ? '宿せる' : '共鳴を待つ';
      const b = document.createElement('button');
      b.className = 'skill spirit' + (fallen ? ' fallen' : '') + (su || (a && a.enchant && a.enchant.id === id) ? ' armed' : '');
      b.disabled = fallen;
      b.setAttribute('aria-label', `${s.name} · ${state}`);
      b.style.setProperty('--sc', s.color);
      b.innerHTML = `${GameArt.available(id) ? GameArt.portrait(id, 'sk-art') : ''}<span class="sk-n">${s.name}</span><span class="sk-d">${state}</span><span class="sk-c">Lv${r.lv}・絆${bondRank(id)}</span>`;
      b.onclick = () => {
        if (busy || phase !== 'player' || over || paused || mode === 'facing' || Panel.isOpen()) return;
        const a2 = ariaU(); if (!a2 || a2.acted || followUpPending(a2)) return;
        hideSay();
        if (sel !== a2) { if (sel && sel.moved) return; select(a2, true); }
        if (mode === 'target') { mode = 'selected'; targets = null; targetCmd = null; moveInfo = a2.moved ? null : reachable(a2); }
        showMenu(a2, 'spirit');
      };
      spiritBox.appendChild(b);
    });
  }
  function refreshHud() {
    if (!cfg) return;
    const { R, D } = ratios();
    ratioA = R; ratioE = D;
    if (stats && !over) stats.dullMax = Math.max(stats.dullMax || 0, D);
    const nA = tierOf(R), nE = tierOf(D), fn = floorNames();
    if (hudReady && nA !== tierA) { if (nA > tierA) { floatText(W / 2, 150, `${fn[0]}の加護 ${ROMAN[nA]}`, 'color', '#e9f4ff'); Audio2.sfx.star(nA + 3); } }
    if (hudReady && nE !== tierE && nE > tierE) floatText(W / 2, 176, `${fn[1]}が強まる ${ROMAN[nE]}`, 'color', cfg.inverted ? '#ffffff' : '#c9a8d8');
    tierA = nA; tierE = nE;
    const fb = $id('floorBar');
    fb.querySelector('.fb-rain').style.width = (R * 100) + '%';
    fb.querySelector('.fb-dull').style.width = (D * 100) + '%';
    fb.querySelector('.fb-lr').innerHTML = `${fn[0]}<b>${Math.round(R * 100)}</b>%`;
    fb.querySelector('.fb-ld').innerHTML = `<b>${Math.round(D * 100)}</b>%${fn[1]}`;
    fb.classList.toggle('inv', !!cfg.inverted);
    const desc = (T) => [`攻+${Math.round((T.atk - 1) * 100)}%`, T.def > 1 ? `防+${Math.round((T.def - 1) * 100)}%` : '', T.sp ? `共鳴+${T.sp}` : '', T.regen ? '再生' : ''].filter(Boolean).join(' ');
    fb.querySelector('.fb-ba').innerHTML = nA ? `<i>${fn[0]}の加護${ROMAN[nA]}</i>${desc(TIER[nA])}` : `<i class="off">${fn[0]}${TIER_AT[0] * 100}%で加護</i>`;
    fb.querySelector('.fb-be').innerHTML = nE ? `<i>${fn[1]}${ROMAN[nE]}</i>敵 ${desc(TIER[nE])}` : '';
    const n = live().filter(u => u.side === 'enemy').length;
    $id('kegareCount').innerHTML = `TURN<b>${turn}</b>　${cfg.inverted ? '白い膜' : '穢れ'}<b>${stage === 0 ? '?' : n}</b>`;
    if (cfg.restoreBeacons) $id('kegareCount').insertAdjacentHTML('beforeend', `　灯<b>${cells.filter(c => c.beaconOn).length}/${cfg.restoreBeacons}</b>`);
    document.querySelector('#resonance .rs-val').textContent = sp;
    vignette.style.opacity = 0.15 + D * 0.7;
    if (cfg.rainLink) FX.intensity('rain', 0.2 + D * 1.2);
    renderSpirits();
    renderMissions();
    renderGuardianHud();
    if (infoU && !infoU.dead) showInfo(infoU);
    if (sel && !cmdMenu.classList.contains('hidden') && !busy) showMenu(sel, menuSub);
  }
  function renderGuardianHud() {
    const e=live().find(u=>u.guardian);
    guardianHud.classList.toggle('hidden',!e);
    if (!e) return;
    const p=GuardianCombat.profile(e.guardian);
    guardianHud.dataset.phase=String(e.guardianPhase+1);
    guardianHud.innerHTML=`${GameArt.portrait(p.art)}<div class="gh-copy"><b>${p.name}<small>${['Ⅰ','Ⅱ','Ⅲ'][e.guardianPhase]} ${GuardianCombat.phaseNames[e.guardianPhase]}</small></b><div class="gh-hp" role="meter" aria-label="精霊に貼りついた穢れHP" aria-valuemin="0" aria-valuemax="${e.mhp}" aria-valuenow="${e.hp}"><i style="width:${e.hp/e.mhp*100}%"></i><em></em><em></em><span>穢れHP ${e.hp}/${e.mhp}</span></div><small class="gh-intent">予告：${p.skills[e.intent?.phase??e.guardianPhase]} · 虹で防ぐ</small></div><button type="button" aria-label="ボスの行動と戦場の会話を読む" ${busy?'disabled':''}>声</button>`;
  }

  // ---------- 盤の主（グランなど） ----------
  function updateSubject() {
    const p = totalFoes ? Math.min(1, stats.kills / totalFoes) : 0;
    const img = subjEl.querySelector('.subjImg');
    if (img) { img.style.filter = `brightness(${0.42 + p * 0.7}) saturate(${0.2 + p * 0.9}) contrast(${1.15 - p * 0.15}) drop-shadow(0 0 ${10 + p * 40}px rgba(${p > 0.5 ? '120,200,255' : '0,0,0'},${0.5 + p * 0.3}))`; img.style.opacity = 0.5 + p * 0.3; }
    const au = subjEl.querySelector('.subjAura'); if (au) au.style.filter = `grayscale(${1 - p}) brightness(${0.5 + p * 0.7})`;
    const thn = subjEl.querySelector('.thorns'); if (thn) thn.style.opacity = 1 - p;
    const dome = subjEl.querySelector('.subjDome'); if (dome) dome.style.opacity = Math.max(0, 0.95 - p * 1.1);
  }
  function buildSubject() {
    subjEl.innerHTML = '';
    const s = cfg.subject;
    if (s === 'gran') subjEl.innerHTML = '<img class="subjImg" src="assets/img/gran.png">';
    else if (s && s.aura) subjEl.innerHTML = `<div class="aura subjAura" style="--c:${s.aura}"><div class="core"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div></div>` + (s.dome ? '<div class="subjDome"></div>' : '') + (s.thorns ? thornsSvg() : '');
    updateSubject();
  }
  function thornsSvg() {
    let p = '';
    for (let i = 0; i < 26; i++) {
      const side = i % 4, k = Math.random();
      let x0, y0; if (side === 0) { x0 = k * 100; y0 = -2; } else if (side === 1) { x0 = 102; y0 = k * 100; } else if (side === 2) { x0 = k * 100; y0 = 102; } else { x0 = -2; y0 = k * 100; }
      const reach = 0.12 + Math.random() * 0.16;
      const x1 = x0 + (50 - x0) * reach, y1 = y0 + (50 - y0) * reach;
      const cx = (x0 + x1) / 2 + (Math.random() - .5) * 12, cy = (y0 + y1) / 2 + (Math.random() - .5) * 12;
      p += `<path d="M${x0},${y0} Q${cx},${cy} ${x1},${y1}" stroke="url(#thg)" stroke-width="${3 + Math.random() * 5}" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    }
    return `<svg class="thorns" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 0 8px rgba(30,70,40,.7))"><defs><linearGradient id="thg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b140e"/><stop offset="1" stop-color="#1d3324"/></linearGradient></defs>${p}</svg>`;
  }

  // ---------- チュートリアル ----------
  let tut = null;
  function tutorialStep(ev) {
    if (!tut) return;
    const s = tut.steps[tut.i];
    if (!s || s.wait !== ev) return;
    tut.i++;
    const n = tut.steps[tut.i];
    if (n) say(n.who, n.text); else { tut = null; hideSay(); }
  }

  // ---------- 勝敗 ----------
  // ---------- ミッション ----------
  function missionText(m) {
    const f = floorNames();
    switch (m.type) {
      case 'purify': return `浄化を${m.n}回使う`;
      case 'guardianVoice': return '守り手の理性を3段階取り戻す';
      case 'teamHP': return `二人のHPをそれぞれ${m.n}%以上残す`;
      case 'turns': return `${m.n}ターン以内にクリア`;
      case 'hp': return `アリアのHPを${m.n}%以上残す`;
      case 'back': return `背後から${m.n}回攻撃する`;
      case 'crit': return `会心の一撃を${m.n}回出す`;
      case 'summonKill': return `召喚した精霊で${m.n}体倒す`;
      case 'enchantKill': return cfg.postgame ? `宿した心剣・四響の剣で${m.n}体倒す` : `精霊を宿した心剣で${m.n}体倒す`;
      case 'flashMulti': return '透明の一閃で2体を同時に斬る';
      case 'noSpirit': return '精霊の力を借りずにクリア';
      case 'noItem': return '道具を使わずにクリア';
      case 'noDown': return '召喚した精霊を倒させない';
      case 'rainbow': return `クリア時に${f[0]}の床${m.n}%以上`;
      case 'dullMax': return `${f[1]}を一度も${m.n}%にしない`;
      case 'bossLast': return '核を最後に倒す';
      case 'spiritUse': return `${SPIRITS[m.spirit].name}の力を${m.n}回使う`;
      case 'skillUse': return `${m.spirit ? SPIRITS[m.spirit].name + 'から' : ''}覚えた技を${m.n}回使う`;
    }
    return '';
  }
  // ok: true 達成 / false 失敗 / null まだ
  function missionState(m, fin) {
    const a = units.find(u => u.kind === 'aria'), n = m.n;
    const count = (v) => ({ ok: v >= n ? true : fin ? false : null, prog: `${Math.min(v, n)}/${n}` });
    const never = (v) => ({ ok: v ? false : fin ? true : null, prog: '' });
    switch (m.type) {
      case 'purify': return count(stats.purify || 0);
      case 'guardianVoice': return count(stats.guardianVoices || 0);
      case 'teamHP': { const heroes = units.filter(u => ['aria', 'chrome_human'].includes(u.kind)); const v = Math.min(...heroes.map(u => u.dead ? 0 : Math.round(u.hp / u.mhp * 100))); return { ok: fin ? heroes.length === 2 && v >= n : null, prog: v + '%' }; }
      case 'turns': return { ok: turn > n ? false : fin ? true : null, prog: `${turn}/${n}` };
      case 'hp': { const k = a && !a.dead ? Math.round(a.hp / a.mhp * 100) : 0; return { ok: fin ? k >= n : null, prog: k + '%' }; }
      case 'back': return count(stats.back);
      case 'crit': return count(stats.crit);
      case 'summonKill': return count(stats.summonKills);
      case 'enchantKill': return count(stats.enchantKills);
      case 'flashMulti': return { ok: stats.flashMulti ? true : fin ? false : null, prog: '' };
      case 'noSpirit': return never(stats.spiritUses);
      case 'noItem': return never(stats.items);
      case 'noDown': return never(stats.down);
      case 'rainbow': { const v = Math.round((fin ? stats.rainbowEnd : ratioA) * 100); return { ok: fin ? v >= n : null, prog: v + '%' }; }
      case 'dullMax': { const v = Math.round(stats.dullMax * 100); return { ok: v >= n ? false : fin ? true : null, prog: `最大${v}%` }; }
      case 'bossLast': return { ok: stats.bossEarly ? false : fin ? stats.lastBoss : null, prog: '' };
      case 'spiritUse': return count(stats.bondUses[m.spirit] || 0);
      case 'skillUse': return count(m.spirit ? stats.skillBySpirit[m.spirit] || 0 : stats.skillUses);
    }
    return { ok: null, prog: '' };
  }
  let missionOpen = true;
  function renderMissions() {
    const box = $id('missionBox'), ms = cfg.missions || [];
    if (!ms.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    const st = ms.map(m => missionState(m, false));
    const done = st.filter(x => x.ok === true).length;
    box.classList.toggle('closed', !missionOpen);
    box.innerHTML = `<div class="mb-h">ミッション<span>${done}/${ms.length}</span></div>` + ms.map((m, i) => `<div class="mb-i ${st[i].ok === true ? 'ok' : st[i].ok === false ? 'ng' : ''}"><i></i><span>${missionText(m)}</span><em>${st[i].prog}</em></div>`).join('');
  }
  $id('missionBox').addEventListener('click', e => { e.stopPropagation(); missionOpen = !missionOpen; renderMissions(); });

  // ---------- 勝敗 ----------
  function win() {
    if (over) return;
    if (cells.some(c => c.beacon && !c.beaconOn)) { say('ルノワール', '穢れは消えた。残った復興の灯に「浄化」を届けよう。', 5000); return; }
    over = true;
    hideMenu(); deselect();
    stats.rainbowEnd = ratioA;
    Audio2.sfx.win();
    FX.flash('255,255,255', 0.6);
    const a = ariaU(), c0 = a ? cellOf(a) : cells[0];
    cells.forEach(c => paint(c, 'rainbow', 200 + dist(c, c0) * 60));
    refreshHud();
    stats.kills = Math.max(stats.kills, totalFoes); updateSubject();
    stats.time = (performance.now() - stats.start) / 1000;
    settle();
    saveParty();
    later(() => { hideSay(); showResult(); }, 2200);
  }
  const RANK_NAME = { S: '澄みきった共鳴', A: '迷いのない刃', B: '揺れながら、届いた', C: 'それでも、隣にいた' };
  // ミッションの達成数でランクが決まる
  function settle() {
    const ms = cfg.missions || [];
    const res = ms.map(m => missionState(m, true).ok === true);
    const n = res.filter(Boolean).length;
    let r;
    if (ms.length) r = n >= ms.length ? 'S' : n === ms.length - 1 ? 'A' : n >= 1 ? 'B' : 'C';
    else { const par = cfg.par || totalFoes + 3; r = turn <= par ? 'S' : turn <= par + 2 ? 'A' : turn <= par + 5 ? 'B' : 'C'; }
    // しずく（お金）
    const lvs = units.filter(u => u.side !== 'ally' && u.kind !== 'chrome').map(u => u.lv);
    const avg = lvs.length ? lvs.reduce((a, b) => a + b, 0) / lvs.length : 1;
    const clear = cfg.reward || Math.round(30 + avg * 10);
    const mult = { S: 1.5, A: 1.25, B: 1.1, C: 1 }[r];
    const gold = Math.round((stats.gold + clear) * mult * Progression.difficulties[difficulty].reward);
    party.gold += gold;
    // ステージの記録
    let unique = null, equipment = null, equipmentGold = 0;
    if (cfg.id) {
      const rc = party.stages[cfg.id] || (party.stages[cfg.id] = { cleared: false, best: null, missions: [], difficulties: {} });
      const dr = rc.difficulties[difficulty] || (rc.difficulties[difficulty] = { cleared: false, best: null, missions: [], clears: 0 });
      const first = !dr.cleared;
      for (const record of [rc, dr]) {
        record.cleared = true;
        if (!record.best || 'SABC'.indexOf(r) < 'SABC'.indexOf(record.best)) record.best = r;
        record.missions = res.map((v, i) => v || !!record.missions[i]);
        record.clears = (record.clears || 0) + 1;
      }
      const reward = Progression.rewards(cfg, difficulty);
      stats.materialRewards = Progression.collectBattleMaterials(party, cfg, difficulty, res, r, dr);
      stats.questItems = []; stats.rankItems = [];
      const awardItems = (items, result) => { for (const [id, count] of Object.entries(items)) {
        if (!ITEMS[id]) continue;
        const before = party.items[id] || 0;
        party.items[id] = Math.min(9, before + count);
        if (party.items[id] > before) result.push({ id, count: party.items[id] - before });
      } };
      if (first) awardItems(reward.firstItems, stats.questItems);
      if (r === 'S' && !dr.sRewardClaimed) {
        dr.sRewardClaimed = true;
        awardItems(reward.sItems, stats.rankItems);
        const id = reward.sEquipment, gear = typeof EQUIP !== 'undefined' && EQUIP[id];
        if (gear && (difficulty === 'hard' ? gear.unique : !gear.unique)) {
          if (!party.owned.includes(id)) { party.owned.push(id); if (gear.unique) unique = id; else equipment = id; }
          else if (!gear.unique) { equipment = id; equipmentGold = Math.round(gear.price / 2); party.gold += equipmentGold; }
        }
      }
      stats.first = first;
    }
    stats.result = { r, res, gold, clear, mult, unique, equipment, equipmentGold };
  }
  function showResult() {
    const { r, res, gold, unique, equipment, equipmentGold } = stats.result;
    const ms = cfg.missions || [];
    const lv = stats.levelUps.map(l => `<div class="r-lv"><span>${l.name}</span>LV ${l.from} → <b>${l.to}</b><small>HP+${l.hp}　攻+${l.atk}　防+${l.def}</small></div>`).join('');
    const ar = party.aria;
    const mlist = ms.length ? `<div class="r-ms">${ms.map((m, i) => `<div class="${res[i] ? 'ok' : 'ng'}"><i></i>${missionText(m)}</div>`).join('')}</div>` : '';
    const u = unique && typeof EQUIP !== 'undefined' ? EQUIP[unique] : null;
    Panel.open(cfg.inverted ? '夜空' : '共鳴', `<div class="result">
      <div class="r-rank">${r}</div><div class="r-name">${RANK_NAME[r]}</div>
      <p class="r-difficulty">${Progression.difficulties[difficulty].name}・適正LV ${cfg.recommendedLv}</p>
      ${mlist}
      ${Object.entries(stats.materialRewards || {}).filter(([, bag]) => Object.keys(bag).length).map(([kind, bag]) => `<div class="r-materials"><small>${{ clear: '戦闘クリア素材 · 毎回', mission: 'ミッション初達成の素材', mastery: '初S評価の素材' }[kind]}</small>${InventoryArt.chips(bag)}</div>`).join('')}
      ${(stats.questItems || []).length ? `<p class="r-bond">この難易度の初回報酬：${InventoryArt.chips(Object.fromEntries(stats.questItems.map(x => [x.id, x.count])))}</p>` : ''}
      ${u ? `<div class="r-unique"><small>Sランク達成　ユニーク装備</small>${InventoryArt.icon(unique)}<b>${u.name}</b><span>${u.desc}</span></div>` : ''}
      ${equipment ? `<div class="r-unique r-equipment"><small>ふつうのS評価　通常装備</small>${InventoryArt.icon(equipment)}<b>${EQUIP[equipment].name}</b><span>${equipmentGold ? `所持済みのため ${equipmentGold}しずくに交換` : EQUIP[equipment].desc}</span></div>` : ''}
      ${(stats.rankItems || []).length ? `<p class="r-bond">やさしいのS評価報酬：${InventoryArt.chips(Object.fromEntries(stats.rankItems.map(x => [x.id, x.count])))}</p>` : ''}
      <div class="r-stats"><div>${cfg.inverted ? '切り離した膜' : '切り分けた穢れ'}<b>${stats.kills}</b></div><div>ターン<b>${turn}</b></div><div>${floorNames()[0]}の床<b>${Math.round(stats.rainbowEnd * 100)}%</b></div><div>しずく<b>+${gold}</b></div></div>
      <div class="r-exp">アリア　LV <b>${ar.lv}</b>　<span class="r-expbar"><i style="width:${ar.lv >= MAX_LV ? 100 : ar.exp}%"></i></span>　${ar.lv >= MAX_LV ? '成長上限' : `EXP +${stats.expA}`}</div>
      ${lv ? `<div class="r-lvs">${lv}</div>` : ''}
      ${Object.entries(stats.bondGains).map(([id, n]) => `<p class="r-bond" style="color:${SPIRITS[id].color}">${SPIRITS[id].name}との絆 +${n}（絆${bondRank(id)}）</p>`).join('')}
      ${Object.entries(stats.trainingGains).map(([id, gains]) => Object.entries(gains).filter(([, n]) => n).map(([route, n]) => `<p class="r-bond" style="color:${SPIRITS[id].color}">${SPIRITS[id].name}・${Progression.routes[route].name}熟練 +${n}（${Progression.training(party, id, route)}）</p>`).join('')).join('')}
      ${stats.learned.map(id => { const s = Progression.skills.find(s => s.id === id); return `<div class="r-unique"><small>${Progression.routes[s.route].name}の熟練で覚えた${s.type}</small><b>${s.name}</b><span>${s.desc}</span></div>`; }).join('')}
      </div>`, { noClose: true, footer: `<button class="btn-main" id="resNext">${cfg.resultLabel || (onDone ? 'つづける' : 'マップへ戻る')}</button>` });
    if (u) Audio2.sfx.levelup();
    document.getElementById('resNext').onclick = () => { if (!running) return; Panel.close(); end(true); };
  }
  function lose() {
    if (over) return;
    over = true; hideMenu(); Audio2.sfx.lose(); FX.flash('10,0,20', 0.9); shake(10);
    saveParty();
    later(() => {
      Panel.open('', `<div class="result"><div class="r-name" style="margin-top:8px">${cfg.loseText || '黒が、すべてを覆った。'}</div>
        <p style="margin:10px 0 4px">リラの声がした気がした。<br>「急がなくていい。凪いだ水面を選びなさい」</p>
        <p style="font-size:12px;color:var(--ink-faint)">得た経験・精霊との絆・覚えた技は、残っています。<br>難易度：${Progression.difficulties[difficulty].name}</p>
        </div>`, { noClose: true, footer: '<button class="btn-main" id="resRetry">もう一度、立ち上がる</button>' });
      document.getElementById('resRetry').onclick = () => { Panel.close(); restart(); };
    }, 1500);
  }

  // ---------- 入力 ----------
  cv.addEventListener('mousemove', e => {
    if (!running) return;
    const c = pick(e.clientX, e.clientY);
    if (c !== hover) {
      hover = c;
      const u = c && unitAt(c);
      if (u) showInfo(u); else if (sel) showInfo(sel);
    }
  });
  cv.addEventListener('mouseleave', () => { hover = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    if (!running) return;
    if (e.button === 2) { cancel(); return; }
    if (e.button === 0) onClick(pick(e.clientX, e.clientY));
  });
  let touchCell = null;
  cv.addEventListener('touchstart', e => { const t = e.touches[0]; touchCell = pick(t.clientX, t.clientY); hover = touchCell; const u = touchCell && unitAt(touchCell); if (u) showInfo(u); e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', e => { onClick(touchCell); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (!running || Panel.isOpen() || paused || e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (['q', 'r', '0'].includes(e.key.toLowerCase())) { e.preventDefault(); if (!e.repeat) rotateView(e.key === '0' ? -viewRotation : e.key.toLowerCase() === 'q' ? -1 : 1); return; }
    if (mode === 'facing') {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); return; }
      const buttons = [...cmdMenu.querySelectorAll('[data-k="facewait"]')];
      const i = buttons.indexOf(document.activeElement);
      const next = e.key === 'ArrowLeft' ? (i < 0 ? 0 : i % 2 ? i - 1 : i + 1)
        : e.key === 'ArrowRight' ? (i < 0 ? 1 : i % 2 ? i - 1 : i + 1)
          : e.key === 'ArrowUp' || e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 2) % 4) : -1;
      if (next >= 0) { e.preventDefault(); buttons[next]?.focus({ preventScroll: true }); return; }
      if (/^[1-4]$/.test(e.key) && !e.repeat) { e.preventDefault(); command('facewait', String(worldDir(Number(e.key) - 1))); }
      return;
    }
    if (e.key === 'Escape') cancel();
    else if ((e.key === 'a' || e.key === 'A') && sel && mode === 'selected' && !busy) command('attack');
    else if ((e.key === 'w' || e.key === 'W') && sel && mode === 'selected' && !busy) command('wait');
    else if (e.key === 'e' || e.key === 'E') endPlayerPhase();
  });
  addEventListener('resize', () => { if (running) { layout(); if (sel && !cmdMenu.classList.contains('hidden')) showMenu(sel, menuSub); } });
  endBtn.addEventListener('click', e => { e.stopPropagation(); Audio2.sfx.choose(); endPlayerPhase(); });
  $id('boardHelp').onclick = () => help();
  $id('boardMenu').onclick = () => Main.gameMenu();
  $id('rotateLeft').onclick = () => rotateView(-1);
  $id('rotateRight').onclick = () => rotateView(1);
  function rotateView(step) {
    if (!running || busy || over || paused || Panel.isOpen()) return;
    const next = (viewRotation + step + 4) % 4;
    if (next === viewRotation) return;
    const active = document.activeElement;
    const focused = active.closest?.('#cmdMenu') ? { k: active.dataset.k, a: active.dataset.a } : null;
    viewRotation = next; orderCells(); layout();
    cam.z = cam.tz = 1; cam.x = cam.tx = cam.y = cam.ty = 0;
    hover = null; touchCell = null; fxp.length = 0; floatLayer.innerHTML = '';
    units.forEach(u => { u.lunge = u.knock = null; });
    $id('boardView').setAttribute('aria-label', `戦闘マップの視点 · 表示角度${viewRotation * 90}度`);
    refreshHud();
    if (focused) [...cmdMenu.querySelectorAll('button')].find(b => b.dataset.k === focused.k && b.dataset.a === focused.a)?.focus({ preventScroll: true });
    Audio2.sfx.choose();
  }

  function help() {
    hideSay();
    Panel.open('戦い方', `
      <h4>目的</h4>盤のどこかにいる<b>穢れの影</b>を、すべて心剣で切り分けてください。アリアが倒れると、やり直しになります。復興編はクロムも毎ターン操作でき、二人のどちらかが倒れると再挑戦です。
      <h4>動かし方</h4>味方に触れると、<b>光る床</b>が歩ける場所。床に触れると移動し、そのあとメニューが開きます。<br>動かずに行動したいときは、本人にもう一度触れるか「その場で行動」。届く敵に直接触れても攻撃できます。<br><b>待機は4方向から向きを選んで確定</b>。Esc／戻るで取り消しても行動は消費せず、移動も戻せます。方向キーで選び、Enterで確定できます。<br>右クリック／Esc／「選び直す」：戻る　E：ターン終了　A：攻撃　W：待機の向き選び
      <h4>マップの回転</h4><b>↶／↷</b>ボタンで視点を左右に90度ずつ回転します。キーボードは<b>Q：左、R：右、0：初期の視点</b>。回転は移動や行動を使わず、位置・射程・正面／背後の判定はそのままです。移動や攻撃の演出中は回転できません。
      <div class="tip-tiles"><div><span class="tip-rainbow-floor${cfg.inverted ? ' night' : ''}"><img src="assets/tiles/dark_land_flat.png" alt=""></span>${floorNames()[0]}の床（味方）</div><div><img src="assets/tiles/dark_land_flat.png" alt="">${floorNames()[1]}の床（穢れ）</div></div>
      <h4>床の割合と加護</h4>味方が歩いた床・攻撃した床は<b>虹色</b>に、穢れが立つ床は<b>くすみ</b>ます。盤全体の割合が<b>25%・45%・65%</b>を超えるたびに、その側の攻撃・守り・共鳴が強くなります（65%で毎ターン回復）。<br>自分の色の床に立つと攻撃+10%、相手の色の床では守り-10%。
      <h4>位置どり</h4>敵の足元の<b style="color:#ffd07a">橙の矢印が正面</b>、<b style="color:#81e7ff">青の二本線が背後</b>です。HPの横にも正面を向く矢印が表示されます。敵の情報欄では、選んだ味方の現在位置が正面・側面・背後のどれかを確認できます。<br>高い場所から打つと+15%。敵の<b>背後</b>から+25%（会心も出やすい）、側面から+10%。
      <h4>精霊</h4>仲間になった精霊は、<b>共鳴</b>を使って力を貸してくれます。<br>・<b>召喚</b>（共鳴6）：盤に降り立ち、登場の大技のあと3ターン共に戦う。<br>・<b>心剣に宿す</b>（共鳴3）：3ターンのあいだ、精霊の力をまとった<b>通常攻撃が毎ターン2回</b>に。同じ敵にも別の敵にも追撃でき、空振りも1回に数えます。移動は最初の1回だけで、技・魔法・道具を選ぶと行動は終了します。宿すときは行動を使わず、1ターンに1度。<br>召喚と宿しは同時にはできません。召喚している間は宿せず、宿している間は召喚できません。
      <p><b>召喚した精霊が倒されたら、その戦闘中は再召喚も心剣に宿すこともできません。</b>他の精霊は使えます。召喚の期限で帰還した精霊は再び使え、再挑戦・次の戦闘では戦闘不能の制限を解除します。</p>
      <h4>道具とミッション</h4>町で買った道具は、メニューの「道具」から使えます（行動を使う）。<br>右上のミッションをすべて達成するとSランク。S評価の報酬は難易度別。<b>ハードはユニーク装備、ふつうは通常装備、やさしいはアイテム</b>です。各難易度で1回ずつ受け取れ、所持済みの通常装備は価格の半分のしずくになります。
      <h4>LV</h4>攻撃と撃破で経験値が入り、100たまるとLVが上がります。精霊は、召喚や宿しで育ちます。
      <h4>精霊との絆・覚えた技</h4>召喚で絆+3、心剣に宿すと+2。召喚した精霊の攻撃や、宿した心剣が命中すると+1、覚えた技を使うと+2。絆は精霊と技の強さを育てます。<b>習得はエンチャントと召喚の熟練を別々に判定</b>し、それぞれ8・20・40で3種ずつ、全24種。宿すとエンチャント熟練+2、宿した通常攻撃の命中で+1。召喚すると召喚熟練+3、精霊の命中で+1。覚えた技の使用は熟練に入りません。<br>習得後は「覚えた技」から、召喚や宿しをせずに使えます。絆が深まるほど精霊のHP・攻撃・守りと、宿した心剣・覚えた技の効果が育ちます。負けても絆と習得は残ります。
      <h4>ルノワールの四響エンチャント</h4>クロムだけが使う切り札です。共鳴6・1戦闘に1回。3ターン、4精霊のエンチャント効果をまとめて宿し、通常攻撃が毎ターン2回になります。宿す行動は消費しません。吸収して身につけたルノワール自身の能力なので、他の精霊の召喚中・戦闘不能でも使えます。クロム自身に精霊の召喚能力はありません。再挑戦・次の戦闘で使用回数は戻ります。<h4>復興の灯</h4>復興編は敵の全滅と、番号のついた灯をすべて点けることが目的です。アリアとクロムの<b>「浄化」（共鳴2）</b>で2マス以内の灯そのものを選んでください。周り2マスも虹に戻ります。防壁を持つ核は、灯が全部点くまで攻撃が届きません。<h4>難易度・依頼</h4>マップの戦場や依頼でやさしい・ふつう・ハードの3段階の難易度を選べます。適正LV・報酬・ミッション実績は難易度ごとに表示されます。戦闘開始後は再挑戦も同じ難易度です。町の「依頼」でサブクエストを探せます。
      <p style="margin-top:12px;color:#ffd98a">「切るのは穢れだけ。その人の色は、一滴も切らない」</p>`);
  }

  // ---------- 開始・終了 ----------
  function start(conf, done) {
    if (conf.chapterGate && !GuardianJourney.available(conf)) { Engine.toast('物語でこの土地の道を開いてください'); World.open(); return Promise.resolve(false); }
    if (conf.postgame && !Restoration.joined()) { Engine.toast('復興編の物語から旅を始めてください'); World.open(); return Promise.resolve(false); }
    stop();
    if (World.isOpen) World.close();
    party = loadParty();
    const key = conf.hardOnly ? 'hard' : Progression.normalize(conf.difficulty || Progression.selected(party, conf.id));
    baseCfg = { ...conf, difficulty: key }; onDone = done;
    const my = sess;
    const learnedSpirits = Progression.skills.filter(s => party.aria.skills.includes(s.id)).map(s => s.spirit);
    return Promise.all([ready, GameArt.loadBattle(conf, learnedSpirits)]).then(() => { if (my === sess) restart(); });
  }
  function restart() {
    sess++;
    shakeAnimation?.cancel(); shakeAnimation = null;
    artEffects.length = 0; cutinCancel?.(); cutinCancel = null;
    cancelPending();
    cfg = Progression.prepare(baseCfg, baseCfg.difficulty);
    cfg.onPhase0 = baseCfg.onPhase0;
    guardianHistory = [];
    screen.classList.toggle('guardian-battle',!!cfg.guardian);
    cols = cfg.cols; rows = cfg.rows;
    viewRotation = 0; defeatedSpirits.clear(); renoirUsed = false;
    $id('boardView').setAttribute('aria-label', '戦闘マップの視点 · 表示角度0度');
    difficulty = cfg.difficulty;
    party = loadParty();
    GB = gearBonus(party.equip);
    if (cfg.recLv) party.aria.lv = Math.max(party.aria.lv, cfg.recLv);
    (cfg.spirits || []).forEach(id => { const r = rec(id); r.lv = Math.max(r.lv, (cfg.recLv || 1) - 1); });
    saveParty();
    stage = cfg.phase0 ? 0 : 1;
    uid = 1;
    const plan = genMap();
    initFloors(plan);
    units = [makeUnit('aria', 'ally', party.aria.lv, plan.aria)];
    if (cfg.companion && Restoration.joined()) {
      party.chrome.lv = Math.max(party.chrome.lv, cfg.recLv || 1);
      const free = cells.filter(c => c.walk && !unitAt(c) && Math.abs(c.h - plan.aria.h) <= 1).sort((a, b) => dist(a, plan.aria) - dist(b, plan.aria));
      if (free[0]) units.push(makeUnit('chrome_human', 'ally', party.chrome.lv, free[0]));
    }
    initBeacons(plan.aria);
    saveParty();
    const words = cfg.kegWords || [];
    kegIdx = 0; colorIdx = 0; totalFoes = 0;
    plan.enemies.forEach(({ spec, cell }) => {
      const u = makeUnit(spec.kind, 'enemy', spec.lv || 1, cell, { hidden: spec.phase === 1 });
      if (spec.armor) u.armor = spec.armor;
      if (spec.kind === 'boss' && cfg.bossArt) { u.artId = cfg.bossArt; if(cfg.guardian)u.hgt=cfg.bossArt==='gran'?1.35:1.5; }
      if (spec.kind === 'boss' && cfg.bossHP) { u.hp = u.mhp = Math.round(u.mhp * cfg.bossHP); }
      if (spec.kind === 'boss' && cfg.guardian) { u.guardian=cfg.guardian;u.guardianPhase=0;u.guardianAtk=u.atk; }
      u.word = spec.kind === 'boss' ? (cfg.rootWord || '') : spec.kind === 'chrome' ? '' : (words[kegIdx++ % Math.max(1, words.length)] || '');
      if (spec.kind === 'boss' && cfg.bossName) u.name = cfg.bossName;
      units.push(u);
      if (!u.hidden && spec.kind !== 'chrome') totalFoes++;
    });
    makeDecor();
    orderCells();
    turn = 0; phase = 'player'; busy = true; over = false; paused = false;
    sel = null; mode = 'idle'; moveInfo = null; targets = null; targetCmd = null; hover = null; threat = null; menuSub = null; infoU = null;
    sp = Math.min(spCap(), (cfg.spStart != null ? cfg.spStart : 3) + GB.spStart); skyCharges = 0; enchantUsed = false;
    stats = { purify: 0, kills: 0, taken: 0, down: 0, start: performance.now(), levelUps: [], expA: 0, phase0: 0, back: 0, crit: 0, items: 0, spiritUses: 0, summonKills: 0, enchantKills: 0, flashMulti: 0, dullMax: 0, lastBoss: false, bossEarly: false, gold: 0, bondUses: {}, bondGains: {}, trainingGains: {}, learned: [], skillUses: 0, skillBySpirit: {} };
    units.filter(u=>u.guardian).forEach(u=>guardianTransition(u,true));
    learnedRoute = 'enchant';
    fxp.length = 0; floatLayer.innerHTML = '';
    cam.z = cam.tz = 1;
    hideMenu();
    document.querySelector('.bt-act').textContent = `${cfg.act || '戦場'}・${Progression.difficulties[difficulty].name}・適正LV ${cfg.recommendedLv}`;
    document.querySelector('.bt-name').textContent = cfg.title || '';
    screen.classList.remove('hidden');
    document.getElementById('pouch').style.visibility = 'hidden';
    $id('renoirBox').style.display = cfg.hideSide ? 'none' : '';
    endBtn.disabled = true;
    bannerEl.className = ''; cutinEl.className = ''; skillEl.className = '';
    buildSubject();
    layout();
    missionOpen = !screen.classList.contains('short') && !(cfg.guardian && screen.classList.contains('compact'));
    hudReady = false; refreshHud(); hudReady = true;
    showInfo(units[0]);
    if (cfg.tutorial) { tut = { steps: cfg.tutorial, i: 0 }; const s = tut.steps[0]; say(s.who, s.text); }
    else { tut = null; if (cfg.intro) say(cfg.intro.who, cfg.intro.text, 7000); else hideSay(); }
    if (!running) { running = true; t0 = performance.now(); renderFrame = requestAnimationFrame(render); }
    runTask(playerPhase());
  }
  // 終章：第二段へ
  function enterPhase1(opt = {}) { return runTask((async () => {
    const my = sess;
    stage = 1; paused = false;
    const ch = units.find(u => u.kind === 'chrome');
    if (ch) { ch.side = 'neutral'; ch.word = ''; }
    skyCharges = opt.skyCharges || 0;
    units.filter(u => u.hidden).forEach(u => {
      // 第一段のあいだに誰かが立っていたら、近くの空いた床へ
      if (unitAt(cellOf(u))) { const free = cells.filter(c => c.walk && !unitAt(c)).sort((a, b) => dist(a, u) - dist(b, u))[0]; if (free) { u.r = free.r; u.c = free.c; } }
      u.hidden = false; u.bornT = performance.now(); totalFoes++; paintArea(cellOf(u), 1, 'dull', 80);
    });
    FX.flash('235,240,255', 0.5);
    Audio2.sfx.expose();
    refreshHud();
    if (opt.say) say(opt.say.who, opt.say.text, 8000);
    await wait(1000);
    if (my !== sess) return;
    await playerPhase();
  })()); }
  function stop() {
    sess++; running = false; over = true;
    shakeAnimation?.cancel(); shakeAnimation = null;
    artEffects.length = 0; cutinCancel?.(); cutinCancel = null;
    cancelAnimationFrame(renderFrame); renderFrame = null;
    cancelPending();
    screen.classList.add('hidden'); hideSay(); floatLayer.innerHTML = ''; hideMenu();
    guardianHud.classList.add('hidden');guardianHistory=[];
    cutinEl.className = ''; bannerEl.className = ''; skillEl.className = '';
  }
  function end(won) {
    sess++;
    shakeAnimation?.cancel(); shakeAnimation = null;
    artEffects.length = 0; cutinCancel?.(); cutinCancel = null;
    cancelAnimationFrame(renderFrame); renderFrame = null;
    cancelPending();
    running = false; screen.classList.add('hidden'); hideSay(); floatLayer.innerHTML = ''; hideMenu();
    guardianHud.classList.add('hidden');guardianHistory=[];
    document.getElementById('pouch').style.visibility = '';
    const cb = onDone; onDone = null;
    if (cb) cb(won); else World.open();
  }
  return {
    start, enterPhase1, help, stop,
    setDifficulty(d) { try { localStorage.setItem('cr_diff', Progression.normalize(d)); } catch (e) {} },
    resetParty() { party = fillParty({ aria: { lv: 1, exp: 0 }, spirits: {} }); saveParty(); },
    reloadParty() { party = loadParty(); return party; },
    saveParty() { saveParty(); },
    gearBonus, statsFor,
    get party() { return party; },
    get running() { return running; },
  };
})();
