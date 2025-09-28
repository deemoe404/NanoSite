# Theme Authoring Guide

The revamped theme system lets you go beyond simple color overrides. Each theme may ship with optional metadata and layout directives that the runtime interprets to configure the UI.

## Theme Manifest (`assets/themes/packs.json`)

* Each entry must expose at least an `id` (or legacy `value`) that matches the folder name under `assets/themes/`.
* `label` and `description` may be either strings or language maps (`{ "default": "…", "zh": "…" }`).
* Additional keys are ignored by the loader, which makes it safe to keep per-theme notes in the manifest.

Example:

```json
{
  "id": "nocturne",
  "label": { "default": "Nocturne", "zh": "夜曲" },
  "description": { "default": "Warm charcoal palette with a left sidebar." }
}
```

## Theme Folder Structure

```
assets/themes/<id>/
  ├── theme.css   // optional CSS overrides
  └── theme.json  // optional configuration metadata
```

`theme.css` behaves exactly as before: it is linked as an additional stylesheet when the pack is active. Use it for bespoke typography, shadows, or component styling.

`theme.json` is new and **optional**. When present, it may contain the following keys:

```json
{
  "label": { "default": "Readable" },
  "description": "Custom summary shown in the picker.",
  "layout": { "sidebar": "left" },
  "variables": {
    "--layout-container-max-width": "70rem",
    "--layout-sidebar-width": "16rem"
  },
  "bodyClass": ["theme-readable"]
}
```

* `layout.sidebar` — accepts `"right"`, `"left"`, or `"hidden"`. It toggles the grid template used by `assets/styles.css`.
* `variables` — a map of CSS custom properties to apply directly on `:root`. Only keys starting with `--` are honoured.
* `bodyClass` / `bodyClasses` / `classes` — optional list (or space-separated string) of classes that will be applied to `<body>`.
* `label` / `description` act as fallbacks for the manifest entry when additional metadata is needed.

All values are sanitized before being written to the DOM or persisted.

## Persistence & Early Boot

* The runtime stores the resolved `layout.sidebar`, variables, and body classes in `localStorage` under the key `__ns_theme_layout_state`.
* `assets/js/theme-boot.js` reads that snapshot before the SPA bootstraps and restores dataset attributes and CSS variables, greatly reducing layout flashes.
* If a theme omits `theme.json`, the site falls back to the base layout with no persisted state.

## CSS Hooks

Core styles now expose layout-related custom properties:

* `--layout-container-max-width`
* `--layout-content-width`
* `--layout-sidebar-width`
* `--layout-gutter`
* `--layout-container-padding`
* `--layout-box-padding`

Themes can override them via `theme.json` or directly in `theme.css`.

The `<body>` element also receives a theme-specific class when `bodyClass` is provided, enabling targeted overrides without resorting to `!important` rules.

## Internationalisation

The picker automatically resolves the correct translation for `label` and `description` using the active UI language. Provide `default` plus any additional language codes you support.

## Legacy Packs

Themes that only include `theme.css` continue to work. They simply use the default layout variables and do not expose extra metadata to the picker.

