#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

version="v9.9.9"
zip_path="${tmp_dir}/press-system-${version}.zip"

bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${tmp_dir}" >/dev/null

if [[ ! -f "${zip_path}" ]]; then
  echo "expected package at ${zip_path}" >&2
  exit 1
fi

entries_file="${tmp_dir}/entries.txt"
unzip -Z1 "${zip_path}" | sed '/\/$/d' > "${entries_file}"

if ! grep -qx "press-system-${version}/index.html" "${entries_file}"; then
  echo "expected package to include index.html" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/index_editor.html" "${entries_file}"; then
  echo "expected package to include index_editor.html" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/system-updates.js" "${entries_file}"; then
  echo "expected package to include system updater code" >&2
  exit 1
fi

blocked='(^|/)(wwwroot/|site\.yaml$|site\.local\.ya?ml$|CNAME$|README\.md$|BRANCHING\.md$|robots\.txt$|sitemap\.xml$|scripts/|\.github/|assets/avatar\.(png|jpe?g)$|assets/hero\.jpeg$)'
if grep -Eq "${blocked}" "${entries_file}"; then
  echo "release package contains files outside the system update boundary:" >&2
  grep -E "${blocked}" "${entries_file}" >&2
  exit 1
fi

allowed="^press-system-${version}/(index\\.html|index_editor\\.html|assets/(main\\.js|js/.*|i18n/.*|schema/.*|themes/.*))$"
while IFS= read -r entry; do
  if [[ ! "${entry}" =~ ${allowed} ]]; then
    echo "unexpected file in system release package: ${entry}" >&2
    exit 1
  fi
done < "${entries_file}"
