// Live, interruptible feedback. Rules and saves finish first; effects only draw their trace.
const MinigameMotion = (() => {
  const colors = ['#8ae0ef', '#a4e9b6', '#ffe099', '#d1b3ff'];
  const arts = ['tide', 'leaf', 'gold', 'prism'];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set(), animations = new Set(), nodes = new Set();
  const blocked = new Map();
  let epoch = 0, active = null, skipButton = null, skipText = '', boardFocus = null;
  const reduced = () => document.documentElement.dataset.motion === 'reduced' || media.matches;
  function clear() {
    epoch++;
    timers.forEach(clearTimeout); timers.clear();
    animations.forEach(a => a.cancel()); animations.clear();
    nodes.forEach(node => node.remove()); nodes.clear();
    unlock();
    if (active) { active.classList.remove('mg-motion-playing', 'mg-motion-voyage', 'mg-action-feedback'); delete active.dataset.effect; }
    active = null;
  }
  function unlock() {
    blocked.forEach((wasDisabled, button) => { button.disabled = wasDisabled; }); blocked.clear();
    if (active) active.removeAttribute('aria-busy');
    if (skipButton?.isConnected) skipButton.textContent = skipText;
    if (boardFocus?.isConnected && (document.activeElement === document.body || document.activeElement === skipButton)) boardFocus.focus({ preventScroll: true });
    skipButton = boardFocus = null; skipText = '';
  }
  function lock(host) {
    boardFocus = host.contains(document.activeElement) ? document.activeElement : null;
    host.setAttribute('aria-busy', 'true');
    host.querySelectorAll('[data-gem]').forEach(button => { blocked.set(button, button.disabled); button.disabled = true; });
    skipButton = Panel.body().querySelector('[data-crystal-hint]');
    skipText = skipButton.textContent; skipButton.textContent = '連鎖演出を早送り';
    if (boardFocus) skipButton.focus({ preventScroll: true });
  }
  function later(fn, delay) {
    const token = epoch;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (epoch === token && active?.isConnected) fn();
    }, delay);
    timers.add(timer);
  }
  function animate(node, frames, duration = 420, delay = 0, remove = false) {
    if (!node || reduced()) return;
    const animation = node.animate(frames, { duration, delay, easing: 'cubic-bezier(.22,.7,.22,1)', fill: 'both' });
    animations.add(animation);
    animation.finished.then(() => {
      animations.delete(animation); animation.cancel();
      if (remove) { node.remove(); nodes.delete(node); }
    }, () => animations.delete(animation));
  }
  function start(host, kind, duration = 800) {
    clear();
    if (!host || !host.isConnected || !host.getBoundingClientRect().width) return null;
    active = host; host.dataset.effect = kind; host.classList.add('mg-action-feedback');
    later(clear, duration);
    if (reduced()) return null;
    const layer = document.createElement('div'); layer.className = 'mg-motion-layer';
    layer.setAttribute('aria-hidden', 'true'); host.append(layer); nodes.add(layer);
    return layer;
  }
  function point(host, element) {
    const h = host.getBoundingClientRect(), b = element.getBoundingClientRect();
    return { x: b.x - h.x + b.width / 2, y: b.y - h.y + b.height / 2, w: b.width, h: b.height };
  }
  function piece(layer, cls, x, y, color = colors[2]) {
    const node = document.createElement('span'); node.className = cls;
    node.style.left = `${x}px`; node.style.top = `${y}px`; node.style.setProperty('--motion-color', color);
    layer.append(node); nodes.add(node); return node;
  }
  function ring(layer, p, color, delay = 0, size = 70) {
    const node = piece(layer, 'mg-motion-ring', p.x, p.y, color);
    node.style.width = node.style.height = `${size}px`;
    animate(node, [{ opacity: .8, transform: 'translate(-50%,-50%) scale(.25)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }], 540, delay, true);
  }
  function sparks(layer, p, color, delay = 0, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count - Math.PI / 2, radius = 20 + i % 3 * 7;
      const node = piece(layer, 'mg-motion-spark', p.x, p.y, color);
      animate(node, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: .9, offset: .2 }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * radius}px),calc(-50% + ${Math.sin(angle) * radius}px)) scale(.25)` }], 520, delay, true);
    }
  }
  function label(layer, p, text, color = colors[2], delay = 0) {
    const node = piece(layer, 'mg-motion-label', p.x, p.y, color); node.textContent = text;
    animate(node, [{ opacity: 0, transform: 'translate(-50%,0) scale(.85)' }, { opacity: 1, offset: .2, transform: 'translate(-50%,-12px) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-32px) scale(1)' }], 720, delay, true);
    return node;
  }
  function sprite(layer, art, p, size = 48) {
    const image = document.createElement('img'); image.className = 'mg-motion-sprite'; image.alt = '';
    image.src = `assets/minigames/${art}.webp`; image.style.width = image.style.height = `${size}px`;
    image.style.left = `${p.x}px`; image.style.top = `${p.y}px`; layer.append(image); nodes.add(image); return image;
  }
  function link(layer, a, b, color, delay = 0) {
    const node = piece(layer, 'mg-motion-link', a.x, a.y, color);
    node.style.width = `${Math.hypot(b.x - a.x, b.y - a.y)}px`;
    node.style.rotate = `${Math.atan2(b.y - a.y, b.x - a.x)}rad`;
    animate(node, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: .9, offset: .45, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], 480, delay, true);
  }
  function lantern(index, mask, board) {
    const host = Panel.body().querySelector('.mg-lantern'), layer = start(host, 'light', 850);
    if (!layer) return;
    const lamps = [...host.querySelectorAll('[data-lamp]')], origin = point(host, lamps[index]);
    ring(layer, origin, colors[0], 0, origin.w);
    lamps.forEach((lamp, i) => {
      if (!(mask & 1 << i)) return;
      const p = point(host, lamp), lit = !!(board & 1 << i), delay = i === index ? 0 : 95;
      if (i !== index) link(layer, origin, p, lit ? colors[2] : colors[0]);
      animate(lamp.querySelector('.mg-prop'), [{ opacity: .45, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1.13)', offset: .55 }, { opacity: 1, transform: 'scale(1)' }], 410, delay);
      ring(layer, p, lit ? colors[2] : colors[0], delay, p.w * .65);
      if (lit) sparks(layer, p, colors[2], delay, 4);
    });
  }
  function echo(index, kind = 'listen', round = 0, input = 0) {
    const host = Panel.body().querySelector('.mg-echo'), layer = start(host, kind, kind === 'verse' ? 1100 : 750);
    if (!layer) return;
    const pad = host.querySelector(`[data-pad="${index}"]`), p = point(host, pad), color = kind === 'wrong' ? '#f0a7b4' : colors[index];
    ring(layer, p, color, 0, Math.min(p.w, p.h) * .8);
    ring(layer, p, color, 120, Math.min(p.w, p.h) * .65);
    if (kind === 'wrong') {
      animate(pad.querySelector('.mg-prop'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], 280);
      label(layer, p, 'もう一度', color);
      return;
    }
    animate(pad.querySelector('.mg-prop'), [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-5px) scale(1.12)', offset: .35 }, { transform: 'translateY(0) scale(1)' }], 430);
    sparks(layer, p, color);
    if (kind !== 'listen') {
      const dot = Panel.body().querySelector(`.mg-echo-progress i:nth-child(${input})`);
      if (dot) animate(dot, [{ transform: 'scale(.6)' }, { transform: 'scale(1.65)', offset: .4 }, { transform: 'scale(1)' }], 430);
      if (kind === 'verse') {
        const star = host.querySelector(`.mg-verse-stars i:nth-child(${round})`);
        if (star) {
          const to = point(host, star), orb = piece(layer, 'mg-motion-orb', p.x, p.y, color);
          animate(orb, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: .9, offset: .5, transform: `translate(${(to.x - p.x) * .5 - 4}px,${to.y - p.y - 16}px) scale(.8)` }, { opacity: 0, transform: `translate(${to.x - p.x - 4}px,${to.y - p.y - 4}px) scale(.2)` }], 600, 0, true);
          ring(layer, to, colors[2], 490, 32); sparks(layer, to, colors[2], 490, 8);
          animate(star, [{ transform: 'scale(.5)' }, { transform: 'scale(1.8)', offset: .5 }, { transform: 'scale(1)' }], 460, 460);
        }
      }
    }
  }
  function voyage(fromLane, mode, events, combo) {
    const host = Panel.body().querySelector('.mg-route-map'), duration = events.length === 2 ? 1200 : 950;
    const layer = start(host, mode, duration); if (!layer) return;
    const slots = [...host.querySelectorAll('.mg-ship-row>div')], ship = host.querySelector('.mg-ship-row .current .mg-prop');
    if (!ship || !slots[fromLane]) return;
    const from = point(host, slots[fromLane]), end = point(host, ship);
    const targets = events.map((event, i) => {
      const tile = host.querySelector(`[data-distance="${i + 1}"] [data-sea-lane="${event.lane}"]`);
      return tile ? point(host, tile) : { ...end, y: end.y - 42 * (i + 1) };
    });
    host.classList.add('mg-motion-voyage');
    const boat = sprite(layer, 'ship', from, Math.min(66, end.w)), keys = [{ transform: 'translate(-50%,-50%)', offset: 0 }];
    targets.forEach((p, i) => keys.push({ transform: `translate(calc(-50% + ${p.x - from.x}px),calc(-50% + ${p.y - from.y}px)) rotate(${mode === 'dash' ? -6 : 3}deg)`, offset: .35 + i * .25 }));
    keys.push({ transform: `translate(calc(-50% + ${end.x - from.x}px),calc(-50% + ${end.y - from.y}px))`, offset: 1 });
    animate(boat, keys, duration - 150, 0, true);
    ring(layer, from, colors[0], 0, 42);
    events.forEach((event, i) => {
      const p = targets[i], delay = i * 300 + 140;
      const art = { star: 'treasure', charge: 'wind', heart: 'heal', reef: 'reef' }[event.tile];
      if (art) {
        const item = sprite(layer, art, p, Math.min(p.w * .65, 46));
        animate(item, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' }, { opacity: 1, offset: .25, transform: 'translate(-50%,-50%) scale(1.1)' }, { opacity: 0, transform: 'translate(-50%,-90%) scale(.3)' }], 580, delay, true);
      }
      const color = event.hp < 0 ? '#f0a7b4' : event.tile === 'star' ? colors[2] : event.tile === 'heart' ? '#f2bfd3' : colors[0];
      ring(layer, p, color, delay, mode === 'guard' ? 72 : 50); sparks(layer, p, color, delay);
      if (event.guarded) {
        const shield = piece(layer, 'mg-motion-shield', p.x, p.y, colors[0]);
        animate(shield, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: .85, offset: .35, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.2)' }], 580, delay, true);
      }
      const text = event.guarded ? '護り成功' : event.hp < 0 ? `船体 ${event.hp}` : event.tile === 'heart' ? `癒し${event.hp ? ' +1' : ''}` : event.tile === 'charge' ? `風${event.charge ? ' +1' : ' 満タン'}` : event.gain ? `宝 +${event.gain}` : '無傷で前進';
      label(layer, p, text, color, delay);
    });
    if (mode === 'dash') link(layer, from, targets.at(-1), colors[0]);
    if (combo >= 2) label(layer, { x: host.clientWidth / 2, y: 35 }, `${combo} COMBO`, colors[2], 260);
  }
  function camp(choice) {
    const host = Panel.body().querySelector('.mg-voyage-scene'), layer = start(host, 'camp', 950); if (!layer) return;
    const p = { x: host.clientWidth / 2, y: host.clientHeight / 2 };
    const art = { repair: 'heal', wind: 'wind', treasure: 'treasure' }[choice], color = choice === 'treasure' ? colors[2] : colors[0];
    const item = sprite(layer, art, p, 65);
    animate(item, [{ opacity: 0, transform: 'translate(-50%,-20%) scale(.5)' }, { opacity: 1, offset: .4, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-85%) scale(.7)' }], 850, 0, true);
    ring(layer, p, color, 100, 110); sparks(layer, p, color, 180, 10);
    label(layer, { ...p, y: p.y + 35 }, { repair: '船を修復', wind: '風を補充', treasure: '秘蔵の宝 +28' }[choice], color, 200);
  }
  function tile(layer, p, value) {
    const node = piece(layer, 'mg-motion-cell', p.x - p.w / 2, p.y - p.h / 2, colors[value % 4]);
    node.style.width = `${p.w}px`; node.style.height = `${p.h}px`;
    const image = document.createElement('img'); image.src = `assets/minigames/${value >= 4 ? 'nova' : arts[value % 4]}.webp`; image.alt = ''; node.append(image);
    const caption = document.createElement('small'); caption.textContent = (value >= 4 ? '✦ ' : '') + ['≈ 潮', '❧ 芽', '◇ 金', '✧ 虹'][value % 4]; node.append(caption);
    if (value >= 4) node.classList.add('nova');
    return node;
  }
  function crystal(board, action, result) {
    const host = Panel.body().querySelector('.mg-crystal-grid');
    const swapTime = action.type === 'swap' ? 180 : 0, step = result.valid ? Math.min(270, 1700 / Math.max(1, result.frames.length)) : 0;
    const duration = result.valid ? swapTime + result.frames.length * step + 350 : 700;
    const layer = start(host, result.valid ? result.fever ? 'fever' : action.type : 'miss', duration); if (!layer) return;
    const rects = [...host.querySelectorAll('[data-gem]')].map(gem => point(host, gem));
    host.classList.add('mg-motion-playing');
    let cells = board.map((value, i) => tile(layer, rects[i], value));
    const swap = reverse => {
      const a = rects[action.a], b = rects[action.b];
      [[cells[action.a], a, b], [cells[action.b], b, a]].forEach(([node, from, to]) => animate(node, reverse ? [{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px)` }, { transform: 'translate(0,0)' }] : [{ transform: 'translate(0,0)' }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px)` }], reverse ? 240 : swapTime));
    };
    if (action.type === 'swap') swap(false);
    if (!result.valid) {
      later(() => swap(true), swapTime);
      label(layer, { x: host.clientWidth / 2, y: host.clientHeight / 2 }, '手数消費なし', '#f0b9c5', 150);
      return;
    }
    lock(host);
    const clearCells = () => { cells.forEach(node => { node.remove(); nodes.delete(node); }); };
    result.frames.forEach((frame, frameIndex) => later(() => {
      clearCells(); cells = frame.before.map((value, i) => tile(layer, rects[i], value));
      const color = result.fever ? colors[2] : colors[3];
      frame.clear.forEach(i => {
        animate(cells[i], [{ opacity: 1, transform: 'scale(1)' }, { opacity: .95, transform: 'scale(1.2)', offset: .35 }, { opacity: 0, transform: 'scale(.15)' }], step * .45, 0, true);
        if (frameIndex < 5) sparks(layer, rects[i], colors[frame.before[i] % 4], 0, 3);
      });
      frame.exploded.forEach(i => ring(layer, rects[i], colors[2], 0, rects[i].w * 2.6));
      if (frame.nova >= 0) { ring(layer, rects[frame.nova], colors[2], 0, rects[frame.nova].w * 1.5); }
      if (action.type === 'rainbow' && frameIndex === 0) {
        const row = Math.floor(action.index / 5), a = rects[row * 5], b = rects[row * 5 + 4];
        link(layer, { ...a, x: 0 }, { ...b, x: host.clientWidth }, colors[3]);
      }
      layer.querySelectorAll('.mg-chain-label').forEach(node => { node.remove(); nodes.delete(node); });
      label(layer, { x: host.clientWidth / 2, y: Math.min(45, host.clientHeight / 4) }, `${result.fever ? 'FEVER ×2 · ' : ''}${frameIndex + 1} CHAIN +${frame.gain}`, color).classList.add('mg-chain-label');
      later(() => {
        clearCells();
        const stride = rects[5].y - rects[0].y;
        cells = frame.falls.map(fall => {
          const end = rects[fall.to], from = fall.from >= 0 ? rects[fall.from] : { ...end, y: rects[fall.to % 5].y + Math.floor(fall.from / 5) * stride };
          const node = tile(layer, end, fall.value);
          if (from.y !== end.y) animate(node, [{ transform: `translateY(${from.y - end.y}px)`, opacity: fall.from < 0 ? .45 : 1 }, { transform: 'translateY(0)', opacity: 1 }], step * .52);
          return node;
        });
      }, step * .46);
    }, swapTime + frameIndex * step));
    later(() => {
      host.classList.remove('mg-motion-playing'); clearCells(); unlock();
      if (result.shuffled) { ring(layer, { x: host.clientWidth / 2, y: host.clientHeight / 2 }, colors[0], 0, 140); label(layer, { x: host.clientWidth / 2, y: host.clientHeight / 2 }, '新しい結晶へ', colors[0]); }
      const feedback = Panel.body().querySelector('.mg-cascade-feedback');
      animate(feedback, [{ transform: 'scale(.92)' }, { transform: 'scale(1.08)', offset: .45 }, { transform: 'scale(1)' }], 300);
    }, swapTime + result.frames.length * step);
  }
  function result(won, id) {
    const host = Panel.body().querySelector('.mg-result'), layer = start(host, won ? 'clear' : 'retry', 1300); if (!layer) return;
    const rank = host.querySelector('.mg-result-rank,.mg-failure-icon'), p = point(host, rank);
    animate(rank, [{ opacity: .5, transform: 'scale(.75)' }, { opacity: 1, transform: 'scale(1.08)', offset: .5 }, { opacity: 1, transform: 'scale(1)' }], 600);
    if (won) {
      ring(layer, p, colors[2], 80, 140); ring(layer, p, colors[3], 200, 100);
      sparks(layer, p, colors[2], 150, 14);
      const award = host.querySelector('.mg-hard-award .inventory-art');
      if (award) animate(award, [{ transform: 'scale(.6)' }, { transform: 'scale(1.2)', offset: .5 }, { transform: 'scale(1)' }], 650, 200);
    } else ring(layer, p, colors[0], 100, 95);
  }
  document.addEventListener('game-panel-closed', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('resize', clear);
  media.addEventListener('change', () => { if (media.matches) clear(); });
  new MutationObserver(() => { if (active && !active.isConnected) clear(); }).observe(document.querySelector('#panel'), { childList: true, subtree: true });
  new MutationObserver(() => { if (reduced()) clear(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return { clear, lantern, echo, voyage, camp, crystal, result };
})();
