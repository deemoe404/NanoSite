## NanoSite について

NanoSite は、シンプルなブログやドキュメント向けのゼロ依存・純フロントエンドの軽量テンプレートです。Markdown ファイルを `wwwroot/` に置き、`wwwroot/index.json` に登録すると、ブラウザだけでルーティング、レンダリング、目次（TOC）を行います。

### 特徴（概要）

- 完全静的：GitHub Pages などの静的ホスティングに最適
- Markdown 対応：見出し、リスト、リンク、画像、コードフェンス、表、チェックリスト
- 目次（TOC）：サイドバーに固定し、H2/H3 をハイライト
- ライト/ダークテーマ：手動切替と選好の記憶
- セキュリティ：URL スキームの許可リスト、相対画像パスの自動解決

### クイックスタート

1. 記事（`*.md`）を `wwwroot/` に追加します。
2. `wwwroot/index.json` にタイトルとファイル名を登録します。
3. ローカルプレビュー：`python3 -m http.server 8000` を実行し、`http://localhost:8000/` を開きます。

### デモとソース

- Markdown ショーケース： [デモを開く](?id=post/intro/markdown-showcase.md)

> ヒント：「すべての記事」タブは `wwwroot/index.json` から一覧を生成します。この「概要」タブは `wwwroot/tabs.json` で設定され、このファイルにマッピングされています。

