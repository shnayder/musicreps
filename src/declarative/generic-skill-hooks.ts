// Internal hooks and builder functions for GenericSkill.
// These wire up the quiz engine, derive state, and manage overlays.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { SkillHandle, SpeedCheckFixture } from '../types.ts';

import type { useLearnerModel } from '../hooks/use-learner-model.ts';
import type { useLevelScope } from '../hooks/use-level-scope.ts';
import type { QuizEngineConfig } from '../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  type PresentationPhase,
  usePhaseClass,
} from '../hooks/use-phase-class.ts';
import { useSkillLifecycle } from '../hooks/use-skill-lifecycle.ts';
import { useRoundSummary } from '../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../hooks/use-practice-summary.ts';

import {
  computeProgressColors,
  progressBarColors,
  type ProgressSegment,
} from '../stats-display.ts';
import type { LevelProgressEntry } from '../ui/skill-screen.tsx';
import { IMPLEMENTED_TASK_TYPES } from '../ui/speed-check.tsx';

import type {
  ButtonsDef,
  ComparisonStrategy,
  SkillController,
  SkillDefinition,
} from './types.ts';
import { useSequentialInput } from './use-sequential-input.ts';
import {
  type MultiTapInputHandle,
  useMultiTapInput,
} from './use-multi-tap-input.ts';
import { checkGenericAnswer, resolveGroupLabel } from './answer-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMPTY_GROUPS: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------------------
// Engine setup hook — refs, sequential input, engine config, engine creation
// ---------------------------------------------------------------------------

export type GenericEngineSetup<Q> = {
  engine: ReturnType<typeof useQuizEngine>;
  currentQRef: { current: Q | null };
  seqInput: ReturnType<typeof useSequentialInput>;
  multiTapInput: MultiTapInputHandle;
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  };
  isSequential: boolean;
};

