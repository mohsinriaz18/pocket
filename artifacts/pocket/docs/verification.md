# Verification evidence

## Passed

- Mobile TypeScript check.
- Six deterministic financial calculation tests: cash flow and transfer legs, transaction edit/delete balance reconstruction, net worth without double-counting savings goals, missing FX behavior and explicit conversion, period/category filters, goal progress, recurrence periods and short-month due dates.
- Versioned SQL migration executed successfully in a disposable local PostgreSQL instance with a minimal Supabase-compatible auth schema. No existing development/production database was changed.
- Isolated database checks: paid-bill duplicate prevention and reversal; debt repayment edits/deletes reconcile outstanding amounts; account deletion with history is blocked; changing an account currency cannot reinterpret existing entries; current investment values update separately from original contributions and save history; RLS hides other users' records and rejects cross-owner financial links.
- Expo workflow serves the application. An unauthenticated mobile-size preview rendered the branded introductory screen; browser logs contained no runtime exceptions.
- Supabase authentication settings endpoint responds successfully. Email auth enabled; Google and Apple disabled.
- Live Supabase migration installed successfully through the Management API on 2026-10-13. Preflight confirmed the public schema had no existing tables. All nine Pocket tables have RLS and ownership policies, authenticated CRUD grants, and no anonymous read grants.
- Live catalog checks confirmed numeric monetary columns, the auth-profile creation trigger, and all four financial mutation functions restricted to authenticated users. Public REST endpoints recognize all tables and reject unauthenticated access. No financial seed records were added.

## Not verified / externally blocked

- Full live signup, email confirmation, recovery redirects, login/logout, cross-device CRUD, financial reconciliation and signed-in UI. Schema and privilege verification do not substitute for authenticated workflow checks.
- Social provider configuration and actual Google/Apple sign-in.
- Physical-device notification permissions, reminder scheduling and exports/sharing.
- App Store production builds and submission.

## Limitations to preserve

- Scheduled local reminders are refreshed when the app opens or data is refetched, cover the next 30 days, and skip today if an entry was added. Entries added remotely while a device is closed cannot cancel that device's pending reminder until it synchronizes again. No background service is claimed.
- No live market feed or automatic payment execution is implemented.
- Transfers currently require accounts sharing a currency; no unknown FX rate is silently invented.
- Historical charts reconstruct known records, not missing historical balance snapshots. Current net-worth and portfolio summaries are identified as current snapshots.
- Dates and reminder times use validated text inputs rather than native picker controls.
- Reference inventory entries stay pending live verification; no screen is marked fully complete merely because its UI exists.
