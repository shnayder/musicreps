// Interval Semitones quiz mode: bidirectional interval <-> semitone number.
// Forward: "minor 3rd = ?" -> 3, Reverse: "7 = ?" -> Perfect 5th
// 24 items total (12 intervals x 2 directions).
//
// Depends on globals: INTERVALS, intervalMatchesInput, createQuizEngine,
// updateModeStats, renderStatsTable, buildStatsLegend

function createIntervalSemitonesMode() {
  const container = document.getElementById('mode-intervalSemitones');

  // Build item list: 12 intervals x 2 directions
  const ALL_ITEMS = [];
  for (const interval of INTERVALS) {
    ALL_ITEMS.push(interval.abbrev + ':fwd'); // interval -> number
    ALL_ITEMS.push(interval.abbrev + ':rev'); // number -> interval
  }

  function parseItem(itemId) {
    const [abbrev, dir] = itemId.split(':');
    const interval = INTERVALS.find(i => i.abbrev === abbrev);
    return { interval, dir };
  }

  let currentItem = null;
  let statsMode = null; // null | 'retention' | 'speed'

  function getTableRows() {
    return INTERVALS.map(interval => ({
      label: interval.abbrev,
      sublabel: String(interval.num),
      _colHeader: 'Interval',
      fwdItemId: interval.abbrev + ':fwd',
      revItemId: interval.abbrev + ':rev',
    }));
  }

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    statsContainer.innerHTML = '';
    const tableDiv = document.createElement('div');
    statsContainer.appendChild(tableDiv);
    renderStatsTable(engine.selector, getTableRows(), 'I\u2192#', '#\u2192I', mode, tableDiv);
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

  const mode = {
    id: 'intervalSemitones',
    name: 'Interval \u2194 Semitones',
    storageNamespace: 'intervalSemitones',

    getEnabledItems() {
      return ALL_ITEMS;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const intervalButtons = container.querySelector('.answer-buttons-intervals');
      const numButtons = container.querySelector('.answer-buttons-numbers');

      if (currentItem.dir === 'fwd') {
        // Show interval name, answer is number 1-12
        prompt.textContent = currentItem.interval.name + ' = ?';
        intervalButtons.style.display = 'none';
        numButtons.style.display = '';
      } else {
        // Show number, answer is interval
        prompt.textContent = currentItem.interval.num + ' = ?';
        intervalButtons.style.display = '';
        numButtons.style.display = 'none';
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const correct = parseInt(input, 10) === currentItem.interval.num;
        return { correct, correctAnswer: String(currentItem.interval.num) };
      } else {
        const correct = intervalMatchesInput(currentItem.interval, input);
        return { correct, correctAnswer: currentItem.interval.abbrev };
      }
    },

    onStart() {
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      hideStats();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
      showStats('retention');
    },

    handleKey(e, { submitAnswer }) {
      // Keyboard: number keys for forward, no keyboard for interval buttons
      if (currentItem.dir === 'fwd') {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          if (pendingDigit !== null) {
            const num = pendingDigit * 10 + parseInt(e.key);
            clearTimeout(pendingDigitTimeout);
            pendingDigit = null;
            pendingDigitTimeout = null;
            if (num >= 1 && num <= 12) {
              submitAnswer(String(num));
            }
            return true;
          }
          const d = parseInt(e.key);
          if (d >= 2 && d <= 9) {
            submitAnswer(String(d));
          } else {
            // 0 or 1 — could be 10, 11, 12
            pendingDigit = d;
            pendingDigitTimeout = setTimeout(() => {
              if (pendingDigit >= 1) submitAnswer(String(pendingDigit));
              pendingDigit = null;
              pendingDigitTimeout = null;
            }, 400);
          }
          return true;
        }
      }
      return false;
    },
  };

  let pendingDigit = null;
  let pendingDigitTimeout = null;

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  function init() {
    // Interval answer buttons
    container.querySelectorAll('.answer-btn-interval').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.interval);
      });
    });

    // Number answer buttons
    container.querySelectorAll('.answer-btn-num').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.num);
      });
    });

    // Start/stop/stats
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());
    container.querySelector('.stop-btn').addEventListener('click', () => engine.stop());
    container.querySelector('.heatmap-btn').addEventListener('click', toggleStats);

    updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    showStats('retention');
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); },
    deactivate() {
      if (engine.isActive) engine.stop();
      engine.detach();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
    },
  };
}
