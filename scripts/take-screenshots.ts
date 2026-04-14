// Fixture-based Playwright screenshot script.
// Navigates to each mode with ?fixtures&native, dispatches __fixture__ events,
// and captures deterministic screenshots.
//
// Usage:
//   npx tsx scripts/take-screenshots.ts             # 3x PNG (default)
//   npx tsx scripts/take-screenshots.ts --ci         # 1x JPEG (CI mode)
//   npx tsx scripts/take-screenshots.ts --dir ./out  # custom output dir
//   npx tsx scripts/take-screenshots.ts --list       # print all names and exit
//   npx tsx scripts/take-screenshots.ts --only pat   # only names matching pat

import { chromium } from 'playwright';
import { ChildProcess } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FixtureDetail } from '../src/types.ts';
import {
  buildManifest,
  MODE_IDS,
  MODE_TITLES,
  type ScreenshotEntry,
} from './screenshot-manifest.ts';
import { startServer } from '../tests/e2e/helpers/server.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PREFERRED_PORT = 8002;
let BASE_URL = '';
const PHONE_VIEWPORT = { width: 402, height: 873 };
// iPad 13" logical size at 1x (store asset is 2064×2752 at 2x).
const IPAD_VIEWPORT = { width: 1032, height: 1376 };

// Parse CLI flags
const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const dirIdx = args.indexOf('--dir');
const OUT_DIR = dirIdx >= 0 && args[dirIdx + 1]
  ? path.resolve(args[dirIdx + 1])
  : path.resolve(__dirname, '..', 'screenshots');
const ipadMode = args.includes('--ipad');
const VIEWPORT = ipadMode ? IPAD_VIEWPORT : PHONE_VIEWPORT;
const listMode = args.includes('--list');
const onlyIdx = args.indexOf('--only');
const onlyPatterns = onlyIdx >= 0 && args[onlyIdx + 1]
  ? args[onlyIdx + 1].split(',')
  : null;
const touchMode = !args.includes('--no-touch');
const DEVICE_SCALE_FACTOR = ciMode ? 1 : 3;
const IMG_EXT = ciMode ? 'jpg' : 'png';
const IMG_TYPE = ciMode ? ('jpeg' as const) : ('png' as const);

// ---------------------------------------------------------------------------
// Index HTML generation
// ---------------------------------------------------------------------------

