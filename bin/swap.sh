#!/usr/bin/env bash
# Flip the live blue/green colour behind Caddy with a graceful (zero-downtime)
# reload.
#
#   bin/swap.sh          # toggle to the other colour
#   bin/swap.sh blue     # force blue live
#   bin/swap.sh green    # force green live
set -euo pipefail

cd "$(dirname "$0")/.."

SNIPPET="caddy/live-upstream.caddy"
TARGET="${1:-}"

current() {
  if grep -q "app-green" "$SNIPPET" 2>/dev/null; then echo green; else echo blue; fi
}

if [ -z "$TARGET" ]; then
  if [ "$(current)" = "blue" ]; then TARGET=green; else TARGET=blue; fi
fi

if [ "$TARGET" != "blue" ] && [ "$TARGET" != "green" ]; then
  echo "Usage: bin/swap.sh [blue|green]" >&2
  exit 1
fi

cat > "$SNIPPET" <<EOF
reverse_proxy app-${TARGET}:3000 {
	flush_interval -1
}
EOF

echo "Reloading Caddy → live colour: ${TARGET}"
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
echo "Live colour is now: ${TARGET}"
