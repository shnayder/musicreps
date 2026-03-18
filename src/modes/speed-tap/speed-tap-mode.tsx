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
import { displayNote, NOTES, pickRandomAccidental } from '../../music-data.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../mode-catalog.ts';
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
import { Text } from '../../ui/text.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../../ui/mode-screen.tsx';
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';

import {
  ALL_ITEMS,
  getEnabledNotes,
  getNoteAtPosition,
  getPositionsForNote,
} from './logic.ts';

// ---------------------------------------------------------------------------
// UI constants and DOM helpers (not pure logic — kept in mode file)
// ---------------------------------------------------------------------------

const FB_TAP_CORRECT = 'hsl(125, 48%, 33%)';

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
// Engine config builder
// ---------------------------------------------------------------------------

function buildSpeedTapConfig(
  scope: ReturnType<typeof useScopeState>[0],
  currentNoteRef: { current: string | null },
  quizFbRef: { current: HTMLDivElement | null },
  targetPosRef: { current: { string: number; fret: number }[] },
  foundPosRef: { current: Set<string> },
  roundActiveRef: { current: boolean },
  wrongFlashTimeoutsRef: { current: Set<ReturnType<typeof setTimeout>> },
  colorError: string,
  setProgressText: (text: string) => void,
  setCurrentDisplayName: (name: string) => void,
): QuizEngineConfig {
  return {
    getEnabledItems: () => {
      const nf = scope.kind === 'note-filter' ? scope.noteFilter : 'natural';
      return getEnabledNotes(nf);
    },
    checkAnswer: (_itemId: string, input: string) => ({
      correct: input === 'complete',
      correctAnswer: displayNote(currentNoteRef.current!),
    }),
    onAnswer: (_itemId: string, result) => {
      roundActiveRef.current = false;
      if (!result.correct && quizFbRef.current) {
        for (const pos of targetPosRef.current) {
          const key = pos.string + '-' + pos.fret;
          if (!foundPosRef.current.has(key)) {
            setCircleFill(quizFbRef.current, pos.string, pos.fret, colorError);
          }
        }
      }
    },
    onStart: () => {},
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
    getExpectedResponseCount: (itemId: string) =>
      getPositionsForNote(itemId).length,
  };
}

// ---------------------------------------------------------------------------
// Sync helper — update spatial state when engine moves to a new item
// ---------------------------------------------------------------------------

function syncQuestionState(
  itemId: string | null,
  phase: string,
  currentNoteRef: { current: string | null },
  targetPosRef: { current: { string: number; fret: number }[] },
  foundPosRef: { current: Set<string> },
  roundActiveRef: { current: boolean },
  setCurrentDisplayName: (name: string) => void,
  setProgressText: (text: string) => void,
): void {
  if (itemId && phase !== 'idle') {
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
  }
}

// ---------------------------------------------------------------------------
// Stats HTML builder
// ---------------------------------------------------------------------------

function buildSpeedTapStatsHTML(
  selector: ReturnType<typeof useLearnerModel>['selector'],
): string {
  let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
  for (let i = 0; i < NOTES.length; i++) {
    html += '<th>' + displayNote(NOTES[i].name) + '</th>';
  }
  html += '</tr></thead><tbody><tr>';
  for (let j = 0; j < NOTES.length; j++) {
    html += '<td class="stats-cell" style="background:' +
      getStatsCellColor(selector, NOTES[j].name) + '"></td>';
  }
  html += '</tr></tbody></table>' + buildStatsLegend();
  return html;
}

// ---------------------------------------------------------------------------
// Active quiz view sub-component
// ---------------------------------------------------------------------------

type SpeedTapActiveProps = {
  engine: ReturnType<typeof useQuizEngine>;
  round: ReturnType<typeof useRoundSummary>;
  practicingLabel: string;
  progressText: string;
  promptText: string;
  svgHTML: string;
  quizFbRef: { current: HTMLDivElement | null };
  handleTap: (e: MouseEvent) => void;
};

function SpeedTapActiveView(
  {
    engine,
    round,
    practicingLabel,
    progressText,
    promptText,
    svgHTML,
    quizFbRef,
    handleTap,
  }: SpeedTapActiveProps,
) {
  const phase = engine.state.phase;
  return (
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
            ? (engine.state.answered ? 'Time is up' : 'Last question')
            : ''}
          onClose={engine.stop}
        />
      )}
      {phase === 'round-complete'
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
              count={engine.state.roundAnswered}
              correct={round.roundCorrect}
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
                  label={engine.state.roundTimerExpired ? 'Continue' : 'Next'}
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
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCSSColor(prop: string, ref: { current: string }): void {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(
      prop,
    ).trim();
    if (val) ref.current = val;
  } catch (_) { /* expected in tests */ }
}

