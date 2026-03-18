// Screen Structure tab — quiz flow and idle screen layout components.

import { goodRound, roughRound } from '../fixtures/index.ts';
import { NoteButtons } from './buttons.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid } from './stats.tsx';
import { GroupProgressToggles } from './scope.tsx';
import { FeedbackDisplay } from './quiz-ui.tsx';
import {
  ModeScreen,
  ModeTopBar,
  PracticeCard,
  QuizArea,
  Recommendation,
  RoundCompleteActions,
  RoundCompleteInfo,
  StartButton,
  Tabs,
} from './mode-screen.tsx';
import { type GroupSel, PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local helpers
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

function IdleBasicComponents(
  { groupSel }: { groupSel: GroupSel },
) {
  return (
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
    </PreviewGrid>
  );
}

function IdleComposedComponents(
  { sel }: { sel: StatsSelector },
) {
  return (
    <PreviewGrid>
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
  );
}

function IdleScreenComponents(
  { sel, groupSel }: { sel: StatsSelector; groupSel: GroupSel },
) {
  return (
    <>
      <h2>Idle Screen</h2>
      <IdleBasicComponents groupSel={groupSel} />
      <IdleComposedComponents sel={sel} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function StructureTab(
  { sel, groupSel, tabId: _tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <div>
      <QuizFlowComponents />
      <IdleScreenComponents sel={sel} groupSel={groupSel} />
    </div>
  );
}
