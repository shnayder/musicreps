// E2E test: chord spelling sequential input mode.
//
// Tests button-by-button note entry, batch text input via the text field,
// and rejection of wrong note count.
//
// Usage: npx tsx tests/e2e/chord-spelling.test.ts

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type Browser, chromium, type Page } from 'playwright';
import { type ChildProcess } from 'node:child_process';
import { startServer } from './helpers/server.ts';
import {
  createTestPage,
  navigateToMode,
  seedLocalStorage,
  startQuiz,
} from './helpers/page-helpers.ts';
import {
  buildEnabledGroups,
  buildMotorBaseline,
} from './helpers/fixture-builders.ts';

const MODE_ID = 'chordSpelling';
const MODE = `#mode-${MODE_ID}`;

let browser: Browser;
let server: ChildProcess;
let baseUrl: string;

before(async () => {
  const { proc, portReady } = startServer(8007);
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
// Tests
// ---------------------------------------------------------------------------

describe('chord spelling — batch text input (E2E)', () => {
  let page: Page;

  before(async () => {
    page = await createTestPage(browser, baseUrl);
    await seedLocalStorage(page, baseUrl, {
      ...buildMotorBaseline(250),
      // Enable only major/minor triads (group 0) for predictable questions
      ...buildEnabledGroups('chordSpelling_enabledGroups', [0]),
    });
    await navigateToMode(page, MODE_ID);
  });

  after(async () => {
    await page?.context().close();
  });

  it('batch text input submits and shows feedback', async () => {
    await startQuiz(page, MODE_ID);

    // Read the prompt to determine what chord we need to spell
    const promptText = await page.textContent(`${MODE} .quiz-prompt`);
    assert.ok(promptText, 'should have a chord prompt');

    // Major/minor triads have 3 notes; placeholder no longer shows count
    const noteCount = 3;
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });

    // Submit a batch of note names (may be wrong, that's fine — we're testing
    // the UI flow, not musical correctness)
    const testNotes = ['C', 'E', 'G'].slice(0, noteCount).join(' ');
    await input.fill(testNotes);
    await input.press('Enter');

    // Should see sequential slots filled
    const slots = page.locator(`${MODE} .seq-slot`);
    const slotCount = await slots.count();
    assert.ok(
      slotCount >= noteCount,
      `should have ${noteCount} sequential slots, got ${slotCount}`,
    );

    // Should see feedback (Next button visible)
    const nextBtn = page.locator(`${MODE} .next-btn`);
    await nextBtn.waitFor({ state: 'visible', timeout: 3000 });

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });
  });

  it('wrong note count via batch shows wrong feedback', async () => {
    await startQuiz(page, MODE_ID);

    // Submit fewer notes than expected (major/minor triads need 3)
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });

    await input.fill('C');
    await input.press('Enter');

    // Should evaluate as wrong (1 note ≠ 3 expected) and show Next button
    const nextBtn = page.locator(`${MODE} .next-btn`);
    await nextBtn.waitFor({ state: 'visible', timeout: 3000 });

    // The single slot should show the entered note
    const slots = page.locator(`${MODE} .seq-slot`);
    const slotCount = await slots.count();
    assert.ok(slotCount >= 1, `should have at least 1 slot, got ${slotCount}`);

    // Correct answer row should appear (since count mismatches)
    const correctRow = page.locator(`${MODE} .seq-correct-row`);
    const hasCorrectRow = await correctRow.isVisible().catch(() => false);
    assert.ok(hasCorrectRow, 'should show correct answer when count is wrong');

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });
  });
});

describe('chord spelling — button input (E2E)', () => {
  let page: Page;

  before(async () => {
    page = await createTestPage(browser, baseUrl);
    await seedLocalStorage(page, baseUrl, {
      ...buildMotorBaseline(250),
      ...buildEnabledGroups('chordSpelling_enabledGroups', [0]),
    });
    await navigateToMode(page, MODE_ID);
  });

  after(async () => {
    await page?.context().close();
  });

  it('button-by-button input fills slots and evaluates on Check', async () => {
    await startQuiz(page, MODE_ID);

    // Major/minor triads have 3 notes
    const noteCount = 3;

    // Split-note buttons: two grids in an answer-grid-stack.
    // First grid = base notes (C D E F G A B), second = accidentals (♭ ♮ ♯).
    // Tap a base note + natural (♮) accidental for each note in the chord.
    const grids = page.locator(`${MODE} .answer-grid-stack .answer-grid`);
    const baseButtons = grids.nth(0).locator('.answer-btn');
    const naturalBtn = grids.nth(1).locator('.answer-btn:nth-child(2)'); // ♮

    const btnCount = await baseButtons.count();
    assert.ok(btnCount >= 2, `expected base note buttons, got ${btnCount}`);

    for (let i = 0; i < noteCount; i++) {
      const btnIdx = i % btnCount;
      await baseButtons.nth(btnIdx).click();
      await page.waitForTimeout(100);
      await naturalBtn.click();
      await page.waitForTimeout(100);
    }

    // Sequential slots should show filled entries (not yet evaluated)
    const filledSlots = page.locator(`${MODE} .seq-slot.filled`);
    const filledCount = await filledSlots.count();
    assert.ok(
      filledCount >= noteCount,
      `should have ${noteCount} filled slots, got ${filledCount}`,
    );

    // Check button should be visible (no auto-submit)
    const checkBtn = page.locator(`${MODE} .next-btn`);
    await checkBtn.waitFor({ state: 'visible', timeout: 3000 });
    const checkText = await checkBtn.textContent();
    assert.ok(
      checkText?.includes('Check'),
      `should show Check button, got "${checkText}"`,
    );
    await checkBtn.click();

    // After clicking Check, Next button should appear
    const nextBtn = page.locator(`${MODE} .next-btn`);
    await nextBtn.waitFor({ state: 'visible', timeout: 3000 });

    // Sequential slots should show evaluated results
    const evaluatedSlots = page.locator(`${MODE} .seq-slot`);
    const evaluatedCount = await evaluatedSlots.count();
    assert.ok(
      evaluatedCount >= noteCount,
      `should have ${noteCount} evaluated slots, got ${evaluatedCount}`,
    );

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });
  });
});
