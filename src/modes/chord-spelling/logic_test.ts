import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  checkAnswer,
  evaluateSequential,
  getGridItemId,
  getItemIdsForGroup,
  handleInput,
  initSequentialState,
  parseChordInput,
  parseItem,
  SPELLING_GROUPS,
} from './logic.ts';

describe('ALL_ITEMS', () => {
  it('has items (12 roots × chord types)', () => {
    assert.ok(ALL_ITEMS.length > 0);
    // 12 roots × number of chord types
    assert.equal(ALL_ITEMS.length % 12, 0);
  });

  it('contains expected items', () => {
    assert.ok(ALL_ITEMS.includes('C:major'));
    assert.ok(ALL_ITEMS.includes('F#:dim'));
    assert.ok(ALL_ITEMS.includes('Bb:minor'));
  });
});

describe('SPELLING_GROUPS', () => {
  it('has at least 1 group', () => {
    assert.ok(SPELLING_GROUPS.length >= 1);
  });

  it('each group has types and a label', () => {
    for (const g of SPELLING_GROUPS) {
      assert.ok(Array.isArray(g.types));
      assert.ok(g.types.length > 0);
      assert.ok(typeof g.label === 'string');
    }
  });
});

describe('getItemIdsForGroup', () => {
  it('group 0 returns non-empty array', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(ids.length > 0);
  });

  it('group 0 items contain chord type names in "root:type" format', () => {
    const ids = getItemIdsForGroup(0);
    for (const id of ids) {
      assert.ok(id.includes(':'), `item "${id}" should contain a colon`);
      const colonIdx = id.indexOf(':');
      assert.ok(colonIdx > 0, `item "${id}" root should be non-empty`);
      assert.ok(
        colonIdx < id.length - 1,
        `item "${id}" type should be non-empty`,
      );
    }
  });

  it('group 0 items include expected roots', () => {
    const ids = getItemIdsForGroup(0);
    // Each group should have items for all 12 roots
    const roots = new Set(ids.map((id) => id.substring(0, id.indexOf(':'))));
    assert.ok(roots.has('C'));
    assert.ok(roots.has('F#'));
    assert.ok(roots.has('Bb'));
  });
});

describe('parseItem', () => {
  it('"C:major" returns rootName "C", chordType with name "major", tones starting with "C"', () => {
    const q = parseItem('C:major');
    assert.equal(q.rootName, 'C');
    assert.equal(q.chordType.name, 'major');
    assert.ok(Array.isArray(q.tones));
    assert.ok(q.tones.length > 0);
    assert.equal(q.tones[0], 'C');
  });

  it('"C:major" tones are ["C", "E", "G"]', () => {
    const q = parseItem('C:major');
    assert.deepEqual(q.tones, ['C', 'E', 'G']);
  });

  it('"F#:dim" returns rootName "F#", chordType with name "dim"', () => {
    const q = parseItem('F#:dim');
    assert.equal(q.rootName, 'F#');
    assert.equal(q.chordType.name, 'dim');
    assert.ok(q.tones.length > 0);
    assert.equal(q.tones[0], 'F#');
  });

  it('"Db:minor" returns rootName "Db" with tones starting with "Db"', () => {
    const q = parseItem('Db:minor');
    assert.equal(q.rootName, 'Db');
    assert.equal(q.tones[0], 'Db');
  });
});

describe('initSequentialState', () => {
  it('"C:major" returns expectedCount 3 (triad), empty entries', () => {
    const state = initSequentialState('C:major');
    assert.equal(state.expectedCount, 3);
    assert.deepEqual(state.entries, []);
  });

  it('"C:dom7" returns expectedCount 4 (seventh chord)', () => {
    const state = initSequentialState('C:dom7');
    assert.equal(state.expectedCount, 4);
    assert.deepEqual(state.entries, []);
  });

  it('expectedCount matches chord tones length', () => {
    const q = parseItem('C:major');
    const state = initSequentialState('C:major');
    assert.equal(state.expectedCount, q.tones.length);
  });
});

