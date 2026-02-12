// Key Signatures quiz mode: key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb
// 24 items: 12 major keys x 2 directions.
// Grouped by accidental count for progressive unlocking.
//
// Depends on globals: MAJOR_KEYS, keySignatureLabel, keyBySignatureLabel,
// spelledNoteMatchesSemitone, createQuizEngine, createNoteKeyHandler,
// updateModeStats, renderStatsTable, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createKeySignaturesMode() {
  const container = document.getElementById('mode-keySignatures');
  const GROUPS_KEY = 'keySignatures_enabledGroups';

  // Group definitions: keys grouped by accidental count
  const KEY_GROUPS = [
    { keys: ['C', 'G', 'F'],     label: '0-1' },
    { keys: ['D', 'Bb'],         label: '2' },
    { keys: ['A', 'Eb'],         label: '3' },
    { keys: ['E', 'Ab'],         label: '4' },
    { keys: ['B', 'Db', 'F#'],   label: '5+' },
  ];

  let enabledGroups = new Set([0, 1]); // Default: groups 0+1
  let recommendedGroups = new Set();

  // Build full item list
  const ALL_ITEMS = [];
  for (const key of MAJOR_KEYS) {
    ALL_ITEMS.push(key.root + ':fwd');
    ALL_ITEMS.push(key.root + ':rev');
  }

  function parseItem(itemId) {
    const [rootName, dir] = itemId.split(':');
    const key = MAJOR_KEYS.find(k => k.root === rootName);
    return { key, dir };
  }

  function getItemIdsForGroup(groupIndex) {
    const roots = KEY_GROUPS[groupIndex].keys;
    const items = [];
    for (const root of roots) {
      items.push(root + ':fwd');
      items.push(root + ':rev');
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
    const allGroups = KEY_GROUPS.map((_, i) => i);
    const result = computeRecommendations(selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const allGroups = KEY_GROUPS.map((_, i) => i);
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

  function getTableRows() {
    return MAJOR_KEYS.map(key => ({
      label: key.root + ' major',
      sublabel: keySignatureLabel(key),
      _colHeader: 'Key',
      fwdItemId: key.root + ':fwd',
      revItemId: key.root + ':rev',
    }));
  }

  function showStats(mode) {
    statsMode = mode;
    const statsContainer = container.querySelector('.stats-container');
    const btn = container.querySelector('.heatmap-btn');
    statsContainer.innerHTML = '';
    const tableDiv = document.createElement('div');
    statsContainer.appendChild(tableDiv);
    renderStatsTable(engine.selector, getTableRows(), 'Key\u2192Sig', 'Sig\u2192Key', mode, tableDiv, engine.baseline);
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

  let pendingSigDigit = null;
  let pendingSigTimeout = null;

  const mode = {
    id: 'keySignatures',
    name: 'Key Signatures',
    storageNamespace: 'keySignatures',

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
      const sigButtons = container.querySelector('.answer-buttons-keysig');
      const noteButtons = container.querySelector('.answer-buttons-notes');

      if (currentItem.dir === 'fwd') {
        prompt.textContent = currentItem.key.root + ' major = ?';
        sigButtons.style.display = '';
        noteButtons.style.display = 'none';
      } else {
        const label = keySignatureLabel(currentItem.key);
        prompt.textContent = label + ' major = ?';
        sigButtons.style.display = 'none';
        noteButtons.style.display = '';
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const expected = keySignatureLabel(currentItem.key);
        return { correct: input === expected, correctAnswer: expected };
      } else {
        const correct = spelledNoteMatchesSemitone(currentItem.key.root, input);
        return { correct, correctAnswer: currentItem.key.root };
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
      if (currentItem.dir === 'rev') {
        return noteKeyHandler.handleKey(e);
      }
      // Forward: number keys for sig selection
      if (e.key >= '0' && e.key <= '7') {
        e.preventDefault();
        if (pendingSigTimeout) clearTimeout(pendingSigTimeout);
        pendingSigDigit = e.key;
        pendingSigTimeout = setTimeout(() => {
          if (pendingSigDigit === '0') {
            submitAnswer('0');
          }
          pendingSigDigit = null;
          pendingSigTimeout = null;
        }, 600);
        return true;
      }
      if (pendingSigDigit !== null && (e.key === '#' || e.key === 'b')) {
        e.preventDefault();
        clearTimeout(pendingSigTimeout);
        const answer = pendingSigDigit + e.key;
        pendingSigDigit = null;
        pendingSigTimeout = null;
        submitAnswer(answer);
        return true;
      }
      return false;
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
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
    KEY_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    container.querySelectorAll('.answer-btn-keysig').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.sig);
      });
    });

    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
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
    activate() { engine.attach(); refreshUI(); engine.showCalibrationIfNeeded(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
      if (pendingSigTimeout) clearTimeout(pendingSigTimeout);
      pendingSigDigit = null;
    },
  };
}
