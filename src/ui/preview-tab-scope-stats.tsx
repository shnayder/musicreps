// Scope & Stats tab — stats grids/tables/legend and scope control components.

import { NOTES } from '../music-data.ts';
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
import { type GroupSel, PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local helpers
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

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function ScopeStatsTab(
  { sel, groupSel, tabId: _tabId }: {
    sel: StatsSelector;
    groupSel: GroupSel;
    tabId: string;
  },
) {
  return (
    <div>
      <StatsSection sel={sel} />
      <ScopeSection groupSel={groupSel} />
    </div>
  );
}
