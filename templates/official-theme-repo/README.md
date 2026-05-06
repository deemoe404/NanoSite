# Official Press Theme Repository Template

Use this layout for one official theme repository, such as `EkilyHQ/Press-Theme-Arcus`.

## Required Files

- `theme/theme.json` - Press theme manifest with `contractVersion: 1`.
- `theme/theme.css` and `theme/modules/**` - theme runtime files.
- `theme-release.json` - latest release manifest consumed by Press Theme Manager.
- `.github/workflows/theme-release.yml` - release workflow for ZIP, digest, GitHub Release, browser-fetchable artifact, and manifest update.

Theme source belongs in the theme repository under `theme/`. Press only consumes the released ZIP and stages it into a site under `assets/themes/<slug>/`.

## Release Contract

The workflow publishes:

- `press-theme-<slug>-vX.Y.Z.zip`
- a matching ZIP copy under the `release-artifacts` branch for browser `fetch()`
- SHA-256 digest in `theme-release.json`
- file inventory relative to the theme root

The ZIP must normalize to exactly one theme root with root-level `theme.json`; the workflow packages `theme/` as that root and leaves repository metadata out of the ZIP.
