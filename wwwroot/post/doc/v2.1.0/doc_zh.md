---
title: 微站指南
date: 2025-08-23
version: v2.1.0
tags:
	- 微站
	- 文档
excerpt: 无需构建步骤即可直接用 Markdown 文件创建内容网站，只需将文件放入 wwwroot/，在 YAML 中列出并发布，即可兼容 GitHub Pages。本指南涵盖项目结构、配置文件、内容加载、主题、搜索、标签、SEO、媒体以及部署方法。
author: deemoe
ai: true
---

## 文件概览
在开始使用 **NanoSite** 之前，理解网站结构中的核心文件十分重要：

- `site.yaml` — 您将在这里设置网站的基本信息，例如**站点标题**或您的**个人资料链接**。
- `wwwroot/` — 包含所有内容和数据的文件夹：
  - `wwwroot/index.yaml` — 所有**文章**的索引，例如“旅行日志 - 马尔代夫”、“读书笔记：小王子”等。
  - `wwwroot/tabs.yaml` — 所有**页面**的索引，例如“关于本站”、“法律声明”等。

> 您始终可以从 [v2.1.0/site.yaml](https://github.com/deemoe404/NanoSite/blob/v2.1.0/site.yaml) 获取到 v2.1.0 版本的**默认**设置文件。


## 网站基本信息设置
在 `site.yaml` 中，您可以设置以下基本信息：

- `siteTitle` 与 `siteSubtitle` — 网站的标题与副标题。
- `avatar` — 网站的 LOGO。

例如，本站的 `site.yaml` 配置如下：

```yaml
# 网站基本信息设置
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


## 联系方式与社交媒体展示
NanoSite 允许您在站点卡片上展示您的联系方式或者社交媒体链接。您可以在 `site.yaml` 中添加 `profileLinks` 字段来实现这一点，例如：

```yaml
# 社交媒体链接
profileLinks:
  - label: GitHub
    href: https://github.com/deemoe404/NanoSite
  - label: Demo
    href: https://nano.dee.moe/
```

> `label` 选项仅用于显示文本，因此可以是任意值——而非固定的社交媒体名称。


## 文章写作
NanoSite 默认将 `wwwroot/` 文件夹作为工作路径。它通过读取这个文件夹下的 `index.yaml` 文件来获取文章列表。例如 [为 NanoSite 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_zh.md&lang=zh) 这篇文章对应的 `wwwroot/index.yaml` 内容如下：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  zh: post/page/githubpages_zh.md # 文章的中文版本位于 wwwroot/post/page/githubpages_zh.md
  ja: post/page/githubpages_ja.md
```

除了在 `wwwroot/index.yaml` 中指定文章的 Markdown 文件路径外，您还需要在每篇 Markdown 文件的开头添加前言区（Front Matter）来提供文章的元数据。以下是 `wwwroot/post/page/githubpages_zh.md` 的文件节选：

```markdown
---
title: 为 NanoSite 配置 GitHub Pages
date: 2025-08-21
tags:
  - 微站
  - 技术
  - GitHub Pages
image: page.jpeg
excerpt: 你可以将 NanoSite 免费托管在 GitHub Pages 上。本文作为一份自包含的参考，但仍请以 GitHub 官方文档为准以获取最准确的信息。
author: deemoe
ai: true
---

... 此后内容省略
```

其中的关键词含义如下：

- `title` — 文章标题。
- `date` — 文章发布日期。
- `tags` — 文章标签，可多选（参见上文示例）。
- `excerpt` — 文章摘要。
- `image` — 文章封面图片路径（相对于该 Markdown 文件本身）。
- `author` — 文章作者。
- `ai` — 声明该文章的创作过程是否有生成式 AI（此处特指 LLMs）的参与。

> 前言区的所有参数都是可选的；若您不愿意提供某个参数，可直接将其留空或删除该行。

## 页面写作
与 [文章写作](#45) 类似，NanoSite 通过读取 `wwwroot/` 文件夹内的 `tabs.yaml` 文件来获取页面列表。例如 [关于](?tab=about&lang=zh) 页面的对应的 `wwwroot/tabs.yaml` 内容如下：

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  zh:
    title: 关于
    location: tab/about/zh.md # 页面的中文版本位于 wwwroot/tab/about/zh.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

与文章不同，页面对应的 Markdown 文件可以不包含前言区。


## 图片与视频
NanoSite 支持在 Markdown 中插入图片和视频。所有 Markdown 文件中的图片和视频都会以该文件的相对路径进行引用。例如在 [为 NanoSite 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_zh.md&lang=zh) 这篇文章中，其于内容开头处插入了一张图片：

```markdown
![page](page.jpeg)
```

且其文章路径为 `wwwroot/post/page/githubpages_zh.md`，那么 `page.jpeg` 的存放位置则应为 `wwwroot/post/page/page.jpeg`。视频文件与图片文件的引用方式相同，只需确保路径正确即可，NanoSite 会自动识别出视频文件并进行处理。

## 站内链接卡片（预览）

当某段落只包含一个指向文章的链接（如 `?id=...`）时，该链接会被升级为带封面、摘要、日期、阅读时长的卡片（就像您在文章列表中看到的那样）。

```markdown
... 此前内容省略

[为 NanoSite 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_zh.md)

... 此后内容省略
```

若要在行内强制显示为卡片，可在 `title` 中包含 `card` 或添加 `data-card`：

```markdown
... 此前内容省略

这是一张 [为 NanoSite 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_zh.md "card") 行内卡片。

... 此后内容省略
```

## 常见问题

- Q：网站打开后完全空白？
  - A：请校验 YAML（缩进、冒号、列表/键值结构）。
  - A：默认情况下，`index.yaml`/`tabs.yaml` 中的路径需相对 `wwwroot/`。请检查路径。
  - A：请确认您通过一个模拟服务器或真实服务器进行网站预览（而非直接双击 `index.html` 打开），因为某些浏览器出于安全考虑默认禁止本地网页加载资源。
- Q：文章已编写但未在网站中列出
  - A：请确认文章的 `location` 已写入 `wwwroot/index.yaml`，并且路径正确。
  - A：请尝试按住键盘上的 `Shift` 按键点击刷新按钮，强制刷新浏览器缓存。

## 进阶内容
此处记录 NanoSite 的一些高级选项，若您有兴趣可以进一步探索。

### 其他设置
`site.yaml` 还有一些其他设置选项。

#### 主题覆写
默认情况下，网站的主题尊重用户的选择，并储存在浏览器中。但您可以通过设置强制用户加载某一主题（及其变体）。
- `themeMode` — 主题模式（例如，`user`、`dark`、`light`、`default`）。
- `themePack` — 主题包（例如，`minimalism`、`github`）。
- `themeOverride` — 强制用户加载特定主题（缺省为 `false`）。

例如：
```yaml
themeMode: user
themePack: minimalism
themeOverride: true
```

#### 错误报告设置
- `reportIssueURL` — 启用预填充的 GitHub 问题链接。
- `errorOverlay` — 如果发生错误，则在页面上显示错误弹窗（缺省为 `false`）。
- `assetWarnings` — 资源相关警告设置。
  - `largeImage` — 大图警告设置。
    - `enabled` — 是否启用大图警告（缺省为 `false`）。
    - `thresholdKB` — 大图阈值（缺省为 `500KB`）。

例如：
```yaml
reportIssueURL: https://github.com/deemoe404/NanoSite/issues/new
errorOverlay: true
assetWarnings:
  largeImage:
    enabled: true
    thresholdKB: 500
```

#### 杂项设置
- `contentOutdatedDays` — 内容被视为过时的天数（默认为 180 天）。
- `cardCoverFallback` — 如果未提供封面图像，则使用生成的占位封面图像（缺省为 `true`）。
- `pageSize` — 索引列表中每页的帖子数量（缺省为 `8`）。
- `defaultLanguage` — 默认 UI/内容语言（例如，`en`、`zh`、`ja`；缺省为 `en`）。

例如：
```yaml
contentOutdatedDays: 180
cardCoverFallback: false
pageSize: 8
defaultLanguage: en
```

### 路由工作方式

前端路由读取 URL 查询参数：

- `?tab=posts` — 全部文章（默认）。支持 `&page=N` 分页。
- `?tab=search&q=关键词` — 按标题或标签搜索。也可用 `&tag=标签名` 过滤。
- `?id=路径/到/文章.md` — 直接打开某篇文章（路径必须存在于 `index.yaml`）。
- `?lang=zh` — UI/内容语言。存储在 localStorage，并回退到浏览器与 `<html lang>`。

Markdown 中的站内跳转链接示例：`[看看这篇](?id=post/frogy/main.md)`，标签页：`[关于](?tab=about)`。

### SEO（内置）

运行时按页面动态更新 meta（标题、描述、Open Graph、Twitter Card），并注入结构化数据（JSON-LD）。数据来源优先级：

1) Markdown 前言区（`title`、`excerpt`、`tags`、`date`、`image`）
2) `index.yaml` 元数据
3) 自动回退（H1/首段）与生成的占位社交图

