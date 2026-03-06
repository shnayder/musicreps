// GenericMode — a single Preact component that interprets a ModeDefinition.
// Handles all hook composition, keyboard routing, and phase-conditional
// rendering that would otherwise be duplicated across every mode file.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../types.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
  numberNarrowingSet,
  PENDING_DELAY_AMBIGUOUS,
  PENDING_DELAY_UNAMBIGUOUS,
} from '../quiz-engine.ts';
import { ROMAN_NUMERALS } from '../music-data.ts';

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

import type { KeyboardHintDef, ModeDefinition, ResponseDef } from './types.ts';

// ---------------------------------------------------------------------------
// Keyboard handler helpers
// ---------------------------------------------------------------------------

type HandlerState = {
  pendingNote: string | null;
  pendingDigit: number | null;
};

/**
 * Build a keyboard handler function for a given ResponseDef.
 * Returns a handleKey function and a reset function.
 */
function useKeyboardHandler(
  _responseDef: ResponseDef,
  submitAnswer: (input: string) => void,
  setPendingNote: (n: string | null) => void,
  setPendingDigit: (d: number | null) => void,
  pendingState: { current: HandlerState },
) {
  // Note handler (for note, piano-note response types)
  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        submitAnswer,
        () => true,
        setPendingNote,
      ),
    [submitAnswer, setPendingNote],
  );

  // Digit buffer refs (for number response types)
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKey = useCallback(
    (
      e: KeyboardEvent,
      ctx: { submitAnswer: (input: string) => void },
      activeResponse: ResponseDef,
    ): boolean | void => {
      switch (activeResponse.kind) {
        case 'note':
        case 'piano-note':
          return noteHandler.handleKey(e);

        case 'number': {
          const { start, end } = activeResponse;
          // Enter commits pending digit
          if (
            e.key === 'Enter' && pendingState.current.pendingDigit !== null
          ) {
            e.preventDefault();
            clearTimeout(pendingTimeoutRef.current!);
            const d = pendingState.current.pendingDigit;
            pendingState.current.pendingDigit = null;
            setPendingDigit(null);
            pendingTimeoutRef.current = null;
            if (d >= start) ctx.submitAnswer(String(d));
            return true;
          }
          // Digit input
          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const d = parseInt(e.key);
            if (pendingState.current.pendingDigit !== null) {
              const num = pendingState.current.pendingDigit * 10 + d;
              clearTimeout(pendingTimeoutRef.current!);
              pendingState.current.pendingDigit = null;
              setPendingDigit(null);
              pendingTimeoutRef.current = null;
              if (num >= start && num <= end) ctx.submitAnswer(String(num));
              return true;
            }
            // Check if digit could be a prefix of multi-digit number
            const couldBePrefix = d * 10 <= end;
            if (!couldBePrefix || (d >= start && d > 1)) {
              if (d >= start && d <= end) ctx.submitAnswer(String(d));
            } else {
              pendingState.current.pendingDigit = d;
              setPendingDigit(d);
              const delay = numberNarrowingSet(d, end, start)!.size > 1
                ? PENDING_DELAY_AMBIGUOUS
                : PENDING_DELAY_UNAMBIGUOUS;
              pendingTimeoutRef.current = setTimeout(() => {
                if (pendingState.current.pendingDigit !== null) {
                  const v = pendingState.current.pendingDigit;
                  if (v >= start) ctx.submitAnswer(String(v));
                  pendingState.current.pendingDigit = null;
                  setPendingDigit(null);
                  pendingTimeoutRef.current = null;
                }
              }, delay);
            }
            return true;
          }
          return false;
        }

        case 'degree':
          if (e.key >= '1' && e.key <= '7') {
            e.preventDefault();
            ctx.submitAnswer(e.key);
            return true;
          }
          return false;

        case 'numeral':
          if (e.key >= '1' && e.key <= '7') {
            e.preventDefault();
            ctx.submitAnswer(ROMAN_NUMERALS[parseInt(e.key) - 1]);
            return true;
          }
          return false;

        case 'keysig': {
          // digit + #/b keysig handler
          if (
            e.key === 'Enter' && pendingState.current.pendingDigit !== null
          ) {
            e.preventDefault();
            clearTimeout(pendingTimeoutRef.current!);
            const d = pendingState.current.pendingDigit;
            pendingState.current.pendingDigit = null;
            setPendingDigit(null);
            pendingTimeoutRef.current = null;
            if (d === 0) ctx.submitAnswer('0');
            return true;
          }
          if (e.key >= '0' && e.key <= '7') {
            e.preventDefault();
            if (pendingTimeoutRef.current) {
              clearTimeout(pendingTimeoutRef.current);
            }
            pendingState.current.pendingDigit = parseInt(e.key);
            setPendingDigit(parseInt(e.key));
            pendingTimeoutRef.current = setTimeout(() => {
              if (pendingState.current.pendingDigit === 0) {
                ctx.submitAnswer('0');
              }
              pendingState.current.pendingDigit = null;
              setPendingDigit(null);
              pendingTimeoutRef.current = null;
            }, 600);
            return true;
          }
          if (
            pendingState.current.pendingDigit !== null &&
            (e.key === '#' || e.key === 'b')
          ) {
            e.preventDefault();
            clearTimeout(pendingTimeoutRef.current!);
            const answer = pendingState.current.pendingDigit + e.key;
            pendingState.current.pendingDigit = null;
            setPendingDigit(null);
            pendingTimeoutRef.current = null;
            ctx.submitAnswer(answer);
            return true;
          }
          return false;
        }

        case 'interval':
          // No keyboard support for interval buttons
          return false;
      }
    },
    [noteHandler, setPendingDigit, pendingState],
  );

  const reset = useCallback(() => {
    noteHandler.reset();
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingState.current.pendingDigit = null;
    setPendingDigit(null);
  }, [noteHandler, setPendingDigit, pendingState]);

  return { handleKey, reset };
}

