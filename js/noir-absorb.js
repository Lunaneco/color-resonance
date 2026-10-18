// ノアールの吸収。瀕死の穢れを消し、種類ごとの初回だけ技を残す。
// 戦場の有無は party.noir.joined だけを見る。無いセーブには足さない。
const NoirAbsorb = (() => {
  const RANGE = 2;
  const THRESHOLD = 0.30;

  // 預かった技は共鳴を使う（cost）。ふつうの敵の技は共鳴2〜3、守り手・ボス・クロムの技（tier: 'boss'）は共鳴4〜6の大技。
  // ノアールの攻撃はアリアの半分ほどなので、威力は通常攻撃の1.4倍以上にしてある。radius は選んだ相手の周りにも当たる。
  const CATALOG = {
    n_shade: { id: 'n_shade', name: '影の一口', desc: '隣の穢れを、預かった影で打つ', range: [1, 1], power: 1.6, cost: 2, target: 'enemy' },
    n_thorn: { id: 'n_thorn', name: '棘の残り', desc: '2マスまで届く、細い棘', range: [1, 2], power: 1.4, cost: 2, target: 'enemy' },
    n_lead: { id: 'n_lead', name: '殻割り', desc: '鉛を無視して打つ', range: [1, 1], power: 1.4, cost: 2, pierce: true, target: 'enemy' },
    n_membrane: { id: 'n_membrane', name: '膜ほどき', desc: '2マスまで、白い膜をほどく', range: [1, 2], power: 1.5, cost: 2, target: 'enemy' },
    n_push: { id: 'n_push', name: '潮の押し', desc: '打って、1マス押し流す', range: [1, 1], power: 1.5, cost: 2, push: true, target: 'enemy' },
    n_ember: { id: 'n_ember', name: '澱の燠', desc: '灼くように打つ。床はくすませない', range: [1, 1], power: 1.7, cost: 2, target: 'enemy' },
    n_root: { id: 'n_root', name: '絡む澱', desc: '打って、半分の確率で1ターン動けなくする', range: [1, 2], power: 1.4, cost: 2, root: 0.5, target: 'enemy' },
    n_plate: { id: 'n_plate', name: '金の膜', desc: '自分か隣の味方に、次の一撃を半分にする膜を張る', range: [0, 1], plate: 1, cost: 2, target: 'ally' },
    n_drain: { id: 'n_drain', name: '色吸い', desc: '打って、共鳴を1戻す', range: [1, 1], power: 1.4, cost: 2, sp: 1, target: 'enemy' },
    n_mist: { id: 'n_mist', name: '霞の一刺し', desc: '外れにくい一撃', range: [1, 2], power: 1.5, cost: 2, sure: true, target: 'enemy' },
    n_pierce: { id: 'n_pierce', name: '金継ぎの残り', desc: '守りと鉛を無視して貫く', range: [1, 1], power: 1.8, cost: 3, pierce: true, target: 'enemy' },
    n_rainbow: { id: 'n_rainbow', name: '虹の残り香', desc: '打って、当たった床の周りを虹に染める', range: [1, 2], power: 1.5, cost: 3, paint: 1, target: 'enemy' },
    n_heal: { id: 'n_heal', name: '灯の残り', desc: '自分か隣の味方を、最大HPの25%癒す', range: [0, 1], heal: 0.25, cost: 3, target: 'ally' },
    n_hearth: { id: 'n_hearth', name: '炉の残り火', desc: '打って、自分を最大HPの10%癒す', range: [1, 1], power: 1.6, cost: 3, selfHeal: 0.1, target: 'enemy' },
    n_star: { id: 'n_star', name: '星の屑', desc: '打って、共鳴を2戻す', range: [1, 2], power: 1.3, cost: 3, sp: 2, target: 'enemy' },
    // 守り手・ボス・クロムから預かる大技
    n_tidal: { id: 'n_tidal', tier: 'boss', name: '潮の大波', desc: '選んだ相手と周り1マスを大波で打ち、押し流す', range: [1, 2], power: 2.1, radius: 1, push: true, cost: 5, target: 'enemy' },
    n_briar: { id: 'n_briar', tier: 'boss', name: '茨の檻', desc: '3マスまで届き、必ず1ターン動けなくする', range: [1, 3], power: 2.0, root: 1, cost: 4, target: 'enemy' },
    n_kintsugi: { id: 'n_kintsugi', tier: 'boss', name: '金継ぎの穿ち', desc: '守りと鉛を無視して、深く貫く', range: [1, 2], power: 2.7, pierce: true, cost: 4, target: 'enemy' },
    n_prism: { id: 'n_prism', tier: 'boss', name: '七色の澱', desc: '選んだ相手と周り1マスを打ち、床を広く虹に染める', range: [1, 3], power: 2.0, radius: 1, paint: 2, cost: 5, target: 'enemy' },
    n_roar: { id: 'n_roar', tier: 'boss', name: '紅竜の咆哮', desc: '預かった怒りの、重い一撃', range: [1, 1], power: 3.0, cost: 4, target: 'enemy' },
    n_night: { id: 'n_night', tier: 'boss', name: '夜渡りの帳', desc: '選んだ相手と周り1マスへ、夜を降ろす', range: [1, 2], power: 2.1, radius: 1, cost: 5, target: 'enemy' },
    n_beacon: { id: 'n_beacon', tier: 'boss', name: '港灯の癒し', desc: '選んだ味方と周り1マスの味方を、最大HPの35%癒す', range: [0, 2], heal: 0.35, radius: 1, cost: 4, target: 'ally' },
    n_current: { id: 'n_current', tier: 'boss', name: '水紐の奔流', desc: '選んだ相手と周り1マスを打ち、押し流す', range: [1, 2], power: 2.0, radius: 1, push: true, cost: 5, target: 'enemy' },
    n_sprout: { id: 'n_sprout', tier: 'boss', name: '芽吹きの縛り', desc: '選んだ相手と周り1マスを打ち、必ず1ターン動けなくする', range: [1, 2], power: 1.8, radius: 1, root: 1, cost: 5, target: 'enemy' },
    n_fold: { id: 'n_fold', tier: 'boss', name: '頁折りの一閃', desc: '守りと鉛を無視して、2マス先まで切り裂く', range: [1, 2], power: 2.6, pierce: true, cost: 4, target: 'enemy' },
    n_hearthfire: { id: 'n_hearthfire', tier: 'boss', name: '炉火の抱擁', desc: '打って、自分を最大HPの30%癒す', range: [1, 1], power: 2.4, selfHeal: 0.3, cost: 4, target: 'enemy' },
    n_lantern: { id: 'n_lantern', tier: 'boss', name: '灯翅の光', desc: '選んだ味方と周り1マスの味方を癒し、次の一撃を半分にする膜を張る', range: [0, 2], heal: 0.25, plate: 1, radius: 1, cost: 5, target: 'ally' },
    n_crown: { id: 'n_crown', tier: 'boss', name: '冠枝の砕き', desc: '守りと鉛を無視した、重い一撃', range: [1, 1], power: 3.0, pierce: true, cost: 5, target: 'enemy' },
    n_starfall: { id: 'n_starfall', tier: 'boss', name: '星璃の流星', desc: '3マスまで届き、共鳴を3戻す', range: [1, 3], power: 2.0, sp: 3, cost: 4, target: 'enemy' },
    n_tick: { id: 'n_tick', tier: 'boss', name: '止まる時報', desc: '選んだ相手と周り1マスを打ち、必ず1ターン動けなくする', range: [1, 2], power: 2.2, radius: 1, root: 1, cost: 6, target: 'enemy' },
    n_wave: { id: 'n_wave', tier: 'boss', name: '漆黒の大波', desc: '3マスまで届き、選んだ相手と周り1マスを黒い波で打つ', range: [1, 3], power: 2.6, radius: 1, cost: 6, target: 'enemy' },
    n_core: { id: 'n_core', tier: 'boss', name: '核の澱', desc: '核から預かった、2マスまで届く重い一撃', range: [1, 2], power: 2.5, cost: 4, target: 'enemy' },
    n_gulp: { id: 'n_gulp', tier: 'boss', name: '闇の一口', desc: '守り手から預かった、重い一撃', range: [1, 1], power: 2.6, cost: 4, target: 'enemy' },
  };

  const BY_TYPE = {
    g_gran: 'n_tidal', g_ivy: 'n_briar', g_spinel: 'n_kintsugi', g_king: 'n_prism', g_vard: 'n_roar',
    g_nephra: 'n_night', g_farol: 'n_beacon', g_rivela: 'n_current', g_pomela: 'n_sprout', g_folio: 'n_fold',
    g_fiamma: 'n_hearthfire', g_lucerna: 'n_lantern', g_coronel: 'n_crown', g_aster: 'n_starfall', g_chrome: 'n_wave', g_kaoru: 'n_tick',
  };
  const BY_TRAIT = { push: 'n_push', ember: 'n_ember', root: 'n_root', plate: 'n_plate', drain: 'n_drain', mist: 'n_mist' };
  const BY_KIND = { shade: 'n_shade', thorn: 'n_thorn', lead: 'n_lead', membrane: 'n_membrane', boss: 'n_core', chrome: 'n_wave' };

  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };
  const cleanKey = (v, prefix) => {
    const s = String(v || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return s ? prefix + s.slice(0, 40) : '';
  };

  function blank(lv) {
    return { joined: true, lv: clamp(lv, 1, 99, 1), exp: 0, skills: [], known: {} };
  }

  function typeOf(enemy, stageId) {
    if (enemy && enemy.guardian) return cleanKey(enemy.guardian, 'g_') || 'g_unknown';
    if (enemy && enemy.kind === 'chrome') return 'g_chrome';
    if (enemy && enemy.kind === 'boss') return cleanKey(stageId || 'core', 'b_') || 'b_core';
    if (enemy && enemy.variant && enemy.variant.art) return cleanKey(enemy.variant.art, 'v_') || 'k_shade';
    return cleanKey((enemy && enemy.kind) || 'shade', 'k_') || 'k_shade';
  }

  function skillFor(key, enemy) {
    if (BY_TYPE[key]) return CATALOG[BY_TYPE[key]];
    if (key.startsWith('b_')) return CATALOG.n_core;
    if (key.startsWith('g_')) return CATALOG.n_gulp;
    const trait = enemy && enemy.trait;
    if (trait && BY_TRAIT[trait]) return CATALOG[BY_TRAIT[trait]];
    const kind = enemy && enemy.kind;
    if (kind && BY_KIND[kind]) return CATALOG[BY_KIND[kind]];
    return CATALOG.n_shade;
  }

  function nearDeath(enemy) {
    return !!(enemy && enemy.hp > 0 && enemy.mhp > 0 && enemy.hp / enemy.mhp <= THRESHOLD);
  }

  function absorb(record, enemy, stageId) {
    const key = typeOf(enemy, stageId);
    const skill = skillFor(key, enemy);
    if (!record.known || typeof record.known !== 'object' || Array.isArray(record.known)) record.known = {};
    if (!Array.isArray(record.skills)) record.skills = [];
    if (record.known[key]) {
      return { key, skill: CATALOG[record.known[key]] || skill, learned: false, duplicate: false, alreadyType: true };
    }
    record.known[key] = skill.id;
    if (record.skills.includes(skill.id)) {
      return { key, skill, learned: false, duplicate: true, alreadyType: false };
    }
    record.skills.push(skill.id);
    return { key, skill, learned: true, duplicate: false, alreadyType: false };
  }

  function sanitize(raw, ariaLv) {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const known = {};
    const srcKnown = base.known && typeof base.known === 'object' && !Array.isArray(base.known) ? base.known : {};
    Object.keys(srcKnown).sort().forEach(k => {
      if (!/^[kgbv]_[a-z0-9_]{1,40}$/.test(k)) return;
      const id = srcKnown[k];
      if (typeof id === 'string' && CATALOG[id]) known[k] = id;
    });
    const skills = [];
    (Array.isArray(base.skills) ? base.skills : []).forEach(id => {
      if (typeof id === 'string' && CATALOG[id] && !skills.includes(id)) skills.push(id);
    });
    // 1.22.0 より前に守り手を吸収した記録は、守り手ごとの大技へ置き換える（前に覚えた技は残す）。
    Object.keys(known).forEach(k => { if (BY_TYPE[k] && known[k] !== BY_TYPE[k]) known[k] = BY_TYPE[k]; });
    Object.values(known).forEach(id => { if (!skills.includes(id)) skills.push(id); });
    return {
      joined: base.joined === true,
      lv: clamp(base.lv, 1, 99, clamp(ariaLv, 1, 99, 1)),
      exp: clamp(base.exp, 0, 99, 0),
      skills,
      known,
    };
  }

  const get = id => CATALOG[id] || null;
  const costOf = skill => Math.max(0, (skill && skill.cost) || 0);
  const isMajor = enemy => !!(enemy && (enemy.guardian || enemy.kind === 'boss' || enemy.kind === 'chrome'));
  const list = record => (record && Array.isArray(record.skills) ? record.skills : []).map(id => CATALOG[id]).filter(Boolean);

  return { RANGE, THRESHOLD, CATALOG, BY_TYPE, blank, typeOf, skillFor, nearDeath, absorb, sanitize, get, list, costOf, isMajor };
})();
