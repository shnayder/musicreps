// Key Signatures Preact mode: bidirectional key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb.
// 24 items (12 keys x 2 dirs), grouped by key group.

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { RecommendationResult } from '../../types.ts';
import { displayNote } from '../../music-data.ts';
import { createAdaptiveKeyHandler } from '../../quiz-engine.ts';
import { computeRecommendations } from '../../recommendations.ts';
import {
  buildRecommendationText,
  computePracticeSummary,
} from '../../mode-ui-state.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import { usePhaseClass } from '../../hooks/use-phase-class.ts';
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
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';

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
// Mode handle for navigation integration
// ---------------------------------------------------------------------------

export type ModeHandle = {
  activate(): void;
  deactivate(): void;
};

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
  // --- Scope ---
  const [scope, scopeActions] = useScopeState({
    kind: 'groups',
    groups: KEY_GROUPS.map((g, i) => ({
      index: i,
      label: g.label,
      itemIds: getItemIdsForGroup(i),
    })),
    defaultEnabled: [0, 1],
    storageKey: 'keySignatures_enabledGroups',
    label: 'Keys',
    sortUnstarted: (a, b) => a.string - b.string,
  });

  const enabledGroups = scope.kind === 'groups'
    ? scope.enabledGroups
    : new Set([0, 1]);

  // --- Core hooks ---
  const learner = useLearnerModel('keySignatures', ALL_ITEMS);

  // --- Enabled items ---
  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const g of enabledGroups) {
      items.push(...getItemIdsForGroup(g));
    }
    return items;
  }, [enabledGroups]);

  // --- Question state ---
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const currentQRef = useRef<Question | null>(null);

  // --- Key handlers ---
  const pendingSigDigitRef = useRef<string | null>(null);
  const pendingSigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => true,
      ),
    [],
  );

  // --- Recommendations ---
  const recommendation = useMemo((): RecommendationResult => {
    return computeRecommendations(
      learner.selector,
      ALL_GROUP_INDICES,
      getItemIdsForGroup,
      { expansionThreshold: 0.7 },
      { sortUnstarted: (a, b) => a.string - b.string },
    );
  }, [learner.selector]);

  const recommendationText = useMemo(() => {
    return buildRecommendationText(
      recommendation,
      (i: number) => KEY_GROUPS[i].label,
    );
  }, [recommendation]);

  const applyRecommendation = useCallback(() => {
    if (recommendation.enabled) {
      scopeActions.setScope({
        kind: 'groups',
        enabledGroups: recommendation.enabled,
      });
    }
  }, [recommendation, scopeActions]);

  // --- Practicing label ---
  const practicingLabel = useMemo(() => {
    if (enabledGroups.size === KEY_GROUPS.length) return 'all keys';
    const keys = [...enabledGroups].sort((a, b) => a - b)
      .flatMap((g) => KEY_GROUPS[g].keys)
      .map((k) => displayNote(k));
    return keys.join(', ');
  }, [enabledGroups]);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => {
      const items: string[] = [];
      const groups = scope.kind === 'groups'
        ? scope.enabledGroups
        : new Set([0, 1]);
      for (const g of groups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

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

    getPracticingLabel: () => {
      const groups = scope.kind === 'groups'
        ? scope.enabledGroups
        : new Set([0, 1]);
      if (groups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...groups].sort((a, b) => a - b)
        .flatMap((g) => KEY_GROUPS[g].keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },
  }), [scope, noteHandler]);

  const engine = useQuizEngine(engineConfig, learner.selector);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [statsMode, setStatsMode] = useState('retention');

  // --- Round summary ---
  const round = useRoundSummary(engine, learner, practicingLabel);

  // --- Stats selector ---
  const statsSel = useStatsSelector(
    learner.selector,
    engine.state.phase,
    statsMode,
  );

  // --- Practice summary ---
  const sessionSummary = enabledItems.length + ' items \u00B7 60s';
  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: ALL_ITEMS,
        selector: learner.selector,
        itemNoun: 'items',
        recommendation,
        recommendationText,
        sessionSummary,
        masteryText: engine.state.masteryText,
        showMastery: engine.state.showMastery,
      }),
    [
      learner.selector,
      recommendation,
      recommendationText,
      sessionSummary,
      engine.state.masteryText,
      engine.state.showMastery,
      engine.state.phase,
    ],
  );

  // --- Navigation handle ---
  useLayoutEffect(() => {
    onMount({
      activate() {
        learner.syncBaseline();
        engine.updateIdleMessage();
      },
      deactivate() {
        if (engine.state.phase !== 'idle') engine.stop();
        noteHandler.reset();
        if (pendingSigTimeoutRef.current) {
          clearTimeout(pendingSigTimeoutRef.current);
        }
        pendingSigDigitRef.current = null;
      },
    });
  }, [engine, learner, noteHandler]);

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
            sessionSummary={sessionSummary}
            onStart={engine.start}
            onApplyRecommendation={summary.showRecommendationButton
              ? applyRecommendation
              : undefined}
            scope={
              <GroupToggles
                labels={KEY_GROUPS.map((g) => g.label)}
                active={enabledGroups}
                recommended={recommendation.expandIndex ?? undefined}
                onToggle={scopeActions.toggleGroup}
              />
            }
          />
        }
        progressContent={
          <div>
            <div class='baseline-info'>{round.baselineText}</div>
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
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
        context={practicingLabel}
        count={round.countText}
        fluent={engine.state.masteredCount}
        total={engine.state.totalEnabledCount}
        isWarning={engine.timerWarning}
        isLastQuestion={engine.timerLastQuestion}
        onClose={engine.stop}
      />
      <QuizArea
        prompt={promptText}
        lastQuestion={engine.state.roundTimerExpired ? 'Last question' : ''}
      >
        <KeysigButtons hidden={dir === 'rev'} onAnswer={handleSigAnswer} />
        <NoteButtons hidden={dir === 'fwd'} onAnswer={handleNoteAnswer} />
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
      </QuizArea>
    </>
  );
}
