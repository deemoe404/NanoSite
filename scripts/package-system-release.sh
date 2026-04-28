#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
output_dir="${2:-dist}"

if [[ ! "${version}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 vMAJOR.MINOR.PATCH [output-dir]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
archive_name="nanosite-system-${version}.zip"
prefix="nanosite-system-${version}/"

system_paths=(
  "index.html"
  "index_editor.html"
  "assets/main.js"
  "assets/js"
  "assets/i18n"
  "assets/schema"
  "assets/themes"
)

mkdir -p "${output_dir}"
output_dir="$(cd "${output_dir}" && pwd)"
archive_path="${output_dir}/${archive_name}"
cd "${repo_root}"

git archive \
  --format=zip \
  --prefix="${prefix}" \
  --output="${archive_path}" \
  HEAD \
  -- "${system_paths[@]}"

printf '%s\n' "${archive_path}"
