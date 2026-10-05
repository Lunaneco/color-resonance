// 習得済みの技を素材で磨く。戦闘の外で利用し、育成と素材を同時に保存する。
const SkillForge = (() => {
  let spirit = 'gran', route = 'enchant';
  const materialRows = (party, cost) => Object.entries(cost).map(([id, need]) => {
    const m = Progression.materials[id], have = party.materials[id] || 0;
    return `<span class="sf-cost ${have < need ? 'short' : ''}" style="--material:${m.color}"><i aria-hidden="true">◆</i>${m.name}<b>${have} / ${need}</b></span>`;
  }).join('');
  function open() {
    if (Board.running) return;
    render();
  }
  function render(focusId) {
    const party = Board.reloadParty(), known = new Set(party.aria.skills);
    const list = Progression.skills.filter(s => s.spirit === spirit && s.route === route).sort((a, b) => a.at - b.at);
    Panel.open('スキル強化', `<div class="sf-workshop">
      <div class="sf-hero"><span class="sf-eyebrow">SPIRIT WORKSHOP</span><h3>集めた色で、技を磨く。</h3><p>習得済みの技を+3まで強化できます。消費共鳴はそのまま。絆の補正も重なります。<br>素材は戦闘・ミッション・遊びと、一部の町の店で集まります。</p></div>
      <details class="sf-bag"><summary>素材袋 <span>${Object.values(party.materials).reduce((n, v) => n + v, 0)}個 / 各${Progression.MATERIAL_MAX}個まで</span></summary><div class="sf-inventory">${Object.entries(Progression.materials).map(([id, m]) => `<div style="--material:${m.color}"><b><i aria-hidden="true">◆</i>${m.name}<em>${party.materials[id] || 0}</em></b><small>${m.desc}</small><span>${m.source}</span></div>`).join('')}</div></details>
      <div class="sf-spirits" role="group" aria-label="強化する精霊の技">${Object.entries(Progression.spirits).map(([id, s]) => `<button data-forge-spirit="${id}" aria-pressed="${spirit === id}" style="--spirit:${s.color}">${GameArt.portrait(id, 'sf-art')}<span>${s.name}</span></button>`).join('')}</div>
      <div class="sf-routes" role="group" aria-label="強化する習得系統">${Object.entries(Progression.routes).map(([id, r]) => `<button data-forge-route="${id}" aria-pressed="${route === id}">${r.name}</button>`).join('')}</div>
      <div class="sf-skills">${list.map(base => {
        const id = base.id, level = Progression.skillLevel(party, id), current = Progression.skill(party, id), cost = Progression.recipe(party, id);
        const learned = known.has(id), affordable = cost && Object.entries(cost).every(([key, n]) => party.materials[key] >= n);
        const next = level < 3 ? Progression.skill(party, id, level + 1) : null;
        return `<article class="sf-card ${learned ? '' : 'locked'}" data-forge-card="${id}"><div class="sf-card-head"><div><small>${base.type} · 共鳴${base.cost}</small><h4>${base.name}</h4></div><span class="sf-level">${level ? '+' + level : '未強化'}${level === 3 ? ' · MAX' : ''}</span></div><p>${current.desc}</p>
          ${!learned ? `<p class="sf-lock">${Progression.routes[route].name}熟練${base.at}で習得（現在${Progression.training(party, spirit, route)}）</p>` : next ? `<div class="sf-preview"><span>+${level + 1}に強化すると</span><b>${Progression.enhancement(base, level + 1)}</b></div><div class="sf-costs" aria-label="所持数 / 必要数">${materialRows(party, cost)}</div><button class="sf-upgrade" data-upgrade="${id}" ${affordable ? '' : 'disabled'}>+${level + 1}に強化する${affordable ? '' : ' · 素材不足'}</button>` : '<div class="sf-max">✦ この技は最大まで磨かれています</div>'}</article>`;
      }).join('')}</div><p class="sf-footnote">戦闘クリアの素材は毎回。ミッション達成は各難易度で初達成時、澄明の核は初S評価で受け取れます。遊びの素材も評価ごとに1回で、練習では獲得できません。</p>
    </div>`);
    const body = Panel.body();
    body.querySelectorAll('[data-forge-spirit]').forEach(b => b.onclick = () => { spirit = b.dataset.forgeSpirit; Audio2.sfx.choose(); render(); });
    body.querySelectorAll('[data-forge-route]').forEach(b => b.onclick = () => { route = b.dataset.forgeRoute; Audio2.sfx.choose(); render(); });
    body.querySelectorAll('[data-upgrade]').forEach(b => b.onclick = () => {
      if (Board.running || !b.isConnected || b.disabled) return;
      b.disabled = true;
      const result = Progression.upgrade(Board.party, b.dataset.upgrade);
      if (result.ok) { Board.saveParty(); World.refresh(); Audio2.sfx.levelup(); }
      Engine.toast(result.message); render(b.dataset.upgrade);
    });
    if (focusId) {
      const card = body.querySelector(`[data-forge-card="${focusId}"]`);
      card?.scrollIntoView({ block: 'nearest' });
      (card?.querySelector('button:not(:disabled)') || body.querySelector(`[data-forge-route="${route}"]`))?.focus({ preventScroll: true });
    }
  }
  return { open };
})();
