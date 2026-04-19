// Tests for mode progress manifest structure and completeness.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  getModeProgress,
  MODE_PROGRESS_MANIFEST,
} from './mode-progress-manifest.ts';
import { TRACKS } from './mode-catalog.ts';

describe('MODE_PROGRESS_MANIFEST', () => {
  it('covers every mode in TRACKS', () => {
    const manifestIds = new Set(MODE_PROGRESS_MANIFEST.map((e) => e.modeId));
    const trackIds = new Set(TRACKS.flatMap((t) => t.skills));
    const missing = [...trackIds].filter((id) => !manifestIds.has(id));
    assert.deepEqual(
      missing,
      [],
      `Modes in TRACKS but missing from manifest: ${missing.join(', ')}. ` +
        'Add the ModeDefinition to ALL_DEFINITIONS in mode-progress-manifest.ts.',
    );
  });

  it('has unique mode IDs', () => {
    const ids = MODE_PROGRESS_MANIFEST.map((e) => e.modeId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('each entry has a valid namespace', () => {
    for (const entry of MODE_PROGRESS_MANIFEST) {
      assert.ok(
        entry.namespace.length > 0,
        `${entry.modeId} has empty namespace`,
      );
    }
  });

  it('each entry has allItemIds that returns non-empty array', () => {
    for (const entry of MODE_PROGRESS_MANIFEST) {
      const items = entry.allItemIds();
      assert.ok(
        items.length > 0,
        `${entry.modeId} has no items`,
      );
    }
  });

  it('every mode has at least one group with items', () => {
    for (const entry of MODE_PROGRESS_MANIFEST) {
      assert.ok(
        entry.groups.length > 0,
        `${entry.modeId} has empty groups array`,
      );
      for (const g of entry.groups) {
        const ids = g.getItemIds();
        assert.ok(
          ids.length > 0,
          `${entry.modeId} group "${g.label}" has no items`,
        );
      }
    }
  });

  it('expected group counts per mode', () => {
    const expected: Record<string, number> = {
      fretboard: 6, // 3 fret ranges × natural/accidental
      ukulele: 6, // 3 fret ranges × natural/accidental
      noteSemitones: 1, // single-group mode
      intervalSemitones: 1, // single-group mode
      semitoneMath: 5, // distance groups
      intervalMath: 5, // distance groups
      keySignatures: 4, // 2 major + 2 minor key groups
      scaleDegrees: 3, // degree groups
      diatonicChords: 3, // chord groups
      chordSpelling: 7, // spelling groups (groups 0-6)
      speedTap: 2, // naturals, sharps/flats
      guitarChordShapes: 5, // major, minor, dom7, m7, sus
      ukuleleChordShapes: 5, // major, minor, dom7, m7, sus
    };

    for (const entry of MODE_PROGRESS_MANIFEST) {
      assert.equal(
        entry.groups.length,
        expected[entry.modeId],
        `${entry.modeId} group count`,
      );
    }
  });
});

describe('getModeProgress', () => {
  it('returns entry for known mode', () => {
    const entry = getModeProgress('semitoneMath');
    assert.ok(entry !== undefined);
    assert.equal(entry!.namespace, 'semitoneMath');
  });

  it('returns undefined for unknown mode', () => {
    assert.equal(getModeProgress('nonexistent'), undefined);
  });
});
