# Theme System Re-architecture Plan

## Goals

* Replace the current CSS-only "pack" concept with a richer theme definition that can also control layout structure, spacing, and component-level variations.
* Preserve backward compatibility so existing packs (`native`, `github`) continue to function without extra metadata.
* Provide a configuration-driven pipeline so future themes can adjust layout without editing core styles.
* Surface metadata (label/description) that the Function Area theme picker can display to help users choose themes.
* Ship a showcase theme inspired by the provided visual reference to verify the new framework.

## Observations from Current Codebase

* Global styling lives in `assets/styles.css` and hardcodes layout dimensions (container width, sidebar width, grid order, etc.).
* Themes today are implemented as standalone CSS overrides under `assets/themes/<pack>/theme.css` with a manifest at `assets/themes/packs.json`.
* JavaScript glue (`assets/js/theme.js`) simply swaps the `<link id="theme-pack">` href and stores the pack in localStorage; there is no knowledge of layout or additional metadata.
* The Function Area UI is rendered via `mountThemeControls()` and populates the theme select from `packs.json`. Labels are static English strings.
* Bootstrapping (`assets/js/theme-boot.js`) immediately applies the saved pack href and dark/light choice.

## Proposed Architecture

1. **Theme Manifest Upgrade**
   * Extend `assets/themes/packs.json` so each entry may include `id` (or legacy `value`), `label`, optional `description`, and flags.
   * Accept labels/descriptions as either plain strings or language maps; fallback to string when unspecified.
   * Cache the parsed manifest in `theme.js` so other helpers (language refresh) can re-render options.

2. **Per-theme Configuration**
   * Allow each theme folder to expose an optional `theme.json` file describing:
     ```json
     {
       "label": "Native",
       "description": "Minimal print layout",
       "layout": {
         "sidebar": "right" | "left" | "hidden"
       },
       "variables": {
         "--layout-container-max-width": "75rem",
         "--layout-content-width": "45rem",
         "--layout-sidebar-width": "18.75rem",
         "--layout-gutter": "1.5rem"
       },
       "bodyClass": ["theme-native"],
       "notes": "Optional extra metadata for future use"
     }
     ```
   * Themes that omit `theme.json` fall back to defaults so legacy packs continue to operate.

3. **Layout Variables & Data Attributes**
   * Refactor `assets/styles.css` to consume CSS variables with sensible fallbacks for container sizing, spacing, and content padding.
   * Introduce `body[data-layout-sidebar="left|right|hidden"]` selectors to flip column order or collapse the sidebar.
   * Ensure mobile breakpoints keep stacking logic intact; the responsive rules continue to work because they target `.container`, `.content`, `.sidebar`, etc.

4. **Runtime Application Logic**
   * Enhance `loadThemePack()` to
     1. Sanitize the requested pack name and update the `<link>` href (current behavior).
     2. Fetch and cache `theme.json` when available.
     3. Clear previously applied CSS variables/body classes/dataset values, then apply the configuration (set custom properties, add/remove classes, assign `data-layout-sidebar`).
     4. Persist the applied layout state in localStorage so early boot can rehydrate it before main JS executes.
   * Track active variables and classes so they can be removed cleanly when switching themes.

5. **Early Boot Support**
   * Update `assets/js/theme-boot.js` to read the persisted layout snapshot (for the last-used pack) and apply dataset/variables synchronously before the page paints, minimizing layout flashes during navigation.

6. **Function Area Enhancements**
   * Populate the theme select using the richer manifest, respecting the current language when label/description are provided as objects.
   * Add a small caption element under the select that displays the active theme's description.
   * Refresh the option labels and caption whenever the language changes by tying into `refreshLanguageSelector()`.

7. **Sample Theme Implementation**
   * Add a new pack `nocturne` (working name) inspired by the screenshot: warm charcoal backgrounds, golden accents, centered content with a left-aligned sidebar, and condensed typography.
   * Provide `theme.json` for `nocturne` that:
     * Moves the sidebar to the left.
     * Narrows the content column and container width.
     * Adjusts spacing via variables instead of hard-coded overrides.
     * Registers a body class for any additional styling hooks.

8. **Backward Compatibility**
   * Supply lightweight `theme.json` descriptors for existing packs (`native`, `github`) that encode their current layout defaults so everything flows through the new pipeline.
   * Maintain `theme.js` exports (`applySavedTheme`, `bindThemePackPicker`, etc.) so other modules remain untouched.
   * Base CSS retains the same fallback values so, in the absence of any theme configuration, the site renders exactly as before.

9. **Documentation**
   * Document the theme configuration schema within the repo so future contributors can author new packs without reading the implementation.

## Implementation Order

1. Refactor base layout CSS to use variables and add sidebar positioning selectors.
2. Extend `theme.js` with manifest parsing, configuration loading, variable/class application, localStorage persistence, and updated UI rendering.
3. Update `theme-boot.js` to restore the saved layout state during early boot.
4. Provide `theme.json` files for `native` and `github` packs.
5. Create the new `nocturne` theme (CSS + JSON + manifest entry) based on the reference style.
6. Add documentation for theme authors.
7. Verify i18n integration (labels/descriptions), layout switching, and compatibility with existing features (posts, tabs, site.yaml overrides, Function Area picker).

## Manual QA (2025-09-27)

* Confirmed theme picker loads manifest metadata after refresh and switches between `native`, `github`, and `nocturne` without layout glitches.
* Verified sidebar position persists across reloads when selecting the Nocturne layout.
* Captured full-page screenshot of the Nocturne theme via Playwright automation for regression reference.
