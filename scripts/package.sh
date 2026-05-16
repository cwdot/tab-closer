#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f manifest.json ]]; then
  echo "error: manifest.json not found in $ROOT" >&2
  exit 1
fi

NAME="$(node -p "require('./manifest.json').name.replace(/\s+/g,'-').toLowerCase()" 2>/dev/null \
  || python3 -c "import json;print(json.load(open('manifest.json'))['name'].replace(' ','-').lower())")"
VERSION="$(node -p "require('./manifest.json').version" 2>/dev/null \
  || python3 -c "import json;print(json.load(open('manifest.json'))['version'])")"

DIST="$ROOT/dist"
OUT="$DIST/${NAME}-${VERSION}.xpi"

mkdir -p "$DIST"
rm -f "$OUT"

# Files to include. Everything tracked in the extension, nothing else.
INCLUDE=(
  manifest.json
  popup.html
  popup.css
  popup.js
  background.js
  icons
)

for f in "${INCLUDE[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "error: missing required file: $f" >&2
    exit 1
  fi
done

# -FS = sync (don't keep stale entries), -X = no extra file attrs, -r = recurse
zip -qr -FS -X "$OUT" "${INCLUDE[@]}" \
  --exclude '*.DS_Store' \
  --exclude '*/.*' \
  --exclude '*~'

echo "built in $DIST"
echo "built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
