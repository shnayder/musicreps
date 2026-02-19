// Shared mode controller: creates the full lifecycle for any quiz mode
// from a ModeDefinition. Owns tabs, practice summary, scope controls,
// recommendations, stats, engine wiring — everything modes used to
// duplicate across 10 closures.

import type {
  AdaptiveSelector,
  CalibrationTrialConfig,
  CheckAnswerResult,
  ModeController,
  ModeDefinition,
  ModeUIState,
  NoteFilter,
  NoteKeyHandler,
  PracticeSummaryState,
  QuizAreaEls,
  QuizEngine,
  QuizMode,
  RecommendationResult,
  ScopeState,
} from './types.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';
import { displayNote } from './music-data.ts';
import {
  createQuizEngine,
  pickCalibrationButton,
  refreshNoteButtonLabels,
} from './quiz-engine.ts';
import {
  buildStatsLegend,
  createStatsControls,
  getAutomaticityColor,
  renderStatsGrid,
  renderStatsTable,
} from './stats-display.ts';
import { computeRecommendations } from './recommendations.ts';
import {
  buildRecommendationText,
  computePracticeSummary,
} from './mode-ui-state.ts';

// ---------------------------------------------------------------------------
// Scope state management (load/save/toggle)
// ---------------------------------------------------------------------------

function loadScopeState(def: ModeDefinition): ScopeState {
  const spec = def.scopeSpec;
  if (spec.kind === 'none') return { kind: 'none' };

  if (spec.kind === 'groups') {
    let enabled = new Set(spec.defaultEnabled);
    const saved = localStorage.getItem(spec.storageKey);
    if (saved) {
      try {
        enabled = new Set(JSON.parse(saved));
      } catch (_) { /* expected */ }
    }
    return { kind: 'groups', enabledGroups: enabled };
  }

  if (spec.kind === 'fretboard') {
    const inst = spec.instrument;
    let enabledStrings = new Set([inst.defaultString]);
    const stringsKey = inst.storageNamespace + '_enabledStrings';
    const saved = localStorage.getItem(stringsKey);
    if (saved) {
      try {
        enabledStrings = new Set(JSON.parse(saved));
      } catch (_) { /* expected */ }
    }
    let noteFilter: NoteFilter = 'natural';
    const filterKey = inst.storageNamespace + '_noteFilter';
    const savedFilter = localStorage.getItem(filterKey);
    if (
      savedFilter === 'natural' || savedFilter === 'sharps-flats' ||
      savedFilter === 'all'
    ) {
      noteFilter = savedFilter;
    }
    return { kind: 'fretboard', enabledStrings, noteFilter };
  }

  if (spec.kind === 'note-filter') {
    let noteFilter: NoteFilter = 'natural';
    const saved = localStorage.getItem(spec.storageKey);
    if (saved === 'natural' || saved === 'sharps-flats' || saved === 'all') {
      noteFilter = saved;
    }
    return { kind: 'note-filter', noteFilter };
  }

  return { kind: 'none' };
}

function saveScopeState(def: ModeDefinition, scope: ScopeState): void {
  const spec = def.scopeSpec;
  if (spec.kind === 'groups' && scope.kind === 'groups') {
    localStorage.setItem(
      spec.storageKey,
      JSON.stringify([...scope.enabledGroups]),
    );
  } else if (spec.kind === 'fretboard' && scope.kind === 'fretboard') {
    const inst = spec.instrument;
    localStorage.setItem(
      inst.storageNamespace + '_enabledStrings',
      JSON.stringify([...scope.enabledStrings]),
    );
    try {
      localStorage.setItem(
        inst.storageNamespace + '_noteFilter',
        scope.noteFilter,
      );
    } catch (_) { /* expected */ }
  } else if (spec.kind === 'note-filter' && scope.kind === 'note-filter') {
    try {
      localStorage.setItem(spec.storageKey, scope.noteFilter);
    } catch (_) { /* expected */ }
  }
}

// ---------------------------------------------------------------------------
// createModeController
// ---------------------------------------------------------------------------

