// Chord Spelling quiz mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.

import type { ChordType, StringRecommendation } from './types.ts';
import {
  CHORD_ROOTS,
  CHORD_TYPES,
  displayNote,
  getChordTones,
  spelledNoteMatchesInput,
  spelledNoteMatchesSemitone,
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

export function createChordSpellingMode() {
  const container = document.getElementById('mode-chordSpelling')!;
  const GROUPS_KEY = 'chordSpelling_enabledGroups';

  // Group chord types by their group index
  const SPELLING_GROUPS: { types: ChordType[]; label: string }[] = [];
  let maxGroup = 0;
  for (const ct of CHORD_TYPES) {
    if (ct.group > maxGroup) maxGroup = ct.group;
  }
  for (let g = 0; g <= maxGroup; g++) {
    const types = CHORD_TYPES.filter((t) => t.group === g);
    const label = types.map((t) => t.symbol || 'maj').join(', ');
    SPELLING_GROUPS.push({ types, label });
  }

  let enabledGroups = new Set<number>([0]);
  let recommendedGroups = new Set<number>();

  // Build full item list
  const ALL_ITEMS: string[] = [];
  for (const root of CHORD_ROOTS) {
    for (const type of CHORD_TYPES) {
      ALL_ITEMS.push(root + ':' + type.name);
    }
  }

  function parseItem(
    itemId: string,
  ): { rootName: string; chordType: ChordType; tones: string[] } {
    const colonIdx = itemId.indexOf(':');
    const rootName = itemId.substring(0, colonIdx);
    const typeName = itemId.substring(colonIdx + 1);
    const chordType = CHORD_TYPES.find((t) => t.name === typeName)!;
    const tones = getChordTones(rootName, chordType);
    return { rootName, chordType, tones };
  }

  function getItemIdsForGroup(groupIndex: number): string[] {
    const types = SPELLING_GROUPS[groupIndex].types;
    const items: string[] = [];
    for (const root of CHORD_ROOTS) {
      for (const type of types) {
        items.push(root + ':' + type.name);
      }
    }
    return items;
  }

  // --- Group management ---

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
    const allGroups = SPELLING_GROUPS.map((_: unknown, i: number) => i);
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
            return SPELLING_GROUPS[g].label;
          });
        parts.push(
          'solidify ' + cNames.join(', ') +
            ' \u2014 ' + result.consolidateDueCount + ' slow item' +
            (result.consolidateDueCount !== 1 ? 's' : ''),
        );
      }
      if (result.expandIndex !== null) {
        parts.push(
          'start ' + SPELLING_GROUPS[result.expandIndex].label +
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

  // --- Multi-note entry state ---

  let currentItem:
    | { rootName: string; chordType: ChordType; tones: string[] }
    | null = null;
  let enteredTones: { input: string; display: string; correct: boolean }[] = [];

  function renderSlots(): void {
    const slotsDiv = container.querySelector('.chord-slots');
    if (!currentItem) {
      slotsDiv!.innerHTML = '';
      return;
    }
    let html = '';
    for (let i = 0; i < currentItem.tones.length; i++) {
      let cls = 'chord-slot';
      let content = '_';
      if (i < enteredTones.length) {
        content = enteredTones[i].display;
        cls += enteredTones[i].correct ? ' correct' : ' wrong';
      } else if (i === enteredTones.length) {
        cls += ' active';
      }
      html += '<span class="' + cls + '">' + content + '</span>';
    }
    slotsDiv!.innerHTML = html;
  }

  function submitTone(input: string): void {
    if (!engine.isActive || engine.isAnswered) return;
    if (!currentItem || enteredTones.length >= currentItem.tones.length) return;

    const idx = enteredTones.length;
    const expected = currentItem.tones[idx];
    const isCorrect = spelledNoteMatchesInput(expected, input);

    enteredTones.push({
      input,
      display: isCorrect ? displayNote(expected) : displayNote(input),
      correct: isCorrect,
    });
    renderSlots();

    if (enteredTones.length === currentItem.tones.length) {
      const allCorrect = enteredTones.every((t) => t.correct);
      engine.submitAnswer(allCorrect ? '__correct__' : '__wrong__');
    }
  }

  // --- Stats ---

  const statsControls = createStatsControls(container, (mode, el) => {
    const colLabels = CHORD_TYPES.map((t) => t.symbol || 'maj');
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    el.appendChild(gridDiv);
    const rootNotes = CHORD_ROOTS.map((r) => ({ name: r, displayName: r }));
    renderStatsGrid(
      engine.selector,
      colLabels,
      (rootName, colIdx) => {
        return rootName + ':' + CHORD_TYPES[colIdx].name;
      },
      mode,
      gridDiv,
      rootNotes,
      engine.baseline ?? undefined,
    );
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline ?? undefined);
    el.appendChild(legendDiv);
  });

  // --- Quiz mode interface ---

  const mode = {
    id: 'chordSpelling',
    name: 'Chord Spelling',
    storageNamespace: 'chordSpelling',

    getEnabledItems(): string[] {
      const items: string[] = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    getPracticingLabel(): string {
      if (enabledGroups.size === SPELLING_GROUPS.length) {
        return 'all chord types';
      }
      const labels = [...enabledGroups].sort((a, b) => a - b)
        .map((g) => SPELLING_GROUPS[g].label);
      return labels.join(', ') + ' chords';
    },

    getExpectedResponseCount(itemId: string): number {
      const parsed = parseItem(itemId);
      return parsed.tones.length;
    },

    presentQuestion(itemId: string): void {
      currentItem = parseItem(itemId);
      enteredTones = [];
      const prompt = container.querySelector('.quiz-prompt');
      prompt!.textContent = displayNote(currentItem.rootName) +
        currentItem.chordType.symbol;
      renderSlots();
    },

    checkAnswer(_itemId: string, input: string) {
      const allCorrect = input === '__correct__';
      const correctAnswer = currentItem!.tones.map(displayNote).join(' ');
      return { correct: allCorrect, correctAnswer };
    },

    onStart(): void {
      noteKeyHandler.reset();
      enteredTones = [];
      if (statsControls.mode) statsControls.hide();
    },

    onStop(): void {
      noteKeyHandler.reset();
      enteredTones = [];
      const slotsDiv = container.querySelector('.chord-slots');
      slotsDiv!.innerHTML = '';
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
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
      // Multi-press: pick 2–4 random note buttons
      const count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
      const targets: HTMLElement[] = [];
      let prev = prevBtn;
      for (let i = 0; i < count; i++) {
        const btn = pickCalibrationButton(buttons, prev);
        targets.push(btn);
        prev = btn;
      }
      const labels = targets.map((b) => b.textContent);
      return { prompt: 'Press ' + labels.join(' '), targetButtons: targets };
    },

    calibrationIntroHint:
      'We\u2019ll measure your response speed to set personalized targets. Press the notes shown in the prompt, in order \u2014 10 rounds total.',
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload?.(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => submitTone(input),
    () => true,
  );

  function init(): void {
    // Tab switching
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
    });

    // Set section heading
    const toggleLabel = container.querySelector('.toggle-group-label');
    if (toggleLabel) toggleLabel.textContent = 'Chord types';

    const togglesDiv = container.querySelector('.distance-toggles')!;
    SPELLING_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    container.querySelectorAll<HTMLElement>('.answer-btn-note').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          let input = btn.dataset.note!;
          // Resolve enharmonic: buttons can't distinguish A#/Bb, so if the
          // button's pitch matches the expected tone, use the expected spelling.
          if (currentItem && enteredTones.length < currentItem.tones.length) {
            const expected = currentItem.tones[enteredTones.length];
            if (spelledNoteMatchesSemitone(expected, input)) {
              input = expected;
            }
          }
          submitTone(input);
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
