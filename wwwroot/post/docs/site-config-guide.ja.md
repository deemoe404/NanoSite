# サイト設定ガイド

このガイドでは、`site.json` を使ってサイトのアイデンティティ（タイトル、サブタイトル、アバター、プロフィールリンク）をカスタマイズする方法と、多言語設定について説明します。

## クイックスタート

1. リポジトリ直下でローカルサーバーを起動: `python3 -m http.server 8000`
2. ブラウザで `http://localhost:8000/` を開く
3. `site.json` を編集してリロード

> 注意: `site.json` の読み込みにはサーバーが必要です。ファイル URL で `index.html` を開くと `fetch` がブロックされる場合があります。

## `site.json` が制御するもの

- サイドバーのタイトルとサブタイトル
- サイドバーのアバター画像
- 1 行でドット（•）区切りのプロフィールリンク
- ブラウザタブのタイトル接尾辞（サイトタイトル）

## キー

```json
{
  "siteTitle": "My Site",
  "siteSubtitle": "Welcome!",
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" },
    { "label": "Blog", "href": "https://example.com" }
  ]
}
```

- `siteTitle`: サイドバーに表示され、ドキュメントタイトルの接尾辞にも使われます。
- `siteSubtitle`: タイトル下の任意の説明文。
- `avatar`: 画像への相対パスまたは URL。可能ならローカル資産を推奨。
- `profileLinks`: `{ label, href }` の配列（推奨）。`{ "ラベル": "https://..." }` のマップ形式も利用可能。

## 多言語設定

言語マップを使って言語ごとの値を提供できます。使用中の UI 言語に応じて値が選択されます。

```json
{
  "siteTitle": { "default": "My Site", "zh": "我的站点", "ja": "私のサイト" },
  "siteSubtitle": { "default": "Welcome!", "zh": "欢迎！", "ja": "ようこそ！" },
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" }
  ]
}
```

- 言語コードはサイトの言語セレクタに合わせます（例: `en`, `zh`, `ja`）。
- 指定がない言語は `default` にフォールバックします。

## 仕組み（概要）

- アプリは起動時に `site.json` を読み込み、サイト情報とリンクを描画します。
- 選択中の UI 言語が適用されます。
- ドキュメントタイトルは `ページタイトル · siteTitle` の形式になります。
- `index.html` の静的フォールバックは、`site.json` 読み込み後に上書きされます。

## ポスト索引（`wwwroot/index.json`）

`wwwroot/post/` 配下の Markdown 記事を列挙・多言語化します。各エントリは多言語構造をサポートします。

例（多言語）：

```json
{
  "最初の投稿": {
    "en": { "title": "My First Post", "location": "post/my-first-post.md" },
    "zh": { "title": "我的第一篇文章", "location": "post/my-first-post.md" },
    "ja": { "title": "最初の投稿", "location": "post/my-first-post.md" },
    "tag": ["Note"],
    "date": "2025-08-13",
    "image": "images/covers/welcome.jpg"
  }
}
```

フィールド:
- `en`/`zh`/`ja`/`default`: 言語別バリアント。値は文字列（パスのみ）または `{ title, location }`。
- `location`: 旧式のフラット形も動作しますが、上記の多言語形を推奨します。
- `tag` または `tags`: 文字列または配列。
- `date`: ISO 風の日付。UI 言語で表示フォーマットが変わります。
- `image` / `cover` / `thumb`: インデックス/検索用カード画像。`thumb`/`cover` を優先、なければ `image`。

追加手順:
1. `wwwroot/post/your-post.md` を作成。最初の `#` 見出しはページタイトルに利用されます。
2. `wwwroot/index.json` に追記（少なくとも 1 言語の `location`）。
3. 再読み込みすると「すべての記事」にカードが出現し、読了時間と日付が表示されます。

## タブ（`wwwroot/tabs.json`）

`wwwroot/tab/` 配下の追加ページ（例: About, Changelog）。多言語構造はインデックスと同様です。

例：

```json
{
  "About": {
    "en": { "title": "About", "location": "tab/about.md" },
    "zh": { "title": "关于", "location": "tab/about.zh.md" },
    "ja": { "title": "概要", "location": "tab/about.ja.md" }
  },
  "Changelog": {
    "default": { "title": "Changelog", "location": "tab/changelog.md" }
  }
}
```

注意:
- コンテンツは `wwwroot/tab/` に置き、`location` から参照します。
- 言語が見つからない場合は `default`（または `en`）にフォールバックします。
- タブタイトルは内部ルーティング用にスラッグ化され、非 ASCII 文字もサポートします。

## ヒント

- 画像は `assets/` 配下の相対パスを推奨。
- 外部リンクは安全なものに限定し、URL はアプリ側でサニタイズされます。
- リンクのラベルは簡潔にして、ドット区切りの 1 行レイアウトを見やすく。

## トラブルシューティング

- 変更が反映されない場合、ローカルサーバーでのアクセスか、強制リロードを確認。
- ブラウザコンソールで JSON パースエラーを確認。
- `assets/avatar.png` などのパスが正しく解決されるか確認。