export function createModeController(
  def: ModeDefinition,
): ModeController {
  const container = document.getElementById('mode-' + def.id)!;

  // --- Mutable state ---
  let uiState: ModeUIState = {
    activeTab: 'practice',
    scope: loadScopeState(def),
    practice: emptyPracticeSummary(),
    statsMode: null,
    recommendation: null,
  };

  // --- Quiz area element references ---
  const quizAreaEls: QuizAreaEls = {
    promptEl: container.querySelector('.quiz-prompt')!,
    quizArea: container.querySelector('.quiz-area')!,
    container,
  };

  // For fretboard modes, add the SVG wrapper references
  if (def.scopeSpec.kind === 'fretboard') {
    quizAreaEls.fretboardWrapper = container.querySelector(
      '.quiz-area .fretboard-wrapper',
    ) as HTMLElement | undefined;
    quizAreaEls.progressFretboardWrapper = container.querySelector(
      '.tab-progress .fretboard-wrapper',
    ) as HTMLElement | undefined;
  }

  // --- Build QuizMode adapter for the engine ---
  const quizMode: QuizMode = {
    id: def.id,
    storageNamespace: def.storageNamespace,

    getEnabledItems(): string[] {
      return def.getEnabledItems(uiState.scope);
    },

    presentQuestion(itemId: string): void {
      const question = def.getQuestion(itemId);
      if (def.prompt.kind === 'text') {
        quizAreaEls.promptEl.textContent = def.prompt.getText(question);
      } else {
        def.prompt.clear(quizAreaEls);
        def.prompt.render(question, quizAreaEls);
      }
      // Handle bidirectional group switching
      if (def.response.kind === 'bidirectional') {
        const activeGroupId = def.response.getActiveGroup(question);
        for (const group of def.response.groups) {
          const groupEl = container.querySelector(
            '.answer-buttons-' + group.id,
          );
          if (groupEl) {
            groupEl.classList.toggle(
              'answer-group-hidden',
              group.id !== activeGroupId,
            );
          }
        }
      }
    },

    checkAnswer(itemId: string, input: string): CheckAnswerResult {
      return def.checkAnswer(itemId, input);
    },

    onStart(): void {
      keyHandler.reset();
      if (statsControls.mode) statsControls.hide();
      // Clear progress fretboard heatmap
      clearProgressFretboard();
    },

    onStop(): void {
      keyHandler.reset();
      if (def.prompt.kind === 'custom') {
        def.prompt.clear(quizAreaEls);
      }
      // Restore default button labels after modes that relabel per-question
      refreshNoteButtonLabels(container);
      if (uiState.activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean | void {
      return keyHandler.handleKey(e);
    },

    onAnswer(
      itemId: string,
      result: CheckAnswerResult,
      _responseTime: number,
    ): void {
      if (def.prompt.kind === 'custom' && def.prompt.onAnswer) {
        const question = def.getQuestion(itemId);
        def.prompt.onAnswer(question, result, quizAreaEls);
      }
    },

    getPracticingLabel(): string {
      return def.getPracticingLabel(uiState.scope);
    },
  };

  // Add optional fields
  if (def.getExpectedResponseCount) {
    const fn = def.getExpectedResponseCount.bind(def);
    quizMode.getExpectedResponseCount = fn;
  }
  if (def.calibrationProvider) {
    quizMode.calibrationProvider = def.calibrationProvider;
  }
  if (def.calibrationSpec?.introHint) {
    quizMode.calibrationIntroHint = def.calibrationSpec.introHint;
  }
  if (def.calibrationSpec?.getButtons) {
    const getButtons = def.calibrationSpec.getButtons;
    quizMode.getCalibrationButtons = () => getButtons(container);
  } else if (def.response.kind === 'buttons') {
    quizMode.getCalibrationButtons = () =>
      Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
  }
  if (def.calibrationSpec?.getTrialConfig) {
    quizMode.getCalibrationTrialConfig = def.calibrationSpec.getTrialConfig;
  } else {
    // Default: search-mode calibration using note buttons
    quizMode.getCalibrationTrialConfig = (
      buttons: HTMLElement[],
      prevBtn: HTMLElement | null,
    ): CalibrationTrialConfig => {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    };
  }

  // --- Create engine ---
  const engine: QuizEngine = createQuizEngine(quizMode, container);

  // --- Key handler ---
  const keyHandler: NoteKeyHandler = createKeyHandlerFromResponse(
    def,
    (input: string) => engine.submitAnswer(input),
    () => uiState.scope,
  );

  // --- Preload storage ---
  engine.storage.preload?.(def.allItemIds);

  // --- Stats controls ---
  const statsControls = createStatsControls(container, renderStats);

  // --- Utility: clear progress fretboard heatmap ---
  function clearProgressFretboard(): void {
    if (quizAreaEls.progressFretboardWrapper) {
      quizAreaEls.progressFretboardWrapper
        .querySelectorAll<SVGElement>('.fb-pos')
        .forEach((c) => (c.style.fill = ''));
    }
  }

  // --- Recommendations ---
  function getRecommendationResult(): RecommendationResult | null {
    const spec = def.scopeSpec;
    if (spec.kind === 'groups') {
      const allIndices = spec.groups.map((g) => g.index);
      return computeRecommendations(
        engine.selector,
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
        engine.selector,
        allStrings,
        (s: number) => {
          // Filter allItemIds to this string
          const prefix = s + '-';
          return def.allItemIds.filter((id) => id.startsWith(prefix));
        },
        DEFAULT_CONFIG,
        {
          sortUnstarted: (a, b) => b.string - a.string,
        },
      );
    }
    return null;
  }

  function getRecommendationText(
    result: RecommendationResult | null,
  ): string {
    if (!result || result.recommended.size === 0) return '';
    const spec = def.scopeSpec;
    const extras = def.getRecommendationContext?.(result, engine.selector)
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

  // --- Render stats (callback for statsControls) ---
  function renderStats(mode: string, el: HTMLElement): void {
    const statsSpec = def.stats;
    if (statsSpec.kind === 'table') {
      const tableDiv = document.createElement('div');
      el.appendChild(tableDiv);
      renderStatsTable(
        engine.selector,
        statsSpec.getRows(),
        statsSpec.fwdHeader,
        statsSpec.revHeader,
        mode,
        tableDiv,
        engine.baseline ?? undefined,
      );
      const legendDiv = document.createElement('div');
      legendDiv.innerHTML = buildStatsLegend(
        mode,
        engine.baseline ?? undefined,
      );
      el.appendChild(legendDiv);
    } else if (statsSpec.kind === 'grid') {
      const gridDiv = document.createElement('div');
      el.appendChild(gridDiv);
      renderStatsGrid(
        engine.selector,
        statsSpec.colLabels,
        statsSpec.getItemId,
        mode,
        gridDiv,
        statsSpec.notes,
        engine.baseline ?? undefined,
      );
      const legendDiv = document.createElement('div');
      legendDiv.innerHTML = buildStatsLegend(
        mode,
        engine.baseline ?? undefined,
      );
      el.appendChild(legendDiv);
    } else if (statsSpec.kind === 'custom') {
      statsSpec.render(
        mode,
        el,
        engine.selector,
        engine.baseline,
        container,
      );
    }
  }

  // --- UI rendering ---

  function refreshUI(): void {
    const rec = getRecommendationResult();
    uiState = {
      ...uiState,
      recommendation: rec,
      practice: computePracticeSummaryForController(rec),
    };
    renderIdleUI();
    updateScopeToggles();
    engine.updateIdleMessage();
  }

  function computePracticeSummaryForController(
    rec: RecommendationResult | null,
  ): PracticeSummaryState {
    const recText = getRecommendationText(rec);
    const itemNoun = def.scopeSpec.kind === 'fretboard' ? 'positions' : 'items';
    const enabledItems = def.getEnabledItems(uiState.scope);
    const allMastered = enabledItems.length > 0 &&
      engine.selector.checkAllMastered(enabledItems);
    const needsReview = !allMastered &&
      engine.selector.checkNeedsReview(enabledItems);
    let masteryText = '';
    let showMastery = false;
    if (allMastered) {
      masteryText = 'Looks like you\u2019ve got this!';
      showMastery = true;
    } else if (needsReview) {
      masteryText = 'Time to review?';
      showMastery = true;
    }

    return computePracticeSummary({
      allItemIds: def.allItemIds,
      selector: engine.selector,
      itemNoun,
      recommendation: rec,
      recommendationText: recText,
      sessionSummary: def.getSessionSummary(uiState.scope),
      masteryText,
      showMastery,
    });
  }

  function renderIdleUI(): void {
    const p = uiState.practice;
    const statusLabel = container.querySelector('.practice-status-label');
    const statusDetail = container.querySelector('.practice-status-detail');
    const recText = container.querySelector('.practice-rec-text');
    const recBtn = container.querySelector('.practice-rec-btn');
    const sessionSummary = container.querySelector('.session-summary-text');
    const masteryMsg = container.querySelector('.mastery-message');

    if (statusLabel) statusLabel.textContent = p.statusLabel;
    if (statusDetail) statusDetail.textContent = p.statusDetail;
    if (recText) recText.textContent = p.recommendationText;
    if (recBtn) recBtn.classList.toggle('hidden', !p.showRecommendationButton);
    if (sessionSummary) sessionSummary.textContent = p.sessionSummary;
    if (masteryMsg) {
      masteryMsg.textContent = p.masteryText;
      masteryMsg.classList.toggle('visible', p.showMastery);
    }
  }

  function updateScopeToggles(): void {
    const scope = uiState.scope;
    const rec = uiState.recommendation;

    if (scope.kind === 'groups') {
      container.querySelectorAll<HTMLElement>('.distance-toggle').forEach(
        (btn) => {
          const g = parseInt(btn.dataset.group!);
          btn.classList.toggle('active', scope.enabledGroups.has(g));
          btn.classList.toggle(
            'recommended',
            rec ? rec.recommended.has(g) : false,
          );
        },
      );
    } else if (scope.kind === 'fretboard') {
      container.querySelectorAll<HTMLElement>('.string-toggle').forEach(
        (btn) => {
          const s = parseInt(btn.dataset.string!);
          btn.classList.toggle('active', scope.enabledStrings.has(s));
          btn.classList.toggle(
            'recommended',
            rec ? rec.recommended.has(s) : false,
          );
        },
      );
      // Note filter toggles
      const naturalBtn = container.querySelector<HTMLElement>(
        '.notes-toggle[data-notes="natural"]',
      );
      const accBtn = container.querySelector<HTMLElement>(
        '.notes-toggle[data-notes="sharps-flats"]',
      );
      if (naturalBtn) {
        naturalBtn.classList.toggle(
          'active',
          scope.noteFilter === 'natural' || scope.noteFilter === 'all',
        );
      }
      if (accBtn) {
        accBtn.classList.toggle(
          'active',
          scope.noteFilter === 'sharps-flats' || scope.noteFilter === 'all',
        );
      }
      // Hide/show accidental buttons
      const hideAcc = scope.noteFilter === 'natural';
      container.querySelectorAll<HTMLElement>('.note-btn.accidental').forEach(
        (btn) => btn.classList.toggle('hidden', hideAcc),
      );
      const accRow = container.querySelector('.note-row-accidentals');
      if (accRow) accRow.classList.toggle('hidden', hideAcc);
    }
  }

  // --- Tab switching ---

  function switchTab(tabName: string): void {
    uiState = { ...uiState, activeTab: tabName as 'practice' | 'progress' };
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach((el) => {
      const isPractice = el.classList.contains('tab-practice');
      const isProgress = el.classList.contains('tab-progress');
      if (tabName === 'practice') {
        el.classList.toggle('active', isPractice);
      } else {
        el.classList.toggle('active', isProgress);
      }
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      // Clear progress fretboard heatmap when switching to practice
      clearProgressFretboard();
      refreshUI();
    }
  }

  // --- Scope mutation helpers ---

  function toggleGroup(groupIndex: number): void {
    if (uiState.scope.kind !== 'groups') return;
    const current = uiState.scope.enabledGroups;
    const next = new Set(current);
    if (next.has(groupIndex)) {
      if (next.size > 1) next.delete(groupIndex);
    } else {
      next.add(groupIndex);
    }
    uiState = { ...uiState, scope: { kind: 'groups', enabledGroups: next } };
    saveScopeState(def, uiState.scope);
    refreshUI();
  }

  function toggleFretboardString(s: number): void {
    if (uiState.scope.kind !== 'fretboard') return;
    const current = uiState.scope.enabledStrings;
    const next = new Set(current);
    if (next.has(s)) {
      if (next.size > 1) next.delete(s);
    } else {
      next.add(s);
    }
    uiState = {
      ...uiState,
      scope: {
        kind: 'fretboard',
        enabledStrings: next,
        noteFilter: uiState.scope.noteFilter,
      },
    };
    saveScopeState(def, uiState.scope);
    refreshUI();
  }

  function setNoteFilter(filter: NoteFilter): void {
    if (uiState.scope.kind === 'fretboard') {
      uiState = {
        ...uiState,
        scope: {
          kind: 'fretboard',
          enabledStrings: uiState.scope.enabledStrings,
          noteFilter: filter,
        },
      };
    } else if (uiState.scope.kind === 'note-filter') {
      uiState = {
        ...uiState,
        scope: { kind: 'note-filter', noteFilter: filter },
      };
    }
    saveScopeState(def, uiState.scope);
    refreshUI();
  }

  function applyRecommendations(): void {
    const rec = getRecommendationResult();
    if (!rec || rec.recommended.size === 0) return;

    if (uiState.scope.kind === 'groups' && rec.enabled) {
      uiState = {
        ...uiState,
        scope: { kind: 'groups', enabledGroups: rec.enabled },
      };
      saveScopeState(def, uiState.scope);
    } else if (uiState.scope.kind === 'fretboard' && rec.enabled) {
      // Check for note filter override from definition
      let noteFilter = uiState.scope.noteFilter;
      const ctx = def.getRecommendationContext?.(rec, engine.selector);
      if (ctx?.noteFilter) noteFilter = ctx.noteFilter;
      uiState = {
        ...uiState,
        scope: {
          kind: 'fretboard',
          enabledStrings: rec.enabled,
          noteFilter,
        },
      };
      saveScopeState(def, uiState.scope);
    }
    refreshUI();
  }

  // --- Init: wire up DOM ---

  function init(): void {
    // Tab switching
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
    });

    // Start button
    container.querySelector('.start-btn')!.addEventListener('click', () => {
      engine.start();
    });

    // Use recommendation button
    const recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', () => applyRecommendations());
    }

    // Scope-specific wiring
    wireScope();

    // Answer button wiring
    wireAnswerButtons();

    // Initial UI render
    refreshUI();
  }

  function wireScope(): void {
    const spec = def.scopeSpec;

    if (spec.kind === 'groups') {
      // Generate group toggle buttons
      const togglesDiv = container.querySelector('.distance-toggles');
      if (togglesDiv) {
        for (const group of spec.groups) {
          const btn = document.createElement('button');
          btn.className = 'distance-toggle';
          btn.dataset.group = String(group.index);
          btn.textContent = group.label;
          btn.addEventListener('click', () => toggleGroup(group.index));
          togglesDiv.appendChild(btn);
        }
      }
      // Set section label if specified
      if (spec.label) {
        const toggleLabel = container.querySelector('.toggle-group-label');
        if (toggleLabel) toggleLabel.textContent = spec.label;
      }
    } else if (spec.kind === 'fretboard') {
      // String toggles
      container.querySelectorAll<HTMLElement>('.string-toggle').forEach(
        (btn) => {
          btn.addEventListener('click', () => {
            toggleFretboardString(parseInt(btn.dataset.string!));
          });
        },
      );
      // Note filter toggles
      container.querySelectorAll<HTMLElement>('.notes-toggle').forEach(
        (btn) => {
          btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const anyActive = container.querySelector('.notes-toggle.active');
            if (!anyActive) btn.classList.add('active');
            const naturalActive = container.querySelector(
              '.notes-toggle[data-notes="natural"].active',
            );
            const accActive = container.querySelector(
              '.notes-toggle[data-notes="sharps-flats"].active',
            );
            let filter: NoteFilter;
            if (naturalActive && accActive) filter = 'all';
            else if (accActive) filter = 'sharps-flats';
            else filter = 'natural';
            setNoteFilter(filter);
          });
        },
      );
      // Hover card setup for progress fretboard
      if (quizAreaEls.progressFretboardWrapper) {
        setupHoverCard(
          quizAreaEls.progressFretboardWrapper,
          def,
          engine.selector,
        );
      }
    }
  }

  function wireAnswerButtons(): void {
    const resp = def.response;

    if (resp.kind === 'buttons') {
      container.querySelectorAll<HTMLElement>(
        '.note-btn, .answer-btn',
      ).forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          const answer = resp.getButtonAnswer(btn);
          if (answer) engine.submitAnswer(answer);
        });
      });
    } else if (resp.kind === 'bidirectional') {
      // Wire all answer buttons; each group's getButtonAnswer returns null
      // for buttons that don't belong to it.
      container.querySelectorAll<HTMLElement>('.answer-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          for (const group of resp.groups) {
            const answer = group.getButtonAnswer(btn);
            if (answer) {
              engine.submitAnswer(answer);
              return;
            }
          }
        });
      });
    }
  }

  // --- Lifecycle ---

  function activate(): void {
    engine.attach();
    refreshNoteButtonLabels(container);
    refreshUI();
  }

  function deactivate(): void {
    if (engine.isRunning) engine.stop();
    engine.detach();
    keyHandler.reset();
  }

  function onNotationChange(): void {
    if (!container.classList.contains('mode-active')) return;
    refreshUI();
    if (uiState.activeTab === 'progress' && statsControls.mode) {
      statsControls.show(statsControls.mode);
    }
  }

  return { init, activate, deactivate, onNotationChange };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPracticeSummary(): PracticeSummaryState {
  return {
    statusLabel: '',
    statusDetail: '',
    recommendationText: '',
    showRecommendationButton: false,
    sessionSummary: '',
    masteryText: '',
    showMastery: false,
    enabledItemCount: 0,
  };
}

