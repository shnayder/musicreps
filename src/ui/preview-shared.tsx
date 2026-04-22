// Shared infrastructure for preview page: layout scaffolds, fretboard helper,
// mock data selector, and common types.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { NOTES } from '../music-data.ts';
import { fretboardSVG } from '../fretboard.ts';
import type { StatsSelector } from './stats.tsx';
import { CommentArea, CommentBubble } from './preview-comments.tsx';

// ---------------------------------------------------------------------------
// Preview scaffold
// ---------------------------------------------------------------------------

export function Section(
  { title, children, tabId }: {
    title: string;
    children: ComponentChildren;
    tabId?: string;
  },
) {
  return (
    <section class='preview-section'>
      <h3>
        {title}
        {tabId && <CommentBubble tabId={tabId} sectionTitle={title} />}
      </h3>
      <div class='preview-frame'>{children}</div>
      {tabId && <CommentArea tabId={tabId} sectionTitle={title} />}
    </section>
  );
}

export function PreviewGrid({ children }: { children: ComponentChildren }) {
  return <div class='preview-grid'>{children}</div>;
}

// ---------------------------------------------------------------------------
// Fretboard preview helpers
// ---------------------------------------------------------------------------

/** Fretboard SVG rendered via dangerouslySetInnerHTML with post-render coloring. */
export function FretboardPreview(
  { colorCircles }: { colorCircles: (root: HTMLElement) => void },
) {
  const ref = useRef<HTMLDivElement>(null);
  const svgHTML = fretboardSVG();
  useEffect(() => {
    if (ref.current) colorCircles(ref.current);
  }, []);
  return (
    <div
      ref={ref}
      // deno-lint-ignore react-no-danger
      dangerouslySetInnerHTML={{ __html: svgHTML }}
    />
  );
}

// ---------------------------------------------------------------------------
// Mock stats selector for StatsGrid / StatsTable demos
// ---------------------------------------------------------------------------

export function mockSelector(): StatsSelector {
  // Deterministic mock: notes earlier in chromatic scale have higher mastery,
  // mastery decreases with distance, later notes are unseen.
  function mockAuto(noteIdx: number, colIdx: number): number | null {
    if (noteIdx >= 5) return null;
    if (noteIdx === 4 && colIdx > 1) return null;
    return Math.max(0, Math.min(1, 0.95 - noteIdx * 0.12 - colIdx * 0.15));
  }

  const lookup: Record<string, number | null> = {};
  NOTES.forEach((note, ni) => {
    for (let ci = 0; ci < 6; ci++) {
      lookup[`${note.name}+${ci + 1}`] = mockAuto(ni, ci);
      // Bidirectional entries for table demo
      lookup[`${note.name}:fwd`] = mockAuto(ni, 0);
      lookup[`${note.name}:rev`] = mockAuto(ni, 2);
    }
  });

  return {
    getSpeedScore(id: string) {
      return lookup[id] ?? null;
    },
    getFreshness(id: string) {
      const speed = lookup[id];
      if (speed == null) return null;
      return 0.3 + speed * 0.7;
    },
    getStats(_id: string) {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type GroupSel = {
  getSpeedScore: (id: string) => number | null;
  getFreshness: (id: string) => number | null;
};

// ---------------------------------------------------------------------------
// PreviewSkillScreen — forces phase class and layout for quiz state previews
// ---------------------------------------------------------------------------

/** Wrapper that forces skill-screen visibility and constrains height for preview. */
export function PreviewSkillScreen(
  { phase, children }: { phase: string; children: ComponentChildren },
) {
  return (
    <div
      class={`skill-screen phase-${phase}`}
      style={{ display: 'block', minHeight: 0, margin: 0, padding: 0 }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSS helper
// ---------------------------------------------------------------------------

/** Read a CSS custom property value from :root. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
    .trim();
}
