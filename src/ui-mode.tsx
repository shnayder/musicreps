// ModeView: renders a single quiz mode with tabs, scope, quiz session.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type {
  AdaptiveSelector,
  CheckAnswerResult,
  ModeDefinition,
  NoteFilter,
  RecommendationResult,
  ScopeState,
} from './types.ts';
import { useQuizEngine } from './use-quiz-engine.ts';
import {
  CountdownBar,
  FretboardSVG,
  NoteButtons,
  NumberButtons,
  ProgressBar,
  RoundComplete,
} from './ui-shared.tsx';
import { computeRecommendations } from './recommendations.ts';
import { buildRecommendationText } from './mode-ui-state.ts';
import { displayNote } from './music-data.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getSpeedHeatmapColor,
  renderStatsGrid,
  renderStatsTable,
} from './stats-display.ts';

// ---------------------------------------------------------------------------
// Scope state helpers
// ---------------------------------------------------------------------------

function loadScope(def: ModeDefinition): ScopeState {
  const spec = def.scopeSpec;
  if (spec.kind === 'none') return { kind: 'none' };
  if (spec.kind === 'groups') {
    const stored = localStorage.getItem(spec.storageKey);
    if (stored) {
      try {
        const arr = JSON.parse(stored);
        return { kind: 'groups', enabledGroups: new Set(arr) };
      } catch { /* use default */ }
    }
    return { kind: 'groups', enabledGroups: new Set(spec.defaultEnabled) };
  }
  if (spec.kind === 'fretboard') {
    const inst = spec.instrument;
    const key = 'scope_' + inst.id;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const obj = JSON.parse(stored);
        return {
          kind: 'fretboard',
          enabledStrings: new Set(obj.strings || [inst.defaultString]),
          noteFilter: obj.noteFilter || 'all',
        };
      } catch { /* use default */ }
    }
    return {
      kind: 'fretboard',
      enabledStrings: new Set([inst.defaultString]),
      noteFilter: 'all' as NoteFilter,
    };
  }
  if (spec.kind === 'note-filter') {
    const stored = localStorage.getItem(spec.storageKey);
    return {
      kind: 'note-filter',
      noteFilter: (stored as NoteFilter) || 'all',
    };
  }
  return { kind: 'none' };
}

function saveScope(def: ModeDefinition, scope: ScopeState): void {
  const spec = def.scopeSpec;
  if (spec.kind === 'groups' && scope.kind === 'groups') {
    localStorage.setItem(
      spec.storageKey,
      JSON.stringify([...scope.enabledGroups]),
    );
  }
  if (spec.kind === 'fretboard' && scope.kind === 'fretboard') {
    const inst = spec.instrument;
    localStorage.setItem(
      'scope_' + inst.id,
      JSON.stringify({
        strings: [...scope.enabledStrings],
        noteFilter: scope.noteFilter,
      }),
    );
  }
  if (spec.kind === 'note-filter' && scope.kind === 'note-filter') {
    localStorage.setItem(spec.storageKey, scope.noteFilter);
  }
}

// ---------------------------------------------------------------------------
// Recommendation helpers
// ---------------------------------------------------------------------------

function getRecommendationResult(
  def: ModeDefinition,
  selector: AdaptiveSelector,
): RecommendationResult | null {
  const spec = def.scopeSpec;
  if (spec.kind === 'groups') {
    const allIndices = spec.groups.map((g) => g.index);
    return computeRecommendations(
      selector,
      allIndices,
      (index: number) => spec.groups[index].itemIds,
      DEFAULT_CONFIG,
      spec.sortUnstarted ? { sortUnstarted: spec.sortUnstarted } : undefined,
    );
  }
  if (spec.kind === 'fretboard') {
    const inst = spec.instrument;
    const allStrings = Array.from(
      { length: inst.stringCount },
      (_, i) => i,
    );
    return computeRecommendations(
      selector,
      allStrings,
      (s: number) => {
        const prefix = s + '-';
        return def.allItemIds.filter((id) => id.startsWith(prefix));
      },
      DEFAULT_CONFIG,
      { sortUnstarted: (a, b) => b.string - a.string },
    );
  }
  return null;
}

