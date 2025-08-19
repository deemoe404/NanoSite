---
title: NanoSite ドキュメント
date: 2025-08-17
tags:
	- NanoSite
	- ドキュメント
excerpt: Markdown ファイルから直接コンテンツサイトを構築し、ビルド工程は不要です。wwwroot/ に配置し、JSON にリストして公開するだけで、GitHub Pages にも対応します。本ガイドでは、プロジェクト構造、設定ファイル、コンテンツ読み込み、テーマ、検索、タグ、SEO、メディア、デプロイ手順を解説します。
author: deemoe
---

# NanoSite ドキュメント

ビルド不要。純粋な Markdown ファイルからコンテンツサイトを構築できます。`wwwroot/` に Markdown を置き、JSON に登録して、そのまま公開（GitHub Pages に最適）。

本ページの内容:

- プロジェクト構成とルーティング
- 設定ファイルと各パラメータ
- コンテンツの読込（記事・タブ・多言語）
- テーマ・検索・タグ・SEO・画像/動画
- デプロイとよく使うレシピ


## プロジェクト構成

- `index.html` — 入口ページ。基本 meta とコンテンツ/サイドバー/タブ領域。JS がここにマウント。
- `site.json` — サイト全体の設定（タイトル、アバター、テーマ既定など）。
- `assets/` — UI の JS/CSS（ビルド不要）。
	- `assets/main.js` — アプリのブートとルーター。
	- `assets/js/*.js` — 機能（i18n、markdown、search、theme、SEO など）。
	- `assets/themes/` — テーマパック CSS と `packs.json`（パック一覧）。
- `wwwroot/` — すべてのコンテンツとデータ。
	- `wwwroot/index.json` — 記事インデックス（ホーム/検索に表示）。
	- `wwwroot/tabs.json` — 静的タブ（About、Gallery など）。
	- `wwwroot/post/**` — 記事とそのアセット。
	- `wwwroot/tab/**` — タブ用の Markdown。
- 任意の SEO/CDN ルートファイル：`sitemap.xml`、`robots.txt`、`CNAME`。


## ルーティング

フロントエンドルーターは URL のクエリを読みます：

- `?tab=posts` — すべての記事（デフォルト）。`&page=N` でページング。
- `?tab=search&q=語句` — タイトルまたはタグで検索。`&tag=タグ名` で絞り込み。
- `?id=path/to/post.md` — 特定記事を表示（`index.json` に登録されている必要）。
- `?lang=ja` — UI/コンテンツの言語。localStorage に保持し、ブラウザと言語属性にもフォールバック。

Markdown 内でのサイト内リンク例：`[この記事](?id=post/frogy/main.md)`、タブ：`[概要](?tab=about)`。


## コンテンツ作成

`wwwroot/` に Markdown を作成。以下の Front Matter を推奨（必須ではありませんが、カード/SEO に有効）：

```markdown
---
title: 記事タイトル
date: 2025-08-18
tags: [タグA, タグB]
excerpt: カードとメタ説明に使う短い要約。
author: your-name
image: path/to/cover.jpg   # 任意。OG 画像などに使用
---

# 見出し1

本文...
```

注意：

- `index.json` がメタデータを持たない場合、Front Matter から `title`、`date`、`tags`、`excerpt`、`image` を取得します。
- ページ内の H1 は本文タイトルとして使用されます。カードのタイトルは `index.json` または Front Matter の `title` から。


## 記事インデックス：`wwwroot/index.json`

3 つの形をサポート。使いやすいものを選択してください。

1) 簡易（本リポジトリが使用）：言語ごとのパスを記述。アプリが Markdown を取得し、Front Matter からメタを抽出：

```json
{
	"nanoSite": {
		"en": "post/meet-nanosite/main_en.md",
		"zh": "post/meet-nanosite/main_zh.md",
		"ja": "post/meet-nanosite/main_ja.md"
	},
	"nanodoc": {
		"en": "post/meet-nanosite/doc_en.md",
		"zh": "post/meet-nanosite/doc_zh.md",
		"ja": "post/meet-nanosite/doc_ja.md"
	}
}
```

2) 統合：各言語で `{title, location}` を持ち、共通フィールドをトップレベルに置けます：

