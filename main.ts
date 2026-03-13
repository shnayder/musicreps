import { assembleHTML, SERVICE_WORKER } from './src/build-template.ts';

// ---------------------------------------------------------------------------
// Version — derived from git at build time
// ---------------------------------------------------------------------------

async function gitText(...args: string[]): Promise<string> {
  const cmd = new Deno.Command('git', {
    args,
    stdout: 'piped',
    stderr: 'null',
  });
  const out = await cmd.output();
  if (!out.success) throw new Error(`git ${args[0]} failed`);
  return new TextDecoder().decode(out.stdout).trim();
}

async function getVersion(): Promise<string> {
  try {
    const [branch, hash] = await Promise.all([
      gitText('rev-parse', '--abbrev-ref', 'HEAD'),
      gitText('rev-parse', '--short=6', 'HEAD'),
    ]);
    if (branch === 'main') {
      // CI sets BUILD_NUMBER via GitHub API — no full history needed.
      const envCount = Deno.env.get('BUILD_NUMBER');
      if (envCount) return `#${envCount}`;
      return hash;
    }
    const suffix = branch.includes('/')
      ? branch.slice(branch.lastIndexOf('/') + 1)
      : branch;
    return `${hash} ${suffix}`;
  } catch {
    return 'dev';
  }
}

// ---------------------------------------------------------------------------
// Bundle JS with esbuild (subprocess for Deno compatibility)
// ---------------------------------------------------------------------------

function resolve(rel: string): string {
  return new URL(rel, import.meta.url).pathname;
}

async function bundleJS(entry = './src/app.ts'): Promise<string> {
  const entryPoint = resolve(entry);
  const appContactEmail = Deno.env.get('APP_CONTACT_EMAIL') || '';
  const appSupportUrl = Deno.env.get('APP_SUPPORT_URL') || '';
  const appTermsUrl = Deno.env.get('APP_TERMS_URL') || '';
  const appPrivacyUrl = Deno.env.get('APP_PRIVACY_URL') || '';
  const cmd = new Deno.Command('npx', {
    args: [
      'esbuild',
      '--bundle',
      '--format=iife',
      '--jsx=automatic',
      '--jsx-import-source=preact',
      `--define:__APP_CONTACT_EMAIL__=${JSON.stringify(appContactEmail)}`,
      `--define:__APP_SUPPORT_URL__=${JSON.stringify(appSupportUrl)}`,
      `--define:__APP_TERMS_URL__=${JSON.stringify(appTermsUrl)}`,
      `--define:__APP_PRIVACY_URL__=${JSON.stringify(appPrivacyUrl)}`,
      entryPoint,
    ],
    stdout: 'piped',
    stderr: 'piped',
  });
  const output = await cmd.output();
  if (!output.success) {
    const err = new TextDecoder().decode(output.stderr);
    throw new Error(`esbuild failed:\n${err}`);
  }
  return new TextDecoder().decode(output.stdout);
}

// ---------------------------------------------------------------------------
// Font embedding — base64-encode woff2 for offline-compatible @font-face
// ---------------------------------------------------------------------------

async function fontFaceCSS(): Promise<string> {
  const fontPath = resolve('./src/DMSerifDisplay-latin.woff2');
  const fontBytes = await Deno.readFile(fontPath);
  const b64 = btoa(String.fromCharCode(...fontBytes));
  return `@font-face {
  font-family: 'DM Serif Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,${b64}) format('woff2');
}`;
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

async function buildHTML(): Promise<string> {
  const [rawCss, fontCss, js, version] = await Promise.all([
    Deno.readTextFile(resolve('./src/styles.css')),
    fontFaceCSS(),
    bundleJS(),
    getVersion(),
  ]);
  return assembleHTML(fontCss + '\n' + rawCss, js).replaceAll(
    '__VERSION__',
    version,
  );
}

// ---------------------------------------------------------------------------
// Component preview page (Preact)
// ---------------------------------------------------------------------------

function assemblePreviewHTML(css: string, previewJs: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Preview &mdash; Music Reps</title>
  <link rel="stylesheet" href="../../src/styles.css">
  <style>
    ${css}
  </style>
  <style>
    /* Preview page overrides */
    body {
      display: block;
      max-width: 720px;
      padding: 2rem 1rem;
      min-height: auto;
      color: var(--color-text);
      line-height: 1.5;
    }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .subtitle { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 2rem; }
    .page-nav { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.8rem; }
    .page-nav a { color: var(--color-brand-dark); text-decoration: none; }
    .page-nav a:hover { text-decoration: underline; }
    h2 {
      font-size: 1.1rem;
      margin: 2.5rem 0 0.75rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--color-border-lighter);
    }
    .preview-section { margin-bottom: 1.5rem; }
    .preview-section h3 {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-light);
      margin: 0 0 0.5rem;
    }
    .preview-frame {
      max-width: 402px;
      border: 1px solid var(--color-border-light);
      border-radius: 8px;
      padding: var(--space-4);
      background: var(--color-bg);
    }
  </style>
