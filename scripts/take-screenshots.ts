// Playwright screenshot script: captures idle + quiz screenshots for all 10 modes.
// Usage: npx tsx scripts/take-screenshots.ts

import { chromium } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8001;
const URL = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');
const VIEWPORT = { width: 402, height: 873 };
const DEVICE_SCALE_FACTOR = 3;

// All mode IDs in registration order (from app.js)
const MODE_IDS = [
  'fretboard',
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

// Modes that use QuizEngine and need motorBaseline seeded (all except speedTap)
const ENGINE_MODES = MODE_IDS.filter(id => id !== 'speedTap');

function startServer(): ChildProcess {
  const proc = spawn('deno', ['run', '--allow-net', '--allow-read', 'main.ts'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });
  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString();
    // Only show errors, not routine "Listening on" messages
    if (!msg.includes('Listening on')) process.stderr.write(msg);
  });
  return proc;
}

async function waitForServer(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch { /* server not ready yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Start dev server
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

    // Load page once to initialize localStorage
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    // Seed motorBaseline for all engine-based modes to skip calibration
    for (const ns of ENGINE_MODES) {
      await page.evaluate((key) => localStorage.setItem(key, '500'), `motorBaseline_${ns}`);
    }
    // Speed tap doesn't need motorBaseline but does need its own init handled

    // Reload so app picks up seeded baselines
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Helper: switch to a mode via home screen
    async function switchToMode(modeId: string) {
      // Go home first (click back button if in a mode)
      const backBtn = await page.$('.mode-screen.mode-active .mode-back-btn');
      if (backBtn) {
        await backBtn.click();
        await page.waitForTimeout(200);
      }
      await page.click(`[data-mode="${modeId}"]`);
      await page.waitForTimeout(300); // settle animations
    }

    // Helper: capture a screenshot
    async function capture(name: string) {
      const filePath = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: filePath });
      console.log(`  ${name}.png`);
    }

    // --- Capture each mode ---
    for (const modeId of MODE_IDS) {
      console.log(`Mode: ${modeId}`);
      await switchToMode(modeId);

      // Idle screenshot
      await capture(`${modeId}-idle`);

      // Start quiz
      const modeContainer = `#mode-${modeId}`;
      await page.click(`${modeContainer} .start-btn`);

      // Wait for quiz to become active
      await page.waitForSelector(`${modeContainer} .quiz-area.active`, { timeout: 5000 });
      await page.waitForTimeout(500); // let first question render

      // Quiz screenshot
      await capture(`${modeId}-quiz`);

      // Stop quiz — press Escape
      await page.keyboard.press('Escape');
      await page.waitForSelector(`${modeContainer} .quiz-area.active`, {
        state: 'hidden',
        timeout: 3000,
      }).catch(() => {});
      await page.waitForTimeout(200);
    }

    // --- Design moment captures (correct, wrong, round-complete) ---
    let designCaptures = 0;
    // Use semitoneMath as the representative mode for feedback states
    const feedbackMode = 'semitoneMath';
    const feedbackContainer = `#mode-${feedbackMode}`;
    console.log('Design moments: feedback states');
    await switchToMode(feedbackMode);
    await page.click(`${feedbackContainer} .start-btn`);
    await page.waitForSelector(`${feedbackContainer} .quiz-area.active`, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Correct feedback: try each answer button until we get "correct" feedback
    const noteButtons = await page.$$(`${feedbackContainer} .answer-btn`);
    for (const btn of noteButtons) {
      const isDisabled = await btn.getAttribute('disabled');
      if (isDisabled !== null) continue;
      await btn.click();
      await page.waitForTimeout(200);
      const feedback = await page.$(`${feedbackContainer} .feedback .correct`);
      if (feedback) break;
      // If wrong, wait for next question and try again
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }
    // If we got correct feedback, capture it
    const gotCorrect = await page.$(`${feedbackContainer} .feedback .correct`);
    if (gotCorrect) {
      await capture('design-correct-feedback');
      designCaptures++;
    }

    // Wrong feedback: submit an intentionally wrong answer
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    // Get the correct answer text so we can avoid it
    const wrongCapture = await page.evaluate((container: string) => {
      const buttons = document.querySelectorAll(`${container} .answer-btn:not([disabled])`);
      // Click the first available button — likely wrong for most questions
      if (buttons.length > 0) {
        (buttons[0] as HTMLElement).click();
        return true;
      }
      return false;
    }, feedbackContainer);
    if (wrongCapture) {
      await page.waitForTimeout(200);
      // Check if it was actually wrong; if correct, try next question
      const wrongFeedback = await page.$(`${feedbackContainer} .feedback .incorrect`);
      if (wrongFeedback) {
        await capture('design-wrong-feedback');
        designCaptures++;
      } else {
        // Got correct by accident, try one more time
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        await page.evaluate((container: string) => {
          const buttons = document.querySelectorAll(`${container} .answer-btn:not([disabled])`);
          if (buttons.length > 0) (buttons[0] as HTMLElement).click();
        }, feedbackContainer);
        await page.waitForTimeout(200);
        const retryWrong = await page.$(`${feedbackContainer} .feedback .incorrect`);
        if (retryWrong) {
          await capture('design-wrong-feedback');
          designCaptures++;
        } else {
          console.log('  (wrong-feedback not captured — got correct twice)');
        }
      }
    }

    // Stop current quiz
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Round-complete: shorten timer to trigger round end quickly
    console.log('Design moments: round-complete');
    await switchToMode(feedbackMode);
    await page.click(`${feedbackContainer} .start-btn`);
    await page.waitForSelector(`${feedbackContainer} .quiz-area.active`, { timeout: 5000 });
    await page.waitForTimeout(300);

    // Answer a few questions to accumulate stats before the round ends
    for (let i = 0; i < 5; i++) {
      const keys = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
      await page.keyboard.press(keys[i % keys.length]);
      await page.waitForTimeout(100);
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
    }
    // Fast-forward perceived time by 70s so the engine thinks the round expired
    await page.evaluate(() => {
      const realNow = Date.now;
      const realPerf = performance.now;
      const offset = 70_000;
      Date.now = () => realNow.call(Date) + offset;
      performance.now = () => realPerf.call(performance) + offset;
    });
    // Trigger a timer check by answering one more question
    await page.keyboard.press('c');
    await page.waitForTimeout(300);
    const roundComplete = await page.waitForSelector(
      `${feedbackContainer} .round-complete`,
      { state: 'visible', timeout: 5_000 }
    ).catch(() => null);
    if (roundComplete) {
      await page.waitForTimeout(300);
      await capture('design-round-complete');
      designCaptures++;
    } else {
      console.log('  (round-complete not captured — timer did not expire)');
    }

    // --- Menu screenshot ---
    // Go home first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const backBtn2 = await page.$('.mode-screen.mode-active .mode-back-btn');
    if (backBtn2) {
      await backBtn2.click();
      await page.waitForTimeout(200);
    }
    console.log('Menu');
    await page.click('.hamburger');
    await page.waitForSelector('.nav-drawer.open');
    await page.waitForTimeout(300);
    await capture('menu');

    await browser.close();
    console.log(`\nDone! ${MODE_IDS.length * 2 + 1 + designCaptures} screenshots in ${OUT_DIR}`);
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
