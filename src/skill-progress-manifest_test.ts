// Tests for mode progress manifest structure and completeness.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  getSkillProgress,
  SKILL_PROGRESS_MANIFEST,
} from './skill-progress-manifest.ts';
import { TRACKS } from './skill-catalog.ts';

describe('SKILL_PROGRESS_MANIFEST', () => {
  it('covers every mode in TRACKS', () => {
    const manifestIds = new Set(SKILL_PROGRESS_MANIFEST.map((e) => e.skillId));
    const trackIds = new Set(TRACKS.flatMap((t) => t.skills));
    const missing = [...trackIds].filter((id) => !manifestIds.has(id));
    assert.deepEqual(
      missing,
      [],
      `Modes in TRACKS but missing from manifest: ${missing.join(', ')}. ` +
        'Add the SkillDefinition to ALL_DEFINITIONS in skill-progress-manifest.ts.',
    );
  });

  it('has unique mode IDs', () => {
    const ids = SKILL_PROGRESS_MANIFEST.map((e) => e.skillId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('each entry has a valid namespace', () => {
    for (const entry of SKILL_PROGRESS_MANIFEST) {
      assert.ok(
        entry.namespace.length > 0,
        `${entry.skillId} has empty namespace`,
      );
    }
  });

  it('each entry has allItemIds that returns non-empty array', () => {
    for (const entry of SKILL_PROGRESS_MANIFEST) {
      const items = entry.allItemIds();
      assert.ok(
        items.length > 0,
        `${entry.skillId} has no items`,
      );
    }
  });

  it('every mode has at least one group with items', () => {
    for (const entry of SKILL_PROGRESS_MANIFEST) {
      assert.ok(
        entry.levels.length > 0,
        `${entry.skillId} has empty groups array`,
      );
      for (const g of entry.levels) {
        const ids = g.getItemIds();
        assert.ok(
          ids.length > 0,
          `${entry.skillId} group "${g.label}" has no items`,
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

    for (const entry of SKILL_PROGRESS_MANIFEST) {
      assert.equal(
        entry.levels.length,
        expected[entry.skillId],
        `${entry.skillId} group count`,
      );
    }
  });
});

describe('motor task type + response count forwarding', () => {
  it('forwards motorTaskType from mode definitions', () => {
    // These are the non-default task types — regressions here would silently
    // break home/skill progress-bar color parity.
    const expected: Record<string, string> = {
      guitarChordShapes: 'fretboard-tap',
      ukuleleChordShapes: 'fretboard-tap',
      speedTap: 'fretboard-tap',
      chordSpelling: 'chord-sequence',
    };
    for (const [skillId, taskType] of Object.entries(expected)) {
      const entry = getSkillProgress(skillId)!;
      assert.equal(
        entry.motorTaskType,
        taskType,
        `${skillId} should forward motorTaskType`,
      );
    }
  });

  it('forwards getResponseCount for multi-response modes', () => {
    const chordShapes = getSkillProgress('guitarChordShapes')!;
    assert.ok(
      chordShapes.getResponseCount,
      'guitarChordShapes should forward getResponseCount',
    );
    const someId = chordShapes.allItemIds()[0];
    assert.ok(
      chordShapes.getResponseCount!(someId) > 1,
      `guitarChordShapes item ${someId} should be multi-response`,
    );
  });
});

describe('getSkillProgress', () => {
  it('returns entry for known mode', () => {
    const entry = getSkillProgress('semitoneMath');
    assert.ok(entry !== undefined);
    assert.equal(entry!.namespace, 'semitoneMath');
  });

  it('returns undefined for unknown mode', () => {
    assert.equal(getSkillProgress('nonexistent'), undefined);
  });
});
