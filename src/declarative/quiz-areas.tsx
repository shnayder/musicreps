// Quiz area components — rendered during an active quiz session.
// Includes AnswerInput (text field), ResponseButtons (dispatch),
// three quiz area variants, and QuizActiveView (top-level dispatcher).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import type { useRoundSummary } from '../hooks/use-round-summary.ts';

import {
  type ButtonFeedback,
  DegreeButtons,
  IntervalButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  type SplitButtonsFlushRef,
  SplitKeysigButtons,
  SplitNoteButtons,
} from '../ui/buttons.tsx';
import { SequentialSlots } from '../ui/sequential-slots.tsx';
import {
  CenteredContent,
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  QuizStage,
  ScreenLayout,
} from '../ui/screen-layout.tsx';
import {
  type LevelProgressEntry,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../ui/mode-screen.tsx';
import {
  FeedbackDisplay,
  KeyboardHint,
  type KeyboardHintType,
} from '../ui/quiz-ui.tsx';
import { InteractiveFretboard } from '../ui/interactive-fretboard.tsx';
import { Text } from '../ui/text.tsx';

import type {
  ButtonsDef,
  ComparisonStrategy,
  ModeController,
  ModeDefinition,
  SequentialEntryResult,
} from './types.ts';
import type { MultiTapInputHandle } from './use-multi-tap-input.ts';
import { toButtonValue } from './answer-utils.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHintType(buttons: ButtonsDef): KeyboardHintType {
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
// AnswerInput — text field for keyboard answers
// ---------------------------------------------------------------------------

export function AnswerInput(
  { onSubmit, disabled, placeholder, onInvalid, feedbackCorrect }: {
    onSubmit: (input: string) => boolean;
    disabled?: boolean;
    placeholder?: string;
    onInvalid?: () => void;
    feedbackCorrect?: boolean | null;
  },
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }, [disabled]);

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
      if (!value) {
        triggerShake();
        onInvalid?.();
        return;
      }
      if (!onSubmit(value)) triggerShake();
    },
    [onSubmit, onInvalid, triggerShake],
  );

  let cls = 'answer-input';
  if (shake) cls += ' answer-input-shake';
  if (feedbackCorrect === false) cls += ' answer-input-wrong';
  else if (feedbackCorrect === true) cls += ' answer-input-correct';
  const label = placeholder ?? 'Type answer, press Enter';

  return (
    <input
      ref={inputRef}
      type='text'
      class={cls}
      placeholder={label}
      aria-label={label}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      autoComplete='off'
      autoCorrect='off'
      spellcheck={false}
    />
  );
}

// ---------------------------------------------------------------------------
// ResponseButtons — dispatch to the correct button component
// ---------------------------------------------------------------------------

