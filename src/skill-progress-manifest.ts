// Skill progress manifest: derived from the shared ALL_SKILL_DEFINITIONS list.
// Adding a skill to skill-definitions.ts automatically includes it here.

import type { ScopeDef } from './declarative/types.ts';
import type { MotorTaskType } from './types.ts';
import { ALL_SKILL_DEFINITIONS } from './skill-definitions.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillProgressEntry = {
  skillId: string;
  namespace: string;
  /** Motor task type for this skill's baseline calibration (default 'note-button'). */
  motorTaskType?: MotorTaskType;
  /** Expected sub-response count per item (for multi-response skills). */
  getResponseCount?: (itemId: string) => number;
  levels: Array<{
    id: string;
    label: string | (() => string);
    longLabel?: string | (() => string);
    getItemIds: () => string[];
  }>;
  allItemIds: () => string[];
};

// ---------------------------------------------------------------------------
// Derivation from SkillDefinition
// ---------------------------------------------------------------------------

/** Build a manifest entry from any SkillDefinition. */
function entryFromDef(
  def: {
    id: string;
    namespace: string;
    allItems: string[];
    scope: ScopeDef;
    motorTaskType?: MotorTaskType;
    getExpectedResponseCount?: (itemId: string) => number;
  },
): SkillProgressEntry {
  const scope = def.scope;
  return {
    skillId: def.id,
    namespace: def.namespace,
    motorTaskType: def.motorTaskType,
    getResponseCount: def.getExpectedResponseCount,
    levels: scope.kind === 'levels'
      ? scope.levels.map((g) => ({
        id: g.id,
        label: g.label,
        longLabel: g.longLabel,
        getItemIds: () => scope.getItemIdsForLevel(g.id),
      }))
      : [{ id: 'all', label: 'All', getItemIds: () => def.allItems }],
    allItemIds: () => def.allItems,
  };
}

// ---------------------------------------------------------------------------
// Manifest (auto-derived)
// ---------------------------------------------------------------------------

export const SKILL_PROGRESS_MANIFEST: SkillProgressEntry[] =
  ALL_SKILL_DEFINITIONS
    .map(entryFromDef);

/** Look up a skill's progress entry by ID. */
export function getSkillProgress(
  skillId: string,
): SkillProgressEntry | undefined {
  return SKILL_PROGRESS_MANIFEST.find((e) => e.skillId === skillId);
}
