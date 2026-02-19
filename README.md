# Music Reps

Interactive music theory drill app — fretboard notes, intervals, key signatures,
and more.

**[Try it live](https://shnayder.github.io/musicreps/)**

## Features

- Mobile-responsive SVG fretboard
- Toggle individual strings on/off
- Natural notes only or include accidentals
- Answer via tap/click buttons or keyboard
- Adaptive learning prioritizes notes you're slower on
- Progress persists across sessions (localStorage)

## Development

Requires [Deno](https://deno.land/).

```bash
# Run local dev server on port 8001
deno run --allow-net main.ts

# Build static HTML for GitHub Pages
deno run --allow-write --allow-read main.ts --build
```

## License

MIT
