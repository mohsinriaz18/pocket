import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, Card, Txt, DataState, Empty, Btn, useConfirm, MissingRates, FadeIn, Banner, Progress } from '@/components/ui';
import { Actions } from '@/components/actions';
import { GoalForm } from '@/components/forms';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { money, convert, goalProgress } from '@/lib/finance';
import { fmtDate, num } from '@/lib/helpers';
import { Goal } from '@/lib/types';

export default function Goals() {
  const p = usePalette();
  const { data, loading, error, refresh, remove } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  const [edit, setEdit] = useState<Goal | undefined>(undefined);
  const [open, setOpen] = useState<boolean>(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const { ask, el } = useConfirm();
  const missing = new Set<string>();
  let saved = 0, target = 0;
  data.goals.forEach((g) => {
    const s = convert(num(g.saved), g.currency, cur, data.exchange_rates);
    const t = convert(num(g.target), g.currency, cur, data.exchange_rates);
    if (s === null || t === null) { missing.add(g.currency); return; }
    saved += s; target += t;
  });
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const openNew = () => { setEdit(undefined); setOpen(true); };
  return (
    <>
      <Screen title="Goals" tabbed onRefresh={refresh}>
        <DataState />
        {!loading && !error ? (
          <>
            <FadeIn>
              <Card tone="dark" style={{ padding: 20, gap: 8 }}>
                <Txt v="label" color={p.lime}>Saved toward goals</Txt>
                <Txt v="num" color={p.onPrimary} numberOfLines={1}>{money(saved, cur)}</Txt>
                <Progress pct={pct} color={p.lime} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v="small" color={p.onPrimary}>{money(target, cur)} target</Txt>
                  <Txt v="small" color={p.lime}>{pct.toFixed(1)}% complete</Txt>
                </View>
              </Card>
            </FadeIn>
            <MissingRates list={Array.from(missing)} />
            <Txt v="h2" style={{ marginTop: 8 }}>Your goals</Txt>
            {delErr ? <Banner kind="error" message={delErr} /> : null}
            {data.goals.length === 0 ? <Empty icon="target" title="No goals yet" body="Set a target for an emergency fund, a trip or anything you are saving for." action="New goal" onAction={openNew} /> : (
              <View style={{ gap: 10 }}>
                {data.goals.map((g, i) => {
                  const gp = goalProgress(g) * 100;
                  return (
                    <FadeIn key={g.id} i={i}>
                      <Card onPress={() => { setEdit(g); setOpen(true); }} style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Txt v="h3">{g.name}</Txt>
                            <Txt v="small" muted>{g.category}{g.target_date ? ` · by ${fmtDate(g.target_date)}` : ''}</Txt>
                          </View>
                          <Actions onDelete={() => ask('Delete goal', `Delete ${g.name}?`, 'Delete', async () => { setDelErr(null); try { await remove('goals', g.id); } catch (e) { setDelErr(e instanceof Error ? e.message : 'Could not delete.'); } })} />
                        </View>
                        <Progress pct={gp} color={gp >= 100 ? p.good : p.teal} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Txt v="small">{money(num(g.saved), g.currency)} of {money(num(g.target), g.currency)}</Txt>
                          <Txt v="small" muted>{gp.toFixed(0)}%</Txt>
                        </View>
                      </Card>
                    </FadeIn>
                  );
                })}
              </View>
            )}
            <Btn label="New goal" icon="plus" onPress={openNew} />
          </>
        ) : null}
      </Screen>
      <GoalForm visible={open} onClose={() => setOpen(false)} record={edit} />
      {el}
    </>
  );
}
