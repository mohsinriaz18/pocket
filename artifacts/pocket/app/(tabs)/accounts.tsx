import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, Card, Txt, Row, Stat, DataState, Empty, Btn, useConfirm, MissingRates, FadeIn, Banner } from '@/components/ui';
import { Actions } from '@/components/actions';
import { AccountForm } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, accountBalance, convert } from '@/lib/finance';
import { Account } from '@/lib/types';

export default function Accounts() {
  const p = usePalette();
  const { data, loading, error, refresh, remove } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  const [edit, setEdit] = useState<Account | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();
  const accounts = data.accounts.filter((a) => !a.archived);
  const missing = new Set<string>();
  let assets = 0, owed = 0;
  accounts.forEach((a) => {
    const b = accountBalance(a, data.transactions);
    const c = convert(b, a.currency, cur, data.exchange_rates);
    if (c === null) { missing.add(a.currency); return; }
    if (c >= 0) assets += c; else owed += c;
  });
  const openNew = () => { setEdit(undefined); setOpen(true); };
  return (
    <>
      <Screen title="Accounts" tabbed onRefresh={refresh}>
        <DataState />
        {!loading && !error ? (
          <>
            <FadeIn>
              <Card tone="dark" style={{ padding: 20, gap: 4 }}>
                <Txt v="label" color={p.lime}>Total across accounts</Txt>
                <Txt v="num" color={p.onPrimary} numberOfLines={1}>{money(assets + owed, cur)}</Txt>
              </Card>
            </FadeIn>
            <MissingRates list={Array.from(missing)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat icon="arrow-down-left" label="Assets" value={money(assets, cur)} tone={p.good} />
              <Stat icon="arrow-up-right" label="Owed" value={money(Math.abs(owed), cur)} tone={p.bad} />
            </View>
            <Txt v="h2" style={{ marginTop: 8 }}>Your accounts</Txt>
            {delErr ? <Banner kind="error" message={delErr} /> : null}
            {accounts.length === 0 ? <Empty icon="credit-card" title="No accounts yet" body="Add a bank account, wallet or cash to see balances here." action="Add account" onAction={openNew} /> : (
              <View style={{ gap: 10 }}>
                {accounts.map((a, i) => (
                  <FadeIn key={a.id} i={i}>
                    <Row icon={a.type === 'Cash' ? 'dollar-sign' : a.type === 'Credit Card' ? 'credit-card' : 'briefcase'} title={a.name}
                      sub={`${a.bank || a.type}${a.last_four ? ` ending ${a.last_four}` : ''} · ${a.currency}`}
                      value={money(accountBalance(a, data.transactions), a.currency)}
                      valueColor={accountBalance(a, data.transactions) < 0 ? p.bad : undefined}
                      onPress={() => { setEdit(a); setOpen(true); }}
                      trailing={<Actions onDelete={() => ask('Delete account', `Delete ${a.name}? Deletion is blocked if this account has any transaction history. Nothing is removed in that case; you will see an error instead.`, 'Delete', async () => { setDelErr(null); try { await remove('accounts', a.id); } catch (e) { setDelErr(e instanceof Error ? e.message : 'Could not delete account.'); } })} />} />
                  </FadeIn>
                ))}
              </View>
            )}
            <Btn label="Add account" icon="plus" onPress={openNew} />
          </>
        ) : null}
      </Screen>
      <AccountForm visible={open} onClose={() => setOpen(false)} record={edit} />
      {el}
    </>
  );
}
