# Color Resonance ゲーム素材

ゲームの物語・敵・仲間・技に合わせ、組み込みimagegenで生成した素材ライブラリです。キャラクター30種類、技・状態・環境・装甲・外皮・着弾・出現・通過・帰還エフェクト37種類、主原画67枚、透過PNGコマ562枚、動作GIF157本（動作・単発技・継続ループ132本と専用反復プレビュー25本）を収録しています。水面の4×4配置用GIF2本は別枠の確認画像です。

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
| source/{id}.png | 採用した画像生成原本、RGBA。各寸法はmanifestのsourceSize、修正前原画も保持 |
| sheets/{id}.png | 実装用透過シート。従来は1152×768・4×2、習得技は1152×1152・4×3。追加セットごとのgridを参照 |
| frames/{id}/{cel}.png | 透過コマ。従来・習得技は288×384、状態・環境・装甲以降は256×192。正確な寸法はgrid.cellSize |
| gifs/{id}/{action}.gif | 従来単体288×384、合成技384×480、装甲・外皮・着弾・出現は256×192。保存用effect.gifは単発、preview.gifは反復 |
| manifest.json | 素材名・参照先・コマ順・保持時間・ループ設定・合成レイヤー |
| prompts.json | 実際の生成・修正プロンプト、基準絵、採用ファイル、修正理由 |
| quality-report.json | PNGのアルファ・セル境界・GIF全コマ復号の検証記録 |
| review/{id}.jpg / motion-boundaries.jpg | コマ別と動作の区切りの確認画像 |

コマ番号は左上から右へ、上段0〜3、下段4〜7です。敵・仲間は待機、瞬き、移動A、移動B、攻撃予備、攻撃、被ダメージ、発動。モブは最後の4コマを会話A・会話B・挨拶A・挨拶Bに使います。各動作の正確な順序・尺は対応表に収録しています。

従来シートは固定の等寸グリッドで切り出しています。個々のポーズをタイトクロップしたり、毎コマ別々の倍率で揃えたりしていません。1方向のポーズセットです。歩行はコマ2→0→3→0、攻撃は0→4→5→0として実際の姿勢差分を切り替えます。

## ゲームへ読み込む

キャラクターと既存技の初期素材はゲーム本体へ組み込み済みです。`js/art.js` が必要なシートを読み込み、対応表の `sequence` / `durationsMs` / `loop` と戦闘の時計でコマを進めます。攻撃・被ダメージの再生速度は命中の瞬間に合わせます。キャラクターの倍率・足元は全コマで固定です。PNGの滑らかな透過を保ち、GIFのプレビュー用ループは戦闘へ持ち込みません。追加セットの接続状況は各節に記載しています。

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


## 専用素材を制作した従来12技の実測終端

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


## 状態継続 第6セット

[蔦の束縛・黄金の守りの足元環をZIPでまとめて保存](downloads/status-set06.zip)できます。

| 素材ID | 対応する実コードの状態 | GIF | 再生 |
|---|---|---|---|
| root_hold | `unit.root > 0` | [status.gif](gifs/root_hold/status.gif) | 1600msの常時ループ |
| guard_hold | `unit.guard > 0` | [status.gif](gifs/guard_hold/status.gif) | 1600msの常時ループ |

各256×192・6PNGセル・3列×2行の768×384シート・12コマGIFです。状態が付いている間だけ反復し、状態解除と同時に描画を止めます。習得技の単発GIFとは異なり、保存用の `status.gif` 自体がループします。rootは移動を縛る蔦、guardは味方の守りを示します。`js/board.js` の状態輪（root/guard）を置き換える素材候補で、ゲーム本体へはまだ接続していません。

単一のGPT Image原画から同じ輪郭・アルファを保持し、RGBの明るさだけ90→100→90%へ変える控えめな色の呼吸です。葉3枚・金の菱形4枚・中抜きは同じ形を保ちます。全PNG/GIFのアルファ形状が同一、GIFの先頭と末尾がピクセル単位で同じで、足元pivot(128,96)は常に完全透明です。PNG外枠は24px以上完全透明。GIFは共通255色＋透過色、閾値96・ディザなし・disposal=2で、半透明の縁は二値になります。明るい床では細い輪郭の硬さが出る場合があります。

PNGの再生順はGIFと同じ `sequence:[0,1,2,3,4,5,5,4,3,2,1,0]`、保持時間は `durationsMs:[160,120,120,120,120,160,160,120,120,120,120,160]` です。明るい折り返し（5→5）は320ms、周回境界（最後の0→次の最初の0）も320ms同じ絵を保持します。下の使用例は `GameArt.sample` を通してこの往復順と保持時間を使用します。6枚のPNGを番号順に反復する再生は、この動作定義とは異なります。

**配置はシートのpivotを使います。** 実コピーの `GameArt.draw` は輪郭bboxの中央または下端に合わせるため、この足元pivotとは一致しません。`GameArt.load` が返すPNGシートと `GameArt.sample(id,'status',elapsed)` を使い、以下のように固定pivotへ描画できます。影の後、キャラ本体より前に描き、環の実幅を `tw*0.65` 程度にします。rootとguardが同時に付く場合の重なりや、選択環・床との読みやすさは実ゲームで調整してください。

```js
// GameArt.ready完了後。assetはmanifestの該当エントリー。
const [sheet] = await GameArt.load([asset.id]);
function drawStatus(ctx, asset, sheet, elapsedMs, footX, footY, tw) {
  const cel = GameArt.sample(asset.id, 'status', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize;
  const [px, py] = asset.pivotPx;
  const scale = tw * 0.65 / asset.footprintWidthPx;
  ctx.drawImage(sheet,
    (cel % asset.grid.columns) * w, Math.floor(cel / asset.grid.columns) * h, w, h,
    footX - px * scale, footY - py * scale, w * scale, h * scale);
}
// root/guardが0になったら呼ばない。elapsedMsは状態付与時からの経過時間。
```

実コピーの `GameArt.sample` を読み取り専用VMで実行し、3周分のコマ開始・切替直前1ms・次周の開始について140アサートが通過しています。**連続視覚再生と実ゲーム内配置は未確認**です。静止構造・全コマデコード・ループ境界と再生定義を検証した候補として使用してください。

```sh
python3 tools/build_status_assets.py
```

`status-set-06.json` に単一原画のクロップ枠・一律倍率・透過穴の実測中心・pivot・明るさを保存しています。クロップは同じ原画の一度だけの共通枠で、コマ別のフィットや位置合わせは行いません。全コマの色以外は固定です。主原画、黄金環の編集前原画、実参照PNG、初回・修正の生成プロンプト、PNG/GIF・シート・レビュー画像と再生成スクリプトを保持しています。


## 環境水面 第7セット

[虹・くすみの水面ループをZIPでまとめて保存](downloads/environment-set07.zip)できます。

