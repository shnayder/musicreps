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

  // --- Tab state ---
  let activeTab = 'practice';

  // --- Two fretboard instances: progress (heatmap) and quiz (highlighting) ---
  const progressFretboard = container.querySelector('.tab-progress .fretboard-wrapper');
  const quizFretboard = container.querySelector('.quiz-area .fretboard-wrapper');

  // --- SVG helpers (scoped to a specific fretboard instance) ---

  function highlightCircle(root, string, fret, color) {
    const circle = root.querySelector(
      `circle[data-string="${string}"][data-fret="${fret}"]`
    );
    if (circle) circle.style.fill = color;
  }

  function showNoteText(root, string, fret, bgColor) {
    const text = root.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) {
      text.textContent = displayNote(fb.getNoteAtPosition(string, fret));
      text.style.fill = bgColor && heatmapNeedsLightText(bgColor) ? 'white' : '';
    }
  }

  function clearAll(root) {
    root.querySelectorAll('.note-circle').forEach(c => c.style.fill = '');
    root.querySelectorAll('.note-text').forEach(t => { t.textContent = ''; t.style.fill = ''; });
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

  // --- Tab switching ---

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach(el => {
      var isPractice = el.classList.contains('tab-practice');
      var isProgress = el.classList.contains('tab-progress');
      if (tabName === 'practice') {
        el.classList.toggle('active', isPractice);
      } else {
        el.classList.toggle('active', isProgress);
      }
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      clearAll(progressFretboard);
      renderPracticeSummary();
    }
  }

  // --- Heatmap (renders on the progress fretboard) ---

  const statsControls = createStatsControls(container, (mode, el) => {
    el.innerHTML = buildStatsLegend(mode, engine.baseline);
    if (mode === 'retention') {
      for (const s of allStrings) {
        for (let f = 0; f < instrument.fretCount; f++) {
          const auto = engine.selector.getAutomaticity(`${s}-${f}`);
          const color = getAutomaticityColor(auto);
          highlightCircle(progressFretboard, s, f, color);
          showNoteText(progressFretboard, s, f, color);
        }
      }
    } else {
      for (const s of allStrings) {
        for (let f = 0; f < instrument.fretCount; f++) {
          const stats = engine.selector.getStats(`${s}-${f}`);
          const ewma = stats ? stats.ewma : null;
          const color = getSpeedHeatmapColor(ewma, engine.baseline);
          highlightCircle(progressFretboard, s, f, color);
          showNoteText(progressFretboard, s, f, color);
        }
      }
    }
  });

  function hideHeatmap() {
    statsControls.hide();
    clearAll(progressFretboard);
  }

  // --- Stats ---

  function updateStats(selector) {
    const statsEl = container.querySelector('.stats');
    if (statsEl) statsEl.textContent = '';
  }

  // --- Recommendations ---

  function getRecommendationResult() {
    return computeRecommendations(
      engine.selector, allStrings,
      (s) => fb.getItemIdsForString(s, naturalsOnly),
      DEFAULT_CONFIG, {}
    );
  }

  function updateRecommendations(selector) {
    const result = getRecommendationResult();
    recommendedStrings = result.recommended;
    updateStringToggles();
  }

  function applyRecommendations(selector) {
    const result = getRecommendationResult();
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
    renderPracticeSummary();
    renderSessionSummary();
  }

  // --- Practice summary rendering ---

  function computeStringAvgAutomaticity(stringIndex) {
    const items = fb.getItemIdsForString(stringIndex, naturalsOnly);
    var sum = 0, count = 0;
    for (var i = 0; i < items.length; i++) {
      var auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) { sum += auto; count++; }
    }
    return count > 0 ? sum / count : null;
  }

  function renderPracticeSummary() {
    var statusLabel = container.querySelector('.practice-status-label');
    var statusDetail = container.querySelector('.practice-status-detail');
    var recText = container.querySelector('.practice-rec-text');
    var recBtn = container.querySelector('.practice-rec-btn');
    var chipsEl = container.querySelector('.practice-group-chips');
    if (!statusLabel) return;

    // Overall stats
    var items = mode.getEnabledItems();
    var threshold = engine.selector.getConfig().automaticityThreshold;
    var fluent = 0, seen = 0;
    for (var i = 0; i < items.length; i++) {
      var auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) {
        seen++;
        if (auto > threshold) fluent++;
      }
    }

    // All items (not just enabled)
    var allItems = fb.getFretboardEnabledItems(new Set(allStrings), naturalsOnly);
    var allFluent = 0;
    for (var j = 0; j < allItems.length; j++) {
      var a2 = engine.selector.getAutomaticity(allItems[j]);
      if (a2 !== null && a2 > threshold) allFluent++;
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail.textContent = allItems.length + ' positions to learn';
    } else {
      var pct = allItems.length > 0 ? Math.round((allFluent / allItems.length) * 100) : 0;
      var label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail.textContent = allFluent + ' of ' + allItems.length + ' positions fluent';
    }

    // Recommendation
    var result = getRecommendationResult();
    if (result.recommended.size > 0) {
      var names = [];
      var sorted = Array.from(result.recommended).sort(function(a, b) { return b - a; });
      for (var k = 0; k < sorted.length; k++) {
        names.push(displayNote(instrument.stringNames[sorted[k]]));
      }
      recText.textContent = 'Recommended: ' + names.join(', ') + ' string' + (names.length > 1 ? 's' : '');
      recBtn.classList.remove('hidden');
    } else {
      recText.textContent = '';
      recBtn.classList.add('hidden');
    }

    // String chips
    var chipHTML = '';
    for (var s = 0; s < allStrings.length; s++) {
      var avg = computeStringAvgAutomaticity(s);
      var color = getAutomaticityColor(avg);
      var textColor = heatmapNeedsLightText(color) ? 'white' : '';
      var name = displayNote(instrument.stringNames[s]);
      chipHTML += '<div class="string-chip" style="background:' + color;
      if (textColor) chipHTML += ';color:' + textColor;
      chipHTML += '">' + name + '</div>';
    }
    chipsEl.innerHTML = chipHTML;
  }

  // --- Session summary ---

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    var count = enabledStrings.size;
    var noteType = naturalsOnly ? 'natural notes' : 'all notes';
    el.textContent = count + ' string' + (count !== 1 ? 's' : '') + ' \u00B7 ' + noteType + ' \u00B7 60s';
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
      clearAll(quizFretboard);
      const q = fb.parseFretboardItem(itemId);
      currentString = q.currentString;
      currentFret = q.currentFret;
      currentNote = q.currentNote;
      highlightCircle(quizFretboard, q.currentString, q.currentFret, COLOR_HIGHLIGHT);
    },

    checkAnswer(itemId, input) {
      return fb.checkFretboardAnswer(currentNote, input);
    },

    onAnswer(itemId, result, responseTime) {
      if (result.correct) {
        highlightCircle(quizFretboard, currentString, currentFret, COLOR_SUCCESS);
      } else {
        highlightCircle(quizFretboard, currentString, currentFret, COLOR_ERROR);
      }
      showNoteText(quizFretboard, currentString, currentFret);
    },

    onStart() {
      noteKeyHandler.reset();
      if (statsControls.mode) hideHeatmap();
      updateStats(engine.selector);
    },

    onStop() {
      noteKeyHandler.reset();
      clearAll(quizFretboard);
      updateStats(engine.selector);
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
    },

    getCalibrationTrialConfig(buttons, prevBtn) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
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

    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // String toggles
    container.querySelectorAll('.string-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleString(parseInt(btn.dataset.string));
      });
    });

    // Note buttons (for quiz)
    container.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    // Naturals-only checkbox
    const naturalsCheckbox = container.querySelector('#' + instrument.id + '-naturals-only');
    if (naturalsCheckbox) {
      naturalsCheckbox.addEventListener('change', (e) => {
        naturalsOnly = e.target.checked;
        updateAccidentalButtons();
        refreshUI();
      });
    }

    // Start button
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());

    // Use recommendation button
    var recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', () => {
        applyRecommendations(engine.selector);
        refreshUI();
      });
    }

    applyRecommendations(engine.selector);
    updateAccidentalButtons();
    updateStats(engine.selector);
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
      engine.showCalibrationIfNeeded();
    },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
    onNotationChange() {
      if (!container.classList.contains('mode-active')) return;
      renderPracticeSummary();
      if (activeTab === 'progress' && statsControls.mode) {
        statsControls.show(statsControls.mode);
      }
    },
  };
}

function createGuitarFretboardMode() {
  return createFrettedInstrumentMode(GUITAR);
}

function createUkuleleFretboardMode() {
  return createFrettedInstrumentMode(UKULELE);
}
