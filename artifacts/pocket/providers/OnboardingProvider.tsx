import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePocket } from '@/providers/PocketProvider';
import { supabase } from '@/lib/supabase';
import {
  ONBOARDING_STORAGE_KEY, EMAIL_COOLDOWN_SECONDS, emptyOnboardingDraft, parseOnboardingDraft,
  onboardingBelongsTo, cooldownSeconds, type OnboardingAnswers, type OnboardingDraft,
} from '@/lib/onboarding';

type ContextValue = {
  draft: OnboardingDraft; loading: boolean; storageError: string | null;
  needsFinish: boolean; saving: boolean; finishError: string | null; authTransition: boolean;
  updateAnswer(key: keyof OnboardingAnswers, value: OnboardingAnswers[keyof OnboardingAnswers]): Promise<void>;
  goToStep(step: number): Promise<void>; finishQuestions(): Promise<void>;
  createAccount(name: string, email: string, password: string): Promise<{ verificationRequired: boolean }>;
  verifyCode(email: string, code: string): Promise<void>; resendCode(email: string): Promise<void>;
  changeEmail(): Promise<void>; resetDraft(): Promise<void>; retryFinish(): void;
};
const Context = createContext<ContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pocket = usePocket();
  const userId = pocket.session?.user.id ?? null;
  const latestUser = useRef(userId);
  latestUser.current = userId;
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const draftRef = useRef(draft);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const [loading, setLoading] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [authTransition, setAuthTransition] = useState<boolean>(false);
  const working = useRef(false);
  const previousUser = useRef<string | null>(null);
  const [finish, setFinish] = useState<{ userId: string | null; saving: boolean; error: string | null }>({
    userId: null, saving: false, error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const write = useCallback(async (next: OnboardingDraft) => {
    draftRef.current = next;
    setDraft(next);
    const operation = writes.current.catch(() => {}).then(() =>
      AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next)));
    writes.current = operation;
    try {
      await operation;
      if (draftRef.current === next) setStorageError(null);
    } catch {
      setStorageError('Your setup could not be saved on this device. Keep the app open and try again before leaving.');
    }
  }, []);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then(raw => {
      if (!live || !raw) return;
      const saved = parseOnboardingDraft(raw);
      draftRef.current = saved;
      setDraft(saved);
    }).catch(() => {
      if (live) setStorageError('Your saved setup could not be read. Please start fresh; no account or financial records were changed.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const resetDraft = useCallback(async () => {
    await write({ ...emptyOnboardingDraft(), nextEmailAt: draftRef.current.nextEmailAt });
  }, [write]);

  useEffect(() => {
    if (loading || pocket.authLoading || authTransition) return;
    const owner = draftRef.current.ownerId;
    const signedOutOwner = !userId && previousUser.current && owner === previousUser.current;
    if (owner && ((userId && owner !== userId) || signedOutOwner)) void resetDraft();
    previousUser.current = userId;
  }, [userId, loading, pocket.authLoading, authTransition, resetDraft]);

  const needsFinish = onboardingBelongsTo(draft, userId);
  useEffect(() => {
    if (!userId || !needsFinish || loading || authTransition) return;
    const uid = userId;
    const answers = draftRef.current.answers;
    let live = true;
    setFinish({ userId: uid, saving: true, error: null });
    void (async () => {
      try {
        const { error } = await supabase.rpc('complete_onboarding', {
          p_expected_user_id: uid, p_goal: answers.goal, p_challenge: answers.challenge,
          p_frequency: answers.frequency, p_currency: answers.currency,
        });
        if (error) throw error;
        if (!live || latestUser.current !== uid || draftRef.current.ownerId !== uid) return;
        await pocket.refresh();
        if (!live || latestUser.current !== uid || draftRef.current.ownerId !== uid) return;
        await resetDraft();
      } catch {
        if (live && latestUser.current === uid) setFinish({
          userId: uid, saving: false,
          error: 'Your email is verified, but we could not save your setup. Check your connection and retry. You are still signed in.',
        });
      }
    })();
    return () => { live = false; };
    // Deliberately retry only on user/account transitions or an explicit retry.
  }, [userId, needsFinish, loading, authTransition, attempt, resetDraft]);

  const runAuth = async <T,>(work: () => Promise<T>, transitions: boolean): Promise<T> => {
    if (working.current) throw new Error('Please wait for your current request to finish.');
    working.current = true;
    if (transitions) setAuthTransition(true);
    try { return await work(); }
    finally {
      working.current = false;
      if (transitions) setAuthTransition(false);
    }
  };
  const reserveEmailRequest = async () => {
    const seconds = cooldownSeconds(draftRef.current.nextEmailAt);
    if (seconds > 0) throw new Error(`Wait ${seconds} seconds before requesting another email. An hourly email limit may require a longer wait.`);
    await write({ ...draftRef.current, nextEmailAt: Date.now() + EMAIL_COOLDOWN_SECONDS * 1000 });
  };

  return <Context.Provider value={{
    draft, loading, storageError, needsFinish, authTransition,
    saving: needsFinish && finish.userId === userId && finish.saving,
    finishError: needsFinish && finish.userId === userId ? finish.error : null,
    updateAnswer: async (key, value) => {
      await write(parseOnboardingDraft(JSON.stringify({
        ...draftRef.current, ready: false, ownerId: null,
        answers: { ...draftRef.current.answers, [key]: value },
      })));
    },
    goToStep: async step => { await write({ ...draftRef.current, step: Math.max(0, Math.min(5, step)) }); },
    finishQuestions: async () => {
      if (!draftRef.current.answers.goal) throw new Error('Choose your main goal to continue.');
      await write({ ...draftRef.current, ready: true, step: 5 });
    },
    createAccount: (name, email, password) => runAuth(async () => {
      if (!draftRef.current.ready) throw new Error('Finish your Pocket setup before creating your account.');
      await reserveEmailRequest();
      const result = await pocket.signUp(name, email, password);
      await write({ ...draftRef.current, ownerId: result.userId });
      return { verificationRequired: result.verificationRequired };
    }, true),
    verifyCode: (email, code) => runAuth(async () => {
      const result = await pocket.verifyEmailCode(email, code);
      // Never attach an unrelated account to this device's anonymous preferences.
      if (draftRef.current.ownerId && draftRef.current.ownerId !== result.userId) await resetDraft();
    }, true),
    resendCode: email => runAuth(async () => {
      await reserveEmailRequest();
      await pocket.resendEmailCode(email);
    }, false),
    changeEmail: async () => { await write({ ...draftRef.current, ownerId: null }); },
    resetDraft,
    retryFinish: () => setAttempt(value => value + 1),
  }}>{children}</Context.Provider>;
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error('useOnboarding must be inside OnboardingProvider');
  return value;
}
