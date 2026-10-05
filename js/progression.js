// マップと戦闘で共通の難易度・精霊の絆。
const Progression = (() => {
  const difficulties = {
    gentle: { name: 'やさしい', level: -1, enemyLevel: -1, hp: 0.85, atk: 1, reward: 0.8, desc: '敵のHPが少なく、受ける傷も軽い' },
    normal: { name: 'ふつう', level: 0, enemyLevel: 0, hp: 1, atk: 1, reward: 1, desc: '標準の敵と報酬' },
    hard: { name: 'むずかしい', level: 3, enemyLevel: 2, hp: 1.15, atk: 1.08, reward: 1.5, desc: '敵が強くなる・しずく1.5倍' },
    expert: { name: '達人', level: 6, enemyLevel: 4, hp: 1.35, atk: 1.16, reward: 2, desc: '高いHPと攻撃力・しずく2倍' },
  };
  const spirits = {
    gran: { name: 'グラン', color: '#3fb4c9' }, ivy: { name: 'アイビー', color: '#5fd07a' },
    spinel: { name: 'スピネル', color: '#ffd25e' }, king: { name: 'パレット王', color: '#b48cff' },
  };
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
  ];
  const thresholds = [0, 8, 20, 40, 70];
  const normalize = key => Object.hasOwn(difficulties, key) ? key : 'normal';
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const count = (value, fallback = 0, max = 999999) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Math.floor(Number(value)))) : fallback;
  function selected(party, id) {
    let fallback = 'normal';
    try { fallback = localStorage.getItem('cr_diff'); } catch (e) {}
    return normalize(party.stageDifficulty?.[id] || fallback);
  }
  const level = (conf, key) => Math.max(1, (conf.recLv || conf.lv || 1) + difficulties[normalize(key)].level);
  const rank = points => thresholds.filter(n => (points || 0) >= n).length;
  const learned = (party, id) => skills.filter(s => (!id || s.spirit === id) && party.aria.skills.includes(s.id));
  function migrate(party) {
    if (!isRecord(party)) party = {};
    party.aria = isRecord(party.aria) ? party.aria : {};
    party.aria.lv = Math.max(1, count(party.aria.lv, 1, 99));
    party.aria.exp = count(party.aria.exp, 0, 99);
    party.gold = count(party.gold, 0, 9999999);
    party.spirits = isRecord(party.spirits) ? party.spirits : {};
    party.owned = [...new Set(Array.isArray(party.owned) ? party.owned.filter(id => typeof id === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(id)) : [])];
    const equipment = isRecord(party.equip) ? party.equip : {};
    party.equip = Object.fromEntries(['blade', 'cloth', 'charm'].map(slot => [slot, party.owned.includes(equipment[slot]) ? equipment[slot] : null]));
    const inventory = isRecord(party.items) ? party.items : { i_tea: 2 };
    party.items = Object.fromEntries(['i_tea', 'i_water', 'i_shard', 'i_powder', 'i_ward'].filter(id => Object.hasOwn(inventory, id)).map(id => [id, count(inventory[id], 0, 9)]));
    const choices = isRecord(party.stageDifficulty) ? party.stageDifficulty : {};
    party.stageDifficulty = Object.fromEntries(Object.entries(choices).filter(([id, d]) => /^[a-z][a-z0-9_]{0,63}$/.test(id) && Object.hasOwn(difficulties, d)));
    party.aria.skills = [...new Set(Array.isArray(party.aria.skills) ? party.aria.skills.filter(id => skills.some(s => s.id === id)) : [])];
    for (const [id, r] of Object.entries(party.spirits)) {
      if (!Object.hasOwn(spirits, id) || !isRecord(r)) { delete party.spirits[id]; continue; }
      r.lv = Math.max(1, count(r.lv, party.aria.lv, 99));
      r.exp = count(r.exp, 0, 99);
      r.bond = count(r.bond, 0);
      r.uses = count(r.uses, 0);
      skills.filter(s => s.spirit === id && r.bond >= s.at).forEach(s => {
        if (!party.aria.skills.includes(s.id)) party.aria.skills.push(s.id);
      });
    }
    // 以前の実績は標準難易度の記録として引き継ぐ。
    party.stages = isRecord(party.stages) ? party.stages : {};
    const cleanStage = r => ({ cleared: r.cleared === true, best: ['S', 'A', 'B', 'C'].includes(r.best) ? r.best : null,
      missions: Array.isArray(r.missions) ? r.missions.slice(0, 16).map(v => v === true) : [], clears: count(r.clears, r.cleared === true ? 1 : 0) });
    for (const [id, r] of Object.entries(party.stages)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(id) || !isRecord(r)) { delete party.stages[id]; continue; }
      const record = cleanStage(r);
      const tiers = isRecord(r.difficulties) ? r.difficulties : record.cleared ? { normal: record } : {};
      record.difficulties = Object.fromEntries(Object.entries(tiers).filter(([key, value]) => Object.hasOwn(difficulties, key) && isRecord(value)).map(([key, value]) => [key, cleanStage(value)]));
      party.stages[id] = record;
    }
    const leisure = isRecord(party.minigames) ? party.minigames : {};
    const records = isRecord(leisure.records) ? leisure.records : {};
    party.minigames = { version: 1, records: {}, preferred: {}, active: null };
    for (const id of ['lantern', 'echo']) {
      party.minigames.records[id] = {};
      for (const [difficulty, cap] of [['gentle', 70], ['normal', 100], ['hard', 140]]) {
        const r = records[id]?.[difficulty];
        if (isRecord(r)) party.minigames.records[id][difficulty] = { plays: count(r.plays), clears: count(r.clears), best: count(r.best, 0, 100), paid: count(r.paid, 0, cap), bestMoves: r.bestMoves == null ? null : count(r.bestMoves, 0, 9999) };
      }
      const preferred = leisure.preferred?.[id];
      party.minigames.preferred[id] = ['gentle', 'normal', 'hard'].includes(preferred) ? preferred : 'gentle';
    }
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
    copy.difficulty = normalize(key);
    const d = difficulties[copy.difficulty];
    copy.recommendedLv = level(conf, key);
    copy.enemies = (copy.enemies || []).map(e => ({ ...e, lv: Math.max(1, (e.lv || 1) + d.enemyLevel) }));
    copy.enemyBoost = { hp: d.hp, atk: d.atk };
    return copy;
  }
  return { difficulties, spirits, skills, thresholds, normalize, selected, level, rank, learned, migrate, prepare };
})();
