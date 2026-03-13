// GenericMode — a single Preact component that interprets a ModeDefinition.
// Handles all hook composition, text-input keyboard handling, and
// phase-conditional rendering. Keyboard input is via a text field + Enter;
// buttons remain for tap/click on mobile.
//
// Sequential modes (def.sequential): GenericMode collects multiple inputs,
// renders progress slots, and evaluates all at once after the last input.
//
// Modes with custom rendering needs (e.g., SVG fretboard) provide a
// `useController` hook that can override prompt rendering, stats rendering,
// engine lifecycle hooks, and keyboard handling.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { ModeHandle } from '../types.ts';

import { useLearnerModel } from '../hooks/use-learner-model.ts';
import { useGroupScope } from '../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../hooks/use-practice-summary.ts';

import {
  displayNote,
  intervalMatchesInput,
  INTERVALS,
  resolveNoteInput,
  spelledNoteMatchesSemitone,
} from '../music-data.ts';
import {
  type ButtonFeedback,
  DegreeButtons,
  IntervalButtons,
  KeysigButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  PianoNoteButtons,
  SplitNoteButtons,
} from '../ui/buttons.tsx';
import { SequentialSlots } from '../ui/sequential-slots.tsx';
import { GroupProgressToggles } from '../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../ui/mode-screen.tsx';
import { StatsGrid, StatsLegend, StatsTable } from '../ui/stats.tsx';
import {
  FeedbackDisplay,
  KeyboardHint,
  type KeyboardHintType,
} from '../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../ui/speed-check.tsx';