| 素材ID | 床の状態 | 1枚のGIF | 4×4配置GIF |
|---|---|---|---|
| sea_surface_prism | 虹 | [ambient.gif](gifs/sea_surface_prism/ambient.gif) | [4×4](review/sea_surface_prism-4x4.gif) |
| sea_surface_dull | くすみ | [ambient.gif](gifs/sea_surface_dull/ambient.gif) | [4×4](review/sea_surface_dull-4x4.gif) |

各256×192・12PNGセル・4列×3行の1024×576シート・12コマGIFです。PNGは `sequence:[0,1,2,3,4,5,6,7,8,9,10,11]`、各200ms、`loop:true` とGIFと同じ時刻で再生します。総尺2400ms、保存用GIFもループします。固定の模様の上を、広い周期反射が進みます。位相は0/12〜11/12の等間隔で、次周0/12へ同じ1/12の歩幅で進むため、800msの静止区間はありません。先頭と末尾は異なる画ですが、周回境界の位相差は他のコマ間と同じです。

実ゲームは `th=tw*0.54` の盤面です。反復する楕円や白い帯を抑えるため、広く穏やかな色変化の正方形UV原画を新たに生成しました。各辺の約2%を除いた範囲を256×256のUVへ写し、半周期ずらした4パッチを `sin²(πs)sin²(πt)` の窓で合成して周期化しました。ずらした側の座標は軸反転し、窓は切れ目で0になります。u/vの対辺が周期的につながります。周期化による平均の偏りは、RGB全体へ一律の倍率をかけて生成原画UVの平均輝度へ戻しています。周期化前後のUV PNGと倍率を保持しています。

反射は `0.5+0.5*cos(2π(u-phase))` の広い一周期で、色の加算は虹(8,8,5)、くすみ(3,4,5)です。同じ素材の隣接面で色・照明が一致します。薄い周期反復は残るため、穏やかな静水面用として使います。**全ての海タイルへ同じ盤面時刻・位相を使います。** タイルごとのランダム位相や独立した開始時刻は使いません。虹/くすみの色境界は床の状態表示として残します。

論理平面は200×108、頂点(128,42)・(228,96)・(128,150)・(28,96)、pivot(128,96)です。出力アルファは原画のアルファではなく、固定の平面被覆を使います。アンチエイリアスした縁が隣の面と重なって暗い線を作らないよう、被覆だけ2%広げた縁の重なりを持ちます。論理的なタイル幅200は同じです。中心と面内は不透明、全PNG/GIFで同じアルファ、24px以上の外枠は完全透明です。

通常章の `sea_calm`・`sea_flat`・`sea_shallow` の上面候補です。虹とくすみを `floor` に対応させ、終章の `cfg.inverted` と中立床、通れない深海には適用しません。既存タイルを保持して上面へ重ね、480msの床切り替えでは既存の `prev` / `floor` と `k` に従いクロスフェードします。範囲表示・経路・キャラより前に描いて、操作情報を隠さない順序にします。ゲーム本体には未接続です。

```js
// assetはmanifestの該当エントリー。sheetはGameArt.load([asset.id])の返すPNG。
function drawWaterSurface(ctx, asset, sheet, boardElapsedMs, x, y, tw, opacity = 1) {
  const cel = GameArt.sample(asset.id, 'ambient', boardElapsedMs);
  if (!sheet || cel == null || opacity <= 0) return;
  const [w, h] = asset.grid.cellSize;
  const scale = tw / 200; // 論理平面の高さ108*scale = tw*.54
  ctx.save(); ctx.globalAlpha *= opacity;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    x - 128 * scale, y - 96 * scale, w * scale, h * scale);
  ctx.restore();
}
// 全海面へ同じboardElapsedMsを渡す。drawCellの(x,y)に配置する。
// prevの面を1-k、floorの面をkで描画。対象外/neutral/invertedの面は描かない。
// 範囲や経路より前に置く。2%の縁の重なりを別のbboxフィットで拡縮しない。
```

全12コマの隣接面を(±100,54)ずらして、不透明な重なり324組/コマのRGB差がPNG/GIFとも0であることを確認しています。4×4配置の全コマGIFと複数時刻の静止配置も確認しています。実コピー `GameArt.sample` の3周140アサートが通過しています。GIFは共通255色＋透過色、閾値96・ディザなし・disposal=2で、滑らかな色勾配に量子化の段が出る場合があります。**連続視覚再生・実ゲーム内配置・480msの床切り替え遷移は未確認**です。

```sh
python3 tools/build_environment_assets.py
```

生成・修正原画、以前の原画とプロンプトの履歴、実タイル参照、周期化前後のUV、照明と投影設定を `environment-set-07.json` / `prompts.json` とZIPに保存しています。模様の物理的な変形は行わず、周期的な照明が動きます。

## 鉛装甲 第8セット

[一層剥離・最終殻割れをZIPでまとめて保存](downloads/armor-set08.zip)できます。

| 素材ID | 発生条件 | 単発GIF | 接触時刻（可視開始から） |
|---|---|---|---|
| lead_layer_peel | 鉛の層が減り、まだ残る | [effect.gif](gifs/lead_layer_peel/effect.gif) | 1枚：360ms |
| lead_shell_break | 鉛の層が1以上から0になる | [effect.gif](gifs/lead_shell_break/effect.gif) | 左434ms・右405ms・上548ms |

実コピー `board.js` の鉛装甲更新に対応する、受け側のイベント素材です。前の装甲値と更新後の装甲値を比較し、減った瞬間に一度だけ再生します。通常攻撃は1層、スピネルの貫通攻撃などは残る層をまとめて剥がします。正稿の「殻のように割れて落ちた」「体には触れない」に合わせ、対象の本体・顔・刃を描かず、外殻の1枚または3枚だけを外へ剥がして落とします。ゲーム本体には未接続です。

各256×192・12PNGセル・4列×3行の1024×576シートです。GIFは開始の透明80ms、セル000〜008各80ms、009〜011各120ms、終了の透明640msの14コマ、総尺1800msです。可視終端はPNG/GIFとも1160ms。保存用 `effect.gif` はループせず、一覧用 `preview.gif` だけが繰り返します。対応表の `sequence` は `[null,0,1,2,3,4,5,6,7,8,9,10,11,null]`、`loop:false` です。

固定の足元pivot(128,128)・地面y128・基準タイル幅80です。各板は飛行中に同じ大きさを保持し、外向きの水平速度と重力420px/s²で落下します。回転した不透明輪郭の最初の地面接触を1ms刻みで求め、その位置と姿勢で止めます。全板が着地した後、セル009〜011だけ接地点へ0.65→0.35→0.12倍に縮小し、最後の小さな残片を消します。着地前には縮めません。接地点は剥離x98、殻割れx87・202.5・136、丸め誤差は0.5px以内です。地面線付きの各12コマ比較を `review/lead_layer_peel.jpg` / `review/lead_shell_break.jpg` に保存しています。地面線は確認画像だけにあり、GIF/PNG素材には含みません。

