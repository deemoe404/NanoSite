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
