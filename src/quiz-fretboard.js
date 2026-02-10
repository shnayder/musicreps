// Fretboard quiz mode: identify the note at a highlighted fretboard position.
// Plugs into the shared quiz engine via the mode interface.
//
// Depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// noteMatchesInput, createQuizEngine, DEFAULT_CONFIG

function createFretboardMode() {
  const container = document.getElementById('mode-fretboard');
  const STRINGS_KEY = 'fretboard_enabledStrings';
  let enabledStrings = new Set([5]); // Default: low E only
  let naturalsOnly = true;
  let recommendedStrings = new Set();
  let heatmapMode = null;

  // --- Note helpers (match original app.js behavior) ---

  const noteNames = NOTES.map(n => n.name);

  function getNoteAtPosition(string, fret) {
    const offset = STRING_OFFSETS[string];
    const noteIndex = (offset + fret) % 12;
    return noteNames[noteIndex];
  }

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
    if (text) text.textContent = getNoteAtPosition(string, fret);
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
    if (enabledStrings.has(s)) {
      if (enabledStrings.size > 1) enabledStrings.delete(s);
    } else {
      enabledStrings.add(s);
    }
    saveEnabledStrings();
    updateStringToggles();
  }

  // --- Heatmap ---
  // Color functions: getAutomaticityColor, getSpeedHeatmapColor from stats-display.js

  function showHeatmapView(mode, selector) {
    heatmapMode = mode;
    const btn = container.querySelector('.heatmap-btn');
    const quizArea = container.querySelector('.quiz-area');
    quizArea.classList.add('active');

    // Hide quiz-specific elements
    container.querySelector('.countdown-container').style.display = 'none';
    container.querySelector('.note-buttons').style.display = 'none';
    container.querySelector('.feedback').style.display = 'none';
    container.querySelector('.time-display').style.display = 'none';
    container.querySelector('.hint').style.display = 'none';

    // Show appropriate legend
    container.querySelector('#retention-legend').classList.toggle('active', mode === 'retention');
    container.querySelector('#speed-legend').classList.toggle('active', mode === 'speed');

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
      btn.textContent = 'Hide Heatmap';
      for (let s = 0; s <= 5; s++) {
        for (let f = 0; f < 13; f++) {
          const stats = selector.getStats(`${s}-${f}`);
          const ewma = stats ? stats.ewma : null;
          highlightCircle(s, f, getSpeedHeatmapColor(ewma));
          showNoteText(s, f);
        }
      }
    }
  }

  function hideHeatmap() {
    heatmapMode = null;
    const btn = container.querySelector('.heatmap-btn');
    btn.textContent = 'Show Retention';
    clearAll();
    container.querySelector('.quiz-area').classList.remove('active');
    container.querySelector('#retention-legend').classList.remove('active');
    container.querySelector('#speed-legend').classList.remove('active');
    container.querySelector('.countdown-container').style.display = '';
    container.querySelector('.note-buttons').style.display = '';
    container.querySelector('.feedback').style.display = '';
    container.querySelector('.time-display').style.display = '';
    container.querySelector('.hint').style.display = '';
  }

  function toggleHeatmap(selector) {
    if (heatmapMode === null) {
      showHeatmapView('retention', selector);
    } else if (heatmapMode === 'retention') {
      showHeatmapView('speed', selector);
    } else {
      hideHeatmap();
    }
  }

  // --- Stats ---

  function median(arr) {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  function getTimeColor(ms) {
    if (ms === null) return '';
    if (ms < 3000) return 'hsl(120, 70%, 35%)';
    if (ms < 4000) return 'hsl(80, 70%, 35%)';
    if (ms < 5000) return 'hsl(50, 70%, 40%)';
    if (ms < 6000) return 'hsl(30, 70%, 40%)';
    return 'hsl(0, 70%, 40%)';
  }

  function updateStats(selector) {
    const ewmas = [];
    for (let s = 0; s <= 5; s++) {
      for (let f = 0; f < 13; f++) {
        const stats = selector.getStats(`${s}-${f}`);
        if (stats && stats.ewma) ewmas.push(stats.ewma);
      }
    }
    const med = median(ewmas);
    const statsEl = container.querySelector('.stats');
    if (statsEl) {
      if (med !== null) {
        statsEl.innerHTML = `median: <span style="color:${getTimeColor(Math.round(med))}">${Math.round(med)}ms</span>`;
      } else {
        statsEl.textContent = '';
      }
    }
  }

  // --- Recommendations ---

  function getItemIdsForString(s) {
    const items = [];
    for (let f = 0; f < 13; f++) {
      const note = getNoteAtPosition(s, f);
      if (!naturalsOnly || NATURAL_NOTES.includes(note)) {
        items.push(`${s}-${f}`);
      }
    }
    return items;
  }

  function applyRecommendations(selector) {
    const allStrings = [0, 1, 2, 3, 4, 5];
    const recs = selector.getStringRecommendations(allStrings, getItemIdsForString);

    const started = recs.filter(r => r.unseenCount < r.totalCount);
    const unstarted = recs.filter(r => r.unseenCount === r.totalCount);

    if (started.length === 0) {
      recommendedStrings = new Set();
      updateStringToggles();
      return;
    }

    const totalSeen = started.reduce((sum, r) => sum + (r.masteredCount + r.dueCount), 0);
    const totalMastered = started.reduce((sum, r) => sum + r.masteredCount, 0);
    const consolidatedRatio = totalSeen > 0 ? totalMastered / totalSeen : 0;

    const startedByWork = [...started].sort(
      (a, b) => (b.dueCount + b.unseenCount) - (a.dueCount + a.unseenCount)
    );

    const workCounts = startedByWork.map(r => r.dueCount + r.unseenCount);
    const medianWork = workCounts[Math.floor(workCounts.length / 2)];
    recommendedStrings = new Set();
    const newEnabled = new Set();
    for (const r of startedByWork) {
      if (r.dueCount + r.unseenCount > medianWork) {
        recommendedStrings.add(r.string);
        newEnabled.add(r.string);
      }
    }
    if (newEnabled.size === 0) {
      recommendedStrings.add(startedByWork[0].string);
      newEnabled.add(startedByWork[0].string);
    }

    if (consolidatedRatio >= DEFAULT_CONFIG.expansionThreshold && unstarted.length > 0) {
      recommendedStrings.add(unstarted[0].string);
      newEnabled.add(unstarted[0].string);
    }

    if (newEnabled.size > 0) {
      enabledStrings = newEnabled;
      saveEnabledStrings();
    }
    updateStringToggles();
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
      const items = [];
      for (const s of enabledStrings) {
        for (let f = 0; f < 13; f++) {
          const note = getNoteAtPosition(s, f);
          if (!naturalsOnly || NATURAL_NOTES.includes(note)) {
            items.push(`${s}-${f}`);
          }
        }
      }
      return items;
    },

    presentQuestion(itemId) {
      clearAll();
      const [s, f] = itemId.split('-').map(Number);
      currentString = s;
      currentFret = f;
      currentNote = getNoteAtPosition(s, f);
      highlightCircle(s, f, '#FFD700');
    },

    checkAnswer(itemId, input) {
      const note = NOTES.find(n => n.name === currentNote);
      const correct = note && noteMatchesInput(note, input);
      return { correct, correctAnswer: currentNote };
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
      if (heatmapMode) hideHeatmap();
      updateStats(engine.selector);
    },

    onStop() {
      clearAll();
      updateStats(engine.selector);
      showHeatmapView('retention', engine.selector);
    },

    handleKey(e, { submitAnswer }) {
      const key = e.key.toUpperCase();

      // Handle # for sharps or b for flats
      if (pendingNote && !naturalsOnly) {
        if (e.key === '#' || (e.shiftKey && e.key === '3')) {
          e.preventDefault();
          clearTimeout(pendingTimeout);
          submitAnswer(pendingNote + '#');
          pendingNote = null;
          pendingTimeout = null;
          return true;
        }
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          clearTimeout(pendingTimeout);
          submitAnswer(pendingNote + 'b');
          pendingNote = null;
          pendingTimeout = null;
          return true;
        }
      }

      if ('CDEFGAB'.includes(key)) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);

        if (naturalsOnly) {
          submitAnswer(key);
        } else {
          pendingNote = key;
          pendingTimeout = setTimeout(() => {
            submitAnswer(pendingNote);
            pendingNote = null;
            pendingTimeout = null;
          }, 400);
        }
        return true;
      }

      return false;
    },
  };

  // Keyboard state for accidental handling
  let pendingNote = null;
  let pendingTimeout = null;

  // Create engine
  const engine = createQuizEngine(mode, container);

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
    },
    deactivate() {
      if (engine.isActive) engine.stop();
      engine.detach();
    },
  };
}
