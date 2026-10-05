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
  assert.equal(expert.difficulty, 'hard'); assert.equal(expert.enemyBoost.hp, hard.enemyBoost.hp); assert.equal(JSON.stringify(B.ivy), original);
  assert.deepEqual(Object.keys(P.difficulties), ['gentle', 'normal', 'hard']);
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
  assert.equal(P.skills.length, 24);
  for (const spirit of Object.keys(P.spirits)) {
    for (const route of Object.keys(P.routes)) assert.deepEqual(plain(P.skills.filter(s => s.spirit === spirit && s.route === route).map(s => s.at).sort((a,b)=>a-b)), [8, 20, 40]);
  }
  assert.deepEqual([0, 7, 8, 19, 20, 39, 40, 69, 70, 200].map(P.rank), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('Malformed party fields are repaired without creating unavailable skills, items or rewards', () => {
  const party = P.migrate({ aria: { lv: -4, exp: 'broken', skills: ['ivy_bind', 'invented', 'ivy_bind'] }, spirits: { gran: { lv: Infinity, exp: 200, bond: Infinity, uses: -5 }, evil: {} }, gold: 'bad', owned: 'u_knot', equip: { charm: 'u_knot' }, items: { i_tea: 20, i_water: -4, evil: 99 }, stages: { cove: null, ivy: { cleared: true, best: 'unknown', missions: 'bad', difficulties: { expert: { cleared: true, clears: Infinity }, evil: {} } } }, stageDifficulty: ['expert'] });
  assert.deepEqual(plain(party.aria), { lv: 1, exp: 0, skills: ['ivy_bind'], skillLevels: {} });
  assert.equal(party.gold, 0); assert.deepEqual(plain(party.owned), []);
  assert.equal(party.equip.charm, null); assert.deepEqual(plain(party.items), { i_tea: 9, i_water: 0 });
  assert.deepEqual(Object.keys(party.spirits), ['gran']); assert.equal(party.spirits.gran.lv, 1); assert.equal(party.spirits.gran.bond, 0);
  assert.equal(party.stages.cove, undefined); assert.equal(party.stages.ivy.best, null); assert.equal(party.stages.ivy.difficulties.hard.clears, 1);
  assert.deepEqual(plain(party.stageDifficulty), {});
  const once = JSON.stringify(party); P.migrate(party); assert.equal(JSON.stringify(party), once);
});

test('Enchant and summon practice unlock disjoint sets and never copies the other route or spirit',()=>{
  const p=P.migrate({aria:{lv:1,exp:0},spirits:{gran:{bond:0},ivy:{bond:0}}});
  P.practice(p,'gran','enchant',7);assert.equal(P.learned(p).length,0);
  const first=P.practice(p,'gran','enchant',1);assert.deepEqual(plain(first.map(s=>s.id)),['gran_wave']);
  assert.equal(P.training(p,'gran','summon'),0);assert.equal(P.training(p,'ivy','enchant'),0);
  P.practice(p,'gran','enchant',32);assert.equal(P.learned(p,'gran','enchant').length,3);assert.equal(P.learned(p,'gran','summon').length,0);
  P.practice(p,'gran','summon',8);assert.deepEqual(plain(P.learned(p,'gran','summon').map(s=>s.id)),['gran_spray']);
  P.practice(p,'gran','summon',32);assert.equal(P.learned(p,'gran').length,6);assert.equal(P.learned(p,'ivy').length,0);
  assert.equal(P.practice(p,'gran','summon',100).length,0);assert.equal(new Set(p.aria.skills).size,p.aria.skills.length);
});

test('Legacy skills survive while new paths start at zero and common bond cannot unlock more skills',()=>{
  const p=P.migrate({aria:{lv:8,exp:0},spirits:{gran:{bond:40}}});
  assert.equal(P.learned(p,'gran').length,3);assert.deepEqual(plain(p.spirits.gran.training),{enchant:0,summon:0});
  p.spirits.gran.bond=999;P.migrate(p);assert.equal(P.learned(p,'gran').length,3);
  P.practice(p,'gran','summon',8);assert(p.aria.skills.includes('gran_spray'));assert(!p.aria.skills.includes('gran_current'));
  const saved=JSON.stringify(p);P.migrate(p);assert.equal(JSON.stringify(p),saved);
});

test('Old expert selection and records merge into hard without losing clears, missions, inventory or skills',()=>{
  const p=P.migrate({aria:{lv:4,exp:0,skills:['gran_wave']},spirits:{gran:{bond:0,training:{enchant:8,summon:0}}},owned:['u_knot'],stageDifficulty:{cove:'expert'},stages:{cove:{cleared:true,best:'S',clears:7,difficulties:{hard:{cleared:true,best:'A',clears:2,missions:[true,false],sRewardClaimed:true},expert:{cleared:true,best:'S',clears:3,missions:[false,true]}}}}});
  assert.equal(p.stageDifficulty.cove,'hard');assert.equal(p.stages.cove.difficulties.expert,undefined);
  const h=p.stages.cove.difficulties.hard;assert.equal(h.clears,5);assert.equal(h.best,'S');assert(h.sRewardClaimed);assert.deepEqual(plain(h.missions),[true,true]);assert.equal(p.stages.cove.clears,7);assert(p.owned.includes('u_knot'));assert(p.aria.skills.includes('gran_wave'));
  const saved=JSON.stringify(p);P.migrate(p);assert.equal(JSON.stringify(p),saved);
});

test('S rewards distinguish items, ordinary equipment, and hard-only unique gear for every real stage and quest',()=>{
  for(const conf of [...Object.values(B),...Object.values(Q)]){
    const easy=P.rewards(conf,'gentle'),normal=P.rewards(conf,'normal'),hard=P.rewards(conf,'hard');
    assert(Object.keys(easy.sItems).length);assert.equal(easy.sEquipment,null);assert(normal.sEquipment&&!normal.sEquipment.startsWith('u_'));assert.equal(hard.sEquipment,conf.unique);assert(hard.unique);
    assert(Object.keys(easy.firstItems).length&&Object.keys(normal.firstItems).length&&Object.keys(hard.firstItems).length);
  }
  assert.equal(new Set(Object.values(Q).map(q=>q.unique)).size,12);
  assert(Object.values(Q).every(q=>q.unique.startsWith('u_quest_')));
});

test('Minigame migration bounds rewards and preserves only usable partial sessions', () => {
  const party = P.migrate({ aria: { lv: 500, exp: 15 }, spirits: {}, minigames: { records: { lantern: { gentle: { plays: 4, clears: 3, best: 1000, paid: 10000, bestMoves: 9 } }, echo: { hard: { best: Infinity, paid: -1 } } }, preferred: { lantern: 'hard', echo: 'expert' }, active: { id: 'echo', difficulty: 'gentle', sequence: [0, 1, 2, 3, 0], round: 1, input: [0, 1], mistakes: 2, aids: 1 } } });
  assert.equal(party.aria.lv, 99); assert.equal(party.minigames.records.lantern.gentle.paid, 70);
  assert.equal(party.minigames.records.lantern.gentle.best, 100); assert.equal(party.minigames.records.echo.hard.best, 0);
  assert.equal(party.minigames.preferred.lantern, 'hard'); assert.equal(party.minigames.preferred.echo, 'gentle');
  assert.deepEqual(plain(party.minigames.active.input), [0, 1]);
  party.minigames.active.sequence = [99]; P.migrate(party); assert.equal(party.minigames.active, null);
  assert.deepEqual(plain(P.migrate(null).aria), { lv: 1, exp: 0, skills: [], skillLevels: {} });
});


test('Companion visibility follows story joins and held colors instead of unearned growth records',()=>{
  for(const [chapters,expected] of [[['act1'],[]],[['act2'],['gran']],[['act3'],['gran']],[['act4'],['gran','ivy']],[['act5'],['gran','ivy','spinel']],[['finale'],['gran','ivy','spinel','king']],[['done'],['gran','ivy','spinel','king']]])assert.deepEqual(plain(P.companions(chapters)),expected);
  assert.deepEqual(plain(P.companions(['act1'],['teal'])),['gran']);assert.deepEqual(plain(P.companions(['act3'],['green'])),['gran','ivy']);assert.deepEqual(plain(P.companions(null,null)),[]);
  assert.equal(P.materialDescription('m_green',['gran']),'これから覚える技を強化する素材');assert.match(P.materialDescription('m_green',['gran','ivy']),/アイビー/);
});
