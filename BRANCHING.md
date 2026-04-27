# Branching Strategy

NanoSite now uses a simple `main + short-lived branches` model.

## Branch Roles

- `main`: stable source for the NanoSite runtime, official documentation site, and Markdown regression corpus.
- `feat/*`: short-lived feature branches for human-authored work.
- `codex/*`: short-lived implementation branches for Codex-authored work.

The old long-lived `doc` branch is retired. Do not use it for development, documentation hosting, or release work.

## Workflow

1. Start new work from `main`.
2. Create a short-lived branch such as `feat/editor-toolbar` or `codex/main-docs-repo`.
3. Keep runtime changes and documentation updates in the same branch when they describe the same behavior.
4. Run the focused checks before merging:

```bash
bash scripts/test-main-guard.sh
bash scripts/test-frontmatter-roundtrip.sh
```

5. Merge back to `main` after review and verification.
6. Delete the short-lived branch after it has landed.

## Documentation Content

`wwwroot/` is the official documentation site, not a starter template. It is expected to contain realistic documentation, media, release history, SEO examples, and Markdown edge cases.

When a runtime feature changes user-facing behavior, update the relevant documentation in `wwwroot/` in the same branch. This keeps the official site and the code versioned together.

The minimal user starter will live in a separate repository named `NanoSite-Starter`. Do not strip this repository's `wwwroot/` back to a minimal template.

## Local Testing Data Isolation

Use local-only config and content for experiments:

1. Copy `site.local.example.yaml` to `site.local.yaml`.
2. Set `contentRoot: wwwroot.local`.
3. Put local test content under `wwwroot.local/`.

`site.local.yaml`, `site.local.yml`, and `wwwroot.local/` are ignored by git.

## Main Guard

PRs targeting `main` must pass the `Main Guard` workflow. The guard only enforces repository hygiene:

- Reject local-only files:
  - `site.local.yaml`
  - `site.local.yml`
  - `wwwroot.local/**`
- Ensure tracked `site.yaml` keeps `contentRoot: wwwroot`.

The guard does not require `main` to stay minimal. `main` is intentionally the complete development and documentation source.
