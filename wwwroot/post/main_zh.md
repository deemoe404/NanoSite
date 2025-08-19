---
title: 初识微站
date: 2025-08-17
tags:
  - 微站
  - 技术
image: hero.jpeg
excerpt: 用纯文本文件（Markdown）构建一个简单的个人网站。无需构建工具，无需数据库——只需编辑文件并发布。非常适合博客、笔记、维基、日记或书籍章节。
author: deemoe
---

![hero](hero.jpeg)

源代码: [GitHub 上的 NanoSite](https://github.com/deemoe404/NanoSite)

## 亮点

- 使用 **Markdown** 编写
- 支持在 **GitHub Pages** 上运行（免费托管）
- 搜索、标签、阅读时长、深色模式与主题包
- 可选的标签页（About、Projects 等）
- 可选的多语言界面与文章
- 自动生成目录，支持可复制的锚点
- 内置分页，适用于大型索引与搜索

## 快速上手


1）前往 [项目仓库页面](https://github.com/deemoe404/NanoSite)。  
2）点击右上角绿色的 **Use this template** 按钮。  
3）选择 **Create a new repository**，并为其命名（可自定义）。  
4）将新仓库下载到本地  
  - 方式一：使用 Git 克隆仓库  
    - `git clone https://github.com/your-username/your-repo.git`
  - 方式二：下载 ZIP 文件  
    - 点击绿色 **Code** 按钮，然后选择 **Download ZIP**。
  - 方式三：使用 GitHub Desktop  
    - 如果已安装 GitHub Desktop，可在网页上选择 "Open with GitHub Desktop"。
5) 本地预览（推荐）
  - 在项目目录启动一个简单的服务器：
    - macOS/Linux: `python3 -m http.server 8000`
    - Windows（PowerShell）: `py -m http.server 8000`
  - 在浏览器打开 `http://localhost:8000/`。
6) 设置站点名称与链接
    - 打开项目根目录的 `site.json`，编辑基础设置：
  ```json
  {
    "siteTitle": "My Site",        // 站点标题
    "siteSubtitle": "Welcome!",    // 站点副标题
    "avatar": "assets/avatar.png", // 站点头像图片路径
    "profileLinks": [
      { "label": Github/Twitter/..., "href": 个人主页的 URL }
    ]
  }
  ```
7) 开始写作！
  - 在 `wwwroot/` 下新建一个 Markdown 文件，例如 `wwwroot/my-first-post.md`：
  ```markdown
  ---
  title: 我的第一篇文章
  date: 2025-08-17
  tags:
    - 笔记
    - 技术
  ---

  # 我的第一篇文章

  你好！这是我的第一篇文章。我可以编写文本、列表，并添加图片。
  ```
  - 在 `wwwroot/index.json` 中注册它，使其显示在首页：
  ```json
  {
    "我的第一篇文章": {
      "zh": "my-first-post.md"
    }
  }
  ```

🎉 恭喜！你已经完成微站的设置。刷新页面，你应该能在首页看到你的文章卡片，点击即可阅读。更多自定义选项请查看[文档](?id=post/meet-nanosite/doc_zh.md)。
