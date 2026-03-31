// InteractiveFretboard — reusable tappable fretboard component.
// Renders a guitar fretboard SVG with tap targets. During collection,
// tapped positions are highlighted. After evaluation, positions are
// colored correct/wrong/missed using the same palette as answer buttons.

import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { fretboardSVG } from '../html-helpers.ts';
import { noteY, stringX } from '../fretboard.ts';
import type { MultiTapEvalResult } from '../declarative/types.ts';

// ---------------------------------------------------------------------------
// Colors — read from CSS custom properties with hardcoded test fallbacks.
// Uses the same semantic tokens as answer button feedback:
//   correct → --color-success (dark green)
//   wrong   → --color-error (red)
//   missed  → --color-success-bg (light green, same as btn-feedback-reveal)
// ---------------------------------------------------------------------------

function readCSSColor(prop: string, fallback: string): string {
  try {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(prop).trim();
    return val || fallback;
  } catch (_) {
    return fallback; // expected in tests
  }
}

// ---------------------------------------------------------------------------
// SVG helpers (imperative DOM mutation for performance)
// ---------------------------------------------------------------------------

function setCircleFill(
  root: HTMLElement,
  posKey: string,
  color: string,
): void {
  const [s, f] = posKey.split('-');
  const circle = root.querySelector(
    'circle.fb-pos[data-string="' + s + '"][data-fret="' + f + '"]',
  ) as SVGElement | null;
  if (circle) circle.style.fill = color;
}

function clearAllCircles(root: HTMLElement): void {
  root.querySelectorAll<SVGElement>('.fb-pos').forEach((c) => {
    c.style.fill = '';
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type InteractiveFretboardProps = {
  /** Callback when user taps a position. Receives "string-fret" key. */
  onTap: (positionKey: string) => void;
  /** Positions tapped so far (highlighted during collection). */
  tappedPositions: ReadonlySet<string>;
  /** Evaluation result (null during collection, populated after submission). */
  evaluated: MultiTapEvalResult | null;
  /** Progress text (e.g., "3 / 8"). */
  progressText: string;
  /** Number of strings (default 6 for guitar). */
  stringCount?: number;
  /** Number of frets including open (default 13 = frets 0-12). */
  fretCount?: number;
  /** String indices to mark as muted (X above nut). Shown only after evaluation. */
  mutedStrings?: ReadonlySet<number>;
};

// ---------------------------------------------------------------------------
// Muted-string X markers — rendered as SVG text elements above the nut.
// ---------------------------------------------------------------------------

const MUTE_MARKER_CLASS = 'fb-mute-marker';
/** Radius of fret-position circles in the SVG (matches fretboard.ts). */
const CIRCLE_R = 14;

function renderMuteMarkers(
  root: HTMLElement,
  mutedStrings: ReadonlySet<number>,
  sc: number,
): void {
  const svg = root.querySelector('svg.fretboard');
  if (!svg) return;
  svg.querySelectorAll('.' + MUTE_MARKER_CLASS).forEach((el) => el.remove());
  const colorMuted = readCSSColor('--color-text-secondary', '#888');
  const cy = noteY(0); // same Y as fret-0 circles
  const half = CIRCLE_R * 0.7; // half-size of X arms
  for (const s of mutedStrings) {
    const cx = stringX(s, sc);
    // Draw an × using two crossing lines, centered on the fret-0 circle position
    const line1 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line',
    );
    const line2 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line',
    );
    for (const ln of [line1, line2]) {
      ln.setAttribute('class', MUTE_MARKER_CLASS);
      ln.setAttribute('stroke', colorMuted);
      ln.setAttribute('stroke-width', '2.5');
      ln.setAttribute('stroke-linecap', 'round');
    }
    line1.setAttribute('x1', String(cx - half));
    line1.setAttribute('y1', String(cy - half));
    line1.setAttribute('x2', String(cx + half));
    line1.setAttribute('y2', String(cy + half));
    line2.setAttribute('x1', String(cx + half));
    line2.setAttribute('y1', String(cy - half));
    line2.setAttribute('x2', String(cx - half));
    line2.setAttribute('y2', String(cy + half));
    svg.appendChild(line1);
    svg.appendChild(line2);
  }
}

function clearMuteMarkers(root: HTMLElement): void {
  root.querySelectorAll('.' + MUTE_MARKER_CLASS).forEach((el) => el.remove());
}

export function InteractiveFretboard(
  {
    onTap,
    tappedPositions,
    evaluated,
    progressText,
    stringCount = 6,
    fretCount = 13,
    mutedStrings,
  }: InteractiveFretboardProps,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const svgHTML = useMemo(
    () => fretboardSVG({ tapTargets: true, stringCount, fretCount }),
    [stringCount, fretCount],
  );

  const handleClick = useCallback((e: MouseEvent) => {
    const el = (e.target as Element).closest(
      '.fb-tap[data-string][data-fret]',
    ) as SVGElement | null;
    if (!el) return;
    const s = el.dataset!.string!;
    const f = el.dataset!.fret!;
    onTap(s + '-' + f);
  }, [onTap]);

  // Sync circle colors imperatively when tapped/evaluated state changes.
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    clearAllCircles(root);
    clearMuteMarkers(root);

    if (evaluated) {
      // After evaluation — same colors as answer button feedback:
      //   correct taps → dark green (--color-success)
      //   wrong taps   → red (--color-error)
      //   missed       → medium green (--color-success-reveal, saturated
      //                   enough to be visible on small fretboard circles)
      const colorOk = readCSSColor('--color-success', '#2e7d32');
      const colorBad = readCSSColor('--color-error', '#d32f2f');
      const colorMissed = readCSSColor('--color-success-reveal', '#66bb6a');
      const tappedSet = new Set(evaluated.perEntry.map((e) => e.positionKey));
      for (const entry of evaluated.perEntry) {
        setCircleFill(
          root,
          entry.positionKey,
          entry.correct ? colorOk : colorBad,
        );
      }
      for (const missed of evaluated.missed) {
        if (!tappedSet.has(missed)) {
          setCircleFill(root, missed, colorMissed);
        }
      }
      // Show muted-string X markers after evaluation
      if (mutedStrings && mutedStrings.size > 0) {
        renderMuteMarkers(root, mutedStrings, stringCount);
      }
    } else {
      // During collection: highlight tapped positions
      const colorSel = readCSSColor(
        '--color-tap-selected',
        'hsl(210, 60%, 50%)',
      );
      for (const posKey of tappedPositions) {
        setCircleFill(root, posKey, colorSel);
      }
    }
  }, [tappedPositions, evaluated, svgHTML, mutedStrings, stringCount]);

  return (
    <div class='interactive-fretboard'>
      <div class='interactive-fretboard-status'>
        <span class='interactive-fretboard-progress'>
          {progressText || '\u00A0'}
        </span>
      </div>
      <div
        ref={wrapperRef}
        onClick={handleClick}
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{ __html: svgHTML }}
      />
    </div>
  );
}
