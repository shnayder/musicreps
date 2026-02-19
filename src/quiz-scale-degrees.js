// Scale Degrees quiz mode: key + degree <-> note name.
// Forward: "5th of D major?" -> A, Reverse: "In D major, A is the ?" -> 5th
// 168 items: 12 keys x 7 degrees x 2 directions.
// Grouped by degree (not by key) for progressive unlocking.

import {
  displayNote,
  getScaleDegreeNote,
  MAJOR_KEYS,
  spelledNoteMatchesSemitone,
} from './music-data.js';
import { DEFAULT_CONFIG } from './adaptive.js';
import {
  createAdaptiveKeyHandler,
  createQuizEngine,
  pickCalibrationButton,
  refreshNoteButtonLabels,
} from './quiz-engine.js';
import {
  buildStatsLegend,
  createStatsControls,
  renderStatsGrid,
} from './stats-display.js';
import { computeRecommendations } from './recommendations.js';

export function createScaleDegreesMode() {
  const container = document.getElementById('mode-scaleDegrees');
  const GROUPS_KEY = 'scaleDegrees_enabledGroups';

  // Groups by degree
  const DEGREE_GROUPS = [
    { degrees: [1, 5], label: '1st,5th' },
    { degrees: [4], label: '4th' },
    { degrees: [3, 7], label: '3rd,7th' },
    { degrees: [2, 6], label: '2nd,6th' },
  ];

  let enabledGroups = new Set([0]);
  let recommendedGroups = new Set();

  // Build full item list
  const ALL_ITEMS = [];
  for (const key of MAJOR_KEYS) {
    for (let d = 1; d <= 7; d++) {
      ALL_ITEMS.push(key.root + ':' + d + ':fwd');
      ALL_ITEMS.push(key.root + ':' + d + ':rev');
    }
  }

  const DEGREE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

  function parseItem(itemId) {
    const parts = itemId.split(':');
    const keyRoot = parts[0];
    const degree = parseInt(parts[1]);
    const dir = parts[2];
    const key = MAJOR_KEYS.find((k) => k.root === keyRoot);
    const noteName = getScaleDegreeNote(keyRoot, degree);
    return { key, degree, dir, noteName };
  }

  function getItemIdsForGroup(groupIndex) {
    const degrees = DEGREE_GROUPS[groupIndex].degrees;
    const items = [];
    for (const key of MAJOR_KEYS) {
      for (const d of degrees) {
        items.push(key.root + ':' + d + ':fwd');
        items.push(key.root + ':' + d + ':rev');
      }
    }
    return items;
  }

  // --- Group management ---

  function loadEnabledGroups() {
    const saved = localStorage.getItem(GROUPS_KEY);
    if (saved) {
      try {
        enabledGroups = new Set(JSON.parse(saved));
      } catch { /* expected */ }
    }
    updateGroupToggles();
  }

  function saveEnabledGroups() {
    localStorage.setItem(GROUPS_KEY, JSON.stringify([...enabledGroups]));
  }

  function updateGroupToggles() {
    container.querySelectorAll('.distance-toggle').forEach((btn) => {
      const g = parseInt(btn.dataset.group);
      btn.classList.toggle('active', enabledGroups.has(g));
      btn.classList.toggle('recommended', recommendedGroups.has(g));
    });
  }

  const recsOptions = { sortUnstarted: (a, b) => a.string - b.string };

  function getRecommendationResult() {
    const allGroups = DEGREE_GROUPS.map((_, i) => i);
    return computeRecommendations(
      engine.selector,
      allGroups,
      getItemIdsForGroup,
      DEFAULT_CONFIG,
      recsOptions,
    );
  }

  function updateRecommendations(_selector) {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(_selector) {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    if (result.enabled) {
      enabledGroups = result.enabled;
      saveEnabledGroups();
    }
    updateGroupToggles();
  }

  function toggleGroup(g) {
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

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach((btn) => {
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

  function refreshUI() {
    updateRecommendations(engine.selector);
    engine.updateIdleMessage();
    renderPracticeSummary();
    renderSessionSummary();
  }

  // --- Practice summary ---

  function renderPracticeSummary() {
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
      statusDetail.textContent = ALL_ITEMS.length + ' items to learn';
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
      statusDetail.textContent = allFluent + ' of ' + ALL_ITEMS.length +
        ' items fluent';
    }

    const result = getRecommendationResult();
    if (result.recommended.size > 0) {
      const parts = [];
      if (result.consolidateIndices.length > 0) {
        const cNames = result.consolidateIndices.sort(function (a, b) {
          return a - b;
        })
          .map(function (g) {
            return DEGREE_GROUPS[g].label;
          });
        parts.push(
          'solidify ' + cNames.join(', ') +
            ' \u2014 ' + result.consolidateDueCount + ' slow item' +
            (result.consolidateDueCount !== 1 ? 's' : ''),
        );
      }
      if (result.expandIndex !== null) {
        parts.push(
          'start ' + DEGREE_GROUPS[result.expandIndex].label +
            ' \u2014 ' + result.expandNewCount + ' new item' +
            (result.expandNewCount !== 1 ? 's' : ''),
        );
      }
      recText.textContent = 'Suggestion: ' + parts.join('\n');
      recBtn.classList.remove('hidden');
    } else {
      recText.textContent = '';
      recBtn.classList.add('hidden');
    }
  }

  function renderSessionSummary() {
    const el = container.querySelector('.session-summary-text');
    if (!el) return;
    const items = mode.getEnabledItems();
    el.textContent = items.length + ' items \u00B7 60s';
  }

  // --- Stats ---

  let currentItem = null;

  const statsControls = createStatsControls(container, (mode, el) => {
    const colLabels = DEGREE_LABELS;
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    el.appendChild(gridDiv);
    const keyNotes = MAJOR_KEYS.map((k) => ({
      name: k.root,
      displayName: k.root,
    }));
    renderStatsGrid(
      engine.selector,
      colLabels,
      (keyRoot, colIdx) => {
        const d = colIdx + 1;
        return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
      },
      mode,
      gridDiv,
      keyNotes,
      engine.baseline,
    );
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    el.appendChild(legendDiv);
  });

  // --- Quiz mode interface ---

  const mode = {
    id: 'scaleDegrees',
    name: 'Scale Degrees',
    storageNamespace: 'scaleDegrees',

    getEnabledItems() {
      const items = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    getPracticingLabel() {
      if (enabledGroups.size === DEGREE_GROUPS.length) return 'all degrees';
      const degrees = [...enabledGroups].sort((a, b) => a - b)
        .flatMap((g) => DEGREE_GROUPS[g].degrees)
        .sort((a, b) => a - b);
      return degrees.map((d) => DEGREE_LABELS[d - 1]).join(', ') + ' degrees';
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const noteButtons = container.querySelector('.answer-buttons-notes');
      const degreeButtons = container.querySelector('.answer-buttons-degrees');

      if (currentItem.dir === 'fwd') {
        prompt.textContent = DEGREE_LABELS[currentItem.degree - 1] + ' of ' +
          displayNote(currentItem.key.root) + ' major';
        noteButtons.classList.remove('answer-group-hidden');
        degreeButtons.classList.add('answer-group-hidden');
      } else {
        prompt.textContent = displayNote(currentItem.key.root) + ' major: ' +
          displayNote(currentItem.noteName);
        noteButtons.classList.add('answer-group-hidden');
        degreeButtons.classList.remove('answer-group-hidden');
      }
    },

    checkAnswer(_itemId, input) {
      if (currentItem.dir === 'fwd') {
        const correct = spelledNoteMatchesSemitone(currentItem.noteName, input);
        return { correct, correctAnswer: displayNote(currentItem.noteName) };
      } else {
        const expectedDegree = String(currentItem.degree);
        return {
          correct: input === expectedDegree,
          correctAnswer: DEGREE_LABELS[currentItem.degree - 1],
        };
      }
    },

    onStart() {
      noteKeyHandler.reset();
      if (statsControls.mode) statsControls.hide();
    },

    onStop() {
      noteKeyHandler.reset();
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      if (currentItem.dir === 'fwd') {
        return noteKeyHandler.handleKey(e);
      }
      // Reverse: number keys 1-7
      if (e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        submitAnswer(e.key);
        return true;
      }
      return false;
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },

    getCalibrationTrialConfig(buttons, prevBtn) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true,
  );

  function init() {
    // Tab switching
    container.querySelectorAll('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Set section heading
    const toggleLabel = container.querySelector('.toggle-group-label');
    if (toggleLabel) toggleLabel.textContent = 'Degrees';

    const togglesDiv = container.querySelector('.distance-toggles');
    DEGREE_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    container.querySelectorAll('.answer-btn-note').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    container.querySelectorAll('.answer-btn-degree').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.degree);
      });
    });

    container.querySelector('.start-btn').addEventListener(
      'click',
      () => engine.start(),
    );

    // Use recommendation button
    const recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', () => {
        applyRecommendations(engine.selector);
        refreshUI();
      });
    }

    updateRecommendations(engine.selector);
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