PNGは消失3セルのalphaを0.85→0.65→0.45とし、滑らかな半透明を保持します。GIFには半透明がないため、同じ縮小とRGB暗化0.85→0.65→0.45・二値透過を使います。**GIFの末段階は縮小と暗化による消失表現で、滑らかな半透明フェードではありません。** 最終残片の幅はGIFで各6px以下、PNGはごく薄いAA縁を含め各最大7pxです。最終GIFの下端y126には、PNGの不透明輪郭より1px上になる量子化差を許容しています。背景に自然に透ける消失はPNGシートを使います。共通255色＋透過色、閾値96、ディザなし、disposal=2です。不透明輪郭（alpha96以上）は地面下へ侵入せず、PNGのごく薄いAA縁は地面の下に最大alpha3で残る場合があります。外枠24pxは完全透明です。

```js
// assetはmanifestの該当エントリー。sheetはGameArt.load([asset.id])で読んだPNG。
function drawArmorFragments(ctx, asset, sheet, elapsedMs, footX, footY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize;
  const scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    footX - 128 * scale, footY - 128 * scale, w * scale, h * scale);
}
// armorが減った瞬間のunitXY(d)を足元として保持し、経過時刻を渡す。
// 更新後armor>0ならlead_layer_peel、armor===0ならlead_shell_breakを選ぶ。
// 1800ms後はイベントを終了。GameArt.drawのbbox中心/下端へのフィットは使わない。
```

原画・実ゲーム参照・プロンプト・切り出し範囲・速度・回転・接触時刻・全セルの座標は `armor-set-08.json` / `prompts.json` に保持しています。復号GIFで終端・透過・段階的な縮小と暗化を確認し、実コピー `GameArt.sample` の90アサートが通過しています。**連続視覚再生・実ゲーム内配置は未確認**です。

```sh
python3 tools/build_armor_assets.py
```

## 外皮の切り離し 第9セット

[穢れの外皮・白い膜の2点をZIPでまとめて保存](downloads/release-set09.zip)できます。

| 素材ID | 対象 | 単発GIF |
|---|---|---|
| kegare_release | 通常章の敵の穢れの外皮 | [effect.gif](gifs/kegare_release/effect.gif) |
| white_membrane_release | 終章の膜の敵のみ | [effect.gif](gifs/white_membrane_release/effect.gif) |

実コピーの敵消去 `defeat(d, killer)` にある、通常章の灰色smokeと終章の白いsmokeの分岐を元に作りました。`d.dead=true` を設定する前の1回だけ選びます。通常用は `d.side==='enemy' && !cfg.inverted`、白い膜は `d.side==='enemy' && cfg.inverted && d.kind==='membrane'` が条件です。**白い膜の素材はクロム本体へ適用しません。** 正稿では切り離すのは貼りついた白い膜だけで、その人の本当の夜空の黒は残します。対象の身体・顔・武器・光輪を描かず、少数の大きな外皮2枚が離れる表現です。既存のルノワールへ飛ぶorbと組み合わせる場合も、追加のorbを描きません。ゲーム本体には未接続です。

各256×192・12PNGセル・4列×3行1024×576のシートです。開始透明80ms、セル000〜007各80ms、008〜011各120ms、終了透明640msの14コマGIF、総尺1840ms、PNG/GIFとも可視終端1200msです。`effect.gif` は1回だけ再生し、`preview.gif` は一覧用に反復します。`sequence:[null,0,1,2,3,4,5,6,7,8,9,10,11,null]`、`loop:false` を使います。

足元pivot(128,128)、基準タイル幅80です。初期の片の中心は、足元から左右±0.35tw・上へ0.5twです。開始の透明80msの後、完成した外皮が出現するため、敵表示の左右の外皮へ重なる始点として使い、そこから離す用法を想定しています。必要なら全コマ共通の位置と倍率で合わせます。実ゲームでの重なり位置は未確認です。実敵画像の外皮を正確に分割した素材ではなく、低彩度の灰紫も含めて参照から新たに解釈した表現です。

左・右の外皮は各同じ形を保持し、左右±40px/sと上向き25px/sで漂って離れます。初めの8セルは固定スケール、PNGと灰色GIFの後半4セルはそれぞれの漂う中心へ0.75→0.50→0.28→0.10倍に縮小します。中央の矩形(120,32)-(136,156)は全PNG/GIFでalpha0、外枠24pxも完全透明です。元の2片から作り、追加の粒子は描きません。低alphaのAAによる孤立画素が残る場合があり、厳密に孤立画素ゼロとはしません。

PNGは後半のalpha0.9→0.8→0.7→0.6を保持します。灰色GIFは同じ縮小にRGB暗化0.9→0.7→0.5→0.3と二値透過を併用します。**白い膜GIFは白・薄紫の色を保ち、暗化しません。** 可視開始から640msの中心(74.4,72)・(181.6,72)と回転±12.8度を固定し、0.75→0.50→0.28→0.06倍へ縮小します。PNGは漂う中心のまま0.10倍まで、白GIFは固定中心で0.06倍までと、末段階の位置・大きさが異なります。滑らかな半透明はPNGを使います。共通255色＋透過色、alpha閾値96、ディザなし、disposal=2です。復号GIFの最後5セルの不透明面積は灰紫1706→954→424→126→11、白1333→760→348→103→7画素です。灰紫の平均RGBは各段階で暗くなり、白GIFの平均RGBは224.81〜230.08の白・薄紫を保っています。

```js
function releaseAssetId(d, cfg) {
  if (d.dead || d.side !== 'enemy') return null;
  return cfg.inverted ? (d.kind === 'membrane' ? 'white_membrane_release' : null)
    : 'kegare_release';
}
function drawReleaseWrappers(ctx, asset, sheet, elapsedMs, footX, footY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    footX - 128 * scale, footY - 128 * scale, w * scale, h * scale);
}
// defeatのdead設定前にIDとunitXY(d)の足元・開始時刻を保持する。
// GameArt.load([id])でシートを読み込み、1840msでイベント終了。
// GameArt.drawのbboxフィットではなく、固定pivotとscaleで描く。
```

実shade/membraneの参照、生成原画とGPT Image修正前原画、両プロンプト、切り出し・漂う速度・回転・全セル位置は `release-set-09.json` / `prompts.json` とZIPに保存しています。実コピー `GameArt.sample` の90アサートが通過しています。**連続視覚再生・実ゲーム内配置は未確認**です。

```sh
python3 tools/build_release_assets.py
```

## 敵の遠隔着弾 第10セット

[茨の射撃着弾・膜の圧迫着弾の2点をZIPでまとめて保存](downloads/impact-set10.zip)できます。

| 素材ID | 対象 | 単発GIF |
|---|---|---|
| thorn_ranged_hit | 茨の遠隔攻撃の命中点 | [effect.gif](gifs/thorn_ranged_hit/effect.gif) |
| membrane_pressure_hit | 膜の遠隔攻撃の命中点 | [effect.gif](gifs/membrane_pressure_hit/effect.gif) |

