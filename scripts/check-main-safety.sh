#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"

if [[ -n "$BASE_REF" ]]; then
  changed_files="$(git diff --name-only "$BASE_REF" "$HEAD_REF")"
else
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    changed_files="$(git diff --name-only HEAD~1 "$HEAD_REF")"
  else
    changed_files="$(git diff --name-only)"
  fi
fi

echo "Running main safety checks..."

failed=0

if [[ -n "${changed_files}" ]]; then
  blocked_matches="$(printf '%s\n' "${changed_files}" | grep -E '^(wwwroot\.local/|site\.local\.ya?ml$)' || true)"
  if [[ -n "${blocked_matches}" ]]; then
    echo "ERROR: local-only files detected in this change set:"
    printf '%s\n' "${blocked_matches}"
    failed=1
  fi
fi

if [[ ! -f "site.yaml" ]]; then
  echo "ERROR: site.yaml is missing."
  failed=1
else
  content_root="$(
    awk -F: '
      /^contentRoot[[:space:]]*:/ {
        value=$2;
        sub(/[[:space:]]+#.*/, "", value);
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value);
        gsub(/^["'"'"']|["'"'"']$/, "", value);
        print value;
        exit;
      }
    ' site.yaml
  )"

  if [[ -z "${content_root}" ]]; then
    echo "ERROR: site.yaml must define contentRoot."
    failed=1
  elif [[ "${content_root}" != "wwwroot" ]]; then
    echo "ERROR: site.yaml contentRoot must be \"wwwroot\" for main releases (current: \"${content_root}\")."
    failed=1
  fi
fi

if [[ "${failed}" -ne 0 ]]; then
  exit 1
fi

echo "Main safety checks passed."
