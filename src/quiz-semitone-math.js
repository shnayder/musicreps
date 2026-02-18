// Semitone Math quiz mode: note +/- semitone count = note.
// "C + 3 = ?" -> D#/Eb,  "G - 5 = ?" -> D
// 264 items: 12 notes x 11 intervals (1-11) x 2 directions (+/-).
// Grouped by semitone count into 6 distance groups for progressive unlocking.
//
// Depends on globals: NOTES, noteAdd, noteSub, noteMatchesInput,
// pickAccidentalName, createQuizEngine, createNoteKeyHandler,
// renderStatsGrid, buildStatsLegend, DEFAULT_CONFIG,
// computeRecommendations

function createSemitoneMathMode() {
  const container = document.getElementById('mode-semitoneMath');
  const GROUPS_KEY = 'semitoneMath_enabledGroups';

  // Distance groups: pairs of semitone distances
  const DISTANCE_GROUPS = [
    { distances: [1, 2],   label: '1,2' },
    { distances: [3, 4],   label: '3,4' },
    { distances: [5, 6],   label: '5,6' },
    { distances: [7, 8],   label: '7,8' },
    { distances: [9, 10],  label: '9,10' },
    { distances: [11],     label: '11' },
  ];

  let enabledGroups = new Set([0]); // Default: first group only
  let recommendedGroups = new Set();

  // Build full item list (for preloading & stats display)
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

  // --- Distance group helpers ---

  function getItemIdsForGroup(groupIndex) {
    const distances = DISTANCE_GROUPS[groupIndex].distances;
    const items = [];
    for (const note of NOTES) {
      for (const d of distances) {
        items.push(note.name + '+' + d);
        items.push(note.name + '-' + d);
      }
    }
    return items;
  }

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

  function getRecommendationResult() {
    const allGroups = DISTANCE_GROUPS.map((_, i) => i);
    return computeRecommendations(engine.selector, allGroups, getItemIdsForGroup, DEFAULT_CONFIG, recsOptions);
  }

  function updateRecommendations(selector) {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    updateGroupToggles();
  }

  function applyRecommendations(selector) {
    const result = getRecommendationResult();
    recommendedGroups = result.recommended;
    if (result.enabled) {
      enabledGroups = result.enabled;
      saveEnabledGroups();
    }
    updateGroupToggles();
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

  // --- Tab state ---
  let activeTab = 'practice';

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active',
        tabName === 'practice' ? el.classList.contains('tab-practice')
                               : el.classList.contains('tab-progress'));
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      renderPracticeSummary();
    }
  }

  function refreshUI() {
    updateRecommendations(engine.selector);
    engine.updateIdleMessage();
    renderPracticeSummary();
    renderSessionSummary();
  }

  // --- Practice summary ---

  function renderPracticeSummary() {
    var statusLabel = container.querySelector('.practice-status-label');
    var statusDetail = container.querySelector('.practice-status-detail');
    var recText = container.querySelector('.practice-rec-text');
    var recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    var items = mode.getEnabledItems();
    var threshold = engine.selector.getConfig().automaticityThreshold;
    var fluent = 0, seen = 0;
    for (var i = 0; i < items.length; i++) {
      var auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) { seen++; if (auto > threshold) fluent++; }
    }
    var allFluent = 0;
    for (var j = 0; j < ALL_ITEMS.length; j++) {
      var a2 = engine.selector.getAutomaticity(ALL_ITEMS[j]);
      if (a2 !== null && a2 > threshold) allFluent++;
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail.textContent = ALL_ITEMS.length + ' items to learn';
    } else {
      var pct = ALL_ITEMS.length > 0 ? Math.round((allFluent / ALL_ITEMS.length) * 100) : 0;
      var label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail.textContent = allFluent + ' of ' + ALL_ITEMS.length + ' items fluent';
    }

    var result = getRecommendationResult();
    if (result.recommended.size > 0) {
      var names = [];
      var sorted = Array.from(result.recommended).sort(function(a, b) { return a - b; });
      for (var k = 0; k < sorted.length; k++) {
        names.push('\u00B1' + DISTANCE_GROUPS[sorted[k]].label);
      }
      recText.textContent = 'Recommended: ' + names.join(', ');
      recBtn.classList.remove('hidden');
    } else {
      recText.textContent = '';
      recBtn.classList.add('hidden');
    }

  }

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    var items = mode.getEnabledItems();
    el.textContent = items.length + ' items \u00B7 60s';
  }

  // --- Stats ---

  let currentItem = null;

  const statsControls = createStatsControls(container, (mode, el) => {
    const colLabels = [];
    for (let s = 1; s <= 11; s++) colLabels.push(String(s));
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid-wrapper';
    el.appendChild(gridDiv);
    renderStatsGrid(engine.selector, colLabels, (noteName, colIdx) => {
      const n = colIdx + 1;
      return [noteName + '+' + n, noteName + '-' + n];
    }, mode, gridDiv, undefined, engine.baseline);
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    el.appendChild(legendDiv);
  });


  // --- Quiz mode interface ---

  const mode = {
    id: 'semitoneMath',
    name: 'Semitone Math',
    storageNamespace: 'semitoneMath',

    getEnabledItems() {
      const items = [];
      for (const g of enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    getPracticingLabel() {
      if (enabledGroups.size === DISTANCE_GROUPS.length) return 'all distances';
      const labels = [...enabledGroups].sort((a, b) => a - b)
        .map(g => '\u00B1' + DISTANCE_GROUPS[g].label);
      return labels.join(', ');
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      currentItem.useFlats = currentItem.op === '-'; // sharps ascending, flats descending
      const prompt = container.querySelector('.quiz-prompt');
      const noteName = displayNote(pickAccidentalName(currentItem.note.displayName, currentItem.useFlats));
      prompt.textContent = noteName + ' ' + currentItem.op + ' ' + currentItem.semitones;
      container.querySelectorAll('.answer-btn-note').forEach(btn => {
        const note = NOTES.find(n => n.name === btn.dataset.note);
        if (note) btn.textContent = displayNote(pickAccidentalName(note.displayName, currentItem.useFlats));
      });
    },

    checkAnswer(itemId, input) {
      const correct = noteMatchesInput(currentItem.answer, input);
      return { correct, correctAnswer: displayNote(pickAccidentalName(currentItem.answer.displayName, currentItem.useFlats)) };
    },

    onStart() {
      noteKeyHandler.reset();
      if (statsControls.mode) statsControls.hide();
    },

    onStop() {
      noteKeyHandler.reset();
      refreshNoteButtonLabels(container);
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey(e, { submitAnswer }) {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },

    getCalibrationTrialConfig(buttons, prevBtn) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true
  );

  function init() {
    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Generate distance group toggle buttons
    const togglesDiv = container.querySelector('.distance-toggles');
    DISTANCE_GROUPS.forEach((group, i) => {
      const btn = document.createElement('button');
      btn.className = 'distance-toggle';
      btn.dataset.group = String(i);
      btn.textContent = group.label;
      btn.addEventListener('click', () => toggleGroup(i));
      togglesDiv.appendChild(btn);
    });

    loadEnabledGroups();

    // Note answer buttons
    container.querySelectorAll('.answer-btn-note').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!engine.isActive || engine.isAnswered) return;
        engine.submitAnswer(btn.dataset.note);
      });
    });

    container.querySelector('.start-btn').addEventListener('click', () => engine.start());

    // Use recommendation button
    var recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', () => {
        applyRecommendations(engine.selector);
        refreshUI();
      });
    }

    applyRecommendations(engine.selector);
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); refreshNoteButtonLabels(container); refreshUI(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
  };
}
