# Color Resonance ゲーム素材

ゲームの物語・敵・仲間・技に合わせ、組み込みimagegenで生成した素材ライブラリです。キャラクター18種類、技エフェクト15種類、主原本シート33枚、透過PNGコマ292枚、GIF117本（動作・単発技110本と専用反復プレビュー7本）を収録しています。

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

PNGは生成時の滑らかなアルファを保持します。GIFは形式上1ビット透過・最大256色で、発光の縁はPNGほど滑らかではありません。最終的なゲーム描画にはPNGを使うと、明暗どちらの背景でも綺麗に合成できます。各GIFは共通パレットと全コマの背景消去で、輪郭や光の残像を防いでいます。

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

| 素材ID | 習得技ID | 技 | 方向 | 単発GIF | 総尺 / 消失セルの終了 |
|---|---|---|---|---|---|
| water_arrow | gran_wave | 水鏡の矢 | 右 | [effect.gif](gifs/water_arrow/effect.gif) | 2120ms / 1400ms |
| flower_guard | ivy_bloom | 花守り | 正面 | [effect.gif](gifs/flower_guard/effect.gif) | 2560ms / 1840ms |
| golden_thrust | spinel_break | 金継ぎの突き | 右 | [effect.gif](gifs/golden_thrust/effect.gif) | 2190ms / 1470ms |

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

潮の癒しは滑らかな水の器と3滴を味方の周囲に配置する回復効果です。黄金の庇護は大きな金の面と一本の修復痕を持つ一枚の盾です。味方の背後へ描画すると、不透明な盾が味方の顔や輪郭を覆うことを避けられます。空間的な配置は実ゲーム内で調整してください。どちらも根元(144,307)を支点に全体が縮退し、途中で滴や盾の面を個別に消していません。主要8セルの輪郭の下端は、アルファ96/255以上を測定すると307〜309pxです。全非透明画素の下端を意味せず、アルファ1〜3/255の微弱な残留がそれより下にある場合があります。PNG単体は保持時間を持たず、時刻はmanifestのコマ順と保持時間から定義しています。

GIFの透過閾値は96、全コマで共通パレットを使い、PNGは滑らかなアルファを保持しています。実コピーの `GameArt.sample` で2技の全コマ開始・切替直前1ms・単発終了の56アサートが通過しています。連続視覚再生と実ゲーム内配置は未実施、ゲーム本体への自動組み込みは行っていません。

```sh
python3 tools/build_learned_assets.py --records assets/generated/learned-set-03.json
```

生成原本と実参照セル、プロンプト、登録座標、保持セル4を使う `phaseTransforms`、最後の残光設定をZIPへ保存しています。第1セットのCanvas共通例で、`loop:false` と対応表のコマ時刻に従って一度だけ再生できます。
