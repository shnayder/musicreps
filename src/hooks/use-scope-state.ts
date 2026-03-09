// useScopeState — Preact hook wrapping scope load/save/toggle from
// mode-controller.ts. Manages enabled groups, fretboard strings, and
// note filter in localStorage.

import { useCallback, useState } from 'preact/hooks';
import type { NoteFilter, ScopeSpec, ScopeState } from '../types.ts';

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
    return { kind: 'groups', enabledGroups: enabled };
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
      const updated: ScopeState = { kind: 'groups', enabledGroups: next };
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

  return [scope, { toggleGroup, setNoteFilter, setScope }];
}
