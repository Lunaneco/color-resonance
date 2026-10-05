// 町の休憩所。先読みの航海、連鎖の結晶、灯りのパズル、色と音の記憶。
const Minigames = (() => {
  const tiers = ['gentle', 'normal', 'hard'];
  const names = { gentle: 'やさしい', normal: 'ふつう', hard: 'ハード' };
  const games = {
    voyage: { title: '星潮の航路', label: '先読み × 宝探し', need: 'act1', icon: '⛵', hue: '#91e7db',
      desc: '三つの海域を渡る小さな冒険。岩礁を避け、星の宝を連続で集めよう。風を使った疾走と、寄港地での選択が航海を変える。', story: '拾った星が帆に宿り、夜の海に一本の航路が生まれた。港で待つ人にも、同じ光が見えている。', ending: '星を積んで、港へ。', gems: ['m_teal', 'm_green'] },
    lantern: { title: '灯台の色つなぎ', label: '色のパズル', need: 'act2', icon: '◈', hue: '#8be8ef',
      desc: '消えた灯りを、ひとつずつ結び直す。隣の灯りも変わる硝子盤で、港の灯台をともそう。',
      sizes: { gentle: [2, 3], normal: [3, 3], hard: [4, 4] }, story: '港に、帰る船の灯りがひとつ増えた。「待っている」という色は、雨の中でも消えない。', ending: '帰る船に、灯りを。', gems: ['m_teal', 'm_gold'] },
    echo: { title: '精霊のこだま', label: '色と音の記憶', need: 'act3', icon: '✧', hue: '#c2a6ff',
      desc: '潮、芽、金、虹。四つの響きを覚えて返すと、小さな夜空に星がひらく。音を消しても遊べます。',
      lengths: { gentle: 3, normal: 5, hard: 7 }, story: '時計ばかりが鳴っていた街に、違う音が帰ってきた。ひとりの旋律が、誰かの返事を待っている。', ending: '響きに、返事を。', gems: ['m_green', 'm_violet'] },
    crystal: { title: '結晶の連鎖', label: '連鎖 × フィーバー', need: 'act4', icon: '❖', hue: '#edc49f',
      desc: '結晶を入れ替えて3つそろえると、次の連鎖へ。4つ以上で爆発する星結晶が生まれる。フィーバーと虹の一閃で、大逆転を狙おう。', story: '砕けた結晶は消えなかった。幾つもの色が重なると、眠っていた硝子庭園がもう一度、花を咲かせた。', ending: '眠る庭園に、彩りを。', gems: ['m_gold', 'm_violet'] },
  };
  const pads = [{ name: '潮', symbol: '≈', art: 'tide', color: '#8ae0ef' }, { name: '芽', symbol: '❧', art: 'leaf', color: '#a4e9b6' }, { name: '金', symbol: '◇', art: 'gold', color: '#ffe099' }, { name: '虹', symbol: '✧', art: 'prism', color: '#d1b3ff' }];
  const prop = name => `<img class="mg-prop" src="assets/minigames/${name}.webp" width="128" height="128" alt="" aria-hidden="true" decoding="async">`;
  const seaArt = { star: 'treasure', charge: 'wind', heart: 'heal', reef: 'reef', harbor: 'lantern-on' };
  const cover = (id, cls = 'mg-cover') => `<img class="${cls}" src="assets/minigames/${id}-cover.webp" width="768" height="512" alt="" aria-hidden="true" decoding="async">`;
  const rewards = { gentle: [20, 35, 50, 70], normal: [30, 50, 75, 100], hard: [40, 70, 100, 140] };
  const grade = score => score >= 95 ? 'S' : score >= 80 ? 'A' : score >= 60 ? 'B' : 'C';
  const entitled = (difficulty, score) => rewards[difficulty]['CBAS'.indexOf(grade(score))];
  let session = null, pulseTimer = null, run = 0, bloomSequence = 0;
  const available = id => Engine.unlocked().includes(games[id].need);
  const load = () => Board.party;
  function write(party) { Board.saveParty(); if (typeof World !== 'undefined') World.refresh(); }
  function stopPulse() { run++; if (pulseTimer) clearTimeout(pulseTimer); pulseTimer = null; if (typeof MinigameMotion !== 'undefined') MinigameMotion.clear(); }
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
    const hardMaterials = Progression.leisureHardBonus(party, difficulty, r);
    for (const [id, amount] of Object.entries(hardMaterials)) materials[id] = (materials[id] || 0) + amount;
    return { gold, materials, hardMaterials, improved, record: r, grade: grade(score) };
  }
  function persist() {
    if (!session || session.practice || session.completed) return;
    const party = load();
    const { practice, completed, phase, watch, message, hint, selected, mode, burstText, ...snapshot } = session;
    party.minigames.active = snapshot; write(party);
  }
  function shell(html) { return `<div class="mg-shell">${html}</div>`; }
  function open(town = 'aquamist') {
    stopPulse(); session = null;
    const party = load(), active = party.minigames.active;
    const total = Object.values(party.minigames.records).flatMap(r => Object.values(r)).reduce((n, r) => n + r.clears, 0);
    const allThree = id => tiers.every(tier => party.minigames.records[id][tier]?.clears);
    Panel.open('色と音の休憩所', shell(`
      <div class="mg-hero"><span class="mg-eyebrow">SMALL ADVENTURES, BRIGHT DISCOVERIES</span><h3>もう一つの冒険へ。</h3><p>第一幕から第四幕まで、章の解放ごとに新しい遊びがひとつ増えます。<br>時間制限はありません。途中で閉じても続きから遊べます。</p><span class="mg-total">完成した遊び <b>${total}</b> 回</span><div class="mg-prize-intro">✦ 各遊びのハード初回クリアで <b>澄明の核 ×2</b><small>評価Cでも受け取れます。初Sの核×1は別の報酬。</small></div></div>
      ${active && available(active.id) ? `<button class="mg-resume" data-resume><span>途中から続ける</span><b>${games[active.id].title} / ${names[active.difficulty]}</b></button>` : ''}
      <div class="mg-catalog">${Object.entries(games).map(([id, game]) => {
        const unlocked = available(id), preferred = party.minigames.preferred[id], chapter = CHAPTERS.find(ch => ch.key === game.need).act;
        return `<article class="mg-card" style="--mg-color:${game.hue}" data-game="${id}">${cover(id)}<div class="mg-card-top"><span class="mg-emblem" aria-hidden="true">${prop({ voyage: 'ship', crystal: 'nova', lantern: 'lantern-on', echo: 'prism' }[id])}</span><div><small>${game.label}</small><h4>${game.title}</h4></div>${allThree(id) ? '<span class="mg-seal">三つの灯り ✦</span>' : ''}</div><span class="mg-chapter ${unlocked ? 'is-unlocked' : ''}">${unlocked ? '✦' : '◇'} ${chapter} · ${unlocked ? '解放済み' : '解放で追加'}</span><p>${game.desc}</p>
          <div class="mg-difficulties" role="group" aria-label="${game.title}の難易度">${tiers.map(tier => { const r = party.minigames.records[id][tier]; return `<button data-tier="${tier}" aria-pressed="${tier === preferred}" ${unlocked ? '' : 'disabled'}><b>${names[tier]}</b><small>${r?.clears ? `最高 ${grade(r.best)} / ${r.best}点` : '未完成'}</small></button>`; }).join('')}</div>
          <div class="mg-hard-prize ${party.minigames.records[id].hard?.hardCoreClaimed === 2 ? 'claimed' : ''}">${InventoryArt.icon('m_core')}<span>✧ ハード初回の宝</span><b>澄明の核 ×${2 - (party.minigames.records[id].hard?.hardCoreClaimed || 0) || 2}</b><small>${party.minigames.records[id].hard?.hardCoreClaimed === 2 ? '受取済み' : '未受取 · 評価を問わず獲得'}</small></div>
          <div class="mg-card-actions"><button class="mg-primary" data-start ${unlocked ? '' : 'disabled'}>新しく遊ぶ</button><button class="mg-secondary" data-practice ${unlocked ? '' : 'disabled'}>練習する</button></div>${!unlocked ? `<p class="mg-note">${chapter}の解放で遊べるようになります。</p>` : `<p class="mg-note">${game.gems.map(id => Progression.materials[id].name).join('・')}と共鳴の砂を、評価C・B・A・Sごとに1回。初Sで核×1を追加。${names[preferred]}のしずく上限 ${rewards[preferred][3]}。</p>`}
          ${allThree(id) ? `<p class="mg-afterword">${game.story}</p>` : ''}</article>`;
      }).join('')}</div><p class="mg-footnote">練習は記録・報酬に含みません。新しく始めると、途中の記録は置き換わります。獲得した成績は残ります。</p>`), { onClose: () => { stopPulse(); session = null; } });
    const body = Panel.body();
    body.querySelector('[data-resume]')?.addEventListener('click', () => start(active.id, active.difficulty, false, active));
    body.querySelectorAll('[data-game]').forEach(card => {
      const id = card.dataset.game;
      card.querySelectorAll('[data-tier]').forEach(button => button.onclick = () => {
        if (!available(id)) return;
        const p = load(); p.minigames.preferred[id] = button.dataset.tier; write(p); open(town);
      });
      card.querySelector('[data-start]').onclick = () => start(id, load().minigames.preferred[id]);
      card.querySelector('[data-practice]').onclick = () => start(id, 'gentle', true);
    });
  }
  function start(id, difficulty = 'gentle', practice = false, saved = null) {
    if (!Object.hasOwn(games, id) || !available(id) || !tiers.includes(difficulty)) return;
    stopPulse();
    const create = () => id === 'lantern' ? createLantern(difficulty) : id === 'echo' ? createEcho(difficulty) : id === 'voyage' ? PlayCore.createVoyage(difficulty, practice ? 73 : undefined) : PlayCore.createCrystal(difficulty, practice ? 73 : undefined);
    session = { ...(saved || create()), practice, completed: false };
    if (saved && ['voyage', 'crystal'].includes(id)) session = { ...(PlayCore.restore(saved) || create()), practice, completed: false };
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
    MinigameMotion.clear();
    const s = session, game = games[s.id];
    const previous = Panel.body();
    const scroll = previous.querySelector(`.mg-play[data-id="${s.id}"]`) ? previous.scrollTop : 0;
    const focused = previous.contains(document.activeElement) ? document.activeElement : null;
    const attribute = focused && ['data-lamp', 'data-pad', 'data-lane', 'data-mode', 'data-camp', 'data-gem', 'data-rainbow', 'data-crystal-hint', 'data-listen', 'data-step', 'data-answer', 'data-back', 'data-hint', 'data-reset', 'data-undo'].find(name => focused.hasAttribute(name));
    const focusTarget = attribute ? `[${attribute}="${focused.getAttribute(attribute)}"]` : null;
    Panel.open(game.title, shell(`<div class="mg-play" data-id="${s.id}"><div class="mg-play-head"><span class="mg-eyebrow">${s.practice ? '練習 / 報酬なし' : names[s.difficulty]} ・ 時間制限なし</span><button class="mg-back" data-back>休憩所へ</button></div>${s.id === 'lantern' ? lanternHtml(s) : s.id === 'echo' ? echoHtml(s) : s.id === 'voyage' ? voyageHtml(s) : crystalHtml(s)}<p class="mg-footnote">${s.practice ? '練習中。元の途中記録は残っています。' : '操作ごとに自動保存。×で閉じても休憩所から続きを再開できます。'}</p></div>`), { onClose: () => { persist(); stopPulse(); session = null; } });
    const body = Panel.body();
    body.scrollTop = scroll;
    body.querySelector('[data-back]').onclick = () => { persist(); open(); };
    if (s.id === 'lantern') bindLantern(body); else if (s.id === 'echo') bindEcho(body); else if (s.id === 'voyage') bindVoyage(body); else bindCrystal(body);
    const target = focusTarget && body.querySelector(focusTarget);
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }
  function lanternHtml(s) {
    const [rows, cols] = games.lantern.sizes[s.difficulty], n = rows * cols;
    const lit = bits(s.board);
    return `<p class="mg-instruction"><b>すべての灯りを「点灯」に。</b>選ぶ灯りと、上下左右の灯りが反転します。</p>
      ${s.practice ? '<div class="mg-tip">まず上の真ん中を押してみよう。自分と、線でつながる隣の灯りが変わります。</div>' : ''}
      <div class="mg-meter"><span>灯り <b data-lit>${lit} / ${n}</b></span><span>手数 <b data-moves>${s.moves}</b></span><span>ヒント <b data-hints>${s.hints}</b></span></div>
      <div class="mg-lantern-wrap"><div class="mg-scene-caption"><b>すべての炎を灯そう</b><span>選ぶ灯り ＋ 上下左右が反転</span></div><div class="mg-lantern" role="group" aria-label="灯台の硝子盤" style="--mg-columns:${cols}">${Array.from({ length: n }, (_, i) => lampHtml(s, i)).join('')}</div><div class="mg-lamp-preview" aria-hidden="true"><i></i><i></i><i></i><i></i><i>＋</i><i></i><i></i><i></i><i></i><span>金の枠が変わる灯り</span></div></div>
      <div class="mg-status" role="status" aria-live="polite">${s.message || '灯りを選んでみよう。何度でもやり直せます。'}</div>
      <div class="mg-toolbar"><button data-undo ${s.history.length ? '' : 'disabled'}>ひとつ戻す</button><button data-hint>ヒント</button><button data-reset>最初の盤面に戻す</button></div>
      <p class="mg-keynote">Tab / 矢印キーで選び、Enter / Spaceで切り替え。<br>点灯は「●」、消灯は「○」でも確認できます。ヒントと戻す操作は成績に含まれます。</p>`;
  }
  function lampHtml(s, i) {
    const on = !!(s.board & 1 << i), [rows, cols] = games.lantern.sizes[s.difficulty];
    return `<button class="mg-lamp ${on ? 'lit' : ''}${s.hint === i ? ' hinted' : ''}" data-lamp="${i}" aria-pressed="${on}" aria-label="${Math.floor(i / cols) + 1}行${i % cols + 1}列 ${on ? '点灯' : '消灯'}${s.hint === i ? ' ヒントの灯り' : ''}" style="--lamp-hue:${185 + i / (rows * cols) * 145}">${prop(on ? 'lantern-on' : 'lantern-off')}<small><span aria-hidden="true">${on ? '●' : '○'}</span> ${on ? '点灯' : '消灯'}</small></button>`;
  }
  function bindLantern(body) {
    const s = session, [rows, cols] = games.lantern.sizes[s.difficulty], full = (1 << rows * cols) - 1;
    const preview = index => {
      const mask = crossMask(rows, cols, index);
      body.querySelectorAll('[data-lamp]').forEach(lamp => {
        const affected = !!(mask & 1 << +lamp.dataset.lamp);
        lamp.classList.toggle('affected', affected);
        lamp.classList.toggle('preview-origin', +lamp.dataset.lamp === index);
      });
    };
    const clearPreview = () => body.querySelectorAll('[data-lamp]').forEach(lamp => lamp.classList.remove('affected', 'preview-origin'));
    body.querySelectorAll('[data-lamp]').forEach(button => {
      button.onpointerenter = () => preview(+button.dataset.lamp);
      button.onpointerleave = () => { const focused = body.querySelector('.mg-lamp:focus'); if (focused) preview(+focused.dataset.lamp); else clearPreview(); };
      button.onfocus = () => preview(+button.dataset.lamp);
      button.onblur = clearPreview;
      button.onclick = () => {
        const index = +button.dataset.lamp;
        s.board ^= crossMask(rows, cols, index); s.moves++; s.history.push(index); s.history = s.history.slice(-256); delete s.hint;
        s.message = `${Math.floor(index / cols) + 1}行${index % cols + 1}列と隣の灯りを切り替えました。`;
        Audio2.sfx.star(index); persist();
        if (s.board === full) finish(); else { render(); Panel.body().querySelector(`[data-lamp="${index}"]`).focus({ preventScroll: true }); MinigameMotion.lantern(index, crossMask(rows, cols, index), s.board); }
      };
      button.onkeydown = event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        if (!Object.hasOwn(offsets, event.key)) return;
        event.preventDefault(); const index = Math.max(0, Math.min(rows * cols - 1, +button.dataset.lamp + offsets[event.key]));
        body.querySelector(`[data-lamp="${index}"]`).focus();
      };
    });
    body.querySelector('[data-undo]').onclick = () => {
      if (!s.history.length) return; const index = s.history.pop(), mask = crossMask(rows, cols, index); s.board ^= mask; s.moves++; s.message = 'ひとつ前の灯りに戻しました。'; delete s.hint; persist(); render(); MinigameMotion.lantern(index, mask, s.board);
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
      <div class="mg-echo" data-phase="${s.phase}" role="group" aria-label="四つの響き"><div class="mg-echo-turn" role="status"><span>${s.phase === 'answer' ? `あなたの番 · あと${length - s.input.length}音` : s.phase === 'watch' || s.phase === 'manual' ? 'お手本 · 光った結晶を覚えよう' : '① お手本を見る → ② 同じ順で返す'}</span><span class="mg-verse-stars" role="img" aria-label="完成した節 ${s.round} / 3">${[0, 1, 2].map(i => `<i class="${i < s.round ? 'lit' : ''}" aria-hidden="true">✦</i>`).join('')}</span></div>${pads.map((pad, i) => `<button class="mg-pad${s.practice && s.phase === 'answer' && s.sequence[s.input.length] === i ? ' practice-target' : ''}" data-pad="${i}" style="--pad-color:${pad.color}" aria-label="${i + 1} ${pad.name}${s.practice && s.phase === 'answer' && s.sequence[s.input.length] === i ? ' 次の響き' : ''}" ${s.phase !== 'answer' ? 'disabled' : ''}><kbd>${i + 1}</kbd>${prop(pad.art)}<b><span aria-hidden="true">${pad.symbol}</span> ${pad.name}</b></button>`).join('')}</div>
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
    MinigameMotion.echo(index, 'listen');
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
      s.mistakes++; s.input = []; s.phase = 'ready'; s.message = '違う響きでした。この節から、落ち着いてもう一度。'; Audio2.sfx.wrong(); persist(); render(); MinigameMotion.echo(index, 'wrong'); return;
    }
    s.input.push(index); s.message = `${pads[index].symbol} ${pads[index].name}、届きました。あと${length - s.input.length}音。`;
    const completedVerse = s.input.length === length, input = s.input.length;
    if (completedVerse) {
      s.round++;
      if (s.round >= 3) { finish(); return; }
      s.input = []; s.phase = 'ready'; s.message = '響きが届き、星がひとつ灯りました。次の節を聴こう。';
    }
    persist(); render();
    MinigameMotion.echo(index, completedVerse ? 'verse' : 'answer', s.round, input);
  }
  const progressBar = (value, goal, label) => `<div class="mg-quest-progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(goal, value)}"><i style="width:${Math.min(100, value / goal * 100)}%"></i></div>`;
  function voyageHtml(s) {
    const rule = PlayCore.voyageRules[s.difficulty], mode = s.mode || 'sail', zone = Math.min(3, Math.floor(s.step / (rule.length / 3)) + 1);
    const nextPort = Math.ceil((s.step + 1) / (rule.length / 3)) * (rule.length / 3);
    const travel = mode === 'dash' ? Math.min(2, rule.length - s.step, nextPort - s.step) : 1;
    return `<div class="mg-adventure-title"><span>STAR TIDE VOYAGE</span><h3>星の宝を、あの港へ。</h3><p>先を見て、進む列を選ぼう。疾走なら宝も岩礁の傷も2倍。</p></div>
      <div class="mg-voyage-layout"><div class="mg-voyage-scene"><div class="mg-sea-label"><b>${['薄明の湾', '星降る海', '夜明けの岸'][zone - 1]}</b><span>${s.step} / ${rule.length} 航程</span></div>
      <div class="mg-route-map" role="group" aria-label="航路の先読み。下の行が次に進む区画">${[2, 1, 0].map(offset => {
        const row = s.map[s.step + offset];
        return `<div class="mg-sea-row ${offset === 0 ? 'next' : ''}${offset < travel ? ' will-travel' : ''}" data-distance="${offset + 1}"><span class="mg-sea-distance">${row ? offset === 0 ? '次へ ↑' : `${offset + 1}先` : '港'}</span>${[0, 1, 2].map(lane => {
          const tile = row ? PlayCore.tiles[row[lane]] : { icon: '⚑', name: '到着の港', detail: '' };
          const type = row?.[lane] || 'harbor', reachable = Math.abs(s.lane - lane) <= 1;
          return `<div class="mg-sea-tile ${type}${offset < travel && reachable ? ' reachable' : ''}${offset < travel && !reachable ? ' unreachable' : ''}" data-sea-lane="${lane}" aria-label="${['左', '中央', '右'][lane]} ${tile.name} ${tile.detail}">${seaArt[type] ? prop(seaArt[type]) : '<strong aria-hidden="true">≈</strong>'}<small>${tile.name}</small></div>`;
        }).join('')}</div>`;
      }).join('')}<div class="mg-ship-row" role="group" aria-label="今いる列から、上の次へ進みます">${[0, 1, 2].map(lane => `<div class="${lane === s.lane ? 'current' : ''}" ${lane === s.lane ? 'aria-label="あなたの船の現在位置"' : ''}>${lane === s.lane ? prop('ship') + '<b>ここから ↑</b>' : '<span aria-hidden="true">・</span>'}</div>`).join('')}</div></div>
      <div class="mg-sea-legend"><span>${prop('treasure')} 宝</span><span>${prop('wind')} 風力+1</span><span>${prop('heal')} 船体+1</span><span>${prop('reef')} 傷</span></div></div>
      <div class="mg-voyage-controls"><div class="mg-vitals"><span>船体 <b>${'♥'.repeat(s.hp)}${'♡'.repeat(rule.hp - s.hp)}</b></span><span>風力 <b>${s.charge} / 4</b></span><span>連続 <b>${s.combo}</b></span><span class="mg-compact-stat">宝 <b>${s.points}</b></span></div>
      <div class="mg-journey-score"><span>宝の輝き <b>${s.points}</b><small>Sの目安 ${rule.target} · 傷1回につき−3点</small></span>${progressBar(s.points, rule.target, '宝の輝き')}</div>
      ${s.camp ? `<div class="mg-camp"><span>✧ 小さな寄港地</span><h4>次の海に、何を持ち出す？</h4><p>一つだけ選べます。積んだ宝は、そのまま。</p><button data-camp="repair"><b>1 船を直す</b><small>船体を2回復</small></button><button data-camp="wind"><b>2 風を集める</b><small>風力を2補充</small></button><button data-camp="treasure"><b>3 秘蔵の宝を積む</b><small>宝の輝き+28</small></button></div>` : `<div class="mg-sail-modes" role="group" aria-label="進み方">${[['sail', '帆走', 0, '1区画進む'], ['guard', '護り', 1, '岩礁の傷を防ぐ'], ['dash', '疾走', 2, '2区画 / 宝と傷2倍']].map(([id, name, cost, desc]) => `<button data-mode="${id}" aria-pressed="${mode === id}" ${s.charge < cost ? 'disabled' : ''}><b>${name}<em>${cost ? `風${cost}` : '風0'}</em></b><small>${desc}</small></button>`).join('')}</div><div class="mg-lanes" role="group" aria-label="選んだ列へ進む">${[0, 1, 2].map(lane => {
        const path = Array.from({ length: travel }, (_, i) => s.map[s.step + i][lane]);
        const damage = mode === 'guard' ? 0 : path.filter(tile => tile === 'reef').length * (mode === 'dash' ? 2 : 1);
        return `<button data-lane="${lane}" class="${lane === s.lane ? 'aboard ' : ''}${damage ? 'danger' : 'safe'}" ${lane === s.lane ? 'aria-current="location"' : ''} ${Math.abs(s.lane - lane) > 1 ? 'disabled' : ''}><kbd>${lane + 1}</kbd><b>${['左へ', '中央へ', '右へ'][lane]}</b><span>${path.map(tile => PlayCore.tiles[tile].name).join(' → ')}</span><em>${Math.abs(s.lane - lane) > 1 ? '隣の列まで' : damage ? `岩礁 −${damage}` : path.includes('reef') ? '護りで安全' : '安全に進む'}</em></button>`;
      }).join('')}</div>`}
      <div class="mg-status" role="status" aria-live="polite">${s.message || '① 進み方 → ② 行き先。船は上の「次へ」に進みます。3つの海域を渡ればクリア。'}</div>
      ${s.practice ? '<p class="mg-tip">練習の海は毎回同じ。まず左の宝へ進み、寄港地では回復・風・宝を選んでみよう。</p>' : ''}<details class="mg-rules"><summary>航海のコツ・操作</summary><p>1〜3 / タップで列を選び、そのまま進みます。移動は隣の列まで。岩礁以外を選べば傷は付きません。宝を取るたびに連続数が増え、静かな海と岩礁で途切れます。風の結晶と回復の雫では連続数を保ちます。船体が0になると終了し、報酬は付きません。3つの海域を渡り切れば、宝の量に関係なくクリア。疾走は寄港地の手前で止まります。</p></details></div></div>`;
  }
  function bindVoyage(body) {
    const s = session;
    body.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { s.mode = button.dataset.mode; render(); });
    body.querySelectorAll('[data-lane]').forEach(button => button.onclick = () => sail(+button.dataset.lane));
    body.querySelectorAll('[data-camp]').forEach(button => button.onclick = () => camp(button.dataset.camp));
  }
  function camp(choice) {
    const s = session; if (!s || s.id !== 'voyage' || !PlayCore.voyageCamp(s, choice)) return;
    s.message = { repair: '船を直しました。次の海へ。', wind: '帆に風が集まりました。疾走を狙うなら今。', treasure: '秘蔵の宝 +28。港まで大切に運ぼう。' }[choice];
    if (choice === 'repair') Audio2.sfx.heal(); else Audio2.sfx.star(4);
    persist(); render(); MinigameMotion.camp(choice);
  }
  function sail(lane) {
    const s = session; if (!s || s.id !== 'voyage' || s.completed) return;
    const mode = s.mode || 'sail', fromLane = s.lane;
    const result = PlayCore.voyageTurn(s, lane, mode); if (!result.valid) return;
    s.mode = 'sail'; s.message = result.log;
    if (result.events.some(event => event.hp < 0)) Audio2.sfx.wrong();
    else if (result.events.some(event => event.tile === 'heart')) Audio2.sfx.heal();
    else Audio2.sfx.star(Math.min(6, s.combo));
    if (result.won) finish(); else if (result.lost) fail(); else { persist(); render(); MinigameMotion.voyage(fromLane, mode, result.events, s.combo); }
  }
  function crystalHtml(s) {
    const rule = PlayCore.crystalRules[s.difficulty], selected = s.selected ?? -1;
    return `<div class="mg-adventure-title"><span>CRYSTAL CASCADE</span><h3>一手から、光の連鎖へ。</h3><p>隣り合う結晶を選んで入れ替え、同じ色・記号を3つ以上そろえよう。</p></div>
      <div class="mg-crystal-layout"><div class="mg-crystal-scene"><div class="mg-scene-caption mg-board-cue" role="status">${s.mode === 'rainbow' ? '虹の一閃 · 消す横一列を選ぼう' : selected >= 0 ? '② 矢印のある隣を選んで交換' : '① 結晶を選ぶ → ② 隣と交換'}</div><div class="mg-crystal-grid ${s.charge >= 12 ? 'fever-ready' : ''}${s.burstText ? ' cascade' : ''}${s.mode === 'rainbow' ? ' rainbow-mode' : ''}" role="group" aria-label="5行5列の結晶盤">${s.board.map((n, i) => {
        const pad = pads[n % 4], nova = n >= 4;
        const neighbor = selected >= 0 && Math.abs(Math.floor(i / 5) - Math.floor(selected / 5)) + Math.abs(i % 5 - selected % 5) === 1;
        const arrow = neighbor ? i < selected ? i % 5 === selected % 5 ? '↓' : '→' : i % 5 === selected % 5 ? '↑' : '←' : '';
        return `<button class="mg-gem ${selected === i ? 'selected' : ''}${neighbor ? ' neighbor' : ''}${nova ? ' nova' : ''}${s.hint?.includes(i) ? ' hinted' : ''}" style="--gem-color:${pad.color}" data-gem="${i}" aria-pressed="${selected === i}" aria-label="${Math.floor(i / 5) + 1}行${i % 5 + 1}列 ${pad.name}${nova ? 'の星結晶。選ぶと周囲9マスを爆発' : 'の結晶'}${neighbor ? '。選択した結晶の隣' : ''}">${prop(nova ? 'nova' : pad.art)}<small><span aria-hidden="true">${nova ? '✦' : pad.symbol}</span> ${pad.name}</small>${arrow ? `<i class="mg-swap-arrow" aria-hidden="true">${arrow}</i>` : ''}</button>`;
      }).join('')}</div><div class="mg-cascade-feedback ${s.burstText ? 'lit' : ''}" aria-hidden="true">${s.burstText || '同じ記号を3つ · 4つで星結晶'}</div></div>
      <div class="mg-crystal-controls"><div class="mg-vitals"><span>残り <b data-turns>${s.movesLeft}手</b></span><span class="mg-chain-stat">最大連鎖 <b>${s.maxChain}</b></span><span class="mg-compact-stat">彩り <b>${s.power}/${rule.target}</b></span><span class="mg-compact-stat">${s.charge >= 12 ? '✧ 次の一手2倍' : `光 ${s.charge}/12`}</span></div>
      <div class="mg-journey-score"><span>庭園の彩り <b data-power>${s.power} / ${rule.target}</b></span>${progressBar(s.power, rule.target, '庭園の彩り')}</div>
      <div class="mg-fever ${s.charge >= 12 ? 'ready' : ''}"><span>${s.charge >= 12 ? '✧ 次の一手はフィーバー！ 彩り2倍' : `フィーバーまで ${12 - s.charge} 個`}</span><div>${Array.from({ length: 12 }, (_, i) => `<i class="${i < s.charge ? 'lit' : ''}"></i>`).join('')}</div></div>
      <div class="mg-crystal-tools"><button data-rainbow aria-pressed="${s.mode === 'rainbow'}" ${s.boostUsed ? 'disabled' : ''}><b>虹の一閃</b><small class="mg-tool-detail">${s.boostUsed ? 'この挑戦では使用済み' : s.mode === 'rainbow' ? '消したい行の結晶を選ぶ · 取消も可' : '1回だけ · 横一列を消す / 手数消費なし'}</small><small class="mg-tool-short">${s.boostUsed ? '使用済み' : s.mode === 'rainbow' ? '消す行を選ぶ' : '横一列 / 手数なし'}</small></button><button data-crystal-hint>つながる一手を見る</button></div>
      <div class="mg-status" role="status" aria-live="polite">${s.message || '4つ以上そろえると、爆発する「星結晶」が生まれます。連鎖するほど彩りが増えます。'}</div>
      ${s.practice ? '<p class="mg-tip">練習は同じ盤面から。「つながる一手を見る」で二つの結晶に印が付きます。選んで入れ替え、連鎖を見てみよう。</p>' : ''}<details class="mg-rules"><summary>連鎖のコツ・操作</summary><p>クリック / タップで結晶を二つ選びます。矢印キーで移動、Enter / Spaceで選択。3つそろわない交換では手数は減りません。4つ以上で生まれた星結晶は、選ぶと周囲9マスを爆発させます（1手）。星結晶も連鎖に巻き込めます。消した個数×連鎖数が彩りになり、12個消すと次の一手が2倍。虹の一閃は手数を使わない切り札です。ヒントは無料。彩りが目標に達すればクリア。手数が尽きると終了します。交換できない盤面は自動で組み替えます。</p></details></div></div>`;
  }
  function bindCrystal(body) {
    const s = session;
    const preview = index => {
      const row = Math.floor(index / 5), col = index % 5;
      body.querySelectorAll('[data-gem]').forEach(gem => {
        const i = +gem.dataset.gem;
        const affected = s.mode === 'rainbow' ? Math.floor(i / 5) === row : s.board[index] >= 4 && Math.abs(Math.floor(i / 5) - row) <= 1 && Math.abs(i % 5 - col) <= 1;
        gem.classList.toggle('area-preview', !!affected);
      });
    };
    const clearPreview = () => body.querySelectorAll('[data-gem]').forEach(gem => gem.classList.remove('area-preview'));
    body.querySelectorAll('[data-gem]').forEach(button => {
      button.onpointerenter = () => preview(+button.dataset.gem);
      button.onpointerleave = () => { const focused = body.querySelector('.mg-gem:focus'); if (focused) preview(+focused.dataset.gem); else clearPreview(); };
      button.onfocus = () => preview(+button.dataset.gem);
      button.onblur = clearPreview;
      button.onclick = () => gem(+button.dataset.gem);
      button.onkeydown = event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 };
        if (!Object.hasOwn(offsets, event.key)) return;
        event.preventDefault(); body.querySelector(`[data-gem="${Math.max(0, Math.min(24, +button.dataset.gem + offsets[event.key]))}"]`).focus({ preventScroll: true });
      };
    });
    body.querySelector('[data-rainbow]').onclick = () => { s.mode = s.mode === 'rainbow' ? null : 'rainbow'; delete s.selected; delete s.burstText; s.message = s.mode ? '虹の一閃：消したい横一列を選ぼう。もう一度ボタンを押すと取消。' : '虹の一閃を取り消しました。まだ使えます。'; render(); };
    body.querySelector('[data-crystal-hint]').onclick = () => {
      if (body.querySelector('.mg-crystal-grid[aria-busy="true"]')) { MinigameMotion.clear(); return; }
      const move = PlayCore.crystalMoves(s.board)[0];
      delete s.burstText;
      s.hint = move ? [move.a, move.b] : [s.board.findIndex(n => n >= 4)];
      s.message = move ? '印の付いた二つの結晶を入れ替えると、光がつながります。ヒントに手数は使いません。' : '星結晶を選んで、周りを爆発させよう。'; render();
    };
  }
  function gem(index) {
    const s = session; if (!s || s.id !== 'crystal' || s.completed) return;
    if (Panel.body().querySelector('.mg-crystal-grid[aria-busy="true"]')) return;
    let action;
    if (s.mode === 'rainbow') action = { type: 'rainbow', index };
    else if (s.board[index] >= 4) action = { type: 'burst', index };
    else if (s.selected == null || s.selected === index) { s.selected = s.selected === index ? null : index; delete s.burstText; s.message = s.selected == null ? '選択を取り消しました。' : '隣の結晶を選んで入れ替えよう。'; render(); return; }
    else {
      const a = s.selected;
      if (Math.abs(Math.floor(a / 5) - Math.floor(index / 5)) + Math.abs(a % 5 - index % 5) !== 1) { s.selected = index; s.message = 'この結晶を選び直しました。隣を選ぶと交換できます。'; render(); return; }
      action = { type: 'swap', a, b: index };
    }
    delete s.selected; delete s.hint; s.mode = null;
    const before = s.board.slice(), result = PlayCore.crystalTurn(s, action);
    if (!result.valid) { delete s.burstText; s.message = '3つそろいませんでした。手数は減っていません。別の結晶を試そう。'; Audio2.sfx.wrong(); render(); MinigameMotion.crystal(before, action, result); return; }
    s.burstText = `${result.fever ? 'FEVER ×2 · ' : ''}${result.chain} CHAIN · +${result.gain}`;
    s.message = `${result.chain}連鎖、彩り+${result.gain}。${result.bursts ? `星結晶が${result.bursts}個はじけた！ ` : ''}${result.shuffled ? '交換できるよう盤面を組み替えました。' : s.charge >= 12 ? '次の一手はフィーバー、彩り2倍！' : '次の連鎖を探そう。'}`;
    Audio2.sfx.star(Math.min(6, result.chain + 1));
    if (result.won) finish(); else if (result.lost) fail(); else { persist(); render(); MinigameMotion.crystal(before, action, result); }
  }
  function bloom(selector) {
    if (document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = Panel.body().querySelector(selector); if (!target) return;
    const image = document.createElement('img'); image.src = 'assets/ui/star-bloom.gif?play=' + ++bloomSequence; image.alt = ''; image.className = 'mg-bloom'; target.append(image);
    setTimeout(() => image.remove(), 1500);
  }
  function fail() {
    const s = session; if (!s || s.completed) return;
    s.completed = true; stopPulse();
    if (!s.practice) { load().minigames.active = null; write(load()); }
    Audio2.sfx.wrong();
    Panel.open('次の冒険へ、もう一度', shell(`<div class="mg-result mg-failed"><span class="mg-eyebrow">${games[s.id].title} / ${s.practice ? '練習' : names[s.difficulty]}</span><div class="mg-failure-icon" aria-hidden="true">☾</div><h3>${s.id === 'voyage' ? '港まで、あと少し。' : '次の一手に、光を。'}</h3><p>${s.id === 'voyage' ? `${s.step}区画を進み、宝の輝き${s.points}。次は岩礁の前で護りや回復を使ってみよう。` : `彩り${s.power} / ${PlayCore.crystalRules[s.difficulty].target}。星結晶・フィーバー・虹の一閃が目標への近道。`}</p><p class="mg-note">今回は未クリア。しずくと素材は消費していません。獲得済みの報酬と記録も残っています。</p><div class="mg-card-actions"><button class="mg-primary" data-retry>もう一度挑戦</button><button class="mg-secondary" data-home>休憩所へ</button></div></div>`), { onClose: () => { stopPulse(); session = null; } });
    Panel.body().querySelector('[data-retry]').onclick = () => start(s.id, s.difficulty, s.practice);
    Panel.body().querySelector('[data-home]').onclick = () => open();
    MinigameMotion.result(false, s.id);
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
    } else if (s.id === 'echo') {
      score = Math.max(0, 100 - s.mistakes * 12 - s.aids * 6);
      description = `3節完成・聴き直し${s.aids}回・間違い${s.mistakes}回`;
    } else if (s.id === 'voyage') {
      score = PlayCore.voyageScore(s); description = `3海域を踏破・宝の輝き${s.points}・最大${s.bestCombo}連続・岩礁${s.hits}回`;
    } else {
      score = PlayCore.crystalScore(s); description = `庭園の彩り${s.power}・最大${s.maxChain}連鎖・残り${s.movesLeft}手・星結晶${s.novaMade}個`;
    }
    const result = s.practice ? null : record(load(), s.id, s.difficulty, score, s.id === 'lantern' ? s.moves : null);
    if (!s.practice) { Board.saveParty(); World.refresh(); }
    Audio2.sfx.win();
    Panel.open('小さな光がともった', shell(`<div class="mg-result"><span class="mg-eyebrow">${games[s.id].title} / ${s.practice ? '練習' : names[s.difficulty]}</span><div class="mg-result-rank">${grade(score)}</div><h3>${games[s.id].ending}</h3><p>${description}</p><div class="mg-result-numbers"><span>今回 <b>${score}</b> 点</span>${result ? `<span>最高 <b>${result.record.best}</b> 点</span><span>報酬 <b>+${result.gold}</b> しずく</span>` : '<span>練習なので記録と報酬はありません</span>'}</div>${result && s.difficulty === 'hard' ? `<div class="mg-hard-award">${InventoryArt.icon('m_core')}<span>✦ ハード初回の宝 · 評価を問わず獲得</span><b>${result.hardMaterials.m_core ? `澄明の核 +${result.hardMaterials.m_core}` : result.record.hardCoreClaimed === 2 ? '受取済み' : '素材袋が満杯です'}</b><small>${result.record.hardCoreClaimed < 2 ? `未受取の${2 - result.record.hardCoreClaimed}個は、素材を使った後のハードクリアで受け取れます。` : '初Sに達したときは、さらに核×1。'}</small></div>` : ''}${result ? `<div class="r-materials"><small>今回の素材合計 · 未受取の評価分とハード初回分</small>${Object.keys(result.materials).length ? InventoryArt.chips(result.materials) : 'この評価までの素材は受取済み、または素材袋が満杯です'}</div>` : ''}<p class="mg-afterword">${games[s.id].story}</p><p class="mg-note">${result ? result.gold ? '上達した分のしずくを受け取りました。' : 'この成績までのしずくは受取済み。繰り返し遊んでも減りません。' : '練習で覚えたら、本番にも挑戦してみよう。'}</p><div class="mg-card-actions"><button class="mg-primary" data-retry>もう一度遊ぶ</button><button class="mg-secondary" data-home>休憩所へ</button></div></div>`), { onClose: () => { stopPulse(); session = null; } });
    Panel.body().querySelector('[data-retry]').onclick = () => start(s.id, s.difficulty, s.practice);
    Panel.body().querySelector('[data-home]').onclick = () => open();
    if (result?.hardMaterials.m_core) bloom('.mg-hard-award');
    MinigameMotion.result(true, s.id);
  }
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (!session || !Panel.isOpen() || !Panel.body().querySelector('.mg-play')) return;
    if (event.key === 'Escape') { event.preventDefault(); Panel.close(); }
    else if (session.id === 'echo' && /^[1-4]$/.test(event.key) && !event.repeat) { event.preventDefault(); answer(+event.key - 1); }
    else if (session.id === 'voyage' && /^[1-3]$/.test(event.key) && !event.repeat) { event.preventDefault(); session.camp ? camp(['repair', 'wind', 'treasure'][+event.key - 1]) : sail(+event.key - 1); }
  });
  return { open, close() { if (Panel.body().querySelector('.mg-shell')) Panel.close(); }, games, tiers, grade, crossMask, solve, createLantern, createEcho, record };
})();
