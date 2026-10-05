// 物語の進行（ノベル部分）
const $ = (s) => document.querySelector(s);

const Panel = (() => {
  const el = $('#panel'); let onClose = null, returnFocus = null;
  const box = el.querySelector('.pn-box'), title = el.querySelector('.pn-title'), footer = el.querySelector('.pn-footer');
  title.id = 'panelTitle'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'panelTitle'); box.tabIndex = -1;
  el.querySelector('.pn-close').setAttribute('aria-label', '閉じる');
  const focusable = () => [...box.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]')].filter(e => e.tabIndex >= 0 && e.getClientRects().length);
  el.querySelector('.pn-close').onclick = () => close();
  el.addEventListener('mousedown', e => { if (e.target === el && !el.dataset.noclose) close(); });
  function open(title, html, opt = {}) {
    if (el.classList.contains('hidden')) returnFocus = document.activeElement;
    el.querySelector('.pn-title').textContent = title;
    el.querySelector('.pn-body').innerHTML = html;
    footer.innerHTML = opt.footer || '';
    footer.classList.toggle('hidden', !opt.footer);
    el.querySelector('.pn-close').style.display = opt.noClose ? 'none' : '';
    el.dataset.noclose = opt.noClose ? '1' : '';
    onClose = opt.onClose || null;
    el.classList.remove('hidden');
    el.querySelector('.pn-body').scrollTop = 0;
    const target = focusable()[0] || box; target.focus({ preventScroll: true });
  }
  function close() {
    if (el.classList.contains('hidden')) return;
    el.classList.add('hidden'); el.querySelector('.pn-body').innerHTML = ''; footer.innerHTML = ''; footer.classList.add('hidden'); const f = onClose; onClose = null; f && f();
    if (el.classList.contains('hidden') && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    document.dispatchEvent(new Event('game-panel-closed'));
  }
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.dataset.noclose) { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const list = focusable(), first = list[0] || box, last = list.at(-1) || box;
      if (!list.length || e.shiftKey && document.activeElement === first || !e.shiftKey && document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    }
  });
  return { open, close, isOpen: () => !el.classList.contains('hidden'), body: () => el.querySelector('.pn-body') };
})();

