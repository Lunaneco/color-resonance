// 物語の進行（ノベル部分）
const $ = (s) => document.querySelector(s);

const Panel = (() => {
  const el = $('#panel'); let onClose = null;
  el.querySelector('.pn-close').onclick = () => close();
  el.addEventListener('mousedown', e => { if (e.target === el && !el.dataset.noclose) close(); });
  function open(title, html, opt = {}) {
    el.querySelector('.pn-title').textContent = title;
    el.querySelector('.pn-body').innerHTML = html;
    el.querySelector('.pn-close').style.display = opt.noClose ? 'none' : '';
    el.dataset.noclose = opt.noClose ? '1' : '';
    onClose = opt.onClose || null;
    el.classList.remove('hidden');
  }
  function close() { el.classList.add('hidden'); el.querySelector('.pn-body').innerHTML = ''; const f = onClose; onClose = null; f && f(); }
  return { open, close, isOpen: () => !el.classList.contains('hidden'), body: () => el.querySelector('.pn-body') };
})();

const Engine = (() => {
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

  let lines = [], idx = 0, chapter = null, running = false;
  let waiting = null, typing = false, typeTimer = null;
  let auto = false, skip = false, inlineMode = false;
  const log = [];
  const tints = {};
  let scene = defaultScene();
  const prog = { shavings: 0 };

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
      if (!el) { el = document.createElement('div'); el.dataset.show = 'gran'; el.className = 'cg'; el.innerHTML = '<img src="assets/img/gran.png" style="width:100%">'; Object.assign(el.style, { left: '50%', top: '5%', width: 'min(1150px,82vw)', transform: 'translateX(-50%)', animation: 'swim 16s ease-in-out infinite' }); cgLayer.appendChild(el); requestAnimationFrame(() => el.classList.add('show')); }
      el.querySelector('img').style.filter = opt === 'dark' ? 'brightness(.28) saturate(.25) contrast(1.2) drop-shadow(0 0 30px rgba(0,0,0,.8))' : opt === 'spirit' ? 'brightness(1.15) saturate(1.3) drop-shadow(0 0 40px rgba(140,210,255,.9))' : 'drop-shadow(0 0 30px rgba(120,200,255,.5))';
      el.querySelector('img').style.transition = 'filter 3s ease';
    } else if (what === 'mari') {
      scene.mari = true;
      if (!el) { el = document.createElement('div'); el.dataset.show = 'mari'; el.className = 'cg'; el.innerHTML = '<div style="position:absolute;inset:-30%;background:radial-gradient(circle,rgba(255,240,190,.55),transparent 60%);filter:blur(10px)"></div><img src="assets/img/mari.png" style="position:relative;width:100%;filter:drop-shadow(0 0 24px rgba(255,230,150,.7))">'; Object.assign(el.style, { right: '12vw', top: '12vh', width: 'min(440px,34vw)', animation: 'float 6s ease-in-out infinite' }); cgLayer.appendChild(el); requestAnimationFrame(() => el.classList.add('show')); }
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
    if (el) { el.classList.remove('show'); el.removeAttribute('data-show'); setTimeout(() => el.remove(), 1500); }
  }

  // CG（一時的な演出）
  let cgCanvas = null, threads = [];
  function cg(key) {
    if (key === 'off') { scene.cgs = []; cgLayer.querySelectorAll('.cgItem').forEach(e => { e.classList.remove('show'); setTimeout(() => e.remove(), 1400); }); cgCanvas = null; threads = []; return; }
    if (['sword', 'feather', 'flight', 'lands', 'night', 'day', 'tear', 'shavings', 'transform'].includes(key)) scene.cgs = [...(scene.cgs || []), key];
    const add = (html, style = {}, cls = '') => { const d = document.createElement('div'); d.className = 'cg cgItem ' + cls; d.innerHTML = html; Object.assign(d.style, style); cgLayer.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show'))); return d; };
    if (key === 'sword') {
      add('<img src="assets/img/sword.png" style="height:100%;filter:drop-shadow(0 0 30px rgba(220,235,255,.95))">', { left: '50%', top: '8vh', height: '74vh', transform: 'translateX(-50%) rotate(8deg)', animation: 'glint 3s ease-in-out infinite' });
      FX.flash('230,240,255', 0.5);
    } else if (key === 'feather') {
      add('<div style="position:absolute;inset:-120%;background:radial-gradient(circle,rgba(255,236,170,.6),transparent 60%);filter:blur(6px)"></div><img src="assets/img/feather.png" style="position:relative;height:100%;filter:drop-shadow(0 0 18px #fff3c0)">', { left: '50%', top: '26vh', height: '26vh', transform: 'translateX(-50%) rotate(-18deg)', animation: 'float 4s ease-in-out infinite' });
    } else if (key === 'transform') {
      const g = cgLayer.querySelector('[data-show="gran"]');
      if (g) { g.querySelector('img').style.filter = 'brightness(1.2) saturate(1.35) hue-rotate(8deg) drop-shadow(0 0 50px rgba(150,220,255,1))'; }
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
      setTimeout(() => cg('off'), 1600);
    } else if (key === 'tear') {
      add('<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(30,40,80,.4),rgba(0,0,0,.92))"></div><div class="tearDrop"></div>', { inset: '0' });
      Audio2.sfx.tear();
      setTimeout(() => { FX.flash('230,240,255', 0.7); }, 2900);
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
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 3500); Renoir.state.sky = k; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    for (let i = 0; i < 10; i++) setTimeout(() => Audio2.sfx.star(i), i * 260);
    FX.flash('220,230,255', 0.5);
  }

  // ---------- 章カード ----------
  function chapterCard(arg) {
    const [act, title] = arg.split('|');
    card.querySelector('.cc-act').textContent = act;
    card.querySelector('.cc-title').textContent = title;
    card.classList.remove('hidden', 'out');
    // アニメーションを再始動
    card.querySelectorAll('div').forEach(d => { d.style.animation = 'none'; d.offsetHeight; d.style.animation = ''; });
    return new Promise(res => {
      const done = () => { card.classList.add('out'); setTimeout(() => { card.classList.add('hidden'); res(); }, 1100); };
      const t = setTimeout(done, skip ? 600 : 3600);
      card.onclick = () => { clearTimeout(t); done(); card.onclick = null; };
    });
  }

  // ---------- 文字送り ----------
  function speedMs() { try { return +(localStorage.getItem('cr_speed') || 32); } catch (e) { return 32; } }
  function typeText(text) {
    textEl.innerHTML = '';
    nextMark.classList.remove('show');
    const sp = skip ? 0 : speedMs();
    const frag = document.createDocumentFragment();
    [...text].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.style.animationDelay = (i * sp) + 'ms'; frag.appendChild(s); });
    textEl.appendChild(frag);
    typing = true;
    clearTimeout(typeTimer);
    return new Promise(res => {
      const finish = () => { typing = false; nextMark.classList.add('show'); res(); };
      typeTimer = setTimeout(finish, text.length * sp + 200);
      completeType = () => { clearTimeout(typeTimer); textEl.querySelectorAll('.ch').forEach(s => s.style.animationDelay = '0ms'); finish(); };
    });
  }
  let completeType = null;

  function waitAdvance(textLen = 20) {
    return new Promise(res => {
      waiting = res;
      if (skip) setTimeout(() => advance(), 50);
      else if (auto) setTimeout(() => { if (waiting === res) advance(); }, 1400 + textLen * 70);
    });
  }
  function advance() {
    if (typing && completeType) { completeType(); return; }
    if (waiting) { const w = waiting; waiting = null; Audio2.sfx.page(); w(); }
  }

  async function sayLine(who, text) {
    tb.classList.remove('hidden');
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
    await typeText(text);
    await waitAdvance(text.length);
  }
  async function centerLine(text) {
    tb.classList.add('hidden');
    centerEl.innerHTML = text; centerEl.classList.add('show');
    log.push({ who: '', text: text.replace(/<br>/g, '') });
    await new Promise(r => setTimeout(r, skip ? 50 : 900));
    await waitAdvance(30);
    centerEl.classList.remove('show');
    await new Promise(r => setTimeout(r, skip ? 30 : 600));
  }

  // ---------- 選択 ----------
  function choice(key) {
    const C = CHOICES[key];
    tb.classList.add('hidden');
    const used = new Set();
    return new Promise(res => {
      const render = () => {
        choiceBox.innerHTML = `<div class="cprompt">${C.prompt}</div>`;
        C.options.forEach((o, i) => {
          const b = document.createElement('button'); b.textContent = o.t; if (used.has(i)) b.classList.add('used');
          b.onclick = async (e) => {
            e.stopPropagation();
            choiceBox.classList.add('hidden');
            if (o.ok) { Audio2.sfx.choose(); for (const l of parse(o.lines.join('\n'))) await runLine(l); res(); }
            else { Audio2.sfx.wrong(); used.add(i); for (const l of parse(o.lines.join('\n'))) await runLine(l); tb.classList.add('hidden'); render(); choiceBox.classList.remove('hidden'); }
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
    tb.classList.add('hidden'); hide('aria'); bigAura.classList.remove('show');
    skip = false; updateBtns();
    const conf = BOARDS[key];
    return new Promise(res => {
      if (key === 'chrome') {
        conf.onPhase0 = async () => {
          inlineMode = true;
          for (const l of parse(FINALE_PHASE0)) await runLine(l);
          tb.classList.add('hidden'); inlineMode = false;
          Board.enterPhase1({ skyCharges: Renoir.state.colors.length || 4, say: { who: 'アリア', text: '白い膜だけを、切り分ける。<br><small>メニューの「小さな夜空」で、ルノワールの夜空が床を取り戻してくれる</small>' } });
        };
      }
      Board.start(conf, () => { res(); });
    }).then(() => { if (scene.aura !== 'none') setAura(scene.aura); });
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
      case 'thread': thread(a[0]); await new Promise(r => setTimeout(r, skip ? 50 : 900)); break;
      case 'keep': keep(a[0]); break;
      case 'sky': skyUp(); break;
      case 'board': await board(a[0]); break;
      case 'choice': await choice(a[0]); break;
      case 'item': prog.shavings++; updatePouch(); toast(`黒い削りかすを、布に包んだ（${prog.shavings}）`); break;
      case 'pouch': scene.pouch = a[0] === 'show'; updatePouch(); break;
      case 'toast': toast(arg); Audio2.sfx.skill(); break;
      case 'tint': tints[a[0]] = a[1]; break;
      case 'flash': FX.flash(a[0] === 'black' ? '0,0,0' : '255,255,255', 1); break;
      case 'shake': document.getElementById('app').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(9px,-6px)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(0,0)' }], { duration: 500 }); break;
      case 'sfx': Audio2.sfx[a[0]] && Audio2.sfx[a[0]](); break;
      case 'wait': await new Promise(r => setTimeout(r, +a[0])); break;
      case 'next': unlock(a[0]); await fadeOut(); toMap(a[0]); return 'stop';
      case 'end': unlock('done'); await credits(); return 'stop';
    }
  }

  async function runLine(l) {
    if (l.t === 'cmd') return command(l.name, l.arg);
    if (l.t === 'center') return centerLine(l.text);
    if (l.t === 'say') return sayLine(l.who, l.text);
    return sayLine('', l.text);
  }

  // ---------- 進行 ----------
  let token = 0;
  async function run(from = 0) {
    const my = ++token; running = true;
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
    chapter = key; lines = parse(SCRIPT[key]);
    if (typeof World !== 'undefined') World.close();
    $('#title').classList.add('hide'); $('#title').style.display = 'none';
    resetStage();
    const st = CHAPTER_STATE[key] || { colors: [], shavings: 0 };
    Renoir.state.colors = (restore && restore.colors) || st.colors.slice();
    Renoir.state.sky = restore ? (restore.sky || 0) : (st.sky || 0);
    prog.shavings = restore ? restore.shavings : st.shavings;
    if (restore && restore.tints) Object.assign(tints, restore.tints);
    if (restore && restore.scene) applyScene(restore.scene);
    updatePouch();
    run(from);
  }
  function resetStage() {
    token++; waiting = null; typing = false;
    tb.classList.add('hidden'); centerEl.classList.remove('show'); choiceBox.classList.add('hidden');
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
    return new Promise(r => { tb.classList.add('hidden'); setTimeout(r, 400); });
  }

  // ---------- 保存 ----------
  function save() {
    try {
      localStorage.setItem('cr_save', JSON.stringify({ chapter, idx, scene, colors: Renoir.state.colors, sky: Renoir.state.sky, shavings: prog.shavings, tints, at: Date.now() }));
    } catch (e) {}
  }
  function load() { try { return JSON.parse(localStorage.getItem('cr_save') || 'null'); } catch (e) { return null; } }
  function unlocked() { try { return JSON.parse(localStorage.getItem('cr_unlocked') || '["prologue"]'); } catch (e) { return ['prologue']; } }
  function unlock(k) { try { const u = unlocked(); if (!u.includes(k)) u.push(k); localStorage.setItem('cr_unlocked', JSON.stringify(u)); } catch (e) {} }
  function cont() { const s = load(); if (!s || !SCRIPT[s.chapter]) return false; if (s.map) { World.open(); return true; } play(s.chapter, s.idx, s); return true; }
  // 章の終わり：ワールドマップへ。次の章は地図の「物語」から始まる
  function toMap(next) {
    token++; running = false;
    try { localStorage.setItem('cr_save', JSON.stringify({ chapter: next, idx: 0, map: true, at: Date.now() })); } catch (e) {}
    resetStage();
    World.open({ arrive: next });
  }

  // ---------- 小物 ----------
  let toastT = null;
  function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600); }
  function updatePouch() { const p = $('#pouch'); p.classList.toggle('hidden', !scene.pouch || prog.shavings === 0); p.querySelector('.p-n').textContent = prog.shavings; }

  async function credits() {
    tb.classList.add('hidden'); cgLayer.innerHTML = '';
    const d = document.createElement('div'); d.className = 'cg cgItem credits';
    d.innerHTML = `<div style="font-size:15px;color:#b9c6de">（了）</div><div class="c1">Color Resonance</div><div>夜空の黒と透明の剣</div><div style="margin-top:30px;font-size:13px;color:#7f8aa6;letter-spacing:.2em">おつかれさまでした。<br>章えらびと「共鳴の練習」がいつでも遊べます。</div>`;
    d.style.inset = '0'; cgLayer.appendChild(d); requestAnimationFrame(() => d.classList.add('show'));
    FX.set('stars:1');
    await new Promise(r => setTimeout(r, 2000));
    await waitAdvance(80);
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
    if (Panel.isOpen()) { if (e.key === 'Escape') Panel.close(); return; }
    if (Board.running && !inlineMode) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    if (e.key === 'Control') { skip = true; updateBtns(); advance(); }
  });
  addEventListener('keyup', e => { if (e.key === 'Control') { skip = false; updateBtns(); } });
  addEventListener('wheel', e => { if (e.deltaY < -30 && !Board.running && running && !Panel.isOpen() && $('#title').style.display === 'none') showLog(); });

  return { play, cont, load, unlocked, resetStage, toast, setBg, get chapter() { return chapter; }, stop() { token++; running = false; } };
})();