export function useGenericEngine<Q>(
  def: SkillDefinition<Q>,
  ctrl: SkillController<Q>,
  ctrlRef: { current: SkillController<Q> },
  levelScopeResult: ReturnType<typeof useLevelScope> | null,
  learner: ReturnType<typeof useLearnerModel>,
  container: HTMLElement,
): GenericEngineSetup<Q> {
  const currentQRef = useRef<Q | null>(null);
  const isSequential = !!def.sequential;
  const isMultiTap = !!def.multiTap;
  const seqSubmitRef = useRef<(input: string) => void>(() => {});
  const seqInput = useSequentialInput(def, currentQRef, seqSubmitRef);
  const mtSubmitRef = useRef<(input: string) => void>(() => {});
  const multiTapInput = useMultiTapInput(def, currentQRef, mtSubmitRef);
  const lastAnswerRef = useRef<
    {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null
  >(null);
  const getEnabledItemsRef = useRef<() => string[]>(() => def.allItems);
  const getPracticingLabelRef = useRef<() => string>(() => 'all items');
  if (levelScopeResult) {
    getEnabledItemsRef.current = levelScopeResult.getEnabledItems;
    getPracticingLabelRef.current = levelScopeResult.getPracticingLabel;
  }

  const engineConfig = useMemo(
    () =>
      buildGenericEngineConfig(
        def,
        getEnabledItemsRef,
        getPracticingLabelRef,
        currentQRef,
        lastAnswerRef,
        ctrlRef,
        isSequential,
        isMultiTap,
        seqInput,
        !!ctrl.handleKey,
      ),
    [def, !!ctrl.handleKey, isSequential, isMultiTap],
  );

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  seqSubmitRef.current = engine.submitAnswer;
  mtSubmitRef.current = engine.submitAnswer;
  if (ctrl.engineSubmitRef) ctrl.engineSubmitRef.current = engine.submitAnswer;

  return {
    engine,
    currentQRef,
    seqInput,
    multiTapInput,
    lastAnswerRef,
    isSequential,
  };
}

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

export function resolveButtons<Q>(
  def: SkillDefinition<Q>,
  dir: 'fwd' | 'rev',
): ButtonsDef {
  if (def.buttons.kind === 'bidirectional') {
    return dir === 'fwd' ? def.buttons.fwd : def.buttons.rev;
  }
  return def.buttons;
}

export function buildLevelScopeSpec<Q>(
  def: SkillDefinition<Q>,
  selector: ReturnType<typeof useLearnerModel>['selector'],
) {
  if (def.scope.kind !== 'levels') return null;
  return {
    levels: def.scope.levels,
    getItemIdsForLevel: def.scope.getItemIdsForLevel,
    allLevelIds: def.scope.allLevelIds,
    storageKey: def.scope.storageKey,
    scopeLabel: def.scope.scopeLabel,
    defaultEnabled: def.scope.defaultEnabled,
    selector,
    formatLabel: def.scope.formatLabel,
  };
}

function buildGenericEngineConfig<Q>(
  def: SkillDefinition<Q>,
  getEnabledItemsRef: { current: () => string[] },
  getPracticingLabelRef: { current: () => string },
  currentQRef: { current: Q | null },
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  },
  ctrlRef: { current: SkillController<Q> },
  isSequential: boolean,
  isMultiTap: boolean,
  seqInput: ReturnType<typeof useSequentialInput>,
  hasHandleKey: boolean,
): QuizEngineConfig {
  return {
    skillId: def.id,
    getEnabledItems: () => getEnabledItemsRef.current(),
    getPracticingLabel: () => getPracticingLabelRef.current(),
    checkAnswer: (itemId, input) =>
      checkGenericAnswer(
        def,
        currentQRef,
        lastAnswerRef,
        isSequential,
        isMultiTap,
        itemId,
        input,
      ),
    onAnswer: (itemId, result) => ctrlRef.current.onAnswer?.(itemId, result),
    onStart: () => ctrlRef.current.onStart?.(),
    onStop: () => {
      if (isSequential) seqInput.resetOnItemChange(null);
      ctrlRef.current.onStop?.();
    },
    handleKey: hasHandleKey
      ? (e, ctx) => ctrlRef.current.handleKey!(e, ctx)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Derived state hook
// ---------------------------------------------------------------------------

export function useGenericDerivedState<Q>(
  def: SkillDefinition<Q>,
  engine: ReturnType<typeof useQuizEngine>,
  learner: ReturnType<typeof useLearnerModel>,
  levelScopeResult: ReturnType<typeof useLevelScope> | null,
  currentQRef: { current: Q | null },
  seqInput: ReturnType<typeof useSequentialInput>,
  multiTapInput: MultiTapInputHandle,
  isSequential: boolean,
  container: HTMLElement,
  onMount: (handle: SkillHandle) => void,
  presentationPhase: PresentationPhase,
  deactivateCleanup?: () => void,
) {
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return def.getQuestion(id, { useFlats: engine.state.roundUseFlats });
  }, [
    engine.state.currentItemId,
    engine.state.phase,
    engine.state.roundUseFlats,
    def,
  ]);
  currentQRef.current = currentQ;
  if (isSequential) seqInput.resetOnItemChange(engine.state.currentItemId);
  if (def.multiTap) multiTapInput.resetOnItemChange(engine.state.currentItemId);

  usePhaseClass(container, presentationPhase, PHASE_FOCUS_TARGETS);
  const round = useRoundSummary(engine);
  const ps = usePracticeSummary({
    allItems: def.allItems,
    selector: learner.selector,
    engine,
    itemNoun: def.itemNoun,
    recommendation: levelScopeResult?.recommendation ?? null,
    recommendationText: levelScopeResult?.recommendationText ?? '',
  });
  useSkillLifecycle(
    onMount,
    engine,
    learner,
    deactivateCleanup,
    ps.resetTabForActivation,
  );

  const handleSubmit = useCallback((input: string): boolean => {
    if (
      def.validateInput && currentQRef.current &&
      !def.validateInput(currentQRef.current, input)
    ) return false;
    engine.submitAnswer(input);
    return true;
  }, [engine.submitAnswer, def]);

  return { currentQ, round, ps, handleSubmit };
}

export function buildSeqProps(seqInput: ReturnType<typeof useSequentialInput>) {
  return {
    entries: seqInput.seqEntries,
    evaluated: seqInput.seqEvaluated,
    correctAnswer: seqInput.seqCorrectAnswer,
    handleInput: seqInput.handleSeqInput,
    handleBatch: seqInput.handleSeqBatch,
    handleCheck: seqInput.handleCheck,
  };
}

// ---------------------------------------------------------------------------
// useSpeedCheckOverlay — local speed check state for mode components
// ---------------------------------------------------------------------------

export type SpeedCheckOverlay = {
  speedCheck: SpeedCheckFixture | 'active' | null;
  setSpeedCheck: (v: SpeedCheckFixture | 'active' | null) => void;
  hasSpeedCheck: boolean;
  presentationPhase: PresentationPhase;
  deactivateCleanup: () => void;
};

