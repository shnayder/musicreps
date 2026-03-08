import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  checkAnswer,
  getGridItemId,
  getItemIdsForGroup,
  handleInput,
  initSequentialState,
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
  it('first correct note for "C:major" returns { status: "continue" }', () => {
    const state = initSequentialState('C:major');
    const result = handleInput('C:major', 'C', state);
    assert.equal(result.status, 'continue');
  });

  it('first correct note advances entries in returned state', () => {
    const state = initSequentialState('C:major');
    const result = handleInput('C:major', 'C', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') {
      assert.equal(result.state.entries.length, 1);
      assert.equal(result.state.entries[0].correct, true);
    }
  });

  it('entering all notes for "C:major" returns { status: "complete", correct: true }', () => {
    let state = initSequentialState('C:major');

    // Enter C
    let result = handleInput('C:major', 'C', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') state = result.state;

    // Enter E
    result = handleInput('C:major', 'E', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') state = result.state;

    // Enter G (final note — should complete)
    result = handleInput('C:major', 'G', state);
    assert.equal(result.status, 'complete');
    if (result.status === 'complete') {
      assert.equal(result.correct, true);
    }
  });

  it('complete result includes final state with all entries', () => {
    let state = initSequentialState('C:major');
    let result = handleInput('C:major', 'C', state);
    if (result.status === 'continue') state = result.state;
    result = handleInput('C:major', 'E', state);
    if (result.status === 'continue') state = result.state;
    result = handleInput('C:major', 'G', state);
    assert.equal(result.status, 'complete');
    if (result.status === 'complete') {
      assert.equal(result.state.entries.length, 3);
      assert.equal(result.state.entries[0].display, 'C');
      assert.equal(result.state.entries[1].display, 'E');
      assert.equal(result.state.entries[2].display, 'G');
    }
  });

  it('entering a wrong note and completing still returns complete with correct: false', () => {
    let state = initSequentialState('C:major');

    // Enter wrong first note
    let result = handleInput('C:major', 'D', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') state = result.state;

    // Enter E
    result = handleInput('C:major', 'E', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') state = result.state;

    // Enter G
    result = handleInput('C:major', 'G', state);
    assert.equal(result.status, 'complete');
    if (result.status === 'complete') {
      assert.equal(result.correct, false);
    }
  });

  it('flat-root chord complete result uses flat spellings in display', () => {
    // Bb minor: Bb Db F
    let state = initSequentialState('Bb:minor');
    let result = handleInput('Bb:minor', 'Bb', state);
    if (result.status === 'continue') state = result.state;
    result = handleInput('Bb:minor', 'Db', state);
    if (result.status === 'continue') state = result.state;
    result = handleInput('Bb:minor', 'F', state);
    assert.equal(result.status, 'complete');
    if (result.status === 'complete') {
      assert.equal(result.state.entries.length, 3);
      // Display should use flat spellings, not sharps
      assert.equal(result.state.entries[0].display, 'B\u266D');
      assert.equal(result.state.entries[1].display, 'D\u266D');
      assert.equal(result.state.entries[2].display, 'F');
    }
  });

  it('enharmonic input (e.g. "Gb" for "F#") is accepted as correct', () => {
    // F#:major has tones F#, A#, C#
    const state = initSequentialState('F#:major');
    const result = handleInput('F#:major', 'Gb', state);
    assert.equal(result.status, 'continue');
    if (result.status === 'continue') {
      // Enharmonic match is normalized — entry should be marked correct
      assert.equal(result.state.entries[0].correct, true);
    }
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
