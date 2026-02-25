// Chord Spelling Preact mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.
// Sequential response: each note entered separately, final result is pass/fail.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle, SequentialState } from '../../types.ts';
import { displayNote } from '../../music-data.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useGroupScope } from '../../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';

import { NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundComplete,
} from '../../ui/mode-screen.tsx';
import { StatsGrid, StatsLegend } from '../../ui/stats.tsx';
import {
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  getGridItemId,
  getItemIdsForGroup,
  GRID_COL_LABELS,
  GRID_NOTES,
  handleInput,
  initSequentialState,
  parseItem,
  SPELLING_GROUPS,
} from './logic.ts';

// ---------------------------------------------------------------------------
// ChordSlots component — shows sequential progress
// ---------------------------------------------------------------------------

function ChordSlots({ state }: { state: SequentialState | null }) {
  if (!state) return <div class='chord-slots' />;
  return (
    <div class='chord-slots'>
      {Array.from({ length: state.expectedCount }, (_, i) => {
        let cls = 'chord-slot';
        let content = '_';
        if (i < state.entries.length) {
          content = state.entries[i].display;
          cls += state.entries[i].correct ? ' correct' : ' wrong';
        } else if (i === state.entries.length) {
          cls += ' active';
        }
        return <span key={i} class={cls}>{content}</span>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChordSpellingMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('chordSpelling', ALL_ITEMS);

  // --- Scope + recommendations ---
  const {
    scopeActions,
    enabledGroups,
    practicingLabel,
    recommendation,
    recommendationText,
    applyRecommendation,
    getEnabledItems,
    getPracticingLabel,
  } = useGroupScope({
    groups: SPELLING_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'chordSpelling_enabledGroups',
    scopeLabel: 'Chord types',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === SPELLING_GROUPS.length) return 'all chord types';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => SPELLING_GROUPS[g].label);
      return labels.join(', ') + ' chords';
    },
  });

  // --- Question + sequential state (refs pre-declared for use in engineConfig) ---
  const currentItemRef = useRef<string | null>(null);
  const [seqState, setSeqState] = useState<SequentialState | null>(null);
  const seqStateRef = useRef<SequentialState | null>(null);

  // --- Key handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  // The key handler routes through sequential input, not engine.submitAnswer
  const handleSeqInputRef = useRef<(note: string) => void>(() => {});

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => handleSeqInputRef.current(note),
        () => true,
        setPendingNote,
      ),
    [],
  );

  // --- Sequential input handler ---
  const handleSequentialInput = useCallback((input: string) => {
    const itemId = currentItemRef.current;
    const state = seqStateRef.current;
    if (!itemId || !state) return;

    const result = handleInput(itemId, input, state);
    if (result.status === 'continue') {
      seqStateRef.current = result.state;
      setSeqState(result.state);
    } else {
      // Sequential complete — submit final result to engine.
      engineSubmitRef.current(result.correct ? '__correct__' : '__wrong__');
    }
  }, []);

  handleSeqInputRef.current = handleSequentialInput;

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems,
    getPracticingLabel,

    checkAnswer: (itemId: string, input: string) => {
      return checkAnswer(itemId, input);
    },

    handleKey: (
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      return noteHandler.handleKey(e);
    },

    onStart: () => noteHandler.reset(),
    onStop: () => {
      noteHandler.reset();
      seqStateRef.current = null;
      setSeqState(null);
    },
  }), [noteHandler, getEnabledItems, getPracticingLabel]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Derived question state (single source of truth) ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return parseItem(id);
  }, [engine.state.currentItemId, engine.state.phase]);

  // Re-initialize sequential state when question changes (sync during render
  // to avoid a one-frame flash of stale chord slots).
  const prevItemRef = useRef<string | null>(null);
  const currentItemId = engine.state.currentItemId;
  if (currentItemId !== prevItemRef.current) {
    prevItemRef.current = currentItemId;
    currentItemRef.current = currentItemId;
    if (currentItemId && engine.state.phase !== 'idle') {
      const newSeqState = initSequentialState(currentItemId);
      seqStateRef.current = newSeqState;
      setSeqState(newSeqState);
    } else {
      seqStateRef.current = null;
      setSeqState(null);
    }
  }

  // --- Narrowing (keyboard match highlighting) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'items',
    recommendation,
    recommendationText,
  });

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Derived state ---
  const promptText = currentQ
    ? displayNote(currentQ.rootName) + currentQ.chordType.symbol
    : '';

  const handleNoteAnswer = useCallback(
    (note: string) => handleSequentialInput(note),
    [handleSequentialInput],
  );

  const round = useRoundSummary(engine, practicingLabel);

  return (
    <>
      <ModeTopBar title='Chord Spelling' onBack={navigateHome} />
      <PracticeTab
        summary={ps.summary}
        onStart={engine.start}
        onApplyRecommendation={ps.summary.showRecommendationButton
          ? applyRecommendation
          : undefined}
        scope={
          <GroupToggles
            labels={SPELLING_GROUPS.map((g) => g.label)}
            active={enabledGroups}
            recommended={recommendation.recommended}
            onToggle={scopeActions.toggleGroup}
          />
        }
        statsContent={
          <>
            <StatsGrid
              selector={ps.statsSel}
              colLabels={GRID_COL_LABELS}
              getItemId={getGridItemId}
              statsMode={ps.statsMode}
              notes={GRID_NOTES}
              baseline={learner.motorBaseline ?? undefined}
            />
            <StatsLegend
              statsMode={ps.statsMode}
              baseline={learner.motorBaseline ?? undefined}
            />
          </>
        }
        statsMode={ps.statsMode}
        onStatsToggle={ps.setStatsMode}
        baseline={learner.motorBaseline}
        onCalibrate={engine.startCalibration}
        activeTab={ps.activeTab}
        onTabSwitch={ps.setActiveTab}
      />
      <QuizSession
        timeLeft={engine.timerText}
        timerPct={engine.timerPct}
        context={practicingLabel}
        count={round.countText}
        fluent={engine.state.masteredCount}
        total={engine.state.totalEnabledCount}
        isWarning={engine.timerWarning}
        isLastQuestion={engine.timerLastQuestion}
        onClose={engine.stop}
      />
      <QuizArea
        prompt={engine.calibrating ? '' : promptText}
        lastQuestion={engine.calibrating
          ? ''
          : (engine.state.roundTimerExpired ? 'Last question' : '')}
      >
        {engine.calibrating
          ? (
            <SpeedCheck
              provider={BUTTON_PROVIDER}
              fixture={engine.calibrationFixture}
              onComplete={(baseline) => {
                learner.applyBaseline(baseline);
                engine.endCalibration();
              }}
              onCancel={engine.endCalibration}
            />
          )
          : (
            <>
              <ChordSlots state={seqState} />
              <FeedbackBanner
                correct={engine.state.feedbackCorrect}
                answer={engine.state.feedbackDisplayAnswer}
              />
              <NoteButtons
                onAnswer={handleNoteAnswer}
                narrowing={noteNarrowing}
              />
              <KeyboardHint type='note' />
              <FeedbackDisplay
                text={engine.state.feedbackText}
                className={engine.state.feedbackClass}
                time={engine.state.timeDisplayText || undefined}
                hint={engine.state.hintText || undefined}
              />
              <RoundComplete
                context={round.roundContext}
                heading='Round complete'
                correct={round.roundCorrect}
                median={round.roundMedian}
                onContinue={engine.continueQuiz}
                onStop={engine.stop}
              />
            </>
          )}
      </QuizArea>
    </>
  );
}
