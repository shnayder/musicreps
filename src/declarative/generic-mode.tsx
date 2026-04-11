// GenericMode — a single Preact component that interprets a ModeDefinition.
// Handles all hook composition, text-input keyboard handling, and
// phase-conditional rendering. Keyboard input is via a text field + Enter;
// buttons remain for tap/click on mobile.
//
// Sequential modes (def.sequential): GenericMode collects multiple inputs,
// renders progress slots, and evaluates all at once after the last input.
//
// Modes with custom rendering needs (e.g., SVG fretboard) provide a
// `useController` hook that can override prompt rendering, stats rendering,
// engine lifecycle hooks, and keyboard handling.

import { useMemo, useRef } from 'preact/hooks';
import type { ModeHandle } from '../types.ts';

import { useLearnerModel } from '../hooks/use-learner-model.ts';
import { useGroupScope } from '../hooks/use-group-scope.ts';

import { LayoutHeader, ScreenLayout } from '../ui/screen-layout.tsx';
import { ModeTopBar } from '../ui/mode-screen.tsx';
import { SkillHeader } from '../ui/practice-config.tsx';
import { NOTE_BUTTON_CONFIG, SpeedCheck } from '../ui/speed-check.tsx';
import type { ModeDefinition } from './types.ts';
import { getInputPlaceholder } from './answer-utils.ts';
import { QuizActiveView } from './quiz-areas.tsx';
import { IdlePracticeView } from './practice-views.tsx';
import {
  buildGroupScopeSpec,
  buildSeqProps,
  EMPTY_GROUPS,
  type GenericModeBodyProps,
  resolveButtons,
  useGenericDerivedState,
  useGenericEngine,
  useLevelBars,
  useProgressColors,
  useSpeedCheckOverlay,
} from './generic-mode-hooks.ts';

// Re-export for external consumers (answer-checking_test.ts).
export { checkCorrectness, toButtonValue } from './answer-utils.ts';

// ---------------------------------------------------------------------------
// ModeHeader — SkillHeader (idle) or minimal ModeTopBar (active/calibration)
// ---------------------------------------------------------------------------

function ModeHeader<Q>(
  { def, isIdle, progressColors, totalReps, navigateHome }: {
    def: ModeDefinition<Q>;
    isIdle: boolean;
    progressColors: string[];
    totalReps: number;
    navigateHome: () => void;
  },
) {
  if (isIdle) {
    return (
      <SkillHeader
        modeId={def.id}
        title={def.name}
        totalReps={totalReps}
        progressColors={progressColors}
        onBack={navigateHome}
      />
    );
  }
  return <ModeTopBar modeId={def.id} title={def.name} showBack={false} />;
}

// ---------------------------------------------------------------------------
// GenericModeBody — renders speed check overlay or idle/active views
// ---------------------------------------------------------------------------

function GenericModeBody<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    groupScopeResult,
    ps,
    sc,
    currentQ,
    round,
    handleSubmit,
    seqInput,
    multiTapInput,
    isSequential,
    lastAnswerRef,
    navigateHome,
  }: GenericModeBodyProps<Q>,
) {
  const dir = currentQ && def.getDirection ? def.getDirection(currentQ) : 'fwd';
  const promptText = currentQ ? def.getPromptText(currentQ) : '';
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;
  const activeButtons = resolveButtons(def, dir);
  const phase = engine.state.phase; // cache-buster: progress + count refresh on phase change
  const isIdle = phase === 'idle' && !sc.speedCheck;
  const skipped = groupScopeResult?.skippedGroups;
  const progressColors = useProgressColors(def, learner, phase, skipped);
  const levelBars = useLevelBars(def, learner, phase, groupScopeResult);
  const totalReps = useMemo(() => {
    let sum = 0;
    for (const id of def.allItems) {
      const s = learner.selector.getStats(id);
      if (s) sum += s.sampleCount;
    }
    return sum;
  }, [def.allItems, learner.selector, learner.selector.version, phase]);

  if (isIdle) {
    return (
      <ScreenLayout>
        <LayoutHeader>
          <ModeHeader
            def={def}
            isIdle
            progressColors={progressColors}
            totalReps={totalReps}
            navigateHome={navigateHome}
          />
        </LayoutHeader>
        <IdlePracticeView
          def={def}
          engine={engine}
          learner={learner}
          ctrl={ctrl}
          groupScopeResult={groupScopeResult}
          ps={ps}
          onCalibrate={sc.hasSpeedCheck
            ? () => sc.setSpeedCheck('active')
            : undefined}
        />
      </ScreenLayout>
    );
  }

  if (sc.speedCheck) {
    return (
      <SpeedCheck
        config={NOTE_BUTTON_CONFIG}
        fixture={typeof sc.speedCheck === 'object' ? sc.speedCheck : undefined}
        onComplete={(baseline) => {
          learner.applyBaseline(baseline);
          sc.setSpeedCheck(null);
        }}
        onCancel={() => sc.setSpeedCheck(null)}
      />
    );
  }

  return (
    <QuizActiveView
      def={def}
      engine={engine}
      ctrl={ctrl}
      currentQ={currentQ}
      round={round}
      levelBars={levelBars}
      handleSubmit={handleSubmit}
      seq={buildSeqProps(seqInput)}
      multiTapInput={multiTapInput}
      activeButtons={activeButtons}
      promptText={promptText}
      useFlats={useFlats}
      placeholder={getInputPlaceholder(def, currentQ, isSequential)}
      lastAnswerRef={lastAnswerRef}
    />
  );
}

// ---------------------------------------------------------------------------
// GenericMode component
// ---------------------------------------------------------------------------

export function GenericMode<Q>(
  { def, container, navigateHome, onMount }: {
    def: ModeDefinition<Q>;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const learner = useLearnerModel(
    def.namespace,
    def.allItems,
    def.motorTaskType,
    def.getExpectedResponseCount,
  );
  const groupScopeSpec = useMemo(
    () => buildGroupScopeSpec(def, learner.selector),
    [def, learner.selector],
  );
  const groupScopeResult = groupScopeSpec
    ? useGroupScope(groupScopeSpec)
    : null;
  const enabledGroups = groupScopeResult?.enabledGroups ?? EMPTY_GROUPS;
  const ctrl = def.useController ? def.useController(enabledGroups) : {};
  const ctrlRef = useRef(ctrl);
  ctrlRef.current = ctrl;

  const {
    engine,
    currentQRef,
    seqInput,
    multiTapInput,
    lastAnswerRef,
    isSequential,
  } = useGenericEngine(
    def,
    ctrl,
    ctrlRef,
    groupScopeResult,
    learner,
    container,
  );
  const sc = useSpeedCheckOverlay(engine, def, ctrl);

  const { currentQ, round, ps, handleSubmit } = useGenericDerivedState(
    def,
    engine,
    learner,
    groupScopeResult,
    currentQRef,
    seqInput,
    multiTapInput,
    isSequential,
    container,
    onMount,
    sc.presentationPhase,
    sc.deactivateCleanup,
  );

  return (
    <GenericModeBody
      def={def}
      engine={engine}
      learner={learner}
      ctrl={ctrl}
      groupScopeResult={groupScopeResult}
      ps={ps}
      sc={sc}
      currentQ={currentQ}
      round={round}
      handleSubmit={handleSubmit}
      seqInput={seqInput}
      multiTapInput={multiTapInput}
      isSequential={isSequential}
      lastAnswerRef={lastAnswerRef}
      navigateHome={navigateHome}
    />
  );
}
