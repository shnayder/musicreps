// Diatonic Chords quiz mode: key + roman numeral <-> chord root.
// Forward: "IV in Bb major?" -> Eb, Reverse: "Dm is what in C major?" -> ii
// 168 items: 12 keys x 7 degrees x 2 directions.
// Grouped by degree importance for progressive unlocking.
//
// Depends on globals: MAJOR_KEYS, DIATONIC_CHORDS, ROMAN_NUMERALS,
// getScaleDegreeNote, spelledNoteMatchesSemitone,
// createQuizEngine, createNoteKeyHandler, updateModeStats,
// renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createDiatonicChordsMode() {
  const container = document.getElementById('mode-diatonicChords');
  const GROUPS_KEY = 'diatonicChords_enabledGroups';

  // Groups by degree importance
  const CHORD_GROUPS = [
    { degrees: [1, 4, 5], label: 'I,IV,V' },
    { degrees: [2, 6],    label: 'ii,vi' },
    { degrees: [3, 7],    label: 'iii,vii\u00B0' },
  ];

  let enabledGroups = new Set([0]);
  let recommendedGroups = new Set();

  // Build full item list
  const ALL_ITEMS = [];
  for (const key of MAJOR_KEYS) {
    for (let d = 1; d <= 7; d++) {
      ALL_ITEMS.push(key.root + ':' + d + ':fwd');
      ALL_ITEMS.push(key.root + ':' + d + ':rev');
    }
  }

  function parseItem(itemId) {
    const parts = itemId.split(':');
    const keyRoot = parts[0];
    const degree = parseInt(parts[1]);
    const dir = parts[2];
    const key = MAJOR_KEYS.find(k => k.root === keyRoot);
    const chord = DIATONIC_CHORDS[degree - 1];
    const rootNote = getScaleDegreeNote(keyRoot, degree);
    return { key, degree, dir, chord, rootNote };
  }

  function getItemIdsForGroup(groupIndex) {
    const degrees = CHORD_GROUPS[groupIndex].degrees;
    const items = [];
    for (const key of MAJOR_KEYS) {
      for (const d of degrees) {
        items.push(key.root + ':' + d + ':fwd');
        items.push(key.root + ':' + d + ':rev');
      }
    }
    return items;
  }

  // --- Group management ---

  function loadEnabledGroups() {
    const saved = localStorage.getItem(GROUPS_KEY);
    if (saved) {
      try { enabledGroups = new Set(JSON.parse(saved)); } catch {}
    }
    updateGroupToggles();
  }

  function saveEnabledGroups() {
    localStorage.setItem(GROUPS_KEY, JSON.stringify([...enabledGroups]));
  }

  function updateGroupToggles() {
    container.querySelectorAll('.distance-toggle').forEach(btn => {
      const g = parseInt(btn.dataset.group);
      btn.classList.toggle('active', enabledGroups.has(g));
      btn.classList.toggle('recommended', recommendedGroups.has(g));
    });
  }

  const recsOptions = { sortUnstarted: (a, b) => a.string - b.string };

  function updateRecommendations(selector) {
    const allGroups = CHORD_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const allGroups = CHORD_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    if (result.enabled) {
      enabledGroups = result.enabled;
      saveEnabledGroups();
    }
    updateGroupToggles();
  }

  function refreshUI() {
    updateRecommendations(engine.selector);
    engine.updateIdleMessage();
  }

  function toggleGroup(g) {
    if (enabledGroups.has(g)) {
      if (enabledGroups.size > 1) enabledGroups.delete(g);
    } else {
      enabledGroups.add(g);
    }
    saveEnabledGroups();
    refreshUI();
  }

  // --- Stats ---

  let currentItem = null;
  let statsMode = null;

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    statsContainer.innerHTML = '';

    // Grid (merged: averages fwd and rev directions)
    const colLabels = ROMAN_NUMERALS;
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);

    const keyNotes = MAJOR_KEYS.map(k => ({ name: k.root, displayName: k.root }));
    renderStatsGrid(engine.selector, colLabels, (keyRoot, colIdx) => {
      const d = colIdx + 1;
      return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
    }, mode, gridDiv, keyNotes);

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

  // --- Quiz mode interface ---

  const mode = {
    id: 'diatonicChords',
    name: 'Diatonic Chords',
    storageNamespace: 'diatonicChords',

    getEnabledItems() {
      const items = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const noteButtons = container.querySelector('.answer-buttons-notes');
      const numeralButtons = container.querySelector('.answer-buttons-numerals');

      if (currentItem.dir === 'fwd') {
        prompt.textContent = currentItem.chord.numeral + ' in ' + currentItem.key.root + ' major = ?';
        noteButtons.style.display = '';
        numeralButtons.style.display = 'none';
      } else {
        const chordName = currentItem.rootNote + currentItem.chord.qualityLabel;
        prompt.textContent = chordName + ' in ' + currentItem.key.root + ' major = ?';
        noteButtons.style.display = 'none';
        numeralButtons.style.display = '';
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const correct = spelledNoteMatchesSemitone(currentItem.rootNote, input);
        const fullAnswer = currentItem.rootNote + ' ' + currentItem.chord.quality;
        return { correct, correctAnswer: fullAnswer };
      } else {
        const expectedNumeral = currentItem.chord.numeral;
        return { correct: input === expectedNumeral, correctAnswer: expectedNumeral };
      }
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
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      if (currentItem.dir === 'fwd') {
        return noteKeyHandler.handleKey(e);
      }
      // Reverse: number keys 1-7 for roman numeral
      if (e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        submitAnswer(ROMAN_NUMERALS[parseInt(e.key) - 1]);
        return true;
      }
      return false;
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createNoteKeyHandler(
    input => engine.submitAnswer(input),
    () => true
  );

  function init() {
    const togglesDiv = container.querySelector('.distance-toggles');
    CHORD_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    container.querySelectorAll('.answer-btn-numeral').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.numeral);
      });
    });

    container.querySelector('.start-btn').addEventListener('click', () => engine.start());
    container.querySelector('.stop-btn').addEventListener('click', () => engine.stop());
    container.querySelector('.heatmap-btn').addEventListener('click', toggleStats);

    applyRecommendations(engine.selector);
    updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    showStats('retention');
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); refreshUI(); },
    deactivate() {
      if (engine.isActive) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
