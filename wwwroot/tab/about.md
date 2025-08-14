## About NanoSite

NanoSite is a zero‑dependency, pure front‑end template for simple blogs and docs. Put your Markdown files in `wwwroot/`, list them in `wwwroot/index.json`, and the browser handles routing, rendering, and the table of contents.

### Features at a glance

- Pure static: ideal for GitHub Pages and other static hosts
- Markdown coverage: headings, lists, links, images, code fences, tables, and checklists
- Table of contents: sticky sidebar with H2/H3 highlighting
- Light/Dark theme: manual toggle with remembered preference
- Safety: URL protocol allow‑list and automatic resolution of relative image paths

### Quick start

1. Add your articles (`*.md`) to `wwwroot/`.
2. Register titles and file names in `wwwroot/index.json`.
3. Preview locally with `python3 -m http.server 8000` and open `http://localhost:8000/`.

### Demos and source

- Markdown showcase: [Open demo](?id=post/intro/markdown-showcase.md)

> Tip: The “All Posts” tab lists everything from `wwwroot/index.json`. This “About” tab is configured by `wwwroot/tabs.json` and mapped to this file.
