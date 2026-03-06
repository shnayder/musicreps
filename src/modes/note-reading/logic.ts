// Note Reading mode — identify notes on treble and bass clef staves.
// Natural notes only (no accidentals). Groups progress from on-staff
// to increasingly distant ledger lines, treble first then bass.

// --- Types ---

export interface Question {
  itemId: string;
  clef: 'treble' | 'bass';
  letter: string;
  octave: number;
  abc: string;
}

// --- Helpers ---

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Convert scientific pitch (e.g. 'C', 4) to ABC notation (e.g. 'C'). */
export function pitchToAbc(letter: string, octave: number): string {
  if (octave >= 5) {
    return letter.toLowerCase() + "'".repeat(octave - 5);
  }
  if (octave === 4) return letter;
  return letter + ','.repeat(4 - octave);
}

function makeId(
  clef: 'treble' | 'bass',
  letter: string,
  octave: number,
): string {
  return `${clef === 'treble' ? 't' : 'b'}:${letter}${octave}`;
}

export function parseItemId(
  id: string,
): { clef: 'treble' | 'bass'; letter: string; octave: number } {
  const clef = id[0] === 't' ? 'treble' as const : 'bass' as const;
  const letter = id[2];
  const octave = parseInt(id.slice(3));
  return { clef, letter, octave };
}

/** Build a complete ABC string for rendering a single note on a staff. */
export function buildAbcString(
  clef: 'treble' | 'bass',
  letter: string,
  octave: number,
): string {
  const clefStr = clef === 'bass' ? ' clef=bass' : '';
  const abcNote = pitchToAbc(letter, octave);
  return `X:1\nM:none\nL:1\nK:C${clefStr}\n${abcNote}`;
}

// --- Note positions per group ---
// Each array lists notes from low to high within the group.

// Treble clef — staff lines: E4 G4 B4 D5 F5
const TREBLE_STAFF = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];

// 1-2 ledger lines: below (D4 space, C4 line, B3 space, A3 line)
//                   above (G5 space, A5 line, B5 space, C6 line)
const TREBLE_NEAR = ['A3', 'B3', 'C4', 'D4', 'G5', 'A5', 'B5', 'C6'];

// 3-6 ledger lines
const TREBLE_FAR = [
  'G2',
  'A2',
  'B2',
  'C3',
  'D3',
  'E3',
  'F3',
  'G3',
  'D6',
  'E6',
  'F6',
  'G6',
  'A6',
  'B6',
  'C7',
  'D7',
];

// Bass clef — staff lines: G2 B2 D3 F3 A3
const BASS_STAFF = ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'];

const BASS_NEAR = ['C2', 'D2', 'E2', 'F2', 'B3', 'C4', 'D4', 'E4'];

const BASS_FAR = [
  'B0',
  'C1',
  'D1',
  'E1',
  'F1',
  'G1',
  'A1',
  'B1',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
];

function withClef(clef: 'treble' | 'bass', notes: string[]): string[] {
  return notes.map((n) => makeId(clef, n[0], parseInt(n.slice(1))));
}

const GROUP_ITEMS = [
  withClef('treble', TREBLE_STAFF),
  withClef('treble', TREBLE_NEAR),
  withClef('treble', TREBLE_FAR),
  withClef('bass', BASS_STAFF),
  withClef('bass', BASS_NEAR),
  withClef('bass', BASS_FAR),
];

// --- Exports ---

export const GROUPS = [
  { label: 'Treble: staff' },
  { label: 'Treble: \u00b11\u20132' },
  { label: 'Treble: \u00b13\u20136' },
  { label: 'Bass: staff' },
  { label: 'Bass: \u00b11\u20132' },
  { label: 'Bass: \u00b13\u20136' },
];

export const ALL_GROUP_INDICES = GROUPS.map((_, i) => i);
export const ALL_ITEMS: string[] = GROUP_ITEMS.flat();

export function getItemIdsForGroup(groupIndex: number): string[] {
  return GROUP_ITEMS[groupIndex];
}

// --- Question generation ---

export function getQuestion(itemId: string): Question {
  const { clef, letter, octave } = parseItemId(itemId);
  return {
    itemId,
    clef,
    letter,
    octave,
    abc: buildAbcString(clef, letter, octave),
  };
}

// --- Answer checking ---

export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  return {
    correct: input.toUpperCase() === q.letter,
    correctAnswer: q.letter,
  };
}

// --- Stats grid ---

export const GRID_ROW_LABELS = LETTERS;
export const GRID_NOTES = LETTERS.map((n) => ({ name: n, displayName: n }));
export const GRID_COL_LABELS = [
  'T\u266e',
  'T\u00b12',
  'T\u00b16',
  'B\u266e',
  'B\u00b12',
  'B\u00b16',
];

export function getGridItemId(rowLabel: string, colIdx: number): string[] {
  return GROUP_ITEMS[colIdx].filter((id) => id[2] === rowLabel);
}
