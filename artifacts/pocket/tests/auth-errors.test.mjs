import test from 'node:test';
import assert from 'node:assert/strict';
import { signupErrorMessage } from '../lib/auth-errors.ts';

test('email confirmation throttles explain the Resend SMTP next step', () => {
  const message = signupErrorMessage({
    code: 'over_email_send_rate_limit',
    message: 'Email rate limit exceeded',
    status: 429,
  });

  assert.match(message, /temporarily limited signup confirmation emails/i);
  assert.match(message, /verified Resend sender/i);
  assert.match(message, /did not automatically retry/i);
});

test('request throttles give a retry-later message without implying an email issue', () => {
  const message = signupErrorMessage({
    code: 'over_request_rate_limit',
    message: 'Too many requests',
    status: 429,
  });

  assert.match(message, /too many signup attempts/i);
  assert.doesNotMatch(message, /Resend/);
});

test('non-throttle signup failures keep their useful Supabase explanation', () => {
  assert.equal(
    signupErrorMessage({ message: 'Password should be at least 8 characters' }),
    'Password should be at least 8 characters',
  );
});

test('unknown signup failures have a safe fallback', () => {
  assert.equal(signupErrorMessage(null), 'Could not create your account. Please try again.');
});
