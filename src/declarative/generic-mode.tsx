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
import type {
  AdaptiveSelector,
  ModeHandle,
  SpeedCheckFixture,
  SuggestionLine,
} from '../types.ts';

import { useLearnerModel } from '../hooks/use-learner-model.ts';
import { useGroupScope } from '../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  type PresentationPhase,
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
  NoteButtons,
  NumberButtons,
  NumeralButtons,
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
import { Card, Section, Stack } from '../ui/layout.tsx';
import {
  computeProgressColors,
  formatReviewDuration,
  progressBarColors,
  type ProgressSegment,
} from '../stats-display.ts';
import {
  type LevelProgressEntry,
  ModeTopBar,
  PracticeTab,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../ui/mode-screen.tsx';
import {
  LevelProgressCard,
  LevelToggles,
  PracticeConfig,
  SkillHeader,
  SuggestionLines,
} from '../ui/practice-config.tsx';
import { StatsGrid, StatsLegend, StatsTable } from '../ui/stats.tsx';
import { SPEED_LEVELS } from '../speed-levels.ts';
import {
  FeedbackDisplay,
  KeyboardHint,
  type KeyboardHintType,
} from '../ui/quiz-ui.tsx';
import { InteractiveFretboard } from '../ui/interactive-fretboard.tsx';
import { Text } from '../ui/text.tsx';
import { RepeatMark } from '../ui/repeat-mark.tsx';
import {
  IMPLEMENTED_TASK_TYPES,
  NOTE_BUTTON_CONFIG,
  SpeedCheck,
} from '../ui/speed-check.tsx';

import type {
  AnswerSpec,
  ButtonsDef,
  ComparisonStrategy,
  ModeController,
  ModeDefinition,
  SequentialEntryResult,
} from './types.ts';
import { useSequentialInput } from './use-sequential-input.ts';
import {
  type MultiTapInputHandle,
  useMultiTapInput,
} from './use-multi-tap-input.ts';

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
  isMultiTap: boolean,
  _itemId: string,
  input: string,
): { correct: boolean; correctAnswer: string } {
  // Both sequential and multiTap use the same sentinel format.
  if (isSequential || isMultiTap) {
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
    onAnswer,
    useFlats,
    narrowing,
    hideAccidentalsOverride,
    columnsOverride,
    feedback,
    answered,
  }: {
    buttonsDef: ButtonsDef;
    onAnswer: (input: string) => void;
    useFlats?: boolean;
    narrowing?: ReadonlySet<string> | null;
    hideAccidentalsOverride?: boolean;
    columnsOverride?: number;
    feedback?: ButtonFeedback | null;
    answered?: boolean;
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

function SequentialQuizArea<Q>(
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

function MultiTapQuizArea(
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

function StandardQuizArea<Q>(
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

type QuizActiveViewProps<Q> = {
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

function QuizActiveView<Q>(
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
              ? seq.handleCheck
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

// ---------------------------------------------------------------------------
// IdlePracticeView — rendered when the engine is idle
// ---------------------------------------------------------------------------

/** Resolve a group label that may be a string or a function. */
function resolveGroupLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

/** Build practice content for multi-level modes (groups). */
function GroupPracticeContent<Q>(
  { def, groupScopeResult }: {
    def: ModeDefinition<Q>;
    groupScopeResult: ReturnType<typeof useGroupScope>;
  },
) {
  const groupScope = def.scope.kind === 'groups' ? def.scope : null;
  if (!groupScope) return null;

  const groupLabels = groupScope.allGroupIds.map((id) => {
    const g = groupScope.groups.find((g) => g.id === id);
    return g ? resolveGroupLabel(g.label) : id;
  });

  return (
    <>
      <PracticeConfig
        mode={groupScopeResult.practiceMode}
        onModeChange={groupScopeResult.setPracticeMode}
        suggestedContent={
          <SuggestionLines lines={groupScopeResult.suggestionLines} />
        }
        customContent={
          <LevelToggles
            labels={groupLabels}
            groupIds={groupScope.allGroupIds}
            active={groupScopeResult.practiceMode === 'custom'
              ? groupScopeResult.enabledGroups
              : groupScopeResult.suggestedScope}
            onToggle={groupScopeResult.scopeActions.toggleGroup}
          />
        }
      />
    </>
  );
}

/** Build level progress cards for the progress tab. */
function LevelProgressCards<Q>(
  { def, learner, groupScopeResult }: {
    def: ModeDefinition<Q>;
    learner: ReturnType<typeof useLearnerModel>;
    groupScopeResult: ReturnType<typeof useGroupScope>;
  },
) {
  const groupScope = def.scope.kind === 'groups' ? def.scope : null;
  if (!groupScope) return null;
  return (
    <Stack gap='related' class='level-progress-cards'>
      {groupScope.allGroupIds.map((id) => {
        const g = groupScope.groups.find((g) => g.id === id);
        const itemIds = groupScope.getItemIdsForGroup(id);
        const colors = progressBarColors(learner.selector, itemIds);
        // Read speed + review timing from recommendation result (single source).
        const ls = groupScopeResult.recommendation.levelStatuses
          ?.find((s) => s.groupId === id);
        const sl = ls
          ? SPEED_LEVELS.find((l) => l.key === ls.speedLabel) ?? null
          : null;
        const pill = ls?.reviewInHours != null
          ? (ls.reviewStatus === 'soon'
            ? 'Review soon'
            : `Review in ${formatReviewDuration(ls.reviewInHours)}`)
          : undefined;
        const skipReason = groupScopeResult.skippedGroups.get(id);
        const status = skipReason === 'mastered'
          ? 'known' as const
          : skipReason === 'deferred'
          ? 'skipped' as const
          : 'normal' as const;
        const label = g
          ? resolveGroupLabel(
            g.longLabel ?? g.label,
          )
          : id;
        return (
          <LevelProgressCard
            key={id}
            label={label}
            statusLabel={sl?.label}
            statusColor={sl?.colorToken}
            pill={pill}
            colors={colors}
            status={status}
            onToggleKnown={() =>
              skipReason === 'mastered'
                ? groupScopeResult.scopeActions.unskipGroup(id)
                : groupScopeResult.scopeActions.skipGroup(id, 'mastered')}
            onToggleSkip={() =>
              skipReason === 'deferred'
                ? groupScopeResult.scopeActions.unskipGroup(id)
                : groupScopeResult.scopeActions.skipGroup(id, 'deferred')}
          />
        );
      })}
    </Stack>
  );
}

/** Compute a suggestion line for single-level (no groups) modes. */
function singleLevelSuggestion(
  selector: AdaptiveSelector,
  allItems: string[],
): SuggestionLine {
  const anySeen = allItems.some((id) => selector.getStats(id) !== null);
  if (!anySeen) return { verb: 'Start', levels: [] };
  if (selector.checkAllAutomatic(allItems)) {
    return { verb: 'All items automatic! Practice something else', levels: [] };
  }
  if (selector.checkNeedsReview(allItems)) {
    return { verb: 'Review', levels: [] };
  }
  return { verb: 'Practice', levels: [] };
}

function IdlePracticeView<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    groupScopeResult,
    ps,
    progressSegments,
    onCalibrate,
  }: {
    def: ModeDefinition<Q>;
    engine: ReturnType<typeof useQuizEngine>;
    learner: ReturnType<typeof useLearnerModel>;
    ctrl: ModeController<Q>;
    groupScopeResult: ReturnType<typeof useGroupScope> | null;
    ps: ReturnType<typeof usePracticeSummary>;
    progressSegments: ProgressSegment[];
    onCalibrate?: () => void;
  },
) {
  const hasGroups = def.scope.kind === 'groups' && groupScopeResult;
  const hasStats = def.stats.kind !== 'none' || !!ctrl.renderStats;
  const customItemCount = hasGroups &&
      groupScopeResult.practiceMode === 'custom'
    ? groupScopeResult.enabledItems.length
    : null;

  return (
    <PracticeTab
      onStart={engine.start}
      progressSegments={progressSegments}
      progressKind={hasGroups ? 'multi-level' : 'single-level'}
      description={def.description}
      scopeValid={!groupScopeResult || groupScopeResult.enabledGroups.size > 0}
      validationMessage='Select at least one level'
      startLabel={customItemCount != null
        ? `Practice (${customItemCount} ${
          customItemCount === 1 ? 'item' : 'items'
        })`
        : undefined}
      practiceContent={hasGroups
        ? (
          <GroupPracticeContent
            def={def}
            groupScopeResult={groupScopeResult}
          />
        )
        : (
          <Stack gap='group' class='practice-config'>
            <Text role='heading-section'>
              Recommendation
            </Text>
            <SuggestionLines
              lines={[singleLevelSuggestion(learner.selector, def.allItems)]}
            />
          </Stack>
        )}
      statsHeading={hasStats ? 'Speed by item' : undefined}
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
                  fwd2Header={def.stats.fwd2Header}
                  rev2Header={def.stats.rev2Header}
                />
              )}
            </>
          )}
          {hasStats && <StatsLegend />}
        </>
      }
      progressExtra={hasGroups
        ? (
          <Section heading='Level progress' gap='group'>
            <LevelProgressCards
              def={def}
              learner={learner}
              groupScopeResult={groupScopeResult}
            />
          </Section>
        )
        : undefined}
      baseline={onCalibrate ? learner.motorBaseline : undefined}
      onCalibrate={onCalibrate}
      activeTab={ps.activeTab}
      onTabSwitch={ps.setActiveTab}
      aboutContent={
        <AboutTab
          description={def.description}
          aboutDescription={def.aboutDescription}
          beforeAfter={def.beforeAfter}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// AboutTab — what you're automating + before/after + description
// ---------------------------------------------------------------------------

function AboutTab(
  { description, aboutDescription, beforeAfter }: {
    description: string;
    aboutDescription?: string;
    beforeAfter: {
      before: string[] | (() => string[]);
      after: string | (() => string);
    };
  },
) {
  const beforeLines = typeof beforeAfter.before === 'function'
    ? beforeAfter.before()
    : beforeAfter.before;
  const after = typeof beforeAfter.after === 'function'
    ? beforeAfter.after()
    : beforeAfter.after;

  return (
    <Stack gap='section' class='about-tab'>
      <Section heading="What you're automating" gap='group'>
        <Text role='body-secondary' as='p'>
          {description}
        </Text>
        <div class='about-columns'>
          <Card variant='well' class='about-col'>
            <Stack gap='related'>
              <Text role='heading-subsection' as='div'>
                Before
              </Text>
              {beforeLines.map((line, i) => (
                <p key={i} class='about-col-text'>{line}</p>
              ))}
            </Stack>
          </Card>
          <Card class='about-col about-col-after'>
            <Stack gap='related'>
              <Text role='heading-subsection' as='div'>
                After
              </Text>
              <p class='about-col-text'>{after}</p>
            </Stack>
          </Card>
        </div>
      </Section>
      {aboutDescription && (
        <Section heading='Why automate this?' gap='group'>
          <Text role='body' as='p'>
            {aboutDescription}
          </Text>
        </Section>
      )}
      <Text role='status' as='p' class='text-hint'>
        Start practicing on the{' '}
        <RepeatMark size={16} class='about-tab-tip-icon' /> tab below.
      </Text>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// GenericMode component
// ---------------------------------------------------------------------------

const EMPTY_GROUPS: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------------------
// Engine setup hook — refs, sequential input, engine config, engine creation
// ---------------------------------------------------------------------------

type GenericEngineSetup<Q> = {
  engine: ReturnType<typeof useQuizEngine>;
  currentQRef: { current: Q | null };
  seqInput: ReturnType<typeof useSequentialInput>;
  multiTapInput: MultiTapInputHandle;
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
  const isMultiTap = !!def.multiTap;
  const seqSubmitRef = useRef<(input: string) => void>(() => {});
  const seqInput = useSequentialInput(def, currentQRef, seqSubmitRef);
  const mtSubmitRef = useRef<(input: string) => void>(() => {});
  const multiTapInput = useMultiTapInput(def, currentQRef, mtSubmitRef);
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
        isMultiTap,
        seqInput,
        !!ctrl.handleKey,
      ),
    [def, !!ctrl.handleKey, isSequential, isMultiTap],
  );

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  seqSubmitRef.current = engine.submitAnswer;
  mtSubmitRef.current = engine.submitAnswer;
  if (ctrl.engineSubmitRef) ctrl.engineSubmitRef.current = engine.submitAnswer;

  return {
    engine,
    currentQRef,
    seqInput,
    multiTapInput,
    lastAnswerRef,
    isSequential,
  };
}

function resolveButtons<Q>(
  def: ModeDefinition<Q>,
  dir: 'fwd' | 'rev',
): ButtonsDef {
  if (def.buttons.kind === 'bidirectional') {
    return dir === 'fwd' ? def.buttons.fwd : def.buttons.rev;
  }
  return def.buttons;
}

function buildGroupScopeSpec<Q>(
  def: ModeDefinition<Q>,
  selector: ReturnType<typeof useLearnerModel>['selector'],
) {
  if (def.scope.kind !== 'groups') return null;
  return {
    groups: def.scope.groups,
    getItemIdsForGroup: def.scope.getItemIdsForGroup,
    allGroupIds: def.scope.allGroupIds,
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
  isMultiTap: boolean,
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
        isMultiTap,
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
  multiTapInput: MultiTapInputHandle,
  isSequential: boolean,
  container: HTMLElement,
  onMount: (handle: ModeHandle) => void,
  presentationPhase: PresentationPhase,
  deactivateCleanup?: () => void,
) {
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    return (!id || engine.state.phase === 'idle') ? null : def.getQuestion(id);
  }, [engine.state.currentItemId, engine.state.phase, def]);
  currentQRef.current = currentQ;
  if (isSequential) seqInput.resetOnItemChange(engine.state.currentItemId);
  if (def.multiTap) multiTapInput.resetOnItemChange(engine.state.currentItemId);

  usePhaseClass(container, presentationPhase, PHASE_FOCUS_TARGETS);
  const round = useRoundSummary(engine);
  const ps = usePracticeSummary({
    allItems: def.allItems,
    selector: learner.selector,
    engine,
    itemNoun: def.itemNoun,
    recommendation: groupScopeResult?.recommendation ?? null,
    recommendationText: groupScopeResult?.recommendationText ?? '',
  });
  useModeLifecycle(
    onMount,
    engine,
    learner,
    deactivateCleanup,
    ps.resetTabForActivation,
  );

  const handleSubmit = useCallback((input: string): boolean => {
    if (
      def.validateInput && currentQRef.current &&
      !def.validateInput(currentQRef.current, input)
    ) return false;
    engine.submitAnswer(input);
    return true;
  }, [engine.submitAnswer, def]);

  return { currentQ, round, ps, handleSubmit };
}

function buildSeqProps(seqInput: ReturnType<typeof useSequentialInput>) {
  return {
    entries: seqInput.seqEntries,
    evaluated: seqInput.seqEvaluated,
    correctAnswer: seqInput.seqCorrectAnswer,
    handleInput: seqInput.handleSeqInput,
    handleBatch: seqInput.handleSeqBatch,
    handleCheck: seqInput.handleCheck,
  };
}

// ---------------------------------------------------------------------------
// useSpeedCheckOverlay — local speed check state for mode components
// ---------------------------------------------------------------------------

type SpeedCheckOverlay = {
  speedCheck: SpeedCheckFixture | 'active' | null;
  setSpeedCheck: (v: SpeedCheckFixture | 'active' | null) => void;
  hasSpeedCheck: boolean;
  presentationPhase: PresentationPhase;
  deactivateCleanup: () => void;
};

function useSpeedCheckOverlay<Q>(
  engine: ReturnType<typeof useQuizEngine>,
  def: ModeDefinition<Q>,
  ctrl: ModeController<Q>,
): SpeedCheckOverlay {
  const [speedCheck, setSpeedCheck] = useState<
    SpeedCheckFixture | 'active' | null
  >(null);
  const hasSpeedCheck = IMPLEMENTED_TASK_TYPES.has(
    def.motorTaskType ?? 'note-button',
  );

  // Sync calibration fixture from engine's fixture injection into local state.
  useEffect(() => {
    if (engine.calibrationFixture) {
      setSpeedCheck(engine.calibrationFixture);
    }
  }, [engine.calibrationFixture]);

  const presentationPhase: PresentationPhase = speedCheck
    ? 'calibration'
    : engine.state.phase;

  const deactivateCleanup = useCallback(() => {
    setSpeedCheck(null);
    ctrl.deactivateCleanup?.();
  }, [ctrl.deactivateCleanup]);

  return {
    speedCheck,
    setSpeedCheck,
    hasSpeedCheck,
    presentationPhase,
    deactivateCleanup,
  };
}

// ---------------------------------------------------------------------------
// GenericModeBody — renders speed check overlay or idle/active views
// ---------------------------------------------------------------------------

type GenericModeBodyProps<Q> = {
  def: ModeDefinition<Q>;
  engine: ReturnType<typeof useQuizEngine>;
  learner: ReturnType<typeof useLearnerModel>;
  ctrl: ModeController<Q>;
  groupScopeResult: ReturnType<typeof useGroupScope> | null;
  ps: ReturnType<typeof usePracticeSummary>;
  sc: SpeedCheckOverlay;
  currentQ: Q | null;
  round: ReturnType<typeof useRoundSummary>;
  handleSubmit: (input: string) => boolean;
  seqInput: ReturnType<typeof useSequentialInput>;
  multiTapInput: MultiTapInputHandle;
  isSequential: boolean;
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  };
  navigateHome: () => void;
};

/** Compute progress colors for the SkillHeader progress bar.
 *  Uses shared computeProgressColors (same logic as home screen). */
function useProgressColors<Q>(
  def: ModeDefinition<Q>,
  learner: ReturnType<typeof useLearnerModel>,
  _phase: string,
  skippedGroups?: ReadonlyMap<string, unknown>,
): ProgressSegment[] {
  return useMemo(() => {
    if (def.scope.kind === 'groups') {
      const scope = def.scope;
      return computeProgressColors(learner.selector, {
        kind: 'groups',
        groups: scope.allGroupIds.map((id) => ({
          id,
          itemIds: scope.getItemIdsForGroup(id),
        })),
        skippedGroups,
      });
    }
    return computeProgressColors(learner.selector, {
      kind: 'items',
      itemIds: def.allItems,
    });
  }, [def, learner.selector, learner.selector.version, _phase, skippedGroups]);
}

/** Per-level progress bars for the round-complete screen.
 *  For group-based modes: one labeled bar per enabled group.
 *  For non-group modes: single unlabeled bar with all items.
 *  Only computed during round-complete phase to avoid unnecessary work. */
function useLevelBars<Q>(
  def: ModeDefinition<Q>,
  learner: ReturnType<typeof useLearnerModel>,
  _phase: string,
  groupScopeResult: ReturnType<typeof useGroupScope> | null,
): LevelProgressEntry[] {
  const enabledGroups = groupScopeResult?.enabledGroups;
  return useMemo(() => {
    if (_phase !== 'round-complete') return [];
    if (def.scope.kind === 'groups' && enabledGroups) {
      const scope = def.scope;
      return scope.allGroupIds
        .filter((id) => enabledGroups.has(id))
        .map((id) => {
          const g = scope.groups.find((g) => g.id === id);
          const label = g ? resolveGroupLabel(g.longLabel ?? g.label) : id;
          const colors = progressBarColors(
            learner.selector,
            scope.getItemIdsForGroup(id),
          );
          return { id, label, colors };
        });
    }
    const colors = progressBarColors(learner.selector, def.allItems);
    return colors.length > 0 ? [{ id: '_all', label: '', colors }] : [];
  }, [def, learner.selector, learner.selector.version, _phase, enabledGroups]);
}

/** Render SkillHeader (idle) or minimal ModeTopBar (active/calibration). */
function ModeHeader<Q>(
  { def, isIdle, totalReps, navigateHome }: {
    def: ModeDefinition<Q>;
    isIdle: boolean;
    totalReps: number;
    navigateHome: () => void;
  },
) {
  if (isIdle) {
    return (
      <SkillHeader
        modeId={def.id}
        title={def.name}
        totalReps={totalReps}
        onBack={navigateHome}
      />
    );
  }
  return <ModeTopBar modeId={def.id} title={def.name} showBack={false} />;
}

function GenericModeBody<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    groupScopeResult,
    ps,
    sc,
    currentQ,
    round,
    handleSubmit,
    seqInput,
    multiTapInput,
    isSequential,
    lastAnswerRef,
    navigateHome,
  }: GenericModeBodyProps<Q>,
) {
  const dir = currentQ && def.getDirection ? def.getDirection(currentQ) : 'fwd';
  const promptText = currentQ ? def.getPromptText(currentQ) : '';
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;
  const activeButtons = resolveButtons(def, dir);
  const phase = engine.state.phase; // cache-buster: progress + count refresh on phase change
  const isIdle = phase === 'idle' && !sc.speedCheck;
  const skipped = groupScopeResult?.skippedGroups;
  const progressColors = useProgressColors(def, learner, phase, skipped);
  const levelBars = useLevelBars(def, learner, phase, groupScopeResult);
  const totalReps = useMemo(() => {
    let sum = 0;
    for (const id of def.allItems) {
      const s = learner.selector.getStats(id);
      if (s) sum += s.sampleCount;
    }
    return sum;
  }, [def.allItems, learner.selector, learner.selector.version, phase]);

  if (isIdle) {
    return (
      <ScreenLayout>
        <LayoutHeader>
          <ModeHeader
            def={def}
            isIdle
            totalReps={totalReps}
            navigateHome={navigateHome}
          />
        </LayoutHeader>
        <IdlePracticeView
          def={def}
          engine={engine}
          learner={learner}
          ctrl={ctrl}
          groupScopeResult={groupScopeResult}
          ps={ps}
          progressSegments={progressColors}
          onCalibrate={sc.hasSpeedCheck
            ? () => sc.setSpeedCheck('active')
            : undefined}
        />
      </ScreenLayout>
    );
  }

  if (sc.speedCheck) {
    return (
      <SpeedCheck
        config={NOTE_BUTTON_CONFIG}
        fixture={typeof sc.speedCheck === 'object' ? sc.speedCheck : undefined}
        onComplete={(baseline) => {
          learner.applyBaseline(baseline);
          sc.setSpeedCheck(null);
        }}
        onCancel={() => sc.setSpeedCheck(null)}
      />
    );
  }

  return (
    <QuizActiveView
      def={def}
      engine={engine}
      ctrl={ctrl}
      currentQ={currentQ}
      round={round}
      levelBars={levelBars}
      handleSubmit={handleSubmit}
      seq={buildSeqProps(seqInput)}
      multiTapInput={multiTapInput}
      activeButtons={activeButtons}
      promptText={promptText}
      useFlats={useFlats}
      placeholder={getInputPlaceholder(def, currentQ, isSequential)}
      lastAnswerRef={lastAnswerRef}
    />
  );
}

