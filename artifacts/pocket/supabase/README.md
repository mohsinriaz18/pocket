# Connect the existing Supabase project

The initial Pocket migration was installed in the existing project on 2026-10-13 through the Supabase Management API. You do not need to run it manually again. See `../docs/verification.md` for confirmed schema checks and remaining authenticated/device checks. The setup instructions below are retained for a fresh project.

1. Open `https://patgnylktkowlrfgwkoe.supabase.co`'s project dashboard. In SQL Editor run the complete `migrations/001_pocket.sql` file. The app public key cannot create schema, so this is a required owner action. It creates no sample financial records.
2. In Authentication → URL Configuration allow `pocket://`, `pocket://reset-password`, the actual Expo Go development redirect, and the mobile web preview reset URL. Expo development redirect is produced by `Linking.createURL('/reset-password')` and differs from a standalone app. Configure the actual deployed redirect before release.
3. Enable Email authentication, email confirmations, and an appropriate password policy. Configure SMTP for reliable verification and reset email delivery.
4. Public runtime settings: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/legacy anon key). Both are intended for the client bundle; they grant no privileged access. Never add a service-role key to an `EXPO_PUBLIC_` variable.
5. Google and Apple are deliberately disabled until Supabase provider configuration and native redirects are supplied. No social sign-in is simulated.
6. Cross-currency totals only use persisted, user-owned exchange rates. Add verified rates via the SQL Editor if conversion is needed; no implicit default FX rate exists. Same-currency transfers are atomic single-ledger records. Cross-currency transfers are rejected rather than invented.
7. Account deletion with history is blocked by foreign keys. Bills/debts with linked payments are also protected. Delete or amend linked records explicitly; never silently erase financial history.

## Data rules

- User IDs come from authenticated Supabase sessions and are checked by RLS. Composite foreign keys prevent cross-user account, investment, bill, and debt associations.
- Accounts are opening balances plus the ledger, not separately maintained balance caches.
- Transfers do not count as income or spending. Investment valuations and goal changes do not create cash flow.
- Net worth includes signed account balances, current investments, loans receivable, and debts owed. Goals earmark existing savings and are not added as new assets.
- Bill payments and debt repayments use SQL transactions and row locks. Repeated bill payments for a recurrence period are rejected. Payment deletion or edits reconcile the related balances.
- Money is PostgreSQL `numeric`, not floating-point database storage. App calculations round only for display.
- Portfolio and net-worth summaries are current snapshots. Report periods filter actual cash-flow entries, not the entire current balance sheet.

## Verification still required after owner setup

Create two test users and verify RLS isolation, email verification/recovery, CRUD reload across devices, cash-in/out/transfer reconciliation, bill duplicate prevention, debt repayment reversal, investment valuation history, export files and physical-device reminders. The signed-in UI cannot be fully verified until schema is installed and a test session exists.
