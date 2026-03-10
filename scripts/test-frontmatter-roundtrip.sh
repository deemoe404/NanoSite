#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node --experimental-default-type=module scripts/test-frontmatter-roundtrip.js
