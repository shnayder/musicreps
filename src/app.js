// Fretboard Trainer — browser application logic.
// Depends on globals from adaptive.js: createAdaptiveSelector,
// createLocalStorageAdapter, DEFAULT_CONFIG.

const TARGET_TIME = 3000;

// --- Initialize adaptive selector ---
const adaptiveStorage = createLocalStorageAdapter('fretboard');
const adaptiveSelector = createAdaptiveSelector(adaptiveStorage);

// Pre-cache all positions to avoid localStorage reads during quiz
const allItemIds = [];
for (let s = 0; s < 6; s++) {
  for (let f = 0; f < 13; f++) {
    allItemIds.push(`${s}-${f}`);
  }
}
adaptiveStorage.preload(allItemIds);

// String tuning (high E to low E, top to bottom visually)
const strings = ['E', 'B', 'G', 'D', 'A', 'E'];
const stringOffsets = [4, 11, 7, 2, 9, 4]; // semitones from C

// Note names
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const naturalNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Accepted answers for each note
const noteAccepts = {
  'C': ['c'],
  'C#': ['c#', 'db'],
  'D': ['d'],
  'D#': ['d#', 'eb'],
  'E': ['e'],
  'F': ['f'],
  'F#': ['f#', 'gb'],
  'G': ['g'],
  'G#': ['g#', 'ab'],
  'A': ['a'],
  'A#': ['a#', 'bb'],
  'B': ['b']
};

// Settings
const STRINGS_KEY = 'fretboard_enabledStrings';
let enabledStrings = new Set([5]); // Default: low E only
let naturalsOnly = true;

// Load enabled strings from localStorage
function loadEnabledStrings() {
  const saved = localStorage.getItem(STRINGS_KEY);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      enabledStrings = new Set(arr);
    } catch {}
  }
  updateStringToggles();
}

function saveEnabledStrings() {
  localStorage.setItem(STRINGS_KEY, JSON.stringify([...enabledStrings]));
}

let recommendedStrings = new Set();

function updateStringToggles() {
  document.querySelectorAll('.string-toggle').forEach(btn => {
    const s = parseInt(btn.dataset.string);
    btn.classList.toggle('active', enabledStrings.has(s));
    btn.classList.toggle('recommended', recommendedStrings.has(s));
  });
}

function toggleString(s) {
  if (enabledStrings.has(s)) {
    if (enabledStrings.size > 1) {
      enabledStrings.delete(s);
    }
  } else {
    enabledStrings.add(s);
  }
  saveEnabledStrings();
  updateStringToggles();
}

let quizActive = false;
let currentString = null;
let currentFret = null;
let currentNote = null;
let answered = false;
let questionStartTime = null;
let countdownInterval = null;
let expired = false;

function getNoteAtPosition(string, fret) {
  const offset = stringOffsets[string];
  const noteIndex = (offset + fret) % 12;
  return noteNames[noteIndex];
}

function highlightCircle(string, fret, color = '#FFD700') {
  const circle = document.querySelector(`circle[data-string="${string}"][data-fret="${fret}"]`);
  if (circle) {
    circle.setAttribute('fill', color);
  }
}

function showNoteText(string, fret) {
  const text = document.querySelector(`text[data-string="${string}"][data-fret="${fret}"]`);
  if (text) {
    text.textContent = getNoteAtPosition(string, fret);
  }
}

