# Press

![hero](assets/hero.jpeg)

**Where knowledge becomes pages.**

This repository is the Ekily Press source, official documentation site, and Markdown rendering regression corpus.

[![GitHub stars](https://img.shields.io/github/stars/EkilyHQ/Press?style=social)](https://github.com/EkilyHQ/Press/stargazers)
[![License](https://img.shields.io/github/license/EkilyHQ/Press)](https://github.com/EkilyHQ/Press/blob/main/LICENSE)
[![Documentation site](https://img.shields.io/website?url=https%3A%2F%2Fekilyhq.github.io/Press&label=docs)](https://ekilyhq.github.io/Press/)

## What This Repository Is

`Press` is the main development repository for the Ekily Press runtime, themes, editor, official documentation, and realistic Markdown content used to exercise the renderer.

The `wwwroot/` folder is intentionally not minimal. It hosts the official Press documentation, release/history pages, SEO examples, media-heavy examples, and edge-case posts that help catch regressions in Markdown parsing, front matter handling, media resolution, search, tags, SEO metadata, and theme rendering.

## For New Sites

The clean starter template will live in `EkilyHQ/Press-Starter`.

Use that starter repository when you want to create your own site. This repository is useful when you want to develop Press itself, inspect the official documentation source, or test behavior against the full documentation corpus.

Until the starter repository is published, the official documentation site remains the best setup guide:

- Official site: [https://ekilyhq.github.io/Press/](https://ekilyhq.github.io/Press/)
- Documentation: [Documentation for Press](https://ekilyhq.github.io/Press/?id=post%2Fdoc%2Fv2.1.0%2Fdoc_en.md&lang=en)
- Theme contract: [Press Theme Contract](https://ekilyhq.github.io/Press/?id=post%2Ftheme-contract%2Ftheme-contract_en.md&lang=en)
- GitHub Pages guide: [Configure GitHub Pages for Press](https://ekilyhq.github.io/Press/?id=post%2Fpage%2Fgithubpages_en.md&lang=en)

## Repository Layout

- `index.html` - public site entrypoint.
- `index_editor.html` - browser editor entrypoint.
- `assets/` - runtime JavaScript, themes, i18n, schemas, and static assets.
- `wwwroot/` - official documentation site content and Markdown regression corpus.
- `site.yaml` - official documentation site configuration.
- `scripts/` - repository checks and focused regression scripts.

## Development Workflow

Press is a zero-build static site. For local development:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

For local-only content experiments, copy `site.local.example.yaml` to `site.local.yaml` and point it at `wwwroot.local/`. Both files are ignored by git, and the main guard prevents them from entering `main`.

Run the focused checks before merging:

```bash
bash scripts/test-main-guard.sh
bash scripts/test-frontmatter-roundtrip.sh
bash scripts/test-system-release-package.sh
bash scripts/test-system-release-workflow.sh
node --experimental-default-type=module scripts/test-system-updates.js
node --experimental-default-type=module scripts/test-theme-contracts.js
node scripts/test-content-model.js
```

## System Releases

Merges to `main` that change Press runtime files automatically publish a patch release with a dedicated `press-system-vX.Y.Z.zip` update package. The package is intentionally limited to the application shell and runtime assets: `index.html`, `index_editor.html`, `assets/main.js`, `assets/js/`, `assets/i18n/`, `assets/schema/`, and `assets/themes/`.

Official documentation and site content stay out of update packages. Changes that only touch `wwwroot/` do not create a system release, and update packages must never include `wwwroot/`, `site.yaml`, `CNAME`, `robots.txt`, `sitemap.xml`, repository policy files, workflow files, scripts, or site-specific media such as `assets/avatar.png` and `assets/hero.jpeg`.

## Branching

The long-lived `doc` branch is retired. `main` is now the stable source for the runtime and the official documentation site.

Use short-lived `feat/*` or `codex/*` branches for work, then merge them into `main` after review and verification. See [BRANCHING.md](BRANCHING.md) for the full policy.

## Built With Press

- [Press official documentation](https://ekilyhq.github.io/Press/) - the documentation site hosted from this repository.

Want to list your site here? Open a PR with the site URL and a one-line description.

## Roadmap

- Add LaTeX support.
- Implement comments backed by GitHub Discussions.
- Publish the minimal `Press-Starter` template repository.

## License

MIT License © 2025 [Ekily](https://github.com/EkilyHQ)
