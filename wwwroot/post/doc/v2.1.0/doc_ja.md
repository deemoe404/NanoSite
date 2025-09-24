---
title: NanoSite ドキュメント
date: 2025-08-23
version: v2.1.0
tags:
	- NanoSite
	- ドキュメント
excerpt: Markdown ファイルだけでコンテンツサイトを構築できます。ビルド工程は不要で、wwwroot/ に置いて YAML に列挙して公開するだけ（GitHub Pages に対応）。本ガイドは、プロジェクト構造、設定ファイル、コンテンツの読み込み、テーマ、検索、タグ、SEO、メディア、デプロイ方法を解説します。
author: deemoe
ai: true
---

## ファイル概要
NanoSite を使い始める前に、サイト構成の中核となるファイル/フォルダを把握しておくと便利です。

- `site.yaml` — サイトの基本情報（サイトタイトルやプロフィールリンクなど）を設定します。
- `wwwroot/` — すべてのコンテンツとデータを格納します：
  - `wwwroot/index.yaml` — 記事のインデックス（例：「旅行記 — モルディブ」「読書ノート：星の王子さま」など）。
  - `wwwroot/tabs.yaml` — 固定ページのインデックス（例：「About」「法的表示」など）。

> v2.1.0 のデフォルト設定ファイルは [v2.1.0/site.yaml](https://github.com/deemoe404/NanoSite/blob/v2.1.0/site.yaml) から取得できます。


## サイト基本情報
`site.yaml` で以下を設定します：

- `siteTitle` / `siteSubtitle` — サイトのタイトルとサブタイトル。
- `avatar` — サイトのロゴ。

例：

```yaml
# サイト基本情報
siteTitle:
  default: NanoSite
  zh: 微站
  ja: ナノサイト
siteSubtitle:
  default: Just Markdown. Just a website.
  zh: 写下 Markdown，就是你的网站。
  ja: 書くだけ、Markdown。それがサイトになる。
avatar: assets/avatar.jpeg
```


## プロフィール／ソーシャルリンク
サイトカードに連絡先やソーシャルリンクを表示できます。`site.yaml` に `profileLinks` を追加します：

```yaml
# ソーシャルリンク
profileLinks:
  - label: GitHub
    href: https://github.com/deemoe404/NanoSite
  - label: Demo
    href: https://nano.dee.moe/
```

> `label` は表示用テキストです。任意の文字列を使えます（固定のサービス名に限定されません）。


## 記事の作成
NanoSite は既定で `wwwroot/` をワークディレクトリとして使用し、`wwwroot/index.yaml` を読んで記事一覧を取得します。例として「NanoSite を GitHub Pages で公開する設定」は `wwwroot/index.yaml` に以下のように登録します：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  zh: post/page/githubpages_zh.md # 中国語版は wwwroot/post/page/githubpages_zh.md にあります
  ja: post/page/githubpages_ja.md
```

`wwwroot/index.yaml` に記事パスを記載するほか、各 Markdown の先頭に Front Matter を入れてメタデータを提供します。`wwwroot/post/page/githubpages_ja.md` の例：

```markdown
---
title: NanoSite を GitHub Pages で公開する設定
date: 2025-08-21
tags:
  - NanoSite
  - 技術
  - GitHub Pages
image: page.jpeg
excerpt: NanoSite は GitHub Pages に無料でホスティングできます。本稿は自足的なリファレンスですが、最新かつ正確な情報は GitHub 公式ドキュメントを参照してください。
author: deemoe
ai: true
---

... 以下省略
```

主な項目：

- `title` — 記事タイトル。
- `date` — 公開日。
- `tags` — タグ（複数可）。
- `excerpt` — カードや meta 用の要約。
- `image` — カバー画像のパス（Markdown ファイルからの相対）。
- `author` — 著者名。
- `ai` — 生成系 AI（特に LLM）の関与有無。

> Front Matter の全項目は任意です。不要なら省略して構いません。

## ページの作成
記事の作成と同様に、固定ページは `wwwroot/tabs.yaml` で管理します。例えば About ページは次のように設定します：

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  zh:
    title: 关于
    location: tab/about/zh.md # 中国語版は wwwroot/tab/about/zh.md にあります
  ja:
    title: 概要
    location: tab/about/ja.md
```

ページの Markdown は Front Matter を省略しても構いません。


## 画像と動画
Markdown 中の画像・動画をサポートします。パスはその Markdown ファイルからの相対で解決されます。前述の GitHub Pages 設定記事では、本文冒頭に次の画像を挿入しています：

```markdown
![page](page.jpeg)
```

記事のパスが `wwwroot/post/page/githubpages_ja.md` の場合、画像は `wwwroot/post/page/page.jpeg` に置きます。動画も同様で、パスが正しければ NanoSite が動画として扱います。

## サイト内リンクカード（プレビュー）

段落全体が記事へのリンク（`?id=...`）だけで構成される場合、そのリンクはカバー画像・抜粋・日付・読了時間を含むカードに自動的に拡張されます。

```markdown
... ここまでの内容は省略

[NanoSite を GitHub Pages で公開する設定](?id=post%2Fpage%2Fgithubpages_ja.md)

... ここから先の内容は省略
```

行内でも強制的にカード表示したい場合は、リンクの `title` に `card` を含めるか、`data-card` を追加します：

```markdown
... ここまでの内容は省略

これは行内カードです → [NanoSite を GitHub Pages で公開する設定](?id=post%2Fpage%2Fgithubpages_ja.md "card")

... ここから先の内容は省略
```

## よくある質問

- Q：サイトを開いたら真っ白です。
  - A：YAML（インデント、コロン、配列/マップ構造）を検証してください。
  - A：既定では `index.yaml`/`tabs.yaml` のパスは `wwwroot/` からの相対です。パスを確認してください。
  - A：`index.html` をダブルクリックではなく、ローカル/実サーバー経由でプレビューしてください。セキュリティ上の理由でローカルリソースの読み込みを禁止するブラウザがあります。
- Q：記事を書いたのに一覧に出ません。
  - A：`wwwroot/index.yaml` に該当記事の `location` が登録され、パスが正しいか確認してください。
  - A：ブラウザのキャッシュを強制更新してください（例：Shift を押しながら再読み込み）。

## 上級
さらに細かく調整したい場合のオプションです。

### その他の設定
`site.yaml` の追加オプション：

#### テーマ強制
既定では、テーマはユーザーの選択（ブラウザに保存）を尊重します。特定のテーマ（およびバリアント）を強制することもできます。
- `themeMode` — `user`、`dark`、`light`、`default` など。
- `themePack` — `minimalism`、`github` など。
- `themeOverride` — テーマを強制するか（既定 `false`）。

例：
```yaml
themeMode: user
themePack: minimalism
themeOverride: true
```

#### エラーレポート設定
- `reportIssueURL` — 事前入力された Issue へのリンクを有効化（例：GitHub の新規 Issue）。
- `errorOverlay` — エラー発生時にページ上へオーバーレイ表示（既定 `false`）。
- `assetWarnings` — アセットに関する警告。
  - `largeImage` — 大きな画像に関する警告。
    - `enabled` — 警告を有効化（既定 `false`）。
    - `thresholdKB` — KB 単位の閾値（既定 `500KB`）。

例：
```yaml
reportIssueURL: https://github.com/deemoe404/NanoSite/issues/new
errorOverlay: true
assetWarnings:
  largeImage:
    enabled: true
    thresholdKB: 500
```

#### そのほか
- `contentOutdatedDays` — この記事が古いとみなす日数（既定 180）。
- `cardCoverFallback` — カバー画像が無い場合に自動生成のプレースホルダーを使用（既定 `true`）。
- `pageSize` — 一覧の 1 ページあたり件数（既定 `8`）。
- `defaultLanguage` — 既定の UI/コンテンツ言語（例：`en`、`zh`、`ja`。既定は `en`）。

例：
```yaml
contentOutdatedDays: 180
cardCoverFallback: false
pageSize: 8
defaultLanguage: en
```

### ルーティングの仕組み

フロントエンドのルーターは URL のクエリを読み取ります：

- `?tab=posts` — すべての記事（既定）。`&page=N` でページング。
- `?tab=search&q=語句` — タイトル/タグで検索。`&tag=タグ名` でさらに絞り込み。
- `?id=path/to/post.md` — 個別記事を開く（パスは `index.yaml` に存在している必要があります）。
- `?lang=zh` — UI/コンテンツの言語。localStorage に保存し、ブラウザ設定と `<html lang>` にフォールバックします。

Markdown の例：`[この記事](?id=post/frogy/main.md)`、`[概要](?tab=about)`。

### SEO（内蔵）

ページごとに meta（タイトル、説明、Open Graph、Twitter Card）を動的に更新し、構造化データ（JSON-LD）を挿入します。参照順：

1) Markdown の Front Matter（`title`、`excerpt`、`tags`、`date`、`image`）
2) `index.yaml` のメタデータ
3) 自動フォールバック（H1/最初の段落）と自動生成のプレースホルダー画像