function resetFretboardCircles(
  quizFbRef: { current: HTMLDivElement | null },
  wrongFlashTimeoutsRef: { current: Set<ReturnType<typeof setTimeout>> },
  currentItemId: string | null,
  phase: string,
): void {
  const wrapper = quizFbRef.current;
  if (!wrapper) return;
  if (!currentItemId || phase === 'idle') {
    clearAllCircles(wrapper);
    return;
  }
  wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
  wrongFlashTimeoutsRef.current.clear();
  clearAllCircles(wrapper);
}

function getPracticingLabel(noteFilter: NoteFilterType): string {
  if (noteFilter === 'all') return 'all notes';
  if (noteFilter === 'sharps-flats') return 'sharps & flats';
  return 'natural notes';
}

// ---------------------------------------------------------------------------
// Idle view sub-component
// ---------------------------------------------------------------------------

function SpeedTapIdleView(
  { noteFilter, scopeActions, engine, ps, statsHTML }: {
    noteFilter: NoteFilterType;
    scopeActions: ReturnType<typeof useScopeState>[1];
    engine: ReturnType<typeof useQuizEngine>;
    ps: ReturnType<typeof usePracticeSummary>;
    statsHTML: string;
  },
) {
  return (
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
      activeTab={ps.activeTab}
      onTabSwitch={ps.setActiveTab}
      aboutContent={<SpeedTapAboutTab />}
    />
  );
}

