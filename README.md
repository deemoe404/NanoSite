# NanoSite📝

NanoSite is a lightweight and efficient website generator designed to make the process of creating and managing small personal websites a breeze🍃. Whether you're building a personal blog, a novel repository, a knowledge base, or a simple wiki, NanoSite empowers you to easily publish your content online using just Markdown syntax.

Todo List:

- [ ] Pages
- [ ] Category

## Internationalization (i18n)

NanoSite supports localized UI and localized content listings. You can switch languages via the sidebar dropdown or by adding a `?lang=<code>` parameter to the URL.

### How It Works
- Detection order: `?lang` in URL → previously selected (localStorage) → browser language → default (`en`).
- UI strings are localized in `assets/js/i18n.js` (via `t()` helper) and applied at boot.
- Content is loaded from a single unified JSON (recommended):
  - Posts: `wwwroot/index.json` with per-language variants inside each entry.
  - Tabs: `wwwroot/tabs.json` (single-language or per-language also supported; see legacy notes).
  - Fallback: when a selected language has no entry, the `default` entry is used automatically.
- Legacy per-language files still work: `index.<lang>.json` and `tabs.<lang>.json` are used when a unified file isn’t present.
- All in-app links (tabs, cards, pagination, search) preserve the active `lang`.
- Date formatting uses the active language from `<html lang>`.

### Content File Schema (Unified)
Use one `wwwroot/index.json` and put language variants per post. Example:

```
{
  "My First Post": {
    "en": { "title": "My First Post", "location": "my-first-post.md" },
    "zh": { "title": "我的第一篇文章", "location": "my-first-post.zh.md" },
    "tag": ["Note"],
    "image": "images/cover.png",
    "date": "2025-08-13"
  }
}
```

Rules:
- The renderer picks the chosen language block; if missing, it falls back to the site’s default language (from `<html lang>` or `assets/js/i18n.js`).
- Display title comes from the language block’s `title`; if missing, the default language’s title is used.
- `location` must point to a markdown file under `wwwroot/`.
- `tag`, `image`, and `date` live at the top level of each entry and apply to all languages.

### Tabs Schema (Unified)
Use one `wwwroot/tabs.json` with per-language blocks for each tab entry:

```
{
  "About": {
    "en": { "title": "About", "location": "tab/about.md" },
    "zh": { "title": "关于", "location": "tab/about.md" },
    "ja": { "title": "概要", "location": "tab/about.md" }
  }
}
```

Notes:
- Tabs loader picks the selected language, falling back to the site’s default language.
- You may keep legacy `tabs.<lang>.json`; the app prefers the unified file when present.

### Add a Language
1) Add a new block (e.g., `"ja": { title, location }`) to any entries that support it.
2) Optionally extend UI translations in `assets/js/i18n.js` (`translations` + `languageNames`). Missing UI keys fall back to English.
3) (Optional) Change the default language: set `<html lang="xx">` in `index.html`.

### Language Switcher
- The dropdown options are derived from languages present in content (e.g., `en`, `zh`, `ja` in `index.json`).
- If a post lacks the selected language, it automatically falls back to `default`.

### Tab Slugs (Non‑Latin Titles)
- Tab links use a slug derived from the tab title (e.g., `?tab=about`).
- For non‑Latin titles (e.g., Chinese/Japanese), the site falls back to a stable hash‑based slug (e.g., `?tab=t-kt1p3g`). This ensures tab links work even when a simple ASCII slug can’t be generated.
- Slugs are computed from the localized title, so they will differ per language. If you hand‑write links to tabs in Markdown, prefer the UI‑generated links or ensure you use the slug for that specific language.

### Tips
- If you hand-write links in markdown that navigate within the app (e.g., `?tab=posts` or `?id=...`), include the current `?lang=xx` to preserve language; all generated UI handles this automatically.
- Date formatting and the “min read” suffix are localized.
- Example provided: `wwwroot/index.zh.json` and `wwwroot/tabs.zh.json` use existing English markdown files with Chinese titles.

## Site Config (site.json)

Use a root-level `site.json` (next to `index.html`) to configure the site identity and sidebar links. This file is fetched at runtime, so use a local server when testing.

- Location: `./site.json` (root)
- Serve locally: `python3 -m http.server 8000` then open `http://localhost:8000/`

### Supported Keys
- siteTitle: string or per-language map. Used for the sidebar title, footer site name, and the browser tab suffix (e.g., `Post Title · My Site`).
- siteSubtitle: string or per-language map. Sidebar subtitle.
- avatar: string or per-language map. Path to your avatar image (default `assets/avatar.png`).
- profileLinks: personal links for the sidebar card. Accepts either an array of `{ label, href }` objects or a map of `{ "Label": "https://..." }`. Links render dot-separated (e.g., `GitHub • Blog`).

Per-language values can be provided using an object with language codes and a `default` fallback.

### Example
```
{
  "siteTitle": { "default": "My Site", "zh": "我的站点", "ja": "私のサイト" },
  "siteSubtitle": { "default": "Welcome!", "zh": "欢迎！", "ja": "ようこそ！" },
  "avatar": "assets/avatar.png",
  "profileLinks": [
    { "label": "GitHub", "href": "https://github.com/yourname" },
    { "label": "Blog", "href": "https://example.com" }
  ]
}
```

Notes:
- If `siteTitle`/`siteSubtitle` are per-language objects, the active language variant is used; otherwise the string is used as-is.
- The footer site name mirrors `siteTitle`.
- Profile links open in a new tab and are rendered as a single line separated by `•`.
- The static title/subtitle/link in `index.html` act as a fallback; they are replaced once `site.json` loads.