実コピー `board.js` の茨の射程2〜3・膜の射程1〜2と、`attack(a,d)` の遠隔分岐を元に作りました。既存分岐の線と着弾に添える短い圧力跡です。`a.side==='enemy' && a.kind==='thorn'` または `a.kind==='membrane'`、かつ `ranged && !r.miss && !r.pass` の命中時だけ1回使います。3本の大きな跡を実敵セルの色から新たに描いた表現で、飛翔体・身体の分割・新しい武器やダメージ効果は含みません。第9セットの消去時の外皮とは別の用途です。ゲーム本体には未接続です。

各256×192・12PNGセル・4列×3行1024×576シートです。開始透明60ms、セル000〜007各40ms、008〜011各80ms、終了透明500msの14コマGIFで総尺1200ms。PNG/GIFとも可視終端700msです。`effect.gif` は一度だけ、一覧用 `preview.gif` だけ反復します。セル003と004は同じピーク形状を合計80ms保持します。12セル全てが別形状ではありません。

固定の**命中点pivot(128,96)**、基準タイル幅80です。足元ではなく、実分岐の `hitX=pd.x` / `hitY=pd.y-tw*d.hgt*.5` に合わせます。元は左から右へ向かう跡で、攻撃側から対象へのベクトルに合わせて回します。全体を同じ支点で0.15→0.35→0.65→1倍へ広げ、最後は0.65→0.40→0.20→0.07倍へ収縮します。可視跡は支点の手前にあり、pivot画素自体は全PNG/GIFでalpha0です。全コマの外枠24pxも完全透明です。

PNGの最後4セルはalpha0.9→0.8→0.7→0.6も保持します。GIFは原画の色を保った輪郭収縮で消し、RGB暗化を行いません。特に白い膜は最後まで白・薄紫を保持し、灰黒へ変えません。共通255色＋透過色、alpha閾値96、ディザなし、disposal=2です。復号GIFの終盤の不透明面積は茨1318→501→120→14、膜1648→625→156→18画素。膜の終盤平均RGBは232.93〜234.75です。

原画の大きな跡は3本ですが、縮小とラスタ化で1〜3pxの分離画素が一部に残ります。茨PNG006にalpha200/193、膜PNG002/008にalpha130/117の画素があり、全てが低alphaのAAではありません。先端から約2.24px離れる場合もあります。追加の粒子システムは使いませんが、孤立画素ゼロ・全コマで3本が明瞭とはしません。64pxではピークの3本は判別でき、開始と末尾は点状です。膜は明るい床でコントラストが弱く、**実ゲームでの視認性と連続視覚再生・実配置は未確認**です。

```js
function drawRangedImpact(ctx, asset, sheet, elapsedMs, hitX, hitY, tw, angle) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.save(); ctx.translate(hitX, hitY); ctx.rotate(angle);
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    -128 * scale, -96 * scale, w * scale, h * scale);
  ctx.restore();
}
// 遠隔命中分岐でa.kindからIDを選び、命中点・方向・開始時刻を保持する。
// GameArt.load([id])で読み込み、1200msでイベント終了。
// GameArt.drawのbboxフィットを避け、全セル共通の命中点と倍率で描く。
```

実敵セル参照、生成原画、膜の修正前原画、全プロンプトと支点・尺度・時間は `impact-set-10.json` / `prompts.json` とZIPに保存しています。実コピー `GameArt.sample` の開始・中点・直前・終端について90アサートが通過しました。各コマの確認画像は `review/thorn_ranged_hit.jpg` / `review/membrane_pressure_hit.jpg` です。

```sh
python3 tools/build_impact_assets.py
```

## 敵の出現 第11セット

[核の増援・白い膜の出現2点をZIPでまとめて保存](downloads/emergence-set11.zip)できます。

| 素材ID | 対象 | 単発GIF |
|---|---|---|
| kegare_reinforcement | 通常章の核が生む新しい敵 | [effect.gif](gifs/kegare_reinforcement/effect.gif) |
| membrane_emergence | 終章の第二段で可視になる膜の敵 | [effect.gif](gifs/membrane_emergence/effect.gif) |

実コピー `board.js` の核による3ターンごとの増援生成と、`enterPhase1` で隠れた膜の敵を可視にする処理に合わせました。核の増援は生成が成功して `units.push(u)` した時、かつ `!cfg.inverted` の場合だけ使います。白い膜は `cfg.inverted && u.kind==='membrane'` の隠れた敵を解除し、`bornT` を更新した時だけです。**クロム本体には使いません。** 新しい敵や能力を作る素材ではなく、既存の600ms出現フェードの左右に添える大きな立ち上がり跡です。身体・顔・目・武器・文字はありません。第9の消去、第10の着弾とは用途が異なります。ゲーム本体には未接続です。

各256×192・12PNGセル・4列×3行1024×576シートです。開始透明40ms、セル000〜007各80ms、008〜011各100ms、終了透明520msの14コマGIFで総尺1600ms。PNG/GIFの可視終端は1080msです。保存用 `effect.gif` は一度だけ透明で終了し、一覧用 `preview.gif` だけ反復します。セル005/006は同じピーク形状を440〜600msの160ms保持します。12セル全てが別形状ではありません。

足元pivot(128,128)、基準タイル幅80、左右の根元(82,128)/(174,128)を固定します。原画の2本を、根元から高さ0.10→0.25→0.45→0.65→0.85→1倍・幅0.70→0.75→0.80→0.85→0.90→1倍に立ち上げます。600msの出生フェードが終わった時点から、0.90→0.70→0.45→0.22→0.06倍へ等方収縮します。全12セルのalpha閾値96以上の各輪郭bbox下端は128です（最後の不透明行はy127）。PNGの弱いAAまで全てがこの線で終わるという意味ではありません。

全PNG/GIFの中央矩形(112,24)-(144,168)はalpha0、外枠24pxも完全透明です。原画から描いた側方表現で、実敵の身体を精密に囲う形ではありません。床の後・敵の前のレイヤーへ描き、出生時のセルの足元へ合わせる使い方を想定しています。新しい敵の隣にいる別のユニットとの重なりと実視認性は未確認です。

PNGの最後4セルはalpha0.9→0.8→0.7→0.6も使います。GIFは原画の色を保って輪郭を縮小し、RGB暗化しません。共通255色＋透過色、閾値96、ディザなし、disposal=2です。GIFの終盤5セルの面積は灰紫3079→1847→776→188→12、白1817→1098→453→110→9画素。白の終盤平均RGBは226.15〜230.57を保ちます。元の主要形状は2本、追加粒子システムはありませんが、ラスタ化による小さい分離画素が残る場合があり、粒ゼロや全画素完全不透明とはしません。灰紫原画の最大alphaは254です。タイル幅64pxでピークを静止比較し、開始・末尾は小さな跡になります。明るい床での白のコントラストは弱めです。

