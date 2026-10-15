# Pocket Android subscriptions

## Implemented in the app and RevenueCat

- Android package: `com.pocketwealth.app`.
- Supabase user IDs identify RevenueCat customers.
- The `premium` entitlement grants access to all Pocket finance screens.
- The current RevenueCat offering provides monthly and annual packages.
- Purchases, restores, loading/errors, foreground refresh and expiry handling are implemented.
- Signing out clears access; changing accounts cannot reuse another user's access state.
- Canceling auto-renewal does not remove access before the entitlement expires.
- Finance records remain in Supabase when a trial or subscription expires.
- Purchase, restore, cancellation and logout controls remain outside the paid-feature gate.
- Prices and eligible trial details come from the store through RevenueCat. The app does not invent a trial or hardcode a price.

The RevenueCat catalog, current offering and product-to-entitlement mappings have been checked. The user confirmed that the Google Play products were created, RevenueCat's service-account credentials were verified, and an Internal testing release was installed from Google Play.

**Live billing verification is still pending.** RevenueCat currently has no recorded sandbox subscription purchase for this project. Its product API returns no indicative prices, so it cannot confirm the USD prices or seven-day trial. Check these in the Google Play purchase sheet; do not treat a configured catalog or a passing local test as proof of a successful store purchase.

## 1. Check the existing Google Play products

Open Pocket in Google Play Console → **Monetize with Play → Products → Subscriptions**.

| Setting | Monthly | Yearly |
| --- | --- | --- |
| Product ID | `pocket_monthly` | `pocket_yearly` |
| Product name | Pocket Monthly | Pocket Yearly |
| Base plan ID | `monthly` | `yearly` |
| Plan type | Auto-renewing | Auto-renewing |
| Billing period | 1 month | 1 year |
| United States price | USD 11.99 | USD 99.99 |

For each existing product, verify these settings rather than creating a duplicate:

1. Confirm the subscription uses the exact product ID.
2. Confirm its base plan uses the exact base plan ID and billing period.
3. Set the United States price above and choose availability/prices for other countries. Google Play can calculate local prices; review them before saving.
4. Save and **activate** the base plan.
5. Check the offer with ID `trial-7-days`.
6. Choose **New customer acquisition**, restricted to customers who have **never had any subscription in this app**. This prevents claiming a second trial by switching from monthly to yearly.
7. Add a **Free trial** phase lasting **7 days**. Do not add a paid introductory phase.
8. Save and **activate** the offer.

If Play Console requires an uploaded build before subscriptions can be created, upload a signed Android App Bundle for `com.pocketwealth.app` to an internal testing draft first. Do not publish to production just to test subscriptions.

## 2. Connect RevenueCat to the store

In RevenueCat, open Pocket's Google Play app and complete the **Google Play credentials** setup using RevenueCat's official instructions:

https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials

Grant the service account the required app/order/subscription permissions in Play Console, then securely upload its JSON credential in RevenueCat. The Replit Google Play OAuth connection does not automatically configure RevenueCat's service account.

The catalog is already mapped as follows:

| Store identifier in RevenueCat | Package | Entitlement |
| --- | --- | --- |
| `pocket_monthly:monthly` | `$rc_monthly` | `premium` |
| `pocket_yearly:yearly` | `$rc_annual` | `premium` |

The `default` offering is current. Do not attach a separate trial product; each trial is an offer on the corresponding base plan.

## 3. Build and verify through Google Play

The public Android RevenueCat SDK key is configured in Replit as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Configure this same **public Android SDK key**, plus Pocket's existing public Supabase configuration, in the Android build environment. Never bundle a RevenueCat secret key or Google service-account JSON.

1. [Build a signed Android App Bundle using Pocket's GitHub cloud workflow](android-cloud-build.md) and upload it to **Internal testing**.
2. Add a Google Play license tester and internal tester, accept the testing invitation, and install Pocket **from Google Play** using that account.
3. Sign into Pocket and confirm the localized monthly/yearly prices and eligible 7-day trial disclosure.
4. Use a Google Play test payment method. Confirm the `premium` entitlement unlocks Pocket.
5. Test purchase cancellation, pending payment, restore, signout/account switching, cancellation with access retained, and expiration returning to the paywall.
6. Verify the financial records are unchanged after access expires and after restoring.

Use a **license-testing account** and confirm the purchase sheet offers **Test card, always approves** before proceeding. Internal tester access alone does not guarantee that purchases are free. If a normal payment card or an unexpected charge appears, cancel checkout and check license-testing enrollment.

For each plan, verify the trial duration and the price after the trial in the store sheet. After a successful test purchase, confirm RevenueCat records a sandbox subscription granting `premium`, and Pocket opens its dashboard without requiring another login. Check restore and accelerated expiry separately. A pending or canceled purchase must leave Pocket locked.

Google Play sandbox subscriptions/trials use accelerated test durations; a test trial may end much faster than seven actual days. Expo Go preview purchases are simulated and are **not** proof of Google Play billing or trial behavior. RevenueCat Test Store does not support trial verification.

No release was submitted or approved by this implementation. Check **Publishing overview** and the relevant testing/production track in Play Console for review status. Complete store listing, privacy policy, data safety, app access/reviewer instructions and any account-deletion requirements before requesting production review.

## Current limitations

- Android first, as requested. An iOS bundle ID, RevenueCat iOS app/key and App Store products/offers are not configured.
- Browser preview cannot perform Google Play purchases.
- Access is enforced in the app's navigation. This is not a new server-side subscription policy for direct Supabase API access.
- Live store purchase, restore, USD pricing and trial verification remain pending the licensed Android-device checks above.

## Local checks

```sh
pnpm --filter @workspace/pocket run typecheck
node --test artifacts/pocket/tests/subscriptions.test.mjs artifacts/pocket/tests/android-release.test.mjs
```
