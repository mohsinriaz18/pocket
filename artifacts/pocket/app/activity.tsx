import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen, Segmented, Field, Row, DataState, Empty, useConfirm, FadeIn, Banner, IconBtn } from '@/components/ui';
import { Actions } from '@/components/actions';
import { TxForm } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money } from '@/lib/finance';
import { fmtDate, num } from '@/lib/helpers';
import { Transaction } from '@/lib/types';

type Filter = 'All' | 'In' | 'Out' | 'Transfers';

export default function Activity() {
  const p = usePalette();
  const { data, loading, error, refresh, remove } = usePocket();
  const [filter, setFilter] = useState<Filter>('All');
  const [q, setQ] = useState<string>('');
  const [edit, setEdit] = useState<Transaction | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();
  const list = useMemo(() => {
    const t = filter === 'All' ? null : filter === 'In' ? 'in' : filter === 'Out' ? 'out' : 'transfer';
    const needle = q.trim().toLowerCase();
    return [...data.transactions]
      .filter((x) => (!t || x.type === t) && (!needle || x.note?.toLowerCase().includes(needle) || x.category.toLowerCase().includes(needle)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [data.transactions, filter, q]);
  const acc = (id: string | null) => data.accounts.find((a) => a.id === id)?.name ?? 'Account';
  return (
    <>
      <Screen title="All activity" back onRefresh={refresh} right={<IconBtn tone="lime" icon="plus" label="Add transaction" onPress={() => { setEdit(undefined); setOpen(true); }} />}>
        <Segmented options={['All', 'In', 'Out', 'Transfers'] as Filter[]} value={filter} onChange={setFilter} />
        <Field icon="search" placeholder="Search notes or categories" value={q} onChangeText={setQ} />
        <DataState />
        {err ? <Banner kind="error" message={err} /> : null}
        {!loading && !error ? (
          list.length === 0 ? (
            <Empty icon="activity" title={data.transactions.length ? 'No matches' : 'Nothing logged yet'} body={data.transactions.length ? 'Try another filter or search.' : 'Transactions you add will be listed here.'} action={data.transactions.length ? undefined : 'Add transaction'} onAction={() => { setEdit(undefined); setOpen(true); }} />
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((t, i) => (
                <FadeIn key={t.id} i={Math.min(i, 6)}>
                  <Row icon={t.type === 'in' ? 'arrow-down-left' : t.type === 'out' ? 'arrow-up-right' : 'repeat'} title={t.category}
                    sub={`${t.type === 'transfer' ? `${acc(t.account_id)} to ${acc(t.to_account_id)}` : acc(t.account_id)} · ${fmtDate(t.date)}${t.note ? ` · ${t.note}` : ''}`}
                    value={`${t.type === 'in' ? '+' : t.type === 'out' ? '-' : ''}${money(num(t.amount), t.currency)}`}
                    valueColor={t.type === 'in' ? p.good : t.type === 'out' ? p.bad : undefined}
                    onPress={() => { setEdit(t); setOpen(true); }}
                    trailing={<Actions onDelete={() => ask('Delete transaction', 'This removes the entry and updates your balances.', 'Delete', async () => { setErr(null); try { await remove('transactions', t.id); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not delete.'); } })} />} />
                </FadeIn>
              ))}
            </View>
          )
        ) : null}
      </Screen>
      <TxForm visible={open} onClose={() => setOpen(false)} record={edit} />
      {el}
    </>
  );
}
