# LitLynx — 文献マップビューア＋AIチャット

TSVファイル（文章データの二次元可視化結果）を散布図マップ／ヒートマップとして表示し、検索・フィルタリング・範囲選択で文献を抽出した上で、AIチャット（Gemini / Claude）で議論できるウェブアプリケーション。

## 主要機能

- **TSV読み込み**: ドラッグ＆ドロップ / ファイル選択（必須カラム: ID, x, y, year, title, abstract, affiliation）
- **マップ表示**: 散布図 / ヒートマップ切替、ズーム・パン対応
- **範囲選択**: 矩形・円形で文献を選択
- **検索**: AND / OR / 正規表現対応
- **動的フィルタ**: 追加カラムを自動検出してフィルタUI生成
- **AIチャット**: Gemini / Claude API（ストリーミング応答、コスト概算表示）
- **エクスポート**: チャット履歴をMarkdownでダウンロード

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | SvelteKit |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS v3 |
| アイコン | Lucide Svelte |
| デプロイ | Cloudflare Pages (`adapter-cloudflare`) |

## セットアップ

```sh
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、TSVファイルを読み込んでください。

## ビルド・デプロイ

```sh
npm run build
```

Cloudflare Pages で GitHub リポジトリと連携すると、`main` ブランチへの push で自動デプロイされます。

## サンプルデータ

`static/sample.tsv` にテスト用データ（20件）が含まれています。
