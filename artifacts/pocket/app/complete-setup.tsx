import React, { useState } from 'react';
import { View } from 'react-native';
import { Btn, Banner, Txt, Skeleton } from '@/components/ui';
import { StepShell, Question } from '@/components/onboarding-parts';
import { useOnboarding } from '@/providers/OnboardingProvider';
import { usePocket } from '@/providers/PocketProvider';

export default function CompleteSetup() {
  const { saving, finishError, retryFinish } = useOnboarding();
  const { signOut } = usePocket();
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true); setLogoutError(null);
    try { await signOut(); }
    catch { setLogoutError('Could not log out. Check your connection and try again.'); }
    finally { setLeaving(false); }
  };
  return (
    <StepShell logo footer={<Btn kind="ghost" label="Log out" icon="log-out" loading={leaving} testID="complete-setup-signout" onPress={leave} />}>
      <Question eyebrow="Email confirmed" title={finishError ? 'Your setup was not saved yet.' : 'Setting up your Pocket'} hint={finishError ? undefined : 'Saving your answers. This only takes a moment.'} />
      {logoutError ? <Banner kind="error" message={logoutError} /> : null}
      {finishError ? (
        <View style={{ gap: 12 }}>
          <Banner kind="error" message={finishError} />
          <Btn label="Try again" icon="refresh-cw" loading={saving} onPress={retryFinish} testID="complete-setup-retry" />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Skeleton h={56} /><Skeleton h={56} />
          <Txt v="small" muted>{saving ? 'Saving...' : 'Getting ready...'}</Txt>
        </View>
      )}
    </StepShell>
  );
}
