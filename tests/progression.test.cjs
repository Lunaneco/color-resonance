const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ localStorage: { getItem: () => 'hard' } });
for (const name of ['progression', 'story', 'quests']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + name + '.js'), 'utf8'), context);
vm.runInContext('globalThis.P = Progression; globalThis.Q = SIDE_QUESTS; globalThis.B = BOARDS;', context);
const { P, Q, B } = context;
const plain = value => JSON.parse(JSON.stringify(value));

test('Old saves preserve inventory and clears; migration restores learned skills and is idempotent', () => {
  const party = { aria: { lv: 8, exp: 25 }, spirits: { gran: { lv: 7, exp: 42 }, ivy: { lv: 6, exp: 0, bond: 40 } }, stages: { cove: { cleared: true, best: 'S', missions: [true, false], clears: 3 } }, gold: 123, items: { i_tea: 2 }, owned: ['u_knot'] };
  P.migrate(party);
  assert.equal(party.gold, 123); assert.equal(party.spirits.gran.bond, 0);
  assert.equal(party.stages.cove.difficulties.normal.clears, 3);
  assert.deepEqual(party.stages.cove.difficulties.normal.missions, [true, false]);
  assert.equal(P.learned(party, 'ivy').length, 3); assert.equal(P.learned(party, 'gran').length, 0);
  const saved = JSON.stringify(party); P.migrate(party); assert.equal(JSON.stringify(party), saved);
});

test('Difficulty changes enemy strength and recommendation without raising the story level floor', () => {
  const original = JSON.stringify(B.ivy);
  const normal = P.prepare(B.ivy, 'normal'), hard = P.prepare(B.ivy, 'hard'), expert = P.prepare(B.ivy, 'expert');
  assert.equal(hard.recLv, normal.recLv); assert.equal(hard.recommendedLv, normal.recommendedLv + 3);
  assert.equal(hard.enemies[0].lv, normal.enemies[0].lv + 2);
  assert(expert.enemyBoost.hp > hard.enemyBoost.hp); assert.equal(JSON.stringify(B.ivy), original);
  assert.equal(P.prepare(B.cove, 'gentle').recommendedLv, 1);
  assert.equal(P.normalize('invalid'), 'normal');
  assert.equal(P.selected({ stageDifficulty: { ivy: 'gentle' } }, 'ivy'), 'gentle');
  assert.equal(P.selected({ stageDifficulty: {} }, 'cove'), 'hard');
});

test('Twelve quests have chapter gates, distinct objectives, repeatable difficulty rewards and valid terrain', () => {
  assert.equal(Object.keys(Q).length, 12);
  const ids = new Set();
  for (const q of Object.values(Q)) {
    assert(!ids.has(q.id)); ids.add(q.id);
    assert(q.need && q.town && q.giver && q.desc && q.reward > 0);
    assert(q.map.low.length && q.enemies.length && q.missions.length === 3);
    assert(Object.keys(q.firstItems).length);
    for (const difficulty of Object.keys(P.difficulties)) assert(P.prepare(q, difficulty).recommendedLv >= 1);
  }
  assert.equal(P.skills.length, 12);
  for (const spirit of Object.keys(P.spirits)) {
    assert.deepEqual(plain(P.skills.filter(s => s.spirit === spirit).map(s => s.at)), [8, 20, 40]);
  }
  assert.deepEqual([0, 7, 8, 19, 20, 39, 40, 69, 70, 200].map(P.rank), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
