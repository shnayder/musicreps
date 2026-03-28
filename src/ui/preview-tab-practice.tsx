// Practice Redesign tab — new skill screen components (SkillHeader,
// PracticeConfig, LevelToggles, LevelProgressCard, SuggestionLines).

import { useState } from 'preact/hooks';
import type { StatsSelector } from './stats.tsx';
import { ActionButton } from './action-button.tsx';
import {
  type ModeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
  TabBar,
  type TabDef,
  TabIcon,
  Tabs,
  useTabsPrefix,
} from './mode-screen.tsx';
import { FeedbackDisplay } from './quiz-ui.tsx';
import { NoteButtons } from './buttons.tsx';
import {
  LevelProgressCard,
  LevelToggles,
  PracticeConfig,
  type PracticeMode,
  SkillHeader,
  type SuggestionLine,
  SuggestionLines,
} from './practice-config.tsx';
import { type GroupSel, PreviewGrid, Section } from './preview-shared.tsx';
import { Text } from './text.tsx';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../mode-catalog.ts';
import {
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  ScreenLayout,
} from './screen-layout.tsx';

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

const MOCK_PROGRESS_COLORS = [
  'hsl(125, 48%, 33%)',
  'hsl(125, 48%, 33%)',
  'hsl(80, 35%, 40%)',
  'hsl(60, 40%, 46%)',
  'hsl(48, 50%, 52%)',
  'var(--heatmap-1)',
  'var(--heatmap-1)',
  'var(--heatmap-1)',
];

const MOCK_SUGGESTION_LINES: SuggestionLine[] = [
  { verb: 'Review', levels: ['E string', 'A string'] },
  { verb: 'Start', levels: ['D string'] },
];

const MOCK_SUGGESTION_SINGLE: SuggestionLine[] = [
  { verb: 'Start', levels: ['E string'] },
];

const MOCK_SUGGESTION_REVIEW: SuggestionLine[] = [
  { verb: 'Review', levels: ['E string', 'A string', 'D string'] },
  { verb: 'Keep practicing', levels: ['G string'] },
];

const MOCK_LEVEL_LABELS = [
  'E e',
  'A',
  'D',
  'G',
  'B',
  'E A ♯♭',
  'D G ♯♭',
  'B e ♯♭',
];

const MOCK_LEVEL_COLORS: string[][] = [
  ['hsl(125, 48%, 33%)', 'hsl(125, 48%, 33%)', 'hsl(80, 35%, 40%)'],
  ['hsl(80, 35%, 40%)', 'hsl(60, 40%, 46%)', 'hsl(48, 50%, 52%)'],
  ['hsl(48, 50%, 52%)', 'var(--heatmap-1)', 'var(--heatmap-1)'],
  ['var(--heatmap-1)', 'var(--heatmap-1)', 'var(--heatmap-1)'],
];

// ---------------------------------------------------------------------------
// Shared props for sub-components needing custom-mode state
// ---------------------------------------------------------------------------

type CustomState = {
  customActive: Set<number>;
  toggleCustom: (i: number) => void;
  customItemCount: number;
};

// ---------------------------------------------------------------------------
// Phase 1: Individual components
// ---------------------------------------------------------------------------

