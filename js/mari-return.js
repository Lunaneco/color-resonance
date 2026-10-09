// 復興の苗床に届いた羽音から、闇に取り込まれたマリーを探す。
const MariReturn = (() => {
  const p={id:'cocoon',name:'闇の繭',art:'shade',chapter:'mari_return',act:'復興本編・マリーの帰還',town:'nowhere',place:'クリスタリアの苗床',lv:22,
    pathId:'gp_cocoon',bossId:'mr_cocoon',colour:'#d8c6ed',material:'m_violet',pattern:'cocoon',effect:'sp',
    counter:'羽音を閉じ込めた黒い繭。予告の輪を虹に戻すと、傷と共鳴の流出を防げる。二人の浄化で道をつなごう。',
    skills:['声を閉じる輪','帰路をほどく輪','残された夜の輪'],
    lines:[[['マリー','……かえ……り……'],['グラン','この羽音を、私は知っている。']],
      [['マリー','ここ、暗いの。羽根を送ったのに……届かないの？'],['アリア','届いてる。声の続きへ、道をつなぐ。']],
      [['マリー','グラン。まだ、待っててくれたの？'],['グラン','おまえが降りた場所は、今も私の額にある。']]],
    freed:'羽音を閉ざしていた糸がほどけた。繭の奥から、黄色い翼が光へ伸びる。'};
  const shared={difficultyFrom:'restore4',act:p.act,chapterGate:'mari_return',guardianRoute:p.id,postgame:true,companion:true,gate:2,lv:22,recLv:22,cols:9,rows:9,spStart:6,
    map:{low:['land_flat'],mid:['land_step','land_flat'],high:['land_high'],hills:.15,obsAmt:.015,waterAmt:0},
    material:'m_violet',hue:'#dbc4ef',decor:['rocks'],theme:{bg:'cave_sky',preset:'dark',fx:'ash:.4',bgm:'fate'},
    spirits:['gran','ivy','spinel','king'],ordinaryReward:'a_star',reward:400,firstItems:{i_tea:1,i_shard:1},
    kegWords:['帰るな','声を消せ','誰も待っていない'],colorWords:['届いた声','帰る道','待っていた場所'],loseText:'羽音へ届く道が途切れた。二人の浄化で、もう一度。'};
  const path={...shared,id:p.pathId,title:'苗床の奥・帰らない羽音',desc:'通常戦。苗床の地下で、声を塞ぐ影を払い、古い羽音へ進む。',
    enemies:[{kind:'shade',lv:21,n:3},{kind:'membrane',lv:22,n:2}],
    missions:[{type:'turns',n:14},{type:'teamHP',n:60},{type:'purify',n:2}],intro:{who:'グラン',text:'風が止んでも、羽音だけが残る。あの子が、まだ奥にいる。'}};
  const boss={...shared,id:p.bossId,title:'闇の繭・帰る声を探して',desc:p.counter,guardian:p.id,bossArt:p.art,bossName:'闇の繭',bossHP:1.2,spawnCap:3,
    enemies:[{kind:'boss',lv:23},{kind:'shade',lv:21,n:3}],unique:'u_quest_echo',
    missions:[{type:'turns',n:14},{type:'teamHP',n:65},{type:'purify',n:3}],missionGuide:'黒い輪の予告を虹に戻し、二人で浄化を3回使おう。HP65%以上を残して、閉じた声へ道を開く。くすみの最大値は条件にしない。',
    intro:{who:'戦場の声',text:'<b>マリー</b> ……かえ……り……<br><b>グラン</b> この羽音を、私は知っている。<small>穢れHPの2/3・1/3で会話と輪の予告が変化。予告床を虹にして、共鳴を守ろう。</small>'}};
  GUARDIANS.push(p);for(const c of [path,boss]){BOARDS[c.id]=c;GUARDIAN_STAGES[c.id]=c;RESTORATION_STAGES[c.id]=c;}
  SPEAKERS['闇の繭']=p.colour;
  const rescue=`
@bg restoration dawn
@bgm haruka
@show aria
@pouch show
クリスタリアの苗床に芽が戻った朝、修理人が一枚の灰黄色の羽根を見つけた。
拾い上げた指先が、墨を触ったように黒く染まった。
風のない地下から、羽音がする。羽ばたきではない。閉じた壁を内側から叩き続けるような、乱れた音だった。
グランの額に残ったくぼみが、かすかに光った。
グラン「この羽根の持ち主は、旅の続きを話しに帰ると言っていた」
クロム「闇の流路に、外へ戻れない枝道がある。崩れた苗床の下へ、古い流れが寄っている」
アリア「まず道を開こう。声の持ち主を、確かめたい」
@bg cave_sky dark
@fx ash:0.5
@bgm fate
地下へ降りるほど、芽の光は遠のいた。壁の水晶も、苔の青も、黒い霧に吸われていく。
グランは一度も口をきかなかった。額のくぼみだけが、羽音に合わせて痛むように明滅していた。
@board gp_cocoon
@bg cave_sky storm
@fx ash:1
地下の空洞には、黒い繭が吊られていた。編み目の奥で、小さな翼が、壁を探すように動いている。
@show mari dark
その影は、黄色ではなかった。墨のように黒く染まった羽が、繭の内側で何度もひらいては、閉じた。
マリー「……かえ……る……から……」
グラン「マリー。あの声の続きが、ここにあったのか」
マリー「……だれ。……ちがう、ちがう。あたしは、帰るの。帰らなきゃ、いけないの」
繭の糸が、声に合わせてきしんだ。糸の外側から、別の声が重なった。帰るな。誰も待っていない。声を消せ。
アリアとクロムは繭を挟み、同じ高さに剣を構えた。
アリア「あなたの羽根は切らない。閉じ込めている糸だけを、ほどく」
@hide mari
@board mr_cocoon
@fx ash:0.5
繭がほどけた。黒い糸の束が、ばらばらと落ちた。
@show mari dark
落ちてきたのは、小さな鳥だった。濡れた羽の大半が、まだ墨の色をしていた。
マリーはグランを見なかった。足元の闇を、じっと見ていた。
マリー「……聞こえてたの。ずっと。帰るなって。待ってる人なんて、いないって」
マリー「年が何度も通りすぎるのがわかった。そのたびに、その声が、ほんとうみたいに思えてきた」
グラン「……」
グランは何も言えなかった。待つのをやめたのは、自分のほうだった。
グラン「羽根には、帰ったら全部話すと残っていた。私は、それを最後の別れだと思い込んだ。……待たなかった。すまない」
マリー「謝らないで。……あたしも、帰ってきたのに、怖いの」
マリー「嵐の黒い波にさらわれたとき、羽根に声を乗せたの。そしたら闇が閉じた。昨日も明日も来ない場所で、あたしはずっと、ひとりで羽ばたいてた」
マリーの羽の端から、黒い滴が落ちた。落ちた先の床が、ひとつずつ、くすんでいった。
マリー「ほら。あたしのまわり、みんな黒くなる。これを連れて、グランの隣にいられない」
アリア「それは、あなたの色じゃない。長い間、貼りついていた闇だよ」
アリアは右の掌を開いた。心剣が、闇の中で透明に伸びた。
アリア「わたしの剣は、穢れしか切らない。あなたの色は、一滴も切らない」
アリアは刃を、マリーの羽の端へ、そっと当てた。
@sfx skill
@show mari dim
@bg cave_sky night
@fx ash:0.2
黒が、羽から剥がれた。剥がれた闇は、砂のように崩れて、床に落ちる前に消えた。
マリー「……あ。羽が、軽い」
羽の下から、見覚えのある灰黄色がのぞいた。
マリー「このままじゃ、前みたいには飛べないんだね。長い闇にさらされた翼の端が、ほどけていく」
アリア「光は消えてない。羽根がほどけても、あなたの色はここにある」
グラン「私たちは、精霊として旅をしている。だが、おまえの行き先は、おまえが決めていい」
マリーは長いあいだ、黙っていた。それから、羽をたたんで、顔を上げた。
マリー「じゃあ、あたしも旅する。全部の色を見たいって、まだ言い終わってないもの」
@bg restoration clear
@bgm forest
@fx motes:0.2
翼から落ちた光が、灰黄色の羽根へ戻った。夜が明けるように、地下の闇が、足元からほどけていった。
@show mari clear
マリーの輪郭は、朝の風をまとった小さな精霊になった。
@sfx skill
@maribond
マリー「ただいま、グラン。今度は、道の途中も一緒だよ」
グラン「おかえり。おまえが降りた場所を、空けておいてよかった」
@marichat vard
@marichat friends
アリアは、苗床の朝を修理簿に書き足した。戻れた声の名を、その声の主に書いてもらった。
マリー「さあ、次はどこ？ ……その前に、枝の修理を手伝うね」
マリーは記録院への風を確かめ、先に立った。知っている窓の並びが、白い壁の向こうにあった。
@fx none
`;
  SCRIPT.restore3=SCRIPT.restore3.replace('@next restore4','葉の下の灰黄色の羽根が震えた。風の止んだ地下から、帰りたい声がする。\nグラン「この羽音は……マリー。まだ、そこにいるのか」\n@next restore4');
  SCRIPT.restore4=SCRIPT.restore4.replace('記録院には、同じ日付の設計図が二枚あった。',rescue+'\n記録院には、同じ日付の設計図が二枚あった。');
  SCRIPT.mari_reunion=`
@chapter マリーと仲間たち | ただいまの、その先
@bg restoration clear
@bgm forest
@show aria
@show mari
マリーは新しい苗木を眺め、枝のないところへ、まだ先の止まり木を想像した。
@marichat vard
@marichat friends
グラン「今日の話は、今日聞こう」
マリー「長いよ。置いていった話も、これから見る色も、いっぱいあるから」
@sideend
`;
  const available=()=>Restoration.joined()&&Board.party.postgame.progress>=3;
  const joined=()=>Engine.unlocked().includes('maribond');
  function start(reunion=false){if(!available()||reunion&&!joined())return;Panel.close();if(joined())Engine.play('mari_reunion');else Restoration.begin('restore4');}
  function chat(id){
    if(id==='vard')return Fury.joined()?`マリー「その角、まだ金色の筋が残ってる！」
ヴァルド「おまえの直したところだ。折らずに、待てた」
マリー「じゃあ、実をひとつ。怒ったあとほど甘いんでしょ」
グランとヴァルドは同時に、いちばん赤い実へ目を向けた。
マリー「二人とも同じのを選ぶのね。もう、そんなに仲良しなの？」
ヴァルド「潮の友だ。おまえの話の続きを、二人で確かめてきた」`:'';
    if(id==='friends')return `アイビー「曲がり角に葉を残す約束、覚えてる？ あなたが来なくなっても、目印だけは枯らさなかった」
マリー「覚えてる。あなたの名前と、一緒に。アイビー、あの木陰で、もう一度昼寝していい？」
アイビー「いいわ。出発したくなったら、いつでも出ていい。今度は、私も隣を歩くから」
マリー「じゃあ、赤い丘の次は森！ ルミナにも、あの蔦の葉っぱにも、ただいまって言わなくちゃ」
スピネル「羽根の継ぎ目、光が透けてきれいだね。痛いところはない？」
マリー「うん。次の嵐は、一緒に抜けよう」
パレット王「ここでは、王へ報告する必要はない。見た色を、そのまま聞かせてくれ」
マリー「なら、話す順番はあたしが決めるね。まずは、赤い丘から！」`;
    return '';
  }
  return {available,joined,start,chat};
})();
