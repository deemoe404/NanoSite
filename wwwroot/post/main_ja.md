---
title: NanoSite のご紹介
date: 2025-08-17
tags:
  - NanoSite
  - 技術
image: hero.jpeg
excerpt: プレーンテキスト（Markdown）からシンプルな個人サイトを作成。ビルドツールもデータベースも不要—ファイルを編集して公開するだけ。ブログ、メモ、Wiki、日記、書籍の各章に最適です。
author: deemoe
---

![hero](hero.jpeg)

ソースコード: [GitHub の NanoSite](https://github.com/deemoe404/NanoSite)

## 主な特長

- **Markdown** で執筆
- **GitHub Pages** で動作（無料ホスティング）
- 検索、タグ、読了目安、ダークモード、テーマパック
- 任意のタブ（About、Projects など）
- UI と記事の多言語化（任意）
- コピー可能なアンカー付き自動目次
- 大規模な一覧や検索に対応したページネーション内蔵

## 5分でクイックスタート

> ⚠️ 注意: `JSON` はコメントをサポートしません。以下のコード例のコメントは説明用です。実際のファイルでは削除してください。

1) [リポジトリページ](https://github.com/deemoe404/NanoSite)にアクセスします。  
2) 右上の緑色の **Use this template** ボタンをクリックします。  
3) **Create a new repository** を選択し、好きな名前を付けてください。  
4) 新しいリポジトリをローカルに取得します  
  - オプション1: Gitを使ってリポジトリをクローンする  
    - `git clone https://github.com/your-username/your-repo.git`
  - オプション2: ZIPファイルをダウンロードする  
    - 緑色の **Code** ボタンをクリックし、**Download ZIP** を選択します。
  - オプション3: GitHub Desktopを使う  
    - GitHub Desktop がインストールされている場合は、リポジトリページから 「Open with GitHub Desktop」 を使用できます。
5) **ローカルでプレビュー**（推奨）
   - プロジェクトフォルダで簡易サーバーを起動:
     - macOS/Linux: `python3 -m http.server 8000`
     - Windows（PowerShell）: `py -m http.server 8000`
   - ブラウザで `http://localhost:8000/` を開く。
6) **サイト名とリンクを設定**
   - ルートの `site.json` を開き、基本設定を編集:
   ```json
   {
     "siteTitle":    "My Site",           // サイトのタイトル
     "siteSubtitle": "Welcome!",          // サイトのサブタイトル
     "avatar":       "assets/avatar.png", // サイトのアバター画像パス
     "profileLinks": [                    // 個人リンク（任意のラベルに対応）
       { "label": "GitHub",   "href": "https://github.com/your-username" },
       { "label": "Twitter",  "href": "https://twitter.com/your-username" },
       { "label": "LinkedIn", "href": "https://www.linkedin.com/in/your-profile" },
       // ... その他の個人リンク
     ]
   }
   ```
7) **書き始めましょう！**
   - `wwwroot/` 配下に Markdown ファイルを作成（例: `wwwroot/my-first-post.md`）:
   ```markdown
  ---
  title: はじめての投稿
  date: 2025-08-17
  tags:
    - メモ
    - 技術
  ---
   # はじめての投稿

   こんにちは！これが最初の投稿です。本文、リスト、画像の追加などができます。
   ```
   - ホームに表示されるよう `wwwroot/index.json` に登録:
   ```json
   {
     "はじめての投稿": {
       "ja": "my-first-post.md"
     },
     "xxxx": {
       "ja": "xxxx.md"
     },
     // ... その他の記事は必要に応じて登録
   }
   ```

🎉 おめでとうございます！NanoSite のセットアップが完了しました。ページを再読み込みすると、ホームに投稿カードが表示されます。クリックすると読めます。

## 次のステップ

- さらにカスタマイズ: [ドキュメント](?id=post/doc_ja.md) を参照。
- デプロイ: [GitHub Pages へのデプロイ](?id=post/githubpages_ja.md) を参照。
- SEO 対応: [SEO 最適化](?id=post/seo_ja.md) を参照。
