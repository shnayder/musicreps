import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  bidirectionalGridId,
  buildBidirectionalIds,
  buildBidirectionalStatsRows,
  buildMathIds,
  mathGridId,
  parseBidirectionalId,
  parseMathId,
} from './mode-utils.ts';

// ---------------------------------------------------------------------------
// buildBidirectionalIds
// ---------------------------------------------------------------------------

describe('buildBidirectionalIds', () => {
  it('builds fwd + rev pairs for each key', () => {
    const ids = buildBidirectionalIds(['C', 'D']);
    assert.deepStrictEqual(ids, ['C:fwd', 'C:rev', 'D:fwd', 'D:rev']);
  });

  it('returns empty for empty input', () => {
    assert.deepStrictEqual(buildBidirectionalIds([]), []);
  });

  it('handles keys with accidentals', () => {
    const ids = buildBidirectionalIds(['C#', 'Bb']);
    assert.deepStrictEqual(ids, ['C#:fwd', 'C#:rev', 'Bb:fwd', 'Bb:rev']);
  });
});

// ---------------------------------------------------------------------------
// parseBidirectionalId
// ---------------------------------------------------------------------------

describe('parseBidirectionalId', () => {
  it('parses simple 2-part IDs', () => {
    assert.deepStrictEqual(
      parseBidirectionalId('C:fwd'),
      { key: 'C', dir: 'fwd' },
    );
    assert.deepStrictEqual(
      parseBidirectionalId('D#:rev'),
      { key: 'D#', dir: 'rev' },
    );
  });

  it('parses compound 3-part IDs (key contains colon)', () => {
    assert.deepStrictEqual(
      parseBidirectionalId('D:5:fwd'),
      { key: 'D:5', dir: 'fwd' },
    );
    assert.deepStrictEqual(
      parseBidirectionalId('Bb:IV:rev'),
      { key: 'Bb:IV', dir: 'rev' },
    );
  });
});

// ---------------------------------------------------------------------------
// bidirectionalGridId
// ---------------------------------------------------------------------------

describe('bidirectionalGridId', () => {
  it('builds fwd/rev pair for compound key', () => {
    assert.deepStrictEqual(
      bidirectionalGridId('D', '5'),
      ['D:5:fwd', 'D:5:rev'],
    );
  });

  it('works with numeric column values', () => {
    assert.deepStrictEqual(
      bidirectionalGridId('C', 3),
      ['C:3:fwd', 'C:3:rev'],
    );
  });
});

// ---------------------------------------------------------------------------
// buildMathIds
// ---------------------------------------------------------------------------

describe('buildMathIds', () => {
  it('builds +/- pairs for each note × value', () => {
    const ids = buildMathIds(['C', 'D'], [1, 2]);
    assert.deepStrictEqual(ids, [
      'C+1',
      'C-1',
      'C+2',
      'C-2',
      'D+1',
      'D-1',
      'D+2',
      'D-2',
    ]);
  });

  it('works with string values (interval abbreviations)', () => {
    const ids = buildMathIds(['C'], ['m2', 'M3']);
    assert.deepStrictEqual(ids, ['C+m2', 'C-m2', 'C+M3', 'C-M3']);
  });

  it('returns empty for empty inputs', () => {
    assert.deepStrictEqual(buildMathIds([], [1, 2]), []);
    assert.deepStrictEqual(buildMathIds(['C'], []), []);
  });
});

// ---------------------------------------------------------------------------
// parseMathId
// ---------------------------------------------------------------------------

describe('parseMathId', () => {
  it('parses natural note + number', () => {
    assert.deepStrictEqual(
      parseMathId('C+3'),
      { note: 'C', op: '+', value: '3' },
    );
    assert.deepStrictEqual(
      parseMathId('G-7'),
      { note: 'G', op: '-', value: '7' },
    );
  });

  it('handles sharps in note name', () => {
    assert.deepStrictEqual(
      parseMathId('C#+3'),
      { note: 'C#', op: '+', value: '3' },
    );
    assert.deepStrictEqual(
      parseMathId('F#-11'),
      { note: 'F#', op: '-', value: '11' },
    );
  });

  it('handles interval abbreviations as values', () => {
    assert.deepStrictEqual(
      parseMathId('C+m3'),
      { note: 'C', op: '+', value: 'm3' },
    );
    assert.deepStrictEqual(
      parseMathId('D-P5'),
      { note: 'D', op: '-', value: 'P5' },
    );
  });

  it('handles flats in note name', () => {
    assert.deepStrictEqual(
      parseMathId('Db+1'),
      { note: 'Db', op: '+', value: '1' },
    );
  });
});

// ---------------------------------------------------------------------------
// mathGridId
// ---------------------------------------------------------------------------

describe('mathGridId', () => {
  it('builds +/- pair for a grid cell', () => {
    assert.deepStrictEqual(mathGridId('C', 3), ['C+3', 'C-3']);
  });

  it('works with string values', () => {
    assert.deepStrictEqual(mathGridId('D', 'm3'), ['D+m3', 'D-m3']);
  });
});

// ---------------------------------------------------------------------------
// buildBidirectionalStatsRows
// ---------------------------------------------------------------------------

describe('buildBidirectionalStatsRows', () => {
  it('builds stats rows with fwd/rev item IDs', () => {
    const rows = buildBidirectionalStatsRows(
      [
        { key: 'C', label: 'C', sublabel: '0' },
        { key: 'D', label: 'D', sublabel: '2' },
      ],
      'Note',
    );
    assert.equal(rows.length, 2);
    assert.deepStrictEqual(rows[0], {
      label: 'C',
      sublabel: '0',
      _colHeader: 'Note',
      fwdItemId: 'C:fwd',
      revItemId: 'C:rev',
    });
    assert.deepStrictEqual(rows[1], {
      label: 'D',
      sublabel: '2',
      _colHeader: 'Note',
      fwdItemId: 'D:fwd',
      revItemId: 'D:rev',
    });
  });

  it('returns empty for empty input', () => {
    assert.deepStrictEqual(buildBidirectionalStatsRows([], 'X'), []);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: build then parse
// ---------------------------------------------------------------------------

describe('round-trip consistency', () => {
  it('bidirectional: build → parse recovers key + dir', () => {
    const keys = ['C', 'C#', 'Bb'];
    const ids = buildBidirectionalIds(keys);
    for (const id of ids) {
      const parsed = parseBidirectionalId(id);
      assert.ok(keys.includes(parsed.key), `key ${parsed.key} not in keys`);
      assert.ok(
        parsed.dir === 'fwd' || parsed.dir === 'rev',
        `dir ${parsed.dir} invalid`,
      );
    }
  });

  it('math: build → parse recovers note + op + value', () => {
    const notes = ['C', 'C#', 'F'];
    const values = [1, 5, 11];
    const ids = buildMathIds(notes, values);
    for (const id of ids) {
      const parsed = parseMathId(id);
      assert.ok(notes.includes(parsed.note), `note ${parsed.note} not found`);
      assert.ok(parsed.op === '+' || parsed.op === '-');
      assert.ok(
        values.includes(parseInt(parsed.value)),
        `value ${parsed.value} not found`,
      );
    }
  });
});
