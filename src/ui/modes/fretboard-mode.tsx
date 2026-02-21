// Fretboard Preact mode: identify notes on the fretboard.
// Parameterized by Instrument for multi-instrument reuse (guitar, ukulele).
// Custom SVG prompt (highlight position), heatmap stats, string + note scope.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type {
  Instrument,
  NoteFilter as NoteFilterType,
  RecommendationResult,
} from '../../types.ts';
import {
  displayNote,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
} from '../../music-data.ts';
import { DEFAULT_CONFIG } from '../../adaptive.ts';
import { createAdaptiveKeyHandler } from '../../quiz-engine.ts';
import { computeRecommendations } from '../../recommendations.ts';
import {
  buildRecommendationText,
  computePracticeSummary,
} from '../../mode-ui-state.ts';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getSpeedHeatmapColor,
} from '../../stats-display.ts';
import {
  computeNotePrioritization,
  createFretboardHelpers,
} from '../../quiz-fretboard-state.ts';
import { fretboardSVG } from '../../html-helpers.ts';
import { computeMedian } from '../../adaptive.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';

import { PianoNoteButtons } from '../buttons.tsx';
import { NoteFilter, StringToggles } from '../scope.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../mode-screen.tsx';
import { StatsToggle } from '../stats.tsx';
import { FeedbackDisplay } from '../quiz-ui.tsx';

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

const FB_QUIZ_HL = 'hsl(50, 100%, 50%)';

function setCircleFill(
  root: HTMLElement,
  string: number,
  fret: number,
  color: string,
): void {
  const circle = root.querySelector(
    'circle.fb-pos[data-string="' + string + '"][data-fret="' + fret + '"]',
  ) as SVGElement | null;
  if (circle) circle.style.fill = color;
}

function clearAll(root: HTMLElement): void {
  root.querySelectorAll<SVGElement>('.fb-pos').forEach((c) => {
    c.style.fill = '';
  });
}

// ---------------------------------------------------------------------------
// Hover card setup (imperative — positioning needs DOM measurement)
// ---------------------------------------------------------------------------

