// Chord Spelling Preact mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.
// Sequential response: each note entered separately, final result is pass/fail.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type {
  ChordType,
  RecommendationResult,
  SequentialInputResult,
  SequentialState,
} from '../../types.ts';
import {
  CHORD_ROOTS,
  CHORD_TYPES,
  displayNote,
  getChordTones,
  spelledNoteMatchesInput,
  spelledNoteMatchesSemitone,
} from '../../music-data.ts';
import { createAdaptiveKeyHandler } from '../../quiz-engine.ts';
import { computeRecommendations } from '../../recommendations.ts';
import {
  buildRecommendationText,
  computePracticeSummary,
} from '../../mode-ui-state.ts';
import { computeMedian } from '../../adaptive.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';

import { NoteButtons } from '../buttons.tsx';
import { GroupToggles } from '../scope.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../mode-screen.tsx';
import type { StatsSelector } from '../stats.tsx';
import { StatsGrid, StatsToggle } from '../stats.tsx';
import { FeedbackDisplay } from '../quiz-ui.tsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function buildGroups(): { types: ChordType[]; label: string }[] {
  let maxGroup = 0;
  for (const ct of CHORD_TYPES) {
    if (ct.group > maxGroup) maxGroup = ct.group;
  }
  const result: { types: ChordType[]; label: string }[] = [];
  for (let g = 0; g <= maxGroup; g++) {
    const types = CHORD_TYPES.filter((t) => t.group === g);
    const label = types.map((t) => t.symbol || 'maj').join(', ');
    result.push({ types, label });
  }
  return result;
}

const SPELLING_GROUPS = buildGroups();

function getItemIdsForGroup(groupIndex: number): string[] {
  const types = SPELLING_GROUPS[groupIndex].types;
  const items: string[] = [];
  for (const root of CHORD_ROOTS) {
    for (const type of types) {
      items.push(root + ':' + type.name);
    }
  }
  return items;
}

const ALL_ITEMS: string[] = [];
for (const root of CHORD_ROOTS) {
  for (const type of CHORD_TYPES) {
    ALL_ITEMS.push(root + ':' + type.name);
  }
}

const ALL_GROUP_INDICES = SPELLING_GROUPS.map((_, i) => i);

const GRID_NOTES = CHORD_ROOTS.map((r) => ({
  name: r,
  displayName: r,
}));

const GRID_COL_LABELS = CHORD_TYPES.map((t) => t.symbol || 'maj');

// ---------------------------------------------------------------------------
// Question + sequential logic
// ---------------------------------------------------------------------------

type Question = {
  rootName: string;
  chordType: ChordType;
  tones: string[];
};

function parseItem(itemId: string): Question {
  const colonIdx = itemId.indexOf(':');
  const rootName = itemId.substring(0, colonIdx);
  const typeName = itemId.substring(colonIdx + 1);
  const chordType = CHORD_TYPES.find((t) => t.name === typeName)!;
  const tones = getChordTones(rootName, chordType);
  return { rootName, chordType, tones };
}

function initSequentialState(itemId: string): SequentialState {
  const item = parseItem(itemId);
  return { expectedCount: item.tones.length, entries: [] };
}

function handleInput(
  itemId: string,
  input: string,
  state: SequentialState,
): SequentialInputResult {
  const item = parseItem(itemId);
  const idx = state.entries.length;
  if (idx >= item.tones.length) {
    const allCorrect = state.entries.every((e) => e.correct);
    return {
      status: 'complete',
      correct: allCorrect,
      correctAnswer: item.tones.map(displayNote).join(' '),
    };
  }

  const expected = item.tones[idx];
  if (spelledNoteMatchesSemitone(expected, input)) {
    input = expected;
  }

  const isCorrect = spelledNoteMatchesInput(expected, input);
  const entries = [
    ...state.entries,
    {
      input,
      display: isCorrect ? displayNote(expected) : displayNote(input),
      correct: isCorrect,
    },
  ];

  const newState: SequentialState = {
    expectedCount: item.tones.length,
    entries,
  };

  if (entries.length === item.tones.length) {
    const allCorrect = entries.every((e) => e.correct);
    return {
      status: 'complete',
      correct: allCorrect,
      correctAnswer: item.tones.map(displayNote).join(' '),
    };
  }

  return { status: 'continue', state: newState };
}

function checkAnswer(itemId: string, input: string) {
  const allCorrect = input === '__correct__';
  const item = parseItem(itemId);
  const correctAnswer = item.tones.map(displayNote).join(' ');
  return { correct: allCorrect, correctAnswer };
}

function getGridItemId(
  rootName: string,
  colIdx: number,
): string | string[] {
  return rootName + ':' + CHORD_TYPES[colIdx].name;
}

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
// Mode handle
// ---------------------------------------------------------------------------

