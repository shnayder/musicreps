import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  evaluate,
  getGridItemId,
  getItemIdsForGroup,
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
    const ids = getItemIdsForGroup('triads-major');
    assert.ok(ids.length > 0);
  });

  it('group 0 items contain chord type names in "root:type" format', () => {
    const ids = getItemIdsForGroup('triads-major');
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
    const ids = getItemIdsForGroup('triads-major');
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

describe('evaluate', () => {
  it('all correct notes → correct: true', () => {
    const q = parseItem('C:major');
    const result = evaluate(q, ['C', 'E', 'G']);
    assert.equal(result.correct, true);
    assert.equal(result.perEntry.every((e) => e.correct), true);
  });

  it('wrong note → correct: false, per-entry marks', () => {
    const q = parseItem('C:major');
    const result = evaluate(q, ['C', 'F', 'G']);
    assert.equal(result.correct, false);
    assert.equal(result.perEntry[0].correct, true);
    assert.equal(result.perEntry[1].correct, false); // F instead of E
    assert.equal(result.perEntry[2].correct, true);
  });

  it('correctAnswer is the spelled tones joined by spaces', () => {
    const q = parseItem('C:major');
    const result = evaluate(q, ['C', 'E', 'G']);
    assert.equal(result.correctAnswer, 'C E G');
  });

  it('correct entries display canonical spelling', () => {
    const q = parseItem('Bb:minor');
    const result = evaluate(q, ['Bb', 'Db', 'F']);
    assert.equal(result.correct, true);
    assert.equal(result.perEntry[0].display, 'B\u266D');
    assert.equal(result.perEntry[1].display, 'D\u266D');
    assert.equal(result.perEntry[2].display, 'F');
  });

  it('enharmonic equivalents are rejected (strict spelling)', () => {
    const q = parseItem('F#:major');
    const result = evaluate(q, ['Gb', 'A#', 'C#']);
    assert.equal(result.correct, false);
    assert.equal(result.perEntry[0].correct, false); // Gb ≠ F#
    assert.equal(result.perEntry[1].correct, true);
    assert.equal(result.perEntry[2].correct, true);
  });

  it('wrong enharmonic spelling for last tone is rejected', () => {
    const q = parseItem('F#:dim');
    const tones = q.tones;
    const inputs = [...tones];
    const lastTone = tones[tones.length - 1];
    inputs[inputs.length - 1] = lastTone === 'C' ? 'B#' : lastTone + 'b';
    const result = evaluate(q, inputs);
    assert.equal(
      result.perEntry[tones.length - 1].correct,
      false,
      `"${inputs[inputs.length - 1]}" should not match "${lastTone}"`,
    );
  });

  it('wrong entry displays user input, not canonical', () => {
    const q = parseItem('C:major');
    const result = evaluate(q, ['C', 'F', 'G']);
    // F is wrong (should be E), so display shows user's input
    assert.equal(result.perEntry[1].display, 'F');
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
    assert.deepEqual(parseChordInput('bb'), ['Bb']);
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
