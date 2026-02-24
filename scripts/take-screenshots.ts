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
// Fixture builders (inline — mirror src/fixtures/quiz-page.ts logic)
// These build the FixtureDetail objects that get dispatched as events.
// ---------------------------------------------------------------------------

type FixtureDetail = {
  engineState?: Record<string, unknown>;
  timerPct?: number;
  timerText?: string;
  timerWarning?: boolean;
  timerLastQuestion?: boolean;
  presentItemId?: string;
};

function quizActiveFixture(itemId: string): FixtureDetail {
  return {
    engineState: {
      phase: 'active',
      currentItemId: itemId,
      answered: false,
      questionStartTime: Date.now(),
      questionCount: 7,
      quizStartTime: Date.now() - 21000,
      quizActive: true,
      answersEnabled: true,
      roundNumber: 1,
      roundAnswered: 6,
      roundCorrect: 4,
      roundTimerExpired: false,
      roundResponseTimes: [],
      roundDurationMs: 0,
      masteredCount: 5,
      totalEnabledCount: 18,
      feedbackText: '',
      feedbackClass: 'feedback',
      feedbackCorrect: null,
      feedbackDisplayAnswer: null,
      timeDisplayText: '',
      hintText: '',
      masteryText: '',
      showMastery: false,
      calibrationBaseline: null,
    },
    timerPct: 65,
    timerText: '0:39',
    timerWarning: false,
    timerLastQuestion: false,
    presentItemId: itemId,
  };
}

function quizCorrectFixture(itemId: string): FixtureDetail {
  return {
    engineState: {
      phase: 'active',
      currentItemId: itemId,
      answered: true,
      questionStartTime: Date.now() - 820,
      questionCount: 14,
      quizStartTime: Date.now() - 32000,
      quizActive: true,
      answersEnabled: false,
      roundNumber: 1,
      roundAnswered: 13,
      roundCorrect: 11,
      roundTimerExpired: false,
      roundResponseTimes: [],
      roundDurationMs: 0,
      masteredCount: 8,
      totalEnabledCount: 18,
      feedbackText: 'Correct!',
      feedbackClass: 'feedback correct',
      feedbackCorrect: true,
      feedbackDisplayAnswer: 'D#',
      timeDisplayText: '0.82s',
      hintText: 'Tap anywhere or press Space for next',
      masteryText: '',
      showMastery: false,
      calibrationBaseline: null,
    },
    timerPct: 55,
    timerText: '0:28',
    timerWarning: false,
    timerLastQuestion: false,
    presentItemId: itemId,
  };
}

function quizWrongFixture(itemId: string): FixtureDetail {
  return {
    engineState: {
      phase: 'active',
      currentItemId: itemId,
      answered: true,
      questionStartTime: Date.now() - 1340,
      questionCount: 22,
      quizStartTime: Date.now() - 42000,
      quizActive: true,
      answersEnabled: false,
      roundNumber: 1,
      roundAnswered: 21,
      roundCorrect: 14,
      roundTimerExpired: false,
      roundResponseTimes: [],
      roundDurationMs: 0,
      masteredCount: 10,
      totalEnabledCount: 20,
      feedbackText: 'Incorrect \u2014 D#',
      feedbackClass: 'feedback incorrect',
      feedbackCorrect: false,
      feedbackDisplayAnswer: 'D#',
      timeDisplayText: '',
      hintText: 'Tap anywhere or press Space for next',
      masteryText: '',
      showMastery: false,
      calibrationBaseline: null,
    },
    timerPct: 38,
    timerText: '0:18',
    timerWarning: false,
    timerLastQuestion: false,
    presentItemId: itemId,
  };
}

