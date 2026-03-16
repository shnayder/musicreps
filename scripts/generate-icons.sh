#!/bin/bash
# Generate all app icon PNGs from the SVG source.
# Requires: resvg (brew install resvg)
#
# Usage: scripts/generate-icons.sh [source.svg]
#   Default source: static/app-icon.svg

set -euo pipefail

SOURCE="${1:-static/app-icon.svg}"

if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found" >&2
  exit 1
fi

if ! command -v resvg &>/dev/null; then
  echo "Error: resvg not found. Install with: brew install resvg" >&2
  exit 1
fi

# Rasterize SVG at 1024x1024 (largest size needed)
echo "Rasterizing $SOURCE → 1024x1024..."
resvg "$SOURCE" "static/icon-1024x1024.png" -w 1024 -h 1024

# Resize to each target using sips (macOS built-in)
resize() {
  local size=$1 dest=$2
  cp "static/icon-1024x1024.png" "$dest"
  sips -z "$size" "$size" "$dest" --out "$dest" >/dev/null
  echo "  ${size}x${size} → $dest"
}

echo "Generating web icons..."
echo "  1024x1024 → static/icon-1024x1024.png"
resize 32  "static/favicon-32x32.png"
resize 180 "static/apple-touch-icon.png"
resize 192 "static/icon-192x192.png"
resize 512 "static/icon-512x512.png"

echo "Generating iOS icon..."
IOS_DEST="ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
cp "static/icon-1024x1024.png" "$IOS_DEST"
echo "  1024x1024 → $IOS_DEST"

echo "Done. Run 'deno task build && npx cap sync ios' to deploy."
