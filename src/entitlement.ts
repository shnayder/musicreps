// Entitlement: daily rep limit for free-tier users on native builds.
// Web always returns unlimited (no paywall). Native checks RevenueCat
// entitlement + daily rep count. Pure logic separated from SDK calls.

import { getDailyReps, toLocalDateString } from './effort.ts';
import type { DailyRepsStore } from './effort.ts';
import { storage } from './storage.ts';

const DEFAULT_DAILY_LIMIT = 200;
const PREMIUM_KEY = 'entitlement_premium';
const OVERRIDE_KEY = 'premium_override';

let _isPremium = false;
let _isNative = false;
let _limitOverride: number | null = null;

export type EntitlementStatus =
  | { tier: 'premium' }
  | {
    tier: 'free';
    repsUsed: number;
    repsLimit: number;
    limitReached: boolean;
  };

export function initEntitlement(
  isNative: boolean,
  limitOverride?: number | null,
): void {
  _isNative = isNative;
  _limitOverride = limitOverride ?? null;
  if (isNative) {
    _isPremium = storage.getItem(PREMIUM_KEY) === 'true';
  }
}

export async function refreshEntitlement(): Promise<void> {
  if (!_isNative) return;
  if (storage.getItem(OVERRIDE_KEY) === 'premium') {
    _isPremium = true;
    return;
  }
  if (storage.getItem(OVERRIDE_KEY) === 'free') {
    _isPremium = false;
    return;
  }
  try {
    const mod = '@revenuecat/purchases-' + 'capacitor';
    const { Purchases } = await import(mod);
    const info = await Purchases.getCustomerInfo();
    const hasActive = Object.keys(
      info.customerInfo.entitlements.active,
    ).length > 0;
    _isPremium = hasActive;
    storage.setItem(PREMIUM_KEY, String(hasActive));
  } catch {
    // Keep cached value on failure
  }
}

export function getFreeDailyLimit(): number {
  return _limitOverride ?? DEFAULT_DAILY_LIMIT;
}

export function getEntitlementStatus(
  store?: DailyRepsStore,
): EntitlementStatus {
  if (!_isNative && storage.getItem(OVERRIDE_KEY) !== 'free') {
    return { tier: 'premium' };
  }
  if (_isPremium && storage.getItem(OVERRIDE_KEY) !== 'free') {
    return { tier: 'premium' };
  }
  const daily = getDailyReps(store);
  const today = toLocalDateString(new Date());
  const repsUsed = daily[today] ?? 0;
  const limit = getFreeDailyLimit();
  return {
    tier: 'free',
    repsUsed,
    repsLimit: limit,
    limitReached: repsUsed >= limit,
  };
}

export function isPremium(): boolean {
  const status = getEntitlementStatus();
  return status.tier === 'premium';
}

export function isLimitReached(store?: DailyRepsStore): boolean {
  const status = getEntitlementStatus(store);
  return status.tier === 'free' && status.limitReached;
}

export function isNativeApp(): boolean {
  return _isNative;
}

// For testing: reset module state
export function _resetEntitlement(): void {
  _isPremium = false;
  _isNative = false;
  _limitOverride = null;
}
