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
import { GroupToggles } from '../ui/scope.tsx';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the keyboard hint type from the active button kind. */
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

/** Resolve the correct AnswerSpec for a question (handles bidirectional). */
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

/** Check correctness using the declared comparison strategy. */
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
      // resolveNoteInput handles 's' → '#', solfège, case normalization
      const resolved = resolveNoteInput(input) ?? input;
      return spelledNoteMatchesSemitone(expected, resolved);
    }
    case 'interval': {
      const iv = INTERVALS.find((i) => i.abbrev === expected);
      return iv ? intervalMatchesInput(iv, input) : false;
    }
  }
}

/** Convert an answer value to the canonical button value for feedback. */
export function toButtonValue(
  strategy: ComparisonStrategy,
  value: string,
): string {
  if (strategy === 'note-enharmonic') return resolveNoteInput(value) ?? value;
  return value;
}

/** Default display text for the correct answer. */
function defaultDisplayAnswer(
  strategy: ComparisonStrategy,
  expected: string,
): string {
  return strategy === 'note-enharmonic' ? displayNote(expected) : expected;
}

// ---------------------------------------------------------------------------
// AnswerInput — text field for keyboard answers
// ---------------------------------------------------------------------------

function AnswerInput(
  { onSubmit, disabled, placeholder, onInvalid, feedbackCorrect }: {
    /** Returns true if accepted, false if rejected (input is preserved). */
    onSubmit: (input: string) => boolean;
    disabled?: boolean;
    placeholder?: string;
    /** Called when user submits empty/whitespace-only input. */
    onInvalid?: () => void;
    /** Tri-state feedback: true = correct (green), false = wrong (red), null/undefined = none. */
    feedbackCorrect?: boolean | null;
  },
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up shake timer on unmount
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Auto-focus and clear input when re-enabled (new question)
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
      // Stop propagation so the engine's document-level keydown
      // doesn't also fire (it would try to advance to next question).
      e.stopPropagation();

      const value = inputRef.current?.value.trim() ?? '';
      if (!value) {
        triggerShake();
        onInvalid?.();
        return;
      }
      const accepted = onSubmit(value);
      if (!accepted) {
        triggerShake();
      }
      // Text stays visible for both correct and incorrect answers;
      // cleared when re-enabled (new question) via the useEffect above.
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
// Tap/click buttons renderer (unchanged — buttons are still useful on mobile)
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
    /** Enable chain-submit for sequential modes. */
    sequential?: boolean;
    /** Whether the current question has been answered (disables split-note buttons). */
    answered?: boolean;
    /** Pending note from keyboard input (syncs split-note visual state). */
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
// GenericMode component
// ---------------------------------------------------------------------------

const EMPTY_GROUPS: ReadonlySet<number> = new Set();

export function GenericMode<Q>(
  { def, container, navigateHome, onMount }: {
    def: ModeDefinition<Q>;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel(def.namespace, def.allItems);

  // --- Scope (group-based or none) ---
  // Note: conditional hook calls below are safe because `def` is stable for
  // the lifetime of each GenericMode instance — the branch never changes.
  const groupScopeSpec = def.scope.kind === 'groups'
    ? {
      groups: def.scope.groups,
      getItemIdsForGroup: def.scope.getItemIdsForGroup,
      allGroupIndices: def.scope.allGroupIndices,
      storageKey: def.scope.storageKey,
      scopeLabel: def.scope.scopeLabel,
      defaultEnabled: def.scope.defaultEnabled,
      selector: learner.selector,
      formatLabel: def.scope.formatLabel,
    }
    : null;
  const groupScopeResult = groupScopeSpec
    ? useGroupScope(groupScopeSpec)
    : null;

  // --- Controller (optional — for modes with custom rendering/hooks) ---
  const enabledGroups = groupScopeResult?.enabledGroups ?? EMPTY_GROUPS;
  const ctrl: ModeController<Q> = def.useController
    ? def.useController(enabledGroups)
    : {};
  const ctrlRef = useRef(ctrl);
  ctrlRef.current = ctrl;

  // --- Question state ---
  const currentQRef = useRef<Q | null>(null);

  // --- Sequential state (only used when def.sequential is present) ---
  const isSequential = !!def.sequential;
  const [seqEntries, setSeqEntries] = useState<{ display: string }[]>([]);
  const seqEntriesRef = useRef<string[]>([]); // raw inputs
  const [seqEvaluated, setSeqEvaluated] = useState<
    SequentialEntryResult[] | null
  >(null);
  const [seqCorrectAnswer, setSeqCorrectAnswer] = useState<string>('');
  const seqSubmitRef = useRef<(input: string) => void>(() => {});

  // --- Answer spec feedback ref ---
  const lastAnswerRef = useRef<
    {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null
  >(null);

  // --- Engine config ---
  const getEnabledItemsRef = useRef<() => string[]>(
    () => def.allItems,
  );
  const getPracticingLabelRef = useRef<() => string>(
    () => 'all items',
  );

  if (groupScopeResult) {
    getEnabledItemsRef.current = groupScopeResult.getEnabledItems;
    getPracticingLabelRef.current = groupScopeResult.getPracticingLabel;
  }

  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => getEnabledItemsRef.current(),
    getPracticingLabel: () => getPracticingLabelRef.current(),

    checkAnswer: (_itemId: string, input: string) => {
      if (isSequential) {
        // Sequential: sentinel-based — real evaluation already happened
        // in handleSeqInput/handleSeqBatch. The engine just records the result.
        // Correct answer is encoded after the sentinel for screen-reader feedback.
        const sep = input.indexOf(':');
        const isCorrect = input.startsWith('__correct__');
        const correctAnswer = sep >= 0 ? input.slice(sep + 1) : '';
        return { correct: isCorrect, correctAnswer };
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
    },

    onAnswer: (itemId, result) => {
      ctrlRef.current.onAnswer?.(itemId, result);
    },

    onStart: () => {
      ctrlRef.current.onStart?.();
    },

    onStop: () => {
      if (isSequential) {
        setSeqEntries([]);
        setSeqEvaluated(null);
        setSeqCorrectAnswer('');
        seqEntriesRef.current = [];
      }
      ctrlRef.current.onStop?.();
    },

    handleKey: ctrl.handleKey
      ? (e, ctx) => ctrlRef.current.handleKey!(e, ctx)
      : undefined,
  }), [def, !!ctrl.handleKey, isSequential]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  seqSubmitRef.current = engine.submitAnswer;

  // --- Derived question state ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return def.getQuestion(id);
  }, [engine.state.currentItemId, engine.state.phase, def]);
  currentQRef.current = currentQ;

  // --- Reset sequential state on question change ---
  const prevSeqItemRef = useRef<string | null>(null);
  if (isSequential && engine.state.currentItemId !== prevSeqItemRef.current) {
    prevSeqItemRef.current = engine.state.currentItemId;
    seqEntriesRef.current = [];
    setSeqEntries([]);
    setSeqEvaluated(null);
    setSeqCorrectAnswer('');
  }

  // --- Sequential input handler (one note at a time, from button tap) ---
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
      // All collected — evaluate
      const result = def.sequential.evaluate(q, newRaw);
      setSeqEvaluated(result.perEntry);
      setSeqCorrectAnswer(result.correctAnswer);
      const sentinel = result.correct ? '__correct__' : '__wrong__';
      seqSubmitRef.current(sentinel + ':' + result.correctAnswer);
    }
  }, [def]);

  // --- Sequential batch submit (keyboard text input) ---
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
    seqSubmitRef.current(sentinel + ':' + result.correctAnswer);
    return true;
  }, [def]);

  // --- Direction ---
  const dir = (currentQ && def.getDirection)
    ? def.getDirection(currentQ)
    : 'fwd';

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

  // --- Practicing label ---
  const practicingLabel = groupScopeResult?.practicingLabel ?? 'all items';

  // --- Round summary ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Practice summary ---
  const ps = usePracticeSummary({
    allItems: def.allItems,
    selector: learner.selector,
    engine,
    itemNoun: def.itemNoun,
    recommendation: groupScopeResult?.recommendation ?? null,
    recommendationText: groupScopeResult?.recommendationText ?? '',
  });

  // --- Navigation handle ---
  const deactivateCleanup = ctrl.deactivateCleanup;
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Prompt text ---
  const promptText = currentQ ? def.getPromptText(currentQ) : '';

  // --- UseFlats for note buttons ---
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;

  // --- Answer submission (shared by text input + button tap) ---
  const handleSubmit = useCallback(
    (input: string): boolean => {
      // Optional input validation — reject garbage without scoring it
      if (def.validateInput && currentQRef.current) {
        if (!def.validateInput(currentQRef.current, input)) {
          return false;
        }
      }
      engine.submitAnswer(input);
      return true;
    },
    [engine.submitAnswer, def],
  );

  // --- Input placeholder ---
  const placeholder = (() => {
    if (isSequential) {
      const seq = def.sequential!;
      if (!seq.batchPlaceholder) return undefined;
      if (typeof seq.batchPlaceholder === 'string') {
        return seq.batchPlaceholder;
      }
      return currentQ ? seq.batchPlaceholder(currentQ) : undefined;
    }
    if (!def.inputPlaceholder) return undefined;
    if (typeof def.inputPlaceholder === 'string') return def.inputPlaceholder;
    return currentQ ? def.inputPlaceholder(currentQ) : undefined;
  })();

  // --- Render ---
  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  // Determine active/inactive buttons for rendering
  const activeButtons: ButtonsDef = def.buttons.kind === 'bidirectional'
    ? (dir === 'fwd' ? def.buttons.fwd : def.buttons.rev)
    : def.buttons;
  const inactiveButtons: ButtonsDef | null =
    def.buttons.kind === 'bidirectional'
      ? (dir === 'fwd' ? def.buttons.rev : def.buttons.fwd)
      : null;

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
        <PracticeTab
          summary={ps.summary}
          onStart={engine.start}
          onApplyRecommendation={ps.summary.showRecommendationButton &&
              groupScopeResult
            ? groupScopeResult.applyRecommendation
            : undefined}
          scopeValid={!groupScopeResult ||
            groupScopeResult.enabledGroups.size > 0}
          validationMessage='Select at least one group'
          scope={groupScopeResult && def.scope.kind === 'groups'
            ? (
              <GroupToggles
                labels={def.scope.groups.map((g) => g.label)}
                active={groupScopeResult.enabledGroups}
                onToggle={groupScopeResult.scopeActions.toggleGroup}
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
              {(def.stats.kind !== 'none' || ctrl.renderStats) &&
                <StatsLegend />}
            </>
          }
          baseline={learner.motorBaseline}
          onCalibrate={engine.startCalibration}
          activeTab={ps.activeTab}
          onTabSwitch={ps.setActiveTab}
        />
      )}

      {!isIdle && (
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
                ? 'Last question'
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
                  correct={round.roundCorrect}
                  median={round.roundMedian}
                />
              </QuizArea>
            )
            : isSequential
            ? (
              <QuizArea
                prompt={ctrl.renderPrompt ? undefined : promptText}
                controls={
                  <>
                    <SequentialSlots
                      expectedCount={currentQ && def.sequential
                        ? def.sequential.expectedCount(currentQ)
                        : 0}
                      entries={seqEntries}
                      evaluated={seqEvaluated}
                      correctTones={seqCorrectAnswer
                        ? seqCorrectAnswer.split(' ')
                        : null}
                    />
                    <ResponseButtons
                      buttonsDef={activeButtons}
                      onAnswer={handleSeqInput}
                      sequential
                      answered={engine.state.answered}
                    />
                    {def.sequential?.parseBatchInput && (
                      <AnswerInput
                        onSubmit={handleSeqBatch}
                        disabled={engine.state.answered}
                        placeholder={placeholder}
                      />
                    )}
                    <FeedbackDisplay
                      text={engine.state.feedbackText}
                      className={engine.state.feedbackClass}
                      time={engine.state.timeDisplayText || undefined}
                      hint={engine.state.hintText || undefined}
                      correct={engine.state.feedbackCorrect}
                      onNext={engine.state.answered
                        ? engine.nextQuestion
                        : undefined}
                    />
                  </>
                }
              >
                {currentQ && ctrl.renderPrompt
                  ? ctrl.renderPrompt(currentQ)
                  : null}
              </QuizArea>
            )
            : (
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
                      time={engine.state.timeDisplayText || undefined}
                      hint={engine.state.hintText || undefined}
                      correct={engine.state.feedbackCorrect}
                      onNext={engine.state.answered
                        ? engine.nextQuestion
                        : undefined}
                      label={engine.state.roundTimerExpired
                        ? 'Continue'
                        : 'Next'}
                    />
                  </>
                }
              >
                {currentQ && ctrl.renderPrompt
                  ? ctrl.renderPrompt(currentQ)
                  : null}
              </QuizArea>
            )}
        </>
      )}
    </>
  );
}
