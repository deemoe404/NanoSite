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

1) **Get the project On [GitHub](https://github.com/deemoe404/NanoSite/)**: Fork or simply download ZIP and unzip.
2) **Preview locally** (recommended)
    - In the project folder, start a simple server:
        - macOS/Linux: `python3 -m http.server 8000`
        - Windows (PowerShell): `py -m http.server 8000`
    - Open `http://localhost:8000/` in your browser.
3) **Set your site name and links**
    - Open `site.json` (in the project root) and edit basic settings:

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

🎉 Congratulations! You've set up your NanoSite. For more customization options, check the documentation below.

## Folder Structure

The first dive in before you master NanoSite is get to know the 📂 folder structure.

- `assets/`: Core files for the NanoSite, no changes required for most users.
- `index.html`: The site entry page. You normally won't need to make changes in this file, except for SEO optimization.
- `site.json`: Major site settings (title, subtitle, avatar, profile links).
- `wwwroot/`: Your content — Markdown files and data files.
    - `wwwroot/index.json`: List of posts (what shows on the homepage).
    - `wwwroot/tabs.json`: List of extra tabs (About, Projects, etc.).
    - Images: you can keep images next to your posts under `wwwroot/...`. Use correct relative paths in your Markdown.
- `index_seo.html`: SEO helper (generate sitemap.xml, robots.txt, and starter meta tags).

## SEO Optimization

NanoSite includes built‑in SEO that works without any build process.

### Site Configuration
Add SEO‑related fields in `site.json`:

```json
{
  "siteTitle": { "default": "Your Site Name", "zh": "你的站点名字", ... },
  "siteDescription": { "default": "Your site description", "zh": "你的站点描述", ... },
  "resourceURL": "https://cdn.example.com/path/", 
  "siteKeywords": { "default": "keyword1, keyword2, keyword3" }
}
```

Notes:
- `resourceURL` is optional and used as the base when composing absolute URLs for resources (e.g., OG images). It can include a path and should end with a `/`.
- `siteKeywords` is used by the SEO generator (below) when producing a starter `<meta name="keywords">` for `index.html`. Runtime meta keywords on article pages are derived from post tags.

