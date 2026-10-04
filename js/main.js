// タイトル・メニュー・設定・練習
const Main = (() => {
  const title = document.getElementById('title');
  const gate = document.getElementById('gate');

  function toTitle() {
    Engine.stop(); Engine.resetStage();
    Board.stop(); World.close();
    document.getElementById('boardScreen').classList.add('hidden');
    document.getElementById('pouch').classList.add('hidden');
    title.style.display = ''; requestAnimationFrame(() => title.classList.remove('hide'));
    Engine.setBg('rain', 'night');
    FX.set('rain:0.35,sparkle:0.25');
    Audio2.playBgm('fate');
    refreshMenu();
  }
  function refreshMenu() {
    const s = Engine.load();
    title.querySelector('[data-m=continue]').disabled = !s;
    const u = Engine.unlocked();
    title.querySelector('[data-m=chapters]').disabled = u.length < 2;
    title.querySelector('[data-m=world]').disabled = !u.includes('act1');
  }

  gate.addEventListener('click', () => {
    Audio2.resume();
    gate.classList.add('hide');
    setTimeout(() => gate.remove(), 1000);
    const ch = location.hash.match(/ch=(\w+)/), bd = location.hash.match(/board=(\w+)/);
    if (ch && SCRIPT[ch[1]]) { title.style.display = 'none'; Engine.play(ch[1]); }
    else if (bd && BOARDS[bd[1]]) { title.style.display = 'none'; Engine.setBg('teal', 'dim'); Board.start(BOARDS[bd[1]], () => toTitle()); }
    else if (location.hash.includes('world')) { title.style.display = 'none'; World.open(); }
    else toTitle();
  });

  title.querySelectorAll('.t-menu button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    Audio2.sfx.choose();
    const m = b.dataset.m;
    if (m === 'new') start(() => Engine.play('prologue'));
    else if (m === 'continue') start(() => Engine.cont());
    else if (m === 'chapters') chapters();
    else if (m === 'world') start(() => World.open());
    else if (m === 'settings') settings();
  }));
  function start(fn) { title.classList.add('hide'); setTimeout(() => { title.style.display = 'none'; fn(); }, 900); }

  function chapters() {
    const u = Engine.unlocked();
    const html = `<div class="chap-list">${CHAPTERS.map(c => `<button class="chap" data-k="${c.key}" ${u.includes(c.key) ? '' : 'disabled'}><div class="c-a">${c.act}</div><div class="c-t">${u.includes(c.key) ? c.title : '・・・'}</div></button>`).join('')}</div>`;
    Panel.open('章をえらぶ', html);
    Panel.body().querySelectorAll('.chap').forEach(b => b.onclick = () => { Panel.close(); start(() => Engine.play(b.dataset.k)); });
  }

  function settings() {
    let diff = 'normal', speed = 32;
    try { diff = localStorage.getItem('cr_diff') || 'normal'; speed = +(localStorage.getItem('cr_speed') || 32); } catch (e) {}
    Panel.open('設定', `
      <div class="row"><label>音楽</label><input type="range" min="0" max="1" step="0.05" value="${Audio2.vol.bgm}" id="vB"></div>
      <div class="row"><label>効果音</label><input type="range" min="0" max="1" step="0.05" value="${Audio2.vol.sfx}" id="vS"></div>
      <div class="row"><label>文字の速さ</label><div class="seg" id="sp"><button data-v="55">ゆっくり</button><button data-v="32">ふつう</button><button data-v="14">はやい</button><button data-v="0">すぐ</button></div></div>
      <div class="row"><label>戦いの難しさ</label><div class="seg" id="df"><button data-v="gentle">やさしい（受ける傷が少ない）</button><button data-v="normal">ふつう</button></div></div>
      <p style="margin-top:14px;font-size:12.5px">左クリック／Enter：読み進める　Ctrl長押し：スキップ　ホイール上：ログ</p>
      <button class="btn-main" id="resetSave" style="border-color:#a88;background:none;color:#e9c3c3;letter-spacing:.15em;font-size:13px">記録をすべて消す</button>`);
    const b = Panel.body();
    b.querySelector('#vB').oninput = e => Audio2.setVol('bgm', +e.target.value);
    b.querySelector('#vS').oninput = e => { Audio2.setVol('sfx', +e.target.value); Audio2.sfx.hover(); };
    const seg = (id, cur, fn) => b.querySelectorAll(`#${id} button`).forEach(x => { x.classList.toggle('on', x.dataset.v == cur); x.onclick = () => { b.querySelectorAll(`#${id} button`).forEach(y => y.classList.toggle('on', y === x)); fn(x.dataset.v); }; });
    seg('sp', speed, v => { try { localStorage.setItem('cr_speed', v); } catch (e) {} });
    seg('df', diff, v => { try { localStorage.setItem('cr_diff', v); } catch (e) {} Board.setDifficulty(v); });
    b.querySelector('#resetSave').onclick = () => {
      if (!confirm('セーブと章の記録を消しますか？')) return;
      try { ['cr_save', 'cr_unlocked', 'cr_best', 'cr_party'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
      Board.resetParty();
      Panel.close(); refreshMenu();
    };
  }

  function gameMenu() {
    Panel.open('メニュー', `<div style="display:flex;flex-direction:column;gap:10px;align-items:center">
      <button class="btn-main" id="gmSet">設定</button>
      <button class="btn-main" id="gmTitle">タイトルへ戻る</button>
      <p style="font-size:12px">進みぐあいは自動で記録されています。</p></div>`);
    Panel.body().querySelector('#gmSet').onclick = () => settings();
    Panel.body().querySelector('#gmTitle').onclick = () => { Panel.close(); toTitle(); };
  }

  // 背景を先に読み込む
  ['rain', 'teal', 'forest', 'canyon', 'cave_sky', 'stars', 'glass'].forEach(k => { const i = new Image(); i.src = `assets/bg/${k}.jpg`; });
  Engine.setBg('rain', 'night');
  FX.set('rain:0.3');

  return { toTitle, gameMenu };
})();
