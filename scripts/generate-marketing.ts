// Marketing asset pipeline — generates App Store and Play Store screenshots.
//
// Two-pass architecture:
//   Pass 1: Shell out to take-screenshots.ts for raw app screenshots
//   Pass 2: Render HTML templates in Playwright at exact store dimensions
//
// Usage:
//   npx tsx scripts/generate-marketing.ts              # generate all
//   npx tsx scripts/generate-marketing.ts --only hero   # filter by name
//   npx tsx scripts/generate-marketing.ts --skip-raw    # reuse cached raw
//   npx tsx scripts/generate-marketing.ts --preview     # open index after
//   npx tsx scripts/generate-marketing.ts --list        # list asset names

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  FORMAT_CAPTURE,
  FORMAT_TEMPLATE_OVERRIDE,
  MARKETING_ASSETS,
  STORE_DIMENSIONS,
  type StoreFormat,
} from './marketing-manifest.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(__dirname, 'marketing-templates');
const OUT_DIR = path.resolve(PROJECT_ROOT, 'screenshots', 'marketing');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const RAW_IPAD_DIR = path.join(OUT_DIR, 'raw-ipad');

function rawDirFor(viewport: 'phone' | 'ipad' | 'none'): string {
  return viewport === 'ipad' ? RAW_IPAD_DIR : RAW_DIR;
}

// Store format → output subdirectory
const FORMAT_DIR: Record<StoreFormat, string> = {
  ios69: 'ios',
  ipad13: 'ipad',
  play: 'play',
  'play-feature': 'play',
};

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const skipRaw = args.includes('--skip-raw');
const forceRaw = args.includes('--force-raw');
const preview = args.includes('--preview');
const listMode = args.includes('--list');
const onlyIdx = args.indexOf('--only');
let onlyPattern: string | null = null;
if (onlyIdx >= 0) {
  const onlyValue = args[onlyIdx + 1];
  if (!onlyValue || onlyValue.startsWith('--')) {
    console.error('Error: --only requires a pattern argument.');
    process.exit(1);
  }
  onlyPattern = onlyValue;
}

// ---------------------------------------------------------------------------
// Filter assets
// ---------------------------------------------------------------------------

let assets = MARKETING_ASSETS;
if (onlyPattern) {
  assets = assets.filter((a) => a.name.includes(onlyPattern));
}