function createKeyHandlerFromResponse(
  def: ModeDefinition,
  submitAnswer: (input: string) => void,
  getScope: () => ScopeState,
): NoteKeyHandler {
  const resp = def.response;
  if (resp.kind === 'buttons' || resp.kind === 'bidirectional') {
    return resp.createKeyHandler(submitAnswer, getScope);
  }
  if (resp.kind === 'sequential') {
    return resp.createKeyHandler(submitAnswer, getScope);
  }
  // spatial or no handler
  if (resp.kind === 'spatial' && resp.createKeyHandler) {
    return resp.createKeyHandler(submitAnswer, getScope);
  }
  return { handleKey: () => false, reset: () => {} };
}

/**
 * Set up hover card on a fretboard wrapper (progress tab).
 * Shows note name, string/fret info, and automaticity on hover.
 */
function setupHoverCard(
  wrapper: HTMLElement,
  def: ModeDefinition,
  selector: AdaptiveSelector,
): void {
  const card = wrapper.querySelector('.hover-card') as HTMLElement | null;
  if (!card) return;

  const svg = wrapper.querySelector('svg');
  if (!svg) return;

  svg.addEventListener('mouseover', (e: MouseEvent) => {
    const el = (e.target as Element).closest('.fb-pos');
    if (!el) return;
    const s = parseInt(el.getAttribute('data-string')!);
    const f = parseInt(el.getAttribute('data-fret')!);
    const itemId = s + '-' + f;

    // Get note from the definition's question data
    const question = def.getQuestion(itemId);
    const note = (question as { currentNote?: string }).currentNote || '';
    const auto = selector.getAutomaticity(itemId);

    const noteEl = card.querySelector('.hc-note');
    if (noteEl) noteEl.textContent = displayNote(note);

    // String/fret detail
    const stringFretEl = card.querySelector('.hc-string-fret');
    if (stringFretEl && def.scopeSpec.kind === 'fretboard') {
      const inst = def.scopeSpec.instrument;
      stringFretEl.textContent = displayNote(inst.stringNames[s]) +
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

    // Position card above circle (or below if near top)
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
  });

  svg.addEventListener('mouseout', (e: MouseEvent) => {
    const el = (e.target as Element).closest('.fb-pos');
    if (el) card.classList.remove('visible');
  });
}
