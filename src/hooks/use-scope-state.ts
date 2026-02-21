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
    return { kind: 'groups', enabledGroups: enabled };
  }

  if (spec.kind === 'fretboard') {
    const inst = spec.instrument;
    let enabledStrings = new Set([inst.defaultString]);
    const saved = localStorage.getItem(
      inst.storageNamespace + '_enabledStrings',
    );
    if (saved) {
      try {
        enabledStrings = new Set(JSON.parse(saved));
      } catch (_) { /* expected */ }
    }
    let noteFilter: NoteFilter = 'natural';
    const savedFilter = localStorage.getItem(
      inst.storageNamespace + '_noteFilter',
    );
    if (
      savedFilter === 'natural' || savedFilter === 'sharps-flats' ||
      savedFilter === 'all'
    ) {
      noteFilter = savedFilter;
    }
    return { kind: 'fretboard', enabledStrings, noteFilter };
  }

  if (spec.kind === 'note-filter') {
    let noteFilter: NoteFilter = 'natural';
    const saved = localStorage.getItem(spec.storageKey);
    if (saved === 'natural' || saved === 'sharps-flats' || saved === 'all') {
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
  } else if (spec.kind === 'fretboard' && scope.kind === 'fretboard') {
    const inst = spec.instrument;
    localStorage.setItem(
      inst.storageNamespace + '_enabledStrings',
      JSON.stringify([...scope.enabledStrings]),
    );
    try {
      localStorage.setItem(
        inst.storageNamespace + '_noteFilter',
        scope.noteFilter,
      );
    } catch (_) { /* expected */ }
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
  toggleString: (index: number) => void;
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
        if (next.size > 1) next.delete(index);
      } else {
        next.add(index);
      }
      const updated: ScopeState = { kind: 'groups', enabledGroups: next };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const toggleString = useCallback((index: number) => {
    setScopeRaw((prev) => {
      if (prev.kind !== 'fretboard') return prev;
      const next = new Set(prev.enabledStrings);
      if (next.has(index)) {
        if (next.size > 1) next.delete(index);
      } else {
        next.add(index);
      }
      const updated: ScopeState = {
        kind: 'fretboard',
        enabledStrings: next,
        noteFilter: prev.noteFilter,
      };
      saveScope(spec, updated);
      return updated;
    });
  }, [spec]);

  const setNoteFilter = useCallback((filter: NoteFilter) => {
    setScopeRaw((prev) => {
      if (prev.kind === 'fretboard') {
        const updated: ScopeState = {
          kind: 'fretboard',
          enabledStrings: prev.enabledStrings,
          noteFilter: filter,
        };
        saveScope(spec, updated);
        return updated;
      }
      if (prev.kind === 'note-filter') {
        const updated: ScopeState = { kind: 'note-filter', noteFilter: filter };
        saveScope(spec, updated);
        return updated;
      }
      return prev;
    });
  }, [spec]);

  return [scope, { toggleGroup, toggleString, setNoteFilter, setScope }];
}
