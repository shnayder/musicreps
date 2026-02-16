// Key Signatures quiz mode: key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb
// 24 items: 12 major keys x 2 directions.
// Grouped by accidental count for progressive unlocking.
//
// Depends on globals: MAJOR_KEYS, keySignatureLabel, keyBySignatureLabel,
// spelledNoteMatchesSemitone, createQuizEngine, createNoteKeyHandler,
// renderStatsTable, buildStatsLegend, DEFAULT_CONFIG,
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

  function getRecommendationResult() {
    const allGroups = KEY_GROUPS.map((_, i) => i);
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
    var chipsEl = container.querySelector('.practice-group-chips');
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
        names.push(KEY_GROUPS[sorted[k]].label);
      }
      recText.textContent = 'Recommended: ' + names.join(', ');
      recBtn.classList.remove('hidden');
    } else {
      recText.textContent = '';
      recBtn.classList.add('hidden');
    }

    var chipHTML = '';
    for (var g = 0; g < KEY_GROUPS.length; g++) {
      var gItems = getItemIdsForGroup(g);
      var sum = 0, count = 0;
      for (var gi = 0; gi < gItems.length; gi++) {
        var ga = engine.selector.getAutomaticity(gItems[gi]);
        if (ga !== null) { sum += ga; count++; }
      }
      var avg = count > 0 ? sum / count : null;
      var color = getAutomaticityColor(avg);
      var textColor = heatmapNeedsLightText(color) ? 'white' : '';
      chipHTML += '<div class="string-chip" style="background:' + color;
      if (textColor) chipHTML += ';color:' + textColor;
      chipHTML += '">' + KEY_GROUPS[g].label + '</div>';
    }
    chipsEl.innerHTML = chipHTML;
  }

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    var items = mode.getEnabledItems();
    el.textContent = items.length + ' items \u00B7 60s';
  }

  // --- Stats ---

  let currentItem = null;

  function getTableRows() {
    return MAJOR_KEYS.map(key => ({
      label: displayNote(key.root) + ' major',
      sublabel: keySignatureLabel(key),
      _colHeader: 'Key',
      fwdItemId: key.root + ':fwd',
      revItemId: key.root + ':rev',
    }));
  }

  const statsControls = createStatsControls(container, (mode, el) => {
    const tableDiv = document.createElement('div');
    el.appendChild(tableDiv);
    renderStatsTable(engine.selector, getTableRows(), 'Key\u2192Sig', 'Sig\u2192Key', mode, tableDiv, engine.baseline);
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    el.appendChild(legendDiv);
  });

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

    getPracticingLabel() {
      if (enabledGroups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...enabledGroups].sort((a, b) => a - b)
        .flatMap(g => KEY_GROUPS[g].keys);
      return keys.join(', ');
    },

    presentQuestion(itemId) {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const sigButtons = container.querySelector('.answer-buttons-keysig');
      const noteButtons = container.querySelector('.answer-buttons-notes');

      if (currentItem.dir === 'fwd') {
        prompt.textContent = displayNote(currentItem.key.root) + ' major = ?';
        sigButtons.classList.remove('answer-group-hidden');
        noteButtons.classList.add('answer-group-hidden');
      } else {
        const label = keySignatureLabel(currentItem.key);
        prompt.textContent = label + ' major = ?';
        sigButtons.classList.add('answer-group-hidden');
        noteButtons.classList.remove('answer-group-hidden');
      }
    },

    checkAnswer(itemId, input) {
      if (currentItem.dir === 'fwd') {
        const expected = keySignatureLabel(currentItem.key);
        return { correct: input === expected, correctAnswer: expected };
      } else {
        const correct = spelledNoteMatchesSemitone(currentItem.key.root, input);
        return { correct, correctAnswer: displayNote(currentItem.key.root) };
      }
    },

    onStart() {
      noteKeyHandler.reset();
      if (statsControls.mode) statsControls.hide();
    },

    onStop() {
      noteKeyHandler.reset();
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
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

    getCalibrationTrialConfig(buttons, prevBtn) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    input => engine.submitAnswer(input),
    () => true
  );

  function init() {
    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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
    activate() { engine.attach(); refreshNoteButtonLabels(container); refreshUI(); engine.showCalibrationIfNeeded(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
      if (pendingSigTimeout) clearTimeout(pendingSigTimeout);
      pendingSigDigit = null;
    },
  };
}
