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
  function selected(party, id) {
    let fallback = 'normal';
    try { fallback = localStorage.getItem('cr_diff'); } catch (e) {}
    return normalize(party.stageDifficulty[id] || fallback);
  }
  const level = (conf, key) => Math.max(1, (conf.recLv || conf.lv || 1) + difficulties[normalize(key)].level);
  const rank = points => thresholds.filter(n => (points || 0) >= n).length;
  const learned = (party, id) => skills.filter(s => (!id || s.spirit === id) && party.aria.skills.includes(s.id));
  function migrate(party) {
    party.stageDifficulty = party.stageDifficulty || {};
    party.aria.skills = Array.isArray(party.aria.skills) ? party.aria.skills : [];
    for (const [id, r] of Object.entries(party.spirits)) {
      r.bond = Math.max(0, Number(r.bond) || 0);
      r.uses = Math.max(0, Number(r.uses) || 0);
      skills.filter(s => s.spirit === id && r.bond >= s.at).forEach(s => {
        if (!party.aria.skills.includes(s.id)) party.aria.skills.push(s.id);
      });
    }
    // 以前の実績は標準難易度の記録として引き継ぐ。
    for (const r of Object.values(party.stages)) {
      if (!r.difficulties) r.difficulties = r.cleared ? { normal: { cleared: true, best: r.best, missions: (r.missions || []).slice(), clears: r.clears || 1 } } : {};
    }
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
