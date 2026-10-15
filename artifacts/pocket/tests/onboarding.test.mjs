import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyOnboardingDraft, parseOnboardingDraft, onboardingBelongsTo, cooldownSeconds, onboardingSummary } from '../lib/onboarding.ts';
import { verifySignupCode, resendSignupCode } from '../lib/email-signup.ts';
import { verificationErrorMessage } from '../lib/auth-errors.ts';

const uid = '11111111-1111-4111-8111-111111111111';
test('draft resume whitelists only preferences, step, account binding and cooldown', () => {
  const value = { ...emptyOnboardingDraft(), step: 4, ready: true, ownerId: uid,
    answers: { goal: 'saving', challenge: 'consistency', frequency: 'weekly', currency: 'USD', password: 'not-retained' },
    email: 'not-retained', password: 'not-retained', code: 'not-retained' };
  const parsed = parseOnboardingDraft(JSON.stringify(value));
  assert.equal(parsed.step, 4);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.answers.currency, 'USD');
  assert.equal(JSON.stringify(parsed).includes('not-retained'), false);
});
test('malformed drafts fail explicitly and unknown choices cannot complete setup', () => {
  assert.throws(() => parseOnboardingDraft('{'), SyntaxError);
  assert.throws(() => parseOnboardingDraft('{"version":2}'), /could not be read/);
  const parsed = parseOnboardingDraft(JSON.stringify({ ...emptyOnboardingDraft(), ready: true,
    answers: { goal: 'invented', currency: 'fake' }, ownerId: 'invalid-id' }));
  assert.equal(parsed.ready, false);
  assert.equal(parsed.ownerId, null);
  assert.equal(parsed.answers.currency, 'PKR');
});
test('a verified session can finish only its own completed draft', () => {
  const draft = { ...emptyOnboardingDraft(), ready: true, ownerId: uid,
    answers: { goal: 'saving', challenge: null, frequency: null, currency: 'USD' } };
  assert.equal(onboardingBelongsTo(draft, uid), true);
  assert.equal(onboardingBelongsTo(draft, null), false);
  assert.equal(onboardingBelongsTo(draft, '22222222-2222-4222-8222-222222222222'), false);
  assert.equal(onboardingBelongsTo({ ...draft, ready: false }, uid), false);
  assert.equal(onboardingBelongsTo({ ...draft, ownerId: null }, uid), false);
});
test('cooldown survives reloads and expires by clock rather than timer ticks', () => {
  const draft = parseOnboardingDraft(JSON.stringify({ ...emptyOnboardingDraft(), nextEmailAt: 61_000 }), 1_000);
  assert.equal(cooldownSeconds(draft.nextEmailAt, 1_000), 60);
  assert.equal(cooldownSeconds(draft.nextEmailAt, 60_001), 1);
  assert.equal(cooldownSeconds(draft.nextEmailAt, 70_000), 0);
});
test('summary uses actual goal, challenge, frequency and currency', () => {
  const summary = onboardingSummary({ goal: 'debt', challenge: 'planning', frequency: 'weekly', currency: 'EUR' });
  assert.match(summary.focus, /repayments/);
  assert.match(summary.challenge, /budgets/);
  assert.match(summary.tracking, /weekly/);
  assert.equal(summary.currency, 'EUR');
});
test('six-digit pasted codes use native email verification once, preserving its session', async () => {
  const calls = [];
  const client = { verifyOtp: async args => {
    calls.push(args);
    return { data: { user: { id: uid }, session: { access_token: 'test-only' } }, error: null };
  } };
  assert.deepEqual(await verifySignupCode(client, ' test@example.invalid ', ' 123456 '), { userId: uid });
  assert.deepEqual(calls, [{ email: 'test@example.invalid', token: '123456', type: 'email' }]);
});
test('invalid local codes never call Supabase', async () => {
  let calls = 0;
  const client = { verifyOtp: async () => { calls++; throw new Error('must not call'); } };
  for (const code of ['1234', '12345678', '12a456', '']) {
    await assert.rejects(verifySignupCode(client, 'test@example.invalid', code), /six-digit/);
  }
  assert.equal(calls, 0);
});
test('failed or incomplete verification cannot report a signed-in result or retry itself', async () => {
  let calls = 0;
  const error = { code: 'otp_expired', message: 'Token has expired or is invalid' };
  await assert.rejects(verifySignupCode({ verifyOtp: async () => {
    calls++; return { data: { user: null, session: null }, error };
  } }, 'test@example.invalid', '123456'), e => e === error);
  assert.equal(calls, 1);
  await assert.rejects(verifySignupCode({ verifyOtp: async () => ({
    data: { user: { id: uid }, session: null }, error: null,
  }) }, 'test@example.invalid', '123456'), /did not establish a session/);
});
test('resend explicitly targets signup only; no passwordless login or automatic retry', async () => {
  const calls = [];
  await resendSignupCode({ resend: async args => { calls.push(args); return { error: null }; } }, ' test@example.invalid ');
  assert.deepEqual(calls, [{ email: 'test@example.invalid', type: 'signup' }]);
  const error = { code: 'over_email_send_rate_limit' };
  await assert.rejects(resendSignupCode({ resend: async () => ({ error }) }, 'test@example.invalid'), e => e === error);
});
test('wrong, expired, offline and throttled code errors have actionable messages', () => {
  assert.match(verificationErrorMessage({ code: 'otp_expired' }), /incorrect or has expired/);
  assert.match(verificationErrorMessage(new Error('Failed to fetch')), /connection/);
  assert.match(verificationErrorMessage({ code: 'over_email_send_rate_limit' }), /hourly allowance/);
  assert.match(verificationErrorMessage({ status: 429 }), /Too many attempts/);
});
