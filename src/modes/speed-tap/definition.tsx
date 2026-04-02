// Speed Tap — declarative mode definition.
// Multi-tap response: user taps all fretboard positions of a given note.
// "Find all C" → tap 8 positions on the fretboard. Evaluated after all tapped.

import { useCallback } from 'preact/hooks';
import { displayNote, NOTES } from '../../music-data.ts';
import {
  MODE_ABOUT_DESCRIPTIONS,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../mode-catalog.ts';
import { getStatsCellColor } from '../../stats-display.ts';
import type {
  ModeController,
  ModeDefinition,
} from '../../declarative/types.ts';
import {
  ALL_GROUP_IDS,
  ALL_ITEMS,
  evaluate,
  formatGroupLabel,
  getItemIdsForGroup,
  getPositionsForNote,
  NOTE_GROUPS,
  parseItem,
  positionKey,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Controller hook — provides custom stats rendering
// ---------------------------------------------------------------------------

function useSpeedTapController(): ModeController<Question> {
  const renderStats = useCallback(
    (
      selector: Parameters<
        NonNullable<ModeController<Question>['renderStats']>
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

export const SPEED_TAP_DEF: ModeDefinition<Question> = {
  id: 'speedTap',
  name: 'Speed Tap',
  namespace: 'speedTap',
  motorTaskType: 'fretboard-tap',
  description: MODE_DESCRIPTIONS.speedTap,
  aboutDescription: MODE_ABOUT_DESCRIPTIONS.speedTap,
  beforeAfter: MODE_BEFORE_AFTER.speedTap,
  itemNoun: 'notes',

  allItems: ALL_ITEMS,
  getQuestion: parseItem,
  getPromptText: (q) => 'Tap all ' + q.displayName,
  quizInstruction: 'Find all positions',

  multiTap: {
    getTargets: (q) => q.positions.map(positionKey),
    evaluate,
  },

  getExpectedResponseCount: (itemId) => getPositionsForNote(itemId).length,

  buttons: { kind: 'none' },

  scope: {
    kind: 'groups',
    groups: NOTE_GROUPS,
    getItemIdsForGroup,
    allGroupIds: ALL_GROUP_IDS,
    storageKey: 'speedTap_enabledGroups',
    scopeLabel: 'Notes',
    defaultEnabled: [ALL_GROUP_IDS[0]],
    formatLabel: formatGroupLabel,
  },

  stats: { kind: 'none' },

  useController: () => useSpeedTapController(),
};
