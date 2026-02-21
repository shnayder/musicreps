#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
BRANCH="${2:-}"

usage() {
  echo "Usage: $0 production | preview <branch> | cleanup <branch>" >&2
  exit 1
}

case "$MODE" in
  production) ;;
  preview|cleanup) [ -z "$BRANCH" ] && usage ;;
  *) usage ;;
esac

SAFE_NAME=""
[ -n "$BRANCH" ] && SAFE_NAME=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9-]/-/g')

# --- Stash build output before switching branches ---
if [ "$MODE" = "production" ]; then
  mkdir -p /tmp/build
  cp -r docs/* /tmp/build/
  rm -rf /tmp/build/preview
elif [ "$MODE" = "preview" ]; then
  mkdir -p /tmp/preview-build
  cp -r docs/* /tmp/preview-build/
fi

# --- Git setup ---
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# --- Switch to gh-pages ---
if [ "$MODE" = "cleanup" ]; then
  if ! git fetch origin gh-pages 2>/dev/null; then
    echo "gh-pages branch does not exist, nothing to clean up."
    exit 0
  fi
  git checkout -- . 2>/dev/null || true
  git checkout -B gh-pages origin/gh-pages

  if [ ! -d "preview/${SAFE_NAME}" ]; then
    echo "No preview directory found for ${SAFE_NAME}, skipping."
    exit 0
  fi
  rm -rf "preview/${SAFE_NAME}"
  COMMIT_MSG="Cleanup preview: ${BRANCH}"
else
  git checkout -- . 2>/dev/null || true
  if git fetch origin gh-pages 2>/dev/null; then
    git checkout -B gh-pages origin/gh-pages
  else
    git checkout --orphan gh-pages
    git rm -rf .
  fi

  if [ "$MODE" = "production" ]; then
    find . -maxdepth 1 ! -name '.' ! -name '.git' ! -name 'preview' -exec rm -rf {} +
    cp -r /tmp/build/* .
    VERSION=$(grep -o 'v[0-9]\+\.[0-9]\+' index.html | head -1 || echo "unknown")
    COMMIT_MSG="Build production: ${VERSION}"
  else
    rm -rf "preview/${SAFE_NAME}"
    mkdir -p "preview/${SAFE_NAME}"
    cp -r /tmp/preview-build/* "preview/${SAFE_NAME}/"
    COMMIT_MSG="Preview: ${BRANCH}"
  fi
fi

# --- Ensure .nojekyll ---
touch .nojekyll

# --- Regenerate preview/index.html (preview/cleanup only) ---
if [ "$MODE" != "production" ]; then
mkdir -p preview
has_previews=false
for dir in preview/*/; do
  [ "$dir" = "preview/*/" ] && continue
  has_previews=true
  break
done

if [ "$has_previews" = true ]; then
  cat > preview/index.html << 'INDEXEOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Preview Builds</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:2rem auto;padding:0 1rem}
a{display:block;padding:.5rem 0;font-size:1.1rem}
h2{font-size:1rem;margin-top:1.5rem;color:#666}</style></head>
<body><h1>Preview Builds</h1><ul>
INDEXEOF
  for dir in preview/*/; do
    [ "$dir" = "preview/*/" ] && continue
    name="$(basename "$dir")"
    echo "<li><a href=\"${name}/\">${name}</a></li>" >> preview/index.html
    if [ -d "preview/${name}/design" ]; then
      echo "<li style=\"padding-left:1.5rem;font-size:0.9rem\"><a href=\"${name}/design/components.html\">${name} — Design System</a></li>" >> preview/index.html
      echo "<li style=\"padding-left:1.5rem;font-size:0.9rem\"><a href=\"${name}/design/colors.html\">${name} — Color System</a></li>" >> preview/index.html
    fi
  done
  echo "</ul></body></html>" >> preview/index.html
else
  cat > preview/index.html << 'INDEXEOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Preview Builds</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:2rem auto;padding:0 1rem}
p{color:#666;font-size:1.1rem}</style></head>
<body><h1>Preview Builds</h1>
<p>No preview builds currently deployed.</p></body></html>
INDEXEOF
fi
fi # end preview index regeneration

# --- Commit and push ---
if [ "$MODE" = "production" ]; then
  git add -A -- . ':!preview'
else
  git add -A
fi
if git diff --cached --quiet; then
  echo "No changes to deploy."
else
  git commit -m "$COMMIT_MSG"
  git push origin gh-pages
fi
