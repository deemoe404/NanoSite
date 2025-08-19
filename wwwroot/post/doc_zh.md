---
title: NanoSite 使用文档
date: 2025-08-17
tags:
	- NanoSite
	- 文档
excerpt: 无需构建步骤即可直接用 Markdown 文件创建内容网站，只需将文件放入 wwwroot/，在 JSON 中列出并发布，即可兼容 GitHub Pages。本指南涵盖项目结构、配置文件、内容加载、主题、搜索、标签、SEO、媒体以及部署方法。
author: deemoe
---

# NanoSite 使用文档

用零构建流程的方式，从纯 Markdown 文件搭建内容站点。把 Markdown 放进 `wwwroot/`，在 JSON 里登记路径，然后直接发布（完全兼容 GitHub Pages）。

本文包含：

- 项目结构与路由
- 所有配置文件与参数说明
- 内容加载方式（文章、标签页、多语言）
- 主题、搜索、标签、SEO、图片/视频
- 部署与常见操作


## 项目结构

- `index.html` — 入口页面，包含基础 meta 与内容/侧边栏/标签区域。前端应用在此挂载。
- `site.json` — 站点级设置（标题、头像、主题默认等）。
- `assets/` — 前端代码与样式；无需编译构建。
	- `assets/main.js` — 应用启动与路由。
	- `assets/js/*.js` — 功能模块（i18n、Markdown、搜索、主题、SEO 等）。
	- `assets/themes/` — 主题包 CSS 与 `packs.json`（可用主题列表）。
- `wwwroot/` — 内容与数据。
	- `wwwroot/index.json` — 文章索引（首页与搜索使用）。
	- `wwwroot/tabs.json` — 静态标签页（About、Gallery 等）。
	- `wwwroot/post/**` — Markdown 文章与资源。
	- `wwwroot/tab/**` — 标签页的 Markdown 文件。
- 可选 SEO/CDN 根文件：`sitemap.xml`、`robots.txt`、`CNAME`。


## 路由工作方式

前端路由读取 URL 查询参数：

- `?tab=posts` — 全部文章（默认）。支持 `&page=N` 分页。
- `?tab=search&q=关键词` — 按标题或标签搜索。也可用 `&tag=标签名` 过滤。
- `?id=路径/到/文章.md` — 直接打开某篇文章（路径必须存在于 `index.json`）。
- `?lang=zh` — UI/内容语言。存储在 localStorage，并回退到浏览器与 `<html lang>`。

Markdown 中的站内跳转链接示例：`[看看这篇](?id=post/frogy/main.md)`，标签页：`[关于](?tab=about)`。


## 内容写作

把 Markdown 放在 `wwwroot/`。推荐使用前言区（非必需，但利于卡片与 SEO）：

```markdown
---
title: 文章标题
date: 2025-08-18
tags: [标签A, 标签B]
excerpt: 一句话摘要，用于卡片与 meta 描述。
author: your-name
image: path/to/cover.jpg   # 可选；用于社交分享图
---

# 一级标题

正文...
```

说明：

- 若 `index.json` 未提供元数据，加载器会读取前言区的 `title`、`date`、`tags`、`excerpt`、`image`。
- 页面中的 H1 用于正文标题；卡片标题来自 `index.json` 或前言区标题。


## 文章索引：`wwwroot/index.json`

支持三种格式，按需选择。

1) 简化版（当前仓库使用）：按语言给出路径，应用会拉取 Markdown 并从前言区提取元数据：

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

2) 统一版：每种语言给出 `{title, location}`，还可在顶层放通用字段：

```json
{
	"我的第一篇": {
		"zh": { "title": "我的第一篇", "location": "post/foo_zh.md", "excerpt": "..." },
		"en": { "title": "My First Post", "location": "post/foo.md" },
		"tag": ["Note"],
		"date": "2025-08-13",
		"image": "post/cover.jpg",
		"thumb": "post/thumb.jpg",
		"cover": "post/cover-wide.jpg"
	}
}
```

3) 旧版（单语）：

```json
{
	"我的第一篇": { "location": "post/foo_zh.md", "tag": ["Note"], "date": "2025-08-13", "image": "..." }
}
```

字段说明（任一格式通用）：

- `location` — 必填，Markdown 路径（相对 `wwwroot/`）。
- `title` — 展示标题（统一版）。其他格式下取键名/前言区标题。
- `tag` / `tags` — 数组或逗号串。用于搜索、标签筛选、meta keywords。
- `date` — ISO 或 YYYY-MM-DD。用于卡片日期与“过期提醒”。
- `image` / `cover` / `thumb` — 卡片/社交图优先级：`thumb` → `cover`/`image`。`thumb` 适合列表小图。
- `excerpt` — 卡片与 SEO 描述。缺省时自动从首段提取。

行为：

- 使用简化版时，元数据来自 Markdown 前言区。
- 跨语言跳转：若链接指向 `main_en.md` 而 UI 为中文，存在中文变体时可自动重定向。
- 只有出现在 `index.json` 的 `location` 才被允许；未知 `?id=` 会显示友好错误。


## 标签页：`wwwroot/tabs.json`

标签页是静态页面，支持与文章相同的三种格式。示例（当前仓库）：

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

说明：

- URL 中的 slug（如 `?tab=about`）由基础标题生成，并在不同语言间保持稳定。
- 浏览器/SEO 标题取自 `tabs.json` 中的 `title`。


## 站点设置：`site.json`

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

