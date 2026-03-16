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
import type { SpeedCheckFixture } from '../types.ts';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// Provider type
// ---------------------------------------------------------------------------

export type SpeedCheckProvider = {
  key: string;
  introText: string;
  trialText: string;
};

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

export function BaselineInfo(
  { baseline, onRun }: { baseline: number | null; onRun: () => void },
) {
  const value = baseline ? (baseline / 1000).toFixed(1) + 's' : '1s';
  const tag = baseline
    ? null
    : <Text role='caption' class='baseline-default-tag'>(default)</Text>;
  const btnLabel = baseline ? 'Redo speed check' : 'Run speed check';
  return (
    <div class='baseline-info'>
      <Text role='subsection-header' as='div' class='baseline-header'>
        Speed check
      </Text>
      <div class='baseline-metric'>
        <Text role='label'>Response time</Text>
        <Text role='metric'>
          {value}
          {tag && <>{tag}</>}
        </Text>
      </div>
      <Text role='caption' as='div' class='baseline-explanation'>
        Timing thresholds are based on this measurement.
      </Text>
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
// Trial loop hook — manages the trial state machine
// ---------------------------------------------------------------------------

type TrialState = {
  active: boolean;
  trialIndex: number;
  startTime: number;
  times: number[];
  prevBtn: HTMLElement | null;
  targetNote: string | null;
  trialTimeout: number | null;
};

function useTrialLoop(
  buttonsRef: { current: HTMLDivElement | null },
  onDone: (median: number) => void,
) {
  const trialRef = useRef<TrialState>({
    active: false,
    trialIndex: 0,
    startTime: 0,
    times: [],
    prevBtn: null,
    targetNote: null,
    trialTimeout: null,
  });
  const [trialProgress, setTrialProgress] = useState('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    return () => {
      trialRef.current.active = false;
      if (trialRef.current.trialTimeout) {
        clearTimeout(trialRef.current.trialTimeout);
      }
    };
  }, []);

  const presentNextTrial = useCallback(() => {
    const state = trialRef.current;
    if (!state.active || !buttonsRef.current) return;
    const buttons = Array.from(
      buttonsRef.current.querySelectorAll<HTMLElement>('.answer-btn-note'),
    );
    if (buttons.length === 0) return;
    for (
      const el of buttonsRef.current.querySelectorAll('.calibration-target')
    ) {
      el.classList.remove('calibration-target');
    }
    const btn = pickCalibrationButton(buttons, state.prevBtn);
    btn.classList.add('calibration-target');
    state.prevBtn = btn;
    state.targetNote = btn.dataset.note || null;
    state.startTime = performance.now();
    setTrialProgress((state.trialIndex + 1) + ' / ' + TOTAL_TRIALS);
  }, []);

  const handleTrialResponse = useCallback((note: string) => {
    const state = trialRef.current;
    if (!state.active || !state.targetNote) return;
    if (note !== state.targetNote) return;
    const elapsed = performance.now() - state.startTime;
    if (state.trialIndex >= WARMUP_TRIALS) state.times.push(elapsed);
    state.trialIndex++;
    state.targetNote = null;
    if (buttonsRef.current) {
      for (
        const el of buttonsRef.current.querySelectorAll('.calibration-target')
      ) {
        el.classList.remove('calibration-target');
      }
    }
    if (state.trialIndex >= TOTAL_TRIALS) {
      state.active = false;
      onDoneRef.current(computeMedian(state.times) ?? 500);
    } else {
      state.trialTimeout = setTimeout(
        () => presentNextTrial(),
        PAUSE_MS,
      ) as unknown as number;
    }
  }, [presentNextTrial]);

  const startTrials = useCallback(() => {
    const state = trialRef.current;
    state.active = true;
    state.trialIndex = 0;
    state.startTime = 0;
    state.times = [];
    state.prevBtn = null;
    state.targetNote = null;
    const timeout = setTimeout(() => presentNextTrial(), 300);
    return () => {
      clearTimeout(timeout);
      state.active = false;
      if (state.trialTimeout) clearTimeout(state.trialTimeout);
    };
  }, [presentNextTrial]);

  return {
    trialRef,
    trialProgress,
    handleTrialResponse,
    startTrials,
    setTrialProgress,
  };
}

