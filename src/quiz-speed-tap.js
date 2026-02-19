// Speed Tap quiz mode: tap all positions of a given note as fast as possible.
// Uses createQuizEngine with getExpectedResponseCount for multi-tap scaling.

import { NOTES, NATURAL_NOTES, STRING_OFFSETS, displayNote, pickRandomAccidental } from './music-data.js';
import { createQuizEngine } from './quiz-engine.js';
import { getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend, createStatsControls } from './stats-display.js';

export function createSpeedTapMode() {
  var container = document.getElementById('mode-speedTap');

  var NOTE_FILTER_KEY = 'speedTap_noteFilter';
  var noteFilter = 'natural'; // 'natural', 'sharps-flats', or 'all'
  var currentNote = null;
  var targetPositions = [];
  var foundPositions = new Set();
  var roundActive = false;
  var wrongFlashTimeouts = new Set();
  var noteNames = NOTES.map(function(n) { return n.name; });

  // --- Fretboard fill colors ---
  var FB_TAP_NEUTRAL = 'hsl(30, 4%, 90%)';
  var FB_TAP_CORRECT = 'hsl(90, 45%, 35%)';

  // --- Colors (from CSS custom properties, cached once) ---
  var _cs = getComputedStyle(document.documentElement);
  var COLOR_ERROR = _cs.getPropertyValue('--color-error').trim();

  // --- Note/position helpers ---

  function getNoteAtPosition(string, fret) {
    var offset = STRING_OFFSETS[string];
    return noteNames[(offset + fret) % 12];
  }

  function getPositionsForNote(noteName) {
    var positions = [];
    for (var s = 0; s < 6; s++) {
      for (var f = 0; f <= 12; f++) {
        if (getNoteAtPosition(s, f) === noteName) {
          positions.push({ string: s, fret: f });
        }
      }
    }
    return positions;
  }

  // --- SVG helpers ---

  function setCircleFill(string, fret, color) {
    var circle = container.querySelector(
      'circle.fb-pos[data-string="' + string + '"][data-fret="' + fret + '"]'
    );
    if (circle) circle.style.fill = color;
  }

  function clearAll() {
    container.querySelectorAll('.fb-pos').forEach(function(c) { c.style.fill = ''; });
  }

  // --- Tab state ---
  var activeTab = 'practice';

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach(function(el) {
      el.classList.toggle('active',
        tabName === 'practice' ? el.classList.contains('tab-practice')
                               : el.classList.contains('tab-progress'));
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      renderPracticeSummary();
    }
  }

  // --- Practice summary ---

  function renderPracticeSummary() {
    var statusLabel = container.querySelector('.practice-status-label');
    var statusDetail = container.querySelector('.practice-status-detail');
    var recText = container.querySelector('.practice-rec-text');
    var recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    var items = mode.getEnabledItems();
    var threshold = engine.selector.getConfig().automaticityThreshold;
    var fluent = 0, seen = 0;
    for (var i = 0; i < items.length; i++) {
      var auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) { seen++; if (auto > threshold) fluent++; }
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail.textContent = items.length + ' notes to learn';
    } else {
      var pct = items.length > 0 ? Math.round((fluent / items.length) * 100) : 0;
      var label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail.textContent = fluent + ' of ' + items.length + ' notes fluent';
    }

    // No groups, so no recommendation
    recText.textContent = '';
    recBtn.classList.add('hidden');
  }

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    var items = mode.getEnabledItems();
    el.textContent = items.length + ' notes \u00B7 60s';
  }

  // --- Note stats view ---

  var statsControls = createStatsControls(container, function(mode, el) {
    var html = '<table class="stats-table speed-tap-stats"><thead><tr>';
    for (var i = 0; i < NOTES.length; i++) {
      html += '<th>' + displayNote(NOTES[i].name) + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (var j = 0; j < NOTES.length; j++) {
      if (mode === 'retention') {
        var auto = engine.selector.getAutomaticity(NOTES[j].name);
        html += '<td class="stats-cell" style="background:' + getAutomaticityColor(auto) + '"></td>';
      } else {
        var stats = engine.selector.getStats(NOTES[j].name);
        var posCount = getPositionsForNote(NOTES[j].name).length;
        var perPosMs = stats ? stats.ewma / posCount : null;
        html += '<td class="stats-cell" style="background:' + getSpeedHeatmapColor(perPosMs) + '"></td>';
      }
    }
    html += '</tr></tbody></table>';
    html += buildStatsLegend(mode, engine.baseline);
    el.innerHTML = html;
  });

  // --- DOM ---

  var progressEl = container.querySelector('.speed-tap-progress');
  var fretboardWrapper = container.querySelector('.fretboard-wrapper');

  // --- Round progress display ---

  function updateRoundProgress() {
    if (progressEl) {
      progressEl.textContent = foundPositions.size + ' / ' + targetPositions.length;
    }
  }

  // --- Circle tap handling ---

  function handleCircleTap(string, fret) {
    if (!engine.isActive || engine.isAnswered || !roundActive) return;

    var key = string + '-' + fret;
    if (foundPositions.has(key)) return;

    var tappedNote = getNoteAtPosition(string, fret);

    if (tappedNote === currentNote) {
      foundPositions.add(key);
      setCircleFill(string, fret, FB_TAP_CORRECT);
      updateRoundProgress();

      if (foundPositions.size === targetPositions.length) {
        roundActive = false;
        engine.submitAnswer('complete');
      }
    } else {
      // Wrong tap — flash red, then reset
      setCircleFill(string, fret, COLOR_ERROR);

      var timeout = setTimeout(function() {
        wrongFlashTimeouts.delete(timeout);
        if (!foundPositions.has(key)) {
          setCircleFill(string, fret, FB_TAP_NEUTRAL);
        }
      }, 800);
      wrongFlashTimeouts.add(timeout);
    }
  }

  function handleFretboardClick(e) {
    if (e.target.closest('.setting-group')) return;

    if (engine.isActive && !engine.isAnswered && roundActive) {
      var target = e.target.closest('circle.fb-pos[data-string][data-fret]');
      if (target) {
        handleCircleTap(parseInt(target.dataset.string), parseInt(target.dataset.fret));
      }
    }
  }

  // --- Mode interface ---

  var mode = {
    id: 'speedTap',
    name: 'Speed Tap',
    storageNamespace: 'speedTap',

    getEnabledItems: function() {
      if (noteFilter === 'natural') return NATURAL_NOTES.slice();
      if (noteFilter === 'sharps-flats') return NOTES.filter(function(n) { return !NATURAL_NOTES.includes(n.name); }).map(function(n) { return n.name; });
      return NOTES.map(function(n) { return n.name; });
    },

    getExpectedResponseCount: function(itemId) {
      return getPositionsForNote(itemId).length;
    },

    presentQuestion: function(itemId) {
      wrongFlashTimeouts.forEach(function(t) { clearTimeout(t); });
      wrongFlashTimeouts.clear();
      clearAll();

      currentNote = itemId;
      targetPositions = getPositionsForNote(currentNote);
      foundPositions = new Set();
      roundActive = true;

      // Set all circles to tap-neutral
      container.querySelectorAll('.fb-pos').forEach(function(c) {
        c.style.fill = FB_TAP_NEUTRAL;
      });

      var prompt = container.querySelector('.quiz-prompt');
      if (prompt) {
        var note = NOTES.find(function(n) { return n.name === currentNote; });
        prompt.textContent = 'Tap all ' + (note ? displayNote(pickRandomAccidental(note.displayName)) : displayNote(currentNote));
      }
      updateRoundProgress();
    },

    checkAnswer: function(itemId, input) {
      var allFound = input === 'complete';
      return { correct: allFound, correctAnswer: displayNote(currentNote) };
    },

    onStart: function() {
      if (statsControls.mode) statsControls.hide();
      if (fretboardWrapper) fretboardWrapper.classList.remove('fretboard-hidden');
    },

    onStop: function() {
      roundActive = false;
      wrongFlashTimeouts.forEach(function(t) { clearTimeout(t); });
      wrongFlashTimeouts.clear();
      clearAll();
      currentNote = null;
      if (progressEl) progressEl.textContent = '';
      if (fretboardWrapper) fretboardWrapper.classList.add('fretboard-hidden');
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      renderPracticeSummary();
      renderSessionSummary();
    },

    onAnswer: function(itemId, result, responseTime) {
      roundActive = false;
      if (!result.correct) {
        // On timeout: reveal remaining target positions
        for (var i = 0; i < targetPositions.length; i++) {
          var pos = targetPositions[i];
          var key = pos.string + '-' + pos.fret;
          if (!foundPositions.has(key)) {
            setCircleFill(pos.string, pos.fret, COLOR_ERROR);
          }
        }
      }
    },

    handleKey: function(e, ctx) {
      // Speed Tap doesn't use keyboard for answers
      return false;
    },

    getCalibrationButtons: function() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },
  };

  var engine = createQuizEngine(mode, container);

  // Pre-cache stats for all notes
  for (var i = 0; i < NOTES.length; i++) {
    engine.storage.getStats(NOTES[i].name);
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

  function init() {
    loadNoteFilter();

    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });

    // Notes toggles (natural / sharps & flats)
    container.querySelectorAll('.notes-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('active');
        var anyActive = container.querySelector('.notes-toggle.active');
        if (!anyActive) btn.classList.add('active');
        var naturalActive = container.querySelector('.notes-toggle[data-notes="natural"].active');
        var accActive = container.querySelector('.notes-toggle[data-notes="sharps-flats"].active');
        if (naturalActive && accActive) noteFilter = 'all';
        else if (accActive) noteFilter = 'sharps-flats';
        else noteFilter = 'natural';
        saveNoteFilter();
        engine.updateIdleMessage();
        renderPracticeSummary();
        renderSessionSummary();
      });
    });

    container.querySelector('.start-btn').addEventListener('click', function() { engine.start(); });

    if (fretboardWrapper) fretboardWrapper.classList.add('fretboard-hidden');
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode: mode,
    engine: engine,
    init: init,
    activate: function() {
      engine.attach();
      container.addEventListener('click', handleFretboardClick);
      engine.updateIdleMessage();
      renderPracticeSummary();
    },
    deactivate: function() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      container.removeEventListener('click', handleFretboardClick);
    },
  };
}