function clearAll() {
  document.querySelectorAll('.note-circle').forEach(circle => {
    circle.setAttribute('fill', 'white');
  });
  document.querySelectorAll('.note-text').forEach(text => {
    text.textContent = '';
  });
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function getTimeColor(ms) {
  if (ms === null) return '';
  if (ms < 3000) return 'hsl(120, 70%, 35%)';
  if (ms < 4000) return 'hsl(80, 70%, 35%)';
  if (ms < 5000) return 'hsl(50, 70%, 40%)';
  if (ms < 6000) return 'hsl(30, 70%, 40%)';
  return 'hsl(0, 70%, 40%)';
}

function getSpeedHeatmapColor(ms) {
  if (ms === null) return '#ddd';
  if (ms < 1500) return 'hsl(120, 60%, 65%)';
  if (ms < 3000) return 'hsl(80, 60%, 65%)';
  if (ms < 4500) return 'hsl(50, 60%, 65%)';
  if (ms < 6000) return 'hsl(30, 60%, 65%)';
  return 'hsl(0, 60%, 65%)';
}

function getRetentionColor(recall) {
  if (recall === null) return '#ddd';
  if (recall > 0.8) return 'hsl(120, 60%, 65%)';
  if (recall > 0.6) return 'hsl(80, 60%, 65%)';
  if (recall > 0.4) return 'hsl(50, 60%, 65%)';
  if (recall > 0.2) return 'hsl(30, 60%, 65%)';
  return 'hsl(0, 60%, 65%)';
}

// Heatmap modes: 'retention', 'speed', or null (hidden)
let heatmapMode = null;

function showHeatmapView(mode) {
  heatmapMode = mode;
  const btn = document.getElementById('heatmap-btn');
  document.getElementById('quiz-area').classList.add('active');
  // Hide quiz-specific elements
  document.querySelector('.countdown-container').style.display = 'none';
  document.getElementById('note-buttons').style.display = 'none';
  document.getElementById('feedback').style.display = 'none';
  document.getElementById('time-display').style.display = 'none';
  document.getElementById('hint').style.display = 'none';

  // Show appropriate legend
  document.getElementById('retention-legend').classList.toggle('active', mode === 'retention');
  document.getElementById('speed-legend').classList.toggle('active', mode === 'speed');

  if (mode === 'retention') {
    btn.textContent = 'Show Speed';
    for (let s = 0; s <= 5; s++) {
      for (let f = 0; f < 13; f++) {
        const recall = adaptiveSelector.getRecall(`${s}-${f}`);
        highlightCircle(s, f, getRetentionColor(recall));
        showNoteText(s, f);
      }
    }
  } else {
    btn.textContent = 'Hide Heatmap';
    for (let s = 0; s <= 5; s++) {
      for (let f = 0; f < 13; f++) {
        const stats = adaptiveSelector.getStats(`${s}-${f}`);
        const ewma = stats ? stats.ewma : null;
        highlightCircle(s, f, getSpeedHeatmapColor(ewma));
        showNoteText(s, f);
      }
    }
  }
}

function hideHeatmap() {
  heatmapMode = null;
  document.getElementById('heatmap-btn').textContent = 'Show Retention';
  clearAll();
  document.getElementById('quiz-area').classList.remove('active');
  document.getElementById('retention-legend').classList.remove('active');
  document.getElementById('speed-legend').classList.remove('active');
  // Restore quiz-specific elements
  document.querySelector('.countdown-container').style.display = '';
  document.getElementById('note-buttons').style.display = '';
  document.getElementById('feedback').style.display = '';
  document.getElementById('time-display').style.display = '';
  document.getElementById('hint').style.display = '';
}

function toggleHeatmap() {
  if (heatmapMode === null) {
    showHeatmapView('retention');
  } else if (heatmapMode === 'retention') {
    showHeatmapView('speed');
  } else {
    hideHeatmap();
  }
}

function getEwmaValues() {
  const ewmas = [];
  for (let s = 0; s <= 5; s++) {
    for (let f = 0; f < 13; f++) {
      const stats = adaptiveSelector.getStats(`${s}-${f}`);
      if (stats && stats.ewma) {
        ewmas.push(stats.ewma);
      }
    }
  }
  return ewmas;
}

function updateStats() {
  const ewmas = getEwmaValues();
  const med = median(ewmas);
  const statsEl = document.getElementById('stats');
  if (med !== null) {
    statsEl.innerHTML = `median: <span style="color:${getTimeColor(Math.round(med))}">${Math.round(med)}ms</span>`;
  } else {
    statsEl.textContent = '';
  }
}

function startCountdown() {
  const bar = document.getElementById('countdown-bar');
  bar.style.width = '100%';
  bar.classList.remove('expired');
  expired = false;

  if (countdownInterval) clearInterval(countdownInterval);

  const startTime = Date.now();
  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, TARGET_TIME - elapsed);
    const percent = (remaining / TARGET_TIME) * 100;
    bar.style.width = percent + '%';

    if (remaining === 0 && !expired) {
      expired = true;
      bar.classList.add('expired');
      clearInterval(countdownInterval);
    }
  }, 50);
}

