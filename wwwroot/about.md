## About NanoSite

NanoSite 是一个零依赖、纯前端的极简博客/文档发布方案。把 Markdown 放在 `wwwroot/`，主页读取 `index.json` 列表，浏览器端完成渲染与导航。

### 特性一览

- 纯静态：适合 GitHub Pages 等静态托管
- Markdown：标题、列表、链接、图片、代码块、表格、待办等
- 目录（TOC）：侧边高亮跟随（仅 H2/H3）
- 深浅色主题：手动切换，记忆偏好
- 安全：链接/图片协议白名单、相对图片路径自动解析

### 快速开始

1. 把文章（`*.md`）放入 `wwwroot/`
2. 在 `wwwroot/index.json` 中登记标题与文件名
3. 通过本地服务器预览：`python3 -m http.server 8000`

### Demo 与源码

- 功能演示：[Feature Demo](?id=features-demo.md)
- 源码仓库：[GitHub](https://github.com/phyllali)

> 提示：顶部的 “All Posts” 标签展示所有文章；当前 “About” 标签由 `wwwroot/tabs.json` 配置并映射到本页 Markdown。

