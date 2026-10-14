import React, { useEffect, useState } from 'react';
import { View, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, Txt, Field, Btn, Chips, Banner, Switch2, SectionTitle } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { scheduleReminder, sendTestNotification } from '@/lib/reminders';
import { currencies } from '@/lib/types';
import { isTime, passwordProblem } from '@/lib/helpers';

type Msg = { kind: 'ok' | 'error' | 'warn'; text: string } | null;
const fail = (e: unknown, d: string) => (e instanceof Error ? e.message : d);

export default function Settings() {
  const { data, session, saveProfile, signOut, changePassword, reminderError } = usePocket();
  const subscription = useSubscription();
  const router = useRouter();
  const prof = data.profile;
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showPw, setShowPw] = useState<boolean>(false);
  const [time, setTime] = useState<string>('20:00');
  const [cur, setCur] = useState<string>('');
  const [sec, setSec] = useState<string>('');
  const [remind, setRemind] = useState<boolean>(false);
  const [pwCur, setPwCur] = useState<string>('');
  const [pwNew, setPwNew] = useState<string>('');
  const [m, setM] = useState<Record<string, Msg>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const flash = (k: string, v: Msg) => setM((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!prof) return;
    setName(prof.name ?? ''); setEmail(prof.email || session?.user?.email || ''); setTime((prof.reminder_time ?? '20:00').slice(0, 5)); setRemind(!!prof.reminder_enabled);
    setCur(prof.primary_currency); setSec(prof.secondary_currency);
  }, [prof?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (k: string, fn: () => Promise<void>, ok: string, d: string) => {
    if (busy) return;
    setBusy(k); flash(k, null);
    try { await fn(); flash(k, { kind: 'ok', text: ok }); } catch (e) { flash(k, { kind: 'error', text: fail(e, d) }); } finally { setBusy(null); }
  };
  const eye = <Pressable onPress={() => setShowPw(!showPw)} hitSlop={8}><Feather name={showPw ? 'eye' : 'eye-off'} size={17} color="#667974" /></Pressable>;
  const note = (k: string) => (m[k] ? <Banner kind={m[k]!.kind} message={m[k]!.text} /> : null);

  const toggleRemind = async (on: boolean) => {
    if (on && !isTime(time)) return flash('rem', { kind: 'error', text: 'Reminder time must be 24-hour HH:MM, for example 20:30.' });
    await run('rem', async () => { await scheduleReminder(on, time); await saveProfile({ reminder_enabled: on, reminder_time: time }); setRemind(on); }, on ? 'Daily reminder is on.' : 'Daily reminder is off.', 'Could not change the reminder.');
  };

  return (
    <Screen title="Profile & settings" back>
      <SectionTitle title="Pocket Premium" />
      <Card style={{ gap: 12 }}>
        <Txt v="h3">{subscription.hasAccess ? 'Premium access is active' : 'Subscription required'}</Txt>
        <Txt v="small" muted>Manage or cancel your plan through your store account. Canceling keeps access until your paid period or trial ends.</Txt>
        {subscription.error ? <Banner kind="warn" message={subscription.error} /> : null}
        <Btn kind="dark" label="Manage subscription" icon="external-link" disabled={!!subscription.action}
          loading={subscription.action === 'manage'} onPress={() => { void subscription.manage(); }} />
        <Btn kind="ghost" label="Restore purchases" disabled={!!subscription.action}
          loading={subscription.action === 'restore'} onPress={() => { void subscription.restore(); }} />
      </Card>
      <SectionTitle title="Profile" />
      <Card style={{ gap: 12 }}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Txt v="small" muted>Changing your email sends a confirmation email. The new address takes effect once you confirm it.</Txt>
        {note('profile')}
        <Btn kind="dark" label="Save profile" loading={busy === 'profile'} onPress={() => {
          const em = email.trim();
          if (!name.trim() || !/^\S+@\S+\.\S+$/.test(em)) return flash('profile', { kind: 'error', text: 'Enter your name and a valid email address.' });
          const changed = em.toLowerCase() !== (prof?.email || session?.user?.email || '').toLowerCase();
          void run('profile', () => saveProfile({ name: name.trim(), email: em }), changed ? `Profile saved. We sent a confirmation email to ${em}; confirm it to finish the change.` : 'Profile saved.', 'Could not save profile.');
        }} />
      </Card>

      <SectionTitle title="Currency" />
      <Card style={{ gap: 12 }}>
        <Txt v="label" muted>Primary currency</Txt>
        <Chips options={currencies} value={cur} onChange={(v) => { setCur(v); void run('cur', () => saveProfile({ primary_currency: v }), 'Primary currency updated.', 'Could not update currency.'); }} />
        <Txt v="label" muted>Secondary currency</Txt>
        <Chips options={currencies} value={sec} onChange={(v) => { setSec(v); void run('cur', () => saveProfile({ secondary_currency: v }), 'Secondary currency updated.', 'Could not update currency.'); }} />
        {note('cur')}
      </Card>

      <SectionTitle title="Appearance" />
      <Card style={{ gap: 12 }}>
        <Chips options={['Light', 'Dark', 'System']} value={prof ? prof.appearance[0].toUpperCase() + prof.appearance.slice(1) : 'System'}
          onChange={(v) => run('app', () => saveProfile({ appearance: v.toLowerCase() as 'light' | 'dark' | 'system' }), 'Appearance updated.', 'Could not update appearance.')} />
        {note('app')}
      </Card>

      <SectionTitle title="Daily reminder" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><Txt v="h3">Remind me to log entries</Txt>
            {Platform.OS === 'web' ? <Txt v="small" muted>Daily scheduling needs the mobile app. On the web you can only send a test.</Txt> : null}</View>
          <Switch2 on={remind} onChange={toggleRemind} />
        </View>
        <Field label="Reminder time" value={time} onChangeText={setTime} placeholder="HH:MM, 24-hour, e.g. 20:00" onEndEditing={() => { if (remind && isTime(time)) void toggleRemind(true); }} />
        <Txt v="small" muted>Only if nothing was added that day · once per day</Txt>
        {reminderError ? <Banner kind="error" message={`Reminder scheduling problem: ${reminderError}`} /> : null}
        {note('rem')}
        <Btn kind="ghost" label="Send a test notification" icon="bell" loading={busy === 'test'} onPress={() => run('test', sendTestNotification, 'Test notification sent.', 'Could not send a test notification.')} />
        {note('test')}
      </Card>

      <SectionTitle title="Security" />
      <Card style={{ gap: 12 }}>
        <Field label="Current password" value={pwCur} onChangeText={setPwCur} secureTextEntry={!showPw} autoCapitalize="none" right={eye} />
        <Field label="New password" value={pwNew} onChangeText={setPwNew} secureTextEntry={!showPw} autoCapitalize="none" right={eye} />
        {note('pw')}
        <Btn kind="dark" label="Change password" loading={busy === 'pw'} onPress={() => {
          const pp = passwordProblem(pwNew);
          if (!pwCur || pp) return flash('pw', { kind: 'error', text: !pwCur ? 'Enter your current password.' : pp! });
          void run('pw', async () => { await changePassword(pwCur, pwNew); setPwCur(''); setPwNew(''); }, 'Password changed.', 'Could not change password.');
        }} />
      </Card>

      <Btn kind="danger" label="Log out" icon="log-out" onPress={async () => { await signOut(); router.replace('/login'); }} style={{ marginTop: 10 }} />
    </Screen>
  );
}
