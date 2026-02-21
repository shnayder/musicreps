// Shared utilities for mode logic: ID parsing, ID building, stats helpers.
// Pure functions — no DOM, no hooks, no side effects.
// Used by per-mode logic.ts files to avoid duplicating mechanical patterns.

import type { StatsTableRow } from './types.ts';

// ---------------------------------------------------------------------------
// Bidirectional ID helpers
// ---------------------------------------------------------------------------
// Bidirectional modes have items like "C:fwd" / "C:rev" (2-part) or
// "D:5:fwd" / "Bb:IV:rev" (compound). The direction is always the last
// colon-separated segment.

/**
 * Build item IDs for a bidirectional mode from a list of keys.
 * Each key produces two IDs: key + ":fwd" and key + ":rev".
 *
 * @example buildBidirectionalIds(["C", "D"]) → ["C:fwd", "C:rev", "D:fwd", "D:rev"]
 */
export function buildBidirectionalIds(keys: string[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    ids.push(keys[i] + ':fwd', keys[i] + ':rev');
  }
  return ids;
}

/**
 * Parse a bidirectional item ID into its key and direction.
 * The direction is the segment after the last colon. The key is everything
 * before it — may contain colons for compound IDs like "D:5:fwd".
 *
 * @example parseBidirectionalId("C:fwd") → { key: "C", dir: "fwd" }
 * @example parseBidirectionalId("D:5:rev") → { key: "D:5", dir: "rev" }
 * @example parseBidirectionalId("Bb:IV:fwd") → { key: "Bb:IV", dir: "fwd" }
 */
export function parseBidirectionalId(
  id: string,
): { key: string; dir: 'fwd' | 'rev' } {
  const lastColon = id.lastIndexOf(':');
  return {
    key: id.substring(0, lastColon),
    dir: id.substring(lastColon + 1) as 'fwd' | 'rev',
  };
}

/**
 * Build a [fwd, rev] ID pair for a bidirectional grid cell.
 * Used by stats grid components to map (row, col) → item IDs.
 *
 * @example bidirectionalGridId("D", "5") → ["D:5:fwd", "D:5:rev"]
 * @example bidirectionalGridId("C", "IV") → ["C:IV:fwd", "C:IV:rev"]
 */
export function bidirectionalGridId(
  key: string,
  col: string | number,
): [string, string] {
  const base = key + ':' + col;
  return [base + ':fwd', base + ':rev'];
}

// ---------------------------------------------------------------------------
// Math ID helpers
// ---------------------------------------------------------------------------
// Math modes have items like "C+3" / "C-3" (semitone math) or "C+m3" / "C-P4"
// (interval math). The note may include a sharp (e.g. "C#").

/**
 * Build item IDs for a math mode from notes × values.
 * Each (note, value) pair produces two IDs: note + "+" + value and
 * note + "-" + value.
 *
 * @example buildMathIds(["C", "D"], [1, 2])
 *   → ["C+1", "C-1", "C+2", "C-2", "D+1", "D-1", "D+2", "D-2"]
 */
export function buildMathIds(
  notes: string[],
  values: (string | number)[],
): string[] {
  const ids: string[] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < values.length; j++) {
      ids.push(notes[i] + '+' + values[j], notes[i] + '-' + values[j]);
    }
  }
  return ids;
}

/**
 * Parse a math item ID into note, operator, and value.
 * Handles sharps in note names (e.g. "C#+3" → note "C#", op "+", value "3").
 * The operator is the first "+" or "-" after the note name (position ≥ 1).
 *
 * @example parseMathId("C+3") → { note: "C", op: "+", value: "3" }
 * @example parseMathId("C#-m3") → { note: "C#", op: "-", value: "m3" }
 * @example parseMathId("Db+P5") → { note: "Db", op: "+", value: "P5" }
 */
export function parseMathId(
  id: string,
): { note: string; op: '+' | '-'; value: string } {
  // Note names are 1–2 chars (C, C#, Db). Find the operator after that.
  const match = id.match(/^([A-Ga-g][#b]?)([+-])(.+)$/);
  if (!match) {
    return { note: id, op: '+', value: '' };
  }
  return {
    note: match[1],
    op: match[2] as '+' | '-',
    value: match[3],
  };
}

/**
 * Build a [plus, minus] ID pair for a math grid cell.
 * Used by stats grid components to map (note, col) → item IDs.
 *
 * @example mathGridId("C", 3) → ["C+3", "C-3"]
 * @example mathGridId("D", "m3") → ["D+m3", "D-m3"]
 */
export function mathGridId(
  note: string,
  value: string | number,
): [string, string] {
  return [note + '+' + value, note + '-' + value];
}

// ---------------------------------------------------------------------------
// Stats row builders
// ---------------------------------------------------------------------------

/**
 * Build stats table rows for a bidirectional mode.
 * Maps an array of items to StatsTableRow objects with fwd/rev item IDs.
 *
 * @param items Array of objects with a key (used for ID generation),
 *   label (display name), and sublabel (secondary info).
 * @param colHeader Column header text for the stats table (e.g. "Note", "Key").
 *
 * @example buildBidirectionalStatsRows(
 *   [{ key: "C", label: "C", sublabel: "0" }], "Note"
 * ) → [{ label: "C", sublabel: "0", _colHeader: "Note",
 *        fwdItemId: "C:fwd", revItemId: "C:rev" }]
 */
export function buildBidirectionalStatsRows(
  items: { key: string; label: string; sublabel: string }[],
  colHeader: string,
): StatsTableRow[] {
  return items.map((item) => ({
    label: item.label,
    sublabel: item.sublabel,
    _colHeader: colHeader,
    fwdItemId: item.key + ':fwd',
    revItemId: item.key + ':rev',
  }));
}
