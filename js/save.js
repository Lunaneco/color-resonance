// 持ち出す記録はゲーム専用キーだけ。読み込み前に全体を確認し、直前の旅を残す。
const SaveData = (() => {
  const progress = ['cr_save', 'cr_unlocked', 'cr_party', 'cr_best'];
  const keys = [...progress, 'cr_diff', 'cr_speed', 'cr_vol', 'cr_settings'];
  const chapters = ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue', 'done'];
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  function checkTree(v, depth = 0) {
    if (depth > 14) throw new Error('記録の階層が深すぎます');
    if (typeof v === 'string' && v.length > 16000) throw new Error('記録の文字列が長すぎます');
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('記録に不正な数値があります');
    if (v && typeof v === 'object') for (const [k, value] of Object.entries(v)) {
      if (['__proto__', 'prototype', 'constructor'].includes(k)) throw new Error('記録に使用できない項目があります');
      checkTree(value, depth + 1);
    }
  }
  function story(v) {
    if (!object(v) || !chapters.includes(v.chapter) || !Number.isInteger(v.idx) || v.idx < 0 || v.idx > 5000) throw new Error('物語の記録が正しくありません');
    const out = { chapter: v.chapter, idx: v.idx, at: finite(v.at, 0, 1e15) ? v.at : Date.now() };
    if (v.map === true) out.map = true;
    if (object(v.cursor) && typeof v.cursor.id === 'string' && /^[a-f0-9]{8}$/.test(v.cursor.id) && Number.isInteger(v.cursor.n) && v.cursor.n >= 0 && v.cursor.n < 5000) out.cursor = { id: v.cursor.id, n: v.cursor.n };
    if (Number.isInteger(v.scriptVersion)) out.scriptVersion = v.scriptVersion;
    if (v.colors != null) {
      if (!Array.isArray(v.colors) || v.colors.length > 16 || v.colors.some(c => typeof c !== 'string' || !/^#[a-f0-9]{3,8}$/i.test(c) && !['teal', 'green', 'gold', 'violet', 'yellow'].includes(c))) throw new Error('夜空の色の記録が正しくありません');
      out.colors = v.colors.slice();
    }
    out.sky = finite(v.sky, 0, 1) ? v.sky : 0;
    out.shavings = finite(v.shavings, 0, 5) ? Math.floor(v.shavings) : 0;
    if (object(v.scene)) {
      const s = v.scene, sc = {};
      const backgrounds = ['none', 'rain', 'teal', 'forest', 'canyon', 'cave_sky', 'stars', 'glass'];
      if (s.bg && !backgrounds.includes(s.bg)) throw new Error('背景の記録が正しくありません');
      sc.bg = s.bg || null;
      sc.preset = typeof s.preset === 'string' && /^[a-zA-Z0-9]{1,20}$/.test(s.preset) ? s.preset : 'none';
      sc.bgm = ['none', 'haruka', 'fate', 'forest'].includes(s.bgm) ? s.bgm : 'none';
      sc.fx = typeof s.fx === 'string' && /^(?:[a-z]+(?::(?:0|[1-3])(?:\.\d{1,3})?)?)(?:,[a-z]+(?::(?:0|[1-3])(?:\.\d{1,3})?)?)*$/.test(s.fx) ? s.fx : 'none';
      sc.aria = s.aria === true; sc.mari = s.mari === true; sc.renoir = s.renoir === true; sc.pouch = s.pouch === true;
      sc.gran = ['clear', 'dark', 'spirit'].includes(s.gran) ? s.gran : null;
      sc.aura = typeof s.aura === 'string' && /^[a-zA-Z]{1,20}$/.test(s.aura) ? s.aura : 'none';
      const cgs = ['sword', 'feather', 'flight', 'lands', 'night', 'day', 'tear', 'shavings', 'transform', 'lila-wave'];
      sc.cgs = Array.isArray(s.cgs) ? [...new Set(s.cgs.filter(c => cgs.includes(c)))] : [];
      out.scene = sc;
    }
    out.tints = {};
    if (object(v.tints)) for (const [who, color] of Object.entries(v.tints)) {
      if (who.length <= 8 && typeof color === 'string' && /^(?:#[a-f0-9]{3,8}|void|renoir)$/i.test(color)) out.tints[who] = color;
    }
    return out;
  }
  function validate(data) {
    if (!object(data)) throw new Error('ゲームのセーブファイルを選んでください');
    const safe = {};
    for (const [key, raw] of Object.entries(data)) {
      if (!keys.includes(key)) throw new Error('このゲーム以外の項目が含まれています');
      if (typeof raw !== 'string' || raw.length > 220000) throw new Error('保存項目の形式が正しくありません');
      if (key === 'cr_diff') {
        if (!['gentle', 'normal', 'hard', 'expert'].includes(raw)) throw new Error('難易度の記録が正しくありません');
        safe[key] = Progression.normalize(raw); continue;
      }
      if (key === 'cr_speed') {
        if (!['0', '14', '32', '55'].includes(raw)) throw new Error('文字速度の記録が正しくありません');
        safe[key] = raw; continue;
      }
      const value = JSON.parse(raw); checkTree(value);
      if (key === 'cr_save') safe[key] = JSON.stringify(story(value));
      else if (key === 'cr_unlocked') {
        if (!Array.isArray(value) || value.some(c => !chapters.includes(c))) throw new Error('章の記録が正しくありません');
        safe[key] = JSON.stringify([...new Set(['prologue', ...value])]);
      } else if (key === 'cr_party') {
        if (!object(value) || !object(value.aria) || !Number.isInteger(value.aria.lv) || !finite(value.aria.lv, 1, 99) || !Number.isInteger(value.aria.exp) || !finite(value.aria.exp, 0, 99) || value.gold != null && !finite(value.gold, 0, 9999999)) throw new Error('仲間・しずくの記録が正しくありません');
        if (typeof Progression !== 'undefined') Progression.migrate(value);
        safe[key] = JSON.stringify(value);
      } else if (key === 'cr_best') {
        if (!object(value)) throw new Error('戦績の記録が正しくありません');
        safe[key] = JSON.stringify(value);
      } else if (key === 'cr_vol') {
        if (!object(value) || !finite(value.bgm, 0, 1) || !finite(value.sfx, 0, 1)) throw new Error('音量の記録が正しくありません');
        safe[key] = JSON.stringify({ bgm: value.bgm, sfx: value.sfx });
      } else if (key === 'cr_settings') {
        if (!object(value) || typeof value.reduceMotion !== 'boolean' || !['normal', 'large'].includes(value.textSize)) throw new Error('表示設定の記録が正しくありません');
        safe[key] = JSON.stringify({ reduceMotion: value.reduceMotion, textSize: value.textSize });
      }
    }
    return safe;
  }
  function snapshot(list = keys) {
    const data = {}; for (const key of list) { const raw = localStorage.getItem(key); if (raw != null) data[key] = raw; } return data;
  }
  const wrap = data => ({ format: 'color-resonance', version: 1, savedAt: new Date().toISOString(), data });
  function parse(text) {
    if (typeof text !== 'string' || text.length > 262144) throw new Error('セーブファイルは256KB以内にしてください');
    const v = JSON.parse(text);
    if (!object(v) || v.format !== 'color-resonance' || v.version !== 1) throw new Error('Color Resonance のセーブファイルではありません');
    return validate(v.data);
  }
  function previewText(text) {
    try {
      const data = parse(text), s = data.cr_save ? JSON.parse(data.cr_save) : null, p = data.cr_party ? JSON.parse(data.cr_party) : null;
      return { ok: true, message: '読み込みできる記録です', chapter: s?.chapter || 'prologue', level: p?.aria?.lv || 1, gold: p?.gold || 0 };
    } catch (e) { return { ok: false, message: e instanceof SyntaxError ? 'ファイルの内容を読み取れません' : e.message }; }
  }
  function apply(data, list = keys) {
    const before = snapshot(list);
    try {
      for (const key of list) { if (Object.hasOwn(data, key)) localStorage.setItem(key, data[key]); else localStorage.removeItem(key); }
    } catch (e) {
      for (const key of list) { try { if (Object.hasOwn(before, key)) localStorage.setItem(key, before[key]); else localStorage.removeItem(key); } catch {} }
      throw new Error('保存できませんでした。ブラウザの保存領域を確認してください');
    }
  }
  function importText(text) {
    try { const data = parse(text); withBackup(() => apply(data)); return { ok: true, message: 'セーブを読み込みました。前の旅はバックアップに残っています' }; }
    catch (e) { return { ok: false, message: e instanceof SyntaxError ? 'ファイルの内容を読み取れません' : e.message }; }
  }
  function withBackup(change) {
    const previous = localStorage.getItem('cr_backup');
    localStorage.setItem('cr_backup', JSON.stringify(wrap(snapshot())));
    try { change(); }
    catch (e) {
      try { if (previous == null) localStorage.removeItem('cr_backup'); else localStorage.setItem('cr_backup', previous); } catch {}
      throw e;
    }
  }
  function restoreBackup() {
    try {
      const raw = localStorage.getItem('cr_backup'); if (!raw) throw new Error('戻せるバックアップがありません');
      const data = parse(raw), current = JSON.stringify(wrap(snapshot())); localStorage.setItem('cr_backup', current);
      try { apply(data); } catch (e) { try { localStorage.setItem('cr_backup', raw); } catch {} throw e; }
      return { ok: true, message: '直前の旅へ戻しました' };
    } catch (e) { return { ok: false, message: e.message }; }
  }
  function clearProgress() {
    try { withBackup(() => apply({}, progress)); return { ok: true, message: '新しい旅の準備ができました' }; }
    catch (e) { return { ok: false, message: e.message }; }
  }
  function exportText() { return JSON.stringify(wrap(validate(snapshot())), null, 2); }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'color-resonance-save-' + new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, message: 'セーブファイルを保存しました' };
    } catch (e) { return { ok: false, message: e.message }; }
  }
  function hasBackup() { try { return !!localStorage.getItem('cr_backup'); } catch { return false; } }
  return { exportText, download, previewText, importText, restoreBackup, hasBackup, clearProgress, story };
})();
