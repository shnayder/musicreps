# Solfège Display & Global Settings — Implementation Plan

## Problem / Context

Users want to drill note identification using solfège syllables (Do, Re, Mi)
instead of letter names (C, D, E). This requires a global display setting that
translates note names throughout the app and a settings modal to toggle it.

Design spec:
`plans/product-specs/active/2026-02-15-solfege-and-settings-spec.md`

## Design

### Data layer (music-data.js)

Add solfège mapping and translation functions. Internal representation stays
letter-name — solfège is a display-only transformation.

```javascript
const SOLFEGE_MAP = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

let _useSolfege = false;
function setUseSolfege(v) {
  _useSolfege = v;
}
function getUseSolfege() {
  return _useSolfege;
}

// "C#" → "Do#", "Db" → "Re♭", "C" → "Do"
function displayNote(name) {
  if (!_useSolfege || !name) return name;
  const letter = name[0].toUpperCase();
  const syl = SOLFEGE_MAP[letter];
  if (!syl) return name;
  const acc = name.slice(1).replace(/b/g, '♭');
  return syl + acc;
}

// "C#/Db" → "Do#/Re♭"
function displayNotePair(displayName) {
  if (!_useSolfege) return displayName;
  if (!displayName.includes('/')) return displayNote(displayName);
  const [s, f] = displayName.split('/');
  return displayNote(s) + '/' + displayNote(f);
}
```

Persist in `localStorage.fretboard_notation` ('letter' | 'solfege'). Load on
module evaluation (before any mode initializes).

### Keyboard handler (quiz-engine.js)

New `createSolfegeKeyHandler(submitAnswer, allowAccidentals)`:

- Buffers 2-char solfège syllables: do→C, re→D, mi→E, fa→F, so→G, la→A, si→B
- Case-insensitive input (accepts Do, DO, do, etc.)
- After syllable resolves, waits 400ms for `#`/`b` accidental (same as letter
  handler)
- All syllables unambiguous after 2 chars ("so"→G, "si"→B)

Wrapper `createAdaptiveKeyHandler(submitAnswer, allowAccidentals)`:

- Delegates to solfège or letter handler based on `getUseSolfege()`
- Drop-in replacement for `createNoteKeyHandler` — all modes switch to this

### Button label refresh

Utility function `refreshNoteButtonLabels(container)`:

- Updates all `.answer-btn-note` and `.note-btn` text from `data-note` attr
- Called on notation change and on mode activate

In modes that dynamically set button labels (semitone math, interval math), the
`presentQuestion()` already sets labels — those call sites wrap in
`displayNote()`. The `onStop()` reset also uses `displayNotePair()`.

### Per-mode translation

Each mode wraps note names through `displayNote()`/`displayNotePair()` in:

- `presentQuestion()` — prompt text
- `checkAnswer()` — `correctAnswer` return value
- `onStop()` — button label reset (modes that dynamically set labels)
- Stats table row labels (for key-based modes)

No changes to item IDs, storage keys, or answer-checking logic. The internal
note names stay as-is. Translation happens only at the display boundary.

### Stats display

`renderStatsGrid()` applies `displayNotePair()` to row labels (currently uses
`note.displayName`). Modes that pass custom labels (key-based modes) translate
in their own stats render callbacks.

### Settings modal (new file: settings.js)

```
createSettingsModal({ onNotationChange })
```

- Creates modal DOM (overlay + card) and appends to body
- Notation toggle: two-button group (A B C / Do Re Mi)
- Open/close: gear icon click opens, × or backdrop closes
- Returns `{ open, close }`

### Top bar changes

Add gear icon to the right of the version number. Gear click opens settings
modal. Gear icon hidden during active quiz/calibration (CSS-driven via phase
classes on mode-screen).

### Calibration unchanged

Recalibrate button stays per-mode in the idle screen. No changes to calibration
wiring in quiz-engine.js or modeScreen() scaffold.

## Implementation Steps

### 1. music-data.js — solfège data layer

- Add `SOLFEGE_MAP` (capitalized: Do, Re, Mi, ...)
- Add `displayNote()`, `displayNotePair()`
- Add `getUseSolfege()`, `setUseSolfege(v)` with localStorage persistence
- Load notation preference on module evaluation
- Add tests for translation functions

### 2. quiz-engine.js — keyboard handlers

- Add `createSolfegeKeyHandler(submitAnswer, allowAccidentals)`
  (case-insensitive)
- Add `createAdaptiveKeyHandler(submitAnswer, allowAccidentals)` wrapper
- Add `refreshNoteButtonLabels(container)` utility
- Add tests for solfège key handler

### 3. stats-display.js — row label translation

- In `renderStatsGrid()`, apply `displayNotePair()` to row labels

### 4. quiz-fretboard-state.js — answer display

- `checkFretboardAnswer()`: wrap `correctAnswer` in `displayNote()`

### 5. quiz-fretboard.js — fretboard display

- `showNoteText()`: wrap `getNoteAtPosition()` result in `displayNote()`
- Switch `createNoteKeyHandler` → `createAdaptiveKeyHandler`
- In `activate()`: refresh button labels (call `refreshNoteButtonLabels`)

### 6. quiz-speed-tap.js — note display

- `showNoteText()`: wrap in `displayNote()`
- Prompt note display: wrap in `displayNotePair()`
- Stats table headers: wrap in `displayNotePair()`

