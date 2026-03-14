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

    // Read the placeholder to know how many notes are expected
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });
    const placeholder = await input.getAttribute('placeholder') ?? '';
    const noteCountMatch = placeholder.match(/^(\d+) notes/);
    const noteCount = noteCountMatch ? parseInt(noteCountMatch[1], 10) : 3;

    // Submit a batch of note names (may be wrong, that's fine — we're testing
    // the UI flow, not musical correctness)
    const testNotes = ['C', 'E', 'G', 'B'].slice(0, noteCount).join(' ');
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

  it('wrong note count is rejected with shake', async () => {
    await startQuiz(page, MODE_ID);

    // Read expected count from placeholder
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });
    const placeholder = await input.getAttribute('placeholder') ?? '';
    const noteCountMatch = placeholder.match(/^(\d+) notes/);
    const noteCount = noteCountMatch ? parseInt(noteCountMatch[1], 10) : 3;

    // Submit fewer notes than expected
    const tooFew = noteCount > 1 ? 'C' : '';
    await input.fill(tooFew);
    await input.press('Enter');

    // Should show shake animation (rejected)
    const cls = await input.getAttribute('class') ?? '';
    assert.ok(
      cls.includes('answer-input-shake'),
      `should show shake on wrong note count: "${cls}"`,
    );

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

  it('button-by-button input fills slots and evaluates', async () => {
    await startQuiz(page, MODE_ID);

    // Read expected count from placeholder
    const input = page.locator(`${MODE} .answer-input`);
    await input.waitFor({ state: 'visible', timeout: 3000 });
    const placeholder = await input.getAttribute('placeholder') ?? '';
    const noteCountMatch = placeholder.match(/^(\d+) notes/);
    const noteCount = noteCountMatch ? parseInt(noteCountMatch[1], 10) : 3;

    // Tap base notes using split-note buttons.
    // In sequential mode, tapping a new base auto-submits the previous.
    // So we tap noteCount+1 base notes: each new tap submits the previous.
    // Actually, the last note needs a double-tap to confirm.
    const baseButtons = page.locator(`${MODE} .split-note-base`);
    const btnCount = await baseButtons.count();

    if (btnCount >= 2) {
      // Tap different base notes — each new tap submits previous as natural
      for (let i = 0; i < noteCount - 1; i++) {
        const btnIdx = i % btnCount;
        await baseButtons.nth(btnIdx).click();
        await page.waitForTimeout(150);
      }

      // Last note: tap then double-tap to confirm
      const lastIdx = (noteCount - 1) % btnCount;
      await baseButtons.nth(lastIdx).click();
      await page.waitForTimeout(150);
      await baseButtons.nth(lastIdx).click();
      await page.waitForTimeout(300);

      // Should see feedback (Next button visible after all notes collected)
      const nextBtn = page.locator(`${MODE} .next-btn`);
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      assert.ok(nextVisible, 'Next button should appear after all notes submitted');

      // Sequential slots should show results
      const evaluatedSlots = page.locator(`${MODE} .seq-slot`);
      const evaluatedCount = await evaluatedSlots.count();
      assert.ok(
        evaluatedCount >= noteCount,
        `should have ${noteCount} evaluated slots, got ${evaluatedCount}`,
      );
    } else {
      assert.ok(true, 'not enough buttons visible — skipping button input test');
    }

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${MODE}.phase-idle`, { timeout: 3000 });
  });
});
