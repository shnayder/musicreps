// Minimal HTML shell for static legal pages (privacy, terms).
// Intentionally self-contained: inline styles, no JS, no fonts — renders on
// any browser including the barebones ones crawled by app-store reviewers.

import { marked } from 'npm:marked@^18.0.0';

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------

export async function renderMarkdown(md: string): Promise<string> {
  // marked.parse can be Promise<string> depending on options; always await
  // to keep the build pipeline type-safe regardless of marked's config.
  return await marked.parse(md);
}

// ---------------------------------------------------------------------------
// HTML shell — matches the app's brand palette without importing styles.css
// (styles.css is tightly coupled to the SPA structure and way too big for a
// static legal page).
// ---------------------------------------------------------------------------

const LEGAL_CSS = `
  :root {
    --color-bg: #faf7f2;
    --color-text: #1f2a24;
    --color-muted: #6b7a72;
    --color-brand: #1a4d2e;
    --color-border: #e2ded5;
    --max-width: 42rem;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--color-bg); color: var(--color-text); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.55;
    padding: 2rem 1.25rem 4rem;
  }
  main {
    max-width: var(--max-width);
    margin: 0 auto;
  }
  header.brand {
    max-width: var(--max-width);
    margin: 0 auto 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  header.brand > a {
    display: inline-block;
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--color-brand);
    text-decoration: none;
  }
  header.brand nav {
    display: inline-block;
    margin-left: 1rem;
  }
  header.brand nav a {
    font-size: 0.9rem;
    color: var(--color-muted);
    font-weight: 400;
    margin-right: 0.75rem;
    text-decoration: none;
  }
  header.brand nav a:hover { color: var(--color-brand); }
  h1 { font-size: 1.9rem; margin: 0 0 0.25rem; color: var(--color-brand); }
  h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 0.35rem; }
  p, li { font-size: 1rem; }
  p { margin: 0 0 1rem; }
  ul, ol { padding-left: 1.5rem; margin: 0 0 1rem; }
  li { margin-bottom: 0.35rem; }
  em { color: var(--color-muted); font-style: italic; }
  a { color: var(--color-brand); }
  footer {
    max-width: var(--max-width);
    margin: 3rem auto 0;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.85rem;
    color: var(--color-muted);
  }
  footer a { color: var(--color-muted); }
`;

export function assembleLegalHTML(
  { title, bodyHTML }: { title: string; bodyHTML: string },
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Music Reps</title>
  <style>${LEGAL_CSS}</style>
</head>
<body>
  <header class="brand">
    <a href="./index.html">Music Reps</a>
    <nav>
      <a href="./privacy.html">Privacy</a>
      <a href="./terms.html">Terms</a>
    </nav>
  </header>
  <main>
    ${bodyHTML}
  </main>
  <footer>
    <a href="./index.html">← Back to app</a>
  </footer>
</body>
</html>
`;
}