describe('handleInput', () => {
  it('first note returns { status: "continue" } with correct: null', () => {
    const state = initSequentialState('C:major');
    const result = handleInput('C:major', 'C', state);
    assert.equal(result.status, 'continue');
    assert.equal(result.state.entries.length, 1);
    assert.equal(result.state.entries[0].correct, null);
  });

  it('entries accumulate without evaluation', () => {
    let state = initSequentialState('C:major');
    let result = handleInput('C:major', 'C', state);
    assert.equal(result.status, 'continue');
    state = result.state;

    result = handleInput('C:major', 'E', state);
    assert.equal(result.status, 'continue');
    assert.equal(result.state.entries.length, 2);
    assert.equal(result.state.entries[0].correct, null);
    assert.equal(result.state.entries[1].correct, null);
  });

  it('entering all notes returns { status: "complete" }', () => {
    let state = initSequentialState('C:major');
    let result = handleInput('C:major', 'C', state);
    state = result.state;
    result = handleInput('C:major', 'E', state);
    state = result.state;
    result = handleInput('C:major', 'G', state);
    assert.equal(result.status, 'complete');
    assert.equal(result.state.entries.length, 3);
    // Not yet evaluated
    assert.equal(result.state.entries[0].correct, null);
  });

  it('displays user input as-is (no normalization)', () => {
    const state = initSequentialState('F#:major');
    // Enter enharmonic "Gb" — should display as Gb, not normalize to F#
    const result = handleInput('F#:major', 'Gb', state);
    assert.equal(result.state.entries[0].display, 'G\u266D');
    assert.equal(result.state.entries[0].correct, null);
  });
});

describe('evaluateSequential', () => {
  it('all correct notes → correct: true', () => {
    let state = initSequentialState('C:major');
    for (const note of ['C', 'E', 'G']) {
      const r = handleInput('C:major', note, state);
      state = r.state;
    }
    const result = evaluateSequential('C:major', state);
    assert.equal(result.correct, true);
    assert.equal(result.state.entries.every((e) => e.correct), true);
  });

  it('wrong note → correct: false, per-entry marks', () => {
    let state = initSequentialState('C:major');
    for (const note of ['C', 'F', 'G']) {
      const r = handleInput('C:major', note, state);
      state = r.state;
    }
    const result = evaluateSequential('C:major', state);
    assert.equal(result.correct, false);
    assert.equal(result.state.entries[0].correct, true);
    assert.equal(result.state.entries[1].correct, false); // F instead of E
    assert.equal(result.state.entries[2].correct, true);
  });

  it('correctAnswer is the spelled tones joined by spaces', () => {
    let state = initSequentialState('C:major');
    for (const note of ['C', 'E', 'G']) {
      const r = handleInput('C:major', note, state);
      state = r.state;
    }
    const result = evaluateSequential('C:major', state);
    assert.equal(result.correctAnswer, 'C E G');
  });

  it('correct entries display canonical spelling', () => {
    let state = initSequentialState('Bb:minor');
    for (const note of ['Bb', 'Db', 'F']) {
      const r = handleInput('Bb:minor', note, state);
      state = r.state;
    }
    const result = evaluateSequential('Bb:minor', state);
    assert.equal(result.correct, true);
    assert.equal(result.state.entries[0].display, 'B\u266D');
    assert.equal(result.state.entries[1].display, 'D\u266D');
    assert.equal(result.state.entries[2].display, 'F');
  });

  it('enharmonic equivalents are rejected (strict spelling)', () => {
    // F#:major expects F#, A#, C# — entering Gb should be wrong
    let state = initSequentialState('F#:major');
    for (const note of ['Gb', 'A#', 'C#']) {
      const r = handleInput('F#:major', note, state);
      state = r.state;
    }
    const result = evaluateSequential('F#:major', state);
    assert.equal(result.correct, false);
    assert.equal(result.state.entries[0].correct, false); // Gb ≠ F#
    assert.equal(result.state.entries[1].correct, true);
    assert.equal(result.state.entries[2].correct, true);
  });

  it('B ≠ Cb (strict enharmonic check)', () => {
    // Gb:major expects Gb, Bb, Db — entering B instead of Cb should be wrong
    // Actually let's use a chord that has Cb. Let's try Gb:major = Gb Bb Db
    // Hmm, Gb:major doesn't have Cb. Let's try a known case:
    // F#:dim = F# A C — entering B# instead of C should be wrong
    let state = initSequentialState('F#:dim');
    const tones = parseItem('F#:dim').tones;
    // Enter first tones correctly, then wrong spelling for last
    for (let i = 0; i < tones.length - 1; i++) {
      const r = handleInput('F#:dim', tones[i], state);
      state = r.state;
    }
    // Enter enharmonic spelling for last tone
    const lastTone = tones[tones.length - 1];
    const wrongSpelling = lastTone === 'C' ? 'B#' : lastTone + 'b';
    const r = handleInput('F#:dim', wrongSpelling, state);
    state = r.state;
    const result = evaluateSequential('F#:dim', state);
    assert.equal(
      result.state.entries[tones.length - 1].correct,
      false,
      `"${wrongSpelling}" should not match "${lastTone}"`,
    );
  });
});

