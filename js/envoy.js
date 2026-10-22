// 本編の陣取り戦「王の遣い兵」。偽の布告で黒く塗られた兵が、町に黒い旗を立てている。
// 精霊の章へ差し込まず、章の区切りにマップから読む独立した「王国編」3話。
// テラ・コッタには置かない（最終章のほかに戦闘を置かない決まり）。
// 戦いの仕組み（指揮点・拠点の占領・迎撃・本陣）は board.js の cfg.encounter.camps が受け持つ。兵は穢れではないので、倒すと黒い塗りが剥がれて我に返る。
// 陣取り戦の盤は手で描く（戦場のヴァルキュリアの市街戦の形）。文字の意味は board.js の layoutMap を参照。
// 上の行ほど奥（敵の側）、下の行ほど手前（アリアの側）。
const CAMP_LAYOUTS = {
  // 雨の港：左は海と桟橋、右は倉庫の丘。敵の本陣は奥の桟橋の先。海沿いの道は速いが丘の弓に狙われ、路地は遠回りだが家に隠れられる。
  camp_port: {
    palette: { wall: '#7d8796', wallDark: '#4f5866', roof: '#3f6a78', roofDark: '#2b4a55', glow: '#ffd28a' },
    ground: [
      '~~~=~~~=~~~~~',
      '~~~=~~~=~~~,,',
      '~~.........,.',
      '==..HH.HH.:::',
      '~~..HH.HH.:H:',
      '~~..........:',
      '==..HH.HHH...',
      '~~..HH.......',
      '~~.....HH.HH.',
      '==.....HH....',
      '~~...........',
    ],
    marks: [
      '       E     ',
      '             ',
      '      s1s    ',
      '          3e ',
      '             ',
      '   2  n   s  ',
      'n            ',
      '       4     ',
      '    s        ',
      '             ',
      '           A ',
    ],
  },
  // 石の子の村：谷底から三段の段々畑を登る。上の段への入口は三つ。真ん中は近いが重装兵が塞ぎ、左右は遠いが敵の旗を落とせる。
  camp_valley: {
    palette: { wall: '#b29a76', wallDark: '#7c6849', roof: '#8a5a3c', roofDark: '#5e3d29', glow: '#ffcf7a' },
    ground: [
      'mm##H###H##mm',
      'm###########m',
      'm:rrHr:rHrr:m',
      'm:::::::::::m',
      'm::H::H::H::m',
      'm:::::::::::m',
      'mrr.rrHr.rr.m',
      '.............',
      '.HH....HH..H.',
      '.H...........',
      '....HH...HH..',
      '.............',
    ],
    marks: [
      '      E      ',
      '   3 s s 4   ',
      '      1      ',
      '  s      2s  ',
      ' e         n ',
      '    5 n      ',
      '             ',
      '   s    s    ',
      '     n       ',
      '             ',
      'n            ',
      '         A   ',
    ],
  },
  // 虹の城下町：大通りが城門まで一本。広場の噴水が道を割り、左右の通りには敵の旗。門の前は土嚢で固められている。
  camp_town: {
    palette: { wall: '#e6e0f0', wallDark: '#a79fbd', roof: '#8a6cc4', roofDark: '#5f4a8e', glow: '#fff0b8' },
    ground: [
      'WWWWW:::WWWWW',
      'H...H:::H...H',
      'H.H.........H',
      '..H.HH.HH.H..',
      '.............',
      'HH.H.....H.HH',
      '.....~~~.....',
      'HH.H.....H.HH',
      '.............',
      '.H.HH...HH.H.',
      '.H.........H.',
      '.............',
    ],
    marks: [
      '      E      ',
      '  n  3 4     ',
      '     s2s     ',
      ' e    5    e ',
      '  1   s      ',
      '             ',
      ' n         n ',
      '             ',
      '     s s     ',
      '             ',
      '             ',
      '      A      ',
    ],
  },
};
// パレット王の眷属「虹の近衛」。王の印のある命令には逆らえない七人で、偽の布告を最初に受け取り、色を黒く塗られた。
// 陣取り戦では、敵の本陣と敵の旗に一人ずつ立つ（並びは本陣、敵の旗の順）。倒すと色が戻り、我に返る。
// 最初の陣取り戦（港）だけは、近衛を少し弱くしてある。
// trait：reach 槍の間合い / fog 霧を濃くする（見える距離−1） / guard 大盾 / might 剛力 / raid 本陣を狙う騎兵 / root 蔓で足を縛る / lead 近衛の長
// 絵は assets/generated の cmd_<id>。まだ無いときは兵の絵を近衛の色で塗る。設定と絵の指示は docs/rainbow-guard.md。
const RAINBOW_GUARD = {
  marina: { id: 'marina', name: '青のマリナ', color: '#7fb8ff', rgb: [40, 110, 200], kind: 's_captain', trait: 'reach', hp: 1.5, atk: 1.15, def: 1.1, rng: [1, 2], sight: '桟橋は、黒で揃える', freed: '……わたしの槍、こんなに青かったっけ' },
  sion: { id: 'sion', name: '藍のシオン', color: '#8f8cff', rgb: [50, 50, 150], kind: 's_bow', trait: 'fog', hp: 1.9, atk: 1.2, def: 1.2, rng: [2, 4], sight: '霧の奥から、全部見えてる', freed: '霧が、晴れていく……' },
  ocher: { id: 'ocher', name: '黄のオーカー', color: '#ffd760', rgb: [170, 130, 30], kind: 's_captain', trait: 'guard', hp: 1.6, atk: 1.1, def: 1.6, sight: '割れ目は、見せるな', freed: '盾が、軽い' },
  amber: { id: 'amber', name: '橙のアンバー', color: '#ffad60', rgb: [190, 100, 30], kind: 's_heavy', trait: 'might', hp: 1.7, atk: 1.5, def: 1.1, sight: '火を落とせ。温かいものは、全部黒に', freed: '……あったかい' },
  viola: { id: 'viola', name: '紫のヴィオラ', color: '#d6a8ff', rgb: [120, 60, 170], kind: 's_captain', trait: 'lead', hp: 1.9, atk: 1.3, def: 1.25, rng: [1, 2], sight: 'この門は、通さない', freed: '剣を、収める' },
  carmine: { id: 'carmine', name: '赤のカーマイン', color: '#ff8a8a', rgb: [180, 40, 50], kind: 's_cavalry', trait: 'raid', hp: 1.7, atk: 1.3, def: 1.1, mov: 1, sight: '本陣ごと、踏みつぶす！', freed: '……止まれた' },
  verde: { id: 'verde', name: '緑のヴェルデ', color: '#8ee6a0', rgb: [40, 140, 70], kind: 's_bow', trait: 'root', hp: 1.8, atk: 1.15, def: 1.15, sight: '芽は、摘む', freed: '土の匂いがする' },
};
const CAMP_BATTLES = [
  { id: 'camp_port', chapter: 'act1', story: 'kingdom_port', before: 'act2', town: 'aquamist', region: 'sea', act: '王国編 I', title: '港の黒い旗', lv: 3, spirits: ['gran'],
    theme: { bg: 'rain', preset: 'dusk', fx: 'rain:0.3', bgm: 'fate' }, hue: '#8fc7da', reward: 200, ordinaryReward: 'a_rain',
    camps: { commanders: [{ ...RAINBOW_GUARD.marina, hp: 1.3, atk: 1.05 }, { ...RAINBOW_GUARD.sion, lv: 2, hp: 1.5, atk: 1 }], cp: 3, cpMax: 6, spawn: { kind: 's_lance', lv: 2 }, spawnEvery: 3, spawnCap: 7 },
    enemies: [{ kind: 's_captain', lv: 3 }, { kind: 's_lance', lv: 2, n: 2 }, { kind: 's_bow', lv: 2, n: 1, hold: true }, { kind: 's_sword', lv: 2, n: 1 }],
    missions: [{ type: 'turns', n: 10 }, { type: 'hp', n: 50 }, { type: 'rainbow', n: 40 }],
    desc: '船着き場の桟橋に、黒い旗が立てられた。桟橋の先の本陣には青のマリナ、丘の旗には藍のシオン。旗を一本ずつ取り返し、本陣の旗を奪う。' },
  { id: 'camp_valley', chapter: 'act3', story: 'kingdom_valley', before: 'act4', town: 'stone', region: 'canyon', act: '王国編 II', title: '石の子の村の旗', lv: 8, spirits: ['gran', 'ivy', 'vard'],
    theme: { bg: 'canyon', preset: 'dusk', fx: 'gold:0.3', bgm: 'fate' }, hue: '#f5d27e', reward: 380, ordinaryReward: 'a_gold',
    camps: { commanders: [{ ...RAINBOW_GUARD.ocher, hp: 1.4, def: 1.4 }, { ...RAINBOW_GUARD.amber, lv: 9 }], cp: 3, cpMax: 7, spawn: { kind: 's_lance', lv: 8 }, spawnEvery: 3, spawnCap: 9 },
    enemies: [{ kind: 's_captain', lv: 9 }, { kind: 's_heavy', lv: 8, n: 2, hold: true }, { kind: 's_bow', lv: 8, n: 2, hold: true }, { kind: 's_lance', lv: 8, n: 1 }],
    missions: [{ type: 'turns', n: 12 }, { type: 'noDown' }, { type: 'rainbow', n: 45 }],
    desc: '石の子の村の屋根に、黒い旗が立っている。上の段の本陣には黄のオーカー、左の段の旗には橙のアンバー。旗を取り返して指揮点を増やし、本陣を奪う。' },
  { id: 'camp_town', chapter: 'act4', story: 'kingdom_town', before: 'act5', town: 'rainbow', region: 'spire', act: '王国編 III', title: '城下町の黒い旗', lv: 11, spirits: ['gran', 'ivy', 'vard', 'spinel'],
    theme: { bg: 'glass', preset: 'dim', fx: 'sparkle:0.3', bgm: 'fate' }, hue: '#cdb8f5', reward: 480, ordinaryReward: 'e_prism',
    camps: { commanders: [{ ...RAINBOW_GUARD.viola, hp: 1.25, def: 1.1 }, { ...RAINBOW_GUARD.carmine, lv: 11, hp: 1.5, atk: 1.2 }, { ...RAINBOW_GUARD.verde, lv: 11, hp: 1.5 }], cp: 3, cpMax: 8, spawn: { kind: 's_lance', lv: 10 }, spawnEvery: 4, spawnCap: 9 },
    enemies: [{ kind: 's_captain', lv: 12 }, { kind: 's_cavalry', lv: 10, n: 1 }, { kind: 's_heavy', lv: 10, n: 1, hold: true }, { kind: 's_bow', lv: 10, n: 2, hold: true }, { kind: 's_sword', lv: 10, n: 1, hold: true }],
    missions: [{ type: 'turns', n: 12 }, { type: 'noDown' }, { type: 'rainbow', n: 50 }],
    desc: '広場から城門まで、黒い旗が並んでいる。城門には近衛の長、紫のヴィオラ。左右の通りの旗には赤のカーマインと緑のヴェルデ。騎兵は本陣を狙ってくる。' },
];

