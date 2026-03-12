#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"
BLOCKED_PATH_PATTERN='^(wwwroot\.local/|site\.local\.ya?ml$)'

list_blocked_history_paths() {
  local range_base="$1"
  local range_head="$2"
  local commit=""
  while IFS= read -r commit; do
    [[ -n "${commit}" ]] || continue
    while IFS=$'\t' read -r status path_a path_b; do
      [[ -n "${status}" ]] || continue
      local candidate=""
      case "${status}" in
        D*) continue ;;
        R*|C*) candidate="${path_b:-}" ;;
        *) candidate="${path_a:-}" ;;
      esac
      if [[ -n "${candidate}" ]] && [[ "${candidate}" =~ ${BLOCKED_PATH_PATTERN} ]]; then
        printf '%s\t%s\t%s\n' "${commit}" "${status}" "${candidate}"
      fi
    done < <(git diff-tree --root --no-commit-id --name-status -r -m -M -C "${commit}")
  done < <(git rev-list --reverse --ancestry-path "${range_base}..${range_head}")
}

if [[ -n "$BASE_REF" ]]; then
  range_base="$(git merge-base "$BASE_REF" "$HEAD_REF")"
  changed_files="$(git diff --diff-filter=ACMRTUXB --name-only "${range_base}" "$HEAD_REF")"
else
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    range_base="HEAD~1"
    changed_files="$(git diff --diff-filter=ACMRTUXB --name-only HEAD~1 "$HEAD_REF")"
  else
    range_base=""
    changed_files="$(git diff --diff-filter=ACMRTUXB --name-only)"
  fi
fi

echo "Running main safety checks..."

failed=0

if [[ -n "${range_base}" ]]; then
  blocked_history="$(list_blocked_history_paths "${range_base}" "$HEAD_REF" || true)"
  if [[ -n "${blocked_history}" ]]; then
    echo "ERROR: local-only files were added or modified in this commit range:"
    printf '%s\n' "${blocked_history}"
    failed=1
  fi
elif [[ -n "${changed_files}" ]]; then
  blocked_matches="$(printf '%s\n' "${changed_files}" | grep -E "${BLOCKED_PATH_PATTERN}" || true)"
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
