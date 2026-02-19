// Fretboard quiz mode: identify the note at a highlighted fretboard position.
// Parameterized factory supports any fretted instrument (guitar, ukulele, etc.).
// Plugs into the shared quiz engine via the mode interface.

import { NOTES, NATURAL_NOTES, GUITAR, UKULELE, noteMatchesInput, displayNote } from './music-data.js';
import { DEFAULT_CONFIG } from './adaptive.js';
import { createQuizEngine, createAdaptiveKeyHandler, refreshNoteButtonLabels, pickCalibrationButton } from './quiz-engine.js';
import { getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend, createStatsControls } from './stats-display.js';
import { computeRecommendations } from './recommendations.js';
import { createFretboardHelpers, toggleFretboardString, computeNotePrioritization } from './quiz-fretboard-state.js';

function createFrettedInstrumentMode(instrument) {
  var container = document.getElementById('mode-' + instrument.id);
  var STRINGS_KEY = instrument.storageNamespace + '_enabledStrings';
  var NOTE_FILTER_KEY = instrument.storageNamespace + '_noteFilter';
  var enabledStrings = new Set([instrument.defaultString]);
  var noteFilter = 'natural'; // 'natural', 'sharps-flats', or 'all'
  var recommendedStrings = new Set();
  var lastNotePri = null;
  var allStrings = Array.from({length: instrument.stringCount}, function(_, i) { return i; });

  // --- Pure helpers (from quiz-fretboard-state.js) ---

  var fb = createFretboardHelpers({
    notes: NOTES,
    naturalNotes: NATURAL_NOTES,
    stringOffsets: instrument.stringOffsets,
    fretCount: instrument.fretCount,
    noteMatchesInput: noteMatchesInput,
  });

  // --- Fretboard fill colors ---
  var FB_QUIZ_HL = 'hsl(50, 100%, 50%)';

  // --- Tab state ---
  var activeTab = 'practice';

  // --- Two fretboard instances: progress (heatmap) and quiz (highlighting) ---
  var progressFretboard = container.querySelector('.tab-progress .fretboard-wrapper');
  var quizFretboard = container.querySelector('.quiz-area .fretboard-wrapper');

  // --- SVG helpers (scoped to a specific fretboard instance) ---

  function setCircleFill(root, string, fret, color) {
    var circle = root.querySelector(
      'circle.fb-pos[data-string="' + string + '"][data-fret="' + fret + '"]'
    );
    if (circle) circle.style.fill = color;
  }

  function clearAll(root) {
    root.querySelectorAll('.fb-pos').forEach(function(c) { c.style.fill = ''; });
  }

  // --- Hover card setup ---

  function setupHoverCard(fretboardWrapper) {
    var card = fretboardWrapper.querySelector('.hover-card');
    if (!card) return;

    function showCard(el) {
      var s = parseInt(el.getAttribute('data-string'));
      var f = parseInt(el.getAttribute('data-fret'));
      var note = fb.getNoteAtPosition(s, f);
      var itemId = s + '-' + f;
      var auto = engine.selector.getAutomaticity(itemId);

      card.querySelector('.hc-note').textContent = displayNote(note);
      card.querySelector('.hc-string-fret').textContent =
        displayNote(instrument.stringNames[s]) + ' string, fret ' + f;

      if (auto !== null) {
        var pct = Math.round(auto * 100);
        var label;
        if (auto > 0.8) label = 'Automatic';
        else if (auto > 0.6) label = 'Solid';
        else if (auto > 0.4) label = 'Getting there';
        else if (auto > 0.2) label = 'Fading';
        else label = 'Needs work';
        card.querySelector('.hc-detail').textContent = label + ' \u00B7 ' + pct + '%';
        var barFill = card.querySelector('.hc-bar-fill');
        barFill.style.width = pct + '%';
        barFill.style.background = getAutomaticityColor(auto);
      } else {
        card.querySelector('.hc-detail').textContent = 'Not seen yet';
        var barFill2 = card.querySelector('.hc-bar-fill');
        barFill2.style.width = '0%';
        barFill2.style.background = '';
      }

      // Position card above circle (or below if near top)
      var containerRect = fretboardWrapper.querySelector('.fretboard-container').getBoundingClientRect();
      var elRect = el.getBoundingClientRect();
      var cx = elRect.left + elRect.width / 2 - containerRect.left;
      var cy = elRect.top - containerRect.top;

      // If circle is near top of fretboard, show card below instead
      if (cy < 50) {
        card.style.left = cx + 'px';
        card.style.top = (cy + elRect.height + 6) + 'px';
        card.style.transform = 'translate(-50%, 0)';
      } else {
        card.style.left = cx + 'px';
        card.style.top = (cy - 6) + 'px';
        card.style.transform = 'translate(-50%, -100%)';
      }
      card.classList.add('visible');
    }

    function hideCard() { card.classList.remove('visible'); }

    var svg = fretboardWrapper.querySelector('svg');
    svg.addEventListener('mouseover', function(e) {
      var el = e.target.closest('.fb-pos');
      if (el) showCard(el);
    });
    svg.addEventListener('mouseout', function(e) {
      var el = e.target.closest('.fb-pos');
      if (el) hideCard();
    });
  }

  // --- String toggles ---

  function loadEnabledStrings() {
    var saved = localStorage.getItem(STRINGS_KEY);
    if (saved) {
      try { enabledStrings = new Set(JSON.parse(saved)); } catch(e) {}
    }
    updateStringToggles();
  }

  function saveEnabledStrings() {
    localStorage.setItem(STRINGS_KEY, JSON.stringify([...enabledStrings]));
  }

  function updateStringToggles() {
    container.querySelectorAll('.string-toggle').forEach(function(btn) {
      var s = parseInt(btn.dataset.string);
      btn.classList.toggle('active', enabledStrings.has(s));
      btn.classList.toggle('recommended', recommendedStrings.has(s));
    });
  }

  function toggleString(s) {
    enabledStrings = toggleFretboardString(enabledStrings, s);
    saveEnabledStrings();
    refreshUI();
  }

  // --- Note filter persistence ---

  function loadNoteFilter() {
    var saved = localStorage.getItem(NOTE_FILTER_KEY);
    if (saved && (saved === 'natural' || saved === 'sharps-flats' || saved === 'all')) {
      noteFilter = saved;
    }
    updateNoteToggles();
  }

  function saveNoteFilter() {
    try { localStorage.setItem(NOTE_FILTER_KEY, noteFilter); } catch (_) {}
  }

  function updateNoteToggles() {
    var naturalBtn = container.querySelector('.notes-toggle[data-notes="natural"]');
    var accBtn = container.querySelector('.notes-toggle[data-notes="sharps-flats"]');
    if (naturalBtn) naturalBtn.classList.toggle('active', noteFilter === 'natural' || noteFilter === 'all');
    if (accBtn) accBtn.classList.toggle('active', noteFilter === 'sharps-flats' || noteFilter === 'all');
  }

  // --- Tab switching ---

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach(function(el) {
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

  var statsControls = createStatsControls(container, function(mode, el) {
    el.innerHTML = buildStatsLegend(mode, engine.baseline);
    if (mode === 'retention') {
      for (var si = 0; si < allStrings.length; si++) {
        var s = allStrings[si];
        for (var f = 0; f < instrument.fretCount; f++) {
          var auto = engine.selector.getAutomaticity(s + '-' + f);
          var color = getAutomaticityColor(auto);
          setCircleFill(progressFretboard, s, f, color);
        }
      }
    } else {
      for (var sj = 0; sj < allStrings.length; sj++) {
        var s2 = allStrings[sj];
        for (var f2 = 0; f2 < instrument.fretCount; f2++) {
          var stats = engine.selector.getStats(s2 + '-' + f2);
          var ewma = stats ? stats.ewma : null;
          var color2 = getSpeedHeatmapColor(ewma, engine.baseline);
          setCircleFill(progressFretboard, s2, f2, color2);
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
    var statsEl = container.querySelector('.stats');
    if (statsEl) statsEl.textContent = '';
  }

  // --- Recommendations ---

  // Sort unstarted strings: lowest pitch first (highest string index = lowest pitch)
  var recsOptions = { sortUnstarted: function(a, b) { return b.string - a.string; } };

  function getRecommendationResult() {
    return computeRecommendations(
      engine.selector, allStrings,
      function(s) { return fb.getItemIdsForString(s, 'all'); },
      DEFAULT_CONFIG, recsOptions
    );
  }

  function updateRecommendations(selector) {
    var result = getRecommendationResult();
    recommendedStrings = result.recommended;
    updateStringToggles();
  }

  function applyRecommendations(selector) {
    var result = getRecommendationResult();
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

  function renderPracticeSummary() {
    var statusLabel = container.querySelector('.practice-status-label');
    var statusDetail = container.querySelector('.practice-status-detail');
    var recText = container.querySelector('.practice-rec-text');
    var recBtn = container.querySelector('.practice-rec-btn');
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
    var allItems = fb.getFretboardEnabledItems(new Set(allStrings), noteFilter);
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

    // Note-type prioritization: naturals first, then add accidentals
    var naturalStats = engine.selector.getStringRecommendations(
      [...result.recommended],
      function(s) { return fb.getItemIdsForString(s, 'natural'); }
    );
    lastNotePri = computeNotePrioritization(naturalStats, DEFAULT_CONFIG.expansionThreshold);

    if (result.recommended.size > 0) {
      // Build rationale text
      var parts = [];
      if (result.consolidateIndices.length > 0) {
        var cNames = result.consolidateIndices.sort(function(a, b) { return b - a; })
          .map(function(s) { return displayNote(instrument.stringNames[s]); });
        parts.push('solidify ' + cNames.join(', ') + ' string' + (cNames.length > 1 ? 's' : '')
          + ' \u2014 ' + result.consolidateDueCount + ' slow item' + (result.consolidateDueCount !== 1 ? 's' : ''));
      }
      if (result.expandIndex !== null) {
        parts.push('start ' + displayNote(instrument.stringNames[result.expandIndex]) + ' string'
          + ' \u2014 ' + result.expandNewCount + ' new item' + (result.expandNewCount !== 1 ? 's' : ''));
      }
      // Append note filter suggestion
      if (lastNotePri.suggestedFilter === 'natural') {
        parts.push('naturals first');
      } else {
        parts.push('add sharps & flats');
      }
      recText.textContent = 'Suggestion: ' + parts.join(', ');
      recBtn.classList.remove('hidden');
    } else {
      recText.textContent = '';
      recBtn.classList.add('hidden');
    }

  }

  // --- Session summary ---

  function noteFilterLabel() {
    if (noteFilter === 'natural') return 'natural notes';
    if (noteFilter === 'sharps-flats') return 'sharps and flats';
    return 'all notes';
  }

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    var count = enabledStrings.size;
    el.textContent = count + ' string' + (count !== 1 ? 's' : '') + ' \u00B7 ' + noteFilterLabel() + ' \u00B7 60s';
  }

  // --- Accidental buttons ---

  function updateAccidentalButtons() {
    var hideAcc = noteFilter === 'natural';
    container.querySelectorAll('.note-btn.accidental').forEach(function(btn) {
      btn.classList.toggle('hidden', hideAcc);
    });
    var accRow = container.querySelector('.note-row-accidentals');
    if (accRow) accRow.classList.toggle('hidden', hideAcc);
  }

  // --- Quiz mode interface ---

  var currentString = null;
  var currentFret = null;
  var currentNote = null;

  var mode = {
    id: instrument.id,
    name: instrument.name,
    storageNamespace: instrument.storageNamespace,

    getEnabledItems: function() {
      return fb.getFretboardEnabledItems(enabledStrings, noteFilter);
    },

    getPracticingLabel: function() {
      var parts = [];
      if (enabledStrings.size < instrument.stringCount) {
        var names = Array.from(enabledStrings).sort(function(a, b) { return b - a; })
          .map(function(s) { return displayNote(instrument.stringNames[s]); });
        parts.push(names.join(', ') + ' string' + (names.length === 1 ? '' : 's'));
      } else {
        parts.push('all strings');
      }
      if (noteFilter !== 'all') parts.push(noteFilterLabel());
      return parts.join(', ');
    },

    presentQuestion: function(itemId) {
      clearAll(quizFretboard);
      var q = fb.parseFretboardItem(itemId);
      currentString = q.currentString;
      currentFret = q.currentFret;
      currentNote = q.currentNote;
      // Highlight active position, rest stay at default blank fill
      setCircleFill(quizFretboard, q.currentString, q.currentFret, FB_QUIZ_HL);
      container.querySelector('.quiz-prompt').textContent = 'Name this note.';
    },

    checkAnswer: function(itemId, input) {
      return fb.checkFretboardAnswer(currentNote, input);
    },

    onAnswer: function(itemId, result, responseTime) {
      if (result.correct) {
        setCircleFill(quizFretboard, currentString, currentFret, 'var(--color-success)');
      } else {
        setCircleFill(quizFretboard, currentString, currentFret, 'var(--color-error)');
      }
    },

    onStart: function() {
      noteKeyHandler.reset();
      if (statsControls.mode) hideHeatmap();
      updateStats(engine.selector);
    },

    onStop: function() {
      noteKeyHandler.reset();
      clearAll(quizFretboard);
      updateStats(engine.selector);
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey: function(e, ctx) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons: function() {
      return Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
    },

    getCalibrationTrialConfig: function(buttons, prevBtn) {
      var btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  // Create engine
  var engine = createQuizEngine(mode, container);

  // Keyboard handler
  var noteKeyHandler = createAdaptiveKeyHandler(
    function(input) { engine.submitAnswer(input); },
    function() { return noteFilter !== 'natural'; }
  );

  // Pre-cache all positions
  var allItemIds = [];
  for (var si = 0; si < allStrings.length; si++) {
    for (var fi = 0; fi < instrument.fretCount; fi++) {
      allItemIds.push(allStrings[si] + '-' + fi);
    }
  }
  engine.storage.preload(allItemIds);

  // --- Wire up DOM ---

  function init() {
    loadEnabledStrings();
    loadNoteFilter();

    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchTab(btn.dataset.tab);
      });
    });

    // String toggles
    container.querySelectorAll('.string-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleString(parseInt(btn.dataset.string));
      });
    });

    // Note buttons (for quiz)
    container.querySelectorAll('.note-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    // Notes toggles (natural / sharps & flats)
    container.querySelectorAll('.notes-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('active');
        // Ensure at least one is active
        var anyActive = container.querySelector('.notes-toggle.active');
        if (!anyActive) btn.classList.add('active');
        var naturalActive = container.querySelector('.notes-toggle[data-notes="natural"].active');
        var accActive = container.querySelector('.notes-toggle[data-notes="sharps-flats"].active');
        if (naturalActive && accActive) noteFilter = 'all';
        else if (accActive) noteFilter = 'sharps-flats';
        else noteFilter = 'natural';
        saveNoteFilter();
        updateAccidentalButtons();
        refreshUI();
      });
    });

    // Start button
    container.querySelector('.start-btn').addEventListener('click', function() { engine.start(); });

    // Use recommendation button
    var recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', function() {
        applyRecommendations(engine.selector);
        if (lastNotePri) {
          noteFilter = lastNotePri.suggestedFilter;
          saveNoteFilter();
          updateNoteToggles();
          updateAccidentalButtons();
        }
        refreshUI();
      });
    }

    // Hover card only on progress fretboard (not quiz — would reveal the answer)
    if (progressFretboard) setupHoverCard(progressFretboard);

    updateRecommendations(engine.selector);
    updateAccidentalButtons();
    updateStats(engine.selector);
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode: mode,
    engine: engine,
    init: init,
    activate: function() {
      engine.attach();
      refreshNoteButtonLabels(container);
      refreshUI();
    },
    deactivate: function() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
    onNotationChange: function() {
      if (!container.classList.contains('mode-active')) return;
      renderPracticeSummary();
      if (activeTab === 'progress' && statsControls.mode) {
        statsControls.show(statsControls.mode);
      }
    },
  };
}

export function createGuitarFretboardMode() {
  return createFrettedInstrumentMode(GUITAR);
}

export function createUkuleleFretboardMode() {
  return createFrettedInstrumentMode(UKULELE);
}
