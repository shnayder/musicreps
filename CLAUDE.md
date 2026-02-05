# CLAUDE.md

Interactive fretboard trainer for learning guitar note positions.

## Structure

```
main.ts          # Single-file Deno app (HTML/CSS/JS embedded)
docs/index.html  # Built static file for GitHub Pages
```

## Development

```bash
# Run dev server
deno run --allow-net main.ts

# Build for GitHub Pages
deno run --allow-write --allow-read main.ts --build
```

## How It Works

- SVG fretboard with clickable note positions
- Quiz mode: identifies a note, user answers via buttons or keyboard
- Adaptive learning: tracks response times in localStorage, prioritizes slower notes
- String selection persisted in localStorage

## Keyboard Shortcuts (during quiz)

- `C D E F G A B` - answer with natural note
- Letter + `#` - sharp (e.g., C then #)
- Letter + `b` - flat (e.g., D then b)
- `Space` / `Enter` - next question (after answering)
- `Escape` - stop quiz
