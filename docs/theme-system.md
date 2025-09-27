# Theme System Architecture Plan

## 1. Current State and Limitations
- Theme packs are limited to CSS files located under `assets/themes/<pack>/theme.css`.
- Layout of the application is hard-coded in `index.html` with a fixed `.content` + `.sidebar` structure.
- JavaScript modules assume a specific DOM hierarchy, preventing major layout changes.
- End users cannot express theme capabilities (metadata, tokens, layout) without editing source files.

## 2. Goals for the New System
- Allow themes to declare metadata, design tokens, and layout behaviour via a manifest.
- Support multiple layout presets (e.g., classic two-column, single-column, sidebar-left) and custom area definitions.
- Maintain backwards compatibility with existing themes through sensible defaults.
- Enable site owners to override parts of the theme layout in `site.yaml`.
- Keep runtime lightweight (no build step) and avoid blocking initial paint.

## 3. Theme Pack Manifest
Each theme pack now includes a `manifest.json` file alongside `theme.css`.

Key fields (subject to validation but flexible for future versions):
- `name`, `label`, `description`, `version`: metadata shown in UI.
- `layout`: object describing the shell (see §4 for structure).
- `variables`: map of CSS custom properties applied to `:root` for design tokens.
- `bodyClasses`, `shellClasses`, `layoutClasses`: arrays of classes applied to `<body>`, the layout shell, and layout root.
- `assets`: reserved for additional resources (future use, defaults to CSS already loaded via link).

If `manifest.json` is missing, the runtime falls back to the built-in `native` manifest that mimics the current layout.

## 4. Layout Specification
A layout manifest describes how logical modules are arranged.

Terminology:
- **Module**: a semantic block of UI with a `data-ns-module` attribute. Core modules include `tabs`, `main`, `search`, `site-card`, `tags`, `tools`, and `toc`.
- **Area**: container created by the layout engine, typically corresponding to visual regions such as the main column or sidebar.

`layout` fields:
- `preset`: named preset used for defaults (`two-column`, `single-column`, etc.).
- `sidebarPosition`: optional hint (`left` / `right`) for two-column presets.
- `areas`: array of area definitions, each containing:
  - `name`: identifier used for attributes/classes (`ns-area-${name}`).
  - `modules`: ordered list of module keys placed inside the area.
  - `class`: optional extra classes (e.g., `content`, `sidebar`).
  - `as`: optional tag name for the container (default `div`).
- `hiddenModules`: modules to hide entirely (useful for minimal layouts).
- `variables`: CSS custom properties attached to the shell for layout sizing (e.g., `--ns-shell-max-width`).

Areas not listed fall back to the default preset definition. Any modules not assigned to an area are appended to a hidden overflow area unless explicitly hidden.

## 5. Runtime Flow
1. On boot (`initThemeSystem()`), the runtime collects all DOM nodes marked with `data-ns-module`.
2. The default manifest (classic two-column) is applied immediately to avoid layout flashes.
3. The active pack is resolved (`localStorage`, site config) and its manifest is fetched asynchronously.
4. Once loaded, the layout engine rebuilds the shell according to the manifest and applies design tokens/body classes.
5. Changing the pack via UI or config re-runs step 4. Overrides from `site.yaml` (`themeLayout`) are merged before application.
6. Theme controls UI reuses the existing `#tools` module so modules remain relocatable.

## 6. Site Configuration Overrides
`site.yaml` gains an optional `themeLayout` object using the same structure as the manifest `layout`. This lets site owners reorder modules or tweak layout settings without duplicating a theme pack.

Override precedence:
1. Theme manifest provides defaults.
2. `site.yaml` `themeLayout` merges on top.
3. Runtime ensures requested modules exist and ignores unknown keys gracefully.

## 7. Sample Theme Deliverable
- Introduce a new `assets/themes/magazine` pack showcasing a single-column “magazine” layout. It pushes auxiliary modules below the content and uses wider spacing.
- Update `packs.json` so it surfaces in the picker with metadata.
- Ensure existing `native` and `github` packs ship manifests compatible with the new system.

## 8. Compatibility Notes
- `index.html` modules receive `data-ns-module` attributes, plus a reusable empty Tools container.
- JavaScript selectors are updated to prefer `data-ns-area` markers with fallbacks to legacy classes to avoid regressions.
- CSS updates provide base styles for the new `.ns-shell`, `.ns-layout`, and `.ns-area-*` classes while keeping legacy selectors working.

## 9. Testing Strategy
- Manual verification by switching between theme packs (native, GitHub, magazine) ensuring layout adjustments and persisted choice.
- Smoke-test main flows: load posts, open static tab, toggle dark/light, verify TOC/search still works.

