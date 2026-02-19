// Fretboard quiz mode: identify the note at a highlighted fretboard position.
// Parameterized factory supports any fretted instrument (guitar, ukulele, etc.).
// Plugs into the shared quiz engine via the mode interface.

import type {
  CalibrationTrialConfig,
  CheckAnswerResult,
  Instrument,
  StringRecommendation,
} from './types.ts';
import {
  displayNote,
  GUITAR,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
  UKULELE,
} from './music-data.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';
import {
  createAdaptiveKeyHandler,
  createQuizEngine,
  pickCalibrationButton,
  refreshNoteButtonLabels,
} from './quiz-engine.ts';
import {
  buildStatsLegend,
  createStatsControls,
  getAutomaticityColor,
  getSpeedHeatmapColor,
} from './stats-display.ts';
import { computeRecommendations } from './recommendations.ts';
import {
  computeNotePrioritization,
  createFretboardHelpers,
  toggleFretboardString,
} from './quiz-fretboard-state.ts';

function createFrettedInstrumentMode(instrument: Instrument) {
  const container = document.getElementById('mode-' + instrument.id)!;
  const STRINGS_KEY = instrument.storageNamespace + '_enabledStrings';
  const NOTE_FILTER_KEY = instrument.storageNamespace + '_noteFilter';
  let enabledStrings = new Set<number>([instrument.defaultString]);
  let noteFilter: 'natural' | 'sharps-flats' | 'all' = 'natural';
  let recommendedStrings = new Set<number>();
  let lastNotePri:
    | { suggestedFilter: string; naturalMasteryRatio: number }
    | null = null;
  const allStrings: number[] = Array.from(
    { length: instrument.stringCount },
    function (_: unknown, i: number) {
      return i;
    },
  );

  // --- Pure helpers (from quiz-fretboard-state.js) ---

  const fb = createFretboardHelpers({
    notes: NOTES,
    naturalNotes: NATURAL_NOTES,
    stringOffsets: instrument.stringOffsets,
    fretCount: instrument.fretCount,
    noteMatchesInput: noteMatchesInput,
  });

  // --- Fretboard fill colors ---
  const FB_QUIZ_HL = 'hsl(50, 100%, 50%)';

  // --- Tab state ---
  let activeTab = 'practice';

  // --- Two fretboard instances: progress (heatmap) and quiz (highlighting) ---
  const progressFretboard = container.querySelector(
    '.tab-progress .fretboard-wrapper',
  ) as HTMLElement;
  const quizFretboard = container.querySelector(
    '.quiz-area .fretboard-wrapper',
  ) as HTMLElement;

  // --- SVG helpers (scoped to a specific fretboard instance) ---

  function setCircleFill(
    root: HTMLElement,
    string: number,
    fret: number,
    color: string,
  ): void {
    const circle = root.querySelector(
      'circle.fb-pos[data-string="' + string + '"][data-fret="' + fret + '"]',
    ) as SVGElement | null;
    if (circle) circle.style.fill = color;
  }

  function clearAll(root: HTMLElement): void {
    root.querySelectorAll<SVGElement>('.fb-pos').forEach(function (c) {
      c.style.fill = '';
    });
  }

  // --- Hover card setup ---

  function setupHoverCard(fretboardWrapper: HTMLElement): void {
    const card = fretboardWrapper.querySelector('.hover-card') as
      | HTMLElement
      | null;
    if (!card) return;

    function showCard(el: Element): void {
      const s = parseInt(el.getAttribute('data-string')!);
      const f = parseInt(el.getAttribute('data-fret')!);
      const note = fb.getNoteAtPosition(s, f);
      const itemId = s + '-' + f;
      const auto = engine.selector.getAutomaticity(itemId);

      card!.querySelector('.hc-note')!.textContent = displayNote(note);
      card!.querySelector('.hc-string-fret')!.textContent =
        displayNote(instrument.stringNames[s]) + ' string, fret ' + f;

      if (auto !== null) {
        const pct = Math.round(auto * 100);
        let label: string;
        if (auto > 0.8) label = 'Automatic';
        else if (auto > 0.6) label = 'Solid';
        else if (auto > 0.4) label = 'Getting there';
        else if (auto > 0.2) label = 'Fading';
        else label = 'Needs work';
        card!.querySelector('.hc-detail')!.textContent = label + ' \u00B7 ' +
          pct + '%';
        const barFill = card!.querySelector('.hc-bar-fill') as HTMLElement;
        barFill.style.width = pct + '%';
        barFill.style.background = getAutomaticityColor(auto);
      } else {
        card!.querySelector('.hc-detail')!.textContent = 'Not seen yet';
        const barFill2 = card!.querySelector('.hc-bar-fill') as HTMLElement;
        barFill2.style.width = '0%';
        barFill2.style.background = '';
      }

      // Position card above circle (or below if near top)
      const containerRect = fretboardWrapper.querySelector(
        '.fretboard-container',
      )!.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const cx = elRect.left + elRect.width / 2 - containerRect.left;
      const cy = elRect.top - containerRect.top;

      // If circle is near top of fretboard, show card below instead
      if (cy < 50) {
        card!.style.left = cx + 'px';
        card!.style.top = (cy + elRect.height + 6) + 'px';
        card!.style.transform = 'translate(-50%, 0)';
      } else {
        card!.style.left = cx + 'px';
        card!.style.top = (cy - 6) + 'px';
        card!.style.transform = 'translate(-50%, -100%)';
      }
      card!.classList.add('visible');
    }

    function hideCard(): void {
      card!.classList.remove('visible');
    }

    const svg = fretboardWrapper.querySelector('svg')!;
    svg.addEventListener('mouseover', function (e: MouseEvent) {
      const el = (e.target as Element).closest('.fb-pos');
      if (el) showCard(el);
    });
    svg.addEventListener('mouseout', function (e: MouseEvent) {
      const el = (e.target as Element).closest('.fb-pos');
      if (el) hideCard();
    });
  }

  // --- String toggles ---

  function loadEnabledStrings(): void {
    const saved = localStorage.getItem(STRINGS_KEY);
    if (saved) {
      try {
        enabledStrings = new Set<number>(JSON.parse(saved));
      } catch (_e) { /* expected */ }
    }
    updateStringToggles();
  }

  function saveEnabledStrings(): void {
    localStorage.setItem(STRINGS_KEY, JSON.stringify([...enabledStrings]));
  }

  function updateStringToggles(): void {
    container.querySelectorAll<HTMLElement>('.string-toggle').forEach(
      function (btn) {
        const s = parseInt(btn.dataset.string!);
        btn.classList.toggle('active', enabledStrings.has(s));
        btn.classList.toggle('recommended', recommendedStrings.has(s));
      },
    );
  }

  function toggleString(s: number): void {
    enabledStrings = toggleFretboardString(enabledStrings, s);
    saveEnabledStrings();
    refreshUI();
  }

  // --- Note filter persistence ---

  function loadNoteFilter(): void {
    const saved = localStorage.getItem(NOTE_FILTER_KEY);
    if (
      saved &&
      (saved === 'natural' || saved === 'sharps-flats' || saved === 'all')
    ) {
      noteFilter = saved;
    }
    updateNoteToggles();
  }

  function saveNoteFilter(): void {
    try {
      localStorage.setItem(NOTE_FILTER_KEY, noteFilter);
    } catch (_) { /* expected */ }
  }

  function updateNoteToggles(): void {
    const naturalBtn = container.querySelector<HTMLElement>(
      '.notes-toggle[data-notes="natural"]',
    );
    const accBtn = container.querySelector<HTMLElement>(
      '.notes-toggle[data-notes="sharps-flats"]',
    );
    if (naturalBtn) {
      naturalBtn.classList.toggle(
        'active',
        noteFilter === 'natural' || noteFilter === 'all',
      );
    }
    if (accBtn) {
      accBtn.classList.toggle(
        'active',
        noteFilter === 'sharps-flats' || noteFilter === 'all',
      );
    }
  }

  // --- Tab switching ---

  function switchTab(tabName: string): void {
    activeTab = tabName;
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach(
      function (btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      },
    );
    container.querySelectorAll('.tab-content').forEach(function (el) {
      const isPractice = el.classList.contains('tab-practice');
      const isProgress = el.classList.contains('tab-progress');
      if (tabName === 'practice') {
        el.classList.toggle('active', isPractice);
      } else {
        el.classList.toggle('active', isProgress);
      }
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      clearAll(progressFretboard);
      renderPracticeSummary();
    }
  }

  // --- Heatmap (renders on the progress fretboard) ---

  const statsControls = createStatsControls(
    container,
    function (mode: string, el: HTMLElement) {
      el.innerHTML = buildStatsLegend(mode, engine.baseline ?? undefined);
      if (mode === 'retention') {
        for (let si = 0; si < allStrings.length; si++) {
          const s = allStrings[si];
          for (let f = 0; f < instrument.fretCount; f++) {
            const auto = engine.selector.getAutomaticity(s + '-' + f);
            const color = getAutomaticityColor(auto);
            setCircleFill(progressFretboard, s, f, color);
          }
        }
      } else {
        for (let sj = 0; sj < allStrings.length; sj++) {
          const s2 = allStrings[sj];
          for (let f2 = 0; f2 < instrument.fretCount; f2++) {
            const stats = engine.selector.getStats(s2 + '-' + f2);
            const ewma = stats ? stats.ewma : null;
            const color2 = getSpeedHeatmapColor(
              ewma,
              engine.baseline ?? undefined,
            );
            setCircleFill(progressFretboard, s2, f2, color2);
          }
        }
      }
    },
  );

  function hideHeatmap(): void {
    statsControls.hide();
    clearAll(progressFretboard);
  }

  // --- Stats ---

  function updateStats(): void {
    const statsEl = container.querySelector('.stats');
    if (statsEl) statsEl.textContent = '';
  }

  // --- Recommendations ---

  // Sort unstarted strings: lowest pitch first (highest string index = lowest pitch)
  const recsOptions = {
    sortUnstarted: function (a: StringRecommendation, b: StringRecommendation) {
      return b.string - a.string;
    },
  };

  function getRecommendationResult() {
    return computeRecommendations(
      engine.selector,
      allStrings,
      function (s: number) {
        return fb.getItemIdsForString(s, 'all');
      },
      DEFAULT_CONFIG,
      recsOptions,
    );
  }

  function updateRecommendations(): void {
    const result = getRecommendationResult();
    recommendedStrings = result.recommended;
    updateStringToggles();
  }

  function applyRecommendations(): void {
    const result = getRecommendationResult();
    recommendedStrings = result.recommended;
    if (result.enabled) {
      enabledStrings = result.enabled;
      saveEnabledStrings();
    }
    updateStringToggles();
  }

  function refreshUI(): void {
    updateRecommendations();
    engine.updateIdleMessage();
    renderPracticeSummary();
    renderSessionSummary();
  }

  // --- Practice summary rendering ---

  function renderPracticeSummary(): void {
    const statusLabel = container.querySelector('.practice-status-label');
    const statusDetail = container.querySelector('.practice-status-detail');
    const recText = container.querySelector('.practice-rec-text');
    const recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    // Overall stats
    const items = mode.getEnabledItems();
    const threshold = engine.selector.getConfig().automaticityThreshold;
    let fluent = 0, seen = 0;
    for (let i = 0; i < items.length; i++) {
      const auto = engine.selector.getAutomaticity(items[i]);
      if (auto !== null) {
        seen++;
        if (auto > threshold) fluent++;
      }
    }

    // All items (not just enabled)
    const allItems = fb.getFretboardEnabledItems(
      new Set<number>(allStrings),
      noteFilter,
    );
    let allFluent = 0;
    for (let j = 0; j < allItems.length; j++) {
      const a2 = engine.selector.getAutomaticity(allItems[j]);
      if (a2 !== null && a2 > threshold) allFluent++;
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail!.textContent = allItems.length + ' positions to learn';
    } else {
      const pct = allItems.length > 0
        ? Math.round((allFluent / allItems.length) * 100)
        : 0;
      let label: string;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail!.textContent = allFluent + ' of ' + allItems.length +
        ' positions fluent';
    }

    // Recommendation
    const result = getRecommendationResult();

    // Note-type prioritization: naturals first, then add accidentals
    const naturalStats = engine.selector.getStringRecommendations(
      [...result.recommended],
      function (s: number) {
        return fb.getItemIdsForString(s, 'natural');
      },
    );
    lastNotePri = computeNotePrioritization(
      naturalStats,
      DEFAULT_CONFIG.expansionThreshold,
    );

    if (result.recommended.size > 0) {
      // Build rationale text
      const parts: string[] = [];
      if (result.consolidateIndices.length > 0) {
        const cNames = result.consolidateIndices.sort(
          function (a: number, b: number) {
            return b - a;
          },
        )
          .map(function (s: number) {
            return displayNote(instrument.stringNames[s]);
          });
        parts.push(
          'solidify ' + cNames.join(', ') + ' string' +
            (cNames.length > 1 ? 's' : '') +
            ' \u2014 ' + result.consolidateDueCount + ' slow item' +
            (result.consolidateDueCount !== 1 ? 's' : ''),
        );
      }
      if (result.expandIndex !== null) {
        parts.push(
          'start ' + displayNote(instrument.stringNames[result.expandIndex]) +
            ' string' +
            ' \u2014 ' + result.expandNewCount + ' new item' +
            (result.expandNewCount !== 1 ? 's' : ''),
        );
      }
      // Append note filter suggestion
      if (lastNotePri.suggestedFilter === 'natural') {
        parts.push('naturals first');
      } else {
        parts.push('add sharps & flats');
      }
      recText!.textContent = 'Suggestion: ' + parts.join(', ');
      recBtn!.classList.remove('hidden');
    } else {
      recText!.textContent = '';
      recBtn!.classList.add('hidden');
    }
  }

  // --- Session summary ---

  function noteFilterLabel(): string {
    if (noteFilter === 'natural') return 'natural notes';
    if (noteFilter === 'sharps-flats') return 'sharps and flats';
    return 'all notes';
  }

  function renderSessionSummary(): void {
    const el = container.querySelector('.session-summary-text');
    if (!el) return;
    const count = enabledStrings.size;
    el.textContent = count + ' string' + (count !== 1 ? 's' : '') + ' \u00B7 ' +
      noteFilterLabel() + ' \u00B7 60s';
  }

  // --- Accidental buttons ---

  function updateAccidentalButtons(): void {
    const hideAcc = noteFilter === 'natural';
    container.querySelectorAll<HTMLElement>('.note-btn.accidental').forEach(
      function (btn) {
        btn.classList.toggle('hidden', hideAcc);
      },
    );
    const accRow = container.querySelector('.note-row-accidentals');
    if (accRow) accRow.classList.toggle('hidden', hideAcc);
  }

  // --- Quiz mode interface ---

  let currentString: number | null = null;
  let currentFret: number | null = null;
  let currentNote: string | null = null;

  const mode = {
    id: instrument.id,
    name: instrument.name,
    storageNamespace: instrument.storageNamespace,

    getEnabledItems: function (): string[] {
      return fb.getFretboardEnabledItems(enabledStrings, noteFilter);
    },

    getPracticingLabel: function (): string {
      const parts: string[] = [];
      if (enabledStrings.size < instrument.stringCount) {
        const names = Array.from(enabledStrings).sort(
          function (a: number, b: number) {
            return b - a;
          },
        )
          .map(function (s: number) {
            return displayNote(instrument.stringNames[s]);
          });
        parts.push(
          names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
        );
      } else {
        parts.push('all strings');
      }
      if (noteFilter !== 'all') parts.push(noteFilterLabel());
      return parts.join(', ');
    },

    presentQuestion: function (itemId: string): void {
      clearAll(quizFretboard);
      const q = fb.parseFretboardItem(itemId);
      currentString = q.currentString;
      currentFret = q.currentFret;
      currentNote = q.currentNote;
      // Highlight active position, rest stay at default blank fill
      setCircleFill(quizFretboard, q.currentString, q.currentFret, FB_QUIZ_HL);
      container.querySelector('.quiz-prompt')!.textContent = 'Name this note.';
    },

    checkAnswer: function (_itemId: string, input: string): CheckAnswerResult {
      return fb.checkFretboardAnswer(currentNote!, input);
    },

    onAnswer: function (
      _itemId: string,
      result: CheckAnswerResult,
      _responseTime: number,
    ): void {
      if (result.correct) {
        setCircleFill(
          quizFretboard,
          currentString!,
          currentFret!,
          'var(--color-success)',
        );
      } else {
        setCircleFill(
          quizFretboard,
          currentString!,
          currentFret!,
          'var(--color-error)',
        );
      }
    },

    onStart: function (): void {
      noteKeyHandler.reset();
      if (statsControls.mode) hideHeatmap();
      updateStats();
    },

    onStop: function (): void {
      noteKeyHandler.reset();
      clearAll(quizFretboard);
      updateStats();
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      refreshUI();
    },

    handleKey: function (
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean {
      return noteKeyHandler.handleKey(e);
    },

    getCalibrationButtons: function (): HTMLElement[] {
      return Array.from(container.querySelectorAll('.note-btn:not(.hidden)'));
    },

    getCalibrationTrialConfig: function (
      buttons: HTMLElement[],
      prevBtn: HTMLElement | null,
    ): CalibrationTrialConfig {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  // Create engine
  const engine = createQuizEngine(mode, container);

  // Keyboard handler
  const noteKeyHandler = createAdaptiveKeyHandler(
    function (input: string) {
      engine.submitAnswer(input);
    },
    function () {
      return noteFilter !== 'natural';
    },
  );

  // Pre-cache all positions
  const allItemIds: string[] = [];
  for (let si = 0; si < allStrings.length; si++) {
    for (let fi = 0; fi < instrument.fretCount; fi++) {
      allItemIds.push(allStrings[si] + '-' + fi);
    }
  }
  engine.storage.preload?.(allItemIds);

  // --- Wire up DOM ---

  function init(): void {
    loadEnabledStrings();
    loadNoteFilter();

    // Tab switching
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach(
      function (btn) {
        btn.addEventListener('click', function () {
          switchTab(btn.dataset.tab!);
        });
      },
    );

    // String toggles
    container.querySelectorAll<HTMLElement>('.string-toggle').forEach(
      function (btn) {
        btn.addEventListener('click', function () {
          toggleString(parseInt(btn.dataset.string!));
        });
      },
    );

    // Note buttons (for quiz)
    container.querySelectorAll<HTMLElement>('.note-btn').forEach(
      function (btn) {
        btn.addEventListener('click', function () {
          if (!engine.isActive || engine.isAnswered) return;
          engine.submitAnswer(btn.dataset.note!);
        });
      },
    );

    // Notes toggles (natural / sharps & flats)
    container.querySelectorAll<HTMLElement>('.notes-toggle').forEach(
      function (btn) {
        btn.addEventListener('click', function () {
          btn.classList.toggle('active');
          // Ensure at least one is active
          const anyActive = container.querySelector('.notes-toggle.active');
          if (!anyActive) btn.classList.add('active');
          const naturalActive = container.querySelector(
            '.notes-toggle[data-notes="natural"].active',
          );
          const accActive = container.querySelector(
            '.notes-toggle[data-notes="sharps-flats"].active',
          );
          if (naturalActive && accActive) noteFilter = 'all';
          else if (accActive) noteFilter = 'sharps-flats';
          else noteFilter = 'natural';
          saveNoteFilter();
          updateAccidentalButtons();
          refreshUI();
        });
      },
    );

    // Start button
    container.querySelector('.start-btn')!.addEventListener(
      'click',
      function () {
        engine.start();
      },
    );

    // Use recommendation button
    const recBtn = container.querySelector('.practice-rec-btn');
    if (recBtn) {
      recBtn.addEventListener('click', function () {
        applyRecommendations();
        if (lastNotePri) {
          noteFilter = lastNotePri.suggestedFilter as
            | 'natural'
            | 'sharps-flats'
            | 'all';
          saveNoteFilter();
          updateNoteToggles();
          updateAccidentalButtons();
        }
        refreshUI();
      });
    }

    // Hover card only on progress fretboard (not quiz — would reveal the answer)
    if (progressFretboard) setupHoverCard(progressFretboard);

    updateRecommendations();
    updateAccidentalButtons();
    updateStats();
    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode: mode,
    engine: engine,
    init: init,
    activate: function (): void {
      engine.attach();
      refreshNoteButtonLabels(container);
      refreshUI();
    },
    deactivate: function (): void {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
    },
    onNotationChange: function (): void {
      if (!container.classList.contains('mode-active')) return;
      renderPracticeSummary();
      if (activeTab === 'progress' && statsControls.mode) {
        statsControls.show(statsControls.mode);
      }
    },
  };
}

export function createGuitarFretboardMode() {
  return createFrettedInstrumentMode(GUITAR);
}

export function createUkuleleFretboardMode() {
  return createFrettedInstrumentMode(UKULELE);
}
