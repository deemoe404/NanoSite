# NanoSite

Build a simple personal website from plain text files (Markdown). No build tools, no databases — just edit files and publish.

Perfect for blogs, notes, wikis, journals, or book chapters.

Highlights:
- Write in Markdown (`.md` files)
- Works on GitHub Pages (free hosting)
- Search, tags, reading time, and dark mode
- Optional tabs (About, Projects, etc.)
- Optional multi‑language UI and posts

---

## Folder Guide

- `index.html`: The site entry page.
- `site.json`: Your site name, subtitle, avatar, and profile links.
- `assets/`: CSS and JavaScript for the site (no changes required for most users).
- `wwwroot/`: Your content — Markdown files and data files.
  - `wwwroot/index.json`: List of posts (what shows on the homepage).
  - `wwwroot/tabs.json`: List of extra tabs (About, Projects, etc.).
  - Images: place them anywhere you like in the repo (no fixed folder required). Use a correct path in your Markdown.

---

## Quick Start (5 minutes)

1) Get the project
- On GitHub: Fork or use as a template. Or download ZIP and unzip.

2) Preview locally (recommended)
- In the project folder, start a simple server:
  - macOS/Linux: `python3 -m http.server 8000`
  - Windows (PowerShell): `py -m http.server 8000`
- Open `http://localhost:8000/` in your browser.

3) Set your site name and links
- Open `site.json` (in the project root) and edit:

```
{
  "siteTitle": "My Site",
  "siteSubtitle": "Welcome!",
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" }
  ]
}
```

4) Add your first post
- Create a new Markdown file under `wwwroot/`, for example `wwwroot/my-first-post.md`:

```
# My First Post

Hello! This is my first post. I can write text, lists, and add images.
```

- Register it in `wwwroot/index.json` so it shows on the homepage:

```
{
  "My First Post": { "location": "my-first-post.md", "tag": ["Note"], "date": "2025-08-13" }
}
```

Reload the page. You should see your post card on the homepage. Click to read it.

---

## Add Tabs (optional)

Tabs are simple pages like “About” or “Projects”.

1) Create a Markdown file, e.g. `wwwroot/tab/about.md`:

```
# About

Hi, I’m ...
```

2) Add it to `wwwroot/tabs.json`:

```
{
  "About": { "title": "About", "location": "tab/about.md" }
}
```

A new “About” tab will appear in the top bar.

---

## Organize Your Content

- Posts live in `wwwroot/` and must be listed in `wwwroot/index.json`.
- Tabs live in `wwwroot/tab/` and must be listed in `wwwroot/tabs.json`.
- Images can live anywhere in this repository. Use a correct relative path in Markdown, for example:
  - If your post is `wwwroot/my-first-post.md`, `![Alt](images/pic.png)` points to `wwwroot/images/pic.png`.
  - You can also reference `assets/cover.png` or `../shared/pic.png` — the path is resolved relative to the Markdown file’s folder.
- The first `#` heading in a Markdown file is used as the page title.

---

## Link to Other Posts or Tabs

Create in‑site links directly in Markdown:

- Link to a post: `[Read more](?id=my-first-post.md)`
  - The value after `id=` must match the `location` in `wwwroot/index.json` (e.g., `notes/day1.md`).
- Link to a tab: `[About](?tab=about)`
  - The tab slug is usually the tab title in lowercase ASCII. If your title uses non‑Latin characters or you’re unsure, click the tab and copy the address bar URL.
- Link to a section in a post: `[Jump to section](?id=my-first-post.md#my-section)`
  - Headings in posts become anchors automatically; use the link icon in the heading or copy the URL after clicking it.

External links work as usual: `[My Site](https://example.com)`.

---

## Multi‑Language (optional)

You can offer the UI and content in multiple languages.

- Switch language from the dropdown in the sidebar or by adding `?lang=xx` to the URL.
- Posts can have language variants inside `wwwroot/index.json`:

