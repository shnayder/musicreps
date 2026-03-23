import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  ALL_KEY_GROUPS,
  getItemIdsForGroup,
  getQuestion,
  getStatsRows,
  KEY_GROUPS,
  MINOR_KEY_GROUPS,
} from './logic.ts';

describe('ALL_ITEMS', () => {
  it('has 48 items (24 major + 24 minor)', () => {
    assert.equal(ALL_ITEMS.length, 48);
  });

  it('contains both fwd and rev for major keys', () => {
    assert.ok(ALL_ITEMS.includes('C:fwd'));
    assert.ok(ALL_ITEMS.includes('C:rev'));
    assert.ok(ALL_ITEMS.includes('F#:fwd'));
    assert.ok(ALL_ITEMS.includes('F#:rev'));
  });

  it('contains both fwd and rev for minor keys', () => {
    assert.ok(ALL_ITEMS.includes('Am:fwd'));
    assert.ok(ALL_ITEMS.includes('Am:rev'));
    assert.ok(ALL_ITEMS.includes('F#m:fwd'));
    assert.ok(ALL_ITEMS.includes('F#m:rev'));
    assert.ok(ALL_ITEMS.includes('Bbm:fwd'));
    assert.ok(ALL_ITEMS.includes('Bbm:rev'));
  });
});

describe('KEY_GROUPS', () => {
  it('has 5 major groups', () => {
    assert.equal(KEY_GROUPS.length, 5);
  });

  it('has 2 minor groups', () => {
    assert.equal(MINOR_KEY_GROUPS.length, 2);
  });

  it('has 7 total groups', () => {
    assert.equal(ALL_KEY_GROUPS.length, 7);
  });
});

describe('getItemIdsForGroup', () => {
  it('group 0 contains C, G, F items', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(ids.includes('C:fwd'));
    assert.ok(ids.includes('C:rev'));
    assert.ok(ids.includes('G:fwd'));
    assert.ok(ids.includes('G:rev'));
    assert.ok(ids.includes('F:fwd'));
    assert.ok(ids.includes('F:rev'));
  });

  it('group 0 has 6 items (3 keys × 2 directions)', () => {
    const ids = getItemIdsForGroup(0);
    assert.equal(ids.length, 6);
  });

  it('group 5 (minor easy) contains Am items', () => {
    const ids = getItemIdsForGroup(5);
    assert.ok(ids.includes('Am:fwd'));
    assert.ok(ids.includes('Am:rev'));
  });

  it('group 5 has 14 items (7 minor keys × 2 directions)', () => {
    assert.equal(getItemIdsForGroup(5).length, 14);
  });

  it('group 6 has 10 items (5 minor keys × 2 directions)', () => {
    assert.equal(getItemIdsForGroup(6).length, 10);
  });
});

describe('getQuestion', () => {
  it('D:fwd returns root "D", dir "fwd", sigLabel "2#"', () => {
    const q = getQuestion('D:fwd');
    assert.equal(q.root, 'D');
    assert.equal(q.dir, 'fwd');
    assert.equal(q.sigLabel, '2#');
  });

  it('Eb:rev returns dir "rev" and sigLabel "3b"', () => {
    const q = getQuestion('Eb:rev');
    assert.equal(q.root, 'Eb');
    assert.equal(q.dir, 'rev');
    assert.equal(q.sigLabel, '3b');
  });

  it('C:fwd returns sigLabel "0"', () => {
    const q = getQuestion('C:fwd');
    assert.equal(q.sigLabel, '0');
  });

  it('G:fwd returns sigLabel "1#"', () => {
    const q = getQuestion('G:fwd');
    assert.equal(q.sigLabel, '1#');
  });
});

describe('getQuestion minor keys', () => {
  it('Am:fwd returns sigLabel "0" (same as C major)', () => {
    const q = getQuestion('Am:fwd');
    assert.equal(q.root, 'A');
    assert.equal(q.dir, 'fwd');
    assert.equal(q.sigLabel, '0');
    assert.equal(q.quality, 'minor');
  });

  it('F#m:rev returns sigLabel "3#" (same as A major)', () => {
    const q = getQuestion('F#m:rev');
    assert.equal(q.root, 'F#');
    assert.equal(q.sigLabel, '3#');
    assert.equal(q.quality, 'minor');
  });

  it('Bbm:fwd returns sigLabel "5b" (same as Db major)', () => {
    const q = getQuestion('Bbm:fwd');
    assert.equal(q.root, 'Bb');
    assert.equal(q.sigLabel, '5b');
    assert.equal(q.quality, 'minor');
  });

  it('major questions have quality "major"', () => {
    const q = getQuestion('D:fwd');
    assert.equal(q.quality, 'major');
  });
});

describe('getQuestion expected values', () => {
  it('fwd: sigLabel is the expected signature answer', () => {
    const q = getQuestion('D:fwd');
    assert.equal(q.sigLabel, '2#');
  });

  it('rev: root is the expected note answer', () => {
    const q = getQuestion('Eb:rev');
    assert.equal(q.root, 'Eb');
  });
});

describe('getStatsRows', () => {
  it('returns 24 rows (12 major + 12 minor)', () => {
    const rows = getStatsRows();
    assert.equal(rows.length, 24);
  });

  it('each row has fwdItemId and revItemId', () => {
    const rows = getStatsRows();
    for (const row of rows) {
      assert.ok(row.fwdItemId, 'row should have fwdItemId');
      assert.ok(row.revItemId, 'row should have revItemId');
      assert.ok(row.fwdItemId.endsWith(':fwd'));
      assert.ok(row.revItemId.endsWith(':rev'));
    }
  });

  it('includes minor key rows', () => {
    const rows = getStatsRows();
    const minorRows = rows.filter((r) => r.label.includes('minor'));
    assert.equal(minorRows.length, 12);
  });
});
