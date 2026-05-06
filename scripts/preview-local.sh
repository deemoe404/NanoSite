#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/preview-local.sh [port]

Starts a local NanoSite preview server without assuming that port 8000 is free.

Port selection order:
  1. CLI argument
  2. NANOSITE_PREVIEW_PORT
  3. PREVIEW_PORT
  4. PORT
  5. .codex/preview-port from this worktree
  6. First free port from PREVIEW_BASE_PORT, default 8000

Optional environment:
  NANOSITE_PREVIEW_HOST / PREVIEW_HOST  Bind host, default 127.0.0.1
  PREVIEW_BASE_PORT                    First auto-scan port, default 8000
  PREVIEW_PORT_SCAN                    Number of ports to scan, default 100
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/.." && pwd)"
fi
cd "$repo_root"

host="${NANOSITE_PREVIEW_HOST:-${PREVIEW_HOST:-127.0.0.1}}"
base_port="${PREVIEW_BASE_PORT:-8000}"
scan_count="${PREVIEW_PORT_SCAN:-100}"
port_file=".codex/preview-port"

is_integer() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

is_valid_port() {
  local port="${1:-}"
  is_integer "$port" && (( port >= 1 && port <= 65535 ))
}

require_valid_port() {
  local label="$1"
  local port="$2"
  if ! is_valid_port "$port"; then
    printf 'Invalid %s: %s\n' "$label" "$port" >&2
    exit 2
  fi
}

port_is_free() {
  local port="$1"
  python3 - "$host" "$port" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((host, port))
    except OSError:
        sys.exit(1)
PY
}

pick_free_port() {
  local start="$1"
  local count="$2"
  require_valid_port "PREVIEW_BASE_PORT" "$start"
  if ! is_integer "$count" || (( count < 1 )); then
    printf 'Invalid PREVIEW_PORT_SCAN: %s\n' "$count" >&2
    exit 2
  fi

  local offset port
  for (( offset = 0; offset < count; offset += 1 )); do
    port=$(( start + offset ))
    if (( port > 65535 )); then
      break
    fi
    if port_is_free "$port"; then
      printf '%s\n' "$port"
      return 0
    fi
  done

  printf 'No free preview port found from %s through %s on %s.\n' \
    "$start" "$(( start + count - 1 ))" "$host" >&2
  exit 1
}

selected_port="${1:-${NANOSITE_PREVIEW_PORT:-${PREVIEW_PORT:-${PORT:-}}}}"

if [[ -n "$selected_port" ]]; then
  require_valid_port "preview port" "$selected_port"
  if ! port_is_free "$selected_port"; then
    printf 'Preview port %s is already in use on %s.\n' "$selected_port" "$host" >&2
    exit 1
  fi
else
  if [[ -f "$port_file" ]]; then
    saved_port="$(tr -d '[:space:]' < "$port_file")"
    if is_valid_port "$saved_port" && port_is_free "$saved_port"; then
      selected_port="$saved_port"
    fi
  fi

  if [[ -z "${selected_port:-}" ]]; then
    selected_port="$(pick_free_port "$base_port" "$scan_count")"
  fi
fi

mkdir -p "$(dirname "$port_file")"
printf '%s\n' "$selected_port" > "$port_file"

printf 'Serving %s\n' "$repo_root"
printf 'Preview URL: http://%s:%s/\n' "$host" "$selected_port"
printf 'Port saved to %s\n' "$port_file"

exec python3 -m http.server "$selected_port" --bind "$host"
