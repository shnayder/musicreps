// Note Semitones quiz mode: bidirectional note <-> semitone number.
// Forward: "C# = ?" -> 1, Reverse: "3 = ?" -> D#/Eb
// 24 items total (12 notes x 2 directions).
//
// Depends on globals: NOTES, createQuizEngine, createNoteKeyHandler,
// updateModeStats, renderStatsTable, buildStatsLegend

function createNoteSemitonesMode() {
  const container = document.getElementById('mode-noteSemitones');

  // Build item list: 12 notes x 2 directions
  const ALL_ITEMS = [];
  for (const note of NOTES) {
    ALL_ITEMS.push(note.name + ':fwd'); // note -> number
    ALL_ITEMS.push(note.name + ':rev'); // number -> note
  }

  function parseItem(itemId) {
    const [noteName, dir] = itemId.split(':');
    const note = NOTES.find(n => n.name === noteName);
    return { note, dir };
  }

  let currentItem = null;

  // Build row definitions for the stats table
  function getTableRows() {
    return NOTES.map(note => ({
      label: note.displayName,
      sublabel: String(note.num),
      _colHeader: 'Note',
      fwdItemId: note.name + ':fwd',
      revItemId: note.name + ':rev',
    }));
  }

  const statsControls = createStatsControls(container, function(mode, el) {
    const tableDiv = document.createElement('div');
    el.appendChild(tableDiv);
    renderStatsTable(engine.selector, getTableRows(), 'N\u2192#', '#\u2192N', mode, tableDiv, engine.baseline);
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    el.appendChild(legendDiv);
  });

  const mode = {
    id: 'noteSemitones',
    name: 'Note \u2194 Semitones',
    storageNamespace: 'noteSemitones',

    getEnabledItems() {
      return ALL_ITEMS;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const noteButtons = container.querySelector('.answer-buttons-notes');
      const numButtons = container.querySelector('.answer-buttons-numbers');

      if (currentItem.dir === 'fwd') {
        // Show note, answer is number 0-11
        prompt.textContent = currentItem.note.displayName + ' = ?';
        noteButtons.style.display = 'none';
        numButtons.style.display = '';
      } else {
        // Show number, answer is note
        prompt.textContent = currentItem.note.num + ' = ?';
        noteButtons.style.display = '';
        numButtons.style.display = 'none';
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const correct = parseInt(input, 10) === currentItem.note.num;
        return { correct, correctAnswer: String(currentItem.note.num) };
      } else {
        const correct = noteMatchesInput(currentItem.note, input);
        return { correct, correctAnswer: currentItem.note.displayName };
      }
    },

    onStart() {
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      statsControls.hide();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
      statsControls.show('retention');
    },

    handleKey(e, { submitAnswer }) {
      if (currentItem.dir === 'rev') {
        return noteKeyHandler.handleKey(e);
      }
      // Forward: number keys 0-9 for semitone answer
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        // Handle two-digit: 10, 11
        if (pendingDigit !== null) {
          const num = pendingDigit * 10 + parseInt(e.key);
          clearTimeout(pendingDigitTimeout);
          pendingDigit = null;
          pendingDigitTimeout = null;
          if (num <= 11) {
            submitAnswer(String(num));
          }
          return true;
        }
        const d = parseInt(e.key);
        if (d >= 2) {
          // Can only be single digit (2-9)
          submitAnswer(String(d));
        } else {
          // 0 or 1 — could be start of 10 or 11
          pendingDigit = d;
          pendingDigitTimeout = setTimeout(() => {
            submitAnswer(String(pendingDigit));
            pendingDigit = null;
            pendingDigitTimeout = null;
          }, 400);
        }
        return true;
      }
      return false;
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },
  };

  let pendingDigit = null;
  let pendingDigitTimeout = null;

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

    // Number answer buttons
    container.querySelectorAll('.answer-btn-num').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.num);
      });
    });

    // Start/stop
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());
    container.querySelector('.stop-btn').addEventListener('click', () => engine.stop());

    updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    statsControls.show('retention');
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); engine.updateIdleMessage(); engine.showCalibrationIfNeeded(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
    },
  };
}