function generateIndexHTML(
  manifest: ScreenshotEntry[],
  outDir: string,
  imgExt: string,
): void {
  // Split into mode groups, speed check, design moments, and progress tab
  const modeGroups = new Map<string, ScreenshotEntry[]>();
  const homeEntries: ScreenshotEntry[] = [];
  const speedCheckEntries: ScreenshotEntry[] = [];
  const designEntries: ScreenshotEntry[] = [];
  const progressEntries: ScreenshotEntry[] = [];

  for (const entry of manifest) {
    if (entry.modeId === 'home') {
      homeEntries.push(entry);
    } else if (entry.clickTab === 'progress') {
      progressEntries.push(entry);
    } else if (entry.name.startsWith('design-')) {
      designEntries.push(entry);
    } else if (entry.name.startsWith('speedCheck-')) {
      speedCheckEntries.push(entry);
    } else {
      const group = modeGroups.get(entry.modeId) ?? [];
      group.push(entry);
      modeGroups.set(entry.modeId, group);
    }
  }

  // Label: strip mode prefix for mode shots, strip "design-" for design moments
  function modeLabel(entry: ScreenshotEntry): string {
    const prefix = `${entry.modeId}-`;
    if (entry.name.startsWith(prefix)) return entry.name.slice(prefix.length);
    // Speed Check entries use 'speedCheck-' prefix under speedTap mode
    if (entry.name.startsWith('speedCheck-')) {
      return entry.name.slice('speedCheck-'.length);
    }
    return entry.name;
  }
  function designLabel(entry: ScreenshotEntry): string {
    return entry.name.replace(/^design-/, '').replace(/-/g, ' ');
  }

  function shotHTML(name: string, label: string): string {
    const file = `${name}.${imgExt}`;
    return `<a href="${file}"><img src="${file}" loading="lazy"><span>${label}</span></a>`;
  }

  let sections = '';

  // Home screen section
  if (homeEntries.length > 0) {
    const shots = homeEntries.map((e) => shotHTML(e.name, e.name)).join('\n');
    sections += `<h2>Home</h2>\n<div class="shots">\n${shots}\n</div>\n`;
  }

  // Mode sections in manifest order (preserves MODE_IDS order)
  for (const modeId of MODE_IDS) {
    const entries = modeGroups.get(modeId);
    if (!entries) continue;
    const title = MODE_TITLES[modeId] ?? modeId;
    const shots = entries.map((e) => shotHTML(e.name, modeLabel(e))).join('\n');
    sections += `<h2>${title}</h2>\n<div class="shots">\n${shots}\n</div>\n`;
  }

  // Speed Check section
  if (speedCheckEntries.length > 0) {
    const shots = speedCheckEntries
      .map((e) => shotHTML(e.name, e.name.slice('speedCheck-'.length)))
      .join('\n');
    sections += `<h2>Speed Check</h2>\n<div class="shots">\n${shots}\n</div>\n`;
  }

  // Design moments section
  if (designEntries.length > 0) {
    const shots = designEntries
      .map((e) => shotHTML(e.name, designLabel(e)))
      .join('\n');
    sections +=
      `<h2>Design Moments</h2>\n<div class="shots">\n${shots}\n</div>\n`;
  }

  // Progress tab section
  if (progressEntries.length > 0) {
    const shots = progressEntries
      .map((e) => shotHTML(e.name, designLabel(e)))
      .join('\n');
    sections +=
      `<h2>Progress Tab</h2>\n<div class="shots">\n${shots}\n</div>\n`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Screenshots</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
h2 { margin-top: 2rem; font-size: 1.3rem; }
.shots { display: flex; flex-wrap: wrap; gap: 1rem; }
.shots a { display: block; text-align: center; text-decoration: none; color: #333; max-width: 300px; }
.shots img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
.shots span { display: block; font-size: .85rem; margin-top: .25rem; }
</style></head>
<body>
<h1>Screenshots</h1>
${sections}</body></html>
`;

  const filePath = path.join(outDir, 'index.html');
  writeFileSync(filePath, html);
  console.log(`Generated ${filePath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Build app manifest and apply --only filter
  let manifest = buildManifest();
  if (onlyPatterns) {
    manifest = manifest.filter((e) =>
      onlyPatterns.some((p) => e.name.includes(p))
    );
  }

  // --list: print all names and exit (no browser needed)
  if (listMode) {
    for (const entry of manifest) console.log(entry.name);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  if (manifest.length > 0) {
    console.log('Starting dev server...');
    const { proc: server, portReady } = startServer(PREFERRED_PORT);
    try {
      const port = await portReady;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Server ready on port ${port}.`);

      const browser = await chromium.launch();
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        hasTouch: touchMode,
      });

      const page = await context.newPage();

      // Load page with ?fixtures&native — native mode hides web-only chrome
      // (brand strip, keyboard hints) and enables simulated safe-area insets
      // via body.native-sim so the marketing device-frame overlay doesn't
      // cover app content.
      await page.goto(`${BASE_URL}/?fixtures&native`);
      await page.waitForLoadState('networkidle');

      // Seed shared motor baseline to skip calibration for all modes.
      // All note-button modes share the 'note-button' task type key.
      await page.evaluate(
        () => localStorage.setItem('motorBaseline_note-button', '500'),
      );

      // Reload so app picks up seeded baselines
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Helper: navigate to a mode via page reload + real UI click.
      // Page reload guarantees clean state — no stale mode-active classes,
      // no leftover fixture state, no navigation system desync.
      // modeId 'home' skips the click — the home screen is visible on load.
      async function navigateToMode(modeId: string) {
        await page.goto(`${BASE_URL}/?fixtures&native`);
        await page.waitForLoadState('networkidle');
        if (modeId === 'home') return;
        await page.click(`[data-mode="${modeId}"]`);
        await page.waitForSelector(`#mode-${modeId}.mode-active`);
      }

      // Helper: capture screenshot
      async function capture(name: string) {
        // Move mouse to top-left corner to clear any hover state
        await page.mouse.move(0, 0);
        const filePath = path.join(OUT_DIR, `${name}.${IMG_EXT}`);
        await page.screenshot({
          path: filePath,
          type: IMG_TYPE,
          ...(ciMode ? { quality: 80 } : {}),
        });
        console.log(`  ${name}.${IMG_EXT}`);
      }

      // Helper: dispatch fixture and wait for application
      async function applyFixture(modeId: string, fixture: FixtureDetail) {
        const container = `#mode-${modeId}`;

        // Clear previous fixture-applied marker
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.removeAttribute('data-fixture-applied');
        }, container);

        // Dispatch __fixture__ custom event
        await page.evaluate(
          ({ sel, detail }) => {
            const el = document.querySelector(sel);
            if (!el) throw new Error(`Container not found: ${sel}`);
            el.dispatchEvent(
              new CustomEvent('__fixture__', { detail, bubbles: false }),
            );
          },
          { sel: container, detail: fixture },
        );

        // Wait for fixture to be applied (Preact re-render + derived state)
        await page.waitForSelector(
          `${container}[data-fixture-applied="true"]`,
          { timeout: 5000 },
        );

        // Wait for derived state → Preact re-render + useEffect side effects
        await page.waitForTimeout(500);
      }

      // --- Capture all screenshots via fixture injection ---
      let currentMode = '';
      let previousHadFixture = false;
      let previousHadLocalStorage = false;

      for (const entry of manifest) {
        const needsReload = entry.modeId !== currentMode ||
          previousHadFixture || previousHadLocalStorage ||
          !!entry.localStorageData;

        // Seed localStorage before navigation so the reload picks it up
        if (entry.localStorageData) {
          await page.evaluate((data: Record<string, string>) => {
            for (const [k, v] of Object.entries(data)) {
              localStorage.setItem(k, v);
            }
          }, entry.localStorageData);
        }

        if (needsReload) {
          if (entry.modeId !== currentMode) {
            console.log(`Mode: ${entry.modeId}`);
          }
          await navigateToMode(entry.modeId);
          currentMode = entry.modeId;
        }

        if (entry.fixture) {
          await applyFixture(entry.modeId, entry.fixture);
        }

        // Switch to progress tab after navigation
        if (entry.clickTab) {
          const sel = `#mode-${entry.modeId} [data-tab="${entry.clickTab}"]`;
          await page.click(sel);
          await page.waitForTimeout(200);
        }

        // Optional extra clicks (e.g. open a modal) after navigation, fixture,
        // and tab switch. Scoped to the current mode container.
        if (entry.clickSelectors) {
          for (const selector of entry.clickSelectors) {
            const scoped = `#mode-${entry.modeId} ${selector}`;
            await page.click(scoped);
            await page.waitForTimeout(200);
          }
        }

        await capture(entry.name);
        previousHadFixture = !!entry.fixture;

        // Clean up seeded localStorage for next entry
        if (entry.localStorageData) {
          await page.evaluate((keys: string[]) => {
            for (const k of keys) localStorage.removeItem(k);
          }, Object.keys(entry.localStorageData));
          previousHadLocalStorage = true;
        } else {
          previousHadLocalStorage = false;
        }
      }

      await browser.close();
      console.log(`Captured ${manifest.length} app screenshots.`);
    } finally {
      server.kill();
    }
  }

  generateIndexHTML(manifest, OUT_DIR, IMG_EXT);
  console.log(`\nDone! ${manifest.length} screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
