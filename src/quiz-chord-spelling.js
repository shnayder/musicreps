// Chord Spelling quiz mode: spell out all notes of a chord in root-up order.
// "Cm7" -> user enters C, Eb, G, Bb in sequence.
// ~132 items: 12 roots x chord types, grouped by chord type.
//
// Depends on globals: CHORD_TYPES, CHORD_ROOTS, getChordTones,
// chordDisplayName, spelledNoteMatchesInput,
// createQuizEngine, createNoteKeyHandler, updateModeStats,
// renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createChordSpellingMode() {
  const container = document.getElementById('mode-chordSpelling');
  const GROUPS_KEY = 'chordSpelling_enabledGroups';

  // Group chord types by their group index
  const SPELLING_GROUPS = [];
  let maxGroup = 0;
  for (const ct of CHORD_TYPES) {
    if (ct.group > maxGroup) maxGroup = ct.group;
  }
  for (let g = 0; g <= maxGroup; g++) {
    const types = CHORD_TYPES.filter(t => t.group === g);
    const label = types.map(t => t.symbol || 'maj').join(', ');
    SPELLING_GROUPS.push({ types, label });
  }

  let enabledGroups = new Set([0]);
  let recommendedGroups = new Set();

  // Build full item list
  const ALL_ITEMS = [];
  for (const root of CHORD_ROOTS) {
    for (const type of CHORD_TYPES) {
      ALL_ITEMS.push(root + ':' + type.name);
    }
  }

  function parseItem(itemId) {
    const colonIdx = itemId.indexOf(':');
    const rootName = itemId.substring(0, colonIdx);
    const typeName = itemId.substring(colonIdx + 1);
    const chordType = CHORD_TYPES.find(t => t.name === typeName);
    const tones = getChordTones(rootName, chordType);
    return { rootName, chordType, tones };
  }

  function getItemIdsForGroup(groupIndex) {
    const types = SPELLING_GROUPS[groupIndex].types;
    const items = [];
    for (const root of CHORD_ROOTS) {
      for (const type of types) {
        items.push(root + ':' + type.name);
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
    const allGroups = SPELLING_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const allGroups = SPELLING_GROUPS.map((_, i) => i);
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

  // --- Multi-note entry state ---

  let currentItem = null;
  let enteredTones = [];
  let statsMode = null;

  function renderSlots() {
    const slotsDiv = container.querySelector('.chord-slots');
    if (!currentItem) { slotsDiv.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < currentItem.tones.length; i++) {
      let cls = 'chord-slot';
      let content = '_';
      if (i < enteredTones.length) {
        content = enteredTones[i].display;
        cls += enteredTones[i].correct ? ' correct' : ' wrong';
      } else if (i === enteredTones.length) {
        cls += ' active';
      }
      html += '<span class="' + cls + '">' + content + '</span>';
    }
    slotsDiv.innerHTML = html;
  }

  function submitTone(input) {
    if (!engine.isActive || engine.isAnswered) return;
    if (!currentItem || enteredTones.length >= currentItem.tones.length) return;

    const idx = enteredTones.length;
    const expected = currentItem.tones[idx];
    const isCorrect = spelledNoteMatchesInput(expected, input);

    enteredTones.push({
      input,
      display: isCorrect ? expected : input,
      correct: isCorrect,
    });
    renderSlots();

    if (enteredTones.length === currentItem.tones.length) {
      const allCorrect = enteredTones.every(t => t.correct);
      engine.submitAnswer(allCorrect ? '__correct__' : '__wrong__');
    }
  }

  // --- Stats ---

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    statsContainer.innerHTML = '';

    // Show ALL chord types, not just enabled ones, for a complete progress view
    const colLabels = CHORD_TYPES.map(t => t.symbol || 'maj');
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    statsContainer.appendChild(gridDiv);

    const rootNotes = CHORD_ROOTS.map(r => ({ name: r, displayName: r }));
    renderStatsGrid(engine.selector, colLabels, (rootName, colIdx) => {
      return rootName + ':' + CHORD_TYPES[colIdx].name;
    }, mode, gridDiv, rootNotes, engine.baseline);

    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
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
    id: 'chordSpelling',
    name: 'Chord Spelling',
    storageNamespace: 'chordSpelling',

    getEnabledItems() {
      const items = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      enteredTones = [];
      const prompt = container.querySelector('.quiz-prompt');
      prompt.textContent = chordDisplayName(currentItem.rootName, currentItem.chordType) + ' = ?';
      renderSlots();
    },

    checkAnswer(itemId, input) {
      const allCorrect = input === '__correct__';
      const correctAnswer = currentItem.tones.join(' ');
      return { correct: allCorrect, correctAnswer };
    },

    onStart() {
      noteKeyHandler.reset();
      enteredTones = [];
      hideStats();
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
    },

    onStop() {
      noteKeyHandler.reset();
      enteredTones = [];
      const slotsDiv = container.querySelector('.chord-slots');
      slotsDiv.innerHTML = '';
      updateModeStats(engine.selector, ALL_ITEMS, engine.els.stats);
      showStats('retention');
      refreshUI();
    },

    handleKey(e, ctx) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createNoteKeyHandler(
    input => submitTone(input),
    () => true
  );

  function init() {
    const togglesDiv = container.querySelector('.distance-toggles');
    SPELLING_GROUPS.forEach((group, i) => {
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
        let input = btn.dataset.note;
        // Resolve enharmonic: buttons can't distinguish A#/Bb, so if the
        // button's pitch matches the expected tone, use the expected spelling.
        if (currentItem && enteredTones.length < currentItem.tones.length) {
          const expected = currentItem.tones[enteredTones.length];
          if (spelledNoteMatchesSemitone(expected, input)) {
            input = expected;
          }
        }
        submitTone(input);
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
