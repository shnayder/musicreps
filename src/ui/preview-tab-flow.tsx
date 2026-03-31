// Full Flow tab — condensed app journey showing all color roles at once.

import {
  feedbackCorrect,
  feedbackWrong,
  goodRound,
} from '../fixtures/index.ts';
import { NoteButtons } from './buttons.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid, StatsLegend } from './stats.tsx';
import { GroupProgressToggles } from './scope.tsx';
import { FeedbackDisplay } from './quiz-ui.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
  Tabs,
} from './mode-screen.tsx';
import { SkillCard } from './home-screen.tsx';
import {
  FretboardPreview,
  type GroupSel,
  PreviewModeScreen,
  Section,
} from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local sub-sections
// ---------------------------------------------------------------------------

function FlowIdleSection(
  { sel, groupSel, tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <>
      <Section title='Home — Skill Card' tabId={tabId}>
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

      <Section title='Idle — Practice + Recommendation' tabId={tabId}>
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
    </>
  );
}

function FlowQuizStates({ tabId }: { tabId: string }) {
  return (
    <>
      <Section title='Active Quiz — Awaiting Answer' tabId={tabId}>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:42'
            timerPct={70}
            count='5'
            isWarning={false}
          />
          <QuizArea prompt='C + 5' controls={<NoteButtons />} />
        </PreviewModeScreen>
      </Section>

      <Section title='Active Quiz — Correct' tabId={tabId}>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:38'
            timerPct={63}
            count='6'
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

      <Section title='Active Quiz — Wrong' tabId={tabId}>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:31'
            timerPct={52}
            count='7'
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

      <Section title='Active Quiz — Timer Warning' tabId={tabId}>
        <PreviewModeScreen phase='active'>
          <QuizSession
            timeLeft='0:08'
            timerPct={13}
            count='11'
            isWarning
          />
          <QuizArea prompt='G - 2' controls={<NoteButtons />} />
        </PreviewModeScreen>
      </Section>
    </>
  );
}

function FlowResultsSection(
  { sel, tabId }: { sel: StatsSelector; tabId: string },
) {
  return (
    <>
      <Section title='Round Complete' tabId={tabId}>
        <PreviewModeScreen phase='round-complete'>
          <QuizArea controls={<RoundCompleteActions />}>
            <RoundCompleteInfo
              heading={goodRound.heading}
              count={18}
              correct={goodRound.correct}
              progressColors={[
                'hsl(125, 48%, 33%)',
                'hsl(80, 35%, 40%)',
                'hsl(48, 50%, 52%)',
                'hsl(40, 60%, 58%)',
              ]}
            />
          </QuizArea>
        </PreviewModeScreen>
      </Section>

      <Section title='Progress Heatmap' tabId={tabId}>
        <StatsGrid
          selector={sel}
          colLabels={['+1', '+2', '+3', '+4', '+5', '+6']}
          getItemId={(name, ci) => `${name}+${ci + 1}`}
        />
        <StatsLegend />
      </Section>

      <Section title='Fretboard — Progress Heatmap' tabId={tabId}>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function FlowTab(
  { sel, groupSel, tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <div style={{ maxWidth: '560px' }}>
      <p class='tab-description'>
        Full app journey — every color role visible at once. Change a{' '}
        <code>--hue-*</code>{' '}
        value and reload to see the effect across all states.
      </p>
      <FlowIdleSection sel={sel} groupSel={groupSel} tabId={tabId} />
      <FlowQuizStates tabId={tabId} />
      <FlowResultsSection sel={sel} tabId={tabId} />
    </div>
  );
}
