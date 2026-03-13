// useSequentialInput — handles multi-input sequential quiz modes.
// Manages the array of entries, evaluates all at once after the last input,
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
  const [seqCorrectAnswer, setSeqCorrectAnswer] = useState('');
  const prevItemRef = useRef<string | null>(null);

  const resetAll = useCallback(() => {
    seqEntriesRef.current = [];
    setSeqEntries([]);
    setSeqEvaluated(null);
    setSeqCorrectAnswer('');
  }, []);

  const handleSeqInput = useCallback((input: string) => {
    if (!def.sequential || !currentQRef.current) return;
    const q = currentQRef.current;
    const expected = def.sequential.expectedCount(q);
    const raw = seqEntriesRef.current;
    if (raw.length >= expected) return;

    const newRaw = [...raw, input];
    seqEntriesRef.current = newRaw;
    setSeqEntries(newRaw.map((r) => ({ display: displayNote(r) })));

    if (newRaw.length === expected) {
      const result = def.sequential.evaluate(q, newRaw);
      setSeqEvaluated(result.perEntry);
      setSeqCorrectAnswer(result.correctAnswer);
      const sentinel = result.correct ? '__correct__' : '__wrong__';
      submitRef.current(sentinel + ':' + result.correctAnswer);
    }
  }, [def]);

  const handleSeqBatch = useCallback((text: string): boolean => {
    if (!def.sequential?.parseBatchInput || !currentQRef.current) return false;
    const q = currentQRef.current;
    const notes = def.sequential.parseBatchInput(text);
    const expected = def.sequential.expectedCount(q);
    if (notes.length !== expected) return false;

    seqEntriesRef.current = notes;
    setSeqEntries(notes.map((r) => ({ display: displayNote(r) })));

    const result = def.sequential.evaluate(q, notes);
    setSeqEvaluated(result.perEntry);
    setSeqCorrectAnswer(result.correctAnswer);
    const sentinel = result.correct ? '__correct__' : '__wrong__';
    submitRef.current(sentinel + ':' + result.correctAnswer);
    return true;
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
    resetOnItemChange,
  };
}
