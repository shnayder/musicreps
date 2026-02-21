// Speed Tap Preact mode: tap all positions of a given note on the fretboard.
// Spatial response — user taps fretboard positions directly.
// Items: 7 natural or 12 chromatic notes, filtered by note selection.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { NoteFilter as NoteFilterType } from '../../types.ts';
import {
  displayNote,
  NATURAL_NOTES,
  NOTES,
  pickRandomAccidental,
  STRING_OFFSETS,
} from '../../music-data.ts';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getSpeedHeatmapColor,
} from '../../stats-display.ts';
import { fretboardSVG } from '../../html-helpers.ts';
import { computeMedian } from '../../adaptive.ts';
import { computePracticeSummary } from '../../mode-ui-state.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';

import { NoteButtons } from '../buttons.tsx';
import { NoteFilter } from '../scope.tsx';
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
// Constants and helpers
// ---------------------------------------------------------------------------

const noteNames: string[] = NOTES.map((n) => n.name);
const ALL_ITEMS = NOTES.map((n) => n.name);

const FB_TAP_NEUTRAL = 'hsl(30, 4%, 90%)';
const FB_TAP_CORRECT = 'hsl(90, 45%, 35%)';

function getNoteAtPosition(string: number, fret: number): string {
  const offset = STRING_OFFSETS[string];
  return noteNames[(offset + fret) % 12];
}

function getPositionsForNote(
  noteName: string,
): { string: number; fret: number }[] {
  const positions: { string: number; fret: number }[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= 12; f++) {
      if (getNoteAtPosition(s, f) === noteName) {
        positions.push({ string: s, fret: f });
      }
    }
  }
  return positions;
}

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

function clearAllCircles(root: HTMLElement): void {
  root.querySelectorAll<SVGElement>('.fb-pos').forEach((c) => {
    c.style.fill = '';
  });
}