`index.yaml` の SEO 例：
```yaml
resourceURL: https://nano.dee.moe/wwwroot/
siteDescription:
  default: NanoSite - Just Markdown. Just a website.
  zh: 微站 - 写下 Markdown，就是你的网站。
  ja: ナノサイト - 書くだけ、Markdown。それがサイトになる。
siteKeywords:
  default: static blog, markdown, github pages, blog
```

補足：
- `resourceURL` — 画像/動画などのリソースが正しく解決されるようにするためのベース URL。実サイトの `wwwroot/` に合わせて設定します。
- `siteDescription` — SEO やソーシャル共有用のサイト説明。
- `siteKeywords` — SEO 用のキーワード。

あわせて `index_seo.html` を開き、`sitemap.xml` と `robots.txt` をサイトルート（`index.html` と同じ階層）に生成し、`site.yaml` に基づく初期の `<head>` タグを `index.html` に反映してください。

### 多言語

- UI 文言は `assets/js/i18n.js` にあります（英語/中国語/日本語を同梱）。`translations` と `languageNames` を拡張して追加可能です。
- コンテンツの多言語：
  - 簡易（本リポジトリの形）：言語ごとに Markdown のパスを指定
  - 統合：言語ごとに `{title, location}`
  - 旧来：`index.en.yaml`/`index.en.json`、`index.zh.yaml`/`index.zh.json` ...（フォールバック）
- 言語切替時、対象記事の言語版があれば同じ記事に留まるようにルーターが調整します。
