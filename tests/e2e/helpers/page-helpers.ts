// Shared page helpers for E2E tests.
// Lightweight functions for common Playwright interactions.

import type { Browser, Page } from 'playwright';

export const VIEWPORT = { width: 402, height: 873 };

/** Create a new browser context + page with standard mobile viewport. */
export async function createTestPage(
  browser: Browser,
  baseUrl: string,
): Promise<Page> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  return page;
}

/** Inject localStorage entries, then reload so the app picks them up. */
export async function seedLocalStorage(
  page: Page,
  baseUrl: string,
  data: Record<string, string>,
): Promise<void> {
  await page.evaluate((items) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, v);
    }
  }, data);
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
}

/** Click a mode button on the home screen and wait for it to become active. */
export async function navigateToMode(
  page: Page,
  skillId: string,
): Promise<void> {
  await page.click(`[data-skill="${skillId}"]`);
  await page.waitForSelector(`#skill-${skillId}.skill-active`);
}

/** Click the Start/Practice button and wait for the quiz to enter active phase. */
export async function startQuiz(
  page: Page,
  skillId: string,
): Promise<void> {
  await page.click(`#skill-${skillId} .start-btn`);
  await page.waitForSelector(`#skill-${skillId}.phase-active`);
}

/** Wait for feedback text to appear after an answer is submitted. */
export async function waitForFeedback(
  page: Page,
  skillId: string,
): Promise<string> {
  const sel = `#skill-${skillId} .feedback`;
  await page.waitForSelector(sel);
  const text = await page.textContent(sel);
  return text ?? '';
}

/** Press Space and wait for the next question to appear. */
export async function advanceToNext(
  page: Page,
  skillId: string,
): Promise<void> {
  await page.keyboard.press('Space');
  // Wait for the Next button to become hidden (new question rendered)
  const nextSel = `#skill-${skillId} .next-btn`;
  await page.waitForSelector(nextSel, { state: 'hidden', timeout: 5000 });
}
