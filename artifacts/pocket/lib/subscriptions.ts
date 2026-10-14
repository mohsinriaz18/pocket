import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

export const PREMIUM_ENTITLEMENT = 'premium';

export function hasPremium(info: CustomerInfo | null, now = Date.now()): boolean {
  const entitlement = info?.entitlements.active[PREMIUM_ENTITLEMENT];
  if (!entitlement?.isActive) return false;
  return !entitlement.expirationDate || Date.parse(entitlement.expirationDate) > now;
}

/** Google Play returns only eligible offers in the default subscription option. */
export function trialLabel(pkg: PurchasesPackage): string | null {
  const phase = pkg.product.defaultOption?.freePhase;
  if (!phase || phase.price.amountMicros !== 0) return null;
  const period = phase.billingPeriod;
  const count = period.value * (phase.billingCycleCount ?? 1);
  if (period.unit === 'WEEK') return `${count * 7}-day free trial`;
  if (period.unit === 'UNKNOWN') return null;
  return `${count}-${period.unit.toLowerCase()} free trial`;
}

export function renewalLabel(pkg: PurchasesPackage): string {
  const interval = pkg.product.subscriptionPeriod;
  if (interval === 'P1Y') return 'year';
  if (interval === 'P1M') return 'month';
  return interval ? `billing period (${interval})` : 'billing period';
}
