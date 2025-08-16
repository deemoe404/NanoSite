# NanoSite

Build a simple personal website from plain text files (Markdown). No build tools, no databases — just edit files and publish.

Perfect for blogs, notes, wikis, journals, or book chapters.

Highlights:
- Write in Markdown (`.md` files)
- Works on GitHub Pages (free hosting)
 - Search, tags, reading time, dark mode, and theme packs
- Optional tabs (About, Projects, etc.)
- Optional multi‑language UI and posts
 - Automatic Table of Contents with copyable anchors
 - Built-in pagination for large indexes and searches

---

## Folder Guide

- `index.html`: The site entry page.
- `site.json`: Your site name, subtitle, avatar, and profile links.
- `assets/`: CSS and JavaScript for the site (no changes required for most users).
 - `assets/themes/packs.json`: Theme pack list (Native, GitHub, Apple, OpenAI, Minimalism).
- `wwwroot/`: Your content — Markdown files and data files.
  - `wwwroot/index.json`: List of posts (what shows on the homepage).
  - `wwwroot/tabs.json`: List of extra tabs (About, Projects, etc.).
  - Images: you can keep images next to your posts under `wwwroot/post/...` or in `assets/`. Use correct relative paths in your Markdown.
 - `index_seo.html`: SEO helper (generate sitemap.xml, robots.txt, and starter meta tags).

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

## Themes (optional)

Switch between built-in theme packs from the sidebar: Native, GitHub, Apple, OpenAI, Minimalism.

- The selector reads `assets/themes/packs.json`. Add or rename packs there.
- CSS for each pack lives in `assets/themes/<pack>/theme.css`.

Dark mode toggles separately and respects system preference or your saved choice.

---

## Organize Your Content

- Posts live in `wwwroot/` and must be listed in `wwwroot/index.json`.
- Tabs live in `wwwroot/tab/` and must be listed in `wwwroot/tabs.json`.
- Images can live anywhere in this repository. Use a correct relative path in Markdown, for example:
  - If your post is `wwwroot/my-first-post.md`, `![Alt](images/pic.png)` points to `wwwroot/images/pic.png`.
- The first `#` heading in a Markdown file is used as the page title.
- Optional card image fields on posts (in `index.json`), in order of preference: `thumb`  ‑ `cover`  ‑ `image`.

---

## Link to Other Posts or Tabs

Create in‑site links directly in Markdown:

- Link to a post: `[Read more](?id=my-first-post.md)`
  - The value after `id=` must match the `location` in `wwwroot/index.json` (e.g., `notes/day1.md`).
- Link to a tab: `[About](?tab=about)`
  - The tab slug is usually the tab title in lowercase ASCII. If your title uses non‑Latin characters or you’re unsure, click the tab and copy the address bar URL.
- Link to a section in a post: click the heading’s `#` icon to copy the correct URL (anchor IDs are auto-generated).

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

Tabs support languages too. Example `wwwroot/tabs.json`:

```
{
  "About": {
    "en": { "title": "About", "location": "tab/about.md" },
    "zh": { "title": "关于", "location": "tab/about.zh.md" },
    "ja": { "title": "概要", "location": "tab/about.ja.md" }
  }
}
```

Notes:
- Preferred format is a single unified JSON with per-language blocks (as above). Legacy files `index.<lang>.json` and `tabs.<lang>.json` also work as a fallback.

---

## Publish to GitHub Pages

1) Push this folder to a GitHub repository.
2) In the repository Settings → Pages, choose the `main` branch and `/ (root)`.
3) Save. After a minute, your site will be live at `https://<yourname>.github.io/<repo>/`.
- If you use a custom domain, edit `CNAME` with your domain and point DNS to GitHub Pages.

No build step is needed — it’s a static site.

---

## SEO Optimization

NanoSite includes built‑in SEO that works without any build process.

### Automatic Meta Tags
- Dynamic title and description per page
- Open Graph and Twitter Card tags
- Structured data (JSON‑LD)
- Canonical URLs

### Site Configuration
Add SEO‑related fields in `site.json`:

```json
{
  "siteTitle": { "default": "Your Site Name" },
  "siteDescription": { "default": "Your site description for search engines" },
  "resourceURL": "https://cdn.example.com/path/", 
  "siteKeywords": { "default": "keyword1, keyword2, keyword3" }
}
```

Notes:
- `resourceURL` is optional and used as the base when composing absolute URLs for resources (e.g., OG images). It can include a path and should end with a `/`.
- `siteKeywords` is used by the SEO generator (below) when producing a starter `<meta name="keywords">` for `index.html`. Runtime meta keywords on article pages are derived from post tags.

### Post‑Level SEO
From each Markdown post, the site automatically derives:
- Meta description from the first paragraph
- Article structured data with publish dates
- Keyword tags from content/tags
- Social preview images (use your own or a generated fallback)

### SEO File Generation
Use the built‑in generator to create sitemap and robots files:
1) Open `index_seo.html` in your browser
2) Use “Sitemap Generator” to create `sitemap.xml`
3) Use “Robots.txt Generator” to create `robots.txt`
4) Copy or download the files and place them in the repository root

Tip: The “HTML Meta Tags” tab in the generator can produce initial `<head>` tags for `index.html` based on your `site.json`.

Best practices:
- Write descriptive H1 titles in Markdown (first `# heading`)
- Include dates (e.g., `Date: 2024-01-01`)
- Add images to posts for better sharing
- Use descriptive filenames and keep descriptions under ~155 characters

All SEO features work automatically — no compilation needed.

---

## Pagination

The All Posts and Search views paginate automatically (8 items per page).

- Navigate via the pager, or use `?tab=posts&page=2` (search: `?tab=search&q=term&page=2`).

---

## Tips & Troubleshooting

- Open with a local server: Some browsers block loading `site.json` from a file. Use `python3 -m http.server 8000` and open `http://localhost:8000/`.
- JSON must be valid: No trailing commas, use double quotes. If the page looks empty, check your recent edits in `index.json`, `tabs.json`, or `site.json`.
- File paths are relative to `wwwroot/`: If an image or post doesn’t show, check the `location` path.
- Theme and search: Use the theme toggle and theme pack picker in the sidebar; search by title or tag on the Search tab.
- Headings have link icons (#). Click to copy a direct link to that section.
- Images lazy-load and use skeleton placeholders to keep layout stable.

---

## Need more control?

Advanced users can customize UI text and language behavior in `assets/js/i18n.js`. The app automatically detects language from the URL (`?lang`), your last choice, or your browser language.

---

## Optional extras

### Outdated content warning

Set `contentOutdatedDays` in `site.json` (default 180). If a post’s `date` is older than this threshold, the post page shows a dismissible “outdated” notice at the top.

```
{
  "contentOutdatedDays": 365
}
```

### Error overlay and one-click issue report

When a JavaScript error occurs, NanoSite shows a small error card with buttons to copy details. You can add a “report issue” button by setting a URL in `site.json` (for example, a GitHub “new issue” link that accepts title/body query parameters):

```
{
  "reportIssueURL": "https://github.com/<owner>/<repo>/issues/new"
}
```

The reporter pre-fills structured context (route, query, user agent) into the issue body.

---

Enjoy your site! If you get stuck, compare your files with the examples above or start with a small change and refresh the page to see the effect.
