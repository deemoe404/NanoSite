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
  en: NanoSite
  chs: 微站
  cht-tw: 微站
  cht-hk: 微站
  ja: ナノサイト
siteSubtitle:
  default: Just Markdown. Just a website.
  en: Just Markdown. Just a website.
  chs: 写下 Markdown，就是你的网站。
  cht-tw: 寫下 Markdown，就是你的網站。
  cht-hk: 寫低 Markdown，就係你嘅網站。
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
  chs: post/page/githubpages_chs.md # 中国語版は wwwroot/post/page/githubpages_chs.md にあります
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
  chs:
    title: 关于
    location: tab/about/chs.md # 中国語版は wwwroot/tab/about/chs.md にあります
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
- `defaultLanguage` — 既定の UI/コンテンツ言語（例：`en`、`chs`、`cht-tw`、`cht-hk`、`ja`。既定は `en`）。

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
- `?lang=chs` — UI 言語の設定。localStorage に保存され、コンテンツは同じ言語のバリアントを試してから設定済みのフォールバック順に従います。

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
  en: NanoSite - Just Markdown. Just a website.
  chs: 微站 - 写下 Markdown，就是你的网站。
  cht-tw: 微站 - 寫下 Markdown，就是你的網站。
  cht-hk: 微站 - 寫低 Markdown，就係你嘅網站。
  ja: ナノサイト - 書くだけ、Markdown。それがサイトになる。
siteKeywords:
  default: static blog, markdown, github pages, blog
  en: static blog, markdown, github pages, blog
  chs: 静态博客, Markdown, GitHub Pages, 博客
  cht-tw: 靜態部落格, Markdown, GitHub Pages, 部落格
  cht-hk: 靜態網誌, Markdown, GitHub Pages, 網誌
  ja: 静的サイト, Markdown, GitHub Pages, ブログ
```

補足：
- `resourceURL` — 画像/動画などのリソースが正しく解決されるようにするためのベース URL。実サイトの `wwwroot/` に合わせて設定します。
- `siteDescription` — SEO やソーシャル共有用のサイト説明。
- `siteKeywords` — SEO 用のキーワード。

あわせて `index_seo.html` を開き、`sitemap.xml` と `robots.txt` をサイトルート（`index.html` と同じ階層）に生成し、`site.yaml` に基づく初期の `<head>` タグを `index.html` に反映してください。

### 多言語

NanoSite では、サイト UI の言語とコンテンツの言語を関連しているが別々のものとして扱います。

- サポートされる UI 言語は `assets/i18n/languages.json` と `assets/i18n/` 内の言語バンドルで決まります。エディターは、プロジェクトがサポートするすべての言語を表示できます。
- コンテンツ言語は、投稿またはページごとに `wwwroot/index.yaml` と `wwwroot/tabs.yaml` で宣言します。作者は、実際に書いた言語バリアントだけを列挙すれば十分です。
- URL に `?lang=...` がある場合、言語バンドルが存在すれば、ナビゲーションやボタンなどのサイト UI はその言語に切り替わります。
- 各投稿またはページでは、NanoSite はまず現在の UI 言語と一致するコンテンツを探します。存在しない場合は `site.yaml` の `defaultLanguage` にフォールバックします。このリポジトリでは既定値は `en` です。
- 設定された既定言語も存在しない場合は、`en`、`default`、最後にその項目で最初に利用可能なバリアントを試し、ページが完全に空にならないようにします。

コンテンツ形式：

  - 簡易（本リポジトリの形）：言語ごとに Markdown のパスを指定
  - 統合：言語ごとに `{title, location}`
  - 旧来：`index.en.yaml`/`index.en.json`、`index.chs.yaml`/`index.chs.json` ...（フォールバック）

言語を切り替えると、該当するバリアントがある場合は同じ記事に留まります。ない場合は、上記のルールで既定言語のコンテンツを表示します。
