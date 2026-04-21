// Speed Tap — declarative mode definition.
// Multi-tap response: user taps all fretboard positions of a given note.
// "Find all C" → tap 8 positions on the fretboard. Evaluated after all tapped.

import { useCallback } from 'preact/hooks';
import { displayNote, NOTES } from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import { getStatsCellColor } from '../../stats-display.ts';
import type {
  SkillController,
  SkillDefinition,
} from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  evaluate,
  formatGroupLabel,
  getItemIdsForLevel,
  getPositionsForNote,
  NOTE_LEVELS,
  parseItem,
  positionKey,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Controller hook — provides custom stats rendering
// ---------------------------------------------------------------------------

function useSpeedTapController(): SkillController<Question> {
  const renderStats = useCallback(
    (
      selector: Parameters<
        NonNullable<SkillController<Question>['renderStats']>
      >[0],
    ) => {
      let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
      for (let i = 0; i < NOTES.length; i++) {
        html += '<th>' + displayNote(NOTES[i].name) + '</th>';
      }
      html += '</tr></thead><tbody><tr>';
      for (let j = 0; j < NOTES.length; j++) {
        html += '<td class="stats-cell" style="background:' +
          getStatsCellColor(selector, NOTES[j].name) + '"></td>';
      }
      html += '</tr></tbody></table>';
      return (
        <div
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    },
    [],
  );

  return { renderStats };
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export const SPEED_TAP_DEF: SkillDefinition<Question> = {
  id: 'speedTap',
  name: 'Speed Tap',
  namespace: 'speedTap',
  motorTaskType: 'fretboard-tap',
  description: SKILL_DESCRIPTIONS.speedTap,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.speedTap,
  beforeAfter: SKILL_BEFORE_AFTER.speedTap,
  itemNoun: 'notes',

  allItems: ALL_ITEMS,
  getQuestion: parseItem,
  getPromptText: (q) => q.displayName,
  quizInstruction: 'Tap all note positions',

  multiTap: {
    getTargets: (q) => q.positions.map(positionKey),
    evaluate,
  },

  getExpectedResponseCount: (itemId) => getPositionsForNote(itemId).length,

  buttons: { kind: 'none' },

  scope: {
    kind: 'levels',
    levels: NOTE_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'speedTap_enabledGroups',
    scopeLabel: 'Notes',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: formatGroupLabel,
  },

  stats: { kind: 'none' },

  useController: () => useSpeedTapController(),
};
