// Diatonic Chords — declarative skill definition (modal chords).
// Bidirectional: "4th in C dorian" → "F Major", or "Fm in C minor" → "4th — iv".

import { useCallback, useMemo, useState } from 'preact/hooks';

import {
  displayNote,
  isValidNoteInput,
  MUSICAL_MODES,
  rootUsesFlats,
} from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type {
  SkillController,
  SkillDefinition,
  StatsSelector,
} from '../../declarative/types.ts';
import { StatsGrid } from '../../ui/stats.tsx';
import {
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  getGridColLabels,
  getGridItemId,
  getItemIdsForLevel,
  getQuestion,
  GRID_NOTES,
  MODE_LEVELS,
  modeLabel,
  ordinalLabel,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Controller hook — tabbed stats per mode
// ---------------------------------------------------------------------------

function useModalChordsController(
  enabledLevels: ReadonlySet<string>,
): SkillController<Question> {
  const enabledModes = useMemo(
    () => MUSICAL_MODES.filter((m) => enabledLevels.has(m.id)),
    [enabledLevels],
  );
  const [activeTab, setActiveTab] = useState(enabledModes[0]?.id ?? 'major');

  // Keep active tab in sync with enabled modes
  const effectiveTab = enabledLevels.has(activeTab)
    ? activeTab
    : enabledModes[0]?.id ?? 'major';

  const renderStats = useCallback(
    (selector: StatsSelector) => {
      const colLabels = getGridColLabels(effectiveTab);
      const getItemId = (keyRoot: string, colIdx: number) =>
        getGridItemId(effectiveTab, keyRoot, colIdx);

      return (
        <div>
          {enabledModes.length > 1 && (
            <div class='stats-mode-tabs'>
              {enabledModes.map((m) => (
                <button
                  key={m.id}
                  type='button'
                  class={'stats-mode-tab' +
                    (m.id === effectiveTab ? ' active' : '')}
                  aria-pressed={m.id === effectiveTab}
                  onClick={() => setActiveTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <StatsGrid
            selector={selector}
            colLabels={colLabels}
            getItemId={getItemId}
            notes={GRID_NOTES}
          />
        </div>
      );
    },
    [effectiveTab, enabledModes],
  );

  return { renderStats };
}

// ---------------------------------------------------------------------------
// Quality label for display answers
// ---------------------------------------------------------------------------

function qualityDisplayLabel(quality: string): string {
  if (quality === 'major') return 'Major';
  if (quality === 'minor') return 'Minor';
  return 'Dim';
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export const DIATONIC_CHORDS_DEF: SkillDefinition<Question> = {
  id: 'diatonicChords',
  name: 'Diatonic Chords',
  namespace: 'modalChords',
  description: SKILL_DESCRIPTIONS.diatonicChords,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.diatonicChords,
  beforeAfter: SKILL_BEFORE_AFTER.diatonicChords,
  itemNoun: 'chords',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd'
      ? ordinalLabel(q.degree) + ' in ' +
        displayNote(q.keyRoot) + ' ' + modeLabel(q.mode)
      : displayNote(q.rootNote) + q.chord.qualityLabel +
        ' in ' + displayNote(q.keyRoot) + ' ' + modeLabel(q.mode),
  quizInstruction: (q) => q.dir === 'fwd' ? 'What chord?' : 'What degree?',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => q.rootNote + ':' + q.chord.quality,
      comparison: 'note-quality',
      getDisplayAnswer: (q) =>
        displayNote(q.rootNote) + ' ' + qualityDisplayLabel(q.chord.quality),
      normalizeInput: (input) => {
        // Normalize keyboard input: "Eb major" → "Eb:major", "Eb dim" → "Eb:diminished"
        let s = input.replace(
          /\s+(major|minor|diminished|dim)$/i,
          (_, q) => ':' + q.toLowerCase(),
        );
        if (s.endsWith(':dim')) s = s.slice(0, -4) + ':diminished';
        return s;
      },
    },
    rev: {
      getExpectedValue: (q) => String(q.degree),
      comparison: 'integer',
      getDisplayAnswer: (q) =>
        ordinalLabel(q.degree) + ' \u2014 ' + q.chord.numeral,
    },
  },
  validateInput: (q, input) => {
    if (q.dir === 'rev') return /^[2-7]$/.test(input);
    // Forward: require "note:quality" format (buttons always produce this).
    // Also accept "note quality" (space-separated) for keyboard input.
    const normalized = input.replace(
      /\s+(major|minor|diminished|dim)$/i,
      (m) => ':' + m.trim().toLowerCase(),
    );
    if (!normalized.includes(':')) return false;
    const [note, quality] = normalized.split(':');
    return isValidNoteInput(note) &&
      ['major', 'minor', 'diminished', 'dim'].includes(quality);
  },
  // Normalize "Eb major" → "Eb:major", "Eb dim" → "Eb:diminished"
  // (Buttons submit "note:quality" directly; this handles keyboard input.)
  getDirection: (q) => q.dir,
  getUseFlats: (q) => rootUsesFlats(q.keyRoot),

  inputPlaceholder: (q) =>
    q.dir === 'fwd' ? 'e.g. Eb:major' : 'Degree (2\u20137)',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'split-note-quality' },
    rev: { kind: 'degree' },
  },

  scope: {
    kind: 'levels',
    levels: MODE_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    storageKey: 'modalChords_enabledModes',
    scopeLabel: 'Modes',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === MODE_LEVELS.length) return 'all modes';
      return MODE_LEVELS
        .filter((l) => levels.has(l.id))
        .map((l) => l.label)
        .join(', ');
    },
  },

  stats: { kind: 'none' },
  useController: useModalChordsController,
};
