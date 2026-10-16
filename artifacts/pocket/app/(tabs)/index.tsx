import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, Txt, Segmented, Chips, SectionTitle, Row, Stat, DataState, Empty, IconBtn, MissingRates, FadeIn } from '@/components/ui';
import { DonutBlock, LineChart, InOutBars } from '@/components/charts';
import { Banner } from '@/components/ui';
import { netWorthTrend, billDueInDays } from '@/lib/finance';
import { TxForm } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, accountBalance, summary, dateRange, categoryTotals, convert, trend } from '@/lib/finance';
import { fmtDate, num } from '@/lib/helpers';
import { Investment } from '@/lib/types';

export default function Home() {
  const p = usePalette();
  const router = useRouter();
  const { data, loading, error, refresh, session } = usePocket();
  const primary = data.profile?.primary_currency ?? 'PKR';
  const secondary = data.profile?.secondary_currency ?? 'USD';
  const [sel, setSel] = useState<string | null>(null);
  const [period, setPeriod] = useState<'Month' | 'Quarter' | 'Year'>('Month');
  const [adding, setAdding] = useState<boolean>(false);
  const cur = sel ?? primary;
  const r = dateRange(period, new Date());
  const s = summary(data, cur, r.from, r.to);
  const f = (v: number) => money(v, cur);
  const spend = categoryTotals(s.transactions, 'out', cur, data.exchange_rates);
  const nwt = netWorthTrend(data, cur, r.from, r.to);
  const nwPoints = nwt.map((x) => x.value);
  const nwFlat = nwPoints.length < 2 || (data.accounts.length === 0 && data.investments.length === 0 && data.debts.length === 0);
  const cash = trend(data, cur, r.from, r.to);
  const bills = data.bills.filter((b) => !b.paid).map((b) => ({ b, d: billDueInDays(b) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const name = data.profile?.name?.split(' ')[0] || (session?.user?.email ?? '').split('@')[0];
  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'Account';
  const invValue = (i: Investment) => convert(num(i.current_value), i.currency, cur, data.exchange_rates);

  return (
    <>
      <Screen title="Dashboard" subtitle={name ? `Hello, ${name}` : undefined} tabbed onRefresh={refresh}
        right={<IconBtn tone="lime" icon="plus" label="Add transaction" onPress={() => setAdding(true)} />}>
        <DataState />
        {!loading && !error ? (
          <>
            <FadeIn>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt v="label" muted>Displaying in</Txt>
                <View style={{ flex: 1 }}><Chips options={Array.from(new Set([primary, secondary]))} value={cur} onChange={setSel} /></View>
              </View>
            </FadeIn>
            <FadeIn i={1}>
              <Card tone="dark" style={{ gap: 6, padding: 20 }}>
                <Txt v="label" color={p.lime}>Net worth</Txt>
                <Txt v="num" color={p.onPrimary} numberOfLines={1}>{f(s.netWorth)}</Txt>
                <Txt v="small" color={p.onPrimary} style={{ opacity: 0.75 }}>Right now, across accounts, investments and debts</Txt>
                <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
                  <View><Txt v="label" color={p.onPrimary} style={{ opacity: 0.7 }}>Total assets</Txt><Txt v="h3" color={p.onPrimary}>{f(s.assets)}</Txt></View>
                  <View><Txt v="label" color={p.onPrimary} style={{ opacity: 0.7 }}>Liabilities</Txt><Txt v="h3" color={p.onPrimary}>{f(s.liabilities)}</Txt></View>
                </View>
              </Card>
            </FadeIn>
            <MissingRates list={s.missingCurrencies} error={data.exchange_rate_error} />
            <Segmented options={['Month', 'Quarter', 'Year'] as const} value={period} onChange={setPeriod} />
            <FadeIn i={2} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Stat icon="arrow-down-left" label="Cash In" value={f(s.cashIn)} tone={p.good} />
              <Stat icon="arrow-up-right" label="Cash Out" value={f(s.cashOut)} tone={p.bad} />
              <Stat icon="trending-up" label="Invest gain" value={f(s.gain)} tone={s.gain < 0 ? p.bad : p.good} />
              <Stat icon="alert-circle" label="Debt" value={f(s.debt)} />
              <Stat icon="target" label="Goals" value={`${f(s.goalsSaved)} of ${f(s.goalsTarget)}`} />
            </FadeIn>

            <SectionTitle title="Net worth trend" />
            <Card style={{ gap: 8 }}>
              {nwFlat ? <Txt muted>No recorded financial history for this period yet.</Txt> : (
                <>
                  <LineChart points={nwPoints} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt v="small" muted>{nwt[0]?.label}</Txt><Txt v="small" muted>{nwt[nwt.length - 1]?.label}</Txt>
                  </View>
                  <Txt v="small" muted>Based on recorded opening dates, transactions and saved valuations. Past currency conversions use saved daily rates where available, otherwise the latest saved rate.</Txt>
                </>
              )}
            </Card>
            <SectionTitle title="Cash flow" />
            <Card>{cash.length ? <InOutBars data={cash} /> : <Txt muted>No cash movement in this period.</Txt>}</Card>

            <SectionTitle title="Accounts" action="See all" onAction={() => router.push('/accounts')} />
            {data.accounts.length === 0 ? <Empty icon="credit-card" title="No accounts yet" body="Add a bank, wallet or cash account to start tracking." action="Add account" onAction={() => router.push('/accounts')} /> : (
              <View style={{ gap: 10 }}>
                {data.accounts.filter((a) => !a.archived).slice(0, 4).map((a) => (
                  <Row key={a.id} icon={a.type === 'Cash' ? 'dollar-sign' : 'credit-card'} title={a.name} sub={`${a.bank || a.type}${a.last_four ? ` ending ${a.last_four}` : ''}`} value={money(accountBalance(a, data.transactions), a.currency)} />
                ))}
              </View>
            )}

            <SectionTitle title="Upcoming bills" action="Bills" onAction={() => router.push('/bills')} />
            {bills.length === 0 ? <Empty icon="calendar" title="No bills due" body="Bills you add will show up here before they are due." /> : (
              <View style={{ gap: 10 }}>
                {bills.map(({ b, d }) => <Row key={b.id} icon="file-text" title={b.name} sub={d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`} value={money(num(b.amount), b.currency)} valueColor={d <= 3 ? p.bad : undefined} />)}
              </View>
            )}

            <SectionTitle title="Spending by category" />
            {spend.length === 0 ? <Empty icon="pie-chart" title="No spending in this period" body="Money out transactions will be broken down here." /> : (
              <Card><DonutBlock data={spend.map((c) => ({ label: c.category, value: c.amount }))} fmt={f} centerLabel="Spent" /></Card>
            )}

            <SectionTitle title="Investments" action="Invest" onAction={() => router.push('/invest')} />
            <Card style={{ gap: 4 }}>
              <Txt v="label" muted>Portfolio value</Txt>
              <Txt v="h1">{f(s.portfolio)}</Txt>
              <Txt v="small" muted>{data.investments.length ? `${data.investments.length} holding${data.investments.length === 1 ? '' : 's'}` : 'No holdings yet'}</Txt>
            </Card>
            {data.investments.slice(0, 3).map((i) => (
              <Row key={i.id} icon="bar-chart-2" title={i.name} sub={i.type} value={(() => { const v = invValue(i); return v === null ? money(num(i.current_value), i.currency) : f(v); })()} />
            ))}

            <SectionTitle title="Recent activity" action="All activity" onAction={() => router.push('/activity')} />
            {recent.length === 0 ? <Empty icon="activity" title="Nothing logged yet" body="Add your first transaction to see it here." action="Add transaction" onAction={() => setAdding(true)} /> : (
              <View style={{ gap: 10 }}>
                {recent.map((t) => (
                  <Row key={t.id} icon={t.type === 'in' ? 'arrow-down-left' : t.type === 'out' ? 'arrow-up-right' : 'repeat'} title={t.category} sub={`${accName(t.account_id)} · ${fmtDate(t.date)}`}
                    value={`${t.type === 'in' ? '+' : t.type === 'out' ? '-' : ''}${money(num(t.amount), t.currency)}`} valueColor={t.type === 'in' ? p.good : t.type === 'out' ? p.bad : undefined} />
                ))}
              </View>
            )}
          </>
        ) : null}
      </Screen>
      <TxForm visible={adding} onClose={() => setAdding(false)} />
    </>
  );
}