function Phase1Components(
  {
    setPracticeMode,
    customActive,
    toggleCustom,
    customItemCount: _customItemCount,
    tabId,
  }:
    & CustomState
    & {
      setPracticeMode: (m: PracticeMode) => void;
      tabId: string;
    },
) {
  const [navTab, setNavTab] = useState<ModeTab>('practice');

  return (
    <>
      <h2>Phase 1: Individual Components</h2>

      <PreviewGrid>
        <Section title='Mode Nav — bottom bar (mobile)' tabId={tabId}>
          <Tabs
            tabs={[
              {
                id: 'practice' as ModeTab,
                label: <TabIcon icon='practice' text='Practice' />,
                content: (
                  <div style='padding:var(--pad-component)'>
                    Practice content
                  </div>
                ),
              },
              {
                id: 'progress' as ModeTab,
                label: <TabIcon icon='progress' text='Progress' />,
                content: (
                  <div style='padding:var(--pad-component)'>
                    Progress content
                  </div>
                ),
              },
              {
                id: 'about' as ModeTab,
                label: <TabIcon icon='about' text='About' />,
                content: <PreviewAboutTab />,
              },
            ]}
            activeTab={navTab}
            onTabSwitch={setNavTab}
            class='mode-nav'
          />
        </Section>
      </PreviewGrid>

      <PreviewGrid>
        <Section title='SkillHeader — with progress' tabId={tabId}>
          <SkillHeader
            modeId='fretboard'
            title='Guitar Fretboard'
            progressColors={MOCK_PROGRESS_COLORS}
            onBack={() => {}}
          />
        </Section>
        <Section title='SkillHeader — empty (new skill)' tabId={tabId}>
          <SkillHeader
            modeId='noteSemitones'
            title='Note ↔ Semitones'
            progressColors={[]}
            onBack={() => {}}
          />
        </Section>
      </PreviewGrid>

      <PreviewGrid>
        <Section title='SuggestionLines — mixed' tabId={tabId}>
          <SuggestionLines lines={MOCK_SUGGESTION_LINES} />
        </Section>
        <Section title='SuggestionLines — single' tabId={tabId}>
          <SuggestionLines lines={MOCK_SUGGESTION_SINGLE} />
        </Section>
        <Section title='SuggestionLines — review-heavy' tabId={tabId}>
          <SuggestionLines lines={MOCK_SUGGESTION_REVIEW} />
        </Section>
      </PreviewGrid>

      <PreviewGrid>
        <Section title='LevelToggles — custom mode' tabId={tabId}>
          <LevelToggles
            labels={MOCK_LEVEL_LABELS}
            active={customActive}
            onToggle={toggleCustom}
          />
        </Section>
      </PreviewGrid>

      <Phase1Cards tabId={tabId} />

      <PreviewGrid>
        <Section title='PracticeConfig — suggested' tabId={tabId}>
          <PracticeConfig
            mode='suggested'
            onModeChange={setPracticeMode}
            suggestedContent={<SuggestionLines lines={MOCK_SUGGESTION_LINES} />}
            customContent={
              <LevelToggles
                labels={MOCK_LEVEL_LABELS}
                active={customActive}
                onToggle={toggleCustom}
              />
            }
          />
        </Section>
        <Section title='PracticeConfig — custom' tabId={tabId}>
          <PracticeConfig
            mode='custom'
            onModeChange={setPracticeMode}
            suggestedContent={<SuggestionLines lines={MOCK_SUGGESTION_LINES} />}
            customContent={
              <LevelToggles
                labels={MOCK_LEVEL_LABELS}
                active={customActive}
                onToggle={toggleCustom}
              />
            }
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function Phase1Cards({ tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='LevelProgressCard — review soon' tabId={tabId}>
        <LevelProgressCard
          label='E string'
          pill='Review soon'
          colors={MOCK_LEVEL_COLORS[0]}
          status='normal'
        />
      </Section>
      <Section title='LevelProgressCard — review scheduled' tabId={tabId}>
        <LevelProgressCard
          label='A string'
          pill='Review in 5d'
          colors={MOCK_LEVEL_COLORS[1]}
          status='known'
        />
      </Section>
      <Section title='LevelProgressCard — skipped' tabId={tabId}>
        <LevelProgressCard
          label='D string'
          colors={MOCK_LEVEL_COLORS[2]}
          status='skipped'
        />
      </Section>
      <Section title='LevelProgressCard — not started' tabId={tabId}>
        <LevelProgressCard
          label='G string'
          colors={MOCK_LEVEL_COLORS[3]}
          status='normal'
        />
      </Section>
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Phase 2: Assembled layouts
// ---------------------------------------------------------------------------

function Phase2MultiLevel(
  { customActive, toggleCustom, customItemCount: _, tabId }: CustomState & {
    tabId: string;
  },
) {
  return (
    <PreviewGrid>
      <Section title='Suggested mode — multi-level' tabId={tabId}>
        <div
          class='mode-screen phase-idle'
          style='display:flex;flex-direction:column;position:relative'
        >
          <SkillHeader
            modeId='fretboard'
            title='Guitar Fretboard'
            progressColors={MOCK_PROGRESS_COLORS}
            onBack={() => {}}
          />
          <PracticeConfig
            mode='suggested'
            onModeChange={() => {}}
            suggestedContent={<SuggestionLines lines={MOCK_SUGGESTION_LINES} />}
            customContent={null}
          />
          <div
            class='practice-zone-action'
            style='padding: var(--pad-region) var(--pad-region) var(--pad-component)'
          >
            <ActionButton variant='primary' onClick={() => {}}>
              Practice
            </ActionButton>
          </div>
        </div>
      </Section>

      <Section title='Custom mode — multi-level' tabId={tabId}>
        <div
          class='mode-screen phase-idle'
          style='display:flex;flex-direction:column;position:relative'
        >
          <SkillHeader
            modeId='fretboard'
            title='Guitar Fretboard'
            progressColors={MOCK_PROGRESS_COLORS}
            onBack={() => {}}
          />
          <PracticeConfig
            mode='custom'
            onModeChange={() => {}}
            suggestedContent={null}
            customContent={
              <LevelToggles
                labels={MOCK_LEVEL_LABELS}
                active={customActive}
                onToggle={toggleCustom}
              />
            }
          />
          <div
            class='practice-zone-action'
            style='padding: var(--pad-region) var(--pad-region) var(--pad-component)'
          >
            <ActionButton variant='primary' onClick={() => {}}>
              Practice
            </ActionButton>
          </div>
        </div>
      </Section>
    </PreviewGrid>
  );
}

function Phase2SingleAndProgress({ tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='Single-level skill' tabId={tabId}>
        <div
          class='mode-screen phase-idle'
          style='display:flex;flex-direction:column;position:relative'
        >
          <SkillHeader
            modeId='noteSemitones'
            title='Note ↔ Semitones'
            progressColors={MOCK_PROGRESS_COLORS.slice(0, 3)}
            onBack={() => {}}
          />
          <div
            class='practice-zone-action'
            style='padding: var(--pad-region) var(--pad-region) var(--pad-component)'
          >
            <ActionButton variant='primary' onClick={() => {}}>
              Practice
            </ActionButton>
          </div>
        </div>
      </Section>

      <Section title='Progress tab — level cards' tabId={tabId}>
        <div style='padding: var(--gap-group) var(--pad-region)'>
          <LevelProgressCard
            label='E string'
            pill='Review soon'
            colors={MOCK_LEVEL_COLORS[0]}
            status='normal'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
          <LevelProgressCard
            label='A string'
            pill='Review in 5d'
            colors={MOCK_LEVEL_COLORS[1]}
            status='normal'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
          <LevelProgressCard
            label='D string'
            pill='Review in 3w'
            colors={MOCK_LEVEL_COLORS[2]}
            status='known'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
          <LevelProgressCard
            label='G string'
            colors={MOCK_LEVEL_COLORS[3]}
            status='normal'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
        </div>
      </Section>
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Screen Layout — idle phase examples
// ---------------------------------------------------------------------------

/** Mode-nav tab bar used in idle-phase footer examples. */
function PreviewAboutTab() {
  const ba = MODE_BEFORE_AFTER.keySignatures;
  return (
    <div class='about-tab'>
      <Text role='body-secondary' as='p' class='about-description'>
        {MODE_DESCRIPTIONS.keySignatures}
      </Text>
      <Text role='heading-subsection' as='div'>What you're training</Text>
      <div class='about-columns'>
        <div class='about-col about-col-before'>
          <Text role='label' as='div' class='about-col-header'>Before</Text>
          <p class='about-col-text'>{ba.before()}</p>
        </div>
        <div class='about-col about-col-after'>
          <Text role='label' as='div' class='about-col-header'>After</Text>
          <p class='about-col-text'>{ba.after()}</p>
        </div>
      </div>
    </div>
  );
}

function ModeNavFooter() {
  const prefix = useTabsPrefix();
  const tabs: TabDef<ModeTab>[] = [
    {
      id: 'practice',
      label: <TabIcon icon='practice' text='Practice' />,
      content: null,
    },
    {
      id: 'progress',
      label: <TabIcon icon='progress' text='Progress' />,
      content: null,
    },
    {
      id: 'about',
      label: <TabIcon icon='about' text='About' />,
      content: null,
    },
  ];
  return (
    <TabBar
      tabs={tabs}
      activeTab='practice'
      onTabSwitch={() => {}}
      prefix={prefix}
      class='mode-nav'
    />
  );
}

function ScreenLayoutIdleExamples(
  { customActive, toggleCustom, customItemCount: _, tabId }: CustomState & {
    tabId: string;
  },
) {
  return (
    <PreviewGrid>
      <Section title='Idle — suggested mode' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>
            <SkillHeader
              modeId='fretboard'
              title='Guitar Fretboard'
              progressColors={MOCK_PROGRESS_COLORS}
            />
          </LayoutHeader>
          <LayoutMain>
            <PracticeConfig
              mode='suggested'
              onModeChange={() => {}}
              suggestedContent={
                <SuggestionLines lines={MOCK_SUGGESTION_LINES} />
              }
              customContent={null}
            />
          </LayoutMain>
          <LayoutFooter>
            <div class='practice-zone-action'>
              <ActionButton variant='primary' onClick={() => {}}>
                Practice
              </ActionButton>
            </div>
            <ModeNavFooter />
          </LayoutFooter>
        </ScreenLayout>
      </Section>

      <Section title='Idle — custom mode' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>
            <SkillHeader
              modeId='fretboard'
              title='Guitar Fretboard'
              progressColors={MOCK_PROGRESS_COLORS}
            />
          </LayoutHeader>
          <LayoutMain>
            <PracticeConfig
              mode='custom'
              onModeChange={() => {}}
              suggestedContent={null}
              customContent={
                <LevelToggles
                  labels={MOCK_LEVEL_LABELS}
                  active={customActive}
                  onToggle={toggleCustom}
                />
              }
            />
          </LayoutMain>
          <LayoutFooter>
            <div class='practice-zone-action'>
              <ActionButton variant='primary' onClick={() => {}}>
                Practice
              </ActionButton>
            </div>
            <ModeNavFooter />
          </LayoutFooter>
        </ScreenLayout>
      </Section>

      <Section title='Idle — single-level' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>
            <SkillHeader
              modeId='noteSemitones'
              title='Note ↔ Semitones'
              progressColors={MOCK_PROGRESS_COLORS.slice(0, 3)}
            />
          </LayoutHeader>
          <LayoutMain>{null}</LayoutMain>
          <LayoutFooter>
            <div class='practice-zone-action'>
              <ActionButton variant='primary' onClick={() => {}}>
                Practice
              </ActionButton>
            </div>
            <ModeNavFooter />
          </LayoutFooter>
        </ScreenLayout>
      </Section>
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Screen Layout — active phase examples
// ---------------------------------------------------------------------------

function ScreenLayoutActiveExamples({ tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='Active quiz — answering' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>
            <QuizSession
              timeLeft='1:23'
              timerPct={72}
              context='E string'
              count='5 of 20'
            />
          </LayoutHeader>
          <LayoutMain scrollable={false}>
            <QuizArea
              prompt='What note is on string 1, fret 3?'
              controls={<NoteButtons onAnswer={() => {}} />}
            />
          </LayoutMain>
          <LayoutFooter>
            <FeedbackDisplay
              text=''
              className='feedback'
            />
          </LayoutFooter>
        </ScreenLayout>
      </Section>

      <Section title='Active quiz — with feedback' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>
            <QuizSession
              timeLeft='1:18'
              timerPct={65}
              context='E string'
              count='6 of 20'
              lastQuestion='G'
            />
          </LayoutHeader>
          <LayoutMain scrollable={false}>
            <QuizArea
              prompt='What note is on string 1, fret 5?'
              controls={
                <NoteButtons
                  onAnswer={() => {}}
                  feedback={{
                    correct: true,
                    userInput: 'A',
                    displayAnswer: 'A',
                  }}
                />
              }
            />
          </LayoutMain>
          <LayoutFooter>
            <FeedbackDisplay
              text='Correct!'
              className='feedback correct'
              hint='A is fret 5 on string 1'
              correct
              onNext={() => {}}
            />
          </LayoutFooter>
        </ScreenLayout>
      </Section>

      <Section title='Round complete' tabId={tabId}>
        <ScreenLayout class='preview-screen-layout'>
          <LayoutHeader>{null}</LayoutHeader>
          <LayoutMain scrollable={false}>
            <QuizArea>
              <RoundCompleteInfo
                context='E string · A string'
                heading='Round Complete'
                count={20}
                correct='18 correct (90%)'
              />
            </QuizArea>
          </LayoutMain>
          <LayoutFooter>
            <RoundCompleteActions
              onContinue={() => {}}
              onStop={() => {}}
            />
          </LayoutFooter>
        </ScreenLayout>
      </Section>
    </PreviewGrid>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function PracticeRedesignTab(
  { sel: _sel, groupSel: _groupSel, tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  const [_practiceMode, setPracticeMode] = useState<PracticeMode>('suggested');
  const [customActive, setCustomActive] = useState<Set<number>>(
    new Set([0, 1]),
  );

  function toggleCustom(i: number) {
    setCustomActive((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const customItemCount = [...customActive].reduce(
    (sum, i) => sum + (i < 5 ? 16 : 10),
    0,
  );

  return (
    <div>
      <Phase1Components
        setPracticeMode={setPracticeMode}
        customActive={customActive}
        toggleCustom={toggleCustom}
        customItemCount={customItemCount}
        tabId={tabId}
      />
      <h2>Phase 2: Assembled Layouts</h2>
      <Phase2MultiLevel
        customActive={customActive}
        toggleCustom={toggleCustom}
        customItemCount={customItemCount}
        tabId={tabId}
      />
      <Phase2SingleAndProgress tabId={tabId} />

      <h2>Screen Layout</h2>
      <ScreenLayoutIdleExamples
        customActive={customActive}
        toggleCustom={toggleCustom}
        customItemCount={customItemCount}
        tabId={tabId}
      />
      <ScreenLayoutActiveExamples tabId={tabId} />
    </div>
  );
}
