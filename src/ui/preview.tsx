// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { displayNote, NOTES } from '../music-data.ts';
import {
  getAutomaticityColor,
  heatmapNeedsLightText,
} from '../stats-display.ts';

// ---------------------------------------------------------------------------
// Preview scaffold
// ---------------------------------------------------------------------------

function Section(
  { title, children }: { title: string; children: ComponentChildren },
) {
  return (
    <section class='preview-section'>
      <h3>{title}</h3>
      <div class='preview-frame'>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Button demos — inline until Phase 2 components replace them
// ---------------------------------------------------------------------------

const ALL_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const ACCIDENTALS = ['C#', 'D#', 'F#', 'G#', 'A#'];
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const INTERVALS = [
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
];

function NoteButtonsDemo() {
  return (
    <div class='answer-buttons answer-buttons-notes'>
      {ALL_NOTES.map((n) => (
        <button
          type='button'
          key={n}
          class='answer-btn answer-btn-note'
          data-note={n}
        >
          {displayNote(n)}
        </button>
      ))}
    </div>
  );
}

function PianoButtonsDemo() {
  return (
    <div class='note-buttons'>
      <div class='note-row-accidentals'>
        {ACCIDENTALS.map((n) => (
          <button
            type='button'
            key={n}
            class='note-btn accidental'
            data-note={n}
          >
            {displayNote(n)}
          </button>
        ))}
      </div>
      <div class='note-row-naturals'>
        {NATURALS.map((n) => (
          <button type='button' key={n} class='note-btn' data-note={n}>
            {displayNote(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

function IntervalButtonsDemo() {
  return (
    <div class='answer-buttons answer-buttons-intervals'>
      {INTERVALS.map((i) => (
        <button
          type='button'
          key={i}
          class='answer-btn answer-btn-interval'
          data-interval={i}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

function NumberButtonsDemo() {
  return (
    <div class='answer-buttons answer-buttons-numbers'>
      {Array.from(
        { length: 12 },
        (_, i) => (
          <button
            type='button'
            key={i}
            class='answer-btn answer-btn-num'
            data-num={String(i)}
          >
            {i}
          </button>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats grid demo — recall heatmap with deterministic mock data
// ---------------------------------------------------------------------------

function StatsGridDemo() {
  const cols = ['+1', '+2', '+3', '+4', '+5', '+6'];

  // Deterministic mock: notes earlier in chromatic scale have higher mastery,
  // mastery decreases with distance, later notes are unseen.
  function mockAuto(noteIdx: number, colIdx: number): number | null {
    if (noteIdx >= 5) return null;
    if (noteIdx === 4 && colIdx > 1) return null;
    return Math.max(0, Math.min(1, 0.95 - noteIdx * 0.12 - colIdx * 0.15));
  }

  return (
    <table class='stats-grid'>
      <thead>
        <tr>
          <th></th>
          {cols.map((c) => <th key={c}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {NOTES.map((note, ni) => (
          <tr key={note.name}>
            <td class='stats-grid-row-label'>{displayNote(note.name)}</td>
            {cols.map((_, ci) => {
              const auto = mockAuto(ni, ci);
              const color = getAutomaticityColor(auto);
              const light = heatmapNeedsLightText(color);
              return (
                <td
                  key={ci}
                  class='stats-cell'
                  style={{
                    background: color,
                    color: light ? 'white' : undefined,
                  }}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function PreviewApp() {
  return (
    <div>
      <h2>Answer Buttons</h2>
      <Section title='Note Buttons (Grid)'>
        <NoteButtonsDemo />
      </Section>
      <Section title='Piano Note Buttons'>
        <PianoButtonsDemo />
      </Section>
      <Section title='Interval Buttons'>
        <IntervalButtonsDemo />
      </Section>
      <Section title='Number Buttons (0–11)'>
        <NumberButtonsDemo />
      </Section>

      <h2>Stats</h2>
      <Section title='Recall Heatmap (stats-grid)'>
        <StatsGridDemo />
      </Section>
    </div>
  );
}

const root = document.getElementById('preview-root');
if (root) render(<PreviewApp />, root);
