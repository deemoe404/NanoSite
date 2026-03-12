# Branching Strategy

This repository uses a three-layer branch model to keep development and release clean.

## Branch Roles

- `main`: stable and releasable template branch for users to fork.
- `next`: integration branch for ongoing development (replace the current long-lived `v2` usage).
- `feat/*`: short-lived feature branches, merged into `next`.

Recommended migration:

1. Keep `main` as the default branch.
2. Treat current `v2` as `next` (rename when convenient).
3. Stop using a long-lived `doc` branch for documentation hosting.

## Documentation Rule

- Documentation should live in tracked content folders on `main`, for example:
  - `wwwroot/post/doc/v1.0.0/*`
  - `wwwroot/post/doc/v2.1.0/*`
- This keeps docs versioned with code and removes cross-branch merge complexity.

## Merge Flow

1. Start work from `next` to `feat/<topic>`.
2. Merge `feat/*` into `next` via PR.
3. Periodically merge `next` into `main` when ready for release.
4. Never merge `sandbox/*` branches into `main`.

## Local Testing Data Isolation

Use local-only config and content root:

1. Create `site.local.yaml` (ignored by git).
   Use `site.local.example.yaml` as a template.
2. Set `contentRoot: wwwroot.local`.
3. Put test content under `wwwroot.local/` (ignored by git).

`site.local.yaml` is loaded before `site.yaml`, so local testing does not require editing tracked release config.

## Main Protection Rules

PRs targeting `main` must pass the `Main Guard` workflow:

- Reject local-only files:
  - `site.local.yaml`
  - `site.local.yml`
  - `wwwroot.local/**`
- Ensure `site.yaml` has `contentRoot: wwwroot`.
