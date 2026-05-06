---
title: Press指南
date: 2025-08-23
version: v2.1.0
tags:
  - Press
  - 文件
excerpt: 唔需要建置步驟，就可以直接用 Markdown 檔案建立內容網站；只要將檔案放入 wwwroot/，喺 YAML 入面列出再發布，就可以兼容 GitHub Pages。本指南涵蓋專案結構、設定、內容載入、主題、搜尋、標籤、SEO、媒體同部署。
author: Ekily
ai: true
---

## 檔案概覽
開始使用 Press 前，可以先認識幾個核心檔案同資料夾：

- `site.yaml` — 設定網站標題、副標題、預設語言、社交連結等基本資訊。
- `wwwroot/` — 放置所有內容同資料。
  - `wwwroot/index.yaml` — 文章索引，例如教學、更新記錄或者閱讀筆記。
  - `wwwroot/tabs.yaml` — 靜態頁面索引，例如關於、歷史、法律頁面。

> 你可以由 [v2.1.0/site.yaml](https://github.com/EkilyHQ/Press/blob/v2.1.0/site.yaml) 取得 v2.1.0 嘅預設設定。

## 網站基本設定
喺 `site.yaml` 入面設定網站基本資訊：

```yaml
siteTitle:
  default: Press
  en: Press
  chs: Press
  cht-tw: Press
  cht-hk: Press
  ja: Press
siteSubtitle:
  default: Where knowledge becomes pages.
  en: Where knowledge becomes pages.
  chs: Where knowledge becomes pages.
  cht-tw: Where knowledge becomes pages.
  cht-hk: Where knowledge becomes pages.
  ja: Where knowledge becomes pages.
avatar: assets/avatar.png
defaultLanguage: en
```

- `siteTitle` / `siteSubtitle` — 網站標題同副標題，可以按語言提供唔同版本。
- `avatar` — 網站頭像或者標誌。
- `defaultLanguage` — 預設 UI/內容語言。本倉庫目前係 `en`。

## 個人資料同社交連結
`profileLinks` 會顯示喺網站卡片上：

```yaml
profileLinks:
  - label: GitHub
    href: https://github.com/EkilyHQ/Press
  - label: Demo
    href: https://ekilyhq.github.io/Press/
```

`label` 只係顯示文字，可以用任何名稱。

## 文章寫作
Press 預設由 `wwwroot/index.yaml` 讀取文章列表。簡化格式如下：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  chs: post/page/githubpages_chs.md
  ja: post/page/githubpages_ja.md
```

每篇 Markdown 可以喺檔案開頭加入 Front Matter：

```markdown
---
title: 為 Press 設定 GitHub Pages
date: 2025-08-21
tags:
  - Press
  - 技術
  - GitHub Pages
image: page.jpeg
excerpt: 你可以將 Press 免費託管喺 GitHub Pages 上。
author: Ekily
ai: true
---
```

常用欄位：

- `title` — 文章標題。
- `date` — 發布日期。
- `tags` — 文章標籤，可以有多個。
- `excerpt` — 摘要，用於文章卡片同 SEO。
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
    title: 关于Press
    location: tab/about/chs.md
  cht-tw:
    title: 關於Press
    location: tab/about/cht-tw.md
  cht-hk:
    title: 關於Press
    location: tab/about/cht-hk.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

頁面 Markdown 可以省略 Front Matter。

## 圖片同影片
Markdown 入面嘅圖片同影片路徑會相對於目前 Markdown 檔案解析：

```markdown
![page](page.jpeg)
```

如果文章位於 `wwwroot/post/page/githubpages_chs.md`，圖片應該放喺 `wwwroot/post/page/page.jpeg`。影片檔案都使用同一套規則，Press 會自動辨識同渲染。

## 站內連結卡片
當一個段落只包含指向文章嘅連結時，Press 會將佢升級成有封面、摘要、日期同閱讀時間嘅卡片：

```markdown
[為 Press 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md)
```

若要喺行內強制使用卡片，可以喺連結 title 入面加入 `card`：

```markdown
呢度係一張 [為 Press 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md "card") 行內卡片。
```

## 路由工作方式
前端路由讀取 URL 查詢參數：

- `?tab=posts` — 全部文章，支援 `&page=N` 分頁。
- `?tab=search&q=關鍵字` — 按標題或者標籤搜尋，亦可以用 `&tag=標籤名` 篩選。
- `?id=path/to/post.md` — 開啟指定文章，該路徑必須存在於 `index.yaml`。
- `?lang=cht-hk` — UI 語言偏好，會儲存在 localStorage；內容會先嘗試匹配該語言，再按回退鏈選擇可用版本。

## 多語言
Press 將網站本體語言同內容語言視為相關但獨立嘅兩層。

- 網站本體支援嘅 UI 語言來自 `assets/i18n/languages.json` 同 `assets/i18n/` 入面對應嘅語言包。文章編輯器可以顯示專案支援嘅全部語言。
- 內容語言由每篇文章或者頁面喺 `wwwroot/index.yaml` 同 `wwwroot/tabs.yaml` 入面分別宣告。作者只需要列出實際撰寫嘅語言版本。
- 當 URL 設定 `?lang=...` 時，網站導覽、按鈕、提示等本體文案會切換到對應 UI 語言，前提係語言包存在。
- 對每篇文章或者頁面，Press 會先嘗試載入同目前 UI 語言相同嘅內容版本。若該版本不存在，就回退到 `site.yaml` 入面嘅 `defaultLanguage`；本倉庫預設係 `en`。
- 如果設定嘅預設語言版本都不存在，Press 會繼續嘗試 `en`、`default`，最後使用該項目下第一個可用版本，避免頁面完全無法渲染。

內容索引支援三種形式：

- 簡化版：按語言直接提供 Markdown 路徑。
- 統一版：每種語言使用 `{title, location}`。
- 舊版：`index.en.yaml`、`index.chs.yaml` 等分語言檔案。

## SEO
Press 會喺執行時按目前頁面更新 meta、Open Graph、Twitter Card 同 JSON-LD。資料來源優先順序：

1. Markdown Front Matter。
2. `index.yaml` 入面嘅 metadata。
3. 自動回退，例如 H1、首段文字或者產生嘅社交圖片。

可喺 `site.yaml` 入面提供多語言 SEO 文字：

```yaml
siteDescription:
  default: Press - Where knowledge becomes pages.
  en: Press - Where knowledge becomes pages.
  chs: Press - Where knowledge becomes pages.
  cht-tw: Press - Where knowledge becomes pages.
  cht-hk: Press - Where knowledge becomes pages.
  ja: Press - Where knowledge becomes pages.
siteKeywords:
  default: static blog, markdown, github pages, blog
  en: static blog, markdown, github pages, blog
  chs: 静态博客, Markdown, GitHub Pages, 博客
  cht-tw: 靜態部落格, Markdown, GitHub Pages, 部落格
  cht-hk: 靜態網誌, Markdown, GitHub Pages, 網誌
  ja: 静的サイト, Markdown, GitHub Pages, ブログ
```

## 常見問題
- Q：網站打開後係空白？
  - A：先檢查 YAML 縮排、冒號同列表/物件結構。
  - A：確認 `index.yaml` / `tabs.yaml` 嘅路徑係相對於 `wwwroot/`。
  - A：請透過本機或者正式伺服器預覽，唔好直接雙擊 `index.html`。
- Q：文章寫好但冇出現喺列表？
  - A：確認文章路徑已加入 `wwwroot/index.yaml`，再強制重新整理瀏覽器快取。
