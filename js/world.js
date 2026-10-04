// ワールドマップ・町・装備・道具・フリーステージ

// ---------- 装備 ----------
// slot: blade 刻印（心剣に刻む）／ cloth 衣 ／ charm 飾り
const EQUIP = {
  e_glass: { slot: 'blade', name: '硝子の刻印', price: 120, fx: { atk: 4 } },
  e_tide: { slot: 'blade', name: '潮の刻印', price: 300, fx: { atk: 8 } },
  e_ash: { slot: 'blade', name: '灰の刻印', price: 560, fx: { atk: 12, crit: 5 } },
  e_amber: { slot: 'blade', name: '琥珀の刻印', price: 950, fx: { atk: 18 } },
  e_prism: { slot: 'blade', name: '虹彩の刻印', price: 1600, fx: { atk: 26, crit: 5 } },
  a_rain: { slot: 'cloth', name: '雨よけの外套', price: 110, fx: { def: 4, hp: 10 } },
  a_wool: { slot: 'cloth', name: '毛織りのケープ', price: 300, fx: { def: 8, hp: 25 } },
  a_moss: { slot: 'cloth', name: '苔むした胸当て', price: 600, fx: { def: 12, hp: 40 } },
  a_gold: { slot: 'cloth', name: '金糸の衣', price: 1000, fx: { def: 18, hp: 60 } },
  a_star: { slot: 'cloth', name: '星織りのドレス', price: 1700, fx: { def: 25, hp: 90 } },
  c_lens: { slot: 'charm', name: '拡大鏡のかけら', price: 350, fx: { crit: 10 } },
  c_bell: { slot: 'charm', name: '小さな鈴', price: 450, fx: { mov: 1 } },
  c_tea: { slot: 'charm', name: 'カモミールの小袋', price: 500, fx: { regen: 5 } },
  c_brush: { slot: 'charm', name: '絵筆の飾り', price: 700, fx: { paintStep: 1 } },
  c_feather: { slot: 'charm', name: '渡り鳥の羽', price: 800, fx: { summonTurns: 1 } },
  // ユニーク（各ステージをSランクでクリアすると手に入る）
  u_knot: { slot: 'charm', unique: true, name: 'リラの結び目', fx: { spMax: 4, spTurn: 1 }, lore: '冷えた指でもほどけるように、少し長めに端を残した結び目。' },
  u_bell: { slot: 'blade', unique: true, name: '鐘楼の子守唄', fx: { atk: 14, back: 15 }, lore: '渡り鳥が鐘楼に残していった歌。背中から、そっと届く。' },
  u_vine: { slot: 'charm', unique: true, name: '姉妹の蔦冠', fx: { enchantTurns: 2, regen: 3 }, lore: 'ひと冬かけて編んだドレスの、残った糸で編んだ冠。' },
  u_kintsugi: { slot: 'cloth', unique: true, name: '金継ぎの衣', fx: { def: 20, hp: 50, dullGuard: 1 }, lore: '割れたところを、金でつないだ衣。傷のところがいちばん強い。' },
  u_palette: { slot: 'blade', unique: true, name: '王のパレット', fx: { atk: 28, splash: 1 }, lore: '世界の色の調和を守ってきた、王の絵の具皿。' },
  u_nightsky: { slot: 'charm', unique: true, name: '小さな夜空のかけら', fx: { crit: 15, killSp: 2 }, lore: '星が光るための黒。ルノワールの中で灯った夜空の一粒。' },
  u_mist: { slot: 'cloth', unique: true, name: '霧のヴェール', fx: { def: 14, hp: 30, evade: 10 }, lore: 'グランが灯台に預けた霧の、ひとすじ。' },
  u_fruit: { slot: 'charm', unique: true, name: '赤い果実のブローチ', fx: { killHeal: 12 }, lore: '怒ったあとほど甘い、という赤い国の果実をかたどったもの。' },
  u_compass: { slot: 'charm', unique: true, name: '迷子の羅針盤', fx: { mov: 1, jump: 1 }, lore: '居心地がよすぎて出口を忘れた森で、マリーが落としたもの。' },
  u_lens: { slot: 'charm', unique: true, name: '星見のレンズ', fx: { rng: 1 }, lore: '遠い星まで、すこしだけ近くに見える。' },
  u_sheath: { slot: 'blade', unique: true, name: '透明の鞘', fx: { atk: 34, flashCost: 1 }, lore: '何も壊さない刃のための、何も隠さない鞘。' },
};
const SLOT_NAME = { blade: '刻印', cloth: '衣', charm: '飾り' };
function fxText(fx) {
  const L = {
    atk: v => `攻撃+${v}`, def: v => `守り+${v}`, hp: v => `HP+${v}`, mov: v => `移動+${v}`, jump: v => `段差+${v}`, crit: v => `会心+${v}%`,
    spMax: v => `共鳴の上限+${v}`, spTurn: v => `毎ターン共鳴+${v}`, spStart: v => `開始時の共鳴+${v}`, back: v => `背後からの攻撃+${v}%`,
    enchantTurns: v => `心剣に宿す時間+${v}ターン`, summonTurns: v => `召喚の時間+${v}ターン`, paintStep: () => '歩いた床のまわりも虹に',
    splash: () => '攻撃した場所のまわりも虹に', dullGuard: () => 'くすんだ床でも守りが下がらない', killHeal: v => `倒すとHPを${v}%回復`,
    evade: v => `かわしやすさ+${v}%`, rng: v => `心剣の射程+${v}`, flashCost: v => `透明の一閃の共鳴-${v}`, regen: v => `毎ターンHPを${v}%回復`, killSp: v => `倒すと共鳴+${v}`,
  };
  return Object.keys(fx).map(k => L[k] ? L[k](fx[k]) : '').filter(Boolean).join('・');
}
Object.values(EQUIP).forEach(e => { e.desc = fxText(e.fx); });

