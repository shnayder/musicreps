// Key Signatures Preact mode: bidirectional key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb.
// 24 items (12 keys x 2 dirs), grouped by key group.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import { displayNote } from '../../music-data.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
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

import { KeysigButtons, NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../../ui/mode-screen.tsx';
import { StatsTable, StatsToggle } from '../../ui/stats.tsx';
import { FeedbackDisplay, KeyboardHint } from '../../ui/quiz-ui.tsx';
import {
  BaselineInfo,
  BUTTON_PROVIDER,
  SpeedCheck,
} from '../../ui/speed-check.tsx';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  getItemIdsForGroup,
  getQuestion,
  getStatsRows,
  KEY_GROUPS,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeySignaturesMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('keySignatures', ALL_ITEMS);

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
    groups: KEY_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'keySignatures_enabledGroups',
    scopeLabel: 'Keys',
    defaultEnabled: [0, 1],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...groups].sort((a, b) => a - b)
        .flatMap((g) => KEY_GROUPS[g].keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },
  });

  // --- Question state ---
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const currentQRef = useRef<Question | null>(null);

  // --- Key handlers ---
  const pendingSigDigitRef = useRef<string | null>(null);
  const pendingSigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => true,
        setPendingNote,
      ),
    [],
  );

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems,
    getPracticingLabel,

    checkAnswer: (_itemId: string, input: string) => {
      const q = currentQRef.current!;
      return checkAnswer(q, input);
    },

    onPresent: (itemId: string) => {
      const q = getQuestion(itemId);
      currentQRef.current = q;
      setCurrentQ(q);
    },

    handleKey: (
      e: KeyboardEvent,
      ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      const dir = currentQRef.current?.dir;
      if (dir === 'rev') {
        return noteHandler.handleKey(e);
      }
      // Forward: Enter commits pending '0' (only valid standalone digit)
      if (
        e.key === 'Enter' && pendingSigDigitRef.current !== null
      ) {
        e.preventDefault();
        clearTimeout(pendingSigTimeoutRef.current!);
        const d = pendingSigDigitRef.current;
        pendingSigDigitRef.current = null;
        pendingSigTimeoutRef.current = null;
        if (d === '0') ctx.submitAnswer('0');
        return true;
      }
      // Forward: number + #/b for key sig answers
      if (e.key >= '0' && e.key <= '7') {
        e.preventDefault();
        if (pendingSigTimeoutRef.current) {
          clearTimeout(pendingSigTimeoutRef.current);
        }
        pendingSigDigitRef.current = e.key;
        pendingSigTimeoutRef.current = setTimeout(() => {
          if (pendingSigDigitRef.current === '0') {
            ctx.submitAnswer('0');
          }
          pendingSigDigitRef.current = null;
          pendingSigTimeoutRef.current = null;
        }, 600);
        return true;
      }
      if (
        pendingSigDigitRef.current !== null &&
        (e.key === '#' || e.key === 'b')
      ) {
        e.preventDefault();
        clearTimeout(pendingSigTimeoutRef.current!);
        const answer = pendingSigDigitRef.current + e.key;
        pendingSigDigitRef.current = null;
        pendingSigTimeoutRef.current = null;
        ctx.submitAnswer(answer);
        return true;
      }
      return false;
    },

    onStart: () => {
      noteHandler.reset();
      if (pendingSigTimeoutRef.current) {
        clearTimeout(pendingSigTimeoutRef.current);
      }
      pendingSigDigitRef.current = null;
    },

    onStop: () => {
      noteHandler.reset();
      if (pendingSigTimeoutRef.current) {
        clearTimeout(pendingSigTimeoutRef.current);
      }
      pendingSigDigitRef.current = null;
    },
  }), [noteHandler, getEnabledItems, getPracticingLabel]);

  const engine = useQuizEngine(engineConfig, learner.selector);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Narrowing (keyboard match highlighting, reverse direction only) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

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

  // --- Round summary ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Stats selector ---
  const statsSel = useStatsSelector(
    learner.selector,
    engine.state.phase,
    statsMode,
  );

  // --- Practice summary ---
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
  const deactivateCleanup = useCallback(() => {
    noteHandler.reset();
    if (pendingSigTimeoutRef.current) {
      clearTimeout(pendingSigTimeoutRef.current);
    }
    pendingSigDigitRef.current = null;
  }, [noteHandler]);
  useModeLifecycle(onMount, engine, learner, setCalibrating, deactivateCleanup);

  // --- Derived state ---
  const dir = currentQ?.dir ?? 'fwd';
  const promptText = currentQ
    ? (currentQ.dir === 'fwd'
      ? displayNote(currentQ.root) + ' major'
      : currentQ.sigLabel + ' major')
    : '';

  // Button answer handlers
  const handleSigAnswer = useCallback(
    (sig: string) => engine.submitAnswer(sig),
    [engine.submitAnswer],
  );
  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Key Signatures' onBack={navigateHome} />
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
                labels={KEY_GROUPS.map((g) => g.label)}
                active={enabledGroups}
                recommended={recommendation.recommended}
                onToggle={scopeActions.toggleGroup}
              />
            }
          />
        }
        progressContent={
          <div>
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
            <BaselineInfo
              baseline={learner.motorBaseline}
              onRun={() => setCalibrating(true)}
            />
            <div class='stats-container'>
              <StatsTable
                selector={statsSel}
                rows={getStatsRows()}
                fwdHeader='Key→Sig'
                revHeader='Sig→Key'
                statsMode={statsMode}
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
              <KeysigButtons
                hidden={dir === 'rev'}
                onAnswer={handleSigAnswer}
              />
              <NoteButtons
                hidden={dir === 'fwd'}
                onAnswer={handleNoteAnswer}
                narrowing={dir === 'rev' ? noteNarrowing : undefined}
              />
              <KeyboardHint type={dir === 'rev' ? 'note' : null} />
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
