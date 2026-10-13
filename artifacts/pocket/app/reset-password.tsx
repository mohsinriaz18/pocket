import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth';
import { Btn, Field, Banner, Txt } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';
import { supabase } from '@/lib/supabase';
import { passwordProblem } from '@/lib/helpers';

export default function ResetPassword() {
  const { session, signOut } = usePocket();
  const router = useRouter();
  const [pw, setPw] = useState<string>('');
  const [pw2, setPw2] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const go = async () => {
    const pp = passwordProblem(pw);
    if (pp) return setErr(pp);
    if (busy) return;
    if (pw !== pw2) return setErr('The two passwords do not match.');
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not update password.'); } finally { setBusy(false); }
  };
  return (
    <AuthShell dark subtitle="Choose a new password">
      {!session ? <Banner kind="warn" message="This reset link has expired or was already used. Request a new one." /> : null}
      <Field icon="lock" placeholder="New password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
      <Field icon="lock" placeholder="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
      {err ? <Banner kind="error" message={err} /> : null}
      {done ? <Banner kind="ok" message="Password updated." /> : null}
      {done ? <Btn label="Continue to Pocket" icon="arrow-right" onPress={() => router.replace('/')} /> : <Btn label="Save new password" loading={busy} disabled={!session} onPress={go} />}
      <Pressable onPress={async () => { if (session && !done) await signOut(); router.replace(session ? '/login' : '/reset'); }} style={{ alignItems: 'center', padding: 8 }}>
        <Txt v="small" color="#C8F34F">{session ? 'Cancel and log out' : 'Request a new link'}</Txt>
      </Pressable>
    </AuthShell>
  );
}
