// useScopeState — Preact hook wrapping scope load/save/toggle from
// mode-controller.ts. Manages enabled groups, fretboard strings, and
// note filter in storage.

import { useCallback, useState } from 'preact/hooks';
import type {
  GroupStatus,
  NoteFilter,
  ScopeSpec,
  ScopeState,
} from '../types.ts';
import { storage } from '../storage.ts';

// ---------------------------------------------------------------------------
// Load / save helpers (extracted from mode-controller.ts lines 47-120)
// ---------------------------------------------------------------------------

function loadScope(spec: ScopeSpec): ScopeState {
  if (spec.kind === 'none') return { kind: 'none' };

  if (spec.kind === 'groups') {
    let enabled = new Set<string>(spec.defaultEnabled);
    const saved = storage.getItem(spec.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'number') {
            // Old format: positional indices → convert using spec.groups[i].id
            const newEnabled = new Set<string>();
            for (const idx of parsed) {
              if (idx >= 0 && idx < spec.groups.length) {
                newEnabled.add(spec.groups[idx].id);
              }
            }
            if (newEnabled.size > 0) enabled = newEnabled;
          } else {
            // New format: string IDs
            const newEnabled = new Set(
              parsed.filter((x: unknown) => typeof x === 'string') as string[],
            );
            if (newEnabled.size > 0) enabled = newEnabled;
          }
        }
      } catch (_) { /* expected */ }
    }
    // Validate: drop IDs not in current group list.
    for (const id of enabled) {
      if (!spec.groups.some((g) => g.id === id)) enabled.delete(id);
    }
    // If all saved groups were invalid, fall back to defaults.
    if (enabled.size === 0) {
      for (const d of spec.defaultEnabled) enabled.add(d);
    }
    // Load skipped groups (Map<string, GroupStatus>).
    const skipped = new Map<string, GroupStatus>();
    const savedSkipped = storage.getItem(spec.storageKey + '_skipped');
    if (savedSkipped) {
      try {
        const parsed = JSON.parse(savedSkipped);
        if (Array.isArray(parsed)) {
          if (
            parsed.length > 0 && Array.isArray(parsed[0]) &&
            parsed[0].length === 2
          ) {
            const [first] = parsed[0];
            if (typeof first === 'number') {
              // Old format: [[index, reason], ...] with numeric indices
              for (const [idx, reason] of parsed) {
                if (
                  typeof idx === 'number' && Number.isInteger(idx) &&
                  (reason === 'mastered' || reason === 'deferred')
                ) {
                  const group = spec.groups[idx];
                  if (group) skipped.set(group.id, reason);
                }
              }
            } else {
              // New format: [[id, reason], ...] with string IDs
              for (const [id, reason] of parsed) {
                if (
                  typeof id === 'string' &&
                  (reason === 'mastered' || reason === 'deferred')
                ) {
                  skipped.set(id, reason);
                }
              }
            }
          } else {
            // Old format: [index, ...] — migrate with 'deferred' default
            for (const idx of parsed) {
              if (typeof idx === 'number') {
                const group = spec.groups[idx];
                if (group) skipped.set(group.id, 'deferred');
              }
            }
          }
        }
      } catch (_) { /* expected */ }
    }
    // Validate: drop IDs not in current group list.
    for (const id of skipped.keys()) {
      if (!spec.groups.some((g) => g.id === id)) skipped.delete(id);
    }
    // Skipped groups must not be enabled.
    for (const id of skipped.keys()) enabled.delete(id);
    return { kind: 'groups', enabledGroups: enabled, skippedGroups: skipped };
  }

  if (spec.kind === 'note-filter') {
    let noteFilter: NoteFilter = 'natural';
    const saved = storage.getItem(spec.storageKey);
    if (
      saved === 'natural' || saved === 'sharps-flats' ||
      saved === 'all' || saved === 'none'
    ) {
      noteFilter = saved;
    }
    return { kind: 'note-filter', noteFilter };
  }

  return { kind: 'none' };
}

function saveScope(spec: ScopeSpec, scope: ScopeState): void {
  if (spec.kind === 'groups' && scope.kind === 'groups') {
    storage.setItem(
      spec.storageKey,
      JSON.stringify([...scope.enabledGroups]),
    );
    storage.setItem(
      spec.storageKey + '_skipped',
      JSON.stringify([...scope.skippedGroups.entries()]),
    );
  } else if (spec.kind === 'note-filter' && scope.kind === 'note-filter') {
    try {
      storage.setItem(spec.storageKey, scope.noteFilter);
    } catch (_) { /* expected */ }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type ScopeActions = {
  toggleGroup: (id: string) => void;
  /** Skip a group with a reason. Removes it from enabled groups. */
  skipGroup: (id: string, reason: GroupStatus) => void;
  /** Unskip a group (removes from skipped map; does not re-enable). */
  unskipGroup: (id: string) => void;
  setNoteFilter: (filter: NoteFilter) => void;
  /** Replace scope state directly (e.g., applying recommendations). */
  setScope: (scope: ScopeState) => void;
};

export function useScopeState(
  spec: ScopeSpec,
): [ScopeState, ScopeActions] {
  const [scope, setScopeRaw] = useState<ScopeState>(() => loadScope(spec));

  // Update state and persist to storage.
  const setScope = useCallback((next: ScopeState) => {
    setScopeRaw(next);
    saveScope(spec, next);
  }, [spec]);

  const toggleGroup = useCallback((id: string) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') return prev;
      const next = new Set(prev.enabledGroups);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const updated: ScopeState = {
        kind: 'groups',
        enabledGroups: next,
        skippedGroups: prev.skippedGroups,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const skipGroup = useCallback((id: string, reason: GroupStatus) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') return prev;
      // Prevent skipping the last non-skipped group.
      const groupCount =
        (spec as Extract<ScopeSpec, { kind: 'groups' }>).groups.length;
      if (
        prev.skippedGroups.size + (prev.skippedGroups.has(id) ? 0 : 1) >=
          groupCount
      ) return prev;
      // Validate that the ID exists in the current group list.
      const groupSpec = spec as Extract<ScopeSpec, { kind: 'groups' }>;
      if (!groupSpec.groups.some((g) => g.id === id)) return prev;
      const nextSkipped = new Map(prev.skippedGroups);
      nextSkipped.set(id, reason);
      const nextEnabled = new Set(prev.enabledGroups);
      nextEnabled.delete(id);
      const updated: ScopeState = {
        kind: 'groups',
        enabledGroups: nextEnabled,
        skippedGroups: nextSkipped,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const unskipGroup = useCallback((id: string) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') return prev;
      if (!prev.skippedGroups.has(id)) return prev;
      const nextSkipped = new Map(prev.skippedGroups);
      nextSkipped.delete(id);
      const updated: ScopeState = {
        kind: 'groups',
        enabledGroups: prev.enabledGroups,
        skippedGroups: nextSkipped,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const setNoteFilter = useCallback((filter: NoteFilter) => {
    setScopeRaw((prev) => {
      if (prev.kind === 'note-filter') {
        const updated: ScopeState = { kind: 'note-filter', noteFilter: filter };
        saveScope(spec, updated);
        return updated;
      }
      return prev;
    });
  }, [spec]);

  return [scope, {
    toggleGroup,
    skipGroup,
    unskipGroup,
    setNoteFilter,
    setScope,
  }];
}
