// Practice Redesign tab — new skill screen components (SkillHeader,
// PracticeConfig, LevelToggles, LevelProgressCard, SuggestionLines).

import { useState } from 'preact/hooks';
import type { StatsSelector } from './stats.tsx';
import { ActionButton } from './action-button.tsx';
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
    practiceMode,
    setPracticeMode,
    customActive,
    toggleCustom,
    customItemCount,
  }:
    & CustomState
    & {
      practiceMode: PracticeMode;
      setPracticeMode: (m: PracticeMode) => void;
    },
) {
  return (
    <>
      <h2>Phase 1: Individual Components</h2>

      <PreviewGrid>
        <Section title='SkillHeader — with progress'>
          <SkillHeader
            modeId='fretboard'
            title='Guitar Fretboard'
            progressColors={MOCK_PROGRESS_COLORS}
            onBack={() => {}}
          />
        </Section>
        <Section title='SkillHeader — empty (new skill)'>
          <SkillHeader
            modeId='noteSemitones'
            title='Note ↔ Semitones'
            progressColors={[]}
            onBack={() => {}}
          />
        </Section>
      </PreviewGrid>

      <PreviewGrid>
        <Section title='SuggestionLines — mixed'>
          <SuggestionLines lines={MOCK_SUGGESTION_LINES} />
        </Section>
        <Section title='SuggestionLines — single'>
          <SuggestionLines lines={MOCK_SUGGESTION_SINGLE} />
        </Section>
        <Section title='SuggestionLines — review-heavy'>
          <SuggestionLines lines={MOCK_SUGGESTION_REVIEW} />
        </Section>
      </PreviewGrid>

      <PreviewGrid>
        <Section title='LevelToggles — custom mode'>
          <LevelToggles
            labels={MOCK_LEVEL_LABELS}
            active={customActive}
            onToggle={toggleCustom}
            itemCount={customItemCount}
          />
        </Section>
      </PreviewGrid>

      <Phase1Cards />

      <PreviewGrid>
        <Section title='PracticeConfig — toggle'>
          <PracticeConfig
            mode={practiceMode}
            onModeChange={setPracticeMode}
            suggestedContent={<SuggestionLines lines={MOCK_SUGGESTION_LINES} />}
            customContent={
              <LevelToggles
                labels={MOCK_LEVEL_LABELS}
                active={customActive}
                onToggle={toggleCustom}
                itemCount={customItemCount}
              />
            }
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function Phase1Cards() {
  return (
    <PreviewGrid>
      <Section title='LevelProgressCard — review'>
        <LevelProgressCard
          label='E string'
          pill='Review'
          colors={MOCK_LEVEL_COLORS[0]}
          status='normal'
        />
      </Section>
      <Section title='LevelProgressCard — known'>
        <LevelProgressCard
          label='A string'
          pill='Learned'
          colors={MOCK_LEVEL_COLORS[1]}
          status='known'
        />
      </Section>
      <Section title='LevelProgressCard — skipped'>
        <LevelProgressCard
          label='D string'
          colors={MOCK_LEVEL_COLORS[2]}
          status='skipped'
        />
      </Section>
      <Section title='LevelProgressCard — not started'>
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
  { customActive, toggleCustom, customItemCount }: CustomState,
) {
  return (
    <PreviewGrid>
      <Section title='Suggested mode — multi-level'>
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
            style='padding: var(--space-5) var(--space-5) var(--space-4)'
          >
            <ActionButton variant='primary' onClick={() => {}}>
              Practice
            </ActionButton>
          </div>
        </div>
      </Section>

      <Section title='Custom mode — multi-level'>
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
                itemCount={customItemCount}
              />
            }
          />
          <div
            class='practice-zone-action'
            style='padding: var(--space-5) var(--space-5) var(--space-4)'
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

function Phase2SingleAndProgress() {
  return (
    <PreviewGrid>
      <Section title='Single-level skill'>
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
            style='padding: var(--space-5) var(--space-5) var(--space-4)'
          >
            <ActionButton variant='primary' onClick={() => {}}>
              Practice
            </ActionButton>
          </div>
        </div>
      </Section>

      <Section title='Progress tab — level cards'>
        <div style='padding: var(--space-3) var(--space-5)'>
          <LevelProgressCard
            label='E string'
            pill='Review'
            colors={MOCK_LEVEL_COLORS[0]}
            status='normal'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
          <LevelProgressCard
            label='A string'
            pill='Practice'
            colors={MOCK_LEVEL_COLORS[1]}
            status='normal'
            onToggleKnown={() => {}}
            onToggleSkip={() => {}}
          />
          <LevelProgressCard
            label='D string'
            pill='Learned'
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
// Exported tab component
// ---------------------------------------------------------------------------

export function PracticeRedesignTab(
  { sel: _sel, groupSel: _groupSel, tabId: _tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('suggested');
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
        practiceMode={practiceMode}
        setPracticeMode={setPracticeMode}
        customActive={customActive}
        toggleCustom={toggleCustom}
        customItemCount={customItemCount}
      />
      <h2>Phase 2: Assembled Layouts</h2>
      <Phase2MultiLevel
        customActive={customActive}
        toggleCustom={toggleCustom}
        customItemCount={customItemCount}
      />
      <Phase2SingleAndProgress />
    </div>
  );
}
