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
  getSpeedScore(id: string): number | null;
  getFreshness(id: string): number | null;
  getStats(id: string): ItemStats | null;
}

// ---------------------------------------------------------------------------
// StatsTable — bidirectional lookup table (Note <-> Semitones, etc.)
// ---------------------------------------------------------------------------

export interface StatsTableRow {
  label: string;
  sublabel: string;
  _colHeader: string;
  fwdItemId: string;
  revItemId: string;
  fwd2ItemId?: string;
  rev2ItemId?: string;
}

export function StatsTable(
  { selector, rows, fwdHeader, revHeader, fwd2Header, rev2Header }: {
    selector: StatsSelector;
    rows: StatsTableRow[];
    fwdHeader: string;
    revHeader: string;
    fwd2Header?: string;
    rev2Header?: string;
  },
) {
  if (!rows || rows.length === 0) return null;
  const hasPair = !!(fwd2Header && rev2Header);
  return (
    <table class='stats-table'>
      <thead>
        <tr>
          <th>{rows[0]._colHeader}</th>
          <th>#</th>
          <th>{fwdHeader}</th>
          <th>{revHeader}</th>
          {hasPair && <th>{fwd2Header}</th>}
          {hasPair && <th>{rev2Header}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const fwdColor = getStatsCellColor(selector, row.fwdItemId);
          const revColor = getStatsCellColor(selector, row.revItemId);
          return (
            <tr key={row.fwdItemId}>
              <td>{row.label}</td>
              <td>{row.sublabel}</td>
              <td class='stats-cell' style={{ background: fwdColor }} />
              <td class='stats-cell' style={{ background: revColor }} />
              {hasPair && (
                <td
                  class='stats-cell'
                  style={{
                    background: getStatsCellColor(
                      selector,
                      row.fwd2ItemId ?? '',
                    ),
                  }}
                />
              )}
              {hasPair && (
                <td
                  class='stats-cell'
                  style={{
                    background: getStatsCellColor(
                      selector,
                      row.rev2ItemId ?? '',
                    ),
                  }}
                />
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// StatsGrid — heatmap grid (12 notes x N columns)
// ---------------------------------------------------------------------------

export function StatsGrid(
  { selector, colLabels, getItemId, notes }: {
    selector: StatsSelector;
    colLabels: string[];
    getItemId: (noteName: string, colIndex: number) => string | string[];
    notes?: { name: string; displayName: string }[];
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
                ? getStatsCellColorMerged(selector, itemId)
                : getStatsCellColor(selector, itemId);
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
// StatsLegend — color scale legend (2D: speed x freshness)
// ---------------------------------------------------------------------------

export function StatsLegend() {
  const html = buildStatsLegend();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