const Envoy = (() => {
  CAMP_BATTLES.forEach(e => {
    BOARDS[e.id] = {
      id: e.id, act: e.act, title: e.title, cols: CAMP_LAYOUTS[e.id].ground[0].length, rows: CAMP_LAYOUTS[e.id].ground.length, recLv: e.lv, lv: e.lv, spStart: 4, region: e.region, renoir: true,
      layout: CAMP_LAYOUTS[e.id], decor: ['rocks', 'mt_small'], hue: e.hue, theme: e.theme, spirits: e.spirits, enemies: e.enemies,
      encounter: { objective: 'camps', camps: e.camps, fog: true }, missions: e.missions, reward: e.reward, ordinaryReward: e.ordinaryReward, firstItems: { i_tea: 1 }, desc: e.desc,
      intro: { who: 'アリア', text: `${e.desc}<small>陣取り：毎ターンの「指揮」で、誰でも何度でも動ける（同じ仲間の再行動は移動が1減る）。アリア・ノアールが隣に敵のいない旗に立つと奪える。敵の攻撃範囲で止まると迎撃される。土嚢の上なら、離れた攻撃と迎撃を4割減らせる。家と城壁は通れない。霧のせいで、見えるのは仲間の周りと虹の床のそばだけ。ノアールは遠くまで見通せる。「危」で危険範囲を確かめよう。</small>` },
      loseText: '黒い旗に、押し戻された。旗を取り返す順番を、もう一度考えよう。',
    };
  });
  Object.assign(SPEAKERS, { 兵士: '#8e86a3', ...Object.fromEntries(Object.values(RAINBOW_GUARD).map(g => [g.name.slice(2), g.color])) });
  const scenes = {
    camp_port: {
      anchor: 'アリアはうなずいた。女性は礼を言わずに包みを受け取り、アリアも求めなかった。二人はしばらく、同じ雨の中に立っていた。',
      before: `坂の下で、怒鳴り声がした。
黒く塗られた兵たちが、船着き場の桟橋に、一本ずつ黒い旗を立てていた。旗の立った桟橋には、色の違う船は一艘も寄れない。
桟橋の先に、房飾りのついた長い槍を持った女が立っていた。房飾りの先まで、黒く塗られていた。
マリナ「この港は、本日より王の布告のもとに置く。桟橋は、すべて黒で揃える」
マリナ「揃えれば、誰も迷わない。迷わなければ、誰も沈まない。……そうだろう？」
老漁師「マリナ嬢ちゃん。灯台守の娘が、何を言ってる。旗を立てられた桟橋には、もう船が帰れん。……ようやく帰ってきた船を、また追い返すつもりか」
倉庫の丘から、冷たい霧が降りてきた。霧の奥で、弓の弦が鳴った。
シオン「見えるものは、全部撃つ。……霧の中なら、誰も見ずに済む」
老漁師「シオンの坊主まで。二人とも、虹の近衛に上がった港の子だ。王さまの、七人の近衛に」
@show aria
アリアは耳を澄ませた。二人の音は、穢れのように黒くざらついてはいなかった。命令の黒を、上から一枚、塗られているだけだった。
アリア「……この人たちは、穢れじゃない。塗られてるだけ」
ノアールが、アリアの襟元で小さく震えた。黒い兵のほうへは、寄っていかなかった。
アリア「旗を取り返そう。一本ずつ。霧の中は見えないから、虹で照らしながら進む」
@hide aria`,
      after: `最後の黒い旗が倒れた。マリナの房飾りから黒が剥がれ、海の青がのぞいた。
マリナ「……灯を消せって言ったのは、わたしの口だった。この港で、灯を消す人間なんて、いないはずなのに」
シオン「霧を呼んだのは、俺だ。見たくなかったんだ。黒い旗を立てる自分を」
老漁師「布告の字を見な。昔の王の字は、もっと丸かった。そいつは、針みたいな字だ」
マリナ「針の字……。近衛は、王の印のある命令には逆らえない。七人とも、同じ字を受け取った」
シオン「残りの五人も、どこかで旗を立てている」
二人は濡れた旗を巻き取り、黙って、桟橋の端に置いた。
桟橋に、色の違う船の灯が、ひとつずつ戻ってきた。`,
    },
    camp_valley: {
      anchor: '石の子「尖塔の人が来た。割れ目を、全部鉛で塞げって。泣いたら、その音も消せって。世界を黒で満たすんだって、笑ってた」',
      before: `石の子の村は、谷の入り口の斜面にあった。家々の屋根に、黒い旗が立っている。谷の底には、港で見たのと同じ布告の霧が溜まっていた。
旗の下で、黒く塗られた兵が、割れた壁に鉛を流しこんでいた。
いちばん上の段で、大盾を背負った大男が兵に指図していた。盾の縁にはめこまれた石まで、黒く塗られていた。
オーカー「割れ目は塞ぐ。割れたものは、元には戻らない。だから、見せるな」
左の段の旗の下では、斧を担いだ女が、かまどの火に土をかけていた。
アンバー「火を落とせ。温かいものは、全部黒に。……冷えていれば、誰も腹が空いていることに気づかない」
石の子「オーカーさんは、前は石を割って、家を建ててくれた。アンバーさんは、スープを作ってくれた」
アイビー「虹の近衛ね。港の二人と同じ、王さまの七人。……旗を取り返しましょう。本陣は、いちばん上の段」
ヴァルド「あいつらは、塗られてるだけだな。……角は、黒い塗りにだけ向ける」`,
      after: `村の旗が、ひとつ残らず倒れた。オーカーの盾から黒が剥がれ、縁の石が黄色く光った。
オーカー「……俺も、石を割る仕事をしていた。割れ目から光が入ることを、知っていたのに」
アンバー「かまどに、もう一度火を入れる。この子に、スープを作る約束をしてたんだ」
石の子が、壁の割れ目に指をかけて、こちらを覗いた。割れ目の向こうに、夕日の金色があった。
オーカー「残るのは、城のヴィオラと、カーマインと、ヴェルデだ。ヴィオラは近衛の長だ。俺たちより、ずっと強い」`,
    },
    camp_town: {
      anchor: '兵士「王の命令だ。……僕の声じゃない。でも、僕の口が、そう言ってしまう。世界を、黒で満たせ」',
      before: `広場から城門まで、黒い旗がいくつも並んでいた。旗の立った通りでは、店の看板まで黒く塗られていた。城下町にも、布告の霧が流れこんでいた。
左の通りを、鞍まで黒く塗られた騎兵が駆け抜けた。
カーマイン「速いほうが勝つ。迷う暇なんか、黒に塗っちまえ。……本陣ごと、踏みつぶしてやる」
右の通りでは、手袋の女が、街路樹の芽を一つずつ摘んでいた。
ヴェルデ「芽は摘む。伸びるものは、みんな王に逆らう」
城門の前に、黒い外套の騎士が立っていた。剣を抜かず、門を背にして、ただ立っていた。
ヴィオラ「虹の近衛の長、ヴィオラ。この門は、王の命令で閉じている」
ヴィオラ「……王の字は、もっと丸かった。わかっている。わかっていて、私は門を閉じている」
@show aria
アリア「城門の旗が、この町の本陣。通りの旗を取り返しながら、城門まで行こう」
グラン「赤い騎兵は、こちらの本陣を狙ってくる。誰か一人、背中に残しておけ」
スピネル「迎えてくる矢は、僕の隣にいれば、少しは和らぐよ」
@hide aria`,
      after: `城門の黒い旗が倒れた。ヴィオラの外套から黒が剥がれ、紫がのぞいた。
ヴィオラ「……やっと、自分の声で言える。王を、助けてください。王も、黒く塗られている」
カーマイン「走るのは好きだった。……何から逃げてたんだろうな、俺は」
ヴェルデ「城の庭の苗、まだ間に合いますか」
ヴィオラ「七人とも、自分の色を取り戻した。町は私たちが守る。アリア、王の声を聞いてきてください」
アリアはうなずいた。門の外で、ヴィオラが自分の剣を鞘に収めた。
町の旗は取り戻した。その先で待っている王には、まだ、会っていない。`,
    },
  };
  // 1.24〜1.26 の途中セーブだけに使う旧配置。新しい本文には挿入しない。
  const inlineLegacy = Object.fromEntries(CAMP_BATTLES.map(e => {
    const oldChapter = {camp_port:'act1',camp_valley:'act4',camp_town:'act5'}[e.id];
    const sc=scenes[e.id];
    return [oldChapter,SCRIPT[oldChapter].replace(sc.anchor,`${sc.anchor}\n${sc.before}\n@board ${e.id}\n${sc.after}`)];
  }));
  const openings = {
    camp_port:`@bg rain dusk
@fx rain:0.3
@bgm fate
@pouch show
グランの背で雲を抜けたとき、アリアは海の下を振り返った。港の灯台が、短く三度、明滅していた。
グラン「あれは、帰港の合図ではない。助けを呼んでいる」
青い翼が傾いた。雲の下へ戻ると、さっきまで灯の見えていた桟橋が、霧に沈んでいた。
アリアは港へ降りた。グランは灯台に預けた潮を細く引き、船が沖で待てる場所を残した。
`,
    camp_valley:`@bg canyon dusk
@fx gold:0.2
@bgm fate
@pouch show
森と赤い丘を離れた夕方、アリアたちは金色の谷へ向かった。グランの横をアイビーが歩き、ヴァルドは荷物を角にかけていた。
谷へ入る前に、食事と寝床を探して石の子の村へ寄った。ところが、煙突からは一本の煙も上がっていなかった。
道端に、港で見たものと同じ、王の印のある布告が落ちていた。
`,
    camp_town:`@bg glass dim
@fx sparkle:0.2
@bgm fate
@pouch show
スピネルとの旅を手帳へ残し、アリアたちはテラ・コッタを発った。向かう先は、布告の印のある城だった。
虹の尖塔が見えはじめても、城下町からは市場の声が聞こえなかった。
港と村で剥がしたものと同じ黒が、通りの入口に垂れていた。
`,
  };
  const closings = {
    camp_port:`グランが灯台へ顔を寄せた。碧い光は、今度は途切れずに灯っていた。
マリナとシオンは桟橋に残り、帰ってくる船へ灯を振った。
アリアたちは灰色の街へ向かう旅を再開した。港を発つ理由も、帰れる場所も、もう失われてはいなかった。`,
    camp_valley:`その夜、アンバーの鍋から湯気が立った。オーカーは割れた椅子を持ってきて、座れるように直した。
村の道は開いた。アリアたちは明日、谷の奥を訪ねることにした。
今夜は、かまどの火を消さずに眠れた。`,
    camp_town:`グラン、アイビー、ヴァルド、スピネルが、開いた門の前にそろった。
アリアは心剣から手を離した。ここからは、命令を受けた人たちではなく、その命令の出た場所へ向かう。
王のもとへ行こう。今度こそ、本人の声を聞くために。`,
  };
  for(const e of CAMP_BATTLES){
    const sc=scenes[e.id];
    SCRIPT[e.story]=`@chapter ${e.act}|${e.title}\n${openings[e.id]}\n${sc.before}\n@board ${e.id}\n${sc.after}\n${closings[e.id]}\n@sideend`;
  }
  // 城下町の解放は王国編IIIで完結。第五幕は、開いた門の内側から始める。
  const kingOpening=SCRIPT.act5.indexOf('パレット・パレスは、');
  const kingThrone=SCRIPT.act5.indexOf('@aura kingDark',kingOpening);
  if(kingOpening>=0&&kingThrone>kingOpening)SCRIPT.act5=SCRIPT.act5.slice(0,kingOpening)+`パレット・パレスの門は開いていた。ヴィオラたちに町を託し、アリアは仲間と城の内側へ入った。
虹色の尖塔は、黒い靄に覆われていた。宝石の壁へ、誰の足音も返ってこない。
旅のあいだに見た布告は、すべてこの城の印だった。けれど、その命令を書かせた声の持ち主には、まだ会っていない。
グランも、アイビーも、ヴァルドも、スピネルも、ここにいる。アリアは玉座の間の扉へ手をかけた。
`+SCRIPT.act5.slice(kingThrone);

  const LEGACY = ['envoy_sea', 'envoy_forest', 'envoy_hill', 'envoy_canyon', 'envoy_spire', 'envoy_veil'];
  LEGACY.forEach(k => { SCRIPT[k] = '\n@sideend\n'; });
  const ORDER = ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue', 'done'];
  const reachedAfter = ch => { const u = Engine.unlocked(), i = ORDER.indexOf(ch); return u.some(k => ORDER.indexOf(k) > i); };
  const cleared = e => !!(Board.party.stages && Board.party.stages[e.id] && Board.party.stages[e.id].cleared);
  const fulfilled = e => {
    const s=Engine.load();
    // 旧版で次章まで到着した旅を、追加した幕間へ巻き戻さない。
    const legacy=(!s||!s.scriptVersion||s.scriptVersion<4)&&Engine.unlocked().includes(e.before);
    return cleared(e)||reachedAfter(e.before)||!!legacy;
  };
  const episode = key => CAMP_BATTLES.find(e => e.story===key);
  function available(e){
    if(typeof e==='string')e=CAMP_BATTLES.find(x=>x.id===e||x.story===e);
    if(!e||!Engine.unlocked().includes(e.before)&&!reachedAfter(e.before))return false;
    if(Progression.journeyGate(e.before,Engine.unlocked(),Engine.load()?.colors))return false;
    const i=CAMP_BATTLES.indexOf(e);
    return i===0||fulfilled(CAMP_BATTLES[i-1]);
  }
  function gate(chapter){
    const e=CAMP_BATTLES.find(x=>x.before===chapter);
    return e&&!fulfilled(e)&&available(e)?e:null;
  }
  const at = town => CAMP_BATTLES.filter(e => e.town === town && available(e));
  function start(id){
    const e=CAMP_BATTLES.find(x=>x.id===id);if(!e||!available(e))return;
    Panel.close();World.close();Engine.play(e.story);
  }
  function replay(id) {
    const e = CAMP_BATTLES.find(x => x.id === id); if (!e || !available(e)) return;
    Panel.close(); World.close(); Engine.resetStage();
    Engine.setBg(e.theme.bg, e.theme.preset); FX.set(e.theme.fx); Audio2.playBgm(e.theme.bgm);
    Board.start({ ...BOARDS[id], difficulty: Progression.selected(Board.party, id), resultLabel: 'マップへ戻る' }, () => World.open({ at: e.town }));
  }
  return { CAMP_BATTLES, LEGACY, at, cleared, completed:fulfilled, available, episode, gate, start, replay, legacyScript:key=>inlineLegacy[key] };

})();
var EXTRA_SIDE_STORIES = Object.assign(typeof EXTRA_SIDE_STORIES === 'object' && EXTRA_SIDE_STORIES ? EXTRA_SIDE_STORIES : {},
  Object.fromEntries([...Envoy.LEGACY.map(k => [k, { home: null, open: () => true }]), ...CAMP_BATTLES.map(e=>[e.story,{home:e.town,open:()=>Envoy.available(e)}]) ]));