```js
function drawEnemyEmergence(ctx, asset, sheet, elapsedMs, footX, footY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    footX - 128 * scale, footY - 128 * scale, w * scale, h * scale);
}
// 増援生成/膜のhidden解除時に出生セルとbornTを保持する。
// GameArt.load([id])で読み込み、床の後・ユニットの前に描き1600msで終了。
// GameArt.drawのbboxフィットではなく、同じ足元・倍率で全コマ描く。
```

実shade/membrane参照、生成原画・修正前原画、両プロンプト、切り出し・根元・尺度・時間は `emergence-set-11.json` / `prompts.json` とZIPに保存しています。`review/kegare_reinforcement.jpg` / `review/membrane_emergence.jpg` の地面線は確認画像だけにあります。実コピー `GameArt.sample` の開始・中点・直前・終端について90アサートが通過しています。**連続視覚再生・実ゲーム内配置は未確認**です。

```sh
python3 tools/build_emergence_assets.py
```

## 心剣の通り抜け 第12セット

[心剣の通り抜け1点をZIPでまとめて保存](downloads/passage-set12.zip)できます。

| 素材ID | 対象 | 単発GIF |
|---|---|---|
| heartblade_pass | 最終戦の第一段で、クロムの黒を傷つけずに通り抜ける心剣 | [effect.gif](gifs/heartblade_pass/effect.gif) |

制作開始時の1.1.0から現在の1.3.0と実コピーの `Board.strike` にある `d.kind==='chrome' && stage===0` の `pass` 分岐、および統合ストーリーの「あなたの黒は、穢れじゃない」に合わせた素材です。アリアの心剣にだけ使い、条件は `a.kind==='aria' && d.kind==='chrome' && stage===0 && r.pass===true` です。光が止まらず通り抜け、傷・命中フラッシュ・黒の消去・破片を描きません。**クロムの本体は変えません。** ゲーム本体には未接続です。

現在の `attack()` は `r.pass` を判定する前に通常の生成エフェクトを登録します。組み込む際は、その通常エフェクトの代わりにこの素材を選ぶ必要があります。通常のmiss、命中、クロムの攻撃、白い膜の剥離には使いません。本セットは素材の追加で、戦闘処理・HP・hurt・flash・knock・テスト・待機時間を変更していません。

256×192・12PNGセル・4列×3行1024×576シートです。開始透明20ms、各セル40ms、終了透明200msの14コマGIF、総尺700ms、PNG/GIFの可視終端500msです。保存用 `effect.gif` は一度だけ透明で終わり、一覧の `preview.gif` だけ反復します。可視セルの更新間隔は40msです。

GPT Imageで実際の心剣と既存の心剣エフェクトを参照し、1本の白・淡い水色・オパール色の光を生成しました。輪郭の単純化までの原画3枚と全プロンプトを保持しています。採用原画1536×1024から固定矩形(288,368)-(1296,688)を一度登録し、全セルで同じ原画基準点(805,535)を使います。各セルでタイトクロップしたり位置を自動補正したりしていません。横方向へ[62,73,87,102,117,130,141,151,162,175,187,198]pxと進み、等方倍率[0.13,0.26,0.45,0.65,0.85,1,0.96,0.80,0.61,0.40,0.22,0.10]で出入りします。ピークの主輪郭幅は160px、基準タイル幅80pxです。

全PNG/GIFの外枠24pxはalpha0。最終GIFの可視12セルは、各々8近傍で1つの連結した輪郭です。独立した粒子システムや画素を削除するノイズ除去は使いません。修正前は先端に1〜2pxの分離がありましたが、原画の輪郭修正と開始・末尾の倍率調整で解消しました。PNGの弱いAAは保持し、GIFは共通255色＋透過色、閾値96、ディザなし、disposal=2です。PNGの最後4セルにはalpha0.95/0.85/0.70/0.55も使います。GIFは色を保って縮小し、RGBを暗くしません。

セルのpivot(128,96)を `unitXY(target).x, unitXY(target).y - tw*0.6` に合わせます。標準は画面右向きです。別方向へ合わせる場合はキャンバス全体をpivotの周りに回転する設計ですが、方向別の視認性は未確認です。明るい床では淡い光のコントラストが弱く、開始・末尾は短い跡です。クロムや隣接ユニットとの重なり、**連続視覚再生・実ゲーム内配置は未確認**です。素材レビューの縦線は確認画像だけで、コマには入りません。

```js
function drawHeartbladePass(ctx, asset, sheet, elapsedMs, targetX, targetY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    targetX - 128 * scale, targetY - 96 * scale, w * scale, h * scale);
}
// アリアのr.pass分岐だけで開始し、通常の命中エフェクトと重ねない。
// GameArt.load(['heartblade_pass'])を事前に行い、700msで終了する。
```

`passage-set-12.json`、`prompts.json`、`quality-report.json`、ZIPに編集元・登録座標・尺度・時間・検証記録を保持します。実コピーの `GameArt.sample` の開始・中点・直前・終端について45アサートが通過しています。これはブラウザでの視覚再生チェックとは別の検証です。

独立AI監査は素材単体の条件付きPASSで、確定NGはありませんでした。全コマの一筋の輪郭・非命中の物語適合・尺・loop・余白・軌道を確認しています。明るい床の64px表示では発生と末尾が弱く、実視認とゲーム内配置は未検証です。PNG末尾の部分alphaと、色を保ったGIFの幾何収縮は異なる表現として保持しています。

制作Macの同じ環境ではZIPから再生成した15媒体がバイト一致しました。独立した別環境では15媒体の画素・GIF復号が一致し、GIF2本はバイトも一致しました。PNG13点は圧縮の環境差でバイトが異なりました。あらゆる環境で15媒体のSHAが一致するという保証ではありません。公開ファイルと今回のコミットのSHA照合は、再生成環境間の比較とは別の確認です。

```sh
python3 tools/build_passage_assets.py
```

## 精霊の帰還 第13セット

現在の1.4.0にはエンチャント・召喚の各系統で24習得技があります。既存の専用素材12点は従来12技向けで、現在の24技をすべて専用素材で網羅したという意味ではありません。ゲームの `spiritSkill()` は24技とも精霊ごとの共通4エフェクトを使っています。追加12技の回復・守りには既存素材の再利用候補があり、単体斬撃・潮霧などは次の専用素材候補です。本セットは召喚の期限切れを扱い、技の仕様や選択処理を変更しません。

[精霊の帰還1点をZIPでまとめて保存](downloads/departure-set13.zip)できます。

| 素材ID | 対象 | 単発GIF |
|---|---|---|
| spirit_departure | 召喚期限が切れ、アリアの胸の中へ還る4精霊 | [effect.gif](gifs/spirit_departure/effect.gif) |

制作時の1.3.0から公開基準の1.4.0と実コピーの `departSpirit(u)` に合わせた、静かに閉じる足元の環です。生存する召喚精霊について `Boolean(u.until) && u.summon < 0` になった時だけ使います。残り0ターンは「このターンまで」の表示で、まだ帰還しません。既存処理は色付きの汎用光柱を登録し、本体を900msでフェードさせます。組み込む際は光柱に代わる帰還の合図として使い、召喚期限・本体のフェード・身体の画素を変更しません。ゲーム本体には未接続です。

