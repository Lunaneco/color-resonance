const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const storage = new Map();
const c = vm.createContext({ document: { addEventListener() {} }, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) } });
for (const id of ['play-core', 'progression', 'minigames', 'save']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + id + '.js'), 'utf8'), c);
vm.runInContext('globalThis.C=PlayCore; globalThis.P=Progression; globalThis.M=Minigames; globalThis.S=SaveData;', c);
const { C, P, M, S } = c, copy = v => JSON.parse(JSON.stringify(v));
const difficulties = ['gentle', 'normal', 'hard'];

test('Every generated sea offers a safe adjacent route from every lane, across 600 voyages', () => {
  for (const d of difficulties) for (let seed = 0; seed < 200; seed++) {
    const s = C.createVoyage(d, seed);
    for (const row of s.map) for (let lane = 0; lane < 3; lane++) assert(row.some((tile, i) => tile !== 'reef' && Math.abs(i - lane) <= 1));
    let outcome;
    while (s.step < C.voyageRules[d].length) {
      if (s.camp) C.voyageCamp(s, 'treasure');
      const lane = s.map[s.step].findIndex((tile, i) => tile !== 'reef' && Math.abs(i - s.lane) <= 1);
      outcome = C.voyageTurn(s, lane); assert(outcome.valid); assert.equal(s.hp, C.voyageRules[d].hp);
    }
    assert(outcome.won); assert.equal(s.hits, 0);
  }
});
test('Voyage offers real risk and reward: dash doubles treasure and damage; guard spends wind to prevent a hit', () => {
  const s = C.createVoyage('hard', 1); s.map[0] = ['star', 'star', 'reef']; s.map[1] = ['reef', 'star', 'water'];
  const risky = copy(s), safe = copy(s);
  const out = C.voyageTurn(risky, 0, 'dash'); assert.equal(out.gain, 28); assert.equal(risky.hp, 1); assert.equal(risky.hits, 1); assert.equal(risky.charge, 0);
  C.voyageTurn(safe, 1, 'dash'); assert.equal(safe.hp, 3); assert.equal(safe.points, 60); assert.equal(safe.bestCombo, 2);
  const protectedShip = copy(s); C.voyageTurn(protectedShip, 2, 'guard'); assert.equal(protectedShip.hp, 3); assert.equal(protectedShip.charge, 1); assert.equal(protectedShip.hits, 0);
  const snap = JSON.stringify(protectedShip); assert.equal(C.voyageTurn(protectedShip, 0).valid, false); assert.equal(JSON.stringify(protectedShip), snap);
});
test('Dash stops at camp, forces one meaningful choice, and never sails through an unresolved camp', () => {
  const s = C.createVoyage('gentle', 2); s.step = 3; s.map[3][1] = 'star'; s.hp = 1;
  C.voyageTurn(s, 1, 'dash'); assert.equal(s.step, 4); assert(s.camp);
  const snap = JSON.stringify(s); assert.equal(C.voyageTurn(s, 1).valid, false); assert.equal(JSON.stringify(s), snap);
  assert(C.voyageCamp(s, 'repair')); assert.equal(s.hp, 3); assert.equal(C.voyageCamp(s, 'treasure'), false);
  s.camp = true; C.voyageCamp(s, 'wind'); assert.equal(s.charge, 2); s.camp = true; C.voyageCamp(s, 'treasure'); assert.equal(s.points, 56);
});
test('All generated crystal boards start stable and playable; cascades stay bounded, stable and resumable', () => {
  for (const d of difficulties) for (let seed = 0; seed < 200; seed++) {
    const s = C.createCrystal(d, seed); assert.equal(C.groups(s.board).length, 0); assert(C.crystalMoves(s.board).length);
    for (let turn = 0; turn < 6 && s.movesLeft && s.power < C.crystalRules[d].target; turn++) {
      const nova = s.board.findIndex(n => n >= 4), move = C.crystalMoves(s.board)[0];
      const out = C.crystalTurn(s, nova >= 0 ? { type: 'burst', index: nova } : { type: 'swap', a: move.a, b: move.b });
      assert(out.valid); assert(out.chain <= 20); assert(out.gain > 0); assert.equal(C.groups(s.board).length, 0); assert.equal(s.board.length, 25);
      assert(s.board.every(n => Number.isInteger(n) && n >= 0 && n <= 7));
      if (!out.won && !out.lost) assert(C.restore(s));
    }
  }
});
test('Invalid crystal swaps do not spend turns, power, or RNG; diagonal swaps cannot bypass the rule', () => {
  const s = C.createCrystal('hard', 45), snap = JSON.stringify(s);
  assert.equal(C.crystalTurn(s, { type: 'swap', a: 0, b: 6 }).valid, false); assert.equal(JSON.stringify(s), snap);
  const legal = new Set(C.crystalMoves(s.board).map(m => `${m.a}:${m.b}`));
  for (let a = 0; a < 25; a++) for (const b of [a + 1, a + 5]) {
    if (b >= 25 || b === a + 1 && Math.floor(a / 5) !== Math.floor(b / 5) || legal.has(`${a}:${b}`)) continue;
    assert.equal(C.crystalTurn(s, { type: 'swap', a, b }).valid, false); assert.equal(JSON.stringify(s), snap); return;
  }
  assert.fail('fixture needs an invalid adjacent swap');
});
test('A four-match creates a star; burst chains with nearby stars; fever doubles the exact same cascade', () => {
  let found;
  for (let seed = 0; seed < 1000 && !found; seed++) {
    const s = C.createCrystal('hard', seed), move = C.crystalMoves(s.board).find(m => { const b=s.board.slice(); [b[m.a],b[m.b]]=[b[m.b],b[m.a]]; return C.groups(b).some(r=>r.length>=4); });
    if (move) found = { s, move };
  }
  assert(found); const normal=copy(found.s),fever=copy(found.s);fever.charge=12;
  const action={type:'swap',a:found.move.a,b:found.move.b},a=C.crystalTurn(normal,action),b=C.crystalTurn(fever,action);
  assert.equal(normal.novaMade,1); assert.equal(b.gain,a.gain*2); assert.deepEqual(copy(normal.board),copy(fever.board));assert(b.fever);
  const s=C.createCrystal('hard',73);s.board[0]=4;s.board[1]=5;s.board[6]=6;
  const burst=C.crystalTurn(s,{type:'burst',index:0});assert(burst.bursts>=3);assert.equal(s.movesLeft,13);assert(burst.count>=9);
});
test('Rainbow is an optional free turn once per attempt, cannot be repeated through restore, and hints are pure', () => {
  const s=C.createCrystal('hard',4),before=s.movesLeft;C.crystalMoves(s.board);assert.equal(s.movesLeft,before);
  assert(C.crystalTurn(s,{type:'rainbow',index:12}).valid);assert.equal(s.movesLeft,before);assert(s.boostUsed);
  const restored=C.restore(s);assert(restored);const snap=JSON.stringify(restored);
  assert.equal(C.crystalTurn(restored,{type:'rainbow',index:0}).valid,false);assert.equal(JSON.stringify(restored),snap);
});
test('Resuming and portable imports reproduce the same next cascade and preserve voyage choices and rare claims', () => {
  for(const id of ['voyage','crystal']){
    const active=id==='voyage'?C.createVoyage('hard',71):C.createCrystal('hard',71);
    if(id==='voyage'){active.step=6;active.camp=true;}
    const p=P.migrate({aria:{lv:1,exp:0},minigames:{active,records:{[id]:{hard:{clears:1,best:42,hardCoreClaimed:2,paid:40,materialGrades:1}}}}});
    const imported=S.importText(JSON.stringify({format:'color-resonance',version:1,data:{cr_party:JSON.stringify(p)}}));assert(imported.ok,imported.message);
    const again=JSON.parse(storage.get('cr_party'));assert.deepEqual(copy(again.minigames.active),copy(active));assert.equal(again.minigames.records[id].hard.hardCoreClaimed,2);
    const snap=JSON.stringify(again);P.migrate(again);assert.equal(JSON.stringify(again),snap);
    if(id==='crystal'){const a=copy(active),b=again.minigames.active,move=C.crystalMoves(a.board)[0],action={type:'swap',a:move.a,b:move.b};assert.deepEqual(copy(C.crystalTurn(a,action)),copy(C.crystalTurn(b,action)));assert.deepEqual(copy(a),copy(b));}
    else{assert(C.voyageCamp(again.minigames.active,'wind'));assert.equal(again.minigames.active.charge,4);}
  }
});
test('Malformed, finished, or defeated adventure saves are discarded while existing achievements remain intact', () => {
  for(const a of [{...C.createVoyage('hard',1),hp:0},{...C.createVoyage('hard',1),map:[['unknown']]},{...C.createVoyage('hard',1),step:18},{...C.createCrystal('hard',1),movesLeft:0},{...C.createCrystal('hard',1),rng:Infinity},{...C.createCrystal('hard',1),power:210},{...C.createCrystal('hard',1),board:Array(25).fill(0)}]){
    const p=P.migrate({minigames:{active:a,records:{echo:{hard:{clears:3,best:88,hardCoreClaimed:2}}}}});assert.equal(p.minigames.active,null);assert.equal(p.minigames.records.echo.hard.clears,3);assert.equal(p.minigames.records.echo.hard.hardCoreClaimed,2);
  }
});
test('Each minigame guarantees two rare cores on its first hard clear at any grade, with separate first-S awards', () => {
  for(const id of Object.keys(M.games)){
    const p=P.migrate({});let out=M.record(p,id,'hard',10);assert.deepEqual(copy(out.hardMaterials),{m_core:2});assert.equal(out.materials.m_core,2);assert.equal(out.grade,'C');
    out=M.record(p,id,'hard',10);assert.deepEqual(copy(out.materials),{});assert.deepEqual(copy(out.hardMaterials),{});
    out=M.record(p,id,'hard',100);assert.equal(out.materials.m_core,1);assert.equal(p.materials.m_core,3);assert.deepEqual(copy(M.record(p,id,'hard',100).materials),{});
    M.record(p,id,'normal',10);M.record(p,id,'gentle',10);assert.equal(p.materials.m_core,3);
    P.migrate(p);assert.deepEqual(copy(M.record(p,id,'hard',100).hardMaterials),{});
  }
});
test('Legacy hard clears receive the new rare bonus on their next actual clear and full bags retain unpaid cores', () => {
  const p=P.migrate({minigames:{records:{lantern:{hard:{clears:9,best:100,paid:140,materialGrades:4}}}},materials:{m_core:998}});
  assert.equal(p.minigames.records.lantern.hard.hardCoreClaimed,0);
  let out=M.record(p,'lantern','hard',0);assert.equal(out.gold,0);assert.equal(out.hardMaterials.m_core,1);assert.equal(out.record.hardCoreClaimed,1);
  out=M.record(p,'lantern','hard',100);assert.deepEqual(copy(out.hardMaterials),{});assert.equal(out.record.hardCoreClaimed,1);
  p.materials.m_core=996;P.migrate(p);out=M.record(p,'lantern','hard',0);assert.equal(out.hardMaterials.m_core,1);assert.equal(p.materials.m_core,997);assert.equal(out.record.hardCoreClaimed,2);
  assert.deepEqual(copy(M.record(p,'lantern','hard',0).hardMaterials),{});
});
