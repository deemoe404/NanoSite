---
title: Configuring GitHub Pages for NanoSite
date: 2025-08-21
tags:
  - NanoSite
  - Technology
  - GitHub Pages
image: page.jpeg
excerpt: You can host NanoSite on GitHub Pages for free. This guide is provided as a self-contained reference; however, always consult the official GitHub documentation for the most accurate information.
author: deemoe
---

> [GitHub Pages](https://pages.github.com) is not part of NanoSite, so you might not find up-to-date information here. Always refer to the official GitHub documentation if you run into issues.

![page](page.jpeg)

## How to Enable GitHub Pages for a Repository

To enable GitHub Pages for your repository, follow these steps:

1. Go to your repository on GitHub.
2. Click on **Settings**.
3. Scroll down to the **Pages** section in the sidebar.
4. Under **Source**, select the branch you want to use (usually `main` or `master`).
5. (Optional) Select a folder, such as `/root` or `/docs`.
6. Click **Save**.
7. After a few moments, your site will be published. The URL will be shown in the Pages section.

- Make sure your repository is public if you want everyone to access your site.
- You can use a custom domain by configuring it in the same section.

## Setting Up Your Custom Domain

1. In the **Pages** section of your repository settings, under **Custom domain**, enter your domain name (e.g., `www.example.com`).
2. Click **Save**.
3. Follow the instructions to configure your DNS settings. This usually involves adding a CNAME record pointing to `your-username.github.io`.
4. After your DNS changes propagate, your site should be accessible at your custom domain.

## Setting Up APEX Domain

1. In your DNS settings, create an A record pointing your apex domain (e.g., `example.com`) to GitHub's IP addresses:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. In the **Pages** section of your repository settings, under **Custom domain**, enter your apex domain (e.g., `example.com`).
3. Click **Save**.
4. After a few minutes, your site should be accessible at your apex domain.
