// Mode progress manifest: derived from the shared ALL_MODE_DEFINITIONS list.
// Adding a mode to mode-definitions.ts automatically includes it here.

import type { ScopeDef } from './declarative/types.ts';
import type { MotorTaskType } from './types.ts';
import { ALL_MODE_DEFINITIONS } from './mode-definitions.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeProgressEntry = {
  modeId: string;
  namespace: string;
  /** Motor task type for this mode's baseline calibration (default 'note-button'). */
  motorTaskType?: MotorTaskType;
  /** Expected sub-response count per item (for multi-response modes). */
  getResponseCount?: (itemId: string) => number;
  groups: Array<{
    id: string;
    label: string | (() => string);
    longLabel?: string | (() => string);
    getItemIds: () => string[];
  }>;
  allItemIds: () => string[];
};

// ---------------------------------------------------------------------------
// Derivation from ModeDefinition
// ---------------------------------------------------------------------------

/** Build a manifest entry from any ModeDefinition. */
function entryFromDef(
  def: {
    id: string;
    namespace: string;
    allItems: string[];
    scope: ScopeDef;
    motorTaskType?: MotorTaskType;
    getExpectedResponseCount?: (itemId: string) => number;
  },
): ModeProgressEntry {
  const scope = def.scope;
  return {
    modeId: def.id,
    namespace: def.namespace,
    motorTaskType: def.motorTaskType,
    getResponseCount: def.getExpectedResponseCount,
    groups: scope.kind === 'groups'
      ? scope.groups.map((g) => ({
        id: g.id,
        label: g.label,
        longLabel: g.longLabel,
        getItemIds: () => scope.getItemIdsForGroup(g.id),
      }))
      : [{ id: 'all', label: 'All', getItemIds: () => def.allItems }],
    allItemIds: () => def.allItems,
  };
}

// ---------------------------------------------------------------------------
// Manifest (auto-derived)
// ---------------------------------------------------------------------------

export const MODE_PROGRESS_MANIFEST: ModeProgressEntry[] = ALL_MODE_DEFINITIONS
  .map(entryFromDef);

/** Look up a mode's progress entry by ID. */
export function getModeProgress(
  modeId: string,
): ModeProgressEntry | undefined {
  return MODE_PROGRESS_MANIFEST.find((e) => e.modeId === modeId);
}
