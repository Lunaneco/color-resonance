// 寄り道「王の遣い兵」。偽の布告で黒く塗られた兵との遭遇戦を、各地にひとつずつ置く。
// 通常戦との違い（反撃・兵種・隊長の号令・守備兵・増援・戦場ごとの勝利条件・危険範囲）は board.js の cfg.encounter が受け持つ。
// 兵は穢れではない。倒すと黒い塗りが剥がれて我に返る。床はくすませず、ノアールも飲まない。
const ENVOY_MAPS = {
  sea: { low: ['sea_calm', 'sea_flat', 'land_flat', 'sea_shallow'], mid: ['land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.04, hills: 0.2, obstacles: ['rocks'], obsAmt: 0.03 },
  forest: { low: ['land_flat', 'land_flat', 'sea_shallow'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.03, hills: 0.3, obstacles: ['rocks', 'mt_small'], obsAmt: 0.05 },
  hill: { low: ['land_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], hills: 0.25, obstacles: ['rocks'], obsAmt: 0.025, waterAmt: 0 },
  canyon: { low: ['land_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], hills: 0.45, obstacles: ['rocks', 'mt_mid'], obsAmt: 0.05 },
  spire: { low: ['land_flat', 'sea_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.03, hills: 0.3, obstacles: ['rocks'], obsAmt: 0.03 },
  veil: { low: ['land_flat', 'sea_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.03, hills: 0.3, obstacles: ['rocks'], obsAmt: 0.025 },
};
const ENVOYS = [
  { key: 'sea', town: 'aquamist', need: 'act2', title: '港の布告', place: 'アクアミストの船着き場', lv: 4, spirits: ['gran'],
    theme: { bg: 'rain', preset: 'dusk', fx: 'rain:0.25', bgm: 'fate' }, hue: '#8fc7da', reward: 220, ordinaryReward: 'a_rain',
    encounter: { objective: 'commander', waves: [{ turn: 3, units: [{ kind: 's_lance', lv: 4, n: 1 }] }] },
    enemies: [{ kind: 's_captain', lv: 5, hold: true }, { kind: 's_lance', lv: 4, n: 2 }, { kind: 's_bow', lv: 4, n: 1 }, { kind: 's_sword', lv: 4, n: 1 }],
    missions: [{ type: 'turns', n: 9 }, { type: 'hp', n: 50 }, { type: 'back', n: 2 }],
    desc: '船着き場の掲示板を、黒く塗られた兵が守っている。隊長の黒を剥がせば、ほかの兵は退く。' },
  { key: 'forest', town: 'thorn', need: 'act4', title: '森の検め', place: '緑の森の小道', lv: 7, spirits: ['gran'],
    theme: { bg: 'forest', preset: 'dim', fx: 'motes:0.4', bgm: 'fate' }, hue: '#8fd09a', reward: 320, ordinaryReward: 'c_bell',
    encounter: { objective: 'protect', turns: 5, villagers: 2, villagerName: '森の薬師', waves: [{ turn: 2, units: [{ kind: 's_cavalry', lv: 7, n: 1 }] }, { turn: 4, units: [{ kind: 's_bow', lv: 7, n: 1 }, { kind: 's_sword', lv: 7, n: 1 }] }] },
    enemies: [{ kind: 's_sword', lv: 7, n: 2 }, { kind: 's_bow', lv: 7, n: 1 }, { kind: 's_cavalry', lv: 7, n: 1 }],
    missions: [{ type: 'turns', n: 6 }, { type: 'noDown' }, { type: 'back', n: 2 }],
    desc: '「色の違う薬草は没収する」。布告を持った兵が、森の薬師を囲んでいる。薬師ふたりを5ターン守り抜く。' },
  { key: 'hill', town: 'f_fruit', need: 'vardbond', title: '果樹園の差し押さえ', place: '赤い果実の丘', lv: 9, spirits: ['gran', 'ivy'],
    theme: { bg: 'canyon', preset: 'dusk', fx: 'gold:0.2', bgm: 'fate' }, hue: '#f0a08f', reward: 380, ordinaryReward: 'e_tide',
    encounter: { objective: 'survive', turns: 6, waves: [{ turn: 2, every: 2, units: [{ kind: 's_lance', lv: 9, n: 1 }, { kind: 's_bow', lv: 9, n: 1 }] }] },
    enemies: [{ kind: 's_lance', lv: 9, n: 2 }, { kind: 's_heavy', lv: 9, n: 1 }, { kind: 's_bow', lv: 9, n: 1 }],
    missions: [{ type: 'turns', n: 7 }, { type: 'hp', n: 50 }, { type: 'back', n: 3 }],
    desc: '「赤い実はすべて城へ納めよ」。差し押さえに来た兵が、次々と丘を上ってくる。6ターンのあいだ、果樹園を守る。' },
  { key: 'canyon', town: 'stone', need: 'act5', title: '谷の掲示板', place: '黄金の谷の切り通し', lv: 11, spirits: ['gran', 'ivy', 'spinel'],
    theme: { bg: 'canyon', preset: 'dim', fx: 'gold:0.3', bgm: 'fate' }, hue: '#f5d27e', reward: 440, ordinaryReward: 'a_gold',
    encounter: { objective: 'seize', waves: [{ turn: 4, units: [{ kind: 's_cavalry', lv: 11, n: 2 }] }] },
    enemies: [{ kind: 's_heavy', lv: 11, n: 3, hold: true }, { kind: 's_bow', lv: 11, n: 2, hold: true }, { kind: 's_captain', lv: 12, hold: true }],
    missions: [{ type: 'turns', n: 10 }, { type: 'noDown' }, { type: 'hp', n: 45 }],
    desc: '谷の奥の掲示板に、細い針のような字の布告が打ちつけてある。重装兵の壁を抜け、アリアが掲示板にたどり着けば、布告をはがせる。' },
  { key: 'spire', town: 'rainbow', need: 'finale', title: '取り消されない命令', place: '虹の城下町の外れ', lv: 15, spirits: ['gran', 'ivy', 'spinel'],
    theme: { bg: 'glass', preset: 'dim', fx: 'sparkle:0.3', bgm: 'fate' }, hue: '#cdb8f5', reward: 560, ordinaryReward: 'e_prism',
    encounter: { objective: 'commander', waves: [{ turn: 3, units: [{ kind: 's_lance', lv: 15, n: 1 }] }] },
    enemies: [{ kind: 's_captain', lv: 16, hold: true }, { kind: 's_cavalry', lv: 15, n: 2 }, { kind: 's_heavy', lv: 15, n: 1 }, { kind: 's_bow', lv: 15, n: 1 }],
    missions: [{ type: 'turns', n: 9 }, { type: 'noDown' }, { type: 'back', n: 3 }],
    desc: '王が命令を取り消したことを、まだ知らない一隊がいる。騎兵が速い。奥に構える隊長の黒を剥がせば、隊は退く。' },
  { key: 'veil', town: 'veil', need: 'restore1', title: '最後の遣い', place: 'クリスタリアへの街道', lv: 20, spirits: ['gran', 'ivy', 'spinel'],
    theme: { bg: 'stars', preset: 'night', fx: 'stars:0.3', bgm: 'fate' }, hue: '#b8c6f0', reward: 760, ordinaryReward: 'a_star',
    encounter: { objective: 'rout', waves: [{ turn: 3, units: [{ kind: 's_heavy', lv: 20, n: 1 }, { kind: 's_bow', lv: 20, n: 1 }] }, { turn: 5, units: [{ kind: 's_cavalry', lv: 20, n: 2 }] }] },
    enemies: [{ kind: 's_captain', lv: 21 }, { kind: 's_heavy', lv: 20, n: 1 }, { kind: 's_lance', lv: 20, n: 1 }, { kind: 's_bow', lv: 20, n: 2 }], companion: true,
    missions: [{ type: 'turns', n: 12 }, { type: 'noDown' }, { type: 'hp', n: 50 }],
    desc: '黒い塗りのまま、光の国まで来てしまった兵たち。隊長を解放しても、兵は止まらない。全員の黒を剥がす。' },
];

const Envoy = (() => {
  const keyOf = e => 'envoy_' + e.key;
  ENVOYS.forEach(e => {
    BOARDS[keyOf(e)] = {
      id: keyOf(e), act: '寄り道・王の遣い兵', title: e.title, cols: 10, rows: 10, recLv: e.lv, lv: e.lv, spStart: 4, region: false, renoir: true,
      map: ENVOY_MAPS[e.key], decor: ['rocks', 'mt_small'], hue: e.hue, theme: e.theme, spirits: e.spirits, enemies: e.enemies, encounter: e.encounter,
      missions: e.missions, reward: e.reward, ...(e.companion ? { companion: true } : {}), ordinaryReward: e.ordinaryReward, firstItems: { i_tea: 1 }, desc: e.desc,
      intro: { who: 'アリア', text: `${e.desc}<small>遭遇戦：攻撃すると、届く相手は反撃してくる。「危険範囲」（D）で、敵の攻撃が届く床を確かめよう。</small>` },
      loseText: '黒く塗られた兵に、押し切られた。布告の黒は、まだ剥がせていない。',
    };
  });
  Object.assign(SPEAKERS, { 遣いの隊長: '#9b8fb5', 遣いの兵: '#8e86a3', 森の薬師: '#a9d6a0', 果樹守り: '#e2a48c' });
  const S = {};
  S.sea = `
アクアミストの船着き場に、新しい掲示板が立っていた。
封蠟は夜のように黒い。七色の紋の上から、別の蠟がかぶせてある。
> 『涙の色は調和を乱す。<br>港の灯は、黒で覆え。』
掲示板の前に、兵が並んでいた。鎧も、顔も、手袋の指先まで、墨を塗ったように黒い。
アリアは耳を澄ませた。兵たちの音は、穢れのように黒くざらついてはいなかった。その上に、薄く、冷たい塗りが一枚、貼りついているだけだった。
アリア「……この人たち、穢れじゃない。命令の黒を、上から塗られてる」
遣いの隊長「王の布告である。港の灯を消せ。逆らう者は、色ごと黒に塗る」
@show renoir
ノアール「……人は、飲まない。塗りだけ、剥がして」
@hide renoir
アリア「うん。切るのは、黒い塗りだけ」
`;
  S.sea_after = `
最後に、隊長の黒が剥がれた。鎧の下から、日に焼けた漁師の腕がのぞいた。
遣いの隊長「……わしは、何をしていた。港の灯を消せと……そんな命令を、わしが」
隊長は、自分の手を見た。それから、掲示板を見上げた。
遣いの隊長「この布告……王の印だ。だが、字が違う。昔の王の字は、もっと丸かった。こんな針みたいな字を、王は書かない」
アリアは、布告の字を指でなぞった。細く、冷たく、どこにも息の入っていない字だった。
`;
  S.forest = `
森の小道で、薬師がふたり、籠を抱えてうずくまっていた。
その周りを、黒く塗られた兵が囲んでいる。
遣いの兵「色の違う薬草は、没収する。布告だ」
森の薬師「これは、熱を下げる草なんです。色が違うのは、効き方が違うから……」
遣いの兵「違うものは、ひとつに揃える。それが調和だ」
アリア「……アイビーの森で、比べる声を聞いた。あれと同じ形をしてる」
グラン「薬師を守れ、アリア。兵の黒を剥がすのは、そのあとでいい」
`;
  S.forest_after = `
兵たちの黒が剥がれると、彼らは籠から転がった薬草を、黙って拾い集めはじめた。
遣いの兵「……すまない。娘が、この草で熱を下げたことがある。それなのに、俺は」
森の薬師「拾ってくれるなら、それでいいです。……謝るのは、熱が下がってからにしてください」
アリアは、薬師が籠に草を戻すのを見ていた。色の違う葉が、隣り合って、混ざらずに並んでいた。
`;
  S.hill = `
赤い丘の入口に、荷車が何台も並んでいた。
> 『赤い実はすべて城へ納めよ。<br>丘に色を残すことを禁ず。』
ヴァルドが、低く唸った。
ヴァルド「実を奪う布告か。……よりによって、この丘で」
アリア「ヴァルド。あの兵たちは、塗られてるだけ。踏まないで」
ヴァルド「分かってる。俺の角は、俺が向ける。……だが、ルベラの木には、指一本触れさせない」
果樹守り「兵が、次から次へと上がってくる。日が沈むまで持ちこたえれば、荷車は帰るはずだ」
`;
  S.hill_after = `
日が傾くころ、最後の荷車が、空のまま丘を下りていった。
黒の剥がれた兵が、ルベラの植えた幼い木の前で立ち止まった。
遣いの兵「……この木の実も、納めろと言われていた」
ヴァルド「この木は、誰にも納めない。……おまえも、もう黒に命じられるな」
兵は、深く頭を下げて、丘を下りた。ヴァルドは、木の根元の土を、角でそっと均した。
`;
  S.canyon = `
谷の切り通しの奥に、掲示板が打ちつけてあった。
字は、細い針のようだった。印は、パレット王のものだった。
その前に、重装兵が壁のように並んでいる。動かない。持ち場を守ることだけを、命じられている顔だった。
スピネル「あの鎧、硬いよ。守りを貫く技でないと、ほとんど届かない」
アリア「全員を相手にしなくていい。掲示板まで行って、布告をはがせば、この命令は終わる」
`;
  S.canyon_after = `
アリアは、掲示板から布告をはがした。紙は、指の中で砂のように崩れた。
重装兵たちの黒が、ゆっくりと薄れていった。
遣いの兵「……王の命令だと、思っていた。印が、本物だったから」
アリア「印は、本物だった。字だけが、違った」
兵は、崩れた紙の跡を、しばらく見つめていた。
`;
  S.spire = `
虹の城下町の外れで、一隊の兵が、まだ黒いままだった。
@aura king
パレット王の遣いの者が、息を切らして追いついてきた。
遣いの者「王は、すべての布告を取り消されました。けれど、あの隊にだけ、取り消しが届いていないのです」
@aura none
遣いの隊長「取り消しなど、聞いていない。我らは、最後の命令を守る」
アリア「命令を守ることと、自分の色を守ることは、違うよ」
遣いの隊長「黙れ。色など、要らぬ」
`;
  S.spire_after = `
隊長の黒が剥がれると、隊は、その場に膝をついた。
遣いの隊長「……取り消されていたのか。王は、もう」
アリア「王は、自分で一枚ずつ取り消して回ってる。あなたたちの命令も、もうない」
遣いの隊長「……ならば、我らも取り消しに回ろう。黒く塗った家の数だけ、詫びに行く」
`;
  S.veil = `
クリスタリアへの街道に、黒い兵の列が続いていた。
取り消しの届かないまま、命令の黒だけを抱えて、光の国まで歩いてきた兵たちだった。
クロム「……あの布告の字は、僕の字に似せて書かれている。僕が国を塗るときに使った、細い字だ」
アリア「あなたが書いたの？」
クロム「書いていない。でも、あの字を真似たくなるような黒を、僕は世界に流した。……最後まで、付き合う」
`;
  S.veil_after = `
最後の兵の黒が剥がれた。街道には、色の違う鎧を着た兵たちが、ばらばらに座りこんでいた。
誰も、同じ顔をしていなかった。
クロムは、ひとりずつに水を配って歩いた。受け取る兵も、受け取らない兵もいた。クロムは、どちらにも何も言わなかった。
`;
  ENVOYS.forEach(e => {
    SCRIPT[keyOf(e)] = `
@chapter 寄り道・王の遣い兵|${e.title}
@bg ${e.theme.bg} ${e.theme.preset}
@bgm fate
@pouch show
@show aria
${S[e.key].trim()}
@hide aria
@board ${keyOf(e)}
@show aria
${S[e.key + '_after'].trim()}
@hide aria
@aura none
@sideend
`;
  });
  const ORDER = ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'finale', 'epilogue', 'done'];
  const reached = need => { const u = Engine.unlocked(); if (!ORDER.includes(need)) return u.includes(need); const i = ORDER.indexOf(need); return u.some(k => ORDER.indexOf(k) >= i); };
  const available = key => { const e = ENVOYS.find(x => keyOf(x) === key); return !!e && reached(e.need); };
  const at = town => ENVOYS.filter(e => e.town === town && reached(e.need));
  const cleared = e => !!(Board.party.stages && Board.party.stages[keyOf(e)] && Board.party.stages[keyOf(e)].cleared);
  function start(key) { if (!available(key)) return; Panel.close(); Engine.play(key); }
  return { ENVOYS, keyOf, available, at, cleared, start };
})();
// 本編の合間に読む物語（寄り道）として Engine に登録する。読み終えたら、読み始めた記録へ戻る。
var EXTRA_SIDE_STORIES = Object.assign(typeof EXTRA_SIDE_STORIES === 'object' && EXTRA_SIDE_STORIES ? EXTRA_SIDE_STORIES : {},
  Object.fromEntries(ENVOYS.map(e => [Envoy.keyOf(e), { home: e.town, open: () => Envoy.available(Envoy.keyOf(e)) }])));
