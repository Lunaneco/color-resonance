// 復興の記録は通常のパーティセーブへ。既存クリア済みセーブにも入口を用意する。
Object.entries(RESTORATION_GEAR).forEach(([id, gear]) => { EQUIP[id] = { ...gear, desc: fxText(gear.fx) }; });
const Restoration = (() => {
  const cleared = () => Engine.unlocked().includes('done');
  const joined = () => cleared() && Board.party.postgame.started;
  const record = () => Board.party.postgame;
  const save = () => { Board.saveParty(); World.refresh(); };
  function join() {
    if (!cleared()) return false;
    const p = Board.party;
    p.postgame.started = true;
    p.chrome.lv = Math.max(p.chrome.lv, p.aria.lv, 16);
    save(); return true;
  }
  function complete(n) {
    if (!joined() || !Number.isInteger(n) || n < 1 || n > 8 || !Board.party.stages['restore' + n]?.cleared || n > record().progress + 1) return false;
    record().progress = Math.max(record().progress, n); save(); return true;
  }
  function priority(value) {
    if (!joined() || !['bridge', 'garden'].includes(value)) return;
    record().priority ||= value; save();
  }
  const recall = () => record().priority === 'garden'
    ? '先に守った苗床には、新しい芽が出ていた。翌日つないだ橋を、種を運ぶ人が渡っていった。'
    : '先に直した橋を、離れていた家族が渡っていった。翌日守った苗床へ、その人たちが水を運んだ。';
  function available(conf) { return joined() && (conf.id.startsWith('restore') ? RESTORATION_CHAPTERS.findIndex(ch => ch.key === conf.id) < record().progress : (conf.gate || 0) < Math.max(1, record().progress)); }
  function canBegin(key) {
    if (!cleared()) return false;
    const i = RESTORATION_CHAPTERS.findIndex(ch => ch.key === key);
    if((i>3||key==='restored')&&!MariReturn.joined())return false;
    return i >= 0 ? i <= record().progress : key === 'restored' && record().progress === 8;
  }
  function begin(key) {
    if (!canBegin(key)) return;
    Panel.close(); Engine.play(key);
  }
  const rank = (conf, d) => Board.party.stages[conf.id]?.difficulties?.[d];
  function open(tab = 'journey') {
    if (!cleared()) return;
    if (!['journey', 'requests', 'legends'].includes(tab)) tab = 'journey';
    const p = Board.party, rec = record(), count = rec.progress;
    let body, storyDiffKey;
    if (tab === 'journey') {
      const s = Engine.load(), needsMari=count>=3&&!MariReturn.joined(), resume = !needsMari&&s&&s.chapter.startsWith('restore')&&!s.map;
      storyDiffKey=needsMari?'restore4':RESTORATION_CHAPTERS[count]?.key;
      body = `<div class="re-next"><div><small>${rec.finished ? '復興の結末を読み終えた旅' : '次の物語'}</small><h3>${resume ? '物語のつづきへ' : needsMari ? RESTORATION_CHAPTERS[3].title : count < 8 ? RESTORATION_CHAPTERS[count].title : '今日の色で、ただいま'}</h3><p>${needsMari ? 'マリーの帰還は復興本編の第4話。羽音へ道を開き、共に原本の窓を取り戻す。' : count < 8 ? RESTORATION_CHAPTERS[count].goal : '暮らしの復興は続く。残った依頼や伝説の旅へ。'}</p></div><button class="btn-main" data-re-story="${needsMari ? 'restore4' : resume ? 'resume' : count < 8 ? RESTORATION_CHAPTERS[count].key : 'restored'}">${needsMari ? 'マリーの声へ' : resume ? 'つづきから読む' : rec.finished ? '結末を振り返る' : '物語へ'}</button></div>
      ${storyDiffKey ? `<div class="re-difficulties" role="group" aria-label="次の物語の戦闘難易度">${Object.entries(Progression.difficulties).map(([key, d]) => `<button data-re-story-diff="${key}" aria-pressed="${Progression.selected(p, storyDiffKey) === key}"><b>${d.name}</b><span>適正LV ${Progression.level(RESTORATION_STAGES[storyDiffKey], key)}</span></button>`).join('')}</div>` : ''}
      <div class="re-map" aria-label="クリスタリアの復興地図">${RESTORATION_CHAPTERS.map((ch, i) => `<button class="re-place ${i < count ? 'restored' : i === count ? 'next' : 'locked'}" ${i < count ? 'data-re-stage' : 'data-re-story'}="${ch.key}" ${i > count ? 'disabled' : ''}><i>${i < count ? '✦' : i === count ? '◇' : '·'}</i><small>${String(i + 1).padStart(2, '0')} ${i < count ? '復興済み · 再出撃' : i === count ? '次の旅' : '道を開くと解放'}</small><b>${i <= count ? ch.place : 'まだ開いていない土地'}</b><span>${i <= count ? `適正LV ${ch.lv}〜${ch.lv + 3}` : '物語とともに解放'}</span></button>`).join('')}</div>
      ${joined() ? `<div class="re-duo"><div>${GameArt.portrait('aria')}<span><b>アリア · LV ${p.aria.lv}</b><small>心剣・精霊・浄化</small></span></div><div>${GameArt.portrait('chrome_human')}<span><b>クロム · LV ${p.chrome.lv}</b><small>人間の仲間 · ルノワールの浄化剣</small></span></div></div><p class="re-note">二人は毎ターン別々に移動・行動。どちらかが倒れると再挑戦。ルノワールは休憩中に元の姿へ戻れます。</p>` : '<p class="re-note">復興編の最初の物語で、人間に戻ったクロムが仲間になります。</p>'}`;
    } else {
      const list = tab === 'requests' ? RESTORATION_REQUESTS : LEGEND_QUESTS;
      body = `<p class="re-note">${tab === 'legends' ? '王国外の各地に残る最強の残響。難易度はハード固定。S評価で、その土地だけの伝説装備を初回獲得。高いLVとスキル強化、二人の連携を準備してください。' : '復興の道が開くたび、新しい依頼が届きます。難易度別に実績・初回報酬を記録します。'}</p><div class="re-contracts">${list.map(c => {
        const ready = available(c), d = c.hardOnly ? 'hard' : Progression.selected(p, c.id), result = rank(c, d);
        return `<button class="re-contract ${c.hardOnly ? 'legend' : ''}" data-re-stage="${c.id}" ${ready ? '' : 'disabled'}>${c.hardOnly ? InventoryArt.icon(c.unique) : '<i aria-hidden="true">✧</i>'}<span><small>${c.district} ${c.giver ? '· ' + c.giver : ''}</small><b>${ready ? c.title : '道を開くと届く依頼'}</b><em>${ready ? `${c.hardOnly ? '伝説級 / ' : ''}${Progression.difficulties[d].name} · 適正LV ${Progression.level(c, d)}` : !joined() ? '復興編でクロムが加入後に解放' : `復興編 第${c.gate + 1}話クリアで解放`}</em><small>${result?.best ? `${result.best}評価 · ${result.sRewardClaimed ? 'S報酬受取済み' : 'S報酬未獲得'}` : ready ? '未クリア' : ''}</small></span><strong>${result?.best || '→'}</strong></button>`;
      }).join('')}</div>`;
    }
    Panel.open('クリスタリアの復興', `<div class="re-book"><header class="re-hero"><small>AFTER THE NIGHT · CRYSTALIA</small><h2>今日の色で、明日の道へ。</h2><p>アリアとクロム、ルノワールの剣が辿る復興の旅。</p><div class="re-progress"><span>王国の復興 ${Math.round(count / 8 * 100)}%</span><progress value="${count}" max="8" aria-label="王国の復興"></progress><small>本編 ${count}/8話 · マリー救出2戦 · 復興依頼12戦 · 伝説5戦</small></div></header><nav class="re-tabs" aria-label="復興のページ">${Object.entries({ journey: '復興の地図', requests: '復興依頼', legends: '王国外の伝説' }).map(([id, label]) => `<button data-re-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</nav>${body}</div>`);
    const root = Panel.body();
    if(joined()&&tab==='journey'){
      const b=document.createElement('button');b.className='gj-recall';b.textContent='この章の通常戦・精霊ボス戦';b.onclick=()=>GuardianJourney.open(RESTORATION_CHAPTERS[Math.min(count,7)].key);root.querySelector('.re-book').append(b);
    }
    if(tab==='journey'&&MariReturn.joined()){
      const event=document.createElement('section');event.className='re-next';event.innerHTML=`<div><small>マリーと精霊たち · 旅の交流</small><h3>${MariReturn.joined()?'ただいまの、その先':'帰らない羽音'}</h3><p>${MariReturn.joined()?'精霊になったマリーと、仲間たちの旅は続く。':'地下に残る羽音を探す通常戦とボス戦。声の主へ帰る道をつなぐ。'}</p></div><button class="btn-main" id="mariStory">${MariReturn.joined()?'仲間の語らい':'羽音を探す'}</button>`;root.querySelector('.re-book').append(event);event.querySelector('#mariStory').onclick=()=>MariReturn.start(MariReturn.joined());
    }
    root.querySelectorAll('[data-re-tab]').forEach(b => b.onclick = () => open(b.dataset.reTab));
    root.querySelectorAll('[data-re-story]').forEach(b => b.onclick = () => { if (b.dataset.reStory === 'resume') { Panel.close(); Engine.cont(); } else begin(b.dataset.reStory); });
    root.querySelectorAll('[data-re-stage]').forEach(b => b.onclick = () => stage(b.dataset.reStage, tab));
    root.querySelectorAll('[data-re-story-diff]').forEach(b => b.onclick = () => { p.stageDifficulty[storyDiffKey] = b.dataset.reStoryDiff; save(); open(); });
  }
  function stage(id, back = 'journey') {
    const c = RESTORATION_STAGES[id];
    if (!c || !available(c)) return;
    const p = Board.party, d = c.hardOnly ? 'hard' : Progression.selected(p, id), result = rank(c, d), reward = Progression.rewards(c, d);
    Panel.open(c.title, `<div class="re-stage"><small>${c.act} · ${c.district || c.title}</small><h2>${c.title}</h2><p>${c.desc || c.goal}</p><div class="re-difficulties">${Object.entries(Progression.difficulties).filter(([key]) => !c.hardOnly || key === 'hard').map(([key, info]) => `<button data-re-diff="${key}" aria-pressed="${d === key}"><b>${info.name}</b><span>適正LV ${Progression.level(c, key)}</span></button>`).join('')}</div><p class="re-rule">敵を全滅させ、${c.restoreBeacons}つの復興の灯を「浄化」で点ける。${c.bossShield ? 'すべて点くまで核への攻撃は防壁に遮られます。' : ''}</p><div class="re-reward">${InventoryArt.icon(reward.sEquipment || Object.keys(reward.sItems)[0])}<div><small>${c.hardOnly ? 'ハードS評価 · 伝説装備' : `${Progression.difficulties[d].name}のS評価報酬`}</small><b>${reward.sEquipment ? EQUIP[reward.sEquipment]?.name : InventoryArt.chips(reward.sItems,'×')}</b><p>${reward.sEquipment ? EQUIP[reward.sEquipment]?.desc : '強化素材はクリア・ミッション初達成・初S評価で獲得します'}</p><small>${result?.sRewardClaimed ? 'この難易度のS報酬は受取済み' : '初S評価で獲得'}</small></div></div><p>${result?.best ? `${Progression.difficulties[d].name}の最高評価：${result.best}` : 'この難易度は未クリア'} · 現在アリアLV ${p.aria.lv} / クロムLV ${p.chrome.lv}</p><button data-re-back="1">一覧へ戻る</button></div>`, { footer: '<button class="btn-main" id="reSortie">二人で出発する</button>' });
    Panel.body().querySelectorAll('[data-re-diff]').forEach(b => b.onclick = () => { p.stageDifficulty[id] = b.dataset.reDiff; save(); stage(id, back); });
    Panel.body().querySelector('[data-re-back]').onclick = () => open(back);
    if (id.startsWith('restore')) {
      const replay = document.createElement('button'); replay.textContent = 'この土地の物語を読み返す'; replay.onclick = () => begin(id); Panel.body().querySelector('.re-stage').append(replay);
    }
    document.getElementById('reSortie').onclick = () => {
      if (!available(c)) return;
      Panel.close(); World.close(); Engine.resetStage();
      Engine.setBg(c.theme.bg, c.theme.preset); FX.set('stars:0.2'); Audio2.playBgm(c.theme.bgm);
      Board.start({ ...c, difficulty: d, resultLabel: '復興の地図へ戻る', intro: { who: 'ルノワール', text: '二人で灯を繋ごう。<br><small>「浄化」は共鳴2。2マス以内の灯を点ける。</small>' } }, () => { World.open(); open(back); });
    };
  }
  function finish() { if (cleared() && record().progress === 8) { record().finished = true; save(); } }
  return { cleared, joined, join, complete, priority, recall, available, canBegin, begin, open, stage, finish };
})();
