// ルノワール：見るたびに形が少しずつ違う、小さな黒
const Renoir = (() => {
  const state = { colors: [], gulp: 0, sky: 0, mood: 0 };
  let castT = -Infinity;
  // 旅で残った色
  const HUES = { teal: '#3fb4c9', green: '#7fd67a', gold: '#ffd25e', violet: '#b48cff', yellow: '#ffe28a' };

  function blobPath(c, x, y, r, t) {
    c.beginPath();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + 0.07 * Math.sin(a * 3 + t * 1.1) + 0.05 * Math.sin(a * 5 - t * 1.7) + 0.035 * Math.sin(a * 2 + t * 0.6 + 1.3);
      const rr = r * k * (a > Math.PI * 0.15 && a < Math.PI * 0.85 ? 0.92 : 1); // 下側を少し平たく
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.86;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }

  function draw(c, x, y, r, t, opt = {}) {
    const gulp = state.gulp;
    const R = r * (1 + gulp * 0.18);
    if (GameArt.available('renoir')) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + R * .85, R * .8, R * .15, 0, 0, 6.29); c.fill();
      const castTime = performance.now() - castT, casting = castTime < (GameArt.animation('renoir', 'sky')?.durationMs || 0);
      const motion = casting ? 'sky' : gulp > .12 ? 'absorb' : 'idle';
      GameArt.drawMotion(c, 'renoir', motion, casting ? castTime : gulp > .12 ? (1 - gulp) * 650 + 280 : t * 1000, x, y + R * .75, R * 1.8, R * 2.1);
      const colors = opt.colors || state.colors, sky = opt.sky ?? state.sky;
      for (let i = 0; i < colors.length * 2 + Math.floor(sky * 16); i++) {
        c.globalAlpha = .5 + .4 * Math.sin(t * 2 + i);
        c.fillStyle = HUES[colors[i % Math.max(1, colors.length)]] || '#e8edff';
        c.beginPath(); c.arc(x + Math.sin(i * 97.13) * R * .65, y + Math.cos(i * 165.12) * R * .40, Math.max(1, r * .025), 0, 6.29); c.fill();
      }
      c.restore(); return;
    }
    c.save();
    // 影
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(x, y + R * 0.92, R * 0.8, R * 0.16, 0, 0, 6.29); c.fill();
    // 体
    blobPath(c, x, y, R, t);
    const grd = c.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R * 1.1);
    grd.addColorStop(0, '#2a2836'); grd.addColorStop(0.55, '#0b0a10'); grd.addColorStop(1, '#000');
    c.fillStyle = grd; c.fill();
    c.save(); c.clip();
    // 中に沈んだ色（星）
    const cols = opt.colors || state.colors;
    const sky = opt.sky ?? state.sky;
    const total = cols.length * 3 + Math.floor(sky * 60);
    for (let i = 0; i < total; i++) {
      const seed = i * 97.13;
      const px = x + Math.sin(seed) * R * 0.75 + Math.sin(t * 0.3 + seed) * 3;
      const py = y + Math.cos(seed * 1.7) * R * 0.6 + Math.cos(t * 0.27 + seed) * 3;
      const col = i < cols.length * 3 ? (HUES[cols[i % cols.length]] || '#fff') : ['#fff', '#cfe0ff', '#ffe9c4'][i % 3];
      const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + (i % 5) * 0.3) + seed);
      const sr = (i < cols.length * 3 ? 2.2 : 1.1) * (0.6 + tw * 0.6) * (r / 40);
      const gg = c.createRadialGradient(px, py, 0, px, py, sr * 5);
      gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.5 + tw * 0.5;
      c.fillStyle = gg; c.beginPath(); c.arc(px, py, sr * 5, 0, 6.29); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, sr * 0.6, 0, 6.29); c.fill();
    }
    c.globalAlpha = 1;
    // つや
    const hl = c.createLinearGradient(x, y - R, x, y);
    hl.addColorStop(0, 'rgba(255,255,255,.14)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.beginPath(); c.ellipse(x - R * 0.2, y - R * 0.5, R * 0.45, R * 0.22, -0.3, 0, 6.29); c.fill();
    c.restore();
    // 輪郭のゆらぎ
    c.strokeStyle = opt.glow ? `rgba(200,220,255,${0.35 + 0.25 * Math.sin(t * 2)})` : 'rgba(120,130,170,.18)';
    c.lineWidth = 1.2; blobPath(c, x, y, R, t); c.stroke();
    c.restore();
  }

  // HUD用のループ
  const hud = document.getElementById('renoirCanvas');
  const hg = hud.getContext('2d');
  function loop(t) {
    state.gulp *= 0.9;
    hg.clearRect(0, 0, 180, 180);
    draw(hg, 90, 86, 46, t / 1000, { glow: state.mood > 0 });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  GameArt.load(['renoir']);

  return { state, draw, HUES, gulp() { state.gulp = 1; }, skyCast() { castT = performance.now(); state.gulp = 1; } };
})();
