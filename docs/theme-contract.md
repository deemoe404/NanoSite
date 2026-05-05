# NanoSite Theme Contract

NanoSite themes are zero-build theme packs under `assets/themes/<pack>/`.
Each pack is entered through `theme.json`; the runtime loads the manifest,
mounts the listed modules, and then exposes a stable context to theme code.

The core runtime owns site configuration, language and content indexes,
Markdown parsing, routing state, SEO metadata, safe insertion helpers, cache
policy, error reporting, and the content model. Themes own the presentation
layer: page skeleton, regions, view markup, component choice, and visual
effects.

## Manifest

```json
{
  "$schema": "../../schema/theme.json",
  "name": "Native",
  "version": "3.4.0",
  "contractVersion": 1,
  "styles": ["theme.css"],
  "modules": ["modules/layout.js", "modules/interactions.js"],
  "views": {
    "post": { "hook": "renderPostView" },
    "posts": { "hook": "renderIndexView" },
    "search": { "hook": "renderSearchResults" },
    "tab": { "hook": "renderStaticTabView" },
    "error": { "hook": "renderErrorState" },
    "loading": { "hooks": ["renderPostLoadingState"] }
  },
  "regions": {
    "main": { "required": true, "aliases": ["mainview"] },
    "toc": { "aliases": ["tocview"] },
    "search": { "aliases": ["searchInput"] },
    "nav": { "aliases": ["tabsNav"] },
    "tags": { "aliases": ["tagview"] },
    "footer": { "required": true }
  },
  "components": ["nano-search", "nano-toc", "nano-post-card"],
  "scrollContainer": false,
  "configSchema": { "type": "object", "additionalProperties": true },
  "content": {
    "shapes": ["rawMarkdown", "html", "blocks", "tocTree", "headings", "metadata", "assets", "links"]
  }
}
```

- `name` and `version`: Human-facing theme identity.
- `contractVersion`: NanoSite runtime contract version. The current value is
  `1`.
- `styles`: Ordered CSS files relative to the theme pack root.
- `modules`: Ordered JavaScript modules relative to the theme pack root.
- `views`: Public view states the theme supports. Required views are `post`,
  `posts`, `search`, and `tab`; themes should also declare `error` and
  `loading` states.
- `regions`: Stable region names. Runtime code asks for regions such as
  `ctx.regions.get('main')`, not fixed DOM IDs.
- `components`: Shared primitives the theme uses, such as `nano-search`,
  `nano-toc`, and `nano-post-card`.
- `scrollContainer`: `false` for window scrolling, `true` for a theme-owned
  container, or `region:<name>` when a registered region owns scroll state.
- `configSchema`: JSON-schema fragment for theme-specific configuration.
- `content.shapes`: Content model fields consumed by the theme.

The legacy `contract` object remains in shipped themes as an adapter map for
`window.__ns_themeHooks` and old DOM IDs. New theme code should target the
top-level manifest fields and the `ctx` object.

## Theme API

Theme modules may continue to export `mount(context)`. They may also export a
single API object:

```js
export default {
  mount(ctx) {},
  unmount(ctx) {},
  regions: {},
  views: {
    post(ctx) {},
    posts(ctx) {},
    search(ctx) {},
    tab(ctx) {}
  },
  components: {},
  effects: {}
};
```

The loader merges explicit API exports first. A `mount(ctx)` function may also
return `{ hooks, views, components, effects }` to publish handlers created from
runtime-local state. Legacy hooks are then attached as an adapter, so existing
themes keep working while new themes can implement `views` directly.

## Runtime Context

View render calls receive `ctx` alongside the legacy payload:

- `ctx.document` and `ctx.window`
- `ctx.router` with route key, query, language-aware links, and navigation
- `ctx.i18n` with `t`, current `lang`, and `withLangParam`
- `ctx.content` for post and tab views
- `ctx.regions`, a registry with `get`, `has`, `register`, `registerMany`,
  `list`, and `snapshot`
- `ctx.utilities` for shared helpers such as TOC, images, post nav, lazy
  loading, and safe link helpers
- `ctx.themeConfig`, `ctx.manifest`, and `ctx.theme`

## Region Registry

Theme modules register DOM handles through the registry:

```js
ctx.regions.register('main', mainElement);
ctx.regions.registerMany({ toc: tocElement, search: searchElement });
```

The shipped themes still expose legacy IDs such as `mainview`, `tocview`,
`searchInput`, `tabsNav`, and `tagview`. These IDs are adapter details and are
listed in `contract.domIds` only so the verifier and dev warnings can keep them
visible.

## Content Model

Post and static-tab rendering receives:

```js
{
  rawMarkdown,
  markdown,
  html,
  tocHtml,
  blocks,
  tocTree,
  headings,
  metadata,
  assets,
  links,
  baseDir,
  location
}
```

Simple themes can render `content.html`. Advanced themes can use `blocks`,
`tocTree`, `headings`, `assets`, and `links` to build magazine layouts,
document navigation, card sections, reading progress, or custom media surfaces
without changing core runtime code.

## Shared Components

Shared primitives are optional. A theme can use, wrap, or replace them.

- `nano-search` emits `nano:search`.
- `nano-toc` renders and cleans up TOC listeners.
- `nano-post-card` renders cards and supports `cover`, `meta`, `actions`,
  `footer`, and `tags` content slots.

Component styling should go through exposed attributes, host classes, slots or
slot-like templates, and CSS part names where the component exposes them.
Shipped themes use the default light-DOM render path for their existing class
selectors; custom themes can set `use-shadow` or `render-root="shadow"` on
`nano-search` and `nano-post-card` when they want actual `::part(input)`,
`::part(card)`, and `::part(title)` styling. Theme logic should communicate
through events such as `nano:search`,
`nano:navigate`, and `nano:tag-select` instead of reaching into private DOM.

## Development Checks

Run:

```bash
node scripts/test-theme-contracts.js
```

The verifier checks manifest shape, module/style paths, supported views,
registered regions, shared components, content shapes, legacy hook adapter
coverage, docs/schema synchronization, and direct core dependencies on legacy
DOM IDs.

Set `?themeDev=1` in the browser or `localStorage.ns_theme_dev_mode = "1"` to
log runtime warnings for malformed manifests, undeclared or missing regions,
missing hooks, hook/render errors, and missing legacy DOM IDs.
