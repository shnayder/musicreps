// Note Semitones quiz mode: bidirectional note <-> semitone number.
// Forward: "C# = ?" -> 1, Reverse: "3 = ?" -> D#/Eb
// 24 items total (12 notes x 2 directions).

import type { Note } from './types.ts';
import {
  displayNote,
  noteMatchesInput,
  NOTES,
  pickRandomAccidental,
} from './music-data.ts';
import {
  createAdaptiveKeyHandler,
  createQuizEngine,
  pickCalibrationButton,
  refreshNoteButtonLabels,
} from './quiz-engine.ts';
import {
  buildStatsLegend,
  createStatsControls,
  renderStatsTable,
} from './stats-display.ts';

export function createNoteSemitonesMode() {
  const container = document.getElementById('mode-noteSemitones')!;

  // Build item list: 12 notes x 2 directions
  const ALL_ITEMS: string[] = [];
  for (const note of NOTES) {
    ALL_ITEMS.push(note.name + ':fwd'); // note -> number
    ALL_ITEMS.push(note.name + ':rev'); // number -> note
  }

  function parseItem(itemId: string): { note: Note; dir: string } {
    const [noteName, dir] = itemId.split(':');
    const note = NOTES.find((n) => n.name === noteName)!;
    return { note, dir };
  }

  let currentItem: { note: Note; dir: string } | null = null;
  let currentAccidentalChoice: string | null = null;

  // --- Tab state ---
  let activeTab = 'practice';

  function switchTab(tabName: string): void {
    activeTab = tabName;
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    container.querySelectorAll('.tab-content').forEach((el) => {
      el.classList.toggle(
        'active',
        tabName === 'practice'
          ? el.classList.contains('tab-practice')
          : el.classList.contains('tab-progress'),
      );
    });
    if (tabName === 'progress') {
      statsControls.show(statsControls.mode || 'retention');
    } else {
      renderPracticeSummary();
    }
  }

  // --- Practice summary ---

  function renderPracticeSummary(): void {
    const statusLabel = container.querySelector('.practice-status-label');
    const statusDetail = container.querySelector('.practice-status-detail');
    const recText = container.querySelector('.practice-rec-text');
    const recBtn = container.querySelector('.practice-rec-btn');
    if (!statusLabel) return;

    const threshold = engine.selector.getConfig().automaticityThreshold;
    let fluent = 0, seen = 0;
    for (let i = 0; i < ALL_ITEMS.length; i++) {
      const auto = engine.selector.getAutomaticity(ALL_ITEMS[i]);
      if (auto !== null) {
        seen++;
        if (auto > threshold) fluent++;
      }
    }

    if (seen === 0) {
      statusLabel.textContent = 'Ready to start';
      statusDetail!.textContent = ALL_ITEMS.length + ' items to learn';
    } else {
      const pct = ALL_ITEMS.length > 0
        ? Math.round((fluent / ALL_ITEMS.length) * 100)
        : 0;
      let label;
      if (pct >= 80) label = 'Strong';
      else if (pct >= 50) label = 'Solid';
      else if (pct >= 20) label = 'Building';
      else label = 'Getting started';
      statusLabel.textContent = 'Overall: ' + label;
      statusDetail!.textContent = fluent + ' of ' + ALL_ITEMS.length +
        ' items fluent';
    }

    // No groups, so no recommendation
    recText!.textContent = '';
    recBtn!.classList.add('hidden');
  }

  function renderSessionSummary(): void {
    const el = container.querySelector('.session-summary-text');
    if (!el) return;
    el.textContent = ALL_ITEMS.length + ' items \u00B7 60s';
  }

  // Build row definitions for the stats table
  function getTableRows() {
    return NOTES.map((note) => ({
      label: displayNote(note.name),
      sublabel: String(note.num),
      _colHeader: 'Note',
      fwdItemId: note.name + ':fwd',
      revItemId: note.name + ':rev',
    }));
  }

  const statsControls = createStatsControls(container, function (mode, el) {
    const tableDiv = document.createElement('div');
    el.appendChild(tableDiv);
    renderStatsTable(
      engine.selector,
      getTableRows(),
      'N\u2192#',
      '#\u2192N',
      mode,
      tableDiv,
      engine.baseline ?? undefined,
    );
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = buildStatsLegend(mode, engine.baseline ?? undefined);
    el.appendChild(legendDiv);
  });

  const mode = {
    id: 'noteSemitones',
    name: 'Note \u2194 Semitones',
    storageNamespace: 'noteSemitones',

    getEnabledItems(): string[] {
      return ALL_ITEMS;
    },

    presentQuestion(itemId: string): void {
      currentItem = parseItem(itemId);
      const prompt = container.querySelector('.quiz-prompt');
      const noteButtons = container.querySelector('.answer-buttons-notes');
      const numButtons = container.querySelector('.answer-buttons-numbers');

      currentAccidentalChoice = pickRandomAccidental(
        currentItem.note.displayName,
      );
      if (currentItem.dir === 'fwd') {
        // Show note, answer is number 0-11
        prompt!.textContent = displayNote(currentAccidentalChoice);
        noteButtons!.classList.add('answer-group-hidden');
        numButtons!.classList.remove('answer-group-hidden');
      } else {
        // Show number, answer is note
        prompt!.textContent = String(currentItem.note.num);
        noteButtons!.classList.remove('answer-group-hidden');
        numButtons!.classList.add('answer-group-hidden');
      }
    },

    checkAnswer(_itemId: string, input: string) {
      if (currentItem!.dir === 'fwd') {
        const correct = parseInt(input, 10) === currentItem!.note.num;
        return { correct, correctAnswer: String(currentItem!.note.num) };
      } else {
        const correct = noteMatchesInput(currentItem!.note, input);
        return {
          correct,
          correctAnswer: displayNote(currentAccidentalChoice!),
        };
      }
    },

    onStart(): void {
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      if (statsControls.mode) statsControls.hide();
    },

    onStop(): void {
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
      pendingDigitTimeout = null;
      if (activeTab === 'progress') {
        statsControls.show('retention');
      }
      renderPracticeSummary();
      renderSessionSummary();
    },

    handleKey(
      e: KeyboardEvent,
      { submitAnswer }: { submitAnswer: (input: string) => void },
    ): boolean {
      if (currentItem!.dir === 'rev') {
        return noteKeyHandler.handleKey(e);
      }
      // Forward: number keys 0-9 for semitone answer
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        // Handle two-digit: 10, 11
        if (pendingDigit !== null) {
          const num = pendingDigit * 10 + parseInt(e.key);
          clearTimeout(pendingDigitTimeout!);
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

    getCalibrationButtons(): HTMLElement[] {
      return Array.from(container.querySelectorAll('.answer-btn-note'));
    },

    getCalibrationTrialConfig(
      buttons: HTMLElement[],
      prevBtn: HTMLElement | null,
    ) {
      const btn = pickCalibrationButton(buttons, prevBtn);
      return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
    },
  };

  let pendingDigit: number | null = null;
  let pendingDigitTimeout: ReturnType<typeof setTimeout> | null = null;

  const engine = createQuizEngine(mode, container);
  engine.storage.preload?.(ALL_ITEMS);

  const noteKeyHandler = createAdaptiveKeyHandler(
    (input) => engine.submitAnswer(input),
    () => true,
  );

  function init(): void {
    // Tab switching
    container.querySelectorAll<HTMLElement>('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
    });

    // Note answer buttons
    container.querySelectorAll<HTMLElement>('.answer-btn-note').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          engine.submitAnswer(btn.dataset.note!);
        });
      },
    );

    // Number answer buttons
    container.querySelectorAll<HTMLElement>('.answer-btn-num').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          if (!engine.isActive || engine.isAnswered) return;
          engine.submitAnswer(btn.dataset.num!);
        });
      },
    );

    // Start/stop
    container.querySelector('.start-btn')!.addEventListener(
      'click',
      () => engine.start(),
    );

    renderPracticeSummary();
    renderSessionSummary();
  }

  return {
    mode,
    engine,
    init,
    activate() {
      engine.attach();
      refreshNoteButtonLabels(container);
      engine.updateIdleMessage();
      renderPracticeSummary();
    },
    deactivate() {
      if (engine.isRunning) engine.stop();
      engine.detach();
      noteKeyHandler.reset();
      if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
      pendingDigit = null;
    },
  };
}
