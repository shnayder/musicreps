import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  ALL_KEY_LEVELS,
  getItemIdsForLevel,
  getQuestion,
  getStatsRows,
  KEY_LEVELS,
  MINOR_KEY_LEVELS,
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

describe('KEY_LEVELS', () => {
  it('has 2 major groups', () => {
    assert.equal(KEY_LEVELS.length, 2);
  });

  it('has 2 minor groups', () => {
    assert.equal(MINOR_KEY_LEVELS.length, 2);
  });

  it('has 4 total groups', () => {
    assert.equal(ALL_KEY_LEVELS.length, 4);
  });
});

describe('getItemIdsForLevel', () => {
  it('group major-easy contains C, G, F, D, Bb, A, Eb items (major 0–3 ♯/♭)', () => {
    const ids = getItemIdsForLevel('major-easy');
    assert.ok(ids.includes('C:fwd'));
    assert.ok(ids.includes('G:fwd'));
    assert.ok(ids.includes('F:fwd'));
    assert.ok(ids.includes('D:fwd'));
    assert.ok(ids.includes('Bb:fwd'));
    assert.ok(ids.includes('A:fwd'));
    assert.ok(ids.includes('Eb:fwd'));
  });

  it('group major-easy has 14 items (7 keys × 2 directions)', () => {
    assert.equal(getItemIdsForLevel('major-easy').length, 14);
  });

  it('group minor-easy (minor 0–3 ♯/♭) contains Am items', () => {
    const ids = getItemIdsForLevel('minor-easy');
    assert.ok(ids.includes('Am:fwd'));
    assert.ok(ids.includes('Am:rev'));
  });

  it('group minor-easy has 14 items (7 minor keys × 2 directions)', () => {
    assert.equal(getItemIdsForLevel('minor-easy').length, 14);
  });

  it('group minor-hard has 10 items (5 minor keys × 2 directions)', () => {
    assert.equal(getItemIdsForLevel('minor-hard').length, 10);
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
  it('returns 12 paired rows (major/minor per signature)', () => {
    const rows = getStatsRows();
    assert.equal(rows.length, 12);
  });

  it('each row has major fwd/rev and minor fwd2/rev2 item IDs', () => {
    const rows = getStatsRows();
    for (const row of rows) {
      assert.ok(row.fwdItemId.endsWith(':fwd'));
      assert.ok(row.revItemId.endsWith(':rev'));
      assert.ok(row.fwd2ItemId?.endsWith(':fwd'));
      assert.ok(row.rev2ItemId?.endsWith(':rev'));
    }
  });

  it('labels pair major and minor keys', () => {
    const rows = getStatsRows();
    // C major pairs with Am
    const cRow = rows.find((r) => r.label.startsWith('C'));
    assert.ok(cRow);
    assert.ok(cRow.label.includes('Am'));
  });
});
