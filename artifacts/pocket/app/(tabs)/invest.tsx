import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen, Card, Txt, Row, DataState, Empty, Btn, useConfirm, MissingRates, FadeIn, Banner, SectionTitle } from '@/components/ui';
import { Actions } from '@/components/actions';
import { InvestmentForm } from '@/components/forms';
import { DonutBlock, LineChart } from '@/components/charts';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, convert } from '@/lib/finance';
import { num } from '@/lib/helpers';
import { Investment } from '@/lib/types';

export default function Invest() {
  const p = usePalette();
  const { data, loading, error, refresh, remove } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  const [edit, setEdit] = useState<Investment | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();

  const calc = useMemo(() => {
    const missing = new Set<string>();
    let value = 0, invested = 0;
    const byType: Record<string, number> = {};
    data.investments.forEach((i) => {
      const v = convert(num(i.current_value), i.currency, cur, data.exchange_rates);
      const c = convert(num(i.invested), i.currency, cur, data.exchange_rates);
      if (v === null || c === null) { missing.add(i.currency); return; }
      value += v; invested += c;
      byType[i.type] = (byType[i.type] ?? 0) + v;
    });
    // trend from recorded valuations: sum of latest known value per holding at each valuation date
    const dates = Array.from(new Set(data.investment_valuations.map((v) => v.date))).sort();
    const points: number[] = [];
    dates.forEach((d) => {
      let total = 0;
      data.investments.forEach((i) => {
        const vs = data.investment_valuations.filter((v) => v.investment_id === i.id && v.date <= d).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!vs) return;
        const c = convert(num(vs.value), i.currency, cur, data.exchange_rates);
        if (c !== null) total += c;
      });
      points.push(total);
    });
    return { missing: Array.from(missing), value, invested, byType, points };
  }, [data, cur]);

  const gain = calc.value - calc.invested;
  const pct = calc.invested > 0 ? (gain / calc.invested) * 100 : 0;
  const openNew = () => { setEdit(undefined); setOpen(true); };

  return (
    <>
      <Screen title="Investments" tabbed onRefresh={refresh}>
        <DataState />
        {!loading && !error ? (
          <>
            <FadeIn>
              <Card tone="dark" style={{ padding: 20, gap: 4 }}>
                <Txt v="label" color={p.lime}>Portfolio value</Txt>
                <Txt v="num" color={p.onPrimary} numberOfLines={1}>{money(calc.value, cur)}</Txt>
                <Txt v="small" color={gain < 0 ? '#FFB4A6' : p.lime}>{gain >= 0 ? '+' : '-'}{money(Math.abs(gain), cur)} ({pct.toFixed(1)}%) since purchase</Txt>
              </Card>
            </FadeIn>
            <MissingRates list={calc.missing} />
            {calc.points.length >= 2 ? (
              <Card style={{ gap: 8 }}><Txt v="label" muted>Trend</Txt><LineChart points={calc.points} /></Card>
            ) : null}
            {Object.keys(calc.byType).length > 0 ? (
              <>
                <SectionTitle title="Allocation" />
                <Card><DonutBlock data={Object.entries(calc.byType).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} fmt={(v) => money(v, cur)} centerLabel="Invested" /></Card>
              </>
            ) : null}
            <Txt v="h2" style={{ marginTop: 8 }}>Holdings</Txt>
            {delErr ? <Banner kind="error" message={delErr} /> : null}
            {data.investments.length === 0 ? <Empty icon="trending-up" title="No holdings yet" body="Add stocks, funds, gold or crypto to follow your portfolio." action="Add investment" onAction={openNew} /> : (
              <View style={{ gap: 10 }}>
                {data.investments.map((i, k) => {
                  const g = num(i.current_value) - num(i.invested);
                  return (
                    <FadeIn key={i.id} i={k}>
                      <Row icon="bar-chart-2" title={i.name} sub={`${i.type}${i.platform ? ` · ${i.platform}` : ''} · ${g >= 0 ? '+' : '-'}${money(Math.abs(g), i.currency)}`}
                        value={money(num(i.current_value), i.currency)} valueColor={undefined} onPress={() => { setEdit(i); setOpen(true); }}
                        trailing={<Actions onDelete={() => ask('Delete holding', `Delete ${i.name}?`, 'Delete', async () => { setDelErr(null); try { await remove('investments', i.id); } catch (e) { setDelErr(e instanceof Error ? e.message : 'Could not delete.'); } })} />} />
                    </FadeIn>
                  );
                })}
              </View>
            )}
            <Btn label="Add investment" icon="plus" onPress={openNew} />
          </>
        ) : null}
      </Screen>
      <InvestmentForm visible={open} onClose={() => setOpen(false)} record={edit} />
      {el}
    </>
  );
}
