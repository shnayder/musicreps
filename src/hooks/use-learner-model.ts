// useLearnerModel — Preact hook wrapping the adaptive selector, storage
// adapter, and motor baseline. Provides the learner model for quiz skills.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import type {
  AdaptiveSelector,
  MotorTaskType,
  StorageAdapter,
} from '../types.ts';
import {
  createAdaptiveSelector,
  createStorageAdapter,
  DEFAULT_CONFIG,
  deriveScaledConfig,
} from '../adaptive.ts';
import { storage } from '../storage.ts';

export type LearnerModel = {
  selector: AdaptiveSelector;
  storage: StorageAdapter;
  motorBaseline: number | null;
  /** Apply a new motor baseline (from calibration). Persists to storage. */
  applyBaseline: (baseline: number) => void;
  /** Re-read baseline from storage (e.g., after another skill calibrated). */
  syncBaseline: () => void;
};

/**
 * Create and manage an adaptive learner model for a quiz skill.
 *
 * @param namespace   Storage namespace for per-item stats (e.g., "guitar")
 * @param allItemIds  All possible item IDs — preloaded on mount
 * @param taskType    Motor task type for baseline storage key. Defaults to "note-button".
 * @param responseCountFn  Optional: expected response count per item (for multi-response skills)
 */
export function useLearnerModel(
  namespace: string,
  allItemIds: string[],
  taskType: MotorTaskType = 'note-button',
  responseCountFn?: (itemId: string) => number,
): LearnerModel {
  // Stable references — these don't change across renders.
  const storageRef = useRef<StorageAdapter>(null!);
  const selectorRef = useRef<AdaptiveSelector>(null!);
  const baselineRef = useRef<number | null>(null);

  const storageKey = 'motorBaseline_' + taskType;

  // Create storage + selector once per namespace.
  const model = useMemo(() => {
    const storage = createStorageAdapter(namespace);
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
    try {
      const stored = storage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed > 0) {
          baselineRef.current = parsed;
          model.selector.updateConfig(
            deriveScaledConfig(parsed, DEFAULT_CONFIG),
          );
        }
      }
    } catch (_) { /* storage unavailable */ }
  }, [model.selector, storageKey]);

  return {
    selector: model.selector,
    storage: model.storage,
    get motorBaseline() {
      return baselineRef.current;
    },

    applyBaseline(baseline: number) {
      baselineRef.current = baseline;
      try {
        storage.setItem(storageKey, String(baseline));
      } catch (_) { /* storage unavailable */ }
      model.selector.updateConfig(
        deriveScaledConfig(baseline, DEFAULT_CONFIG),
      );
    },

    syncBaseline() {
      try {
        const stored = storage.getItem(storageKey);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (parsed > 0 && parsed !== baselineRef.current) {
            baselineRef.current = parsed;
            model.selector.updateConfig(
              deriveScaledConfig(parsed, DEFAULT_CONFIG),
            );
          }
        }
      } catch (_) { /* storage unavailable */ }
    },
  };
}
