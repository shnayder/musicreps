// Tests for mode progress manifest structure and completeness.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  getModeProgress,
  MODE_PROGRESS_MANIFEST,
} from './mode-progress-manifest.ts';

describe('MODE_PROGRESS_MANIFEST', () => {
  it('has 11 entries (one per mode)', () => {
    assert.equal(MODE_PROGRESS_MANIFEST.length, 11);
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

  it('group-based modes have matching group item counts', () => {
    for (const entry of MODE_PROGRESS_MANIFEST) {
      if (entry.groups === null) continue;
      assert.ok(
        entry.groups.length > 0,
        `${entry.modeId} has empty groups array`,
      );
      // Every group should return at least one item
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
    const expected: Record<string, number | null> = {
      fretboard: 8, // 5 natural + 3 accidental groups for guitar
      ukulele: 6, // 4 natural + 2 accidental groups for ukulele
      noteSemitones: null,
      intervalSemitones: null,
      semitoneMath: 5, // distance groups
      intervalMath: 5, // distance groups
      keySignatures: 5, // key groups
      scaleDegrees: 3, // degree groups
      diatonicChords: 3, // chord groups
      chordSpelling: 7, // spelling groups (groups 0-6)
      speedTap: null,
    };

    for (const entry of MODE_PROGRESS_MANIFEST) {
      const exp = expected[entry.modeId];
      if (exp === null) {
        assert.equal(
          entry.groups,
          null,
          `${entry.modeId} should have no groups`,
        );
      } else {
        assert.ok(entry.groups !== null, `${entry.modeId} should have groups`);
        assert.equal(
          entry.groups!.length,
          exp,
          `${entry.modeId} group count`,
        );
      }
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
