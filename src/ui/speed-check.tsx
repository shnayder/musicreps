// SpeedCheck — standalone calibration component.
// Owns the full calibration lifecycle: intro → trial loop → results.
// BaselineInfo (progress tab inline display) lives in skill-screen.tsx.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { type ButtonFeedback, NoteButtons } from './buttons.tsx';
import {
  CALIBRATION_MAX_FRET,
  pickCalibrationFretPosition,
  pickCalibrationNote,
} from '../quiz-engine.ts';
import { SpeedThresholdTable } from './speed-level-legend.tsx';
import { computeMedian } from '../adaptive.ts';
import type { MotorTaskType, SpeedCheckFixture } from '../types.ts';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import { KeyboardHint } from './quiz-ui.tsx';
import { isValidNoteInput, resolveNoteInput } from '../music-data.ts';
import { InteractiveFretboard } from './interactive-fretboard.tsx';
import { ScreenHeader } from './skill-screen.tsx';
import {
  CenteredContent,
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  QuizStage,
  ScreenLayout,
} from './screen-layout.tsx';

// ---------------------------------------------------------------------------
// Motor task configuration
// ---------------------------------------------------------------------------

type BaseMotorTaskConfig = {
  taskType: MotorTaskType;
  introTitle: string;
  introText: string;
  trialPrompt: (answer: string) => string;
  generateAnswer: (prev: string | null, rng?: () => number) => string;
  /** Check if raw user input matches the expected answer. */
  checkAnswer: (input: string, expected: string) => boolean;
  label: string;
};

/** NoteButtons + text input. Answer is a note name. */
export type TextMotorTaskConfig = BaseMotorTaskConfig & { variant: 'text' };

/** InteractiveFretboard with a pulsing target. Answer is a "string-fret" key.
 *  stringCount is required so guitar vs. ukulele can't be silently defaulted. */
export type FretboardMotorTaskConfig = BaseMotorTaskConfig & {
  variant: 'fretboard';
  stringCount: number;
};

export type MotorTaskConfig = TextMotorTaskConfig | FretboardMotorTaskConfig;

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
  variant: 'text',
};

/** Build a fretboard-tap calibration config for the given instrument. */
export function makeFretboardTapConfig(stringCount: number): MotorTaskConfig {
  return {
    taskType: 'fretboard-tap',
    introTitle: 'Measuring fret tap times',
    introText:
      'We\u2019ll highlight a fret \u2014 tap it as fast as you can. ' +
      'This measures your fretboard tap speed so the app can set personalized ' +
      'timing targets. 10 quick trials.',
    // Fretboard variant doesn't use text prompt — the dot is the prompt.
    trialPrompt: () => '',
    generateAnswer: (prev, rng) =>
      pickCalibrationFretPosition(prev, stringCount, rng),
    checkAnswer: (input, expected) => input === expected,
    label: 'fret tap',
    variant: 'fretboard',
    stringCount,
  };
}

/** Set of task types that have a speed check config. */
export const IMPLEMENTED_TASK_TYPES: ReadonlySet<MotorTaskType> = new Set([
  'note-button',
  'fretboard-tap',
]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_TRIALS = 10;
const WARMUP_TRIALS = 2;
const PAUSE_MS = 400;
const WRONG_FEEDBACK_MS = 800;

// ---------------------------------------------------------------------------
// SpeedCheckHeader — chrome bar with label, optional count, and close button
// ---------------------------------------------------------------------------

function SpeedCheckHeader(
  { count, onClose }: { count?: string; onClose: () => void },
) {
  return (
    <LayoutHeader>
      <ScreenHeader
        title='Speed Check'
        onClose={onClose}
        closeAriaLabel='Cancel speed check'
        right={count ? <Text role='metric-info'>{count}</Text> : undefined}
      />
    </LayoutHeader>
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
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
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
    setCurrentTarget(answer);
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
      setPromptText('\u2717');
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
    setPromptText('\u2713');
    setCurrentTarget(null);
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
    currentTarget,
    feedback,
    handleTrialResponse,
    startTrials,
    setTrialProgress,
    setPromptText,
    setCurrentTarget,
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
  const [shake, setShake] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setShake(false);
      shakeTimerRef.current = null;
    }, 400);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      const value = inputRef.current?.value.trim() ?? '';
      if (!value || !isValidNoteInput(value)) {
        triggerShake();
        return;
      }
      onSubmit(value);
      if (inputRef.current) inputRef.current.value = '';
    },
    [onSubmit, triggerShake],
  );

  let cls = 'answer-input';
  if (wrongFlash) cls += ' answer-input-wrong answer-input-shake';
  else if (shake) cls += ' answer-input-shake';

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
// FretboardSpeedCheckTarget — fretboard-tap variant of the trial prompt.
// Renders an InteractiveFretboard with the target fret highlighted; taps are
// forwarded to the trial loop as "string-fret" position keys. Rendered in
// the prompt slot so the 70/30 fretboard layout rule kicks in.
// ---------------------------------------------------------------------------

