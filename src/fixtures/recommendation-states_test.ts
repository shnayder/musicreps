// Tests that each recommendation state fixture produces the expected output.
// Ensures screenshot fixtures and algorithm behavior stay in sync.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ALL_STATES,
  type RecommendationState,
} from './recommendation-states.ts';
import { createAdaptiveSelector, createMemoryStorage } from '../adaptive.ts';
import { computeRecommendations } from '../recommendations.ts';
import { buildRecommendationLines } from '../mode-ui-state.ts';
import { getGroups, getItemIdsForGroup } from '../modes/fretboard/logic.ts';
import { GUITAR } from '../music-data.ts';
import { ALL_ITEMS as NOTE_SEMI_ITEMS } from '../modes/note-semitones/logic.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load a state's localStorage data into a memory storage adapter. */
function loadState(state: RecommendationState) {
  const storage = createMemoryStorage();
  for (const [key, value] of Object.entries(state.localStorageData)) {
    const prefix = `adaptive_${state.namespace}_`;
    if (key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      storage.saveStats(itemId, JSON.parse(value));
    }
  }
  return storage;
}

/** Get the verbs from a multi-group recommendation result. */
function getMultiGroupVerbs(state: RecommendationState): string[] {
  const storage = loadState(state);
  const selector = createAdaptiveSelector(storage);

  if (state.namespace === 'fretboard') {
    const groups = getGroups(GUITAR);
    const groupIds = groups.map((g) => g.id);
    const getIds = (id: string) => getItemIdsForGroup(GUITAR, id);
    const idOrder = new Map(groupIds.map((id, i) => [id, i]));
    const result = computeRecommendations(
      selector,
      groupIds,
      getIds,
      {},
      {
        sortUnstarted: (a, b) =>
          (idOrder.get(a.groupId) ?? 0) - (idOrder.get(b.groupId) ?? 0),
      },
    );
    const lines = buildRecommendationLines(
      result,
      (id) => {
        const g = groups.find((g) => g.id === id);
        if (!g) return id;
        return typeof g.label === 'function' ? g.label() : g.label;
      },
    );
    return lines.map((l) => l.verb);
  }
  return [];
}

/** Get the verb from a single-level mode's recommendation. */
function getSingleLevelVerb(state: RecommendationState): string {
  const storage = loadState(state);
  const selector = createAdaptiveSelector(storage);
  const allItems = NOTE_SEMI_ITEMS;

  const anySeen = allItems.some((id) => selector.getStats(id) !== null);
  if (!anySeen) return 'Start';
  if (selector.checkNeedsReview(allItems)) return 'Review';
  if (selector.checkAllAutomatic(allItems)) {
    return 'All items automatic! Practice something else';
  }
  return 'Practice';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recommendation state fixtures', () => {
  for (const state of ALL_STATES) {
    it(`${state.name} produces expected verbs: [${state.expectedVerbs.join(', ')}]`, () => {
      let actualVerbs: string[];
      if (state.kind === 'multi-group') {
        actualVerbs = getMultiGroupVerbs(state);
      } else {
        actualVerbs = [getSingleLevelVerb(state)];
      }
      assert.deepEqual(
        actualVerbs,
        state.expectedVerbs,
        `State "${state.name}": expected [${state.expectedVerbs}] but got [${actualVerbs}]`,
      );
    });
  }
});
