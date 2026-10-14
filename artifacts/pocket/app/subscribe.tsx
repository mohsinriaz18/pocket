import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Screen, Logo, Txt, Card, Btn, Banner } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { renewalLabel, trialLabel } from '@/lib/subscriptions';

export default function Subscribe() {
  const p = usePalette();
  const { signOut } = usePocket();
  const sub = useSubscription();
  const [choice, setChoice] = useState<'annual' | 'monthly'>('annual');
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const plans = [
    { key: 'annual' as const, label: 'Yearly', pkg: sub.offering?.annual },
    { key: 'monthly' as const, label: 'Monthly', pkg: sub.offering?.monthly },
  ].filter((plan) => !!plan.pkg);
  const selected = plans.find((plan) => plan.key === choice) ?? plans[0];
  const pkg = selected?.pkg;
  const trial = pkg ? trialLabel(pkg) : null;
  const busy = !!sub.action || leaving || retrying;

  return (
    <Screen title="Pocket Premium" subtitle="Your money. All in one place.">
      <View style={styles.intro}>
        <Logo size={72} />
        <Txt v="h1" style={styles.center}>One plan. All of Pocket.</Txt>
        <Txt muted style={styles.center}>
          Track your expenses, grow your savings and see your complete financial picture.
        </Txt>
      </View>
      <Card style={styles.benefits}>
        {['Expenses, accounts and budgets', 'Savings goals and investments', 'Bills, debts and financial reports'].map((label) => (
          <View key={label} style={styles.benefit}>
            <Feather name="check-circle" size={19} color={p.teal} />
            <Txt style={{ flex: 1 }}>{label}</Txt>
          </View>
        ))}
      </Card>
      <View style={styles.plans}>
        {plans.map((plan) => {
          const on = selected?.key === plan.key;
          const planTrial = trialLabel(plan.pkg!);
          return (
            <Pressable
              key={plan.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${plan.label}, ${plan.pkg!.product.priceString} per ${renewalLabel(plan.pkg!)}`}
              disabled={busy}
              onPress={() => setChoice(plan.key)}
              style={[styles.plan, { backgroundColor: on ? p.cardAlt : p.card, borderColor: on ? p.teal : p.border }]}
            >
              <View style={styles.planTop}>
                <Txt v="h3">{plan.label}</Txt>
                <Feather name={on ? 'check-circle' : 'circle'} size={21} color={on ? p.teal : p.muted} />
              </View>
              <Txt v="h2">{plan.pkg!.product.priceString}</Txt>
              <Txt v="small" muted>per {renewalLabel(plan.pkg!)}</Txt>
              {planTrial ? <Txt v="small" color={p.good}>{planTrial}</Txt> : null}
            </Pressable>
          );
        })}
      </View>
      {sub.error ? <Banner kind="warn" message={sub.error} /> : null}
      {logoutError ? <Banner kind="error" message={logoutError} /> : null}
      <Btn
        testID="subscribe-purchase"
        label={trial ? `Start ${trial}` : 'Subscribe to Pocket'}
        icon="arrow-right"
        loading={sub.action === 'purchase'}
        disabled={busy || !pkg || sub.loading}
        onPress={() => { if (pkg) void sub.purchase(pkg); }}
      />
      {pkg ? (
        <Txt v="small" muted style={styles.disclosure}>
          {trial ? `${trial}, then ` : ''}{pkg.product.priceString} per {renewalLabel(pkg)}.
          {' '}Payment is charged to your Google Play account. Your subscription renews automatically unless canceled.
          {' '}Cancel in Google Play before your trial or current billing period ends to avoid the next charge.
          {' '}Free trials are available only to eligible new subscribers, as confirmed by Google Play.
        </Txt>
      ) : (
        <Txt v="small" muted style={styles.disclosure}>
          An active subscription or store free trial is required to use Pocket. Plans will appear here once available from Google Play.
        </Txt>
      )}
      <Btn kind="ghost" label="Restore purchases" icon="rotate-ccw" disabled={busy || sub.loading}
        loading={sub.action === 'restore'} onPress={() => { void sub.restore(); }} />
      <View style={styles.links}>
        <Btn small kind="ghost" label="Retry" disabled={busy} loading={retrying} onPress={() => {
          setRetrying(true); void sub.refresh().finally(() => setRetrying(false));
        }} />
        <Btn small kind="ghost" label="Manage subscription" disabled={busy}
          loading={sub.action === 'manage'} onPress={() => { void sub.manage(); }} />
      </View>
      <Btn kind="ghost" label="Log out" disabled={busy} loading={leaving} onPress={() => {
        setLeaving(true); setLogoutError(null);
        void signOut().catch(() => setLogoutError('Could not log out. Please try again.')).finally(() => setLeaving(false));
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 12, paddingVertical: 14 },
  center: { textAlign: 'center' },
  benefits: { gap: 14 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plans: { flexDirection: 'row', gap: 12 },
  plan: { flex: 1, borderWidth: 2, borderRadius: 22, padding: 15, gap: 6 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  disclosure: { lineHeight: 19, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
});
