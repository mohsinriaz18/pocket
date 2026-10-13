import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, Card, Txt, Row, Stat, DataState, Empty, Btn, useConfirm, MissingRates, FadeIn, Banner, Progress } from '@/components/ui';
import { Actions } from '@/components/actions';
import { DebtForm, RepaySheet } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, convert } from '@/lib/finance';
import { num } from '@/lib/helpers';
import { Debt } from '@/lib/types';

export default function Debts() {
  const p = usePalette();
  const { data, loading, error, refresh, remove } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  const [edit, setEdit] = useState<Debt | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [repay, setRepay] = useState<Debt | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();
  const missing = new Set<string>();
  let total = 0, orig = 0, monthly = 0, lent = 0;
  data.debts.forEach((d) => {
    const o = convert(num(d.outstanding), d.currency, cur, data.exchange_rates);
    const a = convert(num(d.original_amount), d.currency, cur, data.exchange_rates);
    const m = convert(num(d.minimum_payment), d.currency, cur, data.exchange_rates);
    if (o === null || a === null || m === null) { missing.add(d.currency); return; }
    if (d.direction === 'lent') { lent += o; return; }
    total += o; orig += a; monthly += d.frequency === 'Weekly' ? m * 52 / 12 : d.frequency === 'Quarterly' ? m / 3 : d.frequency === 'Yearly' ? m / 12 : m;
  });
  const paid = Math.max(0, orig - total);
  const pct = orig > 0 ? (paid / orig) * 100 : 0;
  const openNew = () => { setEdit(undefined); setOpen(true); };
  return (
    <>
      <Screen title="Debts & Loans" back onRefresh={refresh}>
        <DataState />
        {!loading && !error ? (
          <>
            <FadeIn>
              <Card tone="dark" style={{ padding: 20, gap: 8 }}>
                <Txt v="label" color={p.lime}>Total debt</Txt>
                <Txt v="num" color={p.onPrimary} numberOfLines={1}>{money(total, cur)}</Txt>
                <Progress pct={pct} color={p.lime} />
                <Txt v="small" color={p.lime}>{pct.toFixed(1)}% paid</Txt>
              </Card>
            </FadeIn>
            <MissingRates list={Array.from(missing)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat icon="repeat" label="Per month" value={money(monthly, cur)} />
              <Stat icon="check-circle" label="Paid so far" value={money(paid, cur)} tone={p.good} />
            </View>
            {lent > 0 ? <Stat icon="arrow-down-left" label="Owed to you" value={money(lent, cur)} tone={p.good} /> : null}
            <Txt v="h2" style={{ marginTop: 8 }}>Your debts</Txt>
            {err ? <Banner kind="error" message={err} /> : null}
            {data.debts.length === 0 ? <Empty icon="alert-circle" title="No debts recorded" body="Add a loan or card balance to follow how fast you are paying it off." action="Add debt" onAction={openNew} /> : (
              <View style={{ gap: 10 }}>
                {data.debts.map((d, i) => {
                  const dp = num(d.original_amount) > 0 ? ((num(d.original_amount) - num(d.outstanding)) / num(d.original_amount)) * 100 : 0;
                  return (
                    <FadeIn key={d.id} i={i}>
                      <Card style={{ gap: 10 }} onPress={() => { setEdit(d); setOpen(true); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Txt v="h3">{d.name}</Txt>
                            <Txt v="small" muted>{d.direction === 'lent' ? 'Owed to you' : 'You owe'} · {d.type}{d.lender ? ` · ${d.lender}` : ''}</Txt>
                          </View>
                          <Actions onDelete={() => ask('Delete debt', `Delete ${d.name}?`, 'Delete', async () => { setErr(null); try { await remove('debts', d.id); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not delete.'); } })} />
                        </View>
                        <Progress pct={dp} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Txt v="small">{money(num(d.outstanding), d.currency)} left of {money(num(d.original_amount), d.currency)}</Txt>
                          <Txt v="small" muted>{Math.max(0, dp).toFixed(0)}% paid</Txt>
                        </View>
                        <Btn small kind="dark" label={d.direction === 'lent' ? 'Record repayment' : 'Record payment'} onPress={() => setRepay(d)} />
                      </Card>
                    </FadeIn>
                  );
                })}
              </View>
            )}
            <Btn label="Add debt" icon="plus" onPress={openNew} />
          </>
        ) : null}
      </Screen>
      <DebtForm visible={open} onClose={() => setOpen(false)} record={edit} />
      <RepaySheet debt={repay} onClose={() => setRepay(null)} />
      {el}
    </>
  );
}
