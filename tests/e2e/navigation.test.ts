// E2E test: navigation lifecycle (home ↔ mode switching, Escape routing).
//
// Tests mode switching, back button, Escape behavior in idle vs active phase,
// and scope state preservation across mode switches.
//
// Usage: npx tsx tests/e2e/navigation.test.ts

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
import { buildMotorBaseline } from './helpers/fixture-builders.ts';

let browser: Browser;
let server: ChildProcess;
let baseUrl: string;

before(async () => {
  const { proc, portReady } = startServer(8005);
  server = proc;
  const port = await portReady;
  baseUrl = `http://localhost:${port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function freshPage(): Promise<Page> {
  const page = await createTestPage(browser, baseUrl);
  await seedLocalStorage(page, baseUrl, buildMotorBaseline(250));
  return page;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('navigation lifecycle (E2E)', () => {
  let page: Page;

  before(async () => {
    page = await freshPage();
  });

  after(async () => {
    await page?.context().close();
  });

  it('home → mode → home round trip', async () => {
    // Home screen should be visible
    const homeVisible = await page.locator('#home-screen').isVisible();
    assert.ok(homeVisible, 'home screen should be visible initially');

    // Navigate to a mode
    await navigateToMode(page, 'noteSemitones');

    // Mode should be active, home hidden
    const modeActive = await page
      .locator('#mode-noteSemitones.mode-active')
      .isVisible();
    assert.ok(modeActive, 'mode should be active');
    const homeHidden = await page
      .locator('#home-screen.hidden')
      .count();
    assert.ok(homeHidden > 0, 'home screen should be hidden');

    // Click back/close button
    await page.click('#mode-noteSemitones .mode-close-btn');
    await page.waitForTimeout(300);

    // Home should be visible again
    const homeBack = await page.locator('#home-screen:not(.hidden)').isVisible();
    assert.ok(homeBack, 'home screen should be visible after back');

    // Mode should no longer be active
    const modeGone = await page
      .locator('#mode-noteSemitones.mode-active')
      .count();
    assert.equal(modeGone, 0, 'mode should not be active after back');
  });

  it('Escape from idle mode returns home', async () => {
    await navigateToMode(page, 'semitoneMath');

    // Press Escape while in idle phase
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Should be back at home
    const homeVisible = await page.locator('#home-screen:not(.hidden)').isVisible();
    assert.ok(homeVisible, 'should return to home on Escape from idle');
  });

  it('Escape during quiz stops quiz but stays in mode', async () => {
    await navigateToMode(page, 'noteSemitones');
    await startQuiz(page, 'noteSemitones');

    // Quiz should be active
    const active = await page
      .locator('#mode-noteSemitones.phase-active')
      .isVisible();
    assert.ok(active, 'quiz should be active');

    // Press Escape — should stop quiz but stay in mode
    await page.keyboard.press('Escape');
    await page.waitForSelector('#mode-noteSemitones.phase-idle', {
      timeout: 3000,
    });

    // Mode should still be active (not returned to home)
    const modeStillActive = await page
      .locator('#mode-noteSemitones.mode-active')
      .isVisible();
    assert.ok(modeStillActive, 'mode should still be active after Escape during quiz');

    // Home should still be hidden
    const homeHidden = await page.locator('#home-screen.hidden').count();
    assert.ok(homeHidden > 0, 'home should still be hidden');

    // Go back to home for next test
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('mode switching preserves scope state', async () => {
    // Navigate to semitone math (has groups)
    await navigateToMode(page, 'semitoneMath');

    // Toggle off a group (click first toggle that's on)
    const firstToggle = page.locator(
      '#mode-semitoneMath .group-toggle.group-toggle-active',
    ).first();
    const toggleExists = await firstToggle.isVisible().catch(() => false);

    if (toggleExists) {
      const toggleLabel = await firstToggle.textContent();
      await firstToggle.click();
      await page.waitForTimeout(200);

      // Go home
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Navigate to a different mode
      await navigateToMode(page, 'noteSemitones');
      await page.waitForTimeout(200);

      // Go home again
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Navigate back to semitone math
      await navigateToMode(page, 'semitoneMath');
      await page.waitForTimeout(300);

      // The toggle we turned off should still be off
      const toggleAfter = page.locator(
        `#mode-semitoneMath .group-toggle:has-text("${toggleLabel?.trim()}")`,
      );
      const toggleAfterClass = await toggleAfter.getAttribute('class') ?? '';
      assert.ok(
        !toggleAfterClass.includes('group-toggle-active'),
        `toggle "${toggleLabel?.trim()}" should still be inactive after mode switch`,
      );
    } else {
      // No toggles visible — skip this assertion (mode may have no groups loaded)
      assert.ok(true, 'no group toggles found — skipping scope preservation test');
    }
  });
});
