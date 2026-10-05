// 休憩所の冒険。乱数も途中記録に持ち、閉じて開いても海・結晶は変わらない。
const PlayCore = (() => {
  const voyageRules = { gentle: { length: 12, hp: 4, target: 170 }, normal: { length: 15, hp: 3, target: 230 }, hard: { length: 18, hp: 3, target: 290 } };
  const crystalRules = { gentle: { moves: 18, target: 55 }, normal: { moves: 16, target: 110 }, hard: { moves: 14, target: 210 } };
  const tiles = { star: { icon: '✦', name: '星の宝', detail: '連続で取るほど高得点' }, charge: { icon: 'ϟ', name: '風の結晶', detail: '風力+1 / 得点+4' }, heart: { icon: '♡', name: '癒しの雫', detail: '船体+1 / 得点+4' }, reef: { icon: '▲', name: '暗い岩礁', detail: '船体−1 / 疾走中は−2' }, water: { icon: '≈', name: '静かな海', detail: '無傷で進める / 連続取得は止まる' } };
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const seed = () => Math.floor(Math.random() * 4294967295) + 1;
  function random(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function createVoyage(difficulty, rng = seed()) {
    const rule = voyageRules[difficulty], s = { id: 'voyage', difficulty, rng: rng >>> 0, map: [], step: 0, lane: 1, hp: rule.hp, charge: 2, points: 0, combo: 0, bestCombo: 0, hits: 0, stars: 0, camp: false };
    for (let i = 0; i < rule.length; i++) {
      const row = Array.from({ length: 3 }, () => { const r = random(s); return r < .38 ? 'star' : r < .56 ? 'charge' : r < .68 ? 'heart' : 'water'; });
      // 岩礁が両端にあっても中央へ逃げられる。すべての現在地から無傷の道を選べる。
      const hazard = Math.floor(random(s) * 3); if (i > 0) row[hazard] = 'reef';
      if (difficulty === 'hard' && hazard !== 1 && random(s) < .35) row[2 - hazard] = 'reef';
      const open = [0, 1, 2].filter(l => row[l] !== 'reef');
      if (!row.includes('star')) row[open[Math.floor(random(s) * open.length)]] = 'star';
      s.map.push(row);
    }
    s.map[0] = ['star', 'charge', 'star'];
    return s;
  }
  function voyageTurn(s, lane, mode = 'sail') {
    const rule = voyageRules[s.difficulty];
    if (s.camp || s.hp <= 0 || s.step >= rule.length || !integer(lane, 0, 2) || Math.abs(lane - s.lane) > 1 || !['sail', 'guard', 'dash'].includes(mode)) return { valid: false };
    const cost = mode === 'dash' ? 2 : mode === 'guard' ? 1 : 0;
    if (s.charge < cost) return { valid: false };
    s.charge -= cost; s.lane = lane;
    const log = [], events = []; let gain = 0;
    for (let n = 0; n < (mode === 'dash' ? 2 : 1) && s.step < rule.length; n++) {
      const tile = s.map[s.step++][lane], before = s.points, hp = s.hp, charge = s.charge;
      if (tile === 'reef') {
        s.combo = 0;
        if (mode === 'guard') log.push('護りが岩礁を防いだ');
        else { const damage = mode === 'dash' ? 2 : 1; s.hp = Math.max(0, s.hp - damage); s.hits++; log.push(`岩礁！ 船体−${damage}`); }
      } else if (tile === 'star') {
        s.combo++; s.stars++; s.bestCombo = Math.max(s.bestCombo, s.combo);
        const points = (12 + Math.min(8, s.combo) * 2) * (mode === 'dash' ? 2 : 1); s.points += points;
        log.push(`星の宝 +${points}${s.combo > 1 ? ` / ${s.combo}連続` : ''}`);
      } else {
        if (tile === 'water') s.combo = 0;
        if (tile === 'charge') { s.charge = Math.min(4, s.charge + 1); s.points += 4; }
        if (tile === 'heart') { s.hp = Math.min(rule.hp, s.hp + 1); s.points += 4; }
        log.push(tiles[tile].name);
      }
      gain += s.points - before;
      events.push({ tile, lane, step: s.step, gain: s.points - before, hp: s.hp - hp, charge: s.charge - charge, combo: s.combo, guarded: tile === 'reef' && mode === 'guard' });
      if (!s.hp || s.step % (rule.length / 3) === 0) break;
    }
    s.camp = s.hp > 0 && s.step < rule.length && s.step % (rule.length / 3) === 0;
    return { valid: true, gain, events, log: log.join(' → '), won: s.step === rule.length && s.hp > 0, lost: s.hp === 0 };
  }
  function voyageCamp(s, choice) {
    if (!s.camp || !['repair', 'wind', 'treasure'].includes(choice)) return false;
    if (choice === 'repair') s.hp = Math.min(voyageRules[s.difficulty].hp, s.hp + 2);
    if (choice === 'wind') s.charge = Math.min(4, s.charge + 2);
    if (choice === 'treasure') s.points += 28;
    s.camp = false; return true;
  }
  function voyageScore(s) { return Math.max(0, Math.min(100, Math.round(s.points / voyageRules[s.difficulty].target * 100) - s.hits * 3)); }
  function groups(board) {
    const runs = [];
    for (let axis = 0; axis < 2; axis++) for (let line = 0; line < 5; line++) {
      let run = [];
      for (let n = 0; n <= 5; n++) {
        const index = axis ? n * 5 + line : line * 5 + n;
        if (n < 5 && (!run.length || board[index] % 4 === board[run[0]] % 4)) run.push(index);
        else { if (run.length >= 3) runs.push(run); run = n < 5 ? [index] : []; }
      }
    }
    return runs;
  }
  const adjacent = (a, b) => Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) + Math.abs(a % 5 - b % 5) === 1;
  function crystalMoves(board) {
    const out = [];
    for (let a = 0; a < 25; a++) for (const b of [a + 1, a + 5]) {
      if (b >= 25 || !adjacent(a, b)) continue;
      const copy = board.slice(); [copy[a], copy[b]] = [copy[b], copy[a]];
      const runs = groups(copy); if (runs.length) out.push({ a, b, count: new Set(runs.flat()).size });
    }
    return out.sort((a, b) => b.count - a.count);
  }
  function freshBoard(s) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const board = [];
      for (let i = 0; i < 25; i++) {
        const choices = [0, 1, 2, 3].filter(c => !(i % 5 >= 2 && board[i - 1] === c && board[i - 2] === c) && !(i >= 10 && board[i - 5] === c && board[i - 10] === c));
        board.push(choices[Math.floor(random(s) * choices.length)]);
      }
      if (crystalMoves(board).length) return board;
    }
    // bounded fallback: stable and has a 3-crystal move at 1↔6.
    return [0,1,0,2,3, 2,0,3,1,2, 3,2,1,0,3, 1,3,2,3,0, 0,1,0,2,1];
  }
  function createCrystal(difficulty, rng = seed()) {
    const s = { id: 'crystal', difficulty, rng: rng >>> 0, board: [], movesLeft: crystalRules[difficulty].moves, power: 0, charge: 0, maxChain: 0, novaMade: 0, bursts: 0, boostUsed: false, turns: 0 };
    s.board = freshBoard(s); return s;
  }
  function blast(index) { return Array.from({ length: 25 }, (_, i) => i).filter(i => Math.abs(Math.floor(i / 5) - Math.floor(index / 5)) <= 1 && Math.abs(i % 5 - index % 5) <= 1); }
  function settle(s, first, keep = -1) {
    const fever = s.charge >= 12; if (fever) s.charge = 0;
    let clear = new Set(first), chain = 0, gain = 0, count = 0, bursts = 0;
    const frames = [];
    while (clear.size && chain < 20) {
      chain++;
      // A matched star crystal explodes; nearby stars join the same blast, once each.
      const exploded = new Set();
      for (const i of clear) if (s.board[i] >= 4 && i !== keep && !exploded.has(i)) { exploded.add(i); blasts(i); }
      function blasts(i) { bursts++; for (const j of blast(i)) clear.add(j); }
      clear.delete(keep);
      const amount = clear.size; count += amount; gain += amount * chain * (fever ? 2 : 1);
      // Presentation receives a trace of this exact turn; it never rolls its own board.
      const frame = { before: s.board.slice(), clear: [...clear], nova: keep, exploded: [...exploded], gain: amount * chain * (fever ? 2 : 1), falls: [] };
      if (keep >= 0) s.board[keep] = s.board[keep] % 4 + 4;
      for (let col = 0; col < 5; col++) {
        const sources = Array.from({ length: 5 }, (_, row) => row * 5 + col).filter(i => !clear.has(i));
        const left = sources.map(i => s.board[i]), missing = 5 - left.length;
        while (left.length < 5) left.unshift(Math.floor(random(s) * 4));
        for (let row = 0; row < 5; row++) {
          const to = row * 5 + col;
          s.board[to] = left[row];
          frame.falls.push({ to, from: row < missing ? (row - missing) * 5 + col : sources[row - missing], value: left[row] });
        }
      }
      frame.after = s.board.slice(); frames.push(frame);
      keep = -1; clear = new Set(groups(s.board).flat());
    }
    // Extremely long cascades are bounded; no animation or random loop can block input.
    let shuffled = false;
    if (clear.size || !s.board.some(n => n >= 4) && !crystalMoves(s.board).length) { s.board = freshBoard(s); shuffled = true; }
    s.power += gain; s.charge = Math.min(12, s.charge + count); s.maxChain = Math.max(s.maxChain, chain); s.bursts += bursts;
    return { gain, chain, count, bursts, fever, shuffled, frames };
  }
  function crystalTurn(s, action) {
    if (s.movesLeft <= 0 || s.power >= crystalRules[s.difficulty].target) return { valid: false };
    let first, keep = -1, free = false;
    if (action.type === 'swap') {
      const { a, b } = action; if (!integer(a, 0, 24) || !integer(b, 0, 24) || !adjacent(a, b)) return { valid: false };
      [s.board[a], s.board[b]] = [s.board[b], s.board[a]];
      const runs = groups(s.board);
      if (!runs.length) { [s.board[a], s.board[b]] = [s.board[b], s.board[a]]; return { valid: false }; }
      first = runs.flat(); const long = runs.find(r => r.length >= 4);
      if (long) { keep = long.includes(b) ? b : long.includes(a) ? a : long[0]; s.novaMade++; }
    } else if (action.type === 'burst' && integer(action.index, 0, 24) && s.board[action.index] >= 4) first = [action.index];
    else if (action.type === 'rainbow' && !s.boostUsed && integer(action.index, 0, 24)) {
      first = Array.from({ length: 5 }, (_, col) => Math.floor(action.index / 5) * 5 + col); s.boostUsed = true; free = true;
    } else return { valid: false };
    if (!free) { s.movesLeft--; s.turns++; }
    const result = settle(s, first, keep);
    return { valid: true, ...result, won: s.power >= crystalRules[s.difficulty].target, lost: s.movesLeft === 0 && s.power < crystalRules[s.difficulty].target };
  }
  function crystalScore(s) { return Math.min(100, 50 + s.movesLeft * 2 + Math.min(5, s.maxChain) * 7 + Math.min(3, s.novaMade) * 3); }
  // Save imports receive strict game-specific checks, not trusted arbitrary session objects.
  function restore(a) {
    if (!a || !['gentle', 'normal', 'hard'].includes(a.difficulty)) return null;
    if (a.id === 'voyage') {
      const rule = voyageRules[a.difficulty];
      if (!Array.isArray(a.map) || a.map.length !== rule.length || !a.map.every(row => Array.isArray(row) && row.length === 3 && row.every(t => Object.hasOwn(tiles, t))) || !integer(a.rng, 0, 4294967295) || !integer(a.step, 0, rule.length - 1) || !integer(a.lane, 0, 2) || !integer(a.hp, 1, rule.hp) || !integer(a.charge, 0, 4) || !['points','combo','bestCombo','hits','stars'].every(k => integer(a[k], 0, 10000))) return null;
      const camp = a.camp === true && a.step > 0 && a.step % (rule.length / 3) === 0;
      return { id: a.id, difficulty: a.difficulty, rng: a.rng >>> 0, map: a.map.map(r => r.slice()), step: a.step, lane: a.lane, hp: a.hp, charge: a.charge, points: a.points, combo: a.combo, bestCombo: a.bestCombo, hits: a.hits, stars: a.stars, camp };
    }
    if (a.id === 'crystal') {
      const rule = crystalRules[a.difficulty];
      if (!Array.isArray(a.board) || a.board.length !== 25 || !a.board.every(n => integer(n, 0, 7)) || groups(a.board).length || !integer(a.rng, 0, 4294967295) || !integer(a.movesLeft, 1, rule.moves) || !integer(a.power, 0, rule.target - 1) || !integer(a.charge, 0, 12) || !['maxChain','novaMade','bursts','turns'].every(k => integer(a[k], 0, 10000)) || !a.board.some(n => n >= 4) && !crystalMoves(a.board).length) return null;
      return { id: a.id, difficulty: a.difficulty, rng: a.rng, board: a.board.slice(), movesLeft: a.movesLeft, power: a.power, charge: a.charge, maxChain: a.maxChain, novaMade: a.novaMade, bursts: a.bursts, boostUsed: a.boostUsed === true, turns: a.turns };
    }
    return null;
  }
  return { voyageRules, crystalRules, tiles, createVoyage, voyageTurn, voyageCamp, voyageScore, createCrystal, groups, crystalMoves, crystalTurn, crystalScore, restore };
})();
