// Chord voicing data for guitar and ukulele.
// Standard open-position and common barre fingerings — the shapes shown on
// beginner-to-intermediate chord charts.
//
// Each voicing defines per-string fret numbers:
//   number = fret to press (0 = open string)
//   'x'    = muted / not played
//
// String order: index 0 = highest-pitched string, last = lowest-pitched string.
// Guitar: [e, B, G, D, A, E]   Ukulele: [A, E, C, G]

export type StringAction = number | 'x';

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dom7'
  | 'm7'
  | 'sus2'
  | 'sus4';

export type ChordVoicing = {
  root: string;
  quality: ChordQuality;
  symbol: string; // "" for major, "m" for minor, "7" for dom7, "m7"/"sus2"/"sus4"
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
  // Bm — A-shape barre at fret 2 (x24432)
  { root: 'B', quality: 'minor', symbol: 'm', strings: [2, 3, 4, 4, 2, 'x'] },

  // --- Dominant 7th ---
  { root: 'A', quality: 'dom7', symbol: '7', strings: [0, 2, 0, 2, 0, 'x'] },
  { root: 'B', quality: 'dom7', symbol: '7', strings: [2, 0, 2, 1, 2, 'x'] },
  { root: 'C', quality: 'dom7', symbol: '7', strings: [0, 1, 3, 2, 3, 'x'] },
  { root: 'D', quality: 'dom7', symbol: '7', strings: [2, 1, 2, 0, 'x', 'x'] },
  { root: 'E', quality: 'dom7', symbol: '7', strings: [0, 0, 1, 0, 2, 0] },
  { root: 'G', quality: 'dom7', symbol: '7', strings: [1, 0, 0, 0, 2, 3] },
  // F7 — full barre at fret 1 (131211)
  { root: 'F', quality: 'dom7', symbol: '7', strings: [1, 1, 2, 1, 3, 1] },

  // --- Minor 7th ---
  // Open-position m7 shapes
  { root: 'A', quality: 'm7', symbol: 'm7', strings: [0, 1, 0, 2, 0, 'x'] },
  { root: 'E', quality: 'm7', symbol: 'm7', strings: [0, 0, 0, 0, 2, 0] },
  { root: 'D', quality: 'm7', symbol: 'm7', strings: [1, 1, 2, 0, 'x', 'x'] },
  { root: 'B', quality: 'm7', symbol: 'm7', strings: [2, 0, 2, 0, 2, 'x'] },
  // Barre m7 shapes
  { root: 'F', quality: 'm7', symbol: 'm7', strings: [1, 1, 1, 1, 3, 1] },
  { root: 'G', quality: 'm7', symbol: 'm7', strings: [3, 3, 3, 3, 5, 3] },
  { root: 'C', quality: 'm7', symbol: 'm7', strings: [3, 4, 3, 5, 3, 'x'] },

  // --- Suspended 2nd ---
  {
    root: 'D',
    quality: 'sus2',
    symbol: 'sus2',
    strings: [0, 3, 2, 0, 'x', 'x'],
  },
  { root: 'A', quality: 'sus2', symbol: 'sus2', strings: [0, 0, 2, 2, 0, 'x'] },

  // --- Suspended 4th ---
  {
    root: 'D',
    quality: 'sus4',
    symbol: 'sus4',
    strings: [3, 3, 2, 0, 'x', 'x'],
  },
  { root: 'A', quality: 'sus4', symbol: 'sus4', strings: [0, 3, 2, 2, 0, 'x'] },
  { root: 'E', quality: 'sus4', symbol: 'sus4', strings: [0, 0, 2, 2, 2, 0] },
];

// ---------------------------------------------------------------------------
// Ukulele voicings (4 strings: A E C G)
// ---------------------------------------------------------------------------

export const UKULELE_VOICINGS: ChordVoicing[] = [
  // --- Major ---                          // Chart (G C E A)
  { root: 'C', quality: 'major', symbol: '', strings: [3, 0, 0, 0] }, // 0003
  { root: 'F', quality: 'major', symbol: '', strings: [0, 1, 0, 2] }, // 2010
  { root: 'G', quality: 'major', symbol: '', strings: [2, 3, 2, 0] }, // 0232
  { root: 'A', quality: 'major', symbol: '', strings: [0, 0, 1, 2] }, // 2100
  { root: 'D', quality: 'major', symbol: '', strings: [0, 2, 2, 2] }, // 2220
  { root: 'Bb', quality: 'major', symbol: '', strings: [1, 1, 2, 3] }, // 3211
  { root: 'E', quality: 'major', symbol: '', strings: [2, 4, 4, 4] }, // 4442
  { root: 'B', quality: 'major', symbol: '', strings: [2, 2, 3, 4] }, // 4322

  // --- Minor ---
  { root: 'A', quality: 'minor', symbol: 'm', strings: [0, 0, 0, 2] }, // 2000
  { root: 'D', quality: 'minor', symbol: 'm', strings: [0, 1, 2, 2] }, // 2210
  { root: 'E', quality: 'minor', symbol: 'm', strings: [2, 3, 4, 0] }, // 0432

  // --- Dominant 7th ---
  { root: 'C', quality: 'dom7', symbol: '7', strings: [1, 0, 0, 0] }, // 0001
  { root: 'G', quality: 'dom7', symbol: '7', strings: [2, 1, 2, 0] }, // 0212
  { root: 'A', quality: 'dom7', symbol: '7', strings: [0, 0, 1, 0] }, // 0100
  { root: 'D', quality: 'dom7', symbol: '7', strings: [3, 2, 2, 2] }, // 2223
  { root: 'E', quality: 'dom7', symbol: '7', strings: [2, 0, 2, 1] }, // 1202
  { root: 'B', quality: 'dom7', symbol: '7', strings: [2, 2, 3, 2] }, // 2322
  { root: 'F', quality: 'dom7', symbol: '7', strings: [3, 1, 3, 2] }, // 2313

  // --- Minor 7th ---
  { root: 'A', quality: 'm7', symbol: 'm7', strings: [0, 0, 0, 0] }, // 0000
  { root: 'D', quality: 'm7', symbol: 'm7', strings: [3, 1, 2, 2] }, // 2213
  { root: 'E', quality: 'm7', symbol: 'm7', strings: [2, 0, 2, 0] }, // 0202
  { root: 'B', quality: 'm7', symbol: 'm7', strings: [2, 2, 2, 2] }, // 2222
  { root: 'C', quality: 'm7', symbol: 'm7', strings: [3, 3, 3, 3] }, // 3333
  { root: 'G', quality: 'm7', symbol: 'm7', strings: [1, 1, 2, 0] }, // 0211

  // --- Suspended 4th ---
  { root: 'D', quality: 'sus4', symbol: 'sus4', strings: [0, 3, 2, 0] }, // 0230
  { root: 'A', quality: 'sus4', symbol: 'sus4', strings: [0, 0, 2, 2] }, // 2200
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getVoicings(
  instrument: 'guitar' | 'ukulele',
): ChordVoicing[] {
  return instrument === 'guitar' ? GUITAR_VOICINGS : UKULELE_VOICINGS;
}
