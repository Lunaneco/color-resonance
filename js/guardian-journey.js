const GuardianJourney = (() => {
  function available(conf) {
    const chapter=conf.chapterGate||GuardianCombat.profile(conf.guardianRoute)?.chapter;
    if (!chapter) return false;
    if (chapter === 'mari_return') return typeof MariReturn !== 'undefined' && MariReturn.available();
    if (chapter === 'fury') return typeof Fury !== 'undefined' && Fury.available();
    if (chapter.startsWith('restore')) return Restoration.joined() && Board.party.postgame.progress>=Number(chapter.slice(7))-1;
    return Engine.unlocked().includes(chapter);
  }
  const pathDone=p=>!!(Board.party.stages[p.pathId]?.cleared||p.legacy&&Board.party.stages[p.bossId]?.cleared);
  const mission=m=>({turns:`${m.n}ターン以内にクリア`,hp:`アリアのHP ${m.n}%以上`,rainbow:`虹の床 ${m.n}%以上`,dullMax:`くすみを${m.n}%未満に保つ`,enchantKill:`宿した心剣で${m.n}体倒す`,back:`背後から${m.n}回命中`,summonKill:`召喚した精霊で${m.n}体倒す`,bossLast:'ほかの影を払い、最後にボスの穢れをほどく',guardianVoice:'3段階の声を取り戻す',teamHP:`二人のHPをそれぞれ${m.n}%以上残す`,purify:`浄化を${m.n}回使う`})[m.type]||'戦場のミッションを達成';
  function history(records,id) {
    const p=GuardianCombat.profile(id);if(!p)return;
    Panel.open(p.name+'・戦場の声',`<div class="gj-voices"><header>${GameArt.portrait(p.art)}<div><small>切るのは穢れだけ</small><h2>${p.name}</h2><p>${p.counter}</p></div></header><p>「!」の予告は次の敵の手番に発動します。予告の床を虹にすると、床の侵食・傷・追加効果を防げます。HPが2/3・1/3になると、残った穢れが外へ広がり、行動と予告が変わります。</p>${records.map(rec=>`<section><h3>${rec.phase===3?'穢れをほどいた後':`${['Ⅰ','Ⅱ','Ⅲ'][rec.phase]} · ${GuardianCombat.phaseNames[rec.phase]}`}</h3>${rec.lines.map(([who,text])=>`<p><b>${who}</b><span>${text}</span></p>`).join('')}</section>`).join('')}</div>`);
  }
  function open(chapter) {
    const choices=GUARDIANS.filter(p=>available(GUARDIAN_STAGES['gp_'+p.id]));
    if(!choices.length)return;
    const selected=choices.find(p=>p.chapter===chapter)||choices.find(p=>!Board.party.stages[p.bossId]?.cleared)||choices[choices.length-1];
    const p=selected;
    Panel.open('章の戦場・汚染された精霊',`<div class="gj-book"><header class="au-banner"><small>GUARDIANS OF THE COLOURS</small><h3>道を開き、声を取り戻す。</h3><p>通常戦のあと、汚染された精霊の穢れをほどく。物語でも同じ二つの戦場を通ります。</p></header><nav class="gj-chapters" aria-label="解放済みの章">${choices.map(q=>`<button data-gj-chapter="${q.chapter}" aria-pressed="${q.id===p.id}">${q.act}</button>`).join('')}</nav><div class="gj-guardian">${GameArt.portrait(p.art)}<div><small>${p.act} · ${p.place}</small><h2>${p.name}</h2><p>${p.counter}</p><small>穢れHP 100% → 2/3 → 1/3 · 3段階の行動と会話</small></div></div><div class="gj-stages">${[p.pathId,p.bossId].map((id,i)=>{
      const c=GUARDIAN_STAGES[id],key=Progression.selected(Board.party,c.id),r=Board.party.stages[c.id]?.difficulties?.[key],locked=i&&!pathDone(p);
      return `<button data-gj-stage="${c.id}" ${locked?'disabled':''}><i>${i?'Ⅱ':'Ⅰ'}</i><span><small>${i?'ボス戦 · 汚染された精霊':'通常戦 · 道を開く'}</small><b>${c.title}</b><em>${Progression.difficulties[key].name} · 適正LV ${Progression.level(c,key)} · ${r?.best?r.best+'評価':'未クリア'}</em><small>${locked?'この章の通常戦をクリアすると解放':i?'理性が戻るたびに、予告とくすみが変化':'すべての影を払い、守り手へ進む'}</small></span><strong>→</strong></button>`;
    }).join('')}</div>${Board.party.stages[p.bossId]?.cleared?'<button class="gj-recall" id="gjRecall">取り戻した声を振り返る</button>':''}</div>`);
    const root=Panel.body();root.querySelectorAll('[data-gj-chapter]').forEach(b=>b.onclick=()=>open(b.dataset.gjChapter));root.querySelectorAll('[data-gj-stage]').forEach(b=>b.onclick=()=>stage(b.dataset.gjStage));
    root.querySelector('#gjRecall')?.addEventListener('click',()=>history([...p.lines.map((lines,phase)=>({phase,lines})),{phase:3,lines:[[p.name,p.freed]]}],p.id));
  }
  function stage(id) {
    const c=GUARDIAN_STAGES[id];if(!c||!available(c))return;
    const p=GuardianCombat.profile(c.guardianRoute);if(c.guardian&&!pathDone(p))return;
    const key=Progression.selected(Board.party,id),reward=Progression.rewards(c,key);
    Panel.open(c.title,`<div class="gj-stage">${GameArt.portrait(p.art)}<small>${c.act} · ${c.guardian?'精霊ボス戦':'通常戦'}</small><h2>${c.title}</h2><p>${c.desc}</p><div class="gj-diff" role="group" aria-label="戦場の難易度">${Object.entries(Progression.difficulties).map(([d,value])=>`<button data-gj-diff="${d}" aria-pressed="${key===d}"><b>${value.name}</b><small>適正LV ${Progression.level(c,d)}</small></button>`).join('')}</div><p>${c.guardian?'穢れHPの2/3・1/3で理性が戻り、くすみが広がる。予告を避けるか、虹の床に戻して防ぐ。':'すべての影を払い、守り手への道を開く。'}${c.postgame?'アリアと人間クロムをそれぞれ操作できます。':''}</p><div class="gj-loot"><b>クリア素材</b>${InventoryArt.chips(Progression.battleMaterials(c,key),'×')}<b>${Progression.difficulties[key].name}の初S報酬</b>${reward.sEquipment?InventoryArt.icon(reward.sEquipment)+EQUIP[reward.sEquipment].name:InventoryArt.chips(reward.sItems,'×')}<small>各ミッション初達成でも素材。各難易度の初Sで澄明の核×1。</small></div><button id="gjBack">章の戦場へ戻る</button></div>`,{footer:'<button class="btn-main" id="gjSortie">この戦場へ出発</button>'});
    Panel.body().querySelectorAll('[data-gj-diff]').forEach(b=>b.onclick=()=>{Board.party.stageDifficulty[id]=b.dataset.gjDiff;Board.saveParty();stage(id);});
    const missions=document.createElement('div');missions.className='gj-missions';missions.innerHTML='<b>S評価の条件</b><ul>'+c.missions.map(m=>'<li>'+mission(m)+'</li>').join('')+'</ul>'+(c.missionGuide?`<p class="wp-note gj-mission-guide">${c.missionGuide}</p>`:'');
    Panel.body().querySelector('.gj-loot').before(missions);
    document.getElementById('gjBack').onclick=()=>open(p.chapter);
    document.getElementById('gjSortie').onclick=()=>{
      if(!available(c)||c.guardian&&!pathDone(p))return;
      Panel.close();World.close();Engine.resetStage();Engine.setBg(c.theme.bg,c.theme.preset);FX.set(c.theme.fx);Audio2.playBgm(c.theme.bgm);
      Board.start({...c,difficulty:key,resultLabel:'章の戦場へ戻る'},()=>{World.open();open(p.chapter);});
    };
  }
  return {available,open,stage,history};
})();
