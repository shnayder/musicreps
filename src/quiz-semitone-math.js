// Semitone Math quiz mode: note +/- semitone count = note.
// "C + 3 = ?" -> D#/Eb,  "G - 5 = ?" -> D
// 264 items: 12 notes x 11 intervals (1-11) x 2 directions (+/-).
// Grouped by semitone count for future group toggles.
//
// Depends on globals: NOTES, noteAdd, noteSub, noteMatchesInput,
// createQuizEngine, createNoteKeyHandler, updateModeStats

function createSemitoneMathMode() {
  const container = document.getElementById('mode-semitoneMath');

  // Build item list: 12 notes x 11 semitone counts x 2 directions
  // Item ID format: "C+3" or "C-3"
  const ALL_ITEMS = [];
  for (const note of NOTES) {
    for (let s = 1; s <= 11; s++) {
      ALL_ITEMS.push(note.name + '+' + s);
      ALL_ITEMS.push(note.name + '-' + s);
    }
  }

  function parseItem(itemId) {
    const match = itemId.match(/^([A-G]#?)([+-])(\d+)$/);
    const noteName = match[1];
    const op = match[2];
    const semitones = parseInt(match[3]);
    const note = NOTES.find(n => n.name === noteName);
    const answer = op === '+' ? noteAdd(note.num, semitones) : noteSub(note.num, semitones);
    return { note, op, semitones, answer };
  }

  let currentItem = null;

  const mode = {
    id: 'semitoneMath',
    name: 'Semitone Math',
    storageNamespace: 'semitoneMath',

    getEnabledItems() {
      return ALL_ITEMS;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      prompt.textContent = currentItem.note.displayName + ' ' + currentItem.op + ' ' + currentItem.semitones + ' = ?';
    },

    checkAnswer(itemId, input) {
      const correct = noteMatchesInput(currentItem.answer, input);
      return { correct, correctAnswer: currentItem.answer.displayName };
    },

    onStart() {
      noteKeyHandler.reset();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      noteKeyHandler.reset();
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
