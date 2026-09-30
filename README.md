# FladSim

FF14の直線範囲ギミックを練習する非公式のブラウザアプリ。Pythonで移動・時間・抽選・被弾判定を処理し、Pyodideでブラウザ内実行します。JavaScriptは入力・Canvas描画・Pythonの呼び出しを担当します。サーバー実行環境のないGitHub Pagesでも動きます。

## 開発

[uv](https://docs.astral.sh/uv/getting-started/installation/)をインストールして実行します。

```sh
uv sync --locked
uv run python serve.py
```

http://localhost:8000 を開きます。HTMLの直接オープンではPythonファイルを取得できません。初回はCDNからPythonランタイムを取得するためインターネット接続が必要です。

```sh
uv run python -m unittest discover -s tests -v
```

## 仕様

- 半径1の円形フィールド。12時から時計回りにA・2・B・3・C・4・D・1。
- ボスは中心固定。ターゲットサークル直径はフィールド直径の46%。
- 直線範囲の幅はフィールド半径の50%。帯の片側の縁が中心を通り、ターゲットサークルの半分を覆います。
- 角度は帯の法線を右方向0°・下方向90°とした画面座標。開始は45°・135°・225°・315°から均等に抽選。90°ずつ回転します。回転方向は初期設定でランダム、練習用に固定も可能。
- 開始時刻0・1・2・3秒に予兆。6・7・8・9秒に同じ順番で攻撃。判定は各攻撃の発生時点に1回、赤い表示は0.45秒残ります。
- プレイヤーの判定半径はフィールド半径の2.5%、移動速度は半径の55%/秒。帯の縁に判定半径が触れた場合も被弾します。
- クリック・タップで目的地まで移動、ドラッグで目的地更新。WASDは画面基準で上下左右移動。斜め移動の速度は正規化。
- 被弾後も4回まで練習継続。タブ切り替え・ウィンドウのフォーカス離脱で自動一時停止。
- 各予兆は出現から1秒で消えます。攻撃の発生時に赤い範囲を再表示します。ボスに接触しても移動を妨げません。

## GitHub Pagesへの公開

1. GitHubにリポジトリを作り、これらのファイルを`main`ブランチへpush。
2. リポジトリの **Settings → Pages → Source** を **Deploy from a branch** に設定。
3. ブランチを **main**、フォルダを **/(root)** にして **Save**（以降はmainへのpushで更新）。

URLは通常 `https://<ユーザー名>.github.io/<リポジトリ名>/`。相対パスを使用しているためリポジトリ名のサブパスに対応します。ローカルの `.github/workflows/pages.yml` をGitHubへ追加できる場合は、Sourceを **GitHub Actions** に変更することでテスト後に静的ファイルだけを公開する方式も使用できます。Workflowのpushには認証の `workflow` 権限が必要です。

## 構成

`game.py`: Pythonシミュレーション / `app.js`: 描画・入力 / `styles.css`: レスポンシブUI / `serve.py`: 開発用サーバー / `tests/`: ロジック検証。

外部ゲーム素材は使用していません。実際のFF14とはギミックの細部・速度・判定が異なる練習用実装です。

参考: [Pyodide公式ドキュメント](https://pyodide.org/en/stable/usage/quickstart.html)、[GitHub Pages公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。
