// useScopeState — Preact hook wrapping scope load/save/toggle from
// scope-controller.ts. Manages enabled levels, fretboard strings, and
// note filter in storage.

import { useCallback, useState } from 'preact/hooks';
import type {
  LevelStatus,
  NoteFilter,
  ScopeSpec,
  ScopeState,
} from '../types.ts';
import { storage } from '../storage.ts';

// ---------------------------------------------------------------------------
// Load / save helpers (extracted from scope-controller.ts lines 47-120)
// ---------------------------------------------------------------------------

function loadScope(spec: ScopeSpec): ScopeState {
  if (spec.kind === 'none') return { kind: 'none' };

  if (spec.kind === 'levels') {
    let enabled = new Set<string>(spec.defaultEnabled);
    // Legacy storage key — uses old "enabledGroups" naming in definitions.
    const saved = storage.getItem(spec.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'number') {
            // Old format: positional indices → convert using spec.levels[i].id
            const newEnabled = new Set<string>();
            for (const idx of parsed) {
              if (idx >= 0 && idx < spec.levels.length) {
                newEnabled.add(spec.levels[idx].id);
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
    // Validate: drop IDs not in current level list.
    for (const id of enabled) {
      if (!spec.levels.some((g) => g.id === id)) enabled.delete(id);
    }
    // If all saved levels were invalid, fall back to defaults.
    if (enabled.size === 0) {
      for (const d of spec.defaultEnabled) enabled.add(d);
    }
    // Load skipped levels (Map<string, LevelStatus>).
    const skipped = new Map<string, LevelStatus>();
    // Legacy storage key — appends "_skipped" to old "enabledGroups" key.
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
                  const group = spec.levels[idx];
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
                const group = spec.levels[idx];
                if (group) skipped.set(group.id, 'deferred');
              }
            }
          }
        }
      } catch (_) { /* expected */ }
    }
    // Validate: drop IDs not in current level list.
    for (const id of skipped.keys()) {
      if (!spec.levels.some((g) => g.id === id)) skipped.delete(id);
    }
    // Skipped levels must not be enabled.
    for (const id of skipped.keys()) enabled.delete(id);
    return { kind: 'levels', enabledLevels: enabled, skippedLevels: skipped };
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
  if (spec.kind === 'levels' && scope.kind === 'levels') {
    storage.setItem(
      spec.storageKey,
      JSON.stringify([...scope.enabledLevels]),
    );
    storage.setItem(
      spec.storageKey + '_skipped',
      JSON.stringify([...scope.skippedLevels.entries()]),
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
  toggleLevel: (id: string) => void;
  /** Skip a level with a reason. Removes it from enabled levels. */
  skipLevel: (id: string, reason: LevelStatus) => void;
  /** Unskip a level (removes from skipped map; does not re-enable). */
  unskipLevel: (id: string) => void;
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

  const toggleLevel = useCallback((id: string) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'levels') return prev;
      const next = new Set(prev.enabledLevels);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const updated: ScopeState = {
        kind: 'levels',
        enabledLevels: next,
        skippedLevels: prev.skippedLevels,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const skipLevel = useCallback((id: string, reason: LevelStatus) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'levels') return prev;
      // Prevent skipping the last non-skipped level.
      const levelCount =
        (spec as Extract<ScopeSpec, { kind: 'levels' }>).levels.length;
      if (
        prev.skippedLevels.size + (prev.skippedLevels.has(id) ? 0 : 1) >=
          levelCount
      ) return prev;
      // Validate that the ID exists in the current level list.
      const levelSpec = spec as Extract<ScopeSpec, { kind: 'levels' }>;
      if (!levelSpec.levels.some((g) => g.id === id)) return prev;
      const nextSkipped = new Map(prev.skippedLevels);
      nextSkipped.set(id, reason);
      const nextEnabled = new Set(prev.enabledLevels);
      nextEnabled.delete(id);
      const updated: ScopeState = {
        kind: 'levels',
        enabledLevels: nextEnabled,
        skippedLevels: nextSkipped,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const unskipLevel = useCallback((id: string) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'levels') return prev;
      if (!prev.skippedLevels.has(id)) return prev;
      const nextSkipped = new Map(prev.skippedLevels);
      nextSkipped.delete(id);
      const updated: ScopeState = {
        kind: 'levels',
        enabledLevels: prev.enabledLevels,
        skippedLevels: nextSkipped,
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
    toggleLevel,
    skipLevel,
    unskipLevel,
    setNoteFilter,
    setScope,
  }];
}
