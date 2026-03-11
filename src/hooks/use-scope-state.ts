// useScopeState — Preact hook wrapping scope load/save/toggle from
// mode-controller.ts. Manages enabled groups, fretboard strings, and
// note filter in localStorage.

import { useCallback, useState } from 'preact/hooks';
import type {
  GroupStatus,
  NoteFilter,
  ScopeSpec,
  ScopeState,
} from '../types.ts';

// ---------------------------------------------------------------------------
// Load / save helpers (extracted from mode-controller.ts lines 47-120)
// ---------------------------------------------------------------------------

function loadScope(spec: ScopeSpec): ScopeState {
  if (spec.kind === 'none') return { kind: 'none' };

  if (spec.kind === 'groups') {
    let enabled = new Set(spec.defaultEnabled);
    const saved = localStorage.getItem(spec.storageKey);
    if (saved) {
      try {
        enabled = new Set(JSON.parse(saved));
      } catch (_) { /* expected */ }
    }
    // Drop indices beyond the current group count (groups may have been
    // removed between releases — stale localStorage shouldn't crash).
    const groupCount = spec.groups.length;
    for (const idx of enabled) {
      if (idx < 0 || idx >= groupCount) enabled.delete(idx);
    }
    // If all saved groups were invalid, fall back to defaults.
    if (enabled.size === 0) {
      for (const d of spec.defaultEnabled) enabled.add(d);
    }
    // Load skipped groups (Map<number, GroupStatus>).
    const skipped = new Map<number, GroupStatus>();
    const savedSkipped = localStorage.getItem(spec.storageKey + '_skipped');
    if (savedSkipped) {
      try {
        const parsed = JSON.parse(savedSkipped);
        if (Array.isArray(parsed)) {
          if (
            parsed.length > 0 && Array.isArray(parsed[0]) &&
            parsed[0].length === 2
          ) {
            // New format: [[index, reason], ...]
            for (const [idx, reason] of parsed) {
              if (reason === 'mastered' || reason === 'deferred') {
                skipped.set(idx, reason);
              }
            }
          } else {
            // Old format: [index, ...] — migrate with 'deferred' default
            for (const idx of parsed) {
              if (typeof idx === 'number') skipped.set(idx, 'deferred');
            }
          }
        }
      } catch (_) { /* expected */ }
    }
    for (const idx of skipped.keys()) {
      if (idx < 0 || idx >= groupCount) skipped.delete(idx);
    }
    // Skipped groups must not be enabled.
    for (const idx of skipped.keys()) enabled.delete(idx);
    return { kind: 'groups', enabledGroups: enabled, skippedGroups: skipped };
  }

  if (spec.kind === 'note-filter') {
    let noteFilter: NoteFilter = 'natural';
    const saved = localStorage.getItem(spec.storageKey);
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
    localStorage.setItem(
      spec.storageKey,
      JSON.stringify([...scope.enabledGroups]),
    );
    localStorage.setItem(
      spec.storageKey + '_skipped',
      JSON.stringify([...scope.skippedGroups.entries()]),
    );
  } else if (spec.kind === 'note-filter' && scope.kind === 'note-filter') {
    try {
      localStorage.setItem(spec.storageKey, scope.noteFilter);
    } catch (_) { /* expected */ }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type ScopeActions = {
  toggleGroup: (index: number) => void;
  /** Skip a group with a reason. Removes it from enabled groups. */
  skipGroup: (index: number, reason: GroupStatus) => void;
  /** Unskip a group (removes from skipped map; does not re-enable). */
  unskipGroup: (index: number) => void;
  setNoteFilter: (filter: NoteFilter) => void;
  /** Replace scope state directly (e.g., applying recommendations). */
  setScope: (scope: ScopeState) => void;
};

export function useScopeState(
  spec: ScopeSpec,
): [ScopeState, ScopeActions] {
  const [scope, setScopeRaw] = useState<ScopeState>(() => loadScope(spec));

  // Update state and persist to localStorage.
  const setScope = useCallback((next: ScopeState) => {
    setScopeRaw(next);
    saveScope(spec, next);
  }, [spec]);

  const toggleGroup = useCallback((index: number) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') return prev;
      const next = new Set(prev.enabledGroups);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
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

  const skipGroup = useCallback((index: number, reason: GroupStatus) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') return prev;
      // Prevent skipping the last non-skipped group.
      const groupCount =
        (spec as Extract<ScopeSpec, { kind: 'groups' }>).groups.length;
      if (
        prev.skippedGroups.size + (prev.skippedGroups.has(index) ? 0 : 1) >=
          groupCount
      ) return prev;
      const nextSkipped = new Map(prev.skippedGroups);
      nextSkipped.set(index, reason);
      const nextEnabled = new Set(prev.enabledGroups);
      nextEnabled.delete(index);
      const updated: ScopeState = {
        kind: 'groups',
        enabledGroups: nextEnabled,
        skippedGroups: nextSkipped,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const unskipGroup = useCallback((index: number) => {
    console.log('[REC-DEBUG] unskipGroup called for index:', index);
    setScopeRaw((prev) => {
      if (prev.kind !== 'groups') {
        console.log('[REC-DEBUG] unskip: not groups scope, returning prev');
        return prev;
      }
      if (!prev.skippedGroups.has(index)) {
        console.log(
          '[REC-DEBUG] unskip: index not in skippedGroups, returning prev',
        );
        return prev;
      }
      const nextSkipped = new Map(prev.skippedGroups);
      nextSkipped.delete(index);
      const updated: ScopeState = {
        kind: 'groups',
        enabledGroups: prev.enabledGroups,
        skippedGroups: nextSkipped,
      };
      console.log(
        '[REC-DEBUG] unskip: new state created',
        'skipped:',
        [...nextSkipped.keys()],
        'enabled:',
        [...prev.enabledGroups],
      );
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