export function useSpeedCheckOverlay<Q>(
  engine: ReturnType<typeof useQuizEngine>,
  def: SkillDefinition<Q>,
  ctrl: SkillController<Q>,
): SpeedCheckOverlay {
  const [speedCheck, setSpeedCheck] = useState<
    SpeedCheckFixture | 'active' | null
  >(null);
  const hasSpeedCheck = IMPLEMENTED_TASK_TYPES.has(
    def.motorTaskType ?? 'note-button',
  );

  // Sync calibration fixture from engine's fixture injection into local state.
  useEffect(() => {
    if (engine.calibrationFixture) {
      setSpeedCheck(engine.calibrationFixture);
    }
  }, [engine.calibrationFixture]);

  const presentationPhase: PresentationPhase = speedCheck
    ? 'calibration'
    : engine.state.phase;

  const deactivateCleanup = useCallback(() => {
    setSpeedCheck(null);
    ctrl.deactivateCleanup?.();
  }, [ctrl.deactivateCleanup]);

  return {
    speedCheck,
    setSpeedCheck,
    hasSpeedCheck,
    presentationPhase,
    deactivateCleanup,
  };
}

// ---------------------------------------------------------------------------
// GenericSkillBody props type
// ---------------------------------------------------------------------------

export type GenericSkillBodyProps<Q> = {
  def: SkillDefinition<Q>;
  engine: ReturnType<typeof useQuizEngine>;
  learner: ReturnType<typeof useLearnerModel>;
  ctrl: SkillController<Q>;
  levelScopeResult: ReturnType<typeof useLevelScope> | null;
  ps: ReturnType<typeof usePracticeSummary>;
  sc: SpeedCheckOverlay;
  currentQ: Q | null;
  round: ReturnType<typeof useRoundSummary>;
  handleSubmit: (input: string) => boolean;
  seqInput: ReturnType<typeof useSequentialInput>;
  multiTapInput: MultiTapInputHandle;
  isSequential: boolean;
  lastAnswerRef: {
    current: {
      expected: string;
      comparison: ComparisonStrategy;
      normalizedInput: string;
    } | null;
  };
  navigateHome: () => void;
};

// ---------------------------------------------------------------------------
// useProgressColors — progress bar colors for SkillHeader
// ---------------------------------------------------------------------------

/** Compute progress colors for the SkillHeader progress bar.
 *  Uses shared computeProgressColors (same logic as home screen). */
export function useProgressColors<Q>(
  def: SkillDefinition<Q>,
  learner: ReturnType<typeof useLearnerModel>,
  _phase: string,
  skippedLevels?: ReadonlyMap<string, unknown>,
): ProgressSegment[] {
  return useMemo(() => {
    if (def.scope.kind === 'levels') {
      const scope = def.scope;
      return computeProgressColors(learner.selector, {
        kind: 'levels',
        levels: scope.allLevelIds.map((id) => ({
          id,
          itemIds: scope.getItemIdsForLevel(id),
        })),
        skippedLevels,
      });
    }
    return computeProgressColors(learner.selector, {
      kind: 'items',
      itemIds: def.allItems,
    });
  }, [def, learner.selector, learner.selector.version, _phase, skippedLevels]);
}

// ---------------------------------------------------------------------------
// useLevelBars — per-level progress bars for round-complete screen
// ---------------------------------------------------------------------------

/** Per-level progress bars for the round-complete screen.
 *  For level-based modes: one labeled bar per enabled group.
 *  For non-group modes: single unlabeled bar with all items.
 *  Only computed during round-complete phase to avoid unnecessary work. */
export function useLevelBars<Q>(
  def: SkillDefinition<Q>,
  learner: ReturnType<typeof useLearnerModel>,
  _phase: string,
  levelScopeResult: ReturnType<typeof useLevelScope> | null,
): LevelProgressEntry[] {
  const enabledLevels = levelScopeResult?.enabledLevels;
  return useMemo(() => {
    if (_phase !== 'round-complete') return [];
    if (def.scope.kind === 'levels' && enabledLevels) {
      const scope = def.scope;
      return scope.allLevelIds
        .filter((id) => enabledLevels.has(id))
        .map((id) => {
          const g = scope.levels.find((g) => g.id === id);
          const label = g ? resolveGroupLabel(g.longLabel ?? g.label) : id;
          const colors = progressBarColors(
            learner.selector,
            scope.getItemIdsForLevel(id),
          );
          return { id, label, colors };
        });
    }
    const colors = progressBarColors(learner.selector, def.allItems);
    return colors.length > 0 ? [{ id: '_all', label: '', colors }] : [];
  }, [def, learner.selector, learner.selector.version, _phase, enabledLevels]);
}