describe('parseChordInput', () => {
  it('splits by whitespace', () => {
    assert.deepEqual(parseChordInput('C E G'), ['C', 'E', 'G']);
  });

  it('handles multiple spaces', () => {
    assert.deepEqual(parseChordInput('C  E   G'), ['C', 'E', 'G']);
  });

  it('normalizes case', () => {
    assert.deepEqual(parseChordInput('c e g'), ['C', 'E', 'G']);
  });

  it('"s" suffix is sharp', () => {
    assert.deepEqual(parseChordInput('fs'), ['F#']);
    assert.deepEqual(parseChordInput('Cs'), ['C#']);
  });

  it('"S" suffix is sharp (case-insensitive)', () => {
    assert.deepEqual(parseChordInput('FS'), ['F#']);
  });

  it('"b" suffix is flat', () => {
    assert.deepEqual(parseChordInput('Bb Db F'), ['Bb', 'Db', 'F']);
  });

  it('"#" suffix stays as sharp', () => {
    assert.deepEqual(parseChordInput('F# A# C#'), ['F#', 'A#', 'C#']);
  });

  it('mixed accidentals', () => {
    assert.deepEqual(parseChordInput('A Cb fs'), ['A', 'Cb', 'F#']);
  });

  it('trims leading/trailing whitespace', () => {
    assert.deepEqual(parseChordInput('  C E G  '), ['C', 'E', 'G']);
  });

  it('empty string returns empty array', () => {
    assert.deepEqual(parseChordInput(''), []);
  });

  it('handles Bb (note B-flat)', () => {
    // "bb" should parse as B + flat → Bb
    assert.deepEqual(parseChordInput('bb'), ['Bb']);
  });
});

describe('checkAnswer', () => {
  it('"__correct__" input returns correct: true', () => {
    const result = checkAnswer('C:major', '__correct__');
    assert.equal(result.correct, true);
  });

  it('any other input returns correct: false', () => {
    const result = checkAnswer('C:major', 'C E G');
    assert.equal(result.correct, false);
  });

  it('empty string returns correct: false', () => {
    const result = checkAnswer('C:major', '');
    assert.equal(result.correct, false);
  });

  it('correctAnswer is the spelled tones joined by spaces', () => {
    const result = checkAnswer('C:major', '__correct__');
    assert.equal(result.correctAnswer, 'C E G');
  });
});

describe('getGridItemId', () => {
  it('"C", 0 returns a string in "root:type" format', () => {
    const result = getGridItemId('C', 0);
    assert.equal(typeof result, 'string');
    assert.ok((result as string).startsWith('C:'));
    assert.ok((result as string).includes(':'));
  });

  it('"F#", 0 returns a string starting with "F#:"', () => {
    const result = getGridItemId('F#', 0);
    assert.ok((result as string).startsWith('F#:'));
  });

  it('result matches item format used in ALL_ITEMS', () => {
    const result = getGridItemId('C', 0) as string;
    assert.ok(ALL_ITEMS.includes(result), `"${result}" should be in ALL_ITEMS`);
  });
});
