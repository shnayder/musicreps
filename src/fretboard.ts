// SVG fretboard generation — runs at build time to produce static SVG markup.
// Parameterized for any fretted instrument (guitar, ukulele, etc.).
//
// Orientation: vertical (nut at top). Strings run left-to-right (X axis),
// frets run top-to-bottom (Y axis). This matches a guitar held upright and
// viewed from the front — low strings on the left, high strings on the right.

/** Fret positions along the neck (pixels). Spacing decreases like a real instrument. */
export const fretPositions = [
  0,
  65,
  126,
  183,
  237,
  288,
  336,
  381,
  423,
  463,
  500,
  535,
  568,
  600,
];

/** Maximum fretCount supported by fretPositions (needs positions[fret+1]). */
const MAX_FRET_COUNT = fretPositions.length - 1; // 13

/** X padding left/right of outermost strings. */
const PAD_X = 18;

/** Spacing between adjacent strings (horizontal). */
const STRING_GAP = 50;

/** Compute the X coordinate for a string index (left-to-right, low string first). */
export function stringX(stringIndex: number, stringCount: number): number {
  // Reverse so string 0 (high) is on the right, matching horizontal convention
  // where string 0 was at the top. Low strings (higher index) sit on the left.
  return PAD_X + (stringCount - 1 - stringIndex) * STRING_GAP;
}

/** Compute the Y coordinate for a note at a given fret (nut at top). */
export function noteY(fret: number): number {
  return fret === 0
    ? (fretPositions[0] + fretPositions[1]) / 2
    : (fretPositions[fret] + fretPositions[fret + 1]) / 2;
}

/** Compute SVG width for a given string count. */
export function svgWidth(stringCount: number): number {
  return (stringCount - 1) * STRING_GAP + PAD_X * 2;
}

/** The SVG height is the full fret extent. */
export const SVG_HEIGHT = fretPositions[fretPositions.length - 1]; // 600

/** Generate SVG fret lines (horizontal). Starts from fret 2; fret 1 (nut) is separate. */
export function fretLines(width: number): string {
  return fretPositions
    .slice(2)
    .map(
      (y) =>
        `<line class="fb-fret" x1="0" y1="${y}" x2="${width}" y2="${y}" stroke-width="1"/>`,
    )
    .join('\n      ');
}

/** Generate SVG string lines (vertical, thicker for lower-pitched strings). */
export function stringLines(stringCount: number = 6): string {
  return Array.from({ length: stringCount }, (_, i) => {
    const thickness = 1 + i * 0.4;
    const x = stringX(i, stringCount);
    return `<line class="fb-string" x1="${x}" y1="0" x2="${x}" y2="${SVG_HEIGHT}" stroke-width="${thickness}"/>`;
  }).join('\n      ');
}

/** Generate SVG inlay dots at standard fret marker positions. */
export function fretMarkerDots(
  stringCount: number = 6,
  markers: number[] = [3, 5, 7, 9, 12],
  fretCount: number = 13,
): string {
  const w = svgWidth(stringCount);
  return markers
    .filter((fret) => fret < fretCount)
    .map((fret) => {
      const cy = noteY(fret);
      if (fret === 12) {
        // Double dot at fret 12
        let x1: number, x2: number;
        if (stringCount <= 4) {
          x1 = stringX(1, stringCount);
          x2 = stringX(stringCount - 2, stringCount);
        } else {
          x1 = (stringX(1, stringCount) + stringX(2, stringCount)) / 2;
          x2 = (stringX(stringCount - 3, stringCount) +
            stringX(stringCount - 2, stringCount)) / 2;
        }
        return `<circle class="fb-marker" cx="${x1}" cy="${cy}" r="4"/>` +
          `<circle class="fb-marker" cx="${x2}" cy="${cy}" r="4"/>`;
      }
      return `<circle class="fb-marker" cx="${w / 2}" cy="${cy}" r="4"/>`;
    })
    .join('\n      ');
}

/** Generate SVG position circles — one per fret position, no text. */
export function positionCircles(
  stringCount: number = 6,
  fretCount: number = 13,
): string {
  if (fretCount > MAX_FRET_COUNT) {
    throw new Error(
      `fretCount ${fretCount} exceeds max ${MAX_FRET_COUNT} (fretPositions has ${fretPositions.length} entries)`,
    );
  }
  return Array.from(
    { length: stringCount },
    (_, string) =>
      Array.from({ length: fretCount }, (_, fret) => {
        return `<circle class="fb-pos" data-string="${string}" data-fret="${fret}" cx="${
          stringX(string, stringCount)
        }" cy="${noteY(fret)}" r="14"/>`;
      }).join('\n      '),
  ).join('\n      ');
}