const EMPTY_POSITION_SET: ReadonlySet<string> = new Set<string>();

function FretboardSpeedCheckTarget(
  { stringCount, targetPosition, wrongTapPosition, onTap }: {
    stringCount: number;
    targetPosition: string | null;
    wrongTapPosition: string | null;
    onTap: (positionKey: string) => void;
  },
) {
  // Show frets 0..CALIBRATION_MAX_FRET only — matches the region we sample
  // targets from so the user's attention stays near the nut.
  const fretCount = useMemo(() => CALIBRATION_MAX_FRET + 1, []);
  return (
    <InteractiveFretboard
      onTap={onTap}
      tappedPositions={EMPTY_POSITION_SET}
      evaluated={null}
      stringCount={stringCount}
      fretCount={fretCount}
      targetPosition={targetPosition}
      wrongTapPosition={wrongTapPosition}
    />
  );
}

// ---------------------------------------------------------------------------
// SpeedCheckIntro — intro phase sub-component
// ---------------------------------------------------------------------------

function SpeedCheckIntro(
  { title, text }: {
    title: string;
    text: string;
  },
) {
  return (
    <div class='calibration-results'>
      <Text role='heading-section' as='h2'>{title}</Text>
      <p>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpeedCheckResults — results phase sub-component
// ---------------------------------------------------------------------------

function SpeedCheckResults(
  { baseline }: { baseline: number },
) {
  return (
    <div class='calibration-results'>
      <Text role='heading-page' as='h2'>Speed Check Complete</Text>
      <SpeedThresholdTable baseline={baseline} />
    </div>
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
      // Fretboard variant: promptAnswer is a "string-fret" key; drive the
      // pulsing target dot from it so fixtures render the same as live trials.
      if (config.variant === 'fretboard') {
        trials.setCurrentTarget(fixture.promptAnswer);
      }
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
      <ScreenLayout>
        <SpeedCheckHeader onClose={onCancel} />
        <LayoutMain scrollable={false}>
          <CenteredContent>
            <SpeedCheckIntro
              title={config.introTitle}
              text={config.introText}
            />
          </CenteredContent>
        </LayoutMain>
        <LayoutFooter>
          <ActionButton
            variant='primary'
            class='next-btn'
            onClick={() => setPhase('running')}
          >
            Start
          </ActionButton>
        </LayoutFooter>
      </ScreenLayout>
    );
  }

  if (phase === 'running') {
    const isFretboard = config.variant === 'fretboard';
    // Fretboard variant: always render a prompt character (nbsp when empty)
    // so the row's height is constant and the fretboard below doesn't jump
    // when ✓/✗ feedback appears.
    const promptContent = isFretboard
      ? (trials.promptText || '\u00A0')
      : trials.promptText;
    const promptNode = (
      <Text role='quiz-prompt' as='div' class='quiz-prompt'>
        {promptContent}
      </Text>
    );
    const wrongTap = trials.feedback?.correct === false
      ? trials.feedback.userInput
      : null;
    return (
      <ScreenLayout>
        <SpeedCheckHeader
          count={trials.trialProgress}
          onClose={onCancel}
        />
        <LayoutMain scrollable={false}>
          {isFretboard
            ? (
              // Fretboard in the prompt slot so the existing 70/30 CSS
              // rule (.quiz-stage:has(.quiz-stage-prompt svg.fretboard))
              // gives the fretboard the majority of the vertical space.
              <QuizStage
                prompt={
                  <>
                    {promptNode}
                    <FretboardSpeedCheckTarget
                      stringCount={config.stringCount}
                      targetPosition={trials.currentTarget}
                      wrongTapPosition={wrongTap}
                      onTap={trials.handleTrialResponse}
                    />
                  </>
                }
                response={null}
              />
            )
            : (
              <QuizStage
                prompt={promptNode}
                response={
                  <>
                    <NoteButtons
                      onAnswer={trials.handleTrialResponse}
                      feedback={trials.feedback}
                    />
                    <SpeedCheckInput
                      onSubmit={trials.handleTrialResponse}
                      wrongFlash={trials.feedback?.correct === false}
                    />
                    <KeyboardHint type='note' />
                  </>
                }
              />
            )}
        </LayoutMain>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <SpeedCheckHeader onClose={onCancel} />
      <LayoutMain scrollable={false}>
        <CenteredContent>
          <SpeedCheckResults baseline={baseline} />
        </CenteredContent>
      </LayoutMain>
      <LayoutFooter>
        <ActionButton
          variant='primary'
          class='next-btn'
          onClick={() => onComplete(baseline)}
        >
          Done
        </ActionButton>
      </LayoutFooter>
    </ScreenLayout>
  );
}
