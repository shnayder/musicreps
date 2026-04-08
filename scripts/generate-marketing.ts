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
import { fileURLToPath } from 'url';
import {
  MARKETING_ASSETS,
  requiredScreenshots,
  STORE_DIMENSIONS,
  type StoreFormat,
} from './marketing-manifest.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(__dirname, 'marketing-templates');
const OUT_DIR = path.resolve(PROJECT_ROOT, 'screenshots', 'marketing');
const RAW_DIR = path.join(OUT_DIR, 'raw');

// Store format → output subdirectory
const FORMAT_DIR: Record<StoreFormat, string> = {
  ios69: 'ios',
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
const onlyPattern = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

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

function captureRawScreenshots(): void {
  const needed = requiredScreenshots();
  if (!forceRaw && !skipRaw) {
    // Check if all needed screenshots already exist
    const allExist = needed.every((n) =>
      existsSync(path.join(RAW_DIR, `${n}.png`))
    );
    if (allExist) {
      console.log(
        `Raw screenshots cached (${needed.length} files). Use --force-raw to recapture.`,
      );
      return;
    }
  }
  if (skipRaw) {
    console.log('Skipping raw screenshot capture (--skip-raw).');
    return;
  }

  console.log(`Capturing ${needed.length} raw screenshots...`);
  const namesArg = needed.join(',');
  execSync(
    `npx tsx scripts/take-screenshots.ts --only ${namesArg} --dir "${RAW_DIR}"`,
    { cwd: PROJECT_ROOT, stdio: 'inherit' },
  );
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

        // Load template
        const templatePath = path.join(
          TEMPLATES_DIR,
          `${asset.template}.html`,
        );
        await page.goto(`file://${templatePath}`);
        await page.waitForLoadState('domcontentloaded');

        // Inject data
        await page.evaluate(
          (data: {
            screenshots: string[];
            rawDir: string;
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
            if (data.screenshots.length === 1) {
              const img = document.getElementById(
                'screenshot',
              ) as HTMLImageElement | null;
              if (img) {
                img.src = `file://${data.rawDir}/${data.screenshots[0]}.png`;
              }
            } else {
              // Multi-screenshot templates use screenshot-0, screenshot-1, etc.
              data.screenshots.forEach((name, i) => {
                const img = document.getElementById(
                  `screenshot-${i}`,
                ) as HTMLImageElement | null;
                if (img) {
                  img.src = `file://${data.rawDir}/${name}.png`;
                }
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
            screenshots: asset.screenshots,
            rawDir: RAW_DIR,
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

        // Small delay for CSS rendering
        await page.waitForTimeout(100);

        // Capture
        const outPath = path.join(outSubdir, `${asset.name}.png`);
        await page.screenshot({ path: outPath, type: 'png' });
        console.log(`  ${FORMAT_DIR[format]}/${asset.name}.png  (${dims.width}×${dims.height})`);
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
  const stores = ['ios', 'play'] as const;
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

    html += `<h2>${store === 'ios' ? 'iOS App Store' : 'Google Play Store'}</h2>\n<div class="grid">\n`;
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

  // Clean stale output before rendering
  for (const subdir of ['ios', 'play']) {
    const dir = path.join(OUT_DIR, subdir);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }

  // Pass 2: render marketing templates
  console.log(`\nRendering ${assets.length} marketing assets...`);
  await renderAssets();

  // Generate gallery
  generateIndex();

  if (preview) {
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