</head>
<body>
  <h1>Component Preview</h1>
  <div class="subtitle">
    Preact components rendered with mock data &mdash; edit
    <code>src/ui/preview.tsx</code>, rebuild or refresh <code>/preview</code>.
  </div>
  <div class="page-nav">
    <a href="components.html">Design System &rarr;</a>
    <a href="colors.html">Colors &rarr;</a>
  </div>
  <div id="preview-root"></div>
  <script>
${previewJs}
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Design page copying
// ---------------------------------------------------------------------------

async function copyDesignPages(css: string): Promise<void> {
  const designSrc = resolve('./guides/design');
  const designDst = resolve('./docs/design');
  await Deno.mkdir(designDst, { recursive: true });
  await Deno.writeTextFile(`${designDst}/styles.css`, css);
  for await (const entry of Deno.readDir(designSrc)) {
    if (entry.isFile && entry.name.endsWith('.html')) {
      const content = await Deno.readTextFile(`${designSrc}/${entry.name}`);
      await Deno.writeTextFile(
        `${designDst}/${entry.name}`,
        content.replace('href="../../src/styles.css"', 'href="styles.css"'),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { buildHTML, SERVICE_WORKER as sw };

// ---------------------------------------------------------------------------
// Port selection (find first available port starting from preferred)
// ---------------------------------------------------------------------------

function findOpenPort(start: number): number {
  for (let port = start; port < start + 100; port++) {
    try {
      const listener = Deno.listen({ port });
      listener.close();
      return port;
    } catch (e) {
      if (e instanceof Deno.errors.AddrInUse) continue;
      throw e;
    }
  }
  throw new Error(`No open port found in range ${start}–${start + 99}`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const version = await getVersion();
  const stamp = (html: string) => html.replaceAll('__VERSION__', version);

  if (Deno.args.includes('--build')) {
    const [rawCss, fontCss, js] = await Promise.all([
      Deno.readTextFile(resolve('./src/styles.css')),
      fontFaceCSS(),
      bundleJS(),
    ]);
    const css = fontCss + '\n' + rawCss;
    const html = stamp(assembleHTML(css, js));
    const docsDir = resolve('./docs');
    await Deno.mkdir(docsDir, { recursive: true });
    for (const name of ['apple-touch-icon.png', 'favicon-32x32.png']) {
      await Deno.copyFile(resolve(`./static/${name}`), `${docsDir}/${name}`);
    }
    await Deno.writeTextFile(`${docsDir}/index.html`, html);
    await Deno.writeTextFile(`${docsDir}/sw.js`, SERVICE_WORKER);

    // Component preview page (Preact)
    const previewJs = await bundleJS('./src/ui/preview.tsx');
    const previewHtml = assemblePreviewHTML(css, previewJs);
    await Deno.writeTextFile(
      resolve('./guides/design/components-preview.html'),
      previewHtml,
    );

    // Design pages → docs/design/
    await copyDesignPages(css);

    console.log('Built to docs/index.html + docs/sw.js + docs/design/');
  } else {
    const portArg = Deno.args.find((a) => a.startsWith('--port='));
    let startPort = 8001;
    if (portArg) {
      const parsed = parseInt(portArg.split('=')[1], 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
        startPort = parsed;
      }
    }
    const port = findOpenPort(startPort);
    Deno.serve({ port }, async (req) => {
      const url = new URL(req.url);
      if (url.pathname === '/sw.js') {
        return new Response(SERVICE_WORKER, {
          headers: { 'content-type': 'application/javascript' },
        });
      }
      if (url.pathname === '/preview') {
        const css = await Deno.readTextFile(resolve('./src/styles.css'));
        const pJs = await bundleJS('./src/ui/preview.tsx');
        return new Response(assemblePreviewHTML(css, pJs), {
          headers: { 'content-type': 'text/html' },
        });
      }
      // Re-bundle on every request so source changes are picked up immediately
      const html = await buildHTML();
      return new Response(html, {
        headers: { 'content-type': 'text/html' },
      });
    });
  }
}