function getRecommendationText(
  def: ModeDefinition,
  result: RecommendationResult | null,
  selector: AdaptiveSelector,
): string {
  if (!result || result.recommended.size === 0) return '';
  const spec = def.scopeSpec;
  const extras = def.getRecommendationContext?.(result, selector)
    ?.extraParts ?? [];
  if (spec.kind === 'groups') {
    return buildRecommendationText(
      result,
      (index) => spec.groups[index].label,
      extras,
    );
  }
  if (spec.kind === 'fretboard') {
    const inst = spec.instrument;
    return buildRecommendationText(
      result,
      (s) => displayNote(inst.stringNames[s]) + ' string',
      extras,
    );
  }
  return '';
}

// ---------------------------------------------------------------------------
// ModeView component
// ---------------------------------------------------------------------------

export function ModeView({
  def,
  onHome,
}: {
  def: ModeDefinition;
  onHome: () => void;
}) {
  const [scope, setScope] = useState<ScopeState>(() => loadScope(def));
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [highlights, setHighlights] = useState<Map<string, string>>(
    new Map(),
  );
  const [lastResult, setLastResult] = useState<CheckAnswerResult | null>(null);

  const engine = useQuizEngine(def, scope);
  const { state, countdown } = engine;

  // Persist scope changes
  useEffect(() => {
    saveScope(def, scope);
  }, [scope, def]);

  // Update idle message when scope changes
  useEffect(() => {
    engine.updateIdleMessage();
  }, [scope]);

  // Current question data
  const question = useMemo(() => {
    if (!state.currentItemId) return null;
    return def.getQuestion(state.currentItemId);
  }, [state.currentItemId, def]);

  // -- Fretboard highlights --
  useEffect(() => {
    if (!question || !state.currentItemId) {
      setHighlights(new Map());
      return;
    }
    // For fretboard modes: highlight the current position
    const q = question as { currentString?: number; currentFret?: number };
    if (q.currentString !== undefined && q.currentFret !== undefined) {
      setHighlights(
        new Map([[
          `${q.currentString}-${q.currentFret}`,
          'hsl(50, 100%, 50%)',
        ]]),
      );
    }
  }, [question, state.currentItemId]);

  // -- Handle answer feedback for fretboard --
  useEffect(() => {
    if (!lastResult || !state.currentItemId) return;
    const q = question as { currentString?: number; currentFret?: number };
    if (q?.currentString !== undefined && q?.currentFret !== undefined) {
      const color = lastResult.correct
        ? 'hsl(140, 70%, 45%)'
        : 'hsl(0, 80%, 55%)';
      setHighlights(
        new Map([[`${q.currentString}-${q.currentFret}`, color]]),
      );
    }
    setLastResult(null);
  }, [lastResult]);

  // -- Key handler setup --
  useEffect(() => {
    const response = def.response;
    if (response.kind === 'buttons' || response.kind === 'bidirectional') {
      const handler = response.createKeyHandler(
        (input: string) => {
          const result = engine.submitAnswer(input);
          if (result) setLastResult(result);
        },
        () => scope,
      );
      engine.setKeyHandler(handler);
      return () => {
        handler.reset();
        engine.setKeyHandler(null);
      };
    }
  }, [def, scope]);

  // Submit handler for button clicks
  const handleAnswer = useCallback(
    (input: string) => {
      const result = engine.submitAnswer(input);
      if (result) setLastResult(result);
    },
    [engine],
  );

  // Tap-to-advance
  const handleTapAdvance = useCallback(
    (e: MouseEvent) => {
      if (state.phase !== 'active' || !state.answered) return;
      if ((e.target as HTMLElement).closest('.answer-btn, .note-btn')) return;
      engine.nextQuestion();
    },
    [state.phase, state.answered, engine],
  );

  // Determine phase class
  const phaseClass = state.phase === 'active'
    ? 'phase-active'
    : state.phase === 'round-complete'
    ? 'phase-round-complete'
    : 'phase-idle';

  // Prompt text
  const promptText = useMemo(() => {
    if (!question) return '';
    if (def.prompt.kind === 'text') {
      return def.prompt.getText(question);
    }
    // Custom prompts: extract text from question
    const q = question as { questionText?: string };
    if (q.questionText) return q.questionText;
    // Fretboard: "What note is this?"
    const fq = question as { currentString?: number };
    if (fq.currentString !== undefined) return 'What note is this?';
    return '';
  }, [question, def]);

  // UseFlats flag for button relabeling
  const useFlats = useMemo(() => {
    const q = question as { useFlats?: boolean };
    return q?.useFlats ?? false;
  }, [question]);

  // Hide accidentals for fretboard natural-only mode
  const hideAccidentals = useMemo(() => {
    if (scope.kind === 'fretboard') return scope.noteFilter === 'natural';
    return false;
  }, [scope]);

  // Bidirectional: active group
  const activeGroup = useMemo(() => {
    if (def.response.kind !== 'bidirectional' || !question) return null;
    return def.response.getActiveGroup(question);
  }, [def, question]);

  // Practicing label
  const practicingLabel = useMemo(
    () => def.getPracticingLabel(scope),
    [def, scope],
  );
  const sessionSummary = useMemo(
    () => def.getSessionSummary(scope),
    [def, scope],
  );

  // Is this a fretboard mode?
  const isFretboard = def.scopeSpec.kind === 'fretboard';
  const fretboardConfig = isFretboard
    ? {
      stringCount: (def.scopeSpec as { instrument: { stringCount: number } })
        .instrument.stringCount,
      fretCount: (def.scopeSpec as { instrument: { fretCount: number } })
        .instrument.fretCount,
      markers: (def.scopeSpec as { instrument: { fretMarkers: number[] } })
        .instrument.fretMarkers,
    }
    : null;

  // Recommendation
  const recommendation = useMemo(
    () => getRecommendationResult(def, engine.selector),
    [def, engine.selector, state.phase],
  );
  const recommendationText = useMemo(
    () => getRecommendationText(def, recommendation, engine.selector),
    [def, recommendation, engine.selector],
  );

  const applyRecommendation = useCallback(() => {
    if (!recommendation || recommendation.recommended.size === 0) return;
    if (!recommendation.enabled) return;

    if (scope.kind === 'groups') {
      setScope({ kind: 'groups', enabledGroups: recommendation.enabled });
    } else if (scope.kind === 'fretboard') {
      let noteFilter = scope.noteFilter;
      const ctx = def.getRecommendationContext?.(
        recommendation,
        engine.selector,
      );
      if (ctx?.noteFilter) noteFilter = ctx.noteFilter;
      setScope({
        kind: 'fretboard',
        enabledStrings: recommendation.enabled,
        noteFilter,
      });
    }
  }, [recommendation, scope, def, engine.selector]);

  // Home navigation via Escape when idle
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.phase === 'idle') {
        onHome();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.phase, onHome]);

  return (
    <div
      class={`mode-screen mode-active ${phaseClass}`}
      id={`mode-${def.id}`}
      onClick={handleTapAdvance}
    >
      {/* --- Top bar: back arrow + mode name --- */}
      <div class='mode-top-bar'>
        <button
          type='button'
          class='mode-back-btn'
          aria-label='Back to home'
          onClick={onHome}
        >
          {'\u2190'}
        </button>
        <h1 class='mode-title'>{def.name}</h1>
      </div>

      {/* --- Idle: tabs + content --- */}
      {state.phase === 'idle' && (
        <>
          <div class='mode-tabs'>
            <button
              type='button'
              class={`mode-tab${activeTab === 'practice' ? ' active' : ''}`}
              data-tab='practice'
              onClick={() => setActiveTab('practice')}
            >
              Practice
            </button>
            <button
              type='button'
              class={`mode-tab${activeTab === 'progress' ? ' active' : ''}`}
              data-tab='progress'
              onClick={() => setActiveTab('progress')}
            >
              Progress
            </button>
          </div>

          {activeTab === 'practice' && (
            <div class='tab-content tab-practice active'>
              <div class='practice-card'>
                <div class='practice-zone practice-zone-status'>
                  <PracticeSummary
                    def={def}
                    scope={scope}
                    selector={engine.selector}
                  />
                  {def.scopeSpec.kind === 'none' && (
                    <RecommendationBlock
                      text={recommendationText}
                      onApply={applyRecommendation}
                    />
                  )}
                </div>

                {def.scopeSpec.kind !== 'none' && (
                  <div class='practice-zone practice-zone-scope'>
                    <RecommendationBlock
                      text={recommendationText}
                      onApply={applyRecommendation}
                    />
                    <ScopeControls
                      def={def}
                      scope={scope}
                      setScope={setScope}
                      recommended={recommendation?.recommended ?? null}
                    />
                    {state.showMastery && (
                      <div class='mastery-message mastery-visible'>
                        {state.masteryText}
                      </div>
                    )}
                  </div>
                )}

                <div class='practice-zone practice-zone-action'>
                  <div class='session-summary-text'>{sessionSummary}</div>
                  <button
                    type='button'
                    class='start-btn'
                    onClick={engine.start}
                  >
                    Start Quiz
                  </button>
                </div>
              </div>

              <BaselineInfo baseline={engine.baseline} />
            </div>
          )}

          {activeTab === 'progress' && (
            <div class='tab-content tab-progress active'>
              <StatsView
                def={def}
                selector={engine.selector}
                baseline={engine.baseline}
                fretboardConfig={fretboardConfig}
              />
            </div>
          )}
        </>
      )}

      {/* --- Active quiz --- */}
      {state.phase === 'active' && (
        <div class='quiz-session'>
          <CountdownBar pct={countdown.pct} warning={countdown.warning} />
          <div class='quiz-session-info'>
            <span class='quiz-info-context'>{practicingLabel}</span>
            <span class='quiz-info-time'>{countdown.time}</span>
            <span class='quiz-info-count'>
              {state.roundAnswered}
              {state.roundAnswered === 1 ? ' answer' : ' answers'}
            </span>
          </div>
          {countdown.lastQuestion && (
            <div class='quiz-last-question'>Last question</div>
          )}
          <ProgressBar
            masteredCount={state.masteredCount}
            totalEnabledCount={state.totalEnabledCount}
          />
          <div class={`quiz-area${state.quizActive ? ' active' : ''}`}>
            <button
              type='button'
              class='quiz-header-close'
              onClick={engine.stop}
            >
              &times;
            </button>
            <div class='quiz-prompt'>{promptText}</div>
            {/* Fretboard SVG */}
            {isFretboard && fretboardConfig && (
              <FretboardSVG
                stringCount={fretboardConfig.stringCount}
                fretCount={fretboardConfig.fretCount}
                markers={fretboardConfig.markers}
                highlights={highlights}
              />
            )}
            {/* Answer buttons */}
            <AnswerArea
              def={def}
              activeGroup={activeGroup}
              onAnswer={handleAnswer}
              disabled={!state.answersEnabled}
              useFlats={useFlats}
              hideAccidentals={hideAccidentals}
            />
            {/* Feedback */}
            <div class={state.feedbackClass}>{state.feedbackText}</div>
            {state.timeDisplayText && (
              <div class='time-display'>{state.timeDisplayText}</div>
            )}
            <div class='hint'>{state.hintText}</div>
          </div>
        </div>
      )}

      {/* --- Round complete --- */}
      {state.phase === 'round-complete' && (
        <div class='quiz-session'>
          <RoundComplete
            state={state}
            practicingLabel={practicingLabel}
            onContinue={engine.continueQuiz}
            onStop={engine.stop}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer area: renders the right buttons based on response spec
// ---------------------------------------------------------------------------

function AnswerArea({
  def,
  activeGroup,
  onAnswer,
  disabled,
  useFlats,
  hideAccidentals,
}: {
  def: ModeDefinition;
  activeGroup: string | null;
  onAnswer: (input: string) => void;
  disabled: boolean;
  useFlats: boolean;
  hideAccidentals: boolean;
}) {
  const response = def.response;

  if (response.kind === 'buttons') {
    return (
      <NoteButtons
        onAnswer={onAnswer}
        disabled={disabled}
        useFlats={useFlats}
        hideAccidentals={hideAccidentals}
      />
    );
  }

  if (response.kind === 'bidirectional') {
    return (
      <>
        {response.groups.map((group) => (
          <div
            key={group.id}
            class={`answer-group${activeGroup === group.id ? ' active' : ''}`}
            style={{ display: activeGroup === group.id ? 'block' : 'none' }}
          >
            {group.id === 'notes' && (
              <NoteButtons
                onAnswer={onAnswer}
                disabled={disabled}
                useFlats={useFlats}
                hideAccidentals={hideAccidentals}
              />
            )}
            {group.id === 'numbers' && (
              <NumberButtons
                min={0}
                max={11}
                onAnswer={onAnswer}
                disabled={disabled}
              />
            )}
          </div>
        ))}
      </>
    );
  }

  // Fallback: just note buttons
  return (
    <NoteButtons
      onAnswer={onAnswer}
      disabled={disabled}
      useFlats={useFlats}
      hideAccidentals={hideAccidentals}
    />
  );
}

// ---------------------------------------------------------------------------
// Scope controls
// ---------------------------------------------------------------------------

function ScopeControls({
  def,
  scope,
  setScope,
  recommended,
}: {
  def: ModeDefinition;
  scope: ScopeState;
  setScope: (s: ScopeState) => void;
  recommended: Set<number> | null;
}) {
  const spec = def.scopeSpec;

  if (spec.kind === 'fretboard' && scope.kind === 'fretboard') {
    const inst = spec.instrument;
    return (
      <div class='toggle-group'>
        <span class='toggle-group-label'>Strings</span>
        <div class='string-toggles'>
          {inst.stringNames.map((name, i) => {
            let cls = 'string-toggle';
            if (scope.enabledStrings.has(i)) cls += ' active';
            if (recommended && recommended.has(i)) cls += ' recommended';
            return (
              <button
                type='button'
                key={i}
                class={cls}
                data-string={i}
                data-string-note={name}
                onClick={() => {
                  const next = new Set(scope.enabledStrings);
                  if (next.has(i)) {
                    if (next.size > 1) next.delete(i);
                  } else {
                    next.add(i);
                  }
                  setScope({ ...scope, enabledStrings: next });
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (spec.kind === 'groups' && scope.kind === 'groups') {
    return (
      <div class='toggle-group'>
        <span class='toggle-group-label'>
          {spec.label || 'Groups'}
        </span>
        <div class='distance-toggles'>
          {spec.groups.map((g) => {
            let cls = 'distance-toggle';
            if (scope.enabledGroups.has(g.index)) cls += ' active';
            if (recommended && recommended.has(g.index)) cls += ' recommended';
            return (
              <button
                type='button'
                key={g.index}
                class={cls}
                data-group={g.index}
                onClick={() => {
                  const next = new Set(scope.enabledGroups);
                  if (next.has(g.index)) {
                    if (next.size > 1) next.delete(g.index);
                  } else {
                    next.add(g.index);
                  }
                  setScope({ ...scope, enabledGroups: next });
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recommendation block
// ---------------------------------------------------------------------------

function RecommendationBlock({
  text,
  onApply,
}: {
  text: string;
  onApply: () => void;
}) {
  if (!text) return null;
  return (
    <div class='practice-recommendation'>
      <span class='practice-rec-text'>{text}</span>
      <button type='button' class='practice-rec-btn' onClick={onApply}>
        Use suggestion
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice summary
// ---------------------------------------------------------------------------

function PracticeSummary({
  def,
  scope,
  selector,
}: {
  def: ModeDefinition;
  scope: ScopeState;
  selector: {
    getAutomaticity: (id: string) => number | null;
    getConfig: () => {
      automaticityThreshold: number;
      expansionThreshold: number;
    };
  };
}) {
  const items = def.getEnabledItems(scope);
  const threshold = selector.getConfig().automaticityThreshold;
  let mastered = 0;
  let seen = 0;
  for (const id of items) {
    const a = selector.getAutomaticity(id);
    if (a !== null) {
      seen++;
      if (a > threshold) mastered++;
    }
  }
  const total = items.length;
  const remaining = total - mastered;
  const statusLabel = total === 0
    ? 'No items'
    : mastered === total
    ? 'All mastered'
    : seen === 0
    ? 'Getting started'
    : 'Practicing';
  const statusDetail = total === 0
    ? 'Select some items to practice'
    : mastered === total
    ? 'All ' + total + ' items fluent'
    : mastered + ' / ' + total + ' fluent \u00B7 ' + remaining +
      ' to go';

  return (
    <div class='practice-status'>
      <span class='practice-status-label'>{statusLabel}</span>
      <span class='practice-status-detail'>{statusDetail}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Baseline info
// ---------------------------------------------------------------------------

function BaselineInfo({ baseline }: { baseline: number | null }) {
  if (baseline) {
    return (
      <div class='baseline-info'>
        <span>
          Response time baseline: {(baseline / 1000).toFixed(1)}s{' '}
        </span>
      </div>
    );
  }
  return (
    <div class='baseline-info'>
      <span>Response time baseline: 1s (default)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats view
// ---------------------------------------------------------------------------

function StatsView({
  def,
  selector,
  baseline,
  fretboardConfig,
}: {
  def: ModeDefinition;
  selector: AdaptiveSelector;
  baseline: number | null;
  fretboardConfig: {
    stringCount: number;
    fretCount: number;
    markers: number[];
  } | null;
}) {
  const [statsMode, setStatsMode] = useState<'retention' | 'speed'>(
    'retention',
  );
  const statsContainerRef = useRef<HTMLDivElement>(null);

  // Compute fretboard heatmap colors
  const statsHighlights = useMemo(() => {
    if (!fretboardConfig) return null;
    const map = new Map<string, string>();
    for (let s = 0; s < fretboardConfig.stringCount; s++) {
      for (let f = 0; f < fretboardConfig.fretCount; f++) {
        const itemId = s + '-' + f;
        if (statsMode === 'retention') {
          map.set(
            `${s}-${f}`,
            getAutomaticityColor(selector.getAutomaticity(itemId)),
          );
        } else {
          const stats = selector.getStats(itemId);
          map.set(
            `${s}-${f}`,
            getSpeedHeatmapColor(
              stats ? stats.ewma : null,
              baseline ?? undefined,
            ),
          );
        }
      }
    }
    return map;
  }, [fretboardConfig, statsMode, selector, baseline]);

  // Render table/grid stats for non-fretboard modes
  useEffect(() => {
    if (fretboardConfig || !statsContainerRef.current) return;
    const el = statsContainerRef.current;
    el.innerHTML = '';

    const statsSpec = def.stats;
    if (statsSpec.kind === 'table') {
      const tableDiv = document.createElement('div');
      el.appendChild(tableDiv);
      renderStatsTable(
        selector,
        statsSpec.getRows(),
        statsSpec.fwdHeader,
        statsSpec.revHeader,
        statsMode,
        tableDiv,
        baseline ?? undefined,
      );
    } else if (statsSpec.kind === 'grid') {
      const gridDiv = document.createElement('div');
      gridDiv.className = 'stats-grid-wrapper';
      el.appendChild(gridDiv);
      renderStatsGrid(
        selector,
        statsSpec.colLabels,
        statsSpec.getItemId,
        statsMode,
        gridDiv,
        statsSpec.notes,
        baseline ?? undefined,
      );
    }

    // Legend
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(
      statsMode,
      baseline ?? undefined,
    );
    el.appendChild(legendDiv);
  }, [def, selector, statsMode, baseline, fretboardConfig]);

  // Fluent count
  const fluentText = useMemo(() => {
    const items = def.allItemIds;
    const threshold = selector.getConfig().automaticityThreshold;
    let fluent = 0;
    for (const id of items) {
      const a = selector.getAutomaticity(id);
      if (a !== null && a > threshold) fluent++;
    }
    return fluent + ' / ' + items.length + ' items fluent';
  }, [def, selector]);

  return (
    <>
      {/* Fretboard heatmap */}
      {fretboardConfig && statsHighlights && (
        <FretboardSVG
          stringCount={fretboardConfig.stringCount}
          fretCount={fretboardConfig.fretCount}
          markers={fretboardConfig.markers}
          highlights={statsHighlights}
        />
      )}

      <BaselineInfo baseline={baseline} />

      <div class='stats-controls'>
        <div class='stats-toggle'>
          <button
            type='button'
            class={`stats-toggle-btn${
              statsMode === 'retention' ? ' active' : ''
            }`}
            data-mode='retention'
            onClick={() => setStatsMode('retention')}
          >
            Recall
          </button>
          <button
            type='button'
            class={`stats-toggle-btn${statsMode === 'speed' ? ' active' : ''}`}
            data-mode='speed'
            onClick={() => setStatsMode('speed')}
          >
            Speed
          </button>
        </div>
        <span class='stats'>{fluentText}</span>
      </div>

      {/* Fretboard legend */}
      {fretboardConfig && (
        <div
          class='stats-container'
          dangerouslySetInnerHTML={{
            __html: buildStatsLegend(statsMode, baseline ?? undefined),
          }}
        />
      )}

      {/* Table/grid stats container */}
      {!fretboardConfig && (
        <div class='stats-container' ref={statsContainerRef} />
      )}
    </>
  );
}
