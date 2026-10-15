import React, { useState } from 'react';
import { View, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palettes, PaletteContext } from '@/constants/theme';
import { Txt, Logo, Btn, Banner, Skeleton } from '@/components/ui';
import { StepShell, Question, Option, TextLink } from '@/components/onboarding-parts';
import { useOnboarding } from '@/providers/OnboardingProvider';
import { goalOptions, challengeOptions, frequencyOptions, onboardingCurrencies, onboardingSummary } from '@/lib/onboarding';

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ob = useOnboarding();
  const { draft } = ob;
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const p = palettes.light;
  const d = palettes.dark;

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  const warn = ob.storageError ? <Banner kind="warn" message={`Your answers may not be remembered if you close the app. ${ob.storageError}`} /> : null;

  if (ob.loading) {
    return (
      <StepShell><Skeleton h={40} w="70%" /><Skeleton h={64} /><Skeleton h={64} /><Skeleton h={64} /></StepShell>
    );
  }

  // Saved answers belong to a signup already in progress.
  if (draft.ownerId) {
    return (
      <StepShell logo footer={<Btn kind="ghost" label="Start fresh" testID="onboarding-start-fresh" loading={busy} onPress={() => run(async () => { await ob.resetDraft(); })} />}>
        <Question eyebrow="Setup in progress" title="You have an account waiting to be verified." hint="Enter your email and the six-digit code to continue. Starting fresh clears the saved answers on this device." />
        {warn}
        {err ? <Banner kind="error" message={err} /> : null}
        <Btn label="Verify my email" icon="arrow-right" testID="onboarding-verify" onPress={() => router.replace('/signup?verify=1')} />
        <Btn kind="dark" label="I already have an account" onPress={() => router.replace('/login')} />
      </StepShell>
    );
  }

  const step = Math.max(0, Math.min(5, draft.step));

  if (step === 0) {
    const resume = draft.answers.goal !== null;
    return (
      <PaletteContext.Provider value={d}>
        <View style={{ flex: 1, backgroundColor: '#071A17' }}>
          <View style={{ position: 'absolute', top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: d.lime, opacity: 0.9 }} />
          <View style={{ position: 'absolute', bottom: -70, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: d.gold, opacity: 0.7 }} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28, gap: 10 }}>
            <Logo size={88} />
            <Txt v="h1" color="#EEF1E3" style={{ fontSize: 44, marginTop: 10 }}>Pocket</Txt>
            <Txt color="#EEF1E3" style={{ textAlign: 'center', fontSize: 18, marginTop: 14, maxWidth: 320 }}>Four quick questions, so Pocket starts out shaped around you.</Txt>
            <Txt v="small" color="#93AFA5" style={{ textAlign: 'center' }}>It takes about a minute. Nothing here is a commitment.</Txt>
            <View style={{ alignSelf: 'stretch', marginTop: 24, maxWidth: 420, width: '100%', gap: 4 }}>
              {warn}
              <Btn label={resume ? 'Continue setup' : 'Get started'} icon="arrow-right" testID="onboarding-start" onPress={() => run(() => ob.goToStep(resume ? Math.max(1, step) : 1))} loading={busy} />
              {resume ? <Btn kind="ghost" label="Start over" style={{ marginTop: 8 }} onPress={() => run(ob.resetDraft)} testID="onboarding-start-over" /> : null}
            </View>
            <Pressable testID="onboarding-login" accessibilityRole="button" onPress={() => router.replace('/login')} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }}>
              <Txt v="small" color="#C8F34F">I already have an account</Txt>
            </Pressable>
          </ScrollView>
        </View>
      </PaletteContext.Provider>
    );
  }

  const back = () => run(() => ob.goToStep(step - 1));
  const next = () => run(() => ob.goToStep(step + 1));
  const skip = (key: 'challenge' | 'frequency') => () => run(async () => {
    await ob.updateAnswer(key, null);
    await ob.goToStep(step + 1);
  });
  const pick = (key: 'goal' | 'challenge' | 'frequency' | 'currency', v: string) => run(() => ob.updateAnswer(key, v as never));
  const nextBtn = (enabled: boolean, label = 'Continue') => (
    <>
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label={label} icon="arrow-right" disabled={!enabled} loading={busy} onPress={next} testID="onboarding-next" />
    </>
  );

  if (step === 1) {
    return (
      <StepShell step={1} onBack={back} footer={nextBtn(!!draft.answers.goal)}>
        <Question eyebrow="Your goal" title="What brings you to Pocket?" hint="Pick the one that matters most right now." />
        {warn}
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {goalOptions.map(o => <Option key={o.value} testID={`onboarding-option-goal-${o.value}`} label={o.label} detail={o.detail} icon={o.icon} selected={draft.answers.goal === o.value} onPress={() => pick('goal', o.value)} />)}
        </View>
      </StepShell>
    );
  }
  if (step === 2) {
    return (
      <StepShell step={2} onBack={back} onSkip={skip('challenge')} footer={nextBtn(!!draft.answers.challenge)}>
        <Question eyebrow="Your challenge" title="What gets in the way?" hint="Optional. Skip it if nothing fits." />
        {warn}
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {challengeOptions.map(o => <Option key={o.value} testID={`onboarding-option-challenge-${o.value}`} label={o.label} icon={o.icon} selected={draft.answers.challenge === o.value} onPress={() => pick('challenge', o.value)} />)}
        </View>
      </StepShell>
    );
  }
  if (step === 3) {
    return (
      <StepShell step={3} onBack={back} onSkip={skip('frequency')} footer={nextBtn(!!draft.answers.frequency)}>
        <Question eyebrow="Your rhythm" title="How often would you like to look?" hint="Optional. Pocket won't send reminders unless you ask." />
        {warn}
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {frequencyOptions.map(o => <Option key={o.value} testID={`onboarding-option-frequency-${o.value}`} label={o.label} detail={o.detail} icon={o.icon} selected={draft.answers.frequency === o.value} onPress={() => pick('frequency', o.value)} />)}
        </View>
      </StepShell>
    );
  }
  if (step === 4) {
    return (
      <StepShell step={4} onBack={back} footer={nextBtn(true)}>
        <Question eyebrow="Your currency" title="Which currency do you think in?" hint="This is where your totals start. You can change it later." />
        {warn}
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {onboardingCurrencies.map(c => <Option key={c} testID={`onboarding-option-currency-${c}`} label={c} selected={draft.answers.currency === c} onPress={() => pick('currency', c)} />)}
        </View>
      </StepShell>
    );
  }

  const s = onboardingSummary(draft.answers);
  const finish = () => run(async () => { await ob.finishQuestions(); router.replace('/signup'); });
  return (
    <StepShell step={5} onBack={back} footer={
      <>
        {err ? <Banner kind="error" message={err} /> : null}
        <Btn label="Create my account" icon="arrow-right" loading={busy} onPress={finish} testID="onboarding-summary-cta" />
        <TextLink label="I already have an account" onPress={() => router.replace('/login')} />
      </>
    }>
      <Question eyebrow="Your starting point" title={s.title} />
      {warn}
      <Image source={require('../assets/images/pocket/s3.png')} style={{ width: '100%', height: 150, borderRadius: 24, backgroundColor: '#E8F1EC' }} resizeMode="contain" accessibilityIgnoresInvertColors />
      {[s.focus, s.challenge, s.tracking].map((t, k) => (
        <View key={k} style={{ backgroundColor: p.card, borderRadius: 20, borderWidth: 1, borderColor: p.border, padding: 16 }}>
          <Txt>{t}</Txt>
        </View>
      ))}
      <Txt v="small" muted>Currency: {s.currency}. Next, create an account and confirm your email.</Txt>
    </StepShell>
  );
}
