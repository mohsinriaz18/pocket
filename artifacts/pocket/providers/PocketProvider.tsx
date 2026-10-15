import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { emptyData, type PocketData, type Entity, type Profile, type Bill, type Debt } from '@/lib/types';
import { billPeriod } from '@/lib/finance';
import { scheduleReminder } from '@/lib/reminders';
import { signupOutcome } from '@/lib/signup-outcome';

interface PocketContextValue {
  session: Session | null; authLoading: boolean; data: PocketData; loading: boolean; error: string | null; reminderError: string | null;
  refresh(): Promise<void>; save(entity: Entity, record: Record<string, unknown>): Promise<void>; remove(entity: Entity, id: string): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>; payBill(bill: Bill, accountId: string): Promise<void>;
  repayDebt(debt: Debt, amount: number, accountId: string, date: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<{ verificationRequired: boolean }>;
  signOut(): Promise<void>; resetPassword(email: string): Promise<void>; changePassword(current: string, next: string): Promise<void>;
}
const PocketContext = createContext<PocketContextValue | null>(null);
const entityNames: Entity[] = ['accounts', 'transactions', 'bills', 'goals', 'investments', 'debts'];
const writable: Record<Entity, string[]> = {
  accounts: ['name', 'bank', 'last_four', 'currency', 'type', 'opening_balance', 'archived'],
  transactions: ['type', 'amount', 'currency', 'category', 'account_id', 'to_account_id', 'date', 'note'],
  bills: ['name', 'amount', 'currency', 'due_day', 'repeats', 'category'],
  goals: ['name', 'category', 'currency', 'target', 'target_date', 'saved', 'notes'],
  investments: ['name', 'currency', 'type', 'platform', 'invested', 'current_value', 'quantity', 'purchase_price', 'purchase_date', 'notes'],
  debts: ['name', 'currency', 'type', 'lender', 'original_amount', 'outstanding', 'interest_rate', 'minimum_payment', 'frequency', 'due_day', 'start_date', 'payoff_by', 'notes', 'direction'],
};
function throwIf(error: { message: string } | null) { if (error) throw new Error(error.message); }

async function fetchData(userId: string): Promise<PocketData> {
  const result = { ...emptyData } as PocketData;
  const tables = [...entityNames, 'exchange_rates', 'investment_valuations', 'profiles'];
  const rows = await Promise.all(tables.map(async table => {
    const query = supabase.from(table).select('*');
    const response = table === 'profiles' ? await query.eq('id', userId).maybeSingle() : await query.eq('user_id', userId);
    if (response.error) {
      if (['42P01', 'PGRST205'].includes(response.error.code)) throw new Error('Supabase setup required: run supabase/migrations/001_pocket.sql in your project SQL Editor, then tap Retry.');
      throw new Error(response.error.message);
    }
    return response.data;
  }));
  tables.forEach((table, index) => {
    if (table === 'profiles') result.profile = rows[index] as unknown as Profile | null;
    else Object.assign(result, { [table]: rows[index] ?? [] });
  });
  result.bills = result.bills.map(b => ({ ...b, paid: result.transactions.some(t => t.bill_id === b.id && t.payment_period === billPeriod(b)) }));
  return result;
}
export function PocketProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const client = useQueryClient();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); }).catch(() => setAuthLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setAuthLoading(false);
      if (!next) client.clear();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    const processUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === 'string') await supabase.auth.exchangeCodeForSession(code);
    };
    Linking.getInitialURL().then(url => { if (url) void processUrl(url); });
    const linking = Linking.addEventListener('url', ({ url }) => { void processUrl(url); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const code = new URL(window.location.href).searchParams.get('code');
      if (code) void supabase.auth.exchangeCodeForSession(code);
    }
    return () => { data.subscription.unsubscribe(); appState.remove(); linking.remove(); };
  }, [client]);
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: ['pocket', userId], queryFn: () => fetchData(userId!), enabled: !!userId, retry: 1,
  });
  useEffect(() => {
    if (Platform.OS === 'web' || !query.data?.profile) return;
    const profile = query.data.profile;
    void scheduleReminder(profile.reminder_enabled, profile.reminder_time).then(() => setReminderError(null)).catch(e => setReminderError(e instanceof Error ? e.message : 'Could not refresh reminders.'));
  }, [query.dataUpdatedAt]);
  const ensureUser = () => { if (!userId) throw new Error('Please log in first.'); return userId; };
  const refresh = async () => {
    if (!userId) return;
    await client.invalidateQueries({ queryKey: ['pocket', userId] });
  };
  const save = async (entity: Entity, record: Record<string, unknown>) => {
    const uid = ensureUser();
    const payload = Object.fromEntries(writable[entity].filter(k => record[k] !== undefined).map(k => [k, record[k]]));
    if (entity === 'bills' && record.id && record.paid === false && Object.keys(record).every(k => k === 'id' || k === 'paid')) {
      throwIf((await supabase.rpc('mark_bill_unpaid', { p_bill_id: record.id })).error);
    } else if (entity === 'investments') {
      throwIf((await supabase.rpc('save_investment', { p_id: record.id ?? null, p_record: payload })).error);
    } else {
      const response = record.id
        ? await supabase.from(entity).update(payload).eq('id', record.id).eq('user_id', uid).select('id').single()
        : await supabase.from(entity).insert({ ...payload, user_id: uid }).select('id').single();
      throwIf(response.error);
    }
    await refresh();
  };
  const remove = async (entity: Entity, id: string) => {
    const uid = ensureUser();
    const response = await supabase.from(entity).delete().eq('id', id).eq('user_id', uid).select('id').single();
    throwIf(response.error); await refresh();
  };
  const saveProfile = async (patch: Partial<Profile>) => {
    const uid = ensureUser();
    const fields = ['name', 'email', 'primary_currency', 'secondary_currency', 'appearance', 'reminder_enabled', 'reminder_time'] as const;
    const payload = Object.fromEntries(fields.filter(k => patch[k] !== undefined).map(k => [k, patch[k]]));
    if (patch.email && patch.email !== session?.user.email) {
      const { error } = await supabase.auth.updateUser({ email: patch.email });
      throwIf(error); // Supabase sends verification to both addresses if secure email change is enabled.
      delete payload.email;
    }
    throwIf((await supabase.from('profiles').upsert({ id: uid, ...payload })).error); await refresh();
  };
  const payBill = async (bill: Bill, accountId: string) => {
    ensureUser();
    throwIf((await supabase.rpc('pay_bill', { p_bill_id: bill.id, p_account_id: accountId })).error); await refresh();
  };
  const repayDebt = async (debt: Debt, amount: number, accountId: string, date: string) => {
    ensureUser();
    throwIf((await supabase.rpc('repay_debt', { p_debt_id: debt.id, p_amount: amount, p_account_id: accountId, p_date: date })).error); await refresh();
  };
  const signIn = async (email: string, password: string) => { throwIf((await supabase.auth.signInWithPassword({ email: email.trim(), password })).error); };
  const signUp = async (name: string, email: string, password: string) => {
    const result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: Linking.createURL('/') } });
    return signupOutcome(result.data, result.error);
  };
  const signOut = async () => {
    await scheduleReminder(false, '13:00');
    throwIf((await supabase.auth.signOut()).error); client.clear();
  };
  const resetPassword = async (email: string) => { throwIf((await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/reset-password') })).error); };
  const changePassword = async (current: string, next: string) => {
    if (next.length < 8) throw new Error('Use at least 8 characters for your new password.');
    if (current) {
      const { error } = await supabase.auth.signInWithPassword({ email: session?.user.email ?? '', password: current });
      throwIf(error);
    }
    throwIf((await supabase.auth.updateUser({ password: next })).error);
  };
  return <PocketContext.Provider value={{ session, authLoading, data: query.data ?? emptyData, loading: query.isLoading && !!userId, error: query.error?.message ?? null, reminderError, refresh, save, remove, saveProfile, payBill, repayDebt, signIn, signUp, signOut, resetPassword, changePassword }}>{children}</PocketContext.Provider>;
}
export function usePocket() { const context = useContext(PocketContext); if (!context) throw new Error('usePocket must be inside PocketProvider'); return context; }
