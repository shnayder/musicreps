// SpeedCheck + BaselineInfo — standalone calibration component.
// SpeedCheck owns the full calibration lifecycle: intro → trial loop → results.
// BaselineInfo shows the baseline in the progress tab with a run/rerun button.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type ButtonFeedback, NoteButtons } from './buttons.tsx';
import {
  getCalibrationThresholds,
  pickCalibrationNote,
} from '../quiz-engine.ts';
import { computeMedian } from '../adaptive.ts';
import type { MotorTaskType, SpeedCheckFixture } from '../types.ts';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import { KeyboardHint } from './quiz-ui.tsx';
import { resolveNoteInput } from '../music-data.ts';

// ---------------------------------------------------------------------------
// Motor task configuration
// ---------------------------------------------------------------------------

export type MotorTaskConfig = {
  taskType: MotorTaskType;
  introTitle: string;
  introText: string;
  trialPrompt: (answer: string) => string;
  generateAnswer: (prev: string | null, rng?: () => number) => string;
  /** Check if raw user input matches the expected answer. */
  checkAnswer: (input: string, expected: string) => boolean;
  label: string;
};

function noteAnswerMatches(input: string, expected: string): boolean {
  if (input === expected) return true;
  const resolved = resolveNoteInput(input);
  return resolved === expected;
}

export const NOTE_BUTTON_CONFIG: MotorTaskConfig = {
  taskType: 'note-button',
  introTitle: 'Measuring note button entry times',
  introText:
    'We\u2019ll show you the answer \u2014 enter it as fast as you can. ' +
    'This measures your entry speed so the app can set personalized timing ' +
    'targets. 10 quick trials.',
  trialPrompt: (note) => `Press ${note}`,
  generateAnswer: pickCalibrationNote,
  checkAnswer: noteAnswerMatches,
  label: 'note button entry',
};

