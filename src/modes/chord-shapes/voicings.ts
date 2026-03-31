// Chord voicing data for guitar and ukulele.
// Standard open-position fingerings — the shapes shown on beginner chord charts.
//
// Each voicing defines per-string fret numbers:
//   number = fret to press (0 = open string)
//   'x'    = muted / not played
//
// String order: index 0 = highest-pitched string, last = lowest-pitched string.
// Guitar: [e, B, G, D, A, E]   Ukulele: [A, E, C, G]

export type StringAction = number | 'x';

export type ChordVoicing = {
  root: string;
  quality: 'major' | 'minor' | 'dom7';
  symbol: string; // "" for major, "m" for minor, "7" for dom7
  strings: StringAction[];
};

// ---------------------------------------------------------------------------
// Guitar voicings (6 strings: e B G D A E)
// ---------------------------------------------------------------------------

export const GUITAR_VOICINGS: ChordVoicing[] = [
  // --- Major ---
  { root: 'C', quality: 'major', symbol: '', strings: [0, 1, 0, 2, 3, 'x'] },
  { root: 'A', quality: 'major', symbol: '', strings: [0, 2, 2, 2, 0, 'x'] },
  { root: 'G', quality: 'major', symbol: '', strings: [3, 0, 0, 0, 2, 3] },
  { root: 'E', quality: 'major', symbol: '', strings: [0, 0, 1, 2, 2, 0] },
  { root: 'D', quality: 'major', symbol: '', strings: [2, 3, 2, 0, 'x', 'x'] },
  { root: 'F', quality: 'major', symbol: '', strings: [1, 1, 2, 3, 3, 1] },

  // --- Minor ---
  { root: 'A', quality: 'minor', symbol: 'm', strings: [0, 1, 2, 2, 0, 'x'] },
  { root: 'E', quality: 'minor', symbol: 'm', strings: [0, 0, 0, 2, 2, 0] },
  { root: 'D', quality: 'minor', symbol: 'm', strings: [1, 3, 2, 0, 'x', 'x'] },

  // --- Dominant 7th ---
  { root: 'A', quality: 'dom7', symbol: '7', strings: [0, 2, 0, 2, 0, 'x'] },
  { root: 'B', quality: 'dom7', symbol: '7', strings: [2, 0, 2, 1, 2, 'x'] },
  { root: 'C', quality: 'dom7', symbol: '7', strings: [0, 1, 3, 2, 3, 'x'] },
  { root: 'D', quality: 'dom7', symbol: '7', strings: [2, 1, 2, 0, 'x', 'x'] },
  { root: 'E', quality: 'dom7', symbol: '7', strings: [0, 0, 1, 0, 2, 0] },
  { root: 'G', quality: 'dom7', symbol: '7', strings: [1, 0, 0, 0, 2, 3] },
];

// ---------------------------------------------------------------------------
// Ukulele voicings (4 strings: A E C G)
// ---------------------------------------------------------------------------

export const UKULELE_VOICINGS: ChordVoicing[] = [
  // --- Major ---
  { root: 'C', quality: 'major', symbol: '', strings: [3, 0, 0, 0] },
  { root: 'F', quality: 'major', symbol: '', strings: [0, 1, 0, 2] },
  { root: 'G', quality: 'major', symbol: '', strings: [2, 3, 2, 0] },
  { root: 'A', quality: 'major', symbol: '', strings: [0, 0, 0, 2] },
  { root: 'D', quality: 'major', symbol: '', strings: [0, 2, 2, 2] },
  { root: 'Bb', quality: 'major', symbol: '', strings: [2, 1, 1, 3] },

  // --- Minor ---
  { root: 'A', quality: 'minor', symbol: 'm', strings: [0, 0, 0, 2] },
  { root: 'D', quality: 'minor', symbol: 'm', strings: [1, 2, 2, 3] },
  { root: 'E', quality: 'minor', symbol: 'm', strings: [2, 3, 4, 0] },

  // --- Dominant 7th ---
  { root: 'C', quality: 'dom7', symbol: '7', strings: [1, 0, 0, 0] },
  { root: 'G', quality: 'dom7', symbol: '7', strings: [2, 1, 2, 0] },
  { root: 'A', quality: 'dom7', symbol: '7', strings: [0, 0, 1, 0] },
  { root: 'D', quality: 'dom7', symbol: '7', strings: [3, 2, 2, 2] },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getVoicings(
  instrument: 'guitar' | 'ukulele',
): ChordVoicing[] {
  return instrument === 'guitar' ? GUITAR_VOICINGS : UKULELE_VOICINGS;
}
