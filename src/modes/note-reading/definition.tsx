// Note Reading mode — declarative definition.
// Uses a useController hook for abcjs staff rendering and immediate
// note-key submission (no accidentals, no Enter needed).

import { useEffect, useMemo, useRef } from 'preact/hooks';
import { createAdaptiveKeyHandler } from '../../quiz-engine.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../music-data.ts';
import type {
  ModeController,
  ModeDefinition,
} from '../../declarative/types.ts';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  GRID_NOTES,
  GROUPS,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// abcjs rendering
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
let abcjs: any = null;

async function ensureAbcjs(): Promise<void> {
  if (!abcjs) {
    abcjs = await import('abcjs');
  }
}

function renderStaff(el: HTMLElement, abc: string): void {
  if (!abcjs) return;
  abcjs.renderAbc(el, abc, {
    staffwidth: 150,
    paddingtop: 0,
    paddingbottom: 0,
    paddingleft: 0,
    paddingright: 0,
    responsive: 'resize',
  });
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export const NOTE_READING_DEF: ModeDefinition<Question> = {
  id: 'noteReading',
  name: 'Note Reading',
  namespace: 'noteReading',
  description: MODE_DESCRIPTIONS.noteReading,
  beforeAfter: MODE_BEFORE_AFTER.noteReading,
  itemNoun: 'notes',

  allItems: ALL_ITEMS,

  getQuestion,
  getPromptText: () => 'Name this note',
  checkAnswer: (q, input) => checkAnswer(q, input),

  buttons: { kind: 'piano-note', hideAccidentals: true },

  scope: {
    kind: 'groups',
    groups: GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'noteReading_enabledGroups',
    scopeLabel: 'Range',
    defaultEnabled: [0],
    formatLabel: (enabled) => {
      if (enabled.size === GROUPS.length) return 'all ranges';
      const labels = [...enabled].sort((a, b) => a - b)
        .map((g) => GROUPS[g].label);
      return labels.join(', ');
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
    notes: GRID_NOTES,
  },

  useController: () => useNoteReadingController(),
};

// ---------------------------------------------------------------------------
// Controller hook — abcjs staff rendering + immediate note-key submission
// ---------------------------------------------------------------------------

function useNoteReadingController(): ModeController<Question> {
  // Load abcjs on first use
  useEffect(() => {
    ensureAbcjs();
  }, []);

  // --- Staff ref ---
  const staffRef = useRef<HTMLDivElement>(null);

  // --- Keyboard handler (immediate submission, no accidentals) ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => false, // no accidentals — submit immediately on key press
      ),
    [],
  );

  // Re-render staff when question changes (ref may not be set on first render)
  const currentQRef = useRef<Question | null>(null);

  return {
    renderPrompt: (q: Question) => {
      currentQRef.current = q;
      // Schedule staff render after Preact commits the ref
      requestAnimationFrame(() => {
        if (staffRef.current && currentQRef.current) {
          renderStaff(staffRef.current, currentQRef.current.abc);
        }
      });
      return <div class='staff-display' ref={staffRef} />;
    },

    onStart: () => noteHandler.reset(),
    onStop: () => {
      noteHandler.reset();
      if (staffRef.current) staffRef.current.textContent = '';
    },

    handleKey: (e, ctx) => {
      engineSubmitRef.current = ctx.submitAnswer;
      return noteHandler.handleKey(e);
    },

    deactivateCleanup: () => noteHandler.reset(),
  };
}
