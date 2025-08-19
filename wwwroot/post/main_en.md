---
title: Meet NanoSite
date: 2025-08-17
tags:
  - NanoSite
  - Technology
image: hero.jpeg
excerpt: Build a simple personal website from plain text files (Markdown). No build tools, no databases — just edit files and publish. Perfect for blogs, notes, wikis, journals, or book chapters.
author: deemoe
---

![hero](hero.jpeg)

Source Code: [NanoSite on GitHub](https://github.com/deemoe404/NanoSite)

## Highlights

- Write in **Markdown**
- Works on **GitHub Pages** (free hosting)
- Search, tags, reading time, dark mode, and theme packs
- Optional tabs (About, Projects, etc.)
- Optional multi‑language UI and posts
- Automatic Table of Contents with copyable anchors
- Built-in pagination for large indexes and searches

## Quick Start in 5 minutes

> ⚠️ Note: `JSON` does not support comments. The comments in these examples are for explanation only; remove them in real files.

1) Go to the [repository page](https://github.com/deemoe404/NanoSite).  
2) Click the green **Use this template** button in the top right.  
3) Select **Create a new repository** and name it whatever you like. 
4) Get your new repository locally
  - Option 1: Clone the repository using Git
    - `git clone https://github.com/your-username/your-repo.git`
  - Option 2: Download the ZIP file
    - Click on the green **Code** button, then **Download ZIP**.
  - Option 3: Use GitHub Desktop
    - If you have GitHub Desktop installed, you can use "Open with GitHub Desktop" from the web.
5) **Preview locally** (recommended)
  - In the project folder, start a simple server:
    - macOS/Linux: `python3 -m http.server 8000`
    - Windows (PowerShell): `py -m http.server 8000`
  - Open `http://localhost:8000/` in your browser.
6) **Set your site name and links**
    - Open `site.json` (in the project root) and edit basic settings:
  ```json
  {
    "siteTitle":    "My Site",           // Site title
    "siteSubtitle": "Welcome!",          // Site subtitle
    "avatar":       "assets/avatar.png", // Path to site avatar image
    "profileLinks": [                    // Personal links (multiple supported)
      { "label": "GitHub",   "href": "https://github.com/your-username" },
      { "label": "Twitter",  "href": "https://twitter.com/your-username" },
      { "label": "LinkedIn", "href": "https://www.linkedin.com/in/your-profile" }
    ]
  }
  ```
7) **Start writing!**
  - Create a new Markdown file under `wwwroot/`, for example `wwwroot/my-first-post.md`:
  ```markdown
  ---
  title: My First Post
  date: 2025-08-17
  tags:
    - Note
    - Technology
  ---

  # My First Post

  Hello! This is my first post. I can write text, lists, and add images.
  ```
  - Register it in `wwwroot/index.json` so it shows on the homepage:
  ```json
  {
    "My First Post": {
      "en": "my-first-post.md"
    },
    "xxxx": {
      "en": "xxxx.md"
    },
    // ... register other posts as needed
  }
  ```

🎉 Congratulations! You've set up NanoSite. Reload the page and you should see your post card on the homepage. Click to read it. For more customization options, see the [docs](?id=post/doc_en.md); for deploying to GitHub Pages, see [here](?id=post/githubpages_en.md).
