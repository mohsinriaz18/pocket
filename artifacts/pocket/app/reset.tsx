import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth';
import { Btn, Field, Banner, Txt } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';

export default function Reset() {
  const { resetPassword } = usePocket();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const go = async () => {
    if (!email.trim()) return setErr('Enter the email you signed up with.');
    setBusy(true); setErr(null);
    try { await resetPassword(email.trim()); setDone(true); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send reset email.'); } finally { setBusy(false); }
  };
  return (
    <AuthShell dark subtitle="Reset your password">
      <Txt muted style={{ textAlign: 'center' }}>Enter your email and we will send a link to choose a new password.</Txt>
      <Field icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {err ? <Banner kind="error" message={err} /> : null}
      {done ? <Banner kind="ok" message="Reset link sent. Check your inbox." /> : null}
      <Btn label="Send reset link" icon="send" loading={busy} onPress={go} />
      <Pressable onPress={() => router.replace('/login')} style={{ alignItems: 'center', padding: 8 }}><Txt v="small" color="#C8F34F">Back to Log In</Txt></Pressable>
    </AuthShell>
  );
}
