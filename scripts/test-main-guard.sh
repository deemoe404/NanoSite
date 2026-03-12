#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

cd "${tmp_dir}"
git init -q
git config user.email "test@example.com"
git config user.name "NanoSite Test"

cat > site.yaml <<'EOF'
nested:
  contentRoot: wrong
contentRoot: wwwroot
EOF

"${repo_root}/scripts/check-main-safety.sh" >/dev/null

cat > site.yaml <<'EOF'
nested:
  contentRoot: wrong
contentRoot: wwwroot.local
EOF

if "${repo_root}/scripts/check-main-safety.sh" >/dev/null 2>&1; then
  echo "expected main guard to reject non-wwwroot top-level contentRoot" >&2
  exit 1
fi
