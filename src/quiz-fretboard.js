// Fretboard quiz mode: identify the note at a highlighted fretboard position.
// Plugs into the shared quiz engine via the mode interface.
//
// Depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// noteMatchesInput, createQuizEngine, createNoteKeyHandler, DEFAULT_CONFIG,
// getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend,
// computeRecommendations, createFretboardHelpers, toggleFretboardString

function createFretboardMode() {
  const container = document.getElementById('mode-fretboard');
  const STRINGS_KEY = 'fretboard_enabledStrings';
  let enabledStrings = new Set([5]); // Default: low E only
  let naturalsOnly = true;
  let recommendedStrings = new Set();
  let heatmapMode = null;

  // --- Pure helpers (from quiz-fretboard-state.js) ---

  const fb = createFretboardHelpers({
    notes: NOTES,
    naturalNotes: NATURAL_NOTES,
    stringOffsets: STRING_OFFSETS,
    noteMatchesInput,
  });

  // --- SVG helpers ---

  function highlightCircle(string, fret, color) {
    const circle = container.querySelector(
      `circle[data-string="${string}"][data-fret="${fret}"]`
    );
    if (circle) circle.setAttribute('fill', color);
  }

  function showNoteText(string, fret) {
    const text = container.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) text.textContent = fb.getNoteAtPosition(string, fret);
  }

  function clearAll() {
    container.querySelectorAll('.note-circle').forEach(c => c.setAttribute('fill', 'white'));
    container.querySelectorAll('.note-text').forEach(t => t.textContent = '');
  }

  // --- String toggles ---

  function loadEnabledStrings() {
    const saved = localStorage.getItem(STRINGS_KEY);
    if (saved) {
      try { enabledStrings = new Set(JSON.parse(saved)); } catch {}
    }
    updateStringToggles();
  }

  function saveEnabledStrings() {
    localStorage.setItem(STRINGS_KEY, JSON.stringify([...enabledStrings]));
  }

  function updateStringToggles() {
    container.querySelectorAll('.string-toggle').forEach(btn => {
      const s = parseInt(btn.dataset.string);
      btn.classList.toggle('active', enabledStrings.has(s));
      btn.classList.toggle('recommended', recommendedStrings.has(s));
    });
  }

  function toggleString(s) {
    enabledStrings = toggleFretboardString(enabledStrings, s);
    saveEnabledStrings();
    refreshUI();
  }

  // --- Heatmap ---
  // Color functions: getAutomaticityColor, getSpeedHeatmapColor from stats-display.js

  function showHeatmapView(mode, selector) {
    heatmapMode = mode;
    const btn = container.querySelector('.heatmap-btn');
    const statsContainer = container.querySelector('.stats-container');

    // Populate legend via shared helper
    statsContainer.innerHTML = buildStatsLegend(mode, engine.baseline);
    statsContainer.style.display = '';

    if (mode === 'retention') {
      btn.textContent = 'Show Speed';
      for (let s = 0; s <= 5; s++) {
        for (let f = 0; f < 13; f++) {
          const auto = selector.getAutomaticity(`${s}-${f}`);
          highlightCircle(s, f, getAutomaticityColor(auto));
          showNoteText(s, f);
        }
      }
    } else {
      btn.textContent = 'Show Recall';
      for (let s = 0; s <= 5; s++) {
        for (let f = 0; f < 13; f++) {
          const stats = selector.getStats(`${s}-${f}`);
          const ewma = stats ? stats.ewma : null;
          highlightCircle(s, f, getSpeedHeatmapColor(ewma, engine.baseline));
          showNoteText(s, f);
        }
      }
    }
  }

  function hideHeatmap() {
    heatmapMode = null;
    container.querySelector('.heatmap-btn').textContent = 'Show Recall';
    clearAll();
    const statsContainer = container.querySelector('.stats-container');
    statsContainer.style.display = 'none';
    statsContainer.innerHTML = '';
  }

  function toggleHeatmap(selector) {
    if (heatmapMode === 'retention') {
      showHeatmapView('speed', selector);
    } else {
      showHeatmapView('retention', selector);
    }
  }

  // --- Stats ---

  function updateStats(selector) {
    const statsEl = container.querySelector('.stats');
    if (statsEl) statsEl.textContent = '';
  }

  // --- Recommendations ---

  function updateRecommendations(selector) {
    const allStrings = [0, 1, 2, 3, 4, 5];
    const result = computeRecommendations(
      selector, allStrings,
      (s) => fb.getItemIdsForString(s, naturalsOnly),
      DEFAULT_CONFIG, {}
    );
    recommendedStrings = result.recommended;
    updateStringToggles();
  }

  function applyRecommendations(selector) {
    const allStrings = [0, 1, 2, 3, 4, 5];
    const result = computeRecommendations(
      selector, allStrings,
      (s) => fb.getItemIdsForString(s, naturalsOnly),
      DEFAULT_CONFIG, {}
    );
    recommendedStrings = result.recommended;
    if (result.enabled) {
      enabledStrings = result.enabled;
      saveEnabledStrings();
    }
    updateStringToggles();
  }

  function refreshUI() {
    updateRecommendations(engine.selector);
    engine.updateIdleMessage();
  }

  // --- Accidental buttons ---

  function updateAccidentalButtons() {
    container.querySelectorAll('.note-btn.accidental').forEach(btn => {
      btn.classList.toggle('hidden', naturalsOnly);
    });
  }

  // --- Quiz mode interface ---

  // Track current question for answer checking
  let currentString = null;
  let currentFret = null;
  let currentNote = null;

  const mode = {
    id: 'fretboard',
    name: 'Fretboard',
    storageNamespace: 'fretboard',

    getEnabledItems() {
      return fb.getFretboardEnabledItems(enabledStrings, naturalsOnly);
    },

    presentQuestion(itemId) {
      clearAll();
      const q = fb.parseFretboardItem(itemId);
      currentString = q.currentString;
      currentFret = q.currentFret;
      currentNote = q.currentNote;
      highlightCircle(q.currentString, q.currentFret, '#FFD700');
    },

    checkAnswer(itemId, input) {
      return fb.checkFretboardAnswer(currentNote, input);
    },

    onAnswer(itemId, result, responseTime) {
      if (result.correct) {
        highlightCircle(currentString, currentFret, '#4CAF50');
      } else {
        highlightCircle(currentString, currentFret, '#f44336');
      }
      showNoteText(currentString, currentFret);
    },

    onStart() {
      noteKeyHandler.reset();
      if (heatmapMode) hideHeatmap();
      updateStats(engine.selector);
    },

    onStop() {
      noteKeyHandler.reset();
      clearAll();
      updateStats(engine.selector);
      showHeatmapView('retention', engine.selector);
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      // Use only visible note buttons (respects naturals-only setting)
      return Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
    },
  };

  // Create engine
  const engine = createQuizEngine(mode, container);

  // Keyboard handler via shared helper (replaces inline state machine)
  const noteKeyHandler = createNoteKeyHandler(
    (input) => engine.submitAnswer(input),
    () => !naturalsOnly
  );

  // Pre-cache all positions
  const allItemIds = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < 13; f++) {
      allItemIds.push(`${s}-${f}`);
    }
  }
  engine.storage.preload(allItemIds);

  // --- Wire up DOM ---

  function init() {
    loadEnabledStrings();

    // String toggle handlers
    container.querySelectorAll('.string-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleString(parseInt(btn.dataset.string));
      });
    });

    // Note button handlers
    container.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    // Naturals-only toggle
    const naturalsCheckbox = container.querySelector('#naturals-only');
    if (naturalsCheckbox) {
      naturalsCheckbox.addEventListener('change', (e) => {
        naturalsOnly = e.target.checked;
        updateAccidentalButtons();
        refreshUI();
      });
    }

    // Start/stop/heatmap buttons
    const startBtn = container.querySelector('.start-btn');
    const stopBtn = container.querySelector('.stop-btn');
    const heatmapBtn = container.querySelector('.heatmap-btn');

    if (startBtn) startBtn.addEventListener('click', () => engine.start());
    if (stopBtn) stopBtn.addEventListener('click', () => engine.stop());
    if (heatmapBtn) heatmapBtn.addEventListener('click', () => toggleHeatmap(engine.selector));

    applyRecommendations(engine.selector);
    updateAccidentalButtons();
    updateStats(engine.selector);
    showHeatmapView('retention', engine.selector);
  }

  return {
    mode,
    engine,
    init,
    activate() {
      engine.attach();
      refreshUI();
      engine.showCalibrationIfNeeded();
    },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
