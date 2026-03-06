// GenericMode — a single Preact component that interprets a ModeDefinition.
// Handles all hook composition, text-input keyboard handling, and
// phase-conditional rendering. Keyboard input is via a text field + Enter;
// buttons remain for tap/click on mobile.
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
  DegreeButtons,
  IntervalButtons,
  KeysigButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  PianoNoteButtons,
} from '../ui/buttons.tsx';
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
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../ui/speed-check.tsx';

import type { ButtonsDef, ModeController, ModeDefinition } from './types.ts';

// ---------------------------------------------------------------------------
// AnswerInput — text field for keyboard answers
// ---------------------------------------------------------------------------

function AnswerInput(
  { onSubmit, disabled, placeholder, onInvalid }: {
    onSubmit: (input: string) => void;
    disabled?: boolean;
    placeholder?: string;
    /** Called when user submits empty/whitespace-only input. */
    onInvalid?: () => void;
  },
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);

  // Auto-focus on mount and when re-enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // Stop propagation so the engine's document-level keydown
      // doesn't also fire (it would try to advance to next question).
      e.stopPropagation();

      const value = inputRef.current?.value.trim() ?? '';
      if (!value) {
        // Shake on empty submit
        setShake(true);
        setTimeout(() => setShake(false), 400);
        onInvalid?.();
        return;
      }
      onSubmit(value);
      if (inputRef.current) inputRef.current.value = '';
    },
    [onSubmit, onInvalid],
  );

  const cls = 'answer-input' + (shake ? ' answer-input-shake' : '');

  return (
    <input
      ref={inputRef}
      type='text'
      class={cls}
      placeholder={placeholder ?? 'Type answer, press Enter'}
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
  }: {
    buttonsDef: ButtonsDef;
    hidden?: boolean;
    onAnswer: (input: string) => void;
    useFlats?: boolean;
    narrowing?: ReadonlySet<string> | null;
    hideAccidentalsOverride?: boolean;
  },
) {
  switch (buttonsDef.kind) {
    case 'note':
      return (
        <NoteButtons
          hidden={hidden}
          onAnswer={onAnswer}
          useFlats={useFlats}
        />
      );
    case 'piano-note':
      return (
        <PianoNoteButtons
          onAnswer={onAnswer}
          hideAccidentals={hideAccidentalsOverride ??
            buttonsDef.hideAccidentals}
          narrowing={narrowing}
        />
      );
    case 'number':
      return (
        <NumberButtons
          start={buttonsDef.start}
          end={buttonsDef.end}
          hidden={hidden}
          onAnswer={(n) => onAnswer(String(n))}
        />
      );
    case 'degree':
      return <DegreeButtons hidden={hidden} onAnswer={onAnswer} />;
    case 'numeral':
      return <NumeralButtons hidden={hidden} onAnswer={onAnswer} />;
    case 'interval':
      return <IntervalButtons hidden={hidden} onAnswer={onAnswer} />;
    case 'keysig':
      return <KeysigButtons hidden={hidden} onAnswer={onAnswer} />;
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
      const q = currentQRef.current!;
      return def.checkAnswer(q, input);
    },

    onAnswer: (itemId, result) => {
      ctrlRef.current.onAnswer?.(itemId, result);
    },

    onStart: () => {
      ctrlRef.current.onStart?.();
    },

    onStop: () => {
      ctrlRef.current.onStop?.();
    },

    handleKey: ctrl.handleKey
      ? (e, ctx) => ctrlRef.current.handleKey!(e, ctx)
      : undefined,
  }), [def, !!ctrl.handleKey]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);

  // --- Derived question state ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return def.getQuestion(id);
  }, [engine.state.currentItemId, engine.state.phase, def]);
  currentQRef.current = currentQ;

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
    (input: string) => {
      // Optional input validation — reject garbage without scoring it
      if (def.validateInput && currentQRef.current) {
        if (!def.validateInput(currentQRef.current, input)) {
          return; // silently reject (shake animation handled by AnswerInput)
        }
      }
      engine.submitAnswer(input);
    },
    [engine.submitAnswer, def],
  );

  // --- Input placeholder ---
  const placeholder = (() => {
    if (!def.inputPlaceholder) return undefined;
    if (typeof def.inputPlaceholder === 'string') return def.inputPlaceholder;
    return currentQ ? def.inputPlaceholder(currentQ) : undefined;
  })();

  // --- Render ---
  const phase = engine.state.phase;
  const isIdle = phase === 'idle';
  const hasCustomKeyboard = !!ctrl.handleKey;

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
            : (
              <QuizArea
                prompt={ctrl.renderPrompt ? undefined : promptText}
                controls={
                  <>
                    <FeedbackBanner
                      correct={engine.state.feedbackCorrect}
                      answer={engine.state.feedbackDisplayAnswer}
                    />
                    {hasCustomKeyboard
                      ? <KeyboardHint type='note' />
                      : (
                        <AnswerInput
                          onSubmit={handleSubmit}
                          disabled={engine.state.answered}
                          placeholder={placeholder}
                        />
                      )}
                    <ResponseButtons
                      buttonsDef={activeButtons}
                      onAnswer={handleSubmit}
                      useFlats={useFlats}
                      narrowing={ctrl.narrowing}
                      hideAccidentalsOverride={ctrl.hideAccidentals}
                    />
                    {inactiveButtons && (
                      <ResponseButtons
                        buttonsDef={inactiveButtons}
                        hidden
                        onAnswer={handleSubmit}
                      />
                    )}
                    <FeedbackDisplay
                      text={engine.state.feedbackText}
                      className={engine.state.feedbackClass}
                      time={engine.state.timeDisplayText || undefined}
                      hint={engine.state.hintText || undefined}
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
            )}
        </>
      )}
    </>
  );
}
