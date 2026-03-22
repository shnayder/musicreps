// InteractiveFretboard — reusable tappable fretboard component.
// Renders a guitar fretboard SVG with tap targets. During collection,
// tapped positions are highlighted. After evaluation, positions are
// colored correct/wrong/missed using the same palette as answer buttons.

import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { fretboardSVG } from '../html-helpers.ts';
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
};

export function InteractiveFretboard(
  {
    onTap,
    tappedPositions,
    evaluated,
    progressText,
    stringCount = 6,
    fretCount = 13,
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
  }, [tappedPositions, evaluated, svgHTML]);

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
