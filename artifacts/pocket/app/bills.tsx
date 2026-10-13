import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, Txt, Row, Stat, DataState, Empty, Btn, useConfirm, MissingRates, FadeIn, Banner } from '@/components/ui';
import { Actions } from '@/components/actions';
import { BillForm, PayBillSheet } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, convert } from '@/lib/finance';
import { num } from '@/lib/helpers';
import { billDueInDays } from '@/lib/finance';
import { Bill } from '@/lib/types';

export default function Bills() {
  const p = usePalette();
  const { data, loading, error, refresh, remove, save } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  const [edit, setEdit] = useState<Bill | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();
  const missing = new Set<string>();
  let month = 0, soon = 0;
  data.bills.forEach((b) => {
    const c = convert(num(b.amount), b.currency, cur, data.exchange_rates);
    if (c === null) { missing.add(b.currency); return; }
    const factor = b.repeats === 'Weekly' ? 52 / 12 : b.repeats === 'Yearly' ? 1 / 12 : b.repeats === 'Quarterly' ? 1 / 3 : 1;
    if (b.repeats !== 'Once') month += c * factor;
    if (!b.paid && billDueInDays(b) <= 7) soon += c;
  });
  const sorted = [...data.bills].sort((a, b) => Number(a.paid) - Number(b.paid) || billDueInDays(a) - billDueInDays(b));
  const openNew = () => { setEdit(undefined); setOpen(true); };
  return (
    <>
      <Screen title="Bills" back onRefresh={refresh}>
        <DataState />
        {!loading && !error ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat icon="repeat" label="Per month" value={money(month, cur)} />
              <Stat icon="clock" label="Due in 7 days" value={money(soon, cur)} tone={soon > 0 ? p.bad : undefined} />
            </View>
            <MissingRates list={Array.from(missing)} />
            <Txt v="h2" style={{ marginTop: 8 }}>All bills</Txt>
            {err ? <Banner kind="error" message={err} /> : null}
            {sorted.length === 0 ? <Empty icon="file-text" title="No bills yet" body="Add rent, utilities or subscriptions so nothing slips past." action="Add bill" onAction={openNew} /> : (
              <View style={{ gap: 10 }}>
                {sorted.map((b, i) => {
                  const d = billDueInDays(b);
                  return (
                    <FadeIn key={b.id} i={i}>
                      <Row icon={b.paid ? 'check-circle' : 'file-text'} title={b.name}
                        sub={b.paid ? `Paid · ${b.repeats}` : `${d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`} · day ${b.due_day} · ${b.repeats}`}
                        value={money(num(b.amount), b.currency)} valueColor={!b.paid && d <= 3 ? p.bad : undefined}
                        onPress={() => { setEdit(b); setOpen(true); }}
                        trailing={<Actions onDelete={() => ask('Delete bill', `Delete ${b.name}?`, 'Delete', async () => { setErr(null); try { await remove('bills', b.id); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not delete.'); } })} />} />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
                        {b.paid ? (
                          <Btn small kind="ghost" label="Mark unpaid" onPress={() => ask('Mark unpaid', 'This reverses its latest cash-out payment and restores the account balance.', 'Reverse payment', async () => { setErr(null); try { await save('bills', { id: b.id, paid: false }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not reverse the payment.'); } })} />
                        ) : (
                          <Btn small kind="dark" label="Pay bill" icon="check" onPress={() => setPaying(b)} />
                        )}
                      </View>
                    </FadeIn>
                  );
                })}
              </View>
            )}
            <Btn label="Add bill" icon="plus" onPress={openNew} />
          </>
        ) : null}
      </Screen>
      <BillForm visible={open} onClose={() => setOpen(false)} record={edit} />
      <PayBillSheet bill={paying} onClose={() => setPaying(null)} />
      {el}
    </>
  );
}
