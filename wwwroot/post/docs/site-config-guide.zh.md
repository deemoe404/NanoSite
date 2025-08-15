# 站点配置指南

本文档介绍如何使用 `site.json` 自定义站点标识，包括站点标题、副标题、头像以及资料链接，并说明多语言配置方式。

## 快速开始

1. 在仓库根目录启动本地服务器：`python3 -m http.server 8000`。
2. 在浏览器打开 `http://localhost:8000/`。
3. 编辑 `site.json` 并刷新页面查看效果。

> 注意：加载 `site.json` 需要通过服务器访问。直接用文件协议打开 `index.html` 可能会阻止 `fetch`。

## `site.json` 控制的内容

- 侧边栏卡片中的标题与副标题
- 侧边栏中的头像图片
- 资料链接（以点号 • 分隔的一行链接）
- 浏览器标签页标题的后缀（基于站点标题）

## 配置键说明

```json
{
  "siteTitle": "My Site",
  "siteSubtitle": "Welcome!",
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" },
    { "label": "Blog", "href": "https://example.com" }
  ]
}
```

- `siteTitle`：侧边栏显示且用于文档标题后缀。
- `siteSubtitle`：标题下方的可选说明文字。
- `avatar`：头像图片的相对路径或 URL，建议使用本地资源。
- `profileLinks`：推荐为 `{ label, href }` 数组；也支持 `{ "名称": "https://..." }` 映射形式。

### SEO 相关字段（可选）
你也可以在 `site.json` 中设置全站 SEO 字段：

```json
{
  "siteDescription": { "default": "用于搜索引擎的站点描述" },
  "resourceURL": "https://cdn.example.com/path/",
  "siteKeywords": { "default": "关键词1, 关键词2, 关键词3" }
}
```

说明：
- `resourceURL` 为可选，用于拼接资源的绝对地址（如 OG 图片）。可以包含路径，建议以 `/` 结尾。
- 可在仓库根目录打开 `seo-generator.html`，根据你的配置生成 `sitemap.xml` 与 `robots.txt`。

## 多语言配置

通过语言映射为不同语言提供独立内容，使用中的 UI 语言决定选取哪一项：

```json
{
  "siteTitle": { "default": "My Site", "zh": "我的站点", "ja": "私のサイト" },
  "siteSubtitle": { "default": "Welcome!", "zh": "欢迎！", "ja": "ようこそ！" },
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" }
  ]
}
```

- 语言代码与站点语言选择器一致（例如 `en`、`zh`、`ja`）。
- 若某语言缺失，则回退到 `default` 值。

## 运行机制（简述）

- 应用在启动时加载 `site.json`，随后渲染站点标识与链接。
- 当前 UI 语言决定使用的字段。
- 文档标题格式为 `页面标题 · siteTitle`。
- `index.html` 中存在静态回退文本，`site.json` 加载后会覆盖。

## 文章索引（`wwwroot/index.json`）

用于列出并本地化 `wwwroot/post/` 下的 Markdown 文章。每条目支持多语言结构。

示例（多语言）：

```json
{
  "我的第一篇文章": {
    "en": { "title": "My First Post", "location": "post/my-first-post.md" },
    "zh": { "title": "我的第一篇文章", "location": "post/my-first-post.md" },
    "ja": { "title": "最初の投稿", "location": "post/my-first-post.md" },
    "tag": ["Note"],
    "date": "2025-08-13",
    "image": "post/intro/1.png"
  }
}
```

字段说明：
- `en`/`zh`/`ja`/`default`：语言变体；值可为字符串（仅路径）或对象 `{ title, location }`。
- `location`：也支持旧的扁平结构，但推荐使用上面的多语言形式。
- `tag` 或 `tags`：字符串或数组均可。
- `date`：ISO 风格日期；会按当前 UI 语言格式化显示。
- `image` / `cover` / `thumb`：索引卡片图片，优先 `thumb`/`cover`，否则回退到 `image`。

新增文章（步骤）：
1. 在 `wwwroot/post/` 下创建 `your-post.md`，首个 `#` 标题可作为页面标题。
2. 在 `wwwroot/index.json` 中添加条目（至少提供一个语言的 `location`）。
3. 刷新站点；文章卡片会在“全部文章”中出现，并显示阅读时长与日期。

## 自定义标签页（`wwwroot/tabs.json`）

`wwwroot/tab/` 下的额外页面（例如 About/Changelog），结构与索引类似，也支持多语言。

示例：

```json
{
  "About": {
    "en": { "title": "About", "location": "tab/about.md" },
    "zh": { "title": "关于", "location": "tab/about.zh.md" },
    "ja": { "title": "概要", "location": "tab/about.ja.md" }
  },
  "Changelog": {
    "default": { "title": "Changelog", "location": "tab/changelog.md" }
  }
}
```

说明：
- 内容文件放在 `wwwroot/tab/` 下，并在 `location` 中引用。
- 标题可按语言自定义；缺失时回退到 `default`（或 `en`）。
- 标题会被转为用于路由的 slug，支持非 ASCII 文本。

## 提示

- 使用相对路径引用图片。你可以将图片放在 `wwwroot/post/...`（与文章同目录）或 `assets/` 下。路径以 Markdown 文件所在文件夹为基准解析。
- 保持外部链接可信；程序会对 URL 做基本净化。
- 资料链接建议简短命名，保证以点分隔的一行布局可读。

## 故障排查

- 若修改无效，请确认使用了本地服务器，并尝试强制刷新。
- 检查浏览器控制台中是否有 JSON 解析报错。
- 确认 `assets/avatar.png` 等路径能正确访问。