// ---------------------------------------------------------------------------
// GenericMode component
// ---------------------------------------------------------------------------

export function GenericMode<Q>(
  { def, container, navigateHome, onMount }: {
    def: ModeDefinition<Q>;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const learner = useLearnerModel(
    def.namespace,
    def.allItems,
    def.motorTaskType,
    def.getExpectedResponseCount,
  );
  const groupScopeSpec = useMemo(
    () => buildGroupScopeSpec(def, learner.selector),
    [def, learner.selector],
  );
  const groupScopeResult = groupScopeSpec
    ? useGroupScope(groupScopeSpec)
    : null;
  const enabledGroups = groupScopeResult?.enabledGroups ?? EMPTY_GROUPS;
  const ctrl: ModeController<Q> = def.useController
    ? def.useController(enabledGroups)
    : {};
  const ctrlRef = useRef(ctrl);
  ctrlRef.current = ctrl;

  const {
    engine,
    currentQRef,
    seqInput,
    multiTapInput,
    lastAnswerRef,
    isSequential,
  } = useGenericEngine(
    def,
    ctrl,
    ctrlRef,
    groupScopeResult,
    learner,
    container,
  );
  const sc = useSpeedCheckOverlay(engine, def, ctrl);

  const { currentQ, round, ps, handleSubmit } = useGenericDerivedState(
    def,
    engine,
    learner,
    groupScopeResult,
    currentQRef,
    seqInput,
    multiTapInput,
    isSequential,
    container,
    onMount,
    sc.presentationPhase,
    sc.deactivateCleanup,
  );

  return (
    <GenericModeBody
      def={def}
      engine={engine}
      learner={learner}
      ctrl={ctrl}
      groupScopeResult={groupScopeResult}
      ps={ps}
      sc={sc}
      currentQ={currentQ}
      round={round}
      handleSubmit={handleSubmit}
      seqInput={seqInput}
      multiTapInput={multiTapInput}
      isSequential={isSequential}
      lastAnswerRef={lastAnswerRef}
      navigateHome={navigateHome}
    />
  );
}
