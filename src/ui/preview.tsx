// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { NOTES } from '../music-data.ts';
import { fretboardSVG } from '../html-helpers.ts';
import {
  feedbackCorrect,
  feedbackWrong,
  goodRound,
  roughRound,
  sessionEarlyRound,
  timerMidRound,
  timerWarning,
} from '../fixtures/index.ts';

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
import { StatsGrid, StatsLegend, StatsTable } from './stats.tsx';
import {
  GroupProgressToggles,
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
  RoundCompleteActions,
  RoundCompleteInfo,
  SessionInfo,
  StartButton,
  TabbedIdle,
} from './mode-screen.tsx';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';

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
    getSpeedScore(id: string) {
      return lookup[id] ?? null;
    },
    getFreshness(id: string) {
      // Simulate varying freshness: items with data get 0.3–1.0
      const speed = lookup[id];
      if (speed == null) return null;
      return 0.3 + speed * 0.7;
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
  // Narrow selector for GroupProgressToggles (requires non-optional methods).
  const groupSel = {
    getSpeedScore: sel.getSpeedScore,
    getFreshness: sel.getFreshness,
  };

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
      <Section title='Progress Heatmap (StatsGrid)'>
        <StatsGrid
          selector={sel}
          colLabels={['+1', '+2', '+3', '+4', '+5', '+6']}
          getItemId={(name, ci) => `${name}+${ci + 1}`}
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
        />
      </Section>
      <Section title='Stats Legend'>
        <StatsLegend />
      </Section>

      <h2>Scope Controls</h2>
      <Section title='Group Toggles'>
        <GroupToggles
          labels={['+1 to +3', '+4 to +6', '+7 to +9', '+10 to +11']}
          active={new Set([0, 1])}
          onToggle={() => {}}
        />
      </Section>
      <Section title='String Toggles'>
        <StringToggles
          stringNames={['E', 'A', 'D', 'G', 'B', 'e']}
          active={new Set([0, 1, 2])}
          onToggle={() => {}}
        />
      </Section>
      <Section title='GroupProgressToggles (active groups)'>
        <GroupProgressToggles
          groups={[
            { label: '1–3', itemIds: ['C+1', 'C+2', 'C+3'] },
            { label: '4–6', itemIds: ['C+4', 'C+5', 'C+6'] },
            { label: '7–9', itemIds: ['D+1', 'D+2', 'D+3'] },
          ]}
          active={new Set([0, 1])}
          onToggle={() => {}}
          selector={groupSel}
          onSkip={() => {}}
          onUnskip={() => {}}
        />
      </Section>
      <Section title='GroupProgressToggles (with skipped)'>
        <GroupProgressToggles
          groups={[
            { label: '1–3', itemIds: ['C+1', 'C+2', 'C+3'] },
            { label: '4–6', itemIds: ['C+4', 'C+5', 'C+6'] },
            { label: '7–9', itemIds: ['D+1', 'D+2', 'D+3'] },
          ]}
          active={new Set([0])}
          onToggle={() => {}}
          selector={groupSel}
          skipped={new Map([[1, 'mastered'], [2, 'deferred']]) as ReadonlyMap<
            number,
            'mastered' | 'deferred'
          >}
          onSkip={() => {}}
          onUnskip={() => {}}
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
        <TextPrompt text='C + 5' />
      </Section>
      <Section title='Feedback — Correct'>
        <FeedbackDisplay
          text={feedbackCorrect.text}
          className={feedbackCorrect.className}
          correct={feedbackCorrect.correct}
          onNext={() => {}}
        />
      </Section>
      <Section title='Feedback — Incorrect'>
        <FeedbackDisplay
          text={feedbackWrong.text}
          className={feedbackWrong.className}
          hint={feedbackWrong.hint}
          correct={feedbackWrong.correct}
          onNext={() => {}}
        />
      </Section>
      <Section title='Countdown Bar (mid-round)'>
        <CountdownBar pct={timerMidRound.pct} />
      </Section>
      <Section title='Countdown Bar — Warning'>
        <CountdownBar pct={timerWarning.pct} warning />
      </Section>
      <Section title='Countdown Bar — Last Question'>
        <CountdownBar pct={50} lastQuestion />
      </Section>

      <h2>Structural Components</h2>
      <Section title='ModeTopBar'>
        <ModeTopBar title='Semitone Math' />
      </Section>
      <Section title='ModeTopBar — with description'>
        <ModeTopBar
          title='Semitone Math'
          description='Transpose by semitones without counting'
        />
      </Section>
      <Section title='ModeTopBar — with before/after'>
        <ModeTopBar
          title='Semitone Math'
          description='Transpose by semitones without counting'
          beforeAfter={{
            before: '\u201CF# + 4\u2026 G, G#, A, A#\u2026 Bb?\u201D',
            after: '\u201CF# + 4. Bb.\u201D',
          }}
        />
      </Section>
      <Section title='StartButton'>
        <StartButton />
      </Section>
      <Section title='Recommendation'>
        <Recommendation
          text='solidify +1 to +3 — 3 items to work on'
          onApply={() => {}}
        />
      </Section>
      <Section title='SessionInfo'>
        <SessionInfo
          context={sessionEarlyRound.context}
          count={sessionEarlyRound.count}
        />
      </Section>
      <Section title='QuizSession (header)'>
        <QuizSession
          timeLeft='42s'
          context='Natural notes'
          count='5 of 12'
          isWarning={false}
        />
      </Section>
      <Section title='QuizArea'>
        <QuizArea
          prompt='C + 5'
          controls={
            <>
              <NoteButtons />
              <FeedbackDisplay text='' className='feedback' />
            </>
          }
        />
      </Section>
      <Section title='RoundComplete — Good'>
        <QuizArea controls={<RoundCompleteActions />}>
          <RoundCompleteInfo
            context={goodRound.context}
            heading={goodRound.heading}
            count={18}
            correct={goodRound.correct}
          />
        </QuizArea>
      </Section>
      <Section title='RoundComplete — Rough'>
        <QuizArea controls={<RoundCompleteActions />}>
          <RoundCompleteInfo
            context={roughRound.context}
            heading={roughRound.heading}
            count={9}
            correct={roughRound.correct}
          />
        </QuizArea>
      </Section>
      <Section title='PracticeCard (no scope)'>
        <PracticeCard
          statusLabel='Strong'
          statusDetail='12 of 14 automatic'
          recommendation='start A string — 5 new items'
          onApplyRecommendation={() => {}}
        />
      </Section>
      <Section title='PracticeCard (with group progress toggles)'>
        <PracticeCard
          statusLabel='Solid'
          statusDetail='24 of 26 automatic'
          recommendation='solidify +4 to +6 — 3 items to work on'
          onApplyRecommendation={() => {}}
          scope={
            <GroupProgressToggles
              groups={[
                { label: '1–3', itemIds: ['C+1', 'C+2', 'C+3'] },
                { label: '4–6', itemIds: ['C+4', 'C+5', 'C+6'] },
                { label: '7–9', itemIds: ['D+1', 'D+2', 'D+3'] },
              ]}
              active={new Set([0, 1])}
              onToggle={() => {}}
              selector={groupSel}
              onSkip={() => {}}
              onUnskip={() => {}}
            />
          }
        />
      </Section>
      <Section title='TabbedIdle'>
        <TabbedIdle
          activeTab='practice'
          onTabSwitch={() => {}}
          practiceContent={<PracticeCard statusLabel='Ready to start' />}
          progressContent={
            <div>
              <StatsGrid
                selector={sel}
                colLabels={['+1', '+2', '+3']}
                getItemId={(name, ci) => `${name}+${ci + 1}`}
              />
            </div>
          }
        />
      </Section>
      <Section title='ModeScreen (idle, composed)'>
        <ModeScreen id='preview-demo' phase='idle'>
          <ModeTopBar
            title='Demo Mode'
            description='Practice skill X until it becomes automatic'
            beforeAfter={{
              before: '\u201CX\u2026 um\u2026 Y?\u201D',
              after: '\u201CX. Y.\u201D',
            }}
          />
          <TabbedIdle
            activeTab='practice'
            onTabSwitch={() => {}}
            practiceContent={
              <PracticeCard
                statusLabel='Solid'
                statusDetail='8 of 12 automatic'
              />
            }
            progressContent={
              <StatsGrid
                selector={sel}
                colLabels={['+1', '+2']}
                getItemId={(name, ci) => `${name}+${ci + 1}`}
              />
            }
          />
        </ModeScreen>
      </Section>

      <h2>Design Recipes</h2>
      <Section title='ActionButton — Primary'>
        <ActionButton variant='primary' onClick={() => {}}>
          Practice
        </ActionButton>
      </Section>
      <Section title='ActionButton — Secondary'>
        <ActionButton variant='secondary' onClick={() => {}}>
          Stop
        </ActionButton>
      </Section>
      <Section title='ActionButton — Pair (as in round-complete)'>
        <div class='page-action-row'>
          <ActionButton variant='primary' onClick={() => {}}>
            Keep Going
          </ActionButton>
          <ActionButton variant='secondary' onClick={() => {}}>
            Stop
          </ActionButton>
        </div>
      </Section>
      <Section title='ActionButton — Disabled'>
        <ActionButton variant='primary' onClick={() => {}} disabled>
          Disabled
        </ActionButton>
      </Section>
      <Section title='Text Roles'>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <Text role='section-header' as='div'>Section Header</Text>
          <Text role='subsection-header' as='div'>Subsection Header</Text>
          <Text role='label' as='div'>Label</Text>
          <div>Body text (default — no Text component needed)</div>
          <Text role='secondary' as='div'>Secondary text</Text>
          <Text role='caption' as='div'>Caption text</Text>
          <Text role='metric' as='div'>42.5s</Text>
        </div>
      </Section>
      <Section title='Text Roles — In Context (metric display)'>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          <Text role='subsection-header' as='div'>Speed check</Text>
          <div
            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}
          >
            <Text role='label'>Response time</Text>
            <Text role='metric'>0.5s</Text>
          </div>
          <Text role='caption' as='div'>
            Timing thresholds are based on this measurement.
          </Text>
        </div>
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
            set(4, 5, 'hsl(125, 48%, 33%)');
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
              [5, 0, 'hsl(125, 48%, 33%)'],
              [5, 1, 'hsl(80, 35%, 40%)'],
              [5, 2, 'hsl(125, 48%, 33%)'],
              [5, 3, 'hsl(80, 35%, 40%)'],
              [5, 5, 'hsl(125, 48%, 33%)'],
              [5, 7, 'hsl(60, 40%, 46%)'],
              [5, 8, 'hsl(80, 35%, 40%)'],
              [5, 9, 'hsl(125, 48%, 33%)'],
              [5, 10, 'hsl(60, 40%, 46%)'],
              [5, 12, 'hsl(80, 35%, 40%)'],
              // String A (4) — mixed
              [4, 0, 'hsl(80, 35%, 40%)'],
              [4, 2, 'hsl(60, 40%, 46%)'],
              [4, 3, 'hsl(125, 48%, 33%)'],
              [4, 5, 'hsl(48, 50%, 52%)'],
              [4, 7, 'hsl(60, 40%, 46%)'],
              [4, 8, 'hsl(40, 60%, 58%)'],
              [4, 9, 'hsl(48, 50%, 52%)'],
              [4, 10, 'hsl(80, 35%, 40%)'],
              [4, 12, 'hsl(60, 40%, 46%)'],
              // String D (3) — needs work / fading
              [3, 0, 'hsl(60, 40%, 46%)'],
              [3, 2, 'hsl(40, 60%, 58%)'],
              [3, 3, 'hsl(48, 50%, 52%)'],
              [3, 5, 'hsl(40, 60%, 58%)'],
              [3, 7, 'hsl(48, 50%, 52%)'],
              [3, 8, 'hsl(40, 60%, 58%)'],
              [3, 10, 'hsl(60, 40%, 46%)'],
              [3, 12, 'hsl(40, 60%, 58%)'],
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
