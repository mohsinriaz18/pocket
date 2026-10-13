# Pocket — Wealth & Expense Tracker

Native Expo personal finance app matching the supplied Pocket onboarding and functional screenshots, using the existing Supabase project for authentication and financial records.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `artifacts/pocket: expo` — managed workflow for the mobile app; do not start Expo manually
- `pnpm --filter @workspace/pocket run typecheck` — mobile TypeScript check
- `node --test artifacts/pocket/tests/finance.test.mjs` — financial calculation tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Pocket runtime: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public client key only)
- The shared API/database scaffold is not Pocket's persistence backend. Do not migrate Pocket data into it.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pocket/app/` — auth, tab and secondary mobile screens
- `artifacts/pocket/providers/PocketProvider.tsx` — Supabase auth and user-scoped data operations
- `artifacts/pocket/lib/finance.ts` — financial calculations and currency conversion
- `artifacts/pocket/constants/theme.ts` — Pocket brand tokens
- `artifacts/pocket/supabase/migrations/001_pocket.sql` — schema, RLS, ownership checks, atomic payment functions
- `artifacts/pocket/supabase/README.md` — owner setup, redirects and remaining live verification
- `artifacts/pocket/docs/reference-inventory.md` — inventory of all 22 functional screenshots

## Architecture decisions

- Supabase direct client access is intentional: the user's explicit stack requires Supabase Auth and PostgreSQL, rather than the generated Express data service.
- Account balances derive from the ledger. Goals earmark savings; they do not create extra net-worth assets.
- Missing exchange rates exclude unconverted records with warnings. Never default to a fabricated FX rate.
- Payment reversal is explicit and atomic. Account/history foreign keys prohibit silent financial-history deletion.

## Product

Onboarding, Supabase email auth and recovery; Home, Accounts, Invest, Goals, More; Bills, Debts & Loans, Reports & export, All activity and Profile & settings. Native financial forms, period filtering, charts, CSV/Excel/PDF export and device reminders.

## User preferences

The functional screenshots govern exact labels and navigation. The onboarding showcase governs branding. No production seed/mock finance data and no unsupported additional product features.

## Gotchas

- A public Supabase key cannot install schema. The owner must run the versioned SQL in the existing project's SQL Editor.
- Google/Apple remain disabled until configured in Supabase and tested with correct native redirects.
- Live sign-in/persistence, recovery links, signed-in UI and device permissions must be checked after owner setup; isolated SQL checks are not proof of production setup.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