/** Set of task types that have a speed check config. */
export const IMPLEMENTED_TASK_TYPES: ReadonlySet<MotorTaskType> = new Set([
  'note-button',
]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_TRIALS = 10;
const WARMUP_TRIALS = 2;
const PAUSE_MS = 400;
const WRONG_FEEDBACK_MS = 300;

// ---------------------------------------------------------------------------
// CloseButton — reusable close button with proper touch target
// ---------------------------------------------------------------------------

function CloseButton(
  { onClick, label = 'Close' }: { onClick: () => void; label?: string },
) {
  return (
    <button
      type='button'
      tabIndex={0}
      class='quiz-header-close'
      aria-label={label}
      onClick={onClick}
    >
      {'\u00D7'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SpeedCheckHeader — replaces QuizSession during speed check
// ---------------------------------------------------------------------------

function SpeedCheckHeader(
  { trialProgress, onClose }: { trialProgress?: string; onClose: () => void },
) {
  return (
    <div class='quiz-session'>
      <div class='quiz-session-header'>
        <div class='quiz-session-header-content'>
          <div class='speed-check-header-row'>
            <h1 class='mode-title'>Speed Check</h1>
            {trialProgress && (
              <span class='speed-check-header-progress'>
                {trialProgress}
              </span>
            )}
          </div>
        </div>
        <CloseButton onClick={onClose} label='Cancel speed check' />
      </div>
    </div>
  );
}

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
        <Text role='label'>Response time for note input</Text>
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
  prevAnswer: string | null;
  targetNote: string | null;
  trialTimeout: number | null;
};

function useTrialLoop(
  config: MotorTaskConfig,
  onDone: (median: number) => void,
) {
  const trialRef = useRef<TrialState>({
    active: false,
    trialIndex: 0,
    startTime: 0,
    times: [],
    prevAnswer: null,
    targetNote: null,
    trialTimeout: null,
  });
  const [trialProgress, setTrialProgress] = useState('');
  const [promptText, setPromptText] = useState('');
  const [feedback, setFeedback] = useState<ButtonFeedback | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    return () => {
      trialRef.current.active = false;
      if (trialRef.current.trialTimeout) {
        clearTimeout(trialRef.current.trialTimeout);
      }
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const presentNextTrial = useCallback(() => {
    const state = trialRef.current;
    if (!state.active) return;
    const answer = config.generateAnswer(state.prevAnswer);
    state.prevAnswer = answer;
    state.targetNote = answer;
    state.startTime = performance.now();
    setTrialProgress((state.trialIndex + 1) + ' / ' + TOTAL_TRIALS);
    setPromptText(config.trialPrompt(answer));
    setFeedback(null);
  }, [config]);

  const handleTrialResponse = useCallback((input: string) => {
    const state = trialRef.current;
    if (!state.active || !state.targetNote) return;
    // Ignore input while wrong-answer feedback is showing
    if (feedbackTimerRef.current) return;

    const buttonValue = resolveNoteInput(input) ?? input;

    if (!config.checkAnswer(input, state.targetNote)) {
      // Wrong answer: show feedback on the button, then regenerate
      setFeedback({
        correct: false,
        userInput: buttonValue,
        displayAnswer: state.targetNote,
      });
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null;
        // Regenerate a new trial at the same index
        presentNextTrial();
      }, WRONG_FEEDBACK_MS) as unknown as number;
      return;
    }

    // Correct answer
    const elapsed = performance.now() - state.startTime;
    if (state.trialIndex >= WARMUP_TRIALS) state.times.push(elapsed);
    state.trialIndex++;
    state.targetNote = null;
    setPromptText('');
    setFeedback(null);
    if (state.trialIndex >= TOTAL_TRIALS) {
      state.active = false;
      onDoneRef.current(computeMedian(state.times) ?? 500);
    } else {
      state.trialTimeout = setTimeout(
        () => presentNextTrial(),
        PAUSE_MS,
      ) as unknown as number;
    }
  }, [presentNextTrial, config]);

  const startTrials = useCallback(() => {
    const state = trialRef.current;
    state.active = true;
    state.trialIndex = 0;
    state.startTime = 0;
    state.times = [];
    state.prevAnswer = null;
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
    promptText,
    feedback,
    handleTrialResponse,
    startTrials,
    setTrialProgress,
    setPromptText,
  };
}

// ---------------------------------------------------------------------------
// SpeedCheckInput — text field for entering answers during trials
// ---------------------------------------------------------------------------

function SpeedCheckInput(
  { onSubmit, wrongFlash }: {
    onSubmit: (input: string) => void;
    wrongFlash: boolean;
  },
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      const value = inputRef.current?.value.trim() ?? '';
      if (!value) return;
      onSubmit(value);
      if (inputRef.current) inputRef.current.value = '';
    },
    [onSubmit],
  );

  let cls = 'answer-input';
  if (wrongFlash) cls += ' answer-input-wrong answer-input-shake';

  return (
    <input
      ref={inputRef}
      type='text'
      class={cls}
      placeholder='Type answer, press Enter'
      aria-label='Type answer, press Enter'
      onKeyDown={handleKeyDown}
      autoComplete='off'
      autoCorrect='off'
      spellcheck={false}
    />
  );
}

// ---------------------------------------------------------------------------
// SpeedCheckIntro — intro phase sub-component
// ---------------------------------------------------------------------------

function SpeedCheckIntro(
  { title, text, onStart }: {
    title: string;
    text: string;
    onStart: () => void;
  },
) {
  return (
    <>
      <div class='quiz-content calibration-results'>
        <Text role='section-header' as='h2'>{title}</Text>
        <p>{text}</p>
      </div>
      <div class='quiz-controls'>
        <ActionButton variant='primary' class='next-btn' onClick={onStart}>
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
        <Text role='section-header' as='h2'>Speed Check Complete</Text>
        <div class='calibration-baseline'>
          {(baseline / 1000).toFixed(2)}s
        </div>
        <table class='calibration-thresholds'>
          <thead>
            <tr>
              <th></th>
              <th>Level</th>
              <th>Max time</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.label}>
                <td>
                  <span
                    class='heatmap-swatch'
                    style={`background-color: var(${t.colorToken})`}
                  />
                </td>
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
          class='next-btn'
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
  { config, onComplete, onCancel, fixture }: {
    config: MotorTaskConfig;
    onComplete: (baseline: number) => void;
    onCancel: () => void;
    fixture?: SpeedCheckFixture;
  },
) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'results'>(
    fixture?.phase ?? 'intro',
  );
  const [baseline, setBaseline] = useState(fixture?.baseline ?? 0);

  const trials = useTrialLoop(config, (median) => {
    setBaseline(Math.round(median));
    setPhase('results');
  });

  // Apply fixture overrides to trial display state.
  useEffect(() => {
    if (fixture?.trialProgress) trials.setTrialProgress(fixture.trialProgress);
    if (fixture?.promptAnswer) {
      trials.setPromptText(config.trialPrompt(fixture.promptAnswer));
    }
  }, [fixture]);

  // Keyboard: Escape to cancel
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
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fixture, onCancel]);

  // Start trials when phase becomes 'running'
  useEffect(() => {
    if (fixture || phase !== 'running') return;
    return trials.startTrials();
  }, [fixture, phase, trials.startTrials]);

  if (phase === 'intro') {
    return (
      <>
        <SpeedCheckHeader onClose={onCancel} />
        <div class='quiz-area'>
          <SpeedCheckIntro
            title={config.introTitle}
            text={config.introText}
            onStart={() => setPhase('running')}
          />
        </div>
      </>
    );
  }

  if (phase === 'running') {
    return (
      <>
        <SpeedCheckHeader
          trialProgress={trials.trialProgress}
          onClose={onCancel}
        />
        <div class='quiz-area'>
          <div class='quiz-content'>
            <div class='quiz-prompt'>{trials.promptText}</div>
          </div>
          <div class='quiz-controls'>
            <NoteButtons
              onAnswer={trials.handleTrialResponse}
              feedback={trials.feedback}
            />
            <SpeedCheckInput
              onSubmit={trials.handleTrialResponse}
              wrongFlash={trials.feedback?.correct === false}
            />
            <KeyboardHint type='note' />
          </div>
        </div>
      </>
    );
  }

  return (
    <div class='quiz-area'>
      <SpeedCheckResults baseline={baseline} onComplete={onComplete} />
    </div>
  );
}
