# Color Resonance ゲーム素材

ゲームの物語・敵・仲間・技に合わせ、組み込みimagegenで生成した素材ライブラリです。キャラクター18種類、技エフェクト20種類、主原本シート38枚、透過PNGコマ352枚、GIF127本（動作・単発技115本と専用反復プレビュー12本）を収録しています。

[素材一覧を開く](https://lunaneco.github.io/color-resonance/assets/generated/) では名前・技名で検索し、動作を切り替え、明暗背景で透過を確認できます。`index.html` を直接開いても閲覧できます。

## 収録キャラクター

| 分類 | 素材ID | 名前 |
|---|---|---|
| 敵 | shade / thorn / lead | 穢れの影 / 茨の影 / 鉛の殻 |
| 敵 | boss / membrane / chrome | 穢れの核 / 白い膜 / クロム |
| 仲間 | aria / gran / ivy | アリア / グラン・オーシャン / アイビー |
| 仲間 | spinel / king | スピネル / パレット王 |
| モブ・会話 | lila / fisher / lumina | リラ / 老漁師 / ルミナ |
| モブ・会話 | stone_child / kaoru / mari | 石の子 / 馨（カオル） / マリー |
| 支援 | renoir | ルノワール |

アリア・グラン・心剣・マリーは既存の基準絵を参照しました。ルノワールは既存のゲーム描画を採取した参照PNGを同梱しています。アイビーは緑の竜、スピネルは胸に金色の傷を持つ獣、ルミナは花、石の子は小さな石として、物語の姿を反映しています。

## 動作・必殺技

- 敵・仲間：待機、移動、攻撃、被ダメージ、力の発動。
- モブ：待機、移動、会話、挨拶。
- ルノワール：待機、移動、色を吸いこむ、力の発動。
- 独立エフェクト：透明の一閃・心剣、凪の祈り、小さな夜空、潮騒、蔦、黄金の盾、虹の尖塔、漆黒の波。
- 合成GIF12本：アリアの透明の一閃・凪の祈り・4属性の剣、グラン・アイビー・スピネル・王の召喚技、クロムの漆黒の波、ルノワールの小さな夜空。

| 技 | GIF |
|---|---|
| 透明の一閃 / 凪の祈り | gifs/aria/flash.gif / pray.gif |
| 深碧の刃 / 翠蔦の刃 | gifs/aria/enchant_gran.gif / enchant_ivy.gif |
| 金継ぎの刃 / 虹彩の刃 | gifs/aria/enchant_spinel.gif / enchant_king.gif |
| 潮騒の帰還 / 茨ほどき | gifs/gran/summon.gif / gifs/ivy/summon.gif |
| 黄金の傷の光 / 虹の尖塔 | gifs/spinel/summon.gif / gifs/king/summon.gif |
| 漆黒の波 / 小さな夜空 | gifs/chrome/wave.gif / gifs/renoir/sky.gif |

## ファイルと寸法

| ファイル | 用途 |
|---|---|
| source/{id}.png | 採用した画像生成原本、1536×1024、RGBA |
| sheets/{id}.png | 実装用透過シート。従来素材は1152×768・4列×2行、習得技追加セットは1152×1152・4列×3行 |
| frames/{id}/{cel}.png | 透過コマ、各288×384。従来素材は000〜007、習得技追加セットは000〜011 |
| gifs/{id}/{action}.gif | 単体288×384、合成技384×480。習得技のeffect.gifは単発、preview.gifだけ反復 |
| manifest.json | 素材名・参照先・コマ順・保持時間・ループ設定・合成レイヤー |
| prompts.json | 実際の生成・修正プロンプト、基準絵、採用ファイル、修正理由 |
| quality-report.json | PNGのアルファ・セル境界・GIF全コマ復号の検証記録 |
| review/{id}.jpg / motion-boundaries.jpg | コマ別と動作の区切りの確認画像 |

コマ番号は左上から右へ、上段0〜3、下段4〜7です。敵・仲間は待機、瞬き、移動A、移動B、攻撃予備、攻撃、被ダメージ、発動。モブは最後の4コマを会話A・会話B・挨拶A・挨拶Bに使います。各動作の正確な順序・尺は対応表に収録しています。

従来シートは固定の等寸グリッドで切り出しています。個々のポーズをタイトクロップしたり、毎コマ別々の倍率で揃えたりしていません。1方向のポーズセットです。歩行はコマ2→0→3→0、攻撃は0→4→5→0として実際の姿勢差分を切り替えます。

## ゲームへ読み込む

ゲーム本体へ組み込み済みです。`js/art.js` が必要なシートを読み込み、対応表の `sequence` / `durationsMs` / `loop` と戦闘の時計でコマを進めます。攻撃・被ダメージの再生速度は命中の瞬間に合わせます。キャラクターの倍率・足元は全コマで固定です。PNGの滑らかな透過を保ち、GIFのプレビュー用ループは戦闘へ持ち込みません。

従来のGIFは閲覧用に繰り返します。習得技追加セットは `effect.gif` が単発・透明停止、`preview.gif` が反復です。素材一覧は反復プレビューを表示し、保存リンクは単発GIFを返します。攻撃・被ダメージ・発動・必殺技の実装時は、対応表の `loop: false` に従い一度だけ再生します。エフェクトの `sequence` 内の `null` は透明な余韻のコマです。合成技は `layerSequence` でキャラとエフェクトのセルを指定し、384×480にキャラを(48,80)、エフェクトを(48,16)へ重ねています。

PNGは生成時の滑らかなアルファを保持します。GIFは形式上1ビット透過・最大256色で、発光の縁はPNGほど滑らかではありません。最終的なゲーム描画にはPNGを使うと、明暗どちらの背景でも綺麗に合成できます。各GIFは共通パレットと全コマの背景消去で、輪郭や光の残像を防いでいます。習得技は固定FPSではなく、可視セルを100〜300ms（約10〜3.33fps相当）で保持する可変フレーム時間です。開始・終了の透明待機は別に定義し、正確な時刻は `durationsMs` / `frameStartsMs` を使ってください。GIFの遅延単位は10msです。

戦闘のアリア・4精霊・6種類の敵、歩行・攻撃・被ダメージ・発動、8種類の技エフェクト、召喚と宿しのカットインに使用します。ルノワールのHUDと吸収・夜空の発動、会話のモブ6種類、グランとマリーの立ち絵、戦闘の人物情報・精霊ボタン・仲間画面にも反映しています。物語のアリアと一部の大きなCGは従来の基準絵を使用します。

戦闘に関係するシートを出撃時に、会話の人物を登場時に読み込みます。素材の読み込みに失敗したときは、戦闘の従来描画へ戻して操作を続けられます。中断・再挑戦では古いエフェクトとカットインを停止します。

## GIF・PNGの再書き出し

Python3.10以上とPillow12.3.0で検証済みです。ゲームのルートから実行します。

```sh
python3 tools/build_game_assets.py --force
```

保存済みの原本から再書き出します。画像生成の再実行や背景の自動白抜きは行いません。原本を修正する場合は、`prompts.json` の基準とポーズ順を引き継いで画像生成で修正してください。


## 習得技 第1セット

[3技のGIF・PNG・編集元・対応表をZIPでまとめて保存](downloads/learned-set01.zip)できます。

コピーの `js/progression.js` にある習得技を追加しています。既存のゲーム本体への自動組み込みは行っていません。

| 素材ID | 習得技ID | 技 | 方向 | 単発GIF | 総尺 / GIF可視終端 / PNG再生定義の可視終端 |
|---|---|---|---|---|---|
| water_arrow | gran_wave | 水鏡の矢 | 右 | [effect.gif](gifs/water_arrow/effect.gif) | 2120ms / 1400ms / 1400ms |
| flower_guard | ivy_bloom | 花守り | 正面 | [effect.gif](gifs/flower_guard/effect.gif) | 2560ms / 1840ms / 1840ms |
| golden_thrust | spinel_break | 金継ぎの突き | 右 | [effect.gif](gifs/golden_thrust/effect.gif) | 2190ms / 1370ms / 1470ms |

金継ぎの突きは最終PNGの100msがGIFでは透明となるため、GIF可視終端1370ms、PNG再生定義の可視終端1470ms、GIF透明尾部820msです。媒体は同じまま、この時刻差を対応表とZIP内仕様へ反映しています。

各素材は12枚のPNGセルと、開始・終了の透明コマを含む14コマのGIFです。PNGシートは4列×3行、各セル288×384、番号は左上から右へ000〜011です。000〜007は生成した動作、008〜011は最後の残光や葉が固定支点で小さくなって消える撮影コマです。GIFは共通パレット・1ビット透過、PNGは滑らかなアルファを保持します。

全動作を同じ倍率で書き出し、命中点・守護輪の下端・残光の支点を明示座標で登録しています。輪の下端は発動前後で1px差、外枠は左右24px・上下32px以上完全に透過しています。金色の原本の隣セル混入は、対応表に記録した固定の切り出し領域で除外します。各ポーズを別々の大きさへ合わせる処理は行いません。

`manifest.json` の `skillId` で技から素材を選びます。`sequence` と `durationsMs` を同じ時計で進め、`null` の区間は何も描画しません。`loop:false` なので `durationMs` 到達で再生終了です。`frameStartsMs` は各コマの開始、`phases` は溜め・発動・命中/保持・消失の区間、`visibleEndMs` は最後の消失コマの終了を示します。方向を変える場合は水矢・金色の突きのレイヤーだけ左右反転し、キャラの衣装や髪飾りは反転しません。

```js
// 再生開始時刻を技の発動時に一度だけ記録する。
const startMs = performance.now();
const elapsedMs = performance.now() - startMs;
if (elapsedMs < animation.durationMs) {
  let time = Math.max(0, elapsedMs), index = 0;
  while (index < animation.durationsMs.length - 1 && time >= animation.durationsMs[index]) {
    time -= animation.durationsMs[index++];
  }
  const cel = animation.sequence[index];
  if (cel !== null) {
    const sx = cel % asset.grid.columns * 288;
    const sy = Math.floor(cel / asset.grid.columns) * 384;
    ctx.drawImage(sheet, sx, sy, 288, 384, x - 144, y - 192, 288, 384);
  }
}
```

GIF全コマ復号、寸法・保持時間・共通パレット・背景消去、透明な開始/終了、PNG外枠、単発GIFの反復指定なしを検証しています。実コピーの `GameArt.sample` に対して、3技の各コマ開始・切替直前1ms・単発終了の84アサートも通過しました。連続視覚再生と実ゲーム内配置の確認は未実施です。

保存した原本から、この追加セットだけを再書き出します。

```sh
python3 tools/build_learned_assets.py
```

全素材を再構築する場合は従来の `build_game_assets.py --force` の後に、各追加セットの `build_learned_assets.py` を実行してください。金の主原本は、生成した命中コマだけを編集前シートへ差し替えたものです。編集前の `source/golden_thrust-base.png`、生成編集シート `source/golden_thrust-impact-edit.png`、採用矩形も保存しています。生成原本、生成・局所修正プロンプト、固定登録座標、撮影コマの設定は `prompts.json` と `learned-set-01.json` に保存しています。


## 習得技 第2セット

[若葉の縛り・虹彩の光弾をZIPでまとめて保存](downloads/learned-set02.zip)できます。

| 素材ID | 習得技ID | 方向 | 単発GIF | 総尺 / GIF可視終端 / PNG可視終端 |
|---|---|---|---|---|
| young_leaf_bind | ivy_bind | 正面 | [effect.gif](gifs/young_leaf_bind/effect.gif) | 2560ms / 1740ms / 1840ms |
| prism_bolt | king_prism | 右 | [effect.gif](gifs/prism_bolt/effect.gif) | 2120ms / 1300ms / 1400ms |

第一セットと同じ各288×384・12PNGセル・4列×3行シート・14コマの単発GIFです。`preview.gif` だけ反復します。開始100msと終了720msは透明、最後の4セルは固定支点で残光や葉を縮退させる消失コマです。`sequence`、`durationsMs`、`frameStartsMs`、`loop:false` で再生を制御します。第一セットのCanvas例をそのまま使えます。

この2技では最終PNGセルの最大アルファが若葉93/255、虹彩25/255です。GIFの透過閾値96未満になるため、その100msセルも完全透明となり、GIFの連続透明尾部は820msです。`visibleEndMs` と `phases` は復号GIFの可視終端に一致し、`pngVisibleEndMs` と `pngPhases` はPNGの微弱な残光まで含めた終端を示します。総尺とコマ時刻は同じです。

若葉の縛りは蔦の根元を固定して閉じ、締まった輪と3枚の葉を一体のまま縮退させます。解除セル5〜7は保持セル4を根元(144,307)で0.82→0.64→0.46倍へ縮め、その後4段階の残光へつなぎます。上葉だけが消えるポーズ切替はありません。根元は閉じる前後で1px差です。虹彩の光弾は白い芯を固定したコンパクトな虹色の光弾が、命中の扇状の光へ変わります。右向きの効果レイヤーは方向に合わせて反転できます。キャラのレイヤーは別に扱います。`king_prism` は既存の素材IDでもあるため、新しい素材IDを `prism_bolt` とし、`skillId` で習得技に対応させています。

実コピーの `GameArt.sample` で2技の全コマ開始・切替直前1ms・単発終了の56アサートが通過しています。GIF全コマ、共通パレット、透過外枠、単発終端を検証しています。連続視覚再生と実ゲーム内配置の確認は未実施です。ゲーム本体への自動組み込みは行っていません。

```sh
python3 tools/build_learned_assets.py --records assets/generated/learned-set-02.json
```

採用した生成原本と、虹彩の光弾の編集前シート `source/prism_bolt-base.png` を保持しています。初稿の長い帯を画像生成でコンパクトな光弾へ交換し、セル内で輪郭を完結させました。若葉の元の開蔦ポーズは原本内に残し、書き出し時の `phaseTransforms` で保持ポーズを縮退させています。生成・局所修正プロンプト、登録座標、消失コマ設定は `prompts.json` と `learned-set-02.json` にあります。


## 習得技 第3セット

[潮の癒し・黄金の庇護をZIPでまとめて保存](downloads/learned-set03.zip)できます。

| 素材ID | 習得技ID | 方向 | 単発GIF | 総尺 / GIF・PNG再生定義の可視終端時刻 |
|---|---|---|---|---|
| tide_mend | gran_mend | 正面 | [effect.gif](gifs/tide_mend/effect.gif) | 2540ms / 1820ms |
| golden_aegis | spinel_guard | 正面 | [effect.gif](gifs/golden_aegis/effect.gif) | 2540ms / 1820ms |

各288×384・12PNGセル・4列×3行シート・14コマの単発GIFです。専用の `preview.gif` だけ反復します。開始100msと終了720msは透明。GIFの可視終端とPNGのmanifest再生定義の可視終端は、開始からどちらも1820msです。開始透明100msを除いた不透明表示の持続は1720msで、最後の可視GIFセルは水が1画素、金が2画素まで縮退してから消えます。`visibleEndMs` / `pngVisibleEndMs` / `phases` / `pngPhases` と実ファイルの終端は一致しています。

潮の癒しは滑らかな水の器と3滴を味方の周囲に配置する回復効果です。黄金の庇護は大きな金の面と一本の修復痕を持つ一枚の盾です。味方の背後へ描画すると、不透明な盾が味方の顔や輪郭を覆うことを避けられます。空間的な配置は実ゲーム内で調整してください。どちらも根元(144,307)を支点に全体が縮退し、途中で滴や盾の面を個別に消していません。主要8セルの輪郭bboxの下端（範囲終端座標）は、アルファ96/255以上を測定すると307〜309pxです。全非透明画素の下端を意味せず、アルファ1〜3/255の微弱な残留がそれより下にある場合があります。PNG単体は保持時間を持たず、時刻はmanifestのコマ順と保持時間から定義しています。

GIFの透過閾値は96、全コマで共通パレットを使い、PNGは滑らかなアルファを保持しています。実コピーの `GameArt.sample` で2技の全コマ開始・切替直前1ms・単発終了の56アサートが通過しています。連続視覚再生と実ゲーム内配置は未実施、ゲーム本体への自動組み込みは行っていません。

```sh
python3 tools/build_learned_assets.py --records assets/generated/learned-set-03.json
```

生成原本と実参照セル、プロンプト、登録座標、保持セル4を使う `phaseTransforms`、最後の残光設定をZIPへ保存しています。第1セットのCanvas共通例で、`loop:false` と対応表のコマ時刻に従って一度だけ再生できます。


## 習得技 第4セット

[蒼海の一太刀・暁の砕光をZIPでまとめて保存](downloads/learned-set04.zip)できます。

| 素材ID | 習得技ID | 方向 | 単発GIF | 総尺 / GIF可視終端 / PNG再生定義の可視終端 |
|---|---|---|---|---|
| azure_tide_strike | gran_tide | 右 | [effect.gif](gifs/azure_tide_strike/effect.gif) | 2540ms / 1720ms / 1820ms |
| dawn_shatter | spinel_sun | 正面 | [effect.gif](gifs/dawn_shatter/effect.gif) | 2540ms / 1720ms / 1820ms |

各288×384・12PNGセル・4列×3行シート・14コマの単発GIFです。専用 `preview.gif` だけ反復します。GIFは開始透明100ms、実不透明表示1620ms、透明尾部820ms。PNG単体に保持時間はなく、PNGの終端はmanifestのコマ順と保持時間で定義しています。PNGは縮退とアルファ減衰、GIFは輪郭の縮退を使います。GIFの透過は1bitのため、残る不透明画素は常に255/255で、PNGと同じ半透明フェードではありません。最終PNGの微弱な残光はGIF透過閾値96未満になり、最後の100msセルもGIFでは透明です。`visibleEndMs` / `phases` は復号GIF、`pngVisibleEndMs` / `pngPhases` はPNG再生定義に一致しています。

蒼海の一太刀は一本の白い切刃を持つ大波を、選択地点の範囲へ重ねる効果です。既存素材ID `gran_tide` と区別し、新しい素材IDを `azure_tide_strike` としました。右向きの効果だけ反転できます。暁の砕光は白い芯と左右の光を持つ、正面からの黄金光です。主要8セルの輪郭bbox下端は、アルファ96/255以上・exclusiveの範囲終端座標で307〜309px（実画素306〜308px）です。どちらも基準点(144,307)を固定した変換で全体を縮退させ、波の一部や左右光だけを途中で消していません。輪郭の全画素が完全静止する意味ではなく、ラスタ化と透過閾値により数画素の差があり、金の終盤では下端が最大2〜4px上がる場合があります。

実コピーの `GameArt.sample` で2技の全コマ開始・切替直前1ms・単発終了の56アサートが通過しています。PNG/GIFの全コマ、透明外枠、単発終端、共通パレットを検証しています。連続視覚再生と実ゲーム内配置は未実施、ゲーム本体への自動組み込みは行っていません。

```sh
python3 tools/build_learned_assets.py --records assets/generated/learned-set-04.json
```

大波の越境した初稿は `source/azure_tide_strike-base.png` に保持しています。長い裾を画像生成で短い完全な輪郭を持つ波へ描き直した主原本、金の原本、実参照セル、生成・修正プロンプト、登録座標、`phaseTransforms` を保存しています。第1セットのCanvas共通例と対応表で一度だけ再生できます。


## 習得技 第5セット

[翠蔦の輪舞・七色の結界・パレット・レゾナンスをZIPでまとめて保存](downloads/learned-set05.zip)できます。

| 素材ID | 習得技ID | 方向 | 単発GIF | 総尺 / GIF可視終端 / PNG再生定義の可視終端 |
|---|---|---|---|---|
| vine_round_dance | ivy_dance | 正面・時計回り | [effect.gif](gifs/vine_round_dance/effect.gif) | 2540ms / 1820ms / 1820ms |
| seven_color_barrier | king_canvas | 正面 | [effect.gif](gifs/seven_color_barrier/effect.gif) | 2540ms / 1820ms / 1820ms |
| palette_resonance | king_resonance | 右 | [effect.gif](gifs/palette_resonance/effect.gif) | 2540ms / 1720ms / 1820ms |

各288×384・12PNGセル・4列×3行シート・14コマの単発GIFです。`preview.gif` だけ反復します。開始透明100msを除いたGIF不透明表示は、葉環と結界1720ms、斬撃1620msです。透明尾部は葉環と結界720ms、斬撃820ms。PNG自体は保持時間を持たず、PNGの終端はmanifestの再生定義です。GIFは1bit透過の輪郭縮退、PNGは縮退とアルファ減衰で、同じ半透明フェードではありません。

翠蔦の輪舞は3枚の葉と閉じた蔦の環を、中心(144,205)で時計回りに0→30→60→90度回転させ、その後全体を縮退します。生成原本の完全なセル0〜3を採用し、保持・解除は同じ完全なセル3から組み立てています。元の大きなセル4〜7は採用せず、編集元として残しています。`adoptedSourceCells` / `unusedSourceCells` / `phaseTransforms` に選択と撮影変換を保存しています。

七色の結界は左の暖色と右の寒色、白い縁を持つ中空の結界です。中央は透明なので味方に重ねられます。パレット・レゾナンスは一体になった七色の斬撃で、効果レイヤーだけ左右反転できます。この2技は底点(144,307)を変換の基準にします。基準点が固定でも、ラスタ化や透過閾値で輪郭画素に数画素の差が出ます。登録と輪郭bboxはmetadataを参照してください。斬撃GIFは原画のアルファを全ピクセル保持し、専用原本の処理では輪郭周辺8pxの色だけを生成した色付き縁から採用して書き出しています。帯外不変は原本処理の話であり、GIF全体は共通パレットで再量子化するため、内側のRGB値も旧GIFと同一ではありません。PNGの主原本・全セルは同じまま、白い外縁のGIF劣化を抑えています。明るい背景では濃い青紫の線や階段状の縁が残るため、完全に柔らかい発光を再現するものではありません。編集ドナー、採用マスク、専用原本、`gifSourceEdit` と生成プロンプトを保存しています。

実コピーの `GameArt.sample` で3技の全コマ開始・切替直前1ms・単発終了の84アサートが通過しています。回転・縮退後を含む全PNGセルの透明外枠24px/32px、全GIFコマ、共通パレット、単発終端を検証しています。連続視覚再生と実ゲーム内配置は未実施、ゲーム本体への自動組み込みは行っていません。

```sh
python3 tools/build_learned_assets.py --records assets/generated/learned-set-05.json
```

採用原本、葉環と結界の編集前シート、実参照セル、生成・修正プロンプト、固定登録座標、回転・縮退設定を保持しています。葉環の不採用セルをそのまま使わず、完成済みPNGシートとmanifestのコマ順を使ってください。


## 習得12技の実測終端

[機械可読の終端一覧](learned-visible-times.json)も収録しています。開始透明100msを含む終端時刻と、実不透明表示の持続時間を区別しています。PNGはmanifestで定義した時刻です。

| 技 | 総尺 | GIF可視終端 | GIF不透明持続 | 透明尾部 | PNG定義の可視終端 |
|---|---|---|---|---|---|
| 水鏡の矢 | 2120ms | 1400ms | 1300ms | 720ms | 1400ms |
| 花守り | 2560ms | 1840ms | 1740ms | 720ms | 1840ms |
| 金継ぎの突き | 2190ms | 1370ms | 1270ms | 820ms | 1470ms |
| 若葉の縛り | 2560ms | 1740ms | 1640ms | 820ms | 1840ms |
| 虹彩の光弾 | 2120ms | 1300ms | 1200ms | 820ms | 1400ms |
| 潮の癒し | 2540ms | 1820ms | 1720ms | 720ms | 1820ms |
| 黄金の庇護 | 2540ms | 1820ms | 1720ms | 720ms | 1820ms |
| 蒼海の一太刀 | 2540ms | 1720ms | 1620ms | 820ms | 1820ms |
| 暁の砕光 | 2540ms | 1720ms | 1620ms | 820ms | 1820ms |
| 翠蔦の輪舞 | 2540ms | 1820ms | 1720ms | 720ms | 1820ms |
| 七色の結界 | 2540ms | 1820ms | 1720ms | 720ms | 1820ms |
| パレット・レゾナンス | 2540ms | 1720ms | 1620ms | 820ms | 1820ms |
