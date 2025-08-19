---
title: Documentation for NanoSite
date: 2025-08-17
tags:
  - NanoSite
  - Documentation
excerpt: Create a content site directly from Markdown files with no build steps—just place them in wwwroot/, list them in JSON, and publish (works with GitHub Pages). The guide covers project structure, config files, content loading, themes, search, tags, SEO, media, and deployment tips.
author: deemoe
---

# NanoSite Documentation

Build a content site from plain Markdown files with zero build steps. Drop Markdown into `wwwroot/`, list them in JSON, and publish (GitHub Pages friendly).

This page explains:

- Project structure and routing
- Every config file and its parameters
- How content is loaded (posts, tabs, multi-language)
- Themes, search, tags, SEO, images/videos
- Deployment and common recipes


## Project structure

- `index.html` — Entry page with basic meta tags and containers for content, sidebar, and tabs. JS mounts the app here.
- `site.json` — Site-wide settings (titles, avatar, theme defaults, etc.).
- `assets/` — UI code and styles; no build required.
  - `assets/main.js` — App bootstrap and router.
  - `assets/js/*.js` — Features (i18n, markdown, search, theme, SEO, etc.).
  - `assets/themes/` — Theme packs CSS and `packs.json` (list of available packs).
- `wwwroot/` — All content and data.
  - `wwwroot/index.json` — Posts index (what appears on the home page and search).
  - `wwwroot/tabs.json` — Static tab pages (About, Gallery, etc.).
  - `wwwroot/post/**` — Markdown posts and assets.
  - `wwwroot/tab/**` — Markdown for static tabs.
- Optional root files for SEO/CDN: `sitemap.xml`, `robots.txt`, `CNAME`.


## How routing works

Client-side router reads URL query params:

- `?tab=posts` — All posts (default). Supports `&page=N` for pagination.
- `?tab=search&q=term` — Search by title or tag. Can filter by `&tag=TagName`.
- `?id=path/to/post.md` — Open a specific post (location must exist in `index.json`).
- `?lang=en` — UI/content language. Persisted in localStorage, with browser and `<html lang>` fallbacks.

Links in Markdown can navigate within the site: `[See this](?id=post/frogy/main.md)` or tabs: `[About](?tab=about)`.


## Content authoring

Write Markdown in `wwwroot/`. Recommended front matter (optional but useful for SEO and cards):

```markdown
---
title: My Article Title
date: 2025-08-18
tags: [TagA, TagB]
excerpt: One-sentence summary used on cards and meta description.
author: your-name
image: path/to/cover.jpg   # optional; used for social preview
---

# Heading 1

Body text...
```

Notes:

- If `index.json` doesn’t provide metadata, the loader reads front matter for `title`, `date`, `tags`, `excerpt`, and `image`.
- First H1 is used in-page; the card title comes from `index.json` or front matter title.


## Posts index: `wwwroot/index.json`

Supports three shapes. Pick the one that fits your workflow.

1) Simplified per-language paths (current repo uses this). The app fetches the Markdown and derives metadata from front matter:

```json
{
  "nanoSite": {
    "en": "post/meet-nanosite/main_en.md",
    "zh": "post/meet-nanosite/main_zh.md",
    "ja": "post/meet-nanosite/main_ja.md"
  },
  "nanodoc": {
    "en": "post/meet-nanosite/doc_en.md"
  }
}
```

2) Unified entries with full metadata per language (title + location), plus optional top-level fields:

```json
{
  "My First Post": {
    "en": { "title": "My First Post", "location": "post/foo.md", "excerpt": "..." },
    "zh": { "title": "我的第一篇", "location": "post/foo_zh.md" },
    "tag": ["Note"],
    "date": "2025-08-13",
    "image": "post/cover.jpg",
    "thumb": "post/thumb.jpg",
    "cover": "post/cover-wide.jpg"
  }
}
```

3) Legacy flat map (single-language):