グラン・アイビー・スピネル・キング共通の、白・水色・オパール色の環1点です。4精霊別の配色素材ではありません。撃破・敵の消去・出現・エンチャント期限・継続防御には使いません。グランの召喚攻撃「潮騒の帰還」も別イベントです。身体・顔・柱・文字・破片・追加粒子は描いていません。

256×192・12PNGセル・4列×3行1024×576シート。開始透明40ms、各セル80ms、終了透明400msの14コマGIF、総尺1400ms、PNG/GIF可視終端1000msです。セル003/004は同じピークを280〜440msの160ms保持するため、固有PNG形状は11点です。保存用 `effect.gif` は一度だけ透明で終了し、一覧用 `preview.gif` だけ反復します。

GPT Imageで実際の守りの足元環を画法・輪郭の参照に、心剣をオパール色の参照にして、透過の中空環を新規生成しました。原画1536×1024の固定矩形(64,336)-(1472,816)と基準点(768,576)を一度登録します。各コマで切り直したり自動で中央に寄せたりしません。ピーク主輪郭幅148px、等方倍率[0.72,0.84,0.92,1,1,0.94,0.84,0.70,0.54,0.36,0.22,0.10]。4倍の解像度で同じ原画をアフィン変換し、LANCZOS縮小して輪郭を保ちます。

足元pivot(128,128)を、`u.dead` を設定する前に取得した `unitXY(u)` の位置へ固定し、床の後・ユニットの前に描きます。基準タイル幅80pxです。全PNG/GIFの外枠24pxとpivotの画素はalpha0です。極小の末尾まで内側全域の透明形状を保証するという意味ではありません。GIFの可視12セルは各々8近傍で1つの連結輪郭です。40msで幅106px、ピーク148pxの72%の環が現れ、そこから広がり、440〜1000msで縮みます。ゼロから滑らかに発生する演出ではありません。最後の920〜1000msは14×4px・27画素で上辺3pxが切れた小さなU字です。消失直前の縮退として採用しており、全コマが閉じた輪ではありません。移動や吸い込みの軌道はありません。

PNG最後4セルはalpha0.9/0.8/0.7/0.6も使います。GIFは元の色を保った幾何収縮で、RGBを暗くしません。共通255色＋透過色、閾値96、ディザなし、disposal=2。GIF終盤の面積は671→308→122→27画素で、平均RGBは228.52〜231.49です。PNGとGIFの末尾は異なる表現です。明るい床では白い内側のコントラストが弱く、末尾は小さなU字になります。64pxタイルの静止比較を用意していますが、**連続視覚再生・実ゲーム内配置・実視認性は未確認**です。

```js
function drawSpiritDeparture(ctx, asset, sheet, elapsedMs, footX, footY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    footX - 128 * scale, footY - 128 * scale, w * scale, h * scale);
}
// departSpirit開始時の足元と時刻を保持し、1400msで終了。
// GameArt.load(['spirit_departure'])で事前に読み込み、ユニットの後ろへ描く。
// GameArt.drawのbboxフィットではなく、同じ足元・倍率で全コマ描く。
```

原画・実参照・全プロンプト・登録座標・尺度・尺は `departure-set-13.json`、`prompts.json`、ZIPに保持しています。実コピーの `GameArt.sample` の開始・中点・直前・終端45アサートは、ブラウザでの視覚再生とは別の検証です。同じ制作Mac環境でZIPから再生成した15媒体はバイト一致しました。PNGの圧縮は環境差があるため、全環境でSHAが一致するという保証ではありません。 独立AI監査では主要数値・形の一貫性・縮退・白の保持がPASSでした。別環境の独立再構成で12PNGセルの画素は一致し、符号化バイトには差がありました。極小の末尾と明るい床の視認性には留保があり、実視認性は未検証です。

```sh
python3 tools/build_departure_assets.py
```

## 単体の虹剣光 第14セット

[単体の虹剣光1点をZIPでまとめて保存](downloads/single-blade-set14.zip)できます。

| 素材ID | 習得技ID | 用途 | 単発GIF |
|---|---|---|---|
| seven_color_single_slash | king_edge / king_spectrum | 七彩の刃・虹彩の極剣の対象1体への斬撃 | [effect.gif](gifs/seven_color_single_slash/effect.gif) |

制作時の1.4.0と、公開前の最新コピー・origin1.5.0で技の定義を照合し、専用素材がなかった2つの単体剣技へ、共通の細い剣光1点を追加しました。七彩の刃は隣接1体・基礎威力1.45倍、虹彩の極剣は2マス先までの1体・基礎威力2.2倍です。床の彩色は既存の周り1/2マスで、素材自体は床を描きません。+1〜+3の強化と絆の補正、射程・対象・共鳴コストはゲームの定義に従います。技別や強化段階別の別画像は作っていません。

現在の `spiritSkill()` は命中結果の前に、全ての王の技へ共通の `king_prism` を登録します。組み込む際はこの2技だけに選び、単体対象への `strike()` が `!r.pass && !r.miss && r.dmg>0` を返した時に使います。共通の生成FXに重ねず、置き換える用途です。クロム第一段の `r.pass`、虹彩の光弾、七色の結界、パレット・レゾナンスには使いません。現行の技・HP・装甲・強化処理は変更せず、ゲーム本体には未接続です。

GPT Imageで実際の心剣・七色の範囲斬撃・心剣の一閃を参照しました。既存の広い三日月の形から分け、白い芯と控えめな虹色を持つ、1本の細い対角の剣光を新規生成しています。身体・武器モデル・円・矢じり・破片・追加粒子・文字を描きません。投射物のように移動せず、固定した対象点の周りで短く振り抜きます。

256×192・12PNGセル・4列×3行1024×576シートです。開始透明20ms、各セル40ms、終了透明220msの14コマGIF、総尺720ms、PNG/GIF可視終端500ms。セル004/005は同じピークを180〜260msの80ms保持し、固有PNG形状は11点です。保存用 `effect.gif` は単発で透明終了、一覧用 `preview.gif` だけ反復します。反復時は末尾220msと次の開始20msが透明です。

原画1536×1024の全キャンバスを一度登録し、測定した主輪郭bbox中心(780.5,545)を全セルで使います。原画の向きは約−25度、固定pivot(128,96)の周りで追加角度[−18,−12,−5,3,11,11,18,24,29,33,36,38]度を時計回りに動かします。等方倍率[0.18,0.42,0.70,0.90,1,1,0.88,0.70,0.50,0.32,0.18,0.10]。基準の未回転主輪郭幅160pxに対し、回転したピークGIFのbbox幅は167pxです。4倍サンプリングとLANCZOS縮小で作り、各コマで切り直し・位置の自動補正・ノイズ画素の削除をしません。

