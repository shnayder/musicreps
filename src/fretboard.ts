// SVG fretboard generation — runs at build time to produce static SVG markup.

/** Fret positions along the neck (pixels). Spacing decreases like a real guitar. */
export const fretPositions = [
  0, 65, 126, 183, 237, 288, 336, 381, 423, 463, 500, 535, 568, 600,
];

export const STRING_COUNT = 6;
export const FRET_COUNT = 13; // 0–12

/** Generate SVG fret lines (vertical). */
export function fretLines(): string {
  return fretPositions
    .slice(1)
    .map(
      (x) =>
        `<line x1="${x}" y1="0" x2="${x}" y2="240" stroke="#333" stroke-width="1"/>`,
    )
    .join("\n      ");
}

/** Generate SVG string lines (horizontal, thicker for lower strings). */
export function stringLines(): string {
  return Array.from({ length: STRING_COUNT }, (_, i) => {
    const thickness = 1 + i * 0.5;
    return `<line x1="0" y1="${20 + i * 40}" x2="600" y2="${20 + i * 40}" stroke="#333" stroke-width="${thickness}"/>`;
  }).join("\n      ");
}

/** Generate SVG circles and text elements for every note position. */
export function noteElements(): string {
  return Array.from({ length: STRING_COUNT }, (_, string) =>
    Array.from({ length: FRET_COUNT }, (_, fret) => {
      const x =
        fret === 0
          ? fretPositions[0] + (fretPositions[1] - fretPositions[0]) / 2
          : (fretPositions[fret] + fretPositions[fret + 1]) / 2;
      const y = 20 + string * 40;
      return `<circle
      class="note-circle"
      data-string="${string}"
      data-fret="${fret}"
      cx="${x}"
      cy="${y}"
      r="14"
      fill="white"
      stroke="#333"
      stroke-width="1"
    /><text
      class="note-text"
      data-string="${string}"
      data-fret="${fret}"
      x="${x}"
      y="${y}"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="11"
      fill="#333"
    ></text>`;
    }).join("\n      "),
  ).join("\n      ");
}

/** Fret-number markers (3, 5, 7, 9, 12) positioned as HTML divs. */
export function fretNumberElements(): string {
  const markerFrets = [3, 5, 7, 9, 12];
  return markerFrets
    .map((fret) => {
      const x = (fretPositions[fret] + fretPositions[fret + 1]) / 2;
      const pct = (x / 600) * 100;
      return `<div class="fret-number" style="left: ${pct}%">${fret}</div>`;
    })
    .join("\n    ");
}
