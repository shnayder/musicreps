// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { NOTES } from '../music-data.ts';

import {
  DegreeButtons,
  IntervalButtons,
  KeysigButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  PianoNoteButtons,
} from './buttons.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid, StatsLegend, StatsTable, StatsToggle } from './stats.tsx';
import {
  GroupToggles,
  NoteFilter,
  NotesToggles,
  StringToggles,
} from './scope.tsx';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';

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
// Mock stats selector for StatsGrid / StatsTable demos
// ---------------------------------------------------------------------------

function mockSelector(): StatsSelector {
  // Deterministic mock: notes earlier in chromatic scale have higher mastery,
  // mastery decreases with distance, later notes are unseen.
  function mockAuto(noteIdx: number, colIdx: number): number | null {
    if (noteIdx >= 5) return null;
    if (noteIdx === 4 && colIdx > 1) return null;
    return Math.max(0, Math.min(1, 0.95 - noteIdx * 0.12 - colIdx * 0.15));
  }

  const lookup: Record<string, number | null> = {};
  NOTES.forEach((note, ni) => {
    for (let ci = 0; ci < 6; ci++) {
      lookup[`${note.name}+${ci + 1}`] = mockAuto(ni, ci);
      // Bidirectional entries for table demo
      lookup[`${note.name}:fwd`] = mockAuto(ni, 0);
      lookup[`${note.name}:rev`] = mockAuto(ni, 2);
    }
  });

  return {
    getAutomaticity(id: string) {
      return lookup[id] ?? null;
    },
    getStats(_id: string) {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function PreviewApp() {
  const sel = mockSelector();

  return (
    <div>
      <h2>Answer Buttons</h2>
      <Section title='Note Buttons (Grid)'>
        <NoteButtons />
      </Section>
      <Section title='Piano Note Buttons'>
        <PianoNoteButtons />
      </Section>
      <Section title='Interval Buttons'>
        <IntervalButtons />
      </Section>
      <Section title='Number Buttons (0–11)'>
        <NumberButtons start={0} end={11} />
      </Section>
      <Section title='Key Signature Buttons'>
        <KeysigButtons />
      </Section>
      <Section title='Degree Buttons'>
        <DegreeButtons />
      </Section>
      <Section title='Numeral Buttons'>
        <NumeralButtons />
      </Section>

      <h2>Stats</h2>
      <Section title='Recall Heatmap (StatsGrid)'>
        <StatsGrid
          selector={sel}
          colLabels={['+1', '+2', '+3', '+4', '+5', '+6']}
          getItemId={(name, ci) => `${name}+${ci + 1}`}
          statsMode='retention'
        />
      </Section>
      <Section title='Bidirectional Table (StatsTable)'>
        <StatsTable
          selector={sel}
          rows={NOTES.slice(0, 6).map((n) => ({
            label: n.displayName,
            sublabel: '',
            _colHeader: 'Note',
            fwdItemId: `${n.name}:fwd`,
            revItemId: `${n.name}:rev`,
          }))}
          fwdHeader='→ Semi'
          revHeader='→ Note'
          statsMode='retention'
        />
      </Section>
      <Section title='Stats Legend'>
        <StatsLegend statsMode='retention' />
      </Section>
      <Section title='Stats Toggle'>
        <StatsToggle active='retention' onToggle={() => {}} />
      </Section>

      <h2>Scope Controls</h2>
      <Section title='Group Toggles'>
        <GroupToggles
          labels={['+1 to +3', '+4 to +6', '+7 to +9', '+10 to +11']}
          active={new Set([0, 1])}
          recommended={2}
          onToggle={() => {}}
        />
      </Section>
      <Section title='String Toggles'>
        <StringToggles
          stringNames={['E', 'A', 'D', 'G', 'B', 'e']}
          active={new Set([0, 1, 2])}
          recommended={3}
          onToggle={() => {}}
        />
      </Section>
      <Section title='Note Filter'>
        <NoteFilter mode='natural' onChange={() => {}} />
      </Section>
      <Section title='Notes Toggles'>
        <NotesToggles
          notes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          active={new Set(['C', 'D', 'E', 'F', 'G'])}
          onToggle={() => {}}
        />
      </Section>

      <h2>Quiz UI</h2>
      <Section title='Text Prompt'>
        <TextPrompt text='C + 5 semitones = ?' />
      </Section>
      <Section title='Feedback — Correct'>
        <FeedbackDisplay
          text='Correct!'
          className='feedback correct'
          time='0.82s'
        />
      </Section>
      <Section title='Feedback — Incorrect'>
        <FeedbackDisplay
          text='F — correct answer: E'
          className='feedback incorrect'
          hint='C → E is a major third (4 semitones)'
        />
      </Section>
      <Section title='Countdown Bar (75%)'>
        <CountdownBar pct={75} />
      </Section>
      <Section title='Countdown Bar — Warning (15%)'>
        <CountdownBar pct={15} warning />
      </Section>
      <Section title='Countdown Bar — Last Question'>
        <CountdownBar pct={50} lastQuestion />
      </Section>
    </div>
  );
}

const root = document.getElementById('preview-root');
if (root) render(<PreviewApp />, root);
