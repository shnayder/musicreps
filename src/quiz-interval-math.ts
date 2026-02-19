// Interval Math quiz mode: note +/- interval = note.
// "C + m3 = ?" -> D#/Eb,  "G - P4 = ?" -> D
// 264 items: 12 notes x 11 intervals (m2-M7) x 2 directions (+/-).
// Excludes octave/P8 (adding 12 semitones gives same note).
// Grouped by interval pair into 6 distance groups for progressive unlocking.

import type { Interval, Note, StringRecommendation } from './types.ts';
import {
  displayNote,
  INTERVALS,
  noteAdd,
  noteMatchesInput,
  NOTES,
  noteSub,
  pickAccidentalName,
} from './music-data.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';
import {
  createAdaptiveKeyHandler,
  createQuizEngine,
  pickCalibrationButton,
  refreshNoteButtonLabels,
} from './quiz-engine.ts';
import {
  buildStatsLegend,
  createStatsControls,
  renderStatsGrid,
} from './stats-display.ts';
import { computeRecommendations } from './recommendations.ts';

export function createIntervalMathMode() {
  const container = document.getElementById('mode-intervalMath')!;
  const GROUPS_KEY = 'intervalMath_enabledGroups';

  // Intervals 1-11 only (no octave)
  const MATH_INTERVALS = INTERVALS.filter((i) => i.num >= 1 && i.num <= 11);

  // Distance groups: pairs of intervals by semitone count
  const DISTANCE_GROUPS = [
    { distances: [1, 2], label: 'm2 M2' },
    { distances: [3, 4], label: 'm3 M3' },
    { distances: [5, 6], label: 'P4 TT' },
    { distances: [7, 8], label: 'P5 m6' },
    { distances: [9, 10], label: 'M6 m7' },
    { distances: [11], label: 'M7' },
  ];

  let enabledGroups = new Set<number>([0]); // Default: first group only
  let recommendedGroups = new Set<number>();

  // Build full item list (for preloading & stats display)
  const ALL_ITEMS: string[] = [];
  for (const note of NOTES) {
    for (const interval of MATH_INTERVALS) {
      ALL_ITEMS.push(note.name + '+' + interval.abbrev);
      ALL_ITEMS.push(note.name + '-' + interval.abbrev);
    }
  }

  function parseItem(
    itemId: string,
  ): { note: Note; op: string; interval: Interval; answer: Note } {
    const match = itemId.match(/^([A-G]#?)([+-])(.+)$/)!;
    const noteName = match[1];
    const op = match[2];
    const abbrev = match[3];
    const note = NOTES.find((n) => n.name === noteName)!;
    const interval = MATH_INTERVALS.find((i) => i.abbrev === abbrev)!;
    const answer = op === '+'
      ? noteAdd(note.num, interval.num)
      : noteSub(note.num, interval.num);
    return { note, op, interval, answer };
  }

  // --- Distance group helpers ---

  function getItemIdsForGroup(groupIndex: number): string[] {
    const distances = DISTANCE_GROUPS[groupIndex].distances;
    const intervals = MATH_INTERVALS.filter((i) => distances.includes(i.num));
    const items: string[] = [];
    for (const note of NOTES) {
      for (const interval of intervals) {
        items.push(note.name + '+' + interval.abbrev);
        items.push(note.name + '-' + interval.abbrev);
      }
    }
    return items;
  }

  function loadEnabledGroups(): void {
    const saved = localStorage.getItem(GROUPS_KEY);
    if (saved) {
      try {
        enabledGroups = new Set(JSON.parse(saved));
      } catch { /* expected */ }
    }
    updateGroupToggles();
  }

  function saveEnabledGroups(): void {
    localStorage.setItem(GROUPS_KEY, JSON.stringify([...enabledGroups]));
  }

  function updateGroupToggles(): void {
    container.querySelectorAll<HTMLElement>('.distance-toggle').forEach(
      (btn) => {
        const g = parseInt(btn.dataset.group!);
        btn.classList.toggle('active', enabledGroups.has(g));
        btn.classList.toggle('recommended', recommendedGroups.has(g));
      },
    );
  }

  const recsOptions = {
    sortUnstarted: (a: StringRecommendation, b: StringRecommendation) =>
      a.string - b.string,
  };

  function getRecommendationResult() {
    const allGroups = DISTANCE_GROUPS.map((_: unknown, i: number) => i);
    return computeRecommendations(
      engine.selector,
      allGroups,
      getItemIdsForGroup,
      DEFAULT_CONFIG,
      recsOptions,
    );
  }

  function updateRecommendations(): void {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(): void {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    if (result.enabled) {
      enabledGroups = result.enabled;
      saveEnabledGroups();
    }
    updateGroupToggles();
  }

  function toggleGroup(g: number): void {
    if (enabledGroups.has(g)) {
      if (enabledGroups.size > 1) enabledGroups.delete(g);
    } else {
      enabledGroups.add(g);
    }
    saveEnabledGroups();
    refreshUI();
  }

  // --- Tab state ---
  let activeTab = 'practice';

  function switchTab(tabName: string): void {
    activeTab = tabName;
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach((el) => {
      el.classList.toggle(
        'active',
        tabName === 'practice'
          ? el.classList.contains('tab-practice')
          : el.classList.contains('tab-progress'),
      );
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      renderPracticeSummary();
    }
  }

  function refreshUI(): void {
    updateRecommendations();
    engine.updateIdleMessage();
    renderPracticeSummary();
    renderSessionSummary();
  }

  // --- Practice summary ---

  function renderPracticeSummary(): void {
    const statusLabel = container.querySelector('.practice-status-label');
    const statusDetail = container.querySelector('.practice-status-detail');
    const recText = container.querySelector('.practice-rec-text');
    const recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    const items = mode.getEnabledItems();
    const threshold = engine.selector.getConfig().automaticityThreshold;
    let fluent = 0, seen = 0;
    for (let i = 0; i < items.length; i++) {
      const auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) {
        seen++;
        if (auto > threshold) fluent++;
      }
    }
    let allFluent = 0;
    for (let j = 0; j < ALL_ITEMS.length; j++) {
      const a2 = engine.selector.getAutomaticity(ALL_ITEMS[j]);
      if (a2 !== null && a2 > threshold) allFluent++;
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail!.textContent = ALL_ITEMS.length + ' items to learn';
    } else {
      const pct = ALL_ITEMS.length > 0
        ? Math.round((allFluent / ALL_ITEMS.length) * 100)
        : 0;
      let label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail!.textContent = allFluent + ' of ' + ALL_ITEMS.length +
        ' items fluent';
    }

    const result = getRecommendationResult();
    if (result.recommended.size > 0) {
      const parts: string[] = [];
      if (result.consolidateIndices.length > 0) {
        const cNames = result.consolidateIndices.sort(function (a, b) {
          return a - b;
        })
          .map(function (g) {
            return DISTANCE_GROUPS[g].label;
          });
        parts.push(
          'solidify ' + cNames.join(', ') +
            ' \u2014 ' + result.consolidateDueCount + ' slow item' +
            (result.consolidateDueCount !== 1 ? 's' : ''),
        );
      }
      if (result.expandIndex !== null) {
        parts.push(
          'start ' + DISTANCE_GROUPS[result.expandIndex].label +
            ' \u2014 ' + result.expandNewCount + ' new item' +
            (result.expandNewCount !== 1 ? 's' : ''),
        );
      }
      recText!.textContent = 'Suggestion: ' + parts.join('\n');
      recBtn!.classList.remove('hidden');
    } else {
      recText!.textContent = '';
      recBtn!.classList.add('hidden');
    }
  }

  function renderSessionSummary(): void {
    const el = container.querySelector('.session-summary-text');
    if (!el) return;
    const items = mode.getEnabledItems();
    el.textContent = items.length + ' items \u00B7 60s';
  }

  // --- Stats ---

  let currentItem: {
    note: Note;
    op: string;
    interval: Interval;
    answer: Note;
    useFlats?: boolean;
  } | null = null;

  const statsControls = createStatsControls(container, (mode, el) => {
    const colLabels = MATH_INTERVALS.map((i) => i.abbrev);
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    el.appendChild(gridDiv);
    renderStatsGrid(
      engine.selector,
      colLabels,
      (noteName, colIdx) => {
        const abbrev = MATH_INTERVALS[colIdx].abbrev;
        return [noteName + '+' + abbrev, noteName + '-' + abbrev];
      },
      mode,
      gridDiv,
      undefined,
      engine.baseline ?? undefined,
    );
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline ?? undefined);
    el.appendChild(legendDiv);
  });

  // --- Quiz mode interface ---

  const mode = {
    id: 'intervalMath',
    name: 'Interval Math',
    storageNamespace: 'intervalMath',

    getEnabledItems(): string[] {
      const items: string[] = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    getPracticingLabel(): string {
      if (enabledGroups.size === DISTANCE_GROUPS.length) return 'all intervals';
      const labels = [...enabledGroups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' intervals';
    },

    presentQuestion(itemId: string): void {
      currentItem = parseItem(itemId);
      currentItem.useFlats = currentItem.op === '-'; // sharps ascending, flats descending
      const prompt = container.querySelector('.quiz-prompt');
      const noteName = displayNote(
        pickAccidentalName(currentItem.note.displayName, currentItem.useFlats),
      );
      prompt!.textContent = noteName + ' ' + currentItem.op + ' ' +
        currentItem.interval.abbrev;
      container.querySelectorAll<HTMLElement>('.answer-btn-note').forEach(
        (btn) => {
          const note = NOTES.find((n) => n.name === btn.dataset.note!);
          if (note) {
            btn.textContent = displayNote(
              pickAccidentalName(note.displayName, currentItem!.useFlats!),
            );
          }
        },
      );
    },

    checkAnswer(_itemId: string, input: string) {
      const correct = noteMatchesInput(currentItem!.answer, input);
      return {
        correct,
        correctAnswer: displayNote(
          pickAccidentalName(
            currentItem!.answer.displayName,
            currentItem!.useFlats!,
          ),
        ),
      };
    },

    onStart(): void {
      noteKeyHandler.reset();
      if (statsControls.mode) statsControls.hide();
    },

    onStop(): void {
      noteKeyHandler.reset();
      refreshNoteButtonLabels(container);
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(
      e: KeyboardEvent,
      { submitAnswer: _submitAnswer }: {
        submitAnswer: (input: string) => void;
      },
    ): boolean {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons(): HTMLElement[] {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },

    getCalibrationTrialConfig(
      buttons: HTMLElement[],
      prevBtn: HTMLElement | null,
    ) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload?.(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true,
  );

  function init(): void {
    // Tab switching
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
    });

    // Set section heading
    const toggleLabel = container.querySelector('.toggle-group-label');
    if (toggleLabel) toggleLabel.textContent = 'Intervals';

    // Generate distance group toggle buttons
    const togglesDiv = container.querySelector('.distance-toggles')!;
    DISTANCE_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    // Note answer buttons
    container.querySelectorAll<HTMLElement>('.answer-btn-note').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          engine.submitAnswer(btn.dataset.note!);
        });
      },
    );

    container.querySelector('.start-btn')!.addEventListener(
      'click',
      () => engine.start(),
    );

    // Use recommendation button
    const recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', () => {
        applyRecommendations();
        refreshUI();
      });
    }

    updateRecommendations();
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode,
    engine,
    init,
    activate() {
      engine.attach();
      refreshNoteButtonLabels(container);
      refreshUI();
    },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
