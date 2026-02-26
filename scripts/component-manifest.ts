// Component screenshot manifest: section slugs from components.html.
// Pure data — no Playwright dependency. Same pattern as screenshot-manifest.ts.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentEntry = {
  name: string; // "comp/buttons", "comp/tabs", etc.
  selector: string; // '[data-component="buttons"]'
};

// ---------------------------------------------------------------------------
// Section list (matches data-component attributes in components.html)
// ---------------------------------------------------------------------------

export const COMPONENT_SECTIONS = [
  'spacing-scale',
  'typography-scale',
  'border-radius',
  'shadows',
  'buttons',
  'toggles',
  'tabs',
  'cards-surfaces',
  'feedback-slots',
  'progress-timing',
  'navigation',
  'fretboard',
  'heatmap-stats',
  'layout-patterns',
  'touch-targets',
  'interaction-motion',
  'phase-visibility',
  'mobile-breakpoint',
  'variant-comparisons',
  'phase3-layout',
] as const;

const COMP_PREFIX = 'comp/';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if `name` starts with the `comp/` prefix. */
export function isComponentName(name: string): boolean {
  return name.startsWith(COMP_PREFIX);
}

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/**
 * Build the component manifest, optionally filtered to only matching names.
 * `only` patterns use substring matching (same as --only in take-screenshots).
 */
export function buildComponentManifest(
  only?: string[] | null,
): ComponentEntry[] {
  let entries: ComponentEntry[] = COMPONENT_SECTIONS.map((slug) => ({
    name: `${COMP_PREFIX}${slug}`,
    selector: `[data-component="${slug}"]`,
  }));

  if (only) {
    entries = entries.filter((e) => only.some((p) => e.name.includes(p)));
  }

  return entries;
}
