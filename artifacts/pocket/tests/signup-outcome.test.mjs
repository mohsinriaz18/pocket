import test from 'node:test';
import assert from 'node:assert/strict';
import { signupOutcome } from '../lib/signup-outcome.ts';

test('confirmed signup waits for the email confirmation', () => {
  assert.deepEqual(
    signupOutcome({ user: { identities: [{ id: 'identity' }] }, session: null }, null),
    { verificationRequired: true },
  );
});

test('signup with an active session does not require email verification again', () => {
  assert.deepEqual(
    signupOutcome({ user: { identities: [{ id: 'identity' }] }, session: { access_token: 'test-only' } }, null),
    { verificationRequired: false },
  );
});

test('Supabase errors are preserved and are not treated as signup success', () => {
  const error = { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' };
  assert.throws(() => signupOutcome(null, error), (received) => received === error);
});

test('a missing user response is not shown as confirmation-email success', () => {
  assert.throws(
    () => signupOutcome({ user: null, session: null }, null),
    /did not confirm that signup was accepted/,
  );
});

test('an empty identity response keeps the existing-account recovery path', () => {
  assert.throws(
    () => signupOutcome({ user: { identities: [] }, session: null }, null),
    /already exists\. Please Log In or reset your password/,
  );
});
