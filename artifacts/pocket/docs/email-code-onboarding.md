# Email-code onboarding

Pocket keeps password login. New accounts answer four short questions, review their summary, create a password account, then enter the native six-digit Supabase email code. Successful verification creates the persistent Supabase session; there is no second password login before or after purchasing.

## Supabase configuration

Apply the additive migration `supabase/migrations/002_onboarding.sql` after `001_pocket.sql`. It adds private onboarding preferences and the authenticated `complete_onboarding` function; it does not create financial records. The function validates the expected account, saves answers and applies the primary currency in one transaction. Repeating completion never overwrites a currency later changed in Settings.

The signup confirmation email uses `supabase/templates/signup-confirmation.html`, with `{{ .Token }}` rather than a confirmation link. Configure:

- Confirmation subject: `Your Pocket verification code`
- Native email OTP length: **6**
- Keep confirmation required, the existing Resend SMTP sender, and the existing shared expiry.
- SMTP minimum interval remains 60 seconds. The app enforces that minimum locally; project-wide hourly limits may require a longer wait.

OTP length is a shared Supabase setting. Recovery and email-change templates stay link-based and unchanged; the shared token expiry is not shortened. Never disable confirmation to work around delivery failures.

**Compatibility:** Older installed builds only understand link confirmation. Install the updated Android build before testing code signup. This source update does not upload or publish an Android release.

## State and privacy

Only broad preferences, current question, an opaque signup-account binding and the next email-request time are stored in the local draft. Name, email, password and code are not stored there. The Supabase SDK manages its own authenticated session securely as before.

After an interrupted unverified signup, re-enter the email on the verification screen. No email is automatically resent. A signed-in account can save only its own bound draft; switching accounts discards the unrelated draft. Existing users can log in directly without answering the questions again.

If saving fails after verification, Pocket retains the session and displays retry/logout. The paywall becomes available after persistence succeeds. RevenueCat then receives that same Supabase user ID. Purchase cancellation, pending payment and failed restore retain the session without granting unverified access.

## Checks

```sh
pnpm --filter @workspace/pocket run typecheck
node --test artifacts/pocket/tests/*.test.mjs
node artifacts/pocket/tests/onboarding-browser.mjs https://YOUR_EXPO_PREVIEW_HOST
```

The browser check uses Chromium's debugging protocol and intercepted test-only Supabase responses. It sends no real mail and performs no store purchase. It checks question/draft resume, skip/edit behavior, six-digit paste, wrong codes, resend cooldown, save failure/retry, session restart, currency application, account isolation and returning password login. Run `tests/onboarding.sql` only in a disposable local Postgres database with an Auth test fixture and migrations 001/002 installed.

Real inbox receipt and Android keyboard/autofill, Play trial eligibility, renewal prices, purchase, restore and post-purchase dashboard entry require the updated signed Android build installed through the Play testing track. Do not treat browser fixtures or an accepted SMTP request as proof of inbox delivery or a successful purchase.
