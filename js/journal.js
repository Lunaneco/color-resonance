// 読み終えた章と、使い続けた精霊からの便り。先の物語は開かない。
const Journal = (() => {
  const notes = [
    'リラが残したのは、冷えた指でもほどける結び目。アリアはそれをポケットへ入れ、濡れた子どもたちに毛布を掛けた。手だけが、いつも通りに動いていた。',
    '憎まないことと、許したことは同じではない。グランの悲しみは聞く。失った人と街への責任も、小さくしない。乾いた布を、隣へ一枚。',
    '誰かを先に決めつけず、温かい一杯を置く。急いで答えを出さなくても、向かいに座っていられる時間がある。',
    '茨が守ってきた気持ちも、茨の外に残った気持ちも、ひとつの正解にしない。芽が伸びるための隙間を、少しずつつくる。',
    '割れたところを、なかったことにはしない。金でつないだ場所が、その者の歩いてきた道を静かに示す。',
    'クリスタは、最初からあった名前。アリアは、リラがくれた名前。どちらかを消さず、自分の手でその続きを選ぶ。',
    '星が見えるのは、夜空に黒があるから。暗い色も、誰かから切り捨てるための色ではない。透明な剣が切り分けた先で、返事を待つ。',
    '気持ちが溶けて消える場所ではなく、隣同士で休める場所。カモミールは二人分と、もう一杯。誰の分かは、決めなかった。',
  ];
  const letters = {
    gran: [
      { at: 8, title: '凪を待つ間', text: '「遠くへ届く潮より、帰ってこられる潮を選ぼう。灯台の下で待つ人に、今日の海が怖くないと伝えたい。私には、まだ返しきれないものがある」\nグランは水鏡の端を、静かに岸へ向けた。' },
      { at: 20, title: '冷えた手を温める', text: '「癒しは、何も起きなかったことにする力ではない。冷えたぶんを温める力だ。傷が残る人の隣で、私も待っていよう」\nアリアは頷いて、余分な一杯を置いた。' },
      { at: 40, title: '岸へ戻る潮', text: '「泣き続けるだけでは、責任を取ったことにならない。今日の潮は、壊すためでなく、岸へ帰すために使う。君がそれを教えてくれた」\n大きな影が、雲の上で向きを変えた。' },
    ],
    ivy: [
      { at: 8, title: '若葉の隙間', text: '「縛るのは、傷つけるためじゃない。少し止まって、言えなかったことを聞けるようにするため」\n若葉が心剣へ絡む。握りを塞がないよう、一本だけゆるく結ばれていた。' },
      { at: 20, title: 'ほどける結び方', text: '「守りたい気持ちも、きつく結びすぎると痛くなるのね」\nアイビーは花守りの輪を広げた。輪の端には、いつでも外へ出られる隙間が残っていた。' },
      { at: 40, title: 'それぞれの枝', text: '「隣にいても、同じ向きへ伸びなくていい。あの人の花も、私の葉も、ここで休めるから」\n翠蔦の輪舞が止まると、踏み跡のまわりに小さな芽が残った。' },
    ],
    spinel: [
      { at: 8, title: '金の線', text: '「傷のところを、隠さなくていい」\nスピネルの胸の金が、心剣の刃へひとすじ移った。アリアはその線を指で追い、途中で消さずに、最後まで見た。' },
      { at: 20, title: '盾の内側', text: '「守られる側になっても、君の強さが減るわけではない」\n黄金の庇護がアリアの肩を包んだ。剣を下ろして息をする間も、旅の一部だった。' },
      { at: 40, title: '割れた場所から', text: '「割れた場所があるから、光を通せることもある」\n暁の砕光が鉛をほどく。そのあとに残った者の色を、スピネルは急いで言い当てなかった。' },
    ],
    king: [
      { at: 8, title: '空白の色', text: '「塗らない場所も、絵の一部だ」\n王はパレットの端を拭いた。アリアの透明な剣に、ひとつの色を押しつけず、小さな虹だけを預けた。' },
      { at: 20, title: '隣の色', text: '「調和とは、全部を同じ色にすることではない。隣の色を残せるよう、七色の結界には隙間がある」\nその内側で、アリアは自分の呼吸を聞いた。' },
      { at: 40, title: '続きを描く手', text: '「世界の色を守る仕事は、王ひとりのものではない。続きを選ぶ手が増えるほど、絵は広くなる」\n王の皿には、まだ使っていない色が残っていた。' },
    ],
  };
  const tabs = { journey: '旅の記録', letters: '精霊の便り', memories: '思い出', marks: '旅のしるし' };
  function achievements(p, unlocked, colors = []) {
    const stages = Object.values(p.stages), cleared = stages.filter(r => r.cleared).length;
    const learned = Progression.learned(p).length, friends = Progression.companions(unlocked, colors).length;
    const mini = p.minigames?.records || {}, lights = ['lantern', 'echo'].flatMap(id => Object.values(mini[id] || {})).filter(r => r.clears > 0).length;
    return [
      { title: '最初の澄み', desc: '序章の旅を終える', now: +unlocked.includes('act1'), total: 1 },
      { title: '三つの岸', desc: '異なる戦場を3つクリア', now: Math.min(3, cleared), total: 3 },
      { title: '言葉を残さず', desc: 'いずれかの戦場でSランク', now: +stages.some(r => r.best === 'S' || Object.values(r.difficulties || {}).some(d => d.best === 'S')), total: 1 },
      { title: '難しい岸へ', desc: 'ハードの難易度で戦場をクリア', now: +stages.some(r => r.difficulties?.hard?.cleared), total: 1 },
      { title: '四つの声', desc: '4精霊と旅をする', now: friends, total: 4 },
      { title: '響きを継ぐ', desc: '二つの系統から24種類の技を覚える', now: learned, total: 24 },
      { title: '六つの灯り', desc: '2種類の遊びを全3難易度で完成', now: lights, total: 6 },
      { title: 'もう一杯', desc: '物語の最後まで読む', now: +unlocked.includes('done'), total: 1 },
    ];
  }
  function open(tab = 'journey') {
    if (!Object.hasOwn(tabs, tab)) tab = 'journey';
    const p = Board.party, unlocked = Engine.unlocked(), colors = Engine.load()?.colors, marks = achievements(p, unlocked, colors), joined = Progression.companions(unlocked, colors);
    let body = '';
    if (tab === 'journey') body = `<div class="jn-timeline">${CHAPTERS.map((ch, i) => {
      const read = unlocked.includes(CHAPTERS[i + 1]?.key || 'done'), current = unlocked.includes(ch.key);
      return `<article class="jn-chapter ${read ? 'read' : ''}"><span class="jn-chapter-no">${String(i + 1).padStart(2, '0')}</span><div><small>${ch.act} ${read ? '・読み終えた物語' : current ? '・旅の途中' : '・これからの物語'}</small><h4>${current ? ch.title : 'まだ開いていないページ'}</h4><p>${read ? notes[i] : current ? 'この章を読み終えると、アリアの旅の記録が残ります。' : '出会いを重ねると、次のページが開きます。'}</p></div></article>`;
    }).join('')}</div>`;
    if (tab === 'letters') body = `<p class="jn-note">使い続けて育った絆から、精霊の言葉が届きます。絆8・20・40で一通ずつ。</p><div class="jn-letters">${joined.map(id => {
      const pages = letters[id], bond = p.spirits[id]?.bond || 0, spirit = Progression.spirits[id];
      return `<section class="jn-spirit" style="--jn-color:${spirit.color}"><h3>${spirit.name}<small>絆 ${bond}</small></h3>${pages.map(l => `<article class="jn-letter ${bond >= l.at ? 'opened' : 'locked'}"><small>絆 ${l.at}</small><h4>${bond >= l.at ? l.title : '封を開く日まで'}</h4><p>${bond >= l.at ? l.text.replaceAll('\n', '<br>') : `あと ${Math.max(0, l.at - bond)} の絆で、便りが届きます。`}</p></article>`).join('')}</section>`;
    }).join('') || '<p class="jn-note">精霊が仲間になると、ここに便りが届きます。</p>'}</div>`;
    if (tab === 'memories') body = unlocked.includes('act1') ? `<figure class="jn-memory"><img src="assets/cg/lila-wave-v1.png" alt="黒い波に飲まれながら綱を握り、別れを告げるリラ"><figcaption><small>序章・アクアミスト</small><h3>いってらっしゃい。</h3><p>リラの結び目と、最後に聞こえた黄色。戻らないものを戻ったことにせず、アリアはその続きを歩く。</p></figcaption></figure>` : '<div class="jn-locked-memory"><span aria-hidden="true">◇</span><h3>まだ開いていない思い出</h3><p>序章を読み終えると、このページに物語の一枚絵が残ります。</p></div>';
    if (tab === 'marks') body = `<p class="jn-note">遊び方を選んだ足跡。しるしは旅の成果から記録され、報酬の受け取り操作はありません。</p><div class="jn-marks">${marks.map(m => `<article class="jn-mark ${m.now >= m.total ? 'earned' : ''}"><span class="jn-mark-icon" aria-hidden="true">${m.now >= m.total ? '✦' : '◇'}</span><div><h4>${m.title}</h4><p>${m.desc}</p><progress value="${m.now}" max="${m.total}" aria-label="${m.title}"></progress><small>${m.now} / ${m.total}</small></div></article>`).join('')}</div>`;
    Panel.open('旅の手帳', `<div class="jn-book"><div class="jn-heading"><small>ARIA’S JOURNAL</small><h3>置き忘れないための、手帳。</h3><p>読み終えた物語と、育てた絆の続きを。</p><span>${marks.filter(m => m.now >= m.total).length} / ${marks.length} 旅のしるし</span></div><div class="jn-tabs" role="tablist" aria-label="手帳のページ">${Object.entries(tabs).map(([id, label]) => `<button role="tab" id="journal-tab-${id}" data-journal-tab="${id}" aria-selected="${id === tab}" aria-controls="journal-page" tabindex="${id === tab ? 0 : -1}">${label}</button>`).join('')}</div><div id="journal-page" role="tabpanel" aria-labelledby="journal-tab-${tab}">${body}</div></div>`);
    Panel.body().querySelectorAll('[data-journal-tab]').forEach(b => {
      b.onclick = () => { open(b.dataset.journalTab); Panel.body().querySelector(`[data-journal-tab="${b.dataset.journalTab}"]`).focus({ preventScroll: true }); };
      b.onkeydown = e => {
        const names = Object.keys(tabs), at = names.indexOf(b.dataset.journalTab);
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? names.length - 1 : (at + (e.key === 'ArrowLeft' ? -1 : 1) + names.length) % names.length;
          open(names[next]); Panel.body().querySelector(`[data-journal-tab="${names[next]}"]`).focus({ preventScroll: true });
        }
      };
    });
  }
  return { open, achievements };
})();
