# Press Starter Template

This is the minimal repository shape for `EkilyHQ/Press-Starter`.

Use the upstream repository as a GitHub template for new sites. It should include the Press runtime, editor, `native`, Theme Manager, `assets/themes/packs.json`, `assets/themes/catalog.json`, and minimal site content. It should not include the Press official documentation corpus or regression posts.

## Included

- `site.yaml`
- `wwwroot/index.yaml`
- `wwwroot/tabs.yaml`
- Press runtime files from the system release package
- GitHub Pages setup documentation

## Theme Defaults

`themePack` starts as `native`. Install other official themes from Theme Manager after creating the site.

## Runtime Sync

The real `Press-Starter` repository is rebuilt from Press system release packages. Its sync workflow listens for `press-system-release` repository dispatch events from `Press`, supports manual runs, and has a scheduled catch-up run.

The workflow overlays system-owned runtime files from `press-system-vX.Y.Z.zip`, then regenerates a native-only `assets/themes/packs.json`. Starter-owned files such as `.nojekyll`, `site.yaml`, `wwwroot`, `README.md`, and repository metadata are preserved.
