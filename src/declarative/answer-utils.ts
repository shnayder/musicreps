// Pure answer-checking and input utilities for the declarative mode system.
// No JSX or Preact — all functions are stateless.

import {
  displayNote,
  intervalMatchesInput,
  INTERVALS,
  resolveNoteInput,
  spelledNoteMatchesSemitone,
  spelledNoteToCanonical,
} from '../music-data.ts';

import type {
  AnswerSpec,
  ComparisonStrategy,
  SkillDefinition,
} from './types.ts';

// ---------------------------------------------------------------------------
// Answer specification helpers
// ---------------------------------------------------------------------------

export function resolveAnswerSpec<Q>(
  def: SkillDefinition<Q>,
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
    case 'note-quality': {
      const [expectedNote, expectedQuality] = expected.split(':');
      const [inputNote, inputQuality] = input.split(':');
      if (!inputNote || !inputQuality) return false;
      const resolved = resolveNoteInput(inputNote) ?? inputNote;
      return spelledNoteMatchesSemitone(expectedNote, resolved) &&
        inputQuality === expectedQuality;
    }
  }
}

export function toButtonValue(
  strategy: ComparisonStrategy,
  value: string,
): string {
  if (strategy === 'note-enharmonic') {
    // resolveNoteInput only knows single accidentals; fall back to
    // spelledNoteToCanonical so doubles like "F##" highlight their
    // enharmonic-natural button ("G").
    return resolveNoteInput(value) ?? spelledNoteToCanonical(value);
  }
  if (strategy === 'note-quality') {
    const [note, quality] = value.split(':');
    const canonical = resolveNoteInput(note) ?? spelledNoteToCanonical(note);
    return canonical + ':' + quality;
  }
  return value;
}

export function defaultDisplayAnswer(
  strategy: ComparisonStrategy,
  expected: string,
): string {
  if (strategy === 'note-enharmonic') return displayNote(expected);
  if (strategy === 'note-quality') {
    const [note, quality] = expected.split(':');
    const label = quality === 'major'
      ? 'Major'
      : quality === 'minor'
      ? 'Minor'
      : 'Dim';
    return displayNote(note) + ' ' + label;
  }
  return expected;
}

export function checkGenericAnswer<Q>(
  def: SkillDefinition<Q>,
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

/** Resolve a group label that may be a string or a function. */
export function resolveGroupLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

export function getInputPlaceholder<Q>(
  def: SkillDefinition<Q>,
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
