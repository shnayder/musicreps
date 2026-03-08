// Chord Spelling Preact mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.
//
// All notes are collected before feedback. Evaluation happens after the
// last note is entered, then slots turn green/red and the correct answer
// is shown below if any were wrong. Spelling must be exact (B ≠ Cb).
//
// Two input methods:
//   - SplitNoteButtons (tap): notes entered one at a time
//   - Text input (keyboard): all notes at once, space-separated
//     e.g. "C E G", "A Cb fs" — Enter to submit

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { ModeHandle, SequentialState } from '../../types.ts';
import {
  displayNote,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../music-data.ts';

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

import { SplitNoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../../ui/mode-screen.tsx';
import { StatsGrid, StatsLegend } from '../../ui/stats.tsx';
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  evaluateSequential,
  getGridItemId,
  getItemIdsForGroup,
  GRID_COL_LABELS,
  GRID_NOTES,
  handleInput,
  initSequentialState,
  parseChordInput,
  parseItem,
  SPELLING_GROUPS,
} from './logic.ts';

// ---------------------------------------------------------------------------
// ChordSlots — shows sequential progress with deferred feedback
// ---------------------------------------------------------------------------

function ChordSlots(
  { state, correctTones }: {
    state: SequentialState | null;
    correctTones: string[] | null;
  },
) {
  if (!state) return <div class='chord-slots' />;

  // Evaluation has happened when any entry has correct !== null
  const evaluated = state.entries.length > 0 &&
    state.entries[0].correct !== null;
  const anyWrong = evaluated && state.entries.some((e) => !e.correct);

  return (
    <div class='chord-slots-container'>
      <div class='chord-slots'>
        {Array.from({ length: state.expectedCount }, (_, i) => {
          let cls = 'chord-slot';
          let content = '\u00A0';
          if (i < state.entries.length) {
            content = state.entries[i].display;
            if (evaluated) {
              cls += state.entries[i].correct ? ' correct' : ' wrong';
            } else {
              cls += ' filled';
            }
          } else if (i === state.entries.length) {
            cls += ' active';
          }
          return <span key={i} class={cls}>{content}</span>;
        })}
      </div>
      {anyWrong && correctTones && (
        <div class='chord-correct-row'>
          {correctTones.map((t, i) => (
            <span key={i} class='chord-correct-note'>{displayNote(t)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChordTextInput — keyboard input for typing all notes at once
// ---------------------------------------------------------------------------

function ChordTextInput(
  { onSubmit, disabled, expectedCount }: {
    onSubmit: (notes: string[]) => boolean;
    disabled?: boolean;
    expectedCount: number;
  },
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Auto-focus when re-enabled (new question)
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const triggerShake = useCallback(() => {
    setShake(true);
    if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setShake(false);
      shakeTimerRef.current = null;
    }, 400);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();

      const value = inputRef.current?.value.trim() ?? '';
      if (!value) {
        triggerShake();
        return;
      }

      const notes = parseChordInput(value);
      if (notes.length !== expectedCount) {
        triggerShake();
        return;
      }

      const accepted = onSubmit(notes);
      if (accepted) {
        if (inputRef.current) inputRef.current.value = '';
      } else {
        triggerShake();
      }
    },
    [onSubmit, expectedCount, triggerShake],
  );

  const placeholder = `${expectedCount} notes, e.g. C E G \u2014 Enter`;
  const cls = 'answer-input' + (shake ? ' answer-input-shake' : '');

  return (
    <input
      ref={inputRef}
      type='text'
      class={cls}
      placeholder={placeholder}
      aria-label={placeholder}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      autoComplete='off'
      autoCorrect='off'
      spellcheck={false}
    />
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

  // --- Question + sequential state ---
  const currentItemRef = useRef<string | null>(null);
  const [seqState, setSeqState] = useState<SequentialState | null>(null);
  const seqStateRef = useRef<SequentialState | null>(null);

  // --- Engine submit ref (pre-declared for callbacks) ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  // --- Sequential input handler (button tap, one note at a time) ---
  const handleSequentialInput = useCallback((input: string) => {
    const itemId = currentItemRef.current;
    const state = seqStateRef.current;
    if (!itemId || !state) return;

    const result = handleInput(itemId, input, state);
    seqStateRef.current = result.state;
    setSeqState(result.state);

    if (result.status === 'complete') {
      // All notes collected — evaluate and submit
      const evalResult = evaluateSequential(itemId, result.state);
      seqStateRef.current = evalResult.state;
      setSeqState(evalResult.state);
      engineSubmitRef.current(evalResult.correct ? '__correct__' : '__wrong__');
    }
  }, []);

  // --- Batch submit handler (text input, all notes at once) ---
  const handleBatchSubmit = useCallback((notes: string[]): boolean => {
    const itemId = currentItemRef.current;
    if (!itemId) return false;

    // Build sequential state from all notes at once
    let state = initSequentialState(itemId);
    for (const note of notes) {
      const result = handleInput(itemId, note, state);
      state = result.state;
    }

    // Evaluate and submit
    const evalResult = evaluateSequential(itemId, state);
    seqStateRef.current = evalResult.state;
    setSeqState(evalResult.state);
    engineSubmitRef.current(evalResult.correct ? '__correct__' : '__wrong__');
    return true;
  }, []);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems,
    getPracticingLabel,

    checkAnswer: (itemId: string, input: string) => {
      return checkAnswer(itemId, input);
    },

    onStop: () => {
      seqStateRef.current = null;
      setSeqState(null);
    },
  }), [getEnabledItems, getPracticingLabel]);

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
  useModeLifecycle(onMount, engine, learner);

  // --- Derived state ---
  const promptText = currentQ
    ? displayNote(currentQ.rootName) + currentQ.chordType.symbol
    : '';

  const handleNoteAnswer = useCallback(
    (note: string) => handleSequentialInput(note),
    [handleSequentialInput],
  );

  const round = useRoundSummary(engine, practicingLabel);

  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  return (
    <>
      <ModeTopBar
        modeId='chordSpelling'
        title='Chord Spelling'
        description={MODE_DESCRIPTIONS.chordSpelling}
        beforeAfter={MODE_BEFORE_AFTER.chordSpelling}
        onBack={navigateHome}
        showBack={isIdle}
      />
      {isIdle && (
        <PracticeTab
          summary={ps.summary}
          onStart={engine.start}
          onApplyRecommendation={ps.summary.showRecommendationButton
            ? applyRecommendation
            : undefined}
          scopeValid={enabledGroups.size > 0}
          validationMessage='Select at least one group'
          scope={
            <GroupToggles
              labels={SPELLING_GROUPS.map((g) => g.label)}
              active={enabledGroups}
              onToggle={scopeActions.toggleGroup}
            />
          }
          statsContent={
            <>
              <StatsGrid
                selector={ps.statsSel}
                colLabels={GRID_COL_LABELS}
                getItemId={getGridItemId}
                notes={GRID_NOTES}
              />
              <StatsLegend />
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
                    <ChordSlots
                      state={seqState}
                      correctTones={currentQ?.tones ?? null}
                    />
                    <SplitNoteButtons
                      onAnswer={handleNoteAnswer}
                      sequential
                      answered={engine.state.answered}
                    />
                    {seqState && (
                      <ChordTextInput
                        onSubmit={handleBatchSubmit}
                        disabled={engine.state.answered}
                        expectedCount={seqState.expectedCount}
                      />
                    )}
                    <FeedbackDisplay
                      text={engine.state.feedbackText}
                      className={engine.state.feedbackClass}
                      time={engine.state.timeDisplayText || undefined}
                      hint={engine.state.hintText || undefined}
                      correct={engine.state.feedbackCorrect}
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
