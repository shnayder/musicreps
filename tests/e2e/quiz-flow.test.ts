// E2E test: core quiz lifecycle (start → answer → feedback → next → stop).
//
// Uses the Note ↔ Semitones mode (simplest declarative mode, no groups).
// Seeds a motor baseline to skip calibration.
//
// Usage: npx tsx tests/e2e/quiz-flow.test.ts

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type Browser, chromium, type Page } from 'playwright';
import { type ChildProcess } from 'node:child_process';
import { startServer } from './helpers/server.ts';
import {
  advanceToNext,
  createTestPage,
  navigateToMode,
  seedLocalStorage,
  startQuiz,
} from './helpers/page-helpers.ts';
import { buildMotorBaseline } from './helpers/fixture-builders.ts';

const MODE_ID = 'noteSemitones';
const MODE = `#skill-${MODE_ID}`;

let browser: Browser;
let server: ChildProcess;
let baseUrl: string;

before(async () => {
  const { proc, portReady } = startServer(8004);
  server = proc;
  const port = await portReady;
  baseUrl = `http://localhost:${port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

// ---------------------------------------------------------------------------
// Helper: set up a fresh page with motor baseline and navigate to mode
// ---------------------------------------------------------------------------

async function setupQuizPage(): Promise<Page> {
  const page = await createTestPage(browser, baseUrl);
  await seedLocalStorage(page, baseUrl, {
    ...buildMotorBaseline(250),
  });
  await navigateToMode(page, MODE_ID);
  return page;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quiz flow — note semitones (E2E)', () => {
  let page: Page;

  before(async () => {
    page = await setupQuizPage();
  });

  after(async () => {
    await page?.context().close();
  });

  it('start quiz, answer via button, see feedback, advance to next', async () => {
    await startQuiz(page, MODE_ID);

    // Read the prompt to determine correct answer
    const promptText = await page.textContent(`${MODE} .quiz-prompt`);
    assert.ok(promptText, 'should have a prompt');

    // The mode is bidirectional — prompt is either a note name or a number.
    // Click any answer button to submit (we don't need to be correct here).
    // First, let's click a number button (for forward direction) or note button.
    // Just click the first visible answer button.
    const firstBtn = page.locator(
      `${MODE} .answer-btn:not([style*="visibility: hidden"]):not(.answer-group-hidden .answer-btn)`,
    ).first();
    await firstBtn.click();

    // Should see a Next button (visible = answer was processed)
    const nextBtn = page.locator(`${MODE} .next-btn`);
    await nextBtn.waitFor({ state: 'visible', timeout: 3000 });

    // Feedback should have correct or wrong styling
    const nextBtnClass = await nextBtn.getAttribute('class') ?? '';
    const hasFeedback = nextBtnClass.includes('page-action-correct') ||
      nextBtnClass.includes('page-action-wrong');
    assert.ok(
      hasFeedback,
      `Next button should have feedback class: ${nextBtnClass}`,
    );

    // Question count should show "1"
    const count = await page.textContent(`${MODE} .quiz-info-count`);
    assert.equal(
      count?.trim(),
      '1',
      'should show count after first answer',
    );

    // Advance to next question
    await advanceToNext(page, MODE_ID);
    // Quiz should still be active
    const isActive = await page.locator(`${MODE}.phase-active`).isVisible();
    assert.ok(isActive, 'quiz should still be in active phase');
  });

  it('answer via text input + Enter', async () => {
    // Quiz should already be running from previous test
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });

    // Read placeholder to determine valid input type.
    // Forward direction shows "0–11", reverse shows a note name hint.
    const placeholder = (await input.getAttribute('placeholder')) ?? '';
    const answer = /\d/.test(placeholder) ? '0' : 'C';

    await input.fill(answer);
    await input.press('Enter');

    // Should see feedback (Next button visible)
    const nextBtn = page.locator(`${MODE} .next-btn`);
    await nextBtn.waitFor({ state: 'visible', timeout: 3000 });
  });

  it('invalid text input shows shake', async () => {
    // Advance to next question first
    await advanceToNext(page, MODE_ID);

    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });

    // Submit empty input
    await input.fill('');
    await input.press('Enter');

    // Should have shake animation class
    const cls = await input.getAttribute('class') ?? '';
    assert.ok(
      cls.includes('answer-input-shake'),
      `should have shake class: ${cls}`,
    );
  });

  it('stop quiz with Escape returns to idle', async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });

    // Verify start button is visible again
    const startBtn = page.locator(`${MODE} .start-btn`);
    await startBtn.waitFor({ state: 'visible', timeout: 3000 });
  });

  it('can restart quiz after stopping', async () => {
    await startQuiz(page, MODE_ID);

    // Should have a prompt
    const promptText = await page.textContent(`${MODE} .quiz-prompt`);
    assert.ok(promptText, 'should have a prompt after restart');

    // Stop again for cleanup
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });
  });
});

describe('round complete flow (E2E)', () => {
  let page: Page;
  const ROUND_MS = 5000; // 5s round for fast testing

  before(async () => {
    // Use ?roundMs= to shorten the round timer
    const roundUrl = `${baseUrl}?roundMs=${ROUND_MS}`;
    page = await createTestPage(browser, roundUrl);
    await seedLocalStorage(page, roundUrl, buildMotorBaseline(250));
    await navigateToMode(page, MODE_ID);
  });

  after(async () => {
    await page?.context().close();
  });

  it('answering until round complete shows stats, then stop returns to idle', async () => {
    await startQuiz(page, MODE_ID);

    // Answer questions until the round timer (5s) expires.
    const startTime = Date.now();
    const maxWaitMs = ROUND_MS + 40_000; // generous buffer

    while (Date.now() - startTime < maxWaitMs) {
      // Check if round is complete
      const isRoundComplete = await page
        .locator(`${MODE}.phase-round-complete`)
        .isVisible()
        .catch(() => false);
      if (isRoundComplete) break;

      // Click first visible answer button
      const btn = page.locator(
        `${MODE} .answer-btn:not([style*="visibility: hidden"]):not(.answer-group-hidden .answer-btn)`,
      ).first();
      const btnVisible = await btn.isVisible().catch(() => false);
      if (btnVisible) {
        await btn.click();
        await page.waitForTimeout(100);
      }

      // Check for Next button and click it / press Space
      const nextBtn = page.locator(`${MODE} .next-btn`);
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(100);
      }
    }

    // Should be in round-complete phase
    const roundComplete = await page
      .locator(`${MODE}.phase-round-complete`)
      .isVisible();
    assert.ok(roundComplete, 'should reach round-complete phase');

    // Should show count
    const count = await page.textContent(`${MODE} .round-complete-count`);
    assert.ok(count, 'should show question count');
    const countNum = parseInt(count!, 10);
    assert.ok(
      countNum > 0,
      `should have answered at least 1 question, got ${countNum}`,
    );

    // Click Stop
    await page.click(`${MODE} .page-action-secondary`);
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });

    // Verify we're back to idle
    const startBtn = page.locator(`${MODE} .start-btn`);
    await startBtn.waitFor({ state: 'visible', timeout: 3000 });
  });
});
