// Interval Math quiz mode: note +/- interval = note.
// "C + m3 = ?" -> D#/Eb,  "G - P4 = ?" -> D
// 264 items: 12 notes x 11 intervals (m2-M7) x 2 directions (+/-).
// Excludes octave/P8 (adding 12 semitones gives same note).
// Grouped by interval pair into 6 distance groups for progressive unlocking.
//
// Depends on globals: NOTES, INTERVALS, noteAdd, noteSub,
// noteMatchesInput, createQuizEngine, createNoteKeyHandler, updateModeStats,
// renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createIntervalMathMode() {
  const container = document.getElementById('mode-intervalMath');
  const GROUPS_KEY = 'intervalMath_enabledGroups';

  // Intervals 1-11 only (no octave)
  const MATH_INTERVALS = INTERVALS.filter(i => i.num >= 1 && i.num <= 11);

  // Distance groups: pairs of intervals by semitone count
  const DISTANCE_GROUPS = [
    { distances: [1, 2],   label: 'm2,M2' },
    { distances: [3, 4],   label: 'm3,M3' },
    { distances: [5, 6],   label: 'P4,TT' },
    { distances: [7, 8],   label: 'P5,m6' },
    { distances: [9, 10],  label: 'M6,m7' },
    { distances: [11],     label: 'M7' },
  ];

  let enabledGroups = new Set([0]); // Default: first group only
  let recommendedGroups = new Set();

  // Build full item list (for preloading & stats display)
  const ALL_ITEMS = [];
  for (const note of NOTES) {
    for (const interval of MATH_INTERVALS) {
      ALL_ITEMS.push(note.name + '+' + interval.abbrev);
      ALL_ITEMS.push(note.name + '-' + interval.abbrev);
    }
  }

  function parseItem(itemId) {
    const match = itemId.match(/^([A-G]#?)([+-])(.+)$/);
    const noteName = match[1];
    const op = match[2];
    const abbrev = match[3];
    const note = NOTES.find(n => n.name === noteName);
    const interval = MATH_INTERVALS.find(i => i.abbrev === abbrev);
    const answer = op === '+' ? noteAdd(note.num, interval.num) : noteSub(note.num, interval.num);
    return { note, op, interval, answer };
  }

  // --- Distance group helpers ---

  function getItemIdsForGroup(groupIndex) {
    const distances = DISTANCE_GROUPS[groupIndex].distances;
    const intervals = MATH_INTERVALS.filter(i => distances.includes(i.num));
    const items = [];
    for (const note of NOTES) {
      for (const interval of intervals) {
        items.push(note.name + '+' + interval.abbrev);
        items.push(note.name + '-' + interval.abbrev);
      }
    }
    return items;
  }

  function loadEnabledGroups() {
    const saved = localStorage.getItem(GROUPS_KEY);
    if (saved) {
      try { enabledGroups = new Set(JSON.parse(saved)); } catch {}
    }
    updateGroupToggles();
  }

  function saveEnabledGroups() {
    localStorage.setItem(GROUPS_KEY, JSON.stringify([...enabledGroups]));
  }

  function updateGroupToggles() {
    container.querySelectorAll('.distance-toggle').forEach(btn => {
      const g = parseInt(btn.dataset.group);
      btn.classList.toggle('active', enabledGroups.has(g));
      btn.classList.toggle('recommended', recommendedGroups.has(g));
    });
  }

  const recsOptions = { sortUnstarted: (a, b) => a.string - b.string };

  function updateRecommendations(selector) {
    const allGroups = DISTANCE_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const allGroups = DISTANCE_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    if (result.enabled) {
      enabledGroups = result.enabled;
      saveEnabledGroups();
    }
    updateGroupToggles();
  }

  function refreshUI() {
    updateRecommendations(engine.selector);
    engine.updateIdleMessage();
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

  // --- Stats ---

  let currentItem = null;
  let statsMode = null; // null | 'retention' | 'speed'

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    const colLabels = MATH_INTERVALS.map(i => i.abbrev);

    statsContainer.innerHTML = '';

    // Grid (merged: averages + and − directions)
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);
    renderStatsGrid(engine.selector, colLabels, function(noteName, colIdx) {
      const abbrev = MATH_INTERVALS[colIdx].abbrev;
      return [noteName + '+' + abbrev, noteName + '-' + abbrev];
    }, mode, gridDiv, undefined, engine.baseline);

    // Legend
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    statsContainer.appendChild(legendDiv);

    statsContainer.style.display = '';
    btn.textContent = mode === 'retention' ? 'Show Speed' : 'Show Recall';
  }

  function hideStats() {
    statsMode = null;
    const statsContainer = container.querySelector('.stats-container');
    statsContainer.style.display = 'none';
    statsContainer.innerHTML = '';
  }

  function toggleStats() {
    if (statsMode === 'retention') showStats('speed');
    else showStats('retention');
  }

  // --- Quiz mode interface ---

  const mode = {
    id: 'intervalMath',
    name: 'Interval Math',
    storageNamespace: 'intervalMath',

    getEnabledItems() {
      const items = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      prompt.textContent = currentItem.note.displayName + ' ' + currentItem.op + ' ' + currentItem.interval.abbrev + ' = ?';
    },

    checkAnswer(itemId, input) {
      const correct = noteMatchesInput(currentItem.answer, input);
      return { correct, correctAnswer: currentItem.answer.displayName };
    },

    onStart() {
      noteKeyHandler.reset();
      hideStats();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      noteKeyHandler.reset();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
      showStats('retention');
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createNoteKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true
  );

  function init() {
    // Generate distance group toggle buttons
    const togglesDiv = container.querySelector('.distance-toggles');
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
    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    // Start/stop/stats
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());
    container.querySelector('.stop-btn').addEventListener('click', () => engine.stop());
    container.querySelector('.heatmap-btn').addEventListener('click', toggleStats);

    applyRecommendations(engine.selector);
    updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    showStats('retention');
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); refreshUI(); },
    deactivate() {
      if (engine.isActive) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
