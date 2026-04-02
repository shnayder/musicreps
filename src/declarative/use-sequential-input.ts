// useSequentialInput — handles multi-input sequential quiz modes.
// Manages the array of entries, evaluates on explicit Check action,
// and resets on question change.

import { useCallback, useRef, useState } from 'preact/hooks';
import { displayNote } from '../music-data.ts';
import type { ModeDefinition, SequentialEntryResult } from './types.ts';

export type SequentialInputHandle<Q> = {
  seqEntries: { display: string }[];
  seqEvaluated: SequentialEntryResult[] | null;
  seqCorrectAnswer: string;
  handleSeqInput: (input: string) => void;
  handleSeqBatch: (text: string) => boolean;
  /** Manually trigger evaluation of collected entries. */
  handleCheck: () => void;
  resetOnItemChange: (currentItemId: string | null) => void;
};

export function useSequentialInput<Q>(
  def: ModeDefinition<Q>,
  currentQRef: { current: Q | null },
  submitRef: { current: (input: string) => void },
): SequentialInputHandle<Q> {
  const [seqEntries, setSeqEntries] = useState<{ display: string }[]>([]);
  const seqEntriesRef = useRef<string[]>([]);
  const [seqEvaluated, setSeqEvaluated] = useState<
    SequentialEntryResult[] | null
  >(null);
  const seqEvaluatedRef = useRef<SequentialEntryResult[] | null>(null);
  const [seqCorrectAnswer, setSeqCorrectAnswer] = useState('');
  const prevItemRef = useRef<string | null>(null);

  const resetAll = useCallback(() => {
    seqEntriesRef.current = [];
    setSeqEntries([]);
    seqEvaluatedRef.current = null;
    setSeqEvaluated(null);
    setSeqCorrectAnswer('');
  }, []);

  const handleSeqInput = useCallback((input: string) => {
    if (!def.sequential || !currentQRef.current) return;
    // Don't accept more input after evaluation
    if (seqEvaluatedRef.current) return;

    const newRaw = [...seqEntriesRef.current, input];
    seqEntriesRef.current = newRaw;
    setSeqEntries(newRaw.map((r) => ({ display: displayNote(r) })));
  }, [def]);

  const handleSeqBatch = useCallback((text: string): boolean => {
    if (!def.sequential?.parseBatchInput || !currentQRef.current) return false;
    if (seqEvaluatedRef.current) return false; // already evaluated
    const notes = def.sequential.parseBatchInput(text);
    if (notes.length === 0) return false;

    // Replace entries with parsed batch, then immediately check
    seqEntriesRef.current = notes;
    setSeqEntries(notes.map((r) => ({ display: displayNote(r) })));

    const q = currentQRef.current;
    const result = def.sequential.evaluate(q, notes);
    seqEvaluatedRef.current = result.perEntry;
    setSeqEvaluated(result.perEntry);
    setSeqCorrectAnswer(result.correctAnswer);
    const sentinel = result.correct ? '__correct__' : '__wrong__';
    submitRef.current(sentinel + ':' + result.correctAnswer);
    return true;
  }, [def]);

  const handleCheck = useCallback(() => {
    if (!def.sequential || !currentQRef.current) return;
    if (seqEvaluatedRef.current) return; // already evaluated (e.g. double-click)
    const raw = seqEntriesRef.current;
    if (raw.length === 0) return;

    const q = currentQRef.current;
    const result = def.sequential.evaluate(q, raw);
    seqEvaluatedRef.current = result.perEntry;
    setSeqEvaluated(result.perEntry);
    setSeqCorrectAnswer(result.correctAnswer);
    const sentinel = result.correct ? '__correct__' : '__wrong__';
    submitRef.current(sentinel + ':' + result.correctAnswer);
  }, [def]);

  const resetOnItemChange = useCallback((currentItemId: string | null) => {
    if (currentItemId !== prevItemRef.current) {
      prevItemRef.current = currentItemId;
      resetAll();
    }
  }, [resetAll]);

  return {
    seqEntries,
    seqEvaluated,
    seqCorrectAnswer,
    handleSeqInput,
    handleSeqBatch,
    handleCheck,
    resetOnItemChange,
  };
}
