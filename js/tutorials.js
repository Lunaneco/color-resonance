// 新しい戦闘の仕組みが初めて出てくる戦いで、始まる前に数ページの説明を開く。
// 一度読んだ仕組みは二度と自動では開かない（cr_tutorials）。戦闘の「？」からいつでも読み直せる。
// 序章の入り江の吹き出し（cfg.tutorial）は別物で、こちらは仕組みごとの解説。
const Tutorials = (() => {
  const KEY = 'cr_tutorials';
  // 小さな盤の図。1文字が1マス。
  const GLYPH = {
    '.': ['', ''], r: ['rb', ''], '#': ['fog', ''], h: ['house', ''], s: ['sand', '▬'], '!': ['danger', ''],
    a: ['ally', 'ア'], n: ['ally noir', 'ノ'], p: ['ally', 'ス'], x: ['foe', '兵'], g: ['foe guard', '近'],
    f: ['flag', '⚑'], F: ['flag own', '⚑'], E: ['flag enemy', '⚑'], H: ['flag enemy hq', '本'], A: ['flag own hq', '本'],
    k: ['foe', '核'], w: ['warn', '!'], q: ['rb safe', '◇'], l: ['lamp', '灯'],
  };
  const grid = (rows, caption) => `<figure class="tut-grid" style="--cols:${rows[0].length}">${rows.join('').split('').map(ch => { const [cls, t] = GLYPH[ch] || GLYPH['.']; return `<i class="${cls}">${t}</i>`; }).join('')}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;

  // when(ctx)：その戦いにこの仕組みがあるか。old：この章まで進んだ古いセーブは、すでに知っているものとして開かない。
  const LIST = [
    { id: 'camp', title: '陣取り戦', when: c => !!c.camps, pages: [
      { h: '旗を奪い、本陣を落とす', fig: grid(['..E..H', '..#...', 'f...f.', '......', 'A.a...'], '⚑ 旗　本 本陣（青は味方・紫は敵）'),
        t: '盤には旗が立っています。<b>敵の本陣を奪えば勝ち</b>。自分の本陣を奪われるか、アリアが倒れると負けです。敵を全員倒さなくても勝てます。' },
      { h: '指揮点で、何度でも動く', fig: '<p class="tut-hud">TURN 1　指揮 <b>4/4</b>　拠点 <b>1/5</b></p>',
        t: 'ターンの初めに<b>指揮点</b>がたまります（基本3＋持っている旗の数）。行動を1回終えるたびに1点使います。<br>点が残っていれば、<b>同じ仲間を何度でも</b>動かせます。ただし同じ仲間が動くたびに、移動が1マスずつ減ります。点が尽きるとターンが終わります。' },
      { h: '旗の取り方', fig: grid(['......', '.rrr..', '.rar..', '.rrr..', '......'], '奪った旗の周りは、虹の床になる'),
        t: '<b>アリアとノアール</b>が、<b>隣に敵のいない旗</b>の上で止まると奪えます。周りの床が虹に染まり（アリアは3マス、ほかは2マス）、次のターンから指揮点が1増えます。<br>敵の兵も旗を奪い返し、周りをくすませます。' },
      { h: '迎撃と「危」', fig: grid(['..x...', '.!!!..', '!!a!!.', '.!!!..', '......'], '赤い床で止まると、迎撃される'),
        t: '敵の攻撃が届く床で移動を終えると、近くの敵が<b>2人まで迎撃</b>してきます。<br>右下の<b>「危」</b>（Dキー）で、見えている敵の攻撃が届く床を赤く表示できます。敵が動いたときは、味方が迎撃します。' },
      { h: '土嚢と建物', fig: grid(['hh....', 'hh.s..', '...a..', '..x.hh', '....hh'], '▬ 土嚢　■ 家・城壁'),
        t: '<b>土嚢</b>の上に立つと、離れたところからの攻撃と迎撃を<b>4割</b>減らせます。隣からの攻撃には効きません。敵も使います。<br>家と城壁は通れません。後ろに人が立つと、建物が透けて見えます。' },
      { h: '増援と、本陣を狙う騎兵', t: '敵の旗が残っていると、数ターンごとにそこから兵が出ます。<br>自分の本陣を狙ってくるのは<b>騎兵だけ</b>です。本陣の3マス以内に敵が来ると、ターンの初めに知らせます。一人、背中に残しておくと安心です。' },
    ] },
    { id: 'fog', title: '霧（潜伏）', when: c => !!c.fog, pages: [
      { h: '見えるのは、仲間の周りだけ', fig: grid(['######', '##..##', '#.na.#', '#rrrr.', '.rrrr.'], '見えない床は暗い霧になる'),
        t: '布告の黒が霧になって、盤を覆っています。見えるのは<b>仲間の周り</b>、<b>虹の床とその隣</b>、<b>味方の旗の周り</b>だけです。<br>見える距離はふつう3マス。<b>ノアールは斥候で5マス</b>先まで見えます。' },
      { h: '霧の中の兵', t: '霧の中の兵は盤に映らず、選ぶことも狙うこともできません。「危」にも出ません。<br>見えない兵の射程へ踏みこむと、着いたところで姿を現して迎撃してきます。旗の位置だけは霧の中でも見えます。<br><b>旗を取って虹を広げるほど、霧が晴れていきます。</b>' },
    ] },
    { id: 'guard', title: '虹の近衛', when: c => !!c.guards, pages: [
      { h: 'パレット王の眷属', fig: grid(['...H..', '..g...', '.x.x..', '......', '..a...'], '近 近衛は、旗の上から動かない'),
        t: '敵の本陣と旗には、王に仕える七人の近衛が一人ずつ立っています。偽の布告で色を黒く塗られた人たちです。<br>近衛は<b>持ち場から決して離れず</b>、届く相手だけを打ちます。周り2マスの兵は号令で攻撃が上がります。' },
      { h: '色を取り戻す', t: '近衛を倒すと黒が剥がれて色が戻り、<b>周りの床が虹</b>になります。近くの兵は動揺して弱まり、その近衛が立っていた旗からは<b>増援が出なくなります</b>。<br>近衛はそれぞれ特性を持っています。近衛を選ぶと、名前と特性が見られます。' },
    ] },
    // 敵の作戦（js/tactics.js）。進軍は始まる前に、増援・伏兵・第二形態はその場で初めて起きたときに開く。
    { id: 'charge', title: '敵の進軍', when: c => !!c.charge, pages: [
      { h: '決まったターンまで、敵は待つ', fig: '<p class="tut-hud">敵の作戦：<b>3</b>ターン目から進軍</p>',
        t: 'この戦場の敵は、しばらく持ち場で待っています。ミッション欄の<b>「敵の作戦」</b>に書かれたターンの敵の手番から、<b>一斉に動き出します</b>。<br>それまでに有利な場所を取り、敵が来る道に虹の床を広げておきましょう。近づきすぎると、そのターンより前でも動き出します。' },
    ] },
    { id: 'reinforce', title: '増援', when: () => false, pages: [
      { h: '増援が来る床', fig: grid(['..ww..', '......', '.x..x.', '......', '..a...'], '増 この手番の終わりに、ここへ増援が現れる'),
        t: '橙に光る<b>「増」</b>の床に、この手番の終わり（敵の手番の初め）に増援が現れます。ミッション欄の「敵の作戦」で、来るターンがわかります。<br>ふつうとやさしいでは、増援は現れた手番には動きません。<br><b>ハードでは、予告も「増」の床もなく現れ、その手番から動きます。</b>' },
    ] },
    { id: 'ambush', title: '伏兵', when: () => false, pages: [
      { h: '隠れていた敵', fig: grid(['..h...', '.hx...', '..a...', '......', '......'], '物陰に近づくと、伏兵が姿を現す'),
        t: '盤のどこかに、見えない<b>伏兵</b>が隠れていることがあります。物陰に近づくと姿を現し、近づいた仲間の<b>移動はそこで止まります</b>（取り消せません）。<br>伏兵は、その次の敵の手番から動きます。見える敵を倒しきっても、伏兵が残っていれば姿を現します。' },
    ] },
    { id: 'second', title: '第二形態', when: () => false, pages: [
      { h: 'もう一度、立ち上がる', t: '強い敵の中には、一度倒しても<b>黒をまとい直して立ち上がる</b>ものがいます。HPが半分ほど戻り、攻撃も上がります。周りの床がくすみ、手下を呼ぶこともあります。<br>第二形態は一度きりです。共鳴を残しておくと、立ち上がったところへ大技を合わせられます。' },
    ] },
    // 仲間の持ち味。その仲間が初めて戦いに加わったときに開く（まだ加わっていない仲間の名前は出さない）。
    { id: 'ally_gran', title: 'グラン', ally: true, when: c => c.allies.includes('gran'), pages: [
      { h: 'グランの戦い方', t: '空を泳ぐので、段差を気にせず動けます（移動5・射程1〜2）。<br>・召喚<b>「潮騒の帰還」</b>：降り立った周り2マスの穢れを押し流し、床を虹に染める。<br>・宿す<b>「深碧の刃」</b>：心剣の射程が2に。当てた場所から十字に虹が広がる。<br>陣取り戦の霧の中では、空から<b>4マス先</b>まで見通せます。' },
    ] },
    { id: 'ally_ivy', title: 'アイビー', ally: true, when: c => c.allies.includes('ivy'), pages: [
      { h: 'アイビーの戦い方', t: '離れたところから打つ後衛です（移動3・射程2〜3）。<br>・召喚<b>「茨ほどき」</b>：周り3マスの穢れを縛り、1ターン動けなくする。<br>・宿す<b>「翠蔦の刃」</b>：当てた穢れを縛り、与えた傷の3割を癒す。' },
    ] },
    { id: 'ally_spinel', title: 'スピネル', ally: true, when: c => c.allies.includes('spinel'), pages: [
      { h: 'スピネルの戦い方', fig: grid(['..x...', '.!!!..', '!!a!!.', '.!p!..', '......'], 'スの隣なら、迎撃が半分に'),
        t: '守りの固い壁役です（移動3・射程1）。<br>・召喚<b>「黄金の傷の光」</b>：味方全員を癒し、2ターン守りを固める。<br>・宿す<b>「金継ぎの刃」</b>：鉛を一太刀で砕き、守りを無視して切る。<br>陣取り戦では、<b>スピネルの隣</b>にいる仲間が受ける迎撃を半分に和らげます。' },
    ] },
    { id: 'ally_mari', title: 'マリー', ally: true, when: c => c.allies.includes('mari'), pages: [
      { h: 'マリーの戦い方', t: '空を飛び、離れたところから打ちます（移動4・射程2〜3）。<br>・召喚<b>「帰り道の羽音」</b>：味方全員に2ターン追い風（移動+1）。周り2マスを虹に戻す。<br>・宿す<b>「渡りの羽」</b>：移動+1。当てた周り1マスを虹に戻す。<br>陣取り戦の霧の中では、空から<b>4マス先</b>まで見通せます。' },
    ] },
    { id: 'spirits', title: '精霊の召喚と宿し', old: 'act2', when: c => c.spirits > 0, pages: [
      { h: '共鳴を使って、精霊の力を借りる', t: '戦うと<b>共鳴</b>がたまります。アリアのメニューの「精霊」から使えます。<br>・<b>召喚</b>（共鳴6）：盤に降り立ち、登場の大技のあと3ターン共に戦う。<br>・<b>心剣に宿す</b>（共鳴3）：3ターンのあいだ、通常攻撃が<b>毎ターン2回</b>になる。宿すのは行動を使わない。' },
      { h: '倒されたら', t: '召喚した精霊が倒されると、その戦闘中は再召喚も宿すこともできません。期限で帰った精霊は、また使えます。<br>召喚や宿しで絆と熟練が育ち、覚えた技は「覚えた技」から使えます。' },
    ] },
    { id: 'noir', title: 'ノアールの吸収', old: 'act2', when: c => c.noir, pages: [
      { h: '瀕死の穢れを飲みこむ', t: 'ノアールは<b>2マス以内</b>の、<b>HPが30%以下</b>の穢れを吸収できます。飲んだ穢れは消え、その形を一度だけ<b>技</b>として覚えます。<br>守り手やボスを飲むと、その相手だけの大技を覚え、ノアールのHPが30%戻り、共鳴が2増えます。' },
      { h: '預かった技', t: '覚えた技は、ノアールのメニュー「預かった技」から、共鳴を使って出せます（ふつうの技は2〜3、大技は4〜6）。<br>人の兵は穢れではないので、飲みません。' },
    ] },
    { id: 'guardian', title: '守り手との戦い', old: 'act2', when: c => c.guardian, pages: [
      { h: '三つの段階', t: '守り手は、HPが3分の2・3分の1を割るたびに段階が変わります。一撃で段階を飛び越すことはありません。段階が変わるたびに、穢れの奥から本人の声が戻ってきます。' },
      { h: '床の予告', fig: grid(['.ww...', '.wk...', '.ww...', '.qq...', '..a...'], '! 危ない床　◇ 虹の床は安全'),
        t: '守り手は、次に打つ床を<b>赤い点線と「!」</b>で予告します。予告された床から離れるか、<b>虹の床</b>（◇）に立てば、効果を受けません。盤を回しても、予告は同じ床を指します。' },
    ] },
    { id: 'companion', title: 'クロムと二人で', old: 'restore2', when: c => c.companion, pages: [
      { h: '二人を動かす', t: '復興編は、クロムも毎ターン操作できます。<b>アリアとクロムのどちらかが倒れると</b>再挑戦です。<br>クロムの切り札<b>四響エンチャント</b>（共鳴6・1戦闘に1回）は、3ターンのあいだ4精霊の力をまとめて宿し、通常攻撃が毎ターン2回になります。<br>陣取り戦では、クロムも旗を奪えます。' },
    ] },
    { id: 'beacons', title: '復興の灯', old: 'restore2', when: c => c.beacons, pages: [
      { h: '灯を点ける', fig: grid(['..l...', '.rrr..', '.rar..', '.rrr..', '......'], '灯 番号のついた復興の灯'),
        t: '敵の全滅に加えて、番号のついた<b>灯をすべて点ける</b>のが目的です。アリアとクロムの<b>「浄化」</b>（共鳴2）で、2マス以内の灯を選んでください。周り2マスも虹に戻ります。<br>防壁を持つ核には、灯が全部点くまで攻撃が届きません。' },
    ] },
    { id: 'sceptre', title: '双彩の王笏', old: 'finale', when: c => c.relic, pages: [
      { h: '1ターンに2体', t: 'パレット王から託された王笏があると、そのターンの1体目の召喚のあと、アリアの手番が残ります。メニューは「2体目の召喚」と「待機」だけになります。2体目を呼ぶと手番が終わります。' },
    ] },
    { id: 'fury', title: 'ヴァルドの憤怒', old: 'act4', when: c => c.fury, pages: [
      { h: '傷を力へ', t: 'ヴァルドは、<b>失ったHPのぶんだけ攻撃が上がります</b>。召喚したヴァルドも、ヴァルドを宿した心剣も同じです。情報欄に「憤怒 · 攻撃+○%」と出ます。<br>倒されると力も使えなくなるので、引き際を見極めて。' },
    ] },
  ];
  const ORDER = ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue', 'done', 'restore1', 'restore2', 'restore3', 'restore4', 'restore5', 'restore6', 'restore7', 'restore8', 'restored', 'seam'];
  function seen() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch {}
    // 初めてこの機能に出会ったセーブ：もう通り過ぎた章の仕組みは、知っているものとする
    let unlocked = [];
    try { unlocked = typeof Engine !== 'undefined' ? Engine.unlocked() : []; } catch {}
    const known = LIST.filter(t => t.old && unlocked.some(k => ORDER.indexOf(k) > ORDER.indexOf(t.old))).map(t => t.id);
    save(known);
    return known;
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify([...new Set(list)])); } catch {} }
  // 自動テスト中（WebDriver）は、勝手に開かない。テストで確かめるときは cr_tutorials_force を立てる。
  const automated = () => { try { return navigator.webdriver && !localStorage.getItem('cr_tutorials_force'); } catch { return false; } };
  function pending(ctx) {
    if (automated()) return [];
    const done = seen();
    return LIST.filter(t => !done.includes(t.id) && t.when(ctx)).map(t => t.id);
  }
  // ページをめくる説明を開き、閉じたら解決する
  function show(ids, opt = {}) {
    const pages = ids.flatMap(id => { const t = LIST.find(x => x.id === id); return t ? t.pages.map(p => ({ ...p, topic: t.title, ally: !!t.ally })) : []; });
    if (!pages.length) return Promise.resolve();
    if (opt.mark !== false) save([...seen(), ...ids]);
    return new Promise(resolve => {
      let i = 0, turning = false;
      const draw = () => {
        const p = pages[i], last = i === pages.length - 1;
        Panel.open(`${opt.title || (p.ally ? '新しい仲間' : 'はじめての仕組み')} · ${p.topic}`, `<div class="tut-page"><h4>${p.h}</h4>${p.fig || ''}<p>${p.t}</p></div>`, {
          footer: `<div class="tut-nav"><span>${i + 1} / ${pages.length}</span>${i ? '<button class="ghost" data-tut="prev">戻る</button>' : ''}<button class="btn-main" data-tut="${last ? 'done' : 'next'}">${last ? (opt.doneLabel || '戦いをはじめる') : '次へ'}</button></div>`,
          // ページをめくるために閉じるときは、まだ終わりではない
          onClose: () => { if (!turning) resolve(); },
        });
        document.querySelectorAll('#panel [data-tut]').forEach(b => b.onclick = () => {
          const a = b.dataset.tut;
          if (a === 'done') { Panel.close(); return; }
          i += a === 'next' ? 1 : -1;
          turning = true; Panel.close(); turning = false; draw();
        });
      };
      draw();
    });
  }
  // その場で初めて起きた仕組みを、一度だけ開く（読み終えるまで待つ）
  function once(id) {
    if (automated() || seen().includes(id) || !LIST.some(t => t.id === id)) return Promise.resolve();
    return show([id], { doneLabel: '戦いに戻る' });
  }
  // 読み直しの一覧は、もう読んだ説明だけ（まだ出会っていない仲間や仕組みの名前を出さない）
  const topics = () => { const done = seen(); return LIST.filter(t => done.includes(t.id)).map(t => ({ id: t.id, title: t.ally ? `仲間：${t.title}` : t.title })); };
  return { pending, show, once, topics, LIST, KEY };
})();
