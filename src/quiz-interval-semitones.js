// Interval Semitones quiz mode: bidirectional interval <-> semitone number.
// Forward: "minor 3rd = ?" -> 3, Reverse: "7 = ?" -> Perfect 5th
// 24 items total (12 intervals x 2 directions).

import { INTERVALS, intervalMatchesInput } from './music-data.js';
import { createQuizEngine } from './quiz-engine.js';
import { renderStatsTable, buildStatsLegend, createStatsControls } from './stats-display.js';

export function createIntervalSemitonesMode() {
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

  // --- Practice summary ---

  function renderPracticeSummary() {
    var statusLabel = container.querySelector('.practice-status-label');
    var statusDetail = container.querySelector('.practice-status-detail');
    var recText = container.querySelector('.practice-rec-text');
    var recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    var threshold = engine.selector.getConfig().automaticityThreshold;
    var fluent = 0, seen = 0;
    for (var i = 0; i < ALL_ITEMS.length; i++) {
      var auto = engine.selector.getAutomaticity(ALL_ITEMS[i]);
      if (auto !== null) { seen++; if (auto > threshold) fluent++; }
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail.textContent = ALL_ITEMS.length + ' items to learn';
    } else {
      var pct = ALL_ITEMS.length > 0 ? Math.round((fluent / ALL_ITEMS.length) * 100) : 0;
      var label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail.textContent = fluent + ' of ' + ALL_ITEMS.length + ' items fluent';
    }

    // No groups, so no recommendation
    recText.textContent = '';
    recBtn.classList.add('hidden');
  }

  function renderSessionSummary() {
    var el = container.querySelector('.session-summary-text');
    if (!el) return;
    el.textContent = ALL_ITEMS.length + ' items \u00B7 60s';
  }

  function getTableRows() {
    return INTERVALS.map(interval => ({
      label: interval.abbrev,
      sublabel: String(interval.num),
      _colHeader: 'Interval',
      fwdItemId: interval.abbrev + ':fwd',
      revItemId: interval.abbrev + ':rev',
    }));
  }

  const statsControls = createStatsControls(container, function(mode, el) {
    const tableDiv = document.createElement('div');
    el.appendChild(tableDiv);
    renderStatsTable(engine.selector, getTableRows(), 'I\u2192#', '#\u2192I', mode, tableDiv, engine.baseline);
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline);
    el.appendChild(legendDiv);
  });

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
        prompt.textContent = currentItem.interval.name;
        intervalButtons.classList.add('answer-group-hidden');
        numButtons.classList.remove('answer-group-hidden');
      } else {
        // Show number, answer is interval
        prompt.textContent = String(currentItem.interval.num);
        intervalButtons.classList.remove('answer-group-hidden');
        numButtons.classList.add('answer-group-hidden');
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
      if (statsControls.mode) statsControls.hide();
    },

    onStop() {
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      renderPracticeSummary();
      renderSessionSummary();
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

    getCalibrationButtons() {
      return Array.from(container.querySelectorAll('.answer-btn-interval'));
    },

    getCalibrationTrialConfig(buttons, prevBtn) {
      // Uniform random — no accidental/natural distinction for intervals
      let btn;
      do {
        btn = buttons[Math.floor(Math.random() * buttons.length)];
      } while (btn === prevBtn && buttons.length > 1);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  let pendingDigit = null;
  let pendingDigitTimeout = null;

  const engine = createQuizEngine(mode, container);
  engine.storage.preload(ALL_ITEMS);

  function init() {
    // Tab switching
    container.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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

    // Start/stop
    container.querySelector('.start-btn').addEventListener('click', () => engine.start());

    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode,
    engine,
    init,
    activate() { engine.attach(); engine.updateIdleMessage(); renderPracticeSummary(); },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
    },
  };
}