対象の `unitXY(target).x, unitXY(target).y-tw*0.6` を開始時に取得し、pivotへ合わせて固定します。基準タイル幅80pxです。全PNG/GIFの外枠24pxはalpha0、GIFの可視12セルは各々8近傍で1つの連結輪郭です。 PNG006には最大alpha4/255の極弱い離島が10成分あります。原寸と64px相当では可視の別粒は確認されていませんが、厳密な離島ゼロとはしません。これらの弱い透過画素は保持しています。PNG最後4セルはalpha0.95/0.85/0.70/0.55も使い、GIFは原画の色を保って縮小します。RGBを暗くするフェードではありません。共通255色＋透過色、閾値96、ディザなし、disposal=2です。GIF終盤の面積は391→164→57→17画素、平均RGBは203.03〜206.30。開始・末尾は短い跡です。

64pxタイルで明暗の静止比較を用意しました。明るい床では白い芯と末尾の視認が弱くなります。対象のノックバックや撃破時、隣接ユニットとの重なり、方向別の読みやすさ、**連続視覚再生・実ゲーム内配置・実視認性は未確認**です。

```js
function drawSingleRainbowSlash(ctx, asset, sheet, elapsedMs, targetX, targetY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    targetX - 128 * scale, targetY - 96 * scale, w * scale, h * scale);
}
// この2技の正常な命中結果だけで、対象点と開始時刻を保持し720msで終了。
// GameArt.load(['seven_color_single_slash'])で事前に読み込む。
// GameArt.drawのbboxフィットではなく、同じ対象点・倍率で全コマ描く。
```

原画・実参照・プロンプト・登録座標・角度・尺度・時間を `single-blade-set-14.json`、`prompts.json`、ZIPに保持しています。実コピーの `GameArt.sample` の境界45アサートは、ブラウザでの視覚再生とは別の確認です。同じ制作MacでZIPから15媒体の再生成バイト一致を確認しました。PNGの符号化は環境差があり、全環境でSHAが一致する保証ではありません。独立AI監査は静止・全コマの素材監査で注意付きPASSです。原寸・64px相当の明暗でPNG/GIF全コマを確認し、可視の輪郭断裂・別粒・白から黒い破片への変化はありませんでした。原画登録から24PNGを独立再計算し、両セット全てのRGBA画素が一致しています。これは連続視覚再生や実ゲーム配置の検証とは別です。

```sh
python3 tools/build_single_blade_assets.py
```

## 単体の黄金剣弧 第15セット

[単体の黄金剣弧1点をZIPでまとめて保存](downloads/single-cut-set15.zip)できます。

| 素材ID | 習得技ID | 用途 | 単発GIF |
|---|---|---|---|
| golden_single_cut | spinel_verdict | 黄金の裁断の対象1体への斬撃 | [effect.gif](gifs/golden_single_cut/effect.gif) |

制作時の1.4.0と、公開前の最新コピー・origin1.5.0で技の定義を照合し、専用素材がなかった「黄金の裁断」へ単体の剣弧を追加しました。2マス先までの敵1体に、基礎威力2倍・必中・守りと鉛を貫く既存の技です。+1〜+3の強化や絆の補正、彩色・射程・共鳴コストはゲーム側の定義に従います。技別の強化段階の別画像や新しい能力を作る素材ではありません。

現在の `spiritSkill()` は命中結果の前に、スピネルの技へ共通の `spinel_shield` を登録します。組み込む際は `skill.id==='spinel_verdict'` の単体対象へ、`strike()` が `!r.pass && !r.miss && r.dmg>0` を返した時に使い、共通の生成FXを置き換えます。通常の突き、暁の砕光の広域魔法、防御、鉛の剥離・殻割れ、クロム第一段の非命中には使いません。HP・装甲・強化処理は変更しておらず、ゲーム本体には未接続です。

GPT Imageで実際の黄金の突き・暁の砕光・心剣を参照し、白・金・琥珀色の、左へ開いた縦の細い剣弧を新規生成しました。既存の直線の突きや菱形の広域光、第14の細い虹色の対角剣光とは輪郭が異なり、単なる色替えではありません。身体・傷・消去・装甲の破片・円・追加粒子・文字は描きません。

256×192・12PNGセル・4列×3行1024×576シート。開始透明20ms、各セル40ms、終了透明220msの14コマGIF、総尺720ms、PNG/GIF可視終端500ms。セル004/005は同じピークを180〜260msの80ms保持し、固有PNG形状は11点です。保存用 `effect.gif` は単発で透明終了、一覧用 `preview.gif` だけ反復します。反復境界は末尾220msと次の開始20msが透明です。

原画1536×1024の全キャンバスを一度登録します。原画のy513行でalpha閾値96以上の帯がx881〜1034にあるため、その中点(957.5,513)を固定基準点にしました。三日月bboxの空いた中央ではなく、光の帯の中央を対象pivot(128,96)へ合わせています。基準の未回転主輪郭幅60px・高さ119.87pxに、追加角度[−16,−11,−5,1,7,7,12,16,20,24,28,30]度の時計回りの振り抜きと、等方倍率[0.18,0.42,0.70,0.90,1,1,0.88,0.70,0.50,0.32,0.18,0.10]を使います。4倍サンプリング・LANCZOS縮小で、コマごとの切り直しや自動位置補正、ノイズ画素の削除をしません。

開始時に取得した `unitXY(target).x, unitXY(target).y-tw*0.6` に固定し、基準タイル幅80pxで描きます。全PNG/GIFの外枠24pxはalpha0、GIFの可視12セルは各々8近傍で1つの連結輪郭です。 一部のPNGには最大alpha3/255の極弱い微小離島が残ります。可視の別粒は確認されていませんが、厳密な離島ゼロとはしません。弱い透過画素は保持しています。PNG最後4セルはalpha0.95/0.85/0.70/0.55も使い、GIFは元の色を保った幾何収縮です。RGBを暗くしません。共通255色＋透過色、閾値96、ディザなし、disposal=2。GIF終盤面積は469→194→65→21画素、平均RGB209.38〜214.51で、最後は小さな曲線になります。

64pxタイルの明暗静止比較を用意しました。明るい床では白い芯と末尾の視認が弱くなります。ノックバック・撃破時と隣接ユニットとの重なり、方向別の読みやすさ、**連続視覚再生・実ゲーム内配置・実視認性は未確認**です。

```js
function drawSingleGoldenCut(ctx, asset, sheet, elapsedMs, targetX, targetY, tw) {
  const cel = GameArt.sample(asset.id, 'effect', elapsedMs);
  if (!sheet || cel == null) return;
  const [w, h] = asset.grid.cellSize, scale = tw / 80;
  ctx.drawImage(sheet, (cel % 4) * w, Math.floor(cel / 4) * h, w, h,
    targetX - 128 * scale, targetY - 96 * scale, w * scale, h * scale);
}
// 黄金の裁断の正常な命中結果だけで、対象点と開始時刻を保持し720msで終了。
// GameArt.load(['golden_single_cut'])で事前に読み込む。
// GameArt.drawのbboxフィットではなく、同じ対象点・倍率で全コマ描く。
```