function setupHoverCard(
  wrapper: HTMLElement,
  instrument: Instrument,
  fb: ReturnType<typeof createFretboardHelpers>,
  selector: { getAutomaticity: (id: string) => number | null },
): () => void {
  const card = wrapper.querySelector('.hover-card') as HTMLElement | null;
  if (!card) return () => {};

  const svg = wrapper.querySelector('svg');
  if (!svg) return () => {};

  function onOver(e: MouseEvent) {
    const el = (e.target as Element).closest('.fb-pos');
    if (!el || !card) return;
    const s = parseInt(el.getAttribute('data-string')!);
    const f = parseInt(el.getAttribute('data-fret')!);
    const itemId = s + '-' + f;

    const q = fb.parseFretboardItem(itemId);
    const auto = selector.getAutomaticity(itemId);

    const noteEl = card.querySelector('.hc-note');
    if (noteEl) noteEl.textContent = displayNote(q.currentNote);

    const sfEl = card.querySelector('.hc-string-fret');
    if (sfEl) {
      sfEl.textContent = displayNote(instrument.stringNames[s]) +
        ' string, fret ' + f;
    }

    const detailEl = card.querySelector('.hc-detail');
    const barFill = card.querySelector('.hc-bar-fill') as HTMLElement | null;
    if (auto !== null) {
      const pct = Math.round(auto * 100);
      let label: string;
      if (auto > 0.8) label = 'Automatic';
      else if (auto > 0.6) label = 'Solid';
      else if (auto > 0.4) label = 'Getting there';
      else if (auto > 0.2) label = 'Fading';
      else label = 'Needs work';
      if (detailEl) detailEl.textContent = label + ' \u00B7 ' + pct + '%';
      if (barFill) {
        barFill.style.width = pct + '%';
        barFill.style.background = getAutomaticityColor(auto);
      }
    } else {
      if (detailEl) detailEl.textContent = 'Not seen yet';
      if (barFill) {
        barFill.style.width = '0%';
        barFill.style.background = '';
      }
    }

    const containerRect = wrapper.querySelector(
      '.fretboard-container',
    )!.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const cx = elRect.left + elRect.width / 2 - containerRect.left;
    const cy = elRect.top - containerRect.top;

    if (cy < 50) {
      card.style.left = cx + 'px';
      card.style.top = (cy + elRect.height + 6) + 'px';
      card.style.transform = 'translate(-50%, 0)';
    } else {
      card.style.left = cx + 'px';
      card.style.top = (cy - 6) + 'px';
      card.style.transform = 'translate(-50%, -100%)';
    }
    card.classList.add('visible');
  }

  function onOut(e: MouseEvent) {
    const el = (e.target as Element).closest('.fb-pos');
    if (el && card) card.classList.remove('visible');
  }

  svg.addEventListener('mouseover', onOver);
  svg.addEventListener('mouseout', onOut);

  return () => {
    svg.removeEventListener('mouseover', onOver);
    svg.removeEventListener('mouseout', onOut);
  };
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

export function FretboardMode(
  { instrument, container, navigateHome, onMount }: {
    instrument: Instrument;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const fb = useMemo(
    () =>
      createFretboardHelpers({
        notes: NOTES,
        naturalNotes: NATURAL_NOTES,
        stringOffsets: instrument.stringOffsets,
        fretCount: instrument.fretCount,
        noteMatchesInput,
      }),
    [instrument],
  );

  const allStrings = useMemo(
    () => Array.from({ length: instrument.stringCount }, (_, i) => i),
    [instrument],
  );

  const ALL_ITEMS = useMemo(() => {
    const items: string[] = [];
    for (const s of allStrings) {
      for (let f = 0; f < instrument.fretCount; f++) {
        items.push(s + '-' + f);
      }
    }
    return items;
  }, [allStrings, instrument]);

  // --- Scope ---
  const [scope, scopeActions] = useScopeState({
    kind: 'fretboard',
    instrument,
  });

  const enabledStrings = scope.kind === 'fretboard'
    ? scope.enabledStrings
    : new Set([instrument.defaultString]);
  const noteFilter: NoteFilterType = scope.kind === 'fretboard'
    ? scope.noteFilter
    : 'natural';

  const learner = useLearnerModel(instrument.storageNamespace, ALL_ITEMS);

  // --- Question state ---
  type Question = {
    currentString: number;
    currentFret: number;
    currentNote: string;
  };
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const currentQRef = useRef<Question | null>(null);

  // --- Key handler ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const noteFilterRef = useRef(noteFilter);
  noteFilterRef.current = noteFilter;

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => noteFilterRef.current !== 'natural',
      ),
    [],
  );

  // --- SVG refs ---
  const quizFbRef = useRef<HTMLDivElement>(null);
  const progressFbRef = useRef<HTMLDivElement>(null);

  // --- Generate SVG HTML once ---
  const svgHTML = useMemo(
    () =>
      fretboardSVG({
        stringCount: instrument.stringCount,
        fretCount: instrument.fretCount,
        fretMarkers: instrument.fretMarkers,
      }),
    [instrument],
  );

  // --- Recommendations ---
  const recommendation = useMemo((): RecommendationResult => {
    return computeRecommendations(
      learner.selector,
      allStrings,
      (s: number) => {
        const prefix = s + '-';
        return ALL_ITEMS.filter((id) => id.startsWith(prefix));
      },
      DEFAULT_CONFIG,
      { sortUnstarted: (a, b) => b.string - a.string },
    );
  }, [learner.selector, allStrings, ALL_ITEMS]);

  const recommendationText = useMemo(() => {
    if (!recommendation || recommendation.recommended.size === 0) return '';
    const naturalStats = learner.selector.getStringRecommendations(
      [...recommendation.recommended],
      (s: number) => fb.getItemIdsForString(s, 'natural'),
    );
    const pri = computeNotePrioritization(
      naturalStats,
      DEFAULT_CONFIG.expansionThreshold,
    );
    const extraParts = pri.suggestedFilter === 'natural'
      ? ['naturals first']
      : ['add sharps & flats'];
    return buildRecommendationText(
      recommendation,
      (s: number) => displayNote(instrument.stringNames[s]) + ' string',
      extraParts,
    );
  }, [recommendation, learner.selector, fb, instrument]);

  const applyRecommendation = useCallback(() => {
    if (!recommendation || !recommendation.enabled) return;
    // Check for note filter override
    const naturalStats = learner.selector.getStringRecommendations(
      [...recommendation.recommended],
      (s: number) => fb.getItemIdsForString(s, 'natural'),
    );
    const pri = computeNotePrioritization(
      naturalStats,
      DEFAULT_CONFIG.expansionThreshold,
    );
    const newNoteFilter: NoteFilterType = pri.suggestedFilter === 'natural'
      ? 'natural'
      : 'all';
    scopeActions.setScope({
      kind: 'fretboard',
      enabledStrings: recommendation.enabled,
      noteFilter: newNoteFilter,
    });
  }, [recommendation, learner.selector, fb, scopeActions]);

  const practicingLabel = useMemo(() => {
    const parts: string[] = [];
    if (enabledStrings.size < instrument.stringCount) {
      const names = Array.from(enabledStrings).sort((a, b) => b - a)
        .map((s) => displayNote(instrument.stringNames[s]));
      parts.push(
        names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
      );
    } else {
      parts.push('all strings');
    }
    if (noteFilter === 'natural') parts.push('natural notes');
    else if (noteFilter === 'sharps-flats') parts.push('sharps and flats');
    return parts.join(', ');
  }, [enabledStrings, noteFilter, instrument]);

  const sessionSummary = useMemo(() => {
    const count = enabledStrings.size;
    let filterLabel = 'all notes';
    if (noteFilter === 'natural') filterLabel = 'natural notes';
    else if (noteFilter === 'sharps-flats') filterLabel = 'sharps and flats';
    return count + ' string' + (count !== 1 ? 's' : '') + ' \u00B7 ' +
      filterLabel + ' \u00B7 60s';
  }, [enabledStrings, noteFilter]);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => {
      const s = scope.kind === 'fretboard'
        ? scope.enabledStrings
        : new Set([instrument.defaultString]);
      const nf = scope.kind === 'fretboard' ? scope.noteFilter : 'natural';
      return fb.getFretboardEnabledItems(s as Set<number>, nf);
    },

    checkAnswer: (itemId: string, input: string) => {
      const q = fb.parseFretboardItem(itemId);
      return fb.checkFretboardAnswer(q.currentNote, input);
    },

    onPresent: (itemId: string) => {
      const q = fb.parseFretboardItem(itemId);
      currentQRef.current = q;
      setCurrentQ(q);
      // Highlight the position on the quiz fretboard
      if (quizFbRef.current) {
        clearAll(quizFbRef.current);
        setCircleFill(
          quizFbRef.current,
          q.currentString,
          q.currentFret,
          FB_QUIZ_HL,
        );
      }
    },

    onAnswer: (itemId: string, result) => {
      if (quizFbRef.current) {
        const q = fb.parseFretboardItem(itemId);
        const color = result.correct
          ? 'var(--color-success)'
          : 'var(--color-error)';
        setCircleFill(
          quizFbRef.current,
          q.currentString,
          q.currentFret,
          color,
        );
      }
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
      if (quizFbRef.current) clearAll(quizFbRef.current);
    },

    getPracticingLabel: () => {
      const s = scope.kind === 'fretboard'
        ? scope.enabledStrings
        : new Set([instrument.defaultString]);
      const nf = scope.kind === 'fretboard' ? scope.noteFilter : 'natural';
      const parts: string[] = [];
      if (s.size < instrument.stringCount) {
        const names = Array.from(s).sort((a, b) => b - a)
          .map((i) => displayNote(instrument.stringNames[i]));
        parts.push(
          names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
        );
      } else {
        parts.push('all strings');
      }
      if (nf === 'natural') parts.push('natural notes');
      else if (nf === 'sharps-flats') parts.push('sharps and flats');
      return parts.join(', ');
    },
  }), [scope, noteHandler, fb, instrument]);

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

  // --- Tab + stats state ---
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [statsMode, setStatsMode] = useState('retention');

  // --- Practice summary ---
  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: ALL_ITEMS,
        selector: learner.selector,
        itemNoun: 'positions',
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
      ALL_ITEMS,
    ],
  );

  // --- Heatmap rendering (progress fretboard) ---
  useEffect(() => {
    const wrapper = progressFbRef.current;
    if (!wrapper) return;
    for (const s of allStrings) {
      for (let f = 0; f < instrument.fretCount; f++) {
        const itemId = s + '-' + f;
        if (statsMode === 'retention') {
          const auto = learner.selector.getAutomaticity(itemId);
          setCircleFill(wrapper, s, f, getAutomaticityColor(auto));
        } else {
          const stats = learner.selector.getStats(itemId);
          const ewma = stats ? stats.ewma : null;
          setCircleFill(
            wrapper,
            s,
            f,
            getSpeedHeatmapColor(ewma, learner.motorBaseline ?? undefined),
          );
        }
      }
    }
  }, [
    learner.selector,
    statsMode,
    engine.state.phase,
    allStrings,
    instrument,
    learner.motorBaseline,
  ]);

  // --- Hover card setup ---
  useEffect(() => {
    const wrapper = progressFbRef.current;
    if (!wrapper) return;
    return setupHoverCard(wrapper, instrument, fb, learner.selector);
  }, [instrument, fb, learner.selector]);

  // --- Stats legend ---
  const legendHTML = useMemo(
    () => buildStatsLegend(statsMode, learner.motorBaseline ?? undefined),
    [statsMode, learner.motorBaseline],
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
  const promptText = currentQ ? 'Name this note.' : '';

  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
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

  const baselineText = learner.motorBaseline
    ? 'Response time baseline: ' +
      (learner.motorBaseline / 1000).toFixed(1) + 's'
    : 'Response time baseline: 1s (default)';

  const answerCount = engine.state.roundAnswered;
  const countText = answerCount +
    (answerCount === 1 ? ' answer' : ' answers');

  return (
    <>
      <ModeTopBar title={instrument.name} onBack={navigateHome} />
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
              <>
                <StringToggles
                  stringNames={instrument.stringNames}
                  active={enabledStrings}
                  recommended={recommendation.expandIndex ?? undefined}
                  onToggle={scopeActions.toggleString}
                />
                <NoteFilter
                  mode={noteFilter}
                  onChange={(f) =>
                    scopeActions.setNoteFilter(f as NoteFilterType)}
                />
              </>
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
              <div
                ref={progressFbRef}
                // deno-lint-ignore react-no-danger
                dangerouslySetInnerHTML={{ __html: svgHTML }}
              />
              <div
                // deno-lint-ignore react-no-danger
                dangerouslySetInnerHTML={{ __html: legendHTML }}
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
        <div
          ref={quizFbRef}
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: svgHTML }}
        />
        <PianoNoteButtons
          onAnswer={handleNoteAnswer}
          hideAccidentals={noteFilter === 'natural'}
        />
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
