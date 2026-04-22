// PaywallScreen — shown when the daily free rep limit is reached.
// Displays rep count, upgrade options, and a dismiss button.

import { useCallback, useEffect, useState } from 'preact/hooks';
import { ActionButton } from './action-button.tsx';
import { Stack } from './layout.tsx';
import { Text } from './text.tsx';
import {
  CenteredContent,
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  ScreenLayout,
} from './screen-layout.tsx';
import {
  getEntitlementStatus,
  getFreeDailyLimit,
  refreshEntitlement,
} from '../entitlement.ts';

type Offering = { identifier: string; title: string; priceString: string };

export function PaywallScreen(
  { onDismiss, onUnlocked }: {
    onDismiss: () => void;
    onUnlocked: () => void;
  },
) {
  const status = getEntitlementStatus();
  const repsUsed = status.tier === 'free' ? status.repsUsed : 0;
  const limit = getFreeDailyLimit();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOfferings().then(setOfferings).catch(() => {});
  }, []);

  const handlePurchase = useCallback(async (pkgId: string) => {
    setPurchasing(true);
    setError(null);
    try {
      const mod = '@revenuecat/purchases-' + 'capacitor';
      const { Purchases } = await import(mod);
      const offeringsResult = await Purchases.getOfferings();
      const pkg = offeringsResult.current?.availablePackages?.find(
        (p: { identifier: string }) => p.identifier === pkgId,
      );
      if (!pkg) throw new Error('Package not found');
      await Purchases.purchasePackage({ aPackage: pkg });
      await refreshEntitlement();
      onUnlocked();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Purchase failed';
      if (!msg.includes('cancel')) setError(msg);
    } finally {
      setPurchasing(false);
    }
  }, [onUnlocked]);

  const handleRestore = useCallback(async () => {
    setPurchasing(true);
    setError(null);
    try {
      const mod = '@revenuecat/purchases-' + 'capacitor';
      const { Purchases } = await import(mod);
      await Purchases.restorePurchases();
      await refreshEntitlement();
      onUnlocked();
    } catch {
      setError('No purchases found to restore');
    } finally {
      setPurchasing(false);
    }
  }, [onUnlocked]);

  return (
    <ScreenLayout>
      <LayoutHeader>
        <div />
      </LayoutHeader>
      <LayoutMain scrollable={false}>
        <CenteredContent>
          <Stack gap='region' class='paywall-content'>
            <Stack gap='group' class='paywall-header'>
              <Text role='heading-section' as='h2'>
                Daily limit reached
              </Text>
              <Text role='body' as='p'>
                {`${repsUsed} / ${limit} free reps today`}
              </Text>
              <Text role='body-secondary' as='p'>
                Nice work! Upgrade for unlimited practice.
              </Text>
            </Stack>

            {offerings.length > 0 && (
              <Stack gap='group' class='paywall-offerings'>
                {offerings.map((o) => (
                  <ActionButton
                    key={o.identifier}
                    variant='primary'
                    onClick={() => handlePurchase(o.identifier)}
                    disabled={purchasing}
                  >
                    {`${o.title} — ${o.priceString}`}
                  </ActionButton>
                ))}
              </Stack>
            )}

            {error && (
              <Text role='body-secondary' as='p' class='paywall-error'>
                {error}
              </Text>
            )}

            <button
              type='button'
              class='text-link paywall-restore'
              onClick={handleRestore}
              disabled={purchasing}
            >
              Restore purchases
            </button>
          </Stack>
        </CenteredContent>
      </LayoutMain>
      <LayoutFooter>
        <ActionButton
          variant='secondary'
          onClick={onDismiss}
        >
          Done for today
        </ActionButton>
      </LayoutFooter>
    </ScreenLayout>
  );
}

async function loadOfferings(): Promise<Offering[]> {
  try {
    const mod = '@revenuecat/purchases-' + 'capacitor';
    const { Purchases } = await import(mod);
    const result = await Purchases.getOfferings();
    const pkgs = result.current?.availablePackages ?? [];
    return pkgs.map(
      (
        p: {
          identifier: string;
          product: { title: string; priceString: string };
        },
      ) => ({
        identifier: p.identifier,
        title: p.product.title,
        priceString: p.product.priceString,
      }),
    );
  } catch {
    return [];
  }
}
