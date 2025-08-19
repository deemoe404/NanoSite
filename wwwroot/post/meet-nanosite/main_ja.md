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

1) **[GitHub](https://github.com/deemoe404/NanoSite/) からプロジェクトを入手**: フォークするか、ZIP をダウンロードして解凍。
2) **ローカルでプレビュー**（推奨）
   - プロジェクトフォルダで簡易サーバーを起動:
     - macOS/Linux: `python3 -m http.server 8000`
     - Windows（PowerShell）: `py -m http.server 8000`
   - ブラウザで `http://localhost:8000/` を開く。
3) **サイト名とリンクを設定**
   - ルートの `site.json` を開き、基本設定を編集:
   ```json
   {
     "siteTitle": "My Site",        // サイトのタイトル
     "siteSubtitle": "Welcome!",    // サイトのサブタイトル
     "avatar": "assets/avatar.png", // サイトのアバター画像パス
     "profileLinks": [
       { "label": GitHub/Twitter/…, "href": プロフィールの URL }
     ]
   }
   ```
4) **書き始めましょう！**
   - `wwwroot/` 配下に Markdown ファイルを作成（例: `wwwroot/my-first-post.md`）:
   ```markdown
   # はじめての投稿

   こんにちは！これが最初の投稿です。本文、リスト、画像の追加などができます。
   ```
   - ホームに表示されるよう `wwwroot/index.json` に登録:
   ```json
   {
     "はじめての投稿": {
       "location": "my-first-post.md", // Markdown ファイルへのパス
       "tag": ["メモ"],                 // 投稿のタグ
       "date": "2025-08-13"            // 公開日
     }
   }
   ```

🎉 おめでとうございます！NanoSite のセットアップが完了しました。ページを再読み込みすると、ホームに投稿カードが表示されます。クリックすると読めます。さらにカスタマイズする場合は[ドキュメント](?id=post/meet-nanosite/doc_ja.md)をご覧ください。
