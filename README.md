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
- Content listings are loaded per language if present:
  - Posts: `wwwroot/index.<lang>.json`
  - Tabs: `wwwroot/tabs.<lang>.json`
  - Fallback: language-specific → `*.en.json` → base `*.json`.
- All in-app links (tabs, cards, pagination, search) automatically preserve the active `lang`.
- Date formatting uses the active language from `<html lang>`.

### Add a Language
1) Create content listing files (recommended):
- `wwwroot/index.<lang>.json`
- `wwwroot/tabs.<lang>.json`

These mirror the base files’ structure. Titles should be translated; `location` should point to the markdown file for that language. You may:
- Reuse the same `.md` files for all languages, or
- Create language-specific markdown (e.g., `wwwroot/zh/about.md`) and reference those paths in the `<lang>` JSON files.

2) (Optional) Add UI translations:
- In `assets/js/i18n.js`, extend the `translations` object with a `<lang>` entry. Translate strings you care about. Missing keys gracefully fall back to English.

3) (Optional) Change the default language:
- In `index.html`, set `<html lang="xx">` to your preferred default. The JS reads this on boot.

### Language Switcher
- The sidebar “Function Area” contains a “Language” dropdown.
- Changing it updates the URL `?lang`, persists the choice, and reloads the page with localized UI/content.

### Content File Schema
Both `index.*.json` and `tabs.*.json` are plain maps of display titles to settings:

- For posts (index):
  - "My Post": { "location": "my-post.md", "tag": ["Tag1", "Tag2"], "image": "images/cover.png", "date": "YYYY-MM-DD" }
- For tabs:
  - "About": { "location": "about.md" }

Notes:
- `location` must be a relative path under `wwwroot/` and point to an existing `.md` file.
- `tag` can be a string or array of strings.
- `image` is optional; use paths under `wwwroot/`.

### Tips
- If you hand-write links in markdown that navigate within the app (e.g., `?tab=posts` or `?id=...`), include the current `?lang=xx` to preserve language; all generated UI handles this automatically.
- Date formatting and the “min read” suffix are localized.
- Example provided: `wwwroot/index.zh.json` and `wwwroot/tabs.zh.json` use existing English markdown files with Chinese titles.
