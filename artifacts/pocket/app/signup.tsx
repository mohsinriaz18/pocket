import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Btn, Field, Banner, Txt, Skeleton } from '@/components/ui';
import { StepShell, Question, TextLink } from '@/components/onboarding-parts';
import { palettes } from '@/constants/theme';
import { useOnboarding } from '@/providers/OnboardingProvider';
import { passwordProblem } from '@/lib/helpers';
import { signupErrorMessage, verificationErrorMessage } from '@/lib/auth-errors';
import { cooldownSeconds } from '@/lib/onboarding';
import { Pressable } from 'react-native';

export default function Signup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ verify?: string }>();
  const verifyMode = params.verify === '1';
  const ob = useOnboarding();
  const { draft } = ob;
  const p = palettes.light;
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [pw, setPw] = useState<string>('');
  const [show, setShow] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [stage, setStage] = useState<'form' | 'verify'>(verifyMode || draft.ownerId ? 'verify' : 'form');
  const [sent, setSent] = useState<boolean>(false); // email held in memory from this session's signup
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!ob.loading && !verifyMode && !draft.ready && !draft.ownerId && stage === 'form') router.replace('/onboarding');
  }, [ob.loading, verifyMode, draft.ready, draft.ownerId, stage, router]);
  useEffect(() => {
    if (!ob.loading && draft.ownerId && stage === 'form' && !busy) setStage('verify');
  }, [ob.loading, draft.ownerId, stage, busy]);

  const cd = cooldownSeconds(draft.nextEmailAt, now);
  const wait = (fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true); setErr(null); setInfo(null);
    try { await fn(); } finally { setBusy(false); }
  };
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const create = wait(async () => {
    if (!name.trim() || !validEmail) return setErr('Enter your name and a valid email address.');
    const pp = passwordProblem(pw);
    if (pp) return setErr(pp);
    if (cd > 0) return setErr(`Please wait ${cd}s before requesting another email.`);
    try {
      const r = await ob.createAccount(name.trim(), email.trim(), pw);
      setPw('');
      if (r.verificationRequired) { setSent(true); setStage('verify'); setCode(''); }
    } catch (e) {
      const m = signupErrorMessage(e);
      setErr(/already|registered|exists/i.test(m) ? `${m} If this is your account, log in instead, or use "I already have a code" if you haven't verified it.` : m);
    }
  });
  const verify = wait(async () => {
    if (!validEmail) return setErr('Enter the email address the code was sent to.');
    if (code.length !== 6) return setErr('Enter the six-digit code.');
    try { await ob.verifyCode(email.trim(), code); setCode(''); } catch (e) { setErr(verificationErrorMessage(e)); }
  });
  const resend = wait(async () => {
    if (!validEmail) return setErr('Enter your email address first.');
    if (cd > 0) return;
    try { await ob.resendCode(email.trim()); setInfo('If your signup is waiting for verification, a new code is on its way. Check your spam folder too.'); } catch (e) { setErr(verificationErrorMessage(e)); }
  });
  const editEmail = wait(async () => {
    try { await ob.changeEmail(); setSent(false); setCode(''); setStage(verifyMode ? 'verify' : 'form'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not change the email.'); }
  });

  if (ob.loading) return <StepShell><Skeleton h={40} w="70%" /><Skeleton h={52} /><Skeleton h={52} /></StepShell>;

  const warn = ob.storageError ? <Banner kind="warn" message={`Your answers may not be remembered if you close the app. ${ob.storageError}`} /> : null;

  if (stage === 'verify') {
    const emailLocked = sent && validEmail;
    return (
      <StepShell logo onBack={!verifyMode && !draft.ownerId && !sent ? () => setStage('form') : undefined} backTestID="signup-back">
        <Question eyebrow="Check your inbox" title="Enter your six-digit code" hint={emailLocked ? `We sent a code to ${email.trim()}. It only works for a short time.` : 'Enter the email you signed up with and the code from your message.'} />
        {warn}
        {emailLocked ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.card, borderRadius: 16, borderWidth: 1, borderColor: p.border, paddingLeft: 14 }}>
            <Feather name="mail" size={16} color={p.muted} />
            <View style={{ flex: 1 }}><Txt v="small" numberOfLines={1}>{email.trim()}</Txt></View>
            <TextLink testID="signup-edit-email" label="Edit email" onPress={editEmail} disabled={busy} />
          </View>
        ) : (
          <Field icon="mail" label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" testID="signup-verify-email" />
        )}
        <Field label="Code" icon="hash" placeholder="123456" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={32} autoCorrect={false}
          accessibilityLabel="Six-digit email code" testID="verify-code" style={{ letterSpacing: 6, fontSize: 20 }} />
        {err ? <Banner kind="error" message={err} /> : null}
        {info ? <Banner kind="ok" message={info} /> : null}
        <Btn label="Verify and continue" icon="arrow-right" loading={busy} disabled={code.length !== 6} onPress={verify} testID="verify-submit" />
        <Btn kind="ghost" label={cd > 0 ? `Resend code in ${cd}s` : 'Resend code'} disabled={busy || cd > 0} onPress={resend} testID="verify-resend" />
        <TextLink label="Use a different email" testID="verify-change-email" onPress={editEmail} disabled={busy} />
        <TextLink label="Already verified? Log in" onPress={() => router.replace('/login')} disabled={busy} />
      </StepShell>
    );
  }

  return (
    <StepShell onBack={() => { void ob.goToStep(5).then(() => router.replace('/onboarding')); }} backTestID="signup-back"
      footer={
        <>
          {err ? <Banner kind="error" message={err} /> : null}
          <Btn label={cd > 0 ? `Wait ${cd}s to try again` : 'Create account'} icon="arrow-right" loading={busy} disabled={cd > 0} onPress={create} testID="signup-submit" />
          <TextLink label="I already have a code" testID="signup-have-code" onPress={() => { setErr(null); setStage('verify'); }} />
          <TextLink label="Already have an account? Log in" onPress={() => router.replace('/login')} />
        </>
      }>
      <Question eyebrow="Almost there" title="Create your account" hint="We'll email a six-digit code to confirm it's you." />
      {warn}
      <Field icon="user" label="Name" placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" testID="signup-name" />
      <Field icon="mail" label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" testID="signup-email" />
      <Field icon="lock" label="Password" placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" testID="signup-password" onSubmitEditing={create}
        right={<Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Feather name={show ? 'eye' : 'eye-off'} size={18} color={p.muted} /></Pressable>} />
    </StepShell>
  );
}
