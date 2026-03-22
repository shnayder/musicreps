// E2E test: localStorage persistence and recovery across page reloads.
//
// Tests that scope state, learner data, motor baseline, notation preference,
// and corrupt data recovery all work correctly across reloads.
//
// Usage: npx tsx tests/e2e/persistence.test.ts

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

let browser: Browser;
let server: ChildProcess;
let baseUrl: string;

before(async () => {
  const { proc, portReady } = startServer(8006);
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

describe('scope persistence across reload (E2E)', () => {
  it('disabled group stays disabled after reload', async () => {
    const page = await createTestPage(browser, baseUrl);
    try {
      // Seed with all 6 semitone math groups enabled except group 0,
      // and practice mode set to 'custom' so toggles are visible.
      await seedLocalStorage(page, baseUrl, {
        ...buildMotorBaseline(250),
        ...buildEnabledGroups('semitoneMath_enabledGroups', [1, 2, 3, 4, 5]),
        semitoneMath_enabledGroups_practiceMode: 'custom',
      });
      await navigateToMode(page, 'semitoneMath');

      // Verify group 0's toggle is inactive (not in enabled list)
      const toggles = page.locator('#mode-semitoneMath .level-toggle-btn');
      const firstToggle = toggles.first();
      await firstToggle.waitFor({ state: 'visible', timeout: 3000 });
      const firstClass = await firstToggle.getAttribute('class') ?? '';
      assert.ok(
        !firstClass.includes('active'),
        'first group toggle should be inactive initially',
      );

      // Reload the page
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
      await navigateToMode(page, 'semitoneMath');

      // Verify group 0 is still inactive (custom mode persists too)
      const reloadToggles = page.locator(
        '#mode-semitoneMath .level-toggle-btn',
      );
      await reloadToggles.first().waitFor({ state: 'visible', timeout: 3000 });
      const firstClassAfter =
        await reloadToggles.first().getAttribute('class') ??
          '';
      assert.ok(
        !firstClassAfter.includes('active'),
        'first group toggle should still be inactive after reload',
      );
    } finally {
      await page.context().close();
    }
  });
});

describe('learner data persistence (E2E)', () => {
  it('adaptive stats persist after answering questions', async () => {
    const page = await createTestPage(browser, baseUrl);
    try {
      await seedLocalStorage(page, baseUrl, buildMotorBaseline(250));
      await navigateToMode(page, 'noteSemitones');
      await startQuiz(page, 'noteSemitones');

      // Answer 3 questions by clicking buttons
      for (let i = 0; i < 3; i++) {
        const btn = page.locator(
          '#mode-noteSemitones .answer-btn:not([style*="visibility: hidden"]):not(.answer-group-hidden .answer-btn)',
        ).first();
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          await btn.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Space');
          await page.waitForTimeout(200);
        }
      }

      // Stop the quiz
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Check that adaptive keys exist in localStorage
      const keys = await page.evaluate(() => {
        const result: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            key.startsWith('adaptive_noteSemitones_') &&
            !key.endsWith('_lastSelected')
          ) {
            result.push(key);
          }
        }
        return result;
      });
      assert.ok(
        keys.length > 0,
        `should have adaptive keys, found: ${keys.length}`,
      );

      // Verify the shape of one entry
      const firstValue = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, keys[0]);
      assert.ok(firstValue, 'adaptive value should exist');
      const parsed = JSON.parse(firstValue!);
      assert.ok('ewma' in parsed, 'should have ewma field');
      assert.ok('sampleCount' in parsed, 'should have sampleCount field');
      assert.ok('lastSeen' in parsed, 'should have lastSeen field');
    } finally {
      await page.context().close();
    }
  });
});

describe('motor baseline persistence (E2E)', () => {
  it('seeded baseline skips calibration on quiz start', async () => {
    const page = await createTestPage(browser, baseUrl);
    try {
      await seedLocalStorage(page, baseUrl, buildMotorBaseline(250));

      // Reload to verify persistence
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      await navigateToMode(page, 'noteSemitones');
      await startQuiz(page, 'noteSemitones');

      // Should go directly to active phase (not calibration)
      const isActive = await page
        .locator('#mode-noteSemitones.phase-active')
        .isVisible();
      assert.ok(isActive, 'should be in active phase (no calibration)');

      // Should NOT be in calibration phase
      const isCalibration = await page
        .locator('#mode-noteSemitones.phase-calibration')
        .count();
      assert.equal(isCalibration, 0, 'should not be in calibration phase');

      await page.keyboard.press('Escape');
    } finally {
      await page.context().close();
    }
  });
});

describe('notation preference persistence (E2E)', () => {
  it('solfège preference persists across reload', async () => {
    const page = await createTestPage(browser, baseUrl);
    try {
      // Set solfège notation
      await seedLocalStorage(page, baseUrl, {
        ...buildMotorBaseline(250),
        fretboard_notation: 'solfege',
      });

      // Verify the setting was stored
      const stored = await page.evaluate(() =>
        localStorage.getItem('fretboard_notation')
      );
      assert.equal(stored, 'solfege', 'notation should be set before reload');

      // Reload and verify persistence
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const storedNotation = await page.evaluate(() =>
        localStorage.getItem('fretboard_notation')
      );
      assert.equal(
        storedNotation,
        'solfege',
        'notation should persist as solfege',
      );
    } finally {
      await page.context().close();
    }
  });
});

describe('corrupt localStorage recovery (E2E)', () => {
  it('invalid JSON in enabledGroups does not crash the app', async () => {
    const page = await createTestPage(browser, baseUrl);
    try {
      // Inject corrupt data
      await page.evaluate(() => {
        localStorage.setItem('semitoneMath_enabledGroups', 'not valid json{{{');
      });

      // Reload — app should not crash
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Should still be able to navigate to the mode
      await navigateToMode(page, 'semitoneMath');

      // Should show the practice tab (mode loaded successfully)
      const startBtn = page.locator('#mode-semitoneMath .start-btn');
      const visible = await startBtn.isVisible().catch(() => false);
      assert.ok(
        visible,
        'start button should be visible (mode recovered from corrupt data)',
      );
    } finally {
      await page.context().close();
    }
  });
});