// ---------- 道具（戦いの中で使う。行動を使う） ----------
const ITEMS = {
  i_tea: { name: 'カモミールの茶', price: 30, target: 'ally', heal: 0.4, desc: '自分か隣の味方のHPを40%回復' },
  i_water: { name: '澄んだ湧き水', price: 120, target: 'ally', heal: 1, desc: '自分か隣の味方のHPを全回復' },
  i_shard: { name: '虹のかけら', price: 80, target: 'self', sp: 4, desc: '共鳴+4' },
  i_powder: { name: 'プリズムの粉', price: 60, target: 'area', paint: 2, desc: '2マス先までの一点を中心に、周り2マスを虹に染める' },
  i_ward: { name: '守りの香', price: 50, target: 'ally', guard: 2, desc: '自分か隣の味方の守りを2ターン固める' },
};
const ITEM_MAX = 9;

// ---------- 町の店 ----------
const SHOPS = {
  aquamist: ['i_tea', 'i_shard', 'i_powder', 'e_glass', 'a_rain', 'c_lens'],
  grey: ['i_tea', 'i_water', 'i_shard', 'i_powder', 'i_ward', 'e_glass', 'e_tide', 'a_rain', 'a_wool', 'c_lens', 'c_bell', 'c_tea'],
  stone: ['i_tea', 'i_water', 'i_shard', 'i_powder', 'i_ward', 'e_tide', 'e_ash', 'e_amber', 'a_wool', 'a_moss', 'a_gold', 'c_bell', 'c_tea', 'c_brush'],
  rainbow: ['i_tea', 'i_water', 'i_shard', 'i_powder', 'i_ward', 'e_amber', 'e_prism', 'a_gold', 'a_star', 'c_lens', 'c_bell', 'c_tea', 'c_brush', 'c_feather'],
};

