// 町の休憩所。制限時間なしの色のパズルと、目でも耳でも遊べる記憶あそび。
const Minigames = (() => {
  const tiers = ['gentle', 'normal', 'hard'];
  const names = { gentle: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };
  const games = {
    lantern: { title: '灯台の色つなぎ', label: '色のパズル', need: 'act1', icon: '◈', hue: '#8be8ef',
      desc: '消えた灯りを、ひとつずつ結び直す。隣の灯りも変わる硝子盤で、港の灯台をともそう。',
      sizes: { gentle: [2, 3], normal: [3, 3], hard: [4, 4] }, story: '港に、帰る船の灯りがひとつ増えた。「待っている」という色は、雨の中でも消えない。' },
    echo: { title: '精霊のこだま', label: '色と音の記憶', need: 'act2', icon: '✧', hue: '#c2a6ff',
      desc: '潮、芽、金、虹。四つの響きを覚えて返すと、小さな夜空に星がひらく。音を消しても遊べます。',
      lengths: { gentle: 3, normal: 5, hard: 7 }, story: '時計ばかりが鳴っていた街に、違う音が帰ってきた。ひとりの旋律が、誰かの返事を待っている。' },
  };
  const pads = [{ name: '潮', symbol: '≈', color: '#8ae0ef' }, { name: '芽', symbol: '❧', color: '#a4e9b6' }, { name: '金', symbol: '◇', color: '#ffe099' }, { name: '虹', symbol: '✧', color: '#d1b3ff' }];
  const rewards = { gentle: [20, 35, 50, 70], normal: [30, 50, 75, 100], hard: [40, 70, 100, 140] };
  const grade = score => score >= 95 ? 'S' : score >= 80 ? 'A' : score >= 60 ? 'B' : 'C';
  const entitled = (difficulty, score) => rewards[difficulty]['CBAS'.indexOf(grade(score))];
  let session = null, pulseTimer = null, run = 0;
  const available = id => Engine.unlocked().includes(games[id].need);
  const load = () => Board.party;
  function write(party) { Board.saveParty(); if (typeof World !== 'undefined') World.refresh(); }
  function stopPulse() { run++; if (pulseTimer) clearTimeout(pulseTimer); pulseTimer = null; }
  const bits = n => { let count = 0; for (; n; n &= n - 1) count++; return count; };
  function crossMask(rows, cols, index) {
    const r = Math.floor(index / cols), c = index % cols;
    let mask = 0;
    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols) mask |= 1 << ((r + dr) * cols + c + dc);
    }
    return mask;
  }
  // Gaussian elimination in GF(2), then choose the fewest presses among free-variable solutions.
  // At most 16 lamps; every generated board is reachable because we scramble with legal presses.
  function solve(rows, cols, board) {
    const n = rows * cols, target = (1 << n) - 1;
    const matrix = Array.from({ length: n }, (_, i) => {
      let row = 0; for (let j = 0; j < n; j++) if (crossMask(rows, cols, j) & (1 << i)) row |= 1 << j;
      return row | (((board ^ target) >> i & 1) << n);
    });
    const pivots = []; let next = 0;
    for (let col = 0; col < n; col++) {
      const found = matrix.findIndex((row, i) => i >= next && (row & 1 << col));
      if (found < 0) continue;
      [matrix[next], matrix[found]] = [matrix[found], matrix[next]];
      for (let i = 0; i < n; i++) if (i !== next && (matrix[i] & 1 << col)) matrix[i] ^= matrix[next];
      pivots.push(col); next++;
    }
    if (matrix.slice(next).some(row => (row & target) === 0 && (row & 1 << n))) return null;
    const free = Array.from({ length: n }, (_, i) => i).filter(i => !pivots.includes(i));
    let best = null, bestCount = Infinity;
    for (let choice = 0; choice < 1 << free.length; choice++) {
      let answer = 0;
      free.forEach((column, i) => { if (choice & 1 << i) answer |= 1 << column; });
      for (let i = 0; i < pivots.length; i++) if (((matrix[i] >> n) & 1) ^ (bits(matrix[i] & answer & target) & 1)) answer |= 1 << pivots[i];
      const count = bits(answer);
      if (count < bestCount) { best = answer; bestCount = count; }
    }
    return best;
  }
  function createLantern(difficulty, random = Math.random) {
    const [rows, cols] = games.lantern.sizes[difficulty], n = rows * cols, full = (1 << n) - 1;
    let board = full;
    for (let i = 0; i < n; i++) if (random() < 0.5) board ^= crossMask(rows, cols, i);
    if (board === full) board ^= crossMask(rows, cols, Math.floor(random() * n) % n);
    return { id: 'lantern', difficulty, initial: board, board, moves: 0, hints: 0, history: [] };
  }
  function createEcho(difficulty, random = Math.random) {
    const count = games.echo.lengths[difficulty] + 2;
    return { id: 'echo', difficulty, sequence: Array.from({ length: count }, () => Math.min(3, Math.floor(random() * 4))), round: 0, mistakes: 0, aids: 0 };
  }
  function record(party, id, difficulty, score, moves = null) {
    if (!Object.hasOwn(games, id) || !tiers.includes(difficulty) || !Number.isFinite(score)) throw new Error('Invalid minigame result');
    score = Math.min(100, Math.max(0, Math.round(score)));
    const records = party.minigames.records[id];
    const r = records[difficulty] || (records[difficulty] = { plays: 0, clears: 0, best: 0, paid: 0, bestMoves: null });
    r.plays = Math.min(999999, r.plays + 1); r.clears = Math.min(999999, r.clears + 1);
    const improved = score > r.best || r.clears === 1;
    r.best = Math.max(r.best, score);
    if (Number.isInteger(moves) && moves >= 0) r.bestMoves = r.bestMoves == null ? moves : Math.min(r.bestMoves, moves);
    const gold = Math.max(0, entitled(difficulty, r.best) - r.paid);
    r.paid += gold; party.gold = Math.min(9999999, party.gold + gold); party.minigames.active = null;
    const materials = Progression.leisureMaterials(party, id, difficulty, grade(score), r);
    return { gold, materials, improved, record: r, grade: grade(score) };
  }
  function persist() {
    if (!session || session.practice || session.completed) return;
    const party = load();
    const { practice, completed, phase, watch, message, hint, ...snapshot } = session;
    party.minigames.active = snapshot; write(party);
  }
  function shell(html) { return `<div class="mg-shell">${html}</div>`; }
  function open(town = 'aquamist') {
    stopPulse(); session = null;
    const party = load(), active = party.minigames.active;
    const total = Object.values(party.minigames.records).flatMap(r => Object.values(r)).reduce((n, r) => n + r.clears, 0);
    const allThree = id => tiers.every(tier => party.minigames.records[id][tier]?.clears);
    Panel.open('色と音の休憩所', shell(`
      <div class="mg-hero"><span class="mg-eyebrow">A LITTLE REST BETWEEN ADVENTURES</span><h3>急がず、色と遊ぼう。</h3><p>港の硝子盤と、街に帰ってきた響き。<br>時間制限はありません。途中で閉じても続きから遊べます。</p><span class="mg-total">完成した遊び <b>${total}</b> 回</span></div>
      ${active && available(active.id) ? `<button class="mg-resume" data-resume><span>途中から続ける</span><b>${games[active.id].title} / ${names[active.difficulty]}</b></button>` : ''}
      <div class="mg-catalog">${Object.entries(games).map(([id, game]) => {
        const unlocked = available(id), preferred = party.minigames.preferred[id];
        return `<article class="mg-card" style="--mg-color:${game.hue}" data-game="${id}"><div class="mg-card-top"><span class="mg-emblem" aria-hidden="true">${game.icon}</span><div><small>${game.label}</small><h4>${game.title}</h4></div>${allThree(id) ? '<span class="mg-seal">三つの灯り ✦</span>' : ''}</div><p>${game.desc}</p>
          <div class="mg-difficulties" role="group" aria-label="${game.title}の難易度">${tiers.map(tier => { const r = party.minigames.records[id][tier]; return `<button data-tier="${tier}" aria-pressed="${tier === preferred}" ${unlocked ? '' : 'disabled'}><b>${names[tier]}</b><small>${r?.clears ? `最高 ${grade(r.best)} / ${r.best}点` : '未完成'}</small></button>`; }).join('')}</div>
          <div class="mg-card-actions"><button class="mg-primary" data-start ${unlocked ? '' : 'disabled'}>新しく遊ぶ</button><button class="mg-secondary" data-practice ${unlocked ? '' : 'disabled'}>練習する</button></div>${!unlocked ? `<p class="mg-note">${id === 'lantern' ? '港へ旅立つと' : '第一幕を終えると'}遊べるようになります。</p>` : `<p class="mg-note">しずくと素材は評価C・B・A・Sごとに1回。${id === 'lantern' ? '潮の雫晶・金継ぎの欠片' : '若葉の結晶・虹彩の結晶'}と共鳴の砂、初Sで澄明の核。${names[preferred]}のしずく上限 ${rewards[preferred][3]}。</p>`}
          ${allThree(id) ? `<p class="mg-afterword">${game.story}</p>` : ''}</article>`;
      }).join('')}</div><p class="mg-footnote">練習は記録・報酬に含みません。新しく始めると、途中の記録は置き換わります。獲得した成績は残ります。</p>`), { onClose: () => { stopPulse(); session = null; } });
    const body = Panel.body();
    body.querySelector('[data-resume]')?.addEventListener('click', () => start(active.id, active.difficulty, false, active));
    body.querySelectorAll('[data-game]').forEach(card => {
      const id = card.dataset.game;
      card.querySelectorAll('[data-tier]').forEach(button => button.onclick = () => {
        const p = load(); p.minigames.preferred[id] = button.dataset.tier; write(p); open(town);
      });
      card.querySelector('[data-start]').onclick = () => start(id, load().minigames.preferred[id]);
      card.querySelector('[data-practice]').onclick = () => start(id, 'gentle', true);
    });
  }
  function start(id, difficulty = 'gentle', practice = false, saved = null) {
    if (!Object.hasOwn(games, id) || !available(id) || !tiers.includes(difficulty)) return;
    stopPulse();
    session = { ...(saved || (id === 'lantern' ? createLantern(difficulty) : createEcho(difficulty))), practice, completed: false };
    if (saved && id === 'lantern') {
      const [rows, cols] = games.lantern.sizes[difficulty];
      if (solve(rows, cols, session.initial) == null || solve(rows, cols, session.board) == null) session = { ...createLantern(difficulty), practice, completed: false };
    }
    if (id === 'echo') Object.assign(session, { input: session.input || [], phase: session.input?.length ? 'answer' : 'ready', watch: -1 });
    // A practice board uses a single legal press, making the rule visible without a reward.
    if (practice && id === 'lantern') session.board = session.initial = 63 ^ crossMask(2, 3, 1);
    if (practice && id === 'echo') session.sequence = [0, 1, 2, 3, 0];
    persist(); render();
  }
  function render() {
    if (!session) return;
    const s = session, game = games[s.id];
    const previous = Panel.body();
    const scroll = previous.querySelector(`.mg-play[data-id="${s.id}"]`) ? previous.scrollTop : 0;
    const focused = previous.contains(document.activeElement) ? document.activeElement : null;
    const attribute = focused && ['data-lamp', 'data-pad', 'data-listen', 'data-step', 'data-answer', 'data-back', 'data-hint', 'data-reset', 'data-undo'].find(name => focused.hasAttribute(name));
    const focusTarget = attribute ? `[${attribute}="${focused.getAttribute(attribute)}"]` : null;
    Panel.open(game.title, shell(`<div class="mg-play" data-id="${s.id}"><div class="mg-play-head"><span class="mg-eyebrow">${s.practice ? '練習 / 報酬なし' : names[s.difficulty]} ・ 時間制限なし</span><button class="mg-back" data-back>休憩所へ</button></div>${s.id === 'lantern' ? lanternHtml(s) : echoHtml(s)}<p class="mg-footnote">${s.practice ? '練習中。元の途中記録は残っています。' : '操作ごとに自動保存。×で閉じても休憩所から続きを再開できます。'}</p></div>`), { onClose: () => { persist(); stopPulse(); session = null; } });
    const body = Panel.body();
    body.scrollTop = scroll;
    body.querySelector('[data-back]').onclick = () => { persist(); open(); };
    if (s.id === 'lantern') bindLantern(body); else bindEcho(body);
    const target = focusTarget && body.querySelector(focusTarget);
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }
  function lanternHtml(s) {
    const [rows, cols] = games.lantern.sizes[s.difficulty], n = rows * cols;
    const lit = bits(s.board);
    return `<p class="mg-instruction"><b>すべての灯りを「点灯」に。</b>押した灯りと、その上下左右が切り替わります。もう一度押すと元に戻ります。</p>
      ${s.practice ? '<div class="mg-tip">まず上の真ん中を押してみよう。自分と、線でつながる隣の灯りが変わります。</div>' : ''}
      <div class="mg-meter"><span>灯り <b data-lit>${lit} / ${n}</b></span><span>手数 <b data-moves>${s.moves}</b></span><span>ヒント <b data-hints>${s.hints}</b></span></div>
      <div class="mg-lantern-wrap"><div class="mg-lantern" role="group" aria-label="灯台の硝子盤" style="--mg-columns:${cols}">${Array.from({ length: n }, (_, i) => lampHtml(s, i)).join('')}</div></div>
      <div class="mg-status" role="status" aria-live="polite">${s.message || '灯りを選んでみよう。何度でもやり直せます。'}</div>
      <div class="mg-toolbar"><button data-undo ${s.history.length ? '' : 'disabled'}>ひとつ戻す</button><button data-hint>ヒント</button><button data-reset>最初の盤面に戻す</button></div>
      <p class="mg-keynote">Tab / 矢印キーで選び、Enter / Spaceで切り替え。<br>点灯は「●」、消灯は「○」でも確認できます。ヒントと戻す操作は成績に含まれます。</p>`;
  }
  function lampHtml(s, i) {
    const on = !!(s.board & 1 << i), [rows, cols] = games.lantern.sizes[s.difficulty];
    return `<button class="mg-lamp ${on ? 'lit' : ''}${s.hint === i ? ' hinted' : ''}" data-lamp="${i}" aria-pressed="${on}" aria-label="${Math.floor(i / cols) + 1}行${i % cols + 1}列 ${on ? '点灯' : '消灯'}${s.hint === i ? ' ヒントの灯り' : ''}" style="--lamp-hue:${185 + i / (rows * cols) * 145}"><span aria-hidden="true">${on ? '●' : '○'}</span><small>${on ? '点灯' : '消灯'}</small></button>`;
  }
  function bindLantern(body) {
    const s = session, [rows, cols] = games.lantern.sizes[s.difficulty], full = (1 << rows * cols) - 1;
    body.querySelectorAll('[data-lamp]').forEach(button => {
      button.onclick = () => {
        const index = +button.dataset.lamp;
        s.board ^= crossMask(rows, cols, index); s.moves++; s.history.push(index); s.history = s.history.slice(-256); delete s.hint;
        s.message = `${Math.floor(index / cols) + 1}行${index % cols + 1}列と隣の灯りを切り替えました。`;
        Audio2.sfx.star(index); persist();
        if (s.board === full) finish(); else { render(); Panel.body().querySelector(`[data-lamp="${index}"]`).focus({ preventScroll: true }); }
      };
      button.onkeydown = event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        if (!Object.hasOwn(offsets, event.key)) return;
        event.preventDefault(); const index = Math.max(0, Math.min(rows * cols - 1, +button.dataset.lamp + offsets[event.key]));
        body.querySelector(`[data-lamp="${index}"]`).focus();
      };
    });
    body.querySelector('[data-undo]').onclick = () => {
      if (!s.history.length) return; s.board ^= crossMask(rows, cols, s.history.pop()); s.moves++; s.message = 'ひとつ前の灯りに戻しました。'; delete s.hint; persist(); render();
    };
    body.querySelector('[data-reset]').onclick = () => {
      s.board = s.initial; s.history = []; s.hints++; s.message = '同じ盤面からやり直せます。成績のため、使った手数は残ります。'; delete s.hint; persist(); render();
    };
    body.querySelector('[data-hint]').onclick = () => {
      const solution = solve(rows, cols, s.board);
      if (solution == null) { s.message = 'この途中記録は元の盤面に戻して遊び直せます。'; render(); return; }
      const index = Array.from({ length: rows * cols }, (_, i) => i).find(i => solution & 1 << i);
      if (index == null) { finish(); return; }
      s.hint = index; s.hints++; s.message = `次は${Math.floor(index / cols) + 1}行${index % cols + 1}列を押すと、完成へ近づきます。`; persist(); render();
      Panel.body().querySelector(`[data-lamp="${index}"]`).focus({ preventScroll: true });
    };
  }
  function echoHtml(s) {
    const length = games.echo.lengths[s.difficulty] + s.round;
    return `<p class="mg-instruction"><b>響いた順番を覚えて、返そう。</b>全3節。間違えても、その節から何度でも続けられます。</p>
      <div class="mg-meter"><span>節 <b>${s.round + 1} / 3</b></span><span>覚える音 <b>${length}</b></span><span>返した音 <b data-input>${s.input.length} / ${length}</b></span></div>
      ${s.practice ? '<div class="mg-tip">練習では「潮→芽→金」から始まります。お手本を見てから「順番を返す」を選ぼう。返す時は、次の響きに印がつきます。</div>' : ''}
      <div class="mg-echo" role="group" aria-label="四つの響き">${pads.map((pad, i) => `<button class="mg-pad${s.practice && s.phase === 'answer' && s.sequence[s.input.length] === i ? ' practice-target' : ''}" data-pad="${i}" style="--pad-color:${pad.color}" aria-label="${i + 1} ${pad.name}${s.practice && s.phase === 'answer' && s.sequence[s.input.length] === i ? ' 次の響き' : ''}" ${s.phase !== 'answer' ? 'disabled' : ''}><kbd>${i + 1}</kbd><span aria-hidden="true">${pad.symbol}</span><b>${pad.name}</b></button>`).join('')}</div>
      <div class="mg-echo-progress" aria-hidden="true">${Array.from({ length }, (_, i) => `<i class="${i < s.input.length ? 'done' : ''}"></i>`).join('')}</div>
      <div class="mg-status" role="status" aria-live="polite">${s.message || '「お手本を聴く」で、色と記号の順番を見てみよう。'}</div>
      <div class="mg-toolbar"><button data-listen>${s.phase === 'ready' ? 'お手本を聴く' : 'もう一度聴く'}</button><button data-step>一音ずつ見る</button><button data-answer ${s.phase === 'ready' ? 'disabled' : ''}>順番を返す</button></div>
      <p class="mg-keynote">タッチ / クリック、または数字キー1〜4。音・色・名前・記号が一緒に出ます。<br>聴き直しは成績に含まれます。一音ずつ見る速さで成績は変わりません。</p>`;
  }
  function echoFlash(index, message) {
    const button = Panel.body().querySelector(`[data-pad="${index}"]`);
    if (!button) return;
    Panel.body().querySelectorAll('.mg-pad').forEach(pad => pad.classList.toggle('sounding', pad === button));
    Panel.body().querySelector('.mg-status').textContent = message;
    Audio2.sfx.star([0, 2, 4, 5][index]);
  }
  function bindEcho(body) {
    const s = session, length = games.echo.lengths[s.difficulty] + s.round;
    const watch = () => {
      stopPulse(); if (s.phase !== 'ready') s.aids++; s.phase = 'watch'; s.watch = 0; s.input = []; persist(); render();
      const token = run;
      const step = () => {
        if (session !== s || run !== token || !Panel.isOpen()) return;
        if (s.watch >= length) { s.phase = 'answer'; s.watch = -1; s.message = 'あなたの番。覚えた順番を返そう。'; render(); Panel.body().querySelector('[data-pad="0"]').focus({ preventScroll: true }); return; }
        const index = s.sequence[s.watch++]; echoFlash(index, `${s.watch}音目：${pads[index].symbol} ${pads[index].name}`);
        pulseTimer = setTimeout(() => {
          if (session !== s || run !== token) return;
          Panel.body().querySelectorAll('.mg-pad').forEach(pad => pad.classList.remove('sounding'));
          pulseTimer = setTimeout(step, 250);
        }, 700);
      }; step();
    };
    body.querySelector('[data-listen]').onclick = watch;
    body.querySelector('[data-step]').onclick = () => {
      stopPulse();
      if (s.phase !== 'manual') { if (s.phase !== 'ready') s.aids++; s.phase = 'manual'; s.watch = 0; s.input = []; persist(); render(); }
      if (s.watch < length) { const index = s.sequence[s.watch++]; echoFlash(index, `${s.watch} / ${length}音目：${pads[index].symbol} ${pads[index].name}。覚えたら次の一音へ。`); Panel.body().querySelector('[data-step]').focus({ preventScroll: true }); }
      else { s.phase = 'answer'; s.message = 'あなたの番。覚えた順番を返そう。'; render(); Panel.body().querySelector('[data-pad="0"]').focus({ preventScroll: true }); }
    };
    body.querySelector('[data-answer]').onclick = () => { stopPulse(); s.phase = 'answer'; s.input = []; s.message = 'あなたの番。覚えた順番を返そう。'; render(); Panel.body().querySelector('[data-pad="0"]').focus({ preventScroll: true }); };
    body.querySelectorAll('[data-pad]').forEach(button => button.onclick = () => answer(+button.dataset.pad));
  }
  function answer(index) {
    const s = session;
    if (!s || s.id !== 'echo' || s.phase !== 'answer' || s.completed) return;
    const length = games.echo.lengths[s.difficulty] + s.round;
    Audio2.sfx.star([0, 2, 4, 5][index]);
    if (index !== s.sequence[s.input.length]) {
      s.mistakes++; s.input = []; s.phase = 'ready'; s.message = '違う響きでした。この節から、落ち着いてもう一度。'; Audio2.sfx.wrong(); persist(); render(); return;
    }
    s.input.push(index); s.message = `${pads[index].symbol} ${pads[index].name}、届きました。あと${length - s.input.length}音。`;
    if (s.input.length === length) {
      s.round++;
      if (s.round >= 3) { finish(); return; }
      s.input = []; s.phase = 'ready'; s.message = '響きが届き、星がひとつ灯りました。次の節を聴こう。';
    }
    persist(); render();
  }
  function finish() {
    const s = session;
    if (!s || s.completed) return;
    s.completed = true; stopPulse();
    let score, description;
    if (s.id === 'lantern') {
      const [rows, cols] = games.lantern.sizes[s.difficulty], minimum = bits(solve(rows, cols, s.initial) || 0);
      score = Math.max(0, 100 - Math.max(0, s.moves - minimum) * 3 - s.hints * 8);
      description = `${s.moves}手 / 目安の最短 ${minimum}手・ヒント${s.hints}回`;
    } else {
      score = Math.max(0, 100 - s.mistakes * 12 - s.aids * 6);
      description = `3節完成・聴き直し${s.aids}回・間違い${s.mistakes}回`;
    }
    const result = s.practice ? null : record(load(), s.id, s.difficulty, score, s.id === 'lantern' ? s.moves : null);
    if (!s.practice) { Board.saveParty(); World.refresh(); }
    Audio2.sfx.win();
    Panel.open('小さな光がともった', shell(`<div class="mg-result"><span class="mg-eyebrow">${games[s.id].title} / ${s.practice ? '練習' : names[s.difficulty]}</span><div class="mg-result-rank">${grade(score)}</div><h3>${s.id === 'lantern' ? '帰る船に、灯りを。' : '響きに、返事を。'}</h3><p>${description}</p><div class="mg-result-numbers"><span>今回 <b>${score}</b> 点</span>${result ? `<span>最高 <b>${result.record.best}</b> 点</span><span>報酬 <b>+${result.gold}</b> しずく</span>` : '<span>練習なので記録と報酬はありません</span>'}</div>${result ? `<div class="r-materials"><small>今回の素材 · 評価ごとに1回</small>${Object.keys(result.materials).length ? Object.entries(result.materials).map(([id, n]) => `${Progression.materials[id].name} +${n}`).join('・') : 'この評価までの素材は受取済みです'}</div>` : ''}<p class="mg-afterword">${games[s.id].story}</p><p class="mg-note">${result ? result.gold ? '上達した分のしずくを受け取りました。' : 'この成績までの報酬は受取済み。繰り返し遊んでもしずくは減りません。' : '練習で覚えたら、本番にも挑戦してみよう。'}</p><div class="mg-card-actions"><button class="mg-primary" data-retry>もう一度遊ぶ</button><button class="mg-secondary" data-home>休憩所へ</button></div></div>`), { onClose: () => { stopPulse(); session = null; } });
    Panel.body().querySelector('[data-retry]').onclick = () => start(s.id, s.difficulty, s.practice);
    Panel.body().querySelector('[data-home]').onclick = () => open();
  }
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (!session || !Panel.isOpen() || !Panel.body().querySelector('.mg-play')) return;
    if (event.key === 'Escape') { event.preventDefault(); Panel.close(); }
    else if (session.id === 'echo' && /^[1-4]$/.test(event.key) && !event.repeat) { event.preventDefault(); answer(+event.key - 1); }
  });
  return { open, close() { if (Panel.body().querySelector('.mg-shell')) Panel.close(); }, games, tiers, grade, crossMask, solve, createLantern, createEcho, record };
})();
