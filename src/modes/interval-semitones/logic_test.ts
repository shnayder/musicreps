import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ITEMS, getQuestion, getStatsRows } from './logic.ts';

// ---------------------------------------------------------------------------
// ALL_ITEMS
// ---------------------------------------------------------------------------

describe('ALL_ITEMS', () => {
  it('has 24 items (12 intervals × 2 directions)', () => {
    assert.equal(ALL_ITEMS.length, 24);
  });

  it('contains fwd and rev for each interval', () => {
    assert.ok(ALL_ITEMS.includes('m2:fwd'));
    assert.ok(ALL_ITEMS.includes('m2:rev'));
    assert.ok(ALL_ITEMS.includes('P5:fwd'));
    assert.ok(ALL_ITEMS.includes('P5:rev'));
    assert.ok(ALL_ITEMS.includes('P8:fwd'));
    assert.ok(ALL_ITEMS.includes('P8:rev'));
  });

  it('all IDs end with :fwd or :rev', () => {
    for (const id of ALL_ITEMS) {
      assert.ok(
        id.endsWith(':fwd') || id.endsWith(':rev'),
        `unexpected id: ${id}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------

describe('getQuestion("m2:fwd")', () => {
  it('returns abbrev "m2", num 1, dir "fwd"', () => {
    const q = getQuestion('m2:fwd');
    assert.equal(q.abbrev, 'm2');
    assert.equal(q.num, 1);
    assert.equal(q.dir, 'fwd');
  });

  it('includes the full interval name', () => {
    const q = getQuestion('m2:fwd');
    assert.ok(typeof q.name === 'string');
    assert.ok(q.name.length > 0);
  });
});

describe('getQuestion("P5:rev")', () => {
  it('returns dir "rev" and num 7', () => {
    const q = getQuestion('P5:rev');
    assert.equal(q.dir, 'rev');
    assert.equal(q.num, 7);
    assert.equal(q.abbrev, 'P5');
  });
});

describe('getQuestion for other intervals', () => {
  it('M2 returns num 2', () => {
    const q = getQuestion('M2:fwd');
    assert.equal(q.num, 2);
    assert.equal(q.abbrev, 'M2');
  });

  it('TT returns num 6', () => {
    const q = getQuestion('TT:fwd');
    assert.equal(q.num, 6);
    assert.equal(q.abbrev, 'TT');
  });

  it('P8 returns num 12', () => {
    const q = getQuestion('P8:rev');
    assert.equal(q.num, 12);
    assert.equal(q.abbrev, 'P8');
  });
});

// ---------------------------------------------------------------------------
// Expected values (used by answer spec)
// ---------------------------------------------------------------------------

describe('getQuestion expected values', () => {
  it('fwd: num is the expected integer answer', () => {
    const q = getQuestion('m2:fwd');
    assert.equal(String(q.num), '1');
  });

  it('fwd: P5 has num 7', () => {
    const q = getQuestion('P5:fwd');
    assert.equal(String(q.num), '7');
  });

  it('rev: abbrev is the expected interval', () => {
    const q = getQuestion('m2:rev');
    assert.equal(q.abbrev, 'm2');
  });

  it('rev: TT abbrev is "TT"', () => {
    const q = getQuestion('TT:rev');
    assert.equal(q.abbrev, 'TT');
  });
});

// ---------------------------------------------------------------------------
// getStatsRows
// ---------------------------------------------------------------------------

describe('getStatsRows', () => {
  it('returns 12 rows (one per interval)', () => {
    const rows = getStatsRows();
    assert.equal(rows.length, 12);
  });

  it('each row has fwdItemId and revItemId', () => {
    const rows = getStatsRows();
    for (const row of rows) {
      assert.ok(
        row.fwdItemId.endsWith(':fwd'),
        `bad fwdItemId: ${row.fwdItemId}`,
      );
      assert.ok(
        row.revItemId.endsWith(':rev'),
        `bad revItemId: ${row.revItemId}`,
      );
    }
  });

  it('fwd and rev item IDs share the same interval abbreviation', () => {
    const rows = getStatsRows();
    for (const row of rows) {
      const fwdAbbrev = row.fwdItemId.replace(':fwd', '');
      const revAbbrev = row.revItemId.replace(':rev', '');
      assert.equal(fwdAbbrev, revAbbrev);
    }
  });

  it('first row is m2, last row is P8', () => {
    const rows = getStatsRows();
    assert.equal(rows[0].fwdItemId, 'm2:fwd');
    assert.equal(rows[11].fwdItemId, 'P8:fwd');
  });

  it('each row has label and sublabel', () => {
    const rows = getStatsRows();
    for (const row of rows) {
      assert.ok(typeof row.label === 'string' && row.label.length > 0);
      assert.ok(typeof row.sublabel === 'string');
    }
  });
});