```json
{
	"最初の記事": {
		"ja": { "title": "最初の記事", "location": "post/foo_ja.md", "excerpt": "..." },
		"en": { "title": "My First Post", "location": "post/foo.md" },
		"tag": ["Note"],
		"date": "2025-08-13",
		"image": "post/cover.jpg",
		"thumb": "post/thumb.jpg",
		"cover": "post/cover-wide.jpg"
	}
}
```

3) レガシー（単一言語）：

```json
{
	"最初の記事": { "location": "post/foo_ja.md", "tag": ["Note"], "date": "2025-08-13", "image": "..." }
}
```

項目（いずれの形式でも共通）：

- `location` — 必須。Markdown のパス（`wwwroot/` からの相対）。
- `title` — 表示タイトル（統合形式）。それ以外はキー名や Front Matter から導出。
- `tag` / `tags` — 配列またはカンマ区切り。検索・タグ絞り込み・meta keywords に使用。
- `date` — ISO/`YYYY-MM-DD`。カードの日時や「古い記事」警告に使用。
- `image` / `cover` / `thumb` — カード/OG 画像の優先度。`thumb` は一覧用の小さめ画像に最適。
- `excerpt` — カードと SEO 説明。未設定なら本文の最初の段落から自動抽出。

挙動：

- 簡易形式では、メタは Markdown の Front Matter から取得。
- 言語間リンク：`main_en.md` へのリンクでも、UI が日本語なら日本語版にエイリアスできる場合があります。
- `index.json` に存在しない `location` は無効。未知の `?id=` はエラーメッセージを表示。


## タブ：`wwwroot/tabs.json`

タブは静的ページ。記事と同様に 3 形式をサポート。例（本リポジトリ）：

```json
{
	"gallery": { "en": { "title": "Gallery", "location": "tab/gallery.md" } },
	"publications": { "en": { "title": "Publications", "location": "tab/publications.md" } },
	"About": {
		"en": { "title": "About", "location": "tab/about/en.md" },
		"zh": { "title": "关于", "location": "tab/about/zh.md" }
	}
}
```

注意：

- URL のスラグ（例 `?tab=about`）は基底タイトルから生成され、言語を跨いで安定します。
- ブラウザ/SEO のタイトルは `tabs.json` の `title` を使用。


## サイト設定：`site.json`

```json
{
	"siteTitle": { "default": "deemoe's journal", "zh": "deemoe 的日志", "ja": "deemoe のジャーナル" },
	"siteSubtitle": { "default": "Thanks for playing my game.", "zh": "眼见何事..." },
	"siteDescription": { "default": "deemoe's journal" },
	"resourceURL": "https://dee.moe/wwwroot/",
	"siteKeywords": { "default": "static blog, markdown, github pages, blog" },
	"avatar": "assets/avatar.png",
	"profileLinks": [ { "label": "GitHub", "href": "https://github.com/you" } ],
	"contentOutdatedDays": 180,
	"themeMode": "user",
	"themePack": "minimalism",
	"themeOverride": true,
	"cardCoverFallback": false,
	"reportIssueURL": "https://github.com/<owner>/<repo>/issues/new"
}
```

パラメータ：

- `siteTitle` — 文字列または言語別オブジェクト。サイトカード、フッター、SEO に使用。
- `siteSubtitle` — 任意。サイトカードに表示。
- `siteDescription` — ページ個別の説明が無いときのデフォルト説明。
- `resourceURL` — リソースの絶対 URL を組み立てるベース（OG 画像など）。末尾 `/` 推奨。
- `siteKeywords` — SEO ジェネレーター向け初期キーワード。実行時のキーワードは記事タグに由来。
- `avatar` — サイトのアバター。記事に画像が無い場合のデフォルトのソーシャル画像。
- `profileLinks` — `{ label, href }` の配列。サイトカードに表示。
- `contentOutdatedDays` — 記事 `date` がこの日数より古い場合、記事上部に「情報が古い可能性」通知を表示（閉じることが可能）。
- `themeMode` — "dark" | "light" | "auto" | "user"。`themeOverride` が true の時に強制。
- `themePack` — `assets/themes/packs.json` の値（`native`、`github`、`apple`、`openai`、`minimalism` など）。
- `themeOverride` — true（デフォルト）でサイト側のテーマ設定をユーザー設定より優先。false なら既定値としてのみ適用。
- `cardCoverFallback` — true（または未設定の既定）なら、一覧カードで画像が無いときに色付き頭文字を表示。`false` で非表示。
- `reportIssueURL` — 任意。エラーカードで「問題を報告」ボタンを有効化（GitHub Issue など）。


