#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

workflow=".github/workflows/system-release.yml"

if [[ ! -f "${workflow}" ]]; then
  echo "expected ${workflow} to exist" >&2
  exit 1
fi

if ! awk '
  /^  release:/ { in_release = 1; next }
  in_release && /^  [A-Za-z0-9_-]+:/ { in_release = 0 }
  in_release && /^    if:/ { print; found = 1; exit }
  END { if (!found) exit 1 }
' "${workflow}" | grep -F "github.ref == 'refs/heads/main'" >/dev/null; then
  echo "system release job must be guarded to run only on refs/heads/main" >&2
  exit 1
fi

if awk '
  /changed_files="\$\(git diff --name-only/ && /\|\| true/ { found = 1 }
  END { exit found ? 0 : 1 }
' "${workflow}" >/dev/null; then
  echo "system release workflow must not ignore git diff failures while planning releases" >&2
  exit 1
fi

if grep -F 'releases/tags/${NEXT_TAG}' "${workflow}" >/dev/null; then
  echo "system release workflow must not validate draft releases through the tag endpoint" >&2
  exit 1
fi

if ! grep -F 'steps.create.outputs.release_id' "${workflow}" >/dev/null; then
  echo "system release workflow must validate and publish the draft release by release id" >&2
  exit 1
fi

if grep -F 'gh release create' "${workflow}" >/dev/null; then
  echo "system release workflow must create draft releases through the releases API, not gh release create" >&2
  exit 1
fi

if grep -F 'releases-after-create.json' "${workflow}" >/dev/null; then
  echo "system release workflow must not list releases after create to recover the new release id" >&2
  exit 1
fi

if grep -F 'expected exactly one draft release' "${workflow}" >/dev/null; then
  echo "system release workflow must not depend on immediate list visibility after draft creation" >&2
  exit 1
fi

if ! grep -F 'dist/release-created.json' "${workflow}" >/dev/null; then
  echo "system release workflow must persist the draft release creation response" >&2
  exit 1
fi

if ! grep -F 'repos/${GITHUB_REPOSITORY}/releases" --input dist/create-release.json' "${workflow}" >/dev/null; then
  echo "system release workflow must create draft releases through the REST releases API" >&2
  exit 1
fi

if ! grep -F 'uploads.github.com/repos/${GITHUB_REPOSITORY}/releases/${release_id}/assets' "${workflow}" >/dev/null; then
  echo "system release workflow must upload the release asset by release id" >&2
  exit 1
fi

if ! grep -F 'stale-draft-release-ids.txt' "${workflow}" >/dev/null; then
  echo "system release workflow must clean stale draft releases for retry safety" >&2
  exit 1
fi

if grep -F 'release.get("name") == next_tag' "${workflow}" >/dev/null; then
  echo "system release workflow must identify stale releases by tag_name, not editable release names" >&2
  exit 1
fi

if ! grep -F 'release.get("tag_name") == next_tag' "${workflow}" >/dev/null; then
  echo "system release workflow must match stale draft releases by tag_name" >&2
  exit 1
fi

if ! grep -F 'git push --delete origin "${next_tag}"' "${workflow}" >/dev/null; then
  echo "system release workflow must delete stale release tags before retrying" >&2
  exit 1
fi

if ! grep -F 'git tag -d "${next_tag}"' "${workflow}" >/dev/null; then
  echo "system release workflow must delete stale local release tags before retrying" >&2
  exit 1
fi

stale_cleanup_line="$(grep -nF 'stale-draft-release-ids.txt' "${workflow}" | head -n 1 | cut -d: -f1)"
tag_refusal_line="$(grep -nF 'Refusing to overwrite existing tag' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -n "${tag_refusal_line}" && -n "${stale_cleanup_line}" && "${tag_refusal_line}" -lt "${stale_cleanup_line}" ]]; then
  echo "system release workflow must clean stale drafts and tags before refusing an existing tag" >&2
  exit 1
fi
