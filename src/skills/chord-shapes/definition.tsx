// Chord Shapes — declarative mode definitions for guitar and ukulele.
// Multi-tap response: user taps all played positions of a chord voicing.
// Two modes registered: one per instrument.

import { useCallback } from 'preact/hooks';
import { displayNote } from '../../music-data.ts';
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
  ALL_LEVEL_IDS,
  allItems,
  evaluate,
  formatGroupLabel,
  getItemIdsForLevel,
  parseItem,
  QUALITY_LEVELS,
  type Question,
} from './logic.ts';
import { getVoicings } from './voicings.ts';

// ---------------------------------------------------------------------------
// Stats rendering — grid of roots × qualities
// ---------------------------------------------------------------------------

function useChordShapesController(
  instrument: 'guitar' | 'ukulele',
): SkillController<Question> {
  const voicings = getVoicings(instrument);

  const renderStats = useCallback(
    (
      selector: Parameters<
        NonNullable<SkillController<Question>['renderStats']>
      >[0],
    ) => {
      // Collect unique roots and qualities in voicing order
      const roots: string[] = [];
      const rootSet = new Set<string>();
      const qualities: string[] = [];
      const qualitySet = new Set<string>();
      for (const v of voicings) {
        if (!rootSet.has(v.root)) {
          rootSet.add(v.root);
          roots.push(v.root);
        }
        if (!qualitySet.has(v.quality)) {
          qualitySet.add(v.quality);
          qualities.push(v.quality);
        }
      }

      const symbolFor = (q: string) =>
        voicings.find((v) => v.quality === q)?.symbol ?? q;

      let html = '<table class="stats-table chord-shapes-stats"><thead><tr>';
      html += '<th></th>';
      for (const r of roots) html += '<th>' + displayNote(r) + '</th>';
      html += '</tr></thead><tbody>';
      for (const q of qualities) {
        html += '<tr><th>' + (symbolFor(q) || 'maj') + '</th>';
        for (const r of roots) {
          const id = r + ':' + q;
          const exists = voicings.some(
            (v) => v.root === r && v.quality === q,
          );
          if (exists) {
            html += '<td class="stats-cell" style="background:' +
              getStatsCellColor(selector, id) + '"></td>';
          } else {
            html += '<td></td>';
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      return (
        <div
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    },
    [voicings],
  );

  return { renderStats };
}

// ---------------------------------------------------------------------------
// Factory — creates a SkillDefinition for either instrument
// ---------------------------------------------------------------------------

export function createChordShapesDef(
  instrument: 'guitar' | 'ukulele',
): SkillDefinition<Question> {
  const isGuitar = instrument === 'guitar';
  const id = isGuitar ? 'guitarChordShapes' : 'ukuleleChordShapes';
  const stringCount = isGuitar ? 6 : 4;
  const items = allItems(instrument);

  return {
    id,
    name: isGuitar ? 'Guitar Chord Shapes' : 'Ukulele Chord Shapes',
    namespace: id,
    motorTaskType: 'fretboard-tap',
    description: SKILL_DESCRIPTIONS[id],
    aboutDescription: SKILL_ABOUT_DESCRIPTIONS[id],
    beforeAfter: SKILL_BEFORE_AFTER[id],
    itemNoun: 'chords',

    allItems: items,
    getQuestion: (itemId) => parseItem(instrument, itemId),
    getPromptText: (q) => q.displayName,
    quizInstruction: 'Tap all played positions',

    multiTap: {
      getTargets: (q) => q.playedPositions,
      evaluate,
      stringCount,
      getMutedStrings: (q) => q.mutedStrings,
      onePerString: true,
    },

    getExpectedResponseCount: (itemId) => {
      const q = parseItem(instrument, itemId);
      return q.playedPositions.length;
    },

    buttons: { kind: 'none' },

    scope: {
      kind: 'levels',
      levels: QUALITY_LEVELS,
      getItemIdsForLevel: (levelId) => getItemIdsForLevel(instrument, levelId),
      allLevelIds: ALL_LEVEL_IDS,
      // Legacy storage key — uses old "enabledGroups" naming.
      storageKey: id + '_enabledGroups',
      scopeLabel: 'Chords',
      defaultEnabled: [ALL_LEVEL_IDS[0]],
      formatLabel: formatGroupLabel,
    },

    stats: { kind: 'none' },

    useController: () => useChordShapesController(instrument),
  };
}

export const GUITAR_CHORD_SHAPES_DEF = createChordShapesDef('guitar');
export const UKULELE_CHORD_SHAPES_DEF = createChordShapesDef('ukulele');
