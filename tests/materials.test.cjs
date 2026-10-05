const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const c = vm.createContext({ document: { addEventListener() {} }, localStorage: { getItem() {} } });
for (const file of ['progression', 'minigames']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), c);
vm.runInContext('globalThis.P=Progression; globalThis.M=Minigames;', c);
const { P, M } = c, plain = v => JSON.parse(JSON.stringify(v));
const party = () => P.migrate({ aria: { lv: 5, skills: P.skills.map(s => s.id) }, materials: Object.fromEntries(Object.keys(P.materials).map(id => [id, 100])) });

test('Upgrading spends the complete recipe once, requires a learned skill, and stops at +3', () => {
  const p = party(), snapshot = JSON.stringify(p);
  assert(!P.upgrade(p, 'unknown').ok); assert.equal(JSON.stringify(p), snapshot);
  for (const [level, dust, gem, core] of [[1, 3, 2, 0], [2, 6, 4, 0], [3, 10, 6, 1]]) {
    const before = plain(p.materials);
    assert(P.upgrade(p, 'gran_wave').ok); assert.equal(P.skillLevel(p, 'gran_wave'), level);
    assert.equal(before.m_dust - p.materials.m_dust, dust); assert.equal(before.m_teal - p.materials.m_teal, gem); assert.equal(before.m_core - p.materials.m_core, core);
    assert.equal(p.materials.m_green, 100);
  }
  const final = JSON.stringify(p); assert(!P.upgrade(p, 'gran_wave').ok); assert.equal(JSON.stringify(p), final);
  p.aria.skills = p.aria.skills.filter(id => id !== 'gran_mend'); const unlearned = JSON.stringify(p);
  assert(!P.upgrade(p, 'gran_mend').ok); assert.equal(JSON.stringify(p), unlearned);
});

test('Insufficient ingredients do not partially spend materials or advance an upgrade', () => {
  for (const missing of ['m_dust', 'm_teal', 'm_core']) {
    const p = party(); p.aria.skillLevels.gran_wave = 2; p.materials[missing] = 0;
    const before = JSON.stringify(p); assert(!P.upgrade(p, 'gran_wave').ok); assert.equal(JSON.stringify(p), before);
  }
});

test('All 24 skills gain real effects without changing resonance, target, range or area', () => {
  const p = party();
  for (const base of P.skills) {
    const zero = P.skill(p, base.id); for (const key of Object.keys(base)) assert.equal(zero[key], base[key]);
    p.aria.skillLevels[base.id] = 3; const s = P.learned(p).find(s => s.id === base.id);
    assert.equal(s.upgrade, 3); assert.equal(s.name, base.name + ' +3');
    for (const key of ['cost', 'target', 'range', 'radius', 'paint', 'pierce']) assert.equal(s[key], base[key]);
    if (base.power) assert.equal(s.power, Math.round(base.power * 1.36 * 1000) / 1000);
    if (base.heal) assert.equal(s.heal, Math.round((base.heal + .15) * 100) / 100);
    if (base.guard) assert.equal(s.guard, base.guard + 1);
    if (base.root) assert.equal(s.root, Math.min(3, base.root + 1));
    if (base.drain) assert.equal(s.drain, .35);
  }
  assert.equal(P.skill(p, 'gran_mend').heal, .6); assert.equal(P.skill(p, 'spinel_guard').guard, 4);
  assert.equal(P.skill(p, 'spinel_verdict').power, 2.72);
});

