## 关于 NanoSite

NanoSite 是一个零依赖、纯前端的轻量模板，适合搭建简单的博客和文档站点。把你的 Markdown 文件放到 `wwwroot/`，在 `wwwroot/index.json` 中登记，它就能在浏览器中完成路由、渲染和目录（TOC）。

### 特性速览

- 纯静态：非常适合 GitHub Pages 等静态托管
- Markdown 覆盖：标题、列表、链接、图片、代码块、表格、任务列表
- 目录（TOC）：侧边栏固定，支持 H2/H3 高亮
- 明/暗主题：手动切换并记忆偏好
- 安全性：URL 协议白名单，自动解析相对图片路径

### 快速上手

1. 将你的文章（`*.md`）添加到 `wwwroot/`。
2. 在 `wwwroot/index.json` 中登记标题与文件名。
3. 本地预览：运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/`。

### 示例与源码

- Markdown 展示： [打开示例](?id=post/intro/markdown-showcase.md)

> 提示：“全部文章”页签会从 `wwwroot/index.json` 读取并列出所有文章。本“关于”页由 `wwwroot/tabs.json` 配置并映射到本文件。

