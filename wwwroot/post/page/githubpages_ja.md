---
title: NanoSite 用の GitHub Pages 設定
date: 2025-08-21
tags:
  - NanoSite
  - 技術
  - GitHub Pages
image: page.jpeg
excerpt: NanoSite は GitHub Pages に無料でホスティングできます。本ガイドは自己完結の参考情報ですが、最新で正確な情報は常に GitHub の公式ドキュメントを参照してください。
author: deemoe
ai: true
---

> [GitHub Pages](https://pages.github.com) は NanoSite の一部ではありません。ここにある情報が最新でない場合があります。問題がある場合は GitHub の公式ドキュメントを参照してください。

![page](page.jpeg)

## リポジトリで GitHub Pages を有効にする方法

GitHub Pages を有効にするには、以下の手順に従ってください。

1. GitHub でリポジトリを開きます。
2. **Settings（設定）** をクリックします。
3. サイドバーの **Pages** セクションに移動します。
4. **Source** で公開したいブランチ（通常は `main` または `master`）を選択します。
5. （任意）`/root` や `/docs` などのフォルダを選択します。
6. **Save** をクリックします。
7. 数十秒後、サイトが公開されます。URL は Pages セクションに表示されます。

- 誰でもアクセスできるようにするには、リポジトリを公開にしてください。
- カスタムドメインは同じセクションで設定できます。

## カスタムドメインの設定

1. リポジトリ設定の **Pages** セクションで、**Custom domain** にドメイン名（例: `www.example.com`）を入力します。
2. **Save** をクリックします。
3. 案内に従って DNS を設定します。通常は `your-username.github.io` を指す CNAME レコードを追加します。
4. DNS が伝播すると、カスタムドメインでサイトにアクセスできるようになります。

## APEX ドメインの設定

1. DNS 設定で、APEX ドメイン（例: `example.com`）の A レコードを GitHub の IP に向けます:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. リポジトリ設定の **Pages** セクションで、**Custom domain** に APEX ドメイン（例: `example.com`）を入力します。
3. **Save** をクリックします。
4. 数分後、APEX ドメインでサイトにアクセスできるようになります。
