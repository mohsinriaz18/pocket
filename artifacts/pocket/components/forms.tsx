import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Sheet, Field, Chips, Btn, Txt, Segmented, Banner } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';
import { isDate, today, num, accountLabels } from '@/lib/helpers';
import {
  Account, Bill, Debt, Goal, Investment, Transaction, Entity, currencies, outCategories, inCategories, goalCategories,
} from '@/lib/types';

type Kind = 'text' | 'number' | 'select' | 'date' | 'multiline' | 'digits';
interface F { key: string; label: string; kind: Kind; options?: string[]; required?: boolean; placeholder?: string; optional?: boolean }
type Vals = Record<string, string>;

function FormSheet({ visible, onClose, title, fields, initial, submitLabel, onSubmit, extra }: {
  visible: boolean; onClose: () => void; title: string; fields: F[]; initial: Vals; submitLabel: string;
  onSubmit: (v: Vals) => Promise<void>; extra?: React.ReactNode;
}) {
  const [vals, setVals] = useState<Vals>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const initRef = useRef(initial);
  initRef.current = initial;
  const lock = useRef<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  useEffect(() => { if (visible) { setVals(initRef.current); setErr(null); setDirty(false); } }, [visible]);
  const set = (k: string, v: string) => { setDirty(true); setVals((s) => ({ ...s, [k]: v })); };

  const submit = async () => {
    for (const f of fields) {
      const v = (vals[f.key] ?? '').trim();
      if (!v && f.required) return setErr(`${f.label} is required.`);
      if (v && f.kind === 'number' && !Number.isFinite(Number(v))) return setErr(`${f.label} must be a number.`);
      if (v && f.kind === 'date' && !isDate(v)) return setErr(`${f.label} must be a valid date in YYYY-MM-DD format.`);
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setErr(null);
    try { await onSubmit(vals); setDirty(false); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save. Try again.'); } finally { lock.current = false; setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} dirty={dirty} busy={busy}>
      {extra}
      {fields.map((f) => f.kind === 'select' ? (
        <View key={f.key} style={{ gap: 6 }}>
          <Txt v="label" muted>{f.label}</Txt>
          <Chips options={f.options ?? []} value={vals[f.key] ?? ''} onChange={(v) => set(f.key, v)} />
        </View>
      ) : (
        <Field
          key={f.key}
          label={f.label + (f.required ? '' : '')}
          value={vals[f.key] ?? ''}
          onChangeText={(v) => set(f.key, v)}
          placeholder={f.placeholder ?? (f.kind === 'date' ? 'YYYY-MM-DD' : f.optional ? 'Optional' : '')}
          keyboardType={f.kind === 'number' ? 'numbers-and-punctuation' : f.kind === 'digits' ? 'number-pad' : 'default'}
          multiline={f.kind === 'multiline'}
          maxLength={f.kind === 'digits' ? 4 : undefined}
        />
      ))}
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label={submitLabel} loading={busy} onPress={submit} />
    </Sheet>
  );
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const nz = (v: string) => (v.trim() === '' ? null : v.trim());
const withId = (rec: { id?: string } | undefined, r: Record<string, unknown>) => (rec?.id ? { ...r, id: rec.id } : r);

interface P<T> { visible: boolean; onClose: () => void; record?: T }

export function AccountForm({ visible, onClose, record }: P<Account>) {
  const { save, data } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  return (
    <FormSheet visible={visible} onClose={onClose} title={record ? 'Edit account' : 'New account'} submitLabel="Save account"
      fields={[
        { key: 'name', label: 'Account name', kind: 'text', required: true },
        { key: 'bank', label: 'Bank', kind: 'text', optional: true },
        { key: 'last_four', label: 'Last 4 digits', kind: 'digits', optional: true },
        { key: 'currency', label: 'Currency', kind: 'select', options: currencies },
        { key: 'type', label: 'Type', kind: 'select', options: ['Checking', 'Savings', 'Cash', 'Credit Card', 'Wallet'] },
        { key: 'opening_balance', label: 'Starting balance (negative if you owe)', kind: 'number', required: true },
      ]}
      initial={{ name: s(record?.name), bank: s(record?.bank), last_four: s(record?.last_four), currency: record?.currency ?? cur, type: record?.type ?? 'Checking', opening_balance: record ? s(record.opening_balance) : '0' }}
      onSubmit={(v) => save('accounts', withId(record, { name: v.name.trim(), bank: v.bank.trim(), last_four: v.last_four.trim(), currency: v.currency, type: v.type, opening_balance: num(v.opening_balance), archived: record?.archived ?? false }))}
    />
  );
}

export function InvestmentForm({ visible, onClose, record }: P<Investment>) {
  const { save, data } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  return (
    <FormSheet visible={visible} onClose={onClose} title={record ? 'Edit investment' : 'New investment'} submitLabel="Save"
      fields={[
        { key: 'name', label: 'Name', kind: 'text', required: true },
        { key: 'currency', label: 'Currency', kind: 'select', options: currencies },
        { key: 'type', label: 'Type', kind: 'select', options: ['Stocks', 'Mutual Funds', 'Crypto', 'Gold', 'Real Estate', 'Bonds', 'Other'] },
        { key: 'platform', label: 'Platform / broker', kind: 'text', optional: true },
        { key: 'invested', label: 'Amount invested', kind: 'number', required: true },
        { key: 'current_value', label: 'Current value', kind: 'number', required: true },
        { key: 'quantity', label: 'Quantity / units', kind: 'number' },
        { key: 'purchase_price', label: 'Purchase price', kind: 'number' },
        { key: 'purchase_date', label: 'Purchase date', kind: 'date', required: true },
        { key: 'notes', label: 'Notes', kind: 'multiline', optional: true },
      ]}
      initial={{ name: s(record?.name), currency: record?.currency ?? cur, type: record?.type ?? 'Stocks', platform: s(record?.platform), invested: s(record?.invested), current_value: s(record?.current_value), quantity: s(record?.quantity), purchase_price: s(record?.purchase_price), purchase_date: record?.purchase_date ?? today(), notes: s(record?.notes) }}
      onSubmit={(v) => save('investments', withId(record, { name: v.name.trim(), currency: v.currency, type: v.type, platform: v.platform.trim(), invested: num(v.invested), current_value: num(v.current_value), quantity: nz(v.quantity) === null ? null : num(v.quantity), purchase_price: nz(v.purchase_price) === null ? null : num(v.purchase_price), purchase_date: v.purchase_date, notes: v.notes.trim() }))}
    />
  );
}

export function GoalForm({ visible, onClose, record }: P<Goal>) {
  const { save, data } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  return (
    <FormSheet visible={visible} onClose={onClose} title={record ? 'Edit goal' : 'New goal'} submitLabel="Save goal"
      fields={[
        { key: 'category', label: 'Category', kind: 'select', options: goalCategories },
        { key: 'currency', label: 'Currency', kind: 'select', options: currencies },
        { key: 'name', label: 'Goal name', kind: 'text', required: true },
        { key: 'target', label: 'Target', kind: 'number', required: true },
        { key: 'target_date', label: 'Target date', kind: 'date', optional: true },
        { key: 'saved', label: 'Already saved', kind: 'number' },
        { key: 'notes', label: 'Notes', kind: 'multiline', optional: true },
      ]}
      initial={{ category: record?.category ?? 'Emergency Fund', currency: record?.currency ?? cur, name: s(record?.name), target: s(record?.target), target_date: s(record?.target_date), saved: record ? s(record.saved) : '0', notes: s(record?.notes) }}
      onSubmit={(v) => save('goals', withId(record, { category: v.category, currency: v.currency, name: v.name.trim(), target: num(v.target), target_date: nz(v.target_date), saved: num(v.saved), notes: v.notes.trim() }))}
    />
  );
}

export function DebtForm({ visible, onClose, record }: P<Debt>) {
  const { save, data } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  return (
    <FormSheet visible={visible} onClose={onClose} title={record ? 'Edit debt' : 'Add debt'} submitLabel="Save debt"
      fields={[
        { key: 'direction', label: 'Direction', kind: 'select', options: ['I owe', 'Owed to me'] },
        { key: 'name', label: 'Name', kind: 'text', required: true },
        { key: 'currency', label: 'Currency', kind: 'select', options: currencies },
        { key: 'type', label: 'Type', kind: 'select', options: ['Personal Loan', 'Credit Card', 'Mortgage', 'Car Loan', 'Informal', 'Other'] },
        { key: 'lender', label: 'Lender', kind: 'text', optional: true },
        { key: 'original_amount', label: 'Original amount', kind: 'number', required: true },
        { key: 'outstanding', label: 'Outstanding now', kind: 'number', required: true },
        { key: 'interest_rate', label: 'Interest % / yr', kind: 'number' },
        { key: 'minimum_payment', label: 'Minimum payment', kind: 'number' },
        { key: 'frequency', label: 'Frequency', kind: 'select', options: ['Monthly', 'Weekly', 'Quarterly', 'Yearly'] },
        { key: 'due_day', label: 'Due day of month', kind: 'digits', required: true },
        { key: 'start_date', label: 'Start date', kind: 'date', optional: true },
        { key: 'payoff_by', label: 'Payoff by', kind: 'date', optional: true },
        { key: 'notes', label: 'Notes', kind: 'multiline', optional: true },
      ]}
      initial={{ direction: record?.direction === 'lent' ? 'Owed to me' : 'I owe', name: s(record?.name), currency: record?.currency ?? cur, type: record?.type ?? 'Personal Loan', lender: s(record?.lender), original_amount: s(record?.original_amount), outstanding: s(record?.outstanding), interest_rate: record ? s(record.interest_rate) : '0', minimum_payment: record ? s(record.minimum_payment) : '0', frequency: record?.frequency ?? 'Monthly', due_day: s(record?.due_day) || '1', start_date: s(record?.start_date), payoff_by: s(record?.payoff_by), notes: s(record?.notes) }}
      onSubmit={async (v) => {
        const d = Number(v.due_day);
        if (!(d >= 1 && d <= 31)) throw new Error('Due day must be between 1 and 31.');
        await save('debts', withId(record, { direction: v.direction === 'Owed to me' ? 'lent' : 'owed', name: v.name.trim(), currency: v.currency, type: v.type, lender: v.lender.trim(), original_amount: num(v.original_amount), outstanding: num(v.outstanding), interest_rate: num(v.interest_rate), minimum_payment: num(v.minimum_payment), frequency: v.frequency, due_day: d, start_date: nz(v.start_date), payoff_by: nz(v.payoff_by), notes: v.notes.trim() }));
      }}
    />
  );
}

export function BillForm({ visible, onClose, record }: P<Bill>) {
  const { save, data } = usePocket();
  const cur = data.profile?.primary_currency ?? 'PKR';
  return (
    <FormSheet visible={visible} onClose={onClose} title={record ? 'Edit bill' : 'New bill'} submitLabel="Save bill"
      fields={[
        { key: 'name', label: 'Bill name', kind: 'text', required: true },
        { key: 'amount', label: 'Amount', kind: 'number', required: true },
        { key: 'due_day', label: 'Due day of month', kind: 'digits', required: true },
        { key: 'repeats', label: 'Repeats', kind: 'select', options: ['Monthly', 'Weekly', 'Quarterly', 'Yearly', 'Once'] },
        { key: 'currency', label: 'Currency', kind: 'select', options: currencies },
        { key: 'category', label: 'Category', kind: 'select', options: outCategories },
      ]}
      initial={{ name: s(record?.name), amount: s(record?.amount), due_day: s(record?.due_day) || '1', repeats: record?.repeats ?? 'Monthly', currency: record?.currency ?? cur, category: record?.category ?? 'Utilities' }}
      onSubmit={async (v) => {
        const d = Number(v.due_day);
        if (!(d >= 1 && d <= 31)) throw new Error('Due day must be between 1 and 31.');
        await save('bills', withId(record, { name: v.name.trim(), amount: num(v.amount), due_day: d, repeats: v.repeats, currency: v.currency, category: v.category, paid: record?.paid ?? false, last_paid_at: record?.last_paid_at ?? null }));
      }}
    />
  );
}

export function TxForm({ visible, onClose, record }: P<Transaction>) {
  const { save, data } = usePocket();
  const accounts = data.accounts.filter((a) => !a.archived || a.id === record?.account_id);
  const labels = accountLabels(accounts);
  const idOf = (l: string) => accounts.find((a) => labels[a.id] === l)?.id ?? '';
  const [mode, setMode] = useState<'Money Out' | 'Money In' | 'Transfer'>('Money Out');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('PKR');
  const [category, setCategory] = useState<string>('Food');
  const [custom, setCustom] = useState<boolean>(false);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [note, setNote] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const lock = useRef<boolean>(false);
  const accRef = useRef(accounts);
  accRef.current = accounts;
  const defCur = data.profile?.primary_currency ?? 'PKR';
  const T = <A,>(fn: (v: A) => void) => (v: A) => { setDirty(true); fn(v); };

  useEffect(() => {
    if (!visible) return;
    setErr(null); setCustom(false); setDirty(false);
    if (record) {
      setMode(record.type === 'in' ? 'Money In' : record.type === 'out' ? 'Money Out' : 'Transfer');
      setAmount(String(record.amount)); setCurrency(record.currency); setCategory(record.category);
      setFrom(record.account_id); setTo(record.to_account_id ?? ''); setDate(record.date.slice(0, 10)); setNote(record.note ?? '');
    } else {
      const a = accRef.current[0];
      setMode('Money Out'); setAmount(''); setCurrency(a?.currency ?? defCur); setCategory('Food');
      setFrom(a?.id ?? ''); setTo(''); setDate(today()); setNote('');
    }
  }, [visible, record, defCur]);

  const linked = !!record && (!!record.bill_id || !!record.debt_id);
  const fromCur = accounts.find((a) => a.id === from)?.currency;
  const toOptions = accounts.filter((a) => a.id !== from && a.currency === fromCur);
  const cats = mode === 'Money In' ? inCategories : outCategories;
  const switchMode = (m: typeof mode) => { setDirty(true); setMode(m); setCustom(false); setCategory(m === 'Money In' ? 'Salary' : m === 'Money Out' ? 'Food' : 'Transfer'); if (m === 'Transfer') setTo(''); };
  const pickFrom = (id: string) => { setDirty(true); setFrom(id); const a = accounts.find((x) => x.id === id); if (a) setCurrency(a.currency); if (to === id) setTo(''); };

  const submit = async () => {
    if (lock.current) return;
    const amt = Number(amount);
    if (!linked) {
      if (!(amt > 0)) return setErr('Enter an amount greater than zero.');
      if (!from) return setErr('Choose an account first.');
      if (mode === 'Transfer' && (!to || to === from)) return setErr('Choose a different destination account.');
      if (mode === 'Transfer' && accounts.find((a) => a.id === to)?.currency !== fromCur) return setErr('Transfers are only allowed between accounts in the same currency.');
      if (mode === 'Transfer' && currency !== fromCur) return setErr('Transfer currency must match the account currency.');
      if (!category.trim()) return setErr('Choose or add a category.');
    }
    if (!isDate(date)) return setErr('Enter a valid date in YYYY-MM-DD format.');
    lock.current = true;
    setBusy(true); setErr(null);
    try {
      await save('transactions', withId(record, {
        type: mode === 'Money In' ? 'in' : mode === 'Money Out' ? 'out' : 'transfer', amount: linked ? record!.amount : amt, currency, category: category.trim(),
        account_id: from, to_account_id: mode === 'Transfer' ? to : null, date, note: note.trim(), bill_id: record?.bill_id ?? null, debt_id: record?.debt_id ?? null,
      }));
      setDirty(false);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); } finally { lock.current = false; setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={record ? 'Edit transaction' : 'Add transaction'} dirty={dirty} busy={busy}>
      {accounts.length === 0 ? <Banner kind="warn" message="Add an account first. Every transaction belongs to one." /> : null}
      {linked ? <Banner kind="warn" message="This entry is linked to a bill or debt payment. Its type, amount, account and category are locked; you can change the date and note." /> : null}
      {linked ? (
        <Txt v="h3">{record?.category}: {record?.amount} {record?.currency}</Txt>
      ) : (<>
      <Segmented options={['Money Out', 'Money In', 'Transfer'] as const} value={mode} onChange={switchMode} />
      <Field label="Amount" value={amount} onChangeText={T(setAmount)} keyboardType="decimal-pad" placeholder="0.00" />
      <View style={{ gap: 6 }}><Txt v="label" muted>Currency</Txt><Chips options={mode === 'Transfer' && fromCur ? [fromCur] : currencies} value={currency} onChange={T(setCurrency)} /></View>
      {mode !== 'Transfer' ? (
        <View style={{ gap: 6 }}>
          <Txt v="label" muted>Category</Txt>
          <Chips options={[...cats, ...(cats.includes(category) || custom || !category ? [] : [category])]} value={custom ? '' : category} onChange={T((c: string) => { setCustom(false); setCategory(c); })} />
          <Chips options={['Add custom']} value={custom ? 'Add custom' : ''} onChange={T(() => { setCustom(true); setCategory(''); })} />
          {custom ? <Field value={category} onChangeText={T(setCategory)} placeholder="Category name" autoFocus /> : null}
        </View>
      ) : null}
      <View style={{ gap: 6 }}>
        <Txt v="label" muted>{mode === 'Money In' ? 'To account' : 'From account'}</Txt>
        <Chips options={accounts.map((a) => labels[a.id])} value={labels[from] ?? ''} onChange={(l) => { const id = idOf(l); if (id) pickFrom(id); }} />
      </View>
      {mode === 'Transfer' ? (
        <View style={{ gap: 6 }}>
          <Txt v="label" muted>To account</Txt>
          {toOptions.length ? <Chips options={toOptions.map((a) => labels[a.id])} value={labels[to] ?? ''} onChange={T((l: string) => setTo(idOf(l)))} /> : <Txt v="small" muted>No other {fromCur ?? ''} account. Transfers only work between accounts in the same currency.</Txt>}
        </View>
      ) : null}
      </>)}
      <Field label="Date" value={date} onChangeText={T(setDate)} placeholder="YYYY-MM-DD" />
      <Field label="Note" value={note} onChangeText={T(setNote)} placeholder="Optional" />
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label="Save" loading={busy} disabled={accounts.length === 0} onPress={submit} />
    </Sheet>
  );
}

function AccountPicker({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  const labels = accountLabels(accounts);
  return <Chips options={accounts.map((a) => labels[a.id])} value={labels[value] ?? ''} onChange={(l) => { const a = accounts.find((x) => labels[x.id] === l); if (a) onChange(a.id); }} />;
}

export function PayBillSheet({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { data, payBill } = usePocket();
  const accounts = data.accounts.filter((a) => !a.archived);
  const [acc, setAcc] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const lock = useRef<boolean>(false);
  useEffect(() => { if (bill) { setErr(null); setAcc(accounts.find((a) => a.currency === bill.currency)?.id ?? accounts[0]?.id ?? ''); } }, [bill?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet visible={!!bill} onClose={onClose} title={`Pay ${bill?.name ?? ''}`} busy={busy}>
      <Txt muted>Choose the account this payment leaves. It will be recorded as a transaction.</Txt>
      {accounts.length === 0 ? <Banner kind="warn" message="Add an account before paying a bill." /> : <AccountPicker accounts={accounts} value={acc} onChange={setAcc} />}
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label="Mark as paid" loading={busy} disabled={!acc || !bill} onPress={async () => {
        if (!bill || lock.current) return;
        lock.current = true;
        setBusy(true); setErr(null);
        try { await payBill(bill, acc); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Payment failed.'); } finally { lock.current = false; setBusy(false); }
      }} />
    </Sheet>
  );
}

export function RepaySheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { data, repayDebt } = usePocket();
  const accounts = data.accounts.filter((a) => !a.archived);
  const [acc, setAcc] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const lock = useRef<boolean>(false);
  useEffect(() => { if (debt) { setErr(null); setDirty(false); setAmount(''); setDate(today()); setAcc(accounts.find((a) => a.currency === debt.currency)?.id ?? accounts[0]?.id ?? ''); } }, [debt?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lent = debt?.direction === 'lent';
  return (
    <Sheet visible={!!debt} onClose={onClose} title={lent ? 'Record repayment received' : 'Record a payment'} dirty={dirty} busy={busy}>
      <Field label={`Amount (${debt?.currency ?? ''})`} value={amount} onChangeText={(v) => { setDirty(true); setAmount(v); }} keyboardType="decimal-pad" placeholder="0.00" />
      <View style={{ gap: 6 }}>
        <Txt v="label" muted>{lent ? 'Into account' : 'From account'}</Txt>
        <AccountPicker accounts={accounts} value={acc} onChange={(id) => { setDirty(true); setAcc(id); }} />
      </View>
      <Field label="Date" value={date} onChangeText={(v) => { setDirty(true); setDate(v); }} placeholder="YYYY-MM-DD" />
      {err ? <Banner kind="error" message={err} /> : null}
      <Btn label="Save payment" loading={busy} disabled={!debt || accounts.length === 0} onPress={async () => {
        if (!debt || lock.current) return;
        const a = Number(amount);
        if (!(a > 0)) return setErr('Enter an amount greater than zero.');
        if (!acc) return setErr('Choose an account.');
        if (!isDate(date)) return setErr('Enter a valid date in YYYY-MM-DD format.');
        lock.current = true;
        setBusy(true); setErr(null);
        try { await repayDebt(debt, a, acc, date); setDirty(false); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not record payment.'); } finally { lock.current = false; setBusy(false); }
      }} />
    </Sheet>
  );
}

export type { Entity };
