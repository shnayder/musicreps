import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allItems,
  chordDisplayName,
  evaluate,
  formatGroupLabel,
  getItemIdsForGroup,
  getMutedStrings,
  getPlayedPositions,
  itemId,
  parseItem,
  positionKey,
  QUALITY_GROUPS,
  voicingSummary,
} from './logic.ts';
import { GUITAR_VOICINGS, UKULELE_VOICINGS } from './voicings.ts';

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

describe('positionKey', () => {
  it('formats string-fret key', () => {
    assert.equal(positionKey(2, 5), '2-5');
    assert.equal(positionKey(0, 0), '0-0');
  });
});

describe('getPlayedPositions', () => {
  it('returns non-muted positions for C major guitar', () => {
    // C major: [0, 1, 0, 2, 3, 'x'] → strings 0-4 played
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'C' && v.quality === 'major'
    )!;
    const positions = getPlayedPositions(v);
    assert.equal(positions.length, 5);
    assert.ok(positions.includes('0-0')); // e open
    assert.ok(positions.includes('1-1')); // B fret 1
    assert.ok(positions.includes('4-3')); // A fret 3
    assert.ok(!positions.includes('5-0')); // E is muted
  });

  it('returns all 6 positions for G major guitar (no muted strings)', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'G' && v.quality === 'major'
    )!;
    const positions = getPlayedPositions(v);
    assert.equal(positions.length, 6);
  });
});

describe('getMutedStrings', () => {
  it('C major guitar mutes string 5 (low E)', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'C' && v.quality === 'major'
    )!;
    assert.deepEqual(getMutedStrings(v), [5]);
  });

  it('D major guitar mutes strings 4 and 5', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'D' && v.quality === 'major'
    )!;
    assert.deepEqual(getMutedStrings(v), [4, 5]);
  });

  it('G major guitar has no muted strings', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'G' && v.quality === 'major'
    )!;
    assert.deepEqual(getMutedStrings(v), []);
  });

  it('ukulele chords have no muted strings', () => {
    for (const v of UKULELE_VOICINGS) {
      assert.deepEqual(
        getMutedStrings(v),
        [],
        `${v.root}${v.symbol} should have no muted strings`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Item ID + parsing
// ---------------------------------------------------------------------------

describe('itemId', () => {
  it('formats root:quality', () => {
    assert.equal(itemId(GUITAR_VOICINGS[0]), 'C:major');
  });
});

describe('parseItem', () => {
  it('parses guitar C:major', () => {
    const q = parseItem('guitar', 'C:major');
    assert.equal(q.root, 'C');
    assert.equal(q.quality, 'major');
    assert.equal(q.playedPositions.length, 5);
    assert.deepEqual(q.mutedStrings, [5]);
  });

  it('parses ukulele C:major', () => {
    const q = parseItem('ukulele', 'C:major');
    assert.equal(q.root, 'C');
    assert.equal(q.quality, 'major');
    assert.equal(q.playedPositions.length, 4);
    assert.deepEqual(q.mutedStrings, []);
  });

  it('throws for unknown voicing', () => {
    assert.throws(() => parseItem('guitar', 'Z:major'));
  });
});

// ---------------------------------------------------------------------------
// allItems
// ---------------------------------------------------------------------------

describe('allItems', () => {
  it('guitar has correct count', () => {
    assert.equal(allItems('guitar').length, GUITAR_VOICINGS.length);
  });

  it('ukulele has correct count', () => {
    assert.equal(allItems('ukulele').length, UKULELE_VOICINGS.length);
  });

  it('all guitar IDs are unique', () => {
    const items = allItems('guitar');
    assert.equal(new Set(items).size, items.length);
  });

  it('all ukulele IDs are unique', () => {
    const items = allItems('ukulele');
    assert.equal(new Set(items).size, items.length);
  });
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

describe('evaluate', () => {
  it('all correct returns correct=true', () => {
    const q = parseItem('guitar', 'C:major');
    const result = evaluate(q, q.playedPositions);
    assert.equal(result.correct, true);
    assert.equal(result.missed.length, 0);
    assert.ok(result.perEntry.every((e) => e.correct));
  });

  it('wrong position returns correct=false', () => {
    const q = parseItem('guitar', 'C:major');
    // Replace one correct position with a wrong one
    const tapped = [...q.playedPositions];
    tapped[0] = '5-5'; // wrong position
    const result = evaluate(q, tapped);
    assert.equal(result.correct, false);
  });

  it('reports missed positions', () => {
    const q = parseItem('guitar', 'G:major');
    // Tap only 5 of 6 positions, with one wrong
    const tapped = q.playedPositions.slice(0, 5);
    tapped.push('3-7'); // wrong position instead of the 6th
    const result = evaluate(q, tapped);
    assert.equal(result.correct, false);
    assert.ok(result.missed.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

describe('chordDisplayName', () => {
  it('major chord shows root only', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'C' && v.quality === 'major'
    )!;
    assert.equal(chordDisplayName(v), 'C');
  });

  it('minor chord shows root + m', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'A' && v.quality === 'minor'
    )!;
    assert.equal(chordDisplayName(v), 'Am');
  });

  it('dom7 chord shows root + 7', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'E' && v.quality === 'dom7'
    )!;
    assert.equal(chordDisplayName(v), 'E7');
  });
});

describe('voicingSummary', () => {
  it('formats C major guitar as x32010', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'C' && v.quality === 'major'
    )!;
    assert.equal(voicingSummary(v.strings), 'x32010');
  });

  it('formats G major guitar as 320003', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'G' && v.quality === 'major'
    )!;
    assert.equal(voicingSummary(v.strings), '320003');
  });
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

describe('groups', () => {
  it('has 3 quality groups', () => {
    assert.equal(QUALITY_GROUPS.length, 3);
  });

  it('guitar group items cover all voicings', () => {
    const all = new Set(allItems('guitar'));
    const grouped = new Set([
      ...getItemIdsForGroup('guitar', 0),
      ...getItemIdsForGroup('guitar', 1),
      ...getItemIdsForGroup('guitar', 2),
    ]);
    assert.deepEqual(grouped, all);
  });

  it('ukulele group items cover all voicings', () => {
    const all = new Set(allItems('ukulele'));
    const grouped = new Set([
      ...getItemIdsForGroup('ukulele', 0),
      ...getItemIdsForGroup('ukulele', 1),
      ...getItemIdsForGroup('ukulele', 2),
    ]);
    assert.deepEqual(grouped, all);
  });
});

describe('formatGroupLabel', () => {
  it('all groups → "all chords"', () => {
    assert.equal(formatGroupLabel(new Set([0, 1, 2])), 'all chords');
  });

  it('single group', () => {
    assert.equal(formatGroupLabel(new Set([0])), 'major');
    assert.equal(formatGroupLabel(new Set([1])), 'minor');
    assert.equal(formatGroupLabel(new Set([2])), '7th');
  });

  it('two groups joined with &', () => {
    assert.equal(formatGroupLabel(new Set([0, 2])), 'major & 7th');
  });
});
