// Pure answer-checking and input utilities for the declarative mode system.
// No JSX or Preact — all functions are stateless.

import {
  displayNote,
  intervalMatchesInput,
  INTERVALS,
  resolveNoteInput,
  spelledNoteMatchesSemitone,
} from '../music-data.ts';
import type { KeyboardHintType } from '../ui/quiz-ui.tsx';

import type {
  AnswerSpec,
  ButtonsDef,
  ComparisonStrategy,
  ModeDefinition,
} from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getHintType(buttons: ButtonsDef): KeyboardHintType {
  switch (buttons.kind) {
    case 'note':
    case 'split-note':
      return 'note';
    case 'number':
      return buttons.start === 0 ? 'number-0-11' : 'number-1-12';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Answer specification helpers
// ---------------------------------------------------------------------------

export function resolveAnswerSpec<Q>(
  def: ModeDefinition<Q>,
  q: Q,
): AnswerSpec<Q> {
  const spec = def.answer!;
  if ('kind' in spec && spec.kind === 'bidirectional') {
    const dir = def.getDirection!(q);
    return dir === 'fwd' ? spec.fwd : spec.rev;
  }
  return spec as AnswerSpec<Q>;
}

export function checkCorrectness(
  strategy: ComparisonStrategy,
  expected: string,
  input: string,
): boolean {
  switch (strategy) {
    case 'exact':
      return input === expected;
    case 'integer':
      return parseInt(input, 10) === parseInt(expected, 10);
    case 'note-enharmonic': {
      const resolved = resolveNoteInput(input) ?? input;
      return spelledNoteMatchesSemitone(expected, resolved);
    }
    case 'interval': {
      const iv = INTERVALS.find((i) => i.abbrev === expected);
      return iv ? intervalMatchesInput(iv, input) : false;
    }
  }
}

export function toButtonValue(
  strategy: ComparisonStrategy,
  value: string,
): string {
  if (strategy === 'note-enharmonic') return resolveNoteInput(value) ?? value;
  return value;
}

export function defaultDisplayAnswer(
  strategy: ComparisonStrategy,
  expected: string,
): string {
  return strategy === 'note-enharmonic' ? displayNote(expected) : expected;
}

export function checkGenericAnswer<Q>(
  def: ModeDefinition<Q>,
  currentQRef: { current: Q | null },
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  },
  isSequential: boolean,
  isMultiTap: boolean,
  _itemId: string,
  input: string,
): { correct: boolean; correctAnswer: string } {
  // Both sequential and multiTap use the same sentinel format.
  if (isSequential || isMultiTap) {
    const sep = input.indexOf(':');
    return {
      correct: input.startsWith('__correct__'),
      correctAnswer: sep >= 0 ? input.slice(sep + 1) : '',
    };
  }
  const q = currentQRef.current!;
  const spec = resolveAnswerSpec(def, q);
  const expected = spec.getExpectedValue(q);
  const normalized = spec.normalizeInput?.(input) ?? input;
  const correct = checkCorrectness(spec.comparison, expected, normalized);
  const display = spec.getDisplayAnswer?.(q) ??
    defaultDisplayAnswer(spec.comparison, expected);
  lastAnswerRef.current = {
    expected,
    comparison: spec.comparison,
    normalizedInput: normalized,
  };
  return { correct, correctAnswer: display };
}

export function getInputPlaceholder<Q>(
  def: ModeDefinition<Q>,
  currentQ: Q | null,
  isSequential: boolean,
): string | undefined {
  if (isSequential) {
    const seq = def.sequential!;
    if (!seq.batchPlaceholder) return undefined;
    return typeof seq.batchPlaceholder === 'string'
      ? seq.batchPlaceholder
      : currentQ
      ? seq.batchPlaceholder(currentQ)
      : undefined;
  }
  if (!def.inputPlaceholder) return undefined;
  return typeof def.inputPlaceholder === 'string'
    ? def.inputPlaceholder
    : currentQ
    ? def.inputPlaceholder(currentQ)
    : undefined;
}
