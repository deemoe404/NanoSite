---
title: Press指南
date: 2025-08-23
version: v2.1.0
tags:
	- Press
	- 文档
excerpt: 无需构建步骤即可直接用 Markdown 文件创建内容网站，只需将文件放入 wwwroot/，在 YAML 中列出并发布，即可兼容 GitHub Pages。本指南涵盖项目结构、配置文件、内容加载、主题、搜索、标签、SEO、媒体以及部署方法。
author: Ekily
ai: true
---

## 文件概览
在开始使用 **Press** 之前，理解网站结构中的核心文件十分重要：

- `site.yaml` — 您将在这里设置网站的基本信息，例如**站点标题**或您的**个人资料链接**。
- `wwwroot/` — 包含所有内容和数据的文件夹：
  - `wwwroot/index.yaml` — 所有**文章**的索引，例如“旅行日志 - 马尔代夫”、“读书笔记：小王子”等。
  - `wwwroot/tabs.yaml` — 所有**页面**的索引，例如“关于本站”、“法律声明”等。

> 您始终可以从 [v2.1.0/site.yaml](https://github.com/EkilyHQ/Press/blob/v2.1.0/site.yaml) 获取到 v2.1.0 版本的**默认**设置文件。


## 网站基本信息设置
在 `site.yaml` 中，您可以设置以下基本信息：

- `siteTitle` 与 `siteSubtitle` — 网站的标题与副标题。
- `avatar` — 网站的 LOGO。

例如，本站的 `site.yaml` 配置如下：

```yaml
# 网站基本信息设置
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
```


## 联系方式与社交媒体展示
Press 允许您在站点卡片上展示您的联系方式或者社交媒体链接。您可以在 `site.yaml` 中添加 `profileLinks` 字段来实现这一点，例如：

```yaml
# 社交媒体链接
profileLinks:
  - label: GitHub
    href: https://github.com/EkilyHQ/Press
  - label: Demo
    href: https://ekilyhq.github.io/Press/
```

> `label` 选项仅用于显示文本，因此可以是任意值——而非固定的社交媒体名称。


## 文章写作
Press 默认将 `wwwroot/` 文件夹作为工作路径。它通过读取这个文件夹下的 `index.yaml` 文件来获取文章列表。例如 [为 Press 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md&lang=chs) 这篇文章对应的 `wwwroot/index.yaml` 内容如下：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  chs: post/page/githubpages_chs.md # 文章的中文版本位于 wwwroot/post/page/githubpages_chs.md
  ja: post/page/githubpages_ja.md
```

除了在 `wwwroot/index.yaml` 中指定文章的 Markdown 文件路径外，您还需要在每篇 Markdown 文件的开头添加前言区（Front Matter）来提供文章的元数据。以下是 `wwwroot/post/page/githubpages_chs.md` 的文件节选：

```markdown
---
title: 为 Press 配置 GitHub Pages
date: 2025-08-21
tags:
  - Press
  - 技术
  - GitHub Pages
image: page.jpeg
excerpt: 你可以将 Press 免费托管在 GitHub Pages 上。本文作为一份自包含的参考，但仍请以 GitHub 官方文档为准以获取最准确的信息。
author: Ekily
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
与 [文章写作](#45) 类似，Press 通过读取 `wwwroot/` 文件夹内的 `tabs.yaml` 文件来获取页面列表。例如 [关于](?tab=about&lang=chs) 页面的对应的 `wwwroot/tabs.yaml` 内容如下：

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  chs:
    title: 关于
    location: tab/about/chs.md # 页面的中文版本位于 wwwroot/tab/about/chs.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

与文章不同，页面对应的 Markdown 文件可以不包含前言区。


## 图片与视频
Press 支持在 Markdown 中插入图片和视频。所有 Markdown 文件中的图片和视频都会以该文件的相对路径进行引用。例如在 [为 Press 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md&lang=chs) 这篇文章中，其于内容开头处插入了一张图片：

```markdown
![page](page.jpeg)
```

且其文章路径为 `wwwroot/post/page/githubpages_chs.md`，那么 `page.jpeg` 的存放位置则应为 `wwwroot/post/page/page.jpeg`。视频文件与图片文件的引用方式相同，只需确保路径正确即可，Press 会自动识别出视频文件并进行处理。

## 站内链接卡片（预览）

当某段落只包含一个指向文章的链接（如 `?id=...`）时，该链接会被升级为带封面、摘要、日期、阅读时长的卡片（就像您在文章列表中看到的那样）。

```markdown
... 此前内容省略

[为 Press 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md)

... 此后内容省略
```

若要在行内强制显示为卡片，可在 `title` 中包含 `card` 或添加 `data-card`：

```markdown
... 此前内容省略

这是一张 [为 Press 配置 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md "card") 行内卡片。

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
此处记录 Press 的一些高级选项，若您有兴趣可以进一步探索。

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
reportIssueURL: https://github.com/EkilyHQ/Press/issues/new
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
- `defaultLanguage` — 默认 UI/内容语言（例如，`en`、`chs`、`cht-tw`、`cht-hk`、`ja`；缺省为 `en`）。

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
- `?lang=chs` — UI 语言偏好。存储在 localStorage；内容会先尝试匹配该语言版本，再按配置的回退链选择可用内容。

Markdown 中的站内跳转链接示例：`[看看这篇](?id=post/frogy/main.md)`，标签页：`[关于](?tab=about)`。

### SEO（内置）

运行时按页面动态更新 meta（标题、描述、Open Graph、Twitter Card），并注入结构化数据（JSON-LD）。数据来源优先级：

1) Markdown 前言区（`title`、`excerpt`、`tags`、`date`、`image`）
2) `index.yaml` 元数据
3) 自动回退（H1/首段）与生成的占位社交图

`index.yaml` 的 SEO 部分示例配置如下：
```yaml
resourceURL: https://ekilyhq.github.io/Press/wwwroot/
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

其中：
- `resourceURL` — 资源的基础 URL，确保所有资源（如图片、视频）都能正确加载。默认情况下设置为您实际网站的 `wwwroot/` 目录即可。
- `siteDescription` — 网站的描述信息，用于 SEO 和社交分享。
- `siteKeywords` — 网站的关键词，用于 SEO。

您同时应该打开 `index_seo.html`，生成 `sitemap.xml`、`robots.txt` 并放入网站根目录（与 `index.html` 同级）；以及根据 `site.yaml` 生成初始 `<head>` 标签并填入 `index.html` 的对应位置。

### 多语言

Press 将网站本体语言和内容语言视为相关但独立的两层。

- 网站本体支持的 UI 语言来自 `assets/i18n/languages.json` 以及 `assets/i18n/` 中对应的语言包。文章编辑器可以展示项目支持的全部语言。
- 内容语言由每篇文章或页面在 `wwwroot/index.yaml` 与 `wwwroot/tabs.yaml` 中分别声明。作者只需要列出自己实际撰写的语言版本。
- 当 URL 中设置 `?lang=...` 时，网站导航、按钮、提示等本体文案会切换到对应 UI 语言（前提是语言包存在）。
- 对每篇文章或页面，Press 会先尝试加载与当前 UI 语言相同的内容版本。若该版本不存在，则回退到 `site.yaml` 中的 `defaultLanguage`；本仓库默认是 `en`。
- 如果配置的默认语言版本也不存在，Press 会继续尝试 `en`、`default`，最后使用该条目下第一个可用版本，以避免页面完全无法渲染。

内容索引支持：

	- 简化版（本仓库示例）：按语言直接给出 Markdown 路径
	- 统一版：每种语言的 `{title, location}`
	- 旧版：`index.en.yaml`/`index.en.json`、`index.chs.yaml`/`index.chs.json`…（回退）

切换语言时，若当前文章存在相应变体，路由会尽量保持在“同一篇”；若不存在，则按上述规则显示默认语言内容。
