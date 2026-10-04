// 画面全体の粒子：雨・光の粒・灰・金の塵・星
const FX = (() => {
  const cv = document.getElementById('fxCanvas');
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let modes = {}; // name -> intensity (0..1)
  const parts = [];
  let flash = 0, flashColor = '255,255,255';
  let last = performance.now();

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  function set(spec) {
    // spec: "rain:0.6,motes" / "none"
    const next = {};
    if (spec && spec !== 'none') spec.split(',').forEach(s => { const [k, v] = s.trim().split(':'); if (k) next[k] = v ? parseFloat(v) : 1; });
    modes = next;
    Audio2.rain(modes.storm ? 1 : modes.rain ? Math.min(1, modes.rain) * 0.7 : 0);
    // 星は固定配置
    parts.length = 0;
    if (modes.stars) for (let i = 0; i < 220 * modes.stars; i++) parts.push(star());
  }
  function intensity(name, v) { if (modes[name] !== undefined || v > 0) { modes[name] = v; if (name === 'rain' || name === 'storm') Audio2.rain(v * 0.8); } }
  function star() { return { k: 'star', x: Math.random() * W, y: Math.random() * H * 0.9, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.5 + Math.random() * 2 }; }

  const cnt = (rate) => { const n = rate; return Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0); };
  function spawn(dt) {
    const rain = modes.storm ? 1.6 : (modes.rain || 0);
    for (let i = 0, n = cnt(rain * 260 * dt); i < n; i++) parts.push({ k: 'rain', x: Math.random() * (W + 300) - 150, y: -20, vx: -120 - rain * 80, vy: 900 + Math.random() * 500, l: 12 + Math.random() * 18 * rain, a: 0.15 + Math.random() * 0.3 });
    if (modes.motes) for (let i = 0, n = cnt(modes.motes * 14 * dt); i < n; i++) parts.push({ k: 'mote', x: Math.random() * W, y: H + 10, vx: (Math.random() - .5) * 20, vy: -20 - Math.random() * 40, r: 1 + Math.random() * 2.6, life: 0, max: 6 + Math.random() * 6, hue: [140, 170, 50, 200][(Math.random() * 4) | 0] });
    if (modes.ash) for (let i = 0, n = cnt(modes.ash * 18 * dt); i < n; i++) parts.push({ k: 'ash', x: Math.random() * W, y: -10, vx: 10 + Math.random() * 20, vy: 18 + Math.random() * 30, r: 1 + Math.random() * 2, p: Math.random() * 6, life: 0, max: 20 });
    if (modes.gold) for (let i = 0, n = cnt(modes.gold * 16 * dt); i < n; i++) parts.push({ k: 'mote', x: Math.random() * W, y: H * Math.random(), vx: (Math.random() - .5) * 14, vy: -6 - Math.random() * 14, r: 0.8 + Math.random() * 2, life: 0, max: 4 + Math.random() * 5, hue: 44 });
    if (modes.sparkle) for (let i = 0, n = cnt(modes.sparkle * 10 * dt); i < n; i++) parts.push({ k: 'spark', x: Math.random() * W, y: Math.random() * H, life: 0, max: 0.8 + Math.random() * 1.2, r: 2 + Math.random() * 5 });
    if (modes.snow) for (let i = 0, n = cnt(modes.snow * 20 * dt); i < n; i++) parts.push({ k: 'ash', x: Math.random() * W, y: -10, vx: -6 + Math.random() * 12, vy: 22 + Math.random() * 26, r: 1 + Math.random() * 2.4, p: Math.random() * 6, life: 0, max: 30, white: true });
    if (modes.storm && Math.random() < dt * 0.12) { flash = 1; flashColor = '220,230,255'; Audio2.sfx.thunder(); }
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    spawn(dt);
    g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.k === 'rain') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        g.strokeStyle = `rgba(200,220,255,${p.a})`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.vx * 0.018, p.y - p.l); g.stroke();
        if (p.y > H + 20) parts.splice(i, 1);
      } else if (p.k === 'mote') {
        p.life += dt; p.x += p.vx * dt + Math.sin(p.life * 1.3 + p.r) * 0.3; p.y += p.vy * dt;
        const a = Math.sin(Math.PI * p.life / p.max);
        const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        grd.addColorStop(0, `hsla(${p.hue},90%,85%,${0.8 * a})`); grd.addColorStop(1, `hsla(${p.hue},90%,70%,0)`);
        g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r * 5, 0, 6.29); g.fill();
        if (p.life > p.max) parts.splice(i, 1);
      } else if (p.k === 'ash') {
        p.life += dt; p.p += dt; p.x += (p.vx + Math.sin(p.p) * 12) * dt; p.y += p.vy * dt;
        g.fillStyle = p.white ? `rgba(240,245,255,${0.6})` : `rgba(170,170,175,${0.45})`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fill();
        if (p.y > H + 10 || p.life > p.max) parts.splice(i, 1);
      } else if (p.k === 'spark') {
        p.life += dt; const a = Math.sin(Math.PI * p.life / p.max);
        drawSpark(g, p.x, p.y, p.r * a, `rgba(255,255,255,${a})`);
        if (p.life > p.max) parts.splice(i, 1);
      } else if (p.k === 'star') {
        p.p += dt * p.s; const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.p));
        g.fillStyle = `rgba(235,240,255,${a * (modes.stars || 0)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fill();
        if (p.r > 1.3 && a > 0.9) drawSpark(g, p.x, p.y, p.r * 3, `rgba(255,255,255,${(a - 0.9) * 6 * (modes.stars || 0)})`);
      }
    }
    if (flash > 0) {
      g.fillStyle = `rgba(${flashColor},${flash * 0.55})`; g.fillRect(0, 0, W, H);
      flash -= dt * 2.2;
    }
    requestAnimationFrame(frame);
  }
  function drawSpark(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
  }
  requestAnimationFrame(frame);

  function doFlash(color = '255,255,255', k = 1) { flash = k; flashColor = color; }
  return { set, intensity, flash: doFlash, drawSpark, get modes() { return modes; } };
})();
