// SVG fretboard generation — runs at build time to produce static SVG markup.
// Parameterized for any fretted instrument (guitar, ukulele, etc.).

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

/** Y padding above/below outermost strings. */
const PAD_Y = 18;

/** Spacing between adjacent strings. */
const STRING_GAP = 38;

/** Compute the Y coordinate for a string index. */
export function stringY(stringIndex: number): number {
  return PAD_Y + stringIndex * STRING_GAP;
}

/** Compute the X coordinate for a note at a given fret. */
export function noteX(fret: number): number {
  return fret === 0
    ? (fretPositions[0] + fretPositions[1]) / 2
    : (fretPositions[fret] + fretPositions[fret + 1]) / 2;
}

/** Compute SVG height for a given string count. */
export function svgHeight(stringCount: number): number {
  return (stringCount - 1) * STRING_GAP + PAD_Y * 2;
}

/** Generate SVG fret lines (vertical). Starts from fret 2; fret 1 (nut) is a separate element. */
export function fretLines(height: number): string {
  return fretPositions
    .slice(2)
    .map(
      (x) =>
        `<line class="fb-fret" x1="${x}" y1="0" x2="${x}" y2="${height}" stroke-width="1"/>`,
    )
    .join('\n      ');
}

/** Generate SVG string lines (horizontal, thicker for lower strings). */
export function stringLines(stringCount: number = 6): string {
  return Array.from({ length: stringCount }, (_, i) => {
    const thickness = 1 + i * 0.4;
    return `<line class="fb-string" x1="0" y1="${stringY(i)}" x2="600" y2="${
      stringY(i)
    }" stroke-width="${thickness}"/>`;
  }).join('\n      ');
}

/** Generate SVG inlay dots at standard fret marker positions. */
export function fretMarkerDots(
  stringCount: number = 6,
  markers: number[] = [3, 5, 7, 9, 12],
  fretCount: number = 13,
): string {
  const h = svgHeight(stringCount);
  return markers
    .filter((fret) => fret < fretCount)
    .map((fret) => {
      const cx = noteX(fret);
      if (fret === 12) {
        // Double dot at fret 12
        let y1: number, y2: number;
        if (stringCount <= 4) {
          // Not enough strings for distinct "between" positions — place on strings 1 and (n-2)
          y1 = stringY(1);
          y2 = stringY(stringCount - 2);
        } else {
          // 5+ strings: between strings 1-2 and (n-3)-(n-2)
          y1 = (stringY(1) + stringY(2)) / 2;
          y2 = (stringY(stringCount - 3) + stringY(stringCount - 2)) / 2;
        }
        return `<circle class="fb-marker" cx="${cx}" cy="${y1}" r="4"/>` +
          `<circle class="fb-marker" cx="${cx}" cy="${y2}" r="4"/>`;
      }
      return `<circle class="fb-marker" cx="${cx}" cy="${h / 2}" r="4"/>`;
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
          noteX(fret)
        }" cy="${stringY(string)}" r="10"/>`;
      }).join('\n      '),
  ).join('\n      ');
}
