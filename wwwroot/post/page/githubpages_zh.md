---
title: 为 NanoSite 配置 GitHub Pages
date: 2025-08-21
tags:
  - 微站
  - 技术
  - GitHub Pages
excerpt: 你可以将 NanoSite 免费托管在 GitHub Pages 上。本文作为一份自包含的参考，但仍请以 GitHub 官方文档为准以获取最准确的信息。
author: deemoe
---

> [GitHub Pages](https://pages.github.com) 并非 NanoSite 的一部分，因此这里的信息可能不是最新的。如遇问题，请优先参考 GitHub 官方文档。

## 如何为仓库启用 GitHub Pages

按照以下步骤为你的仓库开启 GitHub Pages：

1. 打开你的 GitHub 仓库页面。
2. 点击 **Settings（设置）**。
3. 在侧边栏找到 **Pages** 部分。
4. 在 **Source** 处选择你要发布的分支（通常为 `main` 或 `master`）。
5. （可选）选择一个文件夹，比如 `/root` 或 `/docs`。
6. 点击 **Save（保存）**。
7. 片刻后你的网站会被发布，URL 会显示在 Pages 区域中。

- 如果你希望所有人都能访问你的网站，请确保仓库为公开状态。
- 你可以在同一页面配置自定义域名。

## 设置自定义域名

1. 在仓库设置的 **Pages** 页面下，找到 **Custom domain**，输入你的域名（例如 `www.example.com`）。
2. 点击 **Save**。
3. 按提示配置你的 DNS 记录。通常需要添加一个指向 `your-username.github.io` 的 CNAME 记录。
4. DNS 生效后，你就可以通过自定义域名访问你的网站。

## 设置 APEX 根域名

1. 在你的 DNS 服务商处，为根域名（例如 `example.com`）创建 A 记录，指向 GitHub 的 IP 地址：
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. 回到仓库设置的 **Pages** 页面，在 **Custom domain** 中填写你的根域名（例如 `example.com`）。
3. 点击 **Save**。
4. 几分钟后，你应该可以通过根域名访问你的网站。