```
{
  "My First Post": {
    "en": { "title": "My First Post", "location": "my-first-post.md" },
    "zh": { "title": "我的第一篇文章", "location": "my-first-post.zh.md" },
    "tag": ["Note"],
    "date": "2025-08-13"
  }
}
```

If a language version is missing, the site falls back to the default.

---

## Publish to GitHub Pages

1) Push this folder to a GitHub repository.
2) In the repository Settings → Pages, choose the `main` branch and `/ (root)`.
3) Save. After a minute, your site will be live at `https://<yourname>.github.io/<repo>/`.
- If you use a custom domain, edit `CNAME` with your domain and point DNS to GitHub Pages.

No build step is needed — it’s a static site.

---

## SEO Optimization

NanoSite includes built-in SEO features that work without any build process:

### Automatic Meta Tags
- Dynamic title and description for each page
- Open Graph and Twitter Card tags for social sharing
- Structured data (JSON-LD) for search engines
- Canonical URLs to prevent duplicate content issues

### Enhanced Site Configuration
Update `site.json` with SEO-friendly information:

```json
{
  "siteTitle": { "default": "Your Site Name" },
  "siteDescription": { "default": "Your site description for search engines" },
  "siteUrl": "https://yourdomain.com/",
  "siteKeywords": { "default": "keyword1, keyword2, keyword3" }
}
```

**Important**: Make sure your `siteUrl` doesn't include `/wwwroot/` at the end - it should be your actual domain like `https://yourdomain.com/`

### Post-Level SEO
Each markdown file automatically generates:
- Meta descriptions from the first paragraph
- Article structured data with publication dates
- Automatic keyword extraction from content
- Social sharing optimized images

### SEO File Generation
1. Open `seo-generator.html` in your browser
2. Use the **Sitemap Generator** tab to create `sitemap.xml`
3. Use the **Robots.txt Generator** tab to create `robots.txt`
4. Check the **Site Configuration** tab to verify your settings
5. Copy or download the generated files
6. Save them in your root directory

### SEO Best Practices
- Write descriptive titles for your markdown files (first `# heading`)
- Include dates in your posts: `Date: 2024-01-01`
- Add images to posts for better social sharing
- Use descriptive filenames for your markdown files
- Keep descriptions under 155 characters for best results

All SEO features work automatically - no compilation needed!

### Post-Level SEO
Each markdown file automatically generates:
- Meta descriptions from the first paragraph
- Article structured data with publication dates
- Automatic keyword extraction from content
- Social sharing optimized images

### Sitemap Generation
1. Open `sitemap-generator.html` in your browser
2. Click "Generate Sitemap" 
3. Copy the generated XML
4. Save as `sitemap.xml` in your root directory
5. The `robots.txt` file is already configured

### SEO Best Practices
- Write descriptive titles for your markdown files (first `# heading`)
- Include dates in your posts: `Date: 2024-01-01`
- Add images to posts for better social sharing
- Use descriptive filenames for your markdown files
- Keep descriptions under 155 characters for best results

All SEO features work automatically - no compilation needed!

---

## Tips & Troubleshooting

- Open with a local server: Some browsers block loading `site.json` from a file. Use `python3 -m http.server 8000` and open `http://localhost:8000/`.
- JSON must be valid: No trailing commas, use double quotes. If the page looks empty, check your recent edits in `index.json`, `tabs.json`, or `site.json`.
- File paths are relative to `wwwroot/`: If an image or post doesn’t show, check the `location` path.
- Theme and search: Use the theme toggle in the sidebar; search by title or tag on the Search tab.

---

## Need more control?

Advanced users can customize UI text and language behavior in `assets/js/i18n.js`. The app automatically detects language from the URL (`?lang`), your last choice, or your browser language.

---

Enjoy your site! If you get stuck, compare your files with the examples above or start with a small change and refresh the page to see the effect.
