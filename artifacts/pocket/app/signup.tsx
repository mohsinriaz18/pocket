import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthShell, OAuthButtons } from '@/components/auth';
import { Btn, Field, Banner, Txt } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';
import { passwordProblem } from '@/lib/helpers';
import { signupErrorMessage } from '@/lib/auth-errors';

export default function Signup() {
  const { signUp } = usePocket();
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [pw, setPw] = useState<string>('');
  const [show, setShow] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(false);
  const go = async () => {
    if (!name.trim() || !email.trim()) return setErr('Enter your name and email.');
    const pp = passwordProblem(pw);
    if (pp) return setErr(pp);
    if (busy) return;
    setBusy(true); setErr(null);
    try { const r = await signUp(name.trim(), email.trim(), pw); if (r.verificationRequired) setSent(true); } catch (e) { setErr(signupErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <AuthShell subtitle="Create your account">
      {sent ? (
        <>
          <Banner kind="ok" message={`We sent a confirmation link to ${email.trim()}. Open it, then log in to start using Pocket.`} />
          <Btn label="Go to Log In" icon="arrow-right" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <Field icon="user" placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Field icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field icon="lock" placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" onSubmitEditing={go}
            right={<Pressable onPress={() => setShow(!show)} hitSlop={8}><Feather name={show ? 'eye' : 'eye-off'} size={17} color="#667974" /></Pressable>} />
          {err ? <Banner kind="error" message={err} /> : null}
          <Btn label="Create Account" icon="arrow-right" loading={busy} onPress={go} testID="signup-submit" />
          <OAuthButtons />
        </>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 }}>
        <Txt v="small" muted>Already have an account?</Txt>
        <Pressable onPress={() => router.replace('/login')}><Txt v="small" color="#0F5C4D">Log In</Txt></Pressable>
      </View>
    </AuthShell>
  );
}
