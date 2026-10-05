// 音：BGM（素材）と、色と音の効果音（WebAudioで合成）
const Audio2 = (() => {
  const TRACKS = { haruka: 'assets/audio/haruka.mp3', forest: 'assets/audio/forest.mp3', fate: 'assets/audio/fate.mp3' };
  let ctx = null, master = null, sfxGain = null, rainNode = null, rainGain = null;
  let bgm = null, bgmKey = null, rainLevel = 0;
  const vol = { bgm: 0.55, sfx: 0.7 };
  try { const s = JSON.parse(localStorage.getItem('cr_vol') || 'null'); if (s) for (const k of ['bgm', 'sfx']) if (typeof s[k] === 'number' && Number.isFinite(s[k])) vol[k] = Math.max(0, Math.min(1, s[k])); } catch (e) {}

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(master);
      // 残響
      const conv = ctx.createConvolver(); conv.buffer = impulse(2.8, 2.2);
      const wet = ctx.createGain(); wet.gain.value = 0.32; conv.connect(wet); wet.connect(comp);
      sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx;
      sfxGain.connect(comp); sfxGain.connect(conv);
    } catch (e) { ctx = null; }
  }
  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------- BGM ----------
  function playBgm(key, fade = 2000) {
    if (key === bgmKey) return;
    const old = bgm; bgmKey = key;
    if (old) fadeTo(old, 0, fade, () => { old.pause(); });
    if (!key || key === 'none' || !TRACKS[key]) { bgm = null; return; }
    const a = new Audio(TRACKS[key]); a.loop = true; a.volume = 0;
    a.play().catch(() => {});
    fadeTo(a, vol.bgm, fade);
    bgm = a;
  }
  function fadeTo(a, target, ms, done) {
    const start = a.volume, t0 = performance.now();
    if (a._fade) cancelAnimationFrame(a._fade);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      a.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k < 1) a._fade = requestAnimationFrame(step); else done && done();
    };
    a._fade = requestAnimationFrame(step);
  }
  function duck(on) { if (bgm) fadeTo(bgm, on ? vol.bgm * 0.35 : vol.bgm, 800); }
  function setVol(kind, v) {
    if (!['bgm', 'sfx'].includes(kind) || !Number.isFinite(+v)) return;
    v = Math.max(0, Math.min(1, +v));
    vol[kind] = v;
    if (kind === 'bgm' && bgm) { cancelAnimationFrame(bgm._fade); bgm._fade = null; bgm.volume = v; }
    if (kind === 'sfx' && sfxGain) { sfxGain.gain.value = v; rain(rainLevel); }
    try { localStorage.setItem('cr_vol', JSON.stringify(vol)); } catch (e) {}
  }

  // ---------- 合成音 ----------
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // ペンタトニック
  const BASE = 392; // G4
  function hz(step, base = BASE) { const o = Math.floor(step / SCALE.length); const s = SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length]; return base * Math.pow(2, (s + 12 * o) / 12); }

  function bell(freq, t = 0, dur = 1.6, gain = 0.18, type = 'sine') {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const o1 = ctx.createOscillator(); o1.type = type; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(sfxGain);
    o1.start(now); o2.start(now); o1.stop(now + dur + 0.05); o2.stop(now + dur + 0.05);
  }
  function noise(t, dur, gain, f1, f2, q = 1) {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const len = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f1, now); f.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(now); s.stop(now + dur);
  }
  function tone(freq, t, dur, gain, type = 'sine', glideTo) {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, now + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    o.connect(f); f.connect(g); g.connect(sfxGain); o.start(now); o.stop(now + dur + 0.05);
  }

  const sfx = {
    // 聴いた数（黒い音の数）で音の高さと濁りが変わる
    listen(n, delay = 0) {
      const step = Math.max(0, 7 - n);
      bell(hz(step), delay, n === 0 ? 2.2 : 1.4, n === 0 ? 0.12 : 0.15);
      if (n >= 2) bell(hz(step) * Math.pow(2, 1 / 12), delay + 0.01, 0.9, 0.04, 'triangle');
    },
    ripple(count) { for (let i = 0; i < Math.min(count, 10); i++) bell(hz(4 + i), i * 0.06, 1.8, 0.07); },
    cut() {
      noise(0, 0.5, 0.22, 7000, 1800, 0.8);
      [0, 4, 7, 9].forEach((s, i) => bell(hz(s + 5, 523), 0.04 + i * 0.045, 2.4, 0.11));
      tone(110, 0, 1.4, 0.12, 'sine', 55);
    },
    crack() { noise(0, 0.25, 0.25, 3000, 600, 2); tone(180, 0, 0.4, 0.1, 'triangle', 90); },
    miss() { noise(0, 0.7, 0.12, 600, 3000, 0.6); bell(hz(2, 262), 0.1, 1.2, 0.06); },
    expose() { tone(70, 0, 1.6, 0.35, 'sawtooth', 40); noise(0, 1.0, 0.2, 300, 80, 1.2); tone(74, 0, 1.2, 0.12, 'sawtooth', 41); },
    mark() { bell(hz(9, 523), 0, 0.5, 0.06, 'triangle'); },
    hover() { bell(hz(5, 784), 0, 0.15, 0.015); },
    skill() { [0, 2, 4, 7, 9, 12].forEach((s, i) => bell(hz(s, 523), i * 0.05, 1.6, 0.08)); noise(0, 1.2, 0.08, 400, 4000, 0.5); },
    win() { [0, 4, 7, 11, 14, 16, 19].forEach((s, i) => bell(hz(s, 330), i * 0.11, 3.2, 0.12)); },
    lose() { tone(98, 0, 3, 0.3, 'sawtooth', 49); noise(0, 3, 0.25, 200, 60, 0.8); },
    absorb() { tone(220, 0, 0.6, 0.08, 'sine', 70); },
    thread() { tone(55, 0, 4, 0.2, 'sine', 50); tone(82, 0.5, 3.5, 0.08, 'triangle', 80); },
    star(i = 0) { bell(hz(6 + (i % 6), 523), 0, 2.5, 0.07); },
    tear() { [12, 9, 7, 4, 2, 0].forEach((s, i) => bell(hz(s, 392), i * 0.32, 4, 0.1)); },
    page() { noise(0, 0.12, 0.03, 2500, 5000, 0.8); },
    choose() { bell(hz(4, 523), 0, 1, 0.07); },
    wrong() { bell(hz(1, 262), 0, 1.2, 0.06, 'triangle'); },
    thunder() { noise(0, 2.8, 0.5, 200, 40, 0.7); tone(45, 0, 2.5, 0.3, 'sine', 30); },
    wave() { noise(0, 3.5, 0.45, 180, 900, 0.5); noise(0.6, 3, 0.3, 900, 120, 0.5); },
    sword() { noise(0, 0.6, 0.18, 1500, 9000, 2); [7, 11, 14].forEach((s, i) => bell(hz(s, 523), 0.1 + i * 0.07, 2.2, 0.08)); },
    // 戦い
    hit() { noise(0, 0.2, 0.28, 2600, 380, 1.4); tone(150, 0, 0.28, 0.2, 'triangle', 60); },
    crit() { noise(0, 0.4, 0.38, 6000, 500, 1); tone(95, 0, 0.7, 0.28, 'sawtooth', 40); [0, 4, 7].forEach((s, i) => bell(hz(s + 7, 523), 0.06 + i * 0.04, 1.4, 0.09)); },
    heal() { [0, 2, 4, 7].forEach((s, i) => bell(hz(s + 4, 523), i * 0.08, 1.8, 0.07)); },
    levelup() { [0, 2, 4, 5, 7, 9, 10].forEach((s, i) => bell(hz(s, 523), i * 0.07, 1.8, 0.09)); },
    step() { noise(0, 0.07, 0.035, 900, 500, 1.2); },
    summon() { noise(0, 1.4, 0.16, 300, 5000, 0.6); [0, 2, 4, 6, 7, 9].forEach((s, i) => bell(hz(s, 392), 0.1 + i * 0.09, 2.4, 0.09)); tone(65, 0, 1.6, 0.18, 'sine', 130); },
    phase(enemy) {
      if (enemy) { tone(73, 0, 1.4, 0.22, 'sawtooth', 55); tone(77.8, 0.02, 1.2, 0.1, 'sawtooth', 58); noise(0, 1, 0.12, 250, 90, 1); }
      else [0, 4, 7, 9].forEach((s, i) => bell(hz(s, 392), i * 0.08, 2, 0.08));
    },
  };

  // 雨の環境音
  function rain(level) {
    rainLevel = Number.isFinite(+level) ? Math.max(0, Math.min(1.6, +level)) : 0; level = rainLevel;
    if (!ctx) return;
    if (!rainNode) {
      const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      rainNode = ctx.createBufferSource(); rainNode.buffer = b; rainNode.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 5200;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      rainNode.connect(f); f.connect(f2); f2.connect(rainGain); rainGain.connect(master); rainNode.start();
    }
    rainGain.gain.setTargetAtTime(level * 0.09 * (vol.sfx / 0.7), ctx.currentTime, 1.2);
  }

  return { resume, playBgm, duck, setVol, vol, sfx, rain, get bgmKey() { return bgmKey; } };
})();
