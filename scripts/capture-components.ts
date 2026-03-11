// Capture element-level screenshots of component sections from components.html.
// Uses file:// protocol — no dev server needed.
// Shared by take-screenshots.ts and ui-iterate.ts.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ComponentEntry } from './component-manifest.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_HTML = path.resolve(
  __dirname,
  '..',
  'guides',
  'design',
  'components.html',
);

const VIEWPORT = { width: 612, height: 600 };

export type ComponentCaptureOptions = {
  entries: ComponentEntry[];
  outDir: string;
  imgType?: 'png' | 'jpeg';
  quality?: number; // JPEG quality (ignored for PNG)
  hasTouch?: boolean; // true → pointer: coarse (phone), false → pointer: fine (desktop)
};

/**
 * Capture element-level screenshots of component sections.
 * Opens components.html via file://, waits for JS-generated content,
 * then calls element.screenshot() on each matched section.
 */
export async function captureComponents(
  opts: ComponentCaptureOptions,
): Promise<void> {
  const { entries, outDir, imgType = 'png', quality, hasTouch } = opts;
  if (entries.length === 0) return;

  // Ensure output directory (including comp/ subdirectory) exists
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ...(hasTouch !== undefined ? { hasTouch } : {}),
  });
  const page = await context.newPage();

  // Load via file:// — no server needed
  const fileUrl = `file://${COMPONENTS_HTML}`;
  await page.goto(fileUrl);
  await page.waitForLoadState('networkidle');

  // Wait for JS-generated content (spacing scale, type scale, etc.)
  // The scripts run on load; networkidle should suffice, but add a small
  // buffer for any remaining DOM mutations.
  await page.waitForTimeout(300);

  const ext = imgType === 'jpeg' ? 'jpg' : 'png';

  for (const entry of entries) {
    const el = await page.$(entry.selector);
    if (!el) {
      console.warn(`  WARNING: selector not found: ${entry.selector}`);
      continue;
    }

    const filePath = path.join(outDir, `${entry.name}.${ext}`);
    // Ensure subdirectory exists (entry.name includes "comp/" prefix)
    mkdirSync(path.dirname(filePath), { recursive: true });

    await el.screenshot({
      path: filePath,
      type: imgType,
      ...(imgType === 'jpeg' && quality ? { quality } : {}),
    });
    console.log(`  ${entry.name}.${ext}`);
  }

  await browser.close();
  console.log(`Captured ${entries.length} component screenshots in ${outDir}`);
}
