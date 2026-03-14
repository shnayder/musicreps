// Hook: computes progress data for all modes on the home screen.
// Returns a Map<modeId, ModeProgress> recomputed on mount and on navigate-home.

import { useEffect, useState } from 'preact/hooks';
import type { AdaptiveSelector, StorageAdapter } from '../types.ts';
import {
  createAdaptiveSelector,
  createLocalStorageAdapter,
  deriveScaledConfig,
} from '../adaptive.ts';
import {
  MODE_PROGRESS_MANIFEST,
  type ModeProgressEntry,
} from '../mode-progress-manifest.ts';
import {
  getSpeedFreshnessColor,
  getStatsCellColorMerged,
} from '../stats-display.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeProgress = {
  groupColors: string[]; // one HSL string per group, sorted descending by automaticity
};

// ---------------------------------------------------------------------------
// Pure computation (no hooks — testable)
// ---------------------------------------------------------------------------

/** Average automaticity across items (unseen → 0). Used for sort order. */
function averageAutomaticity(
  selector: Pick<AdaptiveSelector, 'getAutomaticity'>,
  itemIds: string[],
): number {
  if (itemIds.length === 0) return 0;
  let sum = 0;
  for (const id of itemIds) {
    sum += selector.getAutomaticity(id) ?? 0;
  }
  return sum / itemIds.length;
}

/**
 * Load skipped group indices from localStorage.
 * Convention: key = `{namespace}_enabledGroups_skipped`.
 * Format: [[index, reason], ...] where reason is 'mastered' | 'deferred'.
 */
export function loadSkippedGroups(namespace: string): ReadonlySet<number> {
  try {
    const raw = localStorage.getItem(namespace + '_enabledGroups_skipped');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const result = new Set<number>();
    for (const entry of parsed) {
      // New format: [[index, reason], ...]
      if (Array.isArray(entry) && typeof entry[0] === 'number') {
        result.add(entry[0]);
      } else if (typeof entry === 'number') {
        // Old format: [index, ...]
        result.add(entry);
      }
    }
    return result;
  } catch (_) { /* expected */ }
  return new Set();
}

/** Compute progress for a single mode, filtering out skipped groups. */
export function computeProgressForMode(
  entry: ModeProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedGroups?: ReadonlySet<number>,
): ModeProgress {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(storage, cfg);

  // Compute per-group color + automaticity, then sort descending
  type Segment = { color: string; auto: number };
  let segments: Segment[];

  if (entry.groups !== null) {
    segments = [];
    for (let i = 0; i < entry.groups.length; i++) {
      if (skippedGroups?.has(i)) continue;
      const ids = entry.groups[i].getItemIds();
      segments.push({
        color: getStatsCellColorMerged(selector, ids),
        auto: averageAutomaticity(selector, ids),
      });
    }
  } else {
    const ids = entry.allItemIds();
    segments = [{
      color: getStatsCellColorMerged(selector, ids),
      auto: averageAutomaticity(selector, ids),
    }];
  }

  // All groups skipped → single "unseen" segment
  if (segments.length === 0) {
    return { groupColors: [getSpeedFreshnessColor(null, null)] };
  }

  segments.sort((a, b) => b.auto - a.auto);
  return { groupColors: segments.map((s) => s.color) };
}

/** Compute progress for all modes. Exported for testing. */
export function computeAllProgress(
  createStorage: (ns: string) => StorageAdapter = createLocalStorageAdapter,
  motorBaseline: number | null = null,
  getSkipped: (ns: string) => ReadonlySet<number> = loadSkippedGroups,
): Map<string, ModeProgress> {
  const result = new Map<string, ModeProgress>();
  for (const entry of MODE_PROGRESS_MANIFEST) {
    const skipped = entry.groups !== null
      ? getSkipped(entry.namespace)
      : undefined;
    result.set(
      entry.modeId,
      computeProgressForMode(
        entry,
        createStorage(entry.namespace),
        motorBaseline,
        skipped,
      ),
    );
  }
  return result;
}

/** Read motor baseline from localStorage (with NaN guard). */
function readMotorBaseline(): number | null {
  try {
    const raw = localStorage.getItem('motorBaseline_button');
    if (raw) {
      const n = Number(raw);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch (_) { /* expected */ }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Computes progress data for all modes. Recomputes when the home screen
 * becomes visible (via MutationObserver on #home-screen class changes).
 */
export function useHomeProgress(): Map<string, ModeProgress> {
  const [progress, setProgress] = useState<Map<string, ModeProgress>>(
    () => computeAllProgress(createLocalStorageAdapter, readMotorBaseline()),
  );

  useEffect(() => {
    const el = document.getElementById('home-screen');
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!el.classList.contains('hidden')) {
        setProgress(
          computeAllProgress(createLocalStorageAdapter, readMotorBaseline()),
        );
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return progress;
}
