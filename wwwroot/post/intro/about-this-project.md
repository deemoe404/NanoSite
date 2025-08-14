# About This Project

Welcome to your NanoSite — a tiny, zero-build, GitHub Pages–friendly blog where every post is just a Markdown file in `wwwroot/`. The homepage indexes posts from `wwwroot/index.json`, and the browser handles routing, search, a TOC, and rendering. No frameworks or servers needed.

## What’s inside

- Simple single-page shell: `index.html` + `assets/` CSS/JS
- Content-first: Markdown posts live under `wwwroot/`
- Smart UI: cards with cover, tags, excerpts, and read-time
- Article helpers: generated TOC (H2/H3), heading permalinks, smooth scrolling
- Extras: theme toggle, search by title/tags, About tab via `wwwroot/tabs.json`

## How to add posts

1. Create a Markdown file in `wwwroot/` (e.g., `my-post.md`).
2. Add an entry in `wwwroot/index.json`:

   ```json
   {
     "My Post Title": { "location": "my-post.md", "tag": ["Tag"], "image": "images/cover.png", "date": "2025-08-13" }
   }
   ```

3. Serve locally with `python3 -m http.server 8000` and open `http://localhost:8000`.

## Explore Markdown features

Want to see what the renderer supports (headings, code blocks, tables, task lists, images, links, quotes, and more)?

- See the full demo: [Markdown Showcase →](?id=post/intro/markdown-showcase.md)

## Notes

- Keep paths relative (no leading `/`) to work on GitHub Pages.
- Images can be local under `wwwroot/images/` or remote (`https://...`).
- Query routing is validated against `index.json`, so only registered posts can load.

Happy writing!