// ---------------------------------------------------------------------------
// Response buttons renderer
// ---------------------------------------------------------------------------

function ResponseButtons(
  { responseDef, hidden, onAnswer, narrowing, useFlats }: {
    responseDef: ResponseDef;
    hidden?: boolean;
    onAnswer: (input: string) => void;
    narrowing?: ReadonlySet<string> | null;
    useFlats?: boolean;
  },
) {
  switch (responseDef.kind) {
    case 'note':
      return (
        <NoteButtons
          hidden={hidden}
          onAnswer={onAnswer}
          useFlats={useFlats}
          narrowing={!hidden ? narrowing : undefined}
        />
      );
    case 'piano-note':
      return (
        <PianoNoteButtons
          onAnswer={onAnswer}
          hideAccidentals={responseDef.hideAccidentals}
          narrowing={narrowing}
        />
      );
    case 'number':
      return (
        <NumberButtons
          start={responseDef.start}
          end={responseDef.end}
          hidden={hidden}
          onAnswer={(n) => onAnswer(String(n))}
          narrowing={!hidden ? narrowing : undefined}
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
  // Build the spec object outside the hook call so TypeScript can narrow.
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
  // Note: hooks must be called unconditionally — useGroupScope handles
  // the no-scope case internally via a dummy spec. For the prototype,
  // we use conditional calls since scope.kind is stable for a mode's lifetime.
  const groupScopeResult = groupScopeSpec
    ? useGroupScope(groupScopeSpec)
    : null;

  // --- Question state ---
  const currentQRef = useRef<Q | null>(null);

  // --- Pending input state (for keyboard narrowing) ---
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [pendingDigit, setPendingDigit] = useState<number | null>(null);
  const pendingStateRef = useRef<HandlerState>({
    pendingNote: null,
    pendingDigit: null,
  });

  // --- Submit ref (for keyboard handler indirection) ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  // --- Keyboard handler ---
  const submitViaRef = useCallback(
    (input: string) => engineSubmitRef.current(input),
    [],
  );
  const { handleKey, reset: resetHandler } = useKeyboardHandler(
    def.answer.kind === 'bidirectional' ? def.answer.fwd : def.answer,
    submitViaRef,
    setPendingNote,
    setPendingDigit,
    pendingStateRef,
  );

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

    handleKey: (
      e: KeyboardEvent,
      ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      // For bidirectional modes, determine active response from direction
      const q = currentQRef.current;
      let activeResponse: ResponseDef;
      if (def.answer.kind === 'bidirectional' && q && def.getDirection) {
        const dir = def.getDirection(q);
        activeResponse = dir === 'fwd' ? def.answer.fwd : def.answer.rev;
      } else if (def.answer.kind === 'bidirectional') {
        activeResponse = def.answer.fwd;
      } else {
        activeResponse = def.answer;
      }
      return handleKey(e, ctx, activeResponse);
    },

    onStart: () => resetHandler(),
    onStop: () => resetHandler(),
  }), [def, handleKey, resetHandler]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

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

  // --- Narrowing ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  const numEnd = (() => {
    if (def.answer.kind === 'bidirectional') {
      const r = dir === 'fwd' ? def.answer.fwd : def.answer.rev;
      return r.kind === 'number' ? r.end : 0;
    }
    return def.answer.kind === 'number' ? def.answer.end : 0;
  })();
  const numStart = (() => {
    if (def.answer.kind === 'bidirectional') {
      const r = dir === 'fwd' ? def.answer.fwd : def.answer.rev;
      return r.kind === 'number' ? r.start : 0;
    }
    return def.answer.kind === 'number' ? def.answer.start : 0;
  })();

  const numNarrowing = useMemo(
    () =>
      engine.state.answered
        ? null
        : numberNarrowingSet(pendingDigit, numEnd, numStart),
    [pendingDigit, engine.state.answered, numEnd, numStart],
  );

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
  const deactivateCleanup = useCallback(() => resetHandler(), [resetHandler]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Prompt text ---
  const promptText = currentQ ? def.getPromptText(currentQ) : '';

  // --- UseFlats for note buttons ---
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;

  // --- Answer handler ---
  const handleAnswer = useCallback(
    (input: string) => engine.submitAnswer(input),
    [engine.submitAnswer],
  );

  // --- Keyboard hint ---
  const keyboardHint: KeyboardHintDef = (() => {
    if (!def.getKeyboardHint) {
      // Infer from response type
      const activeResp = def.answer.kind === 'bidirectional'
        ? (dir === 'fwd' ? def.answer.fwd : def.answer.rev)
        : def.answer;
      if (activeResp.kind === 'note' || activeResp.kind === 'piano-note') {
        return 'note';
      }
      if (activeResp.kind === 'number') {
        return activeResp.start === 0 ? 'number-0-11' : 'number-1-12';
      }
      return null;
    }
    if (typeof def.getKeyboardHint === 'function') {
      return def.getKeyboardHint(dir);
    }
    return def.getKeyboardHint;
  })();

  // --- Render ---
  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  // Determine active response for button rendering
  const activeResp: ResponseDef = def.answer.kind === 'bidirectional'
    ? (dir === 'fwd' ? def.answer.fwd : def.answer.rev)
    : def.answer;
  const inactiveResp: ResponseDef | null = def.answer.kind === 'bidirectional'
    ? (dir === 'fwd' ? def.answer.rev : def.answer.fwd)
    : null;

  // Determine narrowing for the active response
  const activeNarrowing = activeResp.kind === 'note' ||
      activeResp.kind === 'piano-note'
    ? noteNarrowing
    : activeResp.kind === 'number'
    ? numNarrowing
    : null;

  return (
    <>
      <ModeTopBar
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
              {def.stats.kind !== 'none' && <StatsLegend />}
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
                prompt={promptText}
                controls={
                  <>
                    <FeedbackBanner
                      correct={engine.state.feedbackCorrect}
                      answer={engine.state.feedbackDisplayAnswer}
                    />
                    <ResponseButtons
                      responseDef={activeResp}
                      onAnswer={handleAnswer}
                      narrowing={activeNarrowing}
                      useFlats={useFlats}
                    />
                    {inactiveResp && (
                      <ResponseButtons
                        responseDef={inactiveResp}
                        hidden
                        onAnswer={handleAnswer}
                      />
                    )}
                    <KeyboardHint type={keyboardHint} />
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
              />
            )}
        </>
      )}
    </>
  );
}