### 7. quiz-note-semitones.js

- Forward prompt: `displayNotePair(note.displayName)`
- Reverse correctAnswer: `displayNotePair(note.displayName)`
- Stats table labels: `displayNotePair(note.displayName)`
- Switch to `createAdaptiveKeyHandler`

### 8. quiz-semitone-math.js + quiz-interval-math.js

- Prompt: `displayNote(pickAccidentalName(...))`
- Button labels in presentQuestion: `displayNote(pickAccidentalName(...))`
- correctAnswer: `displayNote(pickAccidentalName(...))`
- onStop label reset: `displayNotePair(note.displayName)`
- Switch to `createAdaptiveKeyHandler`

### 9. quiz-key-signatures.js

- Forward prompt: `displayNote(key.root) + ' major = ?'`
- Reverse correctAnswer: `displayNote(key.root)`
- Stats row labels: `displayNote(key.root) + ' major'`
- Switch to `createAdaptiveKeyHandler`

### 10. quiz-scale-degrees.js

- Forward prompt: `... of ${displayNote(key.root)} major = ?`
- Reverse prompt: `${displayNote(key.root)} major: ${displayNote(noteName)} = ?`
- Forward correctAnswer: `displayNote(noteName)`
- Stats row labels: `displayNote(key.root)`
- Switch to `createAdaptiveKeyHandler`

### 11. quiz-diatonic-chords.js

- Forward prompt: `${numeral} in ${displayNote(key.root)} major = ?`
- Reverse prompt:
  `${displayNote(rootNote)}${qual} in ${displayNote(key.root)} major = ?`
- Forward correctAnswer: `displayNote(rootNote) + ' ' + quality`
- Switch to `createAdaptiveKeyHandler`

### 12. quiz-chord-spelling.js

- Prompt: `displayNote(root) + type.symbol + ' = ?'`
- Slot display: wrap expected tone in `displayNote()`
- correctAnswer: `tones.map(displayNote).join(' ')`
- Switch to `createAdaptiveKeyHandler`

### 13. settings.js — new file

- `createSettingsModal({ onNotationChange })`
- DOM creation: overlay, card, notation toggle, close button
- localStorage read/write for notation
- Open/close logic

### 14. styles.css — modal + gear styles

- `.settings-overlay` — fixed, dimmed backdrop
- `.settings-modal` — centered card
- `.settings-toggle` — two-option notation switch
- `.gear-btn` — top-bar gear icon, hidden during active quiz

### 15. main.ts + build.ts — wiring

- Add gear icon button after version number in top bar
- Add settings modal HTML to template
- Add `readFile('./src/settings.js')` to script concatenation (before
  navigation.js)
- Both files stay in sync

### 16. app.js — wire everything together

- Create settings modal with callbacks
- `onNotationChange`: call `refreshNoteButtonLabels()` on current mode
  container, refresh stats display if showing

### 17. Tests

- music-data: `displayNote`, `displayNotePair`, `setUseSolfege`
- quiz-engine: solfège key handler buffer, disambiguation, accidentals, case
  insensitivity

### 18. Version bump

- v3.10 → v3.11

## Files Modified

| File                          | Changes                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `src/music-data.js`           | Solfège map, translation fns, notation state                       |
| `src/quiz-engine.js`          | Solfège key handler, adaptive wrapper, `refreshNoteButtonLabels`   |
| `src/stats-display.js`        | Row label translation in `renderStatsGrid`                         |
| `src/quiz-fretboard-state.js` | `displayNote` in correctAnswer                                     |
| `src/quiz-fretboard.js`       | `displayNote` in showNoteText, adaptive key handler, label refresh |
| `src/quiz-speed-tap.js`       | `displayNote` in prompts, labels, stats                            |
| `src/quiz-note-semitones.js`  | `displayNotePair` in prompts, answers, stats                       |
| `src/quiz-semitone-math.js`   | `displayNote` in prompts, answers, button labels                   |
| `src/quiz-interval-math.js`   | Same as semitone math                                              |
| `src/quiz-key-signatures.js`  | `displayNote` in key names                                         |
| `src/quiz-scale-degrees.js`   | `displayNote` in key/note names                                    |
| `src/quiz-diatonic-chords.js` | `displayNote` in chord/key names                                   |
| `src/quiz-chord-spelling.js`  | `displayNote` in chord names, tone display                         |
| `src/settings.js`             | **New** — settings modal logic                                     |
| `src/styles.css`              | Modal/gear styles                                                  |
| `src/app.js`                  | Wire settings modal                                                |
| `main.ts`                     | Gear icon, settings HTML, settings.js in build                     |
| `build.ts`                    | Sync with main.ts                                                  |

## Testing

- Unit tests: `displayNote`, `displayNotePair`, solfège key handler
- Manual: toggle notation in settings → verify all modes show solfège
- Manual: type solfège abbreviations (any case) → verify answer submission
- Manual: settings gear hidden during active quiz

## Rebase notes

After rebasing on main, the bidirectional modes (key-signatures, scale-degrees,
diatonic-chords) now use CSS class toggling (`answer-group-hidden`) instead of
`style.display` for showing/hiding answer button groups. The implementation
should follow this pattern.

## Version

v3.10 → v3.11