参数：

- `siteTitle` — 字符串或多语言对象。用于站点卡片、页脚与 SEO。
- `siteSubtitle` — 可选，字符串或多语言对象。显示于站点卡片。
- `siteDescription` — 当页面无描述时作为默认 SEO 描述。
- `resourceURL` — 组合绝对资源地址的前缀（如 OG 图）；建议以 `/` 结尾。
- `siteKeywords` — 提供给 SEO 生成器的初始关键词；运行时文章页的关键词来自标签。
- `avatar` — 站点头像；当文章无图时作为默认社交图源。
- `profileLinks` — `{ label, href }` 数组，显示在站点卡片。
- `contentOutdatedDays` — 若文章 `date` 超过此天数，文章顶部显示可关闭的“可能过时”提示。
- `themeMode` — "dark" | "light" | "auto" | "user"。当 `themeOverride` 为 true 时强制生效。
- `themePack` — 见 `assets/themes/packs.json` 中的值（如 `native`、`github`、`apple`、`openai`、`minimalism`）。
- `themeOverride` — 默认为 true；强制站点主题覆盖用户选择。为 false 时仅作为默认值。
- `cardCoverFallback` — 若为 true（或未设置时的默认逻辑），列表卡片在无封面时显示彩色首字母；设为 `false` 可隐藏该占位封面。
- `reportIssueURL` — 可选。启用错误卡片中的“一键反馈”按钮（如指向 GitHub 新建 Issue 的链接）。


## 主题与工具

- 侧边栏（工具）包含主题切换与主题包选择。主题包定义在 `assets/themes/packs.json`，CSS 位于 `assets/themes/<pack>/theme.css`。
- 站点可在 `site.json` 设定默认主题；若 `themeOverride` 为 `false`，用户仍可通过 UI 修改并保留偏好。
- 语言下拉框会结合内容索引自动展示可用内容语言（统一/简化格式下）。


## 搜索、标签与分页

- 搜索匹配标题与标签。在侧边栏搜索框回车触发。
- 标签侧栏从文章索引聚合标签；点击可过滤。
- 列表自动分页（每页 8 项）。在 `posts` 或 `search` 视图使用 `?page=N`。


## 图片与视频

图片

- 使用标准 Markdown：`![Alt](relative/or/absolute.png "可选标题")`。
- 图片懒加载，带骨架占位，并保持纵横比避免布局抖动。

视频（通过图片语法识别扩展名）：

```markdown
![演示视频](post/demo.mov "poster=post/frame.jpg | formats=mp4,webm")
```

可选标题参数：

- `poster=...` — 指定封面图；否则页面会尝试自动捕捉一帧作为海报。
- `sources=a.mp4,b.webm` — 额外显式源。
- `formats=mp4,webm` — 基于主文件名自动生成其它格式源。


## 站内链接卡片（预览）

当段落只包含一个指向文章的链接（如 `?id=...`）时，该链接会被升级为带封面、摘要、日期、阅读时长的卡片。若要在行内强制卡片，可在 `title` 中包含 `card` 或添加 `data-card`：

```markdown
[阅读这篇](?id=post/meet-nanosite/doc_zh.md "card")
```


## SEO（内置）

运行时按页面动态更新 meta（标题、描述、Open Graph、Twitter Card），并注入结构化数据（JSON-LD）。数据来源优先级：

1) Markdown 前言区（`title`、`excerpt`、`tags`、`date`、`image`）
2) `index.json` 元数据
3) 自动回退（H1/首段）与生成的占位社交图

你也可以打开 `index_seo.html`，生成 `sitemap.xml`、`robots.txt`，以及根据 `site.json` 生成初始 `<head>` 标签。

提示：如果你的资源走 CDN，请在 `site.json` 里设置 `resourceURL`。


## 多语言

- UI 文案在 `assets/js/i18n.js`（已含 English/中文/日本語）。可扩展 `translations` 和 `languageNames` 添加更多语言。
- 内容支持：
	- 简化版（本仓库示例）：按语言直接给出 Markdown 路径
	- 统一版：每种语言的 `{title, location}`
	- 旧版：`index.en.json`、`index.zh.json`...（回退）
- 切换语言时，若当前文章存在相应变体，路由会尽量保持在“同一篇”。


## 部署

GitHub Pages：

1) 推送仓库
2) Settings → Pages → Branch: `main`, Path: `/ (root)`
3) 自定义域名可设置 `CNAME` 并配置 DNS

本地预览（无构建）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```


## 故障排查

- 页面空白？请校验 JSON（不要尾随逗号，必须双引号）。
- `index.json`/`tabs.json` 中的路径需相对 `wwwroot/`。
- 一些浏览器禁止 `file://` 加载资源，请使用本地服务器预览。
- 文章未找到？确认其 `location` 已写入 `wwwroot/index.json`。


## 小抄

- 快速新增文章（简化格式）：

	1) 创建 `wwwroot/post/new.md`（含前言区）
	2) 向 `wwwroot/index.json` 添加：

	```json
	{ "新文章": { "zh": "post/new.md" } }
	```

- 新增标签页：

	1) 创建 `wwwroot/tab/about.md`
	2) 向 `wwwroot/tabs.json` 添加：

	```json
	{ "关于": { "zh": { "title": "关于", "location": "tab/about.md" } } }
	```

- 全站强制主题：

	```json
	{ "themeMode": "dark", "themePack": "apple", "themeOverride": true }
	```

写作愉快。
