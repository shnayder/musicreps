// Speed Tap Preact mode: tap all positions of a given note on the fretboard.
// Spatial response — user taps fretboard positions directly.
// Items: 7 natural or 12 chromatic notes, filtered by note selection.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { ModeHandle, NoteFilter as NoteFilterType } from '../../types.ts';
import {
  displayNote,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
  NOTES,
  pickRandomAccidental,
} from '../../music-data.ts';
import { buildStatsLegend, getStatsCellColor } from '../../stats-display.ts';
import { fretboardSVG } from '../../html-helpers.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';

import { NoteButtons } from '../../ui/buttons.tsx';
import { NoteFilter } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../../ui/mode-screen.tsx';
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

import {
  ALL_ITEMS,
  getEnabledNotes,
  getNoteAtPosition,
  getPositionsForNote,
} from './logic.ts';

// ---------------------------------------------------------------------------
// UI constants and DOM helpers (not pure logic — kept in mode file)
// ---------------------------------------------------------------------------

const FB_TAP_CORRECT = 'hsl(122, 46%, 33%)';

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
  const svgHTML = useMemo(() => fretboardSVG({ tapTargets: true }), []);

  // --- Tap handler ---
  const handleTap = useCallback((e: MouseEvent) => {
    if (!roundActiveRef.current || !currentNoteRef.current) return;
    const el = (e.target as Element).closest(
      '.fb-tap[data-string][data-fret]',
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
          setCircleFill(wrapper, s, f, '');
        }
      }, 800);
      wrongFlashTimeoutsRef.current.add(timeout);
    }
  }, []);

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

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Derived question state (single source of truth) ---
  // Re-initialize spatial state when the item changes (sync during render
  // to keep display and refs in sync with engine state).
  const prevItemRef = useRef<string | null>(null);
  const currentItemId = engine.state.currentItemId;
  if (currentItemId !== prevItemRef.current) {
    prevItemRef.current = currentItemId;
    if (currentItemId && engine.state.phase !== 'idle') {
      const note = NOTES.find((n) => n.name === currentItemId);
      const name = note
        ? displayNote(pickRandomAccidental(note.displayName))
        : displayNote(currentItemId);
      const positions = getPositionsForNote(currentItemId);

      currentNoteRef.current = currentItemId;
      targetPosRef.current = positions;
      foundPosRef.current = new Set();
      roundActiveRef.current = true;
      setCurrentDisplayName(name);
      setProgressText('0 / ' + positions.length);
    }
  }

  // SVG reset when question changes (imperative DOM — must run as effect)
  useEffect(() => {
    const wrapper = quizFbRef.current;
    if (!wrapper) return;
    if (!currentItemId || engine.state.phase === 'idle') {
      clearAllCircles(wrapper);
      return;
    }
    wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
    wrongFlashTimeoutsRef.current.clear();
    clearAllCircles(wrapper);
  }, [currentItemId]);

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

  // --- Round summary (context, correct, median, baseline, count) ---
  const practicingLabel = useMemo(() => {
    if (noteFilter === 'all') return 'all notes';
    if (noteFilter === 'sharps-flats') return 'sharps & flats';
    return 'natural notes';
  }, [noteFilter]);

  const round = useRoundSummary(engine, practicingLabel);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'notes',
    recommendation: null,
    recommendationText: '',
  });

  // --- Cleanup timeouts on unmount ---
  useEffect(() => {
    return () => {
      wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // --- Navigation handle ---
  useModeLifecycle(onMount, engine, learner);

  // --- Stats rendering (custom — uses automaticity/speed heatmap, no StatsTable) ---
  const statsHTML = useMemo(() => {
    let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
    for (let i = 0; i < NOTES.length; i++) {
      html += '<th>' + displayNote(NOTES[i].name) + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (let j = 0; j < NOTES.length; j++) {
      const color = getStatsCellColor(learner.selector, NOTES[j].name);
      html += '<td class="stats-cell" style="background:' + color + '"></td>';
    }
    html += '</tr></tbody></table>';
    html += buildStatsLegend();
    return html;
  }, [
    learner.selector,
    engine.state.phase,
  ]);

  const promptText = currentDisplayName ? 'Tap all ' + currentDisplayName : '';

  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  return (
    <>
      <ModeTopBar
        modeId='speedTap'
        title='Speed Tap'
        description={MODE_DESCRIPTIONS.speedTap}
        beforeAfter={MODE_BEFORE_AFTER.speedTap}
        onBack={navigateHome}
        showBack={isIdle}
      />
      {isIdle && (
        <PracticeTab
          summary={ps.summary}
          onStart={engine.start}
          scopeValid={noteFilter !== 'none'}
          validationMessage='Select at least one note type'
          scope={
            <NoteFilter
              mode={noteFilter}
              onChange={(f) => scopeActions.setNoteFilter(f as NoteFilterType)}
            />
          }
          statsContent={
            <div
              // deno-lint-ignore react-no-danger
              dangerouslySetInnerHTML={{ __html: statsHTML }}
            />
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
                    <NoteButtons hidden onAnswer={() => {}} />
                    <FeedbackDisplay
                      text={engine.state.feedbackText}
                      className={engine.state.feedbackClass}
                      hint={engine.state.hintText || undefined}
                      correct={engine.state.feedbackCorrect}
                      onNext={engine.state.answered
                        ? engine.nextQuestion
                        : undefined}
                      label={engine.state.roundTimerExpired
                        ? 'Continue'
                        : 'Next'}
                    />
                  </>
                }
              >
                <div class='speed-tap-status'>
                  <span class='speed-tap-progress'>{progressText}</span>
                </div>
                <div
                  ref={quizFbRef}
                  onClick={handleTap}
                  // deno-lint-ignore react-no-danger
                  dangerouslySetInnerHTML={{ __html: svgHTML }}
                />
              </QuizArea>
            )}
        </>
      )}
    </>
  );
}
