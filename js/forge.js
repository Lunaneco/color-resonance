// 星の樹の枝は習得経路。四つの灯りは習得から+3までの実際の成長。
const SkillForge = (() => {
  let spirit = 'gran', route = 'enchant', selected = null, bagOpen = false, bloomSequence = 0;
  const sigils = { gran: '◈', ivy: '❧', spinel: '✧', king: '✦' };
  const coordinates = [[32, 22], [68, 44], [32, 66]];
  function materialRows(party, cost) {
    return Object.entries(cost).map(([id, need]) => {
      const m = Progression.materials[id], have = party.materials[id] || 0;
      return `<span class="sf-cost ${have < need ? 'short' : ''}" style="--material:${m.color}"><i aria-hidden="true">◆</i><span>${m.name}<b>${have} / ${need}</b></span><small>${have < need ? 'あと' + (need - have) : '揃っています'}</small></span>`;
    }).join('');
  }
  function open(options = {}) {
    if (Board.running) return;
    if (options.spirit) spirit = options.spirit;
    if (options.route && Progression.routes[options.route]) route = options.route;
    if (options.skill) selected = options.skill;
    render();
  }
  function render(focus, bloom) {
    const oldBody = Panel.body(), same = !!oldBody.querySelector('.sf-workshop'), scroll = same ? oldBody.scrollTop : 0;
    if (same) bagOpen = !!oldBody.querySelector('.sf-bag')?.open;
    const party = Board.reloadParty(), known = new Set(party.aria.skills);
    const joined = Progression.companions(Engine.unlocked(), Engine.load()?.colors);
    if (!joined.includes(spirit)) spirit = joined.find(id => Progression.learned(party, id).length) || joined[0] || null;
    const list = Progression.skills.filter(s => s.spirit === spirit && s.route === route).sort((a, b) => a.at - b.at);
    if (!list.some(s => s.id === selected)) selected = list.find(s => known.has(s.id))?.id || list[0]?.id || null;
    const s = Progression.spirits[spirit], points = spirit ? Progression.training(party, spirit, route) : 0;
    const nextLearn = list.find(s => !known.has(s.id));
    const tree = list.length ? `<div class="sf-tree" aria-label="${s.name}の${Progression.routes[route].name}の星の樹">
      <div class="sf-tree-caption"><span>枝の星を選んで、技を磨く</span><small>点灯＝習得・強化済み</small></div>
      <svg class="sf-branches" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${list.map((base, i) => {
        const [x, y] = coordinates[i]; return `<path class="${known.has(base.id) ? 'lit' : ''}" d="M50 91 C50 70 ${x} ${y + 22} ${x} ${y}"/>`;
      }).join('')}</svg>
      ${list.map((base, i) => {
        const level = Progression.skillLevel(party, base.id), learned = known.has(base.id), [x, y] = coordinates[i];
        return `<button class="sf-node ${learned ? 'known' : 'locked'}" data-forge-skill="${base.id}" aria-pressed="${selected === base.id}" aria-label="${base.name}、${learned ? '強化' + level + '段階' : '未習得、熟練' + base.at + 'で習得'}" style="--x:${x}%;--y:${y}%"><i class="sf-node-star" aria-hidden="true">${learned ? sigils[spirit] : '◇'}</i><span><b>${base.name}</b><small>${learned ? base.type + ' · 共鳴' + base.cost : '熟練 ' + base.at + ' で習得'}</small><span class="sf-node-lights" aria-hidden="true">${[0, 1, 2, 3].map(n => `<i class="${learned && n <= level ? 'lit' : ''}">${n ? '+' + n : '✦'}</i>`).join('')}</span></span></button>`;
      }).join('')}
      <div class="sf-root" aria-hidden="true">${GameArt.portrait(spirit, 'sf-root-art')}<span>${s.name}の色</span></div><div class="sf-tree-seal" aria-hidden="true">✧</div>
    </div>` : '<div class="sf-tree sf-empty"><span aria-hidden="true">✧</span><h4>色の種は、まだ夢のなか。</h4><p>精霊が仲間になると、覚えた技が<br>この樹に小さな星を灯します。</p><small>集めた素材は、素材袋で待っています。</small></div>';
    const base = list.find(b => b.id === selected);
    Panel.open('スキル強化 · 星の樹', `<div class="sf-workshop" style="--spirit:${s?.color || '#b7dfe9'}">
      <header class="sf-hero"><div><span class="sf-eyebrow">THE CELESTIAL GROVE</span><h3>星の樹</h3><p>旅で集めた色が、あなたの技に咲く。</p></div><span class="sf-hero-seal" aria-hidden="true">✧</span></header>
      ${joined.length ? `<div class="sf-spirits" style="--sf-columns:${joined.length};--sf-mobile-columns:${Math.min(2, joined.length)}" role="group" aria-label="強化する精霊の技">${joined.map(id => `<button data-forge-spirit="${id}" aria-pressed="${spirit === id}" style="--spirit:${Progression.spirits[id].color}">${GameArt.portrait(id, 'sf-art')}<span>${Progression.spirits[id].name}</span><i aria-hidden="true">${sigils[id]}</i></button>`).join('')}</div>
      <div class="sf-routes" role="group" aria-label="強化する習得系統">${Object.entries(Progression.routes).map(([id, r]) => `<button data-forge-route="${id}" aria-pressed="${route === id}"><span aria-hidden="true">${id === 'enchant' ? '⚔' : '✧'}</span><span>${r.name}<small>${id === 'enchant' ? '心剣に宿す力' : '隣に呼ぶ力'}</small></span></button>`).join('')}</div>
      <div class="sf-progress"><span>${s.name} <b>熟練 ${points}</b></span><span>習得 ${list.filter(s => known.has(s.id)).length}/3 · 満開 ${list.filter(s => known.has(s.id) && Progression.skillLevel(party, s.id) === 3).length}/3</span></div>` : ''}
      <div class="sf-layout ${base ? '' : 'empty'}">${tree}${base ? detail(party, base, points, known.has(base.id), bloom) : ''}</div>
      ${nextLearn ? `<p class="sf-next-learn">次に灯る星 <b>${nextLearn.name}</b> · 熟練${nextLearn.at}で習得（あと${Math.max(0, nextLearn.at - points)}）</p>` : ''}
      <details class="sf-bag" ${bagOpen ? 'open' : ''}><summary><span><i aria-hidden="true">◈</i> 素材袋</span><small>${Object.values(party.materials).reduce((n, v) => n + v, 0)}個 <i aria-hidden="true">⌄</i></small></summary><div class="sf-inventory">${Object.entries(Progression.materials).map(([id, m]) => `<div style="--material:${m.color}"><i class="sf-crystal" aria-hidden="true">◆</i><div><b>${m.name}<em>${party.materials[id] || 0}</em></b><small>${Progression.materialDescription(id, joined)}</small><span>${m.source}</span></div></div>`).join('')}</div><p class="sf-cap">各素材 ${Progression.MATERIAL_MAX}個まで保存できます。</p></details>
      <details class="sf-guide"><summary>素材の集め方 <span aria-hidden="true">＋</span></summary><p>戦闘クリアの素材は毎回。ミッション達成は各難易度で初達成時、澄明の核は初S評価で受け取れます。遊びの素材も評価ごとに1回で、練習では獲得できません。一部の町の店でも購入できます。</p></details>
    </div>`);
    const body = Panel.body(); body.scrollTop = scroll;
    body.querySelectorAll('[data-forge-spirit]').forEach(b => b.onclick = () => { spirit = b.dataset.forgeSpirit; Audio2.sfx.choose(); render(`[data-forge-spirit="${spirit}"]`); });
    body.querySelectorAll('[data-forge-route]').forEach(b => b.onclick = () => { route = b.dataset.forgeRoute; Audio2.sfx.choose(); render(`[data-forge-route="${route}"]`); });
    body.querySelectorAll('[data-forge-skill]').forEach(b => b.onclick = () => { selected = b.dataset.forgeSkill; Audio2.sfx.choose(); render(`[data-forge-skill="${selected}"]`); });
    body.querySelector('.sf-tree')?.addEventListener('keydown', e => {
      if (!e.target.matches('[data-forge-skill]') || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const index = list.findIndex(s => s.id === selected), delta = ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1;
      body.querySelector(`[data-forge-skill="${list[(index + delta + list.length) % list.length].id}"]`)?.click();
    });
    body.querySelectorAll('[data-upgrade]').forEach(b => b.onclick = () => {
      if (Board.running || !b.isConnected || b.disabled) return;
      b.disabled = true;
      const result = Progression.upgrade(Board.party, b.dataset.upgrade);
      if (result.ok) { Board.saveParty(); World.refresh(); Audio2.sfx.levelup(); }
      if (!result.ok) Engine.toast(result.message);
      render(`[data-upgrade="${b.dataset.upgrade}"]`, result.ok);
    });
    if (bloom && document.documentElement.dataset.motion !== 'reduced') {
      const success = body.querySelector('.sf-success'), effect = document.createElement('img');
      effect.src = 'assets/ui/star-bloom.gif?bloom=' + ++bloomSequence; effect.alt = ''; effect.className = 'sf-bloom'; success?.append(effect);
      setTimeout(() => effect.remove(), 1500);
    }
    if (focus) (body.querySelector(focus) || body.querySelector(`[data-forge-skill="${selected}"]`))?.focus({ preventScroll: true });
    if (focus?.startsWith('[data-forge-skill') && matchMedia('(max-width:760px)').matches) body.querySelector('.sf-card')?.scrollIntoView({ block: 'nearest' });
    if (bloom) body.querySelector('.sf-success')?.scrollIntoView({ block: 'nearest' });
  }
  function detail(party, base, points, learned, bloom) {
    const id = base.id, level = Progression.skillLevel(party, id), current = Progression.skill(party, id), cost = Progression.recipe(party, id);
    const affordable = cost && Object.entries(cost).every(([key, n]) => (party.materials[key] || 0) >= n);
    return `<article class="sf-card ${learned ? '' : 'locked'}" data-forge-card="${id}">
      <div class="sf-card-head"><small>${Progression.routes[route].name}の枝 · ${base.type}</small><span class="sf-level">${learned ? level ? '+' + level : '未強化' : '未習得'}${learned && level === 3 ? ' · MAX' : ''}</span></div>
      <h4>${base.name}</h4><div class="sf-skill-meta"><span>共鳴 <b>${base.cost}</b></span><span>射程 <b>${base.range}</b></span>${base.radius ? `<span>範囲 <b>${base.radius}</b></span>` : ''}</div><p class="sf-description">${current.desc}</p>
      <ol class="sf-growth" aria-label="習得と強化段階">${[0, 1, 2, 3].map(n => `<li class="${learned && n <= level ? 'lit' : ''} ${learned && n === level ? 'current' : ''}"><span aria-hidden="true">${n === 3 ? '✦' : '◇'}</span><b>${n ? '+' + n : '習得'}</b><small>${['色の種', '芽吹き', '開花', '満開'][n]}</small></li>`).join('')}</ol>
      ${!learned ? `<div class="sf-lock"><b>まだ眠っている星</b><p>${Progression.routes[route].name}熟練${base.at}で習得（現在${points}）</p><progress value="${Math.min(points, base.at)}" max="${base.at}" aria-label="習得までの熟練度"></progress><small>戦闘で${route === 'enchant' ? 'この精霊を心剣に宿す' : 'この精霊を召喚する'}と熟練が育ちます。<br>あと${Math.max(0, base.at - points)}で、この枝に星が灯ります。</small></div>` : level < 3 ? `<div class="sf-preview"><span>次の星 <b>+${level + 1}</b></span><div><small>現在</small><p>${Progression.enhancement(base, level).replace('威力+0%', '威力' + base.power + '倍')}</p><small>強化後</small><b>${Progression.enhancement(base, level + 1)}</b></div></div>
      <div class="sf-cost-label">星を灯す素材 <small>所持 / 必要</small></div><div class="sf-costs">${materialRows(party, cost)}</div><button class="sf-upgrade" data-upgrade="${id}" ${affordable ? '' : 'disabled'}><span aria-hidden="true">✦</span> +${level + 1}に強化する${affordable ? '' : ' · 素材不足'}</button><small class="sf-preserve">消費共鳴と射程はそのまま。絆の力も重なります。</small>` : `<div class="sf-max"><span aria-hidden="true">✦</span><b>この枝の星は、満開です。</b><p>${Progression.enhancement(base, level)}</p><small>最大強化 +3 · さらに絆の補正が重なります。</small></div>`}
      ${bloom ? `<div class="sf-success" role="status"><b>✦ ${base.name} +${level}</b><span>新しい星が灯りました</span></div>` : ''}</article>`;
  }
  return { open };
})();
