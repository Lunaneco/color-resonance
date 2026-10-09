// 本編ではグラン・アイビー・スピネル・パレット王本人。HPは貼りついた穢れの厚さを表す。
const GUARDIAN_LEGACY_SCRIPTS = {...SCRIPT};
const GUARDIANS = [
  { id:'gran', slot:0, name:'グラン・オーシャン', legacy:true, chapter:'act1', place:'鐘楼への階段', from:'gran', lv:2, town:'belfry', pattern:'tide', effect:'push', colour:'#69d8e8', material:'m_teal', unique:'u_bell',
    prelude:'鐘楼へ上がる階段を、鯨の涙からにじんだ影がふさいでいた。アリアは雨の澱を切り分け、グラン自身の穢れへ届く道を開いた。',
    returnLine:'鐘が一度だけ鳴った。濡れた階段を、アリアは上へ進んだ。',
    skills:['逆巻く潮線','ふたつの潮線','帰り潮のうねり'], counter:'横一列の潮線を避ける。虹の床では押し流されない。',
    lines:[[['グラン','泣き続けなければ……泣き、続け……！'],['アリア','聞こえなくても言う。あなたの悲しみは、切らない。']], [['グラン','……誰だ。あの子の……歌が'],['アリア','老漁師が歌っていた。あなたの海に、残っていた歌だよ。']], [['グラン','波が、また上がる。下の段から離れろ……！'],['アリア','教えてくれたのは、あなたの声だね。あと少し。']]],
    freed:'あの子の声が、する。悲しみの下で、まだ覚えていた。' },
  { id:'ivy', slot:2, name:'シルキー・アイビー', legacy:true, chapter:'act3', place:'森の結び目', from:'ivy', lv:5, town:'thorn', pattern:'vines', effect:'root', colour:'#96dca4', material:'m_green', unique:'u_vine',
    prelude:'森の入り口から、アイビーの鳥籠へ続く道が影に覆われていた。アリアは鳥道をふさぐ影を払い、緑の精霊自身へ届く足場を探した。',
    returnLine:'鳥が一羽、開いた枝を抜けた。森の奥では、まだ重い緑の音がしている。',
    skills:['蔦の小檻','絡み直す根','ほどける鳥道'], counter:'足元の周囲を蔦が囲む。虹の床なら拘束を防げる。',
    lines:[[['アイビー','私を、見ないで……妹役、妹役……！'],['アリア','あなたを比べる声、その結び目を見てる。']], [['アイビー','鳥が……帰れない。姉さんは、どこ'],['アリア','ルミナもここにいる。あなた自身の声で、呼んでいい。']], [['アイビー','外側の根が伸びる。枝の間を抜けて'],['アリア','あなたの名前は、アイビー。妹役じゃない。']]],
    freed:'……なに、これ。頭が、静か。姉さんを呼ぶ声が、私に戻ってきた。' },
  { id:'spinel', slot:3, name:'スピネル', legacy:true, chapter:'act4', place:'石の谷の外縁', from:'spinel', lv:8, town:'canyon', pattern:'shell', effect:'armor', colour:'#f5cf85', material:'m_gold', unique:'u_kintsugi',
    prelude:'谷へ降りる道に、鉛の影が積み重なっていた。奥ではスピネル自身がドームに閉じこもっている。アリアは石の子たちの道を払い、殻の前へ進んだ。',
    returnLine:'石の子たちの道が開いた。谷の奥では、スピネルを閉じこめる鉛がまだ鈍く光っていた。',
    skills:['閉ざす晶環','砕ける外殻','開いた金継ぎ'], counter:'殻の周囲に衝撃の環。段階が進むと装甲が薄くなる。',
    lines:[[['スピネル','出ていけ……出て、いけ……！'],['アリア','外の鉛だけを斬る。あなたには、触らない。']], [['スピネル','石の子は……まだ、そこにいるか'],['アリア','いるよ。あなたが庇った子たちが、待ってる。']], [['スピネル','環の外へ。今なら、鉛の隙間に届く'],['アリア','その隙間から、外を見よう。']]],
    freed:'本当は、外が見たかった。傷の向こうに、みんながいた。' },
  { id:'king', slot:4, name:'パレット王', legacy:true, chapter:'act5', place:'虹の尖塔の門', from:'king', lv:11, town:'spire', pattern:'prism', effect:'guard', colour:'#c4adf5', material:'m_violet', unique:'u_palette',
    prelude:'尖塔の門を、王の借り物の言葉から生まれた影がふさいでいた。玉座の奥には、汚染されたパレット王自身がいる。アリアたちは七色の道を、王のもとまでつないだ。',
    returnLine:'門に七色の影が落ちた。違う色のまま、アリアは尖塔へ入った。',
    skills:['斜めの黒光','交差する彩線','七色を返す王冠'], counter:'斜めに伸びる光線。虹にした床は守りを生まない。',
    lines:[[['パレット王','世界を、黒で……満たせ……！'],['アリア','その言葉の下に、あなたの七色がある。']], [['パレット王','私は……民の声を、聞こうと'],['アリア','王の声で、もう一度聞いて。誰かの命令じゃなく。']], [['パレット王','斜めの光が重なる。その間に道がある'],['アリア','教えてくれたのは、世界の調和を守るあなた。']]],
    freed:'私は、何をしていた。すまない。民の違う色を、もう奪わない。' },
  { id:'nephra', slot:5, name:'夜渡りのネフラ', chapter:'finale', place:'王国へ届く最後の橋', from:'king', lv:14, town:'veil', pattern:'night', effect:'unguard', colour:'#9aaee5', material:'m_violet', unique:'u_nightsky',
    prelude:'王国へ届く最後の橋で、夜を渡る精霊が自分の影を踏み続けていた。黒そのものは静かだった。その上に、夜を閉じろという別の声が貼りついている。',
    returnLine:'橋の先に、夜の深さが残った。アリアはその黒を消さずに、ヴェールへ歩いた。',
    skills:['影の両岸','月影のすきま','星のない縁'], counter:'戦場の縁と影の帯に注意。虹の床なら守りを剥がされない。',
    lines:[[['ネフラ','……ヨル、トジ……'],['アリア','夜を好きでいることは、悪くない。']], [['ネフラ','黒を……切るの？'],['アリア','黒に貼りついた声を切る。あなたの夜は残す。']], [['ネフラ','縁の影が動く。星の道を見て'],['アリア','うん。夜の中を、歩けるね。']]],
    freed:'夜を残してくれて、ありがとう。静かに休める橋に戻すよ。' },
  { id:'farol', slot:6, name:'港灯のファロル', chapter:'restore1', place:'桟橋の灯台路', from:'restore1', lv:16, town:'aquamist', pattern:'lighthouse', effect:'push', colour:'#93d9e5', material:'m_teal', unique:'u_quest_harbor',
    prelude:'桟橋への道に、流木の影が集まっていた。港の灯を守る精霊も、長い停電の中で穢れを抱え込んでいる。二人は荷車の道から順に、影をほどくことにした。', returnLine:'灯台の精霊は航路を照らす仕事へ戻った。荷車を通し、二人は桟橋の修理へ向かう。',
    skills:['途切れる灯列','二本の灯列','帰港を呼ぶ灯'], counter:'縦の灯列を避ける。虹の床なら潮の押し流しを防げる。',
    lines:[[['ファロル','……ヒ、ヲ、ケセ……！'],['クロム','その声を広げたのは僕だ。今は、止める。']], [['ファロル','帰る船が……見えない'],['アリア','灯を戻す。ここにいる人たちの船へ。']], [['ファロル','隣の灯列にも潮が来る。横へ移って'],['クロム','聞こえた。二人で道をつなぐ。']]], freed:'戻る船の灯を、もう奪わせないよ。' },
  { id:'rivela', slot:7, name:'水紐のリヴェラ', chapter:'restore2', place:'水門前の分岐', from:'restore2', lv:18, town:'aquamist', pattern:'carp', effect:'sp', colour:'#91cddd', material:'m_teal', unique:'u_quest_tide',
    prelude:'水門の手前で、流れの分岐を影が埋めていた。水紐の精霊は、どの家へ水を流すか思い出せないまま、同じ波を二つの水路へ返し続けていた。', returnLine:'リヴェラは家ごとの水路を見分けた。二人は、その流れを閉じる校正の結び目へ進む。',
    skills:['返し水の二路','重なる水路','ほどける水紐'], counter:'離れた二本の水路が危険。虹で澄ませると共鳴が残る。',
    lines:[[['リヴェラ','……オナジ、ナミ……'],['ルノワール','流れ先まで、同じにしなくていい。']], [['リヴェラ','家が……ひとつずつ、違う'],['アリア','そう。どの窓にも水がいる。']], [['リヴェラ','二つ目の流れが折り返す。真ん中へ'],['クロム','あなたの道しるべで、進むよ。']]], freed:'違う速さの水を、違う窓へ届けてくる。' },
  { id:'pomela', slot:8, name:'苗耳のポメラ', chapter:'restore3', place:'果樹園の苗道', from:'restore3', lv:20, town:'thorn', pattern:'orchard', effect:'root', colour:'#b3dfa4', material:'m_green', unique:'u_quest_bloom',
    prelude:'苗道を影が覆い、苗耳の精霊は落ちた名札を拾い続けていた。拾うたびに、違う名前を消せという声が耳へ結びつく。名札を守る仕事が、名前のない檻を育てていた。', returnLine:'名札を読む声が戻った。二人は精霊と札を分けて拾い、果樹園の奥へ道を開いた。',
    skills:['囲い芽の輪','二重の苗輪','帰る芽吹き'], counter:'足元を囲う芽の輪。輪の内側か外側へ抜け、虹で根を防ぐ。',
    lines:[[['ポメラ','……ナ、マエ……イラナイ……'],['アリア','その札は、植えた人の名前だよ。']], [['ポメラ','この苗……誰が、植えた？'],['クロム','消える前に、札を読もう。']], [['ポメラ','外の芽が伸びる。苗の間に立って'],['アリア','あなたの耳に、名前を返すね。']]], freed:'違う名前を、ひとつずつ覚え直すよ。' },
  { id:'folio', slot:9, name:'紙翼のフォリオ', chapter:'restore4', place:'記録院の外階段', from:'restore4', lv:22, town:'rainbow', pattern:'crane', effect:'unguard', colour:'#d2c6f1', material:'m_violet', unique:'u_quest_palette',
    prelude:'記録院の外階段で、頁からこぼれた影が道を消していた。紙翼の精霊は破れた記録を抱え、空白の命令に折りたたまれている。翼を開く場所から、二人は取り戻した。', returnLine:'フォリオは原本を抱えて扉を開けた。書かれたことも、書かれなかったことも残したまま、二人は記録院へ入る。',
    skills:['折り目の十字','開く頁の線','原本の余白'], counter:'十字の折り目が走る。虹の余白なら守りを失わない。',
    lines:[[['フォリオ','……クウ、ハク……'],['クロム','空白で、なかったことにはしない。']], [['フォリオ','二枚……違う、記録'],['アリア','重ねずに、両方見せて。']], [['フォリオ','折り目が開く。線から外へ'],['クロム','その翼を、命令から離す。']]], freed:'同じにならない頁を、そのまま預かるよ。' },
  { id:'fiamma', slot:10, name:'炉火のフィアンマ', chapter:'restore5', place:'家の丘の石段', from:'restore5', lv:24, town:'stone', pattern:'hearth', effect:'ember', colour:'#f2bd88', material:'m_gold', unique:'u_quest_bridge',
    prelude:'家の丘の石段には、冷えた炉からこぼれた影が残っていた。炉火の精霊は誰かの帰りを呼ぶ声に包まれ、火をつける相手を見失っている。二人は空いた家を焼かず、声に貼りつく影を追った。', returnLine:'炉火は、いま暮らす人の湯を温めはじめた。戻らない声の奥にある命令を、二人は確かめに行った。',
    skills:['くすぶる火床','ひらく炉の口','誰かのための火'], counter:'炉の周りへ火床が残る。虹で消すと追加のくすみを防ぐ。',
    lines:[[['フィアンマ','……オカエ、リ……オカエリ……'],['アリア','その声を、帰ってきた人の代わりにはしない。']], [['フィアンマ','今……誰を、温めれば'],['クロム','ここで暮らしている人たちを。']], [['フィアンマ','火口が広がる。虹で、火床を消して'],['アリア','声じゃなくて、あなた自身へ届くように。']]], freed:'戻る人にも、戻らない人を待つ人にも、温かい湯を用意するよ。' },
  { id:'lucerna', slot:11, name:'灯翅のルチェルナ', chapter:'restore6', place:'広場へ続く小路', from:'restore6', lv:26, town:'rainbow', pattern:'lantern', effect:'guard', colour:'#ecd494', material:'m_violet', unique:'u_quest_stargarden',
    prelude:'広場へ続く小路で、影が違う色の窓を閉じていた。灯翅の精霊は、ひとつだけ正しい灯を選ぼうとして、その光の中に閉じこめられている。二人は窓ごとの道を開いた。', returnLine:'灯翅は窓をひとつずつ見分けた。広場で選ぶ灯は、その窓の人へ返される。',
    skills:['狭い灯の扇','広がる灯の扇','それぞれの窓灯'], counter:'ボスの向いた先へ扇状の光。虹にして光の守りを防ぐ。',
    lines:[[['ルチェルナ','……セイ、カイ……ヒトツ……'],['クロム','一人の正解で、全部の窓を閉じない。']], [['ルチェルナ','この灯も……違う、灯も'],['アリア','どちらも、その窓の人が選んだんだ。']], [['ルチェルナ','扇の外に立って。窓の間は、消えない'],['クロム','あなたの光を、選ぶ人へ返す。']]], freed:'違う灯の窓へ、同じように羽ばたけるよ。' },
  { id:'coronel', slot:12, name:'冠枝のコロネル', chapter:'restore7', place:'天測回廊の入口', from:'restore7', lv:28, town:'spire', pattern:'crown', effect:'armor', colour:'#b2c4ec', material:'m_gold', unique:'u_quest_gold',
    prelude:'回廊の入口で、古い儀式の影が列を作っていた。冠枝の精霊は主を迎える役目を守ろうとして、人の歩幅まで列に合わせてしまっている。二人は列から外れた道を探した。', returnLine:'精霊は冠を命令の札から離した。王冠のない二人を、回廊の奥へ通した。',
    skills:['揃える行列','二列の行進','冠のない歩幅'], counter:'二列の行進線を避ける。装甲は段階ごとに剥がれる。',
    lines:[[['コロネル','……レツ、ヲ……ミダスナ……'],['アリア','みんな、同じ歩幅じゃないよ。']], [['コロネル','冠が……ない。誰を、通せば'],['クロム','自分で行き先を選ぶ人を。']], [['コロネル','次の列が動く。列の間を通って'],['アリア','冠じゃなくて、私たちを見て。']]], freed:'誰の歩幅も変えずに、ここを案内する。' },
  { id:'aster', slot:13, name:'星璃のアステル', chapter:'restore8', place:'観測塔の外周', from:'restore8', lv:30, town:'veil', pattern:'starglass', effect:'sp', colour:'#93d7e9', material:'m_violet', unique:'u_quest_echo',
    prelude:'観測塔の外周に、測れなかった色の影がたまっていた。星璃の小精霊は管理者と別の存在だったが、正しい数値だけ返す命令に包まれている。二人はその声を、塔の命令から切り離すことにした。', returnLine:'アステルは違う色の星を示した。均彩の管理者へ続く扉が開いた。',
    skills:['欠けた星目盛り','重なる星環','違う星の軌道'], counter:'星環の目盛りが順にずれる。虹にした床では共鳴を守れる。',
    lines:[[['アステル','……ゴサ、ゼロ……ゴサ……'],['ルノワール','測れなかった色も、そこにある。']], [['アステル','全部……違う。間違い、なの？'],['アリア','違うことは、間違いじゃない。']], [['アステル','次の星環がずれる。光っていない目盛りへ'],['クロム','その違う星を、消さずに行く。']]], freed:'僕は管理者の答えじゃない。違う星を、違うまま見ていく。' },
];
// 広域・持続侵食はピーク制限を避け、局所侵食は対処する余地を残した上限にする。
const GUARDIAN_BOSS_GOALS = {
  nephra: [{type:'turns',n:14},{type:'hp',n:65},{type:'rainbow',n:45}],
  farol: [{type:'turns',n:13},{type:'teamHP',n:65},{type:'back',n:3}],
  rivela: [{type:'turns',n:13},{type:'teamHP',n:60},{type:'enchantKill',n:2}],
  pomela: [{type:'turns',n:14},{type:'teamHP',n:60},{type:'dullMax',n:80}],
  folio: [{type:'turns',n:14},{type:'teamHP',n:65},{type:'back',n:3}],
  fiamma: [{type:'turns',n:14},{type:'teamHP',n:60},{type:'rainbow',n:50}],
  lucerna: [{type:'turns',n:13},{type:'teamHP',n:65},{type:'back',n:3}],
  coronel: [{type:'turns',n:14},{type:'teamHP',n:65},{type:'enchantKill',n:2}],
  aster: [{type:'turns',n:14},{type:'teamHP',n:65},{type:'purify',n:3}],
};
const GUARDIAN_MISSION_GUIDES = {
  gran:'潮線は広く侵食するため、くすみ上限はありません。背後から2回攻撃し、HP65%以上を守って穢れをほどこう。',
  ivy:'蔦の輪は局所的です。グランを宿した攻撃で床を澄ませ、くすみ70%未満を守りながら影を2体倒そう。',
  spinel:'殻の環を虹に戻し、召喚した精霊で1体倒そう。段階変化の侵食を見越して、くすみ75%未満を守る。',
  king:'斜めの光は広く侵食するため、途中のくすみ上限はありません。影を先に払い、虹の床60%以上で王の穢れをほどこう。',
  nephra:'縁の侵食は途中の割合で判定しません。虹の道を45%以上残し、HP65%以上で夜を渡ろう。',
  farol:'灯列の侵食量は判定しません。二人ともHP65%以上を保ち、潮線の横から背後攻撃を3回当てよう。',
  rivela:'二本の水路から離れ、二人のHP60%以上を守ろう。宿した心剣か四響の剣で2体倒す。',
  pomela:'小さな戦場の苗輪は、二人の浄化で抑えられます。くすみ80%未満・二人のHP60%以上を守ろう。',
  folio:'頁の線から離れ、二人ともHP65%以上を保とう。守りに頼りすぎず、背後攻撃を3回当てる。',
  fiamma:'持続する火床に途中のくすみ上限はありません。二人で浄化し、HP60%以上・虹の床50%以上を残そう。',
  lucerna:'扇の外へ回り、背後から3回攻撃しよう。二人ともHP65%以上を保つ。',
  coronel:'行進線を避け、二人のHP65%以上を守ろう。宿した心剣か四響の剣で2体倒し、殻を崩す。',
  aster:'星環から離れ、二人のHP65%以上を守ろう。浄化を3回使い、予告の床を澄ませる。',
};
const GUARDIAN_STAGES = {};
GUARDIANS.forEach((p, n) => {
  const i = p.slot ?? n;   // 欠番（テラ・コッタの戦場）があっても、ほかの戦場の構成は変えない
  p.art = p.legacy ? p.id : 'guardian_' + p.id;
  p.pathId='gp_'+p.id; p.bossId=p.legacy?p.from:'gb_'+p.id;
  p.act = CHAPTERS.find(ch => ch.key === p.chapter).act;
  const ref = BOARDS[p.from], postgame = p.chapter.startsWith('restore');
  const shared = { id:'', chapterGate:p.chapter, difficultyFrom:p.legacy?p.bossId:p.chapter, guardianRoute:p.id, act:p.act, recLv:p.lv, lv:p.lv, cols:8, rows:8,
    map:{...ref.map, hills:Math.min(.25,ref.map.hills||.2), obsAmt:.015, waterAmt:.025}, hue:p.colour, decor:ref.decor,
    spirits:CHAPTER_STATE[p.chapter].colors.map(c=>({teal:'gran',green:'ivy',gold:'spinel',violet:'king'}[c])),
    spStart:postgame?6:Math.min(6,3+Math.floor(i/2)), theme:ref.theme||{bg:['rain','glass','forest','canyon','stars','stars'][i],preset:'night',fx:'stars:.15',bgm:i<2?'haruka':'forest'},
    postgame, companion:postgame, reward:80+p.lv*15, firstItems:{i_tea:1,i_shard:1}, ordinaryReward:Progression.ordinaryEquipment(ref), material:p.material,
    kegWords:['道を閉じろ','帰る場所はない','違いを消せ'], colorWords:['通っていい道','守り手の名前','戻ってきた声'],
    loseText:'守り手へ声が届かなかった。道と予告を確かめ、もう一度。' };
  const path = { ...shared, id:'gp_'+p.id, title:p.place+'・影を払う道', desc:'影を払い、汚染された精霊へ辿り着く通常戦。',unique:ref.unique||p.unique,
    enemies:[{kind:'shade',lv:p.lv,n:3},{kind:i%3===0?'thorn':'lead',lv:p.lv,n:p.lv<5?1:2}],
    missions:[{type:'turns',n:12},{type:'hp',n:45},{type:'rainbow',n:30}], intro:{who:'アリア',text:'道をふさぐ影を切り分けよう。<small>通常戦のあと、土地の精霊へ声を届ける。</small>'} };
  let boss = { ...shared, id:p.bossId, title:p.name+'・穢れをほどく', desc:p.counter, guardian:p.id, bossArt:p.art, bossName:'汚染された'+p.name, bossHP:1.05, spawnCap:3,
    enemies:[{kind:'boss',lv:p.lv},{kind:'shade',lv:Math.max(1,p.lv-1),n:2}], unique:p.unique,
    missions:GUARDIAN_BOSS_GOALS[p.id], intro:{who:'戦場の声',text:p.lines[0].map(([who,text])=>`<b>${who}</b> ${text}`).join('<br>')+'<small>穢れHPの2/3・1/3で段階が変わる。予告の床を虹にすると、特殊攻撃を防げる。</small>'} };
  if(p.legacy){boss={...ref,guardian:p.id,guardianRoute:p.id,bossArt:p.art,bossName:'汚染された'+p.name,beats:[],desc:p.counter,intro:boss.intro,material:p.material,theme:shared.theme};}
  boss.missionGuide=GUARDIAN_MISSION_GUIDES[p.id];
  GUARDIAN_STAGES[path.id]=path; GUARDIAN_STAGES[boss.id]=boss; BOARDS[path.id]=path; BOARDS[boss.id]=boss;
  const encounter=`\n@aura none\n${p.prelude}\n@board ${path.id}\n影の奥に、${p.name}がいた。口から出る声は、まだ言葉にならない。\nアリア「あなたの色を傷つけずに、絡みついたものをほどく」\n@board ${boss.id}\n${p.name}「${p.freed}」\n${p.returnLine}\n`;
  if(p.legacy){SCRIPT[p.chapter]=SCRIPT[p.chapter].replace('@pouch show','@pouch show\n'+p.prelude+'\n@board '+path.id+'\n'+p.returnLine+'\n');}
  else if (postgame) {
    const anchor=p.chapter==='restore1'?'アリア「では、二人で。一振りも、一緒に」':SCRIPT[p.chapter].trim().split('\n').filter(line=>line.trim()&&!line.trim().startsWith('@'))[0];
    SCRIPT[p.chapter]=SCRIPT[p.chapter].replace(anchor,(p.chapter==='restore1'?anchor+'\n'+encounter:encounter+'\n'+anchor));
  }
  else SCRIPT[p.chapter]=SCRIPT[p.chapter].replace('@pouch show','@pouch show'+(p.chapter==='finale'?'\n@bg stars night\n@fx stars:.2':'')+encounter+(p.chapter==='finale'?'\n@bg none black\n@fx none':'')+'\n');
  SPEAKERS[p.name]=p.colour;
  if (typeof GameArt !== 'undefined') GameArt.speakers[p.name]=p.art;
});
