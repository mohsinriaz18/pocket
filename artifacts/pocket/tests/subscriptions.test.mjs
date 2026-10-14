import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPremium, trialLabel, renewalLabel } from '../lib/subscriptions.ts';

const now = Date.parse('2026-10-14T12:00:00Z');
const info = (isActive, expirationDate = null) => ({
  entitlements: { active: { premium: { isActive, expirationDate } } },
});
const pkg = (unit = 'DAY', value = 7, amountMicros = 0, cycles = 1) => ({
  product: {
    priceString: '$11.99',
    subscriptionPeriod: 'P1M',
    defaultOption: { freePhase: {
      billingPeriod: { unit, value },
      billingCycleCount: cycles,
      price: { amountMicros },
    } },
  },
});

test('missing, inactive and expired entitlements cannot unlock Pocket', () => {
  assert.equal(hasPremium(null, now), false);
  assert.equal(hasPremium({ entitlements: { active: {} } }, now), false);
  assert.equal(hasPremium(info(false), now), false);
  assert.equal(hasPremium(info(true, '2026-10-14T12:00:00Z'), now), false);
  assert.equal(hasPremium(info(true, '2026-10-13T12:00:00Z'), now), false);
  assert.equal(hasPremium(info(true, 'invalid'), now), false);
});
test('active paid and trial entitlements unlock until their expiration', () => {
  assert.equal(hasPremium(info(true, '2026-10-21T12:00:00Z'), now), true);
  assert.equal(hasPremium(info(true, null), now), true);
});
test('cancellation retains access through the current paid period', () => {
  const value = info(true, '2026-11-14T12:00:00Z');
  value.entitlements.active.premium.willRenew = false;
  assert.equal(hasPremium(value, now), true);
});
test('only the premium entitlement grants access', () => {
  assert.equal(hasPremium({ entitlements: { active: { other: { isActive: true } } } }, now), false);
});
test('trial text comes from the eligible Google Play free phase', () => {
  assert.equal(trialLabel(pkg()), '7-day free trial');
  assert.equal(trialLabel(pkg('WEEK', 1)), '7-day free trial');
  assert.equal(trialLabel(pkg('DAY', 3)), '3-day free trial');
  assert.equal(trialLabel(pkg('DAY', 7, 1000000)), null);
  assert.equal(trialLabel(pkg('UNKNOWN')), null);
  assert.equal(trialLabel({ product: { defaultOption: null, introPrice: { price: 0 } } }), null);
  assert.equal(trialLabel({ product: { defaultOption: { freePhase: null } } }), null);
});
test('billing intervals use store metadata, not client price constants', () => {
  assert.equal(renewalLabel(pkg()), 'month');
  assert.equal(renewalLabel({ product: { subscriptionPeriod: 'P1Y' } }), 'year');
  assert.equal(renewalLabel({ product: { subscriptionPeriod: null } }), 'billing period');
});
