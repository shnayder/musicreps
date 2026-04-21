// GenericSkill — a single Preact component that interprets a SkillDefinition.
// Handles all hook composition, text-input keyboard handling, and
// phase-conditional rendering. Keyboard input is via a text field + Enter;
// buttons remain for tap/click on mobile.
//
// Sequential modes (def.sequential): GenericSkill collects multiple inputs,
// renders progress slots, and evaluates all at once after the last input.
//
// Modes with custom rendering needs (e.g., SVG fretboard) provide a
// `useController` hook that can override prompt rendering, stats rendering,
// engine lifecycle hooks, and keyboard handling.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { SkillHandle } from '../types.ts';

import { useLearnerModel } from '../hooks/use-learner-model.ts';
import { useLevelScope } from '../hooks/use-level-scope.ts';

import { LayoutHeader, ScreenLayout } from '../ui/screen-layout.tsx';
import { SkillHeader } from '../ui/practice-config.tsx';
import {
  makeFretboardTapConfig,
  NOTE_BUTTON_CONFIG,
  SpeedCheck,
} from '../ui/speed-check.tsx';
import type { SkillDefinition } from './types.ts';
import { getInputPlaceholder } from './answer-utils.ts';
import { QuizActiveView } from './quiz-areas.tsx';
import { IdlePracticeView } from './practice-views.tsx';
import {
  buildLevelScopeSpec,
  buildSeqProps,
  EMPTY_GROUPS,
  type GenericSkillBodyProps,
  resolveButtons,
  useGenericDerivedState,
  useGenericEngine,
  useLevelBars,
  useProgressColors,
  useSpeedCheckOverlay,
} from './generic-skill-hooks.ts';

// ---------------------------------------------------------------------------
// GenericSkillBody — renders speed check overlay or idle/active views
// ---------------------------------------------------------------------------

function GenericSkillBody<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    levelScopeResult,
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
  }: GenericSkillBodyProps<Q>,
) {
  const dir = currentQ && def.getDirection ? def.getDirection(currentQ) : 'fwd';
  const promptText = currentQ ? def.getPromptText(currentQ) : '';
  const useFlats = currentQ && def.getUseFlats
    ? def.getUseFlats(currentQ)
    : undefined;
  const activeButtons = resolveButtons(def, dir);
  const phase = engine.state.phase; // cache-buster: progress + count refresh on phase change
  const isIdle = phase === 'idle' && !sc.speedCheck;
  const skipped = levelScopeResult?.skippedLevels;
  const progressColors = useProgressColors(def, learner, phase, skipped);
  const levelBars = useLevelBars(def, learner, phase, levelScopeResult);
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
          <SkillHeader
            skillId={def.id}
            title={def.name}
            totalReps={totalReps}
            onBack={navigateHome}
          />
        </LayoutHeader>
        <IdlePracticeView
          def={def}
          engine={engine}
          learner={learner}
          ctrl={ctrl}
          levelScopeResult={levelScopeResult}
          ps={ps}
          progressSegments={progressColors}
          onCalibrate={sc.hasSpeedCheck
            ? () => sc.setSpeedCheck('active')
            : undefined}
        />
      </ScreenLayout>
    );
  }

  if (sc.speedCheck) {
    const speedCheckConfig = def.motorTaskType === 'fretboard-tap'
      ? makeFretboardTapConfig(def.multiTap?.stringCount ?? 6)
      : NOTE_BUTTON_CONFIG;
    return (
      <SpeedCheck
        config={speedCheckConfig}
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
// GenericSkill component
// ---------------------------------------------------------------------------

export function GenericSkill<Q>(
  { def, container, navigateHome, onMount }: {
    def: SkillDefinition<Q>;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: SkillHandle) => void;
  },
) {
  const learner = useLearnerModel(
    def.namespace,
    def.allItems,
    def.motorTaskType,
    def.getExpectedResponseCount,
  );
  const levelScopeSpec = useMemo(
    () => buildLevelScopeSpec(def, learner.selector),
    [def, learner.selector],
  );
  const levelScopeResult = levelScopeSpec
    ? useLevelScope(levelScopeSpec)
    : null;
  const enabledLevels = levelScopeResult?.enabledLevels ?? EMPTY_GROUPS;
  const ctrl = def.useController ? def.useController(enabledLevels) : {};
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
    levelScopeResult,
    learner,
    container,
  );
  const sc = useSpeedCheckOverlay(engine, def, ctrl);

  // Freeze the active scope while a round is in progress. See scope-lock.ts:
  // recommendations can change mid-round as `selector.version` bumps, which
  // would otherwise shift both the item pool and the answer button set while
  // the user is mid-round. Locking keeps the scope stable from the first
  // question of a round until we return to idle.
  const enginePhase = engine.state.phase;
  const setScopeLocked = levelScopeResult?.setScopeLocked;
  useEffect(() => {
    if (!setScopeLocked) return;
    setScopeLocked(enginePhase !== 'idle');
  }, [enginePhase, setScopeLocked]);

  const { currentQ, round, ps, handleSubmit } = useGenericDerivedState(
    def,
    engine,
    learner,
    levelScopeResult,
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
    <GenericSkillBody
      def={def}
      engine={engine}
      learner={learner}
      ctrl={ctrl}
      levelScopeResult={levelScopeResult}
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