test('Clear materials are repeatable, each mission is paid once, and S cores are separate from gear rewards', () => {
  const p = P.migrate({}), r = { sRewardClaimed: true }, conf = { id: 'q_harbor' };
  let reward = P.collectBattleMaterials(p, conf, 'normal', [true, false, true], 'A', r);
  assert.deepEqual(plain(reward), { clear: { m_dust: 3, m_teal: 2 }, mission: { m_dust: 2, m_teal: 2 }, mastery: {} });
  reward = P.collectBattleMaterials(p, conf, 'normal', [true, true, true], 'S', r);
  assert.deepEqual(plain(reward.mission), { m_dust: 1, m_teal: 1 }); assert.deepEqual(plain(reward.mastery), { m_core: 1 });
  reward = P.collectBattleMaterials(p, conf, 'normal', [true, true, true], 'S', r);
  assert.deepEqual(plain(reward.mission), {}); assert.deepEqual(plain(reward.mastery), {});
  assert.deepEqual(plain(p.materials), { m_dust: 12, m_teal: 9, m_green: 0, m_gold: 0, m_violet: 0, m_core: 1 });
  const hard = P.collectBattleMaterials(p, conf, 'hard', [true, true, true], 'S', {});
  assert.deepEqual(plain(hard.clear), { m_dust: 4, m_teal: 3 }); assert.equal(hard.mastery.m_core, 1);
  assert.deepEqual(plain(P.battleMaterials({ id: 'q_bloom' }, 'gentle')), { m_dust: 2, m_green: 1 });
  assert.equal(P.battleMaterials({ id: 'q_bridge' }, 'normal').m_gold, 2);
  assert.equal(P.battleMaterials({ id: 'chrome' }, 'hard').m_violet, 3);
});

test('Leisure materials reward newly reached grades and preserve old money claims across all difficulties', () => {
  const p = P.migrate({ minigames: { records: { lantern: { gentle: { best: 100, paid: 70, plays: 10, clears: 10 } } } } });
  let out = M.record(p, 'lantern', 'gentle', 20);
  assert.equal(out.gold, 0); assert.deepEqual(plain(out.materials), { m_dust: 2, m_teal: 1, m_gold: 1 });
  assert.deepEqual(plain(M.record(p, 'lantern', 'gentle', 20).materials), {});
  out = M.record(p, 'lantern', 'gentle', 100); assert.deepEqual(plain(out.materials), { m_dust: 6, m_teal: 3, m_gold: 3, m_core: 1 });
  assert.equal(out.record.materialGrades, 4); assert.deepEqual(plain(M.record(p, 'lantern', 'gentle', 88).materials), {});
  out = M.record(p, 'echo', 'hard', 100); assert.deepEqual(plain(out.materials), { m_dust: 16, m_green: 8, m_violet: 8, m_core: 1 });
  assert.equal(p.minigames.records.lantern.gentle.paid, 70);
});

test('Material awards cap inventory and return only the actual added quantities', () => {
  const p = P.migrate({ materials: { m_dust: 998, m_teal: 999, m_core: -3, invalid: 50 } });
  assert.deepEqual(plain(P.awardMaterials(p, { m_dust: 5, m_teal: 2, m_core: 1, invalid: 5 })), { m_dust: 1, m_core: 1 });
  assert.equal(p.materials.m_dust, 999); assert.equal(p.materials.invalid, undefined);
});

test('Migration bounds upgrades and ingredients, merges legacy claims, and remains idempotent', () => {
  const p = P.migrate({ aria: { skills: ['gran_wave'], skillLevels: { gran_wave: 99, ivy_bind: 3, unknown: 2 } }, materials: { m_dust: 5000, m_teal: '8', m_green: -1, m_gold: Infinity }, stages: { cove: { difficulties: { hard: { materialMissions: [true, false], materialMasteryClaimed: false }, expert: { materialMissions: [false, true], materialMasteryClaimed: true } } } }, minigames: { records: { echo: { normal: { materialGrades: 99 } } } } });
  assert.deepEqual(plain(p.aria.skillLevels), { gran_wave: 3 }); assert.equal(p.materials.m_dust, 999); assert.equal(p.materials.m_teal, 8); assert.equal(p.materials.m_green, 0); assert.equal(p.materials.m_gold, 0);
  assert.deepEqual(plain(p.stages.cove.difficulties.hard.materialMissions), [true, true]); assert(p.stages.cove.difficulties.hard.materialMasteryClaimed);
  assert.equal(p.minigames.records.echo.normal.materialGrades, 4);
  const saved = JSON.stringify(p); P.migrate(p); assert.equal(JSON.stringify(p), saved);
});
