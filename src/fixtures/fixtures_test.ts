// Fixture round-trip tests: validates that fixture item IDs produce valid
// questions for each mode, and that fixture builders produce valid engine state.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { defaultItems } from './items.ts';
import {
  quizActive,
  quizCorrectFeedback,
  quizFeedbackTimerExpired,
  quizFeedbackTimerLow,
  quizLastQuestionAnswered,
  quizLastQuestionAwaiting,
  quizRoundComplete,
  quizWrongFeedback,
  speedCheckIntro,
  speedCheckResults,
  speedCheckTesting,
} from './quiz-page.ts';

// Mode-specific getQuestion / parseItem functions
import { getQuestion as getNSQuestion } from '../skills/note-semitones/logic.ts';
import { getQuestion as getISQuestion } from '../skills/interval-semitones/logic.ts';
import { getQuestion as getSMQuestion } from '../skills/semitone-math/logic.ts';
import { getQuestion as getIMQuestion } from '../skills/interval-math/logic.ts';
import { getQuestion as getKSQuestion } from '../skills/key-signatures/logic.ts';
import { getQuestion as getSDQuestion } from '../skills/scale-degrees/logic.ts';
import { getQuestion as getDCQuestion } from '../skills/diatonic-chords/logic.ts';
import { parseItem as parseCSItem } from '../skills/chord-spelling/logic.ts';
import { parseItem as parseChordShapesItem } from '../skills/chord-shapes/logic.ts';
import { getPositionsForNote } from '../skills/speed-tap/logic.ts';
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
  guitarChordShapes: (id) => parseChordShapesItem('guitar', id),
  ukuleleChordShapes: (id) => parseChordShapesItem('ukulele', id),
};

// ---------------------------------------------------------------------------
// 1. Item ID validity: each defaultItems entry produces a valid question
// ---------------------------------------------------------------------------

describe('fixture item ID validity', () => {
  for (const [key, itemId] of Object.entries(defaultItems)) {
    // Strip _rev suffix to get the base mode ID
    const skillId = key.replace(/_rev$/, '');
    it(`${key}: getQuestion("${itemId}") returns a valid question`, () => {
      const fn = modeQuestionFns[skillId];
      assert.ok(fn, `No getQuestion function for mode ${skillId}`);
      const q = fn(itemId);
      assert.ok(
        q,
        `getQuestion returned null/undefined for ${skillId}:${itemId}`,
      );
      assert.equal(typeof q, 'object');

      // Mode-specific shape checks
      if (skillId === 'fretboard' || skillId === 'ukulele') {
        const fb = q as {
          currentString: number;
          currentFret: number;
          currentNote: string;
        };
        assert.equal(typeof fb.currentString, 'number');
        assert.equal(typeof fb.currentFret, 'number');
        assert.equal(typeof fb.currentNote, 'string');
      } else if (skillId === 'speedTap') {
        const st = q as { positions: { string: number; fret: number }[] };
        assert.ok(st.positions.length > 0, 'Speed tap should have positions');
      } else if (skillId === 'chordSpelling') {
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

  it('quizFeedbackTimerLow produces feedback with timer warning', () => {
    const fixture = quizFeedbackTimerLow(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.answered, true);
    assert.equal(es.feedbackCorrect, true);
    assert.equal(fixture.timerWarning, true);
    assert.equal(fixture.timerPct, 2);
    assert.equal(fixture.timerLastQuestion, false);
  });

  it('quizLastQuestionAwaiting produces expired timer awaiting answer', () => {
    const fixture = quizLastQuestionAwaiting(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.answered, false);
    assert.equal(es.roundTimerExpired, true);
    assert.equal(fixture.timerLastQuestion, true);
    assert.equal(fixture.timerPct, 0);
  });

  it('quizFeedbackTimerExpired produces feedback with expired timer (answered first)', () => {
    const fixture = quizFeedbackTimerExpired(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.answered, true);
    assert.equal(es.feedbackCorrect, true);
    assert.equal(es.roundTimerExpired, true);
    assert.equal(es.hintText, 'Space to continue');
    assert.equal(fixture.timerLastQuestion, true);
    assert.equal(fixture.timerPct, 0);
  });

  it('quizLastQuestionAnswered produces feedback with expired timer', () => {
    const fixture = quizLastQuestionAnswered(testItemId);
    const es = fixture.engineState!;
    assert.equal(es.phase, 'active');
    assert.equal(es.answered, true);
    assert.equal(es.roundTimerExpired, true);
    assert.equal(es.feedbackCorrect, false);
    assert.equal(es.hintText, 'Space to continue');
    assert.equal(fixture.timerLastQuestion, true);
  });

  it('all fixture builders include timer data', () => {
    for (
      const fixture of [
        quizActive(testItemId),
        quizCorrectFeedback(testItemId),
        quizWrongFeedback(testItemId),
        quizFeedbackTimerLow(testItemId),
        quizFeedbackTimerExpired(testItemId),
        quizLastQuestionAwaiting(testItemId),
        quizLastQuestionAnswered(testItemId),
        quizRoundComplete(),
      ]
    ) {
      assert.equal(typeof fixture.timerPct, 'number');
      assert.equal(typeof fixture.timerText, 'string');
      assert.equal(typeof fixture.timerWarning, 'boolean');
      assert.equal(typeof fixture.timerLastQuestion, 'boolean');
    }
  });

  it('speedCheckIntro produces calibration fixture with intro phase', () => {
    const fixture = speedCheckIntro();
    assert.ok(fixture.calibration);
    assert.equal(fixture.calibration!.phase, 'intro');
  });

  it('speedCheckTesting produces calibration fixture with running phase', () => {
    const fixture = speedCheckTesting();
    assert.ok(fixture.calibration);
    assert.equal(fixture.calibration!.phase, 'running');
    assert.equal(fixture.calibration!.trialProgress, '5 / 10');
    assert.equal(fixture.calibration!.promptAnswer, 'E');
  });

  it('speedCheckResults produces calibration fixture with results phase', () => {
    const fixture = speedCheckResults();
    assert.ok(fixture.calibration);
    assert.equal(fixture.calibration!.phase, 'results');
    assert.equal(fixture.calibration!.baseline, 520);
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
    'guitarChordShapes',
    'ukuleleChordShapes',
  ];

  it('defaultItems covers every mode', () => {
    for (const skillId of ALL_MODE_IDS) {
      assert.ok(
        skillId in defaultItems,
        `defaultItems missing mode: ${skillId}`,
      );
    }
  });

  it('defaultItems has no extraneous entries', () => {
    for (const key of Object.keys(defaultItems)) {
      const baseMode = key.replace(/_rev$/, '');
      assert.ok(
        ALL_MODE_IDS.includes(baseMode),
        `defaultItems has unknown mode: ${key}`,
      );
    }
  });
});