if (listMode) {
  for (const a of assets) {
    const fmts = a.formats.join(', ');
    console.log(`${a.name}  [${a.template}]  → ${fmts}`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pass 1: Capture raw screenshots
// ---------------------------------------------------------------------------

/** Screenshots needed for a given capture viewport by the filtered asset list. */
function neededScreenshots(viewport: 'phone' | 'ipad'): string[] {
  const set = new Set<string>();
  for (const asset of assets) {
    const viewports = new Set(asset.formats.map((f) => FORMAT_CAPTURE[f]));
    if (!viewports.has(viewport)) continue;
    for (const s of asset.screenshots) set.add(s);
  }
  return [...set];
}

function captureRawForViewport(viewport: 'phone' | 'ipad'): void {
  const needed = neededScreenshots(viewport);
  if (needed.length === 0) return;
  const dir = rawDirFor(viewport);
  mkdirSync(dir, { recursive: true });

  if (!forceRaw && !skipRaw) {
    const allExist = needed.every((n) =>
      existsSync(path.join(dir, `${n}.png`))
    );
    if (allExist) {
      console.log(
        `Raw ${viewport} screenshots cached (${needed.length} files). Use --force-raw to recapture.`,
      );
      return;
    }
  }
  if (skipRaw) {
    console.log(`Skipping raw ${viewport} capture (--skip-raw).`);
    return;
  }

  console.log(`Capturing ${needed.length} raw ${viewport} screenshots...`);
  const namesArg = needed.join(',');
  const ipadFlag = viewport === 'ipad' ? ' --ipad' : '';
  execSync(
    `npx tsx scripts/take-screenshots.ts --only ${namesArg} --dir "${dir}"${ipadFlag}`,
    { cwd: PROJECT_ROOT, stdio: 'inherit' },
  );
}

function captureRawScreenshots(): void {
  captureRawForViewport('phone');
  captureRawForViewport('ipad');
}

// ---------------------------------------------------------------------------
// Pass 2: Render marketing assets
// ---------------------------------------------------------------------------

async function renderAssets(): Promise<void> {
  const browser = await chromium.launch();
  let totalRendered = 0;

  try {
    for (const asset of assets) {
      for (const format of asset.formats) {
        const dims = STORE_DIMENSIONS[format];
        const outSubdir = path.join(OUT_DIR, FORMAT_DIR[format]);
        mkdirSync(outSubdir, { recursive: true });

        const context = await browser.newContext({
          viewport: { width: dims.width, height: dims.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();

        // Load template (with per-format override so iPad uses tablet frame)
        const template = FORMAT_TEMPLATE_OVERRIDE[format] ?? asset.template;
        const templatePath = path.join(
          TEMPLATES_DIR,
          `${template}.html`,
        );
        await page.goto(pathToFileURL(templatePath).href);
        await page.waitForLoadState('domcontentloaded');

        // Inject data — pull raws from the viewport-matched raw dir.
        const rawDirUrl = pathToFileURL(
          rawDirFor(FORMAT_CAPTURE[format]),
        ).href;
        await page.evaluate(
          (data: {
            screenshotUrls: string[];
            caption?: string;
            subcaption?: string;
            backgroundColor?: string;
          }) => {
            // Set caption text
            const captionEl = document.getElementById('caption');
            if (captionEl && data.caption) captionEl.textContent = data.caption;

            const subcaptionEl = document.getElementById('subcaption');
            if (subcaptionEl) {
              subcaptionEl.textContent = data.subcaption ?? '';
            }

            // Set screenshot src(s)
            if (data.screenshotUrls.length === 1) {
              const img = document.getElementById(
                'screenshot',
              ) as HTMLImageElement | null;
              if (img) img.src = data.screenshotUrls[0];
            } else {
              data.screenshotUrls.forEach((url, i) => {
                const img = document.getElementById(
                  `screenshot-${i}`,
                ) as HTMLImageElement | null;
                if (img) img.src = url;
              });
            }

            // Background color override
            if (data.backgroundColor) {
              document.documentElement.style.setProperty(
                '--bg-color',
                data.backgroundColor,
              );
              document.documentElement.style.setProperty(
                '--bg-gradient',
                'none',
              );
              document.body.style.background = data.backgroundColor;
            }
          },
          {
            screenshotUrls: asset.screenshots.map(
              (name) => `${rawDirUrl}/${name}.png`,
            ),
            caption: asset.caption,
            subcaption: asset.subcaption,
            backgroundColor: asset.backgroundColor,
          },
        );

        // Wait for images to load
        await page.waitForFunction(() => {
          const imgs = document.querySelectorAll('img');
          return [...imgs].every(
            (img) => img.complete && img.naturalHeight > 0,
          );
        }, { timeout: 10_000 });

        // Wait for @font-face fonts to load
        await page.waitForFunction(
          () => document.fonts.status === 'loaded',
          { timeout: 10_000 },
        );

        // Capture
        const outPath = path.join(outSubdir, `${asset.name}.png`);
        await page.screenshot({ path: outPath, type: 'png' });
        console.log(
          `  ${
            FORMAT_DIR[format]
          }/${asset.name}.png  (${dims.width}×${dims.height})`,
        );
        totalRendered++;

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nRendered ${totalRendered} marketing assets.`);
}

// ---------------------------------------------------------------------------
// Index HTML
// ---------------------------------------------------------------------------

function generateIndex(): void {
  const stores = ['ios', 'ipad', 'play'] as const;
  let html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>Marketing Assets</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #eee;
         padding: 2rem; max-width: 1400px; margin: 0 auto; }
  h1 { margin-bottom: 1rem; }
  h2 { color: #aaa; margin: 2rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
  .grid { display: flex; flex-wrap: wrap; gap: 1.5rem; }
  .card { background: #222; border-radius: 8px; padding: 1rem; max-width: 300px; }
  .card img { width: 100%; border-radius: 4px; }
  .card .meta { font-size: 0.85rem; color: #888; margin-top: 0.5rem; }
</style>
</head><body>
<h1>Marketing Assets</h1>
<p style="color:#888">Generated ${new Date().toISOString().slice(0, 16)}</p>\n`;

  for (const store of stores) {
    const dir = path.join(OUT_DIR, store);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    if (files.length === 0) continue;

    const title = store === 'ios'
      ? 'iOS App Store (iPhone 6.9")'
      : store === 'ipad'
      ? 'iOS App Store (iPad 13")'
      : 'Google Play Store';
    html += `<h2>${title}</h2>\n<div class="grid">\n`;
    for (const file of files) {
      html += `<div class="card">
  <img src="${store}/${file}" alt="${file}">
  <div class="meta">${file}</div>
</div>\n`;
    }
    html += `</div>\n`;
  }

  html += `</body></html>`;
  writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  console.log(`Index: ${OUT_DIR}/index.html`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // Pass 1: raw screenshots
  captureRawScreenshots();

  // Verify all raw screenshots exist before rendering
  for (const viewport of ['phone', 'ipad'] as const) {
    const missing = neededScreenshots(viewport).filter(
      (n) => !existsSync(path.join(rawDirFor(viewport), `${n}.png`)),
    );
    if (missing.length > 0) {
      console.error(
        `Missing raw ${viewport} screenshots: ${missing.join(', ')}`,
      );
      console.error('Run without --skip-raw to capture them.');
      process.exit(1);
    }
  }

  // Clean stale output before rendering
  for (const subdir of ['ios', 'ipad', 'play']) {
    const dir = path.join(OUT_DIR, subdir);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }

  // Pass 2: render marketing templates
  console.log(`\nRendering ${assets.length} marketing assets...`);
  await renderAssets();

  // Generate gallery
  generateIndex();

  if (preview) {
    // macOS-only; other platforms would need xdg-open or similar
    execSync(`open "${path.join(OUT_DIR, 'index.html')}"`, {
      stdio: 'ignore',
    });
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
