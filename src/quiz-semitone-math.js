// Semitone Math quiz mode: note +/- semitone count = note.
// "C + 3 = ?" -> D#/Eb,  "G - 5 = ?" -> D
// 264 items: 12 notes x 11 intervals (1-11) x 2 directions (+/-).
// Grouped by semitone count into 6 distance groups for progressive unlocking.
//
// Depends on globals: NOTES, noteAdd, noteSub, noteMatchesInput,
// createQuizEngine, createNoteKeyHandler, updateModeStats,
// renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createSemitoneMathMode() {
  const container = document.getElementById('mode-semitoneMath');
  const GROUPS_KEY = 'semitoneMath_enabledGroups';

  // Distance groups: pairs of semitone distances
  const DISTANCE_GROUPS = [
    { distances: [1, 2],   label: '1,2' },
    { distances: [3, 4],   label: '3,4' },
    { distances: [5, 6],   label: '5,6' },
    { distances: [7, 8],   label: '7,8' },
    { distances: [9, 10],  label: '9,10' },
    { distances: [11],     label: '11' },
  ];

  let enabledGroups = new Set([0]); // Default: first group only
  let recommendedGroups = new Set();

  // Build full item list (for preloading & stats display)
  const ALL_ITEMS = [];
  for (const note of NOTES) {
    for (let s = 1; s <= 11; s++) {
      ALL_ITEMS.push(note.name + '+' + s);
      ALL_ITEMS.push(note.name + '-' + s);
    }
  }

  function parseItem(itemId) {
    const match = itemId.match(/^([A-G]#?)([+-])(\d+)$/);
    const noteName = match[1];
    const op = match[2];
    const semitones = parseInt(match[3]);
    const note = NOTES.find(n => n.name === noteName);
    const answer = op === '+' ? noteAdd(note.num, semitones) : noteSub(note.num, semitones);
    return { note, op, semitones, answer };
  }

  // --- Distance group helpers ---

  function getItemIdsForGroup(groupIndex) {
    const distances = DISTANCE_GROUPS[groupIndex].distances;
    const items = [];
    for (const note of NOTES) {
      for (const d of distances) {
        items.push(note.name + '+' + d);
        items.push(note.name + '-' + d);
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
  let statsDir = '+';   // '+' | '-'

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    const colLabels = [];
    for (let s = 1; s <= 11; s++) colLabels.push(String(s));

    statsContainer.innerHTML = '';

    // Direction toggle
    const dirToggle = document.createElement('div');
    dirToggle.className = 'stats-dir-toggle';
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.className = 'dir-btn' + (statsDir === '+' ? ' active' : '');
    plusBtn.setAttribute('aria-label', 'Show ascending stats');
    plusBtn.addEventListener('click', () => { statsDir = '+'; showStats(statsMode); });
    const minusBtn = document.createElement('button');
    minusBtn.textContent = '\u2212';
    minusBtn.className = 'dir-btn' + (statsDir === '-' ? ' active' : '');
    minusBtn.setAttribute('aria-label', 'Show descending stats');
    minusBtn.addEventListener('click', () => { statsDir = '-'; showStats(statsMode); });
    dirToggle.appendChild(plusBtn);
    dirToggle.appendChild(minusBtn);
    statsContainer.appendChild(dirToggle);

    // Grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);
    renderStatsGrid(engine.selector, colLabels, function(noteName, colIdx) {
      return noteName + statsDir + (colIdx + 1);
    }, mode, gridDiv);

    // Legend
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode);
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
    id: 'semitoneMath',
    name: 'Semitone Math',
    storageNamespace: 'semitoneMath',

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
      prompt.textContent = currentItem.note.displayName + ' ' + currentItem.op + ' ' + currentItem.semitones + ' = ?';
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
