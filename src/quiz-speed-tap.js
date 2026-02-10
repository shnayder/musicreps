// Speed Tap quiz mode: tap all positions of a given note as fast as possible.
// Uses its own quiz loop (not createQuizEngine) since rounds need multi-tap input.
//
// Depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// createAdaptiveSelector, createLocalStorageAdapter, updateModeStats,
// getAutomaticityColor, buildStatsLegend

function createSpeedTapMode() {
  const container = document.getElementById('mode-speedTap');
  const NAMESPACE = 'speedTap';

  let naturalsOnly = true;
  let active = false;
  let roundActive = false;
  let currentNote = null;
  let targetPositions = []; // [{string, fret}]
  let foundPositions = new Set(); // "s-f" strings
  let roundStartTime = null;
  let timerInterval = null;
  let wrongFlashTimeouts = new Set();
  let statsVisible = false;

  const noteNames = NOTES.map(n => n.name);

  // --- Adaptive system ---

  const storage = createLocalStorageAdapter(NAMESPACE);
  const selector = createAdaptiveSelector(storage);

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

  function showNoteStats() {
    statsVisible = true;
    const statsContainer = container.querySelector('.stats-container');
    const heatmapBtn = container.querySelector('.heatmap-btn');
    if (!statsContainer) return;

    const notes = naturalsOnly
      ? NOTES.filter(n => NATURAL_NOTES.includes(n.name))
      : NOTES;

    let html = buildStatsLegend('retention');
    html += '<table class="stats-table"><thead><tr>';
    for (const note of notes) {
      html += '<th>' + note.displayName + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for (const note of notes) {
      const auto = selector.getAutomaticity(note.name);
      const color = getAutomaticityColor(auto);
      html += '<td class="stats-cell" style="background:' + color + '"></td>';
    }
    html += '</tr></tbody></table>';

    statsContainer.innerHTML = html;
    statsContainer.style.display = '';
    if (heatmapBtn) heatmapBtn.textContent = 'Hide Stats';
  }

  function hideNoteStats() {
    statsVisible = false;
    const statsContainer = container.querySelector('.stats-container');
    const heatmapBtn = container.querySelector('.heatmap-btn');
    if (statsContainer) {
      statsContainer.style.display = 'none';
      statsContainer.innerHTML = '';
    }
    if (heatmapBtn) heatmapBtn.textContent = 'Show Recall';
  }

  function toggleNoteStats() {
    if (statsVisible) {
      hideNoteStats();
    } else {
      showNoteStats();
    }
  }

  // --- DOM references ---

  const els = {
    prompt: container.querySelector('.speed-tap-prompt'),
    progress: container.querySelector('.speed-tap-progress'),
    timer: container.querySelector('.speed-tap-timer'),
    feedback: container.querySelector('.feedback'),
    hint: container.querySelector('.hint'),
    startBtn: container.querySelector('.start-btn'),
    stopBtn: container.querySelector('.stop-btn'),
    heatmapBtn: container.querySelector('.heatmap-btn'),
    stats: container.querySelector('.stats'),
    quizArea: container.querySelector('.quiz-area'),
  };

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
    if (statsVisible) hideNoteStats();
    if (els.startBtn) els.startBtn.style.display = 'none';
    if (els.heatmapBtn) els.heatmapBtn.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.display = 'inline';
    if (els.quizArea) els.quizArea.classList.add('active');
    nextRound();
  }

  function stop() {
    active = false;
    roundActive = false;
    stopTimer();
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

    if (els.startBtn) els.startBtn.style.display = 'inline';
    if (els.heatmapBtn) els.heatmapBtn.style.display = 'inline';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.quizArea) els.quizArea.classList.remove('active');

    updateStats();
    showNoteStats();
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
    if (els.heatmapBtn) els.heatmapBtn.addEventListener('click', () => toggleNoteStats());

    updateStats();
    showNoteStats();
  }

  return {
    init,
    activate() { attach(); },
    deactivate() {
      if (active) stop();
      detach();
    },
  };
}
