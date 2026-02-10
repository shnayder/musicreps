// Interval Math quiz mode: note +/- interval = note.
// "C + m3 = ?" -> D#/Eb,  "G - P4 = ?" -> D
// 264 items: 12 notes x 11 intervals (m2-M7) x 2 directions (+/-).
// Excludes octave/P8 (adding 12 semitones gives same note).
// Grouped by interval for future group toggles.
//
// Depends on globals: NOTES, INTERVALS, noteAdd, noteSub,
// noteMatchesInput, createQuizEngine, createNoteKeyHandler, updateModeStats

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
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
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

    // Start/stop
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());
    container.querySelector('.stop-btn').addEventListener('click', () => engine.stop());

    updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
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