```json
{
  "My First Post": { "location": "post/foo.md", "tag": ["Note"], "date": "2025-08-13", "image": "..." }
}
```

Fields (any shape):

- `location` — Required path to the Markdown file, relative to `wwwroot/`.
- `title` — Display title (unified shape). Otherwise derived from key/front matter.
- `tag` / `tags` — Array or comma string. Used for search, tag filters, and meta keywords.
- `date` — ISO or YYYY-MM-DD. Shown on cards and for “outdated content” checks.
- `image` / `cover` / `thumb` — Preferred in this order for card/social images. `thumb` is a smaller image for listing cards; `cover`/`image` are fallbacks.
- `excerpt` — Short summary shown on cards and SEO description. If omitted, auto-extracted from first paragraph.

Behavior:

- When using the simplified shape, metadata comes from Markdown front matter.
- Cross-language navigation: if a link points to `main_en.md` but the UI is `zh`, the router can redirect to the `zh` variant when available.
- Only `location`s present in `index.json` are allowed; unknown `?id=` shows a friendly error.


## Tabs: `wwwroot/tabs.json`

Tabs are static pages. Use the same three shapes as posts. Example (current repo):

```json
{
  "gallery": { "en": { "title": "Gallery", "location": "tab/gallery.md" } },
  "publications": { "en": { "title": "Publications", "location": "tab/publications.md" } },
  "About": {
    "en": { "title": "About", "location": "tab/about/en.md" },
    "zh": { "title": "关于", "location": "tab/about/zh.md" }
  }
}
```

Notes:

- The slug in URLs (e.g., `?tab=about`) is derived from the base title and kept stable across languages.
- The tab page title used in the browser/SEO is the `title` defined in `tabs.json`.


## Site settings: `site.json`

```json
{
  "siteTitle": { "default": "deemoe's journal", "zh": "deemoe 的日志", "ja": "deemoe のジャーナル" },
  "siteSubtitle": { "default": "Thanks for playing my game.", "zh": "眼见何事..." },
  "siteDescription": { "default": "deemoe's journal" },
  "resourceURL": "https://dee.moe/wwwroot/",
  "siteKeywords": { "default": "static blog, markdown, github pages, blog" },
  "avatar": "assets/avatar.png",
  "profileLinks": [ { "label": "GitHub", "href": "https://github.com/you" } ],
  "contentOutdatedDays": 180,
  "themeMode": "user",
  "themePack": "minimalism",
  "themeOverride": true,
  "cardCoverFallback": false,
  "reportIssueURL": "https://github.com/<owner>/<repo>/issues/new"
}
```

Parameters:

- `siteTitle` — String or per-language object. Used in site card, footer, and SEO.
- `siteSubtitle` — Optional string or per-language object. Shown in the site card.
- `siteDescription` — Used as default meta description when a page doesn’t provide one.
- `resourceURL` — Base URL prefix for absolute resource links in SEO (e.g., OG images). Should end with `/`.
- `siteKeywords` — Starter keywords used by the SEO generator; runtime keywords on articles come from tags.
- `avatar` — Path/URL to site avatar used in cards and as default social image when a post has no image.
- `profileLinks` — Array of `{ label, href }` shown as social links in the site card.
- `contentOutdatedDays` — If a post’s `date` is older than this many days, show a dismissible “outdated” note at the top of the post.
- `themeMode` — "dark" | "light" | "auto" | "user". When `themeOverride` is true, this is enforced.
- `themePack` — One of the packs in `assets/themes/packs.json` (e.g., `native`, `github`, `apple`, `openai`, `minimalism`).
- `themeOverride` — When true (default), enforce `themeMode` and `themePack` over user choices. When false, they act as defaults.
- `cardCoverFallback` — If true (default behavior when missing), listing cards render a colorful initial when no cover image is provided; set `false` to hide fallback covers.
- `reportIssueURL` — Optional. Enables a button in the error overlay to report issues (e.g., to a GitHub New Issue URL).


