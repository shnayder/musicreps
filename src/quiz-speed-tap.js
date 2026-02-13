// Speed Tap quiz mode: tap all positions of a given note as fast as possible.
// Uses its own quiz loop (not createQuizEngine) since rounds need multi-tap input.
//
// Depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// createAdaptiveSelector, createLocalStorageAdapter, updateModeStats,
// getAutomaticityColor, getSpeedHeatmapColor, buildStatsLegend,
// runCalibration, getCalibrationThresholds, deriveScaledConfig,
// computeMedian, DEFAULT_CONFIG

function createSpeedTapMode() {
  const container = document.getElementById('mode-speedTap');
  const NAMESPACE = 'speedTap';
  const BASELINE_KEY = 'motorBaseline_button';

  let naturalsOnly = true;
  let active = false;
  let roundActive = false;
  let currentNote = null;
  let targetPositions = []; // [{string, fret}]
  let foundPositions = new Set(); // "s-f" strings
  let roundStartTime = null;
  let timerInterval = null;
  let wrongFlashTimeouts = new Set();
  const noteNames = NOTES.map(n => n.name);

  // --- Adaptive system ---
  // Speed tap rounds involve finding 6-8 positions, so response times are
  // much higher than single-tap modes. Adjust config accordingly.
  const SPEED_TAP_BASE_CONFIG = Object.assign({}, DEFAULT_CONFIG, {
    minTime: 4000,             // can't tap 6-8 positions in < 4s
    automaticityTarget: 12000, // 12s → speedScore 0.5 (decent pace)
    maxResponseTime: 30000,    // allow tracking up to 30s rounds
  });

  const storage = createLocalStorageAdapter(NAMESPACE);
  const selector = createAdaptiveSelector(storage, SPEED_TAP_BASE_CONFIG);

  // --- Motor baseline ---

  let motorBaseline = null;
  let calibrationCleanup = null;
  let calibrationContentEl = null;
  let calibPhase = 'none'; // 'none' | 'intro' | 'calibrating' | 'results'

  // Load stored baseline at init
  const storedBaseline = localStorage.getItem(BASELINE_KEY);
  if (storedBaseline) {
    const parsed = parseInt(storedBaseline, 10);
    if (parsed > 0) {
      motorBaseline = parsed;
      selector.updateConfig(deriveScaledConfig(motorBaseline, SPEED_TAP_BASE_CONFIG));
    }
  }

  function applyBaseline(baseline) {
    motorBaseline = baseline;
    localStorage.setItem(BASELINE_KEY, String(baseline));
    selector.updateConfig(deriveScaledConfig(baseline, SPEED_TAP_BASE_CONFIG));
  }

  function preloadStats() {
    for (const note of NOTES) {
      storage.getStats(note.name);
    }
  }

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

  function getEnabledItems() {
    return naturalsOnly ? NATURAL_NOTES.slice() : NOTES.map(n => n.name);
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

  function clearNoteText(string, fret) {
    const text = container.querySelector(
      `text[data-string="${string}"][data-fret="${fret}"]`
    );
    if (text) text.textContent = '';
  }

  function clearAll() {
    container.querySelectorAll('.note-circle').forEach(c => c.setAttribute('fill', 'white'));
    container.querySelectorAll('.note-text').forEach(t => t.textContent = '');
  }

  // --- Note stats view ---

  const statsControls = createStatsControls(container, (mode, el) => {
    // Always show all 12 notes regardless of naturalsOnly setting
    let html = '<table class="stats-table speed-tap-stats"><thead><tr>';
    for (const note of NOTES) {
      html += '<th>' + note.displayName + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (const note of NOTES) {
      if (mode === 'retention') {
        const auto = selector.getAutomaticity(note.name);
        html += '<td class="stats-cell" style="background:' + getAutomaticityColor(auto) + '"></td>';
      } else {
        // Normalize to per-position time so the color scale makes sense
        // for multi-tap rounds (6-8 positions per note).
        const stats = selector.getStats(note.name);
        const posCount = getPositionsForNote(note.name).length;
        const perPosMs = stats ? stats.ewma / posCount : null;
        html += '<td class="stats-cell" style="background:' + getSpeedHeatmapColor(perPosMs) + '"></td>';
      }
    }
    html += '</tr></tbody></table>';

    if (mode === 'speed') {
      html += '<div class="heatmap-legend active">'
        + '<div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>'
        + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>&lt; 1.5s/pos</div>'
        + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>1.5\u20133s/pos</div>'
        + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>3\u20134.5s/pos</div>'
        + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>4.5\u20136s/pos</div>'
        + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>&gt; 6s/pos</div>'
        + '</div>';
    } else {
      html += buildStatsLegend(mode);
    }

    el.innerHTML = html;
  });


  // --- DOM references ---

  const els = {
    prompt: container.querySelector('.speed-tap-prompt'),
    progress: container.querySelector('.speed-tap-progress'),
    timer: container.querySelector('.speed-tap-timer'),
    feedback: container.querySelector('.feedback'),
    hint: container.querySelector('.hint'),
    timeDisplay: container.querySelector('.time-display'),
    startBtn: container.querySelector('.start-btn'),
    stopBtn: container.querySelector('.stop-btn'),
    recalibrateBtn: container.querySelector('.recalibrate-btn'),
    statsToggle: container.querySelector('.stats-toggle'),
    stats: container.querySelector('.stats'),
    quizArea: container.querySelector('.quiz-area'),
    fretboardWrapper: container.querySelector('.fretboard-wrapper'),
    statsControls: container.querySelector('.stats-controls'),
    quizHeader: container.querySelector('.quiz-header'),
    quizHeaderClose: container.querySelector('.quiz-header-close'),
    sessionStats: container.querySelector('.session-stats'),
    questionCountEl: container.querySelector('.question-count'),
    elapsedTimeEl: container.querySelector('.elapsed-time'),
    progressBar: container.querySelector('.progress-bar'),
    progressFill: container.querySelector('.progress-fill'),
    progressText: container.querySelector('.progress-text'),
  };

  // --- Session tracking ---

  let sessionStartTime = null;
  let roundCount = 0;
  let sessionElapsedInterval = null;

  function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return seconds + 's';
    return minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
  }

  function updateSessionElapsed() {
    if (!sessionStartTime || !els.elapsedTimeEl) return;
    els.elapsedTimeEl.textContent = formatElapsedTime(Date.now() - sessionStartTime);
  }

  function startSessionTimer() {
    if (sessionElapsedInterval) {
      clearInterval(sessionElapsedInterval);
    }
    sessionStartTime = Date.now();
    roundCount = 0;
    updateRoundCount();
    updateSessionElapsed();
    sessionElapsedInterval = setInterval(updateSessionElapsed, 1000);
  }

  function stopSessionTimer() {
    if (sessionElapsedInterval) {
      clearInterval(sessionElapsedInterval);
      sessionElapsedInterval = null;
    }
    sessionStartTime = null;
  }

  function updateRoundCount() {
    if (els.questionCountEl) {
      els.questionCountEl.textContent = roundCount;
    }
  }

  function computeProgress() {
    const items = getEnabledItems();
    let mastered = 0;
    const cfg = selector.getConfig();
    for (const id of items) {
      const recall = selector.getRecall(id);
      if (recall !== null && recall >= cfg.recallThreshold) {
        mastered++;
      }
    }
    return { masteredCount: mastered, totalEnabledCount: items.length };
  }

  function renderProgress() {
    const progress = computeProgress();
    if (els.progressFill) {
      const pct = progress.totalEnabledCount > 0
        ? Math.round((progress.masteredCount / progress.totalEnabledCount) * 100)
        : 0;
      els.progressFill.style.width = pct + '%';
    }
    if (els.progressText) {
      els.progressText.textContent = progress.masteredCount + ' / ' + progress.totalEnabledCount;
    }
  }

  // --- Timer ---

  function startTimer() {
    roundStartTime = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (!roundStartTime || !els.timer) return;
    const elapsed = Date.now() - roundStartTime;
    els.timer.textContent = (elapsed / 1000).toFixed(1) + 's';
  }

  // --- Display updates ---

  function updateProgress() {
    if (els.progress) {
      els.progress.textContent = foundPositions.size + ' / ' + targetPositions.length;
    }
  }

  function updateStats() {
    updateModeStats(selector, getEnabledItems(), els.stats);
  }

  // --- Calibration ---

  function formatMs(ms) {
    return (ms / 1000).toFixed(1) + 's';
  }

  function clearCalibrationContent() {
    if (calibrationContentEl) {
      calibrationContentEl.remove();
      calibrationContentEl = null;
    }
    // Remove close button
    const closeBtn = container.querySelector('.calibration-close-btn');
    if (closeBtn) closeBtn.remove();
  }

  function renderCalibrationClose() {
    if (!container.querySelector('.calibration-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'calibration-close-btn';
      closeBtn.textContent = '\u00D7';
      closeBtn.setAttribute('aria-label', 'Close speed check');
      closeBtn.addEventListener('click', stopCalibration);
      if (els.quizArea) {
        els.quizArea.style.position = 'relative';
        els.quizArea.appendChild(closeBtn);
      }
    }
  }

  function getCalibrationButtons() {
    return Array.from(container.querySelectorAll('.answer-btn-note'));
  }

  function startCalibration() {
    calibPhase = 'intro';
    container.classList.add('calibrating');

    // Mark calibration button container
    const buttons = getCalibrationButtons();
    if (buttons.length > 0) {
      const parent = buttons[0].closest('.answer-buttons');
      if (parent) parent.classList.add('calibration-active');
    }

    if (els.quizArea) els.quizArea.classList.add('active');
    if (els.startBtn) els.startBtn.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.recalibrateBtn) els.recalibrateBtn.style.display = 'none';
    if (els.feedback) {
      els.feedback.textContent = 'Quick Speed Check';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = "We\u2019ll measure your tap speed to set personalized targets. Tap each highlighted button as fast as you can \u2014 10 taps total.";
    if (els.timeDisplay) els.timeDisplay.textContent = '';

    // Enable calibration buttons
    container.querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.pointerEvents = '';
    });

    clearCalibrationContent();
    const btn = document.createElement('button');
    btn.textContent = 'Start';
    btn.className = 'calibration-action-btn';
    btn.addEventListener('click', beginCalibrationTrials);
    calibrationContentEl = btn;
    if (els.hint && els.hint.parentNode) {
      els.hint.parentNode.insertBefore(btn, els.hint.nextSibling);
    }
    renderCalibrationClose();
  }

  function beginCalibrationTrials() {
    const buttons = getCalibrationButtons();
    if (buttons.length < 2) {
      stopCalibration();
      return;
    }

    calibPhase = 'calibrating';
    if (els.feedback) {
      els.feedback.textContent = 'Speed check!';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = 'Tap the highlighted button as fast as you can';

    clearCalibrationContent();
    renderCalibrationClose();

    calibrationCleanup = runCalibration({
      buttons,
      els: { feedback: els.feedback, hint: els.hint, timeDisplay: els.timeDisplay },
      container,
      onComplete: (median) => {
        calibrationCleanup = null;
        if (!Number.isFinite(median) || median <= 0) {
          stopCalibration();
          return;
        }
        const baseline = Math.round(median);
        applyBaseline(baseline);
        showCalibrationResults(baseline);
      },
    });
  }

  function showCalibrationResults(baseline) {
    calibPhase = 'results';
    if (els.feedback) {
      els.feedback.textContent = 'Speed Check Complete';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = '';
    if (els.timeDisplay) els.timeDisplay.textContent = '';

    // Disable buttons during results
    container.querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
    });

    clearCalibrationContent();

    const div = document.createElement('div');
    div.className = 'calibration-results';

    const baselineP = document.createElement('p');
    baselineP.className = 'calibration-baseline';
    baselineP.textContent = 'Your baseline response time: ' + formatMs(baseline);
    div.appendChild(baselineP);

    const thresholds = getCalibrationThresholds(baseline);
    const table = document.createElement('table');
    table.className = 'calibration-thresholds';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Speed', 'Response time', 'Meaning'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    thresholds.forEach((t) => {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = t.label;
      tr.appendChild(tdLabel);
      const tdTime = document.createElement('td');
      tdTime.textContent = t.maxMs !== null ? '< ' + formatMs(t.maxMs) : '> ' + formatMs(thresholds[thresholds.length - 2].maxMs);
      tr.appendChild(tdTime);
      const tdMeaning = document.createElement('td');
      tdMeaning.textContent = t.meaning;
      tr.appendChild(tdMeaning);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    div.appendChild(table);

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.className = 'calibration-action-btn';
    doneBtn.addEventListener('click', stopCalibration);
    div.appendChild(doneBtn);

    calibrationContentEl = div;
    if (els.hint && els.hint.parentNode) {
      els.hint.parentNode.insertBefore(div, els.hint.nextSibling);
    }
    renderCalibrationClose();
  }

  function stopCalibration() {
    if (calibrationCleanup) {
      calibrationCleanup();
      calibrationCleanup = null;
    }
    calibPhase = 'none';
    clearCalibrationContent();
    container.classList.remove('calibrating');
    const activeEl = container.querySelector('.calibration-active');
    if (activeEl) activeEl.classList.remove('calibration-active');

    // Reset to idle state
    if (els.quizArea) els.quizArea.classList.remove('active');
    if (els.feedback) {
      els.feedback.textContent = '';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = '';
    if (els.timeDisplay) els.timeDisplay.textContent = '';
    if (els.fretboardWrapper) els.fretboardWrapper.style.display = 'none';
    if (els.statsControls) els.statsControls.style.display = '';
    if (els.startBtn) els.startBtn.style.display = 'inline';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.recalibrateBtn) {
      els.recalibrateBtn.style.display = motorBaseline ? 'inline' : 'none';
    }
    if (els.quizHeader) els.quizHeader.style.display = 'none';
    if (els.sessionStats) els.sessionStats.style.display = 'none';
    if (els.progressBar) els.progressBar.style.display = 'none';

    // Disable answer buttons
    container.querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
    });

    updateStats();
    statsControls.show('retention');
  }

  function showCalibrationIfNeeded() {
    if (!motorBaseline && !active && calibPhase === 'none') {
      startCalibration();
    }
  }

  // --- Round logic ---

  function nextRound() {
    wrongFlashTimeouts.forEach(t => clearTimeout(t));
    wrongFlashTimeouts.clear();
    clearAll();

    const items = getEnabledItems();
    if (items.length === 0) return;

    currentNote = selector.selectNext(items);
    targetPositions = getPositionsForNote(currentNote);
    foundPositions = new Set();
    roundActive = true;

    if (els.prompt) {
      const note = NOTES.find(n => n.name === currentNote);
      els.prompt.textContent = 'Tap all ' + (note ? note.displayName : currentNote);
    }
    if (els.feedback) {
      els.feedback.textContent = '';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = '';

    updateProgress();
    startTimer();
  }

  function completeRound() {
    roundActive = false;
    stopTimer();

    const elapsed = Date.now() - roundStartTime;
    selector.recordResponse(currentNote, elapsed, true);

    roundCount++;
    updateRoundCount();
    renderProgress();

    if (els.feedback) {
      els.feedback.textContent = (elapsed / 1000).toFixed(1) + 's';
      els.feedback.className = 'feedback correct';
    }
    if (els.hint) els.hint.textContent = 'Tap anywhere or press Space for next';

    updateStats();
  }

  // --- Circle tap handling ---

  function handleCircleTap(string, fret) {
    if (!active || !roundActive) return;

    const key = string + '-' + fret;
    if (foundPositions.has(key)) return;

    const tappedNote = getNoteAtPosition(string, fret);

    if (tappedNote === currentNote) {
      foundPositions.add(key);
      highlightCircle(string, fret, '#4CAF50');
      showNoteText(string, fret);
      updateProgress();

      if (foundPositions.size === targetPositions.length) {
        completeRound();
      }
    } else {
      // Wrong tap — flash red, show actual note, then reset
      highlightCircle(string, fret, '#f44336');
      showNoteText(string, fret);

      const timeout = setTimeout(() => {
        wrongFlashTimeouts.delete(timeout);
        if (!foundPositions.has(key)) {
          highlightCircle(string, fret, 'white');
          clearNoteText(string, fret);
        }
      }, 800);
      wrongFlashTimeouts.add(timeout);
    }
  }

  // --- Event handlers ---

  function handleFretboardClick(e) {
    if (e.target.closest('.quiz-controls, .setting-group')) return;

    // During calibration, ignore fretboard clicks
    if (calibPhase !== 'none') return;

    if (active && roundActive) {
      const target = e.target.closest('circle[data-string][data-fret]') ||
                     e.target.closest('text[data-string][data-fret]');
      if (target) {
        handleCircleTap(parseInt(target.dataset.string), parseInt(target.dataset.fret));
      }
      return;
    }

    // After round complete, tap anywhere to advance
    if (active && !roundActive && currentNote !== null) {
      nextRound();
    }
  }

  function handleKeydown(e) {
    // Handle Escape during calibration
    if (calibPhase !== 'none') {
      if (e.key === 'Escape') {
        stopCalibration();
      }
      return;
    }

    if (!active) return;

    if (e.key === 'Escape') {
      stop();
      return;
    }

    if ((e.key === ' ' || e.key === 'Enter') && !roundActive && currentNote !== null) {
      e.preventDefault();
      nextRound();
    }
  }

  // --- Start / stop ---

  function start() {
    active = true;
    if (statsControls.mode) statsControls.hide();
    if (els.fretboardWrapper) els.fretboardWrapper.style.display = '';
    if (els.statsControls) els.statsControls.style.display = 'none';
    if (els.startBtn) els.startBtn.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.recalibrateBtn) els.recalibrateBtn.style.display = 'none';
    if (els.quizArea) els.quizArea.classList.add('active');
    if (els.quizHeader) els.quizHeader.style.display = 'flex';
    if (els.sessionStats) els.sessionStats.style.display = 'flex';
    if (els.progressBar) els.progressBar.style.display = '';
    startSessionTimer();
    renderProgress();
    nextRound();
  }

  function stop() {
    active = false;
    roundActive = false;
    stopTimer();
    stopSessionTimer();
    wrongFlashTimeouts.forEach(t => clearTimeout(t));
    wrongFlashTimeouts.clear();
    clearAll();

    currentNote = null;
    roundStartTime = null;

    if (els.prompt) els.prompt.textContent = '';
    if (els.progress) els.progress.textContent = '';
    if (els.timer) els.timer.textContent = '';
    if (els.feedback) {
      els.feedback.textContent = '';
      els.feedback.className = 'feedback';
    }
    if (els.hint) els.hint.textContent = '';

    if (els.fretboardWrapper) els.fretboardWrapper.style.display = 'none';
    if (els.statsControls) els.statsControls.style.display = '';
    if (els.startBtn) els.startBtn.style.display = 'inline';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.recalibrateBtn) {
      els.recalibrateBtn.style.display = motorBaseline ? 'inline' : 'none';
    }
    if (els.quizArea) els.quizArea.classList.remove('active');
    if (els.quizHeader) els.quizHeader.style.display = 'none';
    if (els.sessionStats) els.sessionStats.style.display = 'none';
    if (els.progressBar) els.progressBar.style.display = 'none';

    updateStats();
    statsControls.show('retention');
  }

  // --- Lifecycle ---

  function attach() {
    document.addEventListener('keydown', handleKeydown);
    container.addEventListener('click', handleFretboardClick);
  }

  function detach() {
    document.removeEventListener('keydown', handleKeydown);
    container.removeEventListener('click', handleFretboardClick);
  }

  function init() {
    preloadStats();

    const naturalsCheckbox = container.querySelector('#speed-tap-naturals-only');
    if (naturalsCheckbox) {
      naturalsCheckbox.addEventListener('change', (e) => {
        naturalsOnly = e.target.checked;
      });
    }

    if (els.startBtn) els.startBtn.addEventListener('click', () => start());
    if (els.stopBtn) els.stopBtn.addEventListener('click', () => stop());
    if (els.quizHeaderClose) els.quizHeaderClose.addEventListener('click', () => stop());
    if (els.recalibrateBtn) {
      els.recalibrateBtn.addEventListener('click', () => startCalibration());
    }

    if (els.fretboardWrapper) els.fretboardWrapper.style.display = 'none';
    if (els.recalibrateBtn) {
      els.recalibrateBtn.style.display = motorBaseline ? 'inline' : 'none';
    }
    updateStats();
    statsControls.show('retention');
  }

  return {
    init,
    activate() {
      attach();
      showCalibrationIfNeeded();
    },
    deactivate() {
      if (calibPhase !== 'none') stopCalibration();
      if (active) stop();
      detach();
    },
  };
}
