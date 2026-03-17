// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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
  GroupProgressBar,
  GroupProgressToggles,
  GroupToggles,
  NoteFilter,
  NotesToggles,
  StringToggles,
} from './scope.tsx';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';
import {
  CloseButton,
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
  Tabs,
} from './mode-screen.tsx';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import {
  SegmentedControl,
  SettingToggle,
  SkillCard,
  SkillCardHeader,
  TrackPill,
  TrackSection,
} from './home-screen.tsx';

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

function PreviewGrid({ children }: { children: ComponentChildren }) {
  return <div class='preview-grid'>{children}</div>;
}

// ---------------------------------------------------------------------------
// Fretboard preview helpers
// ---------------------------------------------------------------------------

/** Fretboard SVG rendered via dangerouslySetInnerHTML with post-render coloring. */
function FretboardPreview(
  { colorCircles }: { colorCircles: (root: HTMLElement) => void },
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
// Shared types
// ---------------------------------------------------------------------------

type GroupSel = {
  getSpeedScore: (id: string) => number | null;
  getFreshness: (id: string) => number | null;
};

// ---------------------------------------------------------------------------
// PreviewModeScreen — forces phase class and layout for quiz state previews
// ---------------------------------------------------------------------------

/** Wrapper that forces mode-screen visibility and constrains height for preview. */
function PreviewModeScreen(
  { phase, children }: { phase: string; children: ComponentChildren },
) {
  return (
    <div
      class={`mode-screen phase-${phase}`}
      style={{ display: 'block', minHeight: 0, margin: 0, padding: 0 }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Flow tab — condensed app journey showing all color roles at once
// ---------------------------------------------------------------------------

function FlowTab(
  { sel, groupSel }: { sel: StatsSelector; groupSel: GroupSel },
) {
  return (
    <div style={{ maxWidth: '560px' }}>
      <p class='tab-description'>
        Full app journey — every color role visible at once. Change a{' '}
        <code>--hue-*</code>{' '}
        value and reload to see the effect across all states.
      </p>
      <Section title='Home — Skill Card'>
        <SkillCard
          modeId='semitoneMath'
          trackId='core'
          isStarred={false}
          onToggleStar={() => {}}
          onSelectMode={() => {}}
          progress={{
            groupColors: [
              'hsl(125, 48%, 33%)',
              'hsl(80, 35%, 40%)',
              'hsl(48, 50%, 52%)',
              'hsl(40, 60%, 58%)',
              'hsl(30, 4%, 85%)',
            ],
          }}
        />
      </Section>

      <Section title='Idle — Practice + Recommendation'>
        <ModeTopBar
          modeId='semitoneMath'
          title='Semitone Math'
          description='Transpose by semitones without counting'
        />
        <Tabs
          activeTab='practice'
          onTabSwitch={() => {}}
          tabs={[
            {
              id: 'practice',
              label: 'Practice',
              content: (
                <PracticeCard
                  statusLabel='Learning'
                  statusDetail='8 of 24 automatic'
                  recommendation='start ±3–4 — 12 new items'
                  onApplyRecommendation={() => {}}
                  scope={
                    <GroupProgressToggles
                      groups={[
                        { label: '±1–2', itemIds: ['C+1', 'C+2', 'C+3'] },
                        { label: '±3–4', itemIds: ['C+4', 'C+5', 'C+6'] },
                        { label: '±5–6', itemIds: ['D+1', 'D+2', 'D+3'] },
                      ]}
                      active={new Set([0, 1])}
                      onToggle={() => {}}
                      selector={groupSel}
                      onSkip={() => {}}
                      onUnskip={() => {}}
                    />
                  }
                />
              ),
            },
            {
              id: 'progress',
              label: 'Progress',
              content: (
                <StatsGrid
                  selector={sel}
                  colLabels={['+1', '+2', '+3']}
                  getItemId={(name, ci) => `${name}+${ci + 1}`}
                />
              ),
            },
          ]}
        />
      </Section>

      <Section title='Active Quiz — Awaiting Answer'>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:42'
            timerPct={70}
            context='±1–2 semitones'
            count='5 answers'
            isWarning={false}
          />
          <QuizArea prompt='C + 5' controls={<NoteButtons />} />
        </PreviewModeScreen>
      </Section>

      <Section title='Active Quiz — Correct'>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:38'
            timerPct={63}
            context='±1–2 semitones'
            count='6 answers'
            isWarning={false}
          />
          <QuizArea
            prompt='C + 5'
            controls={
              <>
                <NoteButtons
                  feedback={{
                    correct: true,
                    userInput: 'F',
                    displayAnswer: 'F',
                  }}
                />
                <FeedbackDisplay
                  text={feedbackCorrect.text}
                  className={feedbackCorrect.className}
                  correct={feedbackCorrect.correct}
                  onNext={() => {}}
                />
              </>
            }
          />
        </PreviewModeScreen>
      </Section>

      <Section title='Active Quiz — Wrong'>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:31'
            timerPct={52}
            context='±1–2 semitones'
            count='7 answers'
            isWarning={false}
          />
          <QuizArea
            prompt='D + 3'
            controls={
              <>
                <NoteButtons
                  feedback={{
                    correct: false,
                    userInput: 'F#',
                    displayAnswer: 'F',
                  }}
                />
                <FeedbackDisplay
                  text={feedbackWrong.text}
                  className={feedbackWrong.className}
                  hint={feedbackWrong.hint}
                  correct={feedbackWrong.correct}
                  onNext={() => {}}
                />
              </>
            }
          />
        </PreviewModeScreen>
      </Section>

      <Section title='Active Quiz — Timer Warning'>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:08'
            timerPct={13}
            context='±1–2 semitones'
            count='11 answers'
            isWarning
          />
          <QuizArea prompt='G - 2' controls={<NoteButtons />} />
        </PreviewModeScreen>
      </Section>

      <Section title='Round Complete'>
        <PreviewModeScreen phase='round-complete'>
          <QuizArea controls={<RoundCompleteActions />}>
            <RoundCompleteInfo
              context={goodRound.context}
              heading={goodRound.heading}
              count={18}
              correct={goodRound.correct}
            />
          </QuizArea>
        </PreviewModeScreen>
      </Section>

      <Section title='Progress Heatmap'>
        <StatsGrid
          selector={sel}
          colLabels={['+1', '+2', '+3', '+4', '+5', '+6']}
          getItemId={(name, ci) => `${name}+${ci + 1}`}
        />
        <StatsLegend />
      </Section>

      <Section title='Fretboard — Progress Heatmap'>
        <FretboardPreview
          colorCircles={(root) => {
            const mastery: Array<[number, number, string]> = [
              [5, 0, 'hsl(125, 48%, 33%)'],
              [5, 1, 'hsl(80, 35%, 40%)'],
              [5, 2, 'hsl(125, 48%, 33%)'],
              [5, 3, 'hsl(80, 35%, 40%)'],
              [5, 5, 'hsl(125, 48%, 33%)'],
              [5, 7, 'hsl(60, 40%, 46%)'],
              [5, 8, 'hsl(80, 35%, 40%)'],
              [5, 9, 'hsl(125, 48%, 33%)'],
              [4, 0, 'hsl(80, 35%, 40%)'],
              [4, 2, 'hsl(60, 40%, 46%)'],
              [4, 3, 'hsl(125, 48%, 33%)'],
              [4, 5, 'hsl(48, 50%, 52%)'],
              [4, 7, 'hsl(60, 40%, 46%)'],
              [4, 8, 'hsl(40, 60%, 58%)'],
              [3, 0, 'hsl(60, 40%, 46%)'],
              [3, 2, 'hsl(40, 60%, 58%)'],
              [3, 3, 'hsl(48, 50%, 52%)'],
              [3, 5, 'hsl(40, 60%, 58%)'],
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

// ---------------------------------------------------------------------------
// Answer Buttons tab
// ---------------------------------------------------------------------------

function ButtonsTab() {
  return (
    <PreviewGrid>
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
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Quiz UI tab
// ---------------------------------------------------------------------------

function QuizUITab() {
  return (
    <>
      <h2>Prompts & Feedback</h2>
      <PreviewGrid>
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
      </PreviewGrid>
      <h2>Session Header & Timer</h2>
      <PreviewGrid>
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
        <Section title='Countdown Bar (mid-round)'>
          <CountdownBar pct={timerMidRound.pct} />
        </Section>
        <Section title='Countdown Bar — Warning'>
          <CountdownBar pct={timerWarning.pct} warning />
        </Section>
        <Section title='Countdown Bar — Last Question'>
          <CountdownBar pct={50} lastQuestion />
        </Section>
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Scope & Stats tab
// ---------------------------------------------------------------------------

function StatsSection({ sel }: { sel: StatsSelector }) {
  return (
    <>
      <h2>Stats</h2>
      <PreviewGrid>
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
      </PreviewGrid>
    </>
  );
}

function ScopeSection({ groupSel }: { groupSel: GroupSel }) {
  return (
    <>
      <h2>Scope Controls</h2>
      <PreviewGrid>
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
        <Section title='GroupProgressBar'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <GroupProgressBar
              colors={['#4caf50', '#4caf50', '#ff9800', '#9e9e9e', '#9e9e9e']}
            />
            <GroupProgressBar
              colors={['#4caf50', '#4caf50', '#ff9800', '#9e9e9e', '#9e9e9e']}
              disabled
            />
          </div>
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
      </PreviewGrid>
    </>
  );
}

function ScopeStatsTab(
  { sel, groupSel }: { sel: StatsSelector; groupSel: GroupSel },
) {
  return (
    <div>
      <StatsSection sel={sel} />
      <ScopeSection groupSel={groupSel} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen Structure tab
// ---------------------------------------------------------------------------

function QuizFlowComponents() {
  return (
    <>
      <h2>Quiz Flow</h2>
      <PreviewGrid>
        <Section title='StartButton'>
          <StartButton />
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
      </PreviewGrid>
    </>
  );
}

function IdleScreenComponents(
  { sel, groupSel }: { sel: StatsSelector; groupSel: GroupSel },
) {
  return (
    <>
      <h2>Idle Screen</h2>
      <PreviewGrid>
        <Section title='ModeTopBar'>
          <ModeTopBar title='Semitone Math' />
        </Section>
        <Section title='ModeTopBar — with description'>
          <ModeTopBar
            title='Semitone Math'
            description='Transpose by semitones without counting'
          />
        </Section>
        <Section title='Recommendation'>
          <Recommendation
            text='solidify +1 to +3 — 3 items to work on'
            onApply={() => {}}
          />
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
        <Section title='Tabs'>
          <Tabs
            activeTab='practice'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <PracticeCard statusLabel='Ready to start' />,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: (
                  <StatsGrid
                    selector={sel}
                    colLabels={['+1', '+2', '+3']}
                    getItemId={(name, ci) => `${name}+${ci + 1}`}
                  />
                ),
              },
            ]}
          />
        </Section>
        <Section title='ModeScreen (idle, composed)'>
          <ModeScreen id='preview-demo' phase='idle'>
            <ModeTopBar
              title='Demo Mode'
              description='Practice skill X until it becomes automatic'
            />
            <Tabs
              activeTab='practice'
              onTabSwitch={() => {}}
              tabs={[
                {
                  id: 'practice',
                  label: 'Practice',
                  content: (
                    <PracticeCard
                      statusLabel='Solid'
                      statusDetail='8 of 12 automatic'
                    />
                  ),
                },
                {
                  id: 'progress',
                  label: 'Progress',
                  content: (
                    <StatsGrid
                      selector={sel}
                      colLabels={['+1', '+2']}
                      getItemId={(name, ci) => `${name}+${ci + 1}`}
                    />
                  ),
                },
              ]}
            />
          </ModeScreen>
        </Section>
      </PreviewGrid>
    </>
  );
}

function StructureTab(
  { sel, groupSel }: { sel: StatsSelector; groupSel: GroupSel },
) {
  return (
    <div>
      <QuizFlowComponents />
      <IdleScreenComponents sel={sel} groupSel={groupSel} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design System tab — helpers
// ---------------------------------------------------------------------------

/** Read a CSS custom property value from :root. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
    .trim();
}

function CloseButtonSection() {
  return (
    <>
      <h2>Close Button</h2>
      <PreviewGrid>
        <Section title='CloseButton'>
          <CloseButton ariaLabel='Close' onClick={() => {}} />
        </Section>
      </PreviewGrid>
    </>
  );
}

function SkillCardHeaderSection() {
  return (
    <>
      <h2>Skill Card Header</h2>
      <PreviewGrid>
        <Section title='SkillCardHeader — no pill'>
          <SkillCardHeader modeId='semitoneMath' />
        </Section>
        <Section title='SkillCardHeader — with pill'>
          <SkillCardHeader
            modeId='semitoneMath'
            trackId='core'
            trackLabel='Core'
          />
        </Section>
        <Section title='TrackPill variants'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <TrackPill trackId='core' label='Core' />
            <TrackPill trackId='reading' label='Reading' />
            <TrackPill trackId='guitar' label='Guitar' />
            <TrackPill trackId='ukulele' label='Ukulele' />
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

function TrackSectionPreview() {
  return (
    <>
      <h2>Track Section</h2>
      <PreviewGrid>
        <Section title='TrackSection — expanded'>
          <TrackSection
            trackId='core'
            label='Core'
            isExpanded
            onToggle={() => {}}
          >
            <div style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
              Skills go here
            </div>
          </TrackSection>
        </Section>
        <Section title='TrackSection — collapsed'>
          <TrackSection
            trackId='guitar'
            label='Guitar'
            isExpanded={false}
            onToggle={() => {}}
          >
            <div style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
              Skills go here
            </div>
          </TrackSection>
        </Section>
        <Section title='All track colors'>
          <div>
            {(['core', 'reading', 'guitar', 'ukulele'] as const).map((id) => (
              <TrackSection
                key={id}
                trackId={id}
                label={id.charAt(0).toUpperCase() + id.slice(1)}
                isExpanded={false}
                onToggle={() => {}}
              >
                {''}
              </TrackSection>
            ))}
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

function SegmentedControlSection() {
  const [val1, setVal1] = useState<'letter' | 'solfege'>('letter');
  const [val2, setVal2] = useState<'letter' | 'solfege'>('solfege');
  const noteOptions = [
    { value: 'letter' as const, label: 'A B C' },
    { value: 'solfege' as const, label: 'Do Re Mi' },
  ];
  return (
    <>
      <h2>Segmented Control</h2>
      <PreviewGrid>
        <Section title='SegmentedControl — first selected'>
          <SegmentedControl
            options={noteOptions}
            value={val1}
            onChange={setVal1}
          />
        </Section>
        <Section title='SegmentedControl — second selected'>
          <SegmentedControl
            options={noteOptions}
            value={val2}
            onChange={setVal2}
          />
        </Section>
        <Section title='SettingToggle — with label'>
          <SettingToggle
            label='Note names'
            options={noteOptions}
            value={val1}
            onChange={setVal1}
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function TabsSection() {
  return (
    <>
      <h2>Tabs</h2>
      <PreviewGrid>
        <Section title='2 tabs — first active'>
          <Tabs
            activeTab='practice'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
            ]}
          />
        </Section>
        <Section title='2 tabs — second active'>
          <Tabs
            activeTab='progress'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
            ]}
          />
        </Section>
        <Section title='3 tabs'>
          <Tabs
            activeTab='about'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
              {
                id: 'about',
                label: 'About',
                content: <div>About content</div>,
              },
            ]}
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function ActionButtonsSection() {
  return (
    <>
      <h2>Action Buttons</h2>
      <PreviewGrid>
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
        <Section title='ActionButton — Pair (round-complete)'>
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
      </PreviewGrid>
    </>
  );
}

function TypographySection() {
  return (
    <>
      <h2>Typography</h2>
      <PreviewGrid>
        <Section title='Text roles'>
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
        <Section title='Text roles — in context (metric display)'>
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
      </PreviewGrid>
    </>
  );
}

const SPACE_TOKENS: Array<{ name: string; desc: string }> = [
  { name: '--space-1', desc: 'Toggle gaps, pixel-level' },
  { name: '--space-2', desc: 'Button grid gaps, tight padding' },
  { name: '--space-3', desc: 'Standard gap, small padding' },
  { name: '--space-4', desc: 'Section gaps, nav padding' },
  { name: '--space-5', desc: 'Body padding, section spacing' },
  { name: '--space-6', desc: 'Large section gaps' },
];

function SpacingSection() {
  return (
    <>
      <h2>Spacing Scale</h2>
      <PreviewGrid>
        <Section title='Spacing tokens'>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
          >
            {SPACE_TOKENS.map(({ name, desc }) => {
              const val = cssVar(name);
              const px = parseFloat(val) * 16;
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  <code
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '6.5rem',
                      color: 'var(--color-text-light)',
                      flexShrink: 0,
                    }}
                  >
                    {name}
                  </code>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '2.5rem',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}
                  >
                    {val}
                  </span>
                  <div
                    style={{
                      height: '14px',
                      width: `${Math.max(px * 3, 4)}px`,
                      background: 'var(--color-brand)',
                      opacity: 0.65,
                      borderRadius: '2px',
                    }}
                  />
                  <Text role='caption'>{desc}</Text>
                </div>
              );
            })}
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

const TYPE_TOKENS: Array<{ name: string; usage: string }> = [
  { name: '--text-xs', usage: 'Legend labels, tiny annotations' },
  { name: '--text-sm', usage: 'Session stats, settings, table text' },
  { name: '--text-base', usage: 'Body, buttons, nav items' },
  { name: '--text-md', usage: 'Answer buttons, note buttons' },
  { name: '--text-lg', usage: 'Mode title, answer count' },
  { name: '--text-xl', usage: 'Feedback, close buttons' },
  { name: '--text-2xl', usage: 'Home title, quiz prompts' },
];

function TypeScaleSection() {
  return (
    <>
      <h2>Type Scale</h2>
      <PreviewGrid>
        <Section title='Size tokens'>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TYPE_TOKENS.map(({ name, usage }) => {
              const val = cssVar(name);
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.6rem',
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--color-border-lighter)',
                  }}
                >
                  <code
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '6.5rem',
                      color: 'var(--color-text-light)',
                      flexShrink: 0,
                    }}
                  >
                    {name}
                  </code>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '2.5rem',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}
                  >
                    {val}
                  </span>
                  <span style={{ fontSize: val }}>Ag 0–9 C#</span>
                  <Text role='caption' as='span' style={{ marginLeft: 'auto' }}>
                    {usage}
                  </Text>
                </div>
              );
            })}
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

const RADIUS_TOKENS: Array<{ name: string; usage: string }> = [
  { name: '--radius-sm', usage: 'Toggles, cells, bars, small btns' },
  { name: '--radius-md', usage: 'Cards, answer btns, CTAs, progress' },
  { name: '--radius-lg', usage: 'Settings modal' },
];

function RadiusShadowSection() {
  return (
    <>
      <h2>Border Radius & Shadows</h2>
      <PreviewGrid>
        <Section title='Radius tokens'>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {RADIUS_TOKENS.map(({ name, usage }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '48px',
                    border: '2px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    borderRadius: `var(${name})`,
                  }}
                />
                <code
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--color-text-light)',
                  }}
                >
                  {name}
                </code>
                <Text role='caption' as='span'>{cssVar(name)}</Text>
                <Text
                  role='caption'
                  as='span'
                  style={{ textAlign: 'center', maxWidth: '80px' }}
                >
                  {usage}
                </Text>
              </div>
            ))}
          </div>
        </Section>
        <Section title='Shadow / elevation'>
          <div
            style={{
              display: 'flex',
              gap: '1.25rem',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '60px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text role='caption'>Flat</Text>
              </div>
              <Text role='caption'>Cards, tables</Text>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '60px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text role='caption'>Low</Text>
              </div>
              <Text role='caption'>CTA button</Text>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '60px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text role='caption'>High</Text>
              </div>
              <Text role='caption'>Modal, drawer</Text>
            </div>
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Design System tab
// ---------------------------------------------------------------------------

function DesignSystemTab() {
  return (
    <div>
      <CloseButtonSection />
      <SkillCardHeaderSection />
      <TrackSectionPreview />
      <SegmentedControlSection />
      <TabsSection />
      <ActionButtonsSection />
      <TypographySection />
      <SpacingSection />
      <TypeScaleSection />
      <RadiusShadowSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fretboard tab
// ---------------------------------------------------------------------------

function FretboardTab() {
  return (
    <PreviewGrid>
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
            const mastery: Array<[number, number, string]> = [
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
              [4, 0, 'hsl(80, 35%, 40%)'],
              [4, 2, 'hsl(60, 40%, 46%)'],
              [4, 3, 'hsl(125, 48%, 33%)'],
              [4, 5, 'hsl(48, 50%, 52%)'],
              [4, 7, 'hsl(60, 40%, 46%)'],
              [4, 8, 'hsl(40, 60%, 58%)'],
              [4, 9, 'hsl(48, 50%, 52%)'],
              [4, 10, 'hsl(80, 35%, 40%)'],
              [4, 12, 'hsl(60, 40%, 46%)'],
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
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Tab navigation + PreviewApp
// ---------------------------------------------------------------------------

const TABS = [
  'flow',
  'buttons',
  'quiz-ui',
  'scope-stats',
  'structure',
  'design-system',
  'fretboard',
] as const;

type PreviewTab = typeof TABS[number];

const TAB_LABELS: Record<PreviewTab, string> = {
  'flow': 'Full Flow',
  'buttons': 'Answer Buttons',
  'quiz-ui': 'Quiz UI',
  'scope-stats': 'Scope & Stats',
  'structure': 'Screen Structure',
  'design-system': 'Design System',
  'fretboard': 'Fretboard',
};

const STORAGE_KEY = 'preview_active_tab';

function loadSavedTab(): PreviewTab {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (TABS as readonly string[]).includes(saved)) {
      return saved as PreviewTab;
    }
  } catch { /* ignore */ }
  return 'flow';
}

function PreviewApp() {
  const [activeTab, setActiveTab] = useState<PreviewTab>(loadSavedTab);

  const sel = mockSelector();
  const groupSel: GroupSel = {
    getSpeedScore: sel.getSpeedScore,
    getFreshness: sel.getFreshness,
  };

  function switchTab(tab: PreviewTab) {
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch { /* ignore */ }
  }

  return (
    <div>
      <h1>Component Preview</h1>
      <div class='subtitle'>
        Preact components with mock data — edit{' '}
        <code>src/ui/preview.tsx</code>, rebuild or refresh{' '}
        <code>/preview</code>.
      </div>
      <div class='page-nav'>
        <a href='colors.html'>Colors &rarr;</a>
      </div>
      <div class='preview-tabs'>
        {TABS.map((tab) => (
          <button
            key={tab}
            type='button'
            class={`preview-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => switchTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {activeTab === 'flow' && <FlowTab sel={sel} groupSel={groupSel} />}
      {activeTab === 'buttons' && <ButtonsTab />}
      {activeTab === 'quiz-ui' && <QuizUITab />}
      {activeTab === 'scope-stats' && (
        <ScopeStatsTab sel={sel} groupSel={groupSel} />
      )}
      {activeTab === 'structure' && (
        <StructureTab sel={sel} groupSel={groupSel} />
      )}
      {activeTab === 'design-system' && <DesignSystemTab />}
      {activeTab === 'fretboard' && <FretboardTab />}
    </div>
  );
}

const root = document.getElementById('preview-root');
if (root) render(<PreviewApp />, root);
