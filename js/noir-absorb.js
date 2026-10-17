// ノアールの吸収。瀕死の穢れを消し、種類ごとの初回だけ技を残す。
// 戦場の有無は party.noir.joined だけを見る。無いセーブには足さない。
const NoirAbsorb = (() => {
  const RANGE = 2;
  const THRESHOLD = 0.30;

  const CATALOG = {
    n_shade: { id: 'n_shade', name: '影の一口', desc: '隣の穢れを、預かった影で小さく打つ', range: [1, 1], power: 0.7, target: 'enemy' },
    n_thorn: { id: 'n_thorn', name: '棘の残り', desc: '2マスまで届く、細い棘', range: [1, 2], power: 0.55, target: 'enemy' },
    n_lead: { id: 'n_lead', name: '殻割り', desc: '小さく打ち、鉛を一枚剥がす', range: [1, 1], power: 0.5, target: 'enemy' },
    n_membrane: { id: 'n_membrane', name: '膜ほどき', desc: '2マスまで、白い膜を小さくほどく', range: [1, 2], power: 0.55, target: 'enemy' },
    n_push: { id: 'n_push', name: '潮の押し', desc: '小さく打ち、1マス押し流す', range: [1, 1], power: 0.55, push: true, target: 'enemy' },
    n_ember: { id: 'n_ember', name: '澱の燠', desc: '小さく灼く。床はくすませない', range: [1, 1], power: 0.6, target: 'enemy' },
    n_root: { id: 'n_root', name: '絡む澱', desc: '小さく打ち、半分の確率で1ターン動けなくする', range: [1, 2], power: 0.5, root: 0.5, target: 'enemy' },
    n_plate: { id: 'n_plate', name: '金の膜', desc: '自分か隣の味方に、次の一撃を半分にする膜を張る', range: [0, 1], plate: 1, target: 'ally' },
    n_drain: { id: 'n_drain', name: '色吸い', desc: '小さく打ち、共鳴を1戻す', range: [1, 1], power: 0.45, sp: 1, target: 'enemy' },
    n_mist: { id: 'n_mist', name: '霞の一刺し', desc: '外れにくい、小さな一撃', range: [1, 2], power: 0.5, sure: true, target: 'enemy' },
    n_pierce: { id: 'n_pierce', name: '金継ぎの残り', desc: '守りと鉛を無視して、小さく貫く', range: [1, 1], power: 0.65, pierce: true, target: 'enemy' },
    n_rainbow: { id: 'n_rainbow', name: '虹の残り香', desc: '小さく打ち、当たった床の周りを虹に染める', range: [1, 2], power: 0.45, paint: 1, target: 'enemy' },
    n_roar: { id: 'n_roar', name: '短い咆哮', desc: '預かった怒りの、短い一声', range: [1, 1], power: 0.95, target: 'enemy' },
    n_heal: { id: 'n_heal', name: '灯の残り', desc: '自分か隣の味方を、最大HPの18%癒す', range: [0, 1], heal: 0.18, target: 'ally' },
    n_hearth: { id: 'n_hearth', name: '炉の残り火', desc: '小さく打ち、自分を少し癒す。床はくすませない', range: [1, 1], power: 0.55, selfHeal: 0.08, target: 'enemy' },
    n_star: { id: 'n_star', name: '星の屑', desc: '小さく打ち、共鳴を2戻す', range: [1, 2], power: 0.4, sp: 2, target: 'enemy' },
    n_wave: { id: 'n_wave', name: '夜のひと波', desc: '預かった黒の、一筋だけの波', range: [1, 2], power: 0.75, target: 'enemy' },
    n_night: { id: 'n_night', name: '夜を閉じる声', desc: '縁の夜を、小さくほどく', range: [1, 2], power: 0.6, target: 'enemy' },
    n_core: { id: 'n_core', name: '核の澱', desc: '核から預かった、小さな一撃', range: [1, 1], power: 0.7, target: 'enemy' },
    n_gulp: { id: 'n_gulp', name: '闇の一口', desc: 'まだ名のない守護者から預かった、小さな一撃', range: [1, 1], power: 0.6, target: 'enemy' },
  };

  const BY_TYPE = {
    g_gran: 'n_push', g_ivy: 'n_root', g_spinel: 'n_pierce', g_king: 'n_rainbow', g_vard: 'n_roar',
    g_nephra: 'n_night', g_farol: 'n_heal', g_rivela: 'n_push', g_pomela: 'n_root', g_folio: 'n_pierce',
    g_fiamma: 'n_hearth', g_lucerna: 'n_heal', g_coronel: 'n_pierce', g_aster: 'n_star', g_chrome: 'n_wave',
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
  const list = record => (record && Array.isArray(record.skills) ? record.skills : []).map(id => CATALOG[id]).filter(Boolean);

  return { RANGE, THRESHOLD, CATALOG, blank, typeOf, skillFor, nearDeath, absorb, sanitize, get, list };
})();