const Engine = (() => {
  const SIDE_STORIES=['fury','fury_reunion','mari_reunion'];
  const BG = { rain: 'rain', cave_sky: 'cave_sky', canyon: 'canyon', teal: 'teal', forest: 'forest', stars: 'stars', glass: 'glass' };
  const PRESET = {
    none: 'none', dim: 'brightness(.72)', night: 'brightness(.55) saturate(.85) hue-rotate(-8deg)', storm: 'brightness(.32) saturate(.45) contrast(1.15)',
    gray: 'grayscale(.9) brightness(.62) contrast(.95)', dawn: 'brightness(1.04) saturate(.95) sepia(.12)', dusk: 'brightness(.78) saturate(.95) sepia(.28) hue-rotate(-14deg)',
    memory: 'brightness(1.12) saturate(1.1) sepia(.22)', dark: 'brightness(.38) saturate(.45) contrast(1.05)', lead: 'grayscale(.85) brightness(.55) contrast(1.05)',
    gold: 'saturate(1.35) sepia(.38) brightness(1.06) hue-rotate(-10deg)', bright: 'brightness(1.08) saturate(1.15)', clear: 'brightness(1.06) saturate(1.05)',
    clearDawn: 'brightness(1.25) saturate(.25) contrast(.9)',
    c0: 'grayscale(1) brightness(.78) contrast(.9)', c1: 'grayscale(.8) sepia(.12) brightness(.84)', c2: 'grayscale(.55) sepia(.22) brightness(.9)',
    c3: 'grayscale(.28) sepia(.26) brightness(.95)', c4: 'grayscale(0) sepia(.16) saturate(1.12) brightness(1.02)',
  };
  const AURAS = {
    lira: '#ffd98a', liraBright: '#ffe9a8', gran: '#2f86a8', woman: '#b5927a', fisher: '#7fa5b8', rooster: '#d9c25a',
    chrome: 'void', chromeStar: 'starry', kaoru: '#8f8a86', kaoru2: '#c97a52', ivy: '#5fd07a', ivyDark: '#2d4a33', lumina: '#fff2c0',
    spinel: '#ffd25e', spinelLead: '#7c8088', stone: '#c2b29a', king: '#b48cff', kingDark: '#2a1838',
  };

  const tb = $('#textbox'), textEl = $('#text'), speakerEl = $('#speaker'), namePlate = $('#namePlate'), nextMark = $('#nextMark');
  const centerEl = $('#centerText'), choiceBox = $('#choiceBox'), card = $('#chapterCard');
  const aria = $('#charAria'), bigAura = $('#bigAura'), cgLayer = $('#cgLayer');
  let speakerArt = null, speakerArtId = null;
  function clearSpeakerArt() {
    if (speakerArt) { GameArt.unmount(speakerArt); speakerArt.remove(); }
    speakerArt = null; speakerArtId = null;
  }
  function showSpeakerArt(who) {
    if (scene.cgs.includes('lila-wave')) { clearSpeakerArt(); return; }
    const id = who === 'クロム' && chapter?.startsWith('restore') ? 'chrome_human' : GameArt.speakers[who];
    if (!id || id === 'aria' || scene.gran && id === 'gran' || scene.mari && id === 'mari' || scene.renoir && id === 'renoir') {
      if (speakerArt) { speakerArt.classList.add('dim'); GameArt.mount(speakerArt, speakerArtId, 'idle'); }
      return;
    }
    if (!speakerArt) {
      speakerArt = document.createElement('canvas'); speakerArt.width = 384; speakerArt.height = 640;
      speakerArt.className = 'speaker-art'; cgLayer.appendChild(speakerArt);
    }
    const changed = speakerArtId !== id;
    speakerArtId = id; speakerArt.classList.remove('dim');
    speakerArt.classList.toggle('small', !['lila', 'fisher', 'kaoru', 'chrome', 'chrome_human', 'achroma', 'king'].includes(id));
    speakerArt.setAttribute('role', 'img'); speakerArt.setAttribute('aria-label', who);
    GameArt.mount(speakerArt, id, ['lila', 'fisher', 'lumina', 'stone_child', 'kaoru', 'mari'].includes(id) ? 'talk' : 'idle');
    if (changed) { speakerArt.classList.remove('show'); requestAnimationFrame(() => speakerArt?.classList.add('show')); }
  }

  let lines = [], idx = 0, chapter = null, running = false, excursionReturn = null;
  let waiting = null, typing = false, typeTimer = null;
  let auto = false, skip = false, inlineMode = false;
  const log = [];
  const tints = {};
  let scene = defaultScene();
  const prog = { shavings: 0 };
  let token = 0;
  let stageShake = null;
  const timers = new Map();
  function later(fn, ms, cancel) {
    const mine = token, id = setTimeout(() => { timers.delete(id); if (mine === token) fn(); else cancel?.(); }, ms);
    timers.set(id, cancel); return id;
  }
  function cancelTimer(id) { clearTimeout(id); timers.delete(id); }
  const waitStage = ms => new Promise(resolve => later(() => resolve(true), ms, () => resolve(false)));
  function abandon() {
    token++; running = false;
    stageShake?.cancel(); stageShake = null; inlineMode = false;
    for (const [id, cancel] of timers) { clearTimeout(id); cancel?.(); } timers.clear();
    if (waiting) { const done = waiting; waiting = null; done(false); }
    typing = false; completeType = null; skip = false; typeTimer = null;
  }

  function defaultScene() { return { bg: null, preset: 'none', bgm: 'none', fx: 'none', aria: false, gran: null, mari: false, renoir: false, aura: 'none', pouch: false, cgs: [] }; }

  // ---------- 書式 ----------
  function parse(src) {
    return src.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')).map(s => {
      if (s.startsWith('@')) { const sp = s.indexOf(' '); return { t: 'cmd', name: sp < 0 ? s.slice(1) : s.slice(1, sp), arg: sp < 0 ? '' : s.slice(sp + 1).trim() }; }
      if (s.startsWith('>')) return { t: 'center', text: s.slice(1).trim() };
      const m = s.match(/^([^「」\s]{1,8})「([\s\S]*)」$/);
      if (m) return { t: 'say', who: m[1], text: '「' + m[2] + '」' };
      return { t: 'narr', text: s };
    });
  }

  // ---------- 背景 ----------
  let bgFront = $('#bgA'), bgBack = $('#bgB');
  function setBg(key, preset = 'none') {
    if (scene.bg !== key) clearSpeakerArt();
    scene.bg = key; scene.preset = preset;
    if (key === 'none') { bgFront.classList.remove('show'); bgBack.classList.remove('show'); return; }
    const url = `assets/bg/${BG[key] || key}.jpg`;
    const cur = bgFront.dataset.key;
    if (cur === key && bgFront.classList.contains('show')) { bgFront.style.filter = PRESET[preset] || 'none'; return; }
    bgBack.style.backgroundImage = `url("${url}")`; bgBack.dataset.key = key;
    bgBack.style.filter = PRESET[preset] || 'none';
    bgBack.classList.add('show'); bgFront.classList.remove('show');
    [bgFront, bgBack] = [bgBack, bgFront];
  }
  function setPreset(preset) { scene.preset = preset; bgFront.style.filter = PRESET[preset] || 'none'; }

  // ---------- オーラ ----------
  function setAura(key) {
    scene.aura = key;
    if (!key || key === 'none') { bigAura.classList.remove('show'); return; }
    const c = AURAS[key] || '#cfe8ff';
    bigAura.classList.toggle('void', c === 'void' || c === 'starry');
    bigAura.style.setProperty('--c', c === 'void' ? '#000' : c === 'starry' ? '#dfe8ff' : c);
    bigAura.classList.add('show');
    bigAura.querySelector('.core').style.background = c === 'starry' ? 'radial-gradient(circle,#0b0d1c 30%,rgba(10,12,30,.8) 55%,transparent 72%)' : '';
  }
  function speakerColor(who) { return tints[who] || SPEAKERS[who] || '#cfe8ff'; }

  // ---------- 立ち絵・CG ----------
  function show(what, opt) {
    if (what === 'aria') { aria.classList.add('show'); scene.aria = true; return; }
    let el = cgLayer.querySelector(`[data-show="${what}"]`);
    if (what === 'gran') {
      scene.gran = opt || 'clear';
      if (!el) { el = document.createElement('div'); el.dataset.show = 'gran'; el.className = 'cg'; el.innerHTML = '<canvas width="720" height="400" style="width:100%"></canvas>'; Object.assign(el.style, { left: '50%', top: '5%', width: 'min(1050px,82vw)', transform: 'translateX(-50%)', animation: 'swim 16s ease-in-out infinite' }); cgLayer.appendChild(el); GameArt.mount(el.querySelector('canvas'), 'gran', 'idle', { fallback: 'assets/img/gran.png' }); requestAnimationFrame(() => el.classList.add('show')); }
      el.querySelector('canvas').style.filter = opt === 'dark' ? 'brightness(.28) saturate(.25) contrast(1.2) drop-shadow(0 0 30px rgba(0,0,0,.8))' : opt === 'spirit' ? 'brightness(1.15) saturate(1.3) drop-shadow(0 0 40px rgba(140,210,255,.9))' : 'drop-shadow(0 0 30px rgba(120,200,255,.5))';
      el.querySelector('canvas').style.transition = 'filter 3s ease';
    } else if (what === 'mari') {
      scene.mari = true;
      if (!el) { el = document.createElement('div'); el.dataset.show = 'mari'; el.className = 'cg'; el.innerHTML = '<div style="position:absolute;inset:-30%;background:radial-gradient(circle,rgba(255,240,190,.55),transparent 60%);filter:blur(10px)"></div><canvas width="384" height="480" style="position:relative;width:100%;filter:drop-shadow(0 0 24px rgba(255,230,150,.7))"></canvas>'; Object.assign(el.style, { right: '12vw', top: '12vh', width: 'min(440px,34vw)', animation: 'float 6s ease-in-out infinite' }); cgLayer.appendChild(el); GameArt.mount(el.querySelector('canvas'), 'mari', 'idle', { fallback: 'assets/img/mari.png' }); requestAnimationFrame(() => el.classList.add('show')); }
    } else if (what === 'renoir') {
      scene.renoir = true;
      if (!el) {
        el = document.createElement('canvas'); el.dataset.show = 'renoir'; el.className = 'cg'; el.width = 360; el.height = 300;
        Object.assign(el.style, { left: '50%', bottom: '24vh', width: '240px', height: '200px', transform: 'translateX(-50%)' });
        cgLayer.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
        const c = el.getContext('2d');
        const loop = (t) => { if (!el.isConnected) return; c.clearRect(0, 0, 360, 300); Renoir.draw(c, 180, 160, 70, t / 1000, { glow: true }); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      }
    }
  }
  function hide(what) {
    if (what === 'aria') { aria.classList.remove('show'); scene.aria = false; return; }
    if (what === 'gran') scene.gran = null; if (what === 'mari') scene.mari = false; if (what === 'renoir') scene.renoir = false;
    const el = cgLayer.querySelector(`[data-show="${what}"]`);
    if (el) { el.querySelectorAll('canvas').forEach(cv => GameArt.unmount(cv)); el.classList.remove('show'); el.removeAttribute('data-show'); setTimeout(() => el.remove(), 1500); }
  }

  // CG（一時的な演出）
  let cgCanvas = null, threads = [];
  function cg(key) {
    if (key === 'off') { scene.cgs = []; cgLayer.querySelectorAll('.cgItem').forEach(e => { e.classList.remove('show'); setTimeout(() => e.remove(), 1400); }); cgCanvas = null; threads = []; return; }
    if (['sword', 'feather', 'flight', 'lands', 'night', 'day', 'tear', 'shavings', 'transform', 'lila-wave'].includes(key)) scene.cgs = [...new Set([...(scene.cgs || []), key])];
    const add = (html, style = {}, cls = '') => { const d = document.createElement('div'); d.className = 'cg cgItem ' + cls; d.innerHTML = html; Object.assign(d.style, style); cgLayer.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show'))); return d; };
    if (key === 'lila-wave') {
      clearSpeakerArt(); hide('aria');
      const url = 'assets/cg/lila-wave-v1.png';
      add(`<img src="${url}" alt="黒い津波に飲まれながら浮き橋の綱を握り、アリアへ最後の別れを告げるリラ">`, { '--event-image': `url("${url}")` }, 'event-cg');
    } else if (key === 'sword') {
      add('<img src="assets/img/sword.png" style="height:100%;filter:drop-shadow(0 0 30px rgba(220,235,255,.95))">', { left: '50%', top: '8vh', height: '74vh', transform: 'translateX(-50%) rotate(8deg)', animation: 'glint 3s ease-in-out infinite' });
      FX.flash('230,240,255', 0.5);
    } else if (key === 'feather') {
      add('<div style="position:absolute;inset:-120%;background:radial-gradient(circle,rgba(255,236,170,.6),transparent 60%);filter:blur(6px)"></div><img src="assets/img/feather.png" style="position:relative;height:100%;filter:drop-shadow(0 0 18px #fff3c0)">', { left: '50%', top: '26vh', height: '26vh', transform: 'translateX(-50%) rotate(-18deg)', animation: 'float 4s ease-in-out infinite' });
    } else if (key === 'transform') {
      const g = cgLayer.querySelector('[data-show="gran"]');
      if (g) { g.querySelector('img,canvas').style.filter = 'brightness(1.2) saturate(1.35) hue-rotate(8deg) drop-shadow(0 0 50px rgba(150,220,255,1))'; }
      scene.gran = 'spirit';
      add('', { inset: '0', background: 'radial-gradient(ellipse at 50% 25%,rgba(180,230,255,.45),transparent 55%)', mixBlendMode: 'screen' });
      FX.flash('200,235,255', 0.9); FX.set('sparkle:1.2,motes:0.4');
      Audio2.sfx.skill();
    } else if (key === 'flight') {
      add(`<div style="position:absolute;inset:0;background:linear-gradient(180deg,#3d62bd 0%,#7fa3e6 34%,#d9c3d6 56%,#f6c095 70%,#f0a476 84%)"></div>
        <div style="position:absolute;left:66%;top:60%;width:56vmin;height:56vmin;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fffbe8 0%,rgba(255,226,170,.75) 22%,rgba(255,190,130,.25) 50%,transparent 70%)"></div>
        <div class="lands">
          <i style="left:8%;bottom:0;width:13vw;height:3.4vh;background:radial-gradient(ellipse,#e2584c 0%,#b8423c 55%,transparent 72%)"></i>
          <i style="left:27%;bottom:1.2vh;width:16vw;height:4.2vh;background:radial-gradient(ellipse,#3e9a58 0%,#24683c 55%,transparent 72%)"></i>
          <i style="left:49%;bottom:-.4vh;width:11vw;height:3vh;background:radial-gradient(ellipse,#ffe28a 0%,#e0a93a 50%,transparent 72%);box-shadow:0 0 30px rgba(255,220,120,.6)"></i>
          <i style="left:65%;bottom:1.6vh;width:7vw;height:2.2vh;background:radial-gradient(ellipse,#9a9a9e 0%,#6e6e74 55%,transparent 72%)"></i>
          <i style="left:83%;bottom:2.6vh;width:9vw;height:4vh;background:radial-gradient(ellipse,#050508 0%,#16121c 45%,rgba(30,20,40,.5) 60%,transparent 74%);filter:blur(5px)"></i>
        </div>
        <div class="cloudSea"></div>
        <img src="assets/img/gran.png" style="position:absolute;left:50%;top:14%;width:min(900px,70vw);transform:translateX(-50%);filter:brightness(1.12) saturate(1.3) drop-shadow(0 0 40px rgba(170,220,255,.9));animation:swim 12s ease-in-out infinite">`, { inset: '0' });
      FX.set('none');
    } else if (key === 'lands') {
      const l = cgLayer.querySelector('.lands'); if (l) l.classList.add('show');
      FX.set('sparkle:0.4');
    } else if (key === 'night' || key === 'day') {
      const d = add('<canvas style="width:100%;height:100%"></canvas>', { inset: '0', background: key === 'night' ? 'radial-gradient(ellipse at 50% 60%,rgba(12,16,40,.82),rgba(2,3,10,.96))' : 'radial-gradient(ellipse at 50% 60%,rgba(40,30,60,.4),rgba(10,8,20,.75))' });
      const cv = d.querySelector('canvas'); cgCanvas = cv; threads = [];
      const c = cv.getContext('2d');
      const loop = (t) => {
        if (!cv.isConnected) return;
        const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
        const x = W / 2, y = H * 0.52, r = Math.min(W, H) * 0.12;
        // 糸
        threads.forEach(th => {
          th.k = Math.min(1, th.k + 0.006);
          const ex = W * 0.98, ey = H * 0.02;
          c.save(); c.strokeStyle = `rgba(8,6,14,${0.9})`; c.lineWidth = th.big ? 7 : 2.4; c.shadowColor = th.big ? 'rgba(120,80,180,.7)' : 'rgba(100,140,200,.5)'; c.shadowBlur = 14;
          c.beginPath(); c.moveTo(x, y - r * 0.6);
          const steps = 60;
          for (let i = 1; i <= steps * th.k; i++) { const u = i / steps; const px = x + (ex - x) * u + Math.sin(u * 9 + t / 600) * 18 * (1 - u); const py = y - r * 0.6 + (ey - y) * u - Math.sin(u * Math.PI) * 120; c.lineTo(px, py); }
          c.stroke(); c.restore();
        });
        Renoir.draw(c, x, y, r, t / 1000, { glow: true });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else if (key === 'slash') {
      add('<div style="position:absolute;left:-20%;right:-20%;top:50%;height:6px;background:linear-gradient(90deg,transparent,#fff6d8 40%,#fff 50%,#ffd98a 60%,transparent);box-shadow:0 0 40px #ffd27a,0 0 90px #ffe9b0;transform:rotate(-24deg);animation:fadeUp .2s ease"></div>', { inset: '0' });
      FX.flash('255,230,160', 1); Audio2.sfx.cut();
      later(() => cg('off'), 1600);
    } else if (key === 'tear') {
      add('<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(30,40,80,.4),rgba(0,0,0,.92))"></div><div class="tearDrop"></div>', { inset: '0' });
      Audio2.sfx.tear();
      later(() => { FX.flash('230,240,255', 0.7); }, 2900);
    } else if (key === 'shavings') {
      const labels = ['路地の石畳', 'グランの芯', '茨の奥', '鉛の中', '王の足元'];
      const n = Math.min(5, prog.shavings + 1);
      add(`<div class="shavings">${labels.slice(0, n).map((l, i) => `<div class="shaving" style="animation-delay:${0.4 + i * 0.55}s"><span>${l}</span></div>`).join('')}</div>`, { inset: '0', background: 'radial-gradient(ellipse at 50% 50%,rgba(40,30,20,.5),rgba(5,5,10,.85))' });
    }
  }
  function thread(big) { threads.push({ k: 0, big: big === 'big' }); Audio2.sfx.thread(); }
  function keep(color) {
    if (!Renoir.state.colors.includes(color)) Renoir.state.colors.push(color);
    Renoir.gulp(); Audio2.sfx.star(3); FX.flash('200,220,255', 0.2);
  }
  function skyUp() {
    const mine = token;
    Renoir.skyCast();
    const t0 = performance.now();
    const step = (t) => { if (mine !== token) return; const k = Math.min(1, (t - t0) / 3500); Renoir.state.sky = k; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    for (let i = 0; i < 10; i++) later(() => Audio2.sfx.star(i), i * 260);
    FX.flash('220,230,255', 0.5);
  }

  // ---------- 章カード ----------
  function chapterCard(arg) {
    const mine = token;
    const [act, title] = arg.split('|');
    card.querySelector('.cc-act').textContent = act;
    card.querySelector('.cc-title').textContent = title;
    card.classList.remove('hidden', 'out');
    // アニメーションを再始動
    card.querySelectorAll('div').forEach(d => { d.style.animation = 'none'; d.offsetHeight; d.style.animation = ''; });
    return new Promise(res => {
      let doneOnce = false;
      const done = () => { if (doneOnce || mine !== token) return; doneOnce = true; card.onclick = null; card.classList.add('out'); later(() => { card.classList.add('hidden'); res(true); }, 1100, () => res(false)); };
      const t = later(done, skip ? 600 : 3600, () => res(false));
      card.onclick = () => { cancelTimer(t); done(); };
    });
  }

  // ---------- 文字送り ----------
  function speedMs() { try { const n = +(localStorage.getItem('cr_speed') ?? 32); return [0, 14, 32, 55].includes(n) ? n : 32; } catch (e) { return 32; } }
  function typeText(text) {
    textEl.innerHTML = '';
    nextMark.classList.remove('show');
    const sp = skip || document.documentElement.dataset.motion === 'reduced' ? 0 : speedMs(), mine = token;
    const frag = document.createDocumentFragment();
    const template = document.createElement('template'); template.innerHTML = text; let count = 0;
    const copy = (source, target) => {
      for (const node of source.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) for (const ch of node.textContent) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.style.animationDelay = (count++ * sp) + 'ms'; target.appendChild(s); }
        else if (node.nodeType === Node.ELEMENT_NODE) {
          if (['BR', 'B', 'STRONG', 'SMALL', 'EM'].includes(node.tagName)) { const el = document.createElement(node.tagName); target.appendChild(el); copy(node, el); }
          else copy(node, target);
        }
      }
    };
    copy(template.content, frag);
    textEl.appendChild(frag);
    typing = true;
    cancelTimer(typeTimer);
    return new Promise(res => {
      const finish = () => { if (mine !== token) { res(false); return; } typing = false; completeType = null; nextMark.classList.add('show'); res(true); };
      typeTimer = later(finish, count * sp + 200, () => res(false));
      completeType = () => { if (mine !== token) return; cancelTimer(typeTimer); textEl.querySelectorAll('.ch').forEach(s => s.style.animationDelay = '0ms'); finish(); };
    });
  }
  let completeType = null;

  function waitAdvance(textLen = 20) {
    return new Promise(res => {
      waiting = res;
      if (skip) later(() => { if (waiting === res) advance(); }, 50);
      else if (auto) later(() => { if (waiting === res) advance(); }, 1400 + textLen * 70);
    });
  }
  function advance() {
    if (Panel.isOpen() || document.hidden || !running && !inlineMode) return;
    if (typing && completeType) { completeType(); return; }
    if (waiting) { const w = waiting; waiting = null; Audio2.sfx.page(); w(true); }
  }

  async function sayLine(who, text) {
    const mine = token;
    tb.classList.remove('hidden');
    if (!inlineMode) showSpeakerArt(who);
    if (who) {
      speakerEl.textContent = who; namePlate.classList.add('show');
      const c = speakerColor(who); const mini = namePlate.querySelector('.aura');
      mini.classList.toggle('void', c === 'void' || c === 'renoir');
      mini.style.setProperty('--c', c === 'void' ? '#000' : c === 'renoir' ? '#9a8cff' : c);
      textEl.classList.remove('narr');
    } else { namePlate.classList.remove('show'); textEl.classList.add('narr'); }
    aria.classList.toggle('dim', !!who && who !== 'アリア');
    if (!who) aria.classList.remove('dim');
    log.push({ who, text }); if (log.length > 300) log.shift();
    if (!await typeText(text) || mine !== token) return;
    await waitAdvance(text.length);
  }
  async function centerLine(text) {
    const mine = token;
    tb.classList.add('hidden');
    centerEl.innerHTML = text; centerEl.classList.add('show');
    log.push({ who: '', text: text.replace(/<br>/g, '') });
    if (!await waitStage(skip ? 50 : 900) || mine !== token) return;
    if (!await waitAdvance(30) || mine !== token) return;
    centerEl.classList.remove('show');
    await waitStage(skip ? 30 : 600);
  }

  // ---------- 選択 ----------
  function choice(key) {
    const C = CHOICES[key], mine = token;
    if (!C) return Promise.resolve();
    tb.classList.add('hidden');
    const used = new Set();
    return new Promise(res => {
      const render = () => {
        if (mine !== token) return;
        choiceBox.innerHTML = `<div class="cprompt">${C.prompt}</div>`;
        C.options.forEach((o, i) => {
          const b = document.createElement('button'); b.textContent = o.t; if (used.has(i)) b.classList.add('used');
          b.onclick = async (e) => {
            e.stopPropagation();
            if (mine !== token || choiceBox.classList.contains('hidden')) return;
            choiceBox.classList.add('hidden');
            if (o.ok) Audio2.sfx.choose();
            else { Audio2.sfx.wrong(); used.add(i); }
            for (const l of parse(o.lines.join('\n'))) {
              if (mine !== token) { res(); return; }
              await runLine(l);
              if (mine !== token) { res(); return; }
            }
            if (o.ok) res();
            else { tb.classList.add('hidden'); render(); choiceBox.classList.remove('hidden'); }
          };
          choiceBox.appendChild(b);
        });
      };
      skip = false; updateBtns();
      render(); choiceBox.classList.remove('hidden');
    });
  }

  // ---------- 盤 ----------
  function board(key) {
    const mine = token;
    clearSpeakerArt();
    tb.classList.add('hidden'); hide('aria'); bigAura.classList.remove('show');
    skip = false; updateBtns();
    const conf = BOARDS[key];
    return new Promise(res => {
      if (key === 'chrome') {
        conf.onPhase0 = async () => {
          if (mine !== token || !Board.running) return;
          inlineMode = true;
          for (const l of parse(FINALE_PHASE0)) {
            if (mine !== token || !Board.running) return;
            await runLine(l);
            if (mine !== token || !Board.running) return;
          }
          tb.classList.add('hidden'); inlineMode = false;
          Board.enterPhase1({ skyCharges: Renoir.state.colors.length || 4, say: { who: 'アリア', text: '白い膜だけを、切り分ける。<br><small>メニューの「小さな夜空」で、ルノワールの夜空が床を取り戻してくれる</small>' } });
        };
      }
      const difficulty=conf.difficultyFrom?Progression.selected(Board.party,conf.difficultyFrom):Progression.selected(Board.party,key);
      Board.start({ ...conf, difficulty, resultLabel: '物語をつづける' }, () => { res(); });
    }).then(() => { if (mine === token && scene.aura !== 'none') setAura(scene.aura); });
  }

  // ---------- 命令 ----------
  async function command(name, arg) {
    const a = arg.split(/\s+/);
    switch (name) {
      case 'chapter': await chapterCard(arg); break;
      case 'bg': setBg(a[0], a[1] || 'none'); break;
      case 'color': setPreset('c' + a[0]); Audio2.sfx.star(+a[0]); FX.flash('255,236,200', 0.15); if (+a[0] >= 3) FX.set('motes:0.15'); break;
      case 'bgm': scene.bgm = a[0]; Audio2.playBgm(a[0]); break;
      case 'fx': scene.fx = arg; FX.set(arg); break;
      case 'show': show(a[0], a[1]); break;
      case 'hide': hide(a[0]); break;
      case 'aura': setAura(a[0]); break;
      case 'cg': cg(a[0]); break;
      case 'thread': thread(a[0]); await waitStage(skip ? 50 : 900); break;
      case 'keep': keep(a[0]); break;
      case 'sky': skyUp(); break;
      case 'board': await board(a[0]); break;
      case 'choice': await choice(a[0]); break;
      case 'item': prog.shavings++; updatePouch(); toast(`黒い削りかすを、布に包んだ（${prog.shavings}）`); break;
      case 'pouch': scene.pouch = a[0] === 'show'; updatePouch(); break;
      case 'toast': toast(arg); Audio2.sfx.skill(); break;
      case 'tint': tints[a[0]] = a[1]; break;
      case 'flash': FX.flash(a[0] === 'black' ? '0,0,0' : '255,255,255', 1); break;
      case 'shake': if (document.documentElement.dataset.motion !== 'reduced') { stageShake?.cancel(); stageShake = document.getElementById('app').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(9px,-6px)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(0,0)' }], { duration: 500 }); } break;
      case 'sfx': Audio2.sfx[a[0]] && Audio2.sfx[a[0]](); break;
      case 'wait': await waitStage(Math.max(0, Math.min(60000, +a[0] || 0))); break;
      case 'furynews': {const mine=token;for(const line of parse(Fury.chat('mari_news'))){if(mine!==token)return 'stop';await runLine(line);}break;}
      case 'furychat': { const mine=token;for(const line of parse(Fury.chat(a[0]))){if(mine!==token)return 'stop';await runLine(line);}break;}
      case 'marichat': {const mine=token;for(const line of parse(MariReturn.chat(a[0]))){if(mine!==token)return 'stop';await runLine(line);}break;}
      case 'maribond': if(chapter==='restore4'){unlock('maribond');Board.saveParty();toast('マリーが精霊として仲間になった');} break;
      case 'vardbond': if(chapter==='fury'){unlock('vardbond');Board.saveParty();toast('紅角のヴァルドが仲間になった');} break;
      case 'sideend': {
        if((!SIDE_STORIES.includes(chapter)&&chapter!=='restore4')||!excursionReturn) break;
        const bookmark=excursionReturn,mariStory=chapter.startsWith('mari_')||chapter==='restore4';resetStage();excursionReturn=null;
        localStorage.setItem('cr_save',JSON.stringify(bookmark));World.open(mariStory?{}:{at:'f_fruit'});if(mariStory)Restoration.open();return 'stop';
      }
      case 'next': { if(chapter==='restore4'&&excursionReturn)return command('sideend','');const mine = token; unlock(a[0]); await fadeOut(); if (mine === token) toMap(a[0]); return 'stop'; }
      case 'rejoin': Restoration.join(); break;
      case 'restore': Restoration.complete(Number(a[0])); break;
      case 'priority': Restoration.priority(a[0]); await sayLine('アリア', Restoration.recall()); break;
      case 'recall': await sayLine('', Restoration.recall()); break;
      case 'restored': Restoration.finish(); break;
      case 'home': toMap('restored'); return 'stop';
      case 'end': unlock('done'); unlock('restore1'); await credits(); return 'stop';
    }
  }

  async function runLine(l) {
    if (l.t === 'cmd') return command(l.name, l.arg);
    if (l.t === 'center') return centerLine(l.text);
    if (l.t === 'say') return sayLine(l.who, l.text);
    return sayLine('', l.text);
  }

  // ---------- 進行 ----------
  async function run(from = 0) {
    const my = token; running = true;
    for (idx = from; idx < lines.length; idx++) {
      if (my !== token) return;
      const l = lines[idx];
      if (l.t !== 'cmd' || l.name === 'board' || l.name === 'choice') save();
      const r = await runLine(l);
      if (r === 'stop' || my !== token) return;
    }
    running = false;
  }
  function play(key, from = 0, restore) {
    if (!Object.hasOwn(SCRIPT, key)) return;
    if(SIDE_STORIES.includes(key)){
      if(key.startsWith('fury')?(!Fury.available()||key==='fury_reunion'&&!Fury.joined()):(!MariReturn.available()||key==='mari_reunion'&&!MariReturn.joined()))return;
      const bookmark=restore?.returnStory || load()?.returnStory || load() || {chapter:'act3',idx:0,map:true};
      restore={...bookmark,...restore,returnStory:bookmark};unlock(key);
    }
    if (key.startsWith('restore')) {
      if (!Restoration.canBegin(key)) return;
      unlock(key);
    }
    if(key==='restore4'&&!MariReturn.joined()&&Board.party.postgame.progress>=4){const bookmark=restore?.returnStory||load()?.returnStory||load();if(bookmark)restore={...restore,returnStory:bookmark};}
    chapter = key; lines = parse(SCRIPT[key]);
    if(key==='restore4'&&!MariReturn.joined()){const bond=lines.findIndex(l=>l.t==='cmd'&&l.name==='maribond');if(from>bond)from=lines.findIndex(l=>l.text?.startsWith('クリスタリアの苗床に芽が戻った朝'));}
    if (typeof World !== 'undefined') World.close();
    $('#title').classList.add('hide'); $('#title').style.display = 'none';
    resetStage();
    excursionReturn=SIDE_STORIES.includes(key)||key==='restore4'?restore?.returnStory||null:null;
    const st = CHAPTER_STATE[excursionReturn?.chapter || key] || { colors: [], shavings: 0 };
    Renoir.state.colors = (restore && restore.colors) || st.colors.slice();
    Renoir.state.sky = restore ? (restore.sky || 0) : (st.sky || 0);
    prog.shavings = restore?.shavings ?? st.shavings;
    if (restore && restore.tints) Object.assign(tints, restore.tints);
    if (restore && restore.scene) applyScene(restore.scene);
    updatePouch();
    run(from);
  }
  function resetStage() {
    clearSpeakerArt(); cgLayer.querySelectorAll('canvas').forEach(cv => GameArt.unmount(cv));
    abandon(); card.onclick = null; card.classList.add('hidden'); card.classList.remove('out'); nextMark.classList.remove('show');
    tb.classList.add('hidden'); centerEl.classList.remove('show'); choiceBox.classList.add('hidden'); choiceBox.innerHTML = '';
    cgLayer.innerHTML = ''; aria.classList.remove('show'); bigAura.classList.remove('show');
    for (const k in tints) delete tints[k];
    scene = defaultScene();
  }
  function applyScene(s) {
    if (s.bg) setBg(s.bg, s.preset); if (s.bgm) { scene.bgm = s.bgm; Audio2.playBgm(s.bgm); }
    if (s.fx) { scene.fx = s.fx; FX.set(s.fx); }
    if (s.aria) show('aria'); if (s.gran) show('gran', s.gran); if (s.mari) show('mari'); if (s.renoir) show('renoir');
    if (s.aura) setAura(s.aura); scene.pouch = s.pouch;
    (s.cgs || []).forEach(k => cg(k));
  }
  function fadeOut() {
    tb.classList.add('hidden'); return waitStage(400);
  }

  // ---------- 保存 ----------
  const lineId = l => {
    const text = JSON.stringify(l); let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  function cursorAt(index) {
    if (!lines[index]) return null;
    const id = lineId(lines[index]); let n = 0;
    for (let i = 0; i < index; i++) if (lineId(lines[i]) === id) n++;
    return { id, n };
  }
  function resumeIndex(s) {
    const chapterLines = parse(SCRIPT[s.chapter]);
    if (s.cursor) {
      let n = 0;
      for (let i = 0; i < chapterLines.length; i++) if (lineId(chapterLines[i]) === s.cursor.id && n++ === s.cursor.n) return i;
    }
    let at = s.idx;
    // 数値位置だけの旧セーブも、追加前の同じ台詞・命令へ戻す。
    if ((!s.scriptVersion || s.scriptVersion < 3) && typeof GUARDIAN_LEGACY_SCRIPTS !== 'undefined' && GUARDIAN_LEGACY_SCRIPTS[s.chapter] !== SCRIPT[s.chapter]) {
      const oldLines = parse(GUARDIAN_LEGACY_SCRIPTS[s.chapter]), old = oldLines[at];
      if (old) {
        const id=lineId(old), occurrence=oldLines.slice(0,at).filter(l=>lineId(l)===id).length;
        let n=0;
        for(let i=0;i<chapterLines.length;i++)if(lineId(chapterLines[i])===id&&n++===occurrence)return i;
      }
    }
    // この版で増えた序章のCG命令2行を、以前の数値位置へ足す。
    if (!s.scriptVersion && s.chapter === 'prologue' && at >= 106) at += at >= 109 ? 2 : 1;
    return Math.max(0, Math.min(chapterLines.length - 1, at));
  }
  function save() {
    try {
      localStorage.setItem('cr_save', JSON.stringify({ chapter, idx, cursor: cursorAt(idx), scriptVersion: 3, scene, colors: Renoir.state.colors, sky: Renoir.state.sky, shavings: prog.shavings, tints, ...(excursionReturn?{returnStory:excursionReturn}:{}), at: Date.now() }));
    } catch (e) {}
  }
  function load() { try { const value = SaveData.story(JSON.parse(localStorage.getItem('cr_save') || 'null')); return Object.hasOwn(SCRIPT, value.chapter) ? value : null; } catch (e) { return null; } }
  function unlocked() { try { const value = JSON.parse(localStorage.getItem('cr_unlocked') || '["prologue"]'); return Array.isArray(value) ? [...new Set(['prologue', ...value.filter(k => k === 'done' || k === 'vardbond' || k === 'maribond' || Object.hasOwn(SCRIPT, k))])] : ['prologue']; } catch (e) { return ['prologue']; } }
  function unlock(k) { try { const u = unlocked(); if (!u.includes(k)) u.push(k); localStorage.setItem('cr_unlocked', JSON.stringify(u)); } catch (e) {} }
  function cont() {
    const s = load(); if (!s) return false;
    if(s.chapter.startsWith('restore')&&!Restoration.canBegin(s.chapter)&&Board.party.postgame.progress>=3&&!MariReturn.joined()){play('restore4');return true;} if (s.map) { World.open(); return true; }
    const from = resumeIndex(s);
    if (s.chapter === 'prologue' && from >= 107 && from <= 109) { s.scene = s.scene || defaultScene(); s.scene.cgs = ['lila-wave']; }
    play(s.chapter, from, s); return true;
  }
  // 章の終わり：ワールドマップへ。次の章は地図の「物語」から始まる
  function toMap(next) {
    token++; running = false;
    try { localStorage.setItem('cr_save', JSON.stringify({ chapter: next, idx: 0, map: true, at: Date.now() })); } catch (e) {}
    resetStage();
    World.open({ arrive: next });
    if (next.startsWith('restore')) Restoration.open();
  }

  // ---------- 小物 ----------
  let toastT = null;
  function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600); }
  function updatePouch() { const p = $('#pouch'); p.classList.toggle('hidden', !scene.pouch || prog.shavings === 0); p.querySelector('.p-n').textContent = prog.shavings; }

  async function credits() {
    const mine = token;
    tb.classList.add('hidden'); cgLayer.innerHTML = '';
    const d = document.createElement('div'); d.className = 'cg cgItem credits';
    d.innerHTML = `<div style="font-size:15px;color:#b9c6de">（了）</div><div class="c1">Color Resonance</div><div>夜空の黒と透明の剣</div><div style="margin-top:30px;font-size:13px;color:#a3b0c7;letter-spacing:.12em;line-height:2">旅の続きを、好きな場所から。<br>地図の「王国復興」から、新しい旅へ。<br>クロムと歩く復興編・25の戦闘。<br>町には12の依頼と、小さな遊び。<br>手帳には、育てた絆から届く便りが残ります。</div>`;
    d.style.inset = '0'; cgLayer.appendChild(d); requestAnimationFrame(() => d.classList.add('show'));
    FX.set('stars:1');
    if (!await waitStage(2000) || mine !== token) return;
    if (!await waitAdvance(80) || mine !== token) return;
    Main.toTitle();
  }

  // ---------- 入力 ----------
  function updateBtns() {
    tb.querySelector('[data-act=auto]').classList.toggle('on', auto);
    tb.querySelector('[data-act=skip]').classList.toggle('on', skip);
  }
  tb.querySelectorAll('#tbButtons button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const act = b.dataset.act;
    if (act === 'auto') { auto = !auto; skip = false; if (auto && !typing) advance(); }
    if (act === 'skip') { skip = !skip; auto = false; if (skip) advance(); }
    if (act === 'log') showLog();
    if (act === 'menu') Main.gameMenu();
    updateBtns();
  }));
  function showLog() {
    Panel.open('これまでの言葉', log.slice(-120).map(l => `<div class="log-row">${l.who ? `<span class="ln">${l.who}</span>` : ''}${l.text}</div>`).join(''));
    const b = Panel.body(); b.scrollTop = b.scrollHeight;
  }
  document.getElementById('app').addEventListener('click', e => {
    if (Panel.isOpen() || !choiceBox.classList.contains('hidden')) return;
    if (Board.running && !inlineMode) return;
    if (e.target.closest('button') || e.target.closest('#title') || e.target.closest('#gate')) return;
    if (!card.classList.contains('hidden')) return;
    advance();
  });
  addEventListener('keydown', e => {
    if (Panel.isOpen()) { if (e.key === 'Escape' && !$('#panel').dataset.noclose) Panel.close(); return; }
    if (Board.running && !inlineMode) return;
    if (e.target.closest?.('button,input,select,textarea,a[href],[role="button"]')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    if (e.key === 'Control') { skip = true; updateBtns(); advance(); }
  });
  addEventListener('keyup', e => { if (e.key === 'Control') { skip = false; updateBtns(); } });
  const resumeAuto = () => {
    const owner = waiting;
    if (owner && (auto || skip) && !document.hidden && !Panel.isOpen()) later(() => { if (waiting === owner) advance(); }, skip ? 50 : 1400);
  };
  document.addEventListener('game-panel-closed', resumeAuto);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeAuto(); else { skip = false; updateBtns(); } });
  addEventListener('blur', () => { skip = false; updateBtns(); });
  addEventListener('wheel', e => { if (e.deltaY < -30 && !Board.running && running && !Panel.isOpen() && $('#title').style.display === 'none') showLog(); });

  return { play, cont, load, unlocked, resetStage, toast, setBg, clearLog() { log.length = 0; }, get chapter() { return chapter; }, stop() { abandon(); updateBtns(); } };
})();
