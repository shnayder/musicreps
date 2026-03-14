// useRoundTimer — manages the round countdown timer.
// Extracted from useQuizEngine for clarity and testability.
//
// Override duration with ?roundMs=N in the URL (useful for manual testing
// and E2E tests). Falls back to the default 60 seconds.

import { useCallback, useRef, useState } from 'preact/hooks';

export const ROUND_DURATION_MS = 60000;
const TIMER_TICK_MS = 200;
export const LAST_QUESTION_CAP_MS = 30000;

/** Read ?roundMs=N from the URL, if present and valid. */
function getEffectiveRoundMs(): number {
  if (typeof globalThis.location === 'undefined') return ROUND_DURATION_MS;
  const p = new URLSearchParams(globalThis.location.search).get('roundMs');
  if (!p) return ROUND_DURATION_MS;
  const n = parseInt(p, 10);
  return n > 0 ? n : ROUND_DURATION_MS;
}

export const effectiveRoundMs = getEffectiveRoundMs();

function formatRoundTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + ':' + (sec < 10 ? '0' : '') + sec;
}

export type RoundTimerHandle = {
  timerPct: number;
  timerText: string;
  timerWarning: boolean;
  timerLastQuestion: boolean;
  setTimerPct: (v: number) => void;
  setTimerText: (v: string) => void;
  setTimerWarning: (v: boolean) => void;
  setTimerLastQuestion: (v: boolean) => void;
  roundTimerStartRef: { current: number | null };
  roundDurationSnapshotRef: { current: number | null };
  lastQuestionCapRef: { current: number | null };
  startRoundTimer: () => void;
  stopRoundTimer: () => void;
};

export function useRoundTimer(
  onExpiry: () => void,
): RoundTimerHandle {
  const [timerPct, setTimerPct] = useState(100);
  const [timerText, setTimerText] = useState('');
  const [timerWarning, setTimerWarning] = useState(false);
  const [timerLastQuestion, setTimerLastQuestion] = useState(false);

  const roundTimerRef = useRef<number | null>(null);
  const roundTimerStartRef = useRef<number | null>(null);
  const roundDurationSnapshotRef = useRef<number | null>(null);
  const lastQuestionCapRef = useRef<number | null>(null);
  const onExpiryRef = useRef(onExpiry);
  onExpiryRef.current = onExpiry;

  const stopRoundTimer = useCallback(() => {
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (lastQuestionCapRef.current) {
      clearTimeout(lastQuestionCapRef.current);
      lastQuestionCapRef.current = null;
    }
    roundTimerStartRef.current = null;
    setTimerPct(100);
    setTimerText('');
    setTimerWarning(false);
    setTimerLastQuestion(false);
  }, []);

  const startRoundTimer = useCallback(() => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerStartRef.current = Date.now();
    roundDurationSnapshotRef.current = null;

    setTimerPct(100);
    setTimerText(formatRoundTime(effectiveRoundMs));
    setTimerWarning(false);
    setTimerLastQuestion(false);

    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundTimerStartRef.current!;
      const remaining = effectiveRoundMs - elapsed;
      const pct = Math.max(0, (remaining / effectiveRoundMs) * 100);

      setTimerPct(pct);
      setTimerText(formatRoundTime(remaining));
      setTimerWarning(remaining <= 10000 && remaining > 0);

      if (remaining <= 0) {
        if (roundTimerRef.current) clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;
        setTimerPct(0);
        setTimerText('0:00');
        setTimerWarning(false);
        onExpiryRef.current();
      }
    }, TIMER_TICK_MS);
  }, []);

  return {
    timerPct,
    timerText,
    timerWarning,
    timerLastQuestion,
    setTimerPct,
    setTimerText,
    setTimerWarning,
    setTimerLastQuestion,
    roundTimerStartRef,
    roundDurationSnapshotRef,
    lastQuestionCapRef,
    startRoundTimer,
    stopRoundTimer,
  };
}
