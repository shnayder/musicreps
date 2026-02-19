# Plan: Playwright Screenshot Script

## Context

The app has 10 quiz modes with various UI states (idle, active quiz, menu).
During development, there's no quick way to visually verify what the app looks
like across all modes. This adds a simple Playwright script that auto-captures
screenshots of every mode for design feedback and sanity checks.

## Approach

A single TypeScript script (`scripts/take-screenshots.ts`) that:

1. Spawns the Deno dev server as a child process
2. Launches headless Chromium via Playwright
3. Seeds localStorage to bypass motor calibration screens
4. Iterates through all 10 modes, capturing idle + mid-quiz screenshots
5. Captures one hamburger menu screenshot
6. Kills the server and exits

**Viewport**: 402x873 @ 3x (iPhone 17 Pro) **Output**: `screenshots/` directory
(gitignored), 21 PNGs total

## Files to create/modify

| File                                         | Action | Notes                                         |
| -------------------------------------------- | ------ | --------------------------------------------- |
| `plans/2026-02-11-playwright-screenshots.md` | Create | This plan                                     |
| `package.json`                               | Create | Minimal: `playwright` + `tsx` devDependencies |
| `.gitignore`                                 | Create | `node_modules/`, `screenshots/`               |
| `scripts/take-screenshots.ts`                | Create | Main script                                   |
| `CLAUDE.md`                                  | Edit   | Add Screenshots section                       |

## Script design

- Seeds `motorBaseline_{namespace}` = `'500'` for all 9 engine-based modes
  (speedTap excluded — has its own lifecycle)
- After seeding localStorage, reloads page so app initializes with the data
- Navigates to each mode via hamburger menu clicks
- Captures idle screenshot, then clicks Start, waits for quiz UI, captures quiz
  screenshot
- Speed Tap: detects `.speed-tap-prompt` visibility instead of
  `.quiz-area.active`
- Uses `page.keyboard.press('Escape')` to stop quiz between captures
- Screenshot naming: `{modeId}-idle.png`, `{modeId}-quiz.png`, `menu.png`

## Verification

1. Run `npm install && npx playwright install chromium`
2. Run `npx tsx scripts/take-screenshots.ts`
3. Check `screenshots/` for 21 PNGs