function getEnabledNotes(filter: NoteFilterType): string[] {
  if (filter === 'natural') return NATURAL_NOTES.slice();
  if (filter === 'sharps-flats') {
    return NOTES.filter((n) => !NATURAL_NOTES.includes(n.name))
      .map((n) => n.name);
  }
  return NOTES.map((n) => n.name);
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

export function SpeedTapMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const [scope, scopeActions] = useScopeState({
    kind: 'note-filter',
    storageKey: 'speedTap_noteFilter',
  });

  const noteFilter: NoteFilterType = scope.kind === 'note-filter'
    ? scope.noteFilter
    : 'natural';

  const learner = useLearnerModel('speedTap', ALL_ITEMS);

  // --- Spatial state (mutable refs — updated during tap handling) ---
  const currentNoteRef = useRef<string | null>(null);
  const targetPosRef = useRef<{ string: number; fret: number }[]>([]);
  const foundPosRef = useRef(new Set<string>());
  const roundActiveRef = useRef(false);
  const wrongFlashTimeoutsRef = useRef(
    new Set<ReturnType<typeof setTimeout>>(),
  );
  const quizFbRef = useRef<HTMLDivElement>(null);
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  // --- Progress display ---
  const [progressText, setProgressText] = useState('');

  // CSS error color
  const colorErrorRef = useRef('#d32f2f');
  useEffect(() => {
    try {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-error').trim();
      if (val) colorErrorRef.current = val;
    } catch (_) { /* expected in tests */ }
  }, []);

  // --- Question state (for display) ---
  const [currentDisplayName, setCurrentDisplayName] = useState('');

  // --- Fretboard SVG ---
  const svgHTML = useMemo(() => fretboardSVG(), []);

  // --- Tap handler ---
  const handleTap = useCallback((e: MouseEvent) => {
    if (!roundActiveRef.current || !currentNoteRef.current) return;
    const el = (e.target as Element).closest(
      'circle.fb-pos[data-string][data-fret]',
    ) as SVGElement | null;
    if (!el) return;

    const s = parseInt(el.dataset!.string!);
    const f = parseInt(el.dataset!.fret!);
    const key = s + '-' + f;
    if (foundPosRef.current.has(key)) return;

    const wrapper = quizFbRef.current;
    if (!wrapper) return;

    const tappedNote = getNoteAtPosition(s, f);
    if (tappedNote === currentNoteRef.current) {
      foundPosRef.current.add(key);
      setCircleFill(wrapper, s, f, FB_TAP_CORRECT);
      setProgressText(
        foundPosRef.current.size + ' / ' + targetPosRef.current.length,
      );
      if (foundPosRef.current.size === targetPosRef.current.length) {
        roundActiveRef.current = false;
        engineSubmitRef.current('complete');
      }
    } else {
      setCircleFill(wrapper, s, f, colorErrorRef.current);
      const timeout = setTimeout(() => {
        wrongFlashTimeoutsRef.current.delete(timeout);
        if (!foundPosRef.current.has(key)) {
          setCircleFill(wrapper, s, f, FB_TAP_NEUTRAL);
        }
      }, 800);
      wrongFlashTimeoutsRef.current.add(timeout);
    }
  }, []);

  // Attach click handler to quiz fretboard
  useEffect(() => {
    const wrapper = quizFbRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('click', handleTap);
    return () => wrapper.removeEventListener('click', handleTap);
  }, [handleTap]);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => {
      const nf = scope.kind === 'note-filter' ? scope.noteFilter : 'natural';
      return getEnabledNotes(nf);
    },

    checkAnswer: (_itemId: string, input: string) => {
      const allFound = input === 'complete';
      return {
        correct: allFound,
        correctAnswer: displayNote(currentNoteRef.current!),
      };
    },

    onPresent: (itemId: string) => {
      const note = NOTES.find((n) => n.name === itemId);
      const name = note
        ? displayNote(pickRandomAccidental(note.displayName))
        : displayNote(itemId);
      const positions = getPositionsForNote(itemId);

      currentNoteRef.current = itemId;
      targetPosRef.current = positions;
      foundPosRef.current = new Set();
      roundActiveRef.current = true;
      setCurrentDisplayName(name);
      setProgressText('0 / ' + positions.length);

      // Set all circles to neutral
      const wrapper = quizFbRef.current;
      if (wrapper) {
        wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
        wrongFlashTimeoutsRef.current.clear();
        clearAllCircles(wrapper);
        wrapper.querySelectorAll<SVGElement>('.fb-pos').forEach((c) => {
          c.style.fill = FB_TAP_NEUTRAL;
        });
      }
    },

    onAnswer: (_itemId: string, result) => {
      roundActiveRef.current = false;
      if (!result.correct && quizFbRef.current) {
        for (const pos of targetPosRef.current) {
          const key = pos.string + '-' + pos.fret;
          if (!foundPosRef.current.has(key)) {
            setCircleFill(
              quizFbRef.current,
              pos.string,
              pos.fret,
              colorErrorRef.current,
            );
          }
        }
      }
    },

    onStart: () => {
      // Fretboard is always visible in Speed Tap (managed by CSS)
    },
    onStop: () => {
      roundActiveRef.current = false;
      wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
      wrongFlashTimeoutsRef.current.clear();
      currentNoteRef.current = null;
      setProgressText('');
      setCurrentDisplayName('');
      if (quizFbRef.current) clearAllCircles(quizFbRef.current);
    },

    getPracticingLabel: () => {
      const nf = scope.kind === 'note-filter' ? scope.noteFilter : 'natural';
      if (nf === 'all') return 'all notes';
      if (nf === 'sharps-flats') return 'sharps & flats';
      return 'natural notes';
    },

    getExpectedResponseCount: (itemId: string) => {
      return getPositionsForNote(itemId).length;
    },
  }), [scope]);

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
  const enabledNotes = useMemo(
    () => getEnabledNotes(noteFilter),
    [noteFilter],
  );
  const sessionSummary = enabledNotes.length + ' notes \u00B7 60s';

  const practicingLabel = useMemo(() => {
    if (noteFilter === 'all') return 'all notes';
    if (noteFilter === 'sharps-flats') return 'sharps & flats';
    return 'natural notes';
  }, [noteFilter]);

  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: ALL_ITEMS,
        selector: learner.selector,
        itemNoun: 'notes',
        recommendation: null,
        recommendationText: '',
        sessionSummary,
        masteryText: engine.state.masteryText,
        showMastery: engine.state.showMastery,
      }),
    [
      learner.selector,
      sessionSummary,
      engine.state.masteryText,
      engine.state.showMastery,
      engine.state.phase,
    ],
  );

  // --- Cleanup timeouts on unmount ---
  useEffect(() => {
    return () => {
      wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // --- Navigation handle ---
  useLayoutEffect(() => {
    onMount({
      activate() {
        learner.syncBaseline();
        engine.updateIdleMessage();
      },
      deactivate() {
        if (engine.state.phase !== 'idle') engine.stop();
      },
    });
  }, [engine, learner]);

  // --- Stats rendering ---
  const statsHTML = useMemo(() => {
    let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
    for (let i = 0; i < NOTES.length; i++) {
      html += '<th>' + displayNote(NOTES[i].name) + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (let j = 0; j < NOTES.length; j++) {
      if (statsMode === 'retention') {
        const auto = learner.selector.getAutomaticity(NOTES[j].name);
        html += '<td class="stats-cell" style="background:' +
          getAutomaticityColor(auto) + '"></td>';
      } else {
        const stats = learner.selector.getStats(NOTES[j].name);
        const posCount = getPositionsForNote(NOTES[j].name).length;
        const perPosMs = stats ? stats.ewma / posCount : null;
        html += '<td class="stats-cell" style="background:' +
          getSpeedHeatmapColor(perPosMs, learner.motorBaseline ?? undefined) +
          '"></td>';
      }
    }
    html += '</tr></tbody></table>';
    html += buildStatsLegend(statsMode, learner.motorBaseline ?? undefined);
    return html;
  }, [learner.selector, statsMode, engine.state.phase, learner.motorBaseline]);

  // --- Round complete derived ---
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

  const promptText = currentDisplayName ? 'Tap all ' + currentDisplayName : '';

  return (
    <>
      <ModeTopBar title='Speed Tap' onBack={navigateHome} />
      <TabbedIdle
        activeTab={activeTab}
        onTabSwitch={setActiveTab}
        practiceContent={
          <PracticeCard
            statusLabel={summary.statusLabel}
            statusDetail={summary.statusDetail}
            sessionSummary={sessionSummary}
            mastery={summary.showMastery ? summary.masteryText : undefined}
            onStart={engine.start}
            scope={
              <NoteFilter
                mode={noteFilter}
                onChange={(f) =>
                  scopeActions.setNoteFilter(f as NoteFilterType)}
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
            <div
              class='stats-container'
              // deno-lint-ignore react-no-danger
              dangerouslySetInnerHTML={{ __html: statsHTML }}
            />
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
        <div class='speed-tap-status'>
          <span class='speed-tap-progress'>{progressText}</span>
        </div>
        <div
          ref={quizFbRef}
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: svgHTML }}
        />
        <NoteButtons hidden onAnswer={() => {}} />
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
