// Interval Math quiz mode: note +/- interval = note.
// "C + m3 = ?" -> D#/Eb,  "G - P4 = ?" -> D
// 264 items: 12 notes x 11 intervals (m2-M7) x 2 directions (+/-).
// Excludes octave/P8 (adding 12 semitones gives same note).
// Grouped by interval for future group toggles.
//
// Depends on globals: NOTES, INTERVALS, noteAdd, noteSub,
// noteMatchesInput, createQuizEngine, createNoteKeyHandler, updateModeStats,
// renderStatsGrid, buildStatsLegend

function createIntervalMathMode() {
  const container = document.getElementById('mode-intervalMath');

  // Intervals 1-11 only (no octave)
  const MATH_INTERVALS = INTERVALS.filter(i => i.num >= 1 && i.num <= 11);

  // Build item list: 12 notes x 11 intervals x 2 directions
  // Item ID format: "C+m3" or "C-P4"
  const ALL_ITEMS = [];
  for (const note of NOTES) {
    for (const interval of MATH_INTERVALS) {
      ALL_ITEMS.push(note.name + '+' + interval.abbrev);
      ALL_ITEMS.push(note.name + '-' + interval.abbrev);
    }
  }

  function parseItem(itemId) {
    const match = itemId.match(/^([A-G]#?)([+-])(.+)$/);
    const noteName = match[1];
    const op = match[2];
    const abbrev = match[3];
    const note = NOTES.find(n => n.name === noteName);
    const interval = MATH_INTERVALS.find(i => i.abbrev === abbrev);
    const answer = op === '+' ? noteAdd(note.num, interval.num) : noteSub(note.num, interval.num);
    return { note, op, interval, answer };
  }

  let currentItem = null;
  let statsMode = null; // null | 'retention' | 'speed'
  let statsDir = '+';   // '+' | '-'

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    const colLabels = MATH_INTERVALS.map(i => i.abbrev);

    statsContainer.innerHTML = '';

    // Direction toggle
    const dirToggle = document.createElement('div');
    dirToggle.className = 'stats-dir-toggle';
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.className = 'dir-btn' + (statsDir === '+' ? ' active' : '');
    plusBtn.setAttribute('aria-label', 'Show ascending stats');
    plusBtn.addEventListener('click', () => { statsDir = '+'; showStats(statsMode); });
    const minusBtn = document.createElement('button');
    minusBtn.textContent = '\u2212';
    minusBtn.className = 'dir-btn' + (statsDir === '-' ? ' active' : '');
    minusBtn.setAttribute('aria-label', 'Show descending stats');
    minusBtn.addEventListener('click', () => { statsDir = '-'; showStats(statsMode); });
    dirToggle.appendChild(plusBtn);
    dirToggle.appendChild(minusBtn);
    statsContainer.appendChild(dirToggle);

    // Legend
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode);
    statsContainer.appendChild(legendDiv);

    // Grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);
    renderStatsGrid(engine.selector, colLabels, function(noteName, colIdx) {
      return noteName + statsDir + MATH_INTERVALS[colIdx].abbrev;
    }, mode, gridDiv);

    statsContainer.style.display = '';
    btn.textContent = mode === 'retention' ? 'Show Speed' : 'Hide Stats';
  }

  function hideStats() {
    statsMode = null;
    const statsContainer = container.querySelector('.stats-container');
    statsContainer.style.display = 'none';
    statsContainer.innerHTML = '';
    container.querySelector('.heatmap-btn').textContent = 'Show Stats';
  }

  function toggleStats() {
    if (statsMode === null) showStats('retention');
    else if (statsMode === 'retention') showStats('speed');
    else hideStats();
  }

  const mode = {
    id: 'intervalMath',
    name: 'Interval Math',
    storageNamespace: 'intervalMath',

    getEnabledItems() {
      return ALL_ITEMS;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      prompt.textContent = currentItem.note.displayName + ' ' + currentItem.op + ' ' + currentItem.interval.abbrev + ' = ?';
    },

    checkAnswer(itemId, input) {
      const correct = noteMatchesInput(currentItem.answer, input);
      return { correct, correctAnswer: currentItem.answer.displayName };
    },

    onStart() {
      noteKeyHandler.reset();
      hideStats();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      noteKeyHandler.reset();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
      showStats('retention');
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createNoteKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true
  );

  function init() {
    // Note answer buttons
    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
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
      noteKeyHandler.reset();
    },
  };
}
