// Screen Structure tab — quiz flow and idle screen layout components.

import { goodRound, roughRound } from '../fixtures/index.ts';
import { NoteButtons } from './buttons.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid } from './stats.tsx';
import { FeedbackDisplay } from './quiz-ui.tsx';
import {
  ModeScreen,
  QuizArea,
  RoundCompleteActions,
  RoundCompleteInfo,
  StartButton,
  Tabs,
} from './mode-screen.tsx';
import { BrandStrip } from './brand-strip.tsx';
import { SkillHeader } from './practice-config.tsx';
import { Bar, Card, Section as LayoutSection, Stack } from './layout.tsx';
import { Text } from './text.tsx';
import { PreviewGrid, Section } from './preview-shared.tsx';

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
        <Section title='Bar — gap variants' tabId={tabId}>
          <Bar gap='related'>
            <Text role='label'>A</Text>
            <Text role='label'>B</Text>
            <Text role='label'>C</Text>
          </Bar>
          <Text role='body-secondary'>related (4px)</Text>
          <hr />
          <Bar gap='group'>
            <Text role='label'>A</Text>
            <Text role='label'>B</Text>
            <Text role='label'>C</Text>
          </Bar>
          <Text role='body-secondary'>group (12px)</Text>
          <hr />
          <Bar gap='component'>
            <Text role='label'>A</Text>
            <Text role='label'>B</Text>
            <Text role='label'>C</Text>
          </Bar>
          <Text role='body-secondary'>component (16px)</Text>
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
              <Text role='body'>Inset background, no border</Text>
            </Stack>
          </Card>
        </Section>
        <Section title='Card — compact padding' tabId={tabId}>
          <Card padding='compact'>
            <Stack gap='related'>
              <Text role='heading-subsection'>Compact card</Text>
              <Text role='body'>
                Tighter vertical padding for dense content
              </Text>
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
  { tabId }: { tabId: string },
) {
  return (
    <PreviewGrid>
      <Section title='BrandStrip' tabId={tabId}>
        <div class='brand-strip'>
          <BrandStrip />
        </div>
      </Section>
      <Section title='SkillHeader' tabId={tabId}>
        <SkillHeader
          modeId='semitoneMath'
          title='Semitone Math'
          totalReps={42}
          onBack={() => {}}
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
              content: <Text role='body'>Practice content area</Text>,
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
          <SkillHeader
            modeId='semitoneMath'
            title='Demo Mode'
            totalReps={0}
            onBack={() => {}}
          />
          <Tabs
            activeTab='practice'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <Text role='body'>Practice content area</Text>,
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
  { sel, tabId }: {
    sel: StatsSelector;
    tabId: string;
  },
) {
  return (
    <>
      <h2>Idle Screen</h2>
      <IdleBasicComponents tabId={tabId} />
      <IdleComposedComponents sel={sel} tabId={tabId} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function StructureTab(
  { sel, tabId }: {
    sel: StatsSelector;
    tabId: string;
  },
) {
  return (
    <div>
      <LayoutPrimitives tabId={tabId} />
      <QuizFlowComponents tabId={tabId} />
      <IdleScreenComponents sel={sel} tabId={tabId} />
    </div>
  );
}