原画・実参照・プロンプト・登録点・角度・尺度・時間は `single-cut-set-15.json`、`prompts.json`、ZIPに保持しています。同じ制作MacでZIPから15媒体を再生成し、バイト一致を確認しました。実コピーの `GameArt.sample` の境界45アサートは、ブラウザでの視覚再生とは別の確認です。PNGの符号化には環境差があり、全環境でSHAが一致する保証ではありません。独立AI監査は静止・全コマの素材監査で注意付きPASSです。原寸・64px相当の明暗でPNG/GIF全コマを確認し、可視の輪郭断裂・別粒・白から黒い破片への変化はありませんでした。原画登録から24PNGを独立再計算し、両セット全てのRGBA画素が一致しています。これは連続視覚再生や実ゲーム配置の検証とは別です。

```sh
python3 tools/build_single_cut_assets.py
```

## 潮霧の輪 第16セット

[潮霧の輪をZIPでまとめて保存](downloads/mist-set16.zip)できます。**r1・独立AI監査で注意付き採用可**です。ゲーム本体には未接続です。

| ID | 対応技 | GIF | PNGシート |
|---|---|---|---|
| sea_mist_ring | gran_spray / 潮霧の輪 | [単発](gifs/sea_mist_ring/effect.gif) / [一覧反復](gifs/sea_mist_ring/preview.gif) | [1024×576](sheets/sea_mist_ring.png) |

最新コピー1.5.0と公開元の実コードを読み、既存の大波・回復の水とは用途の異なる、流れ模様を持つ凝縮した低い水・霧環1点を作りました。拡散する空気中の霧ではありません。召喚系統・絆8で習得、共鳴3、射程3、周り1マスの敵へ基礎威力0.9倍の必中魔法、周り1マスの彩色はゲームの定義に従います。+0〜+3は同じ素材を使い、能力や範囲を画像から変更しません。回復・守りや星の樹UIは既存素材を流用する方針です。

発動済みの `gran_spray` の選択地点で一度だけ描画する範囲詠唱の素材です。個別の命中・負傷・クロムの初期状態へのダメージを示す画像ではありません。将来の接続ではこの技の汎用 `gran_tide` 表示を置き換えます。現在の波へ重ねず、消費・射程・対象・彩色・空範囲の扱い・ダメージ計算を保ちます。

256×192・12PNGセル・4列×3行1024×576シート。開始透明40ms、セル000〜007各80ms、008〜011各100ms、終了透明400msの14コマGIFで総尺1480ms、PNG/GIF可視終端1080ms。003/004は同じピークを280〜440msの160ms保持し、固有PNG形状は11点です。保存用GIFは透明終了の単発、一覧用だけ反復します。反復境界は末尾400ms＋次の開始40msが透明です。

1536×1024のGPT Image原画を丸ごと保持します。原画の中心(768,512)を固定し、出力pivot(128,104)に登録します。倍率0.40→0.60→0.82→1→1→0.96→0.90→0.80→0.65→0.45→0.28→0.18で広がって閉じます。最初は40%の大きさで現れ、ゼロからの連続発生ではありません。各セルを輪郭bboxで個別に切り直したり、中心を取り直したりしていません。4倍のAFFINE/BICUBICサンプリング後、LANCZOSで縮小します。

原画には元キャンバス左端にalpha1の画素が6点あり、省略せず保持します。最終PNG/GIFの外枠24pxはalpha0。PNG000/002/003/004/006/007/008には最大alpha4/255の弱い離島があり、PNG010のpivotにはalpha1/255が残ります。弱いAAを削除せず、厳密な全PNG離島ゼロ・全PNG中心alpha0とはしません。GIFの可視12セルは各々8近傍で1成分、pivotの透明領域は4近傍の外部背景へつながらないことを数値で確認しました。最後のGIFのbboxは32×12・192画素で、中心の穴を保つ小さな輪です。これは数値・静止確認であり、実時間の見やすさを意味しません。

PNG最後4セルはalpha0.9/0.8/0.7/0.6も使います。GIFは原画の色を保った輪郭縮退で、RGBを暗くしません。共通255色＋透過色、閾値96、ディザなし、disposal=2。GIF終盤面積2353→1137→446→192画素、平均RGB170.06〜172.43です。PNGの半透明フェードとGIFの幾何収縮は異なります。

将来の配置では開始時の `topOf(selectedCell)` にpivotを合わせ、タイル幅80基準で元の256:192比率を保って描きます。ピーク幅176px＝約2.2タイルの低い楕円で、盤面 `th=tw*0.54` の正確な対象境界線ではありません。床の後・ユニットの前の候補です。現在の `drawArtEffects()` は素材を縦長へ伸ばすため、そのまま流用すると比率と位置が変わります。

原寸・64px相当で全コマの明暗静止比較を用意しました。開始と末尾は小さく、明るい床では白い内側が弱くなります。高さの異なる床、複数ユニットとの重なり、**連続視覚再生・実ゲーム内配置・実視認性は未確認**です。独立AI監査では可視GIF全12セルの連結と中心穴、単発1480msと1080ms以後の完全透明、PNG12枚とシートの再生成RGBA一致、両GIFの再生成バイト一致、単独GIFとZIP内の一致を確認し、注意付き採用可でした。シートと個別PNGはalpha0の隠れRGBだけが異なり、可視画素とalphaは一致します。厳密な全RGB・バイト一致の意味ではありません。40%サイズから現れる点、PNG010中心alpha1、明るい床の終盤視認を留保として保持します。

編集元は [mist-set-16.json](mist-set-16.json)、[生成原画](source/sea_mist_ring.png)、[生成プロンプト](prompts.json)、[検証記録](quality-report.json)です。ZIPには実参照・メタデータ・編集スクリプトを含みます。

## 復興編の追加素材

人間の仲間 `chrome_human` と管理者 `achroma` は各4ポーズの2×2グリッド。全8コマと原本PNG、実装シートを同梱しています。歩行・斬撃・浄化はゲームの時計でPNGを切り替え、既存の光エフェクトと合成します。新しいGIFプレビューは追加していません。原本のアルファを保ち、クロムの被弾は待機セルに既存の点滅を重ねます。

生成は組み込みimagegenを使用し、実際の8件のプロンプト・採用原本は `art-source/restoration/prompts.json`、配信用画像の検査記録は `quality-restoration.json` に保存しています。再書き出しは `tools/build_restoration_assets.py`、伝説装備は `tools/build_inventory_assets.py` を使用します。原本の再生成・背景の塗り替えは行いません。

## 汚染された精霊の追加

本編のグラン・アイビー・スピネル・パレット王には本人の既存アニメーションを使い、戦場の穢れを色の減衰と周囲の輪で描きます。新しい土地の精霊10種類は透過の静止セルです。移動・浮遊・突進・被弾と技はゲームの描画で動かし、GIFのコマ差分としては数えていません。採用セル・原本・生成プロンプト・透過検査は [仕様記録](../../docs/guardians.md) を参照してください。
