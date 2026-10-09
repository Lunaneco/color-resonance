// 森と順不同で通る赤い果実の丘。本編の帰還先はEngineがセーブに一緒に持つ。
const Fury = (() => {
  const p = {
    id:'vard', name:'ヴァルド', art:'vard', chapter:'fury', act:'第三幕・紅角の丘', town:'f_fruit', place:'赤い果実の丘',
    pathId:'gp_vard', bossId:'f_fruit', lv:8, colour:'#f57965', material:'m_gold', pattern:'charge', effect:'push',
    counter:'怒りを攻撃力へ変える猛牛。HPが減るほど攻撃が強まる。突進の予告線を避け、虹に戻した床から側面へ回ろう。',
    skills:['盲目の紅角','二筋の憤怒','選び取る突進'],
    lines:[
      [['ヴァルド','壊せ……全部、壊せ……！'],['アリア','角は果樹を避けている。まだ、守りたいものが残ってる。']],
      [['ヴァルド','枝を折るな……その木は、あいつが……！'],['アリア','その怒りは、あなたのもの。黒い声の命令に渡さないで。']],
      [['ヴァルド','俺が踏んでいたのか。守るはずの、この丘を。'],['アリア','怒っていい。誰に、その力を向けるかは選べる。']],
    ],
    freed:'怒りは消えていない。だからこそ、もう黒い声には使わせない。俺の角は、俺が向ける。',
  };
  const ref=FREE_STAGES.f_fruit;
  const path={...ref,id:p.pathId,act:p.act,title:'赤い果実の丘・折れ枝の道',chapterGate:'fury',guardianRoute:'vard',difficultyFrom:'f_fruit',
    cols:8,rows:8,lv:8,recLv:8,map:{...ref.map,hills:.2,obsAmt:.015,waterAmt:0},
    enemies:[{kind:'shade',lv:8,n:3},{kind:'thorn',lv:7,n:2}],bossName:null,unique:null,ordinaryReward:'e_tide',material:'m_gold',reward:160,
    spirits:['gran'],missions:[{type:'turns',n:12},{type:'hp',n:50},{type:'rainbow',n:35}],
    intro:{who:'アリア',text:'折れた枝を踏まないように。まず、道をふさぐ影だけを払おう。'},
    desc:'通常戦。果樹園を荒らす影を払い、丘の奥の紅角へ声を届ける。'};
  const boss={...ref,act:p.act,guardian:'vard',guardianRoute:'vard',chapterGate:'fury',bossArt:'vard',bossName:'汚染された紅角のヴァルド',
    bossHP:1.05,spawnCap:3,recLv:8,lv:8,map:{...ref.map,hills:.2,obsAmt:.015,waterAmt:0},material:'m_gold',ordinaryReward:'e_tide',spirits:['gran'],
    enemies:[{kind:'boss',lv:9},{kind:'shade',lv:8,n:3},{kind:'thorn',lv:8,n:2}],
    missions:[{type:'turns',n:12},{type:'hp',n:65},{type:'back',n:3}],
    missionGuide:'くすみの最大値は条件にしない。突進線を横へ避け、背後から3回命中させよう。怒りが強まる終盤に備え、アリアのHP65%以上を守る。',
    intro:{who:'戦場の声',text:'<b>ヴァルド</b> 壊せ……全部、壊せ……！<br><b>アリア</b> あなたの角は、まだ果樹を避けてる。<small>穢れHPの2/3・1/3で突進線と会話が変化。予告の床を虹に戻すと特殊攻撃を防げる。</small>'},
    desc:p.counter,beats:[]};
  FREE_STAGES.f_fruit=boss;BOARDS.f_fruit=boss;BOARDS[path.id]=path;
  GUARDIAN_STAGES[boss.id]=boss;GUARDIAN_STAGES[path.id]=path;GUARDIANS.push(p);
  const node=WORLD_NODES.find(n=>n.id==='f_fruit');
  // 森の鳥籠・黄金の渓谷と同じ、章の戦場として地図に置く。読み終えるまでは「物語」の印が出る。
  Object.assign(node,{type:'stage',board:'f_fruit',chapter:'fury',clearedBy:'vardbond',sub:'第三幕・赤い丘',
    theme:{bg:'canyon',preset:'dusk',fx:'gold:0.4',bgm:'forest'},
    desc:'折れた枝の積もる赤い丘。怒りを餌にされた猛牛の精霊が、守るはずの畑を踏み荒らしている。'});
  delete node.free;
  SPEAKERS.ヴァルド=p.colour;
  SCRIPT.fury=`
@chapter 第三幕・赤い丘|怒りの向け先
@bg canyon dusk
@bgm forest
@fx gold:.15
@pouch show
@furychat hill_before
丘は、空から見ると、熟れすぎた果実の色をしていた。
ルージュ・オーチャード。かつては、季節ごとに違う実がなる果樹の丘だったという。いまは畝が踏み荒らされ、折れた枝が斜面に積もっていた。
降り立つと、土の匂いに焦げた砂糖のような匂いが混じった。誰にも摘まれないまま潰れた、実の匂いだった。
グラン「マリーが話していた丘だ。怒ったあとほど、果実が甘いと」
@show aria
耳を澄ます。赤い音がした。
首筋を、熱いものがじりじりと上ってくる。小さい頃に広場で浴びた、怒っている人の色だった。それが、ひとつの喉から、丘じゅうへ響いている。
あの夜の自分の胸には、これがなかった。リラを失ったとき、胸の中には冷たさしかなかった。怒りは、どこを探しても見つからなかった。
アリアは、赤い音を聞きながら、自分の手を握りしめた。
@hide aria
丘の奥で、角を持つ巨大な影が吠えた。
@aura vardDark
赤い光を吐くたびに、黒い糸が畝を裂いた。踏みしめられた土から、折れた枝が跳ねる。
その体には、幾筋もの古い傷があった。角の根元には、金色の継ぎ目が一本走っている。誰かが、ていねいに直した跡だった。
グラン「あの角を直した者がいる。……怒りの形をしていても、触れさせた者がいたのだ」
畝の端に、一本だけ、踏まれずに残った幼い果樹があった。
@aura none
@show aria
アリア「この道の影を先に払おう。木を傷つけずに、近くへ行く」
@hide aria
@board gp_vard
猛牛は、黒い言葉を噛み砕くように歯を鳴らした。
@aura vardDark
ヴァルド「奪われる前に……全部、壊せ……！」
アリア「あなたの怒りまで、消すつもりはない。絡まった声だけを切る」
@aura none
ヴァルドは、嵐の夜に畑を失った。
収穫の前の晩だった。川があふれ、畝は泥に沈み、一年分の果実が流れた。誰のせいでもない、と皆が言った。
> 「誰も悪くない。<br>仕方のない嵐だった。」
それでも、怒りは残った。誰にも向けられない怒りは置き場がなくて、角にたまっていった。
黒い種は、そういう場所を好む。
> 「奪われた」<br>「守れなかった」<br>「全部、壊せ」
穢れは怒りを餌にして育ち、命令の形になった。ヴァルドは丘を守るために角を振り、守るはずの木を、自分の足で折った。
折った枝を見るたびに、怒りは増えた。増えた怒りが、また枝を折らせた。
@show aria
アリアは、もう一度、赤い音を聞いた。
赤の下に、黒くざらついた声が貼りついている。壊せ。壊せ。けれど赤そのものは、それとは別の、まっすぐな高さで鳴っていた。
アリア「怒りと、命令は、別のもの」
@sfx sword
アリアは心剣を抜いた。
@hide aria
@aura vardDark
@board f_fruit
@aura vard
@bg canyon clear
@fx gold:.2
@show aria
最後に切り離したのは、角の根にいちばん深く食いこんでいた一本だった。「全部、壊せ」。嵐の夜の、あの一言だった。
赤い音は、消えなかった。
黒い声だけがほどけて、あとに、熱いままの、まっすぐな赤が残った。
鼻先の黒い息が晴れ、赤い毛並みの猛牛が、夕日の中に立っていた。
> クリムゾン・ブル
角が土に触れた。ヴァルドは、自分の足跡を見て、長いあいだ黙った。
ヴァルド「嵐で畑が潰れた。誰も悪くないと言われた。でも、俺には怒りが残った。穢れは、そいつを餌にした」
ヴァルド「追い払うつもりで、俺まで枝を折った。この傷は、そのときのだ」
アリア「怒る理由があったことと、折った枝を戻すこと。両方、忘れなくていい」
ヴァルドは、角の金色の継ぎ目を夕日に向けた。
ヴァルド「ここを直したのは、マリーだ。昔、この丘に来た渡り鳥」
@bg canyon memory
> まだ、マリーが旅をしていた頃。
マリー「そんなに怒って、果実まで酸っぱくしないでよ」
ヴァルド「木を傷つけたやつを、許せっていうのか」
マリー「許せない日は、許さなくていい。でも、その角で次の木まで折らないで」
小さな鳥は、落ちた実を拾った。ヴァルドが怒鳴っても、逃げなかった。
マリー「ほら、甘い。怒れるのは、好きなものがあるからでしょ」
@bg canyon clear
その年の枝にも、翌年には芽が出た。マリーが来なくなってからも、ヴァルドはその木を残した。
@furynews
ヴァルド「……帰らなかったんじゃない。帰ろうとして、いたのか」
グラン「そうだ。あの子は、帰ったら全部話すと言っていた」
ヴァルドは、実を一つ、グランへ転がした。
ヴァルド「なら、食え。おまえが聞けなかった丘の続きだ」
グラン「甘いな。おまえも、食べるときは少し静かになる」
ヴァルド「おまえは泣くと、塩気が増える。果樹に水をやるなら加減しろ」
グランは低く笑った。ヴァルドの鼻から、黒い息ではなく、短い笑いが漏れた。
ヴァルドは、アリアを見た。
ヴァルド「おまえは、怒っていないのか。あれだけ冷たい音をさせて」
アリアは、少し考えた。
アリア「怒り方を、知らないのかもしれない。大事な人がいなくなった夜、胸の中は、冷たいだけだった」
ヴァルド「俺には、おまえの胸のことは分からない。ただ、おまえの音は静かだった。静かなのは、ないからじゃない。……そう聞こえた」
アリア「……そう」
アリアは、握ったままの自分の手を見た。爪の跡が、薄く残っていた。
ヴァルド「怒りを攻撃力に変える。それが俺の力だ。傷を負うほど強くなる。だが、無理に傷つく必要はない」
アリア「治ったら、そのぶん落ち着くんだね。力が弱まっても、傷は治していい」
ヴァルド「俺を呼べば、俺の傷を力にする。剣に宿せば、おまえの傷を力にする。向け先は、一緒に決めよう」
グラン「私の潮で道を開く。おまえの角で、影を払おう」
ヴァルド「頼んだぞ、潮の友」
@vardbond
@furychat forest_meeting
アリア「怒りは、消さなくていいんだね」
ヴァルド「消えるもんか。向ける先を、選ぶんだ」
幼い果樹に、赤い実が一つ残っていた。ヴァルドは、それには触れなかった。
@hide aria
@aura none
@cg night
@thread
その夜、ルノワールが送った糸は、赤く焦げていた。
ルノワールは受け取ろうとして、一度、止まった。それから糸を、ヴァルドの角のほうへ、そっと返した。
あの赤は、ヴァルドのものだった。切り分けたのは、黒い声だけだ。
@cg off
アリア「また見に来よう。丘の木も、帰り道も」
@sideend
`;
  SCRIPT.fury_reunion=`
@chapter 紅角の丘 | 色たちの語らい
@bg canyon clear
@bgm forest
@show aria
@pouch show
丘の木陰に、精霊たちが集まった。赤い実を分ける前に、ヴァルドは踏み跡の畝を直した。
@furychat gran
@furychat ivy
@furychat spinel
@furychat king
@furychat ending
アリア「違う力だから、一緒に歩ける。次も、この木の下で」
@sideend
`;
  const available=()=>Engine.unlocked().some(key=>['act3','act4','act5','finale','epilogue','done'].includes(key));
  const joined=()=>Engine.unlocked().includes('vardbond');
  // 加入前なら、地図の「物語」からこの章を読める（森が開いていれば、どちらが先でもよい）。
  const pending=()=>available()&&!joined();
  const reunionReady=()=>joined()&&Progression.companions(Engine.unlocked(),Engine.load()?.colors).includes('ivy');
  function start(reunion=false){if(!available()||reunion&&!reunionReady())return;Panel.close();Engine.play(reunion?'fury_reunion':'fury');}
  function chat(id){
    const meeting=`アイビー「森の蔦を結び直してきたわ。丘へ来る道も、マリーに残した目印と同じにする」
ヴァルド「目印を残すのは、おまえだったのか。あいつは丘へ来ると、森で昼寝した話から始めた」
アイビー「木の枝を直した角の話も、聞いたわ。今度は、私たちで道の続きを作りましょう」
グランは潮をひと筋、蔦の下へ通した。ヴァルドが畝を起こすと、アイビーはその端へ若葉を植えた。`;
    if(id==='hill_before')return Progression.companions(Engine.unlocked(),Engine.load()?.colors).includes('ivy')?'アイビーは丘の入口で、蔦を一本、細く伸ばした。\nアイビー「枝は折らせない。あなたが立つ畝だけ、先に結んでおくわ」\nグラン「森の目印と同じ結び方だな。……マリーが覚えていた結び方だ」':'';
    if(id==='forest_before')return joined()?'ヴァルドは、森の入口で角を上げた。枝に触れる前に、グランへ道幅を尋ねた。\nヴァルド「ここで待つ。葉を折らずに通る道を、見つけてくれ」':'';
    if(id==='forest_after')return joined()?meeting:'グラン「赤い丘へ寄ろう。マリーが行き来した道を、いまの私たちで歩いてみたい」';
    if(id==='forest_meeting')return Progression.companions(Engine.unlocked(),Engine.load()?.colors).includes('ivy')?meeting:'';
    if(id==='mari_news')return typeof MariReturn!=='undefined'&&MariReturn.joined()?'グラン「マリーは帰り道の嵐で闇に飲まれた。別れだと思っていた声の先で、あの子は帰る時を待っていた。今は、精霊として私たちと旅をしている」':'グラン「マリーは帰り道の嵐から戻らなかった。最後に届いた声だけが、鐘楼に残った。私は、あれが別れだと思っていた」';
    const friends=Progression.companions(Engine.unlocked(),Engine.load()?.colors);
    if(id!=='ending'&&!friends.includes(id))return '';
    const lines={
      gran:`グラン「苗木には雨を少し。私が水を運ぶから、おまえは土を起こしてくれ」
ヴァルド「任せろ。潮の友には、いちばん甘い実を残す」
二人は言い合いながら、同じ畝を進んだ。昨日のけんかを、グランもヴァルドも覚えていなかった。`,
      ivy:`アイビー「怒ったとき、この木陰に座って。閉じ込めないから」
ヴァルド「そこにいれば、何もしなくて済むのか」
アイビー「休めるだけ。立って枝を直すのは、あなた」
ヴァルド「……それなら、悪くない」`,
      spinel:`スピネル「角の継ぎ目、僕の光で補強していい？」
ヴァルド「俺の怒りまで丸くするなよ」
スピネル「継ぎ目を埋めるんじゃなくて、光を沿わせるんだ。ほら、曲げても大丈夫」
ヴァルド「なら頼む。突っ込む前に、仲間の盾を見よう」`,
      king:`パレット王「王であった頃、怒る声を聞くのが怖かった。疑うほうが楽だったのだ」
ヴァルド「俺も、全部敵だと思えば楽だった。木まで敵にした」
パレット王「今度は聞こう。異なる色は、消す理由ではない」
ヴァルド「聞いたうえで、まだ怒る日はある。それでも、一緒に実は食える」`,
      ending:Engine.unlocked().includes('done')?`クリスタリアへの道には、復興の荷車が行き交う。
グラン「丘の木々も、帰る船も。マリーに、まだ話せることが増えた」
ヴァルド「だったら俺たちで続きを増やす。王国へは、水も実も持っていこう」
二人が先に立つと、荷車の人たちは安心して歩き出した。`:`果樹園を離れる前に、グランが根へ水を注ぎ、ヴァルドが踏まれた土を起こした。`,
    };return lines[id]||'';
  }
  return {available,joined,pending,reunionReady,start,chat};
})();
