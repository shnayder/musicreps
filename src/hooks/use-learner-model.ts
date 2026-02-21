// useLearnerModel — Preact hook wrapping the adaptive selector, storage
// adapter, and motor baseline. Provides the learner model for quiz modes.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { AdaptiveSelector, StorageAdapter } from '../types.ts';
import {
  createAdaptiveSelector,
  createLocalStorageAdapter,
  DEFAULT_CONFIG,
  deriveScaledConfig,
} from '../adaptive.ts';

export type LearnerModel = {
  selector: AdaptiveSelector;
  storage: StorageAdapter;
  motorBaseline: number | null;
  /** Apply a new motor baseline (from calibration). Persists to localStorage. */
  applyBaseline: (baseline: number) => void;
  /** Re-read baseline from localStorage (e.g., after another mode calibrated). */
  syncBaseline: () => void;
};

/**
 * Create and manage an adaptive learner model for a quiz mode.
 *
 * @param namespace   Storage namespace for per-item stats (e.g., "guitar")
 * @param allItemIds  All possible item IDs — preloaded on mount
 * @param provider    Calibration provider key (e.g., "button"). Defaults to "button".
 * @param responseCountFn  Optional: expected response count per item (for multi-response modes)
 */
export function useLearnerModel(
  namespace: string,
  allItemIds: string[],
  provider = 'button',
  responseCountFn?: (itemId: string) => number,
): LearnerModel {
  // Stable references — these don't change across renders.
  const storageRef = useRef<StorageAdapter>(null!);
  const selectorRef = useRef<AdaptiveSelector>(null!);
  const baselineRef = useRef<number | null>(null);

  // Create storage + selector once per namespace.
  const model = useMemo(() => {
    const storage = createLocalStorageAdapter(namespace);
    const rcFn = responseCountFn ?? null;
    const selector = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      Math.random,
      rcFn,
    );
    storageRef.current = storage;
    selectorRef.current = selector;
    return { storage, selector };
  }, [namespace]);

  // Preload all item stats on mount.
  useEffect(() => {
    model.storage.preload?.(allItemIds);
  }, [model.storage, allItemIds]);

  // Load motor baseline on mount.
  useEffect(() => {
    const baselineKey = 'motorBaseline_' + provider;
    const legacyKey = 'motorBaseline_' + namespace;
    let stored = localStorage.getItem(baselineKey);
    if (!stored && legacyKey !== baselineKey) {
      stored = localStorage.getItem(legacyKey);
      if (stored) localStorage.setItem(baselineKey, stored); // migrate
    }
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed > 0) {
        baselineRef.current = parsed;
        model.selector.updateConfig(deriveScaledConfig(parsed, DEFAULT_CONFIG));
      }
    }
  }, [model.selector, provider, namespace]);

  return {
    selector: model.selector,
    storage: model.storage,
    get motorBaseline() {
      return baselineRef.current;
    },

    applyBaseline(baseline: number) {
      baselineRef.current = baseline;
      localStorage.setItem('motorBaseline_' + provider, String(baseline));
      model.selector.updateConfig(
        deriveScaledConfig(baseline, DEFAULT_CONFIG),
      );
    },

    syncBaseline() {
      const stored = localStorage.getItem('motorBaseline_' + provider);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed > 0 && parsed !== baselineRef.current) {
          baselineRef.current = parsed;
          model.selector.updateConfig(
            deriveScaledConfig(parsed, DEFAULT_CONFIG),
          );
        }
      }
    },
  };
}