## Themes and UI tools

- Theme toggle and theme pack selector are in the sidebar (Tools). Packs are defined in `assets/themes/packs.json` and their CSS in `assets/themes/<pack>/theme.css`.
- Site owners can set defaults via `site.json` (see above). Users can still change via UI if `themeOverride` is `false`.
- Language selector shows available UI/content languages. Content languages are auto-detected from `index.json`/`tabs.json` when using unified/simplified formats.


## Search, tags, and pagination

- Search matches titles and tags. Press Enter in the sidebar search box.
- Tag sidebar aggregates tags from the posts index; click a tag to filter.
- Lists paginate (8 items per page). Use `?page=N` in `posts` or `search` views.


## Images and videos

Images

- Regular Markdown syntax works: `![Alt](relative/or/absolute.png "optional title")`.
- Images lazy-load with skeleton placeholders and maintain aspect ratio to avoid layout shift.

Videos via image syntax (auto-detected by extension):

```markdown
![Demo video](post/demo.mov "poster=post/frame.jpg | formats=mp4,webm")
```

Title helpers (optional):

- `poster=...` — Set a poster image; otherwise the page tries to auto-capture a frame.
- `sources=a.mp4,b.webm` — Additional explicit sources.
- `formats=mp4,webm` — Auto-generate source URLs by swapping the extension.


## Internal link cards (nice previews)

If a paragraph contains only a link to a post (e.g., `?id=...`), it’s upgraded to a rich card with cover, excerpt, date, and read time. To force a card when inline, set `title` to include `card` or add `data-card`:

```markdown
[Read the guide](?id=post/meet-nanosite/doc_en.md "card")
```


## SEO (built-in)

Runtime SEO updates meta tags per page (title, description, Open Graph, Twitter Card) and injects structured data (JSON-LD) for posts and site. Sources in order:

1) Front matter in the Markdown (`title`, `excerpt`, `tags`, `date`, `image`)
2) Metadata from `index.json`
3) Auto-extracted fallback (H1/first paragraph) and generated fallback image

You can also open `index_seo.html` to generate `sitemap.xml`, `robots.txt`, and starter `<head>` tags based on your `site.json`.

Tip: Set `resourceURL` in `site.json` if your images are served from a CDN.


## Multi‑language

- UI strings are in `assets/js/i18n.js` (English, 中文, 日本語 included). Add more by extending `translations` and `languageNames`.
- Content supports:
  - Simplified per-language paths (as in this repo)
  - Unified entries with per-language blocks
  - Legacy per-language JSON files (`index.en.json`, `index.zh.json`, ...), used as a fallback
- The router keeps you on the same article when switching languages if a variant exists.


## Deploy

GitHub Pages

1) Push this repository
2) Settings → Pages → Branch: `main`, Path: `/ (root)`
3) Optional custom domain: set `CNAME` and configure DNS

Local preview (no build required):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```


## Troubleshooting

- If the page looks empty after edits, validate your JSON (no trailing commas, double quotes only).
- Paths in `index.json`/`tabs.json` must be relative to `wwwroot/`.
- Some browsers block `file://` fetches; always preview via a local server.
- Post not found? Ensure its `location` appears in `wwwroot/index.json`.


## Quick recipes

- Add a post quickly (simplified format):

  1) Create `wwwroot/post/new.md` with front matter
  2) Add to `wwwroot/index.json`:

  ```json
  { "New Post": { "en": "post/new.md" } }
  ```

- Add a tab:

  1) Create `wwwroot/tab/about.md`
  2) Add to `wwwroot/tabs.json`:

  ```json
  { "About": { "en": { "title": "About", "location": "tab/about.md" } } }
  ```

- Enforce a theme site-wide:

  ```json
  { "themeMode": "dark", "themePack": "apple", "themeOverride": true }
  ```

Happy writing.