`index.yaml` 的 SEO 部分示例配置如下：
```yaml
resourceURL: https://nano.dee.moe/wwwroot/
siteDescription:
  default: NanoSite - Just Markdown. Just a website.
  zh: 微站 - 写下 Markdown，就是你的网站。
  ja: ナノサイト - 書くだけ、Markdown。それがサイトになる。
siteKeywords:
  default: static blog, markdown, github pages, blog
```

其中：
- `resourceURL` — 资源的基础 URL，确保所有资源（如图片、视频）都能正确加载。默认情况下设置为您实际网站的 `wwwroot/` 目录即可。
- `siteDescription` — 网站的描述信息，用于 SEO 和社交分享。
- `siteKeywords` — 网站的关键词，用于 SEO。

您同时应该打开 `index_seo.html`，生成 `sitemap.xml`、`robots.txt` 并放入网站根目录（与 `index.html` 同级）；以及根据 `site.yaml` 生成初始 `<head>` 标签并填入 `index.html` 的对应位置。

### 多语言

- UI 文案在 `assets/js/i18n.js`（已含 English/中文/日本語）。可扩展 `translations` 和 `languageNames` 添加更多语言。
- 内容支持：
	- 简化版（本仓库示例）：按语言直接给出 Markdown 路径
	- 统一版：每种语言的 `{title, location}`
	- 旧版：`index.en.yaml`/`index.en.json`、`index.zh.yaml`/`index.zh.json`…（回退）
- 切换语言时，若当前文章存在相应变体，路由会尽量保持在“同一篇”。
