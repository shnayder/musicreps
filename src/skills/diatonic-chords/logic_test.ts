import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  getGridColLabels,
  getGridItemId,
  getItemIdsForLevel,
  getQuestion,
  MODE_LEVELS,
  modeLabel,
  ordinalLabel,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Item space
// ---------------------------------------------------------------------------

describe('ALL_ITEMS', () => {
  it('has 864 items (6 modes × 12 keys × 6 degrees × 2 dirs)', () => {
    assert.equal(ALL_ITEMS.length, 864);
  });

  it('contains no duplicates', () => {
    assert.equal(new Set(ALL_ITEMS).size, ALL_ITEMS.length);
  });

  it('never includes degree 1', () => {
    for (const id of ALL_ITEMS) {
      const degree = parseInt(id.split(':')[2]);
      assert.notEqual(degree, 1, `degree 1 found in item ${id}`);
    }
  });
});

describe('MODE_LEVELS', () => {
  it('has 6 modes', () => {
    assert.equal(MODE_LEVELS.length, 6);
  });

  it('level IDs match MUSICAL_MODES', () => {
    assert.deepEqual(ALL_LEVEL_IDS, [
      'major',
      'minor',
      'dorian',
      'mixolydian',
      'lydian',
      'phrygian',
    ]);
  });
});

describe('getItemIdsForLevel', () => {
  it('returns 144 items per mode', () => {
    for (const levelId of ALL_LEVEL_IDS) {
      const items = getItemIdsForLevel(levelId);
      assert.equal(items.length, 144, `${levelId} has wrong count`);
    }
  });

  it('all items start with the mode prefix', () => {
    const items = getItemIdsForLevel('dorian');
    for (const id of items) {
      assert.ok(id.startsWith('dorian:'), `${id} missing dorian prefix`);
    }
  });
});

// ---------------------------------------------------------------------------
// getQuestion — major mode (same as old behavior)
// ---------------------------------------------------------------------------

