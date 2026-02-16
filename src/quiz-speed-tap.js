// Speed Tap quiz mode: tap all positions of a given note as fast as possible.
// Uses createQuizEngine with getExpectedResponseCount for multi-tap scaling.
//
// Depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// createQuizEngine, createStatsControls,
// getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend,
// DEFAULT_CONFIG

function createSpeedTapMode() {
  const container = document.getElementById('mode-speedTap');

  let naturalsOnly = true;
  let currentNote = null;
  let targetPositions = [];
  let foundPositions = new Set();
  let roundActive = false;
  let wrongFlashTimeouts = new Set();
  const noteNames = NOTES.map(n => n.name);

  // --- Note/position helpers ---

  function getNoteAtPosition(string, fret) {
    const offset = STRING_OFFSETS[string];
    return noteNames[(offset + fret) % 12];
  }

  function getPositionsForNote(noteName) {
    const positions = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= 12; f++) {
        if (getNoteAtPosition(s, f) === noteName) {
          positions.push({ string: s, fret: f });
        }
      }
    }
    return positions;
  }

  // --- Colors (from CSS custom properties, cached once) ---
  const _cs = getComputedStyle(document.documentElement);
  const COLOR_SUCCESS = _cs.getPropertyValue('--color-success').trim();
  const COLOR_ERROR = _cs.getPropertyValue('--color-error').trim();

  // --- SVG helpers ---

  function highlightCircle(string, fret, color) {
    const circle = container.querySelector(
      `circle[data-string="${string}"][data-fret="${fret}"]`
    );
    if (circle) circle.style.fill = color;
  }

  function showNoteText(string, fret) {
    const text = container.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) text.textContent = displayNote(getNoteAtPosition(string, fret));
  }

  function clearNoteText(string, fret) {
    const text = container.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) text.textContent = '';
  }

  function clearAll() {
    container.querySelectorAll('.note-circle').forEach(c => c.style.fill = '');
    container.querySelectorAll('.note-text').forEach(t => t.textContent = '');
  }

  // --- Tab state ---
  let activeTab = 'practice';

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach(el => {
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

  const statsControls = createStatsControls(container, (mode, el) => {
    let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
    for (const note of NOTES) {
      html += '<th>' + displayNote(note.name) + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (const note of NOTES) {
      if (mode === 'retention') {
        const auto = engine.selector.getAutomaticity(note.name);
        html += '<td class="stats-cell" style="background:' + getAutomaticityColor(auto) + '"></td>';
      } else {
        const stats = engine.selector.getStats(note.name);
        const posCount = getPositionsForNote(note.name).length;
        const perPosMs = stats ? stats.ewma / posCount : null;
        html += '<td class="stats-cell" style="background:' + getSpeedHeatmapColor(perPosMs) + '"></td>';
      }
    }
    html += '</tr></tbody></table>';
    html += buildStatsLegend(mode, engine.baseline);
    el.innerHTML = html;
  });

  // --- DOM ---

  const progressEl = container.querySelector('.speed-tap-progress');
  const fretboardWrapper = container.querySelector('.fretboard-wrapper');

  // --- Round progress display ---

  function updateRoundProgress() {
    if (progressEl) {
      progressEl.textContent = foundPositions.size + ' / ' + targetPositions.length;
    }
  }

  // --- Circle tap handling ---

  function handleCircleTap(string, fret) {
    if (!engine.isActive || engine.isAnswered || !roundActive) return;

    const key = string + '-' + fret;
    if (foundPositions.has(key)) return;

    const tappedNote = getNoteAtPosition(string, fret);

    if (tappedNote === currentNote) {
      foundPositions.add(key);
      highlightCircle(string, fret, COLOR_SUCCESS);
      showNoteText(string, fret);
      updateRoundProgress();

      if (foundPositions.size === targetPositions.length) {
        roundActive = false;
        engine.submitAnswer('complete');
      }
    } else {
      // Wrong tap — flash red, show actual note, then reset
      highlightCircle(string, fret, COLOR_ERROR);
      showNoteText(string, fret);

      const timeout = setTimeout(() => {
        wrongFlashTimeouts.delete(timeout);
        if (!foundPositions.has(key)) {
          highlightCircle(string, fret, '');
          clearNoteText(string, fret);
        }
      }, 800);
      wrongFlashTimeouts.add(timeout);
    }
  }

  function handleFretboardClick(e) {
    if (e.target.closest('.setting-group')) return;

    if (engine.isActive && !engine.isAnswered && roundActive) {
      const target = e.target.closest('circle[data-string][data-fret]') ||
                     e.target.closest('text[data-string][data-fret]');
      if (target) {
        handleCircleTap(parseInt(target.dataset.string), parseInt(target.dataset.fret));
      }
    }
  }

  // --- Mode interface ---

  const mode = {
    id: 'speedTap',
    name: 'Speed Tap',
    storageNamespace: 'speedTap',

    getEnabledItems() {
      return naturalsOnly ? NATURAL_NOTES.slice() : NOTES.map(n => n.name);
    },

    getExpectedResponseCount(itemId) {
      return getPositionsForNote(itemId).length;
    },

    presentQuestion(itemId) {
      wrongFlashTimeouts.forEach(t => clearTimeout(t));
      wrongFlashTimeouts.clear();
      clearAll();

      currentNote = itemId;
      targetPositions = getPositionsForNote(currentNote);
      foundPositions = new Set();
      roundActive = true;

      const prompt = container.querySelector('.quiz-prompt');
      if (prompt) {
        const note = NOTES.find(n => n.name === currentNote);
        prompt.textContent = 'Tap all ' + (note ? displayNote(pickRandomAccidental(note.displayName)) : displayNote(currentNote));
      }
      updateRoundProgress();
    },

    checkAnswer(itemId, input) {
      const allFound = input === 'complete';
      return { correct: allFound, correctAnswer: displayNote(currentNote) };
    },

    onStart() {
      if (statsControls.mode) statsControls.hide();
      if (fretboardWrapper) fretboardWrapper.classList.remove('fretboard-hidden');
    },

    onStop() {
      roundActive = false;
      wrongFlashTimeouts.forEach(t => clearTimeout(t));
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

    onAnswer(itemId, result, responseTime) {
      roundActive = false;
      if (!result.correct) {
        // On timeout: reveal remaining target positions
        for (const pos of targetPositions) {
          const key = pos.string + '-' + pos.fret;
          if (!foundPositions.has(key)) {
            highlightCircle(pos.string, pos.fret, COLOR_ERROR);
            showNoteText(pos.string, pos.fret);
          }
        }
      }
    },

    handleKey(e, ctx) {
      // Speed Tap doesn't use keyboard for answers
      return false;
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },
  };

  const engine = createQuizEngine(mode, container);

  // Pre-cache stats for all notes
  for (const note of NOTES) {
    engine.storage.getStats(note.name);
  }

  function init() {
    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const naturalsCheckbox = container.querySelector('#speed-tap-naturals-only');
    if (naturalsCheckbox) {
      naturalsCheckbox.addEventListener('change', (e) => {
        naturalsOnly = e.target.checked;
        engine.updateIdleMessage();
        renderPracticeSummary();
        renderSessionSummary();
      });
    }

    container.querySelector('.start-btn').addEventListener('click', () => engine.start());

    if (fretboardWrapper) fretboardWrapper.classList.add('fretboard-hidden');
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode,
    engine,
    init,
    activate() {
      engine.attach();
      container.addEventListener('click', handleFretboardClick);
      engine.updateIdleMessage();
      renderPracticeSummary();
      engine.showCalibrationIfNeeded();
    },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      container.removeEventListener('click', handleFretboardClick);
    },
  };
}
