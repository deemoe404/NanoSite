# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Single-page entry that loads CSS/JS and renders content.
- `assets/`: Frontend assets.
  - `styles.css`: Layout and Markdown styles.
  - `script.js`: Client-side Markdown fetch + parser + TOC.
  - `avatar.png`: Sidebar image.
- `wwwroot/`: Site content.
  - `index.json`: Post index mapping title → `{ location, tag }`.
  - `*.md`: Markdown posts; images in `wwwroot/images/`.
- `CNAME`, `.nojekyll`: GitHub Pages config.
- `README.md`, `LICENSE`: Project metadata.

## Build, Test, and Development Commands
- Run locally (Python): `python3 -m http.server 8000` then open `http://localhost:8000`.
- Run locally (Node): `npx serve .` (or any static file server).
- No build step: files are served as-is; the browser executes `assets/script.js`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces for HTML/CSS/JS.
- JavaScript: vanilla ES6+, avoid adding deps; keep functions small and pure.
- HTML IDs/classes: lowercase with hyphens (e.g., `mainview`, `tocview`).
- Content files: prefer kebab-case names (e.g., `my-post.md`); spaces work but are URL-encoded.
- Security: escape user/content input using existing helpers (`escapeHtml`, `escapeMarkdown`); avoid unsafe `innerHTML` for unescaped strings.

## Testing Guidelines
- No automated tests. Use manual checks:
  - Home lists posts from `wwwroot/index.json`.
  - Post view `?id=<file.md>` renders headings, code fences, images, links, tables, and todos.
  - TOC populates in `#tocview`; anchors scroll correctly.
  - Mobile layout stacks columns (≤768px).

## Commit & Pull Request Guidelines
- Commits: concise, imperative, present tense (e.g., `parser: fix code fence handling`).
  - Scope keywords suggested: `parser`, `ui`, `styles`, `content`, `infra`, `docs`.
- PRs: include summary, motivation, before/after screenshots for UI, testing steps, and any content changes to `wwwroot/index.json`.

## Security & Configuration Tips
- GitHub Pages: keep `CNAME` and `.nojekyll` intact; serve from repo root.
- Content safety: only parse Markdown from `wwwroot/`; avoid remote execution and inline scripts in content.
- Filenames: keep `wwwroot/` paths stable; update `index.json` when adding/removing posts.
# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Single-page shell; dynamic title; tabs nav.
- `assets/`: Frontend assets.
  - `styles.css`: Theme variables, layout, article/card/TOC styles.
  - `script.js`: Router, Markdown parser, TOC, search, cards, tabs.
- `wwwroot/`: Content and config.
  - `index.json`: Post registry (see below).
  - `tabs.json`: Extra tabs → markdown (About, etc.).
  - `images/`: Local images used by posts/cards.

## Content & Config
- `wwwroot/index.json` entry:
  - `{ "Title": { "location": "post.md", "tag": "Tag" | ["Tag", "More"], "image": "images/cover.png" | "https://..." } }`
  - `tag` accepts string or array. `image` may be relative (under `wwwroot/`) or absolute.
- `wwwroot/tabs.json` entry:
  - `{ "About": { "location": "about.md" } }` (or a string value).

## Build, Test, and Development Commands
- Local server (Python): `python3 -m http.server 8000` → `http://localhost:8000/`.
- Local server (Node): `npx serve -l 8000 .`.
- No build step; everything is client-side.

## Coding Style & Naming Conventions
- Indentation: 2 spaces. Vanilla ES6+ only.
- Use existing helpers for safety: `escapeHtml`, `sanitizeUrl`, `resolveImageSrc`.
- Keep paths relative for GitHub Pages (no leading `/`).
- IDs/classes: lowercase-hyphenated (e.g., `tocview`, `card-cover`).

## Testing Guidelines
- Manual checks:
  - Home: cards show cover/title/tags; excerpts load; search filters.
  - Article: TOC renders (H2/H3), active highlight on scroll; heading permalinks copy.
  - Tabs: about page loads via `tabs.json`; TOC and search hidden.
  - Images: relative and remote; tables are full-width inside scroll wrapper.

## Commit & Pull Request Guidelines
- Messages: imperative, concise (e.g., `cards: add excerpts`).
- Include scope keywords where helpful: `parser`, `ui`, `styles`, `content`, `infra`, `docs`.
- PRs: summary, before/after screenshots for UI, test steps, config changes (`index.json`, `tabs.json`).

## Security & Configuration Tips
- Sanitization: only allow `http/https/mailto/tel`; resolve relative images under `wwwroot/`.
- Query routing: validate `?id` against `index.json`; block `..`, leading `/`, `\`.
- GitHub Pages: keep `CNAME` and `.nojekyll`; serve from repo root.
