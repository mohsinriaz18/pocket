type AuthErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
};

const EMAIL_THROTTLE_MESSAGE =
  'Supabase has temporarily limited signup confirmation emails. Wait a few minutes before trying again. If this keeps happening, the project owner needs to configure a verified Resend sender in Supabase under Authentication → SMTP Settings. Pocket did not automatically retry.';

const REQUEST_THROTTLE_MESSAGE =
  'There have been too many signup attempts. Wait a few minutes before trying again. Pocket did not automatically retry.';

export function signupErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Could not create your account. Please try again.';
  }

  const authError = error as AuthErrorLike;
  const message = typeof authError.message === 'string' ? authError.message : '';
  const code = typeof authError.code === 'string' ? authError.code : '';
  const status = typeof authError.status === 'number' ? authError.status : undefined;
  const details = `${code} ${message}`.toLowerCase();

  if (
    /over_email_send_rate_limit|email_rate_limit_exceeded|email.{0,30}rate.?limit|rate.?limit.{0,30}email|too many emails/.test(details)
  ) {
    return EMAIL_THROTTLE_MESSAGE;
  }

  if (
    status === 429 ||
    /over_request_rate_limit|too many requests|too many signup attempts/.test(details)
  ) {
    return REQUEST_THROTTLE_MESSAGE;
  }

  return message.trim() || 'Could not create your account. Please try again.';
}
