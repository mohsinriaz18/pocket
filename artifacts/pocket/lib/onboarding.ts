export const ONBOARDING_STORAGE_KEY = 'pocket:onboarding:v1';
export const EMAIL_COOLDOWN_SECONDS = 60;

export const goalOptions = [
  { value: 'spending', label: 'Understand my spending', detail: 'Know where my money goes.', icon: 'pie-chart' },
  { value: 'saving', label: 'Build my savings', detail: 'Make room for the things that matter.', icon: 'target' },
  { value: 'debt', label: 'Manage my debt', detail: 'Keep repayments and progress clear.', icon: 'check-circle' },
  { value: 'wealth', label: 'Grow my wealth', detail: 'See my complete financial picture.', icon: 'trending-up' },
] as const;
export const challengeOptions = [
  { value: 'visibility', label: 'I lose track of spending', icon: 'search' },
  { value: 'consistency', label: 'Staying consistent is hard', icon: 'repeat' },
  { value: 'planning', label: 'I want to plan ahead', icon: 'calendar' },
  { value: 'organization', label: 'Everything is in different places', icon: 'layers' },
] as const;
export const frequencyOptions = [
  { value: 'daily', label: 'A quick daily check-in', detail: 'A little attention, more often.', icon: 'sun' },
  { value: 'weekly', label: 'A weekly money review', detail: 'Make time to see the bigger picture.', icon: 'calendar' },
  { value: 'as_needed', label: 'Whenever I need clarity', detail: 'Go at my own pace.', icon: 'compass' },
] as const;
export const onboardingCurrencies = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD', 'INR'] as const;
export type GoalAnswer = typeof goalOptions[number]['value'];
export type ChallengeAnswer = typeof challengeOptions[number]['value'];
export type FrequencyAnswer = typeof frequencyOptions[number]['value'];
export type OnboardingAnswers = {
  goal: GoalAnswer | null;
  challenge: ChallengeAnswer | null;
  frequency: FrequencyAnswer | null;
  currency: typeof onboardingCurrencies[number];
};
export type OnboardingDraft = {
  version: 1;
  step: number;
  answers: OnboardingAnswers;
  ready: boolean;
  ownerId: string | null;
  nextEmailAt: number;
};

export function emptyOnboardingDraft(): OnboardingDraft {
  return {
    version: 1, step: 0,
    answers: { goal: null, challenge: null, frequency: null, currency: 'PKR' },
    ready: false, ownerId: null, nextEmailAt: 0,
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : null;
}

/** Whitelist only broad preferences; never retain email, password or OTP fields. */
export function parseOnboardingDraft(raw: string, now = Date.now()): OnboardingDraft {
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || typeof value.answers !== 'object' || !value.answers) {
    throw new Error('The saved setup could not be read. Please start your setup again.');
  }
  const answers: OnboardingAnswers = {
    goal: oneOf(value.answers.goal, goalOptions.map(option => option.value)),
    challenge: oneOf(value.answers.challenge, challengeOptions.map(option => option.value)),
    frequency: oneOf(value.answers.frequency, frequencyOptions.map(option => option.value)),
    currency: oneOf(value.answers.currency, onboardingCurrencies) ?? 'PKR',
  };
  return {
    version: 1,
    step: Number.isInteger(value.step) ? Math.max(0, Math.min(5, value.step)) : 0,
    answers,
    ready: value.ready === true && !!answers.goal,
    ownerId: typeof value.ownerId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.ownerId) ? value.ownerId : null,
    nextEmailAt: typeof value.nextEmailAt === 'number' && Number.isFinite(value.nextEmailAt)
      ? Math.max(0, Math.min(now + 60 * 60 * 1000, value.nextEmailAt)) : 0,
  };
}

export function onboardingBelongsTo(draft: OnboardingDraft, userId: string | null): boolean {
  return !!userId && draft.ready && !!draft.answers.goal && draft.ownerId === userId;
}

export function cooldownSeconds(nextEmailAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((nextEmailAt - now) / 1000));
}

export function onboardingSummary(answers: OnboardingAnswers) {
  const focus = {
    spending: 'Start with your expenses and budgets to see where your money goes.',
    saving: 'Set savings goals and see your progress alongside everyday spending.',
    debt: 'Keep debts, bills and repayments together so you can plan your next steps.',
    wealth: 'Bring accounts and investments together for a clearer view of your net worth.',
  };
  const tracking = {
    daily: 'Your rhythm: a quick daily check-in. No reminders will be enabled without your choice.',
    weekly: 'Your rhythm: a weekly review. No reminders will be enabled without your choice.',
    as_needed: 'Your rhythm: check in whenever you need clarity.',
  };
  const challenge = {
    visibility: 'Your spending categories will help you see what is happening.',
    consistency: 'Keep your updates manageable; you choose the pace.',
    planning: 'Use budgets, bills and goals to make your next steps clearer.',
    organization: 'Your accounts, savings and investments can stay in one place.',
  };
  return {
    title: goalOptions.find(option => option.value === answers.goal)?.label ?? 'Your money, more clearly',
    focus: answers.goal ? focus[answers.goal] : 'Bring your money into one clear view.',
    challenge: answers.challenge ? challenge[answers.challenge] : 'Start with what matters to you and add detail as you go.',
    tracking: answers.frequency ? tracking[answers.frequency] : 'You can track your money at your own pace.',
    currency: answers.currency,
  };
}
