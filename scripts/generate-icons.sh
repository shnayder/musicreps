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

echo "Generating Android icons..."
RES="android/app/src/main/res"
FG="static/android-foreground.svg"

if [ -d "$RES" ]; then
  # Legacy launcher icons
  for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
    density="${pair%%:*}"; size="${pair##*:}"
    resvg "$SOURCE" "$RES/mipmap-$density/ic_launcher.png" -w "$size" -h "$size"
    resvg "$SOURCE" "$RES/mipmap-$density/ic_launcher_round.png" -w "$size" -h "$size"
    echo "  ${size}x${size} → mipmap-$density/ic_launcher{,_round}.png"
  done

  # Adaptive foreground (108dp canvas with 72dp safe zone)
  for pair in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
    density="${pair%%:*}"; size="${pair##*:}"
    resvg "$FG" "$RES/mipmap-$density/ic_launcher_foreground.png" -w "$size" -h "$size"
    echo "  ${size}x${size} → mipmap-$density/ic_launcher_foreground.png"
  done
else
  echo "  (skipped — android/ not scaffolded)"
fi

echo "Done. Run 'deno task build && npx cap sync' to deploy."
