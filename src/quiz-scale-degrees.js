// Scale Degrees quiz mode: key + degree <-> note name.
// Forward: "5th of D major?" -> A, Reverse: "In D major, A is the ?" -> 5th
// 168 items: 12 keys x 7 degrees x 2 directions.
// Grouped by degree (not by key) for progressive unlocking.
//
// Depends on globals: MAJOR_KEYS, getScaleDegreeNote, findScaleDegree,
// spelledNoteMatchesSemitone, NOTES, createQuizEngine, createNoteKeyHandler,
// updateModeStats, renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createScaleDegreesMode() {
  const container = document.getElementById('mode-scaleDegrees');
  const GROUPS_KEY = 'scaleDegrees_enabledGroups';

  // Groups by degree
  const DEGREE_GROUPS = [
    { degrees: [1, 5], label: '1st,5th' },
    { degrees: [4],    label: '4th' },
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
    const key = MAJOR_KEYS.find(k => k.root === keyRoot);
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
    const allGroups = DEGREE_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const allGroups = DEGREE_GROUPS.map((_, i) => i);
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
  let statsMode = null;

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    statsContainer.innerHTML = '';

    // Grid (merged: averages fwd and rev directions)
    const colLabels = DEGREE_LABELS;
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);

    const keyNotes = MAJOR_KEYS.map(k => ({ name: k.root, displayName: k.root }));
    renderStatsGrid(engine.selector, colLabels, (keyRoot, colIdx) => {
      const d = colIdx + 1;
      return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
    }, mode, gridDiv, keyNotes, engine.baseline);

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

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const noteButtons = container.querySelector('.answer-buttons-notes');
      const degreeButtons = container.querySelector('.answer-buttons-degrees');

      if (currentItem.dir === 'fwd') {
        prompt.textContent = DEGREE_LABELS[currentItem.degree - 1] + ' of ' + currentItem.key.root + ' major = ?';
        noteButtons.style.display = '';
        degreeButtons.style.display = 'none';
      } else {
        prompt.textContent = currentItem.key.root + ' major: ' + currentItem.noteName + ' = ?';
        noteButtons.style.display = 'none';
        degreeButtons.style.display = '';
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const correct = spelledNoteMatchesSemitone(currentItem.noteName, input);
        return { correct, correctAnswer: currentItem.noteName };
      } else {
        const expectedDegree = String(currentItem.degree);
        return { correct: input === expectedDegree, correctAnswer: DEGREE_LABELS[currentItem.degree - 1] };
      }
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
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createNoteKeyHandler(
    input => engine.submitAnswer(input),
    () => true
  );

  function init() {
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

    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    container.querySelectorAll('.answer-btn-degree').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.degree);
      });
    });

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
    activate() { engine.attach(); refreshUI(); engine.showCalibrationIfNeeded(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
