import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthShell, OAuthButtons } from '@/components/auth';
import { Btn, Field, Banner, Txt } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';

export default function Login() {
  const { signIn } = usePocket();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [pw, setPw] = useState<string>('');
  const [show, setShow] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (!email.trim() || !pw) return setErr('Enter your email and password.');
    setBusy(true); setErr(null);
    try { await signIn(email.trim(), pw); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not log in.'); } finally { setBusy(false); }
  };
  return (
    <AuthShell dark subtitle="Welcome back!">
      <Field icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field icon="lock" placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" onSubmitEditing={go}
        right={<Pressable onPress={() => setShow(!show)} hitSlop={8}><Feather name={show ? 'eye' : 'eye-off'} size={17} color="#93AFA5" /></Pressable>} />
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label="Log In" icon="arrow-right" loading={busy} onPress={go} testID="login-submit" />
      <Pressable onPress={() => router.push('/reset')} style={{ alignItems: 'center', padding: 4 }}><Txt v="small">Forgot your password?</Txt></Pressable>
      <OAuthButtons />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 }}>
        <Txt v="small" muted>Don't have an account?</Txt>
        <Pressable onPress={() => router.replace('/onboarding')} style={{ minHeight: 44, justifyContent: 'center' }}><Txt v="small" color="#C8F34F">Sign Up</Txt></Pressable>
      </View>
      <Pressable testID="login-verify" onPress={() => router.push('/signup?verify=1')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Txt v="small" color="#C8F34F">Verify my email with a code</Txt></Pressable>
    </AuthShell>
  );
}
