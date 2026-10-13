import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Progress, Screen, Card, Txt, Segmented, Chips, Field, SectionTitle, Stat, Row, Btn, DataState, Empty, MissingRates, Banner, IconBtn } from '@/components/ui';
import { DonutBlock, InOutBars } from '@/components/charts';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, summary, dateRange, categoryTotals, trend, convert, accountBalance, goalProgress } from '@/lib/finance';
import { exportReport } from '@/lib/export';
import { daysBetween, fmtDate, isDate, num, shiftAnchor, today } from '@/lib/helpers';

type PeriodLabel = 'Week' | 'Month' | 'Qtr' | 'Year' | 'Custom';
const map = { Week: 'Week', Month: 'Month', Qtr: 'Quarter', Year: 'Year', Custom: 'Custom' } as const;

export default function Reports() {
  const p = usePalette();
  const { data, loading, error, refresh } = usePocket();
  const [label, setLabel] = useState<PeriodLabel>('Month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [cFrom, setCFrom] = useState<string>(today());
  const [cTo, setCTo] = useState<string>(today());
  const [curSel, setCurSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const cur = curSel ?? data.profile?.primary_currency ?? 'PKR';
  const period = map[label];
  const customOk = isDate(cFrom) && isDate(cTo) && cFrom <= cTo;
  const r = period === 'Custom' ? { from: cFrom, to: cTo } : dateRange(period, anchor, cFrom, cTo);
  const valid = period !== 'Custom' || customOk;

  const v = useMemo(() => {
    if (!valid) return null;
    const s = summary(data, cur, r.from, r.to);
    const spend = categoryTotals(s.transactions, 'out', cur, data.exchange_rates);
    const earn = categoryTotals(s.transactions, 'in', cur, data.exchange_rates);
    const tr = trend(data, cur, r.from, r.to);
    const big = s.transactions.filter((t) => t.type === 'out').map((t) => ({ t, c: convert(num(t.amount), t.currency, cur, data.exchange_rates) })).filter((x): x is { t: typeof x.t; c: number } => x.c !== null).sort((a, b) => b.c - a.c).slice(0, 5);
    const debtPaid = s.transactions.filter((t) => t.debt_id).map((t) => convert(num(t.amount), t.currency, cur, data.exchange_rates)).reduce<number>((a, b) => a + (b ?? 0), 0);
    const recent = [...s.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return { s, spend, earn, tr, big, debtPaid, recent };
  }, [data, cur, r.from, r.to, valid]);

  const f = (x: number) => money(x, cur);
  const elapsedTo = r.to < today() ? r.to : today();
  const days = valid ? Math.max(1, daysBetween(r.from, elapsedTo)) : 1;
  const doExport = async (fmt: 'Excel' | 'CSV' | 'PDF') => {
    setBusy(fmt); setMsg(null);
    try { await exportReport(fmt, data, cur, r.from, r.to); setMsg({ kind: 'ok', text: `${fmt} export ready.` }); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : `${fmt} export failed.` }); } finally { setBusy(null); }
  };

  return (
    <Screen title="Reports" back onRefresh={refresh}>
      <Segmented options={['Week', 'Month', 'Qtr', 'Year', 'Custom'] as PeriodLabel[]} value={label} onChange={setLabel} />
      {period !== 'Custom' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconBtn icon="chevron-left" label="Previous period" onPress={() => setAnchor(shiftAnchor(period, anchor, -1))} />
          <Txt v="h3">{fmtDate(r.from)} to {fmtDate(r.to)}</Txt>
          <IconBtn icon="chevron-right" label="Next period" onPress={() => setAnchor(shiftAnchor(period, anchor, 1))} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="From" value={cFrom} onChangeText={setCFrom} placeholder="YYYY-MM-DD" /></View>
          <View style={{ flex: 1 }}><Field label="To" value={cTo} onChangeText={setCTo} placeholder="YYYY-MM-DD" /></View>
        </View>
      )}
      {!valid ? <Banner kind="warn" message="Enter a valid start and end date (YYYY-MM-DD), with the start on or before the end." /> : null}
      <View style={{ gap: 6 }}>
        <Txt v="label" muted>Report currency</Txt>
        <Chips options={Array.from(new Set([data.profile?.primary_currency ?? 'PKR', data.profile?.secondary_currency ?? 'USD']))} value={cur} onChange={setCurSel} />
      </View>
      <DataState />
      {!loading && !error && v ? (
        <>
          <MissingRates list={v.s.missingCurrencies} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat icon="arrow-down-left" label="Earned" value={f(v.s.cashIn)} tone={p.good} />
            <Stat icon="arrow-up-right" label="Spent" value={f(v.s.cashOut)} tone={p.bad} />
            <Stat icon="pocket" label="Net saved" value={f(v.s.cashIn - v.s.cashOut)} tone={v.s.cashIn - v.s.cashOut < 0 ? p.bad : p.good} />
            <Stat icon="calendar" label="Avg / day spent" value={f(v.s.cashOut / days)} />
          </View>
          <SectionTitle title="Money in vs out" />
          <Card>{v.tr.length ? <InOutBars data={v.tr} /> : <Txt muted>No activity in this period.</Txt>}</Card>

          <SectionTitle title="Where you spent" />
          {v.spend.length ? <Card><DonutBlock data={v.spend.map((c) => ({ label: c.category, value: c.amount }))} fmt={f} centerLabel="Spent" /></Card> : <Empty icon="pie-chart" title="No spending" body="No money out in this period." />}
          <SectionTitle title="Where you earned" />
          {v.earn.length ? <Card><DonutBlock data={v.earn.map((c) => ({ label: c.category, value: c.amount }))} fmt={f} centerLabel="Earned" /></Card> : <Empty icon="pie-chart" title="No income" body="No money in during this period." />}
          <SectionTitle title="Biggest expenses" />
          {v.big.length ? <View style={{ gap: 10 }}>{v.big.map(({ t, c }) => <Row key={t.id} icon="arrow-up-right" title={t.category} sub={`${fmtDate(t.date)}${t.note ? ` · ${t.note}` : ''}`} value={f(c)} valueColor={p.bad} />)}</View> : <Empty icon="list" title="No expenses" body="Nothing spent in this period." />}

          <SectionTitle title="Investments" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat label="Total invested" value={f(v.s.invested)} />
            <Stat label="Current value" value={f(v.s.portfolio)} />
            <Stat label="Gain / loss" value={f(v.s.gain)} tone={v.s.gain < 0 ? p.bad : p.good} />
          </View>
          {data.investments.length ? <View style={{ gap: 10 }}>{data.investments.map((i) => { const g = num(i.current_value) - num(i.invested); return <Row key={i.id} icon="bar-chart-2" title={i.name} sub={`${i.type} · invested ${money(num(i.invested), i.currency)}`} value={`${g >= 0 ? '+' : '-'}${money(Math.abs(g), i.currency)}`} valueColor={g < 0 ? p.bad : p.good} />; })}</View> : <Empty icon="trending-up" title="No holdings" body="Investments you add will be broken down here." />}
          <SectionTitle title="Goals" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Saved" value={f(v.s.goalsSaved)} />
            <Stat label="Target" value={f(v.s.goalsTarget)} />
          </View>
          {data.goals.map((g) => <Card key={g.id} style={{ gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="h3">{g.name}</Txt><Txt v="small" muted>{(goalProgress(g) * 100).toFixed(0)}%</Txt></View><Progress pct={goalProgress(g) * 100} /><Txt v="small" muted>{money(num(g.saved), g.currency)} of {money(num(g.target), g.currency)}</Txt></Card>)}
          <SectionTitle title="Debts" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Outstanding debt" value={f(v.s.debt)} />
            <Stat label="Debt payments in period" value={f(v.debtPaid)} />
          </View>
          {data.debts.map((d) => <Row key={d.id} icon="alert-circle" title={d.name} sub={`${d.direction === 'lent' ? 'Owed to you' : 'You owe'} · paid ${money(Math.max(0, num(d.original_amount) - num(d.outstanding)), d.currency)}`} value={money(num(d.outstanding), d.currency)} />)}
          <SectionTitle title="Account balances" />
          {data.accounts.filter((a) => !a.archived).map((a) => <Row key={a.id} icon="credit-card" title={a.name} sub={`${a.currency}${a.last_four ? ` ···${a.last_four}` : ''}`} value={money(accountBalance(a, data.transactions), a.currency)} />)}
          <SectionTitle title="Recent activity" />
          {v.recent.length ? <View style={{ gap: 10 }}>{v.recent.map((t) => <Row key={t.id} icon={t.type === 'in' ? 'arrow-down-left' : t.type === 'out' ? 'arrow-up-right' : 'repeat'} title={t.category} sub={fmtDate(t.date)} value={money(num(t.amount), t.currency)} valueColor={t.type === 'in' ? p.good : t.type === 'out' ? p.bad : undefined} />)}</View> : <Empty icon="activity" title="No activity" body="Nothing recorded in this period." />}

          <SectionTitle title="Net worth" />
          <Txt v="small" muted>Net worth and portfolio are current snapshots, not limited to the dates above.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat label="Net worth" value={f(v.s.netWorth)} tone={v.s.netWorth < 0 ? p.bad : p.good} />
            <Stat label="Total assets" value={f(v.s.assets)} />
            <Stat label="Total liabilities" value={f(v.s.liabilities)} />
          </View>

          <SectionTitle title="Export" />
          {msg ? <Banner kind={msg.kind} message={msg.text} /> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['Excel', 'CSV', 'PDF'] as const).map((k) => <Btn key={k} kind="dark" small label={k} icon="download" loading={busy === k} disabled={!!busy} onPress={() => doExport(k)} style={{ flex: 1 }} />)}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
