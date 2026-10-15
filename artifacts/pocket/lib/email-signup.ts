type VerificationResponse = {
  data: { user: { id: string } | null; session: unknown | null };
  error: unknown;
};
type EmailVerificationClient = {
  verifyOtp(parameters: { email: string; token: string; type: 'email' }): Promise<VerificationResponse>;
};
type EmailResendClient = {
  resend(parameters: { email: string; type: 'signup' }): Promise<{ error: unknown }>;
};

export function validEmailCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export async function verifySignupCode(client: EmailVerificationClient, email: string, code: string) {
  if (!email.trim()) throw new Error('Enter the email address used for signup.');
  if (!validEmailCode(code)) throw new Error('Enter the six-digit code from your email.');
  const { data, error } = await client.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('Email verification did not establish a session. Please try again.');
  return { userId: data.user.id };
}

export async function resendSignupCode(client: EmailResendClient, email: string) {
  if (!email.trim()) throw new Error('Enter the email address used for signup.');
  const { error } = await client.resend({ type: 'signup', email: email.trim() });
  if (error) throw error;
}