describe('getQuestion (major)', () => {
  it('parses C:4:fwd correctly', () => {
    const q = getQuestion('major:C:4:fwd');
    assert.equal(q.mode, 'major');
    assert.equal(q.keyRoot, 'C');
    assert.equal(q.degree, 4);
    assert.equal(q.dir, 'fwd');
    assert.equal(q.rootNote, 'F');
    assert.equal(q.chord.quality, 'major');
    assert.equal(q.chord.numeral, 'IV');
  });

  it('major ii is minor', () => {
    const q = getQuestion('major:C:2:fwd');
    assert.equal(q.rootNote, 'D');
    assert.equal(q.chord.quality, 'minor');
    assert.equal(q.chord.numeral, 'ii');
  });

  it('major vii° is diminished', () => {
    const q = getQuestion('major:C:7:fwd');
    assert.equal(q.rootNote, 'B');
    assert.equal(q.chord.quality, 'diminished');
  });

  it('flat key: Bb major IV = Eb major', () => {
    const q = getQuestion('major:Bb:4:fwd');
    assert.equal(q.rootNote, 'Eb');
    assert.equal(q.chord.quality, 'major');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — minor mode (aeolian)
// ---------------------------------------------------------------------------

describe('getQuestion (minor)', () => {
  it('minor iv is minor (not major like in major)', () => {
    const q = getQuestion('minor:C:4:fwd');
    assert.equal(q.rootNote, 'F');
    assert.equal(q.chord.quality, 'minor');
    assert.equal(q.chord.numeral, 'iv');
  });

  it('minor bIII is major', () => {
    const q = getQuestion('minor:C:3:fwd');
    assert.equal(q.rootNote, 'Eb');
    assert.equal(q.chord.quality, 'major');
  });

  it('minor bVII is major', () => {
    const q = getQuestion('minor:C:7:fwd');
    assert.equal(q.rootNote, 'Bb');
    assert.equal(q.chord.quality, 'major');
  });

  it('minor ii° is diminished', () => {
    const q = getQuestion('minor:C:2:fwd');
    assert.equal(q.rootNote, 'D');
    assert.equal(q.chord.quality, 'diminished');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — dorian mode
// ---------------------------------------------------------------------------

describe('getQuestion (dorian)', () => {
  it('dorian IV is major (characteristic chord)', () => {
    const q = getQuestion('dorian:C:4:fwd');
    assert.equal(q.rootNote, 'F');
    assert.equal(q.chord.quality, 'major');
    assert.equal(q.chord.numeral, 'IV');
  });

  it('dorian ii is minor', () => {
    const q = getQuestion('dorian:D:2:fwd');
    assert.equal(q.rootNote, 'E');
    assert.equal(q.chord.quality, 'minor');
  });

  it('dorian bVII is major', () => {
    const q = getQuestion('dorian:C:7:fwd');
    assert.equal(q.rootNote, 'Bb');
    assert.equal(q.chord.quality, 'major');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — mixolydian mode
// ---------------------------------------------------------------------------

describe('getQuestion (mixolydian)', () => {
  it('mixolydian bVII is major (characteristic chord)', () => {
    const q = getQuestion('mixolydian:C:7:fwd');
    assert.equal(q.rootNote, 'Bb');
    assert.equal(q.chord.quality, 'major');
  });

  it('mixolydian v is minor (not major like in major)', () => {
    const q = getQuestion('mixolydian:C:5:fwd');
    assert.equal(q.rootNote, 'G');
    assert.equal(q.chord.quality, 'minor');
  });

  it('mixolydian iii° is diminished', () => {
    const q = getQuestion('mixolydian:C:3:fwd');
    assert.equal(q.rootNote, 'E');
    assert.equal(q.chord.quality, 'diminished');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — lydian mode
// ---------------------------------------------------------------------------

describe('getQuestion (lydian)', () => {
  it('lydian #iv° is diminished (characteristic chord)', () => {
    const q = getQuestion('lydian:C:4:fwd');
    assert.equal(q.rootNote, 'F#');
    assert.equal(q.chord.quality, 'diminished');
  });

  it('lydian II is major', () => {
    const q = getQuestion('lydian:C:2:fwd');
    assert.equal(q.rootNote, 'D');
    assert.equal(q.chord.quality, 'major');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — phrygian mode
// ---------------------------------------------------------------------------

describe('getQuestion (phrygian)', () => {
  it('phrygian bII is major (characteristic chord)', () => {
    const q = getQuestion('phrygian:C:2:fwd');
    assert.equal(q.rootNote, 'Db');
    assert.equal(q.chord.quality, 'major');
  });

  it('phrygian v° is diminished', () => {
    const q = getQuestion('phrygian:C:5:fwd');
    assert.equal(q.rootNote, 'G');
    assert.equal(q.chord.quality, 'diminished');
  });
});

// ---------------------------------------------------------------------------
// getQuestion — reverse direction
// ---------------------------------------------------------------------------

describe('getQuestion (reverse)', () => {
  it('parses reverse direction', () => {
    const q = getQuestion('major:C:4:rev');
    assert.equal(q.dir, 'rev');
    assert.equal(q.degree, 4);
    assert.equal(q.chord.numeral, 'IV');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('ordinalLabel', () => {
  it('returns correct ordinals', () => {
    assert.equal(ordinalLabel(1), '1st');
    assert.equal(ordinalLabel(2), '2nd');
    assert.equal(ordinalLabel(3), '3rd');
    assert.equal(ordinalLabel(4), '4th');
    assert.equal(ordinalLabel(7), '7th');
  });
});

describe('modeLabel', () => {
  it('returns display label', () => {
    assert.equal(modeLabel('major'), 'Major');
    assert.equal(modeLabel('dorian'), 'Dorian');
    assert.equal(modeLabel('minor'), 'Minor');
  });
});

// ---------------------------------------------------------------------------
// Stats grid
// ---------------------------------------------------------------------------

describe('getGridColLabels', () => {
  it('returns 6 labels for degrees 2–7', () => {
    const labels = getGridColLabels('major');
    assert.equal(labels.length, 6);
    assert.equal(labels[0], 'ii'); // degree 2
    assert.equal(labels[2], 'IV'); // degree 4
  });

  it('dorian labels use parallel-major convention', () => {
    const labels = getGridColLabels('dorian');
    assert.equal(labels[1], '\u266DIII'); // degree 3 = ♭III
    assert.equal(labels[5], '\u266DVII'); // degree 7 = ♭VII
  });
});

describe('getGridItemId', () => {
  it('returns fwd+rev pair for a mode/key/column', () => {
    const result = getGridItemId('major', 'C', 0);
    assert.deepEqual(result, ['major:C:2:fwd', 'major:C:2:rev']);
  });

  it('maps column 4 to degree 6', () => {
    const result = getGridItemId('dorian', 'Bb', 4);
    assert.deepEqual(result, ['dorian:Bb:6:fwd', 'dorian:Bb:6:rev']);
  });
});
