// Chord Spelling Preact mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.
// Sequential response: each note entered separately, final result is pass/fail.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle, SequentialState } from '../../types.ts';
import { displayNote } from '../../music-data.ts';
import { createAdaptiveKeyHandler } from '../../quiz-engine.ts';
import { computePracticeSummary } from '../../mode-ui-state.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useGroupScope } from '../../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import {
  useRoundSummary,
  useStatsSelector,
} from '../../hooks/use-round-summary.ts';

import { NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../../ui/mode-screen.tsx';
import { StatsGrid, StatsToggle } from '../../ui/stats.tsx';
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';
import {
  BaselineInfo,
  BUTTON_PROVIDER,
  SpeedCheck,
} from '../../ui/speed-check.tsx';

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
  type Question,
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

  // --- Sequential state ---
  const [seqState, setSeqState] = useState<SequentialState | null>(null);
  const seqStateRef = useRef<SequentialState | null>(null);

  // --- Question state ---
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const currentItemRef = useRef<string | null>(null);

  // --- Key handler ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  // The key handler routes through sequential input, not engine.submitAnswer
  const handleSeqInputRef = useRef<(note: string) => void>(() => {});

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => handleSeqInputRef.current(note),
        () => true,
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
      // Sequential complete — submit final result to engine
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

    onPresent: (itemId: string) => {
      const q = parseItem(itemId);
      currentItemRef.current = itemId;
      setCurrentQ(q);
      const newSeqState = initSequentialState(itemId);
      seqStateRef.current = newSeqState;
      setSeqState(newSeqState);
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

  const engine = useQuizEngine(engineConfig, learner.selector);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Calibration state ---
  const [calibrating, setCalibrating] = useState(false);

  // --- Phase class sync ---
  usePhaseClass(
    container,
    calibrating ? 'calibration' : engine.state.phase,
    PHASE_FOCUS_TARGETS,
  );

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [statsMode, setStatsMode] = useState('retention');

  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: ALL_ITEMS,
        selector: learner.selector,
        itemNoun: 'items',
        recommendation,
        recommendationText,
        masteryText: engine.state.masteryText,
        showMastery: engine.state.showMastery,
      }),
    [
      learner.selector,
      recommendation,
      recommendationText,
      engine.state.masteryText,
      engine.state.showMastery,
      engine.state.phase,
    ],
  );

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, setCalibrating, deactivateCleanup);

  // --- Derived state ---
  const promptText = currentQ
    ? displayNote(currentQ.rootName) + currentQ.chordType.symbol
    : '';

  const handleNoteAnswer = useCallback(
    (note: string) => handleSequentialInput(note),
    [handleSequentialInput],
  );

  const round = useRoundSummary(engine, practicingLabel);
  const statsSel = useStatsSelector(
    learner.selector,
    engine.state.phase,
    statsMode,
  );

  return (
    <>
      <ModeTopBar title='Chord Spelling' onBack={navigateHome} />
      <TabbedIdle
        activeTab={activeTab}
        onTabSwitch={setActiveTab}
        practiceContent={
          <PracticeCard
            statusLabel={summary.statusLabel}
            statusDetail={summary.statusDetail}
            recommendation={summary.recommendationText || undefined}
            mastery={summary.showMastery ? summary.masteryText : undefined}
            onStart={engine.start}
            onApplyRecommendation={summary.showRecommendationButton
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
          />
        }
        progressContent={
          <div>
            <BaselineInfo
              baseline={learner.motorBaseline}
              onRun={() => setCalibrating(true)}
            />
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
            <div class='stats-container'>
              <StatsGrid
                selector={statsSel}
                colLabels={GRID_COL_LABELS}
                getItemId={getGridItemId}
                statsMode={statsMode}
                notes={GRID_NOTES}
                baseline={learner.motorBaseline ?? undefined}
              />
            </div>
          </div>
        }
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
        prompt={calibrating ? '' : promptText}
        lastQuestion={calibrating
          ? ''
          : (engine.state.roundTimerExpired ? 'Last question' : '')}
      >
        {calibrating
          ? (
            <SpeedCheck
              provider={BUTTON_PROVIDER}
              onComplete={(baseline) => {
                learner.applyBaseline(baseline);
                setCalibrating(false);
              }}
              onCancel={() => setCalibrating(false)}
            />
          )
          : (
            <>
              <ChordSlots state={seqState} />
              <NoteButtons onAnswer={handleNoteAnswer} />
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
