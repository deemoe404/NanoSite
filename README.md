# NanoSite

![hero](assets/hero.jpeg)

**A zero-build static site system powered by Markdown.**

This repository is the NanoSite source, official documentation site, and Markdown rendering regression corpus.

[![GitHub stars](https://img.shields.io/github/stars/deemoe404/NanoSite?style=social)](https://github.com/deemoe404/NanoSite/stargazers)
[![License](https://img.shields.io/github/license/deemoe404/NanoSite)](https://github.com/deemoe404/NanoSite/blob/main/LICENSE)
[![Documentation site](https://img.shields.io/website?url=https%3A%2F%2Fnano.dee.moe&label=docs)](https://nano.dee.moe/)

## What This Repository Is

`NanoSite` is the main development repository for the runtime, themes, editor, official documentation, and realistic Markdown content used to exercise the renderer.

The `wwwroot/` folder is intentionally not minimal. It hosts the official NanoSite documentation, release/history pages, SEO examples, media-heavy examples, and edge-case posts that help catch regressions in Markdown parsing, front matter handling, media resolution, search, tags, SEO metadata, and theme rendering.

## For New Sites

The clean starter template will live in `deemoe404/NanoSite-Starter`.

Use that starter repository when you want to create your own site. This repository is useful when you want to develop NanoSite itself, inspect the official documentation source, or test behavior against the full documentation corpus.

Until the starter repository is published, the official documentation site remains the best setup guide:

- Official site: [https://nano.dee.moe/](https://nano.dee.moe/)
- Documentation: [Documentation for NanoSite](https://nano.dee.moe/?id=post%2Fdoc%2Fv2.1.0%2Fdoc_en.md&lang=en)
- GitHub Pages guide: [Configure GitHub Pages for NanoSite](https://nano.dee.moe/?id=post%2Fpage%2Fgithubpages_en.md&lang=en)

## Repository Layout

- `index.html` - public site entrypoint.
- `index_editor.html` - browser editor entrypoint.
- `assets/` - runtime JavaScript, themes, i18n, schemas, and static assets.
- `wwwroot/` - official documentation site content and Markdown regression corpus.
- `site.yaml` - official documentation site configuration.
- `scripts/` - repository checks and focused regression scripts.

## Development Workflow

NanoSite is a zero-build static site. For local development:

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

Merges to `main` that change NanoSite runtime files automatically publish a patch release with a dedicated `nanosite-system-vX.Y.Z.zip` update package. The package is intentionally limited to the application shell and runtime assets: `index.html`, `index_editor.html`, `assets/main.js`, `assets/js/`, `assets/i18n/`, `assets/schema/`, and `assets/themes/`.

Official documentation and site content stay out of update packages. Changes that only touch `wwwroot/` do not create a system release, and update packages must never include `wwwroot/`, `site.yaml`, `CNAME`, `robots.txt`, `sitemap.xml`, repo docs, workflow files, scripts, or site-specific media such as `assets/avatar.jpeg` and `assets/hero.jpeg`.

## Branching

The long-lived `doc` branch is retired. `main` is now the stable source for the runtime and the official documentation site.

Use short-lived `feat/*` or `codex/*` branches for work, then merge them into `main` after review and verification. See [BRANCHING.md](BRANCHING.md) for the full policy.

## Built With NanoSite

- [NanoSite official documentation](https://nano.dee.moe/) - the documentation site hosted from this repository.
- [deemoe's journal](https://dee.moe) - a personal site built with NanoSite.
- [Mrfunnypig's Blog](https://mrfunnypig.github.io/Blog/) - a NanoSite-powered blog.

Want to list your site here? Open a PR with the site URL and a one-line description.

## Roadmap

- Add LaTeX support.
- Implement comments backed by GitHub Discussions.
- Publish the minimal `NanoSite-Starter` template repository.

## License

MIT License © 2025 [deemoe404](https://github.com/deemoe404)
