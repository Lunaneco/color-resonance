// マップと戦闘で共通の難易度・精霊の絆。
const Progression = (() => {
  const difficulties = {
    gentle: { name: 'やさしい', level: -1, enemyLevel: -1, hp: 0.85, atk: 1, reward: 0.8, desc: '敵のHPが少なく、受ける傷も軽い' },
    normal: { name: 'ふつう', level: 0, enemyLevel: 0, hp: 1, atk: 1, reward: 1, desc: '標準の敵と報酬' },
    hard: { name: 'ハード', level: 3, enemyLevel: 2, hp: 1.15, atk: 1.08, reward: 1.5, desc: '敵が強くなる・しずく1.5倍・ボスSでユニーク／通常戦Sで通常装備' },
  };
  const spirits = {
    gran: { name: 'グラン', color: '#3fb4c9' }, ivy: { name: 'アイビー', color: '#5fd07a' },
    spinel: { name: 'スピネル', color: '#ffd25e' }, king: { name: 'パレット王', color: '#b48cff' },
  };
  const routes = { enchant: { name: 'エンチャント', desc: '心剣に宿すと+2、宿した通常攻撃の命中で+1' }, summon: { name: '召喚', desc: '精霊を召喚すると+3、召喚した精霊の命中で+1' } };
  const materials = {
    m_dust: { name: '共鳴の砂', color: '#e6d5ac', price: 25, desc: '技の基礎を磨く共通素材', source: '戦闘クリア・ミッション・遊びの評価報酬・一部の店' },
    m_teal: { name: '潮の雫晶', spirit: 'gran', color: '#65d7ed', price: 55, desc: 'グランの技を強化する素材', source: '入り江・鐘楼・港の依頼・灯台の色つなぎ・灰色の街の店' },
    m_green: { name: '若葉の結晶', spirit: 'ivy', color: '#90dcaa', price: 55, desc: 'アイビーの技を強化する素材', source: '森・果実の丘・森の依頼・精霊のこだま・灰色の街の店' },
    m_gold: { name: '金継ぎの欠片', spirit: 'spinel', color: '#f6d16f', price: 70, desc: 'スピネルの技を強化する素材', source: '石の谷・時計や橋の依頼・灯台の色つなぎ・石の村の店' },
    m_violet: { name: '虹彩の結晶', spirit: 'king', color: '#c4adff', price: 85, desc: 'パレット王の技を強化する素材', source: '城・夜空・終盤の依頼・精霊のこだま・虹の城下町の店' },
    m_core: { name: '澄明の核', color: '#f5e9ff', price: 300, desc: '+3への仕上げに使う希少素材', source: '各戦場・各難易度の初S評価・遊びの初S評価・虹の城下町の店' },
  };
  // 仲間の顔・名前は物語で加入してから表示する。成長用の記録だけでは加入扱いにしない。
  const joinedAt = { gran: 'act2', ivy: 'act4', spinel: 'act5', king: 'finale' };
  const spiritColors = { gran: 'teal', ivy: 'green', spinel: 'gold', king: 'violet' };
  function companions(unlocked = [], colors = []) {
    const chapters = ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue', 'done'];
    const reached = Math.max(-1, ...(Array.isArray(unlocked) ? unlocked : []).map(key => chapters.indexOf(key)));
    const held = Array.isArray(colors) ? colors : [];
    return Object.keys(spirits).filter(id => reached >= chapters.indexOf(joinedAt[id]) || held.includes(spiritColors[id]));
  }
  function materialDescription(id, joined) {
    const m = materials[id];
    return m?.spirit && !joined.includes(m.spirit) ? 'これから覚える技を強化する素材' : m?.desc || '';
  }
  const MATERIAL_MAX = 999;
  const spiritMaterial = { gran: 'm_teal', ivy: 'm_green', spinel: 'm_gold', king: 'm_violet' };
  const legacyRoutes = { gran_wave: 'enchant', gran_mend: 'summon', gran_tide: 'enchant', ivy_bind: 'enchant', ivy_bloom: 'summon', ivy_dance: 'enchant', spinel_break: 'enchant', spinel_guard: 'summon', spinel_sun: 'summon', king_prism: 'summon', king_canvas: 'summon', king_resonance: 'summon' };
  const skills = [
    { id: 'gran_wave', spirit: 'gran', at: 8, name: '水鏡の矢', type: '魔法', cost: 3, target: 'enemy', range: 3, power: 1.2, paint: 1, desc: '3マス先の敵へ必中の水矢。周り1マスを虹にする' },
    { id: 'gran_mend', spirit: 'gran', at: 20, name: '潮の癒し', type: 'スキル', cost: 4, target: 'ally', range: 3, heal: 0.45, paint: 1, desc: '3マス先までの味方を45%回復し、虹の床を広げる' },
    { id: 'gran_tide', spirit: 'gran', at: 40, name: '蒼海の一太刀', type: '技', cost: 6, target: 'area', range: 4, radius: 1, power: 1.55, paint: 2, desc: '選んだ地点の周り1マスへ必中の大波。周り2マスを虹にする' },
    { id: 'ivy_bind', spirit: 'ivy', at: 8, name: '若葉の縛り', type: '魔法', cost: 3, target: 'enemy', range: 3, power: 0.9, root: 2, paint: 0, desc: '3マス先の敵を攻撃し、2ターン移動を封じる' },
    { id: 'ivy_bloom', spirit: 'ivy', at: 20, name: '花守り', type: 'スキル', cost: 4, target: 'ally', range: 2, radius: 1, heal: 0.3, guard: 2, paint: 1, desc: '選んだ味方と周り1マスの味方を30%回復し、2ターン守る' },
    { id: 'ivy_dance', spirit: 'ivy', at: 40, name: '翠蔦の輪舞', type: '技', cost: 6, target: 'area', range: 3, radius: 2, power: 1.1, root: 2, drain: 0.2, paint: 2, desc: '周り2マスの敵を斬って縛り、与えた傷の20%をアリアの癒しにする' },
    { id: 'spinel_break', spirit: 'spinel', at: 8, name: '金継ぎの突き', type: '技', cost: 3, target: 'enemy', range: 2, power: 1.25, pierce: true, paint: 0, desc: '2マス先まで届く必中の突き。守りを無視し、鉛を砕く' },
    { id: 'spinel_guard', spirit: 'spinel', at: 20, name: '黄金の庇護', type: 'スキル', cost: 4, target: 'ally', range: 3, heal: 0.25, guard: 3, paint: 1, desc: '3マス先までの味方を25%回復し、3ターン守りを固める' },
    { id: 'spinel_sun', spirit: 'spinel', at: 40, name: '暁の砕光', type: '魔法', cost: 6, target: 'area', range: 3, radius: 1, power: 1.4, pierce: true, paint: 1, desc: '周り1マスの敵へ黄金の光。守りと鉛を貫く' },
    { id: 'king_prism', spirit: 'king', at: 8, name: '虹彩の光弾', type: '魔法', cost: 3, target: 'enemy', range: 4, power: 1.3, paint: 1, desc: '4マス先へ届く必中の虹の光。周り1マスを虹にする' },
    { id: 'king_canvas', spirit: 'king', at: 20, name: '七色の結界', type: 'スキル', cost: 5, target: 'ally', range: 3, radius: 2, heal: 0.2, guard: 2, paint: 2, desc: '選んだ味方の周り2マスを虹で包み、味方を20%回復して守る' },
    { id: 'king_resonance', spirit: 'king', at: 40, name: 'パレット・レゾナンス', type: '技', cost: 7, target: 'area', range: 4, radius: 2, power: 1.6, paint: 2, desc: '周り2マスへ七色の斬撃。広い範囲の穢れを打ち、床を虹にする' },
  ].map(s => ({ ...s, route: legacyRoutes[s.id], legacy: true })).concat([
    { id: 'gran_current', spirit: 'gran', route: 'enchant', at: 20, name: '凪の構え', type: 'スキル', cost: 3, target: 'ally', range: 0, heal: 0.35, guard: 1, paint: 1, desc: 'アリア自身を35%回復し、1ターン守る。足元の周り1マスを虹にする' },
    { id: 'gran_spray', spirit: 'gran', route: 'summon', at: 8, name: '潮霧の輪', type: '魔法', cost: 3, target: 'area', range: 3, radius: 1, power: 0.9, paint: 1, desc: '3マス先の周り1マスへ必中の潮霧。密集した敵を打ち、虹を広げる' },
    { id: 'gran_ocean', spirit: 'gran', route: 'summon', at: 40, name: '大海の抱擁', type: 'スキル', cost: 6, target: 'ally', range: 3, radius: 2, heal: 0.4, guard: 2, paint: 2, desc: '選んだ味方と周り2マスを40%回復し、2ターン守る。広い範囲を虹にする' },
    { id: 'ivy_renew', spirit: 'ivy', route: 'enchant', at: 20, name: '若葉の息吹', type: 'スキル', cost: 3, target: 'ally', range: 0, heal: 0.4, paint: 1, desc: 'アリア自身を40%回復し、周り1マスを虹にする。前線から退かずに立て直す' },
    { id: 'ivy_grove', spirit: 'ivy', route: 'summon', at: 8, name: '蔦の木立', type: '魔法', cost: 4, target: 'area', range: 3, radius: 1, power: 0.7, root: 1, paint: 1, desc: '周り1マスの敵を必中で攻撃し、1ターン移動を封じる' },
    { id: 'ivy_sanctuary', spirit: 'ivy', route: 'summon', at: 40, name: '花園の庇護', type: 'スキル', cost: 6, target: 'ally', range: 3, radius: 2, heal: 0.4, guard: 3, paint: 2, desc: '選んだ味方と周り2マスを40%回復し、3ターン守る。花の虹で床を包む' },
    { id: 'spinel_polish', spirit: 'spinel', route: 'enchant', at: 20, name: '金継ぎの構え', type: 'スキル', cost: 3, target: 'ally', range: 0, heal: 0.25, guard: 2, paint: 1, desc: 'アリア自身を25%回復し、2ターン守りを固める。周り1マスを虹にする' },
    { id: 'spinel_verdict', spirit: 'spinel', route: 'enchant', at: 40, name: '黄金の裁断', type: '技', cost: 6, target: 'enemy', range: 2, power: 2, pierce: true, paint: 1, desc: '2マス先まで届く威力2倍の必中斬撃。敵1体の守りと鉛を貫く' },
    { id: 'spinel_spark', spirit: 'spinel', route: 'summon', at: 8, name: '金砂の閃光', type: '魔法', cost: 4, target: 'area', range: 3, radius: 1, power: 0.9, pierce: true, paint: 1, desc: '周り1マスの敵へ必中の金砂。守りと鉛を貫き、床を虹にする' },
    { id: 'king_edge', spirit: 'king', route: 'enchant', at: 8, name: '七彩の刃', type: '技', cost: 3, target: 'enemy', range: 1, power: 1.45, paint: 1, desc: '隣の敵1体へ威力1.45倍の必中斬撃。周り1マスを七色に染める' },
    { id: 'king_mantle', spirit: 'king', route: 'enchant', at: 20, name: '虹の纏い', type: 'スキル', cost: 4, target: 'ally', range: 0, heal: 0.3, guard: 2, paint: 1, desc: 'アリア自身を30%回復し、2ターン守る。心剣の周り1マスを虹にする' },
    { id: 'king_spectrum', spirit: 'king', route: 'enchant', at: 40, name: '虹彩の極剣', type: '技', cost: 7, target: 'enemy', range: 2, power: 2.2, paint: 2, desc: '2マス先の敵1体へ威力2.2倍の必中斬撃。周り2マスを虹にする' },
  ]);
  const thresholds = [0, 8, 20, 40, 70];
  const normalize = key => key === 'expert' ? 'hard' : Object.hasOwn(difficulties, key) ? key : 'normal';
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const count = (value, fallback = 0, max = 999999) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Math.floor(Number(value)))) : fallback;
  function selected(party, id) {
    let fallback = 'normal';
    try { fallback = localStorage.getItem('cr_diff'); } catch (e) {}
    return normalize(party.stageDifficulty?.[id] || fallback);
  }
  const level = (conf, key) => Math.max(1, (conf.recLv || conf.lv || 1) + difficulties[normalize(key)].level);
  const rank = points => thresholds.filter(n => (points || 0) >= n).length;
  const learned = (party, id, route) => skills.filter(s => (!id || s.spirit === id) && (!route || s.route === route) && party.aria.skills.includes(s.id)).sort((a, b) => Object.keys(spirits).indexOf(a.spirit) - Object.keys(spirits).indexOf(b.spirit) || a.at - b.at).map(s => skill(party, s.id));
  const skillLevel = (party, id) => count(party.aria.skillLevels?.[id], 0, 3);
  function skill(party, id, previewLevel) {
    const base = skills.find(s => s.id === id);
    if (!base) return null;
    const upgrade = previewLevel == null ? skillLevel(party, id) : count(previewLevel, 0, 3), out = { ...base, upgrade };
    if (!upgrade) return out;
    out.name += ` +${upgrade}`;
    if (base.power) out.power = Math.round(base.power * (1 + upgrade * 0.12) * 1000) / 1000;
    if (base.heal) out.heal = Math.min(0.75, Math.round((base.heal + upgrade * 0.05) * 100) / 100);
    if (base.drain) out.drain = Math.min(0.4, Math.round((base.drain + upgrade * 0.05) * 100) / 100);
    if (base.guard) out.guard = base.guard + (upgrade >= 2 ? 1 : 0);
    if (base.root) out.root = Math.min(3, base.root + (upgrade >= 3 ? 1 : 0));
    if (base.heal) out.desc = out.desc.replace(`${Math.round(base.heal * 100)}%回復`, `${Math.round(out.heal * 100)}%回復`);
    if (base.guard) out.desc = out.desc.replace(`${base.guard}ターン守`, `${out.guard}ターン守`);
    if (base.root) out.desc = out.desc.replace(`${base.root}ターン移動`, `${out.root}ターン移動`);
    if (base.drain) out.desc = out.desc.replace(`${Math.round(base.drain * 100)}%`, `${Math.round(out.drain * 100)}%`);
    if (base.power) out.desc = out.desc.replace(/威力[\d.]+倍/g, `威力${out.power}倍`);
    out.desc += `（強化：${enhancement(base, upgrade)}）`;
    return out;
  }
  function enhancement(base, level) {
    const parts = [];
    if (base.power) parts.push(`威力+${level * 12}%`);
    if (base.heal) parts.push(`回復${Math.round(Math.min(.75, base.heal + level * .05) * 100)}%`);
    if (base.drain) parts.push(`吸収${Math.round(Math.min(.4, base.drain + level * .05) * 100)}%`);
    if (base.guard) parts.push(`守り${base.guard + (level >= 2 ? 1 : 0)}ターン`);
    if (base.root) parts.push(`束縛${Math.min(3, base.root + (level >= 3 ? 1 : 0))}ターン`);
    return parts.join('・');
  }
  function recipe(party, id) {
    const base = skills.find(s => s.id === id), next = skillLevel(party, id) + 1;
    if (!base || next > 3) return null;
    return { m_dust: [0, 3, 6, 10][next], [spiritMaterial[base.spirit]]: [0, 2, 4, 6][next], ...(next === 3 ? { m_core: 1 } : {}) };
  }
  function upgrade(party, id) {
    if (!party.aria.skills.includes(id)) return { ok: false, message: 'まず、この技を習得してください' };
    const cost = recipe(party, id);
    if (!cost) return { ok: false, message: 'この技は最大まで強化されています' };
    if (Object.entries(cost).some(([key, n]) => count(party.materials?.[key], 0, MATERIAL_MAX) < n)) return { ok: false, message: '素材が足りません' };
    for (const [key, n] of Object.entries(cost)) party.materials[key] -= n;
    party.aria.skillLevels ||= {};
    party.aria.skillLevels[id] = skillLevel(party, id) + 1;
    return { ok: true, level: party.aria.skillLevels[id], message: `${skill(party, id).name} に強化しました` };
  }
  function awardMaterials(party, bag) {
    party.materials ||= {};
    const awarded = {};
    for (const [id, n] of Object.entries(bag)) {
      if (!Object.hasOwn(materials, id)) continue;
      const before = count(party.materials[id], 0, MATERIAL_MAX), after = Math.min(MATERIAL_MAX, before + count(n));
      party.materials[id] = after;
      if (after > before) awarded[id] = after - before;
    }
    return awarded;
  }
  function battleMaterials(conf, key) {
    const groups = { gran: ['cove', 'gran', 'f_mist', 'q_harbor', 'q_lantern', 'q_tide'], ivy: ['ivy', 'f_fruit', 'f_maze', 'q_orchard', 'q_thorns', 'q_bloom'], spinel: ['spinel', 'q_clock', 'q_bridge', 'q_gold'] };
    const spirit = Object.keys(groups).find(id => groups[id].includes(conf.id)) || 'king', n = { gentle: 1, normal: 2, hard: 3 }[normalize(key)];
    return { m_dust: n + 1, [materials[conf.material] ? conf.material : spiritMaterial[spirit]]: n };
  }
  function collectBattleMaterials(party, conf, key, res, rank, record) {
    const clear = awardMaterials(party, battleMaterials(conf, key)), missionBag = {}, gem = Object.keys(battleMaterials(conf, key)).find(id => id !== 'm_dust');
    record.materialMissions ||= [];
    res.forEach((done, i) => {
      if (!done || record.materialMissions[i]) return;
      record.materialMissions[i] = true;
      missionBag.m_dust = (missionBag.m_dust || 0) + 1; missionBag[gem] = (missionBag[gem] || 0) + 1;
    });
    const mastery = rank === 'S' && !record.materialMasteryClaimed ? awardMaterials(party, { m_core: 1 }) : {};
    if (rank === 'S') record.materialMasteryClaimed = true;
    return { clear, mission: awardMaterials(party, missionBag), mastery };
  }
  function leisureMaterials(party, id, key, grade, record) {
    key = normalize(key);
    const reached = Math.max(0, 'CBAS'.indexOf(grade) + 1), prior = count(record.materialGrades, 0, 4), bag = {};
    for (let n = prior + 1; n <= reached; n++) {
      bag.m_dust = (bag.m_dust || 0) + { gentle: 2, normal: 3, hard: 4 }[key];
      for (const gem of { lantern: ['m_teal', 'm_gold'], echo: ['m_green', 'm_violet'], voyage: ['m_teal', 'm_green'], crystal: ['m_gold', 'm_violet'] }[id] || []) bag[gem] = (bag[gem] || 0) + (key === 'hard' ? 2 : 1);
      if (n === 4) bag.m_core = 1;
    }
    record.materialGrades = Math.max(prior, reached);
    return awardMaterials(party, bag);
  }
  function leisureHardBonus(party, key, record) {
    if (key !== 'hard') return {};
    const prior = count(record.hardCoreClaimed, 0, 2);
    const awarded = awardMaterials(party, { m_core: 2 - prior });
    // 満杯で入らなかった分は次のクリアで受け取れる。評価の報酬とは独立。
    record.hardCoreClaimed = prior + (awarded.m_core || 0);
    return awarded;
  }
  const training = (party, id, route) => count(party.spirits?.[id]?.training?.[route], 0);
  function practice(party, id, route, amount) {
    if (!Object.hasOwn(routes, route) || !Object.hasOwn(spirits, id) || !party.spirits[id]) return [];
    const r = party.spirits[id];
    r.training = isRecord(r.training) ? r.training : { enchant: 0, summon: 0 };
    r.training[route] = count(training(party, id, route) + count(amount));
    const gained = skills.filter(s => s.spirit === id && s.route === route && r.training[route] >= s.at && !party.aria.skills.includes(s.id));
    gained.forEach(s => party.aria.skills.push(s.id));
    return gained;
  }
  const ordinaryRewards = { cove: 'e_glass', gran: 'a_wool', ivy: 'c_bell', spinel: 'a_gold', king: 'e_prism', chrome: 'a_star', f_mist: 'a_rain', f_fruit: 'e_tide', f_maze: 'a_moss', f_stars: 'c_brush', f_void: 'c_feather', q_harbor: 'e_glass', q_lantern: 'a_rain', q_tide: 'e_tide', q_clock: 'c_lens', q_orchard: 'a_wool', q_thorns: 'c_bell', q_bloom: 'c_tea', q_bridge: 'a_moss', q_gold: 'a_gold', q_palette: 'e_amber', q_stargarden: 'c_brush', q_echo: 'a_star' };
  const isBossStage = conf => (conf.enemies || []).some(e => e.kind === 'boss' || e.kind === 'chrome');
  const ordinaryEquipment = conf => conf.ordinaryReward || ordinaryRewards[conf.id] || 'e_glass';
  function rewards(conf, key) {
    key = normalize(key);
    const firstItems = { ...(conf.firstItems || { i_tea: 1 }) };
    if (key === 'gentle') firstItems.i_tea = (firstItems.i_tea || 0) + 1;
    if (key === 'hard') firstItems.i_ward = (firstItems.i_ward || 0) + 1;
    const unique = key === 'hard' && isBossStage(conf) && !!conf.unique;
    return { firstItems, sEquipment: key === 'hard' ? unique ? conf.unique : ordinaryEquipment(conf) : null,
      sItems: key === 'normal' ? { i_shard: 2, i_powder: 1 } : key === 'gentle' ? { i_shard: 1, i_powder: 1 } : {}, unique };
  }
  function reconcileRewards(party, stages, gear) {
    const all = [...new Map(stages.map(c => [c.id, c])).values()];
    const earned = c => { const r = party.stages?.[c.id]?.difficulties?.hard; return r && (r.sRewardClaimed || r.best === 'S'); };
    const protectedIds = new Set(all.filter(c => isBossStage(c) && earned(c)).map(c => c.unique));
    const changes = [];
    for (const id of [...party.owned]) {
      if (!gear[id]?.unique || protectedIds.has(id)) continue;
      const sources = all.filter(c => c.unique === id && !isBossStage(c) && earned(c));
      if (!sources.length) continue;
      const replacement = ordinaryEquipment(sources[0]), next = gear[replacement];
      if (!next || next.unique) continue;
      party.owned = [...new Set(party.owned.filter(x => x !== id).concat(replacement))];
      let equipped = false;
      for (const slot of ['blade','cloth','charm']) if (party.equip[slot] === id) { party.equip[slot] = null; equipped = true; }
      if (equipped && !party.equip[next.slot]) party.equip[next.slot] = replacement;
      sources.forEach(c => { party.stages[c.id].difficulties.hard.sRewardClaimed = true; });
      changes.push({ from:id, to:replacement });
    }
    return changes;
  }
  function migrate(party) {
    if (!isRecord(party)) party = {};
    party.aria = isRecord(party.aria) ? party.aria : {};
    party.aria.lv = Math.max(1, count(party.aria.lv, 1, 99));
    party.aria.exp = count(party.aria.exp, 0, 99);
    party.gold = count(party.gold, 0, 9999999);
    const post = isRecord(party.postgame) ? party.postgame : {};
    party.postgame = { started: post.started === true, progress: post.started === true ? count(post.progress, 0, 8) : 0,
      finished: post.started === true && count(post.progress, 0, 8) === 8 && post.finished === true,
      priority: ['bridge', 'garden'].includes(post.priority) ? post.priority : null };
    const human = isRecord(party.chrome) ? party.chrome : {};
    party.chrome = { lv: Math.max(1, count(human.lv, party.aria.lv, 99)), exp: count(human.exp, 0, 99) };
    party.spirits = isRecord(party.spirits) ? party.spirits : {};
    party.owned = [...new Set(Array.isArray(party.owned) ? party.owned.filter(id => typeof id === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(id)) : [])];
    const equipment = isRecord(party.equip) ? party.equip : {};
    party.equip = Object.fromEntries(['blade', 'cloth', 'charm'].map(slot => [slot, party.owned.includes(equipment[slot]) ? equipment[slot] : null]));
    const inventory = isRecord(party.items) ? party.items : { i_tea: 2 };
    party.items = Object.fromEntries(['i_tea', 'i_water', 'i_shard', 'i_powder', 'i_ward'].filter(id => Object.hasOwn(inventory, id)).map(id => [id, count(inventory[id], 0, 9)]));
    const choices = isRecord(party.stageDifficulty) ? party.stageDifficulty : {};
    party.stageDifficulty = Object.fromEntries(Object.entries(choices).filter(([id, d]) => /^[a-z][a-z0-9_]{0,63}$/.test(id) && (Object.hasOwn(difficulties, d) || d === 'expert')).map(([id, d]) => [id, normalize(d)]));
    party.aria.skills = [...new Set(Array.isArray(party.aria.skills) ? party.aria.skills.filter(id => skills.some(s => s.id === id)) : [])];
    party.materials = Object.fromEntries(Object.keys(materials).map(id => [id, count(party.materials?.[id], 0, MATERIAL_MAX)]));
    for (const [id, r] of Object.entries(party.spirits)) {
      if (!Object.hasOwn(spirits, id) || !isRecord(r)) { delete party.spirits[id]; continue; }
      r.lv = Math.max(1, count(r.lv, party.aria.lv, 99));
      r.exp = count(r.exp, 0, 99);
      r.bond = count(r.bond, 0);
      r.uses = count(r.uses, 0);
      const legacy = !isRecord(r.training);
      r.training = { enchant: count(r.training?.enchant), summon: count(r.training?.summon) };
      skills.filter(s => s.spirit === id && (legacy && s.legacy && r.bond >= s.at || r.training[s.route] >= s.at)).forEach(s => {
        if (!party.aria.skills.includes(s.id)) party.aria.skills.push(s.id);
      });
    }
    party.aria.skillLevels = Object.fromEntries(Object.entries(isRecord(party.aria.skillLevels) ? party.aria.skillLevels : {}).filter(([id, n]) => party.aria.skills.includes(id) && count(n, 0, 3) > 0).map(([id, n]) => [id, count(n, 0, 3)]));
    // 以前の実績は標準難易度の記録として引き継ぐ。
    party.stages = isRecord(party.stages) ? party.stages : {};
    const cleanStage = r => ({ cleared: r.cleared === true, best: ['S', 'A', 'B', 'C'].includes(r.best) ? r.best : null,
      missions: Array.isArray(r.missions) ? r.missions.slice(0, 16).map(v => v === true) : [], clears: count(r.clears, r.cleared === true ? 1 : 0), sRewardClaimed: r.sRewardClaimed === true,
      materialMissions: Array.isArray(r.materialMissions) ? r.materialMissions.slice(0, 16).map(v => v === true) : [], materialMasteryClaimed: r.materialMasteryClaimed === true });
    for (const [id, r] of Object.entries(party.stages)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(id) || !isRecord(r)) { delete party.stages[id]; continue; }
      const record = cleanStage(r);
      const tiers = isRecord(r.difficulties) ? r.difficulties : record.cleared ? { normal: record } : {};
      record.difficulties = {};
      for (const [key, value] of Object.entries(tiers)) {
        if ((!Object.hasOwn(difficulties, key) && key !== 'expert') || !isRecord(value)) continue;
        const normalized = normalize(key), v = cleanStage(value), old = record.difficulties[normalized];
        record.difficulties[normalized] = old ? { cleared: old.cleared || v.cleared, best: [old.best, v.best].filter(Boolean).sort((a, b) => 'SABC'.indexOf(a) - 'SABC'.indexOf(b))[0] || null, missions: Array.from({ length: Math.max(old.missions.length, v.missions.length) }, (_, i) => !!(old.missions[i] || v.missions[i])), clears: count(old.clears + v.clears), sRewardClaimed: old.sRewardClaimed || v.sRewardClaimed,
          materialMissions: Array.from({ length: Math.max(old.materialMissions.length, v.materialMissions.length) }, (_, i) => !!(old.materialMissions[i] || v.materialMissions[i])), materialMasteryClaimed: old.materialMasteryClaimed || v.materialMasteryClaimed } : v;
      }
      party.stages[id] = record;
    }
    const leisure = isRecord(party.minigames) ? party.minigames : {};
    const records = isRecord(leisure.records) ? leisure.records : {};
    party.minigames = { version: 2, records: {}, preferred: {}, active: null };
    for (const id of ['lantern', 'echo', 'voyage', 'crystal']) {
      party.minigames.records[id] = {};
      for (const [difficulty, cap] of [['gentle', 70], ['normal', 100], ['hard', 140]]) {
        const r = records[id]?.[difficulty];
        if (isRecord(r)) party.minigames.records[id][difficulty] = { plays: count(r.plays), clears: count(r.clears), best: count(r.best, 0, 100), paid: count(r.paid, 0, cap), bestMoves: r.bestMoves == null ? null : count(r.bestMoves, 0, 9999), materialGrades: count(r.materialGrades, 0, 4), hardCoreClaimed: difficulty === 'hard' ? count(r.hardCoreClaimed, 0, 2) : 0 };
      }
      const preferred = leisure.preferred?.[id];
      party.minigames.preferred[id] = ['gentle', 'normal', 'hard'].includes(preferred) ? preferred : 'gentle';
    }
    if (typeof PlayCore !== 'undefined' && ['voyage', 'crystal'].includes(leisure.active?.id)) party.minigames.active = PlayCore.restore(leisure.active);
    // 未完の遊びは復元前に個別ルールも確認する。破損した途中記録は実績と切り離す。
    if (isRecord(leisure.active) && ['lantern', 'echo'].includes(leisure.active.id) && ['gentle', 'normal', 'hard'].includes(leisure.active.difficulty)) {
      const a = leisure.active;
      if (a.id === 'lantern') {
        const cells = { gentle: 6, normal: 9, hard: 16 }[a.difficulty], full = 2 ** cells - 1;
        if (Number.isInteger(a.initial) && a.initial >= 0 && a.initial <= full && Number.isInteger(a.board) && a.board >= 0 && a.board <= full)
          party.minigames.active = { id: a.id, difficulty: a.difficulty, initial: a.initial, board: a.board, moves: count(a.moves, 0, 9999), hints: count(a.hints, 0, 9999), history: Array.isArray(a.history) ? a.history.filter(n => Number.isInteger(n) && n >= 0 && n < cells).slice(-256) : [] };
      } else {
        const length = { gentle: 5, normal: 7, hard: 9 }[a.difficulty];
        if (Array.isArray(a.sequence) && a.sequence.length === length && a.sequence.every(n => Number.isInteger(n) && n >= 0 && n < 4))
          party.minigames.active = { id: a.id, difficulty: a.difficulty, sequence: a.sequence.slice(), round: count(a.round, 0, 2), mistakes: count(a.mistakes, 0, 9999), aids: count(a.aids, 0, 9999), input: [] };
        const active = party.minigames.active;
        if (active && Array.isArray(a.input) && a.input.length < length - 2 + active.round && a.input.every((n, i) => n === active.sequence[i])) active.input = a.input.slice();
      }
    }
    if (typeof party.pos !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(party.pos)) delete party.pos;
    return party;
  }
  function prepare(conf, key) {
    const copy = JSON.parse(JSON.stringify(conf));
    copy.difficulty = copy.hardOnly ? 'hard' : normalize(key);
    const d = difficulties[copy.difficulty];
    copy.recommendedLv = level(conf, copy.difficulty);
    copy.enemies = (copy.enemies || []).map(e => ({ ...e, lv: Math.max(1, (e.lv || 1) + d.enemyLevel) }));
    copy.enemyBoost = { hp: d.hp, atk: d.atk };
    return copy;
  }
  return { difficulties, spirits, routes, skills, thresholds, normalize, selected, level, rank, learned, training, practice, rewards, isBossStage, ordinaryEquipment, reconcileRewards, migrate, prepare,
    companions, materialDescription, materials, MATERIAL_MAX, skillLevel, skill, enhancement, recipe, upgrade, awardMaterials, battleMaterials, collectBattleMaterials, leisureMaterials, leisureHardBonus };
})();