// ---------- フリーステージ ----------
const FREE_WORDS = ['迷い', 'ためいき', '言えなかったこと', '置き忘れた色', '冷たい雨', 'ひとりぼっち', 'どうせ', '見ないふり', '遅すぎた', 'ごめんね'];
const FREE_STAGES = {
  f_mist: {
    id: 'f_mist', act: 'フリーステージ', title: '霧の浅瀬', lv: 4, cols: 9, rows: 9, reward: 120, spStart: 3,
    map: { low: ['sea_flat', 'sea_calm', 'sea_shallow', 'sea_wave1'], mid: ['land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.07, hills: 0.25, obstacles: ['rocks'], obsAmt: 0.03 },
    enemies: [{ kind: 'shade', lv: 4, n: 3 }, { kind: 'thorn', lv: 4, n: 2 }],
    missions: [{ type: 'turns', n: 8 }, { type: 'noItem' }, { type: 'back', n: 2 }], unique: 'u_mist',
    theme: { bg: 'teal', preset: 'dim', fx: 'rain:0.25', bgm: 'haruka' }, hue: '#8fe0f0', decor: ['rocks', 'mt_small'],
    desc: '灯台の霧がたまる浅瀬。足を取られた迷いが、影になってさまよっている。',
  },
  f_fruit: {
    id: 'f_fruit', act: 'フリーステージ', title: '赤い果実の丘', lv: 8, cols: 10, rows: 10, reward: 220, spStart: 4,
    map: { low: ['land_flat', 'land_flat', 'sea_shallow'], mid: ['land_step', 'land_flat'], high: ['land_high'], hills: 0.4, obstacles: ['mt_small', 'rocks'], obsAmt: 0.05 },
    enemies: [{ kind: 'boss', lv: 9 }, { kind: 'shade', lv: 8, n: 3 }, { kind: 'thorn', lv: 8, n: 2 }], bossName: '怒りの核',
    missions: [{ type: 'turns', n: 11 }, { type: 'crit', n: 2 }, { type: 'hp', n: 60 }], unique: 'u_fruit',
    theme: { bg: 'canyon', preset: 'dusk', fx: 'gold:0.4', bgm: 'forest' }, hue: '#ff9a8a', decor: ['mt_mid', 'rocks'],
    desc: 'マリーが話していた、赤い国の丘。怒りのあとに残った苦い言葉が、まだ転がっている。',
  },
  f_maze: {
    id: 'f_maze', act: 'フリーステージ', title: '迷いの森の奥', lv: 11, cols: 10, rows: 10, reward: 320, spStart: 5,
    map: { low: ['land_flat', 'sea_shallow', 'land_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.05, hills: 0.38, obstacles: ['mt_small', 'mt_mid', 'rocks'], obsAmt: 0.08 },
    enemies: [{ kind: 'thorn', lv: 11, n: 3 }, { kind: 'shade', lv: 11, n: 3 }, { kind: 'lead', lv: 11, n: 1 }],
    missions: [{ type: 'turns', n: 12 }, { type: 'summonKill', n: 2 }, { type: 'dullMax', n: 55 }], unique: 'u_compass',
    theme: { bg: 'forest', preset: 'night', fx: 'motes:0.5', bgm: 'forest' }, hue: '#7fd67a', decor: ['mt_big', 'mt_mid'],
    desc: '居心地がよすぎて、出口を忘れてしまう森。奥ほど、くすみが濃い。',
  },
  f_stars: {
    id: 'f_stars', act: 'フリーステージ', title: '星見の崖', lv: 15, cols: 11, rows: 11, reward: 460, spStart: 6,
    map: { low: ['land_flat', 'sea_flat', 'land_flat'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.04, hills: 0.45, obstacles: ['rocks', 'mt_small'], obsAmt: 0.05 },
    enemies: [{ kind: 'boss', lv: 17, armor: 2 }, { kind: 'shade', lv: 15, n: 3 }, { kind: 'lead', lv: 15, n: 2 }, { kind: 'thorn', lv: 15, n: 2 }], bossName: '星を隠す核',
    missions: [{ type: 'turns', n: 12 }, { type: 'flashMulti' }, { type: 'enchantKill', n: 3 }], unique: 'u_lens',
    theme: { bg: 'stars', preset: 'none', fx: 'stars:0.8', bgm: 'fate' }, hue: '#cfd8ff', decor: ['mt_big', 'rocks'],
    desc: '夜空がいちばん近い崖。星を見上げるのを邪魔する言葉が、渦を巻いている。',
  },
  f_void: {
    id: 'f_void', act: 'フリーステージ', title: '透明の回廊', lv: 22, cols: 12, rows: 12, reward: 700, spStart: 6, dullStart: 0.18,
    map: { low: ['sea_flat', 'land_flat', 'sea_calm'], mid: ['land_step', 'land_flat'], high: ['land_high'], water: 'sea_deep', waterAmt: 0.05, hills: 0.4, obstacles: ['mt_mid', 'rocks'], obsAmt: 0.05 },
    enemies: [{ kind: 'boss', lv: 24, armor: 3 }, { kind: 'lead', lv: 22, n: 3 }, { kind: 'thorn', lv: 22, n: 3 }, { kind: 'shade', lv: 22, n: 3 }], bossName: '色を拒む核', spawnCap: 7,
    missions: [{ type: 'turns', n: 15 }, { type: 'noDown' }, { type: 'rainbow', n: 65 }], unique: 'u_sheath',
    theme: { bg: 'glass', preset: 'clearDawn', fx: 'sparkle:0.5', bgm: 'fate' }, hue: '#ffffff', decor: ['mt_big', 'mt_mid'],
    desc: '色のない場所へ続く、透き通った回廊。旅でいちばん強い穢れが、まだ眠っている。',
  },
};

// ---------- 地図 ----------
// chapter: その章の物語が始まる場所（次に進む章なら「物語」の印が出る）
// need: その章が開いていれば見える
const WORLD_NODES = [
  { id: 'aquamist', type: 'town', name: 'アクアミスト', sub: '雨の港町', x: 165, y: 455, need: 'act1', shop: 'aquamist', bg: 'rain', preset: 'dusk', desc: '晴れ間より雨音で朝を知る港町。坂の下に、小さな市が戻ってきている。' },
  { id: 'cove', clearedBy: 'act1',  type: 'stage', board: 'cove', name: '夜明けの入り江', sub: '序章の戦場', x: 85, y: 545, need: 'act1', theme: { bg: 'rain', preset: 'dawn', fx: 'rain:0.08,sparkle:0.4', bgm: 'haruka' }, desc: 'リラに水切りを教わった入り江。黒いにじみは、ときどき戻ってくる。' },
  { id: 'belfry', clearedBy: 'act2',  type: 'stage', board: 'gran', chapter: 'act1', name: '鐘楼の空', sub: '第一幕', x: 255, y: 395, theme: { bg: 'rain', preset: 'night', fx: 'rain:0.6', bgm: 'haruka' }, desc: '雲を泳ぐ鯨の真下。涙の雨は、ここから降っていた。' },
  { id: 'grey', type: 'town', name: '灰色の街', sub: 'チクタクの音の街', chapter: 'act2', x: 425, y: 455, shop: 'grey', bg: 'cave_sky', preset: 'gray', desc: '時計の音ばかりが聞こえる街。角のカフェでは、カモミールが頼める。' },
  { id: 'thorn', clearedBy: 'act4',  type: 'stage', board: 'ivy', chapter: 'act3', name: '茨の鳥籠', sub: '第三幕', x: 365, y: 235, theme: { bg: 'forest', preset: 'dim', fx: 'motes:0.5', bgm: 'forest' }, desc: '木漏れ日を妬む茨が、光の精霊を閉じこめている森。' },
  { id: 'canyon', clearedBy: 'act5',  type: 'stage', board: 'spinel', chapter: 'act4', name: '鉛のドーム', sub: '第四幕', x: 600, y: 320, theme: { bg: 'canyon', preset: 'dim', fx: 'gold:0.5', bgm: 'forest' }, desc: '夕日に金色に燃える渓谷。その真ん中に、鉛の丸屋根がある。' },
  { id: 'stone', type: 'town', name: '石の子の村', sub: '黄金の渓谷', need: 'act5', x: 665, y: 435, shop: 'stone', bg: 'canyon', preset: 'dusk', desc: '鉛から解き放たれた石の子たちの村。渓谷の金で、よい刻印を彫る。' },
  { id: 'spire', clearedBy: 'finale',  type: 'stage', board: 'king', chapter: 'act5', name: '虹の尖塔', sub: '第五幕', x: 770, y: 195, theme: { bg: 'glass', preset: 'dim', fx: 'sparkle:0.3', bgm: 'fate' }, desc: '世界の色の調和を守ってきた王の塔。いまは漆黒が玉座を満たしている。' },
  { id: 'rainbow', type: 'town', name: '虹の城下町', sub: '王の街', need: 'finale', x: 870, y: 95, shop: 'rainbow', bg: 'glass', preset: 'bright', desc: '色の戻った城下町。世界中の品が集まる大きな市がある。' },
  { id: 'veil', clearedBy: 'epilogue',  type: 'stage', board: 'chrome', chapter: 'finale', name: '黒い靄の奥', sub: '終章', x: 895, y: 345, theme: { bg: 'stars', preset: 'dark', fx: 'stars:0.6', bgm: 'fate' }, desc: 'ひとつだけ黒い靄のかかった場所。クロムが待っている。' },
  { id: 'nowhere', type: 'story', chapter: 'epilogue', name: '色のない場所', sub: 'エピローグ', x: 955, y: 535, desc: 'リラが話してくれた、伝承の場所。' },
  { id: 'f_mist', type: 'free', free: 'f_mist', name: '霧の浅瀬', sub: 'フリーステージ', need: 'act2', x: 70, y: 335 },
  { id: 'f_fruit', type: 'free', free: 'f_fruit', name: '赤い果実の丘', sub: 'フリーステージ', need: 'act3', x: 205, y: 175 },
  { id: 'f_maze', type: 'free', free: 'f_maze', name: '迷いの森の奥', sub: 'フリーステージ', need: 'act4', x: 500, y: 130 },
  { id: 'f_stars', type: 'free', free: 'f_stars', name: '星見の崖', sub: 'フリーステージ', need: 'finale', x: 760, y: 520 },
  { id: 'f_void', type: 'free', free: 'f_void', name: '透明の回廊', sub: 'フリーステージ', need: 'done', x: 975, y: 225 },
];
const WORLD_ROUTES = [['aquamist', 'cove'], ['aquamist', 'belfry'], ['aquamist', 'f_mist'], ['belfry', 'grey'], ['grey', 'thorn'], ['thorn', 'f_fruit'], ['thorn', 'f_maze'],
  ['grey', 'canyon'], ['canyon', 'stone'], ['canyon', 'spire'], ['f_maze', 'spire'], ['spire', 'rainbow'], ['spire', 'veil'], ['stone', 'f_stars'], ['veil', 'nowhere'], ['veil', 'f_void']];
const WORLD_LANDS = [
  { name: 'アクアミスト', x: 160, y: 470, rx: 160, ry: 115, col: '#3fb4c9', need: 'act1', seed: 1 },
  { name: '灰色の街', x: 430, y: 455, rx: 95, ry: 72, col: '#9aa3b2', need: 'act2', seed: 2 },
  { name: '赤い丘', x: 215, y: 190, rx: 95, ry: 70, col: '#e2584c', need: 'act3', seed: 3 },
  { name: '緑の森', x: 400, y: 200, rx: 150, ry: 105, col: '#5fd07a', need: 'act3', seed: 4 },
  { name: '黄金の谷', x: 625, y: 380, rx: 135, ry: 105, col: '#ffd25e', need: 'act4', seed: 5 },
  { name: '虹の尖塔', x: 805, y: 160, rx: 130, ry: 95, col: '#b48cff', need: 'act5', seed: 6 },
  { name: '黒い靄', x: 915, y: 400, rx: 105, ry: 150, col: '#3a3448', need: 'finale', seed: 7, dark: true },
];
const CHAPTER_NODE = { act1: 'belfry', act2: 'grey', act3: 'thorn', act4: 'canyon', act5: 'spire', finale: 'veil', epilogue: 'nowhere' };

const World = (() => {
  const el = document.getElementById('world');
  const mapEl = document.getElementById('wmMap');
  const svg = document.getElementById('wmSvg');
  const nodesEl = document.getElementById('wmNodes');
  const ariaEl = document.getElementById('wmAria');
  const panel = document.getElementById('wmPanel');
  let party = null, current = null, isOpen = false, moving = false;

  const unlocked = () => Engine.unlocked();
  const has = (k) => !k || unlocked().includes(k);
  const save = () => Engine.load();
  function nextChapter() { const s = save(); return s && SCRIPT[s.chapter] ? s : null; }
  function visible(n) {
    if (n.chapter) return has(n.chapter);
    return has(n.need);
  }
  const node = (id) => WORLD_NODES.find(n => n.id === id) || questNode(id);
  function questNode(id) {
    const q = SIDE_QUESTS[id]; if (!q) return null;
    const town = WORLD_NODES.find(n => n.id === q.town);
    return { id, type: 'quest', quest: id, name: q.title, sub: `${town.name}・${q.giver}の依頼`, need: q.need, x: town.x, y: town.y };
  }
  const questsAt = town => Object.values(SIDE_QUESTS).filter(q => (!town || q.town === town) && has(q.need));
  const bondReady = q => !q.bondNeed || (party.spirits[q.bondNeed.spirit]?.bond || 0) >= q.bondNeed.n;
  const questTier = q => q.lv <= 5 ? '初級' : q.lv <= 12 ? '中級' : q.lv <= 18 ? '上級' : '最上級';
  const confOf = n => n.board ? BOARDS[n.board] : n.free ? FREE_STAGES[n.free] : n.quest ? SIDE_QUESTS[n.quest] : null;
  const chosen = conf => Progression.selected(party, conf.id);
  const diffRec = (conf, key) => stageRec(conf.id)?.difficulties[key] || null;
  function stageRec(id) { return party.stages[id] || null; }
  function storyHere(n) { const s = nextChapter(); return s && n.chapter && n.chapter === s.chapter ? s : null; }
  // 精霊になった仲間（物語の進み具合で決まる）
  function spiritsNow() { const at = { gran: 'act2', ivy: 'act4', spinel: 'act5', king: 'finale' }; return Object.keys(at).filter(id => has(at[id]) || (party.stages[id] && party.stages[id].cleared)); }
  const replayable = (n, rec) => !!(rec || n.type === 'free' || (n.type === 'quest' && bondReady(SIDE_QUESTS[n.quest])) || (n.clearedBy && has(n.clearedBy)));
  function stageConf(n) {
    if (n.board) {
      const c = JSON.parse(JSON.stringify(BOARDS[n.board]));
      if (c.tutorial) { delete c.tutorial; c.intro = { who: 'アリア', text: 'もう一度、ここで。<br><small>ミッションをすべて達成するとSランク</small>' }; }
      c.difficulty = chosen(c); return c;
    }
    const f = JSON.parse(JSON.stringify(confOf(n)));
    f.kegWords = FREE_WORDS.slice().sort(() => Math.random() - 0.5);
    f.rootWord = '';
    f.spirits = spiritsNow();
    f.difficulty = chosen(f);
    f.intro = { who: '', text: f.desc + '<br><small>ミッションをすべて達成するとSランク</small>' };
    return f;
  }

  // ---------- 描画 ----------
  function blob(cx, cy, rx, ry, seed) {
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2;
      const k = 1 + 0.13 * Math.sin(a * 3 + seed * 1.7) + 0.08 * Math.sin(a * 7 + seed * 3.1) + 0.05 * Math.sin(a * 11 + seed);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      d += i === 0 ? `M${m[0].toFixed(1)},${m[1].toFixed(1)}` : `Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
    }
    const p0 = pts[0], m0 = [(p0[0] + pts[1][0]) / 2, (p0[1] + pts[1][1]) / 2];
    return d + `Q${p0[0].toFixed(1)},${p0[1].toFixed(1)} ${m0[0].toFixed(1)},${m0[1].toFixed(1)}Z`;
  }
  function drawSvg() {
    let defs = '<defs><filter id="wmGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter><filter id="wmSoft"><feGaussianBlur stdDeviation="2.5"/></filter>';
    let land = '', labels = '';
    WORLD_LANDS.forEach((l, i) => {
      const on = has(l.need);
      defs += `<radialGradient id="wl${i}" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${on ? l.col : '#5a5f6e'}" stop-opacity="${on ? (l.dark ? 0.9 : 0.55) : 0.28}"/><stop offset="1" stop-color="${on ? l.col : '#3a3f4e'}" stop-opacity="${on ? 0.12 : 0.08}"/></radialGradient>`;
      const d = blob(l.x, l.y, l.rx, l.ry, l.seed);
      land += `<path d="${d}" fill="${on ? l.col : '#556'}" opacity="${on ? 0.25 : 0.08}" filter="url(#wmGlow)"/>`;
      land += `<path d="${d}" fill="url(#wl${i})" stroke="${on ? l.col : '#667'}" stroke-opacity="${on ? 0.55 : 0.2}" stroke-width="1.5"/>`;
      if (l.dark && on) land += `<path d="${blob(l.x, l.y, l.rx * 0.7, l.ry * 0.7, l.seed + 2)}" fill="#05040a" opacity=".7" filter="url(#wmSoft)"/>`;
      labels += `<text x="${l.x}" y="${l.y + l.ry * 0.62}" class="wl-label ${on ? '' : 'off'}">${on ? l.name : '？？？'}</text>`;
    });
    defs += '</defs>';
    let routes = '';
    WORLD_ROUTES.forEach(([a, b]) => {
      const A = node(a), B = node(b); if (!A || !B || !visible(A) || !visible(B)) return;
      const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.12, my = (A.y + B.y) / 2 - (B.x - A.x) * 0.12;
      routes += `<path d="M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}" class="wr"/>`;
    });
    // 海の光
    let sea = '';
    for (let i = 0; i < 70; i++) { const x = (i * 137.5) % 1000, y = (i * 91.3) % 620; sea += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(i % 3) * 0.6 + 0.6}" class="ws" style="animation-delay:${(i % 9) * 0.5}s"/>`; }
    svg.innerHTML = defs + `<g>${sea}</g><g>${land}</g><g>${routes}</g><g>${labels}</g>`;
  }
  function drawNodes() {
    nodesEl.innerHTML = '';
    WORLD_NODES.filter(visible).forEach(n => {
      const b = document.createElement('button');
      const story = storyHere(n);
      const conf = confOf(n), key = conf && chosen(conf);
      const rec = conf && diffRec(conf, key);
      const locked = (n.type === 'stage' && !replayable(n, stageRec(conf.id)) && !story) || (n.type === 'story' && !story);
      b.className = `wn t-${n.type}${story ? ' story' : ''}${locked ? ' dim' : ''}${current === n.id ? ' here' : ''}`;
      b.style.left = (n.x / 10) + '%'; b.style.top = (n.y / 6.2) + '%';
      b.dataset.node = n.id;
      const qs = n.type === 'town' ? questsAt(n.id) : [];
      const levels = qs.map(q => Progression.level(q, chosen(q)));
      const meta = conf ? `LV${Progression.level(conf, key)}・${Progression.difficulties[key].name}` : qs.length ? `依頼${qs.length}件・LV${Math.min(...levels)}〜${Math.max(...levels)}` : '';
      b.setAttribute('aria-label', n.name + (meta ? '・適正' + meta : ''));
      const icon = n.type === 'town' ? '⌂' : n.type === 'free' ? '◇' : n.type === 'story' ? '✧' : '◆';
      b.innerHTML = `<i class="wn-dot">${icon}</i><span class="wn-name">${n.name}</span>${meta ? `<span class="wn-meta">${meta}</span>` : ''}${rec && rec.best ? `<span class="wn-rank r${rec.best}">${rec.best}</span>` : ''}${story ? '<span class="wn-story">物語</span>' : ''}`;
      b.onclick = (e) => { e.stopPropagation(); go(n.id); };
      nodesEl.appendChild(b);
    });
  }
  function placeAria(id, animate) {
    const n = node(id) || node('aquamist');
    ariaEl.style.transition = animate ? 'left .7s cubic-bezier(.4,0,.2,1), top .7s cubic-bezier(.4,0,.2,1)' : 'none';
    ariaEl.style.left = (n.x / 10) + '%'; ariaEl.style.top = (n.y / 6.2) + '%';
    if (innerWidth <= 820) requestAnimationFrame(() => {
      const view = document.getElementById('wmViewport');
      view.scrollTo({ left: mapEl.offsetLeft + mapEl.offsetWidth * n.x / 1000 - view.clientWidth / 2,
        top: mapEl.offsetTop + mapEl.offsetHeight * n.y / 620 - view.clientHeight / 2, behavior: animate ? 'smooth' : 'instant' });
    });
  }
  function updateTop() {
    document.getElementById('wmLv').textContent = party.aria.lv;
    document.getElementById('wmGold').textContent = party.gold;
  }

  // ---------- 移動と案内 ----------
  async function go(id) {
    if (moving) return;
    const n = node(id);
    Audio2.sfx.choose();
    if (current !== id) {
      moving = true;
      placeAria(id, true);
      Audio2.sfx.step();
      current = id; party.pos = id; Board.saveParty();
      await new Promise(r => setTimeout(r, 720));
      moving = false;
      drawNodes();
    }
    showPanel(n);
  }
  function missionsHtml(conf, rec) {
    return `<div class="wp-ms">${(conf.missions || []).map((m, i) => `<div class="${rec && rec.missions && rec.missions[i] ? 'ok' : ''}"><i></i>${missionLabel(m, conf)}</div>`).join('')}</div>`;
  }
  function missionLabel(m, conf) {
    const f = conf.inverted ? ['夜空', '白い膜'] : ['虹', 'くすみ'];
    return ({
      turns: `${m.n}ターン以内にクリア`, hp: `アリアのHPを${m.n}%以上残す`, back: `背後から${m.n}回攻撃する`, crit: `会心の一撃を${m.n}回出す`,
      summonKill: `召喚した精霊で${m.n}体倒す`, enchantKill: `精霊を宿した心剣で${m.n}体倒す`, flashMulti: '透明の一閃で2体を同時に斬る',
      noSpirit: '精霊の力を借りずにクリア', noItem: '道具を使わずにクリア', noDown: '召喚した精霊を倒させない',
      rainbow: `クリア時に${f[0]}の床${m.n}%以上`, dullMax: `${f[1]}を一度も${m.n}%にしない`, bossLast: '核を最後に倒す',
      spiritUse: `${Progression.spirits[m.spirit]?.name}の力を${m.n}回使う`, skillUse: `${m.spirit ? Progression.spirits[m.spirit].name + 'から' : ''}覚えた技を${m.n}回使う`,
    })[m.type] || '';
  }
  function showPanel(n) {
    const changed = panel.dataset.node !== n.id;
    panel.dataset.node = n.id;
    const story = storyHere(n);
    const conf = confOf(n);
    const sid = conf ? conf.id : null;
    const rec = sid ? stageRec(sid) : null;
    const typeName = { town: '町', stage: '戦場', free: 'フリーステージ', story: '物語', quest: 'サブクエスト' }[n.type];
    let body = `<div class="wp-head"><span class="wp-type t-${n.type}">${typeName}</span><div class="wp-name">${n.name}</div><div class="wp-sub">${n.sub || ''}</div></div>
      <p class="wp-desc">${n.desc || (conf && conf.desc) || ''}</p>`;
    const acts = [];
    if (conf) {
      const key = chosen(conf), d = Progression.difficulties[key];
      body += `<div class="wp-sec">難易度<small>このステージに保存</small></div><div class="wp-difficulty">${Object.entries(Progression.difficulties).map(([id, v]) => {
        const rank = diffRec(conf, id)?.best;
        return `<button data-diff="${id}" class="${id === key ? 'on' : ''}" aria-pressed="${id === key}">${v.name}<small>LV${Progression.level(conf, id)}${rank ? '・' + rank : '・未クリア'}</small></button>`;
      }).join('')}</div><p class="wp-note">${d.desc}。適正LV ${Progression.level(conf, key)}${n.quest ? '・' + questTier(conf) + 'の依頼' : ''}</p>`;
      if (party.aria.lv < Progression.level(conf, key)) body += '<p class="wp-level-note">アリアのLVより高めの戦場です。装備と精霊の力を整えて挑戦できます。</p>';
    }
    if (story) {
      const ch = CHAPTERS.find(c => c.key === story.chapter);
      body += `<div class="wp-story"><small>次の物語</small><b>${ch ? ch.act + '　' + ch.title : ''}</b></div>`;
      acts.push(`<button class="wb main" data-a="story">物語を進める</button>`);
    }
    if (conf && replayable(n, rec)) {
      const key = chosen(conf), record = diffRec(conf, key), lv = Progression.level(conf, key);
      const u = EQUIP[conf.unique];
      const got = conf.unique && party.owned.includes(conf.unique);
      body += `<div class="wp-info"><span>適正LV <b>${lv}</b></span><span>最高ランク <b class="r${record && record.best || 'none'}">${record && record.best || '—'}</b></span><span>クリア <b>${record?.clears || 0}</b>回</span></div>
        <div class="wp-sec">ミッション<small>${Progression.difficulties[key].name}の実績</small></div>${missionsHtml(conf, record)}
        ${u ? `<div class="wp-unique ${got ? 'got' : ''}"><small>Sランクの報酬</small><b>${got ? u.name : '？？？'}</b><span>${got ? u.desc : 'ユニーク装備'}</span></div>` : ''}`;
      if (conf.reward) body += `<p class="wp-note">基本報酬 ${Math.round(conf.reward * Progression.difficulties[key].reward)}しずく＋撃破・ランク報酬</p>`;
      if (conf.firstItems) body += `<p class="wp-note">${record?.cleared ? '初回報酬は受取済み' : 'この難易度の初回報酬：' + Object.entries(conf.firstItems).map(([id, v]) => `${ITEMS[id].name} ×${v}`).join('・')}<br>道具の所持上限は各9個</p>`;
      if (!story) acts.push(`<button class="wb main" data-a="sortie">出撃</button>`);
      else acts.push(`<button class="wb" data-a="sortie">この戦場だけ戦う</button>`);
    } else if (n.type === 'quest') {
      const need = conf.bondNeed;
      body += `<p class="wp-note">受注条件：${Progression.spirits[need.spirit].name}との絆 ${need.n}（現在 ${party.spirits[need.spirit]?.bond || 0}）。召喚や宿しで絆を育てると挑戦できます。</p>`;
    } else if (n.type === 'stage' && !story) {
      body += '<p class="wp-note">物語が進むと、ここで戦えるようになる。</p>';
    }
    if (n.type === 'town') { acts.push(`<button class="wb main" data-a="shop">店に入る</button>`); }
    if (n.type === 'town' && questsAt(n.id).length) body += `<div class="wp-sec">町の依頼<small>${questsAt(n.id).length}件</small></div>${questList(n.id)}`;
    acts.push(`<button class="wb" data-a="equip">装備</button>`);
    panel.innerHTML = body + `<div class="wp-acts">${acts.join('')}</div>`;
    panel.classList.remove('hidden');
    if (changed) panel.scrollTop = 0;
    bindQuests(panel);
    panel.querySelectorAll('[data-diff]').forEach(b => b.onclick = e => {
      e.stopPropagation(); party.stageDifficulty[sid] = b.dataset.diff; Board.saveParty();
      Audio2.sfx.choose(); drawNodes(); showPanel(n);
    });
    panel.querySelectorAll('[data-a]').forEach(b => b.onclick = (e) => {
      e.stopPropagation(); Audio2.sfx.choose();
      const a = b.dataset.a;
      if (a === 'story') playStory(story);
      else if (a === 'sortie') sortie(n);
      else if (a === 'shop') openShop(n);
      else if (a === 'equip') openEquip();
    });
  }

  // ---------- 物語・出撃 ----------
  function playStory(s) {
    close();
    if (s.map) Engine.play(s.chapter); else Engine.cont();
  }
  function sortie(n) {
    if (n.quest && !bondReady(SIDE_QUESTS[n.quest])) return;
    const conf = stageConf(n);
    const th = n.theme || conf.theme || { bg: 'teal', preset: 'dim', fx: 'none', bgm: 'forest' };
    close();
    Engine.resetStage();
    Engine.setBg(th.bg, th.preset || 'dim'); FX.set(th.fx || 'none'); Audio2.playBgm(th.bgm || 'forest');
    if (!Renoir.state.colors.length) Renoir.state.colors = ['teal', 'green', 'gold', 'violet'].slice(0, Math.max(1, spiritsNow().length));
    Board.start(conf, () => open({ at: n.id }));
  }

  // ---------- サブクエスト ----------
  function questList(town) {
    return `<div class="quest-list">${questsAt(town).map(q => {
      const key = chosen(q), r = diffRec(q, key), d = Progression.difficulties[key];
      return `<button class="quest-card" data-quest="${q.id}"><span><b>${q.title}</b><small>${WORLD_NODES.find(n => n.id === q.town).name}・${q.giver}</small></span>
        <em>${questTier(q)} / ${d.name}・適正LV ${Progression.level(q, key)}</em><small>${!bondReady(q) ? '絆を育てると受注可能' : r?.cleared ? `${d.name}クリア済み・${r.best}ランク` : `${d.name}未クリア`}　基本${Math.round(q.reward * d.reward)}しずく</small></button>`;
    }).join('')}</div>`;
  }
  function bindQuests(root) {
    root.querySelectorAll('[data-quest]').forEach(b => b.onclick = e => { e.stopPropagation(); Panel.close(); go(b.dataset.quest); });
  }
  function openQuests() {
    Panel.open('町の依頼', `<p class="wp-note">物語が進むと依頼が増えます。各依頼で難易度を選べます。</p>${questList() || '<p>まだ依頼はありません。</p>'}`);
    bindQuests(Panel.body());
  }

  // ---------- 店 ----------
  function openShop(n) {
    const render = () => {
      const list = SHOPS[n.shop] || [];
      const row = (id) => {
        const it = ITEMS[id], eq = EQUIP[id], x = it || eq;
        const owned = eq ? party.owned.includes(id) : false;
        const cnt = it ? (party.items[id] || 0) : 0;
        const dis = party.gold < x.price || owned || (it && cnt >= ITEM_MAX);
        const tag = it ? '道具' : SLOT_NAME[eq.slot];
        return `<div class="sh-row"><span class="sh-tag ${eq ? eq.slot : 'item'}">${tag}</span><div class="sh-main"><b>${x.name}</b><small>${x.desc}</small></div>
          <span class="sh-own">${it ? `${cnt}/${ITEM_MAX}` : owned ? (party.equip[eq.slot] === id ? '装備中' : '持っている') : ''}</span>
          <button class="sh-buy" data-id="${id}" ${dis ? 'disabled' : ''}>${x.price}<small>しずく</small></button></div>`;
      };
      Panel.open(`${n.name}の店`, `<div class="shop"><div class="sh-gold">しずく <b>${party.gold}</b><small>戦いで手に入る「色のしずく」で買いものができます</small></div>
        <div class="sh-sec">道具</div>${list.filter(id => ITEMS[id]).map(row).join('')}
        <div class="sh-sec">装備</div>${list.filter(id => EQUIP[id]).map(row).join('')}
        <div style="text-align:center"><button class="btn-main" id="shEquip">装備を整える</button></div></div>`);
      const b = Panel.body();
      b.querySelectorAll('.sh-buy').forEach(x => x.onclick = () => buy(x.dataset.id, render));
      b.querySelector('#shEquip').onclick = () => openEquip();
    };
    render();
  }
  function buy(id, rerender) {
    const it = ITEMS[id], eq = EQUIP[id], x = it || eq;
    if (party.gold < x.price) return;
    if (it) { if ((party.items[id] || 0) >= ITEM_MAX) return; party.items[id] = (party.items[id] || 0) + 1; }
    else { if (party.owned.includes(id)) return; party.owned.push(id); }
    party.gold -= x.price;
    Board.saveParty();
    Audio2.sfx.star(3);
    Engine.toast(eq ? `「${eq.name}」を買った。装備から身につけられます` : `「${it.name}」を買った`);
    updateTop();
    rerender();
  }

  // ---------- 装備 ----------
  function openEquip() {
    const render = () => {
      const lv = party.aria.lv, gb = Board.gearBonus(party.equip), st = Board.statsFor('aria', lv, gb);
      const slot = (s) => {
        const mine = party.owned.filter(id => EQUIP[id] && EQUIP[id].slot === s);
        const cur = party.equip[s];
        return `<div class="eq-slot"><div class="eq-sh">${SLOT_NAME[s]}<span>${cur ? EQUIP[cur].name : 'なし'}</span></div>
          <div class="eq-list">${mine.length ? mine.map(id => `<button class="eq-it ${cur === id ? 'on' : ''} ${EQUIP[id].unique ? 'uq' : ''}" data-s="${s}" data-id="${id}"><b>${EQUIP[id].name}</b><small>${EQUIP[id].desc}</small>${EQUIP[id].lore ? `<em>${EQUIP[id].lore}</em>` : ''}</button>`).join('') : '<p class="eq-none">まだ持っていない</p>'}
          ${cur ? `<button class="eq-off" data-s="${s}">はずす</button>` : ''}</div></div>`;
      };
      const sp = Object.keys(gb).filter(k => gb[k] && !['atk', 'def', 'hp'].includes(k)).reduce((o, k) => (o[k] = gb[k], o), {});
      Panel.open('装備', `<div class="equip">
        <div class="eq-stat"><img src="assets/img/aria.png"><div><div class="eq-name">アリア<span>LV ${lv}</span></div>
          <div class="eq-nums"><span>HP<b>${st.mhp}</b></span><span>攻撃<b>${st.atk}</b></span><span>守り<b>${st.def}</b></span><span>移動<b>${4 + gb.mov}</b></span></div>
          <div class="eq-sp">${fxText(sp) || '特別な力はまだない'}</div></div></div>
        ${['blade', 'cloth', 'charm'].map(slot).join('')}
        <div class="eq-items"><div class="sh-sec">道具<small>戦いの中で「道具」から使う</small></div>${Object.keys(party.items).filter(k => party.items[k] > 0).map(k => `<div><b>${ITEMS[k].name}</b> ×${party.items[k]}<small>${ITEMS[k].desc}</small></div>`).join('') || '<p class="eq-none">持っていない</p>'}</div>
      </div>`);
      const b = Panel.body();
      b.querySelectorAll('.eq-it').forEach(x => x.onclick = () => { party.equip[x.dataset.s] = x.dataset.id; Board.saveParty(); Audio2.sfx.choose(); render(); });
      b.querySelectorAll('.eq-off').forEach(x => x.onclick = () => { party.equip[x.dataset.s] = null; Board.saveParty(); Audio2.sfx.page(); render(); });
    };
    render();
  }
  function openParty() {
    const sp = ['gran', 'ivy', 'spinel', 'king'].filter(id => party.spirits[id] || spiritsNow().includes(id));
    const names = { gran: 'グラン', ivy: 'アイビー', spinel: 'スピネル', king: 'パレット王' };
    const cols = { gran: '#3fb4c9', ivy: '#5fd07a', spinel: '#ffd25e', king: '#b48cff' };
    const uniq = Object.keys(EQUIP).filter(k => EQUIP[k].unique);
    Panel.open('仲間', `<div class="pt">
      <div class="pt-row"><span class="pt-name">${GameArt.portrait('aria', 'pt-art')}<b>アリア</b></span><span>LV ${party.aria.lv}</span><span class="pt-exp"><i style="width:${party.aria.exp}%"></i></span></div>
      <p class="wp-note">召喚+3、宿す+2、精霊や宿した心剣の命中+1、覚えた技の使用+2。絆8・20・40でアリアが力を覚え、召喚や宿しなしでも使えます。</p>
      ${sp.map(id => {
        const r = party.spirits[id] || { lv: party.aria.lv, exp: 0, bond: 0, uses: 0 }, rank = Progression.rank(r.bond), next = Progression.thresholds[rank];
        const from = Progression.thresholds[rank - 1], percent = next ? (r.bond - from) / (next - from) * 100 : 100;
        return `<div class="bond-card" style="--c:${cols[id]}"><div class="pt-row"><span class="pt-name">${GameArt.portrait(id, 'pt-art')}<b>${names[id]}</b></span><span>LV ${r.lv}</span><span class="pt-exp"><i style="width:${r.exp}%"></i></span></div>
          <div class="bond-info"><b>絆${rank}</b><span>${r.bond}${next ? ' / ' + next : '・最大ランク'}　使用${r.uses}回</span></div><div class="pt-exp bond-bar"><i style="width:${percent}%"></i></div>
          <p class="wp-note">精霊：HP +${(rank - 1) * 5}%・攻撃 +${(rank - 1) * 4}%・守り +${(rank - 1) * 2}%<br>宿した心剣・攻撃技の威力 +${(rank - 1) * 3}%</p>
          ${Progression.skills.filter(s => s.spirit === id).map(s => `<div class="bond-skill ${party.aria.skills.includes(s.id) ? 'known' : ''}"><b>${party.aria.skills.includes(s.id) ? '✓' : '◇'} ${s.name}</b><small>${s.type}・${party.aria.skills.includes(s.id) ? '習得済み / 共鳴' + s.cost : '絆' + s.at + 'で習得（あと' + Math.max(0, s.at - r.bond) + '）'}</small><span>${s.desc}</span></div>`).join('')}</div>`;
      }).join('') || '<p>まだ精霊の仲間はいない</p>'}
      <div class="sh-sec">ユニーク装備<small>${uniq.filter(k => party.owned.includes(k)).length} / ${uniq.length}</small></div>
      <div class="pt-uq">${uniq.map(k => `<span class="${party.owned.includes(k) ? 'on' : ''}">${party.owned.includes(k) ? EQUIP[k].name : '？？？'}</span>`).join('')}</div></div>`);
  }

  // ---------- 開閉 ----------
  function open(opt = {}) {
    party = Board.reloadParty();
    Board.stop();
    document.getElementById('title').style.display = 'none';
    document.getElementById('textbox').classList.add('hidden');
    Engine.setBg('stars', 'night'); FX.set('sparkle:0.15');
    if (Audio2.bgmKey !== 'forest') Audio2.playBgm('forest');
    const s = nextChapter();
    const arrive = opt.arrive ? CHAPTER_NODE[opt.arrive] : opt.at;
    current = party.pos && node(party.pos) && visible(node(party.pos)) ? party.pos : 'aquamist';
    drawSvg(); drawNodes(); updateTop();
    placeAria(current, false);
    el.classList.remove('hidden');
    isOpen = true;
    panel.dataset.node = '';
    panel.classList.add('hidden');
    const target = arrive || (s && s.map ? CHAPTER_NODE[s.chapter] : null);
    if (target && node(target) && visible(node(target))) setTimeout(() => go(target), 450);
    else showPanel(node(current));
  }
  function close() { el.classList.add('hidden'); isOpen = false; panel.classList.add('hidden'); }
  el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); Audio2.sfx.choose();
    const w = b.dataset.w;
    if (w === 'equip') openEquip();
    else if (w === 'quests') openQuests();
    else if (w === 'party') openParty();
    else if (w === 'title') { close(); Main.toTitle(); }
  }));
  el.addEventListener('click', e => { if (e.target === el || e.target === mapEl || e.target.closest('svg')) panel.classList.add('hidden'); });
  return { open, close, get isOpen() { return isOpen; }, refresh() { if (isOpen) { updateTop(); drawNodes(); } } };
})();
