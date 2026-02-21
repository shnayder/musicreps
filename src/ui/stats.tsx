// Stats display components: Preact equivalents of stats-display.ts renderers.
// Pure color functions are imported from stats-display.ts — no duplication.

import { displayNote, NOTES } from '../music-data.ts';
import type { ItemStats } from '../types.ts';
import {
  buildStatsLegend,
  getStatsCellColor,
  getStatsCellColorMerged,
  heatmapNeedsLightText,
} from '../stats-display.ts';

/** Selector interface for stats lookup (subset of AdaptiveSelector). */
export interface StatsSelector {
  getAutomaticity(id: string): number | null;
  getStats(id: string): ItemStats | null;
}

// ---------------------------------------------------------------------------
// StatsTable — bidirectional lookup table (Note ↔ Semitones, etc.)
// ---------------------------------------------------------------------------

export interface StatsTableRow {
  label: string;
  sublabel: string;
  _colHeader: string;
  fwdItemId: string;
  revItemId: string;
}

export function StatsTable(
  { selector, rows, fwdHeader, revHeader, statsMode, baseline }: {
    selector: StatsSelector;
    rows: StatsTableRow[];
    fwdHeader: string;
    revHeader: string;
    statsMode: string;
    baseline?: number;
  },
) {
  if (!rows || rows.length === 0) return null;
  return (
    <table class='stats-table'>
      <thead>
        <tr>
          <th>{rows[0]._colHeader}</th>
          <th>#</th>
          <th>{fwdHeader}</th>
          <th>{revHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const fwdColor = getStatsCellColor(
            selector,
            row.fwdItemId,
            statsMode,
            baseline,
          );
          const revColor = getStatsCellColor(
            selector,
            row.revItemId,
            statsMode,
            baseline,
          );
          return (
            <tr key={row.fwdItemId}>
              <td>{row.label}</td>
              <td>{row.sublabel}</td>
              <td
                class='stats-cell'
                style={{ background: fwdColor }}
              />
              <td
                class='stats-cell'
                style={{ background: revColor }}
              />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// StatsGrid — heatmap grid (12 notes × N columns)
// ---------------------------------------------------------------------------

export function StatsGrid(
  { selector, colLabels, getItemId, statsMode, notes, baseline }: {
    selector: StatsSelector;
    colLabels: string[];
    getItemId: (noteName: string, colIndex: number) => string | string[];
    statsMode: string;
    notes?: { name: string; displayName: string }[];
    baseline?: number;
  },
) {
  const noteList = notes || NOTES;
  return (
    <table class='stats-grid'>
      <thead>
        <tr>
          <th></th>
          {colLabels.map((c) => <th key={c}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {noteList.map((note) => (
          <tr key={note.name}>
            <td class='stats-grid-row-label'>
              {displayNote(note.name || note.displayName)}
            </td>
            {colLabels.map((_, i) => {
              const itemId = getItemId(note.name, i);
              const color = Array.isArray(itemId)
                ? getStatsCellColorMerged(
                  selector,
                  itemId,
                  statsMode,
                  baseline,
                )
                : getStatsCellColor(selector, itemId, statsMode, baseline);
              const light = heatmapNeedsLightText(color);
              return (
                <td
                  key={i}
                  class='stats-cell'
                  style={{
                    background: color,
                    color: light ? 'white' : undefined,
                  }}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// StatsLegend — color scale legend
// ---------------------------------------------------------------------------

export function StatsLegend(
  { statsMode, baseline }: { statsMode: string; baseline?: number },
) {
  // Reuse the existing pure HTML builder — render via dangerouslySetInnerHTML
  // to avoid duplicating the legend logic. Phase 3+ can replace with pure JSX.
  const html = buildStatsLegend(statsMode, baseline);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------------------------------------------------------------------------
// StatsToggle — Recall / Speed toggle buttons
// ---------------------------------------------------------------------------

export function StatsToggle(
  { active, onToggle }: {
    active: string;
    onToggle: (mode: string) => void;
  },
) {
  return (
    <div class='stats-toggle'>
      <button
        type='button'
        class={'stats-toggle-btn' +
          (active === 'retention' ? ' active' : '')}
        data-mode='retention'
        onClick={() => onToggle('retention')}
      >
        Recall
      </button>
      <button
        type='button'
        class={'stats-toggle-btn' + (active === 'speed' ? ' active' : '')}
        data-mode='speed'
        onClick={() => onToggle('speed')}
      >
        Speed
      </button>
    </div>
  );
}