// ---------------------------------------------------------------------------
// SpeedCheckIntro — intro phase sub-component
// ---------------------------------------------------------------------------

function SpeedCheckIntro(
  { text, onStart }: { text: string; onStart: () => void },
) {
  return (
    <>
      <div class='quiz-content calibration-results'>
        <p>{text}</p>
      </div>
      <div class='quiz-controls'>
        <ActionButton
          variant='primary'
          class='calibration-action-btn'
          onClick={onStart}
        >
          Start
        </ActionButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SpeedCheckResults — results phase sub-component
// ---------------------------------------------------------------------------

function SpeedCheckResults(
  { baseline, onComplete }: {
    baseline: number;
    onComplete: (baseline: number) => void;
  },
) {
  const thresholds = getCalibrationThresholds(baseline);
  return (
    <>
      <div class='quiz-content calibration-results'>
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
                  {t.maxMs !== null
                    ? (t.maxMs / 1000).toFixed(1) + 's'
                    : '\u2014'}
                </td>
                <td>{t.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class='quiz-controls'>
        <ActionButton
          variant='primary'
          class='calibration-action-btn'
          onClick={() => onComplete(baseline)}
        >
          Done
        </ActionButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SpeedCheck — full calibration lifecycle component
// ---------------------------------------------------------------------------

export function SpeedCheck(
  { provider, onComplete, onCancel, fixture }: {
    provider: SpeedCheckProvider;
    onComplete: (baseline: number) => void;
    onCancel: () => void;
    fixture?: SpeedCheckFixture;
  },
) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'results'>(
    fixture?.phase ?? 'intro',
  );
  const [baseline, setBaseline] = useState(fixture?.baseline ?? 0);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const trials = useTrialLoop(buttonsRef, (median) => {
    setBaseline(Math.round(median));
    setPhase('results');
  });

  if (fixture?.trialProgress) trials.setTrialProgress(fixture.trialProgress);

  // Keyboard: Escape to cancel; note keys during trials
  useEffect(() => {
    if (fixture) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        trials.trialRef.current.active = false;
        if (trials.trialRef.current.trialTimeout) {
          clearTimeout(trials.trialRef.current.trialTimeout);
        }
        onCancel();
        return;
      }
      if (phase !== 'running') return;
      const state = trials.trialRef.current;
      if (!state.active || !state.targetNote) return;
      const key = e.key.toUpperCase();
      if (key === state.targetNote[0]) {
        e.preventDefault();
        trials.handleTrialResponse(state.targetNote);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fixture, phase, trials.handleTrialResponse, onCancel]);

  // Start trials when phase becomes 'running'
  useEffect(() => {
    if (fixture || phase !== 'running') return;
    return trials.startTrials();
  }, [fixture, phase, trials.startTrials]);

  // Fixture: highlight target button for 'running' screenshots
  useEffect(() => {
    if (!fixture || fixture.phase !== 'running' || !fixture.targetNote) return;
    if (!buttonsRef.current) return;
    const btn = buttonsRef.current.querySelector(
      `.answer-btn-note[data-note="${fixture.targetNote}"]`,
    ) as HTMLElement | null;
    if (btn) btn.classList.add('calibration-target');
    return () => {
      if (btn) btn.classList.remove('calibration-target');
    };
  }, [fixture]);

  if (phase === 'intro') {
    return (
      <SpeedCheckIntro
        text={provider.introText}
        onStart={() => setPhase('running')}
      />
    );
  }

  if (phase === 'running') {
    return (
      <>
        <div class='quiz-content'>
          <div class='quiz-prompt'>{provider.trialText}</div>
        </div>
        <div class='quiz-controls'>
          <div ref={buttonsRef}>
            <NoteButtons
              onAnswer={trials.handleTrialResponse}
              calibrationActive
            />
          </div>
          <div class='calibration-progress'>{trials.trialProgress}</div>
        </div>
      </>
    );
  }

  return <SpeedCheckResults baseline={baseline} onComplete={onComplete} />;
}
