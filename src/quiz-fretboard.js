// Fretboard quiz mode: identify the note at a highlighted fretboard position.
// Parameterized factory supports any fretted instrument (guitar, ukulele, etc.).
// Plugs into the shared quiz engine via the mode interface.
//
// Depends on globals: NOTES, NATURAL_NOTES, GUITAR, UKULELE,
// noteMatchesInput, createQuizEngine, createNoteKeyHandler, DEFAULT_CONFIG,
// getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend,
// computeRecommendations, createFretboardHelpers, toggleFretboardString

function createFrettedInstrumentMode(instrument) {
  const container = document.getElementById('mode-' + instrument.id);
  const STRINGS_KEY = instrument.storageNamespace + '_enabledStrings';
  let enabledStrings = new Set([instrument.defaultString]);
  let naturalsOnly = true;
  let recommendedStrings = new Set();
  const allStrings = Array.from({length: instrument.stringCount}, (_, i) => i);

  // --- Pure helpers (from quiz-fretboard-state.js) ---

  const fb = createFretboardHelpers({
    notes: NOTES,
    naturalNotes: NATURAL_NOTES,
    stringOffsets: instrument.stringOffsets,
    fretCount: instrument.fretCount,
    noteMatchesInput,
  });

  // --- Colors (from CSS custom properties, cached once) ---
  const _cs = getComputedStyle(document.documentElement);
  const COLOR_HIGHLIGHT = _cs.getPropertyValue('--color-highlight').trim();
  const COLOR_SUCCESS = _cs.getPropertyValue('--color-success').trim();
  const COLOR_ERROR = _cs.getPropertyValue('--color-error').trim();

  // --- SVG helpers ---

  function highlightCircle(string, fret, color) {
    const circle = container.querySelector(
      `circle[data-string="${string}"][data-fret="${fret}"]`
    );
    if (circle) circle.style.fill = color;
  }

  function showNoteText(string, fret, bgColor) {
    const text = container.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) {
      text.textContent = displayNote(fb.getNoteAtPosition(string, fret));
      text.style.fill = bgColor && heatmapNeedsLightText(bgColor) ? 'white' : '';
    }
  }

  function clearAll() {
    container.querySelectorAll('.note-circle').forEach(c => c.style.fill = '');
    container.querySelectorAll('.note-text').forEach(t => { t.textContent = ''; t.style.fill = ''; });
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

  const statsControls = createStatsControls(container, (mode, el) => {
    el.innerHTML = buildStatsLegend(mode, engine.baseline);
    if (mode === 'retention') {
      for (const s of allStrings) {
        for (let f = 0; f < instrument.fretCount; f++) {
          const auto = engine.selector.getAutomaticity(`${s}-${f}`);
          const color = getAutomaticityColor(auto);
          highlightCircle(s, f, color);
          showNoteText(s, f, color);
        }
      }
    } else {
      for (const s of allStrings) {
        for (let f = 0; f < instrument.fretCount; f++) {
          const stats = engine.selector.getStats(`${s}-${f}`);
          const ewma = stats ? stats.ewma : null;
          const color = getSpeedHeatmapColor(ewma, engine.baseline);
          highlightCircle(s, f, color);
          showNoteText(s, f, color);
        }
      }
    }
  });

  function hideHeatmap() {
    statsControls.hide();
    clearAll();
  }

  // --- Stats ---

  function updateStats(selector) {
    const statsEl = container.querySelector('.stats');
    if (statsEl) statsEl.textContent = '';
  }

  // --- Recommendations ---

  function updateRecommendations(selector) {
    const result = computeRecommendations(
      selector, allStrings,
      (s) => fb.getItemIdsForString(s, naturalsOnly),
      DEFAULT_CONFIG, {}
    );
    recommendedStrings = result.recommended;
    updateStringToggles();
  }

  function applyRecommendations(selector) {
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
    const accRow = container.querySelector('.note-row-accidentals');
    if (accRow) accRow.classList.toggle('hidden', naturalsOnly);
  }

  // --- Quiz mode interface ---

  let currentString = null;
  let currentFret = null;
  let currentNote = null;

  const mode = {
    id: instrument.id,
    name: instrument.name,
    storageNamespace: instrument.storageNamespace,

    getEnabledItems() {
      return fb.getFretboardEnabledItems(enabledStrings, naturalsOnly);
    },

    getPracticingLabel() {
      if (enabledStrings.size === instrument.stringCount) return 'all strings';
      const names = [...enabledStrings].sort((a, b) => b - a)
        .map(s => displayNote(instrument.stringNames[s]));
      return names.join(', ') + ' string' + (names.length === 1 ? '' : 's');
    },

    presentQuestion(itemId) {
      clearAll();
      const q = fb.parseFretboardItem(itemId);
      currentString = q.currentString;
      currentFret = q.currentFret;
      currentNote = q.currentNote;
      highlightCircle(q.currentString, q.currentFret, COLOR_HIGHLIGHT);
    },

    checkAnswer(itemId, input) {
      return fb.checkFretboardAnswer(currentNote, input);
    },

    onAnswer(itemId, result, responseTime) {
      if (result.correct) {
        highlightCircle(currentString, currentFret, COLOR_SUCCESS);
      } else {
        highlightCircle(currentString, currentFret, COLOR_ERROR);
      }
      showNoteText(currentString, currentFret);
    },

    onStart() {
      noteKeyHandler.reset();
      if (statsControls.mode) hideHeatmap();
      updateStats(engine.selector);
    },

    onStop() {
      noteKeyHandler.reset();
      clearAll();
      updateStats(engine.selector);
      statsControls.show('retention');
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
    },
  };

  // Create engine
  const engine = createQuizEngine(mode, container);

  // Keyboard handler
  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => engine.submitAnswer(input),
    () => !naturalsOnly
  );

  // Pre-cache all positions
  const allItemIds = [];
  for (const s of allStrings) {
    for (let f = 0; f < instrument.fretCount; f++) {
      allItemIds.push(`${s}-${f}`);
    }
  }
  engine.storage.preload(allItemIds);

  // --- Wire up DOM ---

  function init() {
    loadEnabledStrings();

    container.querySelectorAll('.string-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleString(parseInt(btn.dataset.string));
      });
    });

    container.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    const naturalsCheckbox = container.querySelector('#' + instrument.id + '-naturals-only');
    if (naturalsCheckbox) {
      naturalsCheckbox.addEventListener('change', (e) => {
        naturalsOnly = e.target.checked;
        updateAccidentalButtons();
        refreshUI();
      });
    }

    container.querySelector('.start-btn').addEventListener('click', () => engine.start());

    applyRecommendations(engine.selector);
    updateAccidentalButtons();
    updateStats(engine.selector);
    statsControls.show('retention');
  }

  return {
    mode,
    engine,
    init,
    activate() {
      engine.attach();
      refreshNoteButtonLabels(container);
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

function createGuitarFretboardMode() {
  return createFrettedInstrumentMode(GUITAR);
}

function createUkuleleFretboardMode() {
  return createFrettedInstrumentMode(UKULELE);
}
