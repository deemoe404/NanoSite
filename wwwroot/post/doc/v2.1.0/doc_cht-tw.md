---
title: 微站指南
date: 2025-08-23
version: v2.1.0
tags:
  - 微站
  - 文件
excerpt: 不需要建置步驟，就能直接用 Markdown 檔案建立內容網站；只要把檔案放進 wwwroot/，在 YAML 中列出並發布，即可相容 GitHub Pages。本指南涵蓋專案結構、設定、內容載入、主題、搜尋、標籤、SEO、媒體與部署。
author: deemoe
ai: true
---

## 檔案概覽
開始使用 NanoSite 前，先理解幾個核心檔案與資料夾：

- `site.yaml` — 設定網站標題、副標題、預設語言、社群連結等基本資訊。
- `wwwroot/` — 放置所有內容與資料。
  - `wwwroot/index.yaml` — 文章索引，例如教學、更新記錄或閱讀筆記。
  - `wwwroot/tabs.yaml` — 靜態頁面索引，例如關於、歷史、法律頁面。

> 你可以從 [v2.1.0/site.yaml](https://github.com/deemoe404/NanoSite/blob/v2.1.0/site.yaml) 取得 v2.1.0 的預設設定。

## 網站基本設定
在 `site.yaml` 中設定網站基本資訊：

```yaml
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
defaultLanguage: en
```

- `siteTitle` / `siteSubtitle` — 網站標題與副標題，可依語言提供不同版本。
- `avatar` — 網站頭像或標誌。
- `defaultLanguage` — 預設 UI/內容語言。本倉庫目前設為 `en`。

## 個人資料與社群連結
`profileLinks` 會顯示在網站卡片上：

```yaml
profileLinks:
  - label: GitHub
    href: https://github.com/deemoe404/NanoSite
  - label: Demo
    href: https://nano.dee.moe/
```

`label` 只是顯示文字，可以使用任意名稱。

## 文章寫作
NanoSite 預設從 `wwwroot/index.yaml` 讀取文章列表。簡化格式如下：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  chs: post/page/githubpages_chs.md
  ja: post/page/githubpages_ja.md
```

每篇 Markdown 可以在檔案開頭加入 Front Matter：

```markdown
---
title: 為 NanoSite 設定 GitHub Pages
date: 2025-08-21
tags:
  - 微站
  - 技術
  - GitHub Pages
image: page.jpeg
excerpt: 你可以將 NanoSite 免費託管在 GitHub Pages 上。
author: deemoe
ai: true
---
```

常用欄位：

- `title` — 文章標題。
- `date` — 發布日期。
- `tags` — 文章標籤，可以有多個。
- `excerpt` — 摘要，用於文章卡片與 SEO。
- `image` — 封面圖片，路徑相對於目前 Markdown 檔案。
- `author` — 作者名稱。
- `ai` — 是否有生成式 AI 參與撰寫。

## 頁面寫作
靜態頁面由 `wwwroot/tabs.yaml` 管理：

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  chs:
    title: 关于微站
    location: tab/about/chs.md
  cht-tw:
    title: 關於微站
    location: tab/about/cht-tw.md
  cht-hk:
    title: 關於微站
    location: tab/about/cht-hk.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

頁面 Markdown 可以省略 Front Matter。

## 圖片與影片
Markdown 中的圖片與影片路徑會相對於目前 Markdown 檔案解析：

```markdown
![page](page.jpeg)
```

如果文章位於 `wwwroot/post/page/githubpages_chs.md`，圖片應放在 `wwwroot/post/page/page.jpeg`。影片檔案也使用相同規則，NanoSite 會自動辨識並渲染。

## 站內連結卡片
當一個段落只包含指向文章的連結時，NanoSite 會將它升級成含封面、摘要、日期與閱讀時間的卡片：

```markdown
[為 NanoSite 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md)
```

若要在行內強制使用卡片，可在連結 title 中加入 `card`：

```markdown
這是一張 [為 NanoSite 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md "card") 行內卡片。
```

## 路由工作方式
前端路由讀取 URL 查詢參數：

- `?tab=posts` — 全部文章，支援 `&page=N` 分頁。
- `?tab=search&q=關鍵字` — 依標題或標籤搜尋，也可用 `&tag=標籤名` 篩選。
- `?id=path/to/post.md` — 開啟指定文章，該路徑必須存在於 `index.yaml`。
- `?lang=cht-tw` — UI 語言偏好，會儲存在 localStorage；內容會先嘗試匹配該語言，再按回退鏈選擇可用版本。

## 多語言
NanoSite 將網站本體語言與內容語言視為相關但獨立的兩層。

- 網站本體支援的 UI 語言來自 `assets/i18n/languages.json` 與 `assets/i18n/` 中對應的語言包。文章編輯器可以顯示專案支援的全部語言。
- 內容語言由每篇文章或頁面在 `wwwroot/index.yaml` 與 `wwwroot/tabs.yaml` 中分別宣告。作者只需要列出實際撰寫的語言版本。
- 當 URL 中設定 `?lang=...` 時，網站導覽、按鈕、提示等本體文案會切換到對應 UI 語言，前提是語言包存在。
- 對每篇文章或頁面，NanoSite 會先嘗試載入與目前 UI 語言相同的內容版本。若該版本不存在，則回退到 `site.yaml` 中的 `defaultLanguage`；本倉庫預設是 `en`。
- 如果設定的預設語言版本也不存在，NanoSite 會繼續嘗試 `en`、`default`，最後使用該項目下第一個可用版本，以避免頁面完全無法渲染。

內容索引支援三種形式：

- 簡化版：按語言直接提供 Markdown 路徑。
- 統一版：每種語言使用 `{title, location}`。
- 舊版：`index.en.yaml`、`index.chs.yaml` 等分語言檔案。

## SEO
NanoSite 會在執行時依目前頁面更新 meta、Open Graph、Twitter Card 與 JSON-LD。資料來源優先順序：

1. Markdown Front Matter。
2. `index.yaml` 中的 metadata。
3. 自動回退，例如 H1、首段文字或產生的社群圖片。

可在 `site.yaml` 中提供多語言 SEO 文字：

```yaml
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

## 常見問題
- Q：網站打開後是空白？
  - A：先檢查 YAML 縮排、冒號與列表/物件結構。
  - A：確認 `index.yaml` / `tabs.yaml` 的路徑是相對於 `wwwroot/`。
  - A：請透過本機或正式伺服器預覽，不要直接雙擊 `index.html`。
- Q：文章寫好了但沒有出現在列表中？
  - A：確認文章路徑已加入 `wwwroot/index.yaml`，並強制重新整理瀏覽器快取。
