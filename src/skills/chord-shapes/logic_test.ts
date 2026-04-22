import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allItems,
  chordDisplayName,
  evaluate,
  formatGroupLabel,
  getItemIdsForLevel,
  getMutedStrings,
  getPlayedPositions,
  itemId,
  parseItem,
  positionKey,
  QUALITY_LEVELS,
  voicingSummary,
} from './logic.ts';
import {
  type ChordQuality,
  type ChordVoicing,
  GUITAR_VOICINGS,
  UKULELE_VOICINGS,
} from './voicings.ts';
import { CHORD_TYPES, GUITAR, UKULELE } from '../../music-data.ts';

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

  it('parses guitar A:m7', () => {
    const q = parseItem('guitar', 'A:m7');
    assert.equal(q.displayName, 'Am7');
  });

  it('parses guitar D:sus4', () => {
    const q = parseItem('guitar', 'D:sus4');
    assert.equal(q.displayName, 'Dsus4');
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

  it('m7 chord shows root + m7', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'A' && v.quality === 'm7'
    )!;
    assert.equal(chordDisplayName(v), 'Am7');
  });

  it('sus4 chord shows root + sus4', () => {
    const v = GUITAR_VOICINGS.find((v) =>
      v.root === 'D' && v.quality === 'sus4'
    )!;
    assert.equal(chordDisplayName(v), 'Dsus4');
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

describe('voicing data integrity', () => {
  it('no two voicings within guitar share identical fingerings', () => {
    const seen = new Map<string, string>();
    for (const v of GUITAR_VOICINGS) {
      const key = JSON.stringify(v.strings);
      const label = `${v.root}${v.symbol}`;
      assert.ok(
        !seen.has(key),
        `Duplicate guitar fingering: ${label} matches ${seen.get(key)}`,
      );
      seen.set(key, label);
    }
  });

  it('no two voicings within ukulele share identical fingerings', () => {
    const seen = new Map<string, string>();
    for (const v of UKULELE_VOICINGS) {
      const key = JSON.stringify(v.strings);
      const label = `${v.root}${v.symbol}`;
      assert.ok(
        !seen.has(key),
        `Duplicate ukulele fingering: ${label} matches ${seen.get(key)}`,
      );
      seen.set(key, label);
    }
  });
});

// ---------------------------------------------------------------------------
// Harmonic correctness — every played fret maps to a pitch class that
// belongs to the chord's theoretical spelling (and every chord tone
// appears at least once).
// ---------------------------------------------------------------------------

// Map our internal ChordQuality → the `name` used in CHORD_TYPES (music-data).
const QUALITY_TO_CHORD_TYPE_NAME: Record<ChordQuality, string> = {
  major: 'major',
  minor: 'minor',
  dom7: 'dom7',
  m7: 'min7',
  sus2: 'sus2',
  sus4: 'sus4',
};

function pitchClassOfNoteName(name: string): number {
  // e.g., "C" → 0, "C#" → 1, "Db" → 1, "Bb" → 10
  const letter = name[0];
  const naturals: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let pc = naturals[letter];
  for (const ch of name.slice(1)) {
    if (ch === '#') pc += 1;
    else if (ch === 'b') pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
}

function chordTypeFor(v: ChordVoicing) {
  const typeName = QUALITY_TO_CHORD_TYPE_NAME[v.quality];
  const chordType = CHORD_TYPES.find((t) => t.name === typeName);
  assert.ok(chordType, `Unknown chord type for quality ${v.quality}`);
  return chordType;
}

function expectedPitchClasses(v: ChordVoicing): Set<number> {
  const chordType = chordTypeFor(v);
  const rootPc = pitchClassOfNoteName(v.root);
  return new Set(chordType.intervals.map((iv) => (rootPc + iv) % 12));
}

/**
 * Chord tones that must appear in a playable voicing. The perfect 5th
 * (interval 7) is the one tone conventionally allowed to be omitted
 * in guitar/ukulele voicings — it's the least identity-defining of
 * the triad tones. Our test requires the root, the 3rd (or sus
 * substitute), and the 7th (for 7th chords) to all be present.
 */
function requiredPitchClasses(v: ChordVoicing): Set<number> {
  const chordType = chordTypeFor(v);
  const rootPc = pitchClassOfNoteName(v.root);
  return new Set(
    chordType.intervals
      .filter((iv) => iv !== 7)
      .map((iv) => (rootPc + iv) % 12),
  );
}

function playedPitchClasses(
  instrument: 'guitar' | 'ukulele',
  v: ChordVoicing,
): Set<number> {
  const offsets = instrument === 'guitar'
    ? GUITAR.stringOffsets
    : UKULELE.stringOffsets;
  const pcs = new Set<number>();
  for (let s = 0; s < v.strings.length; s++) {
    const fret = v.strings[s];
    if (fret === 'x') continue;
    pcs.add((offsets[s] + fret) % 12);
  }
  return pcs;
}

describe('harmonic correctness', () => {
  for (
    const [instrument, voicings] of [
      ['guitar', GUITAR_VOICINGS] as const,
      ['ukulele', UKULELE_VOICINGS] as const,
    ]
  ) {
    for (const v of voicings) {
      const label = `${v.root}${v.symbol || '(maj)'} on ${instrument}`;
      it(`${label} — played notes match chord spelling`, () => {
        const expected = expectedPitchClasses(v);
        const required = requiredPitchClasses(v);
        const played = playedPitchClasses(instrument, v);

        // Every played note must be a chord tone (catches typos).
        for (const pc of played) {
          assert.ok(
            expected.has(pc),
            `${label}: played pitch class ${pc} not in expected ` +
              `${[...expected].sort((a, b) => a - b).join(',')}`,
          );
        }

        // Root, 3rd (or sus substitute), and 7th must all appear.
        // The 5th is allowed to be omitted (standard voicing practice).
        for (const pc of required) {
          assert.ok(
            played.has(pc),
            `${label}: missing required chord tone ${pc} (played: ` +
              `${[...played].sort((a, b) => a - b).join(',')})`,
          );
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

describe('groups', () => {
  it('has 5 quality groups (major, minor, dom7, m7, sus)', () => {
    assert.equal(QUALITY_LEVELS.length, 5);
    const ids = QUALITY_LEVELS.map((g) => g.id);
    assert.deepEqual(ids, ['major', 'minor', 'dom7', 'm7', 'sus']);
  });

  it('guitar group items cover all voicings', () => {
    const all = new Set(allItems('guitar'));
    const grouped = new Set<string>();
    for (const g of QUALITY_LEVELS) {
      for (const id of getItemIdsForLevel('guitar', g.id)) grouped.add(id);
    }
    assert.deepEqual(grouped, all);
  });

  it('ukulele group items cover all voicings', () => {
    const all = new Set(allItems('ukulele'));
    const grouped = new Set<string>();
    for (const g of QUALITY_LEVELS) {
      for (const id of getItemIdsForLevel('ukulele', g.id)) grouped.add(id);
    }
    assert.deepEqual(grouped, all);
  });

  it('every voicing belongs to exactly one group', () => {
    for (
      const [instrument, voicings] of [
        ['guitar', GUITAR_VOICINGS] as const,
        ['ukulele', UKULELE_VOICINGS] as const,
      ]
    ) {
      for (const v of voicings) {
        const id = itemId(v);
        let hits = 0;
        for (const g of QUALITY_LEVELS) {
          if (getItemIdsForLevel(instrument, g.id).includes(id)) hits++;
        }
        assert.equal(
          hits,
          1,
          `${id} on ${instrument} should belong to exactly one group (got ${hits})`,
        );
      }
    }
  });

  it('sus group bundles both sus2 and sus4 on guitar', () => {
    const susItems = getItemIdsForLevel('guitar', 'sus');
    assert.ok(susItems.includes('D:sus2'));
    assert.ok(susItems.includes('D:sus4'));
    assert.ok(susItems.includes('E:sus4'));
  });

  it('m7 group contains the open m7 voicings on guitar', () => {
    const m7Items = getItemIdsForLevel('guitar', 'm7');
    for (const id of ['A:m7', 'E:m7', 'D:m7', 'B:m7']) {
      assert.ok(m7Items.includes(id), `expected ${id} in m7 group`);
    }
  });

  it('m7 group contains the barre m7 voicings on guitar', () => {
    const m7Items = getItemIdsForLevel('guitar', 'm7');
    for (const id of ['F:m7', 'G:m7', 'C:m7']) {
      assert.ok(m7Items.includes(id), `expected ${id} in m7 group`);
    }
  });
});

describe('formatGroupLabel', () => {
  it('all groups → "all chords"', () => {
    assert.equal(
      formatGroupLabel(new Set(['major', 'minor', 'dom7', 'm7', 'sus'])),
      'all chords',
    );
  });

  it('single group', () => {
    assert.equal(formatGroupLabel(new Set(['major'])), 'major');
    assert.equal(formatGroupLabel(new Set(['minor'])), 'minor');
    assert.equal(formatGroupLabel(new Set(['dom7'])), '7th');
    assert.equal(formatGroupLabel(new Set(['m7'])), 'm7');
    assert.equal(formatGroupLabel(new Set(['sus'])), 'sus');
  });

  it('two groups joined with &', () => {
    assert.equal(formatGroupLabel(new Set(['major', 'dom7'])), 'major & 7th');
    assert.equal(formatGroupLabel(new Set(['m7', 'sus'])), 'm7 & sus');
  });

  it('preserves group order regardless of set insertion order', () => {
    assert.equal(
      formatGroupLabel(new Set(['sus', 'major', 'm7'])),
      'major & m7 & sus',
    );
  });
});
