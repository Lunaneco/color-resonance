# Color Resonance — 夜空の黒と透明の剣

物語とターン制の戦闘を楽しむ、ブラウザ向けゲームです。HTML、CSS、JavaScriptで動作し、ビルドやサーバー側の処理は不要です。

**プレイする:** https://lunaneco.github.io/color-resonance/

**画像生成素材:** [キャラクター・動作GIF・技エフェクトの素材一覧](https://lunaneco.github.io/color-resonance/assets/generated/)。18種類のキャラクター、8種類の技エフェクト、103本のGIFと透過PNGを収録しています。使い方は [素材README](assets/generated/README.md) を参照してください。

## 遊び方

画面に触れて音を有効にし、「はじめから」を選んでください。

- 物語: クリックまたは Enter で読み進めます。Ctrl 長押しでスキップできます。
- 戦闘: 味方と移動先の床を選び、表示されるメニューで行動します。E でターン終了、Esc で選び直します。
- 進行状況はブラウザのローカルストレージへ自動保存します。ブラウザや端末を変えた場合、セーブは引き継がれません。
- BGM、効果音、文字の速さ、難易度は「設定」で調整できます。

## ローカルで起動

リポジトリのディレクトリで次を実行し、http://localhost:8791/ を開いてください。

```sh
python3 -m http.server 8791
```

戦闘用のデータを `fetch` で読み込むため、`index.html` を直接開くのではなく、HTTPサーバーを使います。

## 公開と更新

GitHub Pages の公開元は GitHub Actions です。`main` ブランチへ変更を push すると、`.github/workflows/deploy.yml` がJavaScriptの構文と戦闘のブラウザ回帰テストを確認し、成功した場合にゲーム本体と素材を自動で公開します。Actions 画面の「Deploy game to GitHub Pages」から手動実行もできます。

## 戦闘のテスト

Node.js 24 で次を実行してください。テスト用のHTTPサーバーは自動で起動・終了します。

```sh
npm ci
npx playwright install chromium
npm test
```

移動と取り消し、攻撃とターン進行、回復、精霊、勝敗と再挑戦、戦闘中断、終章の切り替え、およびPC・スマートフォンの画面配置を確認します。テストでは独立したブラウザを使うので、プレイヤーのセーブデータは変更しません。

## ファイル構成

- `index.html`: ゲーム画面
- `css/`: スタイル
- `js/`: 物語、戦闘、マップ、音声、演出
- `assets/`: 立ち絵、背景、タイル、BGM