export type ModeHandle = {
  activate(): void;
  deactivate(): void;
};

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
  const [scope, scopeActions] = useScopeState({
    kind: 'groups',
    groups: SPELLING_GROUPS.map((g, i) => ({
      index: i,
      label: g.label,
      itemIds: getItemIdsForGroup(i),
    })),
    defaultEnabled: [0],
    storageKey: 'chordSpelling_enabledGroups',
    label: 'Chord types',
    sortUnstarted: (a, b) => a.string - b.string,
  });

  const enabledGroups = scope.kind === 'groups'
    ? scope.enabledGroups
    : new Set([0]);

  const learner = useLearnerModel('chordSpelling', ALL_ITEMS);

  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const g of enabledGroups) {
      items.push(...getItemIdsForGroup(g));
    }
    return items;
  }, [enabledGroups]);

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
      (i: number) => SPELLING_GROUPS[i].label,
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

  const practicingLabel = useMemo(() => {
    if (enabledGroups.size === SPELLING_GROUPS.length) return 'all chord types';
    const labels = [...enabledGroups].sort((a, b) => a - b)
      .map((g) => SPELLING_GROUPS[g].label);
    return labels.join(', ') + ' chords';
  }, [enabledGroups]);

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
    getEnabledItems: () => {
      const items: string[] = [];
      const groups = scope.kind === 'groups'
        ? scope.enabledGroups
        : new Set([0]);
      for (const g of groups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

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

    getPracticingLabel: () => {
      const groups = scope.kind === 'groups'
        ? scope.enabledGroups
        : new Set([0]);
      if (groups.size === SPELLING_GROUPS.length) return 'all chord types';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => SPELLING_GROUPS[g].label);
      return labels.join(', ') + ' chords';
    },
  }), [scope, noteHandler]);

  const engine = useQuizEngine(engineConfig, learner.selector);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Phase class sync ---
  useEffect(() => {
    const phase = engine.state.phase;
    const cls = phase === 'idle'
      ? 'phase-idle'
      : phase === 'round-complete'
      ? 'phase-round-complete'
      : 'phase-active';
    container.classList.remove(
      'phase-idle',
      'phase-active',
      'phase-round-complete',
    );
    container.classList.add(cls);
  }, [engine.state.phase, container]);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [statsMode, setStatsMode] = useState('retention');

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
      },
    });
  }, [engine, learner, noteHandler]);

  // --- Derived state ---
  const promptText = currentQ
    ? displayNote(currentQ.rootName) + currentQ.chordType.symbol
    : '';

  const handleNoteAnswer = useCallback(
    (note: string) => handleSequentialInput(note),
    [handleSequentialInput],
  );

  const roundContext = useMemo(() => {
    const s = engine.state;
    return practicingLabel + ' \u00B7 ' + s.masteredCount + ' / ' +
      s.totalEnabledCount + ' fluent';
  }, [
    engine.state.masteredCount,
    engine.state.totalEnabledCount,
    practicingLabel,
  ]);

  const roundCorrect = useMemo(() => {
    const s = engine.state;
    const dur = Math.round((s.roundDurationMs || 0) / 1000);
    return s.roundCorrect + ' / ' + s.roundAnswered + ' correct \u00B7 ' +
      dur + 's';
  }, [
    engine.state.roundCorrect,
    engine.state.roundAnswered,
    engine.state.roundDurationMs,
  ]);

  const roundMedian = useMemo(() => {
    const times = engine.state.roundResponseTimes;
    const median = computeMedian(times);
    return median !== null
      ? (median / 1000).toFixed(1) + 's median response time'
      : '';
  }, [engine.state.roundResponseTimes]);

  const statsSelector = useMemo((): StatsSelector => ({
    getAutomaticity: (id: string) => learner.selector.getAutomaticity(id),
    getStats: (id: string) => learner.selector.getStats(id),
  }), [learner.selector, engine.state.phase, statsMode]);

  const baselineText = learner.motorBaseline
    ? 'Response time baseline: ' +
      (learner.motorBaseline / 1000).toFixed(1) + 's'
    : 'Response time baseline: 1s (default)';

  const answerCount = engine.state.roundAnswered;
  const countText = answerCount +
    (answerCount === 1 ? ' answer' : ' answers');

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
            sessionSummary={sessionSummary}
            onStart={engine.start}
            onApplyRecommendation={summary.showRecommendationButton
              ? applyRecommendation
              : undefined}
            scope={
              <GroupToggles
                labels={SPELLING_GROUPS.map((g) => g.label)}
                active={enabledGroups}
                recommended={recommendation.expandIndex ?? undefined}
                onToggle={scopeActions.toggleGroup}
              />
            }
          />
        }
        progressContent={
          <div>
            <div class='baseline-info'>{baselineText}</div>
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
            <div class='stats-container'>
              <StatsGrid
                selector={statsSelector}
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
        context={practicingLabel}
        count={countText}
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
        <ChordSlots state={seqState} />
        <NoteButtons onAnswer={handleNoteAnswer} />
        <FeedbackDisplay
          text={engine.state.feedbackText}
          className={engine.state.feedbackClass}
          time={engine.state.timeDisplayText || undefined}
          hint={engine.state.hintText || undefined}
        />
        <RoundComplete
          context={roundContext}
          heading='Round complete'
          correct={roundCorrect}
          median={roundMedian}
          onContinue={engine.continueQuiz}
          onStop={engine.stop}
        />
      </QuizArea>
    </>
  );
}
