// SpeedCheck + BaselineInfo — standalone calibration component.
// SpeedCheck owns the full calibration lifecycle: intro → trial loop → results.
// BaselineInfo shows the baseline in the progress tab with a run/rerun button.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { NoteButtons } from './buttons.tsx';
import {
  getCalibrationThresholds,
  pickCalibrationButton,
} from '../quiz-engine.ts';
import { computeMedian } from '../adaptive.ts';

// ---------------------------------------------------------------------------
// Provider type
// ---------------------------------------------------------------------------

/** Describes a speed check interaction type for measuring motor baseline. */
export type SpeedCheckProvider = {
  /** Provider key for localStorage (e.g., "button"). */
  key: string;
  /** Intro explanation text shown before trials start. */
  introText: string;
  /** Instruction text shown during trials. */
  trialText: string;
};

/** Default button-highlight provider: tap the green button as fast as you can. */
export const BUTTON_PROVIDER: SpeedCheckProvider = {
  key: 'button',
  introText: 'Tap the highlighted button as quickly as you can. ' +
    'This measures your base response time so the app can set ' +
    'accurate timing thresholds.',
  trialText: 'Tap the green button!',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_TRIALS = 10;
const WARMUP_TRIALS = 2;
const PAUSE_MS = 400;

// ---------------------------------------------------------------------------
// BaselineInfo — progress tab inline component
// ---------------------------------------------------------------------------

/**
 * Shows the motor baseline in the progress tab with a run/rerun button.
 * If no baseline exists, shows "Using default: 1s" with "Run speed check".
 * If baseline exists, shows "Response time baseline: Xs" with "Rerun speed check".
 */
export function BaselineInfo(
  { baseline, onRun }: {
    baseline: number | null;
    onRun: () => void;
  },
) {
  const value = baseline ? (baseline / 1000).toFixed(1) + 's' : '1s';
  const tag = baseline ? null : (
    <>
      {' '}
      <span class='baseline-default-tag'>(default)</span>
    </>
  );
  const btnLabel = baseline ? 'Rerun speed check' : 'Run speed check';
  return (
    <div class='baseline-info'>
      <div class='baseline-text'>
        Your tap speed baseline is {value}
        {tag}. Speed and recall estimates are based on this.
      </div>
      <button
        type='button'
        tabIndex={0}
        class='baseline-rerun-btn'
        onClick={onRun}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpeedCheck — full calibration lifecycle component
// ---------------------------------------------------------------------------

/**
 * Self-contained speed check (calibration) component.
 * Manages intro → trial loop → results internally.
 * Renders NoteButtons for trials and handles click + keyboard input.
 *
 * @param provider   Provider config (intro/trial text).
 * @param onComplete Called with the computed baseline (ms) when done.
 * @param onCancel   Called when the user cancels (Escape key).
 */
export function SpeedCheck(
  { provider, onComplete, onCancel }: {
    provider: SpeedCheckProvider;
    onComplete: (baseline: number) => void;
    onCancel: () => void;
  },
) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'results'>('intro');
  const [baseline, setBaseline] = useState(0);
  const [trialProgress, setTrialProgress] = useState('');
  const buttonsRef = useRef<HTMLDivElement>(null);
  const trialRef = useRef({
    active: false,
    trialIndex: 0,
    startTime: 0,
    times: [] as number[],
    prevBtn: null as HTMLElement | null,
    targetNote: null as string | null,
    trialTimeout: null as number | null,
  });

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      trialRef.current.active = false;
      if (trialRef.current.trialTimeout) {
        clearTimeout(trialRef.current.trialTimeout);
      }
    };
  }, []);

  // --- Present next trial ---
  const presentNextTrial = useCallback(() => {
    const state = trialRef.current;
    if (!state.active || !buttonsRef.current) return;

    const buttons = Array.from(
      buttonsRef.current.querySelectorAll<HTMLElement>('.answer-btn-note'),
    );
    if (buttons.length === 0) return;

    // Remove previous highlight.
    for (
      const el of buttonsRef.current.querySelectorAll('.calibration-target')
    ) {
      el.classList.remove('calibration-target');
    }

    // Pick next target (weighted ~35% toward accidentals).
    const btn = pickCalibrationButton(buttons, state.prevBtn);
    btn.classList.add('calibration-target');
    state.prevBtn = btn;
    state.targetNote = btn.dataset.note || null;
    state.startTime = performance.now();

    setTrialProgress((state.trialIndex + 1) + ' / ' + TOTAL_TRIALS);
  }, []);

  // --- Handle trial response (click or keyboard) ---
  const handleTrialResponse = useCallback((note: string) => {
    const state = trialRef.current;
    if (!state.active || !state.targetNote) return;
    if (note !== state.targetNote) return; // Wrong button — ignore.

    const elapsed = performance.now() - state.startTime;

    // Skip warmup trials (first 2).
    if (state.trialIndex >= WARMUP_TRIALS) {
      state.times.push(elapsed);
    }

    state.trialIndex++;
    state.targetNote = null;

    // Remove highlight.
    if (buttonsRef.current) {
      for (
        const el of buttonsRef.current.querySelectorAll('.calibration-target')
      ) {
        el.classList.remove('calibration-target');
      }
    }

    if (state.trialIndex >= TOTAL_TRIALS) {
      // All trials done — compute median baseline.
      state.active = false;
      const median = computeMedian(state.times) ?? 500;
      setBaseline(Math.round(median));
      setPhase('results');
    } else {
      // Pause before next trial.
      state.trialTimeout = setTimeout(
        () => presentNextTrial(),
        PAUSE_MS,
      ) as unknown as number;
    }
  }, [presentNextTrial]);

  // --- Keyboard: Escape to cancel; note keys during trials ---
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape cancels at any point.
      if (e.key === 'Escape') {
        e.preventDefault();
        trialRef.current.active = false;
        if (trialRef.current.trialTimeout) {
          clearTimeout(trialRef.current.trialTimeout);
        }
        onCancel();
        return;
      }

      if (phase !== 'running') return;

      const state = trialRef.current;
      if (!state.active || !state.targetNote) return;

      // Match the base letter of the target note. For calibration we skip
      // the accidental delay — pressing 'C' matches both C and C#. This
      // gives an accurate motor-speed measurement.
      const key = e.key.toUpperCase();
      if (key === state.targetNote[0]) {
        e.preventDefault();
        handleTrialResponse(state.targetNote);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, handleTrialResponse, onCancel]);

  // --- Start trials when phase becomes 'running' ---
  useEffect(() => {
    if (phase !== 'running') return;

    const state = trialRef.current;
    state.active = true;
    state.trialIndex = 0;
    state.startTime = 0;
    state.times = [];
    state.prevBtn = null;
    state.targetNote = null;

    // Small delay to let buttons render before first trial.
    const timeout = setTimeout(() => presentNextTrial(), 300);
    return () => {
      clearTimeout(timeout);
      state.active = false;
      if (state.trialTimeout) clearTimeout(state.trialTimeout);
    };
  }, [phase, presentNextTrial]);

  // --- Render: Intro ---
  if (phase === 'intro') {
    return (
      <div class='calibration-results'>
        <p>{provider.introText}</p>
        <button
          type='button'
          tabIndex={0}
          class='calibration-action-btn'
          onClick={() => setPhase('running')}
        >
          Start
        </button>
      </div>
    );
  }

  // --- Render: Running (trial loop) ---
  if (phase === 'running') {
    return (
      <div>
        <div class='quiz-prompt'>{provider.trialText}</div>
        <div ref={buttonsRef}>
          <NoteButtons
            onAnswer={handleTrialResponse}
            calibrationActive
          />
        </div>
        <div class='calibration-progress'>{trialProgress}</div>
      </div>
    );
  }

  // --- Render: Results ---
  const thresholds = getCalibrationThresholds(baseline);
  return (
    <div class='calibration-results'>
      <div class='calibration-baseline'>
        Your baseline: {(baseline / 1000).toFixed(2)}s
      </div>
      <table class='calibration-thresholds'>
        <thead>
          <tr>
            <th>Level</th>
            <th>Max time</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((t) => (
            <tr key={t.label}>
              <td>{t.label}</td>
              <td>
                {
                  t.maxMs !== null
                    ? (t.maxMs / 1000).toFixed(1) + 's'
                    : '\u2014' /* \u2014 = — (em dash) */
                }
              </td>
              <td>{t.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type='button'
        tabIndex={0}
        class='calibration-action-btn'
        onClick={() => onComplete(baseline)}
      >
        Done
      </button>
    </div>
  );
}
