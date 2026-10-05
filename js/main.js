// タイトル・メニュー・設定。物語と戦闘の進行は各画面が受け持つ。
const Main = (() => {
  const title = document.getElementById('title');
  const gate = document.getElementById('gate');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let preferences = { reduceMotion: reduced.matches, textSize: 'normal' };
  try {
    const saved = JSON.parse(localStorage.getItem('cr_settings') || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.reduceMotion === 'boolean') preferences.reduceMotion = saved.reduceMotion;
      if (saved.textSize === 'large') preferences.textSize = 'large';
    }
  } catch (e) {}

  function applyPreferences(save = false) {
    document.documentElement.dataset.motion = preferences.reduceMotion ? 'reduced' : 'full';
    document.documentElement.dataset.textSize = preferences.textSize;
    if (save) {
      try { localStorage.setItem('cr_settings', JSON.stringify(preferences)); }
      catch (e) { Engine.toast('表示設定をこの端末に記録できませんでした。'); }
    }
  }
  applyPreferences();
  function syncImportedSettings() {
    preferences = { reduceMotion: reduced.matches, textSize: 'normal' };
    try {
      const settings = JSON.parse(localStorage.getItem('cr_settings') || 'null');
      if (settings && typeof settings.reduceMotion === 'boolean') preferences.reduceMotion = settings.reduceMotion;
      if (settings && settings.textSize === 'large') preferences.textSize = 'large';
      const volume = JSON.parse(localStorage.getItem('cr_vol') || 'null') || { bgm: 0.55, sfx: 0.7 };
      Audio2.setVol('bgm', volume.bgm); Audio2.setVol('sfx', volume.sfx);
    } catch (e) {}
    applyPreferences();
  }

  const summary = document.createElement('p');
  summary.className = 't-save-summary'; summary.setAttribute('aria-live', 'polite');
  title.querySelector('.t-sub').after(summary);
  const tools = document.createElement('div'); tools.className = 't-tools';
  tools.innerHTML = '<button type="button" data-m="guide">遊び方</button><button type="button" data-m="journal">旅の手帳</button><button type="button" data-m="about">作品紹介</button>';
  title.querySelector('.t-menu').after(tools);
  title.querySelector('.t-logo').setAttribute('role', 'heading');
  title.querySelector('.t-logo').setAttribute('aria-level', '1');
  title.querySelector('.t-menu').setAttribute('aria-label', 'ゲームを始める');

  // 音声の開始にはクリック／キー操作が必要。開始ゲートもキーボードから操作できる。
  gate.setAttribute('role', 'button'); gate.setAttribute('tabindex', '0');
  gate.setAttribute('aria-label', 'Color Resonance を始める');
  gate.querySelector('.g-tap').textContent = 'ふれるか、Enter で始める';
  const quietStart = document.createElement('button'); quietStart.type = 'button';
  quietStart.className = 'g-quiet'; quietStart.textContent = '音なしで始める';
  quietStart.addEventListener('click', e => {
    e.stopPropagation(); Audio2.setVol('bgm', 0); Audio2.setVol('sfx', 0); enter();
  });
  gate.querySelector('.g-in').append(quietStart);
  gate.addEventListener('keydown', e => {
    if (e.target !== gate || !['Enter', ' '].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); enter();
  });
  gate.addEventListener('click', enter);
  requestAnimationFrame(() => gate.focus({ preventScroll: true }));

  function toTitle() {
    Engine.stop(); Engine.resetStage();
    Board.stop(); World.close();
    document.getElementById('boardScreen').classList.add('hidden');
    document.getElementById('pouch').classList.add('hidden');
    title.style.display = ''; requestAnimationFrame(() => title.classList.remove('hide'));
    Engine.setBg('rain', 'night'); FX.set('rain:0.35,sparkle:0.25'); Audio2.playBgm('fate');
    refreshMenu();
  }
  function refreshMenu() {
    const saved = Engine.load(), unlocked = Engine.unlocked();
    const complete = unlocked.includes('done') && unlocked.includes('act1');
    const continuation = title.querySelector('[data-m=continue]');
    continuation.disabled = !saved;
    continuation.classList.toggle('t-primary', !!saved && !complete);
    title.querySelector('[data-m=new]').classList.toggle('t-primary', !saved && !complete);
    title.querySelector('[data-m=chapters]').disabled = unlocked.length < 2;
    title.querySelector('[data-m=world]').disabled = !unlocked.includes('act1');
    title.querySelector('[data-m=world]').classList.toggle('t-primary', complete);
    const chapter = saved && CHAPTERS.find(c => c.key === saved.chapter);
    summary.textContent = complete && Board.party.postgame.started ? `王国復興 ${Board.party.postgame.progress}/8 · ${Board.party.postgame.finished ? '新しい結末のあとも、地図から旅の続きを。' : '地図の「王国復興」から二人の旅へ。'}` : complete ? '物語を読み終えました。地図の「王国復興」から次の旅へ。' : chapter ? `${chapter.act} · ${chapter.title}${saved.map ? ' ｜ 地図から再開' : ' ｜ 物語の続き'}` : '色を取り戻す物語と、床を染めるタクティクス';
  }
  let entered = false;
  function enter() {
    if (entered) return; entered = true;
    Audio2.resume(); gate.classList.add('hide');
    setTimeout(() => gate.remove(), preferences.reduceMotion ? 30 : 1000);
    const ch = location.hash.match(/ch=(\w+)/), bd = location.hash.match(/board=(\w+)/);
    if (ch && SCRIPT[ch[1]] && (!ch[1].startsWith('restore') || Restoration.canBegin(ch[1]))) { title.style.display = 'none'; Engine.play(ch[1]); }
    else if (bd && BOARDS[bd[1]] && (!BOARDS[bd[1]].postgame || Restoration.joined())) { title.style.display = 'none'; Engine.setBg('teal', 'dim'); Board.start({ ...BOARDS[bd[1]], resultLabel: 'タイトルへ戻る' }, () => toTitle()); }
    else if (location.hash.includes('world')) { title.style.display = 'none'; World.open(); }
    else {
      toTitle();
      setTimeout(() => { if (!Panel.isOpen() && title.style.display !== 'none') title.querySelector('.t-primary')?.focus({ preventScroll: true }); }, preferences.reduceMotion ? 50 : 1050);
    }
  }

  title.querySelectorAll('[data-m]').forEach(button => button.addEventListener('click', e => {
    e.stopPropagation(); Audio2.sfx.choose();
    const action = button.dataset.m;
    if (action === 'new') newJourney();
    else if (action === 'continue') start(() => Engine.cont());
    else if (action === 'chapters') chapters();
    else if (action === 'world') start(() => World.open());
    else if (action === 'settings') settings();
    else if (action === 'guide') guide();
    else if (action === 'journal') Journal.open();
    else if (action === 'about') about();
  }));
  function start(fn) {
    title.classList.add('hide');
    setTimeout(() => { title.style.display = 'none'; fn(); }, preferences.reduceMotion ? 40 : 900);
  }
  function newJourney() {
    const party = Board.party;
    const hasProgress = Engine.load() || Engine.unlocked().length > 1 || party.aria.lv > 1 || Object.keys(party.stages || {}).length > 0;
    if (!hasProgress) { start(() => Engine.play('prologue')); return; }
    Panel.open('新しい旅をはじめる', `<p>今の物語、仲間の成長、装備、依頼の記録をリセットして、最初から遊びます。</p>
      <p class="wp-note">音量と表示設定は引き継ぎます。今の記録は設定からファイルに保存できます。</p>
      <div class="menu-actions"><button class="btn-main" id="newContinue">今の旅を続ける</button><button class="btn-main danger" id="newConfirm">新しい旅をはじめる</button></div>`);
    Panel.body().querySelector('#newContinue').onclick = () => { Panel.close(); if (Engine.load()) start(() => Engine.cont()); };
    Panel.body().querySelector('#newConfirm').onclick = () => {
      const result = SaveData.clearProgress();
      if (!result.ok) { Engine.toast(result.message); return; }
      Engine.clearLog(); Board.reloadParty(); Panel.close(); refreshMenu(); start(() => Engine.play('prologue'));
    };
  }

  function chapters() {
    const unlocked = Engine.unlocked();
    Panel.open('章をえらぶ', `<p class="wp-note">読みたい章から振り返れます。仲間の成長と装備は引き継ぎます。</p><div class="chap-list">${CHAPTERS.filter(c=>!c.key.startsWith('restore')||unlocked.includes('done')).map(c => {const open=c.key.startsWith('restore')?Restoration.canBegin(c.key):unlocked.includes(c.key);return `<button class="chap" data-k="${c.key}" ${open ? '' : 'disabled'}><div class="c-a">${c.act}</div><div class="c-t">${open ? c.title : 'まだ出会っていない物語'}</div></button>`;}).join('')}</div>`);
    Panel.body().querySelectorAll('.chap').forEach(button => button.onclick = () => { Panel.close(); start(() => Engine.play(button.dataset.k)); });
  }

  const GUIDE = `<p class="guide-intro">アリアと精霊たちの旅。物語を読み、床の色と位置どりを考えて戦います。</p>
    <div class="guide-grid">
      <section><span class="guide-no">01</span><h4>物語を読む</h4><p>画面の空いている場所にふれるか、Enter／Spaceで読み進めます。「ログ」で読み返し、「オート」で自動送りにできます。</p></section>
      <section><span class="guide-no">02</span><h4>動く・行動する・待機する</h4><p>アリアや仲間を選び、光る床にふれると移動します。その場で行動することもできます。行動前なら「選び直す」で移動を戻せます。</p><p>「待機」では最後に向きを選びます。背後を敵に向けない位置どりが大切です。</p></section>
      <section><span class="guide-no">03</span><h4>色と背後を使う</h4><p>歩いた床が虹色になると、味方が強くなります。敵の正面は橙の矢印、背後は青の二本線。側面からの攻撃は +10%、背後は +25%です。</p></section>
      <section><span class="guide-no">04</span><h4>次の旅を選ぶ</h4><p>地図で物語、町の依頼、再挑戦を選べます。適性レベルを目安にし、同じステージでも「やさしい・ふつう・ハード」から選べます。S評価の報酬は、やさしいがアイテム、ふつうが通常装備、ハードがユニーク装備です。</p></section>
      <section><span class="guide-no">05</span><h4>精霊の力を選ぶ・絆を育てる</h4><p>召喚は共鳴6で登場時の大技と精霊の別行動。心剣に宿す（エンチャント）は共鳴3で、3ターンのあいだ通常攻撃が毎ターン2回になります。1撃目のあとに追撃する敵を選べます。移動は1回、技や道具を使うと行動は終了します。</p><p>精霊の力や教わった技を使うと絆が育ちます。「仲間・絆」でエンチャント系と召喚系それぞれの熟練度を確認できます。各8・20・40で3種ずつ、4精霊で計24種。以前覚えた技は引き継ぎます。</p><p>地図や町の「スキル強化」で、習得した技を素材で+3まで磨けます。消費共鳴は変わらず、威力・回復量・守りが育ちます。素材は戦闘・ミッション・遊び・一部の店で獲得できます。</p></section>
      <section><span class="guide-no">06</span><h4>星と色の、小さな冒険</h4><p>地図の「遊び」か町の「色と音の休憩所」へ。「星潮の航路」は先を読んで宝を運び、疾走・護り・寄港地の選択で3つの海を渡ります。「結晶の連鎖」は3つの結晶をそろえ、星結晶の爆発とフィーバーで庭園に彩りを戻します。横一列を消す「虹の一閃」は1回だけ、手数消費なし。</p><p>船の「ここから ↑」の上が次の進路です。結晶は選ぶと交換できる隣に矢印が付き、星結晶や虹の一閃はマウスを重ねる・キーで選ぶと消す範囲が光ります。灯りは選んだ位置と上下左右が反転し、金の枠で範囲を確認できます。こだまは「お手本」と「あなたの番」を切り替えて案内します。色だけでなく絵・形・記号・名前で見分けられます。</p><p>灯りのパズル「灯台の色つなぎ」と、四つの響きを返す「精霊のこだま」も遊べます。時間制限はなく、3難易度・練習・途中再開を選べます。第一幕の解放で航路、第二幕で灯台、第三幕でこだま、第四幕で結晶が順番に開きます。章を読み返しても、解放済みの遊びは引き続き選べます。</p><p>各遊びのハード初回クリアで澄明の核2個。評価Cでも受け取れ、初Sの核1個は別の報酬です。素材袋が満杯なら未受取分は次回へ。練習や失敗では初回の宝を消費しません。</p></section>
      <section><span class="guide-no">07</span><h4>旅を記録する</h4><p>物語と戦闘の成果は自動で記録されます。「設定」で記録をファイルに保存し、別の端末に引き継げます。戦闘の途中からは再開できません。</p></section>
    </div><p class="guide-shortcuts"><kbd>Enter</kbd> 物語を進める　<kbd>E</kbd> ターン終了　<kbd>Esc</kbd> 閉じる・選択を戻す</p>`;
  function guide() { Panel.open('旅のはじめかた', GUIDE); }
  function about() {
    Panel.open('Color Resonance', `<div class="about-game"><p class="about-tagline">夜空の黒と透明の剣</p><p>「穢れ」と「その人の色」は、分けられるか。</p>
      <p>透明な剣を持つアリアが、色を失った世界で出会い、選び、精霊たちと歩く物語です。</p></div>
      <h4>あなたのペースで</h4><p>物語はいつでもログから振り返れます。戦いの難易度、文字の速さ、音量、動きの軽減は設定で調整できます。</p>
      <h4>記録について</h4><p>記録はこのブラウザに保存されます。大切な旅の記録は、設定の「ファイルに保存」で手元にも残せます。</p>`);
  }

  function settings() {
    let diff = 'normal', speed = 32;
    try {
      diff = Progression.normalize(localStorage.getItem('cr_diff'));
      const savedSpeed = Number(localStorage.getItem('cr_speed') ?? 32);
      if ([0, 14, 32, 55].includes(savedSpeed)) speed = savedSpeed;
    } catch (e) {}
    Panel.open('設定', `<div class="settings-layout">
      <section class="settings-section"><h4>音</h4>
        <div class="row volume-row"><label for="vB">音楽</label><input type="range" min="0" max="1" step="0.05" value="${Audio2.vol.bgm}" id="vB"><output for="vB" id="vBValue">${Math.round(Audio2.vol.bgm * 100)}%</output></div>
        <div class="row volume-row"><label for="vS">効果音</label><input type="range" min="0" max="1" step="0.05" value="${Audio2.vol.sfx}" id="vS"><output for="vS" id="vSValue">${Math.round(Audio2.vol.sfx * 100)}%</output></div>
      </section>
      <section class="settings-section"><h4>読みやすさと動き</h4>
        <fieldset class="setting-group"><legend>文字の速さ</legend><div class="seg" id="sp"><button data-v="55">ゆっくり</button><button data-v="32">ふつう</button><button data-v="14">はやい</button><button data-v="0">すぐ</button></div></fieldset>
        <fieldset class="setting-group"><legend>物語の文字サイズ</legend><div class="seg" id="textSize"><button data-v="normal">ふつう</button><button data-v="large">大きく</button></div></fieldset>
        <label class="setting-switch"><input type="checkbox" id="reduceMotion" ${preferences.reduceMotion ? 'checked' : ''}><span>動きを軽減する<small>背景の揺れ、点滅、画面の動きを抑えます。</small></span></label>
      </section>
      <section class="settings-section"><h4>戦い</h4><fieldset class="setting-group"><legend>基本の難易度</legend><div class="seg" id="df">${Object.entries(Progression.difficulties).map(([id, d]) => `<button data-v="${id}">${d.name}</button>`).join('')}</div></fieldset>
        <p class="wp-note">各ステージでも選べます。ここでの変更は次の出撃から適用されます。戦闘中と再挑戦の難易度は変わりません。</p>
      </section>
      <section class="settings-section"><h4>旅の記録</h4><p class="wp-note">記録をファイルに保存して、別の端末でも続けられます。</p>
        <div class="save-actions"><button class="setting-button" id="exportSave">ファイルに保存</button><label class="setting-button file-label" for="importSave">ファイルを選ぶ<input id="importSave" type="file" accept=".json,application/json"></label>${SaveData.hasBackup() ? '<button class="setting-button" id="restoreSave">切り替え前の記録を戻す</button>' : ''}</div>
        <div id="savePreview" class="save-preview hidden"></div><p id="saveStatus" class="save-status" role="status" aria-live="polite"></p>
        <button class="setting-button danger" id="resetSave">記録をすべて消す</button><div id="resetConfirm" class="reset-confirm hidden"><p>物語、仲間の成長、装備、依頼の記録を消します。音量と表示設定は残ります。</p><div class="save-actions"><button class="setting-button" id="resetCancel">やめる</button><button class="setting-button danger" id="resetDo">消してタイトルへ戻る</button></div></div>
      </section></div>`);
    const body = Panel.body();
    const volume = (id, kind) => {
      const input = body.querySelector('#' + id), output = body.querySelector('#' + id + 'Value');
      input.oninput = () => { const value = Number(input.value); Audio2.setVol(kind, value); output.textContent = Math.round(value * 100) + '%'; input.setAttribute('aria-valuetext', output.textContent); };
      input.setAttribute('aria-valuetext', output.textContent);
    };
    volume('vB', 'bgm'); volume('vS', 'sfx');
    const segment = (id, current, fn) => body.querySelectorAll(`#${id} button`).forEach(button => {
      const select = on => { button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on)); };
      select(button.dataset.v == current);
      button.onclick = () => {
        body.querySelectorAll(`#${id} button`).forEach(other => { other.classList.toggle('on', other === button); other.setAttribute('aria-pressed', String(other === button)); });
        fn(button.dataset.v);
      };
    });
    segment('sp', speed, value => { try { localStorage.setItem('cr_speed', value); } catch (e) { Engine.toast('文字の速さを記録できませんでした。'); } });
    segment('df', diff, value => Board.setDifficulty(value));
    segment('textSize', preferences.textSize, value => { preferences.textSize = value; applyPreferences(true); });
    body.querySelector('#reduceMotion').onchange = e => { preferences.reduceMotion = e.target.checked; applyPreferences(true); };
    bindSaves(body);
    body.querySelector('#resetSave').onclick = () => {
      body.querySelector('#resetConfirm').classList.remove('hidden'); body.querySelector('#resetCancel').focus({ preventScroll: true });
      body.querySelector('#resetConfirm').scrollIntoView({ block: 'nearest', behavior: 'auto' });
    };
    body.querySelector('#resetCancel').onclick = () => { body.querySelector('#resetConfirm').classList.add('hidden'); body.querySelector('#resetSave').focus({ preventScroll: true }); };
    body.querySelector('#resetDo').onclick = () => {
      const result = SaveData.clearProgress(); if (!result.ok) { Engine.toast(result.message); return; }
      Engine.clearLog(); Board.reloadParty(); Panel.close(); toTitle();
    };
  }

  function bindSaves(body) {
    const status = body.querySelector('#saveStatus'), preview = body.querySelector('#savePreview');
    let fileRequest = 0;
    const report = result => { status.textContent = result.message || ''; status.classList.toggle('error', !result.ok); };
    body.querySelector('#exportSave').onclick = () => {
      try { report(SaveData.download()); }
      catch (e) { report({ ok: false, message: '保存できませんでした。もう一度お試しください。' }); }
    };
    body.querySelector('#importSave').onchange = async e => {
      const request = ++fileRequest;
      preview.replaceChildren(); preview.classList.add('hidden'); status.textContent = '';
      const file = e.target.files[0]; if (!file) return;
      e.target.value = '';
      if (file.size > 256 * 1024) { report({ ok: false, message: 'ファイルが大きすぎます。256KB以内のゲームの記録を選んでください。' }); return; }
      let source, result;
      try { source = await file.text(); result = SaveData.previewText(source); }
      catch (error) { if (body.isConnected && request === fileRequest) report({ ok: false, message: 'このファイルを読み取れませんでした。' }); return; }
      if (!body.isConnected || request !== fileRequest) return;
      report(result); if (!result.ok) return;
      preview.classList.remove('hidden');
      const info = document.createElement('p');
      const chapter = CHAPTERS.find(c => c.key === result.chapter);
      info.textContent = `${chapter ? chapter.act + '・' + chapter.title : '旅の記録'} ｜ アリア LV ${result.level} ｜ しずく ${result.gold}`;
      const note = document.createElement('p'); note.className = 'wp-note';
      note.textContent = 'この記録に切り替えます。今の記録は退避され、設定から戻せます。';
      const confirm = document.createElement('button'); confirm.className = 'setting-button'; confirm.id = 'importConfirm'; confirm.textContent = 'この記録に切り替える';
      confirm.onclick = () => {
        const imported = SaveData.importText(source); report(imported);
        if (imported.ok) { Engine.clearLog(); syncImportedSettings(); Board.reloadParty(); Panel.close(); toTitle(); Engine.toast(imported.message || '旅の記録を読み込みました。'); }
      };
      preview.append(info, note, confirm); confirm.focus({ preventScroll: true }); preview.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    };
    const restore = body.querySelector('#restoreSave');
    if (restore) restore.onclick = () => {
      fileRequest++;
      preview.replaceChildren(); preview.classList.remove('hidden');
      const note = document.createElement('p'); note.textContent = '切り替え前に退避した旅の記録へ戻します。今の記録は次の退避記録になります。';
      const confirm = document.createElement('button'); confirm.className = 'setting-button'; confirm.id = 'restoreConfirm'; confirm.textContent = '退避した記録へ戻す';
      confirm.onclick = () => { const result = SaveData.restoreBackup(); report(result); if (result.ok) { Engine.clearLog(); syncImportedSettings(); Board.reloadParty(); Panel.close(); toTitle(); Engine.toast(result.message || '元の記録に戻しました。'); } };
      preview.append(note, confirm); confirm.focus({ preventScroll: true }); preview.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    };
  }

  function gameMenu() {
    Panel.open('メニュー', `<div class="game-menu"><button class="btn-main" id="gmSet">設定と旅の記録</button><button class="btn-main" id="gmGuide">遊び方</button><button class="btn-main" id="gmJournal">旅の手帳</button><button class="btn-main" id="gmTitle">タイトルへ戻る</button><p class="wp-note">物語と戦闘の成果は自動で記録されます。戦闘の途中からは再開できません。</p></div>`);
    Panel.body().querySelector('#gmSet').onclick = settings;
    Panel.body().querySelector('#gmGuide').onclick = guide;
    Panel.body().querySelector('#gmJournal').onclick = () => Journal.open();
    Panel.body().querySelector('#gmTitle').onclick = () => { Panel.close(); toTitle(); };
  }

  // 背景を先に読み込む。
  ['rain', 'teal', 'forest', 'canyon', 'cave_sky', 'stars', 'glass'].forEach(key => { const image = new Image(); image.src = `assets/bg/${key}.jpg`; });
  document.getElementById('boardHelp').setAttribute('aria-label', '戦い方を読む');
  document.getElementById('boardMenu').setAttribute('aria-label', 'ゲームメニューを開く');
  document.getElementById('toast').setAttribute('role', 'status');
  Engine.setBg('rain', 'night'); FX.set('rain:0.3'); refreshMenu();

  return { toTitle, gameMenu, settings, guide, get preferences() { return { ...preferences }; } };
})();