function SpeedTapAboutTab() {
  const ba = MODE_BEFORE_AFTER.speedTap;
  return (
    <div class='about-tab'>
      <Text role='subsection-header' as='div'>What you're training</Text>
      <div class='about-before-after'>
        <div class='about-ba-row'>
          <Text role='label' as='span'>Before</Text>
          <span class='about-ba-text'>{ba.before()}</span>
        </div>
        <div class='about-ba-row'>
          <Text role='label' as='span'>After</Text>
          <span class='about-ba-text about-ba-after'>{ba.after()}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tap handler — processes fretboard taps during active quiz
// ---------------------------------------------------------------------------

function handleFretboardTap(
  e: MouseEvent,
  roundActiveRef: { current: boolean },
  currentNoteRef: { current: string | null },
  foundPosRef: { current: Set<string> },
  targetPosRef: { current: { string: number; fret: number }[] },
  quizFbRef: { current: HTMLDivElement | null },
  engineSubmitRef: { current: (input: string) => void },
  wrongFlashTimeoutsRef: { current: Set<ReturnType<typeof setTimeout>> },
  colorError: string,
  setProgressText: (text: string) => void,
): void {
  if (!roundActiveRef.current || !currentNoteRef.current) return;
  const el = (e.target as Element).closest('.fb-tap[data-string][data-fret]') as
    | SVGElement
    | null;
  if (!el) return;
  const s = parseInt(el.dataset!.string!);
  const f = parseInt(el.dataset!.fret!);
  const key = s + '-' + f;
  if (foundPosRef.current.has(key)) return;
  const wrapper = quizFbRef.current;
  if (!wrapper) return;

  if (getNoteAtPosition(s, f) === currentNoteRef.current) {
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
    setCircleFill(wrapper, s, f, colorError);
    const timeout = setTimeout(() => {
      wrongFlashTimeoutsRef.current.delete(timeout);
      if (!foundPosRef.current.has(key)) setCircleFill(wrapper, s, f, '');
    }, 800);
    wrongFlashTimeoutsRef.current.add(timeout);
  }
}

// ---------------------------------------------------------------------------
// Spatial state hook — refs, tap handler, engine config, sync
// ---------------------------------------------------------------------------

type SpatialHandle = {
  progressText: string;
  currentDisplayName: string;
  svgHTML: string;
  quizFbRef: { current: HTMLDivElement | null };
  handleTap: (e: MouseEvent) => void;
  engineConfig: QuizEngineConfig;
  engineSubmitRef: { current: (input: string) => void };
  wrongFlashTimeoutsRef: { current: Set<ReturnType<typeof setTimeout>> };
  syncOnItemChange: (itemId: string | null, phase: string) => void;
  resetOnItemChange: (itemId: string | null, phase: string) => void;
};

function useSpeedTapSpatial(
  scope: ReturnType<typeof useScopeState>[0],
): SpatialHandle {
  const currentNoteRef = useRef<string | null>(null);
  const targetPosRef = useRef<{ string: number; fret: number }[]>([]);
  const foundPosRef = useRef(new Set<string>());
  const roundActiveRef = useRef(false);
  const wrongFlashTimeoutsRef = useRef(
    new Set<ReturnType<typeof setTimeout>>(),
  );
  const quizFbRef = useRef<HTMLDivElement>(null);
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const [progressText, setProgressText] = useState('');
  const [currentDisplayName, setCurrentDisplayName] = useState('');
  const colorErrorRef = useRef('#d32f2f');
  useEffect(() => readCSSColor('--color-error', colorErrorRef), []);
  const svgHTML = useMemo(() => fretboardSVG({ tapTargets: true }), []);

  const handleTap = useCallback((e: MouseEvent) => {
    handleFretboardTap(
      e,
      roundActiveRef,
      currentNoteRef,
      foundPosRef,
      targetPosRef,
      quizFbRef,
      engineSubmitRef,
      wrongFlashTimeoutsRef,
      colorErrorRef.current,
      setProgressText,
    );
  }, []);

  const engineConfig = useMemo(
    () =>
      buildSpeedTapConfig(
        scope,
        currentNoteRef,
        quizFbRef,
        targetPosRef,
        foundPosRef,
        roundActiveRef,
        wrongFlashTimeoutsRef,
        colorErrorRef.current,
        setProgressText,
        setCurrentDisplayName,
      ),
    [scope],
  );

  return {
    progressText,
    currentDisplayName,
    svgHTML,
    quizFbRef,
    handleTap,
    engineConfig,
    engineSubmitRef,
    wrongFlashTimeoutsRef,
    syncOnItemChange: (itemId, phase) =>
      syncQuestionState(
        itemId,
        phase,
        currentNoteRef,
        targetPosRef,
        foundPosRef,
        roundActiveRef,
        setCurrentDisplayName,
        setProgressText,
      ),
    resetOnItemChange: (itemId, phase) =>
      resetFretboardCircles(quizFbRef, wrongFlashTimeoutsRef, itemId, phase),
  };
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
  const learner = useLearnerModel('speedTap', ALL_ITEMS, 'fretboard-tap');
  const sp = useSpeedTapSpatial(scope);

  const engine = useQuizEngine(sp.engineConfig, learner.selector, container);
  sp.engineSubmitRef.current = engine.submitAnswer;

  const prevItemRef = useRef<string | null>(null);
  if (engine.state.currentItemId !== prevItemRef.current) {
    prevItemRef.current = engine.state.currentItemId;
    sp.syncOnItemChange(engine.state.currentItemId, engine.state.phase);
  }
  useEffect(
    () => sp.resetOnItemChange(engine.state.currentItemId, engine.state.phase),
    [engine.state.currentItemId],
  );
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);
  const practicingLabel = useMemo(() => getPracticingLabel(noteFilter), [
    noteFilter,
  ]);

  const round = useRoundSummary(engine, practicingLabel);
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'notes',
    recommendation: null,
    recommendationText: '',
  });

  useEffect(() => () => {
    sp.wrongFlashTimeoutsRef.current.forEach((t) => clearTimeout(t));
  }, []);
  useModeLifecycle(onMount, engine, learner);

  const statsHTML = useMemo(() => buildSpeedTapStatsHTML(learner.selector), [
    learner.selector,
    engine.state.phase,
  ]);
  const promptText = sp.currentDisplayName
    ? 'Tap all ' + sp.currentDisplayName
    : '';
  const isIdle = engine.state.phase === 'idle';

  return (
    <>
      <ModeTopBar
        modeId='speedTap'
        title='Speed Tap'
        description={MODE_DESCRIPTIONS.speedTap}
        onBack={navigateHome}
        showBack={isIdle}
      />
      {isIdle && (
        <SpeedTapIdleView
          noteFilter={noteFilter}
          scopeActions={scopeActions}
          engine={engine}
          ps={ps}
          statsHTML={statsHTML}
        />
      )}
      {!isIdle && (
        <SpeedTapActiveView
          engine={engine}
          round={round}
          practicingLabel={practicingLabel}
          progressText={sp.progressText}
          promptText={promptText}
          svgHTML={sp.svgHTML}
          quizFbRef={sp.quizFbRef}
          handleTap={sp.handleTap}
        />
      )}
    </>
  );
}
