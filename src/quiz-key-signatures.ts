// Key Signatures quiz mode: key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb
// 24 items: 12 major keys x 2 directions.
// Grouped by accidental count for progressive unlocking.

import type { MajorKey, StringRecommendation } from './types.ts';
import {
  displayNote,
  keySignatureLabel,
  MAJOR_KEYS,
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
  renderStatsTable,
} from './stats-display.ts';
import { computeRecommendations } from './recommendations.ts';

export function createKeySignaturesMode() {
  const container = document.getElementById('mode-keySignatures')!;
  const GROUPS_KEY = 'keySignatures_enabledGroups';

  // Group definitions: keys grouped by accidental count
  const KEY_GROUPS = [
    { keys: ['C', 'G', 'F'], label: 'C G F' },
    { keys: ['D', 'Bb'], label: 'D B\u266D' },
    { keys: ['A', 'Eb'], label: 'A E\u266D' },
    { keys: ['E', 'Ab'], label: 'E A\u266D' },
    { keys: ['B', 'Db', 'F#'], label: 'B D\u266D F\u266F' },
  ];

  let enabledGroups = new Set<number>([0, 1]); // Default: groups 0+1
  let recommendedGroups = new Set<number>();

  // Build full item list
  const ALL_ITEMS: string[] = [];
  for (const key of MAJOR_KEYS) {
    ALL_ITEMS.push(key.root + ':fwd');
    ALL_ITEMS.push(key.root + ':rev');
  }

  function parseItem(itemId: string): { key: MajorKey; dir: string } {
    const [rootName, dir] = itemId.split(':');
    const key = MAJOR_KEYS.find((k) => k.root === rootName)!;
    return { key, dir };
  }

  function getItemIdsForGroup(groupIndex: number): string[] {
    const roots = KEY_GROUPS[groupIndex].keys;
    const items: string[] = [];
    for (const root of roots) {
      items.push(root + ':fwd');
      items.push(root + ':rev');
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
    const allGroups = KEY_GROUPS.map((_: unknown, i: number) => i);
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
            return KEY_GROUPS[g].label;
          });
        parts.push(
          'solidify ' + cNames.join(', ') +
            ' \u2014 ' + result.consolidateDueCount + ' slow item' +
            (result.consolidateDueCount !== 1 ? 's' : ''),
        );
      }
      if (result.expandIndex !== null) {
        parts.push(
          'start ' + KEY_GROUPS[result.expandIndex].label +
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

  let currentItem: { key: MajorKey; dir: string } | null = null;

  function getTableRows() {
    return MAJOR_KEYS.map((key) => ({
      label: displayNote(key.root) + ' major',
      sublabel: keySignatureLabel(key),
      _colHeader: 'Key',
      fwdItemId: key.root + ':fwd',
      revItemId: key.root + ':rev',
    }));
  }

  const statsControls = createStatsControls(container, (mode, el) => {
    const tableDiv = document.createElement('div');
    el.appendChild(tableDiv);
    renderStatsTable(
      engine.selector,
      getTableRows(),
      'Key\u2192Sig',
      'Sig\u2192Key',
      mode,
      tableDiv,
      engine.baseline ?? undefined,
    );
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline ?? undefined);
    el.appendChild(legendDiv);
  });

  // --- Quiz mode interface ---

  let pendingSigDigit: string | null = null;
  let pendingSigTimeout: ReturnType<typeof setTimeout> | null = null;

  const mode = {
    id: 'keySignatures',
    name: 'Key Signatures',
    storageNamespace: 'keySignatures',

    getEnabledItems(): string[] {
      const items: string[] = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    getPracticingLabel(): string {
      if (enabledGroups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...enabledGroups].sort((a, b) => a - b)
        .flatMap((g) => KEY_GROUPS[g].keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },

    presentQuestion(itemId: string): void {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const sigButtons = container.querySelector('.answer-buttons-keysig');
      const noteButtons = container.querySelector('.answer-buttons-notes');

      if (currentItem.dir === 'fwd') {
        prompt!.textContent = displayNote(currentItem.key.root) + ' major';
        sigButtons!.classList.remove('answer-group-hidden');
        noteButtons!.classList.add('answer-group-hidden');
      } else {
        const label = keySignatureLabel(currentItem.key);
        prompt!.textContent = label + ' major';
        sigButtons!.classList.add('answer-group-hidden');
        noteButtons!.classList.remove('answer-group-hidden');
      }
    },

    checkAnswer(_itemId: string, input: string) {
      if (currentItem!.dir === 'fwd') {
        const expected = keySignatureLabel(currentItem!.key);
        return { correct: input === expected, correctAnswer: expected };
      } else {
        const correct = spelledNoteMatchesSemitone(
          currentItem!.key.root,
          input,
        );
        return { correct, correctAnswer: displayNote(currentItem!.key.root) };
      }
    },

    onStart(): void {
      noteKeyHandler.reset();
      if (statsControls.mode) statsControls.hide();
    },

    onStop(): void {
      noteKeyHandler.reset();
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(
      e: KeyboardEvent,
      { submitAnswer }: { submitAnswer: (input: string) => void },
    ): boolean {
      if (currentItem!.dir === 'rev') {
        return noteKeyHandler.handleKey(e);
      }
      // Forward: number keys for sig selection
      if (e.key >= '0' && e.key <= '7') {
        e.preventDefault();
        if (pendingSigTimeout) clearTimeout(pendingSigTimeout);
        pendingSigDigit = e.key;
        pendingSigTimeout = setTimeout(() => {
          if (pendingSigDigit === '0') {
            submitAnswer('0');
          }
          pendingSigDigit = null;
          pendingSigTimeout = null;
        }, 600);
        return true;
      }
      if (pendingSigDigit !== null && (e.key === '#' || e.key === 'b')) {
        e.preventDefault();
        clearTimeout(pendingSigTimeout!);
        const answer = pendingSigDigit + e.key;
        pendingSigDigit = null;
        pendingSigTimeout = null;
        submitAnswer(answer);
        return true;
      }
      return false;
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
    if (toggleLabel) toggleLabel.textContent = 'Keys';

    const togglesDiv = container.querySelector('.distance-toggles')!;
    KEY_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    container.querySelectorAll<HTMLElement>('.answer-btn-keysig').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          engine.submitAnswer(btn.dataset.sig!);
        });
      },
    );

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
      if (pendingSigTimeout) clearTimeout(pendingSigTimeout);
      pendingSigDigit = null;
    },
  };
}
