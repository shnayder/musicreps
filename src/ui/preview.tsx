// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { NOTES } from '../music-data.ts';
import { fretboardSVG } from '../html-helpers.ts';

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
import {
  ModeScreen,
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  Recommendation,
  RoundComplete,
  SessionInfo,
  StartButton,
  TabbedIdle,
} from './mode-screen.tsx';

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
// Fretboard preview helpers
// ---------------------------------------------------------------------------

/** Fretboard SVG rendered via dangerouslySetInnerHTML with post-render coloring. */
function FretboardPreview(
  { colorCircles }: {
    colorCircles: (root: HTMLElement) => void;
  },
) {
  const ref = useRef<HTMLDivElement>(null);
  const svgHTML = fretboardSVG();
  useEffect(() => {
    if (ref.current) colorCircles(ref.current);
  }, []);
  return (
    <div
      ref={ref}
      // deno-lint-ignore react-no-danger
      dangerouslySetInnerHTML={{ __html: svgHTML }}
    />
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

      <h2>Structural Components</h2>
      <Section title='ModeTopBar'>
        <ModeTopBar title='Semitone Math' />
      </Section>
      <Section title='StartButton + Session Summary'>
        <StartButton summary='8 questions in 60 seconds' />
      </Section>
      <Section title='Recommendation'>
        <Recommendation
          text='Suggestion: solidify +1 to +3 — 3 slow items'
          onApply={() => {}}
        />
      </Section>
      <Section title='SessionInfo'>
        <SessionInfo context='Natural notes, A string' count='5 of 12' />
      </Section>
      <Section title='QuizSession (header)'>
        <QuizSession
          timeLeft='42s'
          context='Natural notes'
          count='5 of 12'
          fluent={6}
          total={14}
          isWarning={false}
        />
      </Section>
      <Section title='QuizArea'>
        <QuizArea prompt='C + 5 = ?' lastQuestion=''>
          <NoteButtons />
          <FeedbackDisplay text='' className='feedback' />
        </QuizArea>
      </Section>
      <Section title='RoundComplete'>
        <RoundComplete
          context='Round 1 complete'
          heading='Great job!'
          correct='8 correct (80%)'
          median='Median: 425ms'
        />
      </Section>
      <Section title='PracticeCard (no scope)'>
        <PracticeCard
          statusLabel='Overall: Strong'
          statusDetail='12 of 14 fluent'
          recommendation='Suggestion: start A string — 5 new items'
          sessionSummary='8 questions in 60 seconds'
          onApplyRecommendation={() => {}}
        />
      </Section>
      <Section title='PracticeCard (with scope toggles)'>
        <PracticeCard
          statusLabel='Strings: E, A'
          statusDetail='24 of 26 fluent'
          recommendation='Suggestion: start D string'
          sessionSummary='12 questions in 60 seconds'
          onApplyRecommendation={() => {}}
          scope={
            <>
              <StringToggles
                stringNames={['E', 'A', 'D', 'G', 'B', 'e']}
                active={new Set([0, 1])}
                recommended={2}
                onToggle={() => {}}
              />
              <NoteFilter mode='natural' onChange={() => {}} />
            </>
          }
        />
      </Section>
      <Section title='TabbedIdle'>
        <TabbedIdle
          activeTab='practice'
          onTabSwitch={() => {}}
          practiceContent={
            <PracticeCard
              statusLabel='Ready to start'
              sessionSummary='8 questions in 60 seconds'
            />
          }
          progressContent={
            <div>
              <StatsToggle active='retention' onToggle={() => {}} />
              <StatsGrid
                selector={sel}
                colLabels={['+1', '+2', '+3']}
                getItemId={(name, ci) => `${name}+${ci + 1}`}
                statsMode='retention'
              />
            </div>
          }
        />
      </Section>
      <Section title='ModeScreen (idle, composed)'>
        <ModeScreen id='preview-demo' phase='idle'>
          <ModeTopBar title='Demo Mode' />
          <TabbedIdle
            activeTab='practice'
            onTabSwitch={() => {}}
            practiceContent={
              <PracticeCard
                statusLabel='Overall: Good'
                statusDetail='8 of 12 fluent'
                sessionSummary='8 questions in 60 seconds'
              />
            }
            progressContent={
              <StatsGrid
                selector={sel}
                colLabels={['+1', '+2']}
                getItemId={(name, ci) => `${name}+${ci + 1}`}
                statsMode='retention'
              />
            }
          />
        </ModeScreen>
      </Section>

      <h2>Fretboard</h2>
      <Section title='Fretboard — Quiz Active'>
        <FretboardPreview
          colorCircles={(root) => {
            const set = (s: number, f: number, fill: string) => {
              const c = root.querySelector(
                `circle.fb-pos[data-string="${s}"][data-fret="${f}"]`,
              ) as SVGElement | null;
              if (c) c.style.fill = fill;
            };
            set(5, 3, 'hsl(50, 100%, 50%)');
            set(4, 5, 'hsl(122, 46%, 33%)');
          }}
        />
      </Section>
      <Section title='Fretboard — Progress Heatmap'>
        <FretboardPreview
          colorCircles={(root) => {
            // Mock mastery: strings E(5), A(4), D(3) have varied levels;
            // G(2), B(1), e(0) are unseen.
            const mastery: Array<[number, number, string]> = [
              // String E (5) — mostly solid/automatic
              [5, 0, 'hsl(122, 46%, 33%)'],
              [5, 1, 'hsl(90, 38%, 38%)'],
              [5, 2, 'hsl(122, 46%, 33%)'],
              [5, 3, 'hsl(90, 38%, 38%)'],
              [5, 5, 'hsl(122, 46%, 33%)'],
              [5, 7, 'hsl(68, 30%, 46%)'],
              [5, 8, 'hsl(90, 38%, 38%)'],
              [5, 9, 'hsl(122, 46%, 33%)'],
              [5, 10, 'hsl(68, 30%, 46%)'],
              [5, 12, 'hsl(90, 38%, 38%)'],
              // String A (4) — mixed
              [4, 0, 'hsl(90, 38%, 38%)'],
              [4, 2, 'hsl(68, 30%, 46%)'],
              [4, 3, 'hsl(122, 46%, 33%)'],
              [4, 5, 'hsl(54, 45%, 52%)'],
              [4, 7, 'hsl(68, 30%, 46%)'],
              [4, 8, 'hsl(44, 65%, 58%)'],
              [4, 9, 'hsl(54, 45%, 52%)'],
              [4, 10, 'hsl(90, 38%, 38%)'],
              [4, 12, 'hsl(68, 30%, 46%)'],
              // String D (3) — needs work / fading
              [3, 0, 'hsl(68, 30%, 46%)'],
              [3, 2, 'hsl(44, 65%, 58%)'],
              [3, 3, 'hsl(54, 45%, 52%)'],
              [3, 5, 'hsl(44, 65%, 58%)'],
              [3, 7, 'hsl(54, 45%, 52%)'],
              [3, 8, 'hsl(44, 65%, 58%)'],
              [3, 10, 'hsl(68, 30%, 46%)'],
              [3, 12, 'hsl(44, 65%, 58%)'],
            ];
            for (const [s, f, fill] of mastery) {
              const c = root.querySelector(
                `circle.fb-pos[data-string="${s}"][data-fret="${f}"]`,
              ) as SVGElement | null;
              if (c) c.style.fill = fill;
            }
          }}
        />
      </Section>
    </div>
  );
}

const root = document.getElementById('preview-root');
if (root) render(<PreviewApp />, root);
