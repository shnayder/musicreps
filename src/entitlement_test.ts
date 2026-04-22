import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyRepsStore } from './effort.ts';
import { toLocalDateString } from './effort.ts';
import {
  _resetEntitlement,
  getEntitlementStatus,
  getFreeDailyLimit,
  initEntitlement,
  isLimitReached,
  isPremium,
} from './entitlement.ts';
import { storage } from './storage.ts';

function memoryDailyStore(repsToday: number): DailyRepsStore {
  const today = toLocalDateString(new Date());
  const data: Record<string, number> = repsToday > 0
    ? { [today]: repsToday }
    : {};
  return {
    read: () => JSON.stringify(data),
    write: () => {},
  };
}

function reset(): void {
  _resetEntitlement();
  storage.removeItem('premium_override');
  storage.removeItem('entitlement_premium');
}

describe('entitlement', () => {
  describe('web platform (not native)', () => {
    it('always returns premium', () => {
      reset();
      initEntitlement(false);
      const status = getEntitlementStatus(memoryDailyStore(999));
      assert.equal(status.tier, 'premium');
    });

    it('isPremium returns true', () => {
      reset();
      initEntitlement(false);
      assert.equal(isPremium(), true);
    });

    it('isLimitReached returns false even with high reps', () => {
      reset();
      initEntitlement(false);
      assert.equal(isLimitReached(memoryDailyStore(999)), false);
    });
  });

  describe('native platform, free tier', () => {
    it('returns free with correct rep count', () => {
      reset();
      initEntitlement(true);
      const status = getEntitlementStatus(memoryDailyStore(50));
      assert.equal(status.tier, 'free');
      if (status.tier === 'free') {
        assert.equal(status.repsUsed, 50);
        assert.equal(status.repsLimit, 200);
        assert.equal(status.limitReached, false);
      }
    });

    it('limit not reached at 199', () => {
      reset();
      initEntitlement(true);
      assert.equal(isLimitReached(memoryDailyStore(199)), false);
    });

    it('limit reached at 200', () => {
      reset();
      initEntitlement(true);
      assert.equal(isLimitReached(memoryDailyStore(200)), true);
    });

    it('limit reached above 200', () => {
      reset();
      initEntitlement(true);
      assert.equal(isLimitReached(memoryDailyStore(250)), true);
    });

    it('zero reps is not reached', () => {
      reset();
      initEntitlement(true);
      assert.equal(isLimitReached(memoryDailyStore(0)), false);
    });
  });

  describe('native platform, premium', () => {
    it('returns premium when cached', () => {
      reset();
      storage.setItem('entitlement_premium', 'true');
      initEntitlement(true);
      const status = getEntitlementStatus(memoryDailyStore(999));
      assert.equal(status.tier, 'premium');
    });

    it('isLimitReached returns false', () => {
      reset();
      storage.setItem('entitlement_premium', 'true');
      initEntitlement(true);
      assert.equal(isLimitReached(memoryDailyStore(999)), false);
    });
  });

  describe('custom limit via URL param', () => {
    it('overrides default limit', () => {
      reset();
      initEntitlement(true, 5);
      assert.equal(getFreeDailyLimit(), 5);
      assert.equal(isLimitReached(memoryDailyStore(4)), false);
      assert.equal(isLimitReached(memoryDailyStore(5)), true);
    });
  });

  describe('dev override', () => {
    it('override=free forces free tier on web', () => {
      reset();
      initEntitlement(false);
      storage.setItem('premium_override', 'free');
      const status = getEntitlementStatus(memoryDailyStore(200));
      assert.equal(status.tier, 'free');
      if (status.tier === 'free') {
        assert.equal(status.limitReached, true);
      }
    });

    it('override=free forces limit check on web with custom limit', () => {
      reset();
      initEntitlement(false, 3);
      storage.setItem('premium_override', 'free');
      assert.equal(isLimitReached(memoryDailyStore(2)), false);
      assert.equal(isLimitReached(memoryDailyStore(3)), true);
    });
  });

  describe('daily reset', () => {
    it('new day has zero reps', () => {
      reset();
      initEntitlement(true);
      const emptyStore: DailyRepsStore = {
        read: () => JSON.stringify({ '2025-01-01': 300 }),
        write: () => {},
      };
      assert.equal(isLimitReached(emptyStore), false);
    });
  });
});
