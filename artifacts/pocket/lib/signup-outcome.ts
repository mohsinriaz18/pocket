type SignupUser = { identities?: unknown[] | null };
type SignupData = { user: SignupUser | null; session: unknown | null } | null;

export function signupOutcome(data: SignupData, error: unknown) {
  if (error) throw error;
  if (!data?.user) {
    throw new Error('Supabase did not confirm that signup was accepted. Please try again later.');
  }
  if (data.user.identities?.length === 0) {
    throw new Error('An account with this email already exists. Please Log In or reset your password.');
  }
  return { verificationRequired: !data.session };
}
