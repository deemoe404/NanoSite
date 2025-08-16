# Site Configuration Guide

This guide explains how to customize your site identity using `site.json`. It covers the site title, subtitle, avatar, and profile links, including multi-language setup.

## Quick Start

1. Run a local server from the repo root: `python3 -m http.server 8000`.
2. Open `http://localhost:8000/` in your browser.
3. Edit `site.json` and refresh to see changes.

> Note: Loading `site.json` requires a server. Opening `index.html` via a file URL may block fetch.

## What `site.json` Controls

- Title and subtitle in the sidebar card
- Avatar image in the sidebar
- Links rendered as a single line separated by dots (•)
- Browser tab title suffix (via base site title)

## Keys

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

- `siteTitle`: Text shown in the sidebar and used as the tab title suffix.
- `siteSubtitle`: Optional text under the title.
- `avatar`: Relative path or URL to the avatar image. Keep assets local when possible.
- `profileLinks`: Either an array of `{ label, href }` items (recommended) or a map like `{ "Label": "https://..." }`.

### SEO‑related fields (optional)
You can also set site‑wide SEO fields in `site.json`:

```json
{
  "siteDescription": { "default": "Your site description for search engines" },
  "resourceURL": "https://cdn.example.com/path/",
  "siteKeywords": { "default": "keyword1, keyword2, keyword3" }
}
```

Notes:
- `resourceURL` is optional and used to build absolute resource URLs (e.g., for OG images). It may include a path and should end with a `/`.
- Use `seo-generator.html` (in the repo root) to generate `sitemap.xml` and `robots.txt` using your configuration.

## Multi‑language Setup

You can provide per‑language values by using language maps. The UI language determines which values are used.

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

- Language codes follow the site’s language selector (e.g., `en`, `zh`, `ja`).
- If a language key is missing, the `default` value is used.

## How It Works Internally

- The app loads `site.json` during boot and then renders identity and links.
- The chosen language comes from the current UI language.
- The document title composes as `Page Title · siteTitle`.
- A static fallback (hard‑coded title/subtitle/links) exists in `index.html` and is overridden after `site.json` loads.

## Post Index (`wwwroot/index.json`)

Use this file to list and localize your Markdown posts under `wwwroot/post/`. The app supports a unified, multilingual format per entry.

Example (multilingual entry):

```json
{
  "My First Post": {
    "en": { "title": "My First Post", "location": "post/my-first-post.md" },
    "zh": { "title": "我的第一篇文章", "location": "post/my-first-post.md" },
    "ja": { "title": "最初の投稿", "location": "post/my-first-post.md" },
    "tag": ["Note"],
    "date": "2025-08-13",
    "image": "post/intro/1.png"
  }
}
```

Accepted fields per entry:
- `en`/`zh`/`ja`/`default`: language variants; each is either a string (path) or an object `{ title, location }`.
- `location`: legacy flat shape is also supported at the same level, but prefer the multilingual shape above.
- `tag` or `tags`: string or array; both forms are supported.
- `date`: any ISO-like date; displayed using the current UI language.
- `image` / `cover` / `thumb`: card image in index/search. `thumb` or `cover` preferred; falls back to `image`.

Add a new post (quick steps):
1. Create Markdown in `wwwroot/post/your-post.md`. The first `#` heading becomes the page title if needed.
2. Add an entry to `wwwroot/index.json` as shown above (at least one language block with `location`).
3. Refresh the site; the card appears in the Posts tab, with read-time and date.

## Tabs (`wwwroot/tabs.json`)

Tabs are additional pages (e.g., About, Changelog) under `wwwroot/tab/`. They use a similar multilingual structure.

Example:

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

Notes:
- Place content under `wwwroot/tab/` and reference it via `location`.
- Titles can be customized per language; if a language is missing, `default` (or `en`) is used.
- Tab titles are slugged for internal routing; non‑ASCII titles are supported.

## Tips

- Use relative paths for images. You can keep images alongside posts under `wwwroot/post/...` or in `assets/`. Paths are resolved relative to each Markdown file’s folder.
- Keep external links safe and verified; the app sanitizes URLs.
- Use concise labels for profile links to keep the dot‑separated layout readable.

## Troubleshooting

- If changes don’t appear, ensure you’re running a local server and hard‑refresh the page.
- Check the browser console for JSON parse errors.
- Verify paths like `assets/avatar.png` resolve correctly.