## テーマとツール

- サイドバー（ツール）にテーマ切替とテーマパック選択があります。パックは `assets/themes/packs.json`、CSS は `assets/themes/<pack>/theme.css`。
- サイト側は `site.json` で既定値を設定可能。`themeOverride` が `false` の場合、ユーザーは UI から自由に切替可能。
- 言語セレクターは、統合/簡易形式のインデックスから利用可能なコンテンツ言語を反映します。


## 検索・タグ・ページング

- 検索はタイトルとタグにマッチ。サイドバーの検索入力で Enter。
- タグサイドバーはインデックスから集計。クリックでフィルタリング。
- 一覧は自動ページング（1 ページ 8 件）。`posts`/`search` で `?page=N`。


## 画像と動画

画像：

- 標準的な Markdown：`![Alt](relative/or/absolute.png "任意のタイトル")`。
- レイジーロード・スケルトン・アスペクト比保持でレイアウトを安定。

動画（拡張子で自動判定して image 記法を動画に変換）：

```markdown
![デモ動画](post/demo.mov "poster=post/frame.jpg | formats=mp4,webm")
```

タイトルの補助パラメータ（任意）：

- `poster=...` — ポスター画像を指定。未指定なら自動でフレームを取得して生成を試みます。
- `sources=a.mp4,b.webm` — 追加の明示的ソース。
- `formats=mp4,webm` — 同名ベースから別拡張子のソースを自動生成。


## サイト内リンクカード（プレビュー）

段落内が `?id=...` のリンクのみで構成されている場合、そのリンクはカバー・抜粋・日付・読了時間を含むカードに自動変換されます。行内でも強制的にカード化したい場合、`title` に `card` を含めるか `data-card` を付与：

```markdown
[ガイドを読む](?id=post/meet-nanosite/doc_ja.md "card")
```


## SEO（内蔵）

各ページでメタ（タイトル、説明、OG、Twitter）を動的に更新し、構造化データ（JSON-LD）を挿入します。参照順：

1) Markdown の Front Matter（`title`、`excerpt`、`tags`、`date`、`image`）
2) `index.json` のメタデータ
3) 自動フォールバック（H1/最初の段落）と自動生成のフォールバック画像

また、`index_seo.html` を開くと、`sitemap.xml`・`robots.txt`・`<head>` 初期タグを `site.json` に基づいて生成できます。

ヒント：画像を CDN で配信する場合は、`site.json` の `resourceURL` を設定してください。


## 多言語

- UI 文言は `assets/js/i18n.js` にあります（英語/中国語/日本語入り）。`translations` と `languageNames` を拡張して追加可能。
- コンテンツは以下をサポート：
	- 簡易形式（本リポジトリの形）：言語ごとのパス
	- 統合形式：言語ごとの `{title, location}`
	- レガシー：`index.en.json`、`index.zh.json` など（フォールバック）
- 言語切替時、該当記事の言語版があれば同一記事に留まるようにエイリアスします。


## デプロイ

GitHub Pages：

1) リポジトリを push
2) Settings → Pages → Branch: `main`, Path: `/ (root)`
3) カスタムドメインは `CNAME` を設定して DNS を構成

ローカルプレビュー（ビルド不要）：

```bash
python3 -m http.server 8000
# http://localhost:8000/ を開く
```


## トラブルシューティング

- 画面が空白？ JSON を確認（末尾カンマ禁止、ダブルクォート使用）。
- `index.json`/`tabs.json` のパスは `wwwroot/` からの相対で記述。
- ブラウザによっては `file://` での読み込みがブロックされます。ローカルサーバーを使ってください。
- 記事が見つからない？ `wwwroot/index.json` に `location` が登録されているか確認。


## レシピ集

- 記事をすばやく追加（簡易形式）：

	1) `wwwroot/post/new.md` を作成（Front Matter あり）
	2) `wwwroot/index.json` に追記：

	```json
	{ "新しい記事": { "ja": "post/new.md" } }
	```

- タブを追加：

	1) `wwwroot/tab/about.md` を作成
	2) `wwwroot/tabs.json` に追記：

	```json
	{ "概要": { "ja": { "title": "概要", "location": "tab/about.md" } } }
	```

- サイト全体でテーマを固定：

	```json
	{ "themeMode": "dark", "themePack": "apple", "themeOverride": true }
	```

楽しい執筆を。
