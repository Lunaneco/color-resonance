// 各国の敵は、土地ごとの姿（art）と名前と、一つの特性を持つ。
// 絵が読めないときは、同じ種類の絵を土地の色へ染めて使う。
// 床の仕掛けは国に一つ。虹に戻すと、潮流・燠・蔦・霞は凪ぐ。
const Regions = (() => {
  // hue: 紫（影の炎）・桃（茨の棘）・金（鉛のひび）を、その土地の色へ回す角度
  const REGIONS = {
    sea: {
      name: '潮の国', color: '#3fb4c9', trait: 'push', kinds: ['shade', 'membrane'],
      tint: { key: 'sea', hue: -85, sat: 1.05, glow: 0.22, rgb: [60, 170, 200] },
      names: { shade: '雨だれの影', thorn: '珊瑚棘の影', lead: '錆びた錨の殻', membrane: '泡の膜' },
    },
    hill: {
      name: '赤い丘', color: '#e2584c', trait: 'ember', kinds: ['shade', 'thorn'],
      tint: { key: 'hill', hue: 95, sat: 1.1, glow: 0.25, rgb: [215, 90, 70] },
      names: { shade: 'くすぶる影', thorn: '燠火の棘', lead: '焦げた鎧殻', membrane: '煤の膜' },
    },
    forest: {
      name: '緑の森', color: '#5fd07a', trait: 'root', kinds: ['thorn', 'membrane'],
      tint: { key: 'forest', hue: -140, sat: 1.0, glow: 0.2, rgb: [90, 190, 110] },
      names: { shade: '木陰の影', thorn: '絡み蔦の影', lead: '苔むした殻', membrane: '胞子の膜' },
    },
    canyon: {
      name: '黄金の谷', color: '#ffd25e', trait: 'plate', kinds: ['shade', 'thorn', 'membrane'],
      tint: { key: 'canyon', hue: 135, sat: 1.1, glow: 0.22, rgb: [225, 185, 80] },
      names: { shade: '砂金の影', thorn: '乾いた棘', lead: '金屑の殻', membrane: '砂の膜' },
    },
    spire: {
      name: '虹の尖塔', color: '#b48cff', trait: 'drain', kinds: ['thorn', 'membrane', 'lead'],
      tint: { key: 'spire', hue: 25, sat: 1.15, glow: 0.2, rgb: [170, 130, 240] },
      names: { shade: '借り物の影', thorn: '彩りの棘', lead: '飾り鎧の殻', membrane: '塗りの膜' },
    },
    veil: {
      name: '透明の国', color: '#cfd8ff', trait: 'mist', kinds: ['shade', 'lead', 'membrane'],
      tint: { key: 'veil', hue: -60, sat: 0.55, glow: 0.3, rgb: [190, 205, 240] },
      names: { shade: '霞の影', thorn: '氷花の棘', lead: '曇り硝子の殻', membrane: '白磁の膜' },
    },
  };
  const TRAITS = {
    push: { name: '押し流し', desc: '命中した味方を、1マス押し流す' },
    ember: { name: '燠火', desc: '命中した味方の周りの床を、くすませる' },
    root: { name: '絡め取り', desc: '命中すると半分の確率で、味方の移動を1ターン封じる' },
    plate: { name: '金の被膜', desc: '最初に受ける傷が半分になる' },
    drain: { name: '色吸い', desc: '命中すると共鳴を1奪う（敵の手番に2まで）' },
    mist: { name: '霞', desc: '攻撃が外れやすい（+12%）' },
  };
  // 床の仕掛け。虹に戻した床は、潮流・燠・蔦・霞を止める。金膜は割れるまで残り、吸彩は虹で共鳴を返す。
  const GIMMICKS = {
    sea: { id: 'current', name: '潮流', desc: '虹でない潮流の上で手番を終えると、矢の向きへ1マス流される' },
    hill: { id: 'ember', name: '燠床', desc: '敵の手番の始め、虹でない燠床の隣の素の床がくすむ' },
    forest: { id: 'vine', name: '蔦床', desc: '虹でない蔦床で手番を終えると、次の自分の手番は移動できない' },
    canyon: { id: 'film', name: '金膜', desc: 'この床に立っていると、最初の一撃が半分になり、膜は割れて消える' },
    spire: { id: 'siphon', name: '吸彩', desc: '味方が虹でない吸彩で手番を終えると共鳴を1失う。虹に戻すと、共鳴が1戻る' },
    veil: { id: 'mist', name: '霞床', desc: '虹でない霞床から攻撃すると外れやすい。背後からは届く' },
  };
  // 同じ国でも、戦場の並びで床の形を変える。序章の近くと端は空け、入り江の足場を塞がない。
  function gimmickLayout(region, id, rows, cols) {
    const g = GIMMICKS[region];
    if (!g || rows < 4 || cols < 4) return [];
    const list = (STAGES[region] || []).map(s => s.endsWith('*') ? s.slice(0, -1) : s);
    const found = list.indexOf(id);
    const pat = (found < 0 ? 0 : found) % 4;
    const tiles = [];
    const add = (r, c, dir = 0) => {
      r = Math.round(r); c = Math.round(c);
      if (r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1) tiles.push({ r, c, dir });
    };
    const midR = Math.floor(rows / 2), midC = Math.floor(cols / 2);
    const band = (r, dir) => { for (let c = 1; c < cols - 1; c++) add(r, c, dir); };
    if (g.id === 'current') {
      if (pat === 0) band(midR, 1);
      else if (pat === 1) { band(Math.max(1, midR - 1), 1); band(Math.min(rows - 2, midR + 1), 3); }
      else if (pat === 2) for (let r = 1; r < rows - 1; r++) add(r, midC, 2);
      else {
        for (let r = 1; r < rows - 1; r++) add(r, Math.max(1, midC - 1), 0);
        for (let r = 1; r < rows - 1; r++) add(r, Math.min(cols - 2, midC + 1), 2);
      }
    } else if (g.id === 'vine') {
      if (pat === 0) for (let c = 1; c < cols - 1; c++) if (c !== midC && c !== midC - 1) add(midR, c);
      else if (pat === 1) {
        for (let c = 1; c < cols - 1; c++) if (c < midC - 1 || c > midC + 1) add(midR, c);
        for (let r = 1; r < rows - 1; r++) if (Math.abs(r - midR) > 1) add(r, Math.max(1, midC - 2));
      } else if (pat === 2) {
        for (let c = 1; c < cols - 1; c += 2) add(Math.max(1, midR - 1), c);
        for (let c = 2; c < cols - 1; c += 2) add(Math.min(rows - 2, midR + 1), c);
      } else for (let r = 1; r < rows - 2; r++) if (r !== midR) add(r, midC);
    } else if (g.id === 'film') {
      const colsA = pat === 1 ? [1] : pat === 2 ? [cols - 2] : pat === 3 ? [midC] : [1, cols - 2];
      colsA.forEach(c => { for (let r = 1; r < rows - 2; r += 2) add(r, c); });
      if (pat === 3) for (let c = 1; c < cols - 1; c += 2) add(midR, c);
    } else if (g.id === 'siphon') {
      if (pat % 2 === 0) for (let i = 1; i < Math.min(rows, cols) - 1; i++) add(i, i);
      else {
        for (let c = 1; c < cols - 1; c++) add(midR, c);
        for (let r = 1; r < rows - 1; r++) if (r !== midR) add(r, midC);
      }
      if (pat >= 2) for (let c = 2; c < cols - 2; c += 3) add(Math.max(1, midR - 2), c);
    } else {
      const seeds = [
        [[2, 2], [2, cols - 3], [midR, midC]],
        [[1, midC], [3, 2], [midR, cols - 3]],
        [[2, Math.max(1, midC - 2)], [midR, 2], [Math.min(rows - 3, midR + 1), cols - 3]],
        [[1, 1], [1, cols - 2], [3, midC]],
      ][pat];
      seeds.forEach(([r, c]) => { add(r, c); add(r, c + (c < midC ? 1 : -1)); });
    }
    const seen = new Set(), homeC = Math.floor(cols * 0.45);
    return tiles.filter(t => {
      const k = t.r + ',' + t.c;
      if (seen.has(k)) return false;
      seen.add(k);
      return !(t.r >= rows - 3 && t.c >= homeC);
    });
  }
  // 戦場の雰囲気：同じ国の中でも、戦場ごとに天気・時間・光を変える
  const ATMOS = {
    sea: [
      { theme: { bg: 'rain', preset: 'dusk', fx: 'rain:0.25' }, hue: '#8fe0f0', map: { waterAmt: 0.08, hills: 0.2 } },
      { theme: { bg: 'teal', preset: 'night', fx: 'sparkle:0.3' }, hue: '#6fd0e8', map: { waterAmt: 0.06, hills: 0.26 } },
      { theme: { bg: 'rain', preset: 'storm', fx: 'rain:0.6' }, hue: '#4fb0d0', map: { waterAmt: 0.09, hills: 0.3 } },
      { theme: { bg: 'restoration', preset: 'dawn', fx: 'sparkle:0.3,motes:0.1' }, hue: '#a8e8f2', map: { waterAmt: 0.05, hills: 0.18 } },
    ],
    hill: [
      { theme: { bg: 'canyon', preset: 'dusk', fx: 'gold:0.4' }, hue: '#ff9a8a', map: { hills: 0.3 } },
      { theme: { bg: 'canyon', preset: 'storm', fx: 'ash:0.6' }, hue: '#ff7a68', map: { hills: 0.34 } },
      { theme: { bg: 'restoration', preset: 'dusk', fx: 'gold:0.5,ash:0.15' }, hue: '#f5a070', map: { hills: 0.26 } },
      { theme: { bg: 'canyon', preset: 'dawn', fx: 'gold:0.3,ash:0.1' }, hue: '#ffb09a', map: { hills: 0.22 } },
    ],
    forest: [
      { theme: { bg: 'forest', preset: 'night', fx: 'motes:0.5' }, hue: '#7fd67a', map: { hills: 0.34 } },
      { theme: { bg: 'forest', preset: 'dawn', fx: 'motes:0.3' }, hue: '#a6e08a', map: { hills: 0.28 } },
      { theme: { bg: 'forest', preset: 'dim', fx: 'rain:0.12,motes:0.3' }, hue: '#6cc890', map: { hills: 0.36 } },
      { theme: { bg: 'restoration', preset: 'dawn', fx: 'motes:0.4' }, hue: '#b3dfa4', map: { hills: 0.3 } },
    ],
    canyon: [
      { theme: { bg: 'canyon', preset: 'dusk', fx: 'gold:0.4' }, hue: '#ffd25e', map: { hills: 0.4 } },
      { theme: { bg: 'canyon', preset: 'night', fx: 'stars:0.3,gold:0.2' }, hue: '#f0c860', map: { hills: 0.42 } },
      { theme: { bg: 'canyon', preset: 'gold', fx: 'gold:0.6' }, hue: '#ffdc7a', map: { hills: 0.38 } },
      { theme: { bg: 'restoration', preset: 'gold', fx: 'gold:0.4' }, hue: '#ecd494', map: { hills: 0.3 } },
    ],
    spire: [
      { theme: { bg: 'glass', preset: 'night', fx: 'sparkle:0.4' }, hue: '#b48cff', map: { hills: 0.3 } },
      { theme: { bg: 'stars', preset: 'night', fx: 'stars:0.5' }, hue: '#c4adf5', map: { hills: 0.34 } },
      { theme: { bg: 'glass', preset: 'dim', fx: 'sparkle:0.2' }, hue: '#cdb8ff', map: { hills: 0.28 } },
      { theme: { bg: 'restoration', preset: 'night', fx: 'stars:0.3' }, hue: '#d2c6f1', map: { hills: 0.26 } },
    ],
    veil: [
      { theme: { bg: 'stars', preset: 'night', fx: 'stars:0.4,snow:0.15' }, hue: '#cfd8ff', map: { hills: 0.3 } },
      { theme: { bg: 'glass', preset: 'clearDawn', fx: 'sparkle:0.5' }, hue: '#ffffff', map: { hills: 0.28 } },
      { theme: { bg: 'cave_sky', preset: 'dim', fx: 'motes:0.3' }, hue: '#b2c4ec', map: { hills: 0.24 } },
      { theme: { bg: 'restoration', preset: 'memory', fx: 'sparkle:0.3' }, hue: '#93d7e9', map: { hills: 0.26 } },
    ],
  };
  // 戦場 → 国。末尾の * は、物語のために作り込んだ雰囲気をそのまま残す。
  const STAGES = {
    sea: ['cove*', 'gran*', 'gp_gran*', 'f_mist', 'q_harbor', 'q_lantern', 'q_tide', 'q_clock', 'restore1', 'gp_farol', 'gb_farol', 'restore2', 'gp_rivela', 'gb_rivela', 'rq_crates', 'rq_well', 'rq_wheel', 'lg_tide'],
    hill: ['f_fruit', 'gp_vard', 'restore5', 'gp_fiamma', 'gb_fiamma'],
    forest: ['ivy*', 'gp_ivy*', 'f_maze', 'q_orchard', 'q_thorns', 'q_bloom', 'restore3', 'gp_pomela', 'gb_pomela', 'rq_names', 'rq_birds', 'rq_garden', 'lg_bloom'],
    canyon: ['spinel*', 'gp_spinel*', 'q_bridge', 'q_gold', 'restore6', 'gp_lucerna', 'gb_lucerna', 'rq_lights', 'rq_bridge', 'lg_gold'],
    spire: ['king*', 'gp_king*', 'f_stars', 'q_palette', 'q_stargarden', 'restore4', 'gp_folio', 'gb_folio', 'rq_ink', 'rq_bells', 'lg_prism'],
    veil: ['chrome*', 'gp_nephra*', 'gb_nephra*', 'f_void', 'q_echo', 'restore7', 'gp_coronel', 'gb_coronel', 'restore8', 'gp_aster', 'gb_aster', 'rq_windows', 'rq_stars', 'gp_cocoon*', 'mr_cocoon*', 'lg_night'],
  };
  const regionOf = {}, atmosOf = {};
  for (const [region, ids] of Object.entries(STAGES)) {
    let n = 0;
    for (const raw of ids) {
      const keep = raw.endsWith('*'), id = keep ? raw.slice(0, -1) : raw;
      regionOf[id] = region;
      if (!keep) atmosOf[id] = ATMOS[region][n++ % ATMOS[region].length];
    }
  }
  const of = conf => conf && conf.region !== false ? conf.region || regionOf[conf.id] || null : null;
  const variant = (region, kind) => {
    const r = REGIONS[region];
    if (!r || !r.names[kind]) return null;
    return { region, name: r.names[kind], tint: r.tint, trait: r.kinds.includes(kind) ? r.trait : null, art: region + '_' + kind };
  };
  // 登録済みの戦場へ雰囲気を反映する（読み込み時に一度だけ）
  function decorate() {
    const registries = [BOARDS, FREE_STAGES, SIDE_QUESTS, RESTORATION_STAGES].filter(r => typeof r === 'object' && r);
    for (const reg of registries) for (const conf of Object.values(reg)) {
      const a = atmosOf[conf.id];
      if (!a || conf.atmosphereSet) continue;
      conf.atmosphereSet = true;
      conf.theme = { ...(conf.theme || {}), bg: a.theme.bg, preset: a.theme.preset, fx: a.theme.fx };
      conf.hue = a.hue; conf.wordHue = conf.wordHue || a.hue;
      conf.map = { ...(conf.map || {}), ...a.map };
    }
  }
  decorate();
  return { REGIONS, TRAITS, GIMMICKS, ATMOS, STAGES, of, variant, decorate, regionOf, atmosOf, gimmickLayout };
})();
