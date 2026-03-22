// InteractiveFretboard — reusable tappable fretboard component.
// Renders a guitar fretboard SVG with tap targets. During collection,
// tapped positions are highlighted. After evaluation, positions are
// colored correct/wrong/missed.

import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { fretboardSVG } from '../html-helpers.ts';
import type { MultiTapEvalResult } from '../declarative/types.ts';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Neutral highlight for tapped-but-not-yet-evaluated positions. */
const TAP_SELECTED = 'hsl(210, 60%, 50%)';

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
      // After evaluation: show correct/wrong/missed
      const tappedSet = new Set(evaluated.perEntry.map((e) => e.positionKey));
      for (const entry of evaluated.perEntry) {
        const color = entry.correct
          ? 'var(--color-success)'
          : 'var(--color-error)';
        setCircleFill(root, entry.positionKey, color);
      }
      for (const missed of evaluated.missed) {
        if (!tappedSet.has(missed)) {
          setCircleFill(root, missed, 'var(--color-warning, #ff9800)');
        }
      }
    } else {
      // During collection: highlight tapped positions
      for (const posKey of tappedPositions) {
        setCircleFill(root, posKey, TAP_SELECTED);
      }
    }
  }, [tappedPositions, evaluated]);

  return (
    <div class='speed-tap-fretboard'>
      {progressText && (
        <div class='speed-tap-status'>
          <span class='speed-tap-progress'>{progressText}</span>
        </div>
      )}
      <div
        ref={wrapperRef}
        onClick={handleClick}
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{ __html: svgHTML }}
      />
    </div>
  );
}
