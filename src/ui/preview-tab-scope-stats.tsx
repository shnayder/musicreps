// Scope & Stats tab — stats grids/tables/legend and scope control components.

import { NOTES } from '../music-data.ts';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid, StatsLegend, StatsTable } from './stats.tsx';
import { GroupProgressBar } from './scope.tsx';
import { PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local helpers
// ---------------------------------------------------------------------------

function StatsSection({ sel, tabId }: { sel: StatsSelector; tabId: string }) {
  return (
    <>
      <h2>Stats</h2>
      <PreviewGrid>
        <Section title='Progress Heatmap (StatsGrid)' tabId={tabId}>
          <StatsGrid
            selector={sel}
            colLabels={['+1', '+2', '+3', '+4', '+5', '+6']}
            getItemId={(name, ci) => `${name}+${ci + 1}`}
          />
        </Section>
        <Section title='Bidirectional Table (StatsTable)' tabId={tabId}>
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
        <Section title='Stats Legend' tabId={tabId}>
          <StatsLegend />
        </Section>
      </PreviewGrid>
    </>
  );
}

function ScopeSection(
  { tabId }: { tabId: string },
) {
  return (
    <>
      <h2>Scope Controls</h2>
      <PreviewGrid>
        <Section title='GroupProgressBar' tabId={tabId}>
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
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function ScopeStatsTab(
  { sel, tabId }: {
    sel: StatsSelector;
    tabId: string;
  },
) {
  return (
    <div>
      <StatsSection sel={sel} tabId={tabId} />
      <ScopeSection tabId={tabId} />
    </div>
  );
}
