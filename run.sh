#!/usr/bin/env bash
# Wrapper invoked by OpenDeck as the plugin's CodePath.
# Resolves node via devbox so the plugin works regardless of the host's PATH.
set -euo pipefail
cd "$(dirname "$0")"

# Use the host's `node` if it's on PATH; fall back to devbox for the dev machine.
if command -v node >/dev/null 2>&1; then
  exec node plugin.js "$@"
elif command -v devbox >/dev/null 2>&1; then
  exec devbox run -- node plugin.js "$@"
else
  echo "claudegauge: no 'node' on PATH and no devbox available" >&2
  exit 127
fi