function startQuiz() {
  if (heatmapMode) hideHeatmap();
  updateStats();
  quizActive = true;
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('heatmap-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'inline';
  document.getElementById('quiz-area').classList.add('active');
  nextQuestion();
}

function stopQuiz() {
  quizActive = false;
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  clearAll();
  document.getElementById('start-btn').style.display = 'inline';
  document.getElementById('heatmap-btn').style.display = 'inline';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('quiz-area').classList.remove('active');
  updateStats();
  showHeatmapView('retention');
}

function getValidItemIds() {
  const itemIds = [];
  for (const s of enabledStrings) {
    for (let f = 0; f < 13; f++) {
      const note = getNoteAtPosition(s, f);
      if (!naturalsOnly || naturalNotes.includes(note)) {
        itemIds.push(`${s}-${f}`);
      }
    }
  }
  return itemIds;
}

function setNoteButtonsEnabled(enabled) {
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}

function nextQuestion() {
  clearAll();

  const validItemIds = getValidItemIds();
  const selectedId = adaptiveSelector.selectNext(validItemIds);
  const [s, f] = selectedId.split('-').map(Number);
  currentString = s;
  currentFret = f;
  currentNote = getNoteAtPosition(currentString, currentFret);

  highlightCircle(currentString, currentFret, '#FFD700');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('time-display').textContent = '';
  document.getElementById('hint').textContent = '';
  setNoteButtonsEnabled(true);
  answered = false;
  questionStartTime = Date.now();
  startCountdown();
}

function checkAnswer(userNote) {
  if (answered) return;

  const feedback = document.getElementById('feedback');
  const hint = document.getElementById('hint');
  const timeDisplay = document.getElementById('time-display');

  const responseTime = Date.now() - questionStartTime;

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  answered = true;
  setNoteButtonsEnabled(false);

  const accepts = noteAccepts[currentNote];
  const correct = accepts.includes(userNote.toLowerCase());

  if (correct) {
    feedback.textContent = 'Correct!';
    feedback.className = 'feedback correct';
    highlightCircle(currentString, currentFret, '#4CAF50');
    adaptiveSelector.recordResponse(`${currentString}-${currentFret}`, responseTime);
    updateStats();
  } else {
    feedback.textContent = 'Incorrect — ' + currentNote;
    feedback.className = 'feedback incorrect';
    highlightCircle(currentString, currentFret, '#f44336');
    adaptiveSelector.recordResponse(`${currentString}-${currentFret}`, responseTime, false);
  }
  showNoteText(currentString, currentFret);
  timeDisplay.textContent = responseTime + ' ms';
  hint.textContent = 'Tap anywhere or press Space for next';
}

// Keyboard input for notes
let pendingNote = null;
let pendingTimeout = null;

function submitPendingNote() {
  if (pendingNote) {
    checkAnswer(pendingNote);
    pendingNote = null;
  }
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
}

document.addEventListener('keydown', (e) => {
  if (!quizActive) return;

  if (e.key === 'Escape') {
    stopQuiz();
    return;
  }

  if ((e.key === ' ' || e.key === 'Enter') && answered) {
    e.preventDefault();
    nextQuestion();
    return;
  }

  if (answered) return;

  const key = e.key.toUpperCase();

  // Handle # for sharps or b for flats
  if (pendingNote && !naturalsOnly) {
    if (e.key === '#' || (e.shiftKey && e.key === '3')) {
      e.preventDefault();
      clearTimeout(pendingTimeout);
      checkAnswer(pendingNote + '#');
      pendingNote = null;
      pendingTimeout = null;
      return;
    }
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      clearTimeout(pendingTimeout);
      checkAnswer(pendingNote + 'b');
      pendingNote = null;
      pendingTimeout = null;
      return;
    }
  }

  // Handle note letters
  if ('CDEFGAB'.includes(key)) {
    e.preventDefault();
    // Cancel any pending note
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
    }

    if (naturalsOnly) {
      // Submit immediately in naturals-only mode
      checkAnswer(key);
    } else {
      // Wait briefly for potential # or b
      pendingNote = key;
      pendingTimeout = setTimeout(submitPendingNote, 400);
    }
  }
});

// Tap anywhere to advance when answered
document.addEventListener('click', (e) => {
  if (!quizActive || !answered) return;
  // Don't advance if clicking a note button or control
  if (e.target.closest('.note-btn, .quiz-controls, .string-toggle')) return;
  nextQuestion();
});

// String toggle handlers
document.querySelectorAll('.string-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    toggleString(parseInt(btn.dataset.string));
  });
});

// Note button handlers
document.querySelectorAll('.note-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!quizActive || answered) return;
    checkAnswer(btn.dataset.note);
  });
});

function updateAccidentalButtons() {
  document.querySelectorAll('.note-btn.accidental').forEach(btn => {
    btn.classList.toggle('hidden', naturalsOnly);
  });
}

// Settings event handlers
document.getElementById('naturals-only').addEventListener('change', (e) => {
  naturalsOnly = e.target.checked;
  updateAccidentalButtons();
});

function getItemIdsForString(s) {
  const items = [];
  for (let f = 0; f < 13; f++) {
    const note = getNoteAtPosition(s, f);
    if (!naturalsOnly || naturalNotes.includes(note)) {
      items.push(`${s}-${f}`);
    }
  }
  return items;
}

function applyRecommendations() {
  const allStrings = [0, 1, 2, 3, 4, 5];
  const recs = adaptiveSelector.getStringRecommendations(allStrings, getItemIdsForString);

  // Check if there's any data at all
  const hasAnyData = recs.some(r => r.dueCount < r.totalCount);
  if (!hasAnyData) {
    // No data yet (first launch or total reset) — keep persisted selection
    recommendedStrings = new Set();
    updateStringToggles();
    return;
  }

  // Check if all strings are equally due (e.g., long absence)
  const maxDue = recs[0].dueCount;
  const minDue = recs[recs.length - 1].dueCount;
  if (maxDue === minDue) {
    // All equal — no useful recommendation, keep persisted selection
    recommendedStrings = new Set();
    updateStringToggles();
    return;
  }

  // Recommend strings with above-median due counts
  const medianDue = recs[Math.floor(recs.length / 2)].dueCount;
  recommendedStrings = new Set();
  const newEnabled = new Set();
  for (const r of recs) {
    if (r.dueCount > medianDue) {
      recommendedStrings.add(r.string);
      newEnabled.add(r.string);
    }
  }
  if (newEnabled.size > 0) {
    enabledStrings = newEnabled;
    saveEnabledStrings();
  }
  updateStringToggles();
}

// Initialize on load
loadEnabledStrings();
applyRecommendations();
updateAccidentalButtons();
updateStats();
showHeatmapView('retention');

// Register service worker for cache busting on iOS home screen
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
