# Promote quiz-prompt and feedbackBlock to modeScreen scaffold

## Problem

Calibration silently requires `.quiz-prompt` to exist in the DOM, but each mode
must independently include `quizPrompt()` in its `quizAreaContent`. This hidden
invariant caused a bug: fretboard and ukulele modes omitted it, breaking the
speed check's "Press C" prompt with no error, no test failure.

The same fragility applies to `feedbackBlock()` (`.feedback`, `.time-display`,
`.hint`) — every mode includes it, the engine assumes it exists, but nothing
enforces it.

## Current state

Every mode's `quizAreaContent` follows the same pattern:

```
quizPrompt() or countdownAndPrompt()   ← always present, always first
[mode-specific buttons/content]
feedbackBlock()                         ← always present, always last
```

`countdownAndPrompt()` is a deprecated alias for `quizPrompt()`.

The resulting DOM inside `.quiz-area` is always:

```
.practicing-label        ← scaffold
.quiz-prompt             ← from quizAreaContent (should be scaffold)
[answer buttons, etc.]   ← mode-specific
.feedback                ← from quizAreaContent (should be scaffold)
.time-display            ← from quizAreaContent (should be scaffold)
.hint                    ← from quizAreaContent (should be scaffold)
.round-complete          ← scaffold
```

## Proposed change

Move `quiz-prompt` and `feedbackBlock` content into `modeScreen()`:

```typescript
// html-helpers.ts modeScreen()
return `<div class="mode-screen phase-idle" id="mode-${id}">
    ...
    <div class="quiz-area">
      <div class="practicing-label"></div>
      <div class="quiz-prompt"></div>
      ${opts.quizAreaContent}
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
      <div class="round-complete">...</div>
    </div>
  </div>`;
```

Modes then only specify what's unique — their answer buttons and any
mode-specific elements:

```typescript
// Before (note-semitones):
quizAreaContent: `${countdownAndPrompt()}
    ${noteAnswerButtons()}
    ${numberButtons(0, 11)}
    ${feedbackBlock()}`;

// After:
quizAreaContent: `${noteAnswerButtons()}
    ${numberButtons(0, 11)}`;
```

## Steps

### 1. Update modeScreen() scaffold

In `src/html-helpers.ts`, add `quiz-prompt` and feedback elements to the
scaffold:

```diff
     <div class="quiz-area">
       <div class="practicing-label"></div>
+      <div class="quiz-prompt"></div>
       ${opts.quizAreaContent}
+      <div class="feedback"></div>
+      <div class="time-display"></div>
+      <div class="hint"></div>
       <div class="round-complete">
```

### 2. Remove from all mode templates

In both `main.ts` and `build.ts`, remove `quizPrompt()` / `countdownAndPrompt()`
and `feedbackBlock()` from every mode's `quizAreaContent`. All 10 modes
affected:

| Mode               | Remove from quizAreaContent               |
| ------------------ | ----------------------------------------- |
| Guitar Fretboard   | `quizPrompt()`, `feedbackBlock()`         |
| Ukulele Fretboard  | `quizPrompt()`, `feedbackBlock()`         |
| Speed Tap          | `countdownAndPrompt()`, `feedbackBlock()` |
| Note Semitones     | `countdownAndPrompt()`, `feedbackBlock()` |
| Interval Semitones | `countdownAndPrompt()`, `feedbackBlock()` |
| Semitone Math      | `countdownAndPrompt()`, `feedbackBlock()` |
| Interval Math      | `countdownAndPrompt()`, `feedbackBlock()` |
| Key Signatures     | `countdownAndPrompt()`, `feedbackBlock()` |
| Scale Degrees      | `countdownAndPrompt()`, `feedbackBlock()` |
| Diatonic Chords    | `countdownAndPrompt()`, `feedbackBlock()` |
| Chord Spelling     | `countdownAndPrompt()`, `feedbackBlock()` |

### 3. Remove unused exports

In `src/html-helpers.ts`:

- Remove `quizPrompt()` export (now inlined in scaffold)
- Remove `countdownAndPrompt()` export (deprecated alias, no longer used)
- Remove `feedbackBlock()` export (now inlined in scaffold)

Remove from import lists in `main.ts` and `build.ts`.

### 4. Version bump

Bump version in both `main.ts` and `build.ts` (v4.3 -> v4.4).

## Verification

- `npx tsx --test src/*_test.ts` — all tests pass
- `npx tsx build.ts` — build succeeds
- Manual: all 10 modes x idle/quiz/calibration states
- Verify calibration prompt ("Press C") shows in fretboard + ukulele
- Verify quiz-prompt shows questions in all text modes
- Verify `.quiz-prompt:empty { display: none }` still hides empty prompt

## Risk

Low. Pure structural refactor — no behavioral change. Every mode had these
elements; they just move from per-mode templates to the shared scaffold.

## Files modified

| File                  | Change                                        |
| --------------------- | --------------------------------------------- |
| `src/html-helpers.ts` | Add to scaffold, remove 3 exports             |
| `main.ts`             | Remove from 10 mode templates, remove imports |
| `build.ts`            | Same as main.ts                               |
| `docs/index.html`     | Rebuilt output                                |