export function ResponseButtons(
  {
    buttonsDef,
    onAnswer,
    useFlats,
    narrowing,
    hideAccidentalsOverride,
    columnsOverride,
    feedback,
    answered,
    splitFlushRef,
  }: {
    buttonsDef: ButtonsDef;
    onAnswer: (input: string) => void;
    useFlats?: boolean;
    narrowing?: ReadonlySet<string> | null;
    hideAccidentalsOverride?: boolean;
    columnsOverride?: number;
    feedback?: ButtonFeedback | null;
    answered?: boolean;
    splitFlushRef?: SplitButtonsFlushRef;
  },
) {
  switch (buttonsDef.kind) {
    case 'note':
      return (
        <NoteButtons
          onAnswer={onAnswer}
          useFlats={useFlats}
          hideAccidentals={hideAccidentalsOverride}
          narrowing={narrowing}
          feedback={feedback}
          columns={columnsOverride ?? buttonsDef.columns}
        />
      );
    case 'split-note':
      return (
        <SplitNoteButtons
          onAnswer={onAnswer}
          answered={answered}
          flushRef={splitFlushRef}
        />
      );
    case 'number':
      return (
        <NumberButtons
          start={buttonsDef.start}
          end={buttonsDef.end}
          onAnswer={(n) => onAnswer(String(n))}
          feedback={feedback}
        />
      );
    case 'degree':
      return (
        <DegreeButtons
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'numeral':
      return (
        <NumeralButtons
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'interval':
      return (
        <IntervalButtons
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'split-keysig':
      return (
        <SplitKeysigButtons
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'none':
      return null;
  }
}

// ---------------------------------------------------------------------------
// SequentialQuizArea — quiz area for sequential (multi-input) modes
// ---------------------------------------------------------------------------

export function SequentialQuizArea<Q>(
  {
    def,
    engine,
    ctrl,
    currentQ,
    activeButtons,
    seq,
    placeholder,
    promptText,
    instruction,
    splitFlushRef,
  }: {
    def: ModeDefinition<Q>;
    engine: ReturnType<typeof useQuizEngine>;
    ctrl: ModeController<Q>;
    currentQ: Q | null;
    activeButtons: ButtonsDef;
    seq: {
      entries: { display: string }[];
      evaluated: SequentialEntryResult[] | null;
      correctAnswer: string;
      handleInput: (input: string) => void;
      handleBatch: (text: string) => boolean;
    };
    placeholder?: string;
    promptText: string;
    instruction?: string;
    splitFlushRef?: SplitButtonsFlushRef;
  },
) {
  return (
    <QuizStage
      prompt={
        <>
          {instruction && (
            <Text role='quiz-instruction' as='div' class='quiz-instruction'>
              {instruction}
            </Text>
          )}
          {ctrl.renderPrompt && currentQ
            ? ctrl.renderPrompt(currentQ)
            : (
              <Text role='quiz-prompt' as='div' class='quiz-prompt'>
                {promptText}
              </Text>
            )}
        </>
      }
      response={
        <>
          <SequentialSlots
            entries={seq.entries}
            evaluated={seq.evaluated}
            correctTones={seq.correctAnswer
              ? seq.correctAnswer.split(' ')
              : null}
          />
          <ResponseButtons
            buttonsDef={activeButtons}
            onAnswer={seq.handleInput}
            answered={engine.state.answered}
            splitFlushRef={splitFlushRef}
          />
          {def.sequential?.parseBatchInput && (
            <AnswerInput
              onSubmit={seq.handleBatch}
              disabled={engine.state.answered}
              placeholder={placeholder}
            />
          )}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// MultiTapQuizArea — quiz area for multi-tap (spatial set) modes
// ---------------------------------------------------------------------------

export function MultiTapQuizArea(
  { multiTapInput, promptText, instruction, stringCount, mutedStrings }: {
    multiTapInput: MultiTapInputHandle;
    promptText: string;
    instruction?: string;
    stringCount?: number;
    mutedStrings?: ReadonlySet<number>;
  },
) {
  // Multi-tap modes render prompt text + interactive fretboard.
  // The fretboard is rendered by GenericMode (not the controller) using
  // shared multi-tap state from useMultiTapInput.
  return (
    <QuizStage
      prompt={
        <>
          {instruction && (
            <Text role='quiz-instruction' as='div' class='quiz-instruction'>
              {instruction}
            </Text>
          )}
          <Text role='quiz-prompt' as='div' class='quiz-prompt'>
            {promptText}
          </Text>
          <InteractiveFretboard
            onTap={multiTapInput.handleTap}
            tappedPositions={multiTapInput.tappedPositions}
            evaluated={multiTapInput.evaluated}
            stringCount={stringCount}
            mutedStrings={mutedStrings}
          />
        </>
      }
      response={null}
    />
  );
}

// ---------------------------------------------------------------------------
// StandardQuizArea — quiz area for single-answer modes
// ---------------------------------------------------------------------------

export function StandardQuizArea<Q>(
  {
    engine,
    ctrl,
    currentQ,
    activeButtons,
    handleSubmit,
    useFlats,
    placeholder,
    promptText,
    lastAnswerRef,
    instruction,
  }: {
    engine: ReturnType<typeof useQuizEngine>;
    ctrl: ModeController<Q>;
    currentQ: Q | null;
    activeButtons: ButtonsDef;
    handleSubmit: (input: string) => boolean;
    useFlats?: boolean;
    placeholder?: string;
    promptText: string;
    lastAnswerRef: {
      current: {
        expected: string;
        comparison: ComparisonStrategy;
        normalizedInput: string;
      } | null;
    };
    instruction?: string;
  },
) {
  return (
    <QuizStage
      prompt={
        <>
          {instruction && (
            <Text role='quiz-instruction' as='div' class='quiz-instruction'>
              {instruction}
            </Text>
          )}
          {ctrl.renderPrompt && currentQ
            ? ctrl.renderPrompt(currentQ)
            : (
              <Text role='quiz-prompt' as='div' class='quiz-prompt'>
                {promptText}
              </Text>
            )}
        </>
      }
      response={
        <>
          <ResponseButtons
            buttonsDef={activeButtons}
            onAnswer={handleSubmit}
            useFlats={useFlats}
            narrowing={ctrl.narrowing}
            hideAccidentalsOverride={ctrl.hideAccidentals}
            columnsOverride={ctrl.buttonColumns}
            feedback={engine.state.feedbackCorrect !== null &&
                lastAnswerRef.current
              ? {
                correct: engine.state.feedbackCorrect,
                userInput: toButtonValue(
                  lastAnswerRef.current.comparison,
                  lastAnswerRef.current.normalizedInput,
                ),
                displayAnswer: toButtonValue(
                  lastAnswerRef.current.comparison,
                  lastAnswerRef.current.expected,
                ),
              }
              : null}
          />
          <AnswerInput
            onSubmit={handleSubmit}
            disabled={engine.state.answered}
            placeholder={placeholder}
            feedbackCorrect={engine.state.feedbackCorrect}
          />
          <KeyboardHint type={getHintType(activeButtons)} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// QuizActiveView — rendering during an active quiz session
// ---------------------------------------------------------------------------

export type QuizActiveViewProps<Q> = {
  def: ModeDefinition<Q>;
  engine: ReturnType<typeof useQuizEngine>;
  ctrl: ModeController<Q>;
  currentQ: Q | null;
  round: ReturnType<typeof useRoundSummary>;
  levelBars: LevelProgressEntry[];
  handleSubmit: (input: string) => boolean;
  seq: {
    entries: { display: string }[];
    evaluated: SequentialEntryResult[] | null;
    correctAnswer: string;
    handleInput: (input: string) => void;
    handleBatch: (text: string) => boolean;
    handleCheck: () => void;
  };
  multiTapInput: MultiTapInputHandle;
  activeButtons: ButtonsDef;
  promptText: string;
  useFlats?: boolean;
  placeholder?: string;
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  };
};

export function QuizActiveView<Q>(
  {
    def,
    engine,
    ctrl,
    currentQ,
    round,
    levelBars,
    handleSubmit,
    seq,
    multiTapInput,
    activeButtons,
    promptText,
    useFlats,
    placeholder,
    lastAnswerRef,
  }: QuizActiveViewProps<Q>,
) {
  const phase = engine.state.phase;
  // Ref for committing a tapped letter that hasn't been paired with an
  // accidental yet, so pressing Check submits "B" rather than dropping it.
  const splitFlushRef = useRef<(() => void) | null>(null);
  const handleCheckWithFlush = useCallback(() => {
    splitFlushRef.current?.();
    seq.handleCheck();
  }, [seq]);

  if (phase === 'round-complete') {
    return (
      <ScreenLayout>
        <LayoutHeader>
          <div />
        </LayoutHeader>
        <LayoutMain scrollable={false}>
          <CenteredContent>
            <RoundCompleteInfo
              heading='Round complete'
              count={engine.state.roundAnswered}
              correct={round.roundCorrect}
              levelBars={levelBars}
            />
          </CenteredContent>
        </LayoutMain>
        <LayoutFooter>
          <RoundCompleteActions
            onContinue={engine.continueQuiz}
            onStop={engine.stop}
          />
        </LayoutFooter>
      </ScreenLayout>
    );
  }

  const instruction = currentQ && def.quizInstruction
    ? (typeof def.quizInstruction === 'function'
      ? def.quizInstruction(currentQ)
      : def.quizInstruction)
    : undefined;

  const mtMutedStrings = useMemo(() => {
    if (!def.multiTap?.getMutedStrings || !currentQ) return undefined;
    return new Set(def.multiTap.getMutedStrings(currentQ));
  }, [def, currentQ]);

  const quizContent = def.multiTap
    ? (
      <MultiTapQuizArea
        multiTapInput={multiTapInput}
        promptText={promptText}
        instruction={instruction}
        stringCount={def.multiTap.stringCount}
        mutedStrings={mtMutedStrings}
      />
    )
    : def.sequential
    ? (
      <SequentialQuizArea
        def={def}
        engine={engine}
        ctrl={ctrl}
        currentQ={currentQ}
        activeButtons={activeButtons}
        seq={seq}
        placeholder={placeholder}
        promptText={promptText}
        instruction={instruction}
        splitFlushRef={splitFlushRef}
      />
    )
    : (
      <StandardQuizArea
        engine={engine}
        ctrl={ctrl}
        currentQ={currentQ}
        activeButtons={activeButtons}
        handleSubmit={handleSubmit}
        useFlats={useFlats}
        placeholder={placeholder}
        promptText={promptText}
        lastAnswerRef={lastAnswerRef}
        instruction={instruction}
      />
    );

  return (
    <ScreenLayout>
      <LayoutHeader>
        <QuizSession
          timeLeft={engine.timerText}
          timerPct={engine.timerPct}
          count={round.countLabel}
          isWarning={engine.timerWarning}
          isLastQuestion={engine.timerLastQuestion}
          onClose={engine.stop}
        />
      </LayoutHeader>
      <LayoutMain scrollable={false}>
        {quizContent}
      </LayoutMain>
      <LayoutFooter>
        <FeedbackDisplay
          text={engine.state.feedbackText}
          className={engine.state.feedbackClass}
          hint={engine.state.hintText || undefined}
          correct={engine.state.feedbackCorrect}
          onNext={engine.state.answered ? engine.nextQuestion : undefined}
          onCheck={!engine.state.answered
            ? (def.sequential && !seq.evaluated && seq.entries.length > 0
              ? handleCheckWithFlush
              : def.multiTap && !multiTapInput.evaluated &&
                  multiTapInput.tappedPositions.size > 0
              ? multiTapInput.handleCheck
              : undefined)
            : undefined}
          label={engine.state.roundTimerExpired ? 'Continue' : 'Next'}
          notice={engine.state.roundTimerExpired && !engine.state.answered
            ? 'Last question'
            : undefined}
        />
      </LayoutFooter>
    </ScreenLayout>
  );
}
