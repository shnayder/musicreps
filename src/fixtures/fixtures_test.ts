// Fixture round-trip tests: validates that fixture item IDs produce valid
// questions for each mode, and that fixture builders produce valid engine state.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { defaultItems } from './items.ts';
import {
  quizActive,
  quizCorrectFeedback,
  quizRoundComplete,
  quizWrongFeedback,
} from './quiz-page.ts';

// Mode-specific getQuestion / parseItem functions
import { getQuestion as getNSQuestion } from '../modes/note-semitones/logic.ts';
import { getQuestion as getISQuestion } from '../modes/interval-semitones/logic.ts';
import { getQuestion as getSMQuestion } from '../modes/semitone-math/logic.ts';
import { getQuestion as getIMQuestion } from '../modes/interval-math/logic.ts';
import { getQuestion as getKSQuestion } from '../modes/key-signatures/logic.ts';
import { getQuestion as getSDQuestion } from '../modes/scale-degrees/logic.ts';
import { getQuestion as getDCQuestion } from '../modes/diatonic-chords/logic.ts';
import { parseItem as parseCSItem } from '../modes/chord-spelling/logic.ts';
import { getPositionsForNote } from '../modes/speed-tap/logic.ts';
import { createFretboardHelpers } from '../quiz-fretboard-state.ts';
import {
  GUITAR,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
  UKULELE,
} from '../music-data.ts';

// Fretboard helpers for guitar and ukulele
const guitarFb = createFretboardHelpers({
  notes: NOTES,
  naturalNotes: NATURAL_NOTES,
  stringOffsets: GUITAR.stringOffsets,
  fretCount: GUITAR.fretCount,
  noteMatchesInput,
});

const ukeFb = createFretboardHelpers({
  notes: NOTES,
  naturalNotes: NATURAL_NOTES,
  stringOffsets: UKULELE.stringOffsets,
  fretCount: UKULELE.fretCount,
  noteMatchesInput,
});

// Map of mode ID → getQuestion function
const modeQuestionFns: Record<string, (itemId: string) => unknown> = {
  fretboard: (id) => guitarFb.parseFretboardItem(id),
  ukulele: (id) => ukeFb.parseFretboardItem(id),
  noteSemitones: getNSQuestion,
  intervalSemitones: getISQuestion,
  semitoneMath: getSMQuestion,
  intervalMath: getIMQuestion,
  keySignatures: getKSQuestion,
  scaleDegrees: getSDQuestion,
  diatonicChords: getDCQuestion,
  chordSpelling: parseCSItem,
  speedTap: (id) => ({ positions: getPositionsForNote(id) }),
};

// ---------------------------------------------------------------------------
// 1. Item ID validity: each defaultItems entry produces a valid question
// ---------------------------------------------------------------------------

describe('fixture item ID validity', () => {
  for (const [modeId, itemId] of Object.entries(defaultItems)) {
    it(`${modeId}: getQuestion("${itemId}") returns a valid question`, () => {
      const fn = modeQuestionFns[modeId];
      assert.ok(fn, `No getQuestion function for mode ${modeId}`);
      const q = fn(itemId);
      assert.ok(
        q,
        `getQuestion returned null/undefined for ${modeId}:${itemId}`,
      );
      assert.equal(typeof q, 'object');

      // Mode-specific shape checks
      if (modeId === 'fretboard' || modeId === 'ukulele') {
        const fb = q as {
          currentString: number;
          currentFret: number;
          currentNote: string;
        };
        assert.equal(typeof fb.currentString, 'number');
        assert.equal(typeof fb.currentFret, 'number');
        assert.equal(typeof fb.currentNote, 'string');
      } else if (modeId === 'speedTap') {
        const st = q as { positions: { string: number; fret: number }[] };
        assert.ok(st.positions.length > 0, 'Speed tap should have positions');
      } else if (modeId === 'chordSpelling') {
        const cs = q as {
          rootName: string;
          chordType: { symbol: string };
          tones: string[];
        };
        assert.equal(typeof cs.rootName, 'string');
        assert.ok(cs.tones.length > 0, 'Chord spelling should have tones');
      } else if ('dir' in (q as Record<string, unknown>)) {
        // Bidirectional modes
        const bi = q as { dir: string };
        assert.ok(
          bi.dir === 'fwd' || bi.dir === 'rev',
          `Expected dir to be "fwd" or "rev", got "${bi.dir}"`,
        );
      } else if ('promptText' in (q as Record<string, unknown>)) {
        // Math modes (semitone-math, interval-math)
        const math = q as { promptText: string };
        assert.equal(typeof math.promptText, 'string');
        assert.ok(math.promptText.length > 0, 'promptText should be non-empty');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Engine state validity: fixture builders produce correct engine state
// ---------------------------------------------------------------------------

describe('fixture engine state validity', () => {
  const testItemId = defaultItems.semitoneMath;

  it('quizActive produces active phase awaiting answer', () => {
    const fixture = quizActive(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.currentItemId, testItemId);
    assert.equal(es.answered, false);
    assert.equal(es.feedbackCorrect, null);
  });

  it('quizCorrectFeedback produces active phase with correct answer', () => {
    const fixture = quizCorrectFeedback(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.currentItemId, testItemId);
    assert.equal(es.answered, true);
    assert.equal(es.feedbackCorrect, true);
  });

  it('quizWrongFeedback produces active phase with wrong answer', () => {
    const fixture = quizWrongFeedback(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.currentItemId, testItemId);
    assert.equal(es.answered, true);
    assert.equal(es.feedbackCorrect, false);
  });

  it('quizRoundComplete produces round-complete phase', () => {
    const fixture = quizRoundComplete();
    const es = fixture.engineState!;
    assert.equal(es.phase, 'round-complete');
    assert.equal(es.currentItemId, null);
  });

  it('all fixture builders include timer data', () => {
    for (
      const fixture of [
        quizActive(testItemId),
        quizCorrectFeedback(testItemId),
        quizWrongFeedback(testItemId),
        quizRoundComplete(),
      ]
    ) {
      assert.equal(typeof fixture.timerPct, 'number');
      assert.equal(typeof fixture.timerText, 'string');
      assert.equal(typeof fixture.timerWarning, 'boolean');
      assert.equal(typeof fixture.timerLastQuestion, 'boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Manifest completeness: every mode ID has a default item
// ---------------------------------------------------------------------------

describe('fixture manifest completeness', () => {
  const ALL_MODE_IDS = [
    'fretboard',
    'ukulele',
    'noteSemitones',
    'intervalSemitones',
    'semitoneMath',
    'intervalMath',
    'keySignatures',
    'scaleDegrees',
    'diatonicChords',
    'chordSpelling',
    'speedTap',
  ];

  it('defaultItems covers every mode', () => {
    for (const modeId of ALL_MODE_IDS) {
      assert.ok(
        modeId in defaultItems,
        `defaultItems missing mode: ${modeId}`,
      );
    }
  });

  it('defaultItems has no extraneous entries', () => {
    for (const key of Object.keys(defaultItems)) {
      assert.ok(
        ALL_MODE_IDS.includes(key),
        `defaultItems has unknown mode: ${key}`,
      );
    }
  });
});
