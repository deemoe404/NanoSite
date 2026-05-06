#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
output_dir="${2:-dist}"

if [[ ! "${version}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 vMAJOR.MINOR.PATCH [output-dir]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
archive_name="press-system-${version}.zip"
prefix="press-system-${version}/"

system_paths=(
  "index.html"
  "index_editor.html"
  "assets/main.js"
  "assets/js"
  "assets/i18n"
  "assets/schema"
  "assets/themes/native"
  "assets/themes/catalog.json"
)

mkdir -p "${output_dir}"
output_dir="$(cd "${output_dir}" && pwd)"
archive_path="${output_dir}/${archive_name}"
cd "${repo_root}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

payload_dir="${tmp_dir}/${prefix%/}"
mkdir -p "${payload_dir}"

while IFS= read -r file; do
  [[ -n "${file}" ]] || continue
  [[ -f "${file}" ]] || continue
  mkdir -p "${payload_dir}/$(dirname "${file}")"
  cp "${file}" "${payload_dir}/${file}"
done < <(git ls-files --cached --others --exclude-standard -- "${system_paths[@]}" | sort -u)

(
  cd "${tmp_dir}"
  zip -qr "${archive_path}" "${prefix%/}"
)

printf '%s\n' "${archive_path}"
