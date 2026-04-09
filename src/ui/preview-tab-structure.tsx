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
import { Card, Section as LayoutSection, Stack } from './layout.tsx';
import { Text } from './text.tsx';
import { type GroupSel, PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local helpers
// ---------------------------------------------------------------------------

function LayoutPrimitives({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Layout Primitives</h2>
      <PreviewGrid>
        <Section title='Stack — gap variants' tabId={tabId}>
          <Stack gap='micro'>
            <Text role='label'>micro (2px)</Text>
            <Text role='body-secondary'>Related sub-items</Text>
          </Stack>
          <hr />
          <Stack gap='related'>
            <Text role='label'>related (4px)</Text>
            <Text role='body-secondary'>Label + value pairs</Text>
          </Stack>
          <hr />
          <Stack gap='group'>
            <Text role='label'>group (12px)</Text>
            <Text role='body-secondary'>Distinct groups</Text>
          </Stack>
          <hr />
          <Stack gap='component'>
            <Text role='label'>component (16px)</Text>
            <Text role='body-secondary'>Card-internal sections</Text>
          </Stack>
        </Section>
        <Section title='Card' tabId={tabId}>
          <Card>
            <Stack gap='related'>
              <Text role='heading-subsection'>Default card</Text>
              <Text role='body'>White background, border, radius, padding</Text>
            </Stack>
          </Card>
        </Section>
        <Section title='Card — well variant' tabId={tabId}>
          <Card variant='well'>
            <Stack gap='related'>
              <Text role='heading-subsection'>Well card</Text>
              <Text role='body'>Inset background for recessed areas</Text>
            </Stack>
          </Card>
        </Section>
        <Section title='Card — accent variants' tabId={tabId}>
          <Card accent='brand'>
            <Text role='body'>Brand accent (left stripe)</Text>
          </Card>
          <div style={{ marginTop: '8px' }} />
          <Card accent='notice'>
            <Text role='body'>Notice accent (gold stripe)</Text>
          </Card>
        </Section>
        <Section title='Section (heading + content)' tabId={tabId}>
          <LayoutSection heading='Section heading'>
            <Text role='body'>
              Content follows the heading with a consistent gap.
            </Text>
          </LayoutSection>
        </Section>
      </PreviewGrid>
    </>
  );
}

function QuizFlowComponents({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Quiz Flow</h2>
      <PreviewGrid>
        <Section title='StartButton' tabId={tabId}>
          <StartButton />
        </Section>
        <Section title='QuizArea' tabId={tabId}>
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
        <Section title='RoundComplete — Good' tabId={tabId}>
          <QuizArea controls={<RoundCompleteActions />}>
            <RoundCompleteInfo
              heading={goodRound.heading}
              count={18}
              correct={goodRound.correct}
              levelBars={[
                {
                  id: 'e',
                  label: 'E strings',
                  colors: ['hsl(125, 48%, 33%)', 'hsl(125, 48%, 33%)'],
                },
                {
                  id: 'a',
                  label: 'A string',
                  colors: ['hsl(80, 35%, 40%)', 'hsl(60, 40%, 46%)'],
                },
              ]}
            />
          </QuizArea>
        </Section>
        <Section title='RoundComplete — Rough' tabId={tabId}>
          <QuizArea controls={<RoundCompleteActions />}>
            <RoundCompleteInfo
              heading={roughRound.heading}
              count={9}
              correct={roughRound.correct}
              levelBars={[
                {
                  id: 'e',
                  label: 'E strings',
                  colors: ['hsl(48, 50%, 52%)'],
                },
                {
                  id: 'a',
                  label: 'A string',
                  colors: ['hsl(40, 60%, 58%)', 'hsl(40, 60%, 58%)'],
                },
              ]}
            />
          </QuizArea>
        </Section>
      </PreviewGrid>
    </>
  );
}

function IdleBasicComponents(
  { groupSel, tabId }: { groupSel: GroupSel; tabId: string },
) {
  return (
    <PreviewGrid>
      <Section title='ModeTopBar' tabId={tabId}>
        <ModeTopBar title='Semitone Math' />
      </Section>
      <Section title='ModeTopBar — with description' tabId={tabId}>
        <ModeTopBar
          title='Semitone Math'
          description='Transpose by semitones without counting'
        />
      </Section>
      <Section title='Recommendation' tabId={tabId}>
        <Recommendation
          text='solidify +1 to +3 — 3 items to work on'
          onApply={() => {}}
        />
      </Section>
      <Section title='PracticeCard (no scope)' tabId={tabId}>
        <PracticeCard
          statusLabel='Strong'
          statusDetail='12 of 14 automatic'
          recommendation='start A string'
          onApplyRecommendation={() => {}}
        />
      </Section>
      <Section title='PracticeCard (with group progress toggles)' tabId={tabId}>
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
  { sel, tabId }: { sel: StatsSelector; tabId: string },
) {
  return (
    <PreviewGrid>
      <Section title='Tabs' tabId={tabId}>
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
      <Section title='ModeScreen (idle, composed)' tabId={tabId}>
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
  { sel, groupSel, tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <>
      <h2>Idle Screen</h2>
      <IdleBasicComponents groupSel={groupSel} tabId={tabId} />
      <IdleComposedComponents sel={sel} tabId={tabId} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function StructureTab(
  { sel, groupSel, tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <div>
      <LayoutPrimitives tabId={tabId} />
      <QuizFlowComponents tabId={tabId} />
      <IdleScreenComponents sel={sel} groupSel={groupSel} tabId={tabId} />
    </div>
  );
}
