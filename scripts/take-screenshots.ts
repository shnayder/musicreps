// Fixture-based Playwright screenshot script.
// Navigates to each mode with ?fixtures, dispatches __fixture__ events,
// and captures deterministic screenshots.
//
// Usage:
//   npx tsx scripts/take-screenshots.ts             # 3x PNG (default)
//   npx tsx scripts/take-screenshots.ts --ci         # 1x JPEG (CI mode)
//   npx tsx scripts/take-screenshots.ts --dir ./out  # custom output dir

import { chromium } from 'playwright';
import { ChildProcess, spawn } from 'child_process';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultItems } from '../src/fixtures/items.ts';
import type { FixtureDetail } from '../src/fixtures/quiz-page.ts';
import {
  quizActive,
  quizCorrectFeedback,
  quizRoundComplete,
  quizWrongFeedback,
} from '../src/fixtures/quiz-page.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8001;
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORT = { width: 402, height: 873 };

// Parse CLI flags
const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const dirIdx = args.indexOf('--dir');
const OUT_DIR = dirIdx >= 0 && args[dirIdx + 1]
  ? path.resolve(args[dirIdx + 1])
  : path.resolve(__dirname, '..', 'screenshots');
const DEVICE_SCALE_FACTOR = ciMode ? 1 : 3;
const IMG_EXT = ciMode ? 'jpg' : 'png';
const IMG_TYPE = ciMode ? 'jpeg' as const : 'png' as const;

// ---------------------------------------------------------------------------
// Mode IDs
// ---------------------------------------------------------------------------

const MODE_IDS = [
  'fretboard',
  'ukulele',
  'speedTap',
  'noteSemitones',
  'intervalSemitones',
  'semitoneMath',
  'intervalMath',
  'keySignatures',
  'scaleDegrees',
  'diatonicChords',
  'chordSpelling',
] as const;

// Modes that use QuizEngine (all except speedTap)
const ENGINE_MODES = MODE_IDS.filter((id) => id !== 'speedTap');

// ---------------------------------------------------------------------------
// Screenshot manifest
// ---------------------------------------------------------------------------

type ScreenshotEntry = {
  name: string;
  modeId: string;
  fixture?: FixtureDetail;
};

function buildManifest(): ScreenshotEntry[] {
  const entries: ScreenshotEntry[] = [];

  // All modes: idle + quiz
  for (const modeId of MODE_IDS) {
    entries.push({ name: `${modeId}-idle`, modeId });
    if (modeId !== 'speedTap') {
      entries.push({
        name: `${modeId}-quiz`,
        modeId,
        fixture: quizActive(defaultItems[modeId]),
      });
    }
  }

  // Design moments: correct, wrong, round-complete (semitoneMath)
  entries.push({
    name: 'design-correct-feedback',
    modeId: 'semitoneMath',
    fixture: quizCorrectFeedback(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-wrong-feedback',
    modeId: 'semitoneMath',
    fixture: quizWrongFeedback(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-round-complete',
    modeId: 'semitoneMath',
    fixture: quizRoundComplete(),
  });

  // Fretboard design moments: correct + wrong
  entries.push({
    name: 'design-fretboard-correct',
    modeId: 'fretboard',
    fixture: quizCorrectFeedback(defaultItems.fretboard),
  });
  entries.push({
    name: 'design-fretboard-wrong',
    modeId: 'fretboard',
    fixture: quizWrongFeedback(defaultItems.fretboard),
  });

  return entries;
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

function startServer(): ChildProcess {
  const proc = spawn(
    'deno',
    ['run', '--allow-net', '--allow-read', '--allow-run', 'main.ts'],
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
    },
  );
  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString();
    if (!msg.includes('Listening on')) process.stderr.write(msg);
  });
  return proc;
}

async function waitForServer(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}`);
      if (res.ok) return;
    } catch { /* server not ready yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Starting dev server...');
  const server = startServer();
  try {
    await waitForServer();
    console.log('Server ready.');

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    const page = await context.newPage();

    // Load page with ?fixtures to enable fixture injection
    await page.goto(`${BASE_URL}/?fixtures`);
    await page.waitForLoadState('networkidle');

    // Seed motorBaseline for all engine modes to skip calibration
    for (const ns of ENGINE_MODES) {
      await page.evaluate(
        (key) => localStorage.setItem(key, '500'),
        `motorBaseline_${ns}`,
      );
    }

    // Reload so app picks up seeded baselines
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Build manifest (apply overrides if present)
    let manifest = buildManifest();
    try {
      const overridesPath = path.resolve(__dirname, 'screenshot-overrides.ts');
      const overrides = await import(overridesPath);
      if (overrides.add) manifest = [...manifest, ...overrides.add];
      if (overrides.remove) {
        const removeSet = new Set(overrides.remove);
        manifest = manifest.filter((e) => !removeSet.has(e.name));
      }
    } catch {
      // No overrides file — use defaults
    }

    // Helper: navigate to a mode via page reload + real UI click.
    // Page reload guarantees clean state — no stale mode-active classes,
    // no leftover fixture state, no navigation system desync.
    async function navigateToMode(modeId: string) {
      await page.goto(`${BASE_URL}/?fixtures`);
      await page.waitForLoadState('networkidle');
      await page.click(`[data-mode="${modeId}"]`);
      await page.waitForSelector(`#mode-${modeId}.mode-active`);
    }

    // Helper: capture screenshot
    async function capture(name: string) {
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
      await page.evaluate(
        (sel) => {
          const el = document.querySelector(sel);
          if (el) el.removeAttribute('data-fixture-applied');
        },
        container,
      );

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
      await page.waitForSelector(`${container}[data-fixture-applied="true"]`, {
        timeout: 5000,
      });

      // Wait for derived state → Preact re-render + useEffect side effects
      await page.waitForTimeout(500);
    }

    // --- Capture screenshots ---
    // Each mode switch reloads the page for clean state. After a fixture,
    // the next entry also reloads to clear stale quiz state.
    let currentMode = '';
    let previousHadFixture = false;

    for (const entry of manifest) {
      const needsReload = entry.modeId !== currentMode || previousHadFixture;

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

      await capture(entry.name);
      previousHadFixture = !!entry.fixture;
    }

    await browser.close();
    console.log(`\nDone! ${manifest.length} screenshots in ${OUT_DIR}`);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