import type {
  AnswerSpec,
  ButtonsDef,
  ComparisonStrategy,
  ModeController,
  ModeDefinition,
  SequentialEntryResult,
} from './types.ts';
import { useSequentialInput } from './use-sequential-input.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHintType(buttons: ButtonsDef): KeyboardHintType {
  switch (buttons.kind) {
    case 'note':
    case 'piano-note':
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

function resolveAnswerSpec<Q>(
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

function defaultDisplayAnswer(
  strategy: ComparisonStrategy,
  expected: string,
): string {
  return strategy === 'note-enharmonic' ? displayNote(expected) : expected;
}

function checkGenericAnswer<Q>(
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
  _itemId: string,
  input: string,
): { correct: boolean; correctAnswer: string } {
  if (isSequential) {
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

function getInputPlaceholder<Q>(
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

// ---------------------------------------------------------------------------
// AnswerInput — text field for keyboard answers
// ---------------------------------------------------------------------------

function AnswerInput(
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

function ResponseButtons(
  {
    buttonsDef,
    hidden,
    onAnswer,
    useFlats,
    narrowing,
    hideAccidentalsOverride,
    feedback,
    sequential,
    answered,
    pendingNote,
  }: {
    buttonsDef: ButtonsDef;
    hidden?: boolean;
    onAnswer: (input: string) => void;
    useFlats?: boolean;
    narrowing?: ReadonlySet<string> | null;
    hideAccidentalsOverride?: boolean;
    feedback?: ButtonFeedback | null;
    sequential?: boolean;
    answered?: boolean;
    pendingNote?: string | null;
  },
) {
  switch (buttonsDef.kind) {
    case 'note':
      return (
        <NoteButtons
          hidden={hidden}
          onAnswer={onAnswer}
          useFlats={useFlats}
          feedback={feedback}
        />
      );
    case 'piano-note':
      return (
        <div class={hidden ? 'answer-group-hidden' : undefined}>
          <PianoNoteButtons
            onAnswer={onAnswer}
            hideAccidentals={hideAccidentalsOverride ??
              buttonsDef.hideAccidentals}
            narrowing={narrowing}
            feedback={feedback}
          />
        </div>
      );
    case 'split-note':
      return (
        <SplitNoteButtons
          onAnswer={onAnswer}
          sequential={sequential}
          pendingNote={pendingNote}
          answered={answered}
        />
      );
    case 'number':
      return (
        <NumberButtons
          start={buttonsDef.start}
          end={buttonsDef.end}
          hidden={hidden}
          onAnswer={(n) => onAnswer(String(n))}
          feedback={feedback}
        />
      );
    case 'degree':
      return (
        <DegreeButtons
          hidden={hidden}
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'numeral':
      return (
        <NumeralButtons
          hidden={hidden}
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'interval':
      return (
        <IntervalButtons
          hidden={hidden}
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
    case 'keysig':
      return (
        <KeysigButtons
          hidden={hidden}
          onAnswer={onAnswer}
          feedback={feedback}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// SequentialQuizArea — quiz area for sequential (multi-input) modes
// ---------------------------------------------------------------------------

function SequentialQuizArea<Q>(
  { def, engine, ctrl, currentQ, activeButtons, seq, placeholder, promptText }:
    {
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
    },
) {
  return (
    <QuizArea
      prompt={ctrl.renderPrompt ? undefined : promptText}
      controls={
        <>
          <SequentialSlots
            expectedCount={currentQ && def.sequential
              ? def.sequential.expectedCount(currentQ)
              : 0}
            entries={seq.entries}
            evaluated={seq.evaluated}
            correctTones={seq.correctAnswer
              ? seq.correctAnswer.split(' ')
              : null}
          />
          <ResponseButtons
            buttonsDef={activeButtons}
            onAnswer={seq.handleInput}
            sequential
            answered={engine.state.answered}
          />
          {def.sequential?.parseBatchInput && (
            <AnswerInput
              onSubmit={seq.handleBatch}
              disabled={engine.state.answered}
              placeholder={placeholder}
            />
          )}
          <FeedbackDisplay
            text={engine.state.feedbackText}
            className={engine.state.feedbackClass}
            hint={engine.state.hintText || undefined}
            correct={engine.state.feedbackCorrect}
            onNext={engine.state.answered ? engine.nextQuestion : undefined}
          />
        </>
      }
    >
      {currentQ && ctrl.renderPrompt ? ctrl.renderPrompt(currentQ) : null}
    </QuizArea>
  );
}

// ---------------------------------------------------------------------------
// StandardQuizArea — quiz area for single-answer modes
// ---------------------------------------------------------------------------

function StandardQuizArea<Q>(
  {
    engine,
    ctrl,
    currentQ,
    activeButtons,
    inactiveButtons,
    handleSubmit,
    useFlats,
    placeholder,
    promptText,
    lastAnswerRef,
  }: {
    engine: ReturnType<typeof useQuizEngine>;
    ctrl: ModeController<Q>;
    currentQ: Q | null;
    activeButtons: ButtonsDef;
    inactiveButtons: ButtonsDef | null;
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
  },
) {
  return (
    <QuizArea
      prompt={ctrl.renderPrompt ? undefined : promptText}
      controls={
        <>
          <ResponseButtons
            buttonsDef={activeButtons}
            onAnswer={handleSubmit}
            useFlats={useFlats}
            narrowing={ctrl.narrowing}
            hideAccidentalsOverride={ctrl.hideAccidentals}
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
          {inactiveButtons && (
            <ResponseButtons
              buttonsDef={inactiveButtons}
              hidden
              onAnswer={handleSubmit}
            />
          )}
          <AnswerInput
            onSubmit={handleSubmit}
            disabled={engine.state.answered}
            placeholder={placeholder}
            feedbackCorrect={engine.state.feedbackCorrect}
          />
          <KeyboardHint type={getHintType(activeButtons)} />
          <FeedbackDisplay
            text={engine.state.feedbackText}
            className={engine.state.feedbackClass}
            hint={engine.state.hintText || undefined}
            correct={engine.state.feedbackCorrect}
            onNext={engine.state.answered ? engine.nextQuestion : undefined}
            label={engine.state.roundTimerExpired ? 'Continue' : 'Next'}
          />
        </>
      }
    >
      {currentQ && ctrl.renderPrompt ? ctrl.renderPrompt(currentQ) : null}
    </QuizArea>
  );
}

// ---------------------------------------------------------------------------
// QuizActiveView — rendering during an active quiz session
// ---------------------------------------------------------------------------

type QuizActiveViewProps<Q> = {
  def: ModeDefinition<Q>;
  engine: ReturnType<typeof useQuizEngine>;
  learner: ReturnType<typeof useLearnerModel>;
  ctrl: ModeController<Q>;
  currentQ: Q | null;
  round: ReturnType<typeof useRoundSummary>;
  practicingLabel: string;
  handleSubmit: (input: string) => boolean;
  seq: {
    entries: { display: string }[];
    evaluated: SequentialEntryResult[] | null;
    correctAnswer: string;
    handleInput: (input: string) => void;
    handleBatch: (text: string) => boolean;
  };
  activeButtons: ButtonsDef;
  inactiveButtons: ButtonsDef | null;
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

function QuizActiveView<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    currentQ,
    round,
    practicingLabel,
    handleSubmit,
    seq,
    activeButtons,
    inactiveButtons,
    promptText,
    useFlats,
    placeholder,
    lastAnswerRef,
  }: QuizActiveViewProps<Q>,
) {
  const phase = engine.state.phase;

  return (
    <>
      {phase !== 'round-complete' && (
        <QuizSession
          timeLeft={engine.timerText}
          timerPct={engine.timerPct}
          context={practicingLabel}
          count={round.countText}
          isWarning={engine.timerWarning}
          isLastQuestion={engine.timerLastQuestion}
          lastQuestion={engine.state.roundTimerExpired
            ? (engine.state.answered ? 'Time is up' : 'Last question')
            : ''}
          onClose={engine.stop}
        />
      )}
      {engine.calibrating
        ? (
          <QuizArea>
            <SpeedCheck
              provider={BUTTON_PROVIDER}
              fixture={engine.calibrationFixture}
              onComplete={(baseline) => {
                learner.applyBaseline(baseline);
                engine.endCalibration();
              }}
              onCancel={engine.endCalibration}
            />
          </QuizArea>
        )
        : phase === 'round-complete'
        ? (
          <QuizArea
            controls={
              <RoundCompleteActions
                onContinue={engine.continueQuiz}
                onStop={engine.stop}
              />
            }
          >
            <RoundCompleteInfo
              context={round.roundContext}
              heading='Round complete'
              count={engine.state.roundAnswered}
              correct={round.roundCorrect}
            />
          </QuizArea>
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
          />
        )
        : (
          <StandardQuizArea
            engine={engine}
            ctrl={ctrl}
            currentQ={currentQ}
            activeButtons={activeButtons}
            inactiveButtons={inactiveButtons}
            handleSubmit={handleSubmit}
            useFlats={useFlats}
            placeholder={placeholder}
            promptText={promptText}
            lastAnswerRef={lastAnswerRef}
          />
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// IdlePracticeView — rendered when the engine is idle
// ---------------------------------------------------------------------------

function IdlePracticeView<Q>(
  { def, engine, learner, ctrl, groupScopeResult, ps }: {
    def: ModeDefinition<Q>;
    engine: ReturnType<typeof useQuizEngine>;
    learner: ReturnType<typeof useLearnerModel>;
    ctrl: ModeController<Q>;
    groupScopeResult: ReturnType<typeof useGroupScope> | null;
    ps: ReturnType<typeof usePracticeSummary>;
  },
) {
  const groupScope = def.scope.kind === 'groups' ? def.scope : null;
  return (
    <PracticeTab
      summary={ps.summary}
      onStart={engine.start}
      onApplyRecommendation={ps.summary.showRecommendationButton &&
          groupScopeResult
        ? groupScopeResult.applyRecommendation
        : undefined}
      scopeValid={!groupScopeResult || groupScopeResult.enabledGroups.size > 0}
      validationMessage='Select at least one group'
      scope={groupScopeResult && groupScope
        ? (
          <GroupProgressToggles
            groups={groupScope.allGroupIndices.map((i) => ({
              label: typeof groupScope.groups[i].label === 'function'
                ? groupScope.groups[i].label()
                : groupScope.groups[i].label,
              itemIds: groupScope.getItemIdsForGroup(i),
            }))}
            active={groupScopeResult.enabledGroups}
            onToggle={groupScopeResult.scopeActions.toggleGroup}
            selector={learner.selector}
            skipped={groupScopeResult.skippedGroups}
            onSkip={groupScopeResult.scopeActions.skipGroup}
            onUnskip={groupScopeResult.scopeActions.unskipGroup}
          />
        )
        : undefined}
      statsContent={
        <>
          {ctrl.renderStats ? ctrl.renderStats(ps.statsSel) : (
            <>
              {def.stats.kind === 'grid' && (
                <StatsGrid
                  selector={ps.statsSel}
                  colLabels={def.stats.colLabels}
                  getItemId={def.stats.getItemId}
                  notes={def.stats.notes}
                />
              )}
              {def.stats.kind === 'table' && (
                <StatsTable
                  selector={ps.statsSel}
                  rows={def.stats.getRows()}
                  fwdHeader={def.stats.fwdHeader}
                  revHeader={def.stats.revHeader}
                />
              )}
            </>
          )}
          {(def.stats.kind !== 'none' || ctrl.renderStats) && <StatsLegend />}
        </>
      }
      baseline={learner.motorBaseline}
      onCalibrate={engine.startCalibration}
      activeTab={ps.activeTab}
      onTabSwitch={ps.setActiveTab}
    />
  );
}

// ---------------------------------------------------------------------------
// GenericMode component
// ---------------------------------------------------------------------------

const EMPTY_GROUPS: ReadonlySet<number> = new Set();

// ---------------------------------------------------------------------------
// Engine setup hook — refs, sequential input, engine config, engine creation
// ---------------------------------------------------------------------------

type GenericEngineSetup<Q> = {
  engine: ReturnType<typeof useQuizEngine>;
  currentQRef: { current: Q | null };
  seqInput: ReturnType<typeof useSequentialInput>;
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  };
  isSequential: boolean;
};

function useGenericEngine<Q>(
  def: ModeDefinition<Q>,
  ctrl: ModeController<Q>,
  ctrlRef: { current: ModeController<Q> },
  groupScopeResult: ReturnType<typeof useGroupScope> | null,
  learner: ReturnType<typeof useLearnerModel>,
  container: HTMLElement,
): GenericEngineSetup<Q> {
  const currentQRef = useRef<Q | null>(null);
  const isSequential = !!def.sequential;
  const seqSubmitRef = useRef<(input: string) => void>(() => {});
  const seqInput = useSequentialInput(def, currentQRef, seqSubmitRef);
  const lastAnswerRef = useRef<
    {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null
  >(null);
  const getEnabledItemsRef = useRef<() => string[]>(() => def.allItems);
  const getPracticingLabelRef = useRef<() => string>(() => 'all items');
  if (groupScopeResult) {
    getEnabledItemsRef.current = groupScopeResult.getEnabledItems;
    getPracticingLabelRef.current = groupScopeResult.getPracticingLabel;
  }

  const engineConfig = useMemo(
    () =>
      buildGenericEngineConfig(
        def,
        getEnabledItemsRef,
        getPracticingLabelRef,
        currentQRef,
        lastAnswerRef,
        ctrlRef,
        isSequential,
        seqInput,
        !!ctrl.handleKey,
      ),
    [def, !!ctrl.handleKey, isSequential],
  );

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  seqSubmitRef.current = engine.submitAnswer;

  return { engine, currentQRef, seqInput, lastAnswerRef, isSequential };
}

function resolveButtons<Q>(
  def: ModeDefinition<Q>,
  dir: 'fwd' | 'rev',
): { active: ButtonsDef; inactive: ButtonsDef | null } {
  if (def.buttons.kind === 'bidirectional') {
    return dir === 'fwd'
      ? { active: def.buttons.fwd, inactive: def.buttons.rev }
      : { active: def.buttons.rev, inactive: def.buttons.fwd };
  }
  return { active: def.buttons, inactive: null };
}

function buildGroupScopeSpec<Q>(
  def: ModeDefinition<Q>,
  selector: ReturnType<typeof useLearnerModel>['selector'],
) {
  if (def.scope.kind !== 'groups') return null;
  return {
    groups: def.scope.groups,
    getItemIdsForGroup: def.scope.getItemIdsForGroup,
    allGroupIndices: def.scope.allGroupIndices,
    storageKey: def.scope.storageKey,
    scopeLabel: def.scope.scopeLabel,
    defaultEnabled: def.scope.defaultEnabled,
    selector,
    formatLabel: def.scope.formatLabel,
  };
}

function buildGenericEngineConfig<Q>(
  def: ModeDefinition<Q>,
  getEnabledItemsRef: { current: () => string[] },
  getPracticingLabelRef: { current: () => string },
  currentQRef: { current: Q | null },
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  },
  ctrlRef: { current: ModeController<Q> },
  isSequential: boolean,
  seqInput: ReturnType<typeof useSequentialInput>,
  hasHandleKey: boolean,
): QuizEngineConfig {
  return {
    getEnabledItems: () => getEnabledItemsRef.current(),
    getPracticingLabel: () => getPracticingLabelRef.current(),
    checkAnswer: (itemId, input) =>
      checkGenericAnswer(
        def,
        currentQRef,
        lastAnswerRef,
        isSequential,
        itemId,
        input,
      ),
    onAnswer: (itemId, result) => ctrlRef.current.onAnswer?.(itemId, result),
    onStart: () => ctrlRef.current.onStart?.(),
    onStop: () => {
      if (isSequential) seqInput.resetOnItemChange(null);
      ctrlRef.current.onStop?.();
    },
    handleKey: hasHandleKey
      ? (e, ctx) => ctrlRef.current.handleKey!(e, ctx)
      : undefined,
  };
}

function useGenericDerivedState<Q>(
  def: ModeDefinition<Q>,
  engine: ReturnType<typeof useQuizEngine>,
  learner: ReturnType<typeof useLearnerModel>,
  groupScopeResult: ReturnType<typeof useGroupScope> | null,
  currentQRef: { current: Q | null },
  seqInput: ReturnType<typeof useSequentialInput>,
  isSequential: boolean,
  container: HTMLElement,
  onMount: (handle: ModeHandle) => void,
  ctrl: ModeController<Q>,
) {
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    return (!id || engine.state.phase === 'idle') ? null : def.getQuestion(id);
  }, [engine.state.currentItemId, engine.state.phase, def]);
  currentQRef.current = currentQ;
  if (isSequential) seqInput.resetOnItemChange(engine.state.currentItemId);

  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);
  const practicingLabel = groupScopeResult?.practicingLabel ?? 'all items';
  const round = useRoundSummary(engine, practicingLabel);
  const ps = usePracticeSummary({
    allItems: def.allItems,
    selector: learner.selector,
    engine,
    itemNoun: def.itemNoun,
    recommendation: groupScopeResult?.recommendation ?? null,
    recommendationText: groupScopeResult?.recommendationText ?? '',
  });
  useModeLifecycle(onMount, engine, learner, ctrl.deactivateCleanup);

  const handleSubmit = useCallback((input: string): boolean => {
    if (
      def.validateInput && currentQRef.current &&
      !def.validateInput(currentQRef.current, input)
    ) return false;
    engine.submitAnswer(input);
    return true;
  }, [engine.submitAnswer, def]);

  return { currentQ, round, ps, practicingLabel, handleSubmit };
}

function buildSeqProps(seqInput: ReturnType<typeof useSequentialInput>) {
  return {
    entries: seqInput.seqEntries,
    evaluated: seqInput.seqEvaluated,
    correctAnswer: seqInput.seqCorrectAnswer,
    handleInput: seqInput.handleSeqInput,
    handleBatch: seqInput.handleSeqBatch,
  };
}

export function GenericMode<Q>(
  { def, container, navigateHome, onMount }: {
    def: ModeDefinition<Q>;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const learner = useLearnerModel(def.namespace, def.allItems);
  const groupScopeSpec = buildGroupScopeSpec(def, learner.selector);
  const groupScopeResult = groupScopeSpec
    ? useGroupScope(groupScopeSpec)
    : null;
  const enabledGroups = groupScopeResult?.enabledGroups ?? EMPTY_GROUPS;
  const ctrl: ModeController<Q> = def.useController
    ? def.useController(enabledGroups)
    : {};
  const ctrlRef = useRef(ctrl);
  ctrlRef.current = ctrl;

  const { engine, currentQRef, seqInput, lastAnswerRef, isSequential } =
    useGenericEngine(def, ctrl, ctrlRef, groupScopeResult, learner, container);
  const { currentQ, round, ps, practicingLabel, handleSubmit } =
    useGenericDerivedState(
      def,
      engine,
      learner,
      groupScopeResult,
      currentQRef,
      seqInput,
      isSequential,
      container,
      onMount,
      ctrl,
    );

  const dir = (currentQ && def.getDirection)
    ? def.getDirection(currentQ)
    : 'fwd';
  const promptText = currentQ ? def.getPromptText(currentQ) : '';
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;
  const { active: activeButtons, inactive: inactiveButtons } = resolveButtons(
    def,
    dir,
  );
  const isIdle = engine.state.phase === 'idle';

  return (
    <>
      <ModeTopBar
        modeId={def.id}
        title={def.name}
        description={def.description}
        beforeAfter={def.beforeAfter}
        onBack={navigateHome}
        showBack={isIdle}
      />
      {isIdle && (
        <IdlePracticeView
          def={def}
          engine={engine}
          learner={learner}
          ctrl={ctrl}
          groupScopeResult={groupScopeResult}
          ps={ps}
        />
      )}
      {!isIdle && (
        <QuizActiveView
          def={def}
          engine={engine}
          learner={learner}
          ctrl={ctrl}
          currentQ={currentQ}
          round={round}
          practicingLabel={practicingLabel}
          handleSubmit={handleSubmit}
          seq={buildSeqProps(seqInput)}
          activeButtons={activeButtons}
          inactiveButtons={inactiveButtons}
          promptText={promptText}
          useFlats={useFlats}
          placeholder={getInputPlaceholder(def, currentQ, isSequential)}
          lastAnswerRef={lastAnswerRef}
        />
      )}
    </>
  );
}
