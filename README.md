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

### App Store metadata links (build-time)

Settings page links can be configured with environment variables at build time:

- `APP_CONTACT_EMAIL`
- `APP_TERMS_URL`
- `APP_PRIVACY_URL`

Example:

```bash
APP_CONTACT_EMAIL=support@example.com \
APP_TERMS_URL=https://example.com/terms \
APP_PRIVACY_URL=https://example.com/privacy \
deno run --allow-write --allow-read --allow-env main.ts --build
```

## License

MIT