function roundCompleteFixture(): FixtureDetail {
  return {
    engineState: {
      phase: 'round-complete',
      currentItemId: null,
      answered: false,
      questionStartTime: null,
      questionCount: 18,
      quizStartTime: Date.now() - 63000,
      quizActive: true,
      answersEnabled: false,
      roundNumber: 1,
      roundAnswered: 18,
      roundCorrect: 16,
      roundTimerExpired: true,
      roundResponseTimes: Array(18).fill(900),
      roundDurationMs: 63000,
      masteredCount: 12,
      totalEnabledCount: 18,
      feedbackText: '',
      feedbackClass: 'feedback',
      feedbackCorrect: null,
      feedbackDisplayAnswer: null,
      timeDisplayText: '',
      hintText: '',
      masteryText: '',
      showMastery: false,
      calibrationBaseline: null,
    },
    timerPct: 0,
    timerText: '0:00',
    timerWarning: false,
    timerLastQuestion: false,
  };
}

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
        fixture: quizActiveFixture(defaultItems[modeId]),
      });
    }
  }

  // Design moments: correct, wrong, round-complete (semitoneMath)
  entries.push({
    name: 'design-correct-feedback',
    modeId: 'semitoneMath',
    fixture: quizCorrectFixture(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-wrong-feedback',
    modeId: 'semitoneMath',
    fixture: quizWrongFixture(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-round-complete',
    modeId: 'semitoneMath',
    fixture: roundCompleteFixture(),
  });

  // Fretboard design moments: correct + wrong
  entries.push({
    name: 'design-fretboard-correct',
    modeId: 'fretboard',
    fixture: quizCorrectFixture(defaultItems.fretboard),
  });
  entries.push({
    name: 'design-fretboard-wrong',
    modeId: 'fretboard',
    fixture: quizWrongFixture(defaultItems.fretboard),
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

    // Helper: switch to a mode via home screen
    async function switchToMode(modeId: string) {
      const backBtn = await page.$('.mode-screen.mode-active .mode-back-btn');
      if (backBtn) {
        await backBtn.click();
        await page.waitForTimeout(200);
      }
      await page.click(`[data-mode="${modeId}"]`);
      await page.waitForTimeout(300);
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

      // Wait for fixture to be applied (Preact re-render + onPresent)
      await page.waitForSelector(`${container}[data-fixture-applied="true"]`, {
        timeout: 5000,
      });

      // Small delay to let CSS transitions settle
      await page.waitForTimeout(150);
    }

    // --- Capture screenshots ---
    let currentMode = '';
    for (const entry of manifest) {
      // Switch mode if needed
      if (entry.modeId !== currentMode) {
        console.log(`Mode: ${entry.modeId}`);
        await switchToMode(entry.modeId);
        currentMode = entry.modeId;
      }

      // Apply fixture if present
      if (entry.fixture) {
        await applyFixture(entry.modeId, entry.fixture);
      }

      await capture(entry.name);

      // If we applied a fixture, reset to idle for next capture
      if (entry.fixture) {
        // Navigate away and back to reset state
        const nextEntry = manifest[manifest.indexOf(entry) + 1];
        if (
          nextEntry && nextEntry.modeId === entry.modeId && !nextEntry.fixture
        ) {
          // Next entry is an idle capture of the same mode — just reset
          await page.evaluate(
            ({ sel }) => {
              const el = document.querySelector(sel);
              if (!el) return;
              el.removeAttribute('data-fixture-applied');
              el.dispatchEvent(
                new CustomEvent('__fixture__', {
                  detail: {
                    engineState: {
                      phase: 'idle',
                      currentItemId: null,
                      answered: false,
                      quizActive: false,
                      answersEnabled: false,
                      feedbackText: '',
                      feedbackClass: 'feedback',
                      feedbackCorrect: null,
                      feedbackDisplayAnswer: null,
                      hintText: '',
                      timeDisplayText: '',
                      masteryText: '',
                      showMastery: false,
                    },
                    timerPct: 100,
                    timerText: '',
                    timerWarning: false,
                    timerLastQuestion: false,
                  },
                  bubbles: false,
                }),
              );
            },
            { sel: `#mode-${entry.modeId}` },
          );
          await page.waitForTimeout(200);
        }
      }
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
